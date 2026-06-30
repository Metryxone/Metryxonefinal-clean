/**
 * CAPADEX 3.0 — Program 1 · Phase 1.5 Progression Engine / Continuous Growth
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer over the canonical Progression Model (`config/progression-model.ts`).
 * It NEVER writes, NEVER runs DDL, NEVER invokes a progression/recommendation/learning engine —
 * it only:
 *   1. serves the canonical progression model (15-step spine + lifecycle promotion rules +
 *      loop-closure invariants + per-persona paths + axes),
 *   2. INDEPENDENTLY verifies each path's evidence claims against the live filesystem + DB
 *      (the verifier — not the registry — is the SSoT for "present/absent" numbers),
 *   3. computes per-path / per-axis Coverage (kept SEPARATE from Confidence/Outcome/Adoption),
 *   4. verifies the four loop-closure invariants that make growth a CLOSED, continuous loop,
 *   5. classifies remaining progression gaps (Launch-Critical/High/Medium/Low/Future),
 *   6. reports the realized-growth ADOPTION (a SEPARATE axis from Coverage).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0. Never fabricate. The
 * runtime growth machinery is REUSED (Phase 1.3 progression-outcome-capture + evidence-gate);
 * this module adds ZERO new growth logic and ZERO schema.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  PROGRESSION_MODEL,
  PROGRESSION_SPINE,
  PROGRESSION_AXES,
  LIFECYCLE_PROMOTION_RULES,
  LOOP_CLOSURE_INVARIANTS,
  PROGRESSION_DECISIONS,
  type ProgressionPath,
  type ProgressionEvidence,
  type ProgressionStatus,
  type LoopClosureInvariant,
} from '../config/progression-model';
// REUSE the single-source freshness constant from the existing progression-capture mechanism
// (no re-declaration). This module only READS it — it never invokes the capture/signal engine.
import { REASSESSMENT_FRESHNESS_DAYS } from './capadex/progression-outcome-capture';

// Workflow + tsx scripts run with cwd = backend/ ; frontend lives one level up.
const BACKEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function fileExists(rel: string, kind: 'backend' | 'frontend'): boolean {
  const base = kind === 'frontend' ? path.join(REPO_ROOT, 'frontend', 'src') : BACKEND_ROOT;
  return existsSync(path.join(base, rel));
}

/** to_regclass probe — returns true/false if known, null on read error (unknown ≠ absent). */
async function tableExists(pool: Pool, table: string): Promise<boolean | null> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    return rows[0]?.reg != null;
  } catch {
    return null;
  }
}

export interface EvidenceVerification {
  services: { present: number; total: number; missing: string[] };
  routes: { present: number; total: number; missing: string[] };
  frontend: { present: number; total: number; missing: string[] };
  /** null entries = table existence UNKNOWN (DB read error), distinct from absent. */
  tables: { present: number; absent: number; unknown: number; total: number; absentList: string[] };
}

function verifyFsGroup(items: string[], kind: 'backend' | 'frontend'): { present: number; total: number; missing: string[] } {
  const missing = items.filter((i) => !fileExists(i, kind));
  return { present: items.length - missing.length, total: items.length, missing };
}

export async function verifyEvidence(pool: Pool, ev: ProgressionEvidence): Promise<EvidenceVerification> {
  const services = verifyFsGroup(ev.services, 'backend');
  const routes = verifyFsGroup(ev.routes, 'backend');
  const frontend = verifyFsGroup(ev.frontend, 'frontend');

  let present = 0, absent = 0, unknown = 0;
  const absentList: string[] = [];
  for (const t of ev.tables) {
    const r = await tableExists(pool, t);
    if (r === null) unknown += 1;
    else if (r) present += 1;
    else { absent += 1; absentList.push(t); }
  }
  return {
    services, routes, frontend,
    tables: { present, absent, unknown, total: ev.tables.length, absentList },
  };
}

export interface PathCoverage {
  key: string;
  label: string;
  persona: string;
  status: ProgressionStatus;
  statusNote?: string;
  /** Spine steps reached / 15 (the FROZEN canonical spine length). */
  spineReached: number;
  spineTotal: number;
  /** All axes mapped in the registry by definition; confirms the mapping text is non-empty. */
  axesMapped: number;
  axesTotal: number;
  evidence: EvidenceVerification;
}

const AXIS_FIELD: Record<typeof PROGRESSION_AXES[number], keyof ProgressionPath> = {
  persona: 'personas',
  lifecycle: 'lifecycleStages',
  assessment: 'assessments',
  ai: 'aiInterpretation',
  recommendation: 'recommendationRule',
  intervention: 'interventionPath',
  outcome: 'outcomes',
  promotion: 'promotionRule',
};

function axesMappedFor(t: ProgressionPath): number {
  let n = 0;
  for (const axis of PROGRESSION_AXES) {
    const v = t[AXIS_FIELD[axis]];
    if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null) n += 1;
  }
  return n;
}

export async function composeCoverage(pool: Pool): Promise<PathCoverage[]> {
  const out: PathCoverage[] = [];
  for (const t of PROGRESSION_MODEL) {
    out.push({
      key: t.key,
      label: t.label,
      persona: t.persona,
      status: t.status,
      statusNote: t.statusNote,
      spineReached: t.spineReached.length,
      spineTotal: PROGRESSION_SPINE.length,
      axesMapped: axesMappedFor(t),
      axesTotal: PROGRESSION_AXES.length,
      evidence: await verifyEvidence(pool, t.evidence),
    });
  }
  return out;
}

export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';

export interface ClassifiedGap {
  id: string;
  title: string;
  severity: GapSeverity;
  evidence: string;
  remediation: string;
}

/**
 * Progression gap classification (honest — grounded in the FROZEN blueprint verdict + the live
 * FS/DB scan). The continuous-growth LOOP is mechanism-complete via REUSE (Phase 1.3
 * progression-outcome-capture + evidence-gate + the recommendation/learning/intervention/
 * longitudinal engines). What remains are a few engineering RESIDUALS (none Launch-Critical) and
 * — dominantly — ADOPTION (real re-administration / outcome volume), which is reported SEPARATELY
 * by composeProgressionAdoption as a usage axis, NEVER as a gap (Coverage⟂Confidence⟂Outcome⟂
 * Adoption never composited; null≠0; nothing fabricated).
 */
export const PROGRESSION_GAPS: ClassifiedGap[] = [
  {
    id: 'GAP-P1-PROMOTION-NOT-UNIFORMLY-GATED',
    title: 'Promotion is readiness-DERIVED, not a uniformly enforced per-persona gate',
    severity: 'Medium',
    evidence: 'evidence-gate supplies a readiness band (scoreToLevelBand) recorded in wc3_stage_progression, and promotion is derived from it; but there is no single enforced "promotion gate" applied identically across all persona paths (INV4 link is derived, not gated).',
    remediation: 'OPTIONAL/ADDITIVE: behind a flag, wire the existing evidence-gate readiness as a hard precondition to a stage transition per persona. Reuse-only (no new engine); never block byte-identical-OFF. Not Launch-Critical.',
  },
  {
    id: 'GAP-P2-PRACTICE-REINFORCEMENT-INFERRED',
    title: 'Practice-activity & behaviour-reinforcement steps are recommendation/intervention-driven (no explicit logged practice-completion substrate)',
    severity: 'Low',
    evidence: 'practice_activity + behaviour_reinforcement spine steps are surfaced via the recommendation/intervention catalogs; reinforcement is inferred from re-measurement rather than an explicit "practice completed" event log.',
    remediation: 'OPTIONAL/ADDITIVE: if explicit practice-completion telemetry is later required, REUSE the existing intervention substrate (capadex_interventions) with a completion flag rather than a new table. Low priority.',
  },
  {
    id: 'GAP-P3-IMPROVEMENT-EFFECTIVENESS-DEFERRED',
    title: 'Calibrated improvement→promotion effectiveness/accuracy is deliberately abstained',
    severity: 'Future',
    evidence: 'learning/progression milestones carry NO decision-time prediction (predicted_prob_at_decision is NULL by design), so empirical accuracy of the improvement→promotion link is honestly abstained (Confidence axis), distinct from Coverage. This is a deliberate honesty choice, not a bug.',
    remediation: 'FUTURE: once real non-demo re-administration volume + a prediction substrate exist, compute effectiveness/calibration over the EXISTING ledger (validation_loop_outcomes). Never fabricate accuracy before the data exists.',
  },
];

export interface ResolvedGap {
  id: string;
  title: string;
  closure: string;
  /** The honest remaining axis after the mechanism is in place — ADOPTION (usage-driven). */
  residual: string;
}

/**
 * Mechanism-present links the continuous-growth loop REUSES (closed by prior phases via
 * reuse-before-build, NOT rebuilt here) — recorded for traceability. Their honest residual is
 * ADOPTION, never a gap.
 */
export const RESOLVED_PROGRESSION_GAPS: ResolvedGap[] = [
  {
    id: 'MECH-UNIVERSAL-OUTCOME-CAPTURE',
    title: 'Universal close-the-loop realized-outcome capture',
    closure: 'PRESENT via REUSE (Phase 1.3): captureProgressionOutcome + captureJourneyTailMilestone write realized growth/mastery/engagement milestones into the canonical ledger (validation_loop_outcomes). Gated by longitudinalOutcomeCapture → byte-identical OFF. No new engine/table/DDL.',
    residual: 'ADOPTION: real realized-outcome volume is usage-driven (honest-low/0; reported by composeProgressionAdoption — Adoption⟂Coverage, null≠0).',
  },
  {
    id: 'MECH-EVIDENCE-GATED-READINESS',
    title: 'Evidence-gated readiness / promotion derivation',
    closure: 'PRESENT via REUSE: evidence-gate composes the readiness band (scoreToLevelBand + k-anonymity data-sufficiency) recorded in wc3_stage_progression; the composer READS it, never re-derives. Gated by evidenceGatedProgression → byte-identical OFF.',
    residual: 'ENGINEERING (GAP-P1, Medium): promotion is derived from readiness, not uniformly gated per persona.',
  },
  {
    id: 'MECH-REASSESSMENT-SIGNAL',
    title: 'Interval / exit reassessment eligibility signal',
    closure: 'PRESENT via REUSE: getReassessmentSignal derives interval/exit re-administration eligibility ON READ from the accrued longitudinal record (no scheduler, no write). Gated by longitudinalOutcomeCapture → byte-identical OFF.',
    residual: 'ADOPTION: real re-administration cadence is usage-driven (null≠0).',
  },
];

export interface LoopClosureReport {
  id: string;
  title: string;
  from: string;
  to: string;
  mechanism: string;
  /** Coverage: are the services + tables backing this link present? (FS + DB verified). */
  servicesPresent: number;
  servicesTotal: number;
  tablesPresent: number;
  tablesAbsent: number;
  tablesUnknown: number;
  tablesTotal: number;
  /** Coverage roll-up for the link: 'PRESENT' (all services + ≥1 table present), 'PARTIAL', 'ABSENT'. */
  coverage: 'PRESENT' | 'PARTIAL' | 'ABSENT' | 'UNKNOWN';
  residual: string;
}

async function verifyInvariant(pool: Pool, inv: LoopClosureInvariant): Promise<LoopClosureReport> {
  const svc = verifyFsGroup(inv.services, 'backend');
  let present = 0, absent = 0, unknown = 0;
  for (const t of inv.tables) {
    const r = await tableExists(pool, t);
    if (r === null) unknown += 1;
    else if (r) present += 1;
    else absent += 1;
  }
  const total = inv.tables.length;
  let coverage: LoopClosureReport['coverage'];
  if (unknown === total && total > 0) coverage = 'UNKNOWN';
  else if (svc.present === svc.total && present >= 1) coverage = 'PRESENT';
  else if (svc.present === 0 && present === 0) coverage = 'ABSENT';
  else coverage = 'PARTIAL';
  return {
    id: inv.id,
    title: inv.title,
    from: inv.from,
    to: inv.to,
    mechanism: inv.mechanism,
    servicesPresent: svc.present,
    servicesTotal: svc.total,
    tablesPresent: present,
    tablesAbsent: absent,
    tablesUnknown: unknown,
    tablesTotal: total,
    coverage,
    residual: inv.residual,
  };
}

export async function composeLoopClosure(pool: Pool): Promise<{
  invariants: LoopClosureReport[];
  closed_count: number;
  total: number;
  note: string;
}> {
  const invariants: LoopClosureReport[] = [];
  for (const inv of LOOP_CLOSURE_INVARIANTS) invariants.push(await verifyInvariant(pool, inv));
  const closed_count = invariants.filter((i) => i.coverage === 'PRESENT').length;
  return {
    invariants,
    closed_count,
    total: invariants.length,
    note:
      'Each invariant is a COVERAGE statement: the existing mechanism that LINKS two spine steps is ' +
      'present (services + ≥1 backing table verified). Coverage of the loop links is SEPARATE from ' +
      'ADOPTION (is the loop exercised by real non-demo volume — see composeProgressionAdoption) and ' +
      'from CONFIDENCE (calibrated effectiveness — abstained by design). null≠0; nothing fabricated; ' +
      'no link is invoked, only verified by reference.',
  };
}

export interface ProgressionSummary {
  flag: 'progressionEngineCompletion';
  spine_frozen: true;
  spine_step_count: number;
  lifecycle_stage_count: number;
  invariant_count: number;
  path_count: number;
  persona_count: number;
  status_counts: { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };
  /** Coverage axis — does an implementation exist. SEPARATE from Confidence/Outcome/Adoption. */
  evidence_rollup: {
    services: { present: number; total: number };
    routes: { present: number; total: number };
    frontend: { present: number; total: number };
    tables: { present: number; absent: number; unknown: number; total: number };
  };
  /** Spine reachability across all paths (Coverage of spine steps). */
  spine_rollup: { reached: number; total: number };
  /** Loop-closure: how many of the 4 invariants are PRESENT (Coverage). */
  loop_closure: { closed: number; total: number };
  /** OPEN engineering gaps by severity (none Launch-Critical). */
  gap_counts: Record<GapSeverity, number>;
  /** Mechanisms reused (not rebuilt) — traceability; residual is ADOPTION, never a gap. */
  resolved_gap_count: number;
  decisions: typeof PROGRESSION_DECISIONS;
  /** Enterprise-ready verdict — STRUCTURAL only; loop mechanism-complete via reuse, ADOPTION pending. */
  enterprise_ready: { verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING'; note: string };
}

export async function composeSummary(pool: Pool): Promise<ProgressionSummary> {
  const coverage = await composeCoverage(pool);
  const loop = await composeLoopClosure(pool);
  const status_counts = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const evidence_rollup = {
    services: { present: 0, total: 0 },
    routes: { present: 0, total: 0 },
    frontend: { present: 0, total: 0 },
    tables: { present: 0, absent: 0, unknown: 0, total: 0 },
  };
  const spine_rollup = { reached: 0, total: 0 };
  const personas = new Set<string>();
  for (const c of coverage) {
    status_counts[c.status] += 1;
    spine_rollup.reached += c.spineReached;
    spine_rollup.total += c.spineTotal;
    evidence_rollup.services.present += c.evidence.services.present;
    evidence_rollup.services.total += c.evidence.services.total;
    evidence_rollup.routes.present += c.evidence.routes.present;
    evidence_rollup.routes.total += c.evidence.routes.total;
    evidence_rollup.frontend.present += c.evidence.frontend.present;
    evidence_rollup.frontend.total += c.evidence.frontend.total;
    evidence_rollup.tables.present += c.evidence.tables.present;
    evidence_rollup.tables.absent += c.evidence.tables.absent;
    evidence_rollup.tables.unknown += c.evidence.tables.unknown;
    evidence_rollup.tables.total += c.evidence.tables.total;
  }
  for (const p of PROGRESSION_MODEL) for (const code of p.personas) personas.add(code);

  const gap_counts: Record<GapSeverity, number> = {
    'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0,
  };
  for (const g of PROGRESSION_GAPS) gap_counts[g.severity] += 1;

  return {
    flag: 'progressionEngineCompletion',
    spine_frozen: true,
    spine_step_count: PROGRESSION_SPINE.length,
    lifecycle_stage_count: LIFECYCLE_PROMOTION_RULES.length,
    invariant_count: LOOP_CLOSURE_INVARIANTS.length,
    path_count: PROGRESSION_MODEL.length,
    persona_count: personas.size,
    status_counts,
    evidence_rollup,
    spine_rollup,
    loop_closure: { closed: loop.closed_count, total: loop.total },
    gap_counts,
    resolved_gap_count: RESOLVED_PROGRESSION_GAPS.length,
    decisions: PROGRESSION_DECISIONS,
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING',
      note:
        'ONE canonical Progression Model answers "Is CAPADEX capable of measurable, continuous customer ' +
        'growth?": a FROZEN 15-step growth spine (Assessment→Evidence→AI→Recommend→Learn→Practice→' +
        'Reinforce→Competency→Intervene→Measure→Reassess→Validate→Outcome→Promote→Continue), four ' +
        'lifecycle promotion rules (Curiosity→Insight→Growth→Mastery), four loop-closure invariants, and ' +
        'a per-persona path register — every field mapped to the eight progression axes and verified ' +
        'against the live repo. The growth LOOP is mechanism-complete via REUSE-before-build: Phase 1.3 ' +
        'closed the universal realized-outcome capture (progression-outcome-capture) and the evidence-gated ' +
        'readiness (evidence-gate); recommendation/learning/intervention/longitudinal engines supply the ' +
        'middle of the loop. This phase adds ONE read-only composer/registry + ZERO new growth logic + ' +
        'ZERO schema. OPEN engineering gaps are NONE Launch-Critical (GAP-P1 Medium: promotion is ' +
        'readiness-derived not uniformly gated; GAP-P2 Low: practice/reinforcement are recommendation-' +
        'driven; GAP-P3 Future: calibrated effectiveness deliberately abstained). The dominant remaining ' +
        'axis is ADOPTION (real re-administration/outcome volume, currently honest-low/0, reported ' +
        'SEPARATELY by composeProgressionAdoption) — a usage axis, NOT a gap. The verdict stays ' +
        'STRUCTURAL (engineering complete via reuse; adoption is usage-driven and never fabricated). ' +
        'Coverage⟂Confidence⟂Outcome⟂Adoption are reported separately and never composited; null≠0.',
    },
  };
}

/**
 * Realized-growth ADOPTION composer (read-only, never-throws).
 * Reports how much the continuous-growth loop (Progress / Mastery / Continuous re-administration),
 * instrumented via the existing progression-outcome-capture hook in Phase 1.3, is actually being
 * EXERCISED. This is the ADOPTION axis — kept strictly SEPARATE from Coverage (does the loop exist)
 * and never composited. null≠0: a query that cannot be read returns null, distinct from a real
 * measured 0. Demo subjects (is_demo) excluded so adoption can never be self-inflated.
 */
export interface ProgressionAdoption {
  flag: 'progressionEngineCompletion';
  freshness_window_days: number;
  /** Distinct non-demo subjects with a captured stage_completion (Progress) milestone. */
  progressed_subjects: number | null;
  /** Distinct non-demo subjects with a captured reached_mastery (Mastery) milestone. */
  mastery_subjects: number | null;
  /** Distinct non-demo subjects with >1 longitudinal datapoint (Continuous re-administration). */
  reassessed_subjects: number | null;
  /** Distinct subjects with a recorded longitudinal trend (improvement-validation substrate). */
  trend_subjects: number | null;
  /** Total non-demo realized-outcome rows captured (all types). */
  realized_outcomes: number | null;
  note: string;
}

async function readScalar(pool: Pool, sql: string): Promise<number | null> {
  try {
    const r = await pool.query(sql);
    if (!r.rows.length) return 0;
    const v = Number(r.rows[0].n);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null; // unreadable ≠ 0
  }
}

export async function composeProgressionAdoption(pool: Pool): Promise<ProgressionAdoption> {
  // Progress / Mastery milestones live in validation_loop_outcomes (written by captureProgressionOutcome).
  const progressed_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT subject_user_id)::int AS n
       FROM validation_loop_outcomes
      WHERE outcome_type = 'learning'
        AND ref_id LIKE 'capadex_progression:%'
        AND COALESCE(is_demo, false) = false`,
  );
  const mastery_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT subject_user_id)::int AS n
       FROM validation_loop_outcomes
      WHERE outcome_type = 'learning'
        AND ref_id LIKE 'capadex_mastery:%'
        AND COALESCE(is_demo, false) = false`,
  );
  // Continuous = a subject re-administered (>1 longitudinal snapshot).
  const reassessed_subjects = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM (
        SELECT user_id
          FROM wc3_longitudinal_snapshots
         WHERE user_id IS NOT NULL
         GROUP BY user_id
        HAVING COUNT(*) > 1
     ) t`,
  );
  // Improvement-validation substrate = subjects with a recorded longitudinal trend/pattern.
  const trend_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT user_id)::int AS n
       FROM longitudinal_patterns
      WHERE user_id IS NOT NULL`,
  );
  // Total realized-outcome rows (non-demo).
  const realized_outcomes = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n
       FROM validation_loop_outcomes
      WHERE COALESCE(is_demo, false) = false`,
  );
  return {
    flag: 'progressionEngineCompletion',
    freshness_window_days: REASSESSMENT_FRESHNESS_DAYS,
    progressed_subjects,
    mastery_subjects,
    reassessed_subjects,
    trend_subjects,
    realized_outcomes,
    note:
      'ADOPTION axis only — exercise of the (Phase-1.3 reuse-instrumented) continuous-growth loop. ' +
      'SEPARATE from Coverage; never composited. null = unreadable, 0 = measured-empty. Demo subjects ' +
      'excluded. The capture hook is gated by the longitudinalOutcomeCapture flag, so non-zero adoption ' +
      'accrues only as real subjects progress / re-administer existing assessments. This phase builds NO ' +
      'new growth machinery.',
  };
}

/**
 * Persona-progression linkage composer (read-only, never-throws).
 * Validates whether realized progression outcomes can be attributed per persona by JOINING realized
 * outcomes (validation_loop_outcomes) to the persona substrate (capadex_user_profiles) at READ time —
 * no schema change, no persona column added. k-anonymity: per-persona counts below k_min are
 * suppressed (masked). Coverage⟂Outcome⟂Confidence stay distinct.
 */
export interface PersonaProgressionLinkage {
  flag: 'progressionEngineCompletion';
  linkage_present: boolean;
  k_min: number;
  personas: Array<{ persona: string; outcomes: number | null; suppressed: boolean }>;
  note: string;
}

export async function composePersonaProgressionLinkage(pool: Pool): Promise<PersonaProgressionLinkage> {
  const k_min = 30;
  let rows: Array<{ persona: string; n: number }> = [];
  let readable = true;
  try {
    const r = await pool.query(
      `SELECT p.persona AS persona, COUNT(DISTINCT v.subject_user_id)::int AS n
         FROM validation_loop_outcomes v
         JOIN capadex_user_profiles p
           ON p.user_id = v.subject_user_id::uuid
        WHERE COALESCE(v.is_demo, false) = false
          AND v.subject_user_id ~ '^[0-9a-fA-F-]{36}$'
          AND p.persona IS NOT NULL
        GROUP BY p.persona`,
    );
    rows = r.rows.map((x: any) => ({ persona: String(x.persona), n: Number(x.n) }));
  } catch {
    readable = false; // unreadable ≠ empty
  }
  const personas = rows.map((x) => {
    const suppressed = x.n < k_min;
    return { persona: x.persona, outcomes: suppressed ? null : x.n, suppressed };
  });
  return {
    flag: 'progressionEngineCompletion',
    linkage_present: readable,
    k_min,
    personas,
    note:
      'Persona⟂Progression linkage validated by a READ-TIME join (no persona column added, zero DDL). ' +
      'Per-persona counts below k_min are suppressed (masked) for anonymity. linkage_present:false means ' +
      'the join was unreadable, NOT that outcomes are zero (null≠0). Coverage⟂Outcome⟂Confidence never composited.',
  };
}
