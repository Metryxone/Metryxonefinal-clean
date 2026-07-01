/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Operational Readiness.
 *
 * Additive, flag-gated (`operationalReadiness`) AI COST + TOKEN ACCOUNTING.
 * Closes GAP-OPS-4 (per-request AI token usage + cost were not accounted).
 *
 * `recordAiTokenUsage()` is a fire-and-forget hook called from `aiClient.chatJSON` with the
 * real OpenAI `usage` object. Byte-identical OFF: returns immediately (no DB, no table).
 * Persists prompt/completion/total tokens + a computed USD cost to `ops_ai_token_usage`.
 * Cost is computed from a published price map; an UNKNOWN model persists a NULL cost
 * (honest — never fabricated) while still recording token volume.
 */
import pg from 'pg';
import { isOperationalReadinessEnabled } from '../../config/feature-flags';

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

// USD per 1K tokens {input, output}. Extend as models change; unknown → null cost.
const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  'gpt-4.1-mini': { in: 0.0004, out: 0.0016 },
  'gpt-4.1': { in: 0.002, out: 0.008 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4o': { in: 0.0025, out: 0.01 },
};

function computeCostUsd(model: string, u: TokenUsage): number | null {
  const p = PRICE_PER_1K[model];
  if (!p) return null; // unknown model → honest NULL cost (never fabricated)
  const pin = (u.prompt_tokens ?? 0) / 1000;
  const pout = (u.completion_tokens ?? 0) / 1000;
  return Math.round((pin * p.in + pout * p.out) * 1e6) / 1e6;
}

let pool: pg.Pool | null = null;
let schemaReady = false;
function getPool(): pg.Pool | null {
  if (pool) return pool;
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;
  pool = new pg.Pool({ connectionString: conn, max: 2 });
  return pool;
}

async function ensureSchema(p: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await p.query(`CREATE TABLE IF NOT EXISTS ops_ai_token_usage (
    id bigserial PRIMARY KEY,
    model text NOT NULL,
    prompt_tokens int,
    completion_tokens int,
    total_tokens int,
    cost_usd numeric(14,6),          -- NULL when the model's price is unknown (honest)
    surface text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  schemaReady = true;
}

/** Fire-and-forget token/cost persistence. No-op (byte-identical) when the flag is OFF. */
export function recordAiTokenUsage(model: string, usage: TokenUsage | undefined | null, surface?: string): void {
  if (!isOperationalReadinessEnabled()) return;
  if (!usage) return;
  const p = getPool();
  if (!p) return;
  const cost = computeCostUsd(model, usage);
  void (async () => {
    try {
      await ensureSchema(p);
      await p.query(
        `INSERT INTO ops_ai_token_usage (model, prompt_tokens, completion_tokens, total_tokens, cost_usd, surface)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [model, usage.prompt_tokens ?? null, usage.completion_tokens ?? null, usage.total_tokens ?? null, cost, surface ?? null],
      );
    } catch {
      /* accounting must never break an AI call */
    }
  })();
}

async function tableReady(p: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await p.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    return !!(r.rows[0] && r.rows[0].t);
  } catch {
    return false;
  }
}

/** Aggregate token/cost usage (uses the caller's pool). null ≠ 0 when absent. */
export async function getAiTokenUsageSummary(callerPool: pg.Pool) {
  if (!(await tableReady(callerPool, 'ops_ai_token_usage'))) {
    return { ready: false, note: 'AI token-usage table absent until first AI call (flag-ON). null ≠ 0.' };
  }
  const totals = await callerPool.query(
    `SELECT count(*)::int AS calls,
            sum(prompt_tokens)::bigint AS prompt_tokens,
            sum(completion_tokens)::bigint AS completion_tokens,
            sum(total_tokens)::bigint AS total_tokens,
            round(sum(cost_usd)::numeric, 6) AS cost_usd
     FROM ops_ai_token_usage`,
  );
  const byModel = await callerPool.query(
    `SELECT model, count(*)::int AS calls, sum(total_tokens)::bigint AS total_tokens,
            round(sum(cost_usd)::numeric, 6) AS cost_usd
     FROM ops_ai_token_usage GROUP BY model ORDER BY total_tokens DESC NULLS LAST`,
  );
  return { ready: true, totals: totals.rows[0], by_model: byModel.rows };
}
