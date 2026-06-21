/**
 * Phase 6.14 — Super Admin Command Center: unified view (superadmin_command_center deliverable).
 * READ-ONLY, never-throws, compose-never-recompute.
 *
 * Folds the platform's 12 operational domains into one honest posture. Each domain's metrics are
 * REAL composed counts read from live source tables (probed via to_regclass); an absent/unreadable
 * source table → the metric is null and the domain is flagged unmeasurable (never a fabricated 0).
 * A present-but-empty table honestly reports 0. No DDL, no writes, no external side effects.
 */
import pg from 'pg';

const N = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

/** null on error OR on a SQL-NULL aggregate (e.g. AVG over an empty set) — never a fabricated 0. */
async function safeScalar(pool: pg.Pool, sql: string): Promise<number | null> {
  try {
    const r = await pool.query(sql);
    const v = r.rows[0]?.n;
    return v == null ? null : N(v);
  } catch { return null; }
}

export type MetricUnit = 'count' | 'pct' | 'score' | 'inr';

export interface DomainMetricSpec {
  key: string;
  label: string;
  table: string;
  sql: string;
  unit?: MetricUnit;
  headline?: boolean;
}

export interface DomainSpec {
  key: string;
  label: string;
  description: string;
  metrics: DomainMetricSpec[];
}

/** The 12 unified domains mapped to their REAL source tables + read-only composing queries. */
export const DOMAIN_SPECS: DomainSpec[] = [
  {
    key: 'institutions', label: 'Institutions', description: 'Onboarded institution tenants.',
    metrics: [
      { key: 'total', label: 'Institutions', table: 'institutes', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM institutes` },
      { key: 'active', label: 'Active', table: 'institutes',
        sql: `SELECT COUNT(*)::int AS n FROM institutes WHERE lower(coalesce(status,'active')) IN ('active','approved','live')` },
    ],
  },
  {
    key: 'employers', label: 'Employers', description: 'Employer organizations.',
    metrics: [
      { key: 'total', label: 'Organizations', table: 'employer_organizations', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM employer_organizations` },
      { key: 'verified', label: 'Verified', table: 'employer_organizations',
        sql: `SELECT COUNT(*)::int AS n FROM employer_organizations WHERE coalesce(verified,false) = true` },
    ],
  },
  {
    key: 'students', label: 'Students', description: 'Institution-enrolled students.',
    metrics: [
      { key: 'total', label: 'Students', table: 'students', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM students` },
      { key: 'active', label: 'Active', table: 'students',
        sql: `SELECT COUNT(*)::int AS n FROM students WHERE lower(coalesce(status,'active')) IN ('active','enrolled')` },
    ],
  },
  {
    key: 'candidates', label: 'Candidates', description: 'Employer hiring-pipeline candidates.',
    metrics: [
      { key: 'total', label: 'Candidates', table: 'employer_candidates', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM employer_candidates` },
      { key: 'in_pipeline', label: 'In Pipeline', table: 'employer_candidates',
        sql: `SELECT COUNT(*)::int AS n FROM employer_candidates
              WHERE lower(coalesce(stage,'new')) NOT IN ('hired','rejected','withdrawn','declined','archived')` },
      { key: 'hired', label: 'Hired', table: 'employer_candidates',
        sql: `SELECT COUNT(*)::int AS n FROM employer_candidates WHERE lower(coalesce(stage,'')) = 'hired'` },
    ],
  },
  {
    key: 'assessments', label: 'Assessments', description: 'CAPADEX runtime sessions + talent assessments.',
    metrics: [
      { key: 'capadex_sessions', label: 'CAPADEX Sessions', table: 'capadex_sessions', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM capadex_sessions` },
      { key: 'completed', label: 'Completed', table: 'capadex_sessions',
        sql: `SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE lower(coalesce(status,'')) = 'completed'` },
      { key: 'talent_assessments', label: 'Talent Assessments', table: 'ti_fact_assessments',
        sql: `SELECT COUNT(*)::int AS n FROM ti_fact_assessments` },
    ],
  },
  {
    key: 'ei', label: 'Employability Index', description: 'Employability Index profile snapshots.',
    metrics: [
      { key: 'profiles', label: 'EI Profiles', table: 'ei_profile_snapshots', headline: true,
        sql: `SELECT COUNT(DISTINCT subject_id)::int AS n FROM ei_profile_snapshots` },
      { key: 'measured', label: 'Measured Snapshots', table: 'ei_profile_snapshots',
        sql: `SELECT COUNT(*)::int AS n FROM ei_profile_snapshots WHERE coalesce(measurable,false) = true` },
      { key: 'avg_ei', label: 'Avg EI Score', unit: 'score', table: 'ei_profile_snapshots',
        sql: `SELECT ROUND(AVG(ei_score))::int AS n FROM ei_profile_snapshots
              WHERE coalesce(measurable,false) = true AND ei_score IS NOT NULL` },
    ],
  },
  {
    key: 'career_builder', label: 'Career Builder', description: 'Career seeker profiles.',
    metrics: [
      { key: 'total', label: 'Seeker Profiles', table: 'career_seeker_profiles', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM career_seeker_profiles` },
      { key: 'avg_completeness', label: 'Avg Completeness', unit: 'pct', table: 'career_seeker_profiles',
        sql: `SELECT ROUND(AVG(completeness))::int AS n FROM career_seeker_profiles WHERE completeness IS NOT NULL` },
    ],
  },
  {
    key: 'jobs', label: 'Jobs', description: 'Employer job postings.',
    metrics: [
      { key: 'total', label: 'Jobs Posted', table: 'employer_jobs', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM employer_jobs` },
      { key: 'open', label: 'Open', table: 'employer_jobs',
        sql: `SELECT COUNT(*)::int AS n FROM employer_jobs
              WHERE lower(coalesce(status,'active')) IN ('active','open','published','live')` },
      { key: 'applications', label: 'Applications', table: 'employer_jobs',
        sql: `SELECT COALESCE(SUM(application_count),0)::int AS n FROM employer_jobs` },
    ],
  },
  {
    key: 'revenue', label: 'Revenue', description: 'Captured CAPADEX payments.',
    metrics: [
      { key: 'paid_count', label: 'Paid Transactions', table: 'capadex_payments', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM capadex_payments
              WHERE lower(coalesce(status,'')) IN ('paid','captured','success','completed')` },
      { key: 'gross_inr', label: 'Gross Revenue', unit: 'inr', table: 'capadex_payments',
        sql: `SELECT (COALESCE(SUM(amount_paise),0) / 100)::bigint AS n FROM capadex_payments
              WHERE lower(coalesce(status,'')) IN ('paid','captured','success','completed')` },
    ],
  },
  {
    key: 'subscriptions', label: 'Subscriptions', description: 'Package + recurring subscriptions.',
    metrics: [
      { key: 'package_active', label: 'Active Packages', table: 'student_subscriptions', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM student_subscriptions
              WHERE lower(coalesce(status,'active')) IN ('active','live')
                AND (expiry_date IS NULL OR expiry_date >= now())` },
      { key: 'recurring_active', label: 'Active Recurring', table: 'comm_subscriptions',
        sql: `SELECT COUNT(*)::int AS n FROM comm_subscriptions
              WHERE lower(coalesce(status,'')) IN ('active','trialing','in_grace')` },
    ],
  },
  {
    key: 'partners', label: 'Partners', description: 'Partner ecosystem (referral + payout partners).',
    metrics: [
      { key: 'total', label: 'Partners', table: 'partners', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM partners` },
      { key: 'referrals', label: 'Referrals', table: 'partner_referrals',
        sql: `SELECT COUNT(*)::int AS n FROM partner_referrals` },
    ],
  },
  {
    key: 'support', label: 'Support', description: 'Escalations requiring human review.',
    metrics: [
      { key: 'open', label: 'Open Escalations', table: 'rie_escalations', headline: true,
        sql: `SELECT COUNT(*)::int AS n FROM rie_escalations
              WHERE lower(coalesce(status,'open')) NOT IN ('resolved','closed','dismissed')` },
      { key: 'critical_open', label: 'Critical Open', table: 'rie_escalations',
        sql: `SELECT COUNT(*)::int AS n FROM rie_escalations
              WHERE lower(coalesce(severity,'')) = 'critical'
                AND lower(coalesce(status,'open')) NOT IN ('resolved','closed','dismissed')` },
    ],
  },
];

export interface DomainMetricResult {
  key: string; label: string; value: number | null; present: boolean; unit: MetricUnit;
}
export interface DomainResult {
  key: string; label: string; description: string;
  present: boolean; measurable: boolean;
  headline: { key: string; label: string; value: number | null; unit: MetricUnit } | null;
  metrics: DomainMetricResult[];
  sources: string[]; present_sources: string[];
}
export interface CommandCenterOverview {
  generated_at: string;
  degraded: boolean;
  domains: DomainResult[];
  totals: { domains: number; measurable: number; unmeasurable: number };
  notes: string[];
}

/** Compose one domain's metrics read-only. domain.present = at least one source table exists. */
export async function computeDomain(pool: pg.Pool, spec: DomainSpec): Promise<DomainResult> {
  const presence = new Map<string, boolean>();
  for (const m of spec.metrics) {
    if (!presence.has(m.table)) presence.set(m.table, await tableExists(pool, m.table));
  }
  const metrics: DomainMetricResult[] = [];
  for (const m of spec.metrics) {
    const present = presence.get(m.table) === true;
    const value = present ? await safeScalar(pool, m.sql) : null;
    metrics.push({ key: m.key, label: m.label, value, present, unit: m.unit ?? 'count' });
  }
  const domainPresent = [...presence.values()].some(Boolean);
  const hSpec = spec.metrics.find((m) => m.headline) ?? spec.metrics[0];
  const hRes = metrics.find((m) => m.key === hSpec.key) ?? null;
  const sources = [...new Set(spec.metrics.map((m) => m.table))];
  const present_sources = sources.filter((t) => presence.get(t) === true);
  return {
    key: spec.key, label: spec.label, description: spec.description,
    present: domainPresent, measurable: domainPresent,
    headline: hRes ? { key: hRes.key, label: hRes.label, value: hRes.value, unit: hRes.unit } : null,
    metrics, sources, present_sources,
  };
}

export async function buildCommandCenterOverview(pool: pg.Pool): Promise<CommandCenterOverview> {
  const generated_at = new Date().toISOString();
  const domains: DomainResult[] = [];
  let measurable = 0;
  let degraded = false;
  for (const spec of DOMAIN_SPECS) {
    const d = await computeDomain(pool, spec);
    if (d.measurable) measurable += 1; else degraded = true;
    domains.push(d);
  }
  return {
    generated_at,
    degraded,
    domains,
    totals: { domains: DOMAIN_SPECS.length, measurable, unmeasurable: DOMAIN_SPECS.length - measurable },
    notes: [
      'All domain metrics are REAL composed counts from live source tables (probed with to_regclass).',
      'An absent/unreadable source table yields a null metric (unmeasurable) — never a fabricated 0; a present-but-empty table honestly reports 0.',
      'This console is read-only: it composes already-computed platform data and performs no writes or DDL.',
    ],
  };
}
