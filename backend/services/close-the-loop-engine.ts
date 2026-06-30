/**
 * Task #292 — Close-the-Loop Outcome Core (engine).
 *
 * The back half of CAPADEX (re-measure → exit → realized outcome → KPI) is the systemic gap
 * identified in the Phase 0.1 Product Blueprint (GAP-O1 / GAP-K1 / GAP-A4 / GAP-P1 / GAP-P2).
 * This engine delivers the MECHANISM that closes it, strictly additive + flag-gated (`closeTheLoop`):
 *
 *   1. KPI BINDING  — every major product capability is bound to ≥1 authored KPI with a measurement
 *      probe against a REAL substrate (closes GAP-K1). Where a measurement is not wired the binding
 *      still exists and the value is an honest null + reason (the binding ⟂ the measurement coverage).
 *   2. OUTCOME ATTRIBUTION — realized outcomes are captured ATTRIBUTED to a capability + lifecycle
 *      stage (the dimension legacy validation_loop_outcomes lacks → closes GAP-O1). Binary types also
 *      bridge into validation_loop_outcomes so the existing calibration surfaces stay CONNECTED
 *      (no parallel math, no duplicate namespace).
 *   3. RE-MEASUREMENT — Exit / Continuous / Progress re-administration of EXISTING assessments is
 *      recorded as deltas (closes GAP-A4 / GAP-P1), the substrate a Growth→Mastery evidence gate needs.
 *
 * Honesty contract (NEVER regress):
 *   - Flag-gated on `closeTheLoop` (FF_CLOSE_THE_LOOP, default OFF). OFF → no schema, no write, every
 *     route 503 → byte-identical legacy behaviour incl. schema. Write fns assert the flag BEFORE the
 *     lazy ensure-schema so a direct/tooling caller cannot create a table while OFF.
 *   - Coverage ⟂ Confidence ⟂ Evidence are SEPARATE axes, NEVER composited.
 *   - null ≠ 0: an absent/unreadable substrate degrades to null (never a fabricated 0); a present-but-
 *     empty substrate is an honest 0.
 *   - Demo rows (@example.com / explicit is_demo) are recorded but EXCLUDED from every realized /
 *     evidence figure; counted separately, never deleted.
 *   - Abstain < k_min=30: a per-group success RATE / improvement claim is SUPPRESSED below k_min;
 *     counts are still shown. Predictions stay ABSTAINED until realized pairs reach k_min.
 *   - Never fabricates an outcome, a KPI value, or an accuracy claim. This phase ships the MECHANISM;
 *     with ~0 realized non-demo data every surface honestly reports "wired, pending real data".
 */

import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { VALIDATION_K_MIN } from './validation-loop-engine';
import {
  recordValidationOutcome,
  type ValidationOutcomeType,
} from './validation-loop-intake';

export const CLOSE_THE_LOOP_VERSION = '292.0.0';
export const CTL_K_MIN = VALIDATION_K_MIN; // platform precedent: calibrated confidence needs ≥30 realized

// ── Canonical taxonomies ──────────────────────────────────────────────────────────────────────────
export const CTL_OUTCOME_TYPES = [
  'hiring', 'performance', 'promotion', 'retention', 'career', 'learning',
] as const;
export type CtlOutcomeType = (typeof CTL_OUTCOME_TYPES)[number];

/** The four binary types that bridge into the existing validation-loop calibration surface. */
const VALIDATION_BRIDGE_TYPES: readonly ValidationOutcomeType[] =
  ['hiring', 'performance', 'promotion', 'retention'];

export const CTL_REMEASURE_TRIGGERS = ['exit', 'continuous', 'progress'] as const;
export type CtlRemeasureTrigger = (typeof CTL_REMEASURE_TRIGGERS)[number];

/** CAPADEX lifecycle stages (engine codes — the only four that exist in code). */
export const CTL_LIFECYCLE_STAGES = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;
export type CtlLifecycleStage = (typeof CTL_LIFECYCLE_STAGES)[number];

// ── KPI binding catalog (config-as-data) ────────────────────────────────────────────────────────────
// Each of the 11 major product capabilities (Phase 0.1 traceability matrix 09) is bound to a KPI.
// `target` is a PRODUCT-AUTHORED success goal (the binding) — NOT a measurement; a null target means
// the KPI is volumetric / tracked-without-a-target (honest). `measurement` is a probe against a REAL
// substrate; where no measurement is wired it is {method:'not_wired'} and the value degrades to null.
type Measurement =
  | { method: 'count'; probe: string; sql: string }
  | { method: 'scalar'; probe: string; sql: string } // returns a single numeric "v" (null on no rows)
  | { method: 'not_wired'; reason: string };

export interface KpiBinding {
  id: string;
  capability_key: string;
  capability_label: string;
  name: string;
  description: string;
  unit: 'count' | 'rate' | 'score';
  target: number | null;
  target_source: 'product_authored' | 'none';
  direction: 'higher_better' | 'lower_better';
  lifecycle_stage: CtlLifecycleStage | 'all' | null;
  measurement: Measurement;
}

export const CAPABILITY_KPIS: KpiBinding[] = [
  {
    id: 'kpi_capadex_completed_reports',
    capability_key: 'capadex_concern_assessment',
    capability_label: 'CAPADEX concern assessment',
    name: 'Completed assessment reports',
    description: 'CAPADEX assessment reports generated (a completed diagnostic journey).',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'CAP_CUR',
    measurement: { method: 'count', probe: 'public.capadex_reports', sql: 'SELECT COUNT(*)::int AS v FROM capadex_reports' },
  },
  {
    id: 'kpi_signals_captured',
    capability_key: 'signal_behaviour_analysis',
    capability_label: 'Signal / behaviour analysis',
    name: 'Behavioural signals captured',
    description: 'Per-session behavioural signals captured by the analysis engine.',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'CAP_INS',
    measurement: { method: 'count', probe: 'public.capadex_session_signals', sql: 'SELECT COUNT(*)::int AS v FROM capadex_session_signals' },
  },
  {
    id: 'kpi_competency_score_runs',
    capability_key: 'competency_assessment',
    capability_label: 'Competency assessment',
    name: 'Competency score runs',
    description: 'Competency assessment scoring runs executed.',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'CAP_GRW',
    measurement: { method: 'count', probe: 'public.onto_competency_score_runs', sql: 'SELECT COUNT(*)::int AS v FROM onto_competency_score_runs' },
  },
  {
    id: 'kpi_readiness_snapshots',
    capability_key: 'career_builder_readiness',
    capability_label: 'Career Builder / readiness',
    name: 'Career readiness snapshots',
    description: 'Career readiness snapshots persisted (the re-measurable readiness series).',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'CAP_GRW',
    measurement: { method: 'count', probe: 'public.career_readiness_history', sql: 'SELECT COUNT(*)::int AS v FROM career_readiness_history' },
  },
  {
    id: 'kpi_hiring_success_rate',
    capability_key: 'talent_match_hiring',
    capability_label: 'Talent match / hiring',
    name: 'Realized hiring success rate',
    description: 'Mean realized hiring outcome (Hired=1 / Rejected=0) over NON-demo attributed outcomes.',
    unit: 'rate', target: 0.6, target_source: 'product_authored', direction: 'higher_better',
    lifecycle_stage: 'CAP_MAS',
    measurement: {
      method: 'scalar', probe: 'public.close_the_loop_outcomes',
      sql: `SELECT AVG(outcome_value)::float AS v FROM close_the_loop_outcomes
              WHERE outcome_type = 'hiring' AND outcome_kind = 'binary' AND is_demo = false`,
    },
  },
  {
    id: 'kpi_growth_recommendations',
    capability_key: 'recommendation_growth_plan',
    capability_label: 'Recommendation / growth plan',
    name: 'Growth recommendations issued',
    description: 'Recommendations / growth-plan items issued to learners.',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'CAP_GRW',
    measurement: { method: 'count', probe: 'public.capadex_recommendations', sql: 'SELECT COUNT(*)::int AS v FROM capadex_recommendations' },
  },
  {
    id: 'kpi_reports_generated',
    capability_key: 'reports_dashboards',
    capability_label: 'Reports / dashboards',
    name: 'Reports generated',
    description: 'Total CAPADEX reports generated across the platform.',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'all',
    measurement: { method: 'count', probe: 'public.capadex_reports', sql: 'SELECT COUNT(*)::int AS v FROM capadex_reports' },
  },
  {
    id: 'kpi_institutional_outcomes',
    capability_key: 'institutional_intelligence',
    capability_label: 'Institutional intelligence',
    name: 'Institution-attributed realized outcomes',
    description: 'Realized outcomes attributed to the institutional-intelligence capability (k-anon ≥ k_min).',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'all',
    measurement: {
      method: 'count', probe: 'public.close_the_loop_outcomes',
      sql: `SELECT COUNT(*)::int AS v FROM close_the_loop_outcomes
              WHERE capability_key = 'institutional_intelligence' AND is_demo = false`,
    },
  },
  {
    id: 'kpi_paid_conversions',
    capability_key: 'commercial_entitlement',
    capability_label: 'Commercial / entitlement',
    name: 'Paid conversions',
    description: 'Successful CAPADEX payments (commercial conversion).',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: null,
    measurement: {
      method: 'count', probe: 'public.capadex_payments',
      sql: `SELECT COUNT(*)::int AS v FROM capadex_payments WHERE status IN ('paid','captured','success','succeeded')`,
    },
  },
  {
    id: 'kpi_governance_intel',
    capability_key: 'platform_governance_intel',
    capability_label: 'Platform governance intelligence',
    name: 'Governance intelligence outcome binding',
    description: 'Governance intelligence is structural/operational; no realized-outcome KPI is wired in this phase.',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: null,
    measurement: { method: 'not_wired', reason: 'governance_is_structural_not_outcome_bearing' },
  },
  {
    id: 'kpi_realized_attributed_outcomes',
    capability_key: 'outcome_kpi',
    capability_label: 'Outcome & KPI (close-the-loop)',
    name: 'Realized attributed outcomes',
    description: 'NON-demo realized outcomes captured WITH capability + lifecycle attribution — the close-the-loop coverage itself.',
    unit: 'count', target: null, target_source: 'none', direction: 'higher_better',
    lifecycle_stage: 'CAP_MAS',
    measurement: {
      method: 'count', probe: 'public.close_the_loop_outcomes',
      sql: 'SELECT COUNT(*)::int AS v FROM close_the_loop_outcomes WHERE is_demo = false',
    },
  },
];

// ── Schema (lazy, write-paths only) ─────────────────────────────────────────────────────────────────
let schemaReady = false;
export async function ensureCloseTheLoopSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  const p = path.join(__dirname, '../migrations/20270101_close_the_loop_outcome_core.sql');
  const sql = fs.readFileSync(p, 'utf-8');
  await pool.query(sql);
  schemaReady = true;
}

// ── Read helpers (never-throws; null ≠ 0) ───────────────────────────────────────────────────────────
async function tablePresent(pool: Pool, qualified: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [qualified]);
    return r.rows[0]?.t != null;
  } catch { return false; }
}

interface MeasureResult { value: number | null; status: string; }

/** Probe then measure a single numeric. Absent table → null/source_absent; error → null/unreadable;
 *  AVG over 0 rows → null/no_data; COUNT → honest 0 when empty. null is NEVER conflated with 0. */
async function measure(pool: Pool, m: Measurement): Promise<MeasureResult> {
  if (m.method === 'not_wired') return { value: null, status: 'not_wired' };
  const present = await tablePresent(pool, m.probe);
  if (!present) return { value: null, status: 'source_absent' };
  try {
    const r = await pool.query(m.sql);
    const raw = r.rows[0]?.v;
    if (raw == null) return { value: null, status: m.method === 'count' ? 'measured' : 'no_data' };
    const n = Number(raw);
    if (!Number.isFinite(n)) return { value: null, status: 'no_data' };
    return { value: n, status: 'measured' };
  } catch { return { value: null, status: 'unreadable' }; }
}

// ── Write side ──────────────────────────────────────────────────────────────────────────────────────
export interface RecordAttributedOutcomeArgs {
  capabilityKey: string;
  lifecycleStage?: string | null;
  outcomeType: CtlOutcomeType;
  outcomeKind?: 'binary' | 'continuous';
  outcomeValue: number;
  predictedProb?: number | null;
  predictedBasis?: string | null;
  subjectEmail: string;
  subjectUserId?: string | null;
  source?: string;
  refId: string;
  /** Canonical validation-loop decision id. When supplied for a binary bridge type, the outcome is
   *  bridged into validation_loop_outcomes UNDER THIS id, so the native (outcome_type, ref_id)
   *  uniqueness dedupes the SAME real-world decision across BOTH the CTL bridge and the native intake
   *  path (no double-count in calibration). Omitted → NO bridge (CTL-only; bridged:false), because a
   *  synthetic key can never align with native intake and would risk double-counting one decision. */
  validationRefId?: string | null;
  detail?: Record<string, unknown>;
}
export interface RecordResult { recorded: boolean; reason?: string; is_demo?: boolean; bridged?: boolean; }

const VALID_CAPABILITY_KEYS = new Set(CAPABILITY_KPIS.map(k => k.capability_key));

/** Record a realized outcome ATTRIBUTED to a capability + lifecycle stage. Flag-gated (asserts BEFORE
 *  ensure-schema), never-throws, demo-aware, idempotent on (outcome_type, ref_id). Binary types that
 *  carry a finite prediction additionally bridge into validation_loop_outcomes (best-effort) so the
 *  existing calibration surfaces stay connected. */
export async function recordAttributedOutcome(
  pool: Pool, args: RecordAttributedOutcomeArgs,
): Promise<RecordResult> {
  if (!isFlagEnabled('closeTheLoop')) return { recorded: false, reason: 'flag_off' };

  const capability = String(args.capabilityKey ?? '').trim();
  if (!VALID_CAPABILITY_KEYS.has(capability)) return { recorded: false, reason: 'invalid_capability_key' };
  const type = String(args.outcomeType ?? '').trim().toLowerCase() as CtlOutcomeType;
  if (!CTL_OUTCOME_TYPES.includes(type)) return { recorded: false, reason: 'invalid_outcome_type' };
  const stage = args.lifecycleStage ? String(args.lifecycleStage).trim().toUpperCase() : null;
  if (stage != null && !CTL_LIFECYCLE_STAGES.includes(stage as CtlLifecycleStage)) {
    return { recorded: false, reason: 'invalid_lifecycle_stage' };
  }
  const email = String(args.subjectEmail ?? '').trim().toLowerCase();
  if (!email) return { recorded: false, reason: 'subject_email_required' };
  const refId = String(args.refId ?? '').trim();
  if (!refId) return { recorded: false, reason: 'ref_id_required' };
  const kind = args.outcomeKind === 'continuous' ? 'continuous' : 'binary';
  const value = Number(args.outcomeValue);
  if (!Number.isFinite(value)) return { recorded: false, reason: 'outcome_value_must_be_numeric' };
  if (kind === 'binary' && value !== 0 && value !== 1) {
    return { recorded: false, reason: 'binary_outcome_value_must_be_0_or_1' };
  }
  const isDemo = email.endsWith('@example.com');
  let pred: number | null = args.predictedProb == null ? null : Number(args.predictedProb);
  if (pred != null && (!Number.isFinite(pred) || pred < 0 || pred > 1)) pred = null;

  try {
    await ensureCloseTheLoopSchema(pool);
    await pool.query(
      `INSERT INTO close_the_loop_outcomes
         (subject_email, subject_user_id, capability_key, lifecycle_stage, outcome_type, outcome_kind,
          outcome_value, predicted_prob_at_decision, predicted_basis, decision_at, observed_at,
          source, is_demo, ref_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now(),$10,$11,$12,$13)
       ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET
         capability_key = EXCLUDED.capability_key,
         lifecycle_stage = EXCLUDED.lifecycle_stage,
         outcome_kind = EXCLUDED.outcome_kind,
         outcome_value = EXCLUDED.outcome_value,
         predicted_prob_at_decision = EXCLUDED.predicted_prob_at_decision,
         predicted_basis = EXCLUDED.predicted_basis,
         observed_at = now(),
         detail = EXCLUDED.detail`,
      [
        email,
        args.subjectUserId != null ? String(args.subjectUserId) : null,
        capability, stage, type, kind, value, pred,
        args.predictedBasis != null ? String(args.predictedBasis) : null,
        args.source ?? 'manual', isDemo, refId,
        JSON.stringify(args.detail ?? {}),
      ],
    );

    // Bridge the 4 binary calibration types into the existing validation-loop surface (best-effort,
    // never-throws, demo-aware, idempotent). Keeps the loop CONNECTED — no parallel calibration math.
    // CRITICAL: the bridge fires ONLY when the caller supplies a CANONICAL validationRefId and writes
    // UNDER that id, so the native (outcome_type, ref_id) uniqueness dedupes the SAME real-world
    // decision whether it arrives via this bridge or via native intake (no double-count). With no
    // canonical id we DON'T bridge — a synthetic key could never align with native and would risk
    // counting one decision twice in calibration.
    let bridged = false;
    const canonicalRef = args.validationRefId != null ? String(args.validationRefId).trim() : '';
    if (canonicalRef && kind === 'binary' && VALIDATION_BRIDGE_TYPES.includes(type as ValidationOutcomeType)) {
      try {
        const r = await recordValidationOutcome(pool, {
          outcomeType: type as ValidationOutcomeType,
          subjectEmail: email,
          subjectUserId: args.subjectUserId ?? null,
          outcomeValue: (value === 1 ? 1 : 0),
          predictedProb: pred,
          predictedBasis: args.predictedBasis ?? null,
          source: 'close_the_loop_bridge',
          refId: canonicalRef, // CANONICAL decision id → native (outcome_type,ref_id) dedupes cross-path
          detail: { capability_key: capability, lifecycle_stage: stage, ctl_ref_id: refId },
        });
        bridged = r.recorded;
      } catch { bridged = false; }
    }
    return { recorded: true, is_demo: isDemo, bridged };
  } catch (err) {
    console.error('[close-the-loop] recordAttributedOutcome failed:', (err as any)?.message ?? err);
    return { recorded: false, reason: 'write_failed' };
  }
}

export interface RecordRemeasurementArgs {
  capabilityKey: string;
  assessmentRef?: string | null;
  trigger: CtlRemeasureTrigger;
  baselineScore?: number | null;
  remeasuredScore?: number | null;
  delta?: number | null;
  lifecycleStageFrom?: string | null;
  lifecycleStageTo?: string | null;
  subjectEmail: string;
  subjectUserId?: string | null;
  source?: string;
  refId: string;
  detail?: Record<string, unknown>;
}

/** Record an Exit / Continuous / Progress re-administration of an EXISTING assessment as a delta.
 *  Flag-gated (asserts BEFORE ensure-schema), never-throws, demo-aware, idempotent on (trigger, ref_id). */
export async function recordRemeasurement(
  pool: Pool, args: RecordRemeasurementArgs,
): Promise<RecordResult> {
  if (!isFlagEnabled('closeTheLoop')) return { recorded: false, reason: 'flag_off' };

  const capability = String(args.capabilityKey ?? '').trim();
  if (!VALID_CAPABILITY_KEYS.has(capability)) return { recorded: false, reason: 'invalid_capability_key' };
  const trigger = String(args.trigger ?? '').trim().toLowerCase() as CtlRemeasureTrigger;
  if (!CTL_REMEASURE_TRIGGERS.includes(trigger)) return { recorded: false, reason: 'invalid_trigger' };
  const email = String(args.subjectEmail ?? '').trim().toLowerCase();
  if (!email) return { recorded: false, reason: 'subject_email_required' };
  const refId = String(args.refId ?? '').trim();
  if (!refId) return { recorded: false, reason: 'ref_id_required' };

  const num = (x: unknown): number | null => {
    if (x == null) return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const baseline = num(args.baselineScore);
  const remeasured = num(args.remeasuredScore);
  let delta = num(args.delta);
  if (delta == null && baseline != null && remeasured != null) delta = remeasured - baseline;
  const stageFrom = args.lifecycleStageFrom ? String(args.lifecycleStageFrom).trim().toUpperCase() : null;
  const stageTo = args.lifecycleStageTo ? String(args.lifecycleStageTo).trim().toUpperCase() : null;
  const isDemo = email.endsWith('@example.com');

  try {
    await ensureCloseTheLoopSchema(pool);
    await pool.query(
      `INSERT INTO close_the_loop_remeasurements
         (subject_email, subject_user_id, capability_key, assessment_ref, trigger, baseline_score,
          remeasured_score, delta, lifecycle_stage_from, lifecycle_stage_to, observed_at, source,
          is_demo, ref_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12,$13,$14)
       ON CONFLICT (trigger, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET
         capability_key = EXCLUDED.capability_key,
         assessment_ref = EXCLUDED.assessment_ref,
         baseline_score = EXCLUDED.baseline_score,
         remeasured_score = EXCLUDED.remeasured_score,
         delta = EXCLUDED.delta,
         lifecycle_stage_from = EXCLUDED.lifecycle_stage_from,
         lifecycle_stage_to = EXCLUDED.lifecycle_stage_to,
         observed_at = now(),
         detail = EXCLUDED.detail`,
      [
        email,
        args.subjectUserId != null ? String(args.subjectUserId) : null,
        capability, args.assessmentRef != null ? String(args.assessmentRef) : null,
        trigger, baseline, remeasured, delta, stageFrom, stageTo,
        args.source ?? 'manual', isDemo, refId, JSON.stringify(args.detail ?? {}),
      ],
    );
    return { recorded: true, is_demo: isDemo };
  } catch (err) {
    console.error('[close-the-loop] recordRemeasurement failed:', (err as any)?.message ?? err);
    return { recorded: false, reason: 'write_failed' };
  }
}

// ── Read side (compose-never-recompute, GET-never-writes) ────────────────────────────────────────────

/** KPI binding surface: every capability bound to a KPI + the live measured value (or honest null). */
export async function composeKpiBindings(pool: Pool) {
  const kpis = [];
  for (const k of CAPABILITY_KPIS) {
    const res = await measure(pool, k.measurement);
    const meetsTarget = (res.value != null && k.target != null)
      ? (k.direction === 'higher_better' ? res.value >= k.target : res.value <= k.target)
      : null;
    kpis.push({
      id: k.id,
      capability_key: k.capability_key,
      capability_label: k.capability_label,
      name: k.name,
      description: k.description,
      unit: k.unit,
      target: k.target,
      target_source: k.target_source,
      direction: k.direction,
      lifecycle_stage: k.lifecycle_stage,
      measured_value: res.value,            // null ≠ 0
      measurement_status: res.status,       // measured | source_absent | unreadable | no_data | not_wired
      meets_target: meetsTarget,            // null until measured against an authored target
      measurement_source: k.measurement.method === 'not_wired' ? null : k.measurement.probe,
    });
  }
  const bound = kpis.length;
  const measured = kpis.filter(k => k.measurement_status === 'measured').length;
  const wired = kpis.filter(k => k.measurement_source != null).length;
  return {
    ok: true, version: CLOSE_THE_LOOP_VERSION,
    capabilities_bound: bound,                 // GAP-K1: every capability is BOUND to a KPI (structural)
    kpis,
    coverage: { bound, wired, measured },      // binding ⟂ measurement-wiring ⟂ live-measured (separate)
    note: 'KPI BINDING is the structural deliverable (every capability bound). Measured values are live; '
        + 'null = not measurable yet (null ≠ 0). Targets are product-authored goals, not measurements.',
    read_only: true,
  };
}

/** Realized-outcome attribution by capability + lifecycle stage. Demo EXCLUDED from realized; per-group
 *  success RATE suppressed below k_min (counts always shown). Coverage ⟂ Confidence kept separate. */
export async function composeOutcomeAttribution(pool: Pool) {
  const present = await tablePresent(pool, 'public.close_the_loop_outcomes');
  if (!present) {
    return {
      ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: false,
      coverage: { realized: null, demo: null, by_capability: [], by_stage: [] }, // null ≠ 0
      confidence: { k_min: CTL_K_MIN, evidence_backed: false, abstained: true, reason: 'substrate_absent' },
      verdict: 'PARTIAL — outcome attribution substrate not yet created (flag-ON write will create it). No data fabricated.',
      read_only: true,
    };
  }
  const totals = await pool.query(
    `SELECT is_demo, COUNT(*)::int AS c FROM close_the_loop_outcomes GROUP BY is_demo`,
  );
  let realized = 0, demo = 0;
  for (const r of totals.rows) { if (r.is_demo) demo += Number(r.c); else realized += Number(r.c); }

  const byCap = await pool.query(
    `SELECT capability_key,
            COUNT(*)::int AS realized,
            AVG(CASE WHEN outcome_kind = 'binary' THEN outcome_value END)::float AS success_rate,
            COUNT(*) FILTER (WHERE outcome_kind = 'binary')::int AS binary_n
       FROM close_the_loop_outcomes WHERE is_demo = false
      GROUP BY capability_key ORDER BY capability_key`,
  );
  const byStage = await pool.query(
    `SELECT COALESCE(lifecycle_stage, 'UNATTRIBUTED') AS lifecycle_stage, COUNT(*)::int AS realized
       FROM close_the_loop_outcomes WHERE is_demo = false
      GROUP BY lifecycle_stage ORDER BY lifecycle_stage`,
  );

  const by_capability = byCap.rows.map(r => {
    const binaryN = Number(r.binary_n);
    const enough = binaryN >= CTL_K_MIN;
    return {
      capability_key: r.capability_key,
      realized: Number(r.realized),                                  // Coverage (count) — always shown
      binary_n: binaryN,
      success_rate: enough && r.success_rate != null ? Number(r.success_rate) : null, // Confidence — suppressed < k_min
      rate_abstained: !enough,
    };
  });

  return {
    ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: true,
    coverage: {
      realized, demo,
      by_capability,
      by_stage: byStage.rows.map(r => ({ lifecycle_stage: r.lifecycle_stage, realized: Number(r.realized) })),
    },
    confidence: {
      k_min: CTL_K_MIN,
      evidence_backed: realized >= CTL_K_MIN,
      abstained: realized < CTL_K_MIN,
      reason: realized === 0 ? 'no_realized_outcomes'
        : realized < CTL_K_MIN ? `insufficient_outcomes (${realized}/${CTL_K_MIN})` : null,
    },
    verdict: realized >= CTL_K_MIN
      ? 'EVIDENCE-BACKED — realized attributed outcomes have reached k_min.'
      : 'PARTIAL — attribution is wired and live; success rates ABSTAINED until realized outcomes reach k_min. No outcome fabricated.',
    read_only: true,
  };
}

/** Re-measurement (Exit / Continuous / Progress) coverage + improvement deltas. Demo EXCLUDED; the
 *  mean-improvement CLAIM is suppressed below k_min (counts shown). */
export async function composeRemeasurement(pool: Pool) {
  const present = await tablePresent(pool, 'public.close_the_loop_remeasurements');
  const triggers: Record<string, { count: number; mean_delta: number | null; delta_abstained: boolean }> = {};
  for (const t of CTL_REMEASURE_TRIGGERS) triggers[t] = { count: 0, mean_delta: null, delta_abstained: true };

  if (!present) {
    return {
      ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: false,
      coverage: { total: null, by_trigger: triggers }, // null ≠ 0
      verdict: 'PARTIAL — re-measurement substrate not yet created (flag-ON write will create it). No data fabricated.',
      read_only: true,
    };
  }
  const rows = await pool.query(
    `SELECT trigger,
            COUNT(*)::int AS c,
            AVG(delta)::float AS mean_delta,
            COUNT(*) FILTER (WHERE delta IS NOT NULL)::int AS delta_n
       FROM close_the_loop_remeasurements WHERE is_demo = false
      GROUP BY trigger`,
  );
  let total = 0;
  for (const r of rows.rows) {
    const t = String(r.trigger);
    const deltaN = Number(r.delta_n);
    const enough = deltaN >= CTL_K_MIN;
    total += Number(r.c);
    triggers[t] = {
      count: Number(r.c),
      mean_delta: enough && r.mean_delta != null ? Number(r.mean_delta) : null, // suppressed < k_min
      delta_abstained: !enough,
    };
  }
  return {
    ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: true,
    coverage: { total, by_trigger: triggers },
    note: 'Exit/Continuous/Progress re-administration deltas. Mean improvement is ABSTAINED below k_min; '
        + 'counts are always shown. This is the substrate a Growth→Mastery evidence gate consumes.',
    read_only: true,
  };
}

/** Top-level honest dashboard: composes KPI binding + outcome attribution + re-measurement, keeping
 *  Coverage ⟂ Confidence ⟂ Evidence on SEPARATE axes (never composited). */
export async function composeOverview(pool: Pool) {
  const [kpis, outcomes, remeasurement] = await Promise.all([
    composeKpiBindings(pool),
    composeOutcomeAttribution(pool),
    composeRemeasurement(pool),
  ]);
  const realized = outcomes.coverage?.realized ?? null;
  return {
    ok: true, version: CLOSE_THE_LOOP_VERSION,
    loop: ['Assess', 'Diagnose', 'Recommend', 'Re-measure', 'Exit', 'Realized Outcome', 'KPI'],
    axes: {
      structural: {
        kpi_bindings: kpis.capabilities_bound,
        outcome_attribution_wired: outcomes.table_present !== false,
        remeasurement_wired: remeasurement.table_present !== false,
        note: 'Mechanism completeness — the deliverable of this phase.',
      },
      coverage: {
        realized_attributed_outcomes: realized,             // null ≠ 0
        remeasurements: remeasurement.coverage?.total ?? null,
        kpis_measured: kpis.coverage.measured,
      },
      confidence: {
        k_min: CTL_K_MIN,
        evidence_backed: outcomes.confidence?.evidence_backed ?? false,
        abstained: outcomes.confidence?.abstained ?? true,
      },
    },
    kpis, outcomes, remeasurement,
    verdict: 'PARTIAL — close-the-loop MECHANISM is structurally complete and live; realized-outcome '
      + 'EVIDENCE is ABSTAINED until non-demo data reaches k_min. Coverage ⟂ Confidence ⟂ Evidence are '
      + 'reported separately and never composited. No outcome, KPI value, or accuracy claim is fabricated.',
    read_only: true,
  };
}

// ── KPI snapshot capture (the ONLY KPI write path; append-only) ──────────────────────────────────────

/** Capture the current KPI bindings into the append-only snapshot ledger. Flag-gated (asserts BEFORE
 *  ensure-schema), never-throws. This is the ONLY write path for KPI values — GETs never write. */
export async function captureKpiSnapshot(
  pool: Pool, capturedBy?: string | null,
): Promise<{ ok: boolean; reason?: string; id?: number; summary?: unknown }> {
  if (!isFlagEnabled('closeTheLoop')) return { ok: false, reason: 'flag_off' };
  try {
    await ensureCloseTheLoopSchema(pool);
    const bindings = await composeKpiBindings(pool);
    const summary = { capabilities_bound: bindings.capabilities_bound, coverage: bindings.coverage };
    const r = await pool.query(
      `INSERT INTO close_the_loop_kpi_snapshots (captured_by, snapshot, summary)
       VALUES ($1, $2, $3) RETURNING id`,
      [capturedBy ?? null, JSON.stringify(bindings.kpis), JSON.stringify(summary)],
    );
    return { ok: true, id: Number(r.rows[0]?.id), summary };
  } catch (err) {
    console.error('[close-the-loop] captureKpiSnapshot failed:', (err as any)?.message ?? err);
    return { ok: false, reason: 'write_failed' };
  }
}

/** Read recent KPI snapshots (read-only, to_regclass-probed → null ≠ 0). */
export async function readKpiSnapshots(pool: Pool, limit = 20) {
  const present = await tablePresent(pool, 'public.close_the_loop_kpi_snapshots');
  if (!present) {
    return { ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: false, snapshots: null, read_only: true };
  }
  const lim = Math.max(1, Math.min(100, Number(limit) || 20));
  const r = await pool.query(
    `SELECT id, captured_at, captured_by, summary FROM close_the_loop_kpi_snapshots
      ORDER BY captured_at DESC LIMIT $1`, [lim],
  );
  return {
    ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: true,
    snapshots: r.rows, count: r.rows.length, read_only: true,
  };
}

/** Drift between the two most-recent KPI snapshots (read-only). Reports per-KPI measured-value deltas;
 *  null ≠ 0 (a value that was/became unmeasurable is reported as null, never a fabricated 0). */
export async function composeKpiDrift(pool: Pool) {
  const present = await tablePresent(pool, 'public.close_the_loop_kpi_snapshots');
  if (!present) {
    return { ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: false, drift: null, read_only: true };
  }
  const r = await pool.query(
    `SELECT id, captured_at, snapshot FROM close_the_loop_kpi_snapshots ORDER BY captured_at DESC LIMIT 2`,
  );
  if (r.rows.length < 2) {
    return {
      ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: true, drift: null,
      reason: 'need_at_least_two_snapshots', snapshots_available: r.rows.length, read_only: true,
    };
  }
  const [curr, prev] = r.rows;
  const currMap = new Map<string, number | null>(
    (curr.snapshot as any[]).map(k => [k.id, k.measured_value ?? null]),
  );
  const prevMap = new Map<string, number | null>(
    (prev.snapshot as any[]).map(k => [k.id, k.measured_value ?? null]),
  );
  const ids = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
  const drift = [...ids].map(id => {
    const c = currMap.get(id) ?? null;
    const p = prevMap.get(id) ?? null;
    const delta = (c != null && p != null) ? c - p : null; // null when either side unmeasurable
    return { id, previous: p, current: c, delta };
  });
  return {
    ok: true, version: CLOSE_THE_LOOP_VERSION, table_present: true,
    from: { id: prev.id, captured_at: prev.captured_at },
    to: { id: curr.id, captured_at: curr.captured_at },
    drift, read_only: true,
  };
}
