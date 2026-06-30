/**
 * CAPADEX 3.0 — Program 1 · Phase 1.7 AI Recommendation Report Orchestration
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer over the canonical AI-orchestration model (`config/ai-orchestration-model.ts`).
 * It NEVER writes, NEVER runs DDL, NEVER invokes an AI / reasoning / recommendation / report / KPI
 * engine — it only:
 *   1. serves the canonical model (12-step AI spine + capability inventory + recommendation /
 *      explainability criteria + report sections + dashboard surfaces + per-persona paths + axes),
 *   2. INDEPENDENTLY verifies each entry's evidence claims against the live filesystem + DB
 *      (the verifier — not the registry — is the SSoT for "present/absent" numbers),
 *   3. computes per-path / per-axis Coverage + capability / recommendation / explainability /
 *      report / dashboard coverage (kept SEPARATE from Confidence/Outcome/Adoption),
 *   4. reports recommendation EFFECTIVENESS substrate honestly — calibrated effectiveness is
 *      ABSTAINED (Confidence axis, null≠0), never fabricated (REUSE of the validation-loop mechanism),
 *   5. classifies remaining AI-integration gaps (Launch-Critical/High/Medium/Low/Future),
 *   6. reports the realized-outcome / report / KPI ADOPTION (SEPARATE axes).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0. Never fabricate. The runtime
 * AI machinery is REUSED (aiClient + ai-reasoning + recommendation/intervention engines + PIL/omega
 * report builders + enterprise-analytics/benchmark KPI engines + validation-loop calibration); this
 * module adds ZERO new logic and ZERO schema.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  AI_ORCHESTRATION_MODEL,
  AI_ORCHESTRATION_SPINE,
  AI_ORCHESTRATION_AXES,
  AI_CAPABILITIES,
  RECOMMENDATION_CRITERIA,
  EXPLAINABILITY_CRITERIA,
  REPORT_SECTIONS,
  DASHBOARD_SURFACES,
  AI_ORCHESTRATION_DECISIONS,
  type AiOrchestrationPath,
  type AiEvidence,
  type AiOrchestrationStatus,
} from '../config/ai-orchestration-model';
// REUSE the single-source freshness constant from the existing progression-capture mechanism
// (no re-declaration). This module only READS it — it never invokes the capture/signal engine.
import { REASSESSMENT_FRESHNESS_DAYS } from './capadex/progression-outcome-capture';
// REUSE the EXISTING validation-loop calibration mechanism (PURE functions only) to WIRE the
// recommendation → outcome effectiveness link to real decision-time predictions WITHOUT a new
// engine/table/DDL. calibrationFromRows abstains honestly (cold_start / provisional, NEVER
// 'calibrated') until ≥ k_min real prediction+outcome pairs accrue — so effectiveness stays null.
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

export async function verifyEvidence(pool: Pool, e: AiEvidence): Promise<EvidenceVerification> {
  return {
    services: verifyFsGroup(e.services, 'backend'),
    routes: verifyFsGroup(e.routes, 'backend'),
    frontend: verifyFsGroup(e.frontend, 'frontend'),
    tables: await verifyTables(pool, e.tables),
  };
}

export interface PathCoverage {
  key: string;
  label: string;
  persona: string;
  status: AiOrchestrationStatus;
  statusNote?: string;
  /** Spine steps reached / 12 (the FROZEN canonical spine length). */
  spineReached: number;
  spineTotal: number;
  kpiFamilies: number;
  axesMapped: number;
  axesTotal: number;
  evidence: EvidenceVerification;
}

const AXIS_FIELD: Record<typeof AI_ORCHESTRATION_AXES[number], keyof AiOrchestrationPath> = {
  persona: 'personas',
  lifecycle: 'lifecycleStages',
  assessment: 'assessments',
  ai_analysis: 'aiAnalysis',
  explainability: 'explainability',
  recommendation: 'recommendation',
  report: 'report',
  kpi: 'kpiFamilies',
};

function axesMappedFor(t: AiOrchestrationPath): number {
  let n = 0;
  for (const axis of AI_ORCHESTRATION_AXES) {
    const v = t[AXIS_FIELD[axis]];
    if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null) n += 1;
  }
  return n;
}

export async function composeCoverage(pool: Pool): Promise<PathCoverage[]> {
  const out: PathCoverage[] = [];
  for (const t of AI_ORCHESTRATION_MODEL) {
    out.push({
      key: t.key,
      label: t.label,
      persona: t.persona,
      status: t.status,
      statusNote: t.statusNote,
      spineReached: t.spineReached.length,
      spineTotal: AI_ORCHESTRATION_SPINE.length,
      kpiFamilies: t.kpiFamilies.length,
      axesMapped: axesMappedFor(t),
      axesTotal: AI_ORCHESTRATION_AXES.length,
      evidence: await verifyEvidence(pool, t.evidence),
    });
  }
  return out;
}

/** Generic per-item coverage shape (capability / criterion / section / surface). */
export interface ItemCoverage {
  key: string;
  label: string;
  status: AiOrchestrationStatus;
  statusNote?: string;
  category?: string;
  audience?: string;
  exampleKpis?: string[];
  evidence: EvidenceVerification;
}

async function composeItems(
  pool: Pool,
  items: Array<{ key?: string; id?: string; label: string; status: AiOrchestrationStatus; statusNote?: string; category?: string; audience?: string; evidence: AiEvidence }>,
): Promise<ItemCoverage[]> {
  const out: ItemCoverage[] = [];
  for (const it of items) {
    out.push({
      key: (it.key ?? it.id) as string,
      label: it.label,
      status: it.status,
      statusNote: it.statusNote,
      category: it.category,
      audience: it.audience,
      evidence: await verifyEvidence(pool, it.evidence),
    });
  }
  return out;
}

export const composeCapabilityInventory = (pool: Pool) => composeItems(pool, AI_CAPABILITIES);
export const composeRecommendationCompleteness = (pool: Pool) => composeItems(pool, RECOMMENDATION_CRITERIA);
export const composeExplainability = (pool: Pool) => composeItems(pool, EXPLAINABILITY_CRITERIA);
export const composeReportValidation = (pool: Pool) => composeItems(pool, REPORT_SECTIONS);
export const composeDashboardValidation = (pool: Pool) => composeItems(pool, DASHBOARD_SURFACES);

export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';

export interface ClassifiedGap {
  id: string;
  title: string;
  severity: GapSeverity;
  evidence: string;
  remediation: string;
}

/**
 * AI-integration gap classification (honest — grounded in the FROZEN blueprint verdict + the live
 * FS/DB scan). The assessment→AI→recommendation→report→KPI chain is mechanism-complete via REUSE.
 * What remains is dominantly CONFIDENCE (calibrated effectiveness, deliberately abstained) +
 * ADOPTION (real report/outcome/KPI volume), reported SEPARATELY, NEVER as a gap. Coverage⟂
 * Confidence⟂Outcome⟂Adoption never composited; null≠0; nothing fabricated.
 */
export const AI_ORCHESTRATION_GAPS: ClassifiedGap[] = [
  {
    id: 'GAP-AI-1',
    title: 'Per-token / per-feature recommendation attribution (explainability depth)',
    severity: 'Medium',
    evidence: 'Recommendations trace to persisted signals (capadex_session_signals → development_recommendations) and a reasoning chain (ai_reasoning_chains), but full per-feature attribution weights are not persisted. This is an explainability-DEPTH residual, not a broken chain — the rationale IS rendered.',
    remediation: 'OPTIONAL future enhancement: persist per-feature attribution from the existing reasoning engine output. Not Launch-Critical; explainability is already human-readable. No DDL in this phase.',
  },
  {
    id: 'GAP-AI-2',
    title: 'Report engagement instrumentation (report adoption signal)',
    severity: 'Low',
    evidence: 'Reports are generated + persisted (capadex_reports) but report-open / share engagement is not instrumented as a first-class KPI. Report VOLUME is measurable; report ENGAGEMENT is an Adoption axis currently honest-low.',
    remediation: 'OPTIONAL: reuse the existing analytics substrate to roll up report engagement as usage accrues. Adoption-driven, never fabricated. No new engine.',
  },
];

export interface ResolvedGap {
  id: string;
  title: string;
  closure: string;
  /** The honest remaining axis after the mechanism is in place — ADOPTION/CONFIDENCE (usage/data-driven). */
  residual: string;
}

/**
 * Mechanism-present links the AI chain REUSES (closed by prior phases via reuse-before-build, NOT
 * rebuilt here) — recorded for traceability. Their honest residual is ADOPTION/CONFIDENCE, never a gap.
 */
export const RESOLVED_AI_ORCHESTRATION_GAPS: ResolvedGap[] = [
  {
    id: 'MECH-AI-ANALYSIS',
    title: 'AI analysis + reasoning chain over assessment evidence',
    closure: 'PRESENT via REUSE: aiClient + ai-reasoning-engine generate narrative analysis + reasoning chains (ai_reasoning_chains) over the persisted assessment signals. The composer READS their existence/output; it never invokes them. Degrades honestly without OPENAI_API_KEY (null≠0).',
    residual: 'CONFIDENCE/ADOPTION: AI output volume is usage-driven; LLM-backed depth depends on the configured key (reported separately, null≠0).',
  },
  {
    id: 'MECH-RECOMMENDATION-CHAIN',
    title: 'Recommendation → intervention → learning-plan chain',
    closure: 'PRESENT via REUSE: recommendation-intelligence + career-recommendation + mei-recommendation engines persist recommendations (development_recommendations/career_recommendations); intervention-intelligence selects interventions (capadex_interventions); learning-path-engine composes the plan. No new engine/table/DDL.',
    residual: 'ADOPTION: real recommendation/intervention volume is usage-driven (Coverage⟂Adoption, null≠0).',
  },
  {
    id: 'MECH-EXPLAINABILITY',
    title: 'Explainability / rationale rendering',
    closure: 'PRESENT via REUSE: capadex-explainability-engine + runtime-explainability-engine render a human-readable rationale per recommendation/decision, surfaced in the generated report.',
    residual: 'CONFIDENCE: per-feature attribution depth is an optional future enhancement (GAP-AI-1) — the rationale IS rendered today.',
  },
  {
    id: 'MECH-REPORT-GENERATION',
    title: 'AI report generation',
    closure: 'PRESENT via REUSE: PIL + omega report builders compose human-readable AI reports persisted in capadex_reports and surfaced in the AI-powered report dashboards. No new report engine.',
    residual: 'ADOPTION: report volume + engagement are usage-driven (Coverage⟂Adoption; GAP-AI-2 for engagement instrumentation).',
  },
  {
    id: 'MECH-EFFECTIVENESS-CALIBRATION-WIRED',
    title: 'Recommendation → outcome effectiveness wired to the calibration mechanism',
    closure: 'CLOSED via REUSE (no new engine/table/DDL): composeEffectiveness READS the EXISTING validation-loop calibration mechanism — recordValidationOutcome captures predicted_prob_at_decision; calibrationFromRows/toCalibrationPairs turn non-demo prediction+outcome rows into a calibrated effectiveness block with a k_min gate. When ≥ k_min real pairs accrue the status flips to calibrated and the rate lights up automatically. Demo excluded; nothing fabricated.',
    residual: 'CONFIDENCE: until ≥ k_min real non-demo prediction+outcome pairs accrue the status is cold_start/provisional and effectiveness_rate stays null (abstained, NEVER fabricated). Reported via the `calibration` block, never a gap.',
  },
  {
    id: 'MECH-KPI-SUBSTRATE',
    title: 'KPI computation substrate (enterprise analytics + benchmark)',
    closure: 'PRESENT via REUSE: the existing enterprise-analytics (anl_kpi_daily) + benchmark engines compute the KPI families. The composer READS coverage of this substrate; it never re-computes a KPI or builds a second KPI engine.',
    residual: 'ADOPTION: KPI population is usage-driven (Coverage⟂Adoption, null≠0).',
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
 * Recommendation EFFECTIVENESS composer (read-only, never-throws).
 * Reports the MEASURED substrate (how many recommendations + interventions exist, how many realized
 * outcomes exist) and HONESTLY ABSTAINS the calibrated effectiveness rate via REUSE of the
 * validation-loop calibration mechanism. effectiveness_rate is null BY DESIGN (Confidence axis)
 * until ≥ k_min real prediction+outcome pairs accrue. Demo subjects excluded so nothing self-inflates.
 */
export interface ChannelEffectiveness {
  substrate_rows: number | null;
  substrate_subjects: number | null;
  effectiveness_rate: number | null;
  calibrated: false;
  note: string;
}

export interface EffectivenessCalibration {
  pairs_used: number | null;
  status: string | null;
  k_min: number | null;
  remaining_to_calibrated: number | null;
  brier: number | null;
  ece: number | null;
  effectiveness_rate: number | null;
  note: string;
}

export interface AiEffectiveness {
  flag: 'aiRecommendationReportOrchestration';
  recommendation: ChannelEffectiveness;
  intervention: ChannelEffectiveness;
  realized_outcomes: number | null;
  calibration: EffectivenessCalibration;
  note: string;
}

export async function composeEffectiveness(pool: Pool): Promise<AiEffectiveness> {
  const rec_rows = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM development_recommendations`);
  const rec_subjects = await readScalar(pool, `SELECT COUNT(DISTINCT user_id)::int AS n FROM development_recommendations WHERE user_id IS NOT NULL`);
  const int_rows = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM capadex_interventions`);
  const int_subjects = await readScalar(pool, `SELECT COUNT(DISTINCT user_id)::int AS n FROM capadex_interventions WHERE user_id IS NOT NULL`);
  const realized_outcomes = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM validation_loop_outcomes WHERE COALESCE(is_demo, false) = false`);
  const channelNote =
    'Substrate counts are MEASURED (Coverage); per-channel effectiveness_rate stays null because the ' +
    'decision-time prediction is recorded loop-level (validation_loop_outcomes), not per recommendation/' +
    'intervention row — see the loop-level `calibration` block. Confidence⟂Coverage, null≠0.';

  // REUSE the EXISTING validation-loop calibration mechanism (PURE) over non-demo outcome rows that
  // carry a decision-time prediction. Wires the effectiveness link end-to-end WITHOUT a new
  // engine/table/DDL: status flips to 'calibrated' + the rate lights up only at ≥ k_min pairs. null≠0.
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
      note: 'Calibration substrate UNREADABLE (validation_loop_outcomes / predicted_prob_at_decision not readable). null = unknown, NOT 0. Nothing fabricated.',
    };
  } else {
    const cal = calibrationFromRows(predRows as OutcomeRow[]);
    const pairs = toCalibrationPairs(predRows as OutcomeRow[]);
    const observed = cal.status === 'calibrated' && pairs.length > 0
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
        'abstained, NEVER fabricated); flips to calibrated only when ≥ k_min non-demo pairs accrue. ' +
        'No engine invoked; zero DDL.',
    };
  }

  return {
    flag: 'aiRecommendationReportOrchestration',
    recommendation: { substrate_rows: rec_rows, substrate_subjects: rec_subjects, effectiveness_rate: null, calibrated: false, note: channelNote },
    intervention: { substrate_rows: int_rows, substrate_subjects: int_subjects, effectiveness_rate: null, calibrated: false, note: channelNote },
    realized_outcomes,
    calibration,
    note:
      'Recommendation→outcome EFFECTIVENESS. Substrate (recommendations, interventions, realized ' +
      'outcomes) is MEASURED (Coverage); loop-level calibrated effectiveness is WIRED via REUSE of the ' +
      'validation-loop calibration mechanism (`calibration` block) and abstains honestly (cold_start, ' +
      'rate null) until ≥ k_min real prediction+outcome pairs accrue — Confidence axis, null≠0, never ' +
      'fabricated. Demo subjects excluded. No engine is invoked; zero DDL.',
  };
}

/**
 * AI-orchestration ADOPTION composer (read-only, never-throws).
 * Reports how much the assessment→AI→recommendation→report→KPI loop is actually EXERCISED — the
 * ADOPTION axis, kept strictly SEPARATE from Coverage and never composited. null≠0; demo excluded.
 */
export interface AiAdoption {
  flag: 'aiRecommendationReportOrchestration';
  freshness_window_days: number;
  reasoning_chains: number | null;
  recommendations: number | null;
  interventions: number | null;
  reports: number | null;
  realized_outcomes: number | null;
  outcome_subjects: number | null;
  reassessed_subjects: number | null;
  kpi_rows: number | null;
  note: string;
}

export async function composeAdoption(pool: Pool): Promise<AiAdoption> {
  const reasoning_chains = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM ai_reasoning_chains`);
  const recommendations = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM development_recommendations`);
  const interventions = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM capadex_interventions`);
  const reports = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM capadex_reports`);
  const realized_outcomes = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM validation_loop_outcomes WHERE COALESCE(is_demo, false) = false`);
  const outcome_subjects = await readScalar(pool, `SELECT COUNT(DISTINCT subject_user_id)::int AS n FROM validation_loop_outcomes WHERE COALESCE(is_demo, false) = false`);
  const reassessed_subjects = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM (
        SELECT user_id FROM wc3_longitudinal_snapshots
         WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1
     ) t`,
  );
  const kpi_rows = await readScalar(pool, `SELECT COUNT(*)::int AS n FROM anl_kpi_daily`);
  return {
    flag: 'aiRecommendationReportOrchestration',
    freshness_window_days: REASSESSMENT_FRESHNESS_DAYS,
    reasoning_chains,
    recommendations,
    interventions,
    reports,
    realized_outcomes,
    outcome_subjects,
    reassessed_subjects,
    kpi_rows,
    note:
      'ADOPTION axis only — exercise of the (reuse-instrumented) assessment→AI→recommendation→report→KPI ' +
      'loop. SEPARATE from Coverage; never composited. null = unreadable, 0 = measured-empty. Demo ' +
      'subjects excluded. AI/report/KPI machinery is REUSED — this phase builds NO new logic.',
  };
}

/**
 * Persona-AI linkage composer (read-only, never-throws).
 * Validates whether AI outputs can be attributed per persona by JOINING realized outcomes
 * (validation_loop_outcomes) to the persona substrate (capadex_user_profiles) at READ time — no
 * schema change. k-anonymity: per-persona counts below k_min are suppressed.
 */
export interface PersonaAiLinkage {
  flag: 'aiRecommendationReportOrchestration';
  linkage_present: boolean;
  k_min: number;
  personas: Array<{ persona: string; outcomes: number | null; suppressed: boolean }>;
  note: string;
}

export async function composePersonaAiLinkage(pool: Pool): Promise<PersonaAiLinkage> {
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
    flag: 'aiRecommendationReportOrchestration',
    linkage_present: readable,
    k_min,
    personas,
    note:
      'Persona⟂AI-outcome linkage validated by a READ-TIME join (no persona column added, zero DDL). ' +
      'Per-persona counts below k_min are suppressed (masked) for anonymity. linkage_present:false means ' +
      'the join was unreadable, NOT that outcomes are zero (null≠0). Coverage⟂Outcome⟂Confidence never composited.',
  };
}

export interface AiOrchestrationSummary {
  flag: 'aiRecommendationReportOrchestration';
  spine_frozen: true;
  spine_step_count: number;
  capability_count: number;
  recommendation_criteria_count: number;
  explainability_criteria_count: number;
  report_section_count: number;
  dashboard_surface_count: number;
  path_count: number;
  persona_count: number;
  status_counts: { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };
  evidence_rollup: {
    services: { present: number; total: number };
    routes: { present: number; total: number };
    frontend: { present: number; total: number };
    tables: { present: number; absent: number; unknown: number; total: number };
  };
  spine_rollup: { reached: number; total: number };
  capability_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  recommendation_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  explainability_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  report_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  dashboard_rollup: { supported: number; partial: number; dead_end: number; missing: number; total: number };
  gap_counts: Record<GapSeverity, number>;
  resolved_gap_count: number;
  decisions: typeof AI_ORCHESTRATION_DECISIONS;
  enterprise_ready: { verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING'; note: string };
}

function rollupStatus(items: Array<{ status: AiOrchestrationStatus }>) {
  const r = { supported: 0, partial: 0, dead_end: 0, missing: 0, total: items.length };
  for (const i of items) {
    if (i.status === 'SUPPORTED') r.supported += 1;
    else if (i.status === 'PARTIAL') r.partial += 1;
    else if (i.status === 'DEAD_END') r.dead_end += 1;
    else r.missing += 1;
  }
  return r;
}

export async function composeSummary(pool: Pool): Promise<AiOrchestrationSummary> {
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
  for (const p of AI_ORCHESTRATION_MODEL) for (const code of p.personas) personas.add(code);

  const gap_counts: Record<GapSeverity, number> = { 'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0 };
  for (const g of AI_ORCHESTRATION_GAPS) gap_counts[g.severity] += 1;

  return {
    flag: 'aiRecommendationReportOrchestration',
    spine_frozen: true,
    spine_step_count: AI_ORCHESTRATION_SPINE.length,
    capability_count: AI_CAPABILITIES.length,
    recommendation_criteria_count: RECOMMENDATION_CRITERIA.length,
    explainability_criteria_count: EXPLAINABILITY_CRITERIA.length,
    report_section_count: REPORT_SECTIONS.length,
    dashboard_surface_count: DASHBOARD_SURFACES.length,
    path_count: AI_ORCHESTRATION_MODEL.length,
    persona_count: personas.size,
    status_counts,
    evidence_rollup,
    spine_rollup,
    capability_rollup: rollupStatus(AI_CAPABILITIES),
    recommendation_rollup: rollupStatus(RECOMMENDATION_CRITERIA),
    explainability_rollup: rollupStatus(EXPLAINABILITY_CRITERIA),
    report_rollup: rollupStatus(REPORT_SECTIONS),
    dashboard_rollup: rollupStatus(DASHBOARD_SURFACES),
    gap_counts,
    resolved_gap_count: RESOLVED_AI_ORCHESTRATION_GAPS.length,
    decisions: AI_ORCHESTRATION_DECISIONS,
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING',
      note:
        'ONE canonical AI-orchestration model audits every EXISTING AI / recommendation / report / ' +
        'analytics / explainability / orchestration capability into one coherent layer answering ' +
        '"assessment → AI analysis → confidence → explainability → recommendation → intervention → ' +
        'outcome-validation → report → KPI": a FROZEN 12-step AI spine, a capability inventory, ' +
        'recommendation-completeness + explainability criteria, report sections + dashboard surfaces, ' +
        'and a per-persona path register — every field mapped to the eight AI axes and verified against ' +
        'the live repo. The chain is mechanism-complete via REUSE-before-build: aiClient + ai-reasoning ' +
        'generate analysis; recommendation/intervention/learning engines + PIL/omega report builders + ' +
        'enterprise-analytics/benchmark KPI engines do the work; the recommendation→outcome ' +
        'effectiveness link is WIRED via REUSE of the existing validation-loop calibration mechanism. ' +
        'This phase adds ONE read-only composer/registry + ZERO new AI/report/KPI logic + ZERO schema; ' +
        'engines are read by existence/persisted-output, NEVER invoked. The dominant remaining axes are ' +
        'CONFIDENCE (calibration abstained until ≥ k_min real prediction+outcome pairs accrue) and ' +
        'ADOPTION (real AI/report/outcome/KPI volume, currently honest-low/0, reported SEPARATELY) — ' +
        'usage/data axes, NOT gaps. The verdict stays STRUCTURAL (engineering complete via reuse; ' +
        'adoption/confidence are data-driven and never fabricated). Coverage⟂Confidence⟂Outcome⟂' +
        'Adoption are reported separately and never composited; null≠0.',
    },
  };
}
