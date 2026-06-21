/**
 * Phase 6.14 — Super Admin Command Center console (READ-ONLY).
 * Unifies the platform's 12 operational domains (Institutions, Employers, Students, Candidates,
 * Assessments, EI, Career Builder, Jobs, Revenue, Subscriptions, Partners, Support) into one view,
 * plus a platform control tower (pending actions / freshness / capacity) and global monitoring
 * (alerts / 24h activity / subsystem status).
 *
 * Reads GET /api/admin/command-center/console/{unified,control-tower,monitoring,validation}.
 * The tab only renders when the `commandCenter` flag is ON (SuperAdminDashboard probes /console/ping
 * before mounting), so flag-OFF is byte-identical legacy. Every figure is REAL composed data; an
 * absent source renders an honest "—" (unmeasurable) — never a fabricated 0.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid, Gauge, Activity, CheckCircle2, AlertTriangle, RefreshCw, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

function formatValue(value?: number | null, unit?: string) {
  if (value == null) return '—';
  if (unit === 'inr') return `₹${new Intl.NumberFormat('en-IN').format(value)}`;
  if (unit === 'pct' || unit === 'score') return new Intl.NumberFormat('en-IN').format(value);
  return new Intl.NumberFormat('en-IN').format(value);
}
function formatTime(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return '—'; }
}

type Tab = 'unified' | 'control-tower' | 'monitoring' | 'validation';

const TABS: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'unified', label: 'Unified View', icon: LayoutGrid },
  { id: 'control-tower', label: 'Control Tower', icon: Gauge },
  { id: 'monitoring', label: 'Global Monitoring', icon: Activity },
  { id: 'validation', label: 'Validation', icon: CheckCircle2 },
];

function useConsole<T>(slug: string, enabled: boolean) {
  return useQuery<T>({
    queryKey: [`/api/admin/command-center/console/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/command-center/console/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${slug} ${res.status}`);
      return res.json();
    },
    enabled,
  });
}

function NotesCard({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BRAND.accent }} />
          <ul className="list-disc pl-4 space-y-1">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PASS: 'border-emerald-300 text-emerald-700',
  WARN: 'border-amber-300 text-amber-700',
  FAIL: 'border-rose-300 text-rose-700',
  operational: 'border-emerald-300 text-emerald-700',
  attention: 'border-amber-300 text-amber-700',
  degraded: 'border-slate-300 text-slate-500',
};

export default function CommandCenterPanel() {
  const [tab, setTab] = useState<Tab>('unified');

  const unified = useConsole<any>('unified', tab === 'unified');
  const controlTower = useConsole<any>('control-tower', tab === 'control-tower');
  const monitoring = useConsole<any>('monitoring', tab === 'monitoring');
  const validation = useConsole<any>('validation', tab === 'validation');

  const active = { unified, 'control-tower': controlTower, monitoring, validation }[tab];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Command Center</h2>
          <p className="text-sm text-slate-500">
            Read-only unified posture across 12 platform domains — composed from live platform data.
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

      {/* ── Unified 12-domain view ─────────────────────────────────────────────── */}
      {tab === 'unified' && unified.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Domains" value={unified.data.totals?.domains} />
            <Stat label="Measurable" value={unified.data.totals?.measurable} />
            <Stat label="Unmeasurable" value={unified.data.totals?.unmeasurable} />
            <Stat label="Status" textValue={unified.data.degraded ? 'Degraded' : 'Complete'} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unified.data.domains?.map((d: any) => (
              <Card key={d.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{d.label}</CardTitle>
                    {d.measurable
                      ? <Badge variant="outline" className={STATUS_COLORS.PASS}>measurable</Badge>
                      : <Badge variant="outline" className={STATUS_COLORS.degraded}>unmeasurable</Badge>}
                  </div>
                  <CardDescription className="text-xs">{d.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {d.headline && (
                    <div className="mb-3">
                      <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>
                        {formatValue(d.headline.value, d.headline.unit)}
                      </div>
                      <div className="text-xs text-slate-500">{d.headline.label}</div>
                    </div>
                  )}
                  <div className="space-y-1 text-sm">
                    {d.metrics?.filter((m: any) => m.key !== d.headline?.key).map((m: any) => (
                      <div key={m.key} className="flex justify-between">
                        <span className="text-slate-500">{m.label}</span>
                        <span className="font-medium">{formatValue(m.value, m.unit)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <NotesCard notes={unified.data.notes} />
        </>
      )}

      {/* ── Platform Control Tower ─────────────────────────────────────────────── */}
      {tab === 'control-tower' && controlTower.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total Users" value={controlTower.data.platform?.total_users} />
            <Stat label="Active Sessions" value={controlTower.data.platform?.active_sessions} />
            <Stat label="Pending Actions" value={controlTower.data.pending_total} />
            <Stat label="Flags Enabled" value={controlTower.data.platform?.feature_flags_enabled} />
          </div>
          <Card>
            <CardHeader><CardTitle>Pending Actions</CardTitle>
              <CardDescription>Items awaiting operator attention — composed read-only from live tables.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Action</TableHead><TableHead>Severity</TableHead>
                  <TableHead className="text-right">Count</TableHead><TableHead>Source</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {controlTower.data.pending_actions?.map((p: any) => (
                    <TableRow key={p.key}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.severity === 'high' ? STATUS_COLORS.FAIL : STATUS_COLORS.degraded}>
                          {p.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatValue(p.count)}</TableCell>
                      <TableCell>
                        {p.present
                          ? <Badge variant="outline" className={STATUS_COLORS.PASS}>present</Badge>
                          : <Badge variant="outline" className={STATUS_COLORS.degraded}>absent</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Data Freshness</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Signal</TableHead><TableHead>Last Activity</TableHead><TableHead>Source</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {controlTower.data.freshness?.map((f: any) => (
                    <TableRow key={f.key}>
                      <TableCell className="font-medium">{f.label}</TableCell>
                      <TableCell className="text-sm text-slate-600">{formatTime(f.last_at)}</TableCell>
                      <TableCell>
                        {f.present
                          ? <Badge variant="outline" className={STATUS_COLORS.PASS}>present</Badge>
                          : <Badge variant="outline" className={STATUS_COLORS.degraded}>absent</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <NotesCard notes={controlTower.data.notes} />
        </>
      )}

      {/* ── Global Monitoring ──────────────────────────────────────────────────── */}
      {tab === 'monitoring' && monitoring.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Health" textValue={String(monitoring.data.status ?? '—')} badge={monitoring.data.status} />
            <Stat label="Governance Alerts" value={monitoring.data.alerts?.active_governance_alerts} />
            <Stat label="Critical Escalations" value={monitoring.data.alerts?.critical_escalations} />
            <Stat label="Subsystems OK" textValue={`${monitoring.data.subsystem_coverage?.measurable ?? '—'}/${monitoring.data.subsystem_coverage?.total ?? '—'}`} />
          </div>
          <Card>
            <CardHeader><CardTitle>24-Hour Activity Pulse</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {monitoring.data.activity_24h?.map((a: any) => (
                  <div key={a.key} className="rounded-md border p-3">
                    <div className="text-xl font-bold" style={{ color: BRAND.primary }}>{formatValue(a.count)}</div>
                    <div className="text-xs text-slate-500">{a.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Subsystem Status</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Subsystem</TableHead><TableHead>Status</TableHead><TableHead>Present Sources</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {monitoring.data.subsystems?.map((s: any) => (
                    <TableRow key={s.domain}>
                      <TableCell className="font-medium">{s.label}</TableCell>
                      <TableCell>
                        {s.measurable
                          ? <Badge variant="outline" className={STATUS_COLORS.PASS}>measurable</Badge>
                          : <Badge variant="outline" className={STATUS_COLORS.degraded}>unmeasurable</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {s.present_sources?.length ? s.present_sources.join(', ') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <NotesCard notes={monitoring.data.notes} />
        </>
      )}

      {/* ── Validation ─────────────────────────────────────────────────────────── */}
      {tab === 'validation' && validation.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Overall" textValue={String(validation.data.overall ?? '—')} badge={validation.data.overall} />
            <Stat label="Pass" value={validation.data.summary?.pass} />
            <Stat label="Warn" value={validation.data.summary?.warn} />
            <Stat label="Fail" value={validation.data.summary?.fail} />
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
                      <TableCell className="font-mono text-xs">{a.area}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[a.status] ?? ''}>{a.status}</Badge>
                      </TableCell>
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
        ? <Badge variant="outline" className={`text-base ${STATUS_COLORS[badge] ?? ''}`}>{textValue}</Badge>
        : <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>
            {textValue ?? formatValue(value)}
          </div>}
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </CardContent></Card>
  );
}
