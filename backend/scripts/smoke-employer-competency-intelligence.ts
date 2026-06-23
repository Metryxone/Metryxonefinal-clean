/**
 * MX-100X Phase 5 — Employer Competency Intelligence SMOKE
 * -------------------------------------------------------
 * 1. HTTP flag-OFF contract: the new /intelligence route (and the existing /match route)
 *    MUST 503 when `employerCompetencyHiring` is OFF (byte-identical OFF — the whole v2 family
 *    is gated). The Backend API workflow runs with the flag OFF, so this asserts the gate.
 * 2. Service-level guards (run the pure derivations directly):
 *    - developmental language only (no hire/no-hire verdict in affirmative output),
 *    - hiring rec carries a non-verdict disclaimer,
 *    - benchmark k-anonymity gate suppresses below k_min / unknown cohort (fail closed),
 *    - coverage-thin → fit band WITHHELD + gather_more_evidence (no fabricated fit).
 */
import {
  deriveInterviewRecommendation,
  deriveHiringRecommendation,
  deriveEmployerBenchmark,
  BENCHMARK_K_MIN,
} from '../services/employer-competency-intelligence';
import type { CompetencyDrivenMatch, CompetencyRequirementMatch } from '../services/employer-competency-hiring';
import type { RoleBenchmark } from '../services/role-dna-expansion-engine';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:8080';
let pass = true;
const note = (ok: boolean, msg: string) => { if (!ok) pass = false; console.log(`${ok ? 'PASS' : 'FAIL'} — ${msg}`); };

function reqRow(code: string, w: number, target: number, cand: number | null): CompetencyRequirementMatch {
  const attainment = cand != null && target > 0 ? Math.min(1, cand / target) : null;
  return {
    code, name: code, importanceTier: 'core', weight: w, source: 'curated',
    targetScore: target, candidateScore: cand, attainment,
    assessed: cand != null, matchedKey: cand != null ? code : null,
    matchedLedger: cand != null ? 'onto_competency_profiles' : null,
  };
}

function match(coverageSufficient: boolean, band: CompetencyDrivenMatch['fitSignal']['band'], bm: RoleBenchmark): CompetencyDrivenMatch {
  const reqs = [reqRow('A', 1, 80, 60), reqRow('B', 0.8, 70, null)];
  return {
    subjectId: 'demo@example.com', jobId: 'j', jobTitle: 'Role', source: 'onto_competency_profile',
    competencyProfileAvailable: true, competencyMatch: 70, requirementCoveragePct: coverageSufficient ? 60 : 20,
    matchedRequirementCount: 1, totalRequirementCount: 2, requirements: reqs,
    gaps: reqs.filter((r) => r.assessed && (r.attainment ?? 1) < 1),
    unassessedRequirements: reqs.filter((r) => !r.assessed),
    roleDna: { resolved: true, roleTitle: 'Role', requirementSource: 'curated', confidence: 0.9, band: 'high', provisional: false, benchmark: bm },
    candidateReadiness: { available: true, readinessScore: 70, band: 'Developing', coveragePct: 60, note: '' },
    calibration: { state: 'uncalibrated', realizedOutcomes: 0, minRequired: 30, note: '' },
    fitSignal: { band: coverageSufficient ? band : null, assessedBand: band, coverageSufficient, provisional: true, rationale: '', validated: false },
    coverageNote: '', confidenceNote: '', provenance: '', version: '', generatedAt: new Date().toISOString(),
  };
}

async function code(path: string): Promise<number> {
  try {
    const r = await fetch(`${BASE}${path}`);
    return r.status;
  } catch { return -1; }
}

async function main() {
  console.log('# Smoke — Employer Competency Intelligence (Phase 5)\n');

  // 1. HTTP flag-OFF contract (global /api/admin-style gate not applicable here; route gates flag→auth).
  const sIntel = await code('/api/v2/employer/competency-match/x/y/intelligence');
  const sMatch = await code('/api/v2/employer/competency-match/x/y');
  note(sIntel === 503, `flag-OFF /intelligence → 503 (got ${sIntel})`);
  note(sMatch === 503, `flag-OFF /match → 503 (got ${sMatch})`);

  // 2. Service guards.
  const k30: RoleBenchmark = { available: true, source: 'ti_role_benchmarks', percentiles: { p50: 60 }, sampleSize: 40 };
  const ok = match(true, 'strong_fit', k30);
  const ir = deriveInterviewRecommendation(ok);
  const hr = deriveHiringRecommendation(ok);
  const affirmative = JSON.stringify({ ...hr, disclaimer: undefined, ...ir }).toLowerCase();
  note(!/strong_hire|no_hire|hire\/no-hire|pass\/fail|suitability score/.test(affirmative), 'no verdict/suitability language in affirmative output');
  note(hr.disclaimer.length > 0 && /not a hiring/i.test(hr.disclaimer), 'hiring rec carries non-verdict disclaimer');
  note(hr.action === 'advance_to_interview', `strong+sufficient → advance_to_interview (got ${hr.action})`);
  note(ir.focusAreas.length === 1 && ir.probeAreas.length === 1, 'interview rec surfaces measured gap + unassessed probe');

  const thin = deriveHiringRecommendation(match(false, 'strong_fit', k30));
  note(thin.action === 'gather_more_evidence' && thin.fitBand === null, 'coverage-thin → gather_more_evidence + WITHHELD fit (no fabrication)');

  note(deriveEmployerBenchmark(k30).available && !deriveEmployerBenchmark(k30).suppressed, `benchmark n=40 (>=${BENCHMARK_K_MIN}) released`);
  note(deriveEmployerBenchmark({ available: true, source: 's', percentiles: {}, sampleSize: 5 }).suppressed, 'benchmark n=5 suppressed (k-anonymity)');
  note(deriveEmployerBenchmark({ available: true, source: 's', percentiles: {}, sampleSize: null }).suppressed, 'benchmark unknown cohort suppressed (fail closed)');
  note(!deriveEmployerBenchmark({ available: false, source: null, reason: 'none' }).suppressed && !deriveEmployerBenchmark({ available: false, source: null, reason: 'none' }).available, 'benchmark absent → honest abstain (not suppressed)');

  console.log(`\n${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
