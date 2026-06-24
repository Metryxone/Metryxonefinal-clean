/**
 * Smoke — MX-73X Section 5 unified hiring score (pure engine).
 *
 * Proves, without a DB:
 *   1. Competency null  -> score WITHHELD (null), never fabricated from EI/readiness.
 *   2. EI actually INFLUENCES the score (changing ei_score moves the number).
 *   3. EI absent        -> excluded (present:false) and weights re-normalize (not counted as 0).
 *   4. All components present -> effective weights sum to ~1 and score stays in [0,100].
 *   5. provisional/validated/calibration are INHERITED from the match (not invented).
 *   6. The competency flag defaults OFF (flag-OFF route 503 contract is upstream of this).
 */
import {
  deriveUnifiedHiringScore,
  normalizeEiScore,
  HIRING_SCORE_WEIGHTS,
} from '../services/employer-hiring-score';
import type { CompetencyDrivenMatch } from '../services/employer-competency-hiring';
import { isEmployerCompetencyHiringEnabled } from '../config/feature-flags';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Minimal match factory — only the fields the score engine reads. */
function makeMatch(over: Partial<CompetencyDrivenMatch> = {}): CompetencyDrivenMatch {
  const base = {
    subjectId: 'cand@example.com',
    jobId: 'job-1',
    jobTitle: 'Backend Engineer',
    source: 'onto_competency_profile',
    competencyProfileAvailable: true,
    competencyMatch: 70,
    requirementCoveragePct: 60,
    matchedRequirementCount: 6,
    totalRequirementCount: 10,
    requirements: [],
    gaps: [],
    unassessedRequirements: [],
    roleDna: {
      resolved: true,
      roleTitle: 'Backend Engineer',
      requirementSource: 'curated',
      confidence: 0.8,
      band: 'high',
      provisional: false,
      benchmark: { available: false, source: null, reason: 'no_matching_benchmark_row' } as any,
    },
    candidateReadiness: {
      available: true,
      readinessScore: 60,
      band: 'developing',
      coveragePct: 55,
      note: '',
    },
    calibration: { state: 'uncalibrated', realizedOutcomes: 0, minRequired: 30, note: '' },
    fitSignal: {
      band: 'fit',
      assessedBand: 'fit',
      coverageSufficient: true,
      provisional: true,
      rationale: '',
      validated: false,
    },
    coverageNote: '',
    confidenceNote: '',
    provenance: '',
    version: '',
    generatedAt: new Date().toISOString(),
  } as unknown as CompetencyDrivenMatch;
  return { ...base, ...over } as CompetencyDrivenMatch;
}

console.log('MX-73X unified hiring score smoke');

// 1. Withheld without a competency anchor.
{
  const r = deriveUnifiedHiringScore(makeMatch({ competencyMatch: null }), { eiScore: 90 });
  check('competency null -> withheld', r.withheld === true && r.hiringScore === null);
  check('withheld -> band null', r.band === null);
  check('withheld -> no fabricated contribution', r.components.every((c) => c.contribution === null));
}

// 2. EI influences the score.
{
  const low = deriveUnifiedHiringScore(makeMatch(), { eiScore: 20 });
  const high = deriveUnifiedHiringScore(makeMatch(), { eiScore: 95 });
  check(
    'EI influences score',
    low.hiringScore != null && high.hiringScore != null && high.hiringScore > low.hiringScore,
    `low=${low.hiringScore} high=${high.hiringScore}`,
  );
  const eiComp = high.components.find((c) => c.key === 'employabilityIndex');
  check('EI present & contributes', !!eiComp && eiComp.present && (eiComp.contribution ?? 0) > 0);
}

// 3. EI absent -> excluded, weights re-normalize (not counted as 0).
{
  const withEi = deriveUnifiedHiringScore(makeMatch(), { eiScore: 50 });
  const noEi = deriveUnifiedHiringScore(makeMatch(), {});
  const eiComp = noEi.components.find((c) => c.key === 'employabilityIndex')!;
  check('EI absent -> present:false', eiComp.present === false && eiComp.value === null);
  check('EI absent -> excluded from presentComponents', !noEi.presentComponents.includes('employabilityIndex'));
  // With EI=50 (below competency 70) the score should be pulled DOWN vs no-EI; absence must
  // NOT behave like EI=0 (which would crater the score far below the no-EI value).
  check(
    'EI absent != EI 0 (re-normalized, not zeroed)',
    noEi.hiringScore != null && withEi.hiringScore != null && noEi.hiringScore > withEi.hiringScore,
    `noEi=${noEi.hiringScore} withEi50=${withEi.hiringScore}`,
  );
}

// 4. Present effective weights sum to ~1; score bounded.
{
  const r = deriveUnifiedHiringScore(makeMatch(), { eiScore: 80 });
  const sumEff = r.components.filter((c) => c.present).reduce((s, c) => s + c.effectiveWeight, 0);
  check('present effective weights ~ 1', Math.abs(sumEff - 1) < 0.02, `sum=${sumEff}`);
  check('score in [0,100]', r.hiringScore != null && r.hiringScore >= 0 && r.hiringScore <= 100);
  check('absent components have 0 effective weight', r.components.filter((c) => !c.present).every((c) => c.effectiveWeight === 0));
}

// 5. Inheritance of provisional/validated/calibration.
{
  const r = deriveUnifiedHiringScore(
    makeMatch({
      calibration: { state: 'calibrated', realizedOutcomes: 40, minRequired: 30, note: '' } as any,
      fitSignal: { band: 'fit', assessedBand: 'fit', coverageSufficient: true, provisional: false, rationale: '', validated: true } as any,
    }),
    { eiScore: 70 },
  );
  check('inherits calibrated', r.calibrationState === 'calibrated' && r.validated === true && r.provisional === false);
}

// 6. normalizeEiScore null-safety.
{
  check('normalizeEiScore null', normalizeEiScore(null) === null && normalizeEiScore('') === null && normalizeEiScore('abc') === null);
  check('normalizeEiScore clamps', normalizeEiScore(140) === 100 && normalizeEiScore(-5) === 0 && normalizeEiScore('73') === 73);
}

// 6b. Benchmark heuristic edge behavior (lock intent).
function withBenchmark(available: boolean, percentiles: Record<string, number> | null) {
  return makeMatch({
    competencyMatch: 70,
    roleDna: {
      resolved: true,
      roleTitle: 'X',
      requirementSource: 'curated',
      confidence: 0.8,
      band: 'high',
      provisional: false,
      benchmark: { available, percentiles } as any,
    } as any,
  });
}
{
  // Unavailable / suppressed cohort -> benchmark abstains (present:false).
  const sup = deriveUnifiedHiringScore(withBenchmark(false, null), { eiScore: 70 });
  const bSup = sup.components.find((c) => c.key === 'benchmarkMatch')!;
  check('benchmark suppressed -> absent', bSup.present === false && bSup.value === null);

  // Only p50 present -> coarse 35/65 placement (above vs below median).
  const med = deriveUnifiedHiringScore(withBenchmark(true, { p50: 60 }), { eiScore: 70 });
  const bMed = med.components.find((c) => c.key === 'benchmarkMatch')!;
  check('benchmark median-only -> coarse placement', bMed.present && (bMed.value === 65 || bMed.value === 35));

  // p90 <= p50 (degenerate) -> falls back to coarse placement, never NaN/over-100.
  const deg = deriveUnifiedHiringScore(withBenchmark(true, { p50: 60, p90: 55 }), { eiScore: 70 });
  const bDeg = deg.components.find((c) => c.key === 'benchmarkMatch')!;
  check('benchmark degenerate p90<=p50 -> bounded coarse', bDeg.present && bDeg.value != null && bDeg.value >= 0 && bDeg.value <= 100);

  // Extreme candidate vs wide band -> clamped to [0,100].
  const ext = deriveUnifiedHiringScore(withBenchmark(true, { p50: 50, p90: 60 }), { eiScore: 70 });
  const bExt = ext.components.find((c) => c.key === 'benchmarkMatch')!;
  check('benchmark extreme -> clamped [0,100]', bExt.present && bExt.value != null && bExt.value >= 0 && bExt.value <= 100);
}

// 7. Base weights sum to 1 (design invariant).
{
  const sum = Object.values(HIRING_SCORE_WEIGHTS).reduce((s, w) => s + w, 0);
  check('base weights sum to 1', Math.abs(sum - 1) < 1e-9, `sum=${sum}`);
}

// 8. Flag defaults OFF (flag-OFF route 503 byte-identical contract is enforced upstream).
{
  check('employerCompetencyHiring defaults OFF', isEmployerCompetencyHiringEnabled() === false);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
if (fail > 0) process.exit(1);
