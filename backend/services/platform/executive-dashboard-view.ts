/**
 * Phase 6.10 — Platform Intelligence · executive dashboard (READ-ONLY) → `executive_dashboard`.
 *
 * COMPOSES buildPlatformIntelligence ONCE (compose-never-recompute) and projects a curated executive
 * KPI summary: the north-star cards an executive needs at a glance, plus the platform-health banner.
 * Every KPI carries a `measurable` flag — a rate that has no honest denominator is surfaced as
 * not-measurable (value null + reason), NEVER fabricated. Read-only, never throws.
 */
import type { Pool } from 'pg';
import { buildPlatformIntelligence, type PlatformIntelligence } from './platform-intelligence-engine';

export interface ExecutiveKpi {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'rupees' | 'pct';
  measurable: boolean;
  sub?: string;
}
export interface ExecutiveDashboard {
  generated_at: string;
  degraded: boolean;
  health_status: PlatformIntelligence['platform_health']['overall_status'];
  kpis: ExecutiveKpi[];
  attention: string[]; // operational/commercial items that warrant executive attention
  notes: string[];
}

/** Phase 6.10 executive dashboard. Read-only, never throws, never fabricates. */
export async function buildExecutiveDashboard(pool: Pool): Promise<ExecutiveDashboard> {
  const pi = await buildPlatformIntelligence(pool);

  const kpis: ExecutiveKpi[] = [
    { key: 'total_users', label: 'Total Users', value: pi.adoption.total_users, unit: 'count', measurable: true,
      sub: `${pi.adoption.new_users_30d.toLocaleString('en-IN')} new in 30d` },
    { key: 'active_users_30d', label: 'Active Users (30d)', value: pi.adoption.active_users_30d, unit: 'count', measurable: true },
    { key: 'mrr', label: 'MRR', value: pi.revenue.mrr_rupees, unit: 'rupees', measurable: true,
      sub: `ARR ₹${pi.revenue.arr_rupees.toLocaleString('en-IN')}` },
    { key: 'total_collected', label: 'Total Collected', value: pi.revenue.total_collected_rupees, unit: 'rupees', measurable: true,
      sub: `₹${pi.revenue.onetime_rupees.toLocaleString('en-IN')} one-time` },
    { key: 'paying_customers', label: 'Paying Customers', value: pi.conversion.paying_emails, unit: 'count', measurable: true },
    { key: 'assessment_completion', label: 'Assessment Completion', value: pi.platform_health.assessment_completion_pct, unit: 'pct', measurable: true },
    { key: 'free_to_paid', label: 'Free → Paid', value: pi.conversion.free_to_paid_pct, unit: 'pct',
      measurable: pi.conversion.free_to_paid_pct != null, sub: pi.conversion.free_to_paid_pct == null ? 'no assessment base yet' : undefined },
    { key: 'retention_rate', label: 'Retention Rate', value: pi.retention.retention_rate, unit: 'pct',
      measurable: pi.retention.retention_rate != null, sub: pi.retention.retention_rate == null ? 'no subscription base yet' : undefined },
    { key: 'growth_rate', label: 'Growth Rate (30d)', value: pi.growth.growth_pct, unit: 'pct',
      measurable: pi.growth.measurable, sub: pi.growth.measurable ? undefined : 'no prior window to compare' },
  ];

  const attention: string[] = [];
  if (pi.retention.at_risk > 0) attention.push(`${pi.retention.at_risk} subscription(s) past due (at-risk).`);
  if (pi.retention.payment_failures_30d > 0) attention.push(`${pi.retention.payment_failures_30d} payment failure(s) in the last 30 days.`);
  if (pi.retention.renewals.churning > 0) attention.push(`${pi.retention.renewals.churning} subscription(s) churning in the renewal window.`);
  if (pi.platform_health.degraded_subsystems.length > 0) {
    attention.push(`Subsystem(s) degraded or not fully activated: ${pi.platform_health.degraded_subsystems.join(', ')}.`);
  }
  if (pi.operational.sessions_in_progress > 0) attention.push(`${pi.operational.sessions_in_progress} assessment session(s) in progress.`);

  return {
    generated_at: new Date().toISOString(),
    degraded: pi.degraded,
    health_status: pi.platform_health.overall_status,
    kpis,
    attention,
    notes: pi.notes,
  };
}
