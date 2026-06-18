/**
 * CAPADEX WC-3 L4 — Personalization Wiring (Phase A).
 *
 * WIRING + OBSERVABILITY ONLY. When enabled, the clarity picker additively
 * attaches a `personalization` provenance envelope describing the dimensions that
 * were available to personalize the selection (age / age-band / persona / proxy /
 * severity / construct / clarity_source), plus a `personalized:true` marker, and
 * fire-and-forget records the decision. It DOES NOT re-order or change which
 * questions are selected — selection stays byte-identical to legacy. (Active
 * re-ranking is a deliberately deferred later phase.)
 *
 * Strictly additive + never-throws: callers gate on `isWc3PersonalizationEnabled()`.
 */
import type { Pool } from 'pg';
import { ensureWc3PersonalizationSchema } from './wc3-schema';

/** Coarse persona → canonical cohort label (read-only; mirrors picker cohorts). */
function canonicalPersona(primaryPersona: string | null | undefined): string | null {
  if (!primaryPersona) return null;
  const p = String(primaryPersona).toLowerCase();
  if (p.includes('parent')) return 'parent';
  if (p.includes('teacher') || p.includes('educator')) return 'teacher';
  if (p.includes('counsel') || p.includes('coach')) return 'counselor';
  if (p.includes('student') || p.includes('self') || p.includes('learner')) return 'self';
  return p;
}

export interface PersonalizationContext {
  sessionId?: string | null;
  userEmail?: string | null;
  masterConcernId?: string | null;
  constructKey?: string | null;
  claritySource?: string | null;
  age?: number | null;
  ageBand?: string | null;
  primaryPersona?: string | null;
  isProxy?: boolean | null;
  severity?: string | null;
  questionCount?: number;
}

export interface PersonalizationEnvelope {
  personalized: true;
  personalization: {
    flag_active: true;
    generated_at: string;
    clarity_source: string | null;
    question_count: number;
    dims_used: {
      age: number | null;
      age_band: string | null;
      canonical_persona: string | null;
      is_proxy: boolean | null;
      severity: string | null;
      construct_key: string | null;
    };
    active_dimensions: string[];
    note: string;
  };
}

/** Pure: build the provenance envelope. No DB, no side effects, never throws. */
export function buildPersonalizationEnvelope(ctx: PersonalizationContext): PersonalizationEnvelope {
  const dims = {
    age: Number.isFinite(ctx.age as number) ? Number(ctx.age) : null,
    age_band: ctx.ageBand ?? null,
    canonical_persona: canonicalPersona(ctx.primaryPersona),
    is_proxy: ctx.isProxy ?? null,
    severity: ctx.severity ?? null,
    construct_key: ctx.constructKey ?? null,
  };
  const active_dimensions = Object.entries(dims)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k]) => k);
  return {
    personalized: true,
    personalization: {
      flag_active: true,
      generated_at: new Date().toISOString(),
      clarity_source: ctx.claritySource ?? null,
      question_count: ctx.questionCount ?? 0,
      dims_used: dims,
      active_dimensions,
      note: 'WC-3 L1 Phase A: provenance/observability only — selection order is unchanged.',
    },
  };
}

/**
 * Fire-and-forget: persist the personalization decision (append-only) and refresh
 * the latest-profile row. Never throws — failures are logged and swallowed so the
 * /analyze hot path is never affected.
 */
export async function logPersonalizationDecision(pool: Pool, ctx: PersonalizationContext): Promise<void> {
  try {
    await ensureWc3PersonalizationSchema(pool);
    const persona = canonicalPersona(ctx.primaryPersona);
    const age = Number.isFinite(ctx.age as number) ? Number(ctx.age) : null;
    const dims = {
      age, age_band: ctx.ageBand ?? null, canonical_persona: persona,
      is_proxy: ctx.isProxy ?? null, severity: ctx.severity ?? null,
      construct_key: ctx.constructKey ?? null,
    };
    await pool.query(
      `INSERT INTO wc3_personalization_decisions
         (session_id, user_email, master_concern_id, construct_key, clarity_source,
          age, age_band, canonical_persona, is_proxy, severity, question_count, dims_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        ctx.sessionId ?? null, ctx.userEmail ?? null, ctx.masterConcernId ?? null,
        ctx.constructKey ?? null, ctx.claritySource ?? null, age, ctx.ageBand ?? null,
        persona, ctx.isProxy ?? null, ctx.severity ?? null, ctx.questionCount ?? 0,
        JSON.stringify(dims),
      ],
    );
    if (ctx.userEmail) {
      await pool.query(
        `INSERT INTO wc3_personalization_profile
           (user_email, last_age, last_age_band, last_persona, last_construct, dims_used, decisions_count, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,1, now())
         ON CONFLICT (user_email) DO UPDATE SET
           last_age = EXCLUDED.last_age,
           last_age_band = EXCLUDED.last_age_band,
           last_persona = EXCLUDED.last_persona,
           last_construct = EXCLUDED.last_construct,
           dims_used = EXCLUDED.dims_used,
           decisions_count = wc3_personalization_profile.decisions_count + 1,
           updated_at = now()`,
        [ctx.userEmail, age, ctx.ageBand ?? null, persona, ctx.constructKey ?? null, JSON.stringify(dims)],
      );
    }
  } catch (err) {
    console.warn('[wc3-personalization] logPersonalizationDecision failed (non-blocking):', err instanceof Error ? err.message : String(err));
  }
}
