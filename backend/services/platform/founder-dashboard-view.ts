/**
 * Phase 6.10 — Platform Intelligence · founder dashboard (READ-ONLY) → `founder_dashboard`.
 *
 * COMPOSES buildPlatformIntelligence ONCE (compose-never-recompute) and projects the founder's
 * North-Star view: growth, revenue run-rate, conversion economics and retention/churn risk, grouped
 * for a founder rather than an operator. Every rate carries a `measurable` flag and is null with a
 * reason when it has no honest denominator — never fabricated. Read-only, never throws.
 */
import type { Pool } from 'pg';
import { buildPlatformIntelligence, type PlatformIntelligence } from './platform-intelligence-engine';

export interface FounderMetric {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'rupees' | 'pct';
  measurable: boolean;
  note?: string;
}
export interface FounderMetricGroup {
  group: 'growth' | 'revenue' | 'conversion' | 'retention';
  metrics: FounderMetric[];
}
export interface FounderDashboard {
  generated_at: string;
  degraded: boolean;
  health_status: PlatformIntelligence['platform_health']['overall_status'];
  north_star: FounderMetric; // the single headline founders track first
  groups: FounderMetricGroup[];
  notes: string[];
}

/** Phase 6.10 founder dashboard. Read-only, never throws, never fabricates. */
export async function buildFounderDashboard(pool: Pool): Promise<FounderDashboard> {
  const pi = await buildPlatformIntelligence(pool);

  // North Star: monthly recurring revenue — the single number a founder anchors on.
  const north_star: FounderMetric = {
    key: 'mrr', label: 'Monthly Recurring Revenue', value: pi.revenue.mrr_rupees, unit: 'rupees', measurable: true,
    note: `ARR run-rate ₹${pi.revenue.arr_rupees.toLocaleString('en-IN')}`,
  };

  const groups: FounderMetricGroup[] = [
    {
      group: 'growth',
      metrics: [
        { key: 'new_users_30d', label: 'New Users (30d)', value: pi.growth.new_users_30d, unit: 'count', measurable: true },
        { key: 'growth_pct', label: 'Growth Rate (30d vs prior)', value: pi.growth.growth_pct, unit: 'pct',
          measurable: pi.growth.measurable, note: pi.growth.measurable ? `prior 30d: ${pi.growth.prev_30d}` : 'no prior window to compare' },
        { key: 'total_users', label: 'Total Users', value: pi.adoption.total_users, unit: 'count', measurable: true },
        { key: 'active_users_30d', label: 'Active Users (30d)', value: pi.adoption.active_users_30d, unit: 'count', measurable: true },
      ],
    },
    {
      group: 'revenue',
      metrics: [
        { key: 'arr', label: 'ARR Run-rate', value: pi.revenue.arr_rupees, unit: 'rupees', measurable: true },
        { key: 'total_collected', label: 'Total Collected', value: pi.revenue.total_collected_rupees, unit: 'rupees', measurable: true },
        { key: 'onetime', label: 'One-time Revenue', value: pi.revenue.onetime_rupees, unit: 'rupees', measurable: true },
        { key: 'active_subscriptions', label: 'Active Subscriptions', value: pi.revenue.active_subscriptions, unit: 'count', measurable: true },
      ],
    },
    {
      group: 'conversion',
      metrics: [
        { key: 'paying_customers', label: 'Paying Customers', value: pi.conversion.paying_emails, unit: 'count', measurable: true },
        { key: 'free_to_paid', label: 'Free → Paid', value: pi.conversion.free_to_paid_pct, unit: 'pct',
          measurable: pi.conversion.free_to_paid_pct != null, note: pi.conversion.free_to_paid_pct == null ? 'no assessment base yet' : undefined },
        { key: 'assessment_completion', label: 'Assessment Completion', value: pi.platform_health.assessment_completion_pct, unit: 'pct', measurable: true },
      ],
    },
    {
      group: 'retention',
      metrics: [
        { key: 'retention_rate', label: 'Retention Rate', value: pi.retention.retention_rate, unit: 'pct',
          measurable: pi.retention.retention_rate != null, note: pi.retention.retention_rate == null ? 'no subscription base yet' : undefined },
        { key: 'at_risk', label: 'At-risk Subscriptions', value: pi.retention.at_risk, unit: 'count', measurable: true },
        { key: 'churning', label: 'Churning (renewal window)', value: pi.retention.renewals.churning, unit: 'count', measurable: true },
        { key: 'payment_failures_30d', label: 'Payment Failures (30d)', value: pi.retention.payment_failures_30d, unit: 'count', measurable: true },
      ],
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    degraded: pi.degraded,
    health_status: pi.platform_health.overall_status,
    north_star,
    groups,
    notes: pi.notes,
  };
}
