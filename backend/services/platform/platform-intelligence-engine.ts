/**
 * Phase 6.10 — Platform Intelligence · composite engine (READ-ONLY) → `platform_intelligence`.
 *
 * COMPOSES (never recomputes) the existing read-only commercial engines and the new operational view
 * into the seven Platform Intelligence categories:
 *   • platform_health  (overall status + data-quality index + assessment completion + substrate coverage)
 *   • adoption         (users total / new / by account type + product footprint) — from engagement-engine
 *   • growth           (last-30d vs preceding-30d signups + growth rate) — from operational view
 *   • conversion       (assessment started → completed → paid funnel) — from operational view
 *   • retention        (subscription lifecycle + renewals + transparent retention rate) — from retention-engine
 *   • revenue          (MRR / ARR / collections / segment mix / forecast) — from revenue-engine
 *   • operational      (session/response/telemetry volume + active sessions + exam attempts)
 *
 * GET-NEVER-WRITES: every composed engine is read-only, probes substrate with to_regclass, never
 * creates schema and never throws. This engine adds no DDL of its own. We never fabricate: each
 * category surfaces its own substrate flags, and rates are null with a reason when their denominator
 * is not measurable (no_substrate vs honest empty are DISTINCT states).
 */
import type { Pool } from 'pg';
import { buildEngagementAnalytics, type EngagementAnalytics } from '../commercial/engagement-engine';
import { buildRetentionAnalytics, type RetentionAnalytics } from '../commercial/retention-engine';
import { buildRevenueAnalytics, type RevenueAnalytics } from '../commercial/revenue-engine';
import { buildPlatformOperationalView, type PlatformOperationalView } from './platform-operational-view';

export interface PlatformHealth {
  overall_status: 'healthy' | 'degraded' | 'no_substrate';
  degraded_subsystems: string[];
  data_quality: { measurable: boolean; runtime_contexts: number; avg_reliability_index: number | null };
  assessment_completion_pct: number;
  substrate_coverage: { present: number; total: number; pct: number };
}
export interface AdoptionCategory {
  total_users: number;
  new_users_30d: number;
  new_users_7d: number;
  active_users_30d: number;
  by_account_type: { account_type: string; users: number }[];
  product_footprint: { career_profiles: number; ei_subjects: number; employer_candidates: number };
}
export interface GrowthCategory {
  measurable: boolean;
  new_users_30d: number;
  prev_30d: number;
  delta: number;
  growth_pct: number | null;
}
export interface ConversionCategory {
  session_emails: number;
  completed_emails: number;
  paying_emails: number;
  completion_pct: number; // distinct completed / distinct started
  free_to_paid_pct: number | null;
}
export interface RetentionCategory {
  active: number;
  at_risk: number;
  payment_failures_30d: number;
  retention_rate: number | null; // active / (active + past_due + cancelled), null when no base
  subscriptions_by_status: { status: string; count: number }[];
  renewals: RetentionAnalytics['retention_risk']['renewals'];
}
export interface RevenueCategory {
  mrr_rupees: number;
  arr_rupees: number;
  total_collected_rupees: number;
  onetime_rupees: number;
  active_subscriptions: number;
  by_segment: RevenueAnalytics['by_segment'];
  forecast: RevenueAnalytics['recurring']['forecast'];
}
export interface OperationalCategory {
  sessions_total: number;
  sessions_completed: number;
  sessions_in_progress: number;
  responses_total: number;
  telemetry_rows: number;
  active_sessions: number | null;
  exam_attempts: number;
}

export interface PlatformIntelligenceHeadline {
  total_users: number;
  new_users_30d: number;
  active_users_30d: number;
  mrr_rupees: number;
  paying_customers: number;
  assessment_completion_pct: number;
  active_subscriptions: number;
  health_status: PlatformHealth['overall_status'];
}

export interface PlatformIntelligence {
  generated_at: string;
  degraded: boolean;
  headline: PlatformIntelligenceHeadline;
  platform_health: PlatformHealth;
  adoption: AdoptionCategory;
  growth: GrowthCategory;
  conversion: ConversionCategory;
  retention: RetentionCategory;
  revenue: RevenueCategory;
  operational: OperationalCategory;
  notes: string[];
}

/** Phase 6.10 composite platform intelligence. Read-only, never throws, never fabricates. */
export async function buildPlatformIntelligence(pool: Pool): Promise<PlatformIntelligence> {
  const engagement = await buildEngagementAnalytics(pool).catch(() => null);
  const retention = await buildRetentionAnalytics(pool).catch(() => null);
  const revenue = await buildRevenueAnalytics(pool).catch(() => null);
  const ops = await buildPlatformOperationalView(pool).catch(() => null);

  const notes: string[] = [];
  let degraded = false;
  const degraded_subsystems: string[] = [];
  const track = (name: string, val: { degraded?: boolean } | null) => {
    if (!val) { degraded = true; degraded_subsystems.push(name); notes.push(`${name} engine failed to compose — figures unavailable.`); return; }
    if (val.degraded) { degraded = true; degraded_subsystems.push(name); }
  };
  track('engagement', engagement);
  track('retention', retention);
  track('revenue', revenue);
  track('operational', ops);

  const eng = engagement;
  const ret = retention;
  const rev = revenue;

  // ── Platform health ─────────────────────────────────────────────────────────────────────────────
  const substrateFlags = ops ? Object.values(ops.substrate) : [];
  const present = substrateFlags.filter(Boolean).length;
  const total = substrateFlags.length || 1;
  const anyPresent = present > 0 || (eng?.substrate.users ?? false);
  const platform_health: PlatformHealth = {
    overall_status: !anyPresent ? 'no_substrate' : (degraded ? 'degraded' : 'healthy'),
    degraded_subsystems,
    data_quality: ops?.data_quality ?? { measurable: false, runtime_contexts: 0, avg_reliability_index: null },
    assessment_completion_pct: eng?.completion.capadex_completion_pct ?? 0,
    substrate_coverage: { present, total, pct: Math.round((present / total) * 1000) / 10 },
  };

  // ── Adoption ────────────────────────────────────────────────────────────────────────────────────
  const adoption: AdoptionCategory = {
    total_users: eng?.adoption.total_users ?? 0,
    new_users_30d: eng?.adoption.new_users_30d ?? 0,
    new_users_7d: eng?.adoption.new_users_7d ?? 0,
    active_users_30d: eng?.engagement.active_users_30d ?? 0,
    by_account_type: eng?.adoption.by_account_type ?? [],
    product_footprint: {
      career_profiles: eng?.product_usage.career_profiles ?? 0,
      ei_subjects: eng?.product_usage.ei_subjects ?? 0,
      employer_candidates: eng?.product_usage.employer_candidates ?? 0,
    },
  };

  // ── Growth ──────────────────────────────────────────────────────────────────────────────────────
  const growth: GrowthCategory = {
    measurable: ops?.growth_trend.measurable ?? false,
    new_users_30d: ops?.growth_trend.new_users_30d ?? adoption.new_users_30d,
    prev_30d: ops?.growth_trend.prev_30d ?? 0,
    delta: ops?.growth_trend.delta ?? 0,
    growth_pct: ops?.growth_trend.growth_pct ?? null,
  };

  // ── Conversion ──────────────────────────────────────────────────────────────────────────────────
  const cf = ops?.conversion_funnel;
  const conversion: ConversionCategory = {
    session_emails: cf?.session_emails ?? 0,
    completed_emails: cf?.completed_emails ?? 0,
    paying_emails: cf?.paying_emails ?? 0,
    completion_pct: cf && cf.session_emails > 0 ? Math.round((cf.completed_emails / cf.session_emails) * 1000) / 10 : 0,
    free_to_paid_pct: cf?.free_to_paid_pct ?? null,
  };

  // ── Retention (transparent retention rate over the measurable lifecycle base) ───────────────────
  let retentionDenom = 0;
  for (const s of ret?.retention_risk.subscriptions_by_status ?? []) {
    if (s.status === 'active' || s.status === 'past_due' || s.status === 'cancelled') retentionDenom += s.count;
  }
  const retentionData: RetentionCategory = {
    active: ret?.retention_risk.active ?? 0,
    at_risk: ret?.retention_risk.at_risk ?? 0,
    payment_failures_30d: ret?.retention_risk.payment_failures_30d ?? 0,
    retention_rate: retentionDenom > 0 ? Math.round(((ret?.retention_risk.active ?? 0) / retentionDenom) * 1000) / 10 : null,
    subscriptions_by_status: ret?.retention_risk.subscriptions_by_status ?? [],
    renewals: ret?.retention_risk.renewals ?? { window_days: 30, due_soon: 0, in_grace: 0, churning: 0 },
  };
  if (retentionDenom === 0) notes.push('Retention rate not measurable yet (no active/past-due/cancelled subscription base).');

  // ── Revenue ─────────────────────────────────────────────────────────────────────────────────────
  const revenueData: RevenueCategory = {
    mrr_rupees: rev?.recurring.mrr_rupees ?? 0,
    arr_rupees: rev?.recurring.arr_rupees ?? 0,
    total_collected_rupees: rev?.totals.total_rupees ?? 0,
    onetime_rupees: rev?.totals.onetime_rupees ?? 0,
    active_subscriptions: rev?.recurring.active_subscriptions ?? 0,
    by_segment: rev?.by_segment ?? [],
    forecast: rev?.recurring.forecast ?? { forecastable: false, reason: 'insufficient_periods', detail: 'No recurring substrate.' },
  };

  // ── Operational ─────────────────────────────────────────────────────────────────────────────────
  const operational: OperationalCategory = {
    sessions_total: ops?.operational.sessions_total ?? 0,
    sessions_completed: ops?.operational.sessions_completed ?? 0,
    sessions_in_progress: ops?.operational.sessions_in_progress ?? 0,
    responses_total: ops?.operational.responses_total ?? 0,
    telemetry_rows: ops?.operational.telemetry_rows ?? 0,
    active_sessions: ops?.operational.active_sessions ?? null,
    exam_attempts: eng?.completion.exam_attempts ?? 0,
  };

  const headline: PlatformIntelligenceHeadline = {
    total_users: adoption.total_users,
    new_users_30d: adoption.new_users_30d,
    active_users_30d: adoption.active_users_30d,
    mrr_rupees: revenueData.mrr_rupees,
    paying_customers: conversion.paying_emails,
    assessment_completion_pct: platform_health.assessment_completion_pct,
    active_subscriptions: revenueData.active_subscriptions,
    health_status: platform_health.overall_status,
  };

  for (const n of ops?.notes ?? []) notes.push(n);

  return {
    generated_at: new Date().toISOString(),
    degraded,
    headline,
    platform_health,
    adoption,
    growth,
    conversion,
    retention: retentionData,
    revenue: revenueData,
    operational,
    notes,
  };
}
