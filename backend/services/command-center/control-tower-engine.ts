/**
 * Phase 6.14 — Platform Control Tower (platform_control_tower deliverable). READ-ONLY, never-throws.
 *
 * Surfaces what needs operator attention NOW: pending actions, data freshness, and platform capacity.
 * Every count/timestamp is composed read-only from live tables (to_regclass probes). Absent/unreadable
 * source → null (unmeasurable), never a fabricated 0. No DDL, no writes.
 */
import pg from 'pg';

const N = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

async function safeScalar(pool: pg.Pool, sql: string): Promise<number | null> {
  try {
    const r = await pool.query(sql);
    const v = r.rows[0]?.n;
    return v == null ? null : N(v);
  } catch { return null; }
}

async function safeTimestamp(pool: pg.Pool, sql: string): Promise<string | null> {
  try {
    const r = await pool.query(sql);
    const v = r.rows[0]?.t;
    return v ? new Date(v).toISOString() : null;
  } catch { return null; }
}

interface PendingSpec { key: string; label: string; table: string; sql: string; severity: 'high' | 'normal'; }
interface FreshnessSpec { key: string; label: string; table: string; sql: string; }

const PENDING_SPECS: PendingSpec[] = [
  { key: 'employer_approvals', label: 'Employer approvals pending', table: 'employer_approvals', severity: 'high',
    sql: `SELECT COUNT(*)::int AS n FROM employer_approvals WHERE lower(coalesce(status,'pending')) = 'pending'` },
  { key: 'critical_escalations', label: 'Critical escalations open', table: 'rie_escalations', severity: 'high',
    sql: `SELECT COUNT(*)::int AS n FROM rie_escalations
          WHERE lower(coalesce(severity,'')) = 'critical'
            AND lower(coalesce(status,'open')) NOT IN ('resolved','closed','dismissed')` },
  { key: 'open_escalations', label: 'Escalations open', table: 'rie_escalations', severity: 'normal',
    sql: `SELECT COUNT(*)::int AS n FROM rie_escalations
          WHERE lower(coalesce(status,'open')) NOT IN ('resolved','closed','dismissed')` },
  { key: 'package_renewals_due', label: 'Package renewals due (30d)', table: 'student_subscriptions', severity: 'normal',
    sql: `SELECT COUNT(*)::int AS n FROM student_subscriptions
          WHERE lower(coalesce(status,'active')) IN ('active','live')
            AND expiry_date IS NOT NULL AND expiry_date <= now() + interval '30 days' AND expiry_date >= now()` },
  { key: 'recurring_renewals_due', label: 'Recurring renewals due (30d)', table: 'comm_subscriptions', severity: 'normal',
    sql: `SELECT COUNT(*)::int AS n FROM comm_subscriptions
          WHERE lower(coalesce(status,'')) IN ('active','trialing','in_grace')
            AND current_period_end IS NOT NULL AND current_period_end <= now() + interval '30 days'` },
  { key: 'candidates_in_review', label: 'Candidates awaiting review', table: 'employer_candidates', severity: 'normal',
    sql: `SELECT COUNT(*)::int AS n FROM employer_candidates
          WHERE lower(coalesce(stage,'new')) IN ('new','applied','screening','review','shortlisted')` },
];

const FRESHNESS_SPECS: FreshnessSpec[] = [
  { key: 'last_session', label: 'Last CAPADEX session', table: 'capadex_sessions',
    sql: `SELECT MAX(created_at) AS t FROM capadex_sessions` },
  { key: 'last_payment', label: 'Last payment', table: 'capadex_payments',
    sql: `SELECT MAX(created_at) AS t FROM capadex_payments` },
  { key: 'last_assessment', label: 'Last talent assessment', table: 'ti_fact_assessments',
    sql: `SELECT MAX(completed_at) AS t FROM ti_fact_assessments` },
  { key: 'last_ei_snapshot', label: 'Last EI snapshot', table: 'ei_profile_snapshots',
    sql: `SELECT MAX(created_at) AS t FROM ei_profile_snapshots` },
  { key: 'last_escalation', label: 'Last escalation', table: 'rie_escalations',
    sql: `SELECT MAX(created_at) AS t FROM rie_escalations` },
];

export interface PendingAction { key: string; label: string; count: number | null; present: boolean; severity: 'high' | 'normal'; }
export interface FreshnessItem { key: string; label: string; last_at: string | null; present: boolean; }
export interface ControlTower {
  generated_at: string;
  degraded: boolean;
  pending_actions: PendingAction[];
  pending_total: number | null;
  freshness: FreshnessItem[];
  platform: {
    total_users: number | null;
    active_sessions: number | null;
    feature_flags_total: number | null;
    feature_flags_enabled: number | null;
  };
  notes: string[];
}

export async function buildControlTower(pool: pg.Pool): Promise<ControlTower> {
  const generated_at = new Date().toISOString();
  let degraded = false;

  const pending_actions: PendingAction[] = [];
  let pending_total: number | null = null;
  for (const p of PENDING_SPECS) {
    const present = await tableExists(pool, p.table);
    const count = present ? await safeScalar(pool, p.sql) : null;
    if (!present) degraded = true;
    if (count != null) pending_total = (pending_total ?? 0) + count;
    pending_actions.push({ key: p.key, label: p.label, count, present, severity: p.severity });
  }

  const freshness: FreshnessItem[] = [];
  for (const f of FRESHNESS_SPECS) {
    const present = await tableExists(pool, f.table);
    const last_at = present ? await safeTimestamp(pool, f.sql) : null;
    if (!present) degraded = true;
    freshness.push({ key: f.key, label: f.label, last_at, present });
  }

  const usersPresent = await tableExists(pool, 'users');
  const sessionsPresent = await tableExists(pool, 'express_sessions');
  const flagsPresent = await tableExists(pool, 'feature_flags');
  const platform = {
    total_users: usersPresent ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM users`) : null,
    active_sessions: sessionsPresent
      ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM express_sessions WHERE expire > now()`) : null,
    feature_flags_total: flagsPresent ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM feature_flags`) : null,
    feature_flags_enabled: flagsPresent
      ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM feature_flags WHERE coalesce(enabled,false) = true`) : null,
  };

  return {
    generated_at,
    degraded,
    pending_actions,
    pending_total,
    freshness,
    platform,
    notes: [
      'Pending actions and freshness are composed read-only from live tables; this console advances or dispatches nothing.',
      'A missing source table yields a null count/timestamp (unmeasurable), never a fabricated 0.',
    ],
  };
}
