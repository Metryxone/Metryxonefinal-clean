/**
 * Phase 6.15 — Founder Dashboard engine (founder_dashboard deliverable). READ-ONLY, never-throws.
 *
 * Four executive sections composed read-only from the live platform substrate:
 *   Revenue   — paid revenue (all-time + 30d trend), paid transactions, ARPT.
 *   Growth    — new users / students / employers / institutions (30d vs prior 30d).
 *   Adoption  — assessments completed, TI assessments, career profiles, measurable EI profiles.
 *   Retention — active package / recurring subscriptions, expiring-soon, cancellations.
 *
 * Every KPI carries `present` (source table exists) — an absent source yields value=null
 * (never a fabricated 0); a present-but-empty source honestly reports 0. Trends use a strictly
 * positive previous base, else delta_pct is null.
 */
import pg from 'pg';
import {
  PAID_STATUSES, safeScalar, presenceMap, buildTrend, type Trend,
} from './founder-control-center-lib';

export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'inr' | 'pct';
  present: boolean;
  trend?: Trend;
}

export interface FounderSection {
  key: string;
  label: string;
  description: string;
  kpis: Kpi[];
}

export interface FounderDashboard {
  generated_at: string;
  degraded: boolean;
  sections: FounderSection[];
  notes: string[];
}

const SOURCE_TABLES = [
  'capadex_payments', 'users', 'students', 'employer_organizations', 'institutes',
  'capadex_sessions', 'ti_fact_assessments', 'career_seeker_profiles', 'ei_profile_snapshots',
  'student_subscriptions', 'comm_subscriptions',
];

const PAID_IN = PAID_STATUSES.map((s) => `'${s}'`).join(',');

export async function buildFounderDashboard(pool: pg.Pool): Promise<FounderDashboard> {
  const generated_at = new Date().toISOString();
  const present = await presenceMap(pool, SOURCE_TABLES);
  let degraded = false;
  const has = (t: string) => {
    const p = present.get(t) === true;
    if (!p) degraded = true;
    return p;
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  // A new-entity-in-last-30d KPI with a prior-30d trend window.
  const growthKpi = async (key: string, label: string, table: string, col = 'created_at'): Promise<Kpi> => {
    const p = has(table);
    if (!p) return { key, label, value: null, unit: 'count', present: false, trend: buildTrend(null, null) };
    const cur = await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${col} >= now() - interval '30 days'`);
    const prev = await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${col} >= now() - interval '60 days' AND ${col} < now() - interval '30 days'`);
    return { key, label, value: cur, unit: 'count', present: true, trend: buildTrend(cur, prev) };
  };

  // ── Revenue ──────────────────────────────────────────────────────────────────
  const revKpis: Kpi[] = [];
  {
    const p = has('capadex_payments');
    const allTimePaise = p ? await safeScalar(pool, `SELECT COALESCE(SUM(amount_paise),0)::bigint AS n FROM capadex_payments WHERE lower(status) IN (${PAID_IN})`) : null;
    const txns = p ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM capadex_payments WHERE lower(status) IN (${PAID_IN})`) : null;
    const rev30Paise = p ? await safeScalar(pool, `SELECT COALESCE(SUM(amount_paise),0)::bigint AS n FROM capadex_payments WHERE lower(status) IN (${PAID_IN}) AND created_at >= now() - interval '30 days'`) : null;
    const revPrevPaise = p ? await safeScalar(pool, `SELECT COALESCE(SUM(amount_paise),0)::bigint AS n FROM capadex_payments WHERE lower(status) IN (${PAID_IN}) AND created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'`) : null;
    const toInr = (paise: number | null) => (paise == null ? null : Math.round(paise / 100));
    const totalInr = toInr(allTimePaise);
    const arpt = totalInr != null && txns != null && txns > 0 ? Math.round(totalInr / txns) : (txns === 0 ? 0 : null);
    revKpis.push({ key: 'total_revenue', label: 'Total Paid Revenue', value: totalInr, unit: 'inr', present: p });
    revKpis.push({ key: 'paid_transactions', label: 'Paid Transactions', value: txns, unit: 'count', present: p });
    revKpis.push({ key: 'revenue_30d', label: 'Revenue (30d)', value: toInr(rev30Paise), unit: 'inr', present: p, trend: buildTrend(toInr(rev30Paise), toInr(revPrevPaise)) });
    revKpis.push({ key: 'arpt', label: 'Avg Revenue / Transaction', value: arpt, unit: 'inr', present: p });
  }

  // ── Growth ───────────────────────────────────────────────────────────────────
  const growthKpis: Kpi[] = [
    await growthKpi('new_users', 'New Users (30d)', 'users'),
    await growthKpi('new_students', 'New Students (30d)', 'students'),
    await growthKpi('new_employers', 'New Employers (30d)', 'employer_organizations'),
    await growthKpi('new_institutions', 'New Institutions (30d)', 'institutes'),
  ];

  // ── Adoption ──────────────────────────────────────────────────────────────────
  const adoptionKpis: Kpi[] = [];
  {
    const pS = has('capadex_sessions');
    const completedCur = pS ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE lower(coalesce(status,'')) = 'completed' AND created_at >= now() - interval '30 days'`) : null;
    const completedPrev = pS ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE lower(coalesce(status,'')) = 'completed' AND created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'`) : null;
    adoptionKpis.push({ key: 'assessments_completed_30d', label: 'CAPADEX Completed (30d)', value: completedCur, unit: 'count', present: pS, trend: buildTrend(completedCur, completedPrev) });

    const pTi = has('ti_fact_assessments');
    const tiCompleted = pTi ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM ti_fact_assessments WHERE completed_at IS NOT NULL`) : null;
    adoptionKpis.push({ key: 'ti_assessments_completed', label: 'TI Assessments Completed', value: tiCompleted, unit: 'count', present: pTi });

    const pCb = has('career_seeker_profiles');
    const profiles = pCb ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM career_seeker_profiles`) : null;
    const avgCompleteness = pCb ? await safeScalar(pool, `SELECT ROUND(AVG(completeness)::numeric, 1) AS n FROM career_seeker_profiles WHERE completeness IS NOT NULL`) : null;
    adoptionKpis.push({ key: 'career_profiles', label: 'Career Profiles', value: profiles, unit: 'count', present: pCb });
    adoptionKpis.push({ key: 'avg_profile_completeness', label: 'Avg Profile Completeness', value: avgCompleteness, unit: 'pct', present: pCb });

    const pEi = has('ei_profile_snapshots');
    const eiMeasurable = pEi ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM ei_profile_snapshots WHERE coalesce(measurable,false) = true`) : null;
    adoptionKpis.push({ key: 'ei_profiles_measurable', label: 'Measurable EI Profiles', value: eiMeasurable, unit: 'count', present: pEi });
  }

  // ── Retention ─────────────────────────────────────────────────────────────────
  const retentionKpis: Kpi[] = [];
  {
    const pPkg = has('student_subscriptions');
    const activePkg = pPkg ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM student_subscriptions WHERE expiry_date IS NOT NULL AND expiry_date > now()`) : null;
    const expiringPkg = pPkg ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM student_subscriptions WHERE expiry_date > now() AND expiry_date <= now() + interval '30 days'`) : null;
    retentionKpis.push({ key: 'active_package_subs', label: 'Active Package Subscriptions', value: activePkg, unit: 'count', present: pPkg });
    retentionKpis.push({ key: 'expiring_package_30d', label: 'Package Renewals Due (30d)', value: expiringPkg, unit: 'count', present: pPkg });

    const pRec = has('comm_subscriptions');
    const activeRec = pRec ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM comm_subscriptions WHERE lower(coalesce(status,'')) = 'active' AND (current_period_end IS NULL OR current_period_end > now())`) : null;
    const cancelling = pRec ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM comm_subscriptions WHERE coalesce(cancel_at_period_end,false) = true OR cancelled_at IS NOT NULL`) : null;
    retentionKpis.push({ key: 'active_recurring_subs', label: 'Active Recurring Subscriptions', value: activeRec, unit: 'count', present: pRec });
    retentionKpis.push({ key: 'cancellations', label: 'Cancellations / Pending Churn', value: cancelling, unit: 'count', present: pRec });
  }

  const sections: FounderSection[] = [
    { key: 'revenue', label: 'Revenue', description: 'Paid revenue, transaction volume and 30-day momentum.', kpis: revKpis },
    { key: 'growth', label: 'Growth', description: 'New entities acquired in the last 30 days vs the prior 30.', kpis: growthKpis },
    { key: 'adoption', label: 'Adoption', description: 'Assessment completion and profile activation across the platform.', kpis: adoptionKpis },
    { key: 'retention', label: 'Retention', description: 'Active subscriptions, upcoming renewals and churn signals.', kpis: retentionKpis },
  ];

  return {
    generated_at,
    degraded,
    sections,
    notes: [
      'All KPIs are composed read-only from live source tables; this console writes nothing.',
      'An absent/unreadable source yields a null KPI (never a fabricated 0); a present-but-empty source honestly reports 0.',
      'Period-over-period delta_pct is null when the prior window is empty (no safe base to divide by).',
    ],
  };
}
