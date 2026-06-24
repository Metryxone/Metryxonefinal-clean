/**
 * Unified Employer Hiring Score — MX-73X Section 5 (additive, flag-gated, read-only).
 *
 * WHAT THIS IS
 * ------------
 * The ONE unified hiring score (0..100) the MX-73X spec asks for. It COMPOSES (never
 * recomputes) signals that ALREADY exist on the Phase-3 competency-driven match plus the
 * candidate's Employability Index, into a single, transparent, weighted score:
 *
 *   Competency Score   (match.competencyMatch)               -- REQUIRED anchor
 *   Readiness Score    (match.candidateReadiness.readiness)  -- candidate-scope readiness
 *   Employability Idx  (candidate.ei_score)                  -- the EI input MX-73X requires
 *   Role Match         (match.roleDna.confidence * 100)      -- role-intelligence confidence
 *   Benchmark Match    (match.roleDna.benchmark percentile)  -- k-anon suppressed by default
 *
 * WHY THIS CLOSES A REAL GAP
 * --------------------------
 * Before MX-73X the competency engine produced a competency-only match; the Employability
 * Index was stored on the candidate but NEVER folded into a hiring score, and there was no
 * single 0..100 hiring number composing all the inputs the spec lists. This is that number.
 *
 * HONESTY CONTRACT
 * ----------------
 * - Pure derivation over already-computed signals. No DB reads, no writes, no DDL.
 * - Competency is the REQUIRED anchor: if `competencyMatch` is null (no measured overlap),
 *   the hiring score is WITHHELD (null) — never fabricated from EI/readiness alone.
 * - Each component is null-safe; the weight set is RE-NORMALIZED over only the components
 *   that are actually present, so an absent input is never silently counted as 0.
 * - Benchmark match abstains under k-anonymity (suppressed cohorts) — it does not contribute.
 * - Inherits coverage/calibration: `provisional` and `validated` are taken from the match;
 *   the score is a DEVELOPMENTAL decision-support signal, NEVER a validated hiring verdict.
 * - `null` where unmeasured — never coerced to 0.
 */
import type { CompetencyDrivenMatch } from './employer-competency-hiring';

export const EMPLOYER_HIRING_SCORE_VERSION = 'mx73x-section5-1.0.0';

/** Base weights for the unified hiring score. Re-normalized over PRESENT components only
 *  (competency is the required anchor, so it is always present when a score is produced). */
export const HIRING_SCORE_WEIGHTS = {
  competency: 0.35,
  employabilityIndex: 0.25,
  readiness: 0.2,
  roleMatch: 0.1,
  benchmarkMatch: 0.1,
} as const;

export type HiringScoreComponentKey = keyof typeof HIRING_SCORE_WEIGHTS;

const NON_VERDICT_DISCLAIMER =
  'Developmental decision-support hiring score — NOT a validated hiring, suitability, or ' +
  'pass/fail verdict. Composes competency, employability, readiness, role-intelligence and ' +
  'benchmark signals; treat as input to human judgement, never as a decision.';

export interface HiringScoreComponent {
  key: HiringScoreComponentKey;
  label: string;
  /** The component's own 0..100 value, or null when unmeasured (never coerced to 0). */
  value: number | null;
  /** Base weight before re-normalization. */
  baseWeight: number;
  /** Weight actually used after re-normalizing over present components (0 when absent). */
  effectiveWeight: number;
  present: boolean;
  /** value * effectiveWeight (the points this component contributes to the score). */
  contribution: number | null;
  source: string;
  note: string;
}

export interface UnifiedHiringScore {
  /** Unified hiring score 0..100, or null when WITHHELD (no competency anchor). */
  hiringScore: number | null;
  band: 'strong' | 'promising' | 'developing' | 'early' | null;
  withheld: boolean;
  withheldReason: string | null;
  components: HiringScoreComponent[];
  /** Keys of components that were present and contributed. */
  presentComponents: HiringScoreComponentKey[];
  /** Keys of components that abstained (unmeasured / suppressed). */
  absentComponents: HiringScoreComponentKey[];
  /** True while coverage-thin OR uncalibrated (inherited from the match). */
  provisional: boolean;
  /** True only once the platform has enough realized outcomes (inherited). */
  validated: boolean;
  calibrationState: 'calibrated' | 'uncalibrated';
  rationale: string;
  disclaimer: string;
  version: string;
  generatedAt: string;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Coerce a raw EI value to a 0..100 number, or null. Never turns missing into 0. */
export function normalizeEiScore(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clamp100(n);
}

/** Candidate-vs-benchmark percentile match (0..100) when the benchmark cohort is released
 *  (k-anonymity satisfied) AND a candidate competency value exists; else null (abstain). */
function benchmarkMatchValue(match: CompetencyDrivenMatch): number | null {
  const bm = match.roleDna?.benchmark;
  // Benchmark abstains when unavailable or suppressed for k-anonymity.
  if (!bm || !bm.available) return null;
  const pct = bm.percentiles ?? null;
  const cand = match.competencyMatch;
  if (!pct || cand == null) return null;
  // Position the candidate's competency match against released percentile anchors.
  const p50 = Number((pct as Record<string, unknown>).p50);
  const p90 = Number((pct as Record<string, unknown>).p90);
  if (!Number.isFinite(p50)) return null;
  if (Number.isFinite(p90) && p90 > p50) {
    // Linear placement between median (=>50) and 90th pct (=>90), clamped.
    const placed = 50 + ((cand - p50) / (p90 - p50)) * 40;
    return clamp100(placed);
  }
  // Only a median anchor: above/below median maps to a coarse 0..100 placement.
  return clamp100(cand >= p50 ? 65 : 35);
}

function bandOf(score: number | null): UnifiedHiringScore['band'] {
  if (score == null) return null;
  if (score >= 80) return 'strong';
  if (score >= 65) return 'promising';
  if (score >= 50) return 'developing';
  return 'early';
}

/**
 * Compose the unified hiring score from an existing competency-driven match plus the
 * candidate's Employability Index. Pure, null-safe, never fabricates.
 */
export function deriveUnifiedHiringScore(
  match: CompetencyDrivenMatch,
  opts: { eiScore?: unknown } = {},
): UnifiedHiringScore {
  const calibrationState = match.calibration?.state ?? 'uncalibrated';
  const provisional = match.fitSignal?.provisional ?? true;
  const validated = match.fitSignal?.validated ?? false;

  const competency = match.competencyMatch;
  const readiness = match.candidateReadiness?.available
    ? match.candidateReadiness.readinessScore
    : null;
  const ei = normalizeEiScore(opts.eiScore);
  const roleMatch =
    match.roleDna?.resolved && Number.isFinite(Number(match.roleDna.confidence))
      ? clamp100(Number(match.roleDna.confidence) * 100)
      : null;
  const benchmarkMatch = benchmarkMatchValue(match);

  const rawValues: Record<HiringScoreComponentKey, number | null> = {
    competency,
    employabilityIndex: ei,
    readiness,
    roleMatch,
    benchmarkMatch,
  };

  const labels: Record<HiringScoreComponentKey, string> = {
    competency: 'Competency Score',
    employabilityIndex: 'Employability Index',
    readiness: 'Readiness Score',
    roleMatch: 'Role Match',
    benchmarkMatch: 'Benchmark Match',
  };
  const sources: Record<HiringScoreComponentKey, string> = {
    competency: 'match.competencyMatch (weighted attainment over assessed requirements)',
    employabilityIndex: 'candidate.ei_score (Employability Index)',
    readiness: 'match.candidateReadiness.readinessScore (role-readiness-v2)',
    roleMatch: 'match.roleDna.confidence (role-DNA resolution confidence)',
    benchmarkMatch: 'match.roleDna.benchmark percentiles (k-anonymity enforced)',
  };

  // Competency is the required anchor. Without it the unified score is WITHHELD.
  if (competency == null) {
    const components: HiringScoreComponent[] = (
      Object.keys(HIRING_SCORE_WEIGHTS) as HiringScoreComponentKey[]
    ).map((key) => ({
      key,
      label: labels[key],
      value: rawValues[key],
      baseWeight: HIRING_SCORE_WEIGHTS[key],
      effectiveWeight: 0,
      present: false,
      contribution: null,
      source: sources[key],
      note:
        key === 'competency'
          ? 'No measured competency overlap — required anchor absent; hiring score withheld.'
          : 'Not folded in: hiring score withheld for lack of a competency anchor.',
    }));
    return {
      hiringScore: null,
      band: null,
      withheld: true,
      withheldReason:
        'Competency match is null (no measured candidate↔role competency overlap). The unified ' +
        'hiring score requires a competency anchor and is withheld rather than fabricated from ' +
        'Employability Index or readiness alone.',
      components,
      presentComponents: [],
      absentComponents: Object.keys(HIRING_SCORE_WEIGHTS) as HiringScoreComponentKey[],
      provisional: true,
      validated,
      calibrationState,
      rationale:
        'Hiring score withheld — no competency anchor. Gather competency evidence before a ' +
        'unified score can be composed (never fabricated).',
      disclaimer: NON_VERDICT_DISCLAIMER,
      version: EMPLOYER_HIRING_SCORE_VERSION,
      generatedAt: new Date().toISOString(),
    };
  }

  const keys = Object.keys(HIRING_SCORE_WEIGHTS) as HiringScoreComponentKey[];
  const presentKeys = keys.filter((k) => rawValues[k] != null);
  const presentBaseWeightSum = presentKeys.reduce((s, k) => s + HIRING_SCORE_WEIGHTS[k], 0);

  const components: HiringScoreComponent[] = keys.map((key) => {
    const value = rawValues[key];
    const present = value != null;
    const effectiveWeight =
      present && presentBaseWeightSum > 0
        ? HIRING_SCORE_WEIGHTS[key] / presentBaseWeightSum
        : 0;
    const contribution = present ? round1(value! * effectiveWeight) : null;
    return {
      key,
      label: labels[key],
      value,
      baseWeight: HIRING_SCORE_WEIGHTS[key],
      effectiveWeight: round1(effectiveWeight * 100) / 100,
      present,
      contribution,
      source: sources[key],
      note: present
        ? `${labels[key]} = ${value} (effective weight ${(effectiveWeight * 100).toFixed(0)}% after re-normalization).`
        : `${labels[key]} unmeasured — excluded from the score (weight re-normalized, never counted as 0).`,
    };
  });

  const hiringScore = round1(
    clamp100(
      presentKeys.reduce(
        (s, k) => s + rawValues[k]! * (HIRING_SCORE_WEIGHTS[k] / presentBaseWeightSum),
        0,
      ),
    ),
  );

  const absentKeys = keys.filter((k) => rawValues[k] == null);
  const rationale =
    `Unified hiring score ${hiringScore}/100 composed from ${presentKeys.length}/${keys.length} ` +
    `available signal(s) (${presentKeys.join(', ')}). ` +
    (absentKeys.length
      ? `${absentKeys.length} signal(s) abstained and were re-normalized out (${absentKeys.join(', ')}). `
      : '') +
    (provisional
      ? 'Provisional — coverage-thin or uncalibrated developmental signal.'
      : 'Coverage sufficient.') +
    (calibrationState === 'uncalibrated' ? ' Uncalibrated (not a validated probability).' : ' Calibrated.');

  return {
    hiringScore,
    band: bandOf(hiringScore),
    withheld: false,
    withheldReason: null,
    components,
    presentComponents: presentKeys,
    absentComponents: absentKeys,
    provisional,
    validated,
    calibrationState,
    rationale,
    disclaimer: NON_VERDICT_DISCLAIMER,
    version: EMPLOYER_HIRING_SCORE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
