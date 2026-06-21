/**
 * Phase 6.13 — Automation execution (sub-flag `automationExecution`, default OFF).
 *
 * getExecutionStatus: READ-ONLY posture of the automation_* tables (to_regclass probes, never-throws).
 * enqueueAutomationRun: the ADDITIVE write path — records INTENT into automation_runs only. It NEVER
 * dispatches emails or external actions (executed_count stays 0). Gated by automationExecution; the
 * caller (route) must verify the flag before invoking. DDL is NOT done here (POST /console/setup owns it).
 */
import pg from 'pg';
import { AUTOMATION_TYPES, computeEligibleForType } from './automation-engine';
import { AUTOMATION_TABLES } from './automation-schema';

const N = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

export interface ExecutionStatus {
  generated_at: string;
  schema_ready: boolean;
  tables: { table: string; exists: boolean; row_count: number | null }[];
  last_run: any | null;
  notes: string[];
}

export async function getExecutionStatus(pool: pg.Pool): Promise<ExecutionStatus> {
  const generated_at = new Date().toISOString();
  const tables: ExecutionStatus['tables'] = [];
  for (const t of AUTOMATION_TABLES) {
    const exists = await tableExists(pool, t);
    let rowCount: number | null = null;
    if (exists) {
      try { const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`); rowCount = N(r.rows[0]?.n); }
      catch { rowCount = null; }
    }
    tables.push({ table: t, exists, row_count: rowCount });
  }
  const schema_ready = tables.every((t) => t.exists);

  let lastRun: any | null = null;
  if (await tableExists(pool, 'automation_runs')) {
    try {
      const r = await pool.query(
        `SELECT id, automation_key, automation_type, status, eligible_count, executed_count, dry_run, created_at
         FROM automation_runs ORDER BY created_at DESC LIMIT 1`);
      lastRun = r.rows[0] ?? null;
    } catch { /* honest null */ }
  }

  return {
    generated_at,
    schema_ready,
    tables,
    last_run: lastRun,
    notes: [
      schema_ready ? 'All automation tables provisioned.' : 'Some automation tables are missing — run POST /console/setup.',
      'Runs are intent-only: enqueue records what WOULD fire; no emails or external side effects are dispatched here.',
    ],
  };
}

export interface EnqueueResult {
  ok: boolean;
  run: any | null;
  eligible_now: number | null;
  automation_type: string;
  message: string;
}

/**
 * Records an intent-only automation run. Throws if schema is missing (caller runs setup first) — the
 * route translates that into a clear error. Sub-flag check is the caller's responsibility.
 */
export async function enqueueAutomationRun(
  pool: pg.Pool,
  automationKey: string,
): Promise<EnqueueResult> {
  const spec = AUTOMATION_TYPES.find((t) => t.key === automationKey);
  if (!spec) {
    return { ok: false, run: null, eligible_now: null, automation_type: automationKey,
      message: `Unknown automation type "${automationKey}".` };
  }
  if (!(await tableExists(pool, 'automation_runs'))) {
    return { ok: false, run: null, eligible_now: null, automation_type: automationKey,
      message: 'automation_runs not provisioned — run POST /console/setup first.' };
  }

  const { eligible_now } = await computeEligibleForType(pool, spec);
  const summary = {
    intent: 'enqueued',
    note: 'Intent-only run — no external actions dispatched. executed_count remains 0 until an external executor is wired.',
    eligible_source: spec.sources.map((s) => s.table),
  };
  const ins = await pool.query(
    `INSERT INTO automation_runs (automation_key, automation_type, status, eligible_count, executed_count, dry_run, summary)
     VALUES ($1, $2, 'queued', $3, 0, true, $4::jsonb)
     RETURNING id, automation_key, automation_type, status, eligible_count, executed_count, dry_run, summary, created_at`,
    [spec.key, spec.key, eligible_now, JSON.stringify(summary)]);

  return {
    ok: true,
    run: ins.rows[0],
    eligible_now,
    automation_type: spec.key,
    message: `Recorded intent-only run for "${spec.label}" (${eligible_now == null ? 'eligibility unmeasurable' : eligible_now + ' eligible now'}).`,
  };
}
