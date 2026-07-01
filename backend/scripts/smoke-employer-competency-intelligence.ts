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
 * 3. comp_* → dom_* crosswalk REGRESSION GUARD (Task 125): given a MEASURABLE candidate
 *    (a purgeable @example.com domain-granularity profile seeded for this run), the REAL
 *    `computeCompetencyDrivenMatch` MUST keep employer match coverage > 0 — non-null
 *    competencyMatch, requirementCoveragePct > 0, source `onto_competency_profile` (not the
 *    heuristic fallback), and at least one requirement matched via the labelled domain-proxy
 *    (matchVia='domain_proxy', matchedLedger carries the `(domain_proxy)` suffix). A negative
 *    control (subject with NO profile) must still abstain → heuristic_fallback / null match,
 *    proving the >0 assertion is not vacuously true. Needs DATABASE_URL + the onto_* genome;
 *    absent substrate is reported as a SKIP (honest), never a silent pass.
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import {
  deriveInterviewRecommendation,
  deriveHiringRecommendation,
  deriveEmployerBenchmark,
  BENCHMARK_K_MIN,
} from '../services/employer-competency-intelligence';
import {
  computeCompetencyDrivenMatch,
  type CompetencyDrivenMatch,
  type CompetencyRequirementMatch,
} from '../services/employer-competency-hiring';
import { generateRoleDNA, type RoleBenchmark } from '../services/role-dna-expansion-engine';

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
    matchVia: cand != null ? 'direct_competency' : null,
  };
}

function match(coverageSufficient: boolean, band: CompetencyDrivenMatch['fitSignal']['band'], bm: RoleBenchmark): CompetencyDrivenMatch {
  const reqs = [reqRow('A', 1, 80, 60), reqRow('B', 0.8, 70, null)];
  return {
    subjectId: 'demo@example.com', jobId: 'j', jobTitle: 'Role', source: 'onto_competency_profile',
    competencyProfileAvailable: true, competencyMatch: 70, requirementCoveragePct: coverageSufficient ? 60 : 20,
    matchedRequirementCount: 1, directMatchCount: 1, domainProxyMatchCount: 0,
    totalRequirementCount: 2, requirements: reqs,
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

const skip = (msg: string) => console.log(`SKIP — ${msg}`);

/** Read the live `employerCompetencyHiring` flag from the gated readback route.
 *  503 → flag OFF (the gate itself is flagged); ok+true → ON; unreachable → 'unknown'. */
async function employerFlagState(): Promise<'on' | 'off' | 'unknown'> {
  try {
    const r = await fetch(`${BASE}/api/v2/employer/competency-match/feature-flag`);
    if (r.status === 503) return 'off';
    if (r.ok) {
      const j: any = await r.json().catch(() => null);
      return j?.feature_flag?.employerCompetencyHiring ? 'on' : 'off';
    }
    return 'unknown';
  } catch { return 'unknown'; }
}

/**
 * Task 125 — comp_* → dom_* crosswalk regression guard. Seeds a purgeable
 * @example.com DOMAIN-granularity competency profile (the exact shape the runtime
 * scorer writes), runs the REAL computeCompetencyDrivenMatch, and asserts the
 * domain-proxy crosswalk keeps employer match coverage > 0. Self-cleaning.
 */
async function crosswalkRegression(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    skip('crosswalk regression — DATABASE_URL not set (cannot seed a measurable candidate)');
    return;
  }
  // 'Product Manager' resolves to curated onto_* requirements whose comp_* codes carry a
  // domain_id, so the candidate's domain scores can stand in via the domain-proxy crosswalk.
  const ROLE_TITLE = 'Product Manager';
  const SUBJECT = 'task125.match-coverage@example.com';
  const ABSENT_SUBJECT = 'task125.no-profile@example.com';
  const pool = new Pool({ connectionString: databaseUrl });

  const cleanup = async () => {
    // Delete profiles first (they FK onto onto_assessment_instances), then the instance + runs.
    await pool.query('DELETE FROM onto_competency_profiles WHERE subject_id = ANY($1::text[])', [[SUBJECT, ABSENT_SUBJECT]]).catch(() => {});
    await pool.query("DELETE FROM onto_assessment_instances WHERE subject_id = ANY($1::text[]) AND source = 'task125_smoke'", [[SUBJECT, ABSENT_SUBJECT]]).catch(() => {});
    await pool.query('DELETE FROM onto_competency_score_runs WHERE subject_id = ANY($1::text[])', [[SUBJECT, ABSENT_SUBJECT]]).catch(() => {});
  };

  try {
    const dna = await generateRoleDNA(pool, ROLE_TITLE);
    const reqs = dna.requirements ?? [];
    if (!reqs.length) {
      skip(`crosswalk regression — role DNA for "${ROLE_TITLE}" resolved 0 requirements (genome not seeded)`);
      return;
    }
    // Map the role's requirement comp_* codes to their onto-domains (the live crosswalk source).
    const codes = reqs.map((r) => String(r.code));
    let domainIds: string[] = [];
    if (await tableHas(pool, 'onto_competencies')) {
      const { rows } = await pool.query(
        'SELECT DISTINCT domain_id FROM onto_competencies WHERE id = ANY($1::text[]) AND domain_id IS NOT NULL',
        [codes],
      );
      domainIds = rows.map((r: any) => String(r.domain_id)).filter(Boolean);
    }
    if (!domainIds.length) {
      skip(`crosswalk regression — no comp_* → dom_* crosswalk rows for "${ROLE_TITLE}" (cannot exercise domain-proxy)`);
      return;
    }

    // Start clean, then seed a MEASURABLE domain-granularity profile (the runtime scorer's shape).
    await cleanup();
    const profile = domainIds.map((dom, i) => ({
      onto_domain: dom,
      label: dom,
      scaled_score: 85,           // measured, strong — so attainment is real, never fabricated
      level: 4,
      question_count: 5 + i,
    }));
    // onto_competency_profiles.instance_id FKs onto_assessment_instances → seed a minimal
    // purgeable instance first and reference its id (a bare random UUID violates the FK).
    const inst = await pool.query(
      `INSERT INTO onto_assessment_instances (id, blueprint_id, subject_id, status, total_questions, source)
       VALUES ($1,$2,$3,'scored',$4,'task125_smoke') RETURNING id`,
      [randomUUID(), 'task125_smoke', SUBJECT, profile.length],
    );
    const instanceId = String(inst.rows[0].id);
    await pool.query(
      `INSERT INTO onto_competency_profiles
         (subject_id, instance_id, blueprint_id, role_id, overall_score, overall_level, profile, coverage, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW())`,
      [
        SUBJECT, instanceId, 'task125_smoke', null, 85, 4,
        JSON.stringify(profile),
        JSON.stringify({ notes: ['Task 125 smoke — purgeable @example.com measurable candidate.'], domains_requested: domainIds }),
      ],
    );

    // Run the REAL engine the HTTP route composes — no synthetic match object here.
    const m = await computeCompetencyDrivenMatch(pool, {
      candidate: { email: SUBJECT },
      job: { id: 'task125_smoke_job', title: ROLE_TITLE },
    });

    note(m.source === 'onto_competency_profile',
      `measurable candidate → source onto_competency_profile (got ${m.source})`);
    note(m.competencyMatch != null,
      `measurable candidate → non-null competencyMatch (got ${m.competencyMatch})`);
    note((m.requirementCoveragePct ?? 0) > 0,
      `measurable candidate → requirementCoveragePct > 0 (got ${m.requirementCoveragePct})`);
    note(m.matchedRequirementCount > 0,
      `measurable candidate → matchedRequirementCount > 0 (got ${m.matchedRequirementCount})`);
    note(m.domainProxyMatchCount > 0,
      `domain-proxy crosswalk fired → domainProxyMatchCount > 0 (got ${m.domainProxyMatchCount})`);
    const proxied: CompetencyRequirementMatch[] = m.requirements.filter((r) => r.matchVia === 'domain_proxy');
    note(proxied.length > 0 && proxied.every((r) => /\(domain_proxy\)/.test(String(r.matchedLedger ?? ''))),
      `domain-proxy matches carry matchVia='domain_proxy' + labelled matchedLedger (got ${proxied.length})`);

    // Negative control — a subject with NO profile MUST abstain, proving >0 is not vacuous.
    const none = await computeCompetencyDrivenMatch(pool, {
      candidate: { email: ABSENT_SUBJECT },
      job: { id: 'task125_smoke_job', title: ROLE_TITLE },
    });
    note(none.source === 'heuristic_fallback' && none.competencyMatch === null && (none.requirementCoveragePct ?? 0) === 0,
      `negative control (no profile) → heuristic_fallback + null match + 0 coverage (got ${none.source}/${none.competencyMatch}/${none.requirementCoveragePct})`);
  } catch (e: any) {
    note(false, `crosswalk regression threw: ${String(e?.message ?? e).slice(0, 160)}`);
  } finally {
    await cleanup();
    await pool.end();
  }
}

async function tableHas(pool: Pool, table: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [table]);
    return !!rows[0]?.reg;
  } catch { return false; }
}

async function main() {
  console.log('# Smoke — Employer Competency Intelligence (Phase 5)\n');

  // 1. HTTP gate contract. The flag state of the RUNNING workflow decides the response to an
  //    UNAUTHENTICATED caller (gating order is flag → auth):
  //      - flag OFF → the flag gate fires first → 503 (byte-identical legacy contract)
  //      - flag ON  → route reachable but auth-gated → 401/403 (a global auth gate intercepts;
  //                   note: that gate's envelope differs from the route's own 401)
  //    Either way an anon caller must NEVER receive a 200 with data. We read the live flag so the
  //    smoke is honest in either workflow configuration rather than assuming one.
  const fstate = await employerFlagState();
  const sIntel = await code('/api/v2/employer/competency-match/x/y/intelligence');
  const sMatch = await code('/api/v2/employer/competency-match/x/y');
  if (fstate === 'off') {
    note(sIntel === 503, `flag-OFF /intelligence → 503 (got ${sIntel})`);
    note(sMatch === 503, `flag-OFF /match → 503 (got ${sMatch})`);
  } else if (fstate === 'on') {
    note([401, 403].includes(sIntel), `flag-ON /intelligence → auth-gated 401/403, never anon 200 (got ${sIntel})`);
    note([401, 403].includes(sMatch), `flag-ON /match → auth-gated 401/403, never anon 200 (got ${sMatch})`);
  } else {
    skip('HTTP gate contract — Backend API not reachable (start the workflow to assert the gate)');
  }

  // 2. Service guards.
  const k30: RoleBenchmark = { available: true, source: 'ti_role_benchmarks', percentiles: { p50: 60 }, sampleSize: 40 };
  const ok = match(true, 'strong_fit', k30);
  const ir = deriveInterviewRecommendation(ok);
  const hr = deriveHiringRecommendation(ok);
  const affirmative = JSON.stringify({ ...hr, disclaimer: undefined, ...ir }).toLowerCase();
  note(!/strong_hire|no_hire|hire\/no-hire|pass\/fail|suitability score/.test(affirmative), 'no verdict/suitability language in affirmative output');
  note(hr.disclaimer.length > 0 && /not a hiring/i.test(hr.disclaimer), 'hiring rec carries non-verdict disclaimer');

  // Branch-exhaustive no-verdict guard: EVERY action branch's affirmative fields (all fields
  // EXCEPT the disclaimer) must stay free of hire/no-hire / suitability verdict language.
  const VERDICT_RE = /(hire\/no-hire|no[-_\s]?hire|strong[-_\s]?hire|pass\/fail|pass or fail|suitability|\bsuitable\b|\bunsuitable\b|guaranteed performance|validated hiring prediction)/i;
  const branchMatches: Array<[string, CompetencyDrivenMatch]> = [
    ['strong_fit+sufficient', match(true, 'strong_fit', k30)],
    ['fit+sufficient', match(true, 'fit', k30)],
    ['conditional+sufficient', match(true, 'conditional', k30)],
    ['unlikely_fit+sufficient', match(true, 'unlikely_fit', k30)],
    ['coverage-thin', match(false, 'strong_fit', k30)],
  ];
  for (const [label, m] of branchMatches) {
    const rec = deriveHiringRecommendation(m);
    const { disclaimer: _d, ...aff } = rec;
    note(!VERDICT_RE.test(JSON.stringify(aff).toLowerCase()), `no verdict language in affirmative fields — ${label} (action ${rec.action})`);
  }
  // Insufficient-evidence branch (no competency profile) — build a null-match directly.
  {
    const noProfile: CompetencyDrivenMatch = { ...match(true, 'strong_fit', k30), competencyProfileAvailable: false, competencyMatch: null };
    const rec = deriveHiringRecommendation(noProfile);
    const { disclaimer: _d, ...aff } = rec;
    note(rec.action === 'insufficient_competency_evidence' && !VERDICT_RE.test(JSON.stringify(aff).toLowerCase()),
      `no verdict language in affirmative fields — no-profile (action ${rec.action})`);
  }
  note(hr.action === 'advance_to_interview', `strong+sufficient → advance_to_interview (got ${hr.action})`);
  note(ir.focusAreas.length === 1 && ir.probeAreas.length === 1, 'interview rec surfaces measured gap + unassessed probe');

  const thin = deriveHiringRecommendation(match(false, 'strong_fit', k30));
  note(thin.action === 'gather_more_evidence' && thin.fitBand === null, 'coverage-thin → gather_more_evidence + WITHHELD fit (no fabrication)');

  note(deriveEmployerBenchmark(k30).available && !deriveEmployerBenchmark(k30).suppressed, `benchmark n=40 (>=${BENCHMARK_K_MIN}) released`);
  note(deriveEmployerBenchmark({ available: true, source: 's', percentiles: {}, sampleSize: 5 }).suppressed, 'benchmark n=5 suppressed (k-anonymity)');
  note(deriveEmployerBenchmark({ available: true, source: 's', percentiles: {}, sampleSize: null }).suppressed, 'benchmark unknown cohort suppressed (fail closed)');
  note(!deriveEmployerBenchmark({ available: false, source: null, reason: 'none' }).suppressed && !deriveEmployerBenchmark({ available: false, source: null, reason: 'none' }).available, 'benchmark absent → honest abstain (not suppressed)');

  // 3. comp_* → dom_* crosswalk regression guard (Task 125).
  await crosswalkRegression();

  console.log(`\n${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
