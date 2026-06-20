/**
 * PHASE 4.8 — Scenario Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the Career Simulation
 * engine (career-simulation-engine.ts) to run a small set of DETERMINISTIC,
 * pre-defined "what-if" scenarios for a subject and rank them by impact, plus
 * the append-only persistence for simulation runs (career_simulation_runs).
 *
 * Scenarios are derived deterministically from the subject's OWN measured
 * baseline (no randomness, no fabricated levels):
 *   - close_top_gap        — raise the subject's weakest measured domain by +1.
 *   - all_domains_plus_one  — raise every measured domain by +1.
 *   - reach_proficient      — hypothetically reach level 4 across every
 *                             measurable domain (an explicit target, clearly
 *                             flagged as hypothetical).
 *   - trajectory_continues  — project the current growth trend forward (Future
 *                             Projection engine) and simulate those levels.
 *
 * Honesty contract (non-negotiable):
 *   - COMPOSES the simulation engine — every score is from getRoleReadiness; this
 *     layer only orchestrates change-sets and ranks the resulting envelopes.
 *   - The baseline context is loaded ONCE and reused across all scenarios (no
 *     redundant recompute; the canonical baseline readiness is shared).
 *   - Simulated/target levels are HYPOTHETICAL and clearly labelled; with no
 *     measured baseline the scenarios are honestly unmeasurable, never faked.
 *   - Read-only & never-throws on the compose path. ZERO DDL on a read — the
 *     ONLY write path is persistSimulationRun (an explicit POST), which lazily
 *     ensures the append-only schema behind the flag gate.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion predictions.
 */

import type { Pool } from 'pg';
import {
  loadSimulationContext,
  applyChanges,
  runSimulation,
  assembleEnvelope,
  CAREER_SIMULATION_VERSION,
  type SimChange,
  type SimContext,
  type ChangeApplied,
  type CareerSimulationEnvelope,
  type RoleSimResult,
} from './career-simulation-engine.js';
import { MEASURABLE_ONTO_DOMAINS, ONTO_DOMAIN_LABEL } from './competency-runtime.js';
import { buildFutureProjection } from './future-projection-engine.js';

export const SCENARIO_VERSION = '4.8.0';

export type ScenarioKey =
  | 'close_top_gap'
  | 'all_domains_plus_one'
  | 'reach_proficient'
  | 'trajectory_continues';

interface RoleSlim {
  role_id: string;
  role_title: string | null;
  transition: string;
  readiness_delta: number | null;
}

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  description: string;
  applicable: boolean;
  changes_applied: ChangeApplied[];
  measurable: boolean;
  unlocked_count: number;
  improved_count: number;
  regressed_count: number;
  mean_readiness_delta: number | null;
  max_readiness_delta: number | null;
  unlocked_roles: RoleSlim[];
  top_improved: RoleSlim[];
  notes: string[];
}

export interface ScenarioSetResult {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  baseline: {
    measured_domains: number;
    measurable_domains: number;
    domains: Array<{ onto_domain: string; label: string; level: number | null }>;
  };
  scenarios: ScenarioResult[];
  best: ScenarioResult | null;
  source_versions: Record<string, string>;
  notes: string[];
}

const SCENARIO_META: Record<ScenarioKey, { label: string; description: string }> = {
  close_top_gap: {
    label: 'Close your biggest gap',
    description: 'Raise your single weakest measured capability domain by one level.',
  },
  all_domains_plus_one: {
    label: 'Level up everywhere',
    description: 'Raise every measured capability domain by one level.',
  },
  reach_proficient: {
    label: 'Reach proficient across the board',
    description: 'Hypothetically reach level 4 (Proficient) in every measured capability domain.',
  },
  trajectory_continues: {
    label: 'If your current growth continues',
    description: 'Project your current re-assessment trajectory forward and see which roles open up.',
  },
};

function slim(r: RoleSimResult): RoleSlim {
  return {
    role_id: r.role_id,
    role_title: r.role_title,
    transition: r.transition,
    readiness_delta: r.readiness_delta,
  };
}

function summarizeScenario(
  key: ScenarioKey,
  changes: SimChange[],
  applicable: boolean,
  env: CareerSimulationEnvelope,
  extraNotes: string[] = [],
): ScenarioResult {
  return {
    key,
    label: SCENARIO_META[key].label,
    description: SCENARIO_META[key].description,
    applicable,
    changes_applied: env.changes_applied,
    measurable: env.measurable,
    unlocked_count: env.summary.unlocked_count,
    improved_count: env.summary.improved_count,
    regressed_count: env.summary.regressed_count,
    mean_readiness_delta: env.summary.mean_readiness_delta,
    max_readiness_delta: env.summary.max_readiness_delta,
    unlocked_roles: env.unlocked_roles.map(slim),
    top_improved: env.improved_roles.slice(0, 5).map(slim),
    notes: [...extraNotes, ...(applicable ? [] : ['scenario not applicable to this subject (no measured baseline)'])],
  };
}

/** Derive a scenario's change-set from the subject's measured baseline. */
function deriveChanges(key: ScenarioKey, ctx: SimContext): { changes: SimChange[]; applicable: boolean } {
  const measured = Array.from(ctx.baselineLevels.entries())
    .filter(([dom, lvl]) => MEASURABLE_ONTO_DOMAINS.has(dom) && lvl != null && Number.isFinite(lvl))
    .map(([dom, lvl]) => ({ dom, lvl: Number(lvl) }));

  switch (key) {
    case 'close_top_gap': {
      if (measured.length === 0) return { changes: [], applicable: false };
      const weakest = measured.slice().sort((a, b) => a.lvl - b.lvl || a.dom.localeCompare(b.dom))[0];
      return { changes: [{ target: weakest.dom, delta: 1 }], applicable: true };
    }
    case 'all_domains_plus_one': {
      if (measured.length === 0) return { changes: [], applicable: false };
      return { changes: measured.map((m) => ({ target: m.dom, delta: 1 })), applicable: true };
    }
    case 'reach_proficient': {
      // Hypothetical target — but grounded in MEASURED domains only. Without a
      // real baseline there is nothing to "reach" from, so it is not applicable
      // (never fabricate progress for an unmeasured subject).
      if (measured.length === 0) return { changes: [], applicable: false };
      const changes: SimChange[] = measured.map((m) => ({ target: m.dom, to_level: 4 }));
      return { changes, applicable: true };
    }
    default:
      return { changes: [], applicable: false };
  }
}

/** Build and rank the full preset scenario set for a subject. Read-only. */
export async function buildScenarioSet(pool: Pool, subjectId: string): Promise<ScenarioSetResult> {
  const ctx = await loadSimulationContext(pool, subjectId);
  const notes: string[] = [...ctx.notes];
  const scenarios: ScenarioResult[] = [];

  // Deterministic preset scenarios derived from the measured baseline.
  for (const key of ['close_top_gap', 'all_domains_plus_one', 'reach_proficient'] as ScenarioKey[]) {
    const { changes, applicable } = deriveChanges(key, ctx);
    const { simulatedLevels, changesApplied, notes: cNotes } = applyChanges(ctx, changes);
    const roleResults = await runSimulation(pool, ctx, simulatedLevels);
    const env = assembleEnvelope(ctx, key, changesApplied, simulatedLevels, roleResults, cNotes);
    scenarios.push(summarizeScenario(key, changes, applicable, env));
  }

  // Trajectory scenario — projected levels from the Future Projection engine.
  {
    const projection = await buildFutureProjection(pool, subjectId).catch(() => null);
    const projChanges: SimChange[] = projection
      ? Object.entries(projection.projected_levels).map(([target, to_level]) => ({ target, to_level }))
      : [];
    const applicable = !!projection?.measurable && projChanges.length > 0;
    const { simulatedLevels, changesApplied, notes: cNotes } = applyChanges(ctx, projChanges);
    const roleResults = await runSimulation(pool, ctx, simulatedLevels);
    const env = assembleEnvelope(ctx, 'trajectory_continues', changesApplied, simulatedLevels, roleResults, cNotes);
    const tNotes = applicable
      ? []
      : ['no projectable trajectory (need >= 2 re-assessment snapshots) — scenario equals baseline.'];
    scenarios.push(summarizeScenario('trajectory_continues', projChanges, applicable, env, tNotes));
  }

  // Rank: most roles unlocked first, then mean readiness lift, then key.
  const ranked = scenarios.slice().sort(
    (a, b) =>
      b.unlocked_count - a.unlocked_count ||
      (b.mean_readiness_delta ?? -Infinity) - (a.mean_readiness_delta ?? -Infinity) ||
      a.key.localeCompare(b.key),
  );

  const measurable = ctx.ready && ctx.measuredDomains > 0;
  const best = ranked.find((s) => s.applicable && (s.unlocked_count > 0 || (s.mean_readiness_delta ?? 0) > 0)) ?? null;

  const baselineDomains = Array.from(MEASURABLE_ONTO_DOMAINS).sort().map((dom) => ({
    onto_domain: dom,
    label: ONTO_DOMAIN_LABEL[dom] ?? dom,
    level: ctx.baselineLevels.get(dom) ?? null,
  }));

  if (!measurable) notes.push('No measured competency profile — scenarios are unmeasurable (no fabrication).');

  return {
    ok: true,
    subject_id: ctx.subject_id,
    version: SCENARIO_VERSION,
    generated_at: new Date().toISOString(),
    measurable,
    baseline: {
      measured_domains: ctx.measuredDomains,
      measurable_domains: MEASURABLE_ONTO_DOMAINS.size,
      domains: baselineDomains,
    },
    scenarios: ranked,
    best,
    source_versions: {
      scenario_engine: SCENARIO_VERSION,
      career_simulation: CAREER_SIMULATION_VERSION,
    },
    notes,
  };
}

// ---------------------------------------------------------------------------
// Append-only persistence (explicit POST path only — NEVER on a GET).
// The DDL here is reached ONLY behind the careerSimulation flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerSimulationSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_simulation_runs (
      id                   BIGSERIAL PRIMARY KEY,
      subject_id           TEXT NOT NULL,
      kind                 TEXT NOT NULL,
      scenario_key         TEXT,
      roles_evaluated      INTEGER NOT NULL DEFAULT 0,
      unlocked_count       INTEGER NOT NULL DEFAULT 0,
      improved_count       INTEGER NOT NULL DEFAULT 0,
      regressed_count      INTEGER NOT NULL DEFAULT 0,
      mean_readiness_delta NUMERIC,
      max_readiness_delta  NUMERIC,
      measurable           BOOLEAN NOT NULL DEFAULT FALSE,
      snapshot             JSONB NOT NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_simulation_runs_subject
       ON career_simulation_runs (subject_id, created_at DESC)`,
  );
}

export type SimulationRunKind = 'what_if' | 'scenario_set' | 'projection';

export interface CareerSimulationRunRow {
  id: number;
  subject_id: string;
  kind: string;
  scenario_key: string | null;
  roles_evaluated: number;
  unlocked_count: number;
  improved_count: number;
  regressed_count: number;
  mean_readiness_delta: number | null;
  max_readiness_delta: number | null;
  measurable: boolean;
  created_at: string;
}

interface RunMetrics {
  scenario_key: string | null;
  roles_evaluated: number;
  unlocked_count: number;
  improved_count: number;
  regressed_count: number;
  mean_readiness_delta: number | null;
  max_readiness_delta: number | null;
  measurable: boolean;
}

/** Append-only — NEVER updates an existing row. */
export async function persistSimulationRun(
  pool: Pool,
  kind: SimulationRunKind,
  subjectId: string,
  metrics: RunMetrics,
  snapshot: unknown,
): Promise<CareerSimulationRunRow> {
  await ensureCareerSimulationSchema(pool);
  const r = await pool.query(
    `INSERT INTO career_simulation_runs
       (subject_id, kind, scenario_key, roles_evaluated, unlocked_count, improved_count,
        regressed_count, mean_readiness_delta, max_readiness_delta, measurable, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, subject_id, kind, scenario_key, roles_evaluated, unlocked_count,
               improved_count, regressed_count, mean_readiness_delta, max_readiness_delta,
               measurable, created_at`,
    [
      String(subjectId ?? '').trim(),
      kind,
      metrics.scenario_key,
      metrics.roles_evaluated,
      metrics.unlocked_count,
      metrics.improved_count,
      metrics.regressed_count,
      metrics.mean_readiness_delta,
      metrics.max_readiness_delta,
      metrics.measurable,
      JSON.stringify(snapshot),
    ],
  );
  return r.rows[0] as CareerSimulationRunRow;
}

/** Convenience: persist a what-if envelope as an append-only run. */
export async function persistWhatIfRun(
  pool: Pool,
  env: CareerSimulationEnvelope,
): Promise<CareerSimulationRunRow> {
  return persistSimulationRun(pool, 'what_if', env.subject_id, {
    scenario_key: env.scenario_key,
    roles_evaluated: env.roles_evaluated,
    unlocked_count: env.summary.unlocked_count,
    improved_count: env.summary.improved_count,
    regressed_count: env.summary.regressed_count,
    mean_readiness_delta: env.summary.mean_readiness_delta,
    max_readiness_delta: env.summary.max_readiness_delta,
    measurable: env.measurable,
  }, env);
}

/** Read-only history. Uses a to_regclass probe so a GET NEVER triggers DDL —
 *  if no run has ever been persisted the table is absent => honest empty. */
export async function listSimulationHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerSimulationRunRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_simulation_runs') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, kind, scenario_key, roles_evaluated, unlocked_count,
              improved_count, regressed_count, mean_readiness_delta, max_readiness_delta,
              measurable, created_at
       FROM career_simulation_runs
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as CareerSimulationRunRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as CareerSimulationRunRow[] };
}
