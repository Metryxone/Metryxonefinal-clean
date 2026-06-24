/**
 * MX-103X — Live Employer Ecosystem Audit Engine (additive, read-only, never-throws).
 *
 * COMPOSES the already-built employer hiring subsystem into ONE honest funnel
 * certification across the eight success-criteria stages:
 *
 *   1 Employer Onboarding · 2 Create Job · 3 Role DNA · 4 Competencies ·
 *   5 Assessment · 6 Candidate Match · 7 Interview Intelligence ·
 *   8 Hiring Decision · 9 Outcome Tracking
 *
 * HONESTY CONTRACT (platform canon):
 *   - Read-only. Every table probed with to_regclass BEFORE any read; absent table
 *     degrades to null (NEVER a fabricated 0). NO DDL, NO writes, never throws.
 *   - Coverage ⟂ Confidence are reported as INDEPENDENT axes and never composited:
 *       coverage    = "can this stage be exercised end-to-end" (flag on + route + substrate)
 *       confidence  = "is the data behind it trustworthy" (real non-demo rows; calibration ≥ k_min)
 *   - Demo data (@example.com candidates, validation_loop_outcomes.is_demo) is counted
 *     SEPARATELY and excluded from the real-data / confidence axis. Demo rows are
 *     exercisable-substrate, never proof of real operation.
 *   - Abstain below k_min = 30 realized outcomes — never claim calibrated confidence.
 *   - Verdict is OPERATIONAL only when every stage is operational on REAL data AND
 *     outcome confidence is calibrated; otherwise honest PARTIAL with explicit reasons.
 *
 * This engine NEVER recomputes the underlying scores — it reports the stored state
 * produced by the real hiring + calibration engines.
 */
import type { Pool } from 'pg';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isEmployerCompetencyHiringEnabled,
  isRoleDNARuntimeEnabled,
  isJobPostingEngineEnabled,
  isHiringAssessmentEnabled,
  isTalentMatchingEnabled,
  isInterviewIntelligenceEnabled,
  isHiringIntelligenceEnabled,
  isEmployerDashboardsEnabled,
  isOutcomeIntelligenceActivationEnabled,
  isValidationLoopEnabled,
} from '../config/feature-flags';

export const EMPLOYER_ECOSYSTEM_AUDIT_VERSION = 'mx-103x-1.0.0';

export const ECOSYSTEM_K_MIN = 30; // platform precedent — calibrated confidence needs ≥30 realized outcomes

export type StageStatus = 'operational' | 'demo_only' | 'gated' | 'gap' | 'empty';
export type CoverageState = 'reachable' | 'gated' | 'absent';
export type ConfidenceState = 'real' | 'demo_only' | 'none' | 'calibrated' | 'provisional';

export interface StageReport {
  id: number;
  key: string;
  name: string;
  criterion: string;
  /** Gating flag(s) that must be ON for this stage's route to serve (null = always-on / no flag). */
  flags: { key: string; enabled: boolean }[];
  flagEnabled: boolean;
  /** Substrate tables and whether each exists. `required` tables gate reachability; optional ones only enrich. */
  tables: { name: string; present: boolean; required: boolean }[];
  substratePresent: boolean;
  /** Honest counts (null = substrate absent, never a fake 0). */
  totalRows: number | null;
  demoRows: number | null;
  realRows: number | null;
  // ── Coverage ⟂ Confidence (independent axes) ──
  coverage: CoverageState;
  confidence: ConfidenceState;
  status: StageStatus;
  note: string;
}

export interface EcosystemAuditResult {
  ok: true;
  version: string;
  generatedAt: string;
  kMin: number;
  stages: StageReport[];
  summary: {
    totalStages: number;
    operational: number;
    demoOnly: number;
    gated: number;
    gap: number;
    empty: number;
    coverageReachable: number;
    realDataStages: number;
    outcomeCalibrated: boolean;
  };
  verdict: 'OPERATIONAL' | 'PARTIAL';
  verdictReasons: string[];
  demoTransparency: string;
  generatedNote: string;
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}

async function scalarInt(pool: Pool, sql: string, params: any[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = Number(rows[0]?.c);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Resolve the demo employer ids = employers that own any @example.com candidate. */
async function resolveDemoEmployerIds(pool: Pool): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT employer_id::text AS id
         FROM employer_candidates
        WHERE email ILIKE '%@example.com' AND employer_id IS NOT NULL`,
    );
    return rows.map((r) => String(r.id)).filter(Boolean);
  } catch {
    return [];
  }
}

function deriveStatus(flagEnabled: boolean, substratePresent: boolean, real: number | null, demo: number | null): StageStatus {
  if (!flagEnabled) return 'gated';
  if (!substratePresent) return 'gap';
  if ((real ?? 0) > 0) return 'operational';
  if ((demo ?? 0) > 0) return 'demo_only';
  return 'empty';
}

function deriveCoverage(flagEnabled: boolean, substratePresent: boolean): CoverageState {
  if (!flagEnabled) return 'gated';
  if (!substratePresent) return 'absent';
  return 'reachable';
}

export async function runEmployerEcosystemAudit(pool: Pool): Promise<EcosystemAuditResult> {
  const demoEmployerIds = await resolveDemoEmployerIds(pool);
  const demoList = demoEmployerIds.length ? demoEmployerIds : ['\u0000__none__'];

  // Pre-probe every table once.
  const tableNames = [
    'employer_organizations', 'employer_members', 'employer_jobs', 'job_postings',
    'onto_roles', 'map_role_competency', 'onto_competencies',
    'ep98_hiring_assessments', 'assessment_invites', 'employer_candidates',
    'tig_intelligence', 'tig_calibration', 'employer_interviews', 'employer_offers',
    'validation_loop_outcomes',
  ];
  const present: Record<string, boolean> = {};
  await Promise.all(tableNames.map(async (t) => { present[t] = await tableExists(pool, t); }));

  const stages: StageReport[] = [];

  // Helper to assemble a stage.
  const build = (
    cfg: {
      id: number; key: string; name: string; criterion: string;
      flags: { key: string; enabled: boolean }[];
      // Each entry is `name` (required) or `[name, false]` (optional/enriching — does NOT gate reachability).
      tables: (string | [string, boolean])[];
    },
    counts: { total: number | null; demo: number | null; real: number | null },
    confidence: ConfidenceState,
    note: string,
  ): StageReport => {
    const flagEnabled = cfg.flags.every((f) => f.enabled);
    const tables = cfg.tables.map((t) => {
      const [name, required] = Array.isArray(t) ? t : [t, true];
      return { name, present: !!present[name], required };
    });
    // A stage is substrate-reachable only when EVERY required table exists (optional tables only enrich).
    // Guard against a stage with no required tables (would vacuously pass `every`) by falling back to `some`.
    const requiredTables = tables.filter((t) => t.required);
    const substratePresent = requiredTables.length > 0
      ? requiredTables.every((t) => t.present)
      : tables.some((t) => t.present);
    return {
      ...cfg,
      flagEnabled,
      tables,
      substratePresent,
      totalRows: counts.total,
      demoRows: counts.demo,
      realRows: counts.real,
      coverage: deriveCoverage(flagEnabled, substratePresent),
      confidence,
      status: deriveStatus(flagEnabled, substratePresent, counts.real, counts.demo),
      note,
    };
  };

  // ── Stage 1 — Employer Onboarding ──────────────────────────────────────────
  {
    const total = present.employer_organizations ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_organizations`) : null;
    const demo = present.employer_organizations
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_organizations WHERE id::text = ANY($1)`, [demoList])
      : null;
    const real = total != null && demo != null ? Math.max(0, total - demo) : null;
    stages.push(build(
      { id: 1, key: 'onboarding', name: 'Employer Onboarding',
        criterion: 'An employer org can be created/verified and members attached.',
        flags: [{ key: 'employerDashboards', enabled: isEmployerDashboardsEnabled() }],
        tables: ['employer_organizations', 'employer_members'] },
      { total, demo, real },
      (real ?? 0) > 0 ? 'real' : (demo ?? 0) > 0 ? 'demo_only' : 'none',
      total === 0
        ? 'No employer organizations yet — the single-tenant hiring path keys jobs on employer_id directly; the org spine is unseeded.'
        : 'Employer orgs present.',
    ));
  }

  // ── Stage 2 — Create Job ────────────────────────────────────────────────────
  {
    const total = present.employer_jobs ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_jobs`) : null;
    const demo = present.employer_jobs
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_jobs WHERE employer_id::text = ANY($1)`, [demoList])
      : null;
    const real = total != null && demo != null ? Math.max(0, total - demo) : null;
    stages.push(build(
      { id: 2, key: 'create_job', name: 'Create Job',
        criterion: 'A job/requisition can be created with role, skills and requirements.',
        flags: [], // employer-admin job CRUD is not flag-gated; job-posting-engine is the additive surface
        tables: ['employer_jobs', ['job_postings', false]] }, // job_postings is the additive surface, not required
      { total, demo, real },
      (real ?? 0) > 0 ? 'real' : (demo ?? 0) > 0 ? 'demo_only' : 'none',
      `employer_jobs=${total ?? 'n/a'} (demo=${demo ?? 'n/a'}); additive job-posting-engine flag=${isJobPostingEngineEnabled() ? 'on' : 'off'}.`,
    ));
  }

  // ── Stage 3 — Role DNA ──────────────────────────────────────────────────────
  {
    const roles = present.onto_roles ? await scalarInt(pool, `SELECT COUNT(*) c FROM onto_roles`) : null;
    const links = present.map_role_competency ? await scalarInt(pool, `SELECT COUNT(*) c FROM map_role_competency`) : null;
    // Role DNA is reference data (not demo-scoped). Coverage = roles with ≥1 competency link.
    const linkedRoles = present.map_role_competency
      ? await scalarInt(pool, `SELECT COUNT(DISTINCT role_id) c FROM map_role_competency`)
      : null;
    stages.push(build(
      { id: 3, key: 'role_dna', name: 'Role DNA',
        criterion: 'A role resolves to a competency requirement profile (Role DNA).',
        flags: [{ key: 'roleDNARuntimeEnabled', enabled: isRoleDNARuntimeEnabled() }],
        tables: ['onto_roles', 'map_role_competency'] },
      { total: roles, demo: 0, real: roles },
      (linkedRoles ?? 0) > 0 ? 'real' : 'none',
      `roles=${roles ?? 'n/a'}, role→competency links=${links ?? 'n/a'} across ${linkedRoles ?? 'n/a'} roles (reference data, not demo-scoped).`,
    ));
  }

  // ── Stage 4 — Competencies ──────────────────────────────────────────────────
  {
    const comps = present.onto_competencies ? await scalarInt(pool, `SELECT COUNT(*) c FROM onto_competencies`) : null;
    stages.push(build(
      { id: 4, key: 'competencies', name: 'Competencies',
        criterion: 'The competency genome is queryable and joins to roles + candidates.',
        flags: [
          { key: 'adaptiveIntelligenceFoundation', enabled: isAdaptiveIntelligenceFoundationEnabled() },
          { key: 'employerCompetencyHiring', enabled: isEmployerCompetencyHiringEnabled() },
        ],
        tables: ['onto_competencies'] },
      { total: comps, demo: 0, real: comps },
      (comps ?? 0) > 0 ? 'real' : 'none',
      `competency genome=${comps ?? 'n/a'} (reference data); employer competency-match engine gated by employerCompetencyHiring.`,
    ));
  }

  // ── Stage 5 — Assessment ────────────────────────────────────────────────────
  {
    const invites = present.assessment_invites ? await scalarInt(pool, `SELECT COUNT(*) c FROM assessment_invites`) : null;
    // ep98_hiring_assessments are the stored hiring scores; demo via candidate join.
    const total = present.ep98_hiring_assessments ? await scalarInt(pool, `SELECT COUNT(*) c FROM ep98_hiring_assessments`) : null;
    const demo = present.ep98_hiring_assessments && present.employer_candidates
      ? await scalarInt(pool,
          `SELECT COUNT(*) c FROM ep98_hiring_assessments a
             JOIN employer_candidates c ON c.id = a.candidate_id
            WHERE c.email ILIKE '%@example.com'`)
      : null;
    const real = total != null && demo != null ? Math.max(0, total - demo) : null;
    stages.push(build(
      { id: 5, key: 'assessment', name: 'Assessment',
        criterion: 'A candidate can be invited to and complete a hiring assessment that scores them.',
        flags: [{ key: 'hiringAssessment', enabled: isHiringAssessmentEnabled() }],
        tables: ['ep98_hiring_assessments', ['assessment_invites', false]] }, // scoring is the proof; invite is the front-half
      { total, demo, real },
      (real ?? 0) > 0 ? 'real' : (demo ?? 0) > 0 ? 'demo_only' : 'none',
      `invites=${invites ?? 'n/a'}; stored hiring assessments=${total ?? 'n/a'} (demo=${demo ?? 'n/a'}); invite/scoring engine gated by hiringAssessment.`,
    ));
  }

  // ── Stage 6 — Candidate Match ───────────────────────────────────────────────
  {
    const total = present.employer_candidates ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_candidates`) : null;
    const demo = present.employer_candidates ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_candidates WHERE email ILIKE '%@example.com'`) : null;
    const real = total != null && demo != null ? Math.max(0, total - demo) : null;
    const intel = present.tig_intelligence ? await scalarInt(pool, `SELECT COUNT(*) c FROM tig_intelligence`) : null;
    stages.push(build(
      { id: 6, key: 'candidate_match', name: 'Candidate Match',
        criterion: 'Candidates are ranked against a job via competency + behaviour match.',
        flags: [{ key: 'talentMatching', enabled: isTalentMatchingEnabled() }],
        tables: ['employer_candidates', ['tig_intelligence', false]] }, // tig graph enriches the match; candidates are required
      { total, demo, real },
      (real ?? 0) > 0 ? 'real' : (demo ?? 0) > 0 ? 'demo_only' : 'none',
      `candidates=${total ?? 'n/a'} (demo=${demo ?? 'n/a'}); talent-intelligence-graph rows=${intel ?? 'n/a'}; talent-matching engine gated by talentMatching. employerCompetencyHiring match is separately available.`,
    ));
  }

  // ── Stage 7 — Interview Intelligence ────────────────────────────────────────
  {
    const total = present.employer_interviews ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_interviews`) : null;
    const demo = present.employer_interviews
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_interviews WHERE employer_id::text = ANY($1)`, [demoList])
      : null;
    const real = total != null && demo != null ? Math.max(0, total - demo) : null;
    const blueprints = present.ep98_hiring_assessments
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM ep98_hiring_assessments WHERE interview_blueprint IS NOT NULL`)
      : null;
    stages.push(build(
      { id: 7, key: 'interview', name: 'Interview Intelligence',
        criterion: 'An interview blueprint/scorecard is generated and interviews can be recorded.',
        flags: [{ key: 'interviewIntelligence', enabled: isInterviewIntelligenceEnabled() }],
        tables: ['employer_interviews', ['ep98_hiring_assessments', false]] }, // assessments are the blueprint source; interviews are required
      { total, demo, real },
      (real ?? 0) > 0 ? 'real' : (blueprints ?? 0) > 0 || (demo ?? 0) > 0 ? 'demo_only' : 'none',
      `recorded interviews=${total ?? 'n/a'} (demo=${demo ?? 'n/a'}); stored interview blueprints=${blueprints ?? 'n/a'}; interview engine gated by interviewIntelligence.`,
    ));
  }

  // ── Stage 8 — Hiring Decision ───────────────────────────────────────────────
  {
    const decided = present.employer_candidates
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_candidates WHERE stage IN ('Hired','Rejected')`)
      : null;
    const realDecided = present.employer_candidates
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_candidates WHERE stage IN ('Hired','Rejected') AND email NOT ILIKE '%@example.com'`)
      : null;
    const demoDecided = decided != null && realDecided != null ? Math.max(0, decided - realDecided) : null;
    const recs = present.ep98_hiring_assessments
      ? await scalarInt(pool, `SELECT COUNT(*) c FROM ep98_hiring_assessments WHERE hiring_recommendation IS NOT NULL`)
      : null;
    const offers = present.employer_offers ? await scalarInt(pool, `SELECT COUNT(*) c FROM employer_offers`) : null;
    stages.push(build(
      { id: 8, key: 'hiring_decision', name: 'Hiring Decision',
        criterion: 'A decision-support hiring recommendation is produced and a Hired/Rejected outcome can be recorded.',
        flags: [{ key: 'hiringIntelligence', enabled: isHiringIntelligenceEnabled() }],
        tables: ['employer_candidates', ['ep98_hiring_assessments', false], ['employer_offers', false]] }, // recs/offers enrich; terminal-stage candidates are the proof
      { total: decided, demo: demoDecided, real: realDecided },
      (realDecided ?? 0) > 0 ? 'real' : (decided ?? 0) > 0 ? 'demo_only' : 'none',
      `terminal-stage candidates=${decided ?? 'n/a'} (demo=${demoDecided ?? 'n/a'}); stored hiring recommendations=${recs ?? 'n/a'}; offers=${offers ?? 'n/a'}; decision-support is advisory only (never a hire/no-hire verdict).`,
    ));
  }

  // ── Stage 9 — Outcome Tracking ──────────────────────────────────────────────
  let outcomeCalibrated = false;
  {
    const total = present.validation_loop_outcomes ? await scalarInt(pool, `SELECT COUNT(*) c FROM validation_loop_outcomes`) : null;
    const demo = present.validation_loop_outcomes ? await scalarInt(pool, `SELECT COUNT(*) c FROM validation_loop_outcomes WHERE is_demo = true`) : null;
    const real = total != null && demo != null ? Math.max(0, total - demo) : null;
    const calibratedOrgs = present.tig_calibration
      ? await scalarInt(pool, `SELECT COUNT(DISTINCT org_id) c FROM tig_calibration WHERE status = 'calibrated'`)
      : null;
    outcomeCalibrated = (real ?? 0) >= ECOSYSTEM_K_MIN && (calibratedOrgs ?? 0) > 0;
    const flags = [
      { key: 'validationLoop', enabled: isValidationLoopEnabled() },
      { key: 'outcomeIntelligenceActivation', enabled: isOutcomeIntelligenceActivationEnabled() },
    ];
    const conf: ConfidenceState = outcomeCalibrated ? 'calibrated' : (real ?? 0) > 0 ? 'provisional' : (demo ?? 0) > 0 ? 'demo_only' : 'none';
    stages.push(build(
      { id: 9, key: 'outcome', name: 'Outcome Tracking',
        criterion: 'Realized hire/perf outcomes are captured and feed calibration (≥30 → calibrated confidence).',
        flags,
        tables: ['validation_loop_outcomes', ['tig_calibration', false]] }, // calibration target enriches; realized outcomes are required
      { total, demo, real },
      conf,
      (real ?? 0) === 0
        ? `No realized non-demo outcomes recorded — calibration stays cold_start/provisional. Confidence abstains until ≥${ECOSYSTEM_K_MIN} real outcomes accrue.`
        : `realized outcomes=${total ?? 'n/a'} (demo=${demo ?? 'n/a'}); calibrated orgs=${calibratedOrgs ?? 'n/a'}. ${outcomeCalibrated ? 'Confidence calibrated.' : `Below k_min=${ECOSYSTEM_K_MIN} → provisional.`}`,
    ));
  }

  // ── Summary + verdict ───────────────────────────────────────────────────────
  const count = (s: StageStatus) => stages.filter((x) => x.status === s).length;
  const realDataStages = stages.filter((x) => (x.realRows ?? 0) > 0).length;
  const summary = {
    totalStages: stages.length,
    operational: count('operational'),
    demoOnly: count('demo_only'),
    gated: count('gated'),
    gap: count('gap'),
    empty: count('empty'),
    coverageReachable: stages.filter((x) => x.coverage === 'reachable').length,
    realDataStages,
    outcomeCalibrated,
  };

  const verdictReasons: string[] = [];
  if (summary.gated > 0) verdictReasons.push(`${summary.gated} stage(s) gated (flag OFF) — route would 503 until activated.`);
  if (summary.gap > 0) verdictReasons.push(`${summary.gap} stage(s) missing substrate tables.`);
  if (summary.demoOnly > 0) verdictReasons.push(`${summary.demoOnly} stage(s) exercisable on DEMO data only — no real (non-demo) rows yet.`);
  if (!outcomeCalibrated) verdictReasons.push(`Outcome confidence abstains: fewer than k_min=${ECOSYSTEM_K_MIN} realized non-demo outcomes, so calibration is not trusted.`);

  const fullyOperational =
    summary.gated === 0 && summary.gap === 0 && summary.demoOnly === 0 &&
    summary.empty === 0 && outcomeCalibrated;
  const verdict: 'OPERATIONAL' | 'PARTIAL' = fullyOperational ? 'OPERATIONAL' : 'PARTIAL';
  if (verdict === 'OPERATIONAL') verdictReasons.push('Every funnel stage is reachable on real data and outcome confidence is calibrated.');

  return {
    ok: true,
    version: EMPLOYER_ECOSYSTEM_AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    kMin: ECOSYSTEM_K_MIN,
    stages,
    summary,
    verdict,
    verdictReasons,
    demoTransparency:
      'Demo rows are sourced from the @example.com candidate seed (and validation_loop_outcomes.is_demo). ' +
      'They are exercisable substrate proving the path runs, but are EXCLUDED from the real-data / confidence axis ' +
      'and from calibration. All scores are computed by the real hiring + calibration engines, never fabricated.',
    generatedNote:
      'Read-only composition over the live employer hiring subsystem. Coverage (exercisable) and Confidence (trustworthy) ' +
      'are independent axes; a PARTIAL verdict with high coverage but demo-only confidence is the honest pre-launch state.',
  };
}
