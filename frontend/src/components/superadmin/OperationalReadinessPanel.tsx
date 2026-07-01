import { BRAND } from '@/design-system/tokens';
/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 *
 * READ-ONLY SuperAdmin console that COMPOSES the already-shipped read APIs of the Operational
 * Readiness composer (`backend/routes/operational-readiness.ts`, flag `operationalReadiness`).
 * It is client-side only — NO new backend, NO service, NO migration, NO business logic. The whole
 * tab is gated by the `operationalReadiness` flag (the dashboard probes /enabled before mounting) →
 * flag-OFF is byte-identical legacy (the tab is not rendered at all).
 *
 * HONESTY invariants (mirrored verbatim from the engine — never softened in the UI):
 *   - The certified axes are SEPARATE structural-coverage scores and are NEVER combined into one.
 *   - Coverage ⟂ Confidence ⟂ Adoption are separate and NEVER composited. Adoption (real non-demo
 *     volume) is a usage axis, never a gap.
 *   - Enterprise-operability CONFIDENCE is WITHHELD (null) by design (Built ≠ Operated ≠ Recoverable).
 *   - null / absent renders "—" (unmeasurable), NEVER a fabricated 0. Measured values shown verbatim.
 *
 * The backend exposes NO `/live` or `/capabilities` route — "live health" composes the real
 * `/dr/readiness` (config presence + live PostgreSQL connectivity) + `/version` (build/uptime) +
 * `/validation`; the "capability inventory" composes the `/model` operational domains + the
 * `/gaps` resolved-mechanism ledger. Nothing is fabricated to fit a name.
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, BarChart3, Bell, Boxes, Camera, CheckCircle2, Coins, Cpu, Database, Gauge, History, Inbox, Info,
  LayoutDashboard, ListChecks, Server, ShieldCheck, TrendingUp, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';

const BASE = '/api/operational-readiness';

/* ── honest formatters (null ≠ 0) ─────────────────────────────────────────── */
function num(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}
function dash(s?: string | null) { return s == null || s === '' ? '—' : String(s); }
/** Score-or-dash: a null score is "—" (no measurable evidence), distinct from a measured 0. */
function score(n?: number | null) { return n == null || Number.isNaN(n) ? '—' : `${num(n)}`; }

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
function useEndpoint<T = any>(path: string) {
  return useQuery<T>({ queryKey: [BASE, path], queryFn: () => getJSON(`${BASE}${path}`), staleTime: 30_000 });
}

const STATE_TONE: Record<string, { bg: string; fg: string }> = {
  supported: { bg: '#DCFCE7', fg: '#166534' }, pass: { bg: '#DCFCE7', fg: '#166534' },
  structural_validated: { bg: '#DCFCE7', fg: '#166534' },
  structural_complete_adoption_pending: { bg: '#E0E7FF', fg: '#3730A3' },
  partial: { bg: '#FEF3C7', fg: '#92400E' },
  dead_end: { bg: '#F3F4F6', fg: '#6B7280' }, missing: { bg: '#FEE2E2', fg: '#991B1B' },
  fail: { bg: '#FEE2E2', fg: '#991B1B' }, failed: { bg: '#FEE2E2', fg: '#991B1B' },
  structural_incomplete: { bg: '#FEE2E2', fg: '#991B1B' },
  critical: { bg: '#FEE2E2', fg: '#991B1B' }, warning: { bg: '#FEF3C7', fg: '#92400E' },
  info: { bg: '#E0E7FF', fg: '#3730A3' },
};
function Tone({ s }: { s?: string | null }) {
  if (!s) return <span style={{ color: '#9CA3AF' }}>—</span>;
  const t = STATE_TONE[String(s).toLowerCase()] ?? { bg: '#F3F4F6', fg: '#374151' };
  return <Badge style={{ background: t.bg, color: t.fg, border: 'none' }}>{String(s).replace(/_/g, ' ')}</Badge>;
}

function Stat({ icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BRAND.ink }}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </CardContent></Card>
  );
}

function ErrorNote({ q }: { q: any }) {
  if (q.isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (q.isError) return <div className="text-sm text-gray-400">Unable to load — honest unavailable, no fabricated value.</div>;
  if (q.data && q.data.ready === false) {
    return <div className="text-sm rounded-md p-3" style={{ background: '#FEF2F2', color: '#991B1B' }}>
      Measurement error — the read-only composer returned an honest unavailable ({dash(q.data.detail)}).
    </div>;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════ */
type TabId = 'overview' | 'certification' | 'coverage' | 'capabilities' | 'live' | 'signals' | 'latency' | 'adoption' | 'gaps' | 'history';

export default function OperationalReadinessPanel() {
  const [tab, setTab] = React.useState<TabId>('overview');
  const TABS: Array<[TabId, string]> = [
    ['overview', 'Overview'], ['certification', 'Certification'], ['coverage', 'Coverage'],
    ['capabilities', 'Capabilities'], ['live', 'Live Health'], ['signals', 'Live Signals'],
    ['latency', 'Latency'], ['adoption', 'Adoption'], ['gaps', 'Gap Register'], ['history', 'Snapshots'],
  ];
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <LayoutDashboard className="w-6 h-6" /> Operational Readiness
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          A unified, read-only console composing the Operational Readiness composer (Phase 2.5). Each
          axis is a SEPARATE structural-coverage score — they are <b>never combined into one number</b>.
          <i> Coverage ⟂ Confidence ⟂ Adoption are separate and never composited; Built ≠ Operated ≠
          Recoverable; null ≠ 0.</i>
        </p>
      </div>

      <div className="flex gap-1 flex-wrap border-b">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? 'border-current' : 'border-transparent text-gray-500'}`}
            style={tab === id ? { color: BRAND.primary } : {}}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewSection />}
      {tab === 'certification' && <CertificationSection />}
      {tab === 'coverage' && <CoverageSection />}
      {tab === 'capabilities' && <CapabilitiesSection />}
      {tab === 'live' && <LiveHealthSection />}
      {tab === 'signals' && <SignalsSection />}
      {tab === 'latency' && <LatencySection />}
      {tab === 'adoption' && <AdoptionSection />}
      {tab === 'gaps' && <GapsSection />}
      {tab === 'history' && <HistorySection />}
    </div>
  );
}

/* ── Snapshots — capture a point-in-time snapshot + review history ──────────── */
function HistorySection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useEndpoint('/snapshots');
  const list: any[] = q.data?.snapshots ?? [];

  const capture = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/audit/capture`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || String(res.status));
      if (body?.ready === false) throw new Error(body?.detail || 'measurement_error');
      if (body?.ok === false) throw new Error(body?.error || 'capture_failed');
      return body;
    },
    onSuccess: (body) => {
      toast({ title: 'Snapshot captured', description: `Recorded ${dash(body?.snapshot_uid)}.` });
      qc.invalidateQueries({ queryKey: [BASE, '/snapshots'] });
    },
    onError: (e: any) => {
      toast({ title: 'Capture failed', description: e?.message ? String(e.message) : undefined, variant: 'destructive' });
    },
  });

  function fmtDate(s?: string | null) {
    if (s == null || s === '') return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? dash(s) : d.toLocaleString('en-IN');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="text-sm rounded-md p-3 flex items-start gap-2 flex-1 min-w-[280px]" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          A snapshot records the current certification &amp; summary for drift tracking over time. Each row
          keeps the structural verdict verbatim — <i>null ≠ 0; nothing is fabricated.</i>
        </div>
        <Button onClick={() => capture.mutate()} disabled={capture.isPending} className="shrink-0">
          <Camera className="w-4 h-4 mr-2" />
          {capture.isPending ? 'Capturing…' : 'Capture snapshot'}
        </Button>
      </div>

      {q.isLoading && <div className="text-sm text-gray-400">Loading…</div>}
      {q.isError && <div className="text-sm text-gray-400">Unable to load — honest unavailable, no fabricated value.</div>}
      {!q.isError && q.data && q.data.ready === false && q.data.error === 'measurement_error' && (
        <div className="text-sm rounded-md p-3" style={{ background: '#FEF2F2', color: '#991B1B' }}>
          Measurement error — snapshot history unreadable ({dash(q.data.note)}).
        </div>
      )}
      {!q.isError && q.data && q.data.ready === false && q.data.error !== 'measurement_error' && (
        <div className="text-sm rounded-md p-3" style={{ background: '#F9FAFB', color: '#6B7280' }}>
          {dash(q.data.note) === '—' ? 'No snapshots captured yet.' : dash(q.data.note)}
        </div>
      )}

      {list.length > 0 && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Captured snapshots ({num(list.length)})</CardTitle>
          <CardDescription>Most recent first. Verdict is the structural validation verdict recorded at capture time.</CardDescription>
        </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b border-t overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Captured at</TableHead><TableHead>Captured by</TableHead>
                  <TableHead>Verdict</TableHead><TableHead>Snapshot ID</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {list.map((s) => (
                    <TableRow key={s.snapshot_uid}>
                      <TableCell className="text-xs">{fmtDate(s.captured_at)}</TableCell>
                      <TableCell className="text-xs">{dash(s.captured_by)}</TableCell>
                      <TableCell className="text-xs"><Tone s={s?.summary?.validation_verdict} /></TableCell>
                      <TableCell className="text-xs font-mono">{dash(s.snapshot_uid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
      )}
    </div>
  );
}

/* ── Overview — summary + verdict + WITHHELD operability confidence ─────────── */
function OverviewSection() {
  const q = useEndpoint('/summary');
  const s = q.data?.summary;
  const sc = s?.status_counts ?? {};
  const gc = s?.gap_counts ?? {};
  const er = s?.enterprise_ready ?? {};
  return (
    <div className="space-y-4">
      <ErrorNote q={q} />
      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<Boxes className="w-4 h-4" />} label="Certified axes" value={num(s.axis_count)} hint="each scored SEPARATELY" />
            <Stat icon={<ListChecks className="w-4 h-4" />} label="Operational domains" value={num(s.domain_count)} />
            <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Supported domains" value={num(sc.SUPPORTED)} hint={`${num(sc.PARTIAL)} partial · ${num(sc.DEAD_END)} dead-end · ${num(sc.MISSING)} missing`} />
            <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Launch-critical gaps" value={num(gc['Launch-Critical'])} hint={`${num(s.resolved_gap_count)} resolved mechanisms`} />
          </div>

          <Card><CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Structural verdict</CardTitle>
            <CardDescription>Structural coverage means evidence EXISTS — it is NOT a runtime, quality or adoption claim.</CardDescription>
          </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm flex justify-between gap-4"><span className="text-gray-600">Validation verdict</span><Tone s={s.validation_verdict} /></div>
              <div className="text-sm flex justify-between gap-4"><span className="text-gray-600">Enterprise readiness</span><Tone s={er.verdict} /></div>
              <div className="text-sm flex justify-between gap-4">
                <span className="text-gray-600">Enterprise-operability confidence</span>
                <span className="text-right font-semibold" style={{ color: '#92400E' }}>
                  {er.operability_confidence == null ? '— (WITHHELD by design)' : num(er.operability_confidence)}
                </span>
              </div>
              {er.note && <p className="text-xs text-gray-500 mt-1 border-l pl-3">{er.note}</p>}
            </CardContent></Card>

          <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            {dash(s.axes_note)}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Certification — the SEPARATE per-axis structural-coverage scores ───────── */
function CertificationSection() {
  const q = useEndpoint('/certification');
  const axes: any[] = q.data?.certification?.axes ?? [];
  return (
    <div className="space-y-4">
      <ErrorNote q={q} />
      <div className="text-sm rounded-md p-3 flex items-start gap-2" style={{ background: '#FFFBEB', color: '#92400E' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        These are <b>{num(axes.length)} SEPARATE</b> structural-coverage scores (0–100 or <b>—</b> when no
        measurable evidence). They are <b>never combined into a single number</b>. null ≠ 0.
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {axes.map((a) => {
          const r = a.status_rollup ?? {};
          return (
            <Card key={a.key}><CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: BRAND.ink }}>{dash(a.label)}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{dash(a.definition)}</div>
                </div>
                <div className="text-2xl font-bold shrink-0" style={{ color: a.structural_coverage_score == null ? '#9CA3AF' : BRAND.primary }}>
                  {score(a.structural_coverage_score)}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Supported {num(r.SUPPORTED)}</span>
                <span>Partial {num(r.PARTIAL)}</span>
                <span>Dead-end {num(r.DEAD_END)}</span>
                <span>Missing {num(r.MISSING)}</span>
                {Array.isArray(a.open_gaps) && a.open_gaps.length > 0 && (
                  <span style={{ color: '#991B1B' }}>Open gaps: {a.open_gaps.join(', ')}</span>
                )}
              </div>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── Coverage — per-domain evidence verification ───────────────────────────── */
function CoverageSection() {
  const q = useEndpoint('/coverage');
  const rows: any[] = q.data?.coverage ?? [];
  return (
    <div className="space-y-3">
      <ErrorNote q={q} />
      <p className="text-xs text-gray-500">Per-domain structural coverage. Evidence counts are present/total across services · routes · frontend · tables.</p>
      {rows.length > 0 && (
        <div className="rounded border overflow-auto max-h-[65vh]">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Domain</TableHead><TableHead>Axis</TableHead><TableHead>Status</TableHead>
              <TableHead>Coverage %</TableHead><TableHead>Services</TableHead><TableHead>Routes</TableHead>
              <TableHead>Frontend</TableHead><TableHead>Tables</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const e = r.evidence ?? {};
                const cell = (o: any) => o ? `${num(o.present)}/${num(o.total)}` : '—';
                return (
                  <TableRow key={r.key}>
                    <TableCell className="text-xs font-medium">{dash(r.label)}</TableCell>
                    <TableCell className="text-xs">{dash(r.axis)}</TableCell>
                    <TableCell className="text-xs"><Tone s={r.status} /></TableCell>
                    <TableCell className="text-xs">{score(r.coverage_pct)}</TableCell>
                    <TableCell className="text-xs">{cell(e.services)}</TableCell>
                    <TableCell className="text-xs">{cell(e.routes)}</TableCell>
                    <TableCell className="text-xs">{cell(e.frontend)}</TableCell>
                    <TableCell className="text-xs">{cell(e.tables)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="text-xs text-gray-400 p-2">{num(rows.length)} domains</div>
        </div>
      )}
    </div>
  );
}

/* ── Capabilities — operational domain inventory + resolved mechanisms ──────── */
function CapabilitiesSection() {
  const qModel = useEndpoint('/model');
  const qGaps = useEndpoint('/gaps');
  const domains: any[] = qModel.data?.OPERATIONAL_DOMAINS ?? [];
  const resolved: any[] = qGaps.data?.gaps?.resolved_gaps ?? [];
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        The capability inventory is the operational domains the composer certifies plus the resolved
        operational mechanisms delivered behind the flag. <i>Built ≠ Operated — presence is structural.</i>
      </p>

      <ErrorNote q={qModel} />
      {domains.length > 0 && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Boxes className="w-4 h-4" /> Operational domains ({num(domains.length)})</CardTitle>
        </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b border-t overflow-auto max-h-[40vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Domain</TableHead><TableHead>Axis</TableHead><TableHead>Category</TableHead><TableHead>Signals</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.key}>
                      <TableCell className="text-xs font-medium">{dash(d.label)}</TableCell>
                      <TableCell className="text-xs">{dash(d.axis)}</TableCell>
                      <TableCell className="text-xs">{dash(d.category)}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(d.signals) && d.signals.length ? d.signals.join(', ') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
      )}

      <ErrorNote q={qGaps} />
      {resolved.length > 0 && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4" /> Resolved operational mechanisms ({num(resolved.length)})</CardTitle>
          <CardDescription>Real working mechanisms built additively behind the flag (composed / reused, never fabricated).</CardDescription>
        </CardHeader>
          <CardContent className="space-y-2">
            {resolved.map((m, i) => (
              <div key={m.key ?? i} className="text-sm rounded border p-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-700">{dash(m.mechanism)}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.former_gap && <Badge style={{ background: '#DCFCE7', color: '#166534', border: 'none' }}>{m.former_gap} closed</Badge>}
                    <span className="text-[11px] text-gray-400">{dash(m.axis)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{dash(m.detail)}</p>
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}

/* ── Live Health — real DR readiness + build/version + validation ──────────── */
function LiveHealthSection() {
  const qDr = useEndpoint('/dr/readiness');
  const qVer = useEndpoint('/version');
  const qVal = useEndpoint('/validation');
  const dr = qDr.data?.readiness;
  const ver = qVer.data?.version;
  const val = qVal.data?.validation;
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Live reads: disaster-recovery READINESS (config presence + live PostgreSQL connectivity) and
        build/version. <b>Recovery-readiness is not an executed restore drill</b> — that boundary stays honest.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Server className="w-4 h-4" />} label="App version" value={dash(ver?.app_version)} hint={dash(ver?.env)} />
        <Stat icon={<Activity className="w-4 h-4" />} label="Uptime (s)" value={num(ver?.uptime_seconds)} />
        <Stat icon={<Gauge className="w-4 h-4" />} label="DR readiness %" value={score(dr?.readiness_pct)} />
        <Stat icon={<Database className="w-4 h-4" />} label="Restore drill" value={dr?.restore_drill_executed ? 'executed' : 'not drilled'} hint="infra-owned boundary" />
      </div>

      <ErrorNote q={qDr} />
      {Array.isArray(dr?.checks) && dr.checks.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Disaster-recovery readiness checks</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {dr.checks.map((c: any) => (
              <div key={c.key} className="text-sm flex items-center justify-between gap-3 rounded border p-2">
                <div><span className="text-gray-700">{dash(c.label)}</span> <span className="text-[11px] text-gray-400">· {dash(c.detail)}</span></div>
                <Tone s={c.status} />
              </div>
            ))}
            {dr.note && <p className="text-xs text-gray-500 mt-1 border-l pl-3">{dr.note}</p>}
          </CardContent></Card>
      )}

      <ErrorNote q={qVal} />
      {val && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Structural validation</CardTitle>
          <CardDescription><Tone s={val.verdict} /></CardDescription>
        </CardHeader>
          <CardContent className="space-y-1">
            {val.checks && Object.entries(val.checks).map(([k, c]: any) => (
              <div key={k} className="text-sm flex items-start justify-between gap-3 rounded border p-2">
                <div className="min-w-0">
                  <span className="text-gray-700">{k.replace(/_/g, ' ')}</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{dash(c?.note)}</p>
                </div>
                <Tone s={c?.pass ? 'pass' : 'fail'} />
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}

/* ── Live Signals — real operational telemetry (queue · alerts · AI cost · metrics) ──
 * READ-ONLY. Composes the already-shipped Phase 2.5 read endpoints. No enqueue / evaluate /
 * toggle write actions are surfaced here (out of scope). A table-absent read returns
 * ready:false → we render an honest "no volume yet" note, NEVER a fabricated 0. null ≠ 0.
 */
function bytes(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(v)} ${u[i]}`;
}
function usd(n?: number | null) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(n))}`;
}
function fmtTime(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? dash(s) : d.toLocaleString('en-IN');
}
/** Honest empty note used when a read returns ready:false (table absent = no volume yet). */
function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="text-sm rounded-md p-3" style={{ background: '#F9FAFB', color: '#6B7280' }}>{children}</div>;
}

function SignalsSection() {
  const qQueue = useEndpoint('/queue/stats');
  const qDlq = useEndpoint('/queue/dead-letter');
  const qRules = useEndpoint('/alerts/rules');
  const qEvents = useEndpoint('/alerts/events');
  const qAi = useEndpoint('/ai/token-usage');
  const qMetrics = useEndpoint('/metrics.json');

  const queue = qQueue.data?.queue;
  const dlqRows: any[] = qDlq.data?.dead_letters ?? [];
  const dlqReady = qDlq.data?.ready !== false;
  const rules: any[] = qRules.data?.rules ?? [];
  const rulesReady = qRules.data?.ready !== false;
  const events: any[] = qEvents.data?.events ?? [];
  const eventsReady = qEvents.data?.ready !== false;
  const ai = qAi.data?.usage;
  const metrics = qMetrics.data?.metrics;

  const byStatus = queue?.by_status ?? {};

  return (
    <div className="space-y-6">
      <div className="text-sm rounded-md p-3 flex items-start gap-2" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Live operational telemetry from the Phase 2.5 mechanisms — durable job queue, alert rules &amp;
        fired events, AI token/cost accounting, and the in-process metrics registry. These are <b>read-only</b>
        views. In dev, real volume is often <b>0</b>; a table that does not exist yet reads as <b>no volume yet</b>
        (null = unreadable ≠ 0 = empty). Nothing here is fabricated.
      </div>

      {/* ── Job queue ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Inbox className="w-4 h-4" /> Durable job queue
        </div>
        <ErrorNote q={qQueue} />
        {queue?.ready === false && <EmptyNote>{dash(queue?.note) || 'Queue table absent until first enqueue (flag-ON).'}</EmptyNote>}
        {queue?.ready === true && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Stat icon={<Activity className="w-4 h-4" />} label="Pending" value={num(byStatus.pending ?? 0)} />
              <Stat icon={<Activity className="w-4 h-4" />} label="Processing" value={num(byStatus.processing ?? 0)} />
              <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Succeeded" value={num(byStatus.succeeded ?? 0)} />
              <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Failed" value={num(byStatus.failed ?? 0)} />
              <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Dead-letter" value={num(queue.dead_letter_count ?? 0)} />
              <Stat icon={<Gauge className="w-4 h-4" />} label="Processing (ms)" value={num(queue.processing_ms?.avg)} hint={`max ${num(queue.processing_ms?.max)}`} />
            </div>
          </>
        )}
      </div>

      {/* ── Dead-letter queue ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <AlertTriangle className="w-4 h-4" /> Dead-letter queue ({dlqReady ? num(dlqRows.length) : '—'})
        </div>
        <ErrorNote q={qDlq} />
        {!dlqReady && <EmptyNote>No dead-letter records yet (table absent until flag-ON). null ≠ 0.</EmptyNote>}
        {dlqReady && dlqRows.length === 0 && <EmptyNote>No dead-lettered jobs. This is a healthy empty state (0), not unreadable.</EmptyNote>}
        {dlqReady && dlqRows.length > 0 && (
          <div className="rounded border overflow-auto max-h-[40vh]">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Job type</TableHead><TableHead>Attempts</TableHead><TableHead>Last error</TableHead><TableHead>Dead-lettered</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dlqRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">{dash(r.job_type)}</TableCell>
                    <TableCell className="text-xs">{num(r.attempts)}</TableCell>
                    <TableCell className="text-xs text-red-700 max-w-[420px] truncate" title={dash(r.last_error)}>{dash(r.last_error)}</TableCell>
                    <TableCell className="text-xs">{fmtTime(r.dead_lettered_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Alert rules ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Bell className="w-4 h-4" /> Alert rules ({rulesReady ? num(rules.length) : '—'})
        </div>
        <ErrorNote q={qRules} />
        {!rulesReady && <EmptyNote>{dash(qRules.data?.note) || 'Alert-rule store absent until flag-ON.'}</EmptyNote>}
        {rulesReady && rules.length > 0 && (
          <div className="rounded border overflow-auto max-h-[40vh]">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Signal</TableHead><TableHead>Condition</TableHead>
                <TableHead>Severity</TableHead><TableHead>Channel</TableHead><TableHead>Enabled</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">{dash(r.name)}</TableCell>
                    <TableCell className="text-xs font-mono">{dash(r.signal)}</TableCell>
                    <TableCell className="text-xs font-mono">{dash(r.comparator)} {num(r.threshold)}</TableCell>
                    <TableCell className="text-xs"><Tone s={r.severity} /></TableCell>
                    <TableCell className="text-xs">{dash(r.channel)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge style={r.enabled
                        ? { background: '#DCFCE7', color: '#166534', border: 'none' }
                        : { background: '#F3F4F6', color: '#6B7280', border: 'none' }}>{r.enabled ? 'enabled' : 'disabled'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Fired alert events ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Activity className="w-4 h-4" /> Recent fired alert events ({eventsReady ? num(events.length) : '—'})
        </div>
        <ErrorNote q={qEvents} />
        {!eventsReady && <EmptyNote>No alert events yet (null ≠ 0).</EmptyNote>}
        {eventsReady && events.length === 0 && <EmptyNote>No alerts have fired. Healthy empty state (0), not unreadable.</EmptyNote>}
        {eventsReady && events.length > 0 && (
          <div className="rounded border overflow-auto max-h-[40vh]">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Rule</TableHead><TableHead>Signal</TableHead><TableHead>Observed</TableHead>
                <TableHead>Threshold</TableHead><TableHead>Severity</TableHead><TableHead>Routed</TableHead><TableHead>Fired</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs font-medium">{dash(e.rule_name)}</TableCell>
                    <TableCell className="text-xs font-mono">{dash(e.signal)}</TableCell>
                    <TableCell className="text-xs">{num(e.observed)}</TableCell>
                    <TableCell className="text-xs">{num(e.threshold)}</TableCell>
                    <TableCell className="text-xs"><Tone s={e.severity} /></TableCell>
                    <TableCell className="text-xs">{e.routed ? 'yes' : 'no'}</TableCell>
                    <TableCell className="text-xs">{fmtTime(e.fired_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── AI token + cost accounting ────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Coins className="w-4 h-4" /> AI token &amp; cost accounting
        </div>
        <ErrorNote q={qAi} />
        {ai?.ready === false && <EmptyNote>{dash(ai?.note) || 'AI token-usage table absent until first AI call (flag-ON).'}</EmptyNote>}
        {ai?.ready === true && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <Stat icon={<Activity className="w-4 h-4" />} label="AI calls" value={num(Number(ai.totals?.calls))} />
              <Stat icon={<Cpu className="w-4 h-4" />} label="Prompt tokens" value={num(Number(ai.totals?.prompt_tokens))} />
              <Stat icon={<Cpu className="w-4 h-4" />} label="Completion tokens" value={num(Number(ai.totals?.completion_tokens))} />
              <Stat icon={<BarChart3 className="w-4 h-4" />} label="Total tokens" value={num(Number(ai.totals?.total_tokens))} />
              <Stat icon={<Coins className="w-4 h-4" />} label="Total cost" value={usd(ai.totals?.cost_usd)} hint="unknown-model cost = —" />
            </div>
            {Array.isArray(ai.by_model) && ai.by_model.length > 0 && (
              <div className="rounded border overflow-auto max-h-[40vh]">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Model</TableHead><TableHead>Calls</TableHead><TableHead>Total tokens</TableHead><TableHead>Cost</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {ai.by_model.map((m: any, i: number) => (
                      <TableRow key={m.model ?? i}>
                        <TableCell className="text-xs font-mono">{dash(m.model)}</TableCell>
                        <TableCell className="text-xs">{num(Number(m.calls))}</TableCell>
                        <TableCell className="text-xs">{num(Number(m.total_tokens))}</TableCell>
                        <TableCell className="text-xs">{usd(m.cost_usd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── In-process metrics registry ───────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Gauge className="w-4 h-4" /> Metrics registry
        </div>
        <ErrorNote q={qMetrics} />
        {metrics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat icon={<Activity className="w-4 h-4" />} label="Uptime (s)" value={num(metrics.uptime_seconds)} />
              <Stat icon={<TrendingUp className="w-4 h-4" />} label="HTTP requests" value={num(metrics.http_requests_total)} />
              <Stat icon={<AlertTriangle className="w-4 h-4" />} label="HTTP 5xx errors" value={num(metrics.http_request_errors_total)} />
              <Stat icon={<Gauge className="w-4 h-4" />} label="Error ratio" value={metrics.http_error_ratio == null ? '—' : num(metrics.http_error_ratio)} hint="— = no traffic yet" />
              <Stat icon={<Cpu className="w-4 h-4" />} label="Heap used" value={bytes(metrics.process_heap_used_bytes)} />
              <Stat icon={<Server className="w-4 h-4" />} label="RSS" value={bytes(metrics.process_rss_bytes)} />
            </div>
            <p className="text-[11px] text-gray-400">
              In-process counters (a metrics registry, not a data store). Error ratio is <b>—</b> until traffic is observed
              (null ≠ 0). Counters reset on restart.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Latency — request-speed percentiles (p50/p95/p99), refreshed periodically ── */
function pct(n?: number | null) {
  // Percentiles are null until enough samples exist — render "—", NEVER a fabricated 0.
  if (n == null || Number.isNaN(n)) return '—';
  return `${num(n)} ms`;
}
function LatencySection() {
  // Live metric — poll every 15s so an operator SEES a slowdown at a glance.
  const q = useQuery<any>({
    queryKey: [BASE, '/metrics/latency'],
    queryFn: () => getJSON(`${BASE}/metrics/latency`),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const lat = q.data?.latency;
  const overall = lat?.overall ?? {};
  const byMethod: Record<string, any> = lat?.by_method ?? {};
  const methods = Object.keys(byMethod).sort();
  return (
    <div className="space-y-4">
      <div className="text-sm rounded-md p-3 flex items-start gap-2" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Request-speed percentiles estimated from the request-duration histogram (Prometheus semantics).
        Percentiles are <b>null until enough samples exist</b> (p50 ≥ 2, p95 ≥ 20, p99 ≥ 100) and render
        <b> —</b>, never a fabricated 0. Auto-refreshes every 15s.
      </div>
      <ErrorNote q={q} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={<Activity className="w-4 h-4" />} label="Requests sampled" value={num(overall.count)} />
        <Stat icon={<Gauge className="w-4 h-4" />} label="Avg" value={pct(overall.avg_ms)} />
        <Stat icon={<BarChart3 className="w-4 h-4" />} label="p50 (median)" value={pct(overall.p50_ms)} />
        <Stat icon={<BarChart3 className="w-4 h-4" />} label="p95" value={pct(overall.p95_ms)} />
        <Stat icon={<BarChart3 className="w-4 h-4" />} label="p99" value={pct(overall.p99_ms)} />
      </div>

      <Card><CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Per-method breakdown</CardTitle>
        <CardDescription>A single slow HTTP verb is visible on its own row. {dash(lat?.metric)}</CardDescription>
      </CardHeader>
        <CardContent className="p-0">
          {methods.length > 0 ? (
            <div className="rounded-b border-t overflow-auto max-h-[55vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Method</TableHead><TableHead>Requests</TableHead><TableHead>Avg</TableHead>
                  <TableHead>p50</TableHead><TableHead>p95</TableHead><TableHead>p99</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {methods.map((m) => {
                    const r = byMethod[m] ?? {};
                    return (
                      <TableRow key={m}>
                        <TableCell className="text-xs font-mono font-medium">{dash(m)}</TableCell>
                        <TableCell className="text-xs">{num(r.count)}</TableCell>
                        <TableCell className="text-xs">{pct(r.avg_ms)}</TableCell>
                        <TableCell className="text-xs">{pct(r.p50_ms)}</TableCell>
                        <TableCell className="text-xs">{pct(r.p95_ms)}</TableCell>
                        <TableCell className="text-xs">{pct(r.p99_ms)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-gray-400 p-4">No per-method samples recorded yet — metrics accrue as requests flow (flag-ON only).</div>
          )}
        </CardContent></Card>

      {lat?.note && <p className="text-xs text-gray-500 border-l pl-3">{dash(lat.note)}</p>}
    </div>
  );
}

/* ── Adoption — SEPARATE real non-demo volume per domain (never a gap) ──────── */
function AdoptionSection() {
  const q = useEndpoint('/adoption');
  const items: any[] = q.data?.adoption?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="text-sm rounded-md p-3 flex items-start gap-2" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
        <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
        Adoption is a <b>SEPARATE</b> axis — real persisted volume per domain. It is <b>never composited</b>
        into Coverage/Certification and <b>never a gap</b>. In dev, real operational volume is honest-low/0.
        null = unreadable (≠ 0 = empty).
      </div>
      <ErrorNote q={q} />
      {items.length > 0 && (
        <div className="rounded border overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Domain</TableHead><TableHead>Axis</TableHead><TableHead>Table</TableHead>
              <TableHead>Present</TableHead><TableHead>Total rows</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="text-xs font-medium">{dash(r.label)}</TableCell>
                  <TableCell className="text-xs">{dash(r.axis)}</TableCell>
                  <TableCell className="text-xs font-mono">{dash(r.table)}</TableCell>
                  <TableCell className="text-xs">{r.table_present ? 'yes' : 'no'}</TableCell>
                  <TableCell className="text-xs">{num(r.total_rows)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ── Gap Register — OPEN gaps by severity + resolved mechanisms ─────────────── */
function GapsSection() {
  const q = useEndpoint('/gaps');
  const g = q.data?.gaps;
  const counts = g?.gap_counts ?? {};
  const open: any[] = g?.open_gaps ?? [];
  const resolved: any[] = g?.resolved_gaps ?? [];
  const SEV = ['Launch-Critical', 'High', 'Medium', 'Low', 'Future'];
  return (
    <div className="space-y-4">
      <ErrorNote q={q} />
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {SEV.map((sev) => <Stat key={sev} label={sev} value={num(counts[sev])} />)}
      </div>

      <Card><CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Operational Gap Register — open ({num(open.length)})</CardTitle>
      </CardHeader>
        <CardContent className="space-y-2">
          {open.length === 0 && (
            <div className="text-sm rounded-md p-3" style={{ background: '#F0FDF4', color: '#166534' }}>
              No OPEN operational gaps of any severity. Engineering closure is STRUCTURAL — adoption &amp;
              enterprise-operability confidence remain SEPARATE axes, never a gap.
            </div>
          )}
          {open.map((gp, i) => (
            <div key={gp.key ?? i} className="text-sm rounded border p-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-gray-700">{dash(gp.title)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Tone s={gp.severity} /><span className="text-[11px] text-gray-400">{dash(gp.axis)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{dash(gp.detail)}</p>
            </div>
          ))}
        </CardContent></Card>

      {resolved.length > 0 && (
        <Card><CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Resolved / reused mechanisms ({num(resolved.length)})</CardTitle>
        </CardHeader>
          <CardContent className="space-y-1">
            {resolved.map((m, i) => (
              <div key={m.key ?? i} className="text-sm flex items-start justify-between gap-3 rounded border p-2">
                <div className="min-w-0">
                  <span className="text-gray-700">{dash(m.mechanism)}</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{dash(m.detail)}</p>
                </div>
                {m.former_gap && <Badge className="shrink-0" style={{ background: '#DCFCE7', color: '#166534', border: 'none' }}>{m.former_gap}</Badge>}
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}
