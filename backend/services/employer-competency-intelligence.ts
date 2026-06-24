/**
 * Employer Competency Intelligence — MX-100X Phase 5 (additive, flag-gated, read-only).
 *
 * WHAT THIS IS
 * ------------
 * The ONE competency-driven employer hiring flow. It COMPOSES (never recomputes) the
 * Phase-3 `computeCompetencyDrivenMatch` (which itself composes Phase-1 Role DNA +
 * Phase-2 unified competency profile + Role-Readiness-V2) and derives, from that match:
 *   - an interview recommendation (focus areas from measured gaps + probe list from
 *     unassessed requirements),
 *   - a hiring recommendation (a developmental decision-SUPPORT action — NOT a
 *     hire/no-hire suitability verdict),
 *   - an employer benchmark surfaced from the Phase-1 Role DNA benchmark with explicit
 *     k-anonymity suppression.
 *
 * This is the competency-PRIMARY alternative to the legacy heuristic in
 * `routes/employer-hiring-intelligence.ts` (STRONG_HIRE/NO_HIRE verdicts). That legacy
 * engine is left UNTOUCHED; this composes alongside it behind the SAME flag
 * (`employerCompetencyHiring`) and is exposed on a separate v2 route.
 *
 * HONESTY CONTRACT
 * ----------------
 * - Reads ONLY. No writes, no DDL. Pure derivations over the match output.
 * - LANGUAGE POLICY: outputs are DEVELOPMENTAL competency signals only. No hiring /
 *   suitability / pass-fail verdict, no guaranteed-performance claim. The hiring
 *   recommendation is a decision-SUPPORT action with an explicit non-verdict disclaimer.
 * - Coverage (requirements assessed) and Confidence (calibration state) stay SEPARATE.
 *   Fit bands withhold below the coverage floor; the signal is `validated:false` until the
 *   platform has enough realized outcomes (inherited from the match).
 * - Benchmark: surfaces the Role DNA benchmark but ENFORCES k-anonymity — a cohort whose
 *   size cannot be confirmed `>= BENCHMARK_K_MIN` is SUPPRESSED (fail closed), never shown.
 * - `null`/abstain where unmeasured — never coerced to 0, never fabricated.
 */
import type { Pool } from 'pg';
import {
  computeCompetencyDrivenMatch,
  EMPLOYER_COMPETENCY_HIRING_VERSION,
  type CompetencyDrivenMatch,
  type CompetencyRequirementMatch,
} from './employer-competency-hiring';
import type { RoleBenchmark } from './role-dna-expansion-engine';
import {
  deriveUnifiedHiringScore,
  type UnifiedHiringScore,
} from './employer-hiring-score';

export const EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION = '98x-phase5-1.0.0';

/** k-anonymity floor for surfacing an employer benchmark cohort. A cohort whose size is
 *  unknown or below this is suppressed (fail closed) — coverage and privacy over reach. */
export const BENCHMARK_K_MIN = 30;

const TOP_FOCUS_AREAS = 6;
const TOP_PROBE_AREAS = 8;

export const LANGUAGE_POLICY = {
  allowed: [
    'competency match',
    'requirement coverage',
    'developmental focus area',
    'interview focus area',
    'evidence to gather',
    'gap band',
    'calibration state',
    'decision support',
  ],
  disallowed: [
    'validated hiring prediction',
    'guaranteed performance',
    'pass/fail verdict',
    'suitability score',
    'hire/no-hire verdict',
  ],
};

const NON_VERDICT_DISCLAIMER =
  'Developmental competency decision-support signal — NOT a hiring, suitability, or ' +
  'pass/fail verdict. Coverage (requirements assessed) and Confidence (calibration state) ' +
  'are independent axes; treat as input to human judgement, never as a decision.';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
export interface InterviewFocusArea {
  code: string;
  name: string;
  importanceTier: string;
  targetScore: number;
  candidateScore: number | null;
  attainment: number | null;
  /** target - candidate (positive => below target), or null when unassessed. */
  shortfall: number | null;
  note: string;
}

export type InterviewStructure =
  | 'baseline_competency_assessment'
  | 'broad_competency_assessment'
  | 'targeted_competency_deep_dive'
  | 'confirmation_interview';

export interface InterviewRecommendation {
  /** Measured competency gaps to probe in interview (real, never fabricated). */
  focusAreas: InterviewFocusArea[];
  /** Role requirements with NO candidate competency data — gather evidence in interview. */
  probeAreas: InterviewFocusArea[];
  structure: InterviewStructure;
  coverageSufficient: boolean;
  note: string;
}

export type HiringAction =
  | 'advance_to_interview'
  | 'targeted_interview'
  | 'gather_more_evidence'
  | 'development_focus'
  | 'insufficient_competency_evidence';

export interface HiringRecommendation {
  /** Developmental decision-SUPPORT action — explicitly NOT a hire/no-hire verdict. */
  action: HiringAction;
  /** Headline fit band inherited from the match (WITHHELD/null below the coverage floor). */
  fitBand: CompetencyDrivenMatch['fitSignal']['band'];
  competencyMatch: number | null;
  requirementCoveragePct: number | null;
  coverageSufficient: boolean;
  calibrationState: 'calibrated' | 'uncalibrated';
  /** True while the signal is coverage-thin OR uncalibrated — not a settled fit. */
  provisional: boolean;
  /** True only once the platform has enough realized outcomes (inherited). */
  validated: boolean;
  rationale: string;
  disclaimer: string;
}

export interface EmployerBenchmark {
  available: boolean;
  source: string | null;
  reason?: string;
  percentiles: Record<string, number | null> | null;
  sampleSize: number | null;
  suppressed: boolean;
  suppressionReason?: string;
  kMin: number;
  note: string;
}

export interface EmployerCompetencyIntelligence {
  subjectId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  /** Full Phase-3 competency-driven match (role-match / gap / readiness / coverage / fit). */
  match: CompetencyDrivenMatch;
  interviewRecommendation: InterviewRecommendation;
  hiringRecommendation: HiringRecommendation;
  /** MX-73X Section 5 — unified hiring score (0..100) composing competency + employability
   *  index + readiness + role-match + benchmark; withheld (null) without a competency anchor. */
  hiringScore: UnifiedHiringScore;
  benchmark: EmployerBenchmark;
  languagePolicy: typeof LANGUAGE_POLICY;
  provenance: string;
  methodologyVersions: { intelligence: string; match: string };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Pure derivations
// ---------------------------------------------------------------------------
function toFocusArea(m: CompetencyRequirementMatch): InterviewFocusArea {
  const shortfall =
    m.candidateScore != null ? Math.round((m.targetScore - m.candidateScore) * 10) / 10 : null;
  const note =
    m.candidateScore != null
      ? `Measured ${m.candidateScore}/${m.targetScore} target (${m.importanceTier}) — developmental focus area; probe for current depth.`
      : `No competency evidence yet (${m.importanceTier}) — gather evidence in interview.`;
  return {
    code: m.code,
    name: m.name,
    importanceTier: m.importanceTier,
    targetScore: m.targetScore,
    candidateScore: m.candidateScore,
    attainment: m.attainment,
    shortfall,
    note,
  };
}

/** Rank by requirement weight, then by larger shortfall (more below target first). */
function byWeightThenShortfall(a: CompetencyRequirementMatch, b: CompetencyRequirementMatch): number {
  if (b.weight !== a.weight) return b.weight - a.weight;
  const sa = a.candidateScore != null ? a.targetScore - a.candidateScore : a.targetScore;
  const sb = b.candidateScore != null ? b.targetScore - b.candidateScore : b.targetScore;
  return sb - sa;
}

export function deriveInterviewRecommendation(match: CompetencyDrivenMatch): InterviewRecommendation {
  const coverageSufficient = match.fitSignal.coverageSufficient;
  const focusAreas = [...match.gaps].sort(byWeightThenShortfall).slice(0, TOP_FOCUS_AREAS).map(toFocusArea);
  const probeAreas = [...match.unassessedRequirements]
    .sort(byWeightThenShortfall)
    .slice(0, TOP_PROBE_AREAS)
    .map(toFocusArea);

  let structure: InterviewStructure;
  if (match.competencyMatch == null) {
    structure = 'baseline_competency_assessment';
  } else if (!coverageSufficient) {
    structure = 'broad_competency_assessment';
  } else if (focusAreas.length > 0) {
    structure = 'targeted_competency_deep_dive';
  } else {
    structure = 'confirmation_interview';
  }

  const note =
    match.competencyMatch == null
      ? 'No measured competency profile — interview should establish a competency baseline; ' +
        'no developmental gaps can be asserted yet (never fabricated).'
      : `${focusAreas.length} measured developmental focus area(s) and ${probeAreas.length} ` +
        `unassessed requirement(s) to gather evidence on. ` +
        (coverageSufficient
          ? 'Assessed coverage is sufficient — deep-dive the focus areas.'
          : 'Assessed coverage is thin — broaden the interview to establish more of the requirement set.');

  return { focusAreas, probeAreas, structure, coverageSufficient, note };
}

export function deriveHiringRecommendation(match: CompetencyDrivenMatch): HiringRecommendation {
  const fit = match.fitSignal;
  const coverageSufficient = fit.coverageSufficient;
  const calibrationState = match.calibration.state;

  let action: HiringAction;
  let rationale: string;

  if (match.competencyMatch == null || !match.competencyProfileAvailable) {
    action = 'insufficient_competency_evidence';
    rationale =
      'No measured competency overlap with the role requirements — competency match withheld. ' +
      'Gather competency evidence before drawing any developmental conclusion (never fabricated).';
  } else if (!coverageSufficient) {
    action = 'gather_more_evidence';
    rationale =
      `Competency match ${match.competencyMatch}/100 over ${match.matchedRequirementCount}/` +
      `${match.totalRequirementCount} requirements (coverage ${match.requirementCoveragePct}%). ` +
      'Coverage is below the floor — headline fit band withheld; gather more competency evidence.';
  } else {
    switch (fit.band) {
      case 'strong_fit':
      case 'fit':
        action = 'advance_to_interview';
        rationale =
          `Competency strengths align with the role requirements (match ${match.competencyMatch}/100, ` +
          `coverage ${match.requirementCoveragePct}%). Advance to interview to validate developmentally.`;
        break;
      case 'conditional':
        action = 'targeted_interview';
        rationale =
          `Mixed competency match (${match.competencyMatch}/100, coverage ${match.requirementCoveragePct}%) ` +
          `with ${match.gaps.length} developmental gap(s) — run a targeted interview on the focus areas.`;
        break;
      default:
        action = 'development_focus';
        rationale =
          `Notable competency gaps (match ${match.competencyMatch}/100, coverage ` +
          `${match.requirementCoveragePct}%) — significant development indicated relative to this role.`;
    }
  }

  return {
    action,
    fitBand: fit.band,
    competencyMatch: match.competencyMatch,
    requirementCoveragePct: match.requirementCoveragePct,
    coverageSufficient,
    calibrationState,
    provisional: fit.provisional,
    validated: fit.validated,
    rationale: `${rationale} ${calibrationState === 'uncalibrated' ? 'Uncalibrated developmental signal.' : 'Calibrated.'}`,
    disclaimer: NON_VERDICT_DISCLAIMER,
  };
}

/** Surface the Phase-1 Role DNA benchmark, ENFORCING k-anonymity (k >= BENCHMARK_K_MIN).
 *  A cohort whose size is unknown or below the floor is suppressed (fail closed). */
export function deriveEmployerBenchmark(rb: RoleBenchmark): EmployerBenchmark {
  const base: EmployerBenchmark = {
    available: false,
    source: rb.source ?? null,
    reason: rb.reason,
    percentiles: null,
    sampleSize: rb.sampleSize ?? null,
    suppressed: false,
    kMin: BENCHMARK_K_MIN,
    note: '',
  };

  if (!rb.available) {
    return {
      ...base,
      note:
        `No role benchmark available (${rb.reason ?? 'unknown'}). ` +
        'Coverage gap — benchmark abstains rather than fabricate a percentile.',
    };
  }

  const n = rb.sampleSize ?? null;
  if (n == null) {
    return {
      ...base,
      suppressed: true,
      suppressionReason: 'cohort_size_unknown',
      note: `Benchmark present but cohort size unknown — suppressed to preserve k-anonymity (k>=${BENCHMARK_K_MIN}).`,
    };
  }
  if (n < BENCHMARK_K_MIN) {
    return {
      ...base,
      suppressed: true,
      suppressionReason: `cohort_too_small(n=${n},min=${BENCHMARK_K_MIN})`,
      note: `Benchmark cohort too small (n=${n} < ${BENCHMARK_K_MIN}) — suppressed for k-anonymity.`,
    };
  }

  return {
    available: true,
    source: rb.source ?? null,
    percentiles: rb.percentiles ?? null,
    sampleSize: n,
    suppressed: false,
    kMin: BENCHMARK_K_MIN,
    note: `Role benchmark cohort n=${n} (>= ${BENCHMARK_K_MIN}) — percentiles released.`,
  };
}

// ---------------------------------------------------------------------------
// Composition (read-only; never throws beyond the underlying match contract)
// ---------------------------------------------------------------------------
export async function computeEmployerCompetencyIntelligence(
  pool: Pool,
  opts: { candidate: any; job: any },
): Promise<EmployerCompetencyIntelligence> {
  const match = await computeCompetencyDrivenMatch(pool, opts);
  return {
    subjectId: match.subjectId,
    jobId: match.jobId,
    jobTitle: match.jobTitle,
    match,
    interviewRecommendation: deriveInterviewRecommendation(match),
    hiringRecommendation: deriveHiringRecommendation(match),
    hiringScore: deriveUnifiedHiringScore(match, { eiScore: opts.candidate?.ei_score }),
    benchmark: deriveEmployerBenchmark(match.roleDna.benchmark),
    languagePolicy: LANGUAGE_POLICY,
    provenance: '98x_phase5_employer_competency_intelligence',
    methodologyVersions: {
      intelligence: EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION,
      match: EMPLOYER_COMPETENCY_HIRING_VERSION,
    },
    generatedAt: new Date().toISOString(),
  };
}
