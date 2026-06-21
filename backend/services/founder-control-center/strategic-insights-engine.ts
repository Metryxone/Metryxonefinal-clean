/**
 * Phase 6.15 — Strategic Insights engine (strategic_insights deliverable). READ-ONLY.
 *
 * COMPOSES the Founder Dashboard, Executive Intelligence and Global Monitoring outputs into:
 *   risk_indicators — bounded-severity signals derived from measurable metrics only.
 *   insights        — short strategic narrative lines, each provenance-bound to a measurable
 *                     metric (an unmeasurable metric emits NO insight — never fabricated).
 *
 * The 9th founder domain (Risk Indicators) lives here; the other 8 live in the dashboard (4)
 * and executive intelligence (4) engines.
 */
import pg from 'pg';
import { buildFounderDashboard, type FounderDashboard, type Kpi } from './founder-dashboard-engine';
import { buildExecutiveIntelligence, type ExecutiveIntelligence } from './executive-intelligence-engine';
import { buildGlobalMonitoring, type GlobalMonitoring } from '../command-center/global-monitoring-engine';

export type Severity = 'high' | 'medium' | 'low' | 'info';
export type Tone = 'positive' | 'watch' | 'risk';

export interface RiskIndicator {
  key: string;
  label: string;
  severity: Severity;
  value: number | null;
  measurable: boolean;
  detail: string;
}
export interface Insight {
  key: string;
  category: string;
  tone: Tone;
  text: string;
  metric_ref: string; // provenance: which measurable metric this insight is bound to
}
export interface StrategicInsights {
  generated_at: string;
  degraded: boolean;
  risk_indicators: RiskIndicator[];
  insights: Insight[];
  risk_summary: { high: number; medium: number; low: number; measurable_signals: number };
  notes: string[];
}

function kpi(dash: FounderDashboard, sectionKey: string, kpiKey: string): Kpi | undefined {
  return dash.sections.find((s) => s.key === sectionKey)?.kpis.find((k) => k.key === kpiKey);
}

export async function buildStrategicInsights(pool: pg.Pool): Promise<StrategicInsights> {
  const generated_at = new Date().toISOString();
  const dash: FounderDashboard = await buildFounderDashboard(pool);
  const exec: ExecutiveIntelligence = await buildExecutiveIntelligence(pool);
  const monitoring: GlobalMonitoring = await buildGlobalMonitoring(pool);
  const degraded = dash.degraded || exec.degraded || monitoring.degraded;

  const risks: RiskIndicator[] = [];
  const insights: Insight[] = [];

  // ── Risk: open critical escalations ──────────────────────────────────────────
  const crit = monitoring.alerts.critical_escalations;
  risks.push({
    key: 'critical_escalations', label: 'Open Critical Escalations',
    severity: crit == null ? 'info' : crit > 0 ? 'high' : 'low',
    value: crit, measurable: crit != null,
    detail: crit == null ? 'escalations unreadable' : crit > 0 ? `${crit} unresolved critical escalation(s)` : 'no critical escalations open',
  });
  if (crit != null && crit > 0) {
    insights.push({ key: 'i_escalations', category: 'Risk', tone: 'risk', metric_ref: 'monitoring.critical_escalations',
      text: `${crit} critical escalation(s) are open and need resolution.` });
  }

  // ── Risk: revenue momentum ───────────────────────────────────────────────────
  const rev30 = kpi(dash, 'revenue', 'revenue_30d');
  if (rev30?.present && rev30.trend) {
    const t = rev30.trend;
    // A % momentum signal is only honest when there is a strictly positive prior base.
    // A null/zero prior window yields no denominator → delta_pct is null and the signal
    // stays informational ('insufficient prior baseline') rather than fabricating "0%".
    const measurable = t.current != null && t.previous != null && t.previous > 0 && t.delta_pct != null;
    const declining = measurable && t.current! < t.previous!;
    risks.push({
      key: 'revenue_momentum', label: 'Revenue Momentum (30d)',
      severity: !measurable ? 'info' : declining ? 'medium' : 'low',
      value: measurable ? t.delta_pct : null, measurable,
      detail: !measurable ? 'insufficient prior baseline' : `${t.delta_pct}% vs prior 30 days`,
    });
    if (measurable) {
      if (declining) insights.push({ key: 'i_rev_down', category: 'Revenue', tone: 'risk', metric_ref: 'dashboard.revenue.revenue_30d',
        text: `30-day revenue is down ${Math.abs(t.delta_pct!)}% versus the prior period.` });
      else if (t.direction === 'up') insights.push({ key: 'i_rev_up', category: 'Revenue', tone: 'positive', metric_ref: 'dashboard.revenue.revenue_30d',
        text: `30-day revenue is up ${t.delta_pct}% versus the prior period.` });
    }
  }

  // ── Risk: renewals due (package + recurring churn) ───────────────────────────
  const expiring = kpi(dash, 'retention', 'expiring_package_30d');
  if (expiring?.present) {
    risks.push({
      key: 'renewals_due', label: 'Package Renewals Due (30d)',
      severity: expiring.value == null ? 'info' : expiring.value > 0 ? 'medium' : 'low',
      value: expiring.value, measurable: expiring.value != null,
      detail: expiring.value == null ? 'subscriptions unreadable' : `${expiring.value} package(s) expiring within 30 days`,
    });
    if (expiring.value != null && expiring.value > 0) insights.push({ key: 'i_renewals', category: 'Retention', tone: 'watch', metric_ref: 'dashboard.retention.expiring_package_30d',
      text: `${expiring.value} package subscription(s) expire within 30 days — schedule a renewal motion.` });
  }
  const cancel = kpi(dash, 'retention', 'cancellations');
  if (cancel?.present) {
    risks.push({
      key: 'churn', label: 'Cancellations / Pending Churn',
      severity: cancel.value == null ? 'info' : cancel.value > 0 ? 'medium' : 'low',
      value: cancel.value, measurable: cancel.value != null,
      detail: cancel.value == null ? 'recurring subscriptions unreadable' : `${cancel.value} cancelled / pending churn`,
    });
    if (cancel.value != null && cancel.value > 0) insights.push({ key: 'i_churn', category: 'Retention', tone: 'risk', metric_ref: 'dashboard.retention.cancellations',
      text: `${cancel.value} recurring subscription(s) are cancelling — investigate churn drivers.` });
  }

  // ── Risk: health domains below threshold ─────────────────────────────────────
  for (const d of exec.domains) {
    if (d.score == null) continue; // unmeasurable → no fabricated risk
    if (d.band === 'at_risk') {
      risks.push({ key: `health_${d.key}`, label: `${d.label} At Risk`, severity: 'high', value: d.score, measurable: true,
        detail: `${d.label} score ${d.score} (at risk)` });
      insights.push({ key: `i_${d.key}`, category: 'Health', tone: 'risk', metric_ref: `executive.${d.key}.score`,
        text: `${d.label} is at risk (score ${d.score}).` });
    } else if (d.band === 'watch') {
      risks.push({ key: `health_${d.key}`, label: `${d.label} Needs Watching`, severity: 'medium', value: d.score, measurable: true,
        detail: `${d.label} score ${d.score} (watch)` });
    } else if (d.band === 'healthy') {
      insights.push({ key: `i_${d.key}`, category: 'Health', tone: 'positive', metric_ref: `executive.${d.key}.score`,
        text: `${d.label} is healthy (score ${d.score}).` });
    }
  }

  // ── Risk: degraded subsystems ─────────────────────────────────────────────────
  const cov = monitoring.subsystem_coverage;
  if (cov.total > 0) {
    const missing = cov.total - cov.measurable;
    risks.push({
      key: 'subsystem_degradation', label: 'Unmeasurable Subsystems',
      severity: missing > 0 ? 'low' : 'low', value: missing, measurable: true,
      detail: `${missing} of ${cov.total} subsystems currently unmeasurable`,
    });
  }

  // ── Insight: growth highlight ────────────────────────────────────────────────
  const newUsers = kpi(dash, 'growth', 'new_users');
  if (newUsers?.present && newUsers.trend && newUsers.trend.current != null && newUsers.trend.previous != null) {
    const t = newUsers.trend;
    if (t.direction === 'up') insights.push({ key: 'i_growth_up', category: 'Growth', tone: 'positive', metric_ref: 'dashboard.growth.new_users',
      text: `User acquisition is up ${t.delta_pct != null ? t.delta_pct + '%' : ''} over the prior 30 days.` });
    else if (t.direction === 'down') insights.push({ key: 'i_growth_down', category: 'Growth', tone: 'watch', metric_ref: 'dashboard.growth.new_users',
      text: `User acquisition slowed ${t.delta_pct != null ? Math.abs(t.delta_pct) + '%' : ''} versus the prior 30 days.` });
  }

  const measurableSignals = risks.filter((r) => r.measurable).length;
  const risk_summary = {
    high: risks.filter((r) => r.measurable && r.severity === 'high').length,
    medium: risks.filter((r) => r.measurable && r.severity === 'medium').length,
    low: risks.filter((r) => r.measurable && r.severity === 'low').length,
    measurable_signals: measurableSignals,
  };

  return {
    generated_at,
    degraded,
    risk_indicators: risks,
    insights,
    risk_summary,
    notes: [
      'Risk indicators and insights are derived only from measurable metrics; an unmeasurable metric emits no risk and no insight (never fabricated).',
      'Every insight is provenance-bound to the metric it summarises (metric_ref).',
      'This engine composes the Founder Dashboard, Executive Intelligence and Global Monitoring outputs — it recomputes nothing.',
    ],
  };
}
