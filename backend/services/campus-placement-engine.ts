/**
 * MX-302E — Campus Placement & Company Intelligence engine.
 *
 * Pure, read-only composers over the campus-placement substrate + the EXISTING
 * Role-DNA / market-intelligence engines. Honesty contracts:
 *   - null ≠ 0 everywhere. A missing/unmeasurable figure is `null`, never 0.
 *   - No fabricated CTC. Package analytics aggregate REAL recorded offers; the
 *     market reference comes from m3_salary_trends. Absent → honest empty state.
 *   - Company DNA is a TRANSPARENT aggregation of the role-DNA distribution +
 *     market salary signal. The behavioural / cultural side has NO signal source
 *     and is omitted (marked unavailable), never invented.
 *   - Cross-student package benchmarks are SUPPRESSED below k_min = 30.
 *   - Eligibility returns an explicit `insufficient_data` verdict when a required
 *     student field or a drive criterion is missing — never a silent pass.
 */
import type { Pool } from 'pg';
import { getRoleProfile } from './role-competency-profile';
import { resolveCuratedRoleByTitle } from './role-title-crosswalk';
import { createMarketIntelligence } from './m3-market-intelligence';

/** k-anonymity floor for any cross-student aggregate (platform convention). */
export const CAMPUS_K_MIN = 30;

// ── Eligibility ─────────────────────────────────────────────────────────────

export interface EligibilityCheck {
  criterion: string;
  required: string | number | null;
  actual: string | number | null;
  /** true = pass, false = fail, null = cannot evaluate (insufficient data). */
  pass: boolean | null;
}

export interface EligibilityResult {
  drive_id: string;
  /** true = eligible, false = not eligible, null = cannot determine. */
  eligible: boolean | null;
  insufficient_data: boolean;
  checks: EligibilityCheck[];
  note: string;
}

interface DriveCriteria {
  eligibility_cgpa: number | null;
  eligibility_branches: string[] | null;
  eligibility_max_backlogs: number | null;
  eligibility_batch_years: number[] | null;
}

interface StudentProfile {
  cgpa: number | null;
  branch: string | null;
  backlogs: number | null;
  batch_year: number | null;
}

/**
 * Rule-based eligibility evaluation. A NULL criterion means "no constraint"
 * (auto-pass). A constraint present but the student field missing → pass=null
 * (insufficient data), which makes the overall verdict null. Only a concrete
 * required-vs-actual comparison can fail.
 */
export function evaluateEligibility(
  driveId: string,
  criteria: DriveCriteria,
  profile: StudentProfile | null,
): EligibilityResult {
  const checks: EligibilityCheck[] = [];
  const p = profile ?? { cgpa: null, branch: null, backlogs: null, batch_year: null };

  // CGPA — student must meet or exceed.
  if (criteria.eligibility_cgpa != null) {
    const actual = p.cgpa;
    checks.push({
      criterion: 'Minimum CGPA',
      required: criteria.eligibility_cgpa,
      actual: actual,
      pass: actual == null ? null : actual >= criteria.eligibility_cgpa,
    });
  }

  // Branch — student's branch must be in the allowed list.
  if (Array.isArray(criteria.eligibility_branches) && criteria.eligibility_branches.length > 0) {
    const allowed = criteria.eligibility_branches.map((b) => String(b).trim().toLowerCase());
    const actual = p.branch;
    checks.push({
      criterion: 'Eligible Branch',
      required: criteria.eligibility_branches.join(', '),
      actual: actual,
      pass: actual == null ? null : allowed.includes(actual.trim().toLowerCase()),
    });
  }

  // Backlogs — student's backlog count must be <= max.
  if (criteria.eligibility_max_backlogs != null) {
    const actual = p.backlogs;
    checks.push({
      criterion: 'Maximum Backlogs',
      required: criteria.eligibility_max_backlogs,
      actual: actual,
      pass: actual == null ? null : actual <= criteria.eligibility_max_backlogs,
    });
  }

  // Batch year — student's batch must be in the allowed list.
  if (Array.isArray(criteria.eligibility_batch_years) && criteria.eligibility_batch_years.length > 0) {
    const allowed = criteria.eligibility_batch_years.map((y) => Number(y));
    const actual = p.batch_year;
    checks.push({
      criterion: 'Batch Year',
      required: criteria.eligibility_batch_years.join(', '),
      actual: actual,
      pass: actual == null ? null : allowed.includes(Number(actual)),
    });
  }

  // No criteria declared at all → genuinely open drive (eligible).
  if (checks.length === 0) {
    return {
      drive_id: driveId,
      eligible: true,
      insufficient_data: false,
      checks,
      note: 'This drive declares no eligibility constraints — open to all applicants.',
    };
  }

  const hasFail = checks.some((c) => c.pass === false);
  const hasUnknown = checks.some((c) => c.pass === null);

  let eligible: boolean | null;
  if (hasFail) eligible = false;          // a concrete failure is decisive
  else if (hasUnknown) eligible = null;   // can't confirm without missing fields
  else eligible = true;

  return {
    drive_id: driveId,
    eligible,
    insufficient_data: hasUnknown && !hasFail,
    checks,
    note: hasFail
      ? 'You do not meet one or more declared criteria for this drive.'
      : hasUnknown
        ? 'Complete your placement profile (CGPA / branch / backlogs / batch year) to confirm eligibility.'
        : 'You meet all declared eligibility criteria for this drive.',
  };
}

// ── Package analytics (real offers + market reference; k-anonymity) ─────────

export interface PackageAnalytics {
  /** The signed-in student's OWN recorded offers (always shown — their data). */
  self: {
    count: number;
    currency: string | null;
    min: number | null;
    median: number | null;
    max: number | null;
    by_type: { offer_type: string; count: number; median: number | null }[];
  };
  /**
   * Cross-student cohort aggregate — only populated when >= k_min real offers
   * with a CTC exist; otherwise suppressed (k_anonymity) and the numbers are
   * null (never fabricated).
   */
  cohort: {
    suppressed: boolean;
    k_min: number;
    n: number;
    currency: string | null;
    p25: number | null;
    median: number | null;
    p75: number | null;
  };
  /** Market reference percentiles from m3_salary_trends (real ingested data). */
  market: { market_title: string; geo: string; currency: string; p25: number | null; p50: number | null; p75: number | null }[];
  note: string;
}

function pctl(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function median(nums: number[]): number | null {
  return pctl([...nums].sort((a, b) => a - b), 0.5);
}

export async function composePackageAnalytics(pool: Pool, userId: string): Promise<PackageAnalytics> {
  // Self offers (the student's own — never suppressed).
  const selfRows = (await pool.query(
    `SELECT offer_type, ctc, currency FROM offers WHERE user_id = $1 AND ctc IS NOT NULL`,
    [userId],
  )).rows as { offer_type: string; ctc: string; currency: string }[];

  const selfCtc = selfRows.map((r) => Number(r.ctc)).filter((n) => Number.isFinite(n));
  const selfCurrency = selfRows[0]?.currency ?? null;
  const byTypeMap = new Map<string, number[]>();
  for (const r of selfRows) {
    const v = Number(r.ctc);
    if (!Number.isFinite(v)) continue;
    const arr = byTypeMap.get(r.offer_type) ?? [];
    arr.push(v);
    byTypeMap.set(r.offer_type, arr);
  }

  // Cross-student cohort (k-anonymity suppressed below k_min).
  const cohortRow = (await pool.query(
    `SELECT count(*)::int AS n FROM offers WHERE ctc IS NOT NULL`,
  )).rows[0] as { n: number };
  const cohortN = cohortRow?.n ?? 0;
  let cohort: PackageAnalytics['cohort'];
  if (cohortN >= CAMPUS_K_MIN) {
    const allCtc = ((await pool.query(
      `SELECT ctc, currency FROM offers WHERE ctc IS NOT NULL ORDER BY ctc`,
    )).rows as { ctc: string; currency: string }[]).map((r) => Number(r.ctc)).filter(Number.isFinite);
    const sorted = [...allCtc].sort((a, b) => a - b);
    cohort = {
      suppressed: false,
      k_min: CAMPUS_K_MIN,
      n: cohortN,
      currency: selfCurrency,
      p25: pctl(sorted, 0.25),
      median: pctl(sorted, 0.5),
      p75: pctl(sorted, 0.75),
    };
  } else {
    cohort = { suppressed: true, k_min: CAMPUS_K_MIN, n: cohortN, currency: null, p25: null, median: null, p75: null };
  }

  // Market reference (real m3_salary_trends).
  let market: PackageAnalytics['market'] = [];
  try {
    const mi = createMarketIntelligence(pool);
    const rows = await mi.salaryTrends();
    market = (rows as any[]).slice(0, 12).map((r) => ({
      market_title: r.market_title,
      geo: r.geo,
      currency: r.currency,
      p25: r.p25 != null ? Number(r.p25) : null,
      p50: r.p50 != null ? Number(r.p50) : null,
      p75: r.p75 != null ? Number(r.p75) : null,
    }));
  } catch {
    market = [];
  }

  return {
    self: {
      count: selfCtc.length,
      currency: selfCurrency,
      min: selfCtc.length ? Math.min(...selfCtc) : null,
      median: median(selfCtc),
      max: selfCtc.length ? Math.max(...selfCtc) : null,
      by_type: Array.from(byTypeMap.entries()).map(([offer_type, arr]) => ({
        offer_type,
        count: arr.length,
        median: median(arr),
      })),
    },
    cohort,
    market,
    note:
      selfCtc.length === 0 && cohort.suppressed
        ? 'No recorded offer CTC yet. Add your offers to see your package analytics; cohort benchmarks unlock once the platform has at least 30 recorded offers (k-anonymity).'
        : 'Self analytics reflect your recorded offers. Cohort benchmarks are k-anonymised (suppressed below 30 offers). Market reference is from ingested salary data.',
  };
}

// ── Company DNA (role-DNA distribution + market signal; no fabricated culture) ─

export interface CompanyDNA {
  company_id: string;
  company_name: string;
  /** Roles this company recruits for (from its drives), crosswalked to curated Role-DNA. */
  roles: {
    role_title: string;
    drive_count: number;
    resolved_role_id: string | null;
    crosswalk_confidence: number | null;
    crosswalk_estimated: boolean;
    competency_count: number;
  }[];
  /** Aggregated hiring competencies across the company's resolved roles. */
  hiring_competencies: { competency_id: string; competency_name: string | null; appears_in_roles: number; avg_required_level: number | null; max_criticality: string }[];
  /** Real package signal from this company's recorded offers (k-anon for cohort). */
  package_signal: { self_offers_at_company: number; recorded_ctc_median: number | null; currency: string | null };
  /** Market salary trends matched to this company's recruited role titles (real m3 data). */
  salary_trends: { matched_role_title: string; market_title: string; geo: string; currency: string | null; p25: number | null; p50: number | null; p75: number | null }[];
  /**
   * Interview / assessment patterns. The platform's interview-intelligence &
   * hiring-assessment engines are scaffolds with NO per-company pattern data,
   * so this is honestly marked unavailable rather than fabricated.
   */
  interview_assessment: { available: false; reason: string };
  /** Preparation checklist GROUNDED in this company's real hiring competencies + drive eligibility (never generic filler). */
  prep_checklist: { item: string; basis: string }[];
  /** Learning focus areas = this company's top hiring competencies (real signal); personalised paths live in the Learning tab. */
  learning_focus: { competency_id: string; competency_name: string | null; criticality: string; note: string }[];
  /** Behavioural / cultural DNA is intentionally unavailable (no signal source). */
  cultural_dna: { available: false; reason: string };
  coverage_note: string;
}

/** Lowercase distinctive tokens (≥4 chars, minus common role stopwords) for honest title matching. */
const TITLE_STOPWORDS = new Set(['senior', 'junior', 'lead', 'associate', 'staff', 'principal', 'engineer', 'developer', 'manager', 'analyst', 'specialist', 'executive', 'officer', 'intern', 'trainee', 'consultant']);
function distinctiveTokens(title: string): string[] {
  return String(title)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !TITLE_STOPWORDS.has(t));
}

const CRIT_RANK: Record<string, number> = { critical: 3, important: 2, desirable: 1, optional: 0 };

export async function composeCompanyDNA(
  pool: Pool,
  companyId: string,
  opts?: { userId?: string; tenantId?: string | null },
): Promise<CompanyDNA | null> {
  const userId = opts?.userId;
  const tenantId = opts?.tenantId ?? null;

  // Tenant-scoped lookup: only the caller's tenant rows OR platform-global (NULL).
  // A company outside the caller's scope returns null → the route 404s (no IDOR leak).
  const c = (await pool.query(
    `SELECT id, name FROM companies
      WHERE id = $1 AND status = 'active'
        AND (tenant_id IS NULL ${tenantId != null ? 'OR tenant_id = $2' : ''})`,
    tenantId != null ? [companyId, tenantId] : [companyId],
  )).rows[0] as { id: string; name: string } | undefined;
  if (!c) return null;

  // Distinct role titles this company recruits for, from its PUBLISHED, in-scope drives.
  const driveRoles = (await pool.query(
    `SELECT COALESCE(role_title, title) AS role_title, count(*)::int AS drive_count
       FROM campus_drives
      WHERE company_id = $1 AND role_title IS NOT NULL AND status = 'published'
        AND (tenant_id IS NULL ${tenantId != null ? 'OR tenant_id = $2' : ''})
      GROUP BY COALESCE(role_title, title)
      ORDER BY drive_count DESC`,
    tenantId != null ? [companyId, tenantId] : [companyId],
  )).rows as { role_title: string; drive_count: number }[];

  // Union of eligibility criteria across this company's in-scope drives (for a grounded prep checklist).
  const eligRows = (await pool.query(
    `SELECT eligibility_cgpa, eligibility_branches, eligibility_max_backlogs, eligibility_batch_years
       FROM campus_drives
      WHERE company_id = $1 AND status = 'published'
        AND (tenant_id IS NULL ${tenantId != null ? 'OR tenant_id = $2' : ''})`,
    tenantId != null ? [companyId, tenantId] : [companyId],
  )).rows as { eligibility_cgpa: string | null; eligibility_branches: any; eligibility_max_backlogs: number | null; eligibility_batch_years: any }[];

  const roles: CompanyDNA['roles'] = [];
  const compAgg = new Map<string, { name: string | null; roles: number; levelSum: number; levelN: number; crit: number }>();

  for (const dr of driveRoles) {
    let resolved_role_id: string | null = null;
    let confidence: number | null = null;
    let estimated = false;
    let competency_count = 0;
    try {
      const res = await resolveCuratedRoleByTitle(pool, dr.role_title);
      if (res.resolved) {
        resolved_role_id = res.resolved.role_id;
        confidence = res.resolved.confidence_pct;
        estimated = res.resolved.estimated;
        const profile = await getRoleProfile(pool, resolved_role_id, { readOnly: true });
        if (profile) {
          competency_count = profile.competency_count;
          for (const comp of profile.competencies) {
            const prev = compAgg.get(comp.competency_id) ?? {
              name: comp.competency_name ?? null,
              roles: 0,
              levelSum: 0,
              levelN: 0,
              crit: 0,
            };
            prev.roles += 1;
            if (comp.required_level != null) {
              prev.levelSum += Number(comp.required_level);
              prev.levelN += 1;
            }
            prev.crit = Math.max(prev.crit, CRIT_RANK[String(comp.criticality)] ?? 0);
            compAgg.set(comp.competency_id, prev);
          }
        }
      }
    } catch {
      /* abstain — leave resolved_role_id null */
    }
    roles.push({
      role_title: dr.role_title,
      drive_count: dr.drive_count,
      resolved_role_id,
      crosswalk_confidence: confidence,
      crosswalk_estimated: estimated,
      competency_count,
    });
  }

  const critName = (n: number) => Object.keys(CRIT_RANK).find((k) => CRIT_RANK[k] === n) ?? 'optional';
  const hiring_competencies = Array.from(compAgg.entries())
    .map(([competency_id, v]) => ({
      competency_id,
      competency_name: v.name,
      appears_in_roles: v.roles,
      avg_required_level: v.levelN ? Number((v.levelSum / v.levelN).toFixed(2)) : null,
      max_criticality: critName(v.crit),
    }))
    .sort((a, b) => b.appears_in_roles - a.appears_in_roles || (CRIT_RANK[b.max_criticality] - CRIT_RANK[a.max_criticality]));

  // Real recorded package signal at this company (self only — k-anon for cohort).
  let package_signal: CompanyDNA['package_signal'] = { self_offers_at_company: 0, recorded_ctc_median: null, currency: null };
  if (userId) {
    const offerRows = (await pool.query(
      `SELECT ctc, currency FROM offers WHERE user_id = $1 AND ctc IS NOT NULL AND LOWER(company_name) = LOWER($2)`,
      [userId, c.name],
    )).rows as { ctc: string; currency: string }[];
    const ctc = offerRows.map((r) => Number(r.ctc)).filter(Number.isFinite);
    package_signal = {
      self_offers_at_company: ctc.length,
      recorded_ctc_median: median(ctc),
      currency: offerRows[0]?.currency ?? null,
    };
  }

  // ── Salary trends: match this company's role titles to real m3 market rows ──
  // Honest: only rows whose market_title shares a distinctive token with a recruited
  // role title are surfaced (no fabricated CTC). Empty when nothing matches.
  const salary_trends: CompanyDNA['salary_trends'] = [];
  if (driveRoles.length > 0) {
    try {
      const marketRows = (await pool.query(
        `SELECT st.p25, st.p50, st.p75, st.currency, st.geo, mr.market_title
           FROM m3_salary_trends st
           JOIN m3_market_roles mr ON mr.id = st.market_role_id
          ORDER BY st.p50 DESC NULLS LAST`,
      )).rows as { p25: any; p50: any; p75: any; currency: string | null; geo: string | null; market_title: string }[];
      const seen = new Set<string>();
      for (const dr of driveRoles) {
        const roleToks = new Set(distinctiveTokens(dr.role_title));
        if (roleToks.size === 0) continue;
        for (const m of marketRows) {
          const mToks = distinctiveTokens(m.market_title);
          if (!mToks.some((t) => roleToks.has(t))) continue;
          const key = `${dr.role_title}|${m.market_title}|${m.geo ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          salary_trends.push({
            matched_role_title: dr.role_title,
            market_title: m.market_title,
            geo: m.geo ?? 'unspecified',
            currency: m.currency ?? null,
            p25: m.p25 != null ? Number(m.p25) : null,
            p50: m.p50 != null ? Number(m.p50) : null,
            p75: m.p75 != null ? Number(m.p75) : null,
          });
          if (salary_trends.length >= 50) break;
        }
        if (salary_trends.length >= 50) break;
      }
    } catch {
      /* m3 tables absent in this env → honest empty salary_trends */
    }
  }

  // ── Preparation checklist: GROUNDED in real hiring competencies + drive eligibility ──
  const prep_checklist: CompanyDNA['prep_checklist'] = [];
  for (const hc of hiring_competencies.slice(0, 8)) {
    const label = hc.competency_name ?? hc.competency_id;
    prep_checklist.push({
      item: `Prepare to demonstrate "${label}"${hc.max_criticality === 'critical' ? ' (critical for this employer)' : ''}`,
      basis: `Required across ${hc.appears_in_roles} of this company's recruited role(s).`,
    });
  }
  // Eligibility-derived, factual checklist items (only when criteria actually exist).
  const cgpaThresholds = eligRows.map((r) => (r.eligibility_cgpa != null ? Number(r.eligibility_cgpa) : null)).filter((v): v is number => v != null && Number.isFinite(v));
  if (cgpaThresholds.length > 0) {
    prep_checklist.push({ item: `Confirm your CGPA meets the cutoff (lowest observed: ${Math.min(...cgpaThresholds)})`, basis: 'From this company\'s published drive eligibility criteria.' });
  }
  const maxBacklogs = eligRows.map((r) => (r.eligibility_max_backlogs != null ? Number(r.eligibility_max_backlogs) : null)).filter((v): v is number => v != null && Number.isFinite(v));
  if (maxBacklogs.length > 0) {
    prep_checklist.push({ item: `Clear active backlogs (max allowed: ${Math.max(...maxBacklogs)})`, basis: 'From this company\'s published drive eligibility criteria.' });
  }
  const branchSet = new Set<string>();
  for (const r of eligRows) { if (Array.isArray(r.eligibility_branches)) r.eligibility_branches.forEach((b: any) => branchSet.add(String(b))); }
  if (branchSet.size > 0) {
    prep_checklist.push({ item: `Verify your branch is eligible (${Array.from(branchSet).slice(0, 8).join(', ')})`, basis: 'From this company\'s published drive eligibility criteria.' });
  }

  // ── Learning focus: this company's top hiring competencies (real signal). ──
  // Personalised learning PATHS are user-level (Learning tab); here we surface WHAT to build.
  const learning_focus: CompanyDNA['learning_focus'] = hiring_competencies.slice(0, 8).map((hc) => ({
    competency_id: hc.competency_id,
    competency_name: hc.competency_name,
    criticality: hc.max_criticality,
    note: 'Build this competency in the Learning tab for a personalised path.',
  }));

  const resolvedCount = roles.filter((r) => r.resolved_role_id).length;
  return {
    company_id: c.id,
    company_name: c.name,
    roles,
    hiring_competencies,
    package_signal,
    salary_trends,
    interview_assessment: {
      available: false,
      reason:
        'Interview / assessment patterns are not available: the platform\'s interview-intelligence and hiring-assessment engines are scaffolds with no per-company pattern data. This is shown as unavailable rather than fabricated.',
    },
    prep_checklist,
    learning_focus,
    cultural_dna: {
      available: false,
      reason:
        'Behavioural / cultural Company DNA has no signal source in the platform and is not fabricated. It will appear only when a genuine signal feed exists.',
    },
    coverage_note:
      driveRoles.length === 0
        ? 'No drives recorded for this company yet — Company DNA is empty until role data exists.'
        : `Company DNA is composed from ${roles.length} recruited role(s); ${resolvedCount} resolved to curated Role-DNA. Roles that did not resolve are shown with no competency expansion (abstained, never guessed).`,
  };
}

// ── Placement readiness (transparent composite — honest, no fabrication) ────

export interface PlacementReadiness {
  score: number | null;       // 0..100, null when no inputs at all
  components: { key: string; label: string; value: number | null; weight: number; note: string }[];
  note: string;
}

export async function composePlacementReadiness(pool: Pool, userId: string): Promise<PlacementReadiness> {
  // Profile completeness (eligibility inputs present).
  const prof = (await pool.query(
    `SELECT cgpa, branch, backlogs, batch_year FROM campus_student_profiles WHERE user_id = $1`,
    [userId],
  )).rows[0] as StudentProfile | undefined;
  const profileFields = prof ? [prof.cgpa, prof.branch, prof.backlogs, prof.batch_year] : [null, null, null, null];
  const profileFilled = profileFields.filter((v) => v != null).length;
  const profileCompleteness = prof ? Math.round((profileFilled / 4) * 100) : null;

  // Application activity.
  const appCount = ((await pool.query(
    `SELECT count(*)::int AS n FROM campus_applications WHERE user_id = $1`,
    [userId],
  )).rows[0]?.n ?? 0) as number;
  const activeApps = ((await pool.query(
    `SELECT count(*)::int AS n FROM campus_applications WHERE user_id = $1 AND status NOT IN ('rejected','withdrawn')`,
    [userId],
  )).rows[0]?.n ?? 0) as number;

  // Offers.
  const offerCount = ((await pool.query(
    `SELECT count(*)::int AS n FROM offers WHERE user_id = $1`,
    [userId],
  )).rows[0]?.n ?? 0) as number;

  const appScore = appCount === 0 ? 0 : Math.min(100, activeApps * 20); // 5 active apps = full
  const offerScore = offerCount === 0 ? 0 : Math.min(100, offerCount * 50); // 2 offers = full

  const components: PlacementReadiness['components'] = [
    {
      key: 'profile',
      label: 'Placement profile completeness',
      value: profileCompleteness,
      weight: 0.4,
      note: prof ? `${profileFilled}/4 eligibility fields filled` : 'No placement profile yet',
    },
    {
      key: 'applications',
      label: 'Active applications',
      value: appCount === 0 ? null : appScore,
      weight: 0.35,
      note: `${activeApps} active of ${appCount} tracked`,
    },
    {
      key: 'offers',
      label: 'Offers in hand',
      value: offerCount === 0 ? null : offerScore,
      weight: 0.25,
      note: `${offerCount} recorded`,
    },
  ];

  // Weighted score over components that have a value; null if none measurable.
  const measured = components.filter((c) => c.value != null);
  let score: number | null = null;
  if (measured.length > 0) {
    const wsum = measured.reduce((s, c) => s + c.weight, 0);
    score = Math.round(measured.reduce((s, c) => s + (c.value as number) * c.weight, 0) / wsum);
  }

  return {
    score,
    components,
    note:
      score == null
        ? 'No placement activity yet — complete your profile and start tracking applications to build your readiness score.'
        : 'Placement readiness is a transparent weighted composite of profile completeness, active applications, and offers. Unmeasured components are excluded (null ≠ 0).',
  };
}
