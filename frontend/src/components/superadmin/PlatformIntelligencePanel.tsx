import { BRAND } from '@/design-system/tokens';
/**
 * Phase 6.10 — Platform Intelligence console (READ-ONLY).
 * Surfaces the composite platform_intelligence overview (7 metric categories) plus the
 * executive_dashboard and founder_dashboard projections.
 *
 * Reads GET /api/admin/platform/console/{overview,executive,founder}. The tab is only rendered when
 * the `platformIntelligenceConsole` flag is ON (the SuperAdminDashboard probes /console/ping before
 * mounting this panel), so flag-OFF is byte-identical legacy. Every figure is REAL composed data;
 * absent substrate renders honest "not measurable / no data yet" states — never fabricated numbers.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Users, TrendingUp, Filter, Repeat, IndianRupee, Server,
  AlertTriangle, RefreshCw, Info, Gauge, Briefcase, LineChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';



function formatNum(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}
function formatRupees(n?: number | null) {
  if (n == null) return '—';
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`;
}
function formatPct(n?: number | null) {
  if (n == null) return '—';
  return `${n}%`;
}
function formatValue(value: number | null, unit: 'count' | 'rupees' | 'pct', measurable: boolean) {
  if (!measurable || value == null) return '—';
  if (unit === 'rupees') return formatRupees(value);
  if (unit === 'pct') return formatPct(value);
  return formatNum(value);
}

interface PlatformIntelligence {
  generated_at: string;
  degraded: boolean;
  headline: {
    total_users: number; new_users_30d: number; active_users_30d: number; mrr_rupees: number;
    paying_customers: number; assessment_completion_pct: number; active_subscriptions: number;
    health_status: 'healthy' | 'degraded' | 'no_substrate';
  };
  platform_health: {
    overall_status: 'healthy' | 'degraded' | 'no_substrate';
    degraded_subsystems: string[];
    data_quality: { measurable: boolean; runtime_contexts: number; avg_reliability_index: number | null };
    assessment_completion_pct: number;
    substrate_coverage: { present: number; total: number; pct: number };
  };
  adoption: {
    total_users: number; new_users_30d: number; new_users_7d: number; active_users_30d: number;
    by_account_type: { account_type: string; users: number }[];
    product_footprint: { career_profiles: number; ei_subjects: number; employer_candidates: number };
  };
  growth: { measurable: boolean; new_users_30d: number; prev_30d: number; delta: number; growth_pct: number | null };
  conversion: { session_emails: number; completed_emails: number; paying_emails: number; completion_pct: number; free_to_paid_pct: number | null };
  retention: {
    active: number; at_risk: number; payment_failures_30d: number; retention_rate: number | null;
    subscriptions_by_status: { status: string; count: number }[];
    renewals: { window_days: number; due_soon: number; in_grace: number; churning: number };
  };
  revenue: {
    mrr_rupees: number; arr_rupees: number; total_collected_rupees: number; onetime_rupees: number;
    active_subscriptions: number; by_segment: { segment: string; rupees: number }[];
    forecast: { forecastable: boolean; reason?: string; detail?: string; next_period_rupees?: number };
  };
  operational: {
    sessions_total: number; sessions_completed: number; sessions_in_progress: number;
    responses_total: number; telemetry_rows: number; active_sessions: number | null; exam_attempts: number;
  };
  notes: string[];
}

interface ExecKpi { key: string; label: string; value: number | null; unit: 'count' | 'rupees' | 'pct'; measurable: boolean; sub?: string }
interface ExecutiveDashboard {
  generated_at: string; degraded: boolean; health_status: string;
  kpis: ExecKpi[]; attention: string[]; notes: string[];
}
interface FounderMetric { key: string; label: string; value: number | null; unit: 'count' | 'rupees' | 'pct'; measurable: boolean; note?: string }
interface FounderDashboard {
  generated_at: string; degraded: boolean; health_status: string;
  north_star: FounderMetric;
  groups: { group: string; metrics: FounderMetric[] }[];
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
function HealthBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    healthy: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    degraded: { label: 'Degraded', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    no_substrate: { label: 'No substrate', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  const m = map[status] ?? map.no_substrate;
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

type ViewKey = 'overview' | 'executive' | 'founder';

export default function PlatformIntelligencePanel() {
  const [view, setView] = useState<ViewKey>('overview');

  const overview = useQuery<PlatformIntelligence>({
    queryKey: ['/api/admin/platform/console/overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/platform/console/overview', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'overview',
  });
  const executive = useQuery<ExecutiveDashboard>({
    queryKey: ['/api/admin/platform/console/executive'],
    queryFn: async () => {
      const res = await fetch('/api/admin/platform/console/executive', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'executive',
  });
  const founder = useQuery<FounderDashboard>({
    queryKey: ['/api/admin/platform/console/founder'],
    queryFn: async () => {
      const res = await fetch('/api/admin/platform/console/founder', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'founder',
  });

  const active = view === 'overview' ? overview : view === 'executive' ? executive : founder;
  const tabs: { key: ViewKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'Platform Overview', icon: Activity },
    { key: 'executive', label: 'Executive', icon: Briefcase },
    { key: 'founder', label: 'Founder', icon: LineChart },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <Activity className="h-6 w-6" /> Platform Intelligence
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Unified platform analytics — health, adoption, growth, conversion, retention, revenue and operations,
            composed read-only from the existing commercial engines. Honest empties where nothing is recorded yet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => active.refetch()} disabled={active.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${active.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              view === t.key ? 'text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            style={view === t.key ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : undefined}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {active.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {active.isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load platform intelligence.
        </CardContent></Card>
      )}

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {view === 'overview' && overview.data && (
        <>
          {overview.data.degraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Some sources were unreadable or a subsystem is not fully activated; figures below reflect available data only.
            </div>
          )}

          {/* Platform health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4" /> Platform Health <HealthBadge status={overview.data.platform_health.overall_status} />
              </CardTitle>
              <CardDescription>
                Substrate coverage {formatPct(overview.data.platform_health.substrate_coverage.pct)}
                {' '}({overview.data.platform_health.substrate_coverage.present}/{overview.data.platform_health.substrate_coverage.total} sources present) ·
                {' '}data quality{' '}
                {overview.data.platform_health.data_quality.measurable
                  ? `BRI ${overview.data.platform_health.data_quality.avg_reliability_index} over ${formatNum(overview.data.platform_health.data_quality.runtime_contexts)} contexts`
                  : 'not measurable yet'}
              </CardDescription>
            </CardHeader>
            {overview.data.platform_health.degraded_subsystems.length > 0 && (
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {overview.data.platform_health.degraded_subsystems.map((s) => (
                    <Badge key={s} variant="outline" className="border-amber-200 text-amber-700">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Headline metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Total Users" value={formatNum(overview.data.headline.total_users)} sub={`${formatNum(overview.data.headline.new_users_30d)} new in 30d`} />
            <Stat icon={IndianRupee} label="MRR" value={formatRupees(overview.data.headline.mrr_rupees)} sub={`${formatNum(overview.data.headline.active_subscriptions)} active subscriptions`} />
            <Stat icon={Filter} label="Paying Customers" value={formatNum(overview.data.headline.paying_customers)} />
            <Stat icon={Activity} label="Active Users (30d)" value={formatNum(overview.data.headline.active_users_30d)} sub={`${formatPct(overview.data.headline.assessment_completion_pct)} completion`} />
          </div>

          {/* Growth + Conversion */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Growth</CardTitle>
                <CardDescription>Signups: last 30d vs preceding 30d</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm md:grid-cols-4">
                <div><p className="text-gray-500">New (30d)</p><p className="text-lg font-semibold">{formatNum(overview.data.growth.new_users_30d)}</p></div>
                <div><p className="text-gray-500">Prior 30d</p><p className="text-lg font-semibold">{formatNum(overview.data.growth.prev_30d)}</p></div>
                <div><p className="text-gray-500">Delta</p><p className="text-lg font-semibold">{overview.data.growth.delta >= 0 ? '+' : ''}{formatNum(overview.data.growth.delta)}</p></div>
                <div><p className="text-gray-500">Growth rate</p><p className="text-lg font-semibold">{overview.data.growth.measurable ? formatPct(overview.data.growth.growth_pct) : '—'}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" /> Conversion Funnel</CardTitle>
                <CardDescription>Assessment started → completed → paid (distinct emails)</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm md:grid-cols-4">
                <div><p className="text-gray-500">Started</p><p className="text-lg font-semibold">{formatNum(overview.data.conversion.session_emails)}</p></div>
                <div><p className="text-gray-500">Completed</p><p className="text-lg font-semibold">{formatNum(overview.data.conversion.completed_emails)}</p></div>
                <div><p className="text-gray-500">Paid</p><p className="text-lg font-semibold">{formatNum(overview.data.conversion.paying_emails)}</p></div>
                <div><p className="text-gray-500">Free → Paid</p><p className="text-lg font-semibold">{formatPct(overview.data.conversion.free_to_paid_pct)}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Retention + Revenue */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Repeat className="h-4 w-4" /> Retention</CardTitle>
                <CardDescription>
                  {formatNum(overview.data.retention.active)} active · {formatNum(overview.data.retention.at_risk)} at-risk ·
                  {' '}retention rate {formatPct(overview.data.retention.retention_rate)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Subscription Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {overview.data.retention.subscriptions_by_status.length === 0
                      ? <EmptyRow cols={2} text="No subscription substrate yet." />
                      : overview.data.retention.subscriptions_by_status.map((r, i) => (
                        <TableRow key={`${r.status}-${i}`}>
                          <TableCell className="font-medium capitalize">{r.status.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.count)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="h-4 w-4" /> Revenue</CardTitle>
                <CardDescription>
                  MRR {formatRupees(overview.data.revenue.mrr_rupees)} · ARR {formatRupees(overview.data.revenue.arr_rupees)} ·
                  {' '}{formatRupees(overview.data.revenue.total_collected_rupees)} collected
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Segment</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {overview.data.revenue.by_segment.length === 0
                      ? <EmptyRow cols={2} text="No revenue recorded yet." />
                      : overview.data.revenue.by_segment.map((r, i) => (
                        <TableRow key={`${r.segment}-${i}`}>
                          <TableCell className="font-medium">{r.segment}</TableCell>
                          <TableCell className="text-right font-semibold">{formatRupees(r.rupees)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Operational */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" /> Operational</CardTitle>
              <CardDescription>Assessment session &amp; runtime volume</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm md:grid-cols-4 lg:grid-cols-7">
              <div><p className="text-gray-500">Sessions</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.sessions_total)}</p></div>
              <div><p className="text-gray-500">Completed</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.sessions_completed)}</p></div>
              <div><p className="text-gray-500">In progress</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.sessions_in_progress)}</p></div>
              <div><p className="text-gray-500">Responses</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.responses_total)}</p></div>
              <div><p className="text-gray-500">Telemetry</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.telemetry_rows)}</p></div>
              <div><p className="text-gray-500">Exam attempts</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.exam_attempts)}</p></div>
              <div><p className="text-gray-500">Active sessions</p><p className="text-lg font-semibold">{formatNum(overview.data.operational.active_sessions)}</p></div>
            </CardContent>
          </Card>

          {overview.data.notes.length > 0 && (
            <Card>
              <CardContent className="space-y-1.5 p-4">
                {overview.data.notes.map((n, i) => (
                  <p key={i} className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {n}</p>
                ))}
              </CardContent>
            </Card>
          )}
          <p className="text-right text-xs text-gray-400">Generated {new Date(overview.data.generated_at).toLocaleString('en-IN')}</p>
        </>
      )}

      {/* ── Executive ────────────────────────────────────────────────────────── */}
      {view === 'executive' && executive.data && (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Platform health: <HealthBadge status={executive.data.health_status} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {executive.data.kpis.map((k) => (
              <Stat key={k.key} icon={Gauge} label={k.label} value={formatValue(k.value, k.unit, k.measurable)} sub={k.sub} />
            ))}
          </div>
          {executive.data.attention.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Needs Attention</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {executive.data.attention.map((a, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-gray-600"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" /> {a}</p>
                ))}
              </CardContent>
            </Card>
          )}
          {executive.data.notes.length > 0 && (
            <Card><CardContent className="space-y-1.5 p-4">
              {executive.data.notes.map((n, i) => (
                <p key={i} className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {n}</p>
              ))}
            </CardContent></Card>
          )}
          <p className="text-right text-xs text-gray-400">Generated {new Date(executive.data.generated_at).toLocaleString('en-IN')}</p>
        </>
      )}

      {/* ── Founder ──────────────────────────────────────────────────────────── */}
      {view === 'founder' && founder.data && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><LineChart className="h-4 w-4" /> North Star · {founder.data.north_star.label}</CardTitle>
              {founder.data.north_star.note && <CardDescription>{founder.data.north_star.note}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-4xl font-bold" style={{ color: BRAND.primary }}>
                {formatValue(founder.data.north_star.value, founder.data.north_star.unit, founder.data.north_star.measurable)}
              </div>
            </CardContent>
          </Card>
          {founder.data.groups.map((g) => (
            <Card key={g.group}>
              <CardHeader className="pb-3"><CardTitle className="text-base capitalize">{g.group}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm md:grid-cols-4">
                {g.metrics.map((m) => (
                  <div key={m.key}>
                    <p className="text-gray-500">{m.label}</p>
                    <p className="text-lg font-semibold">{formatValue(m.value, m.unit, m.measurable)}</p>
                    {m.note && <p className="text-xs text-gray-400">{m.note}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {founder.data.notes.length > 0 && (
            <Card><CardContent className="space-y-1.5 p-4">
              {founder.data.notes.map((n, i) => (
                <p key={i} className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {n}</p>
              ))}
            </CardContent></Card>
          )}
          <p className="text-right text-xs text-gray-400">Generated {new Date(founder.data.generated_at).toLocaleString('en-IN')}</p>
        </>
      )}
    </div>
  );
}
