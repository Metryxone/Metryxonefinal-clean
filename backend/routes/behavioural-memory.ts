/**
 * Career Operating System — Behavioural Memory routes (Phase 5 — Part D).
 *
 * Distinct from the Phase-3 in-memory `career-memory.ts` (transformation history
 * under /api/career/memory/*). This is a DB-backed longitudinal memory for the
 * Career Brain under its own namespace /api/career/behavioural-memory/* so it
 * never collides with the existing routes.
 *
 * Persists per-user snapshots of the aggregated brain state plus a raw
 * time-series of tracked behavioural elements (signals / patterns / interventions
 * / outcomes), and derives growth deltas:
 *
 *   improving_signals   signal strength rose since the previous snapshot
 *   worsening_signals   signal strength fell since the previous snapshot
 *   stable_patterns     pattern present in both snapshots at ~equal confidence
 *   emerging_patterns   pattern present in the latest snapshot but not before
 *
 * k-anonymity: everything here is strictly per-user (their own history). No cohort
 * aggregation, so peer-benchmark k-anonymity is untouched. Schema mirrors
 * backend/migrations/20260530_behavioural_memory.sql (no migration runner).
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { buildCareerBehaviorProfileForUser } from '../services/career-behavior-adapter';
import { buildBehaviorGraphForUser } from '../services/behavior-graph-service';
import { getInterventionRecommendations } from '../services/intervention-intelligence';

let schemaPromise: Promise<void> | null = null;
function ensureBehaviouralMemorySchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    // ── 1. capadex_behavioural_memory ────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capadex_behavioural_memory (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL,
        session_id  UUID,
        entry_type  VARCHAR(20) NOT NULL,
        entry_key   VARCHAR(160) NOT NULL,
        label       TEXT,
        strength    NUMERIC(6,4) NOT NULL DEFAULT 0,
        confidence  NUMERIC(6,4) NOT NULL DEFAULT 0,
        status      VARCHAR(40),
        meta        JSONB NOT NULL DEFAULT '{}',
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cbm_user      ON capadex_behavioural_memory (user_id, recorded_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cbm_user_type ON capadex_behavioural_memory (user_id, entry_type)`);

    // ── 2. career_memory_snapshots: create for new installs ──────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS career_memory_snapshots (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                TEXT NOT NULL,
        snapshot_at            TIMESTAMPTZ DEFAULT NOW(),
        ei_score               NUMERIC(6,2),
        current_stage          TEXT,
        target_role            TEXT,
        transition_probability NUMERIC(6,4),
        core_bottleneck        TEXT,
        market_readiness       NUMERIC(6,2),
        interview_readiness    NUMERIC(6,2),
        signals                JSONB DEFAULT '[]',
        patterns               JSONB DEFAULT '[]',
        interventions          JSONB DEFAULT '[]',
        outcomes               JSONB DEFAULT '[]',
        brain                  JSONB DEFAULT '{}'
      )`);

    // ── 3. Migrate existing installs: add columns the old schema was missing ─
    //    Each ALTER is idempotent (IF NOT EXISTS). Run these BEFORE the index.
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ DEFAULT NOW()`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS current_stage TEXT`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS target_role TEXT`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS transition_probability NUMERIC(6,4)`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS core_bottleneck TEXT`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS market_readiness NUMERIC(6,2)`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS interview_readiness NUMERIC(6,2)`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS signals JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS patterns JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS interventions JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS outcomes JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE career_memory_snapshots ADD COLUMN IF NOT EXISTS brain JSONB DEFAULT '{}'`);

    // ── 4. Backfill snapshot_at from captured_at for any pre-existing rows ───
    await pool.query(`
      UPDATE career_memory_snapshots
         SET snapshot_at = COALESCE(captured_at, created_at, NOW())
       WHERE snapshot_at IS NULL`);

    // ── 5. Index on snapshot_at (must come after column is guaranteed present) ─
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cms_user ON career_memory_snapshots (user_id, snapshot_at DESC)`);
  })();
  return schemaPromise;
}

type TrackedEl = { key: string; label?: string; strength?: number; confidence?: number; status?: string };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function asArray(v: unknown): TrackedEl[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      const key = String(o.key ?? o.signal_key ?? o.pattern_key ?? o.intervention_key ?? '').trim();
      if (!key) return null;
      return {
        key,
        label: o.label != null ? String(o.label) : undefined,
        strength: o.strength != null ? num(o.strength) : undefined,
        confidence: o.confidence != null ? num(o.confidence) : undefined,
        status: o.status != null ? String(o.status) : undefined,
      } as TrackedEl;
    })
    .filter((x): x is TrackedEl => Boolean(x));
}

const STRENGTH_EPS = 0.05;     // below this delta a signal is "stable", not improving/worsening
const CONFIDENCE_EPS = 0.08;   // pattern confidence drift tolerated as "stable"

/**
 * Behavioural memory is strictly per-user. The authenticated identity is the only
 * authority on whose history is read/written — never a client-supplied id. A
 * super admin may target another user (admin tooling); everyone else is pinned to
 * their own id, and an explicit cross-user request is rejected (no silent IDOR).
 */
export function resolveEffectiveUserId(req: Request, requestedRaw: unknown): { userId?: string; forbidden?: boolean } {
  const authUser = (req as any).user;
  const authId = authUser?.id != null ? String(authUser.id) : '';
  if (!authId) return {};
  const isSuperAdmin = authUser?.role === 'super_admin';
  const requested = requestedRaw != null ? String(requestedRaw).trim() : '';
  if (isSuperAdmin) return { userId: requested || authId };
  if (requested && requested !== authId) return { forbidden: true };
  return { userId: authId };
}

/**
 * Derive growth deltas by comparing the two most recent snapshots. With only one
 * snapshot every active pattern counts as emerging and nothing is improving yet.
 */
function computeGrowth(latest: any, prev: any | null) {
  const curSignals = asArray(latest?.signals);
  const prevSignals = asArray(prev?.signals);
  const curPatterns = asArray(latest?.patterns);
  const prevPatterns = asArray(prev?.patterns);

  const prevSignalByKey = new Map(prevSignals.map((s) => [s.key, s]));
  const prevPatternByKey = new Map(prevPatterns.map((p) => [p.key, p]));

  const improving_signals: TrackedEl[] = [];
  const worsening_signals: TrackedEl[] = [];
  for (const s of curSignals) {
    const before = prevSignalByKey.get(s.key);
    if (!before) continue; // brand-new signal: not yet a trend
    const delta = num(s.strength) - num(before.strength);
    if (delta > STRENGTH_EPS) improving_signals.push({ ...s, strength: Number(delta.toFixed(4)) });
    else if (delta < -STRENGTH_EPS) worsening_signals.push({ ...s, strength: Number(delta.toFixed(4)) });
  }

  const stable_patterns: TrackedEl[] = [];
  const emerging_patterns: TrackedEl[] = [];
  for (const p of curPatterns) {
    const before = prevPatternByKey.get(p.key);
    if (!before) { emerging_patterns.push(p); continue; }
    if (Math.abs(num(p.confidence) - num(before.confidence)) <= CONFIDENCE_EPS) stable_patterns.push(p);
  }

  return { improving_signals, worsening_signals, stable_patterns, emerging_patterns };
}

export function registerBehaviouralMemoryRoutes(app: Express, pool: Pool, requireAuth: RequestHandler) {
  // POST /api/career/behavioural-memory/snapshot — persist a Career Brain snapshot + time-series.
  app.post('/api/career/behavioural-memory/snapshot', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureBehaviouralMemorySchema(pool);
      const b = req.body ?? {};
      const resolved = resolveEffectiveUserId(req, b.userId ?? b.user_id);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      const signals = asArray(b.signals);
      const patterns = asArray(b.patterns);
      const interventions = asArray(b.interventions);
      const outcomes = asArray(b.outcomes);
      const sessionId = typeof b.session_id === 'string' && b.session_id ? b.session_id : null;

      const { rows: [snap] } = await pool.query(
        `INSERT INTO career_memory_snapshots
           (user_id, ei_score, current_stage, target_role, transition_probability,
            core_bottleneck, market_readiness, interview_readiness,
            signals, patterns, interventions, outcomes, brain)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb)
         RETURNING id, snapshot_at`,
        [
          userId,
          b.ei_score != null ? num(b.ei_score) : null,
          b.current_stage ?? null,
          b.target_role ?? null,
          b.transition_probability != null ? num(b.transition_probability) : null,
          b.core_bottleneck ?? null,
          b.market_readiness != null ? num(b.market_readiness) : null,
          b.interview_readiness != null ? num(b.interview_readiness) : null,
          JSON.stringify(signals),
          JSON.stringify(patterns),
          JSON.stringify(interventions),
          JSON.stringify(outcomes),
          JSON.stringify(b.brain ?? {}),
        ],
      );

      // Append the raw time-series rows (append-only; powers cross-snapshot trends).
      const rowsToInsert: Array<[string, string, string, string | null, number, number, string | null]> = [];
      const push = (type: string, els: TrackedEl[]) => {
        for (const e of els) rowsToInsert.push([userId, type, e.key, e.label ?? null, num(e.strength), num(e.confidence), e.status ?? null]);
      };
      push('signal', signals);
      push('pattern', patterns);
      push('intervention', interventions);
      push('outcome', outcomes);
      for (const r of rowsToInsert) {
        await pool.query(
          `INSERT INTO capadex_behavioural_memory
             (user_id, session_id, entry_type, entry_key, label, strength, confidence, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [r[0], sessionId, r[1], r[2], r[3], r[4], r[5], r[6]],
        );
      }

      return res.status(201).json({ ok: true, snapshot_id: snap.id, snapshot_at: snap.snapshot_at });
    } catch (err) { next(err); }
  });

  // GET /api/career/behavioural-memory/:userId — snapshots + computed growth deltas.
  app.get('/api/career/behavioural-memory/:userId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureBehaviouralMemorySchema(pool);
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      const { rows: snaps } = await pool.query(
        `SELECT id, snapshot_at, ei_score, current_stage, target_role, transition_probability,
                core_bottleneck, market_readiness, interview_readiness,
                signals, patterns, interventions, outcomes
           FROM career_memory_snapshots
          WHERE user_id = $1
          ORDER BY snapshot_at DESC
          LIMIT 24`,
        [userId],
      );

      const latest = snaps[0] ?? null;
      const prev = snaps[1] ?? null;
      const growth = latest
        ? computeGrowth(latest, prev)
        : { improving_signals: [], worsening_signals: [], stable_patterns: [], emerging_patterns: [] };

      return res.status(200).json({
        ok: true,
        user_id: userId,
        snapshot_count: snaps.length,
        latest_snapshot_at: latest?.snapshot_at ?? null,
        snapshots: snaps,
        growth,
      });
    } catch (err) { next(err); }
  });

  // GET /api/career/behavior-profile/:userId — CAPADEX behavioural intelligence
  // (Behavior Graph) distilled into a decision-ready CareerBehaviorProfile for the
  // Career OS. Read-only; neutral profile when no CAPADEX session is linked.
  app.get('/api/career/behavior-profile/:userId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      const { profile, session_id } = await buildCareerBehaviorProfileForUser(pool, userId);
      return res.status(200).json({ ok: true, user_id: userId, session_id, profile });
    } catch (err) { next(err); }
  });

  // GET /api/career/behavior-graph/:userId — the Unified Behavior Graph for a user
  // (Career OS — P2). Read-only over the already-persisted graph; null graph +
  // session_id:null when no CAPADEX session is linked yet (callers degrade safely).
  app.get('/api/career/behavior-graph/:userId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      const { graph, session_id } = await buildBehaviorGraphForUser(pool, userId);
      return res.status(200).json({ ok: true, user_id: userId, session_id, graph });
    } catch (err) { next(err); }
  });

  // GET /api/career/next-actions/:userId — the persisted, library-backed Top-5 Best
  // Next Actions for a user (Career OS — P4). Read-only: bridges user → latest CAPADEX
  // session (same bridge as the Behavior Graph) and reads back the already-ranked
  // recommendations produced on session completion (`intervention-intelligence.ts`).
  // Empty `actions` (never a generic recommendation) when no session is linked or no
  // library-backed candidate mapped — callers degrade to local heuristics.
  app.get('/api/career/next-actions/:userId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      // Bridge user → latest session via the existing graph bridge (no new bridge).
      const { session_id } = await buildBehaviorGraphForUser(pool, userId);
      const actions = session_id ? await getInterventionRecommendations(pool, session_id) : [];
      return res.status(200).json({ ok: true, user_id: userId, session_id, actions });
    } catch (err) { next(err); }
  });
}
