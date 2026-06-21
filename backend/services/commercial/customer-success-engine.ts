/**
 * Phase 6.8 — Customer Success Intelligence · customer success engine (READ-ONLY).
 *
 * COMPOSES (never recomputes) the engagement engine (adoption / engagement / completion /
 * product usage) and the retention engine (retention risk / expansion) into a single Customer
 * Success view, plus a TRANSPARENT health index.
 *
 * The health index is a disclosed weighted blend of measured rates only:
 *   • engagement_rate  = active_users_30d / total_users          (weight 0.40)
 *   • completion_rate  = capadex_completion_pct / 100            (weight 0.30)
 *   • retention_rate   = active / (active + past_due + cancelled)(weight 0.30)
 * Each component is included ONLY when its denominator is measurable; the weights of the included
 * components are renormalised to sum to 1 and the `components` list discloses exactly which were
 * used. If no component is measurable the index is null with a reason — never a fabricated score.
 *
 * GET-NEVER-WRITES: composes read-only engines; no schema creation; honest empties on absence.
 */
import type { Pool } from 'pg';
import { buildEngagementAnalytics, type EngagementAnalytics } from './engagement-engine';
import { buildRetentionAnalytics, type RetentionAnalytics } from './retention-engine';

export interface HealthComponent {
  key: 'engagement_rate' | 'completion_rate' | 'retention_rate';
  value: number; // 0..1
  weight: number; // renormalised weight actually applied
}
export interface HealthIndex {
  measurable: boolean;
  score: number | null; // 0..100
  components: HealthComponent[];
  reason?: string;
}
export interface CustomerSuccessHeadline {
  total_users: number;
  new_users_30d: number;
  active_users_30d: number;
  assessment_completion_pct: number;
  active_subscriptions: number;
  at_risk_subscriptions: number;
  expansion_candidates: number;
}

export interface CustomerSuccessAnalytics {
  generated_at: string;
  degraded: boolean;
  headline: CustomerSuccessHeadline;
  health: HealthIndex;
  engagement: EngagementAnalytics;
  retention: RetentionAnalytics;
  notes: string[];
}

const RAW_WEIGHTS = { engagement_rate: 0.4, completion_rate: 0.3, retention_rate: 0.3 } as const;

/** Phase 6.8 composite customer success analytics. Read-only, never throws, never fabricates. */
export async function buildCustomerSuccess(pool: Pool): Promise<CustomerSuccessAnalytics> {
  const engagement = await buildEngagementAnalytics(pool).catch(() => null);
  const retention = await buildRetentionAnalytics(pool).catch(() => null);

  let degraded = (engagement?.degraded ?? true) || (retention?.degraded ?? true);
  const notes: string[] = [];
  if (!engagement) { degraded = true; notes.push('Engagement engine failed to compose — engagement figures unavailable.'); }
  if (!retention) { degraded = true; notes.push('Retention engine failed to compose — retention figures unavailable.'); }

  const eng = engagement;
  const ret = retention;

  // ── Transparent health index over measurable components only ────────────────────────────────────
  const rawComponents: { key: HealthComponent['key']; value: number | null }[] = [];

  const totalUsers = eng?.adoption.total_users ?? 0;
  rawComponents.push({
    key: 'engagement_rate',
    value: totalUsers > 0 ? Math.min(1, (eng?.engagement.active_users_30d ?? 0) / totalUsers) : null,
  });

  const capadexTotal = eng?.completion.capadex_total ?? 0;
  rawComponents.push({
    key: 'completion_rate',
    value: capadexTotal > 0 ? (eng?.completion.capadex_completion_pct ?? 0) / 100 : null,
  });

  let retentionDenom = 0;
  for (const s of ret?.retention_risk.subscriptions_by_status ?? []) {
    if (s.status === 'active' || s.status === 'past_due' || s.status === 'cancelled') retentionDenom += s.count;
  }
  rawComponents.push({
    key: 'retention_rate',
    value: retentionDenom > 0 ? (ret?.retention_risk.active ?? 0) / retentionDenom : null,
  });

  const measured = rawComponents.filter((c) => c.value != null) as { key: HealthComponent['key']; value: number }[];
  let health: HealthIndex;
  if (measured.length === 0) {
    health = { measurable: false, score: null, components: [], reason: 'No measurable health components (no users, completions or subscriptions).' };
  } else {
    const weightSum = measured.reduce((acc, c) => acc + RAW_WEIGHTS[c.key], 0);
    const components: HealthComponent[] = measured.map((c) => ({
      key: c.key,
      value: Math.round(c.value * 1000) / 1000,
      weight: Math.round((RAW_WEIGHTS[c.key] / weightSum) * 1000) / 1000,
    }));
    const score = components.reduce((acc, c) => acc + c.value * c.weight, 0) * 100;
    health = { measurable: true, score: Math.round(score * 10) / 10, components };
    if (measured.length < rawComponents.length) {
      notes.push(`Health index computed over ${measured.length}/${rawComponents.length} components (others unmeasurable); weights renormalised.`);
    }
  }

  const headline: CustomerSuccessHeadline = {
    total_users: totalUsers,
    new_users_30d: eng?.adoption.new_users_30d ?? 0,
    active_users_30d: eng?.engagement.active_users_30d ?? 0,
    assessment_completion_pct: eng?.completion.capadex_completion_pct ?? 0,
    active_subscriptions: ret?.retention_risk.active ?? 0,
    at_risk_subscriptions: ret?.retention_risk.at_risk ?? 0,
    expansion_candidates: (ret?.expansion.high_usage_customers.length ?? 0) + (ret?.expansion.repeat_onetime_buyers.length ?? 0),
  };

  return {
    generated_at: new Date().toISOString(),
    degraded,
    headline,
    health,
    engagement: eng ?? emptyEngagement(),
    retention: ret ?? emptyRetention(),
    notes,
  };
}

function emptyEngagement(): EngagementAnalytics {
  return {
    generated_at: new Date().toISOString(),
    degraded: true,
    substrate: {
      users: false, express_sessions: false, ei_events: false, capadex_sessions: false,
      onto_competency_profiles: false, exam_attempts: false, ei_profile_snapshots: false,
      career_seeker_profiles: false, employer_candidates: false, employer_jobs: false, eios_campaigns: false,
    },
    adoption: { total_users: 0, new_users_30d: 0, new_users_7d: 0, by_account_type: [] },
    engagement: { active_sessions: null, active_users_30d: 0, active_users_7d: 0, events_30d: 0, by_event_type: [] },
    completion: { capadex_total: 0, capadex_completed: 0, capadex_completion_pct: 0, competency_scored_subjects: 0, exam_attempts: 0 },
    product_usage: { ei_snapshots: 0, ei_subjects: 0, career_profiles: 0, career_avg_completeness: null, employer_candidates: 0, employer_jobs: 0, eios_campaigns: 0 },
    notes: ['Engagement engine unavailable.'],
  };
}
function emptyRetention(): RetentionAnalytics {
  return {
    generated_at: new Date().toISOString(),
    degraded: true,
    substrate: { comm_subscriptions: false, comm_subscription_events: false, comm_usage_events: false, capadex_payments: false },
    retention_risk: { subscriptions_by_status: [], active: 0, at_risk: 0, payment_failures_30d: 0, renewals: { window_days: 30, due_soon: 0, in_grace: 0, churning: 0 } },
    expansion: { high_usage_customers: [], repeat_onetime_buyers: [], note: 'Retention engine unavailable.' },
    notes: ['Retention engine unavailable.'],
  };
}
