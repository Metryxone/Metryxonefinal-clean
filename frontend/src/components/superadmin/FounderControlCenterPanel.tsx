import { BRAND } from '@/design-system/tokens';
/**
 * Phase 6.15 — Founder Control Center console (READ-ONLY).
 * Executive-grade view across 9 founder domains:
 *   Founder Dashboard       — Revenue, Growth, Adoption, Retention (founder_dashboard)
 *   Executive Intelligence  — Customer / Institution / Employer / Platform Health (executive_intelligence)
 *   Strategic Insights      — Risk Indicators + derived strategic insights (strategic_insights)
 *
 * Reads GET /api/admin/founder-control-center/console/{dashboard,executive,strategic,validation}.
 * The tab only renders when the `founderControlCenter` flag is ON (SuperAdminDashboard probes
 * /console/ping before mounting), so flag-OFF is byte-identical legacy. Every figure is REAL composed
 * data; an absent source renders an honest "—" (unmeasurable) — never a fabricated 0.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Crown, HeartPulse, Lightbulb, CheckCircle2, AlertTriangle, RefreshCw, Info,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';



function formatValue(value?: number | null, unit?: string) {
  if (value == null) return '—';
  if (unit === 'inr') return `₹${new Intl.NumberFormat('en-IN').format(value)}`;
  return new Intl.NumberFormat('en-IN').format(value);
}

type Tab = 'dashboard' | 'executive' | 'strategic' | 'validation';

const TABS: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'dashboard', label: 'Founder Dashboard', icon: Crown },
  { id: 'executive', label: 'Executive Intelligence', icon: HeartPulse },
  { id: 'strategic', label: 'Strategic Insights', icon: Lightbulb },
  { id: 'validation', label: 'Validation', icon: CheckCircle2 },
];

function useConsole<T>(slug: string, enabled: boolean) {
  return useQuery<T>({
    queryKey: [`/api/admin/founder-control-center/console/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/founder-control-center/console/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${slug} ${res.status}`);
      return res.json();
    },
    enabled,
  });
}

const STATUS_COLORS: Record<string, string> = {
  PASS: 'border-emerald-300 text-emerald-700',
  WARN: 'border-amber-300 text-amber-700',
  FAIL: 'border-rose-300 text-rose-700',
  healthy: 'border-emerald-300 text-emerald-700',
  watch: 'border-amber-300 text-amber-700',
  at_risk: 'border-rose-300 text-rose-700',
  unmeasurable: 'border-slate-300 text-slate-500',
  high: 'border-rose-300 text-rose-700',
  medium: 'border-amber-300 text-amber-700',
  low: 'border-emerald-300 text-emerald-700',
  info: 'border-slate-300 text-slate-500',
  positive: 'border-emerald-300 text-emerald-700',
  risk: 'border-rose-300 text-rose-700',
};

function NotesCard({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <Card><CardContent className="pt-4">
      <div className="flex items-start gap-2 text-sm text-slate-600">
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BRAND.accent }} />
        <ul className="list-disc pl-4 space-y-1">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      </div>
    </CardContent></Card>
  );
}

function TrendBadge({ trend }: { trend?: any }) {
  if (!trend || trend.delta_pct == null) return null;
  const dir = trend.direction;
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const color = dir === 'up' ? 'text-emerald-600' : dir === 'down' ? 'text-rose-600' : 'text-slate-400';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" /> {Math.abs(trend.delta_pct)}%
    </span>
  );
}

export default function FounderControlCenterPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  const dashboard = useConsole<any>('dashboard', tab === 'dashboard');
  const executive = useConsole<any>('executive', tab === 'executive');
  const strategic = useConsole<any>('strategic', tab === 'strategic');
  const validation = useConsole<any>('validation', tab === 'validation');

  const active = { dashboard, executive, strategic, validation }[tab];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Founder Control Center</h2>
          <p className="text-sm text-slate-500">
            Executive posture across Revenue, Growth, Adoption, Retention, Health & Risk — composed read-only from live data.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => active.refetch()} disabled={active.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${active.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === id ? 'border-current' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            style={tab === id ? { color: BRAND.primary } : undefined}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {active.isLoading && <Card><CardContent className="py-10 text-center text-slate-400">Loading…</CardContent></Card>}
      {active.isError && (
        <Card><CardContent className="py-10 text-center text-amber-600 flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Could not load this view.
        </CardContent></Card>
      )}

      {/* ── Founder Dashboard ──────────────────────────────────────────────────── */}
      {tab === 'dashboard' && dashboard.data && (
        <>
          {dashboard.data.sections?.map((s: any) => (
            <Card key={s.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.label}</CardTitle>
                <CardDescription className="text-xs">{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {s.kpis?.map((k: any) => (
                    <div key={k.key} className="rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xl font-bold" style={{ color: BRAND.primary }}>
                          {k.present ? formatValue(k.value, k.unit) : '—'}
                        </div>
                        <TrendBadge trend={k.trend} />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{k.label}</div>
                      {!k.present && <div className="text-[10px] text-slate-400 mt-0.5">source absent</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <NotesCard notes={dashboard.data.notes} />
        </>
      )}

      {/* ── Executive Intelligence (health) ────────────────────────────────────── */}
      {tab === 'executive' && executive.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Overall Health" textValue={executive.data.overall_score != null ? String(executive.data.overall_score) : '—'} badge={executive.data.overall_band} />
            <Stat label="Domains" value={executive.data.domains?.length} />
            <Stat label="Measurable" value={executive.data.domains?.filter((d: any) => d.measurable).length} />
            <Stat label="Status" textValue={executive.data.degraded ? 'Degraded' : 'Complete'} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {executive.data.domains?.map((d: any) => (
              <Card key={d.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{d.label}</CardTitle>
                    <Badge variant="outline" className={STATUS_COLORS[d.band] ?? ''}>{d.band}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3">
                    <div className="text-3xl font-bold" style={{ color: BRAND.primary }}>
                      {d.score != null ? d.score : '—'}<span className="text-base text-slate-400">{d.score != null ? '/100' : ''}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    {d.components?.map((c: any) => (
                      <div key={c.key} className="flex justify-between items-center">
                        <span className="text-slate-500">{c.label}</span>
                        <span className="font-medium flex items-center gap-2">
                          {c.value != null ? c.value : '—'}
                          <span className="text-[10px] text-slate-400">{c.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <NotesCard notes={executive.data.notes} />
        </>
      )}

      {/* ── Strategic Insights ─────────────────────────────────────────────────── */}
      {tab === 'strategic' && strategic.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="High Risks" value={strategic.data.risk_summary?.high} badge={strategic.data.risk_summary?.high > 0 ? 'high' : undefined} />
            <Stat label="Medium Risks" value={strategic.data.risk_summary?.medium} />
            <Stat label="Low / OK" value={strategic.data.risk_summary?.low} />
            <Stat label="Measurable Signals" value={strategic.data.risk_summary?.measurable_signals} />
          </div>

          <Card>
            <CardHeader><CardTitle>Risk Indicators</CardTitle>
              <CardDescription>Severity-bounded signals derived from measurable metrics only.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Indicator</TableHead><TableHead>Severity</TableHead>
                  <TableHead className="text-right">Value</TableHead><TableHead>Detail</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {strategic.data.risk_indicators?.map((r: any) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[r.severity] ?? ''}>{r.severity}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{r.measurable ? formatValue(r.value) : '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{r.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Strategic Insights</CardTitle>
              <CardDescription>Each insight is provenance-bound to the measurable metric it summarises.</CardDescription></CardHeader>
            <CardContent>
              {strategic.data.insights?.length ? (
                <div className="space-y-2">
                  {strategic.data.insights.map((i: any) => (
                    <div key={i.key} className="flex items-start gap-3 rounded-md border p-3">
                      <Badge variant="outline" className={STATUS_COLORS[i.tone] ?? ''}>{i.category}</Badge>
                      <div className="flex-1">
                        <div className="text-sm text-slate-700">{i.text}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{i.metric_ref}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-slate-400 py-6 text-center">No insights yet — insufficient measurable signal (honest absence).</div>}
            </CardContent>
          </Card>
          <NotesCard notes={strategic.data.notes} />
        </>
      )}

      {/* ── Validation ─────────────────────────────────────────────────────────── */}
      {tab === 'validation' && validation.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Overall" textValue={String(validation.data.overall ?? '—')} badge={validation.data.overall} />
            <Stat label="Pass" value={validation.data.areas?.filter((a: any) => a.status === 'PASS').length} />
            <Stat label="Warn" value={validation.data.areas?.filter((a: any) => a.status === 'WARN').length} />
            <Stat label="Fail" value={validation.data.areas?.filter((a: any) => a.status === 'FAIL').length} />
          </div>
          <Card>
            <CardHeader><CardTitle>Honesty Harness</CardTitle>
              <CardDescription>PASS = invariant holds · WARN = honest absence · FAIL = a real break.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Area</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {validation.data.areas?.map((a: any) => (
                    <TableRow key={a.area}>
                      <TableCell className="font-medium">{a.area}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[a.status] ?? ''}>{a.status}</Badge></TableCell>
                      <TableCell className="text-sm text-slate-600">{a.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, textValue, badge }: { label: string; value?: number | null; textValue?: string; badge?: string }) {
  return (
    <Card><CardContent className="pt-4">
      {badge
        ? <Badge variant="outline" className={`text-base ${STATUS_COLORS[badge] ?? ''}`}>{textValue ?? formatValue(value)}</Badge>
        : <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>{textValue ?? formatValue(value)}</div>}
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </CardContent></Card>
  );
}
