/**
 * CAPADEX 3.0 — Program 1 · Phase 1.6 Outcome Framework / KPI Engine
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer over the canonical Outcome & KPI Model (`config/outcome-kpi-model.ts`).
 * It NEVER writes, NEVER runs DDL, NEVER invokes an outcome/recommendation/KPI engine — it only:
 *   1. serves the canonical model (12-step spine + 11 outcome types + 10 KPI families +
 *      per-lifecycle-stage outcomes + per-persona paths + axes),
 *   2. INDEPENDENTLY verifies each entry's evidence claims against the live filesystem + DB
 *      (the verifier — not the registry — is the SSoT for "present/absent" numbers),
 *   3. computes per-path / per-axis Coverage + outcome-type + KPI-family coverage (kept SEPARATE
 *      from Confidence/Outcome/Adoption),
 *   4. reports recommendation + intervention EFFECTIVENESS substrate honestly — calibrated
 *      effectiveness is ABSTAINED (Confidence axis, null≠0), never fabricated,
 *   5. classifies remaining outcome/KPI gaps (Launch-Critical/High/Medium/Low/Future),
 *   6. reports the realized-outcome ADOPTION + persona⟂outcome linkage (SEPARATE axes).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0. Never fabricate. The
 * runtime outcome/KPI machinery is REUSED (MX-102X outcome-intelligence + Phase-1.3 capture +
 * enterprise-analytics/benchmark/mei/employability KPI engines); this module adds ZERO new logic
 * and ZERO schema.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  OUTCOME_MODEL,
  OUTCOME_SPINE,
  OUTCOME_TYPES,
  KPI_FAMILIES,
  LIFECYCLE_OUTCOME_RULES,
  OUTCOME_KPI_AXES,
  OUTCOME_KPI_DECISIONS,
  type OutcomePath,
  type OutcomeEvidence,
  type OutcomeKpiStatus,
  type OutcomeType,
  type KpiFamily,
} from '../config/outcome-kpi-model';
// REUSE the single-source freshness constant from the existing progression-capture mechanism
// (no re-declaration). This module only READS it — it never invokes the capture/signal engine.
import { REASSESSMENT_FRESHNESS_DAYS } from './capadex/progression-outcome-capture';
// REUSE the EXISTING validation-loop calibration mechanism (PURE functions only) to WIRE the
// recommendation/intervention → outcome effectiveness link to real decision-time predictions
// (predicted_prob_at_decision, captured by recordValidationOutcome) WITHOUT a new engine/table/DDL.
// calibrationFromRows abstains honestly (cold_start / provisional, NEVER 'calibrated') until ≥ k_min
// real prediction+outcome pairs accrue — so the effectiveness_rate stays null until the data exists.
import { calibrationFromRows, toCalibrationPairs, type OutcomeRow } from './validation-loop-engine';

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

async function verifyTables(pool: Pool, tables: string[]): Promise<EvidenceVerification['tables']> {
  let present = 0, absent = 0, unknown = 0;
  const absentList: string[] = [];
  for (const t of tables) {
    const r = await tableExists(pool, t);
    if (r === null) unknown += 1;
    else if (r) present += 1;
    else { absent += 1; absentList.push(t); }
  }
  return { present, absent, unknown, total: tables.length, absentList };
}

export async function verifyEvidence(pool: Pool, ev: OutcomeEvidence): Promise<EvidenceVerification> {
  return {
    services: verifyFsGroup(ev.services, 'backend'),
    routes: verifyFsGroup(ev.routes, 'backend'),
    frontend: verifyFsGroup(ev.frontend, 'frontend'),
    tables: await verifyTables(pool, ev.tables),
  };
}

export interface PathCoverage {
  key: string;
  label: string;
  persona: string;
  status: OutcomeKpiStatus;
  statusNote?: string;
  /** Spine steps reached / 12 (the FROZEN canonical spine length). */
  spineReached: number;
  spineTotal: number;
  /** How many outcome types / KPI families this path declares (Coverage of the outcome+kpi axes). */
  outcomeTypes: number;
  kpiFamilies: number;
  /** All axes mapped in the registry by definition; confirms the mapping text is non-empty. */
  axesMapped: number;
  axesTotal: number;
  evidence: EvidenceVerification;
}

const AXIS_FIELD: Record<typeof OUTCOME_KPI_AXES[number], keyof OutcomePath> = {
  persona: 'personas',
  lifecycle: 'lifecycleStages',
  assessment: 'assessments',
  ai: 'aiInterpretation',
  recommendation: 'recommendationEffectiveness',
  intervention: 'interventionEffectiveness',
  outcome: 'outcomeTypes',
  kpi: 'kpiFamilies',
};

function axesMappedFor(t: OutcomePath): number {
  let n = 0;
  for (const axis of OUTCOME_KPI_AXES) {
    const v = t[AXIS_FIELD[axis]];
    if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null) n += 1;
  }
  return n;
}

export async function composeCoverage(pool: Pool): Promise<PathCoverage[]> {
  const out: PathCoverage[] = [];
  for (const t of OUTCOME_MODEL) {
    out.push({
      key: t.key,
      label: t.label,
      persona: t.persona,
      status: t.status,
      statusNote: t.statusNote,
      spineReached: t.spineReached.length,
      spineTotal: OUTCOME_SPINE.length,
      outcomeTypes: t.outcomeTypes.length,
      kpiFamilies: t.kpiFamilies.length,
      axesMapped: axesMappedFor(t),
      axesTotal: OUTCOME_KPI_AXES.length,
      evidence: await verifyEvidence(pool, t.evidence),
    });
  }
  return out;
}

/** Per-outcome-type coverage — each of the 11 outcome types' evidence VERIFIED vs live FS+DB. */
export interface OutcomeTypeCoverage {
  id: string;
  label: string;
  category: string;
  status: OutcomeKpiStatus;
  statusNote?: string;
  services: { present: number; total: number };
  tables: { present: number; absent: number; unknown: number; total: number; absentList: string[] };
}

export async function composeOutcomeTypeCoverage(pool: Pool): Promise<OutcomeTypeCoverage[]> {
  const out: OutcomeTypeCoverage[] = [];
  for (const o of OUTCOME_TYPES) {
    out.push({
      id: o.id,
      label: o.label,
      category: o.category,
      status: o.status,
      statusNote: o.statusNote,
      services: verifyFsGroup(o.evidence.services, 'backend'),
      tables: await verifyTables(pool, o.evidence.tables),
    });
  }
  return out;
}

/** Per-KPI-family coverage — each of the 10 KPI families' evidence VERIFIED vs live FS+DB. */
export interface KpiFamilyCoverage {
  key: string;
  label: string;
  status: OutcomeKpiStatus;
  statusNote?: string;
  exampleKpis: string[];
  services: { present: number; total: number };
  tables: { present: number; absent: number; unknown: number; total: number; absentList: string[] };
}

export async function composeKpiCoverage(pool: Pool): Promise<KpiFamilyCoverage[]> {
  const out: KpiFamilyCoverage[] = [];
  for (const k of KPI_FAMILIES) {
    out.push({
      key: k.key,
      label: k.label,
      status: k.status,
      statusNote: k.statusNote,
      exampleKpis: k.exampleKpis,
      services: verifyFsGroup(k.evidence.services, 'backend'),
      tables: await verifyTables(pool, k.evidence.tables),
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
 * Outcome/KPI gap classification (honest — grounded in the FROZEN blueprint verdict + the live
 * FS/DB scan). The assessment→outcome→KPI chain is mechanism-complete via REUSE (MX-102X
 * outcome-intelligence + Phase-1.3 capture + enterprise-analytics/benchmark/mei/employability KPI
 * engines). What remains are a few engineering RESIDUALS (none Launch-Critical) and — dominantly —
 * CONFIDENCE (calibrated effectiveness, deliberately abstained) + ADOPTION (real outcome/KPI
 * volume), reported SEPARATELY, NEVER as a gap (Coverage⟂Confidence⟂Outcome⟂Adoption never
 * composited; null≠0; nothing fabricated).
 */
export const OUTCOME_KPI_GAPS: ClassifiedGap[] = [
  // OPEN ENGINEERING GAPS: none. The former GAP-O1 (effectiveness) is now mechanism-CLOSED via REUSE
  // of the validation-loop calibration substrate (see composeEffectiveness `calibration` block +
  // MECH-EFFECTIVENESS-CALIBRATION-WIRED below). The former GAP-O2 and GAP-O3 were never engineering
  // defects — they are an ARCHITECTURE choice (zero-DDL persona read-time join) and an ADOPTION axis
  // (usage-driven KPI population) respectively; both are reported on their own axes, NEVER as a gap
  // (see AXIS-* entries below). Coverage⟂Confidence⟂Outcome⟂Adoption never composited; null≠0.
];

export interface ResolvedGap {
  id: string;
  title: string;
  closure: string;
  /** The honest remaining axis after the mechanism is in place — ADOPTION/CONFIDENCE (usage/data-driven). */
  residual: string;
}

/**
 * Mechanism-present links the outcome→KPI chain REUSES (closed by prior phases via
 * reuse-before-build, NOT rebuilt here) — recorded for traceability. Their honest residual is
 * ADOPTION/CONFIDENCE, never a gap.
 */
export const RESOLVED_OUTCOME_KPI_GAPS: ResolvedGap[] = [
  {
    id: 'MECH-UNIVERSAL-OUTCOME-CAPTURE',
    title: 'Universal realized-outcome capture into the canonical ledger',
    closure: 'PRESENT via REUSE (MX-102X + Phase 1.3): outcome-intelligence-engine + captureProgressionOutcome/captureJourneyTailMilestone write realized outcomes (placement/hire/progression/mastery/engagement) into validation_loop_outcomes. Gated by longitudinalOutcomeCapture → byte-identical OFF. No new engine/table/DDL.',
    residual: 'ADOPTION: real realized-outcome volume is usage-driven (honest-low/0; reported by composeOutcomeAdoption — Adoption⟂Coverage, null≠0).',
  },
  {
    id: 'MECH-KPI-SUBSTRATE',
    title: 'KPI computation substrate (enterprise analytics + benchmark + scoring)',
    closure: 'PRESENT via REUSE: the existing enterprise-analytics (anl_kpi_daily/anl_cohort_analysis/anl_benchmark_snapshot) + benchmark/mei/employability scoring engines compute the 10 KPI families. The composer READS coverage of this substrate; it never re-computes a KPI or builds a second KPI engine.',
    residual: 'ADOPTION: KPI population is usage-driven (Coverage⟂Adoption, null≠0).',
  },
  {
    id: 'MECH-LONGITUDINAL-IMPROVEMENT',
    title: 'Longitudinal improvement-validation substrate',
    closure: 'PRESENT via REUSE: longitudinal-memory + wc3 longitudinal-foundation record the trend that validates improvement vs baseline (the measured-outcome input). The composer READS it, never re-derives.',
    residual: 'CONFIDENCE + ADOPTION: improvement is measurable once >1 non-demo datapoint exists; calibrated accuracy is abstained by design (Coverage⟂Confidence⟂Adoption, null≠0).',
  },
  {
    id: 'MECH-EFFECTIVENESS-CALIBRATION-WIRED',
    title: 'Recommendation/intervention → outcome effectiveness is WIRED to the calibration mechanism (formerly GAP-O1)',
    closure: 'CLOSED via REUSE (no new engine/table/DDL): composeEffectiveness now READS the EXISTING validation-loop calibration mechanism — recordValidationOutcome captures the decision-time prediction (predicted_prob_at_decision); calibrationFromRows/toCalibrationPairs turn non-demo prediction+outcome rows into a calibrated effectiveness block with a k_min gate. The link is end-to-end: when ≥ k_min real pairs accrue, status flips to calibrated and effectiveness_rate lights up automatically. Demo excluded; nothing fabricated.',
    residual: 'CONFIDENCE: until ≥ k_min real non-demo prediction+outcome pairs accrue the status is cold_start/provisional and effectiveness_rate stays null (abstained, NEVER fabricated). This is a Confidence/Adoption axis — reported via the `calibration` block, never a gap. Coverage⟂Confidence⟂Adoption, null≠0.',
  },
  {
    id: 'AXIS-PERSONA-KPI-ARCHITECTURE',
    title: 'Per-persona KPI roll-up is a deliberate zero-DDL read-time join — an ARCHITECTURE axis, not a gap (formerly GAP-O2)',
    closure: 'RECLASSIFIED (not an engineering defect): persona KPIs are computed by JOINING validation_loop_outcomes to capadex_user_profiles.persona at READ time. This is a deliberate zero-DDL / byte-identical-OFF choice — Coverage IS present; "closing" it would mean adding a persisted persona column (DDL), which would VIOLATE this phase\'s contract. It is therefore an architecture axis, reported with k≥k_min masking, never an open gap.',
    residual: 'ARCHITECTURE (optional/future): if a persisted persona dimension is ever required, REUSE the existing profile substrate via a materialized read-model — no change to the canonical ledger, no DDL in this phase.',
  },
  {
    id: 'AXIS-PLATFORM-KPI-ADOPTION',
    title: 'Platform / organizational KPI population is an ADOPTION axis, not a gap (formerly GAP-O3)',
    closure: 'RECLASSIFIED (not an engineering defect): platform/organizational KPI families roll up over anl_kpi_daily/anl_cohort_analysis. The substrate + computing engine ALREADY exist (Coverage present); values are honest-low/0 ONLY because real usage volume is low. Forcing them non-zero would mean seeding fabricated data. It is therefore an Adoption axis, reported via composeOutcomeAdoption, never an open gap.',
    residual: 'ADOPTION: as real usage accrues, the EXISTING enterprise-analytics engine populates the KPI substrate — no new engine required (Coverage⟂Adoption, null≠0; never fabricated).',
  },
];

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

/** Never-throws row reader — returns rows on success, null on error (unreadable ≠ empty). */
async function readRows(pool: Pool, sql: string): Promise<any[] | null> {
  try {
    const r = await pool.query(sql);
    return r.rows;
  } catch {
    return null; // unreadable ≠ empty
  }
}

/**
 * Recommendation + Intervention EFFECTIVENESS composer (read-only, never-throws).
 * Reports the MEASURED substrate (how many recommendations / interventions exist, how many
 * realized outcomes exist) and HONESTLY ABSTAINS the calibrated effectiveness rate — there is no
 * decision-time prediction recorded, so an effectiveness/accuracy number would be fabricated.
 * effectiveness_rate is therefore null BY DESIGN (Confidence axis), distinct from a measured 0.
 * Demo subjects excluded so nothing self-inflates.
 */
export interface ChannelEffectiveness {
  /** Total non-demo substrate rows for this channel (recommendations or interventions). */
  substrate_rows: number | null;
  /** Distinct non-demo subjects with substrate for this channel. */
  substrate_subjects: number | null;
  /** Calibrated effectiveness rate — ABSTAINED (null) until a decision-time prediction exists. */
  effectiveness_rate: number | null;
  calibrated: false;
  note: string;
}

/**
 * Loop-level calibrated effectiveness, READ through the EXISTING validation-loop calibration
 * mechanism (no new engine/table/DDL). It abstains honestly (status cold_start/provisional, rate
 * null) until ≥ k_min real non-demo prediction+outcome pairs accrue — never fabricated.
 */
export interface EffectivenessCalibration {
  /** Realized {prediction, outcome} pairs available for calibration (non-demo, binary, finite prob in [0,1]). null if unreadable. */
  pairs_used: number | null;
  /** cold_start | provisional | calibrated — NEVER 'calibrated' below k_min. null if unreadable. */
  status: string | null;
  k_min: number | null;
  remaining_to_calibrated: number | null;
  /** Brier score / ECE — null until ≥1 realized outcome pair (never 0 as a default). */
  brier: number | null;
  ece: number | null;
  /** Loop-level observed effectiveness (success rate across evidence pairs) — non-null ONLY when status==='calibrated'. */
  effectiveness_rate: number | null;
  note: string;
}

export interface OutcomeEffectiveness {
  flag: 'outcomeFrameworkKpiEngine';
  recommendation: ChannelEffectiveness;
  intervention: ChannelEffectiveness;
  /** Total non-demo realized outcomes in the canonical ledger (the outcome side of both links). */
  realized_outcomes: number | null;
  /** Loop-level calibrated effectiveness via REUSE of the validation-loop calibration mechanism. */
  calibration: EffectivenessCalibration;
  note: string;
}

export async function composeEffectiveness(pool: Pool): Promise<OutcomeEffectiveness> {
  const rec_rows = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM development_recommendations`,
  );
  const rec_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT user_id)::int AS n FROM development_recommendations WHERE user_id IS NOT NULL`,
  );
  const int_rows = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM capadex_interventions`,
  );
  const int_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT user_id)::int AS n FROM capadex_interventions WHERE user_id IS NOT NULL`,
  );
  const realized_outcomes = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM validation_loop_outcomes WHERE COALESCE(is_demo, false) = false`,
  );
  const channelNote =
    'Substrate counts are MEASURED (Coverage); per-channel effectiveness_rate stays null because the ' +
    'decision-time prediction is recorded loop-level (validation_loop_outcomes), not per recommendation/' +
    'intervention row — see the loop-level `calibration` block. Confidence⟂Coverage, null≠0.';

  // REUSE the EXISTING validation-loop calibration mechanism (PURE) over non-demo outcome rows that
  // carry a decision-time prediction. This WIRES the effectiveness link end-to-end WITHOUT a new
  // engine/table/DDL: when ≥ k_min real prediction+outcome pairs accrue, status flips to 'calibrated'
  // and the rate lights up automatically; until then it abstains honestly (cold_start). null≠0.
  const predRows = await readRows(
    pool,
    `SELECT outcome_kind, outcome_value, predicted_prob_at_decision
       FROM validation_loop_outcomes
      WHERE COALESCE(is_demo, false) = false`,
  );
  let calibration: EffectivenessCalibration;
  if (predRows === null) {
    calibration = {
      pairs_used: null,
      status: null,
      k_min: null,
      remaining_to_calibrated: null,
      brier: null,
      ece: null,
      effectiveness_rate: null,
      note:
        'Calibration substrate UNREADABLE (validation_loop_outcomes / predicted_prob_at_decision not ' +
        'readable). null = unknown, NOT 0. Nothing fabricated.',
    };
  } else {
    const cal = calibrationFromRows(predRows as OutcomeRow[]);
    const pairs = toCalibrationPairs(predRows as OutcomeRow[]);
    // Loop-level observed effectiveness = realized success rate across evidence pairs — surfaced ONLY
    // once the mechanism reports 'calibrated' (≥ k_min). Below k_min it stays null (never fabricated).
    const observed =
      cal.status === 'calibrated' && pairs.length > 0
        ? pairs.reduce((s, p) => s + p.outcome, 0) / pairs.length
        : null;
    calibration = {
      pairs_used: cal.pairs_used,
      status: cal.status,
      k_min: cal.k_min,
      remaining_to_calibrated: cal.remaining_to_calibrated,
      brier: cal.brier,
      ece: cal.ece,
      effectiveness_rate: observed,
      note:
        'Loop-level effectiveness READ through the EXISTING validation-loop calibration mechanism ' +
        '(recordValidationOutcome captures predicted_prob_at_decision; calibrationFromRows calibrates ' +
        'with a k_min gate). status cold_start/provisional → effectiveness_rate null (Confidence axis, ' +
        'abstained, NEVER fabricated); flips to calibrated + a real rate only when ≥ k_min non-demo ' +
        'prediction+outcome pairs accrue. No engine invoked; zero DDL.',
    };
  }

  return {
    flag: 'outcomeFrameworkKpiEngine',
    recommendation: {
      substrate_rows: rec_rows,
      substrate_subjects: rec_subjects,
      effectiveness_rate: null,
      calibrated: false,
      note: channelNote,
    },
    intervention: {
      substrate_rows: int_rows,
      substrate_subjects: int_subjects,
      effectiveness_rate: null,
      calibrated: false,
      note: channelNote,
    },
    realized_outcomes,
    calibration,
    note:
      'Recommendation→outcome and intervention→outcome EFFECTIVENESS. The substrate (recommendations, ' +
      'interventions, realized outcomes) is MEASURED (Coverage); loop-level calibrated effectiveness is ' +
      'WIRED via REUSE of the validation-loop calibration mechanism (`calibration` block) and abstains ' +
      'honestly (cold_start, rate null) until ≥ k_min real prediction+outcome pairs accrue — Confidence ' +
      'axis, null≠0, never fabricated. Demo subjects excluded. No engine is invoked; zero DDL.',
  };
}

/**
 * Realized-outcome ADOPTION composer (read-only, never-throws).
 * Reports how much the assessment→outcome→KPI loop is actually EXERCISED. This is the ADOPTION
 * axis — kept strictly SEPARATE from Coverage and never composited. null≠0; demo excluded.
 */
export interface OutcomeAdoption {
  flag: 'outcomeFrameworkKpiEngine';
  freshness_window_days: number;
  /** Total non-demo realized-outcome rows captured (all types). */
  realized_outcomes: number | null;
  /** Distinct non-demo subjects with ≥1 realized outcome. */
  outcome_subjects: number | null;
  /** Distinct non-demo subjects with a captured stage_completion (Progress) milestone. */
  progressed_subjects: number | null;
  /** Distinct non-demo subjects with a captured reached_mastery (Mastery) milestone. */
  mastery_subjects: number | null;
  /** Distinct subjects with >1 longitudinal datapoint (reassessment / continuous). */
  reassessed_subjects: number | null;
  /** KPI substrate rows populated (anl_kpi_daily) — platform KPI adoption. */
  kpi_rows: number | null;
  note: string;
}

export async function composeOutcomeAdoption(pool: Pool): Promise<OutcomeAdoption> {
  const realized_outcomes = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM validation_loop_outcomes WHERE COALESCE(is_demo, false) = false`,
  );
  const outcome_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT subject_user_id)::int AS n FROM validation_loop_outcomes WHERE COALESCE(is_demo, false) = false`,
  );
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
  const reassessed_subjects = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM (
        SELECT user_id FROM wc3_longitudinal_snapshots
         WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1
     ) t`,
  );
  const kpi_rows = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM anl_kpi_daily`);
  return {
    flag: 'outcomeFrameworkKpiEngine',
    freshness_window_days: REASSESSMENT_FRESHNESS_DAYS,
    realized_outcomes,
    outcome_subjects,
    progressed_subjects,
    mastery_subjects,
    reassessed_subjects,
    kpi_rows,
    note:
      'ADOPTION axis only — exercise of the (reuse-instrumented) assessment→outcome→KPI loop. SEPARATE ' +
      'from Coverage; never composited. null = unreadable, 0 = measured-empty. Demo subjects excluded. ' +
      'Capture is gated by longitudinalOutcomeCapture; KPI population by the enterprise-analytics engine — ' +
      'this phase builds NO new outcome/KPI machinery.',
  };
}

/**
 * Persona-outcome linkage composer (read-only, never-throws).
 * Validates whether realized outcomes can be attributed per persona by JOINING realized outcomes
 * (validation_loop_outcomes) to the persona substrate (capadex_user_profiles) at READ time — no
 * schema change, no persona column added. k-anonymity: per-persona counts below k_min are
 * suppressed (masked). Coverage⟂Outcome⟂Confidence stay distinct.
 */
export interface PersonaOutcomeLinkage {
  flag: 'outcomeFrameworkKpiEngine';
  linkage_present: boolean;
  k_min: number;
  personas: Array<{ persona: string; outcomes: number | null; suppressed: boolean }>;
  note: string;
}

export async function composePersonaOutcomeLinkage(pool: Pool): Promise<PersonaOutcomeLinkage> {
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
    flag: 'outcomeFrameworkKpiEngine',
    linkage_present: readable,
    k_min,
    personas,
    note:
      'Persona⟂Outcome linkage validated by a READ-TIME join (no persona column added, zero DDL). ' +
      'Per-persona counts below k_min are suppressed (masked) for anonymity. linkage_present:false means ' +
      'the join was unreadable, NOT that outcomes are zero (null≠0). Coverage⟂Outcome⟂Confidence never composited.',
  };
}

export interface OutcomeKpiSummary {
  flag: 'outcomeFrameworkKpiEngine';
  spine_frozen: true;
  spine_step_count: number;
  outcome_type_count: number;
  kpi_family_count: number;
  lifecycle_rule_count: number;
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
  /** Outcome-type coverage rollup (how many of the 11 types are SUPPORTED/PARTIAL). */
  outcome_type_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  /** KPI-family coverage rollup (how many of the 10 families are SUPPORTED/PARTIAL). */
  kpi_family_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  /** OPEN engineering gaps by severity (none Launch-Critical). */
  gap_counts: Record<GapSeverity, number>;
  resolved_gap_count: number;
  decisions: typeof OUTCOME_KPI_DECISIONS;
  /** Enterprise-ready verdict — STRUCTURAL only; chain mechanism-complete via reuse, ADOPTION/CONFIDENCE pending. */
  enterprise_ready: { verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING'; note: string };
}

function rollupStatus(items: Array<{ status: OutcomeKpiStatus }>) {
  const r = { supported: 0, partial: 0, dead_end: 0, missing: 0, total: items.length };
  for (const i of items) {
    if (i.status === 'SUPPORTED') r.supported += 1;
    else if (i.status === 'PARTIAL') r.partial += 1;
    else if (i.status === 'DEAD_END') r.dead_end += 1;
    else r.missing += 1;
  }
  return r;
}

export async function composeSummary(pool: Pool): Promise<OutcomeKpiSummary> {
  const coverage = await composeCoverage(pool);
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
  for (const p of OUTCOME_MODEL) for (const code of p.personas) personas.add(code);

  const gap_counts: Record<GapSeverity, number> = {
    'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0,
  };
  for (const g of OUTCOME_KPI_GAPS) gap_counts[g.severity] += 1;

  return {
    flag: 'outcomeFrameworkKpiEngine',
    spine_frozen: true,
    spine_step_count: OUTCOME_SPINE.length,
    outcome_type_count: OUTCOME_TYPES.length,
    kpi_family_count: KPI_FAMILIES.length,
    lifecycle_rule_count: LIFECYCLE_OUTCOME_RULES.length,
    path_count: OUTCOME_MODEL.length,
    persona_count: personas.size,
    status_counts,
    evidence_rollup,
    spine_rollup,
    outcome_type_rollup: rollupStatus(OUTCOME_TYPES),
    kpi_family_rollup: rollupStatus(KPI_FAMILIES),
    gap_counts,
    resolved_gap_count: RESOLVED_OUTCOME_KPI_GAPS.length,
    decisions: OUTCOME_KPI_DECISIONS,
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING',
      note:
        'ONE canonical Outcome & KPI Model answers "assessment → intervention → MEASURABLE OUTCOME → KPI": ' +
        'a FROZEN 12-step outcome spine (Assessment→Evidence→AI→Recommend→Intervene→Learn→Practice→' +
        'Reassess→Improve→Measured-Outcome→KPI-Update→Continuous-Optimization), 11 outcome-tracking types, ' +
        '10 KPI families, four per-lifecycle-stage outcome rules and a per-persona path register — every ' +
        'field mapped to the eight outcome/KPI axes and verified against the live repo. The chain is ' +
        'mechanism-complete via REUSE-before-build: MX-102X outcome-intelligence + Phase-1.3 ' +
        'progression-outcome-capture write realized outcomes into validation_loop_outcomes; the existing ' +
        'enterprise-analytics + benchmark + mei/employability engines compute the KPI families. This phase ' +
        'adds ONE read-only composer/registry + ZERO new outcome/KPI logic + ZERO schema. OPEN engineering ' +
        'gaps = 0: the recommendation/intervention→outcome effectiveness link is WIRED via REUSE of the ' +
        'existing validation-loop calibration mechanism (formerly GAP-O1 — now mechanism-closed); the ' +
        'per-persona KPI roll-up is a deliberate zero-DDL read-time join (an ARCHITECTURE axis, formerly ' +
        'GAP-O2) and platform/organizational KPI population is usage-driven (an ADOPTION axis, formerly ' +
        'GAP-O3) — both reported on their own axes, NEVER as gaps. The dominant remaining axes are ' +
        'CONFIDENCE (calibration abstained until ≥ k_min real prediction+outcome pairs accrue) and ' +
        'ADOPTION (real outcome/KPI volume, currently honest-low/0, reported SEPARATELY) — usage/data ' +
        'axes, NOT gaps. The verdict stays STRUCTURAL (engineering complete via reuse; adoption/confidence ' +
        'are data-driven and never fabricated). Coverage⟂Confidence⟂Outcome⟂Adoption are reported ' +
        'separately and never composited; null≠0.',
    },
  };
}
