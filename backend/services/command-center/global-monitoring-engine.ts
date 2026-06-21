/**
 * Phase 6.14 — Global Monitoring (global_monitoring deliverable). READ-ONLY, never-throws,
 * compose-never-recompute.
 *
 * Surfaces platform-wide health: active alerts, 24h activity pulse, and per-subsystem measurability
 * (derived from the unified Command Center overview — never recomputed). Every figure is composed
 * read-only from live tables; absent/unreadable source → null (unmeasurable), never a fabricated 0.
 */
import pg from 'pg';
import { buildCommandCenterOverview } from './command-center-engine';

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

interface ActivitySpec { key: string; label: string; table: string; sql: string; }

const ACTIVITY_SPECS: ActivitySpec[] = [
  { key: 'sessions_24h', label: 'CAPADEX sessions (24h)', table: 'capadex_sessions',
    sql: `SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE created_at >= now() - interval '24 hours'` },
  { key: 'payments_24h', label: 'Payments (24h)', table: 'capadex_payments',
    sql: `SELECT COUNT(*)::int AS n FROM capadex_payments WHERE created_at >= now() - interval '24 hours'` },
  { key: 'assessments_24h', label: 'Talent assessments (24h)', table: 'ti_fact_assessments',
    sql: `SELECT COUNT(*)::int AS n FROM ti_fact_assessments WHERE completed_at >= now() - interval '24 hours'` },
  { key: 'ei_snapshots_24h', label: 'EI snapshots (24h)', table: 'ei_profile_snapshots',
    sql: `SELECT COUNT(*)::int AS n FROM ei_profile_snapshots WHERE created_at >= now() - interval '24 hours'` },
  { key: 'escalations_24h', label: 'Escalations raised (24h)', table: 'rie_escalations',
    sql: `SELECT COUNT(*)::int AS n FROM rie_escalations WHERE created_at >= now() - interval '24 hours'` },
];

export type HealthStatus = 'operational' | 'attention' | 'degraded';

export interface AlertSummary {
  active_governance_alerts: number | null;
  critical_escalations: number | null;
  items: { key: string; label: string; count: number | null; present: boolean; severity: 'high' | 'normal' }[];
}
export interface ActivityItem { key: string; label: string; count: number | null; present: boolean; }
export interface SubsystemStatus { domain: string; label: string; measurable: boolean; present_sources: string[]; }
export interface GlobalMonitoring {
  generated_at: string;
  status: HealthStatus;
  degraded: boolean;
  alerts: AlertSummary;
  activity_24h: ActivityItem[];
  subsystems: SubsystemStatus[];
  subsystem_coverage: { measurable: number; total: number };
  notes: string[];
}

export async function buildGlobalMonitoring(pool: pg.Pool): Promise<GlobalMonitoring> {
  const generated_at = new Date().toISOString();
  let degraded = false;

  // ── Alerts ────────────────────────────────────────────────────────────────
  const aigPresent = await tableExists(pool, 'aig_alerts');
  const riePresent = await tableExists(pool, 'rie_escalations');
  if (!aigPresent || !riePresent) degraded = true;
  const active_governance_alerts = aigPresent
    ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM aig_alerts WHERE coalesce(is_active,false) = true`) : null;
  const critical_escalations = riePresent
    ? await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM rie_escalations
        WHERE lower(coalesce(severity,'')) = 'critical'
          AND lower(coalesce(status,'open')) NOT IN ('resolved','closed','dismissed')`) : null;
  const alerts: AlertSummary = {
    active_governance_alerts,
    critical_escalations,
    items: [
      { key: 'governance_alerts', label: 'Active governance alerts', count: active_governance_alerts, present: aigPresent, severity: 'normal' },
      { key: 'critical_escalations', label: 'Critical escalations open', count: critical_escalations, present: riePresent, severity: 'high' },
    ],
  };

  // ── 24h activity pulse ──────────────────────────────────────────────────────
  const activity_24h: ActivityItem[] = [];
  for (const a of ACTIVITY_SPECS) {
    const present = await tableExists(pool, a.table);
    const count = present ? await safeScalar(pool, a.sql) : null;
    if (!present) degraded = true;
    activity_24h.push({ key: a.key, label: a.label, count, present });
  }

  // ── Subsystem measurability (composed from the unified overview, not recomputed) ──
  const overview = await buildCommandCenterOverview(pool);
  const subsystems: SubsystemStatus[] = overview.domains.map((d) => ({
    domain: d.key, label: d.label, measurable: d.measurable, present_sources: d.present_sources,
  }));
  const measurable = subsystems.filter((s) => s.measurable).length;
  if (overview.degraded) degraded = true;

  // ── Overall status (honest, conservative) ──────────────────────────────────
  let status: HealthStatus = 'operational';
  if ((critical_escalations ?? 0) > 0) status = 'attention';
  if (degraded) status = status === 'attention' ? 'attention' : 'degraded';

  return {
    generated_at,
    status,
    degraded,
    alerts,
    activity_24h,
    subsystems,
    subsystem_coverage: { measurable, total: subsystems.length },
    notes: [
      'Alerts and 24h activity are composed read-only from live tables; subsystem status is derived from the unified Command Center overview (never recomputed).',
      'A missing source yields null (unmeasurable), never a fabricated 0. "degraded" means a source is absent — not that the platform is failing.',
    ],
  };
}
