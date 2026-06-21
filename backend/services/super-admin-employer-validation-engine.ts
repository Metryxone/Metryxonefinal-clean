/**
 * PHASE 5.15 — Super Admin Validation engine (additive, read-only, never-throws).
 *
 * The EMPLOYER analog of Phase-4.12 `super-admin-career-validation-engine.ts`. A
 * super-admin runs this for ONE employer subject to obtain a comprehensive
 * honesty/invariant report across FOURTEEN areas. It COMPOSES the already-computed
 * employer/talent data + the two 0-DDL pure engines (Notifications 5.14, Workforce
 * 5.12) — it performs NO new scoring and writes NOTHING.
 *
 * Areas:
 *   1.  Employer Setup          — employer_organizations + employer_company_profiles (subject)
 *   2.  Organization Setup      — tenants + employer_organizations (platform)
 *   3.  Job Architecture        — role_families + onto_role_competency_profiles (platform)
 *   4.  Job Posting             — employer_jobs + job_distributions (subject)
 *   5.  Talent Search           — talent_pools / shortlists / saved_searches (platform)
 *   6.  Matching                — employer_candidates.match_score + requirement backing (subject)
 *   7.  Assessments             — employer_candidates.assessment_* + hiring_assessment_* (subject)
 *   8.  Shortlisting            — candidate_pipeline + workflow_transitions (subject)
 *   9.  Interviewing            — interview_schedules / scores / decisions (subject)
 *   10. Hiring                  — employer_offers + interview hire-decisions (subject)
 *   11. Workforce Intelligence  — COMPOSE workforce engine (5.12) (subject)
 *   12. Notifications           — COMPOSE notification engine (5.14) (subject)
 *   13. Permissions             — wos_roles / role_definitions / role_permissions (platform)
 *   14. Audit Logs              — platform_audit_log / admin_audit_logs / capadex / employer (platform)
 *
 * Honesty contract (mirrors 4.12 / 3.12):
 *   - THREE statuses. PASS = checked & valid. WARN = honest absence / not measurable
 *     (an absent table, an empty area, no rows for the subject) — NEVER a failure.
 *     FAIL = a real invariant violation (out-of-bounds score, orphan FK, out-of-canon
 *     enum, negative amount, null created_at, or an existing-but-unreadable table).
 *   - Coverage (does data exist) and Confidence (is it trustworthy) are reported as
 *     SEPARATE axes; never composited.
 *   - null ≠ 0: a missing score is `null`, never silently coerced to 0.
 *   - GET-never-writes: this engine runs ZERO DDL. Every table is probed with
 *     to_regclass before it is read (absent ⇒ WARN, no read); the only composed
 *     engines (Notifications 5.14, Workforce 5.12) are 0-DDL pure read composers.
 *     DDL-bearing engines (job-posting / discovery / shortlisting / interview /
 *     assessment) are NEVER exercised — only their canonical enum CONSTS are imported.
 *   - never-throws: each area runs in its own try/catch; a thrown error becomes a
 *     FAIL for THAT area only — the orchestrator never throws and never 500s.
 */

import type { Pool } from 'pg';
import { JOB_STATUS, CHANNELS } from './job-posting-engine.js';
import { PIPELINE_STATUSES } from './shortlisting-engine.js';
import { INTERVIEW_STATUSES, INTERVIEW_MODES, DECISION_TYPES } from './interview-engine.js';
import {
  computeNotifications,
  computeWorkflowNotifications,
  computeCommunications,
} from './notification-engine.js';
import {
  computeTalentDistribution,
  computeDepartmentReadiness,
} from './workforce-intelligence-engine.js';

export const SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION = '5.15.0';

export const EMPLOYER_VALIDATION_DISCLAIMER =
  'Read-only honesty/invariant harness. It re-reads already-recorded employer data and ' +
  'composes existing read-only engines; it performs no new scoring, sends nothing, and ' +
  'writes nothing. WARN denotes an honest absence (not provisioned / no data), never a ' +
  'failure; FAIL denotes a real invariant break. Coverage and Confidence are separate axes; ' +
  'a missing value is null, never 0.';

// ── Result types (mirror Phase-4.12) ─────────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationStatus;
  detail: string;
}

export interface ValidationArea {
  id: string;
  label: string;
  scope: 'subject' | 'platform';
  status: ValidationStatus;
  measurable: boolean;
  checks: ValidationCheck[];
  notes: string[];
}

export interface EmployerValidationResult {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  areas: ValidationArea[];
  summary: {
    areas_total: number;
    pass: number;
    warn: number;
    fail: number;
    status: ValidationStatus;
    measurable_areas: number;
  };
  disclaimer: string;
  notes: string[];
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** WARN is benign; FAIL dominates; otherwise PASS. */
function worst(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function check(id: string, label: string, status: ValidationStatus, detail: string): ValidationCheck {
  return { id, label, status, detail };
}

function area(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  measurable: boolean,
  checks: ValidationCheck[],
  notes: string[] = [],
): ValidationArea {
  return { id, label, scope, measurable, status: worst(checks.map((c) => c.status)), checks, notes };
}

/** A thrown engine/query error is a FAIL for THAT area only — never a 500. */
function failArea(id: string, label: string, scope: 'subject' | 'platform', err: unknown): ValidationArea {
  const msg = err instanceof Error ? err.message : String(err);
  return area(
    id,
    label,
    scope,
    false,
    [check('engine_error', 'Area executed without throwing', 'fail', `threw: ${msg}`)],
    ['Area failed because a probe/composed engine threw — isolated; other areas are unaffected.'],
  );
}

/** An area whose primary table is not provisioned: WARN (honest absence), no read. */
function notProvisionedArea(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  table: string,
): ValidationArea {
  return area(
    id,
    label,
    scope,
    false,
    [
      check(
        'provisioned',
        'Primary table is provisioned',
        'warn',
        `${table} absent — area not provisioned (honest absence, not a failure). GET performs zero DDL.`,
      ),
    ],
    ['Area skipped its reads to guarantee GET-never-writes; not a defect.'],
  );
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

/** Run an aggregate that returns a single integer column `n`. */
async function num(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query<{ n: string | number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

const JOB_STATUS_VALUES = Object.values(JOB_STATUS) as string[];
const CHANNEL_VALUES = [...CHANNELS] as string[];

// ── Orchestrator scaffolding ─────────────────────────────────────────────────

type AreaFn = () => Promise<ValidationArea>;

async function runArea(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  fn: AreaFn,
): Promise<ValidationArea> {
  try {
    return await fn();
  } catch (err) {
    return failArea(id, label, scope, err);
  }
}

export async function runSuperAdminEmployerValidation(
  pool: Pool,
  subjectId: string,
): Promise<EmployerValidationResult> {
  const sid = String(subjectId ?? '').trim();
  const areas: ValidationArea[] = [];

  // 1 — Employer Setup (subject) ───────────────────────────────────────────────
  areas.push(
    await runArea('employer_setup', 'Employer Setup', 'subject', async () => {
      if (!(await tableExists(pool, 'employer_organizations'))) {
        return notProvisionedArea('employer_setup', 'Employer Setup', 'subject', 'employer_organizations');
      }
      const orgCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_organizations WHERE id=$1', [sid]);
      const checks: ValidationCheck[] = [];
      const measurable = orgCount > 0;
      checks.push(check('org_exists', 'Employer organization row exists for subject', measurable ? 'pass' : 'warn',
        measurable ? 'organization row present.' : 'no organization for subject (honest absence).'));

      // approval_threshold / max_sessions must be non-negative when present.
      const badThreshold = await num(pool, 'SELECT COUNT(*)::int n FROM employer_organizations WHERE id=$1 AND approval_threshold IS NOT NULL AND approval_threshold < 0', [sid]);
      checks.push(check('approval_threshold_bounds', 'approval_threshold non-negative or null', badThreshold === 0 ? 'pass' : 'fail',
        badThreshold === 0 ? 'approval_threshold within range.' : `${badThreshold} negative approval_threshold.`));
      const badSessions = await num(pool, 'SELECT COUNT(*)::int n FROM employer_organizations WHERE id=$1 AND max_sessions IS NOT NULL AND max_sessions < 0', [sid]);
      checks.push(check('max_sessions_bounds', 'max_sessions non-negative or null', badSessions === 0 ? 'pass' : 'fail',
        badSessions === 0 ? 'max_sessions within range.' : `${badSessions} negative max_sessions.`));

      // Coverage axis: company profile present (warn if absent — never a fail).
      let profileCount = 0;
      if (await tableExists(pool, 'employer_company_profiles')) {
        profileCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_company_profiles WHERE employer_id=$1', [sid]);
      }
      checks.push(check('company_profile_coverage', 'Company profile present (Coverage axis)', profileCount > 0 ? 'pass' : 'warn',
        profileCount > 0 ? `${profileCount} company profile row(s).` : 'no company profile for subject (Coverage gap, not a failure).'));

      return area('employer_setup', 'Employer Setup', 'subject', measurable, checks);
    }),
  );

  // 2 — Organization Setup (platform) ──────────────────────────────────────────
  areas.push(
    await runArea('organization_setup', 'Organization Setup', 'platform', async () => {
      const hasTenants = await tableExists(pool, 'tenants');
      const hasOrgs = await tableExists(pool, 'employer_organizations');
      if (!hasTenants && !hasOrgs) {
        return notProvisionedArea('organization_setup', 'Organization Setup', 'platform', 'tenants / employer_organizations');
      }
      const checks: ValidationCheck[] = [];
      let measurable = false;

      if (hasTenants) {
        const tenantCount = await num(pool, 'SELECT COUNT(*)::int n FROM tenants');
        measurable = measurable || tenantCount > 0;
        checks.push(check('tenants_present', 'At least one tenant', tenantCount > 0 ? 'pass' : 'warn',
          `${tenantCount} tenant(s).`));
        // Invariant: active_users ≤ max_users where both present.
        const overAllocated = await num(pool, 'SELECT COUNT(*)::int n FROM tenants WHERE active_users IS NOT NULL AND max_users IS NOT NULL AND active_users > max_users');
        checks.push(check('tenant_seat_invariant', 'active_users ≤ max_users per tenant', overAllocated === 0 ? 'pass' : 'fail',
          overAllocated === 0 ? 'no tenant over its seat cap.' : `${overAllocated} tenant(s) exceed max_users.`));
        const negSeats = await num(pool, 'SELECT COUNT(*)::int n FROM tenants WHERE (active_users IS NOT NULL AND active_users < 0) OR (max_users IS NOT NULL AND max_users < 0)');
        checks.push(check('tenant_seats_non_negative', 'Tenant seat counts non-negative', negSeats === 0 ? 'pass' : 'fail',
          negSeats === 0 ? 'seat counts non-negative.' : `${negSeats} tenant(s) with negative seats.`));
      } else {
        checks.push(check('tenants_present', 'Tenants table provisioned', 'warn', 'tenants table absent (honest absence).'));
      }

      if (hasOrgs) {
        const orgCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_organizations');
        measurable = measurable || orgCount > 0;
        checks.push(check('orgs_present', 'At least one employer organization', orgCount > 0 ? 'pass' : 'warn',
          `${orgCount} organization(s).`));
        const negThreshold = await num(pool, 'SELECT COUNT(*)::int n FROM employer_organizations WHERE approval_threshold IS NOT NULL AND approval_threshold < 0');
        checks.push(check('org_threshold_non_negative', 'Org approval_threshold non-negative', negThreshold === 0 ? 'pass' : 'fail',
          negThreshold === 0 ? 'thresholds non-negative.' : `${negThreshold} negative threshold(s).`));
      }

      return area('organization_setup', 'Organization Setup', 'platform', measurable, checks);
    }),
  );

  // 3 — Job Architecture (platform) ────────────────────────────────────────────
  areas.push(
    await runArea('job_architecture', 'Job Architecture', 'platform', async () => {
      const hasFamilies = await tableExists(pool, 'role_families');
      const hasProfiles = await tableExists(pool, 'onto_role_competency_profiles');
      if (!hasFamilies && !hasProfiles) {
        return notProvisionedArea('job_architecture', 'Job Architecture', 'platform', 'role_families / onto_role_competency_profiles');
      }
      const checks: ValidationCheck[] = [];
      let measurable = false;
      const notes: string[] = [];
      if (!(await tableExists(pool, 'talent_role_families')) || !(await tableExists(pool, 'onto_role_profiles'))) {
        notes.push('talent_role_families / onto_role_profiles not provisioned in this environment (honest absence).');
      }

      if (hasFamilies) {
        const famCount = await num(pool, 'SELECT COUNT(*)::int n FROM role_families');
        measurable = measurable || famCount > 0;
        checks.push(check('families_present', 'Role families present', famCount > 0 ? 'pass' : 'warn',
          `${famCount} role family(ies).`));
        // No family may be its own parent (cycle of length 1).
        const selfParent = await num(pool, 'SELECT COUNT(*)::int n FROM role_families WHERE parent_family_id = id');
        checks.push(check('family_no_self_parent', 'No role family is its own parent', selfParent === 0 ? 'pass' : 'fail',
          selfParent === 0 ? 'no self-parented family.' : `${selfParent} self-parented family(ies).`));
        // Parent references must resolve.
        const danglingParent = await num(pool, 'SELECT COUNT(*)::int n FROM role_families c WHERE c.parent_family_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM role_families p WHERE p.id = c.parent_family_id)');
        checks.push(check('family_parent_resolves', 'Every parent_family_id resolves to a family', danglingParent === 0 ? 'pass' : 'fail',
          danglingParent === 0 ? 'all parent references resolve.' : `${danglingParent} dangling parent reference(s).`));
      }

      if (hasProfiles) {
        const profCount = await num(pool, 'SELECT COUNT(*)::int n FROM onto_role_competency_profiles');
        measurable = measurable || profCount > 0;
        checks.push(check('profiles_present', 'Role-competency profiles present', profCount > 0 ? 'pass' : 'warn',
          `${profCount} role-competency requirement row(s).`));
        const badLevel = await num(pool, 'SELECT COUNT(*)::int n FROM onto_role_competency_profiles WHERE required_level IS NOT NULL AND required_level < 0');
        checks.push(check('required_level_non_negative', 'required_level non-negative or null', badLevel === 0 ? 'pass' : 'fail',
          badLevel === 0 ? 'required_level within range.' : `${badLevel} negative required_level.`));
        const badWeight = await num(pool, 'SELECT COUNT(*)::int n FROM onto_role_competency_profiles WHERE weight IS NOT NULL AND weight < 0');
        checks.push(check('weight_non_negative', 'weight non-negative or null', badWeight === 0 ? 'pass' : 'fail',
          badWeight === 0 ? 'weights non-negative.' : `${badWeight} negative weight(s).`));
      }

      return area('job_architecture', 'Job Architecture', 'platform', measurable, checks, notes);
    }),
  );

  // 4 — Job Posting (subject) ───────────────────────────────────────────────────
  areas.push(
    await runArea('job_posting', 'Job Posting', 'subject', async () => {
      if (!(await tableExists(pool, 'employer_jobs'))) {
        return notProvisionedArea('job_posting', 'Job Posting', 'subject', 'employer_jobs');
      }
      const jobCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_jobs WHERE employer_id=$1', [sid]);
      const measurable = jobCount > 0;
      const checks: ValidationCheck[] = [];
      checks.push(check('jobs_present', 'Jobs exist for subject', measurable ? 'pass' : 'warn',
        measurable ? `${jobCount} job(s).` : 'no jobs for subject (honest absence).'));

      const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM employer_jobs WHERE employer_id=$1 AND status IS NOT NULL AND NOT (status = ANY($2))', [sid, JOB_STATUS_VALUES]);
      checks.push(check('status_in_canon', 'Job status within canonical set', badStatus === 0 ? 'pass' : 'fail',
        badStatus === 0 ? 'all statuses canonical.' : `${badStatus} job(s) with out-of-canon status.`));

      const badSalary = await num(pool, 'SELECT COUNT(*)::int n FROM employer_jobs WHERE employer_id=$1 AND salary_min IS NOT NULL AND salary_max IS NOT NULL AND salary_min > salary_max', [sid]);
      checks.push(check('salary_band_coherent', 'salary_min ≤ salary_max when both present', badSalary === 0 ? 'pass' : 'fail',
        badSalary === 0 ? 'salary bands coherent.' : `${badSalary} job(s) with min > max.`));

      const negCounts = await num(pool, 'SELECT COUNT(*)::int n FROM employer_jobs WHERE employer_id=$1 AND ((application_count IS NOT NULL AND application_count < 0) OR (quota IS NOT NULL AND quota < 0))', [sid]);
      checks.push(check('counts_non_negative', 'application_count / quota non-negative', negCounts === 0 ? 'pass' : 'fail',
        negCounts === 0 ? 'counts non-negative.' : `${negCounts} job(s) with negative count.`));

      // Distribution integrity (job_distributions.job_id must resolve to an employer_jobs row).
      if (await tableExists(pool, 'job_distributions')) {
        const orphanDist = await num(pool, 'SELECT COUNT(*)::int n FROM job_distributions d WHERE NOT EXISTS (SELECT 1 FROM employer_jobs j WHERE j.id = d.job_id)');
        checks.push(check('distributions_resolve', 'Every distribution resolves to a job', orphanDist === 0 ? 'pass' : 'fail',
          orphanDist === 0 ? 'all distributions resolve.' : `${orphanDist} orphan distribution(s).`));
        const badChannel = await num(pool, 'SELECT COUNT(*)::int n FROM job_distributions WHERE channel IS NOT NULL AND NOT (channel = ANY($1))', [CHANNEL_VALUES]);
        checks.push(check('channel_in_catalog', 'Distribution channel within catalog', badChannel === 0 ? 'pass' : 'warn',
          badChannel === 0 ? 'all channels in catalog.' : `${badChannel} distribution(s) with unrecognised channel (catalog uncertainty, not a hard fail).`));
      }

      return area('job_posting', 'Job Posting', 'subject', measurable, checks);
    }),
  );

  // 5 — Talent Search (platform) ────────────────────────────────────────────────
  areas.push(
    await runArea('talent_search', 'Talent Search', 'platform', async () => {
      const hasPools = await tableExists(pool, 'talent_pools');
      const hasShortlists = await tableExists(pool, 'talent_shortlists');
      const hasSaved = await tableExists(pool, 'talent_saved_searches');
      if (!hasPools && !hasShortlists && !hasSaved) {
        return notProvisionedArea('talent_search', 'Talent Search', 'platform', 'talent_pools / talent_shortlists / talent_saved_searches');
      }
      const checks: ValidationCheck[] = [];
      let measurable = false;

      if (hasPools) {
        const poolCount = await num(pool, 'SELECT COUNT(*)::int n FROM talent_pools');
        measurable = measurable || poolCount > 0;
        checks.push(check('pools_present', 'Talent pools present', poolCount > 0 ? 'pass' : 'warn', `${poolCount} pool(s).`));
        if (await tableExists(pool, 'talent_pool_members')) {
          const orphanMembers = await num(pool, 'SELECT COUNT(*)::int n FROM talent_pool_members m WHERE NOT EXISTS (SELECT 1 FROM talent_pools p WHERE p.id = m.pool_id)');
          checks.push(check('pool_members_resolve', 'Every pool member resolves to a pool', orphanMembers === 0 ? 'pass' : 'fail',
            orphanMembers === 0 ? 'all pool members resolve.' : `${orphanMembers} orphan pool member(s).`));
        }
      }
      if (hasShortlists) {
        const slCount = await num(pool, 'SELECT COUNT(*)::int n FROM talent_shortlists');
        measurable = measurable || slCount > 0;
        checks.push(check('shortlists_present', 'Talent shortlists present', slCount > 0 ? 'pass' : 'warn', `${slCount} shortlist(s).`));
        if (await tableExists(pool, 'talent_shortlist_members')) {
          const orphanSl = await num(pool, 'SELECT COUNT(*)::int n FROM talent_shortlist_members m WHERE NOT EXISTS (SELECT 1 FROM talent_shortlists s WHERE s.id = m.shortlist_id)');
          checks.push(check('shortlist_members_resolve', 'Every shortlist member resolves to a shortlist', orphanSl === 0 ? 'pass' : 'fail',
            orphanSl === 0 ? 'all shortlist members resolve.' : `${orphanSl} orphan shortlist member(s).`));
        }
      }
      if (hasSaved) {
        const ssCount = await num(pool, 'SELECT COUNT(*)::int n FROM talent_saved_searches');
        measurable = measurable || ssCount > 0;
        checks.push(check('saved_searches_present', 'Saved searches present', ssCount > 0 ? 'pass' : 'warn', `${ssCount} saved search(es).`));
      }

      return area('talent_search', 'Talent Search', 'platform', measurable, checks);
    }),
  );

  // 6 — Matching (subject) ──────────────────────────────────────────────────────
  areas.push(
    await runArea('matching', 'Matching', 'subject', async () => {
      if (!(await tableExists(pool, 'employer_candidates'))) {
        return notProvisionedArea('matching', 'Matching', 'subject', 'employer_candidates');
      }
      const candCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [sid]);
      const measurable = candCount > 0;
      const checks: ValidationCheck[] = [];
      checks.push(check('candidates_present', 'Candidates exist for subject', measurable ? 'pass' : 'warn',
        measurable ? `${candCount} candidate(s).` : 'no candidates for subject (honest absence).'));

      // match_score / ei_score must be within [0,100] when present — out-of-bounds = fabricated.
      const badMatch = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND match_score IS NOT NULL AND (match_score < 0 OR match_score > 100)', [sid]);
      checks.push(check('match_score_bounds', 'match_score within [0,100] or null', badMatch === 0 ? 'pass' : 'fail',
        badMatch === 0 ? 'all match_scores in range.' : `${badMatch} candidate(s) with out-of-bounds match_score.`));
      const badEi = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND ei_score IS NOT NULL AND (ei_score < 0 OR ei_score > 100)', [sid]);
      checks.push(check('ei_score_bounds', 'ei_score within [0,100] or null', badEi === 0 ? 'pass' : 'fail',
        badEi === 0 ? 'all ei_scores in range.' : `${badEi} candidate(s) with out-of-bounds ei_score.`));

      // Coverage axis: how many candidates actually carry a match_score (null ≠ 0).
      const scored = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND match_score IS NOT NULL', [sid]);
      checks.push(check('match_coverage', 'Match-score coverage (Coverage axis)', measurable ? (scored > 0 ? 'pass' : 'warn') : 'warn',
        `${scored}/${candCount} candidate(s) carry a match_score (null is not 0).`));

      // Confidence axis: requirement backing exists (else matches are Provisional).
      let reqRows = 0;
      if (await tableExists(pool, 'onto_role_competency_profiles')) {
        reqRows = await num(pool, 'SELECT COUNT(*)::int n FROM onto_role_competency_profiles');
      }
      checks.push(check('requirement_backing', 'Requirement backing present (Confidence axis)', reqRows > 0 ? 'pass' : 'warn',
        reqRows > 0 ? `${reqRows} role-competency requirement row(s) back matching.` : 'no requirement backing — matches are Provisional (Confidence gap, not a failure).'));

      return area('matching', 'Matching', 'subject', measurable, checks);
    }),
  );

  // 7 — Assessments (subject) ───────────────────────────────────────────────────
  areas.push(
    await runArea('assessments', 'Assessments', 'subject', async () => {
      if (!(await tableExists(pool, 'employer_candidates'))) {
        return notProvisionedArea('assessments', 'Assessments', 'subject', 'employer_candidates');
      }
      const checks: ValidationCheck[] = [];
      const notes: string[] = [];
      const sent = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND assessment_sent = TRUE', [sid]);
      const scored = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND assessment_score IS NOT NULL', [sid]);
      const total = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [sid]);
      const measurable = sent > 0 || scored > 0;
      checks.push(check('assessment_activity', 'Assessment activity for subject', measurable ? 'pass' : 'warn',
        measurable ? `${sent} sent, ${scored} scored of ${total} candidate(s).` : 'no assessment activity for subject (honest absence).'));

      const badScore = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND assessment_score IS NOT NULL AND (assessment_score < 0 OR assessment_score > 100)', [sid]);
      checks.push(check('assessment_score_bounds', 'assessment_score within [0,100] or null', badScore === 0 ? 'pass' : 'fail',
        badScore === 0 ? 'all assessment_scores in range.' : `${badScore} candidate(s) with out-of-bounds assessment_score.`));

      // A score must imply the assessment was sent (no score without an invite).
      const scoreWithoutSent = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1 AND assessment_score IS NOT NULL AND COALESCE(assessment_sent, FALSE) = FALSE', [sid]);
      checks.push(check('score_implies_sent', 'A scored assessment was sent', scoreWithoutSent === 0 ? 'pass' : 'fail',
        scoreWithoutSent === 0 ? 'every score has a corresponding sent flag.' : `${scoreWithoutSent} scored candidate(s) never marked sent.`));

      if (!(await tableExists(pool, 'hiring_assessment_invites'))) {
        notes.push('Dedicated hiring_assessment_* tables not provisioned in this environment — assessment state read from employer_candidates (honest absence).');
      }
      return area('assessments', 'Assessments', 'subject', measurable, checks, notes);
    }),
  );

  // 8 — Shortlisting (subject) ──────────────────────────────────────────────────
  areas.push(
    await runArea('shortlisting', 'Shortlisting', 'subject', async () => {
      if (!(await tableExists(pool, 'candidate_pipeline'))) {
        return notProvisionedArea('shortlisting', 'Shortlisting', 'subject', 'candidate_pipeline');
      }
      const pipeCount = await num(pool, 'SELECT COUNT(*)::int n FROM candidate_pipeline WHERE employer_id=$1', [sid]);
      const measurable = pipeCount > 0;
      const checks: ValidationCheck[] = [];
      checks.push(check('pipeline_present', 'Pipeline entries exist for subject', measurable ? 'pass' : 'warn',
        measurable ? `${pipeCount} pipeline entry(ies).` : 'no pipeline for subject (honest absence).'));

      const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM candidate_pipeline WHERE employer_id=$1 AND status IS NOT NULL AND NOT (status = ANY($2))', [sid, PIPELINE_STATUSES as string[]]);
      checks.push(check('status_in_canon', 'Pipeline status within canonical FSM', badStatus === 0 ? 'pass' : 'fail',
        badStatus === 0 ? 'all statuses canonical.' : `${badStatus} entry(ies) with out-of-canon status.`));

      const badOrder = await num(pool, 'SELECT COUNT(*)::int n FROM candidate_pipeline WHERE employer_id=$1 AND stage_order IS NOT NULL AND stage_order < 0', [sid]);
      checks.push(check('stage_order_non_negative', 'stage_order non-negative or null', badOrder === 0 ? 'pass' : 'fail',
        badOrder === 0 ? 'stage_order within range.' : `${badOrder} entry(ies) with negative stage_order.`));

      if (await tableExists(pool, 'workflow_transitions')) {
        const orphanTx = await num(pool, 'SELECT COUNT(*)::int n FROM workflow_transitions t WHERE t.employer_id=$1 AND NOT EXISTS (SELECT 1 FROM candidate_pipeline p WHERE p.id = t.pipeline_id)', [sid]);
        checks.push(check('transitions_resolve', 'Every transition resolves to a pipeline entry', orphanTx === 0 ? 'pass' : 'fail',
          orphanTx === 0 ? 'all transitions resolve.' : `${orphanTx} orphan transition(s).`));
        const badTxStatus = await num(pool, 'SELECT COUNT(*)::int n FROM workflow_transitions WHERE employer_id=$1 AND ((from_status IS NOT NULL AND NOT (from_status = ANY($2))) OR (to_status IS NOT NULL AND NOT (to_status = ANY($2))))', [sid, PIPELINE_STATUSES as string[]]);
        checks.push(check('transition_status_in_canon', 'Transition from/to status within canonical FSM', badTxStatus === 0 ? 'pass' : 'fail',
          badTxStatus === 0 ? 'all transition states canonical.' : `${badTxStatus} transition(s) with out-of-canon state.`));
      }

      return area('shortlisting', 'Shortlisting', 'subject', measurable, checks);
    }),
  );

  // 9 — Interviewing (subject) ──────────────────────────────────────────────────
  areas.push(
    await runArea('interviewing', 'Interviewing', 'subject', async () => {
      if (!(await tableExists(pool, 'interview_schedules'))) {
        return notProvisionedArea('interviewing', 'Interviewing', 'subject', 'interview_schedules');
      }
      const ivCount = await num(pool, 'SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1', [sid]);
      const measurable = ivCount > 0;
      const checks: ValidationCheck[] = [];
      checks.push(check('schedules_present', 'Interview schedules exist for subject', measurable ? 'pass' : 'warn',
        measurable ? `${ivCount} interview schedule(s).` : 'no interviews for subject (honest absence).'));

      const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1 AND status IS NOT NULL AND NOT (status = ANY($2))', [sid, INTERVIEW_STATUSES as string[]]);
      checks.push(check('status_in_canon', 'Interview status within canonical set', badStatus === 0 ? 'pass' : 'fail',
        badStatus === 0 ? 'all statuses canonical.' : `${badStatus} schedule(s) with out-of-canon status.`));
      const badMode = await num(pool, 'SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1 AND mode IS NOT NULL AND NOT (mode = ANY($2))', [sid, INTERVIEW_MODES as string[]]);
      checks.push(check('mode_in_canon', 'Interview mode within canonical set or null', badMode === 0 ? 'pass' : 'fail',
        badMode === 0 ? 'all modes canonical.' : `${badMode} schedule(s) with out-of-canon mode.`));
      const badDuration = await num(pool, 'SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1 AND duration_mins IS NOT NULL AND duration_mins < 0', [sid]);
      checks.push(check('duration_non_negative', 'duration_mins non-negative or null', badDuration === 0 ? 'pass' : 'fail',
        badDuration === 0 ? 'durations non-negative.' : `${badDuration} schedule(s) with negative duration.`));

      if (await tableExists(pool, 'interview_scores')) {
        const badScore = await num(pool, 'SELECT COUNT(*)::int n FROM interview_scores WHERE employer_id=$1 AND ((score IS NOT NULL AND score < 0) OR (score IS NOT NULL AND max_score IS NOT NULL AND score > max_score))', [sid]);
        checks.push(check('scores_within_max', 'Interview score within [0, max_score]', badScore === 0 ? 'pass' : 'fail',
          badScore === 0 ? 'all scores within bounds.' : `${badScore} score(s) negative or exceeding max_score.`));
      }
      if (await tableExists(pool, 'interview_decisions')) {
        const badDecision = await num(pool, 'SELECT COUNT(*)::int n FROM interview_decisions WHERE employer_id=$1 AND decision IS NOT NULL AND NOT (decision = ANY($2))', [sid, DECISION_TYPES as string[]]);
        checks.push(check('decision_in_canon', 'Interview decision within canonical set', badDecision === 0 ? 'pass' : 'fail',
          badDecision === 0 ? 'all decisions canonical.' : `${badDecision} decision(s) out-of-canon.`));
      }

      return area('interviewing', 'Interviewing', 'subject', measurable, checks);
    }),
  );

  // 10 — Hiring (subject) ───────────────────────────────────────────────────────
  areas.push(
    await runArea('hiring', 'Hiring', 'subject', async () => {
      const hasOffers = await tableExists(pool, 'employer_offers');
      const hasDecisions = await tableExists(pool, 'interview_decisions');
      if (!hasOffers && !hasDecisions) {
        return notProvisionedArea('hiring', 'Hiring', 'subject', 'employer_offers / interview_decisions');
      }
      const checks: ValidationCheck[] = [];
      let measurable = false;

      if (hasOffers) {
        const offerCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_offers WHERE employer_id=$1', [sid]);
        measurable = measurable || offerCount > 0;
        checks.push(check('offers_present', 'Offers exist for subject', offerCount > 0 ? 'pass' : 'warn',
          offerCount > 0 ? `${offerCount} offer(s).` : 'no offers for subject (honest absence).'));
        const negCtc = await num(pool, 'SELECT COUNT(*)::int n FROM employer_offers WHERE employer_id=$1 AND ((ctc_fixed IS NOT NULL AND ctc_fixed < 0) OR (ctc_variable IS NOT NULL AND ctc_variable < 0) OR (ctc_bonus IS NOT NULL AND ctc_bonus < 0) OR (total_ctc IS NOT NULL AND total_ctc < 0) OR (counter_amount IS NOT NULL AND counter_amount < 0))', [sid]);
        checks.push(check('ctc_non_negative', 'All CTC components non-negative', negCtc === 0 ? 'pass' : 'fail',
          negCtc === 0 ? 'CTC components non-negative.' : `${negCtc} offer(s) with a negative CTC component.`));
        const totalBelowFixed = await num(pool, 'SELECT COUNT(*)::int n FROM employer_offers WHERE employer_id=$1 AND total_ctc IS NOT NULL AND ctc_fixed IS NOT NULL AND total_ctc < ctc_fixed', [sid]);
        checks.push(check('total_ctc_coherent', 'total_ctc ≥ ctc_fixed when both present', totalBelowFixed === 0 ? 'pass' : 'warn',
          totalBelowFixed === 0 ? 'totals coherent with fixed.' : `${totalBelowFixed} offer(s) with total below fixed (review).`));
      }
      if (hasDecisions) {
        const hireCount = await num(pool, "SELECT COUNT(*)::int n FROM interview_decisions WHERE employer_id=$1 AND decision = 'hire'", [sid]);
        measurable = measurable || hireCount > 0;
        checks.push(check('hire_decisions', 'Hire decisions recorded for subject', hireCount > 0 ? 'pass' : 'warn',
          `${hireCount} hire decision(s).`));
      }

      return area('hiring', 'Hiring', 'subject', measurable, checks);
    }),
  );

  // 11 — Workforce Intelligence (subject) — COMPOSE the 5.12 pure engine ─────────
  areas.push(
    await runArea('workforce_intelligence', 'Workforce Intelligence', 'subject', async () => {
      const checks: ValidationCheck[] = [];
      let measurable = false;
      if (await tableExists(pool, 'employer_candidates')) {
        const candCount = await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [sid]);
        measurable = candCount > 0;
        checks.push(check('workforce_data', 'Workforce data exists for subject', measurable ? 'pass' : 'warn',
          measurable ? `${candCount} candidate(s) feed workforce intelligence.` : 'no workforce data for subject (honest absence).'));
      } else {
        checks.push(check('workforce_data', 'Workforce data table provisioned', 'warn', 'employer_candidates absent (honest absence).'));
      }

      // Compose the 0-DDL pure engine and assert a well-formed EngineResult (read-path health).
      const dist = await computeTalentDistribution(pool, sid);
      const dept = await computeDepartmentReadiness(pool, sid);
      const wellFormed = (r: any) => r && typeof r.ok === 'boolean' && (r.ok ? r.data !== undefined : typeof r.code === 'string');
      checks.push(check('distribution_engine', 'Talent distribution engine returns a well-formed result', wellFormed(dist) ? 'pass' : 'fail',
        wellFormed(dist) ? `ok=${dist.ok}` : 'distribution engine returned a malformed envelope.'));
      checks.push(check('department_engine', 'Department readiness engine returns a well-formed result', wellFormed(dept) ? 'pass' : 'fail',
        wellFormed(dept) ? `ok=${dept.ok}` : 'department engine returned a malformed envelope.'));

      return area('workforce_intelligence', 'Workforce Intelligence', 'subject', measurable, checks);
    }),
  );

  // 12 — Notifications (subject) — COMPOSE the 5.14 pure engine ──────────────────
  areas.push(
    await runArea('notifications', 'Notifications', 'subject', async () => {
      const checks: ValidationCheck[] = [];
      const wellFormed = (r: any) => r && typeof r.ok === 'boolean' && (r.ok ? r.data !== undefined : typeof r.code === 'string');

      const notif = await computeNotifications(pool, sid);
      const wf = await computeWorkflowNotifications(pool, sid);
      const comm = await computeCommunications(pool, sid);
      checks.push(check('notification_engine', 'Notification feed returns a well-formed result', wellFormed(notif) ? 'pass' : 'fail',
        wellFormed(notif) ? `ok=${notif.ok}` : 'notification feed returned a malformed envelope.'));
      checks.push(check('workflow_engine', 'Workflow notifications return a well-formed result', wellFormed(wf) ? 'pass' : 'fail',
        wellFormed(wf) ? `ok=${wf.ok}` : 'workflow notifications returned a malformed envelope.'));
      checks.push(check('communication_engine', 'Communication previews return a well-formed result', wellFormed(comm) ? 'pass' : 'fail',
        wellFormed(comm) ? `ok=${comm.ok}` : 'communication previews returned a malformed envelope.'));

      // measurable = alerts derivable (subject has jobs or candidates).
      let measurable = false;
      if (await tableExists(pool, 'employer_candidates')) {
        measurable = (await num(pool, 'SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [sid])) > 0;
      }
      checks.push(check('notifications_measurable', 'Notification source data exists for subject', measurable ? 'pass' : 'warn',
        measurable ? 'subject has candidates to derive alerts from.' : 'no source data for subject (honest absence).'));

      // CRITICAL invariant: communications NEVER carry candidate PII and NEVER mark delivered.
      const messages: any[] = (comm as any)?.ok ? ((comm as any).data?.messages ?? []) : [];
      const anyDelivered = messages.some((m) => m?.delivered === true);
      checks.push(check('never_sends', 'Communication previews are never marked delivered', !anyDelivered ? 'pass' : 'fail',
        !anyDelivered ? `${messages.length} preview(s), all delivered=false (nothing dispatched).` : 'a preview was marked delivered — this engine must never send.'));

      let pii = false;
      if (messages.length && (await tableExists(pool, 'employer_candidates'))) {
        const er = await pool.query<{ email: string }>('SELECT email FROM employer_candidates WHERE employer_id=$1 AND email IS NOT NULL', [sid]);
        const emails = er.rows.map((r) => String(r.email).toLowerCase()).filter(Boolean);
        const haystack = messages.map((m) => `${m?.subject ?? ''} ${m?.body_preview ?? ''}`).join(' \u0001 ').toLowerCase();
        pii = emails.some((e) => haystack.includes(e));
      }
      checks.push(check('no_candidate_pii', 'Communication previews contain no candidate contact PII', !pii ? 'pass' : 'fail',
        !pii ? 'no candidate email leaked into previews.' : 'a candidate email leaked into a communication preview.'));

      return area('notifications', 'Notifications', 'subject', measurable, checks);
    }),
  );

  // 13 — Permissions (platform) ─────────────────────────────────────────────────
  areas.push(
    await runArea('permissions', 'Permissions', 'platform', async () => {
      const hasWos = await tableExists(pool, 'wos_roles');
      const hasDefs = await tableExists(pool, 'role_definitions');
      if (!hasWos && !hasDefs) {
        return notProvisionedArea('permissions', 'Permissions', 'platform', 'wos_roles / role_definitions');
      }
      const checks: ValidationCheck[] = [];
      let measurable = false;

      if (hasWos) {
        const roleCount = await num(pool, 'SELECT COUNT(*)::int n FROM wos_roles');
        measurable = measurable || roleCount > 0;
        checks.push(check('wos_roles_present', 'WOS roles present', roleCount > 0 ? 'pass' : 'warn', `${roleCount} role(s).`));
        if (await tableExists(pool, 'wos_role_assignments')) {
          const orphanAssign = await num(pool, 'SELECT COUNT(*)::int n FROM wos_role_assignments a WHERE NOT EXISTS (SELECT 1 FROM wos_roles r WHERE r.id = a.role_id)');
          checks.push(check('assignments_resolve', 'Every role assignment resolves to a role', orphanAssign === 0 ? 'pass' : 'fail',
            orphanAssign === 0 ? 'all assignments resolve.' : `${orphanAssign} orphan assignment(s).`));
          const badExpiry = await num(pool, 'SELECT COUNT(*)::int n FROM wos_role_assignments WHERE expires_at IS NOT NULL AND granted_at IS NOT NULL AND expires_at < granted_at');
          checks.push(check('expiry_after_grant', 'Assignment expiry is after grant when present', badExpiry === 0 ? 'pass' : 'warn',
            badExpiry === 0 ? 'expiries coherent.' : `${badExpiry} assignment(s) expire before grant (review).`));
        }
      }
      if (hasDefs) {
        const defCount = await num(pool, 'SELECT COUNT(*)::int n FROM role_definitions');
        measurable = measurable || defCount > 0;
        checks.push(check('role_definitions_present', 'Role definitions present', defCount > 0 ? 'pass' : 'warn', `${defCount} role definition(s).`));
        if (await tableExists(pool, 'role_permissions')) {
          const orphanPerm = await num(pool, 'SELECT COUNT(*)::int n FROM role_permissions rp WHERE NOT EXISTS (SELECT 1 FROM role_definitions rd WHERE rd.id = rp.role_id)');
          checks.push(check('permissions_resolve', 'Every role_permission resolves to a role definition', orphanPerm === 0 ? 'pass' : 'fail',
            orphanPerm === 0 ? 'all role_permissions resolve.' : `${orphanPerm} orphan role_permission(s).`));
        }
      }

      return area('permissions', 'Permissions', 'platform', measurable, checks);
    }),
  );

  // 14 — Audit Logs (platform + subject coverage) ───────────────────────────────
  areas.push(
    await runArea('audit_logs', 'Audit Logs', 'platform', async () => {
      const candidates = ['platform_audit_log', 'admin_audit_logs', 'capadex_audit_events', 'employer_audit_logs'];
      const present: string[] = [];
      for (const t of candidates) if (await tableExists(pool, t)) present.push(t);
      if (present.length === 0) {
        return notProvisionedArea('audit_logs', 'Audit Logs', 'platform', candidates.join(' / '));
      }
      const checks: ValidationCheck[] = [];
      let totalRows = 0;
      let nullTs = 0;
      for (const t of present) {
        totalRows += await num(pool, `SELECT COUNT(*)::int n FROM ${t}`);
        nullTs += await num(pool, `SELECT COUNT(*)::int n FROM ${t} WHERE created_at IS NULL`);
      }
      const measurable = totalRows > 0;
      checks.push(check('audit_tables_present', 'At least one audit log table provisioned', 'pass',
        `${present.length} audit table(s): ${present.join(', ')}.`));
      checks.push(check('audit_coverage', 'Audit log entries exist (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? `${totalRows} audit row(s).` : 'no audit rows yet (Coverage gap, not a failure).'));
      checks.push(check('created_at_present', 'Every audit row carries a timestamp', nullTs === 0 ? 'pass' : 'fail',
        nullTs === 0 ? 'all audit rows timestamped.' : `${nullTs} audit row(s) missing created_at.`));

      if (present.includes('employer_audit_logs')) {
        const subjectRows = await num(pool, 'SELECT COUNT(*)::int n FROM employer_audit_logs WHERE org_id=$1', [sid]);
        checks.push(check('subject_audit_coverage', 'Subject-scoped audit coverage', subjectRows > 0 ? 'pass' : 'warn',
          `${subjectRows} audit row(s) for subject (null is not 0).`));
        const badRisk = await num(pool, 'SELECT COUNT(*)::int n FROM employer_audit_logs WHERE risk_score IS NOT NULL AND (risk_score < 0 OR risk_score > 100)', []);
        checks.push(check('risk_score_bounds', 'employer audit risk_score within [0,100] or null', badRisk === 0 ? 'pass' : 'fail',
          badRisk === 0 ? 'risk_scores within range.' : `${badRisk} audit row(s) with out-of-bounds risk_score.`));
      }

      return area('audit_logs', 'Audit Logs', 'platform', measurable, checks);
    }),
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  const pass = areas.filter((a) => a.status === 'pass').length;
  const warn = areas.filter((a) => a.status === 'warn').length;
  const fail = areas.filter((a) => a.status === 'fail').length;
  const measurable_areas = areas.filter((a) => a.measurable).length;

  return {
    ok: true,
    subject_id: sid,
    version: SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION,
    generated_at: new Date().toISOString(),
    areas,
    summary: {
      areas_total: areas.length,
      pass,
      warn,
      fail,
      status: worst(areas.map((a) => a.status)),
      measurable_areas,
    },
    disclaimer: EMPLOYER_VALIDATION_DISCLAIMER,
    notes: [
      'Read-only honesty/invariant harness across fourteen employer/talent areas.',
      'WARN = honest absence / not measurable; FAIL = a real invariant break.',
      'Coverage and Confidence are reported as separate axes; a missing value is null, never 0.',
    ],
  };
}

/** Static catalog of the validated areas (no DB touch — used by the /catalog route). */
export function employerValidationCatalog() {
  return {
    version: SUPER_ADMIN_EMPLOYER_VALIDATION_VERSION,
    areas: [
      { id: 'employer_setup', label: 'Employer Setup', scope: 'subject' },
      { id: 'organization_setup', label: 'Organization Setup', scope: 'platform' },
      { id: 'job_architecture', label: 'Job Architecture', scope: 'platform' },
      { id: 'job_posting', label: 'Job Posting', scope: 'subject' },
      { id: 'talent_search', label: 'Talent Search', scope: 'platform' },
      { id: 'matching', label: 'Matching', scope: 'subject' },
      { id: 'assessments', label: 'Assessments', scope: 'subject' },
      { id: 'shortlisting', label: 'Shortlisting', scope: 'subject' },
      { id: 'interviewing', label: 'Interviewing', scope: 'subject' },
      { id: 'hiring', label: 'Hiring', scope: 'subject' },
      { id: 'workforce_intelligence', label: 'Workforce Intelligence', scope: 'subject' },
      { id: 'notifications', label: 'Notifications', scope: 'subject' },
      { id: 'permissions', label: 'Permissions', scope: 'platform' },
      { id: 'audit_logs', label: 'Audit Logs', scope: 'platform' },
    ],
    statuses: ['pass', 'warn', 'fail'],
    disclaimer: EMPLOYER_VALIDATION_DISCLAIMER,
  };
}
