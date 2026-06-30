/**
 * MX-302H — Institutional Intelligence engine (additive, read-only, never-throws).
 *
 * Wires the previously-MOCK institutional dashboards (University / Faculty /
 * Placement Officer / Parent) to REAL institute-scoped aggregation. It COMPOSES
 * existing persisted substrates — it performs NO new scoring and writes NOTHING:
 *
 *   - Student readiness   → `career_readiness_history` (append-only snapshots)
 *   - Competency profiles → `onto_competency_profiles`
 *   - Employer offers     → `employer_offers` (candidate_id ↔ students.user_id)
 *   - Accreditation       → `institution_accreditations`
 *   - Cohort gating       → `cohort-gating.ts` applyKAnonymity (k_min=30 / k_verified=100)
 *
 * Honesty contract:
 *   - Every SCORE aggregate (readiness, heatmap, placement rate, CTC, gaps) is
 *     passed through k-anonymity → masked (<30) returns NULL benchmarks, never a
 *     fabricated number. Roster counts (total / assessed / batches) are the
 *     institute's OWN operational data and are always shown (not a peer-benchmark
 *     leak) — but score distributions over a tiny roster are masked.
 *   - Coverage (does data exist) and Confidence (cohort status) are SEPARATE axes.
 *   - null ≠ 0: a missing aggregate is `null`, never coerced to 0.
 *   - Department analytics aggregate by existing `batches` (founder decision #3 —
 *     no `departments` table exists; department splits are NEVER fabricated).
 *   - Placement substrate (placement_drives / placement_applications, MX-302E) is
 *     reported as honest-unavailable when absent — never a fabricated funnel.
 *   - Role-aware tenant scoping: institute + role resolved from
 *     `institutes.admin_user_id` (institute_admin) OR `institute_staff→staff_roles`
 *     (placement_officer / faculty / staff); faculty is batch-confined via
 *     `staff_batch_assignments`. Parent reads gated by `parent_student_links` + DPDP
 *     consent. No cross-institute leakage.
 *   - GET-never-writes: zero DDL; every probe uses to_regclass and degrades to a
 *     safe envelope. never-throws: any failure returns an honest degraded result.
 */

import type { Pool } from 'pg';
import { applyKAnonymity, K_MIN, K_VERIFIED, type CohortStatus } from './cohort-gating';
import { assessIndustryGaps } from './industry-gap-engine';
import type { ReadinessResult } from './role-competency-profile';

export const INSTITUTIONAL_INTELLIGENCE_VERSION = '302h.1.0';

// ── Shared types ─────────────────────────────────────────────────────────────

/** Role a caller holds over an institute (drives which surfaces they may read). */
export type InstituteRole = 'institute_admin' | 'placement_officer' | 'faculty' | 'staff';

export interface InstituteScope {
  institute_id: string;
  display_name: string;
  institute_code: string;
  status: string;
  /** Resolved role of the caller over THIS institute (authz axis). */
  role: InstituteRole;
  /** institute_staff.id for staff callers (null for the institute admin/owner). */
  staff_id: string | null;
  /** staff_roles.role_code for staff callers (null for the institute admin/owner). */
  role_code: string | null;
  /** Batch ids a faculty caller is scoped to. null = all batches (admin/officer). */
  allowed_batch_ids: string[] | null;
}

export interface CohortGate {
  n: number;
  status: CohortStatus;
  k_min: number;
  k_verified: number;
  privacy_notice: string;
}

interface ReadinessAgg {
  measurable_count: number;
  avg_overall: number | null;
  avg_current: number | null;
  avg_future: number | null;
  avg_role: number | null;
  avg_growth: number | null;
  high_readiness: number;
  at_risk: number;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    return !!r.rows[0]?.reg;
  } catch {
    return false;
  }
}

/** pg numeric/avg → number|null (null = honestly absent, never coerced to 0). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function gateFromN(n: number): CohortGate {
  const g = applyKAnonymity(n, null);
  return { n, status: g.cohort_status, k_min: K_MIN, k_verified: K_VERIFIED, privacy_notice: g.privacy_notice };
}

// ── Tenant scope resolvers ───────────────────────────────────────────────────

/** Classify a staff_roles.role_code into the canonical institutional role we
 *  authorise against. Data-driven (role codes are free text) → match on tokens,
 *  never fabricate a role the row doesn't carry. Unknown staff → generic 'staff'. */
export function classifyStaffRole(roleCode: string | null | undefined, roleName?: string | null): InstituteRole {
  const hay = `${roleCode ?? ''} ${roleName ?? ''}`.toLowerCase();
  if (/\b(admin|principal|director|head)\b/.test(hay) || /institute_admin/.test(hay)) return 'institute_admin';
  if (/placement|tpo|career.?services|recruit/.test(hay)) return 'placement_officer';
  if (/faculty|teacher|professor|lecturer|mentor|tutor|instructor/.test(hay)) return 'faculty';
  return 'staff';
}

/** Resolve the institute + ROLE a caller holds. Strict tenant boundary — returns
 *  null when the user neither owns nor is staff of any institute (caller → 403).
 *
 *  Resolution order:
 *    1. institute OWNER (institutes.admin_user_id) → role 'institute_admin', all batches.
 *    2. institute STAFF (institute_staff → staff_roles) → role classified from the
 *       staff role code; faculty additionally batch-scoped via staff_batch_assignments
 *       (allowed_batch_ids = their assigned batches; empty array → sees no batch). */
export async function resolveInstituteForUser(pool: Pool, userId: string): Promise<InstituteScope | null> {
  const uid = String(userId ?? '').trim();
  if (!uid) return null;
  try {
    // 1. Institute owner / admin.
    const owner = await pool.query<{ id: string; display_name: string; institute_code: string; status: string }>(
      `SELECT id, display_name, institute_code, status
         FROM institutes WHERE admin_user_id = $1 LIMIT 1`,
      [uid],
    );
    const orow = owner.rows[0];
    if (orow) {
      return {
        institute_id: orow.id, display_name: orow.display_name, institute_code: orow.institute_code,
        status: orow.status, role: 'institute_admin', staff_id: null, role_code: null, allowed_batch_ids: null,
      };
    }

    // 2. Institute staff (faculty / placement officer / other) — requires the staff
    //    linkage tables to exist (older envs may not have them → honest null).
    if (!(await tableExists(pool, 'institute_staff')) || !(await tableExists(pool, 'staff_roles'))) return null;
    const staff = await pool.query<{
      staff_id: string; institute_id: string; display_name: string; institute_code: string;
      status: string; role_code: string | null; role_name: string | null;
    }>(
      `SELECT st.id AS staff_id, i.id AS institute_id, i.display_name, i.institute_code, i.status,
              sr.role_code, sr.role_name
         FROM institute_staff st
         JOIN institutes i  ON i.id  = st.institute_id
         JOIN staff_roles sr ON sr.id = st.role_id
        WHERE st.user_id = $1 AND st.status = 'Active'
        ORDER BY st.joined_at DESC
        LIMIT 1`,
      [uid],
    );
    const srow = staff.rows[0];
    if (!srow) return null;

    const role = classifyStaffRole(srow.role_code, srow.role_name);
    let allowedBatchIds: string[] | null = null;
    if (role === 'faculty') {
      // Faculty is scoped to the batches they are actively assigned to.
      allowedBatchIds = [];
      if (await tableExists(pool, 'staff_batch_assignments')) {
        const b = await pool.query<{ batch_id: string }>(
          `SELECT batch_id FROM staff_batch_assignments WHERE staff_id = $1 AND status = 'Active'`,
          [srow.staff_id],
        );
        allowedBatchIds = b.rows.map((x) => x.batch_id);
      }
    }
    return {
      institute_id: srow.institute_id, display_name: srow.display_name, institute_code: srow.institute_code,
      status: srow.status, role, staff_id: srow.staff_id, role_code: srow.role_code, allowed_batch_ids: allowedBatchIds,
    };
  } catch (err) {
    console.error('[institutional-intelligence] resolveInstituteForUser failed:', err);
    return null;
  }
}

// ── Readiness aggregate (latest snapshot per subject, institute-scoped) ───────

async function readinessAggregate(pool: Pool, instituteId: string, batchIds?: string[] | null): Promise<ReadinessAgg> {
  // Latest readiness snapshot per subject (career_readiness_history is append-only).
  // subject_id ≡ students.user_id. Optionally restricted to a SET of batches via approved
  // enrollment_requests (faculty batch-confinement — an empty array honestly yields no rows).
  // When batchIds is null/undefined the query is institute-wide (byte-identical for admin callers).
  // Pure SELECT.
  const useBatch = Array.isArray(batchIds);
  const batchJoin = useBatch
    ? `JOIN enrollment_requests er ON er.student_id = s.id AND er.batch_id = ANY($2) AND er.status IN ('Approved','Active','Enrolled')`
    : '';
  const params: any[] = useBatch ? [instituteId, batchIds] : [instituteId];
  const sql = `
    WITH latest AS (
      SELECT DISTINCT ON (subject_id)
        subject_id, overall_score, current_score, future_score, role_score, growth_score
      FROM career_readiness_history
      ORDER BY subject_id, created_at DESC
    )
    SELECT
      COUNT(*) FILTER (WHERE l.overall_score IS NOT NULL)        AS measurable_count,
      AVG(l.overall_score)                                       AS avg_overall,
      AVG(l.current_score)                                       AS avg_current,
      AVG(l.future_score)                                        AS avg_future,
      AVG(l.role_score)                                          AS avg_role,
      AVG(l.growth_score)                                        AS avg_growth,
      COUNT(*) FILTER (WHERE l.overall_score >= 75)              AS high_readiness,
      COUNT(*) FILTER (WHERE l.overall_score < 50 AND l.overall_score IS NOT NULL) AS at_risk
    FROM students s
    ${batchJoin}
    JOIN latest l ON l.subject_id = s.user_id
    WHERE s.institute_id = $1`;
  const r = await pool.query(sql.replace('challenge        subject_id', '        subject_id'), params);
  const row = r.rows[0] ?? {};
  return {
    measurable_count: int(row.measurable_count),
    avg_overall: num(row.avg_overall),
    avg_current: num(row.avg_current),
    avg_future: num(row.avg_future),
    avg_role: num(row.avg_role),
    avg_growth: num(row.avg_growth),
    high_readiness: int(row.high_readiness),
    at_risk: int(row.at_risk),
  };
}

// ── University Portal — overview (readiness + department-by-batch) ────────────

export async function composeOverview(pool: Pool, scope: InstituteScope) {
  const instituteId = scope.institute_id;
  const notes: string[] = [];

  // Roster counts (institute's own operational data — always shown).
  const totalStudents = int((await pool.query('SELECT COUNT(*) AS n FROM students WHERE institute_id = $1', [instituteId])).rows[0]?.n);
  const batchCount = int((await pool.query('SELECT COUNT(*) AS n FROM batches WHERE institute_id = $1', [instituteId])).rows[0]?.n);
  const assessed = int((await pool.query(
    `SELECT COUNT(DISTINCT s.id) AS n
       FROM students s JOIN career_readiness_history h ON h.subject_id = s.user_id
      WHERE s.institute_id = $1`, [instituteId])).rows[0]?.n);

  // Score aggregates are k-anonymity gated on the ASSESSED cohort.
  const agg = await readinessAggregate(pool, instituteId);
  const gate = gateFromN(assessed);
  const readiness = gate.status === 'masked'
    ? null
    : {
        measurable_count: agg.measurable_count,
        avg_overall: agg.avg_overall,
        high_readiness: agg.high_readiness,
        at_risk: agg.at_risk,
        blocks: { current: agg.avg_current, future: agg.avg_future, role: agg.avg_role, growth: agg.avg_growth },
      };
  if (gate.status === 'masked' && totalStudents > 0) {
    notes.push(`Readiness aggregates masked — assessed cohort (n=${assessed}) below k_min=${K_MIN}.`);
  }
  if (totalStudents === 0) notes.push('No students enrolled for this institute yet — honest empty (not a defect).');

  // Department analytics by BATCH (founder decision #3 — no departments table).
  const batchRows = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (subject_id) subject_id, overall_score
      FROM career_readiness_history ORDER BY subject_id, created_at DESC
    )
    SELECT b.id, b.batch_name, b.academic_year,
           COUNT(DISTINCT s.id)                                   AS students,
           COUNT(DISTINCT l.subject_id)                           AS assessed,
           AVG(l.overall_score)                                   AS avg_readiness
      FROM batches b
      LEFT JOIN enrollment_requests er ON er.batch_id = b.id AND er.status IN ('Approved','Active','Enrolled')
      LEFT JOIN students s ON s.id = er.student_id
      LEFT JOIN latest l ON l.subject_id = s.user_id
     WHERE b.institute_id = $1
     GROUP BY b.id, b.batch_name, b.academic_year
     ORDER BY b.batch_name`, [instituteId]);

  const departments = batchRows.rows.map((r) => {
    const bAssessed = int(r.assessed);
    const bGate = gateFromN(bAssessed);
    return {
      batch_id: r.id,
      name: r.batch_name,
      academic_year: r.academic_year,
      students: int(r.students),
      assessed: bAssessed,
      // Masked per-batch when its assessed cohort is below k_min.
      avg_readiness: bGate.status === 'masked' ? null : num(r.avg_readiness),
      cohort_status: bGate.status,
    };
  });

  return {
    ok: true,
    version: INSTITUTIONAL_INTELLIGENCE_VERSION,
    institute: scope,
    grouping: 'batch',
    grouping_note: 'Department analytics aggregate by batch — no canonical departments table; splits are never fabricated.',
    roster: { total_students: totalStudents, assessed_students: assessed, batches: batchCount },
    cohort: gate,
    readiness,
    departments,
    notes,
  };
}

// ── University Portal — competency heatmap (domain × cohort) ──────────────────

// Faculty are batch-confined (scope.allowed_batch_ids). When the caller is a faculty role we
// derive a batch filter so the institute-wide competency aggregates are restricted to the
// students enrolled in their assigned batches — never the whole institute (security boundary).
// For institute_admin / placement_officer (role !== 'faculty') the filter is empty → the queries
// are byte-identical to the institute-wide behaviour. param is the $2 bind (allowed batch ids;
// an empty array honestly yields no rows).
function facultyBatchScope(scope: InstituteScope): { join: string; param: string[] | null } {
  if (scope.role === 'faculty') {
    return {
      join: `JOIN enrollment_requests er ON er.student_id = s.id AND er.batch_id = ANY($2) AND er.status IN ('Approved','Active','Enrolled')`,
      param: scope.allowed_batch_ids ?? [],
    };
  }
  return { join: '', param: null };
}

export async function composeHeatmap(pool: Pool, scope: InstituteScope) {
  const instituteId = scope.institute_id;
  const notes: string[] = [];
  const bs = facultyBatchScope(scope);
  const bp: any[] = bs.param ? [instituteId, bs.param] : [instituteId];

  // REAL per-domain aggregation from the canonical competency substrate
  // (`onto_competency_scores`: subject_id, onto_domain, scaled_score). Each
  // domain row is k-anonymity gated on the DISTINCT subjects contributing a score
  // for that domain — masked (<k_min) returns null, never a fabricated number.
  const hasScores = await tableExists(pool, 'onto_competency_scores');
  if (!hasScores) {
    return {
      ok: true, institute: scope, available: false, cohort: gateFromN(0),
      domains: [] as Array<{ domain: string; label: string; n: number; avg_score: number | null; cohort_status: CohortStatus }>,
      notes: ['Competency score substrate (onto_competency_scores) not provisioned — domain heatmap honestly unavailable.'],
    };
  }

  const assessed = int((await pool.query(
    `SELECT COUNT(DISTINCT s.id) AS n
       FROM students s ${bs.join} JOIN onto_competency_scores c ON c.subject_id = s.user_id
      WHERE s.institute_id = $1`, bp)).rows[0]?.n);
  const gate = gateFromN(assessed);

  const rows = (await pool.query(`
    SELECT c.onto_domain,
           MAX(c.domain_label)        AS domain_label,
           COUNT(DISTINCT s.id)       AS n,
           AVG(c.scaled_score)        AS avg_score
      FROM students s ${bs.join}
      JOIN onto_competency_scores c ON c.subject_id = s.user_id
     WHERE s.institute_id = $1
     GROUP BY c.onto_domain
     ORDER BY c.onto_domain`, bp)).rows;

  const domains = rows.map((r) => {
    const dn = int(r.n);
    const dgate = gateFromN(dn);
    return {
      domain: r.onto_domain as string,
      label: (r.domain_label as string) ?? (r.onto_domain as string),
      n: dn,
      // Per-domain k-anonymity: masked domains return null, never a number.
      avg_score: dgate.status === 'masked' ? null : num(r.avg_score),
      cohort_status: dgate.status,
    };
  });

  if (assessed === 0) {
    notes.push('No competency profiles for this institute\u2019s students yet — domain heatmap honestly empty.');
  } else if (domains.length > 0 && domains.every((d) => d.avg_score === null)) {
    notes.push(`Per-domain scores masked — each domain cohort below k_min=${K_MIN}.`);
  }

  return {
    ok: true,
    institute: scope,
    available: domains.length > 0,
    cohort: gate,
    domains,
    notes,
  };
}

// ── snapshot → ReadinessResult (for industry-gap-engine reuse) ────────────────

/** Best-effort extraction of a ReadinessResult from a stored readiness snapshot
 *  JSONB. The snapshot shape varies; we accept it only when it carries the gap
 *  arrays the industry-gap engine consumes — otherwise null (honest, never faked). */
function extractReadinessResult(snapshot: unknown): ReadinessResult | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidates: any[] = [snapshot, (snapshot as any).readiness, (snapshot as any).role_readiness, (snapshot as any).result];
  for (const c of candidates) {
    if (c && typeof c === 'object' && (Array.isArray(c.gap_areas) || Array.isArray(c.critical_gaps))) {
      return c as ReadinessResult;
    }
  }
  return null;
}

// ── University / Placement Portal — gap analysis ──────────────────────────────
// PRIMARY: real competency-domain gaps from `onto_competency_scores` (the canonical
// competency substrate) — the lowest-scoring domains across the cohort are the
// institution-wide critical competency gaps. SECONDARY: coarse readiness-block
// gaps. Both axes are k-anonymity gated on their OWN assessed cohort.

export async function composeGaps(pool: Pool, scope: InstituteScope) {
  const instituteId = scope.institute_id;
  const notes: string[] = [];
  const bs = facultyBatchScope(scope);
  const bp: any[] = bs.param ? [instituteId, bs.param] : [instituteId];
  // Faculty readiness secondary axis is batch-confined to the SAME assigned batches (never institute-wide).
  const rdBatch: string[] | null = scope.role === 'faculty' ? (scope.allowed_batch_ids ?? []) : null;

  // PRIMARY — competency-domain gaps (real per-domain aggregation, per-domain gate).
  const hasScores = await tableExists(pool, 'onto_competency_scores');
  let compAssessed = 0;
  let competency_gaps: Array<{ area: string; domain: string; n: number; avg_score: number | null; cohort_status: CohortStatus }> = [];
  if (hasScores) {
    compAssessed = int((await pool.query(
      `SELECT COUNT(DISTINCT s.id) AS n
         FROM students s ${bs.join} JOIN onto_competency_scores c ON c.subject_id = s.user_id
        WHERE s.institute_id = $1`, bp)).rows[0]?.n);
    const rows = (await pool.query(`
      SELECT c.onto_domain, MAX(c.domain_label) AS domain_label,
             COUNT(DISTINCT s.id) AS n, AVG(c.scaled_score) AS avg_score
        FROM students s ${bs.join} JOIN onto_competency_scores c ON c.subject_id = s.user_id
       WHERE s.institute_id = $1
       GROUP BY c.onto_domain`, bp)).rows;
    competency_gaps = rows.map((r) => {
      const dn = int(r.n); const dgate = gateFromN(dn);
      return {
        area: (r.domain_label as string) ?? (r.onto_domain as string),
        domain: r.onto_domain as string,
        n: dn,
        avg_score: dgate.status === 'masked' ? null : num(r.avg_score),
        cohort_status: dgate.status,
      };
    })
      .filter((g) => g.avg_score != null)
      .sort((a, b) => (a.avg_score as number) - (b.avg_score as number))
      .slice(0, 5);
  }
  const competency_cohort = gateFromN(compAssessed);

  // SECONDARY — coarse readiness-block gaps (separate readiness cohort + gate).
  const rdAssessed = int((await pool.query(
    `SELECT COUNT(DISTINCT s.id) AS n
       FROM students s ${bs.join} JOIN career_readiness_history h ON h.subject_id = s.user_id
      WHERE s.institute_id = $1`, bp)).rows[0]?.n);
  const readiness_cohort = gateFromN(rdAssessed);
  const agg = await readinessAggregate(pool, instituteId, rdBatch);
  let readiness_gaps: Array<{ area: string; avg_score: number | null }> = [];
  if (readiness_cohort.status !== 'masked') {
    readiness_gaps = [
      { area: 'Current Readiness', avg_score: agg.avg_current },
      { area: 'Future Readiness', avg_score: agg.avg_future },
      { area: 'Role Readiness', avg_score: agg.avg_role },
      { area: 'Growth', avg_score: agg.avg_growth },
    ]
      .filter((g) => g.avg_score != null)
      .sort((a, b) => (a.avg_score as number) - (b.avg_score as number))
      .slice(0, 3);
  }

  if (competency_gaps.length === 0 && readiness_gaps.length === 0) {
    notes.push((compAssessed === 0 && rdAssessed === 0)
      ? 'No assessed students — institutional gaps honestly unavailable.'
      : `Gap analysis masked — assessed cohorts (competency n=${compAssessed} / readiness n=${rdAssessed}) below k_min=${K_MIN}.`);
  }

  // Back-compat surface: prefer real competency gaps, else readiness gaps.
  const critical_gaps = competency_gaps.length > 0
    ? competency_gaps.map((g) => ({ area: g.area, avg_score: g.avg_score }))
    : readiness_gaps;

  return {
    ok: true,
    institute: scope,
    cohort: competency_gaps.length > 0 ? competency_cohort : readiness_cohort,
    competency_cohort,
    readiness_cohort,
    competency_gaps,
    readiness_gaps,
    critical_gaps,
    notes,
  };
}

// ── Placement Portal — pipeline + offers (honest unavailable until MX-302E) ───

export async function composePlacement(pool: Pool, scope: InstituteScope) {
  const instituteId = scope.institute_id;
  const notes: string[] = [];

  const hasDrives = await tableExists(pool, 'placement_drives');
  const hasApps = await tableExists(pool, 'placement_applications');
  const pipelineAvailable = hasDrives && hasApps;
  if (!pipelineAvailable) {
    notes.push('Placement drive/application substrate (MX-302E) not provisioned — employer pipeline honestly unavailable (never fabricated).');
  }

  const totalStudents = int((await pool.query('SELECT COUNT(*) AS n FROM students WHERE institute_id = $1', [instituteId])).rows[0]?.n);

  // Offers scoped to institute via candidate_id ↔ students.user_id.
  const offerRow = (await pool.query(`
    SELECT COUNT(*)                                              AS offers,
           COUNT(DISTINCT o.candidate_id)                        AS candidates,
           AVG(o.total_ctc)                                      AS avg_ctc,
           MAX(o.total_ctc)                                      AS top_ctc,
           COUNT(DISTINCT o.candidate_id) FILTER (WHERE LOWER(o.status) IN ('accepted','joined','placed')) AS placed
      FROM employer_offers o
      JOIN students s ON s.user_id = o.candidate_id
     WHERE s.institute_id = $1`, [instituteId])).rows[0] ?? {};

  const offersCount = int(offerRow.offers);
  const placed = int(offerRow.placed);
  // Placement-rate distribution is gated on the placed cohort.
  const gate = gateFromN(placed);
  const offers = (offersCount === 0)
    ? null
    : {
        offers: offersCount,
        candidates_with_offers: int(offerRow.candidates),
        // CTC/placement-rate aggregates masked for tiny cohorts.
        placement_rate: gate.status === 'masked' || totalStudents === 0 ? null : Math.round((placed / totalStudents) * 1000) / 10,
        avg_ctc: gate.status === 'masked' ? null : num(offerRow.avg_ctc),
        top_ctc: gate.status === 'masked' ? null : num(offerRow.top_ctc),
        placed,
      };
  if (offersCount === 0) notes.push('No employer offers linked to this institute\u2019s students yet — honest empty.');

  return {
    ok: true,
    institute: scope,
    pipeline_available: pipelineAvailable,
    cohort: gate,
    offers,
    notes,
  };
}

// ── University Portal — accreditation (NAAC/NBA/UGC/AICTE) ────────────────────

export async function composeAccreditation(pool: Pool, scope: InstituteScope) {
  const hasTable = await tableExists(pool, 'institution_accreditations');
  if (!hasTable) {
    return { ok: true, institute: scope, available: false, accreditations: [], notes: ['Accreditation table not provisioned.'] };
  }
  const r = await pool.query(`
    SELECT accreditation_authority, accreditation_grade, valid_from, valid_until, source_url
      FROM institution_accreditations
     WHERE institution_id::text = $1
     ORDER BY valid_until DESC NULLS LAST`, [scope.institute_id]);
  const rows = r.rows.map((x) => ({
    authority: x.accreditation_authority,
    grade: x.accreditation_grade,
    valid_from: x.valid_from,
    valid_until: x.valid_until,
    source_url: x.source_url,
  }));
  return {
    ok: true,
    institute: scope,
    available: rows.length > 0,
    accreditations: rows,
    notes: rows.length === 0 ? ['No accreditation records on file for this institute — honest empty.'] : [],
  };
}

// ── University Portal — industry alignment (future-readiness proxy) ───────────

export async function composeIndustryAlignment(pool: Pool, scope: InstituteScope) {
  const instituteId = scope.institute_id;
  const notes: string[] = [];

  // Alignment SCORE — future-readiness block (market-alignment-weighted), gated.
  const assessed = int((await pool.query(
    `SELECT COUNT(DISTINCT s.id) AS n
       FROM students s JOIN career_readiness_history h ON h.subject_id = s.user_id
      WHERE s.institute_id = $1 AND h.future_score IS NOT NULL`, [instituteId])).rows[0]?.n);
  const gate = gateFromN(assessed);
  const agg = await readinessAggregate(pool, instituteId);

  // Industry GAP areas — composed via the existing industry-gap-engine
  // (assessIndustryGaps) over each student's latest readiness snapshot, then
  // aggregated to the most frequently-blocking competencies. Gated on the number
  // of students whose snapshot carried derivable industry gaps (honest absence
  // when snapshots lack gap data — never fabricated).
  const snaps = (await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (subject_id) subject_id, snapshot
        FROM career_readiness_history ORDER BY subject_id, created_at DESC
    )
    SELECT l.snapshot
      FROM students s JOIN latest l ON l.subject_id = s.user_id
     WHERE s.institute_id = $1`, [instituteId])).rows;

  const gapAgg = new Map<string, { name: string; count: number; sum: number }>();
  let contributing = 0;
  for (const row of snaps) {
    const rr = extractReadinessResult(row.snapshot);
    if (!rr) continue;
    const ig = assessIndustryGaps(rr);
    const pool2 = ig.critical_gaps.length > 0 ? ig.critical_gaps : ig.gap_areas;
    if (pool2.length === 0) continue;
    contributing++;
    for (const g of pool2) {
      const key = g.competency_name ?? g.competency_id;
      const e = gapAgg.get(key) ?? { name: g.competency_name ?? g.competency_id, count: 0, sum: 0 };
      e.count++; e.sum += g.gap ?? 0; gapAgg.set(key, e);
    }
  }
  const industryGapGate = gateFromN(contributing);
  const top_industry_gaps = industryGapGate.status === 'masked'
    ? []
    : [...gapAgg.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((e) => ({ competency: e.name, students_affected: e.count, avg_gap: e.count ? Math.round((e.sum / e.count) * 10) / 10 : null }));

  notes.push('Alignment score uses the future-readiness block (market-alignment-weighted); industry gap areas are composed via the industry-gap engine over student readiness snapshots.');
  if (gate.status === 'masked') {
    notes.push(assessed === 0
      ? 'No future-readiness data for this institute — alignment score honestly unavailable.'
      : `Alignment score masked — cohort (n=${assessed}) below k_min=${K_MIN}.`);
  }
  if (industryGapGate.status === 'masked') {
    notes.push(contributing === 0
      ? 'No student readiness snapshots carry derivable industry gap areas yet — industry gaps honestly unavailable.'
      : `Industry gaps masked — contributing cohort (n=${contributing}) below k_min=${K_MIN}.`);
  }

  return {
    ok: true,
    institute: scope,
    cohort: gate,
    alignment_score: gate.status === 'masked' ? null : agg.avg_future,
    industry_gap_cohort: industryGapGate,
    top_industry_gaps,
    notes,
  };
}

// ── Faculty Portal — per-student readiness (institute/batch scoped roster) ────

export async function composeFaculty(pool: Pool, scope: InstituteScope, batchId?: string | null) {
  const instituteId = scope.institute_id;
  // Faculty is authorised over its OWN students individually (roster-level, not a
  // peer benchmark) — strictly tenant-scoped. null score = not yet assessed.
  //
  // Role-aware batch scoping (authz):
  //   - faculty: confined to their assigned batches (scope.allowed_batch_ids). A
  //     requested batchId must be one of those (else honest 'batch_not_authorised'
  //     empty). With no assigned batches → empty (never the whole institute).
  //   - institute_admin / placement_officer (allowed_batch_ids === null): optional
  //     single-batch filter, or the full institute roster.
  const requested = batchId ? String(batchId) : null;
  let batchFilter: string[] | null; // null = all institute batches; [] = none
  let scopeNote: string | null = null;
  if (scope.allowed_batch_ids === null) {
    batchFilter = requested ? [requested] : null;
  } else {
    // Faculty — intersect their assigned batches with any explicit request.
    if (requested) {
      if (scope.allowed_batch_ids.includes(requested)) batchFilter = [requested];
      else { batchFilter = []; scopeNote = 'batch_not_authorised'; }
    } else {
      batchFilter = scope.allowed_batch_ids;
    }
  }

  let rows: any[] = [];
  if (batchFilter === null) {
    const r = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (subject_id) subject_id, overall_score, overall_band, measurable, created_at
        FROM career_readiness_history ORDER BY subject_id, created_at DESC
      )
      SELECT s.id, s.student_code, s.full_name,
             l.overall_score, l.overall_band, l.measurable, l.created_at AS assessed_at
        FROM students s
        LEFT JOIN latest l ON l.subject_id = s.user_id
       WHERE s.institute_id = $1
       ORDER BY s.full_name
       LIMIT 500`, [instituteId]);
    rows = r.rows;
  } else if (batchFilter.length > 0) {
    const r = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (subject_id) subject_id, overall_score, overall_band, measurable, created_at
        FROM career_readiness_history ORDER BY subject_id, created_at DESC
      )
      SELECT DISTINCT s.id, s.student_code, s.full_name,
             l.overall_score, l.overall_band, l.measurable, l.created_at AS assessed_at
        FROM students s
        JOIN enrollment_requests er ON er.student_id = s.id
         AND er.batch_id = ANY($2) AND er.status IN ('Approved','Active','Enrolled')
        LEFT JOIN latest l ON l.subject_id = s.user_id
       WHERE s.institute_id = $1
       ORDER BY s.full_name
       LIMIT 500`, [instituteId, batchFilter]);
    rows = r.rows;
  } // batchFilter === [] → no authorised batch → rows stays empty (honest)

  const studentsList = rows.map((x) => ({
    student_id: x.id,
    student_code: x.student_code,
    full_name: x.full_name,
    overall_score: num(x.overall_score),
    band: x.overall_band ?? null,
    assessed: !!x.measurable && x.overall_score != null,
    assessed_at: x.assessed_at ?? null,
  }));
  const notes: string[] = [];
  if (scopeNote === 'batch_not_authorised') notes.push('Requested batch is outside your assigned batches — honest empty.');
  else if (studentsList.length === 0) notes.push(scope.role === 'faculty' && (scope.allowed_batch_ids?.length ?? 0) === 0
    ? 'No batches assigned to you yet — honest empty.'
    : 'No students in scope — honest empty.');
  return {
    ok: true,
    institute: scope,
    role: scope.role,
    batch_id: requested,
    scoped_batch_ids: scope.allowed_batch_ids,
    total: studentsList.length,
    assessed_count: studentsList.filter((s) => s.assessed).length,
    students: studentsList,
    notes,
  };
}

// ── Parent View — child placement readiness (consent-gated) ──────────────────

export interface ParentChildAccess {
  allowed: boolean;
  reason: string;
  student_id?: string;
  student_user_id?: string | null;
  full_name?: string;
}

/** Resolve a parent's authorised access to one child via parent_student_links +
 *  DPDP consent (consent OR child is an adult ≥18). Strict — denies by default. */
export async function resolveParentChildAccess(pool: Pool, parentUserId: string, childStudentId: string): Promise<ParentChildAccess> {
  const uid = String(parentUserId ?? '').trim();
  const cid = String(childStudentId ?? '').trim();
  if (!uid || !cid) return { allowed: false, reason: 'missing_identifiers' };
  try {
    const r = await pool.query(`
      SELECT s.id, s.user_id, s.full_name, s.dob,
             psl.lbi_consent, psl.consent_revoked_date
        FROM parents p
        JOIN parent_student_links psl ON psl.parent_id = p.id
        JOIN students s ON s.id = psl.student_id
       WHERE p.user_id = $1 AND s.id = $2
       LIMIT 1`, [uid, cid]);
    const row = r.rows[0];
    if (!row) return { allowed: false, reason: 'not_linked' };
    let isAdult = false;
    if (row.dob) {
      const age = (Date.now() - new Date(row.dob).getTime()) / (365.25 * 24 * 3600 * 1000);
      isAdult = age >= 18;
    }
    const consentActive = !!row.lbi_consent && !row.consent_revoked_date;
    if (!consentActive && !isAdult) return { allowed: false, reason: 'consent_required', student_id: row.id, full_name: row.full_name };
    return { allowed: true, reason: isAdult ? 'adult_child' : 'consent_granted', student_id: row.id, student_user_id: row.user_id, full_name: row.full_name };
  } catch (err) {
    console.error('[institutional-intelligence] resolveParentChildAccess failed:', err);
    return { allowed: false, reason: 'error' };
  }
}

export async function composeParentPlacementReadiness(pool: Pool, access: ParentChildAccess) {
  if (!access.allowed || !access.student_user_id) {
    return { ok: true, available: false, reason: access.reason, child: access.full_name ?? null, readiness: null, notes: ['Child placement readiness not available (consent or linkage required).'] };
  }
  const r = await pool.query(`
    SELECT overall_score, overall_band, current_score, future_score, role_score, growth_score, measurable, created_at
      FROM career_readiness_history WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 1`, [access.student_user_id]);
  const row = r.rows[0];
  if (!row) {
    return { ok: true, available: false, reason: 'not_assessed', child: access.full_name ?? null, readiness: null, notes: ['Child has not completed a career readiness assessment yet — honest empty.'] };
  }
  return {
    ok: true,
    available: true,
    reason: access.reason,
    child: access.full_name ?? null,
    readiness: {
      overall_score: num(row.overall_score),
      band: row.overall_band ?? null,
      measurable: !!row.measurable,
      blocks: {
        current: num(row.current_score),
        future: num(row.future_score),
        role: num(row.role_score),
        growth: num(row.growth_score),
      },
      assessed_at: row.created_at,
    },
    notes: [],
  };
}
