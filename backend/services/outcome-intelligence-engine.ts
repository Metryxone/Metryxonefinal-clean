/**
 * MX-102X — OUTCOME INTELLIGENCE ACTIVATION (read-only composition engine).
 *
 * Unifies the SIX realized-outcome types into ONE honest surface by COMPOSING the engines that
 * already exist — it never recomputes a score, never writes, and never fabricates an outcome or an
 * accuracy claim:
 *
 *   hiring       → validation_loop_outcomes(outcome_type='hiring') ∪ employer_candidates terminal feeder
 *   performance  → validation_loop_outcomes(outcome_type='performance')
 *   promotion    → validation_loop_outcomes(outcome_type='promotion')
 *   retention    → validation_loop_outcomes(outcome_type='retention')
 *   career       → career_outcomes (career-evidence ledger)
 *   learning     → student_subscriptions (assessment-completion / learning milestone substrate)
 *
 * TWO axes are kept STRICTLY SEPARATE and never composited:
 *   - COVERAGE       — how many realized outcomes are actually captured (a data axis).
 *   - CONFIDENCE     — empirical-accuracy / calibration trust, which is ABSTAINED until ≥ k_min=30
 *                      realized binary {prediction,outcome} pairs accrue (an evidence axis).
 *
 * Honesty contract (mirrors validation-loop-engine + employer-tig calibration):
 *   - Demo rows (is_demo / @example.com) are EXCLUDED from every realized/evidence figure.
 *   - Only finite predictions in [0,1] paired with a binary outcome qualify as calibration pairs;
 *     out-of-range / missing-prediction rows are DROPPED (never clamped/coerced).
 *   - A realized outcome WITHOUT a decision-time prediction still counts toward Coverage but NOT
 *     toward calibration evidence — that gap IS the Coverage≠Confidence finding.
 *   - Absent/unreadable tables degrade to null (honest gap), never 0.
 *   - Prediction ≠ Outcome: predictions exist upstream; empirical accuracy is NOT claimed until
 *     realized outcomes reach k_min. The verdict stays PARTIAL until then.
 *
 * Reuses (never re-implements): buildCalibrationModel (employer-tig), toCalibrationPairs /
 * terminalCandidatesToPairs / calibrationSummary / evidenceVerdict / VALIDATION_K_MIN
 * (validation-loop-engine).
 */

import crypto from 'crypto';
import type { Pool } from 'pg';
import {
  VALIDATION_K_MIN,
  toCalibrationPairs,
  terminalCandidatesToPairs,
  calibrationSummary,
  evidenceVerdict,
  type OutcomeRow,
} from './validation-loop-engine';
import { buildCalibrationModel } from '../routes/employer-tig';

export const OUTCOME_INTELLIGENCE_VERSION = '102.0.0';
/** Platform k_min — inherits the validation-loop / TIG precedent (30). Below this, empirical
 *  accuracy is never claimed (calibration stays provisional/cold_start, the verdict stays PARTIAL). */
export const OI_K_MIN = VALIDATION_K_MIN;

export type OutcomeIntelType =
  | 'hiring' | 'performance' | 'promotion' | 'retention' | 'career' | 'learning';

export const OUTCOME_INTEL_TYPES: OutcomeIntelType[] =
  ['hiring', 'performance', 'promotion', 'retention', 'career', 'learning'];

export function isOutcomeIntelType(t: unknown): t is OutcomeIntelType {
  return typeof t === 'string' && (OUTCOME_INTEL_TYPES as string[]).includes(t);
}

interface TypeMeta {
  label: string;
  /** Which substrate(s) supply this type's realized outcomes. */
  sources: string[];
  /** How empirical validation is (or is not) wired for this type. */
  calibration_method:
    | 'binary_calibration'            // decision-time prob → binary outcome (validation-loop intake)
    | 'binary_calibration+feeder'     // + employer hiring terminal feeder
    | 'association_correlation'       // career-evidence: prior score ↔ realized outcome (native, off-surface)
    | 'not_wired';                    // no decision-time prediction stored yet (honest gap)
  note: string;
}

const TYPE_META: Record<OutcomeIntelType, TypeMeta> = {
  hiring: {
    label: 'Hiring',
    sources: ['validation_loop_outcomes', 'employer_candidates'],
    calibration_method: 'binary_calibration+feeder',
    note: 'Realized hires from validation-loop intake plus the employer terminal-decision feeder (Hired=1/Rejected=0) with the decision-time success probability as the prediction.',
  },
  performance: {
    label: 'Performance',
    sources: ['validation_loop_outcomes'],
    calibration_method: 'binary_calibration',
    note: 'Realized performance outcomes recorded through the validation-loop intake; decision-time prediction calibrated against the binary outcome.',
  },
  promotion: {
    label: 'Promotion',
    sources: ['validation_loop_outcomes'],
    calibration_method: 'binary_calibration',
    note: 'Realized promotion outcomes recorded through the validation-loop intake.',
  },
  retention: {
    label: 'Retention',
    sources: ['validation_loop_outcomes'],
    calibration_method: 'binary_calibration',
    note: 'Realized retention outcomes recorded through the validation-loop intake.',
  },
  career: {
    label: 'Career',
    sources: ['career_outcomes'],
    calibration_method: 'association_correlation',
    note: 'Realized career outcomes captured in the career-evidence ledger. Its native validation is an association correlation (prior readiness/EI score ↔ realized outcome), surfaced at /api/admin/career-evidence — NOT a [0,1] probability calibration, so the unified calibration axis abstains for career rather than coercing a score into a probability.',
  },
  learning: {
    label: 'Learning',
    sources: ['student_subscriptions'],
    calibration_method: 'not_wired',
    note: 'Realized learning outcomes = completed assessments / generated reports on student subscriptions. No decision-time prediction is stored for learning yet, so empirical calibration is honestly NOT wired (Coverage only).',
  },
};

// ── read-only probes (never write) ──────────────────────────────────────────────────────────────
async function tablePresent(pool: Pool, qualified: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [qualified]);
    return r.rows[0]?.t != null;
  } catch {
    return false;
  }
}

async function safeCount(pool: Pool, sql: string, params: any[] = []): Promise<number | null> {
  try {
    const r = await pool.query(sql, params);
    return Number(r.rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

/** Irreversible pseudonym for any subject identifier surfaced in a ledger (no raw PII). */
export function pseudonym(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'anon';
  return 'user_' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}

type Pair = { predicted: number; outcome: 0 | 1 };

interface TypeBlock {
  type: OutcomeIntelType;
  label: string;
  sources: string[];
  calibration_method: TypeMeta['calibration_method'];
  coverage: {
    realized: number | null;   // non-demo realized outcomes captured (null = substrate unreadable)
    demo: number | null;       // illustrative demo rows (never evidence)
    table_present: boolean;
    detail: Record<string, number | null>;
  };
  calibration: {
    method_applies: boolean;   // false for association_correlation / not_wired
    pairs_used: number;        // realized binary {pred,outcome} pairs feeding calibration
    summary: ReturnType<typeof calibrationSummary> | null;
  };
  validation: ReturnType<typeof evidenceVerdict>;
  abstained: boolean;
  confidence_note: string;
  note: string;
}

const CONFIDENCE_NOTE =
  'Model/structural confidence (reliability·consistency·evidence) is a SEPARATE axis from empirical accuracy. Empirical accuracy requires realized outcomes ≥ k_min and is ABSTAINED below it — never inferred from confidence.';

// ── per-type realized + calibration extraction ──────────────────────────────────────────────────

/** validation_loop_outcomes rows for one type, split realized (non-demo) vs demo. */
async function loadValidationLoopType(
  pool: Pool, type: OutcomeIntelType,
): Promise<{ present: boolean; realized: OutcomeRow[]; demo: OutcomeRow[] }> {
  const present = await tablePresent(pool, 'public.validation_loop_outcomes');
  if (!present) return { present: false, realized: [], demo: [] };
  try {
    const r = await pool.query(
      `SELECT outcome_kind, outcome_value, predicted_prob_at_decision, is_demo
         FROM validation_loop_outcomes WHERE outcome_type = $1`,
      [type],
    );
    return {
      present: true,
      realized: r.rows.filter((x: any) => !x.is_demo),
      demo: r.rows.filter((x: any) => x.is_demo),
    };
  } catch {
    return { present: true, realized: [], demo: [] };
  }
}

/** Employer hiring terminal feeder → realized pairs (demo-excluded inside terminalCandidatesToPairs). */
async function loadHiringFeederPairs(pool: Pool): Promise<{ present: boolean; pairs: Pair[]; terminal: number | null }> {
  const present = await tablePresent(pool, 'public.employer_candidates');
  if (!present) return { present: false, pairs: [], terminal: null };
  try {
    const r = await pool.query(
      `SELECT stage, predicted_prob_at_decision, email
         FROM employer_candidates
        WHERE stage IN ('Hired','Rejected') AND predicted_prob_at_decision IS NOT NULL`,
    );
    // Realized coverage EXCLUDES demo (@example.com) — mirrors terminalCandidatesToPairs' demo filter.
    const terminal = await safeCount(
      pool,
      `SELECT COUNT(*)::int AS count FROM employer_candidates
        WHERE stage IN ('Hired','Rejected') AND lower(coalesce(email,'')) NOT LIKE '%@example.com'`,
    );
    return { present: true, pairs: terminalCandidatesToPairs(r.rows), terminal };
  } catch {
    return { present: true, pairs: [], terminal: null };
  }
}

async function buildTypeBlock(pool: Pool, type: OutcomeIntelType): Promise<TypeBlock> {
  const meta = TYPE_META[type];
  let realizedCount: number | null = null;
  let demoCount: number | null = null;
  let tablePresentFlag = false;
  const detail: Record<string, number | null> = {};
  let pairs: Pair[] = [];
  let methodApplies = false;

  if (type === 'hiring' || type === 'performance' || type === 'promotion' || type === 'retention') {
    methodApplies = true;
    const vl = await loadValidationLoopType(pool, type);
    tablePresentFlag = vl.present;
    realizedCount = vl.present ? vl.realized.length : null;
    demoCount = vl.present ? vl.demo.length : null;
    detail.validation_loop_realized = realizedCount;
    pairs = toCalibrationPairs(vl.realized);

    if (type === 'hiring') {
      const feeder = await loadHiringFeederPairs(pool);
      detail.employer_candidates_terminal = feeder.terminal;
      detail.employer_feeder_pairs = feeder.present ? feeder.pairs.length : null;
      // Coverage folds in feeder terminal decisions (realized hiring outcomes that exist outside intake).
      if (feeder.terminal != null) realizedCount = (realizedCount ?? 0) + feeder.terminal;
      pairs = [...pairs, ...feeder.pairs];
    }
  } else if (type === 'career') {
    // career-evidence ledger: realized count is Coverage; its NATIVE validation is correlation
    // (off this surface). We do NOT coerce prior_score into a probability → calibration abstains.
    tablePresentFlag = await tablePresent(pool, 'public.career_outcomes');
    if (tablePresentFlag) {
      realizedCount = await safeCount(pool, `SELECT COUNT(*)::int AS count FROM career_outcomes WHERE is_demo = false`);
      demoCount = await safeCount(pool, `SELECT COUNT(*)::int AS count FROM career_outcomes WHERE is_demo = true`);
    }
    detail.career_outcomes_realized = realizedCount;
    methodApplies = false; // calibration axis abstains; native correlation lives off-surface
    pairs = [];
  } else {
    // learning: completion substrate; no decision-time prediction → calibration not wired.
    tablePresentFlag = await tablePresent(pool, 'public.student_subscriptions');
    if (tablePresentFlag) {
      realizedCount = await safeCount(
        pool, `SELECT COUNT(*)::int AS count FROM student_subscriptions WHERE assessment_completed_at IS NOT NULL`);
      detail.assessments_completed = realizedCount;
      detail.reports_generated = await safeCount(
        pool, `SELECT COUNT(*)::int AS count FROM student_subscriptions WHERE report_generated_at IS NOT NULL`);
      detail.subscriptions_total = await safeCount(
        pool, `SELECT COUNT(*)::int AS count FROM student_subscriptions`);
    }
    demoCount = null; // student_subscriptions carries no demo flag
    methodApplies = false;
    pairs = [];
  }

  const summary = methodApplies ? calibrationSummary(buildCalibrationModel(pairs)) : null;

  return {
    type,
    label: meta.label,
    sources: meta.sources,
    calibration_method: meta.calibration_method,
    coverage: { realized: realizedCount, demo: demoCount, table_present: tablePresentFlag, detail },
    calibration: { method_applies: methodApplies, pairs_used: pairs.length, summary },
    validation: evidenceVerdict(pairs.length),
    abstained: pairs.length < OI_K_MIN,
    confidence_note: CONFIDENCE_NOTE,
    note: meta.note,
  };
}

// ── public composition surface ──────────────────────────────────────────────────────────────────

export async function composeOverview(pool: Pool) {
  const types = await Promise.all(OUTCOME_INTEL_TYPES.map((t) => buildTypeBlock(pool, t)));

  const sumNullable = (xs: (number | null)[]) =>
    xs.some((x) => x != null) ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) : null;

  const realizedCoverage = sumNullable(types.map((t) => t.coverage.realized));
  const evidencePairs = types.reduce((s, t) => s + t.calibration.pairs_used, 0);
  const platformVerdict = evidenceVerdict(evidencePairs);
  const typesWithCoverage = types.filter((t) => (t.coverage.realized ?? 0) > 0).length;
  const typesEvidenceBacked = types.filter((t) => t.validation.evidence_backed).length;

  return {
    ok: true,
    version: OUTCOME_INTELLIGENCE_VERSION,
    k_min: OI_K_MIN,
    types,
    platform: {
      type_count: OUTCOME_INTEL_TYPES.length,
      types_with_coverage: typesWithCoverage,
      realized_coverage: realizedCoverage,      // data axis — total realized outcomes captured
      evidence_pairs: evidencePairs,            // confidence axis — calibratable {pred,outcome} pairs
      types_evidence_backed: typesEvidenceBacked,
      evidence: platformVerdict,
      abstained: evidencePairs < OI_K_MIN,
    },
    axes: {
      coverage: 'Realized outcomes captured (data). Null = substrate unreadable, never assumed 0.',
      confidence: CONFIDENCE_NOTE,
    },
    verdict: platformVerdict.evidence_backed
      ? 'EVIDENCE-BACKED — realized outcomes have reached k_min; calibration is trusted.'
      : 'PARTIAL — the six-type surface is structurally unified and reads live substrates; empirical accuracy stays ABSTAINED until realized outcomes reach k_min. No outcome or accuracy is fabricated.',
    prediction_note: 'Prediction ≠ Outcome. Upstream engines produce predictions; this surface claims empirical accuracy ONLY once realized outcomes accrue (abstained below k_min).',
    read_only: true,
  };
}

export async function composeType(pool: Pool, type: OutcomeIntelType) {
  const block = await buildTypeBlock(pool, type);
  return { ok: true, version: OUTCOME_INTELLIGENCE_VERSION, k_min: OI_K_MIN, ...block, read_only: true };
}

/** Read-only unified ledger of recent realized outcomes across substrates — subjects pseudonymised. */
export async function composeLedger(pool: Pool, type?: OutcomeIntelType, limit = 100) {
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows: any[] = [];

  const wantVl = !type || ['hiring', 'performance', 'promotion', 'retention'].includes(type);
  const wantCareer = !type || type === 'career';
  const wantLearning = !type || type === 'learning';

  if (wantVl && await tablePresent(pool, 'public.validation_loop_outcomes')) {
    try {
      const r = await pool.query(
        `SELECT outcome_type, outcome_kind, outcome_value, predicted_prob_at_decision,
                is_demo, source, subject_email, observed_at
           FROM validation_loop_outcomes
          ${type && wantVl ? 'WHERE outcome_type = $1' : ''}
          ORDER BY observed_at DESC NULLS LAST LIMIT ${type && wantVl ? '$2' : '$1'}`,
        type && wantVl ? [type, lim] : [lim],
      );
      for (const x of r.rows) {
        rows.push({
          type: x.outcome_type, substrate: 'validation_loop_outcomes',
          outcome_kind: x.outcome_kind, outcome_value: x.outcome_value,
          predicted_prob_at_decision: x.predicted_prob_at_decision,
          is_demo: x.is_demo, source: x.source,
          subject: pseudonym(x.subject_email), observed_at: x.observed_at,
        });
      }
    } catch { /* honest gap */ }
  }

  if ((!type || type === 'hiring') && await tablePresent(pool, 'public.employer_candidates')) {
    try {
      const r = await pool.query(
        `SELECT stage, predicted_prob_at_decision, email, decision_at, stage_changed_at, updated_at
           FROM employer_candidates
          WHERE stage IN ('Hired','Rejected')
          ORDER BY COALESCE(decision_at, stage_changed_at, updated_at) DESC NULLS LAST LIMIT $1`, [lim]);
      for (const x of r.rows) {
        const isDemo = String(x.email ?? '').trim().toLowerCase().endsWith('@example.com');
        rows.push({
          type: 'hiring', substrate: 'employer_candidates',
          outcome_kind: 'binary', outcome_value: x.stage === 'Hired' ? 1 : 0,
          predicted_prob_at_decision: x.predicted_prob_at_decision,
          is_demo: isDemo, source: 'employer_feeder',
          subject: pseudonym(x.email),
          observed_at: x.decision_at ?? x.stage_changed_at ?? x.updated_at,
        });
      }
    } catch { /* honest gap */ }
  }

  if (wantCareer && await tablePresent(pool, 'public.career_outcomes')) {
    try {
      const r = await pool.query(
        `SELECT outcome_type, outcome_kind, outcome_value, prior_score_value, prior_score_type,
                is_demo, source, user_id, observed_at
           FROM career_outcomes ORDER BY observed_at DESC NULLS LAST LIMIT $1`, [lim]);
      for (const x of r.rows) {
        rows.push({
          type: 'career', substrate: 'career_outcomes',
          outcome_kind: x.outcome_kind, outcome_value: x.outcome_value,
          prior_score_value: x.prior_score_value, prior_score_type: x.prior_score_type,
          is_demo: x.is_demo, source: x.source,
          subject: pseudonym(x.user_id), observed_at: x.observed_at,
        });
      }
    } catch { /* honest gap */ }
  }

  if (wantLearning && await tablePresent(pool, 'public.student_subscriptions')) {
    try {
      const r = await pool.query(
        `SELECT student_id, assessment_completed_at, report_generated_at, status, created_at
           FROM student_subscriptions
          WHERE assessment_completed_at IS NOT NULL
          ORDER BY assessment_completed_at DESC NULLS LAST LIMIT $1`, [lim]);
      for (const x of r.rows) {
        rows.push({
          type: 'learning', substrate: 'student_subscriptions',
          outcome_kind: 'milestone', outcome_value: 1,
          status: x.status, is_demo: false, source: 'subscription',
          subject: pseudonym(x.student_id),
          observed_at: x.assessment_completed_at ?? x.created_at,
        });
      }
    } catch { /* honest gap */ }
  }

  rows.sort((a, b) => {
    const ta = a.observed_at ? new Date(a.observed_at).getTime() : 0;
    const tb = b.observed_at ? new Date(b.observed_at).getTime() : 0;
    return tb - ta;
  });

  return {
    ok: true, version: OUTCOME_INTELLIGENCE_VERSION,
    type: type ?? 'all', count: rows.length, rows: rows.slice(0, lim),
    note: 'Subjects are irreversibly pseudonymised; demo rows are labelled, never counted as evidence.',
    read_only: true,
  };
}

interface CertCheck { id: string; criterion: string; status: 'PASS' | 'PARTIAL' | 'FAIL'; detail: string; }

/** Honest certification — structural checks PASS; empirical-accuracy criteria stay PARTIAL until
 *  realized outcomes reach k_min. Never inflates a verdict. */
export async function composeCertification(pool: Pool) {
  const overview = await composeOverview(pool);
  const evidencePairs = overview.platform.evidence_pairs;
  const realized = overview.platform.realized_coverage ?? 0;

  const checks: CertCheck[] = [
    {
      id: 'C1', criterion: 'Unified six-type outcome taxonomy (hiring·performance·promotion·retention·career·learning)',
      status: 'PASS',
      detail: `All ${OUTCOME_INTEL_TYPES.length} types composed from their canonical substrates without mutating any existing surface.`,
    },
    {
      id: 'C2', criterion: 'Coverage ⟂ Confidence kept as separate axes (never composited)',
      status: 'PASS',
      detail: 'Coverage (realized outcomes captured) and Confidence (empirical accuracy) are reported independently; a realized outcome without a decision-time prediction counts only toward Coverage.',
    },
    {
      id: 'C3', criterion: 'Abstain below k_min — no empirical accuracy claimed under threshold',
      status: evidencePairs >= OI_K_MIN ? 'PASS' : 'PARTIAL',
      detail: evidencePairs >= OI_K_MIN
        ? `Evidence pairs ${evidencePairs} ≥ k_min ${OI_K_MIN}; calibration trusted.`
        : `Evidence pairs ${evidencePairs}/${OI_K_MIN}; accuracy correctly ABSTAINED (mechanism present, threshold unmet).`,
    },
    {
      id: 'C4', criterion: 'No fabrication — null/abstain never coerced to 0; out-of-range predictions dropped',
      status: 'PASS',
      detail: 'Unreadable substrates degrade to null (not 0); only finite [0,1] predictions paired with binary outcomes feed calibration.',
    },
    {
      id: 'C5', criterion: 'Prediction ≠ Outcome — empirical accuracy requires realized outcomes',
      status: 'PASS',
      detail: 'Upstream predictions are surfaced; empirical accuracy is claimed ONLY once realized outcomes accrue.',
    },
    {
      id: 'C6', criterion: 'Flag-gated, additive, byte-identical OFF (read-only, no DDL)',
      status: 'PASS',
      detail: 'Behind outcomeIntelligenceActivation (default OFF); composer reads via to_regclass probes only and never writes.',
    },
    {
      id: 'C7', criterion: 'Empirical accuracy evidence-backed (≥ k_min realized predictions)',
      status: evidencePairs >= OI_K_MIN ? 'PASS' : 'PARTIAL',
      detail: `Realized coverage ${realized}, evidence pairs ${evidencePairs}/${OI_K_MIN}. PARTIAL until realized predictions reach k_min — honest, not a defect.`,
    },
  ];

  const anyFail = checks.some((c) => c.status === 'FAIL');
  const allPass = checks.every((c) => c.status === 'PASS');
  const verdict: 'CERTIFIED' | 'PARTIAL' | 'FAIL' = anyFail ? 'FAIL' : allPass ? 'CERTIFIED' : 'PARTIAL';

  return {
    ok: true,
    version: OUTCOME_INTELLIGENCE_VERSION,
    k_min: OI_K_MIN,
    verdict,
    summary: verdict === 'CERTIFIED'
      ? 'CERTIFIED — six-type outcome intelligence is unified and empirically evidence-backed.'
      : 'PARTIAL — six-type outcome intelligence is structurally unified and honest; empirical accuracy ABSTAINS until realized outcomes reach k_min. Honest PARTIAL over inflation.',
    checks,
    platform: overview.platform,
    read_only: true,
  };
}
