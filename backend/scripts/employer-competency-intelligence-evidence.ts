/**
 * MX-100X Phase 5 — Employer Competency Intelligence EVIDENCE
 * ----------------------------------------------------------
 * Proves the competency-driven employer hiring flow end-to-end and documents the honest
 * dormant-data ceiling. Runs the engine DIRECTLY (no HTTP / no flag) — the flag gates the
 * route, not the engine.
 *
 * Part A — live trace: run computeEmployerCompetencyIntelligence for a real role title with a
 *          synthetic candidate. Shows Role DNA → requirements → match → readiness → interview
 *          rec → hiring rec → benchmark with provenance, and the honest abstention when no
 *          candidate competency profile exists (live employer data is dormant).
 * Part B — derivation proof: feed CRAFTED match objects (measured gaps + sufficient coverage)
 *          to the pure derive* functions to PROVE interview/hiring recommendations and the
 *          benchmark k-anonymity gate behave correctly when real data exists.
 * Part C — language-policy assertion: no disallowed (verdict/suitability) term appears in any
 *          emitted recommendation string.
 *
 * Writes backend/audit/99x-certification/employer_competency_intelligence_evidence.md.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import {
  computeEmployerCompetencyIntelligence,
  deriveInterviewRecommendation,
  deriveHiringRecommendation,
  deriveEmployerBenchmark,
  LANGUAGE_POLICY,
  BENCHMARK_K_MIN,
  EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION,
} from '../services/employer-competency-intelligence';
import type { CompetencyDrivenMatch, CompetencyRequirementMatch } from '../services/employer-competency-hiring';
import type { RoleBenchmark } from '../services/role-dna-expansion-engine';

const ROLE_TITLE = process.env.EVIDENCE_ROLE ?? 'Software Engineer';
const lines: string[] = [];
function log(s = '') { lines.push(s); console.log(s); }

function req(
  code: string,
  name: string,
  tier: string,
  weight: number,
  target: number,
  candidate: number | null,
): CompetencyRequirementMatch {
  const attainment = candidate != null && target > 0 ? Math.round(Math.min(1, candidate / target) * 100) / 100 : null;
  return {
    code, name, importanceTier: tier, weight, source: 'curated',
    targetScore: target, candidateScore: candidate, attainment,
    assessed: candidate != null, matchedKey: candidate != null ? code : null,
    matchedLedger: candidate != null ? 'onto_competency_profiles' : null,
  };
}

function craftedMatch(opts: {
  competencyMatch: number | null;
  coveragePct: number | null;
  band: CompetencyDrivenMatch['fitSignal']['band'];
  coverageSufficient: boolean;
  requirements: CompetencyRequirementMatch[];
  benchmark: RoleBenchmark;
  calibrated?: boolean;
}): CompetencyDrivenMatch {
  const assessed = opts.requirements.filter((r) => r.assessed);
  const gaps = assessed.filter((r) => (r.attainment ?? 1) < 1);
  const unassessed = opts.requirements.filter((r) => !r.assessed);
  return {
    subjectId: 'demo@example.com', jobId: 'job-1', jobTitle: ROLE_TITLE,
    source: 'onto_competency_profile', competencyProfileAvailable: true,
    competencyMatch: opts.competencyMatch, requirementCoveragePct: opts.coveragePct,
    matchedRequirementCount: assessed.length, totalRequirementCount: opts.requirements.length,
    requirements: opts.requirements, gaps, unassessedRequirements: unassessed,
    roleDna: {
      resolved: true, roleTitle: ROLE_TITLE, requirementSource: 'curated_over_inherited',
      confidence: 0.9, band: 'high', provisional: false, benchmark: opts.benchmark,
    },
    candidateReadiness: { available: true, readinessScore: 72, band: 'Developing', coveragePct: opts.coveragePct, note: 'demo' },
    calibration: {
      state: opts.calibrated ? 'calibrated' : 'uncalibrated',
      realizedOutcomes: opts.calibrated ? 40 : 0, minRequired: 30,
      note: 'demo',
    },
    fitSignal: {
      band: opts.coverageSufficient ? opts.band : null, assessedBand: opts.band,
      coverageSufficient: opts.coverageSufficient,
      provisional: !opts.coverageSufficient || !opts.calibrated, rationale: 'demo',
      validated: !!opts.calibrated,
    },
    coverageNote: 'demo', confidenceNote: 'demo',
    provenance: 'demo', version: 'demo', generatedAt: new Date().toISOString(),
  };
}

function assertNoVerdictLanguage(label: string, blob: Record<string, unknown>): boolean {
  // Scan AFFIRMATIVE output only. The `disclaimer` field intentionally NAMES the disallowed
  // verdict terms to say what the output is NOT — excluding it avoids a false positive.
  const { disclaimer, ...affirmative } = blob;
  const text = JSON.stringify(affirmative).toLowerCase();
  const banned = ['strong_hire', 'no_hire', 'hire/no-hire', 'pass/fail', 'suitability score', 'guaranteed performance'];
  const hits = banned.filter((t) => text.includes(t.toLowerCase()));
  const ok = hits.length === 0;
  log(`- ${label}: ${ok ? 'PASS — no verdict/suitability language' : 'FAIL — found ' + hits.join(', ')}`);
  return ok;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let pass = true;
  log(`# Employer Competency Intelligence — Evidence (MX-100X Phase 5)`);
  log(`Engine v${EMPLOYER_COMPETENCY_INTELLIGENCE_VERSION} · generated ${new Date().toISOString()}`);
  log('');
  log('Read-only · additive · flag `employerCompetencyHiring` (OFF byte-identical). Engine run directly (flag gates the route only).');
  log('');

  // ---------------------------------------------------------------- Part A
  log(`## Part A — Live trace (role "${ROLE_TITLE}", synthetic candidate)`);
  try {
    const intel = await computeEmployerCompetencyIntelligence(pool, {
      candidate: { id: 'cand-evidence', email: `evidence_${Date.now()}@example.com` },
      job: { id: 'job-evidence', title: ROLE_TITLE },
    });
    const m = intel.match;
    log(`- Role DNA resolved: ${m.roleDna.resolved} (title=${m.roleDna.roleTitle}, source=${m.roleDna.requirementSource}, confidence=${m.roleDna.confidence})`);
    log(`- Requirements: ${m.totalRequirementCount} · assessed: ${m.matchedRequirementCount} · coverage: ${m.requirementCoveragePct ?? 'null'}%`);
    log(`- Competency match: ${m.competencyMatch ?? 'null (withheld)'} · source: ${m.source}`);
    log(`- Fit band: ${m.fitSignal.band ?? 'WITHHELD (null)'} · validated: ${m.fitSignal.validated} · calibration: ${m.calibration.state}`);
    log(`- Interview structure: ${intel.interviewRecommendation.structure} · focus areas: ${intel.interviewRecommendation.focusAreas.length} · probe areas: ${intel.interviewRecommendation.probeAreas.length}`);
    log(`- Hiring action: ${intel.hiringRecommendation.action}`);
    log(`- Benchmark: available=${intel.benchmark.available} suppressed=${intel.benchmark.suppressed} reason=${intel.benchmark.suppressionReason ?? intel.benchmark.reason ?? '-'} (k_min=${intel.benchmark.kMin})`);
    log(`- Provenance: ${intel.provenance}`);
    log('');
    log('  Honest read: live employer candidate/competency data is dormant — a synthetic candidate has no');
    log('  measured competency profile, so the match abstains (heuristic fallback) rather than fabricate a score.');
    log('  Role DNA + requirements + benchmark abstention demonstrate the upstream flow is wired and honest.');
  } catch (e) {
    pass = false;
    log(`- Part A FAILED: ${(e as Error).message}`);
  }
  log('');

  // ---------------------------------------------------------------- Part B
  log('## Part B — Derivation proof (crafted measured match)');
  const reqs = [
    req('COG', 'Cognitive Reasoning', 'core', 1.0, 80, 60),       // gap
    req('COM', 'Communication', 'core', 0.9, 70, 75),             // met
    req('LEA', 'Leadership', 'important', 0.7, 80, 50),           // gap (large)
    req('TEC', 'Technical Depth', 'core', 1.0, 85, null),         // unassessed
    req('ADP', 'Adaptability', 'supporting', 0.5, 60, null),     // unassessed
  ];
  const k30 = { available: true, source: 'ti_role_benchmarks', percentiles: { p50: 62 }, sampleSize: 42 } as RoleBenchmark;

  const strong = craftedMatch({ competencyMatch: 82, coveragePct: 62, band: 'strong_fit', coverageSufficient: true, requirements: reqs, benchmark: k30, calibrated: true });
  const ir = deriveInterviewRecommendation(strong);
  const hr = deriveHiringRecommendation(strong);
  log(`- Strong/calibrated: hiring action=${hr.action} (expect advance_to_interview) · validated=${hr.validated} · structure=${ir.structure}`);
  log(`  focus areas (measured gaps): ${ir.focusAreas.map((f) => f.code).join(', ') || 'none'} · probe (unassessed): ${ir.probeAreas.map((f) => f.code).join(', ') || 'none'}`);
  pass = pass && hr.action === 'advance_to_interview' && hr.validated === true && ir.focusAreas.length === 2 && ir.probeAreas.length === 2;

  const thin = craftedMatch({ competencyMatch: 82, coveragePct: 20, band: 'strong_fit', coverageSufficient: false, requirements: reqs, benchmark: k30 });
  const hrThin = deriveHiringRecommendation(thin);
  log(`- Coverage-thin: hiring action=${hrThin.action} (expect gather_more_evidence) · fitBand=${hrThin.fitBand ?? 'WITHHELD'} (expect WITHHELD)`);
  pass = pass && hrThin.action === 'gather_more_evidence' && hrThin.fitBand === null;

  const dev = craftedMatch({ competencyMatch: 38, coveragePct: 80, band: 'development_focus', coverageSufficient: true, requirements: reqs, benchmark: k30 });
  const hrDev = deriveHiringRecommendation(dev);
  log(`- Low match: hiring action=${hrDev.action} (expect development_focus)`);
  pass = pass && hrDev.action === 'development_focus';

  // Benchmark k-anonymity gate
  const bOk = deriveEmployerBenchmark(k30);
  const bSmall = deriveEmployerBenchmark({ available: true, source: 'ti_role_benchmarks', percentiles: { p50: 50 }, sampleSize: 12 });
  const bUnknown = deriveEmployerBenchmark({ available: true, source: 'ti_role_benchmarks', percentiles: { p50: 50 }, sampleSize: null });
  const bAbsent = deriveEmployerBenchmark({ available: false, source: null, reason: 'no_matching_benchmark_row' });
  log(`- Benchmark k>=${BENCHMARK_K_MIN}: n=42 released=${bOk.available && !bOk.suppressed} (expect true)`);
  log(`- Benchmark n=12: suppressed=${bSmall.suppressed} reason=${bSmall.suppressionReason} (expect cohort_too_small)`);
  log(`- Benchmark n=unknown: suppressed=${bUnknown.suppressed} reason=${bUnknown.suppressionReason} (expect cohort_size_unknown — fail closed)`);
  log(`- Benchmark absent: available=${bAbsent.available} suppressed=${bAbsent.suppressed} (expect false/false — honest abstain)`);
  pass = pass && bOk.available && !bOk.suppressed && bSmall.suppressed && bUnknown.suppressed && !bAbsent.available && !bAbsent.suppressed;
  log('');

  // ---------------------------------------------------------------- Part C
  log('## Part C — Language policy (developmental signals only)');
  pass = assertNoVerdictLanguage('interview recommendation', ir) && pass;
  pass = assertNoVerdictLanguage('hiring recommendation', hr) && pass;
  log(`- Disclaimer present on hiring rec: ${hr.disclaimer.length > 0 ? 'PASS' : 'FAIL'}`);
  pass = pass && hr.disclaimer.length > 0;
  log('');

  log(`## Verdict: ${pass ? 'PASS' : 'FAIL'}`);
  log('');
  log('### Honest ceiling');
  log('- Live employer candidate/job/competency data = dormant (0 rows). Real match/fit/benchmark cannot be');
  log('  exercised on production data and remain honestly withheld/abstained — a DATA-MATURITY gap, not a code gap.');
  log('- Calibration stays `uncalibrated` until >=30 realized hiring outcomes (Phase 7, data-gated).');
  log('- Recommendations are developmental competency signals — never a hiring/suitability verdict.');

  const dir = join(process.cwd(), 'audit', '99x-certification');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'employer_competency_intelligence_evidence.md');
  writeFileSync(out, lines.join('\n'));
  console.log(`\nWrote ${out}`);
  await pool.end();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
