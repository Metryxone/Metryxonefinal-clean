import { BRAND } from '@/design-system/tokens';
/**
 * Phase 6.8 — Customer Success Intelligence dashboard (READ-ONLY).
 * Surfaces the composite customer-success analytics: a transparent health index + Adoption,
 * Engagement, Assessment Completion, EI/Career/Employer usage, Retention Risk and Expansion.
 *
 * Reads GET /api/admin/commercial/success/analytics. The tab is only rendered when the
 * `commercialCustomerSuccess` flag is ON (the SuperAdminDashboard probes /ping before mounting
 * this panel), so flag-OFF is byte-identical legacy. Every figure is REAL recorded activity;
 * empty substrate renders honest "no data yet" states — never fabricated numbers.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HeartPulse, Users, Activity, ClipboardCheck, Brain, Briefcase, Building2,
  AlertTriangle, TrendingUp, RefreshCw, Info, Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';



function formatNum(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}
function pct(n?: number | null) {
  if (n == null) return '—';
  return `${n}%`;
}

interface EngagementAnalytics {
  substrate: Record<string, boolean>;
  adoption: { total_users: number; new_users_30d: number; new_users_7d: number; by_account_type: { account_type: string; users: number }[] };
  engagement: { active_sessions: number | null; active_users_30d: number; active_users_7d: number; events_30d: number; by_event_type: { event_type: string; events: number }[] };
  completion: { capadex_total: number; capadex_completed: number; capadex_completion_pct: number; competency_scored_subjects: number; exam_attempts: number };
  product_usage: { ei_snapshots: number; ei_subjects: number; career_profiles: number; career_avg_completeness: number | null; employer_candidates: number; employer_jobs: number; eios_campaigns: number };
  notes: string[];
}
interface RetentionAnalytics {
  substrate: Record<string, boolean>;
  retention_risk: {
    subscriptions_by_status: { status: string; count: number }[];
    active: number; at_risk: number; payment_failures_30d: number;
    renewals: { window_days: number; due_soon: number; in_grace: number; churning: number };
  };
  expansion: {
    high_usage_customers: { email: string; usage_events: number; quantity: number }[];
    repeat_onetime_buyers: { email: string; paid_purchases: number }[];
    note: string;
  };
  notes: string[];
}
interface CustomerSuccessAnalytics {
  generated_at: string;
  degraded: boolean;
  headline: {
    total_users: number; new_users_30d: number; active_users_30d: number;
    assessment_completion_pct: number; active_subscriptions: number;
    at_risk_subscriptions: number; expansion_candidates: number;
  };
  health: {
    measurable: boolean;
    score: number | null;
    components: { key: string; value: number; weight: number }[];
    reason?: string;
  };
  engagement: EngagementAnalytics;
  retention: RetentionAnalytics;
  notes: string[];
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: BRAND.primary }}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
          </div>
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${BRAND.accent}22` }}>
            <Icon className="h-5 w-5" style={{ color: BRAND.primary }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-6 text-center text-sm text-gray-400">{text}</TableCell>
    </TableRow>
  );
}

const COMPONENT_LABEL: Record<string, string> = {
  engagement_rate: 'Engagement (active/total users)',
  completion_rate: 'Assessment completion',
  retention_rate: 'Retention (active subs)',
};

export default function CustomerSuccessPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<CustomerSuccessAnalytics>({
    queryKey: ['/api/admin/commercial/success/analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/success/analytics', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <HeartPulse className="h-6 w-6" /> Customer Success Intelligence
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Adoption, engagement, assessment completion, product usage, retention risk and expansion —
            composed from real recorded activity. Honest empties where no data exists yet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading customer success analytics…</p>}
      {isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load customer success analytics.
        </CardContent></Card>
      )}

      {data && (
        <>
          {data.degraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Some sources were unreadable; figures below reflect available data only.
            </div>
          )}

          {/* Health index */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" /> Customer Health Index</CardTitle>
              <CardDescription>Transparent blend of measured engagement, completion and retention — weights renormalised over measurable components only.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {data.health.measurable ? (
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-4xl font-bold" style={{ color: BRAND.primary }}>{data.health.score}<span className="text-lg text-gray-400">/100</span></div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {data.health.components.map((c) => (
                      <div key={c.key} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5">
                        <span className="text-gray-500">{COMPONENT_LABEL[c.key] ?? c.key}:</span>{' '}
                        <span className="font-semibold">{Math.round(c.value * 100)}%</span>{' '}
                        <span className="text-xs text-gray-400">(w {c.weight})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{data.health.reason ?? 'Not measurable yet.'}</p>
              )}
            </CardContent>
          </Card>

          {/* Headline metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Total Users" value={formatNum(data.headline.total_users)} sub={`${formatNum(data.headline.new_users_30d)} new (30d)`} />
            <Stat icon={Activity} label="Active Users (30d)" value={formatNum(data.headline.active_users_30d)} />
            <Stat icon={ClipboardCheck} label="Assessment Completion" value={pct(data.headline.assessment_completion_pct)} />
            <Stat icon={AlertTriangle} label="At-Risk Subscriptions" value={formatNum(data.headline.at_risk_subscriptions)} sub={`${formatNum(data.headline.active_subscriptions)} active`} />
          </div>

          {/* Adoption + Engagement */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Adoption by Account Type</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Account Type</TableHead><TableHead className="text-right">Users</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.engagement.adoption.by_account_type.length === 0
                      ? <EmptyRow cols={2} text="No users yet." />
                      : data.engagement.adoption.by_account_type.map((r, i) => (
                        <TableRow key={`${r.account_type}-${i}`}>
                          <TableCell className="font-medium capitalize">{r.account_type.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.users)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Engagement (30-day)</CardTitle>
                <CardDescription>Active sessions {data.engagement.engagement.active_sessions == null ? '(unavailable)' : `· ${formatNum(data.engagement.engagement.active_sessions)} live`}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Event Type</TableHead><TableHead className="text-right">Events</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.engagement.engagement.by_event_type.length === 0
                      ? <EmptyRow cols={2} text="No engagement events in the last 30 days." />
                      : data.engagement.engagement.by_event_type.map((r, i) => (
                        <TableRow key={`${r.event_type}-${i}`}>
                          <TableCell className="font-medium">{r.event_type}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.events)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Product usage */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Product Usage</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm md:grid-cols-4">
              <div><p className="text-gray-500">EI snapshots</p><p className="text-lg font-semibold">{formatNum(data.engagement.product_usage.ei_snapshots)}</p><p className="text-xs text-gray-400">{formatNum(data.engagement.product_usage.ei_subjects)} subjects</p></div>
              <div><p className="text-gray-500">Career profiles</p><p className="text-lg font-semibold">{formatNum(data.engagement.product_usage.career_profiles)}</p><p className="text-xs text-gray-400">avg completeness {data.engagement.product_usage.career_avg_completeness == null ? '—' : `${data.engagement.product_usage.career_avg_completeness}%`}</p></div>
              <div><p className="text-gray-500">Competency scored</p><p className="text-lg font-semibold">{formatNum(data.engagement.completion.competency_scored_subjects)}</p><p className="text-xs text-gray-400">{formatNum(data.engagement.completion.exam_attempts)} exam attempts</p></div>
              <div><p className="text-gray-500">Employer usage</p><p className="text-lg font-semibold">{formatNum(data.engagement.product_usage.employer_candidates)}</p><p className="text-xs text-gray-400">{formatNum(data.engagement.product_usage.employer_jobs)} jobs · {formatNum(data.engagement.product_usage.eios_campaigns)} campaigns</p></div>
            </CardContent>
          </Card>

          {/* Retention risk */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Retention Risk</CardTitle>
              <CardDescription>
                {formatNum(data.retention.retention_risk.payment_failures_30d)} payment failures (30d) ·
                renewals ({data.retention.retention_risk.renewals.window_days}d): {formatNum(data.retention.retention_risk.renewals.due_soon)} due · {formatNum(data.retention.retention_risk.renewals.in_grace)} grace · {formatNum(data.retention.retention_risk.renewals.churning)} churning
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow><TableHead>Subscription Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.retention.retention_risk.subscriptions_by_status.length === 0
                    ? <EmptyRow cols={2} text="No subscription substrate yet." />
                    : data.retention.retention_risk.subscriptions_by_status.map((r, i) => (
                      <TableRow key={`${r.status}-${i}`}>
                        <TableCell className="font-medium capitalize">
                          {r.status.replace(/_/g, ' ')}
                          {r.status === 'past_due' && <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700">at risk</Badge>}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatNum(r.count)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Expansion */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> High-Usage Customers</CardTitle>
                <CardDescription>Directional expansion signal (real usage volume)</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Events</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.retention.expansion.high_usage_customers.length === 0
                      ? <EmptyRow cols={3} text="No usage substrate yet." />
                      : data.retention.expansion.high_usage_customers.map((r, i) => (
                        <TableRow key={`${r.email}-${i}`}>
                          <TableCell className="font-medium">{r.email}</TableCell>
                          <TableCell className="text-right">{formatNum(r.usage_events)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.quantity)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4" /> Upsell Candidates</CardTitle>
                <CardDescription>Repeat one-time buyers (≥2 paid) — subscription upsell</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Paid Purchases</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.retention.expansion.repeat_onetime_buyers.length === 0
                      ? <EmptyRow cols={2} text="No repeat one-time buyers yet." />
                      : data.retention.expansion.repeat_onetime_buyers.map((r, i) => (
                        <TableRow key={`${r.email}-${i}`}>
                          <TableCell className="font-medium">{r.email}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.paid_purchases)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {(data.notes.length > 0 || data.engagement.notes.length > 0 || data.retention.notes.length > 0) && (
            <Card>
              <CardContent className="space-y-1.5 p-4">
                {[...data.notes, ...data.engagement.notes, ...data.retention.notes].map((n, i) => (
                  <p key={i} className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {n}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-right text-xs text-gray-400">Generated {new Date(data.generated_at).toLocaleString('en-IN')}</p>
        </>
      )}
    </div>
  );
}
