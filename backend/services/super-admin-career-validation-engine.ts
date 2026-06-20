/**
 * PHASE 4.12 — Super Admin Career Validation engine (additive, read-only, never-throws).
 *
 * The CAREER analog of Phase-3.12 `super-admin-validation-engine.ts`. A super-admin
 * runs this for ONE subject to obtain a comprehensive honesty/invariant report across
 * THIRTEEN areas. It COMPOSES every Phase-4.x career engine and two platform
 * governance probes — it performs NO new scoring and writes NOTHING.
 *
 * Areas:
 *   1.  Career Architecture   — career-graph-engine (cg_roles / cg_edges / cg_tracks)
 *   2.  Career Matching       — Phase 4.2 (NOT YET BUILT → honest WARN, never fabricated)
 *   3.  Career Readiness      — career-readiness-aggregator (4.3)
 *   4.  Career Gaps           — career-gap-engine (4.4)
 *   5.  Career Roadmaps       — career-roadmap-engine (4.5)
 *   6.  Development Plans      — career-development-engine (4.6)
 *   7.  Recommendations       — career-recommendation-aggregator (4.7)
 *   8.  Simulations           — career-simulation-engine (4.8)
 *   9.  Passport              — career-passport-engine (4.9)
 *   10. Signals               — career-signal-engine (4.10)
 *   11. Tracking              — career-progression-engine (4.11)
 *   12. Audit Logs            — platform admin/audit-log probe
 *   13. Permissions           — platform role/permission probe
 *
 * Honesty contract (mirrors 3.12):
 *   - THREE statuses. PASS = checked & valid. WARN = honest absence / not measurable
 *     (an absent engine, an empty graph, no measured profile) — NEVER a failure.
 *     FAIL = a real invariant violation (out-of-bounds score, band/score incoherence,
 *     count mismatch, a fire without grounds, or an existing-but-unreadable table).
 *   - Coverage (does data exist) and Confidence (is it trustworthy) are reported as
 *     SEPARATE axes; never composited.
 *   - null ≠ 0: a missing score is `null`, never silently coerced to 0.
 *   - GET-never-writes: this engine runs zero DDL. Every competency-runtime-composing
 *     engine is gated behind `competencyRuntimeReady(pool)`; when the runtime is not
 *     provisioned the area WARNs without exercising the engine, so a lazy ensure-schema
 *     can never fire on a read. Graph + history reads are pure SELECT.
 *   - never-throws: each area runs in its own try/catch; a thrown engine error becomes a
 *     FAIL for THAT area only — the orchestrator never throws and never 500s.
 */

import type { Pool } from 'pg';
import { buildGraphCache, listTracks } from './career-graph-engine.js';
import { buildCareerReadiness } from './career-readiness-aggregator.js';
import { buildCareerGap, competencyRuntimeReady } from './career-gap-engine.js';
import { buildCareerRoadmap } from './career-roadmap-engine.js';
import { buildCareerDevelopment } from './career-development-engine.js';
import { buildCareerRecommendations } from './career-recommendation-aggregator.js';
import { buildCareerSimulation } from './career-simulation-engine.js';
import { loadPassportContext } from './career-passport-engine.js';
import { buildCareerSignals } from './career-signal-engine.js';
import { buildCareerProgression } from './career-progression-engine.js';

export const SUPER_ADMIN_CAREER_VALIDATION_VERSION = '4.12.0';

// ── Result types (mirror Phase-3.12) ─────────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationStatus;
  detail: string;
}

export interface ValidationArea {
  id: string;
  label: string;
  scope: 'subject' | 'platform';
  status: ValidationStatus;
  measurable: boolean;
  checks: ValidationCheck[];
  notes: string[];
}

export interface CareerValidationResult {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  runtime_provisioned: boolean;
  areas: ValidationArea[];
  summary: {
    areas_total: number;
    pass: number;
    warn: number;
    fail: number;
    status: ValidationStatus;
    measurable_areas: number;
  };
  notes: string[];
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** WARN is benign; FAIL dominates; otherwise PASS. */
function worst(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

/** A score is valid iff it is null (honestly absent) OR a finite number in [lo,hi]. */
function inRange(n: unknown, lo = 0, hi = 100): boolean {
  if (n === null || n === undefined) return true; // null = honest absence, not 0
  return typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
}

/** Sentinel band values the career engines emit to mean "no band" (an unmeasured
 *  block carries score=null AND one of these — that is coherent, not a fabrication). */
const ABSENT_BAND_SENTINELS = new Set(['', 'unmeasured', 'none', 'n/a', 'na']);

/** Band and score must agree on presence: a score with no band (or a real band with
 *  no score) is an incoherent (fabricated/dropped) envelope. Sentinel bands
 *  ('Unmeasured' / 'None') count as ABSENT so an honestly-unmeasured block passes. */
function bandScoreCoherent(score: unknown, band: unknown): boolean {
  const hasScore = score !== null && score !== undefined;
  const hasBand =
    band !== null &&
    band !== undefined &&
    !ABSENT_BAND_SENTINELS.has(String(band).trim().toLowerCase());
  return hasScore === hasBand;
}

function check(id: string, label: string, status: ValidationStatus, detail: string): ValidationCheck {
  return { id, label, status, detail };
}

function area(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  measurable: boolean,
  checks: ValidationCheck[],
  notes: string[] = [],
): ValidationArea {
  return { id, label, scope, measurable, status: worst(checks.map((c) => c.status)), checks, notes };
}

/** A thrown engine error is a FAIL for THAT area only — never a 500. */
function failArea(id: string, label: string, scope: 'subject' | 'platform', err: unknown): ValidationArea {
  const msg = err instanceof Error ? err.message : String(err);
  return area(
    id,
    label,
    scope,
    false,
    [check('engine_error', 'Engine executed without throwing', 'fail', `threw: ${msg}`)],
    ['Area failed because its composed engine threw — isolated; other areas are unaffected.'],
  );
}

/** A subject area that composes the competency runtime but the runtime is not
 *  provisioned: WARN (honest absence) and DO NOT exercise the engine, so a lazy
 *  ensure-schema can never fire on this read. */
function notProvisionedArea(id: string, label: string, engineName: string): ValidationArea {
  return area(
    id,
    label,
    'subject',
    false,
    [
      check(
        'runtime_provisioned',
        'Competency runtime is provisioned',
        'warn',
        `competency runtime not provisioned — ${engineName} not exercised (honest absence, not a failure). GET performs zero DDL.`,
      ),
    ],
    ['Composed engine skipped to guarantee GET-never-writes; not a defect.'],
  );
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

async function countRows(pool: Pool, table: string): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`);
  return Number(r.rows[0]?.n ?? '0');
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

type AreaFn = () => Promise<ValidationArea>;

async function runArea(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  fn: AreaFn,
): Promise<ValidationArea> {
  try {
    return await fn();
  } catch (err) {
    return failArea(id, label, scope, err);
  }
}

export async function runSuperAdminCareerValidation(
  pool: Pool,
  subjectId: string,
): Promise<CareerValidationResult> {
  const sid = String(subjectId ?? '').trim();
  // Probe ONCE up-front; subject engines that compose the competency runtime are
  // gated on this so a read never triggers their lazy ensure-schema (zero DDL).
  let runtimeReady = false;
  try {
    runtimeReady = await competencyRuntimeReady(pool);
  } catch {
    runtimeReady = false;
  }

  const areas: ValidationArea[] = [];

  // 1 — Career Architecture (platform: cg_roles / cg_edges / cg_tracks) ────────
  areas.push(
    await runArea('career_architecture', 'Career Architecture', 'platform', async () => {
      if (!(await tableExists(pool, 'cg_roles'))) {
        return area('career_architecture', 'Career Architecture', 'platform', false, [
          check('graph_tables', 'Career-graph tables present', 'warn', 'cg_roles absent — career graph not provisioned (honest absence).'),
        ]);
      }
      const g = await buildGraphCache(pool);
      const tracks = await listTracks(pool);
      const roleCount = g.roles.size;
      const edgeCount = g.edges.length;
      const checks: ValidationCheck[] = [];

      checks.push(
        check('roles_present', 'Graph has at least one role', roleCount > 0 ? 'pass' : 'warn',
          `${roleCount} role(s) in graph cache.`),
      );
      checks.push(
        check('counts_non_negative', 'Role/edge/track counts are non-negative', roleCount >= 0 && edgeCount >= 0 && tracks.length >= 0 ? 'pass' : 'fail',
          `roles=${roleCount} edges=${edgeCount} tracks=${tracks.length}`),
      );

      // Every edge endpoint must resolve to a known role — no dangling/fabricated edges.
      const dangling = g.edges.filter((e) => !g.roles.has(e.from_role_id) || !g.roles.has(e.to_role_id));
      checks.push(
        check('edges_resolve', 'Every edge endpoint resolves to a known role', dangling.length === 0 ? 'pass' : 'fail',
          dangling.length === 0 ? `all ${edgeCount} edge(s) resolve.` : `${dangling.length} edge(s) reference a missing role.`),
      );

      // Adjacency must index every edge exactly once (keyed by from_role_id).
      let adjTotal = 0;
      g.adjacency.forEach((list) => { adjTotal += list.length; });
      checks.push(
        check('adjacency_coherent', 'Adjacency indexes every edge exactly once', adjTotal === edgeCount ? 'pass' : 'fail',
          `adjacency entries=${adjTotal} vs edges=${edgeCount}`),
      );

      // Track waypoints must resolve to known roles.
      const badWaypoints = tracks.reduce(
        (n, t) => n + t.waypoints.filter((w) => !g.roles.has(w.role_id)).length, 0);
      checks.push(
        check('track_waypoints_resolve', 'Every track waypoint resolves to a known role', badWaypoints === 0 ? 'pass' : 'fail',
          badWaypoints === 0 ? `${tracks.length} track(s) consistent.` : `${badWaypoints} waypoint(s) reference a missing role.`),
      );

      return area('career_architecture', 'Career Architecture', 'platform', roleCount > 0, checks);
    }),
  );

  // 2 — Career Matching (Phase 4.2 — NOT YET BUILT → honest WARN) ──────────────
  areas.push(
    await runArea('career_matching', 'Career Matching', 'subject', async () => {
      const hasRules = await tableExists(pool, 'career_matching_rules');
      // Phase 4.2 was never built. Report its absence honestly; never fabricate a match.
      return area('career_matching', 'Career Matching', 'subject', false, [
        check(
          'matching_built',
          'Career Matching engine (Phase 4.2) is built',
          'warn',
          hasRules
            ? 'career_matching_rules table exists but the Career Match engine is not wired — reporting as not-yet-built (honest absence).'
            : 'Career Matching (Phase 4.2) is not yet built — no engine or config to validate (honest absence, not a failure).',
        ),
      ], ['Career Matching is intentionally pending; this area never fabricates a match result.']);
    }),
  );

  // 3 — Career Readiness (4.3) ─────────────────────────────────────────────────
  areas.push(
    await runArea('career_readiness', 'Career Readiness', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_readiness', 'Career Readiness', 'buildCareerReadiness');
      const env = await buildCareerReadiness(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Readiness measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'overall readiness is measurable.' : 'no measured readiness for subject (honest absence).'));
      checks.push(check('overall_bounds', 'Overall score within [0,100] or null', inRange(env.overall.score) ? 'pass' : 'fail',
        `overall.score=${env.overall.score}`));
      checks.push(check('overall_band_coherent', 'Overall band ⇔ score presence', bandScoreCoherent(env.overall.score, env.overall.band) ? 'pass' : 'fail',
        `score=${env.overall.score} band=${env.overall.band}`));
      checks.push(check('measurable_matches_data', 'measurable flag matches score presence', (env.measurable === (env.overall.score !== null)) ? 'pass' : 'fail',
        `measurable=${env.measurable} overall.score=${env.overall.score}`));

      for (const block of [env.current, env.future, env.role, env.growth]) {
        const ok = inRange(block.score)
          && bandScoreCoherent(block.score, block.band)
          && inRange(block.axes.coverage.coverage_pct);
        const sep = typeof block.axes.coverage.measurable === 'boolean' && !!block.axes.confidence.band;
        checks.push(check(`block_${block.type}`, `${block.label}: bounds + band + coverage coherent`, ok ? 'pass' : 'fail',
          `score=${block.score} band=${block.band} coverage_pct=${block.axes.coverage.coverage_pct}`));
        checks.push(check(`block_${block.type}_axes`, `${block.label}: Coverage & Confidence are separate axes`, sep ? 'pass' : 'fail',
          `coverage.measurable=${block.axes.coverage.measurable} confidence.band=${block.axes.confidence.band}`));
      }
      return area('career_readiness', 'Career Readiness', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 4 — Career Gaps (4.4) ──────────────────────────────────────────────────────
  areas.push(
    await runArea('career_gaps', 'Career Gaps', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_gaps', 'Career Gaps', 'buildCareerGap');
      const env = await buildCareerGap(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Gaps measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'gap analysis is measurable.' : 'no target role / measured gaps (honest absence).'));

      const bucketSum = Object.values(env.buckets).reduce((n, b) => n + b.gap_count, 0);
      const partition = bucketSum + env.unclassified.length;
      checks.push(check('gap_partition', 'Σ bucket gaps + unclassified = total_gaps', partition === env.summary.total_gaps ? 'pass' : 'fail',
        `buckets=${bucketSum} + unclassified=${env.unclassified.length} = ${partition} vs total=${env.summary.total_gaps}`));
      checks.push(check('critical_le_total', 'critical & blocking ≤ total', (env.summary.total_critical <= env.summary.total_gaps && env.summary.total_blocking <= env.summary.total_gaps) ? 'pass' : 'fail',
        `critical=${env.summary.total_critical} blocking=${env.summary.total_blocking} total=${env.summary.total_gaps}`));
      checks.push(check('classified_pct_bounds', 'classified_pct within [0,100] or null', inRange(env.summary.classified_pct) ? 'pass' : 'fail',
        `classified_pct=${env.summary.classified_pct}`));

      let bucketOk = true;
      for (const b of Object.values(env.buckets)) {
        if (b.gap_count !== b.items.length) bucketOk = false;
        if (b.critical_count > b.gap_count || b.blocking_count > b.gap_count) bucketOk = false;
      }
      checks.push(check('bucket_internal', 'Each bucket: gap_count = items.length, sub-counts ≤ gap_count', bucketOk ? 'pass' : 'fail',
        bucketOk ? 'all buckets internally consistent.' : 'a bucket count is inconsistent.'));

      const fo = env.future_outlook;
      checks.push(check('future_outlook_coherent', 'Future outlook bounds + band coherent', (inRange(fo.composite) && bandScoreCoherent(fo.composite, fo.band) && fo.real_signal_count >= 0) ? 'pass' : 'fail',
        `composite=${fo.composite} band=${fo.band} real_signals=${fo.real_signal_count}`));
      checks.push(check('axes_separate', 'Coverage & Confidence are separate axes', (typeof env.axes.coverage.measurable === 'boolean' && !!env.axes.confidence.band) ? 'pass' : 'fail',
        `coverage.measurable=${env.axes.coverage.measurable} confidence.band=${env.axes.confidence.band}`));
      return area('career_gaps', 'Career Gaps', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 5 — Career Roadmaps (4.5) ──────────────────────────────────────────────────
  areas.push(
    await runArea('career_roadmaps', 'Career Roadmaps', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_roadmaps', 'Career Roadmaps', 'buildCareerRoadmap');
      const env = await buildCareerRoadmap(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Roadmap measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'roadmap is measurable.' : 'no target role / measured roadmap (honest absence).'));

      const p = env.progression;
      checks.push(check('progression_bounds', 'Progression scores within [0,100] or null', (inRange(p.current.score) && inRange(p.progression_pct) && inRange(p.target.readiness_score)) ? 'pass' : 'fail',
        `current=${p.current.score} pct=${p.progression_pct} target=${p.target.readiness_score}`));
      checks.push(check('current_band_coherent', 'Current band ⇔ score presence', bandScoreCoherent(p.current.score, p.current.band) ? 'pass' : 'fail',
        `score=${p.current.score} band=${p.current.band}`));

      const t = env.timeline;
      const weeksOk = t.total_estimated_weeks === null || (typeof t.total_estimated_weeks === 'number' && t.total_estimated_weeks >= 0);
      checks.push(check('timeline_non_negative', 'Estimated weeks null or ≥ 0', weeksOk ? 'pass' : 'fail',
        `total_estimated_weeks=${t.total_estimated_weeks}`));

      const s = env.summary;
      const populatedMilestones = env.milestones.filter((m: any) => (m?.competency_count ?? 0) > 0).length;
      checks.push(check('summary_counts', 'milestone/competency/immediate counts consistent', (s.milestone_count === populatedMilestones && s.milestone_count <= env.milestones.length && s.total_competencies === env.development_plan.length && s.immediate_count <= s.total_competencies) ? 'pass' : 'fail',
        `milestones populated=${populatedMilestones}/scaffold=${env.milestones.length} reported=${s.milestone_count} · plan=${env.development_plan.length}/${s.total_competencies} immediate=${s.immediate_count}`));
      checks.push(check('axes_separate', 'Coverage & Confidence are separate axes', (typeof env.axes.coverage.measurable === 'boolean' && !!env.axes.confidence.band) ? 'pass' : 'fail',
        `coverage.measurable=${env.axes.coverage.measurable} confidence.band=${env.axes.confidence.band}`));
      return area('career_roadmaps', 'Career Roadmaps', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 6 — Development Plans (4.6) ─────────────────────────────────────────────────
  areas.push(
    await runArea('career_development', 'Development Plans', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_development', 'Development Plans', 'buildCareerDevelopment');
      const env = await buildCareerDevelopment(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Development plan measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'development plan is measurable.' : 'no measured development plan (honest absence).'));

      const plan = env.development_plan;
      const streamSum = plan.streams.length;
      checks.push(check('active_streams_bound', 'active_streams ≤ stream count', plan.summary.active_streams <= streamSum ? 'pass' : 'fail',
        `active=${plan.summary.active_streams} streams=${streamSum}`));
      checks.push(check('unclassified_count', 'plan unclassified_count = unclassified.length', plan.summary.unclassified_count === plan.unclassified.length ? 'pass' : 'fail',
        `unclassified_count=${plan.summary.unclassified_count} list=${plan.unclassified.length}`));

      const tr = env.tracking;
      const deltaOk = tr.overall.prior_gap_points === null
        ? tr.overall.delta_gap_points === null
        : (typeof tr.overall.delta_gap_points === 'number');
      checks.push(check('tracking_delta_coherent', 'delta_gap_points null ⇔ no prior baseline', deltaOk ? 'pass' : 'fail',
        `prior=${tr.overall.prior_gap_points} delta=${tr.overall.delta_gap_points}`));

      const t = env.timeline;
      const weeksOk = t.total_estimated_weeks === null || (typeof t.total_estimated_weeks === 'number' && t.total_estimated_weeks >= 0);
      checks.push(check('timeline_non_negative', 'Estimated weeks null or ≥ 0', weeksOk ? 'pass' : 'fail',
        `total_estimated_weeks=${t.total_estimated_weeks}`));
      checks.push(check('taxonomy_note', 'Taxonomy note present (no fabricated stream type)', !!env.taxonomy_note ? 'pass' : 'warn',
        env.taxonomy_note ? 'taxonomy note present.' : 'taxonomy note missing.'));
      checks.push(check('axes_separate', 'Coverage & Confidence are separate axes', (typeof env.axes.coverage.measurable === 'boolean' && !!env.axes.confidence.band) ? 'pass' : 'fail',
        `coverage.measurable=${env.axes.coverage.measurable} confidence.band=${env.axes.confidence.band}`));
      return area('career_development', 'Development Plans', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 7 — Recommendations (4.7) ──────────────────────────────────────────────────
  areas.push(
    await runArea('career_recommendations', 'Recommendations', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_recommendations', 'Recommendations', 'buildCareerRecommendations');
      const env = await buildCareerRecommendations(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Recommendations measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'recommendations are measurable.' : 'no measured recommendations (honest absence).'));

      const flat = env.groups.reduce((n, g) => n + g.items.length, 0);
      checks.push(check('total_matches_groups', 'total_recommendations = Σ group items', flat === env.summary.total_recommendations ? 'pass' : 'fail',
        `Σ items=${flat} vs total=${env.summary.total_recommendations}`));
      const byTypeSum = Object.values(env.summary.by_type).reduce((n, v) => n + (v as number), 0);
      checks.push(check('by_type_sum', 'Σ by_type = total_recommendations', byTypeSum === env.summary.total_recommendations ? 'pass' : 'fail',
        `Σ by_type=${byTypeSum} vs total=${env.summary.total_recommendations}`));
      checks.push(check('personalized_partition', 'personalized + market_only = total', (env.summary.personalized_count + env.summary.market_only_count === env.summary.total_recommendations) ? 'pass' : 'fail',
        `personalized=${env.summary.personalized_count} market_only=${env.summary.market_only_count} total=${env.summary.total_recommendations}`));

      let itemOk = true;
      for (const g of env.groups) {
        if (g.item_count !== g.items.length) itemOk = false;
        for (const it of g.items) {
          if (!it.rec_key || typeof it.rank_score !== 'number') itemOk = false;
        }
      }
      checks.push(check('items_grounded', 'Every item has a rec_key + numeric rank_score (no fabricated rec)', itemOk ? 'pass' : 'fail',
        itemOk ? 'all items grounded.' : 'an item is missing rec_key/rank_score or a group count is off.'));
      checks.push(check('config_source', 'Config source is db|defaults', (['db', 'defaults'].includes(env.config.library_source) && ['db', 'defaults'].includes(env.config.rules_source)) ? 'pass' : 'fail',
        `library=${env.config.library_source} rules=${env.config.rules_source}`));
      checks.push(check('axes_separate', 'Coverage & Confidence are separate axes', (typeof env.axes.coverage.measurable === 'boolean' && !!env.axes.confidence.band) ? 'pass' : 'fail',
        `coverage.measurable=${env.axes.coverage.measurable} confidence.band=${env.axes.confidence.band}`));
      return area('career_recommendations', 'Recommendations', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 8 — Simulations (4.8) — baseline (zero changes) ────────────────────────────
  areas.push(
    await runArea('career_simulations', 'Simulations', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_simulations', 'Simulations', 'buildCareerSimulation');
      const env = await buildCareerSimulation(pool, sid, [], 'validation_baseline');
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Simulation measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'simulation is measurable.' : 'no measured domains to simulate (honest absence).'));

      checks.push(check('summary_partition', 'unlocked/improved/regressed counts = list lengths', (env.summary.unlocked_count === env.unlocked_roles.length && env.summary.improved_count === env.improved_roles.length && env.summary.regressed_count === env.regressed_roles.length) ? 'pass' : 'fail',
        `unlocked=${env.unlocked_roles.length}/${env.summary.unlocked_count} improved=${env.improved_roles.length}/${env.summary.improved_count} regressed=${env.regressed_roles.length}/${env.summary.regressed_count}`));
      const partition = env.summary.unlocked_count + env.summary.improved_count + env.summary.regressed_count + env.unchanged_roles;
      checks.push(check('roles_partition', 'unlocked+improved+regressed+unchanged = roles_evaluated', partition === env.roles_evaluated ? 'pass' : 'fail',
        `partition=${partition} vs roles_evaluated=${env.roles_evaluated}`));
      checks.push(check('all_roles_count', 'roles_evaluated = all_roles.length', env.roles_evaluated === env.all_roles.length ? 'pass' : 'fail',
        `roles_evaluated=${env.roles_evaluated} all_roles=${env.all_roles.length}`));
      checks.push(check('delta_bounds', 'mean/max readiness delta within [-100,100] or null', (inRange(env.summary.mean_readiness_delta, -100, 100) && inRange(env.summary.max_readiness_delta, -100, 100)) ? 'pass' : 'fail',
        `mean=${env.summary.mean_readiness_delta} max=${env.summary.max_readiness_delta}`));

      // No changes applied ⇒ no fabricated unlocks; deltas must be 0/null.
      const baselineHonest = env.changes_applied.length > 0
        || (env.summary.unlocked_count === 0 && (env.summary.mean_readiness_delta === 0 || env.summary.mean_readiness_delta === null));
      checks.push(check('baseline_no_fabrication', 'Zero changes ⇒ zero unlocks & zero delta (no fabrication)', baselineHonest ? 'pass' : 'fail',
        `changes=${env.changes_applied.length} unlocked=${env.summary.unlocked_count} mean_delta=${env.summary.mean_readiness_delta}`));
      checks.push(check('axes_separate', 'Coverage & Confidence are separate axes', (typeof env.axes.coverage.measurable === 'boolean' && !!env.axes.confidence.band) ? 'pass' : 'fail',
        `coverage.measurable=${env.axes.coverage.measurable} confidence.band=${env.axes.confidence.band}`));
      return area('career_simulations', 'Simulations', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 9 — Passport (4.9) ─────────────────────────────────────────────────────────
  areas.push(
    await runArea('career_passport', 'Passport', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_passport', 'Passport', 'loadPassportContext');
      const ctx = await loadPassportContext(pool, sid);
      const measurable = ctx.runtimeReady && ctx.competencyProfile !== null;
      const checks: ValidationCheck[] = [];
      checks.push(check('runtime_ready_flag', 'runtimeReady flag present (boolean)', typeof ctx.runtimeReady === 'boolean' ? 'pass' : 'fail',
        `runtimeReady=${ctx.runtimeReady}`));
      checks.push(check('measurable', 'Passport has a measured competency profile', measurable ? 'pass' : 'warn',
        measurable ? 'competency profile present.' : 'no measured competency profile (honest absence).'));
      checks.push(check('career_profile_shape', 'careerProfile.exists is boolean', typeof ctx.careerProfile.exists === 'boolean' ? 'pass' : 'fail',
        `exists=${ctx.careerProfile.exists}`));
      checks.push(check('journey_events_array', 'journeyEvents is a non-negative array', Array.isArray(ctx.journeyEvents) ? 'pass' : 'fail',
        `journeyEvents=${Array.isArray(ctx.journeyEvents) ? ctx.journeyEvents.length : 'not-array'}`));

      // Composed readiness embed (if present) must itself be coherent — never fabricated.
      if (ctx.readiness) {
        const r = ctx.readiness;
        const ok = inRange(r.overall.score) && bandScoreCoherent(r.overall.score, r.overall.band);
        checks.push(check('readiness_embed_coherent', 'Embedded readiness bounds + band coherent', ok ? 'pass' : 'fail',
          `score=${r.overall.score} band=${r.overall.band}`));
      } else {
        checks.push(check('readiness_embed_coherent', 'Embedded readiness present', 'warn', 'no readiness composed into passport (honest absence).'));
      }
      return area('career_passport', 'Passport', 'subject', measurable, checks, ctx.notes?.slice(0, 3) ?? []);
    }),
  );

  // 10 — Signals (4.10) ────────────────────────────────────────────────────────
  areas.push(
    await runArea('career_signals', 'Signals', 'subject', async () => {
      if (!runtimeReady) return notProvisionedArea('career_signals', 'Signals', 'buildCareerSignals');
      const env = await buildCareerSignals(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('signals_present', 'Signal library produced signals', env.summary.signals_total > 0 ? 'pass' : 'warn',
        `${env.summary.signals_total} signal(s).`));
      checks.push(check('total_matches_list', 'signals_total = signals.length', env.summary.signals_total === env.signals.length ? 'pass' : 'fail',
        `signals_total=${env.summary.signals_total} list=${env.signals.length}`));
      const measCount = env.signals.filter((s) => s.measurable).length;
      checks.push(check('measurable_count', 'signals_measurable = count(measurable signals)', env.summary.signals_measurable === measCount ? 'pass' : 'fail',
        `signals_measurable=${env.summary.signals_measurable} counted=${measCount}`));
      checks.push(check('coverage_pct_bounds', 'coverage_pct within [0,100]', inRange(env.summary.coverage_pct) ? 'pass' : 'fail',
        `coverage_pct=${env.summary.coverage_pct}`));

      let signalOk = true;
      for (const s of env.signals) {
        if (!inRange(s.score)) signalOk = false;
        if (!bandScoreCoherent(s.score, s.band)) signalOk = false;
        if (s.coverage.inputs_present > s.coverage.inputs_total) signalOk = false;
        // measurable ⇔ score present: a non-measurable signal must NOT carry a score.
        if (s.measurable !== (s.score !== null)) signalOk = false;
      }
      checks.push(check('signal_internal', 'Each signal: bounds + band + inputs + no fabricated score', signalOk ? 'pass' : 'fail',
        signalOk ? 'all signals internally consistent.' : 'a signal violates bounds/band/inputs/measurable-coherence.'));
      checks.push(check('config_source', 'Config source is db|defaults', (['db', 'defaults'].includes(env.config_source.library) && ['db', 'defaults'].includes(env.config_source.rules)) ? 'pass' : 'fail',
        `library=${env.config_source.library} rules=${env.config_source.rules}`));
      return area('career_signals', 'Signals', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 11 — Tracking (4.11) — GET composes no engine (pure history read) ──────────
  areas.push(
    await runArea('career_tracking', 'Tracking', 'subject', async () => {
      const env = await buildCareerProgression(pool, sid);
      const checks: ValidationCheck[] = [];
      checks.push(check('measurable', 'Progression measurable for subject', env.measurable ? 'pass' : 'warn',
        env.measurable ? 'progression is measurable.' : 'insufficient longitudinal data (honest absence).'));
      checks.push(check('dimensions_total', 'dimensions_total = dimensions.length', env.summary.dimensions_total === env.dimensions.length ? 'pass' : 'fail',
        `dimensions_total=${env.summary.dimensions_total} list=${env.dimensions.length}`));
      const measCount = env.dimensions.filter((d) => d.measurable).length;
      checks.push(check('dimensions_measurable', 'dimensions_measurable = count(measurable dims)', env.summary.dimensions_measurable === measCount ? 'pass' : 'fail',
        `dimensions_measurable=${env.summary.dimensions_measurable} counted=${measCount}`));
      checks.push(check('coverage_pct_bounds', 'coverage_pct within [0,100]', inRange(env.summary.coverage_pct) ? 'pass' : 'fail',
        `coverage_pct=${env.summary.coverage_pct}`));

      let dimOk = true;
      for (const d of env.dimensions) {
        if (d.kind === 'numeric') {
          if (!inRange(d.first_score) || !inRange(d.last_score)) dimOk = false;
          // delta null ⇔ direction null; delta present ⇒ equals last-first (when both present).
          const deltaNull = d.delta === null;
          if (deltaNull !== (d.direction === null)) dimOk = false;
          if (d.first_score !== null && d.last_score !== null && d.delta !== null
            && Math.abs((d.last_score - d.first_score) - d.delta) > 0.01) dimOk = false;
        } else {
          if (d.transition_count !== d.transitions.length) dimOk = false;
        }
      }
      checks.push(check('dimension_internal', 'Each dimension: numeric Δ coherent / event transition_count = list', dimOk ? 'pass' : 'fail',
        dimOk ? 'all dimensions internally consistent.' : 'a dimension delta/direction/transition count is inconsistent.'));
      const src = env.sources;
      checks.push(check('sources_non_negative', 'History source counts are non-negative', (src.readiness_history >= 0 && src.growth_tracking >= 0 && src.career_history >= 0) ? 'pass' : 'fail',
        `readiness=${src.readiness_history} growth=${src.growth_tracking} history=${src.career_history}`));
      checks.push(check('sufficient_datapoints', 'At least 2 snapshots for a trend', env.summary.total_snapshots >= 2 ? 'pass' : 'warn',
        `total_snapshots=${env.summary.total_snapshots} (≥2 needed for a trend).`));
      return area('career_tracking', 'Tracking', 'subject', env.measurable, checks, env.notes?.slice(0, 3) ?? []);
    }),
  );

  // 12 — Audit Logs (platform governance probe) ────────────────────────────────
  areas.push(
    await runArea('audit_logs', 'Audit Logs', 'platform', async () => {
      const candidates = ['admin_audit_logs', 'platform_audit_log', 'audit_logs'];
      const checks: ValidationCheck[] = [];
      let anyPresent = false;
      for (const t of candidates) {
        const exists = await tableExists(pool, t);
        if (!exists) {
          checks.push(check(`tbl_${t}`, `${t} present`, 'warn', `${t} absent.`));
          continue;
        }
        anyPresent = true;
        try {
          const n = await countRows(pool, t);
          checks.push(check(`tbl_${t}`, `${t} present & readable`, 'pass', `${n} row(s).`));
        } catch (e) {
          // Exists but COUNT failed = a real break, not an honest absence.
          checks.push(check(`tbl_${t}`, `${t} present & readable`, 'fail', `exists but unreadable: ${(e as Error).message}`));
        }
      }
      if (!anyPresent) {
        checks.push(check('any_audit_log', 'At least one audit-log table exists', 'warn', 'no audit-log table found (honest absence).'));
      }
      return area('audit_logs', 'Audit Logs', 'platform', anyPresent, checks);
    }),
  );

  // 13 — Permissions (platform governance probe) ───────────────────────────────
  areas.push(
    await runArea('permissions', 'Permissions', 'platform', async () => {
      const checks: ValidationCheck[] = [];
      const tables = ['role_definitions', 'permission_definitions', 'role_permissions'];
      let anyRbac = false;
      for (const t of tables) {
        const exists = await tableExists(pool, t);
        if (!exists) {
          checks.push(check(`tbl_${t}`, `${t} present`, 'warn', `${t} absent.`));
          continue;
        }
        anyRbac = true;
        try {
          const n = await countRows(pool, t);
          checks.push(check(`tbl_${t}`, `${t} present & readable`, 'pass', `${n} row(s).`));
        } catch (e) {
          checks.push(check(`tbl_${t}`, `${t} present & readable`, 'fail', `exists but unreadable: ${(e as Error).message}`));
        }
      }
      // A super-admin must exist or the IDOR-gated surfaces are unreachable.
      try {
        if (await tableExists(pool, 'users')) {
          const r = await pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users WHERE role = 'super_admin'");
          const n = Number(r.rows[0]?.n ?? '0');
          checks.push(check('super_admin_present', 'At least one super_admin exists', n > 0 ? 'pass' : 'fail',
            `${n} super_admin user(s).`));
        } else {
          checks.push(check('super_admin_present', 'users table present', 'warn', 'users table absent.'));
        }
      } catch (e) {
        checks.push(check('super_admin_present', 'super_admin probe', 'fail', `probe failed: ${(e as Error).message}`));
      }
      return area('permissions', 'Permissions', 'platform', anyRbac, checks);
    }),
  );

  // ── Summary fold ────────────────────────────────────────────────────────────
  const pass = areas.filter((a) => a.status === 'pass').length;
  const warn = areas.filter((a) => a.status === 'warn').length;
  const fail = areas.filter((a) => a.status === 'fail').length;
  const measurable_areas = areas.filter((a) => a.measurable).length;

  return {
    ok: true,
    subject_id: sid,
    version: SUPER_ADMIN_CAREER_VALIDATION_VERSION,
    generated_at: new Date().toISOString(),
    runtime_provisioned: runtimeReady,
    areas,
    summary: {
      areas_total: areas.length,
      pass,
      warn,
      fail,
      status: worst(areas.map((a) => a.status)),
      measurable_areas,
    },
    notes: [
      'Read-only honesty harness — composes Phase-4.x engines + platform probes, performs no new scoring, writes nothing.',
      'WARN = honest absence / not measurable (incl. Career Matching 4.2 not yet built); FAIL = a real invariant violation.',
      'Coverage (data exists) and Confidence (trustworthy) are separate axes — never composited.',
    ],
  };
}
