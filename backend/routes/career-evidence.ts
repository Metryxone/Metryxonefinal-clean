/**
 * Career Builder — First Outcome Evidence Loop
 * Prefix: /api/career/outcomes*       (user-facing, authenticated)
 *         /api/admin/career-evidence/* (superadmin)
 *
 * Closes a single score -> real-outcome -> validated-claim loop on Career Builder:
 *   1. CAPTURE  real observed outcomes (goal achieved / EI lift / role change),
 *      each stamped with the prior score that preceded it + provenance.
 *   2. VALIDATE by linking prior score to observed outcome and reporting n +
 *      confidence honestly. Demo/synthetic rows can NEVER be presented as validated.
 *
 * Flag-gated (careerOutcomeEvidence). OFF -> every route 503s, the goal hook is a
 * no-op, and no table is created -> byte-identical legacy.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { isCareerOutcomeEvidenceEnabled } from '../config/feature-flags';
import { computeEvidence, MIN_VALIDATION_N, type OutcomePair } from '../services/career-evidence-engine';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  const p = path.join(__dirname, '../migrations/20260618_career_outcomes.sql');
  if (fs.existsSync(p)) {
    await pool.query(fs.readFileSync(p, 'utf8')); // fail-closed on DDL error
  }
  await pool.query('SELECT 1 FROM career_outcomes LIMIT 1');
  schemaReady = true;
}

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isCareerOutcomeEvidenceEnabled()) {
    return res.status(503).json({ ok: false, error: 'career_outcome_evidence_disabled' });
  }
  next();
}

function resolveUserId(req: Request): string | null {
  const u = (req as Request & { user?: { id?: string; userId?: string } }).user;
  if (u?.id) return String(u.id);
  if (u?.userId) return String(u.userId);
  return null;
}

const VALID_TYPES = new Set(['goal_achieved', 'ei_lift', 'role_change', 'promotion', 'hire']);
const CONTINUOUS_TYPES = new Set(['ei_lift']);

/** Resolve the most-recent prior score for a user (readiness preferred, then EI). */
async function resolvePriorScore(
  pool: Pool,
  userId: string,
  before?: Date,
): Promise<{ type: string; value: number; at: Date } | null> {
  const beforeClause = before ? 'AND computed_at <= $2' : '';
  const params: unknown[] = before ? [userId, before] : [userId];
  // 1. Career-graph role readiness
  const r = await pool
    .query(
      `SELECT readiness_score AS v, computed_at AS at FROM cg_user_role_readiness
       WHERE user_id = $1 AND readiness_score IS NOT NULL ${beforeClause}
       ORDER BY computed_at DESC LIMIT 1`,
      params,
    )
    .catch(() => ({ rows: [] as Array<{ v: number; at: Date }> }));
  if (r.rows[0]) return { type: 'readiness', value: Number(r.rows[0].v), at: r.rows[0].at };
  return null;
}

/**
 * Capture an outcome row idempotently (keyed on outcome_type + ref_id when present).
 * Exported so the goal-completion hook in career-seeker.ts can call it fire-and-forget.
 */
export async function captureCareerOutcome(
  pool: Pool,
  args: {
    userId: string;
    outcomeType: string;
    outcomeValue: number;
    outcomeKind?: 'binary' | 'continuous';
    priorScoreType?: string | null;
    priorScoreValue?: number | null;
    priorScoreAt?: Date | null;
    source: string;
    isDemo?: boolean;
    refId?: string | null;
    detail?: Record<string, unknown>;
    observedAt?: Date;
  },
): Promise<void> {
  if (!isCareerOutcomeEvidenceEnabled()) return; // flag OFF -> no-op
  await ensureSchema(pool);
  const kind = args.outcomeKind ?? (CONTINUOUS_TYPES.has(args.outcomeType) ? 'continuous' : 'binary');
  await pool.query(
    `INSERT INTO career_outcomes
       (user_id, outcome_type, outcome_kind, outcome_value, prior_score_type,
        prior_score_value, prior_score_at, observed_at, source, is_demo, ref_id, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET
       outcome_value = EXCLUDED.outcome_value,
       prior_score_type = EXCLUDED.prior_score_type,
       prior_score_value = EXCLUDED.prior_score_value,
       prior_score_at = EXCLUDED.prior_score_at,
       observed_at = EXCLUDED.observed_at`,
    [
      args.userId,
      args.outcomeType,
      kind,
      args.outcomeValue,
      args.priorScoreType ?? null,
      args.priorScoreValue ?? null,
      args.priorScoreAt ?? null,
      args.observedAt ?? new Date(),
      args.source,
      args.isDemo ?? false,
      args.refId ?? null,
      JSON.stringify(args.detail ?? {}),
    ],
  );
}

/**
 * Hook invoked when a goal is marked completed. Records a real `goal_achieved`
 * outcome (binary=1) stamped with the user's prior score. Idempotent on goal id.
 * Marked demo when the originating goal is itself demo-seeded so it never pollutes
 * the validated cohort.
 */
export async function onGoalCompleted(
  pool: Pool,
  args: { userId: string; goalId: string; source?: string; isDemo?: boolean },
): Promise<void> {
  if (!isCareerOutcomeEvidenceEnabled()) return;
  try {
    const prior = await resolvePriorScore(pool, args.userId);
    await captureCareerOutcome(pool, {
      userId: args.userId,
      outcomeType: 'goal_achieved',
      outcomeValue: 1,
      outcomeKind: 'binary',
      priorScoreType: prior?.type ?? null,
      priorScoreValue: prior?.value ?? null,
      priorScoreAt: prior?.at ?? null,
      source: args.source ?? 'goal_completion_hook',
      isDemo: args.isDemo ?? false,
      refId: args.goalId,
      detail: { capturedBy: 'goal_completion_hook' },
    });
  } catch (err) {
    console.warn('[career-evidence] onGoalCompleted:', err instanceof Error ? err.message : String(err));
  }
}

const adminCache = new Map<string, { ts: number; data: unknown }>();
function adminCached<T>(key: string, bust: boolean, fn: () => Promise<T>): Promise<T> {
  const e = adminCache.get(key);
  if (!bust && e && Date.now() - e.ts < 60_000) return Promise.resolve(e.data as T);
  return fn().then((data) => { adminCache.set(key, { ts: Date.now(), data }); return data; });
}

export function registerCareerEvidenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
): void {
  if (isCareerOutcomeEvidenceEnabled()) {
    ensureSchema(pool).catch((err) =>
      console.warn('[career-evidence] startup schema:', err instanceof Error ? err.message : String(err)),
    );
  }

  app.use('/api/career/outcomes', flagGate, async (_req, res, next) => {
    try { await ensureSchema(pool); next(); } catch (err) { res.status(503).json({ ok: false, error: String((err as Error).message) }); }
  });
  app.use('/api/admin/career-evidence', flagGate, async (_req, res, next) => {
    try { await ensureSchema(pool); next(); } catch (err) { res.status(503).json({ ok: false, error: String((err as Error).message) }); }
  });

  // ── USER: list own outcomes ────────────────────────────────────────────────
  app.get('/api/career/outcomes', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'not_authenticated' });
      const r = await pool.query(
        `SELECT id, outcome_type, outcome_kind, outcome_value, prior_score_type,
                prior_score_value, prior_score_at, observed_at, source, is_demo, detail
         FROM career_outcomes WHERE user_id = $1 ORDER BY observed_at DESC LIMIT 200`,
        [userId],
      );
      res.json({ ok: true, outcomes: r.rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── USER: manually record a real outcome for self ──────────────────────────
  app.post('/api/career/outcomes', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'not_authenticated' });
      const b = (req.body ?? {}) as Record<string, unknown>;
      const outcomeType = String(b.outcomeType ?? '');
      if (!VALID_TYPES.has(outcomeType)) {
        return res.status(400).json({ ok: false, error: 'invalid_outcome_type', allowed: [...VALID_TYPES] });
      }
      const outcomeValue = Number(b.outcomeValue);
      if (!Number.isFinite(outcomeValue)) return res.status(400).json({ ok: false, error: 'invalid_outcome_value' });
      const prior = await resolvePriorScore(pool, userId);
      await captureCareerOutcome(pool, {
        userId,
        outcomeType,
        outcomeValue,
        outcomeKind: CONTINUOUS_TYPES.has(outcomeType) ? 'continuous' : 'binary',
        priorScoreType: prior?.type ?? null,
        priorScoreValue: prior?.value ?? null,
        priorScoreAt: prior?.at ?? null,
        source: 'manual',
        isDemo: false,
        refId: typeof b.refId === 'string' ? b.refId : null,
        detail: typeof b.detail === 'object' && b.detail ? (b.detail as Record<string, unknown>) : {},
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── ADMIN: summary of captured outcomes (real vs demo) ─────────────────────
  app.get('/api/admin/career-evidence/summary', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const bust = req.query.refresh === '1';
      const data = await adminCached('summary', bust, async () => {
        const total = await pool.query('SELECT count(*)::int n FROM career_outcomes');
        const real = await pool.query('SELECT count(*)::int n FROM career_outcomes WHERE is_demo = false');
        const demo = await pool.query('SELECT count(*)::int n FROM career_outcomes WHERE is_demo = true');
        const byType = await pool.query(
          `SELECT outcome_type, is_demo, count(*)::int n FROM career_outcomes
           GROUP BY outcome_type, is_demo ORDER BY outcome_type`,
        );
        const users = await pool.query('SELECT count(DISTINCT user_id)::int n FROM career_outcomes WHERE is_demo = false');
        return {
          totalOutcomes: total.rows[0].n,
          realOutcomes: real.rows[0].n,
          demoOutcomes: demo.rows[0].n,
          distinctRealUsers: users.rows[0].n,
          byType: byType.rows,
        };
      });
      res.json({ ok: true, ...data });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── ADMIN: backfill goal_achieved outcomes from existing completed goals ────
  // Reads the REAL career_seeker_goals.completed flag. Demo-seeded goals are
  // captured but flagged is_demo so they never enter the validated cohort.
  app.post('/api/admin/career-evidence/backfill', requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const goals = await pool.query(
        `SELECT id, user_id, data, updated_at FROM career_seeker_goals WHERE completed = true`,
      );
      let captured = 0;
      for (const g of goals.rows as Array<{ id: string; user_id: string; data: Record<string, unknown>; updated_at: Date }>) {
        const src = String((g.data ?? {}).source ?? '');
        const isDemo = /demo/i.test(src);
        const prior = await resolvePriorScore(pool, g.user_id, g.updated_at);
        await captureCareerOutcome(pool, {
          userId: g.user_id,
          outcomeType: 'goal_achieved',
          outcomeValue: 1,
          outcomeKind: 'binary',
          priorScoreType: prior?.type ?? null,
          priorScoreValue: prior?.value ?? null,
          priorScoreAt: prior?.at ?? null,
          source: 'backfill',
          isDemo,
          refId: g.id,
          observedAt: g.updated_at,
          detail: { capturedBy: 'backfill', goalSource: src || null },
        });
        captured++;
      }
      adminCache.clear();
      res.json({ ok: true, completedGoalsFound: goals.rows.length, captured });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── ADMIN: the validation engine — link prior score -> observed outcome ────
  app.get('/api/admin/career-evidence/validation', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const outcomeType = String(req.query.outcome_type ?? 'goal_achieved');
      const priorScoreType = String(req.query.prior_score_type ?? 'readiness');
      if (!VALID_TYPES.has(outcomeType)) {
        return res.status(400).json({ ok: false, error: 'invalid_outcome_type', allowed: [...VALID_TYPES] });
      }
      const kind: 'binary' | 'continuous' = CONTINUOUS_TYPES.has(outcomeType) ? 'continuous' : 'binary';
      const bust = req.query.refresh === '1';

      const data = await adminCached(`val:${outcomeType}:${priorScoreType}`, bust, async () => {
        const rows = await pool.query(
          `SELECT outcome_value, prior_score_value, is_demo FROM career_outcomes
           WHERE outcome_type = $1 AND prior_score_type = $2 AND prior_score_value IS NOT NULL`,
          [outcomeType, priorScoreType],
        );
        const realPairs: OutcomePair[] = [];
        const demoPairs: OutcomePair[] = [];
        for (const r of rows.rows as Array<{ outcome_value: string; prior_score_value: string; is_demo: boolean }>) {
          const pair = { priorScore: Number(r.prior_score_value), outcomeValue: Number(r.outcome_value) };
          (r.is_demo ? demoPairs : realPairs).push(pair);
        }
        // For a binary outcome, "not achieved" subjects also count: derive them from
        // the scored population that has NO achieved outcome of this type. This keeps
        // the cohort honest (achievers vs a real control), not just positive events.
        if (kind === 'binary') {
          const control = await pool.query(
            `SELECT rd.user_id, rd.readiness_score AS v
             FROM cg_user_role_readiness rd
             WHERE rd.readiness_score IS NOT NULL
               -- exclude obvious demo/seed identities so the REAL cohort stays real
               AND rd.user_id NOT ILIKE 'demo%'
               AND rd.user_id NOT ILIKE '%@example.com'
               AND rd.user_id NOT IN (
                 SELECT user_id FROM career_outcomes
                 WHERE outcome_type = $1 AND is_demo = false
               )`,
            [outcomeType],
          ).catch(() => ({ rows: [] as Array<{ user_id: string; v: string }> }));
          for (const c of control.rows as Array<{ user_id: string; v: string }>) {
            realPairs.push({ priorScore: Number(c.v), outcomeValue: 0 });
          }
        }

        const real = computeEvidence(realPairs, kind, true);
        const demo = computeEvidence(demoPairs, kind, false);
        return {
          outcomeType,
          priorScoreType,
          minValidationN: MIN_VALIDATION_N,
          real,
          demoPreview: demo,
          headline: {
            claim:
              real.status === 'VALIDATED'
                ? `Prior ${priorScoreType} score is significantly associated with ${outcomeType} (n=${real.n}, p=${real.pValue?.toFixed(4)}).`
                : 'No validated score -> outcome claim yet. Validity floor stands until real outcomes accrue.',
            validated: real.validated,
            status: real.status,
          },
        };
      });
      res.json({ ok: true, ...data });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  // ── ADMIN: seed a clearly-labelled SYNTHETIC demo cohort ───────────────────
  // Demonstrates the loop end-to-end. Every row is is_demo=true + @example.com and
  // can NEVER be presented as validated by the engine. Idempotent (DELETE+reinsert).
  app.post('/api/admin/career-evidence/seed-demo', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const nReq = Math.max(10, Math.min(200, Number(req.query.n ?? 40) || 40));
      await pool.query(`DELETE FROM career_outcomes WHERE is_demo = true AND source = 'demo_seed'`);
      // Deterministic pseudo-random so reruns are stable.
      let seed = 12345;
      const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const base = new Date('2026-01-01T00:00:00Z').getTime();
      for (let i = 0; i < nReq; i++) {
        const prior = 35 + rng() * 55; // readiness 35..90
        // mild, NOISY positive link (illustrative only) — higher prior -> more likely achieve
        const prob = Math.min(0.95, Math.max(0.05, (prior - 35) / 55 * 0.6 + 0.2));
        const achieved = rng() < prob ? 1 : 0;
        const observed = new Date(base + i * 86_400_000);
        await captureCareerOutcome(pool, {
          userId: `demo-evidence-${i + 1}@example.com`,
          outcomeType: 'goal_achieved',
          outcomeValue: achieved,
          outcomeKind: 'binary',
          priorScoreType: 'readiness',
          priorScoreValue: Math.round(prior * 10) / 10,
          priorScoreAt: observed,
          source: 'demo_seed',
          isDemo: true,
          refId: `demo-evidence-${i + 1}`,
          observedAt: observed,
          detail: { synthetic: true, note: 'Illustrative demo cohort — NOT real-world evidence.' },
        });
      }
      adminCache.clear();
      res.json({ ok: true, seeded: nReq, note: 'Synthetic demo cohort (is_demo=true) — never presented as validated.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: String((err as Error).message) });
    }
  });

  console.log('[career-evidence] First Outcome Evidence Loop routes registered (flag careerOutcomeEvidence)');
}
