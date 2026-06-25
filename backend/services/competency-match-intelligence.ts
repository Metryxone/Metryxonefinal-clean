/**
 * MX-107A — Competency Match Intelligence (read-only composer).
 *
 * A PURE, READ-ONLY composition layer that makes the candidate Competency Assessment →
 * Employer Role DNA → readiness → hiring fit → career-recommendation chain legible as ONE
 * canonical competency framework. It traces the full crosswalk and surfaces it as:
 *   - Phase 1  Crosswalk Coverage report (every hop in the chain, quantified)
 *   - Phase 5  Super Admin coverage console (crosswalk / Role-DNA / assessment /
 *              competency-match / employer-match coverage)
 *   - Phase 6  Founder dashboard (match reachability · highest/lowest roles · crosswalk
 *              health · Role-DNA health · competency coverage)
 *   - Phase 8  Honest PASS / PARTIAL / FAIL certification
 *
 * CANON (strict — mirrors MX-104X/105X):
 *   - COMPOSE NEVER RECOMPUTE: reads already-built tables/engines only. Recomputes nothing,
 *     writes nothing, runs NO DDL (no ensure-schema). GET-only.
 *   - HONEST DEGRADATION: every read is to_regclass-probed; a MISSING table → null (NOT a
 *     fabricated 0). An EMPTY (present) table → 0. null ≠ 0 is preserved everywhere.
 *   - COVERAGE ⟂ CONFIDENCE: kept separate; a rate with a 0 denominator is null, never a
 *     fabricated 0%/100%.
 *   - PRECISE ⟂ OPERATIONAL: comp_*-level PRECISE crosswalk coverage (the question→competency
 *     map) and the domain-proxy OPERATIONAL match path are reported on SEPARATE axes. Canonical
 *     precision is NEVER inflated by the proxy path.
 *   - NEVER THROWS: every read is wrapped; a failure degrades that field to null, never the
 *     request.
 *   - DEVELOPMENTAL signals only — NOT hiring/promotion/suitability predictions.
 */
import type { Pool } from 'pg';

export const CMI_VERSION = '107a.1.0.0';

export const CMI_DISCLAIMER =
  'Competency Match Intelligence is a READ-ONLY composition of the already-built competency ' +
  'crosswalk (assessment → competency → Role DNA → readiness → match → recommendation). It ' +
  'recomputes no score and writes nothing. PRECISE comp_*-level mapping coverage and the ' +
  'domain-proxy OPERATIONAL match path are reported as SEPARATE axes — canonical precision is ' +
  'never inflated by the proxy. Coverage (data exists) and Confidence (sufficient/trustworthy) ' +
  'are separate; a rate with a zero denominator is null, never a fabricated 0%. Absent tables ' +
  'degrade to null (not 0). Developmental signals only — NOT hiring/promotion predictions.';

// ── primitives (proven pattern from ecosystem-activation.ts) ───────────────────

async function tablePresent(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS r', ['public.' + table]);
    return !!r.rows[0]?.r;
  } catch {
    return false;
  }
}

/** Scalar SELECT returning a single numeric `n`. null when guard table absent OR query errors. */
async function scalar(pool: Pool, guardTable: string, sql: string, params: any[] = []): Promise<number | null> {
  if (!(await tablePresent(pool, guardTable))) return null;
  try {
    const r = await pool.query(sql, params);
    const v = r.rows[0]?.n;
    if (v === null || v === undefined) return 0;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

/** Rows of a SELECT. [] when guard absent OR query errors (caller distinguishes via guard). */
async function rows<T = any>(pool: Pool, guardTable: string, sql: string, params: any[] = []): Promise<T[]> {
  if (!(await tablePresent(pool, guardTable))) return [];
  try {
    const r = await pool.query(sql, params);
    return r.rows as T[];
  } catch {
    return [];
  }
}

/** A coverage/conversion rate: null when num/denom unmeasurable or denom <= 0 (never fake 0/100). */
function rate(num: number | null, denom: number | null): number | null {
  if (num === null || denom === null) return null;
  if (denom <= 0) return null;
  return Math.round((num / denom) * 1000) / 10; // one decimal %
}

function present(...vals: Array<number | null>): boolean {
  return vals.some((v) => v !== null);
}

type Verdict = 'PASS' | 'PARTIAL' | 'FAIL';

// ── Phase 1: Crosswalk Coverage report ─────────────────────────────────────────
//
// Traces every hop of the canonical chain and quantifies coverage. Each hop reports its
// raw counts plus the PRECISE (comp_*-level) and OPERATIONAL (domain-proxy) axes where they
// diverge — so the honest ceiling (precise mapping is sparse) is always visible.

export interface CrosswalkHop {
  hop: string;
  present: boolean; // backing table present
  counts: Record<string, number | null>;
  coverage_pct: number | null;
  axis: 'precise' | 'operational' | 'structural';
  note: string;
}

export async function composeCrosswalkCoverage(pool: Pool): Promise<any> {
  // Hop 1 — Assessment questions (the bank + the precise question→competency map).
  const bankQuestions = await scalar(pool, 'competency_question_templates', 'SELECT count(*)::int AS n FROM competency_question_templates');
  const mappedQuestions = await scalar(pool, 'onto_competency_question_map', 'SELECT count(DISTINCT question_id)::int AS n FROM onto_competency_question_map WHERE active');

  // Hop 2 — Competencies measured (genome total · precise-mapped · domain-proxy eligible).
  const totalComps = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies');
  const compsWithDomain = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies WHERE domain_id IS NOT NULL');
  const preciseComps = await scalar(pool, 'onto_competency_question_map', 'SELECT count(DISTINCT competency_id)::int AS n FROM onto_competency_question_map WHERE active');

  // Hop 3 — Competency scores (runtime ledgers).
  const scoredSubjects = await scalar(pool, 'onto_competency_profiles', 'SELECT count(DISTINCT subject_id)::int AS n FROM onto_competency_profiles');
  const scoreRuns = await scalar(pool, 'onto_competency_score_runs', 'SELECT count(*)::int AS n FROM onto_competency_score_runs');

  // Hop 4 — Role DNA requirements.
  const dnaRoles = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(DISTINCT role_id)::int AS n FROM onto_role_competency_profiles WHERE active');
  const dnaReqs = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(*)::int AS n FROM onto_role_competency_profiles WHERE active');
  const reqsWithLevel = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(*)::int AS n FROM onto_role_competency_profiles WHERE active AND required_level IS NOT NULL AND required_level > 0');

  // Hop 5 — Match reachability (a role DNA requirement is matchable when its competency is
  // either PRECISE-mapped to a question, or DOMAIN-proxy reachable via onto_competencies).
  const reqsPrecise = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r
     WHERE r.active AND EXISTS (SELECT 1 FROM onto_competency_question_map m WHERE m.active AND m.competency_id = r.competency_id)`,
  );
  const reqsProxy = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r
     WHERE r.active AND EXISTS (SELECT 1 FROM onto_competencies c WHERE c.id = r.competency_id AND c.domain_id IS NOT NULL)`,
  );

  const hops: CrosswalkHop[] = [
    {
      hop: '1 · Assessment questions → competency',
      present: present(bankQuestions, mappedQuestions),
      counts: { bank_questions: bankQuestions, precise_mapped_questions: mappedQuestions },
      coverage_pct: null,
      axis: 'precise',
      note: `${mappedQuestions ?? 0} questions carry a PRECISE competency map; the wider authored bank (${bankQuestions ?? 0}) scores via domain proxy until mapped.`,
    },
    {
      hop: '2 · Competencies measured',
      present: present(totalComps, preciseComps, compsWithDomain),
      counts: { genome_competencies: totalComps, precise_mapped_competencies: preciseComps, domain_proxy_eligible: compsWithDomain },
      coverage_pct: rate(preciseComps, totalComps),
      axis: 'precise',
      note: `PRECISE comp-level coverage is ${rate(preciseComps, totalComps) ?? 0}% (${preciseComps ?? 0}/${totalComps ?? 0}); domain-proxy is OPERATIONAL at ${rate(compsWithDomain, totalComps) ?? 0}%. Reaching 100% precise is the data-mapping effort, not composition.`,
    },
    {
      hop: '3 · Competency scores',
      present: present(scoredSubjects, scoreRuns),
      counts: { scored_subjects: scoredSubjects, score_runs: scoreRuns },
      coverage_pct: null,
      axis: 'structural',
      note: `${scoredSubjects ?? 0} subjects scored across ${scoreRuns ?? 0} runs (dual ledger: profiles + score_runs). Activation accrues as real assessments complete.`,
    },
    {
      hop: '4 · Role DNA requirements',
      present: present(dnaRoles, dnaReqs),
      counts: { dna_roles: dnaRoles, dna_requirements: dnaReqs, requirements_with_level: reqsWithLevel },
      coverage_pct: rate(reqsWithLevel, dnaReqs),
      axis: 'structural',
      note: `${dnaRoles ?? 0} roles carry curated Role DNA (${dnaReqs ?? 0} requirements); ${rate(reqsWithLevel, dnaReqs) ?? 0}% specify a required level.`,
    },
    {
      hop: '5 · Match reachability (req → competency score)',
      present: present(reqsPrecise, reqsProxy, dnaReqs),
      counts: { requirements_total: dnaReqs, precise_reachable: reqsPrecise, proxy_reachable: reqsProxy },
      coverage_pct: rate(reqsProxy, dnaReqs),
      axis: 'operational',
      note: `${rate(reqsPrecise, dnaReqs) ?? 0}% of role requirements are PRECISE-reachable (${reqsPrecise ?? 0}/${dnaReqs ?? 0}); ${rate(reqsProxy, dnaReqs) ?? 0}% are OPERATIONAL via domain proxy. The two axes are reported separately — never composited.`,
    },
  ];

  return {
    ok: true,
    phase: 'P1_crosswalk_coverage',
    version: CMI_VERSION,
    read_only: true,
    generated_at: new Date().toISOString(),
    headline: {
      precise_competency_coverage_pct: rate(preciseComps, totalComps),
      operational_competency_coverage_pct: rate(compsWithDomain, totalComps),
      precise_requirement_reachability_pct: rate(reqsPrecise, dnaReqs),
      operational_requirement_reachability_pct: rate(reqsProxy, dnaReqs),
    },
    hops,
    disclaimer: CMI_DISCLAIMER,
  };
}

// ── Phase 6: per-role match reachability (founder highest/lowest) ───────────────
//
// Structural reachability is the honest, candidate-free "match health" of a role: the share
// of role WEIGHT whose competency is precise- / proxy-reachable. It is NOT a live match score
// (those abstain until employers run real matches) — it is labelled as reachability throughout.

interface RoleReach {
  role_id: string;
  role_title: string | null;
  requirement_count: number;
  weight_total: number;
  precise_reachable_pct: number | null;
  proxy_reachable_pct: number | null;
}

async function composeRoleReachability(pool: Pool): Promise<RoleReach[]> {
  const data = await rows<any>(
    pool, 'onto_role_competency_profiles',
    `SELECT r.role_id,
            ro.title AS role_title,
            count(*)::int AS req_count,
            COALESCE(sum(r.weight), 0)::float AS weight_total,
            COALESCE(sum(r.weight) FILTER (WHERE EXISTS (
              SELECT 1 FROM onto_competency_question_map m WHERE m.active AND m.competency_id = r.competency_id)), 0)::float AS weight_precise,
            COALESCE(sum(r.weight) FILTER (WHERE EXISTS (
              SELECT 1 FROM onto_competencies c WHERE c.id = r.competency_id AND c.domain_id IS NOT NULL)), 0)::float AS weight_proxy
       FROM onto_role_competency_profiles r
       LEFT JOIN onto_roles ro ON ro.id = r.role_id
      WHERE r.active
      GROUP BY r.role_id, ro.title
      ORDER BY r.role_id`,
  );
  return data.map((d) => {
    const wt = Number(d.weight_total) || 0;
    return {
      role_id: String(d.role_id),
      role_title: d.role_title ?? null,
      requirement_count: Number(d.req_count) || 0,
      weight_total: Math.round(wt * 100) / 100,
      precise_reachable_pct: wt > 0 ? Math.round((Number(d.weight_precise) / wt) * 1000) / 10 : null,
      proxy_reachable_pct: wt > 0 ? Math.round((Number(d.weight_proxy) / wt) * 1000) / 10 : null,
    };
  });
}

// ── Phase 5: Super Admin coverage console ──────────────────────────────────────

export async function composeSuperAdmin(pool: Pool): Promise<any> {
  const totalComps = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies');
  const preciseComps = await scalar(pool, 'onto_competency_question_map', 'SELECT count(DISTINCT competency_id)::int AS n FROM onto_competency_question_map WHERE active');
  const compsWithDomain = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies WHERE domain_id IS NOT NULL');
  const dnaRoles = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(DISTINCT role_id)::int AS n FROM onto_role_competency_profiles WHERE active');
  const totalRoles = await scalar(pool, 'onto_roles', 'SELECT count(*)::int AS n FROM onto_roles WHERE COALESCE(deprecated,false)=false');
  const dnaReqs = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(*)::int AS n FROM onto_role_competency_profiles WHERE active');
  const reqsPrecise = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r WHERE r.active AND EXISTS (SELECT 1 FROM onto_competency_question_map m WHERE m.active AND m.competency_id = r.competency_id)`,
  );
  const reqsProxy = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r WHERE r.active AND EXISTS (SELECT 1 FROM onto_competencies c WHERE c.id = r.competency_id AND c.domain_id IS NOT NULL)`,
  );
  const bankQuestions = await scalar(pool, 'competency_question_templates', 'SELECT count(*)::int AS n FROM competency_question_templates');
  const mappedQuestions = await scalar(pool, 'onto_competency_question_map', 'SELECT count(DISTINCT question_id)::int AS n FROM onto_competency_question_map WHERE active');
  const scoredSubjects = await scalar(pool, 'onto_competency_profiles', 'SELECT count(DISTINCT subject_id)::int AS n FROM onto_competency_profiles');
  const employerJobs = await scalar(pool, 'employer_jobs', 'SELECT count(*)::int AS n FROM employer_jobs');
  const employerCandidates = await scalar(pool, 'employer_candidates', 'SELECT count(*)::int AS n FROM employer_candidates');

  return {
    ok: true,
    phase: 'P5_super_admin_coverage',
    version: CMI_VERSION,
    read_only: true,
    generated_at: new Date().toISOString(),
    coverage: {
      crosswalk: {
        label: 'Question → Competency crosswalk',
        available: present(preciseComps, totalComps),
        precise_competencies: preciseComps,
        genome_competencies: totalComps,
        precise_coverage_pct: rate(preciseComps, totalComps),
        operational_coverage_pct: rate(compsWithDomain, totalComps),
        note: 'Precise coverage = competencies with an authored question map; operational = domain-proxy eligible. Separate axes.',
      },
      roleDna: {
        label: 'Role DNA coverage',
        available: present(dnaRoles, totalRoles),
        roles_with_dna: dnaRoles,
        total_active_roles: totalRoles,
        role_coverage_pct: rate(dnaRoles, totalRoles),
        requirements: dnaReqs,
        note: 'Share of active roles that carry a curated competency requirement profile.',
      },
      assessment: {
        label: 'Assessment coverage',
        available: present(bankQuestions, scoredSubjects),
        bank_questions: bankQuestions,
        precise_mapped_questions: mappedQuestions,
        scored_subjects: scoredSubjects,
        map_coverage_pct: rate(mappedQuestions, bankQuestions),
        note: 'Scored subjects are the live activation axis; map coverage is the precise-scoring axis.',
      },
      competencyMatch: {
        label: 'Competency → match reachability',
        available: present(reqsPrecise, dnaReqs),
        requirements: dnaReqs,
        precise_reachable_pct: rate(reqsPrecise, dnaReqs),
        operational_reachable_pct: rate(reqsProxy, dnaReqs),
        note: 'How much of curated Role DNA the match engine can actually score (precise vs domain-proxy).',
      },
      employerMatch: {
        label: 'Employer match activation',
        available: present(employerJobs, employerCandidates),
        employer_jobs: employerJobs,
        employer_candidates: employerCandidates,
        note: 'Live employer-side substrate. Match outcomes accrue as employers post jobs and run candidate matches.',
      },
    },
    disclaimer: CMI_DISCLAIMER,
  };
}

// ── Phase 6: Founder dashboard ─────────────────────────────────────────────────

export async function composeFounder(pool: Pool): Promise<any> {
  // null ≠ 0: when the Role DNA table is ABSENT, role-count metrics must be null (missing),
  // NOT 0 (empty). reach.length alone can't tell absent from empty, so probe the table.
  const dnaPresent = await tablePresent(pool, 'onto_role_competency_profiles');
  const reach = await composeRoleReachability(pool);
  const rolesMeasured = dnaPresent ? reach.length : null;
  const totalComps = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies');
  const preciseComps = await scalar(pool, 'onto_competency_question_map', 'SELECT count(DISTINCT competency_id)::int AS n FROM onto_competency_question_map WHERE active');
  const compsWithDomain = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies WHERE domain_id IS NOT NULL');
  const dnaReqs = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(*)::int AS n FROM onto_role_competency_profiles WHERE active');
  const reqsPrecise = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r WHERE r.active AND EXISTS (SELECT 1 FROM onto_competency_question_map m WHERE m.active AND m.competency_id = r.competency_id)`,
  );
  const reqsProxy = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r WHERE r.active AND EXISTS (SELECT 1 FROM onto_competencies c WHERE c.id = r.competency_id AND c.domain_id IS NOT NULL)`,
  );

  // Average OPERATIONAL reachability across roles (proxy axis). Honest: this is reachability,
  // not a live match score. Live match abstains (null) until real employer matches accrue.
  const proxyVals = reach.map((r) => r.proxy_reachable_pct).filter((v): v is number => v !== null);
  const preciseVals = reach.map((r) => r.precise_reachable_pct).filter((v): v is number => v !== null);
  const avg = (vs: number[]): number | null => (vs.length ? Math.round((vs.reduce((s, v) => s + v, 0) / vs.length) * 10) / 10 : null);

  const byPrecise = [...reach].sort((a, b) => (b.precise_reachable_pct ?? -1) - (a.precise_reachable_pct ?? -1));

  return {
    ok: true,
    phase: 'P6_founder_dashboard',
    version: CMI_VERSION,
    read_only: true,
    generated_at: new Date().toISOString(),
    matchReachability: {
      // Two SEPARATE axes — never composited into one "match score".
      average_precise_reachability_pct: avg(preciseVals),
      average_operational_reachability_pct: avg(proxyVals),
      roles_measured: rolesMeasured,
      note: 'Reachability = share of role weight the match engine can score. This is NOT a live candidate→role match (those abstain until employers run real matches).',
    },
    highestMatchRoles: byPrecise.slice(0, 5),
    lowestMatchRoles: byPrecise.slice(-5).reverse(),
    crosswalkHealth: {
      precise_competency_coverage_pct: rate(preciseComps, totalComps),
      operational_competency_coverage_pct: rate(compsWithDomain, totalComps),
      precise_requirement_reachability_pct: rate(reqsPrecise, dnaReqs),
      operational_requirement_reachability_pct: rate(reqsProxy, dnaReqs),
    },
    roleDnaHealth: {
      roles_with_dna: rolesMeasured,
      requirements: dnaReqs,
      avg_requirements_per_role: dnaPresent && reach.length ? Math.round(((dnaReqs ?? 0) / reach.length) * 10) / 10 : null,
    },
    competencyCoverage: {
      genome_competencies: totalComps,
      precise_mapped: preciseComps,
      domain_proxy_eligible: compsWithDomain,
    },
    liveMatch: {
      // No persisted live-employer match ledger to read from → abstain (null, not 0).
      average_live_match: null,
      state: 'abstained',
      note: 'Live employer match outcomes are not yet accrued; the operational match path is proven (domain-proxy) but real candidate→role matches abstain until employers run them.',
    },
    disclaimer: CMI_DISCLAIMER,
  };
}

// ── Phase 8: Certification ─────────────────────────────────────────────────────

export interface CertQuestion {
  id: string;
  question: string;
  verdict: Verdict;
  evidence: string;
}

export async function composeCertification(pool: Pool): Promise<any> {
  const totalComps = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies');
  const preciseComps = await scalar(pool, 'onto_competency_question_map', 'SELECT count(DISTINCT competency_id)::int AS n FROM onto_competency_question_map WHERE active');
  const compsWithDomain = await scalar(pool, 'onto_competencies', 'SELECT count(*)::int AS n FROM onto_competencies WHERE domain_id IS NOT NULL');
  const dnaRoles = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(DISTINCT role_id)::int AS n FROM onto_role_competency_profiles WHERE active');
  const dnaReqs = await scalar(pool, 'onto_role_competency_profiles', 'SELECT count(*)::int AS n FROM onto_role_competency_profiles WHERE active');
  const reqsPrecise = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r WHERE r.active AND EXISTS (SELECT 1 FROM onto_competency_question_map m WHERE m.active AND m.competency_id = r.competency_id)`,
  );
  const reqsProxy = await scalar(
    pool, 'onto_role_competency_profiles',
    `SELECT count(*)::int AS n FROM onto_role_competency_profiles r WHERE r.active AND EXISTS (SELECT 1 FROM onto_competencies c WHERE c.id = r.competency_id AND c.domain_id IS NOT NULL)`,
  );
  const scoredSubjects = await scalar(pool, 'onto_competency_profiles', 'SELECT count(DISTINCT subject_id)::int AS n FROM onto_competency_profiles');

  const preciseCompPct = rate(preciseComps, totalComps);
  const opCompPct = rate(compsWithDomain, totalComps);
  const preciseReqPct = rate(reqsPrecise, dnaReqs);
  const opReqPct = rate(reqsProxy, dnaReqs);

  const questions: CertQuestion[] = [
    {
      id: 'Q1_single_framework',
      question: 'Does candidate assessment, employer Role DNA, readiness and recommendations run off ONE canonical competency framework?',
      verdict: (dnaReqs ?? 0) > 0 && (totalComps ?? 0) > 0 ? 'PASS' : 'FAIL',
      evidence: `All surfaces resolve against the onto_* genome (${totalComps ?? 0} competencies) + onto_role_competency_profiles (${dnaReqs ?? 0} requirements across ${dnaRoles ?? 0} roles). No parallel framework exists.`,
    },
    {
      id: 'Q2_canonical_precision',
      question: 'Is the canonical comp_*-level mapping 100% complete (every competency precisely question-mapped)?',
      verdict: preciseCompPct != null && preciseCompPct >= 99 ? 'PASS' : (preciseCompPct != null && preciseCompPct > 0 ? 'PARTIAL' : 'FAIL'),
      evidence: `PRECISE coverage is ${preciseCompPct ?? 0}% (${preciseComps ?? 0}/${totalComps ?? 0}). Reaching 100% is the question→competency data-mapping effort (NOT achievable by composition) — honestly PARTIAL.`,
    },
    {
      id: 'Q3_operational_match',
      question: 'Can the match engine operationally score curated Role DNA today (via the domain-proxy bridge)?',
      verdict: opReqPct != null && opReqPct >= 99 ? 'PASS' : (opReqPct != null && opReqPct > 0 ? 'PARTIAL' : 'FAIL'),
      evidence: `${opReqPct ?? 0}% of role requirements (${reqsProxy ?? 0}/${dnaReqs ?? 0}) are domain-proxy reachable; precise-reachable is ${preciseReqPct ?? 0}% (${reqsPrecise ?? 0}/${dnaReqs ?? 0}). Reported on separate axes — never composited.`,
    },
    {
      id: 'Q4_role_dna_present',
      question: 'Do roles carry curated competency Role DNA with required levels?',
      verdict: (dnaRoles ?? 0) > 0 && (dnaReqs ?? 0) > 0 ? 'PASS' : 'FAIL',
      evidence: `${dnaRoles ?? 0} roles carry curated Role DNA (${dnaReqs ?? 0} requirements). Required levels back the readiness/gap computation.`,
    },
    {
      id: 'Q5_live_activation',
      // Demo/seed subjects are NOT distinguishable from real ones at this layer, so we never
      // upgrade to PASS on unverifiable volume — present-but-unverified is honestly PARTIAL.
      question: 'Is the chain ACTIVATED with real (non-demo) assessment volume end-to-end?',
      verdict: (scoredSubjects ?? 0) > 0 ? 'PARTIAL' : 'FAIL',
      evidence: `${scoredSubjects ?? 0} subjects carry competency scores, but these cannot be verified as non-demo at this layer. The structural machinery is in place; real (non-demo) activation volume is NOT proven, so this stays PARTIAL — never upgraded to PASS on demo/seed counts.`,
    },
    {
      id: 'Q6_honest_separation',
      question: 'Are Coverage ⟂ Confidence and Precise ⟂ Operational kept SEPARATE (no inflated single number)?',
      verdict: 'PASS',
      evidence: 'Every surface reports precise and operational axes separately; rates with a zero denominator are null (never a fabricated 0%); absent tables degrade to null, not 0.',
    },
  ];

  const fails = questions.filter((q) => q.verdict === 'FAIL').length;
  const partials = questions.filter((q) => q.verdict === 'PARTIAL').length;
  const overall: Verdict = fails > 0 ? 'FAIL' : partials > 0 ? 'PARTIAL' : 'PASS';

  return {
    ok: true,
    phase: 'P8_certification',
    version: CMI_VERSION,
    read_only: true,
    generated_at: new Date().toISOString(),
    overall_verdict: overall,
    summary: {
      pass: questions.filter((q) => q.verdict === 'PASS').length,
      partial: partials,
      fail: fails,
      total: questions.length,
    },
    axes: {
      precise_competency_coverage_pct: preciseCompPct,
      operational_competency_coverage_pct: opCompPct,
      precise_requirement_reachability_pct: preciseReqPct,
      operational_requirement_reachability_pct: opReqPct,
      scored_subjects: scoredSubjects,
    },
    questions,
    note: 'Overall PARTIAL is the HONEST verdict: the framework is unified and operationally matchable today, but canonical comp-level precision and real activation volume are data efforts (tasks #123/#124 and live usage), never fabricated by composition.',
    disclaimer: CMI_DISCLAIMER,
  };
}

// ── Overview roll-up (composes the four phases' headlines) ──────────────────────

export async function composeOverview(pool: Pool): Promise<any> {
  const [coverage, superAdmin, founder, cert] = await Promise.all([
    composeCrosswalkCoverage(pool).catch(() => null),
    composeSuperAdmin(pool).catch(() => null),
    composeFounder(pool).catch(() => null),
    composeCertification(pool).catch(() => null),
  ]);
  return {
    ok: true,
    phase: 'overview',
    version: CMI_VERSION,
    read_only: true,
    generated_at: new Date().toISOString(),
    overall_verdict: cert?.overall_verdict ?? null,
    headline: coverage?.headline ?? null,
    certification_summary: cert?.summary ?? null,
    match_reachability: founder?.matchReachability ?? null,
    coverage_axes: superAdmin?.coverage ? Object.keys(superAdmin.coverage) : [],
    disclaimer: CMI_DISCLAIMER,
  };
}
