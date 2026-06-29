import { BRAND } from '@/design-system/tokens';
/**
 * MX-800 Phase 2.11 — Platform Intelligence Operations Center.
 *
 * READ-ONLY SuperAdmin console that COMPOSES the already-shipped read APIs of the nine prior MX-800
 * intelligence tiers (client-side only — NO new backend, NO service, NO migration, NO business logic):
 *   - 2.1  Platform Intelligence Registry   /api/admin/platform-intelligence-registry
 *   - 2.3  Engineering Intelligence          /api/admin/engineering-intelligence
 *   - 2.4  Runtime Intelligence              /api/admin/runtime-intelligence
 *   - 2.5  Knowledge Intelligence            /api/admin/knowledge-intelligence
 *   - 2.6  Decision Intelligence             /api/admin/decision-intelligence
 *   - 2.7  Predictive Intelligence           /api/admin/predictive-intelligence
 *   - 2.8  Recommendation Intelligence       /api/admin/recommendation-intelligence
 *   - 2.9  Continuous Learning Intelligence  /api/admin/continuous-learning-intelligence
 *   - 2.10 Enterprise Intelligence           /api/admin/enterprise-intelligence
 *
 * The whole console is gated by the `platformIntelligenceOperations` flag (the dashboard probes
 * /feature-flag before mounting) → flag-OFF is byte-identical legacy.
 *
 * HONESTY (Visible ≠ Healthy · Dashboard ≠ Intelligence · Monitoring ≠ Governance · Alert ≠ Incident ·
 * Metric ≠ Insight · Insight ≠ Decision · Built ≠ Activated · null ≠ 0 · human approval mandatory):
 *   - Each section independently probes its underlying engine's `/enabled` flag and renders an honest
 *     "engine not enabled" notice when that backend is OFF — it never fabricates zeros or data.
 *   - Alert Intelligence is CLIENT-SIDE DERIVED from each engine's own measured validation output
 *     (Alert ≠ Incident). It never executes any action — human approval remains mandatory.
 *   - null/absent renders "—" (missing), never a fake 0. Measured values are shown verbatim.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, BarChart3, Boxes, Brain, Compass, Database, Gauge, GitBranch,
  Info, LayoutDashboard, Lightbulb, Power, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/* ── tier bases (existing 2.1–2.10 read APIs) ─────────────────────────────── */
const R21 = '/api/admin/platform-intelligence-registry';   // 2.1
const ENG = '/api/admin/engineering-intelligence';         // 2.3
const RT  = '/api/admin/runtime-intelligence';             // 2.4
const KN  = '/api/admin/knowledge-intelligence';           // 2.5
const DEC = '/api/admin/decision-intelligence';            // 2.6
const PRD = '/api/admin/predictive-intelligence';          // 2.7
const REC = '/api/admin/recommendation-intelligence';      // 2.8
const LRN = '/api/admin/continuous-learning-intelligence'; // 2.9
const ENT = '/api/admin/enterprise-intelligence';          // 2.10

const TIERS: Array<{ base: string; label: string }> = [
  { base: R21, label: 'Platform Intelligence Registry (2.1)' },
  { base: ENG, label: 'Engineering Intelligence (2.3)' },
  { base: RT,  label: 'Runtime Intelligence (2.4)' },
  { base: KN,  label: 'Knowledge Intelligence (2.5)' },
  { base: DEC, label: 'Decision Intelligence (2.6)' },
  { base: PRD, label: 'Predictive Intelligence (2.7)' },
  { base: REC, label: 'Recommendation Intelligence (2.8)' },
  { base: LRN, label: 'Continuous Learning Intelligence (2.9)' },
  { base: ENT, label: 'Enterprise Intelligence (2.10)' },
];
const ENGINE_LABEL: Record<string, string> = Object.fromEntries(TIERS.map((t) => [t.base, t.label]));

/* ── honest formatters (null ≠ 0) ─────────────────────────────────────────── */
function num(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}
function dash(s?: string | null) { return s == null || s === '' ? '—' : String(s); }

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const STATE_TONE: Record<string, { bg: string; fg: string }> = {
  pass: { bg: '#DCFCE7', fg: '#166534' }, ok: { bg: '#DCFCE7', fg: '#166534' },
  healthy: { bg: '#DCFCE7', fg: '#166534' }, measured: { bg: '#DCFCE7', fg: '#166534' },
  active: { bg: '#DCFCE7', fg: '#166534' }, structural_certified: { bg: '#E0E7FF', fg: '#3730A3' },
  attention: { bg: '#FEF3C7', fg: '#92400E' }, partial: { bg: '#FEF3C7', fg: '#92400E' },
  degraded: { bg: '#FEF3C7', fg: '#92400E' }, at_risk: { bg: '#FEF3C7', fg: '#92400E' },
  fail: { bg: '#FEE2E2', fg: '#991B1B' }, failed: { bg: '#FEE2E2', fg: '#991B1B' },
  violation: { bg: '#FEE2E2', fg: '#991B1B' }, non_compliant: { bg: '#FEE2E2', fg: '#991B1B' },
  dormant: { bg: '#F3F4F6', fg: '#6B7280' }, unmeasurable: { bg: '#F3F4F6', fg: '#6B7280' },
  unmeasured: { bg: '#F3F4F6', fg: '#6B7280' },
};
function Tone({ s }: { s?: string | null }) {
  if (!s) return <span style={{ color: '#9CA3AF' }}>—</span>;
  const t = STATE_TONE[String(s).toLowerCase()] ?? { bg: '#F3F4F6', fg: '#374151' };
  return <Badge style={{ background: t.bg, color: t.fg, border: 'none' }}>{s}</Badge>;
}

/* concern-status set used by derived alerts + tone scanning */
const CONCERN = new Set(['attention', 'partial', 'degraded', 'at_risk', 'fail', 'failed', 'violation', 'non_compliant', 'breaking']);

/* ── engine flag probe (ungated /enabled → { enabled }) ────────────────────── */
function useEngineEnabled(base: string) {
  return useQuery<{ enabled: boolean }>({
    queryKey: [base, 'enabled'],
    queryFn: () => getJSON(`${base}/enabled`),
    staleTime: 60_000,
  });
}

function EngineOff({ base }: { base: string }) {
  return (
    <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#F9FAFB', color: '#6B7280' }}>
      <Power className="w-4 h-4 mt-0.5 shrink-0" />
      <span><b>{ENGINE_LABEL[base] ?? base}</b> is not enabled. This section composes that engine — turning the
        engine flag ON will surface its measured data here. <i>Built ≠ activated; no data is fabricated.</i></span>
    </div>
  );
}

/* ── small presentational primitives ──────────────────────────────────────── */
function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BRAND.ink }}>{value}</div>
    </CardContent></Card>
  );
}

/** Generic recursive key/value renderer for loosely-typed nested objects (honest null → "—"). */
function RecursiveKV({ data, title, icon }: { data?: any; title: string; icon?: React.ReactNode }) {
  const entries = data && typeof data === 'object' && !Array.isArray(data) ? Object.entries(data) : [];
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && <div className="text-xs text-gray-400">— no data</div>}
        {entries.map(([k, v]) => <KVNode key={k} k={k} v={v} depth={0} />)}
      </CardContent></Card>
  );
}
function KVNode({ k, v, depth }: { k: string; v: any; depth: number }) {
  const label = k.replace(/_/g, ' ');
  const isStatusKey = /status|verdict|state/i.test(k);
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    return (
      <div style={{ marginLeft: depth * 12 }}>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="border-l pl-3 mt-1 space-y-1">
          {Object.entries(v).map(([ck, cv]) => <KVNode key={ck} k={ck} v={cv} depth={depth + 1} />)}
        </div>
      </div>
    );
  }
  let val: React.ReactNode;
  if (Array.isArray(v)) val = v.length ? `${v.length} items` : '—';
  else if (typeof v === 'number') val = num(v);
  else if (typeof v === 'boolean') val = v ? 'yes' : 'no';
  else if (isStatusKey && typeof v === 'string') val = <Tone s={v} />;
  else val = dash(v);
  return (
    <div className="text-sm flex justify-between gap-4" style={{ marginLeft: depth * 12 }}>
      <span className="text-gray-600">{label}</span><span className="text-right font-semibold">{val}</span>
    </div>
  );
}

/** Fetch one tier endpoint and render it via RecursiveKV with honest off/loading/error states. */
function EndpointCard({ base, path, on, title, icon }: { base: string; path: string; on: boolean; title: string; icon?: React.ReactNode }) {
  const q = useQuery<any>({ queryKey: [base, path], queryFn: () => getJSON(`${base}${path}`), enabled: on });
  if (!on) return <EngineOff base={base} />;
  if (q.isLoading) return <div className="text-sm text-gray-400">Loading {ENGINE_LABEL[base]}…</div>;
  if (q.isError) return <div className="text-sm text-gray-400">Unable to load {ENGINE_LABEL[base]}.</div>;
  return <RecursiveKV data={q.data} title={title} icon={icon} />;
}

/** Read-only data table from a react-query result with a { rows | items | registry } envelope. */
function DataTable({ q, cols, rowsKey, emptyNote, filter }: { q: any; cols: Array<[string, string, 'state'?]>; rowsKey?: string; emptyNote?: string; filter?: (r: any) => boolean }) {
  if (q.isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (q.isError) return <div className="text-sm text-gray-400">Unable to load.</div>;
  const all: any[] = q.data?.[rowsKey ?? 'rows'] ?? q.data?.rows ?? q.data?.items ?? q.data?.registry ?? [];
  const rows = filter ? all.filter(filter) : all;
  if (rows.length === 0) return <div className="text-sm text-gray-400">{emptyNote ?? '— no rows'}</div>;
  return (
    <div className="rounded border overflow-auto max-h-[60vh]">
      <Table>
        <TableHeader><TableRow>{cols.map(([, label]) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map(([k, , kind]) => (
                <TableCell key={k} className="text-xs">
                  {kind === 'state' ? <Tone s={r[k]} />
                    : Array.isArray(r[k]) ? (r[k].length ? r[k].join(', ') : '—')
                    : typeof r[k] === 'boolean' ? (r[k] ? 'yes' : 'no')
                    : typeof r[k] === 'number' ? num(r[k])
                    : dash(r[k])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="text-xs text-gray-400 p-2">{num(rows.length)} rows</div>
    </div>
  );
}

function SubTabs({ tabs, active, onChange }: { tabs: Array<[string, string]>; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded ${active === id ? 'text-white' : 'text-gray-600 bg-gray-100'}`}
          style={active === id ? { background: BRAND.primary } : {}}>{label}</button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
type TabId = 'operations' | 'monitoring' | 'observability' | 'governance' | 'operational' | 'alerts' | 'executive' | 'superadmin' | 'validation';

export default function PlatformIntelligenceOperationsPanel() {
  const [tab, setTab] = React.useState<TabId>('operations');

  const on: Record<string, boolean> = {};
  for (const t of TIERS) on[t.base] = useEngineEnabled(t.base).data?.enabled === true; // eslint-disable-line react-hooks/rules-of-hooks
  const anyOn = TIERS.some((t) => on[t.base]);

  const TABS: Array<[TabId, string]> = [
    ['operations', 'Operations'], ['monitoring', 'Monitoring'], ['observability', 'Observability'],
    ['governance', 'Governance'], ['operational', 'Operational Intel'], ['alerts', 'Alerts'],
    ['executive', 'Executive'], ['superadmin', 'SuperAdmin Ops'], ['validation', 'Validation'],
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <LayoutDashboard className="w-6 h-6" /> Platform Intelligence Operations Center
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          A unified, read-only operations console composing the existing MX-800 intelligence engines
          (2.1–2.10). Each section reflects the live state of its underlying engine — sections whose engine
          flag is OFF show an honest notice, never fabricated data. <i>Monitoring ≠ Governance · Alert ≠
          Incident · Insight ≠ Decision · human approval remains mandatory.</i>
        </p>
      </div>

      {!anyOn && (
        <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#FFFBEB', color: '#92400E' }}>
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          None of the underlying intelligence engines (2.1–2.10) are currently enabled. This console is
          exposed, but it has no engine data to compose yet — enable the engine flags to populate the
          sections below. <b>Visible ≠ Healthy; Built ≠ Activated.</b>
        </div>
      )}

      <div className="flex gap-1 flex-wrap border-b">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? 'border-current' : 'border-transparent text-gray-500'}`}
            style={tab === id ? { color: BRAND.primary } : {}}>{label}</button>
        ))}
      </div>

      {tab === 'operations' && <OperationsSection on={on} />}
      {tab === 'monitoring' && <MonitoringSection on={on} />}
      {tab === 'observability' && <ObservabilitySection on={on} />}
      {tab === 'governance' && <GovernanceSection on={on} />}
      {tab === 'operational' && <OperationalSection on={on} />}
      {tab === 'alerts' && <AlertsSection on={on} />}
      {tab === 'executive' && <ExecutiveSection on={on} />}
      {tab === 'superadmin' && <SuperAdminSection on={on} />}
      {tab === 'validation' && <ValidationSection on={on} />}
    </div>
  );
}

/* ── Part 1: Intelligence Operations Center — unified per-engine status ─────── */
function OperationsSection({ on }: { on: Record<string, boolean> }) {
  const enabledCount = TIERS.filter((t) => on[t.base]).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Boxes className="w-4 h-4" />} label="Intelligence tiers" value={num(TIERS.length)} />
        <Stat icon={<Activity className="w-4 h-4" />} label="Engines enabled" value={num(enabledCount)} />
        <Stat icon={<Power className="w-4 h-4" />} label="Engines dormant" value={num(TIERS.length - enabledCount)} />
        <Stat icon={<ShieldCheck className="w-4 h-4" />} label="Console" value="exposed" />
      </div>
      <Card><CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4" /> Intelligence engine registry</CardTitle>
        <CardDescription>Live activation state per engine. Console exposure says nothing about engine activation (Built ≠ Activated).</CardDescription>
      </CardHeader>
        <CardContent className="space-y-1">
          {TIERS.map((t) => (
            <div key={t.base} className="text-sm flex items-center justify-between rounded border p-2">
              <span className="text-gray-700">{t.label}</span>
              <Tone s={on[t.base] ? 'active' : 'dormant'} />
            </div>
          ))}
        </CardContent></Card>
      <EndpointCard base={ENT} path="/summary" on={on[ENT]} title="Enterprise operations summary (2.10)" icon={<LayoutDashboard className="w-4 h-4" />} />
    </div>
  );
}

/* ── Part 2: Real-time Intelligence Monitoring — per-engine health ─────────── */
function MonitoringSection({ on }: { on: Record<string, boolean> }) {
  const HEALTH: Array<{ base: string; path: string; title: string }> = [
    { base: R21, path: '/summary', title: 'Registry health (2.1)' },
    { base: ENG, path: '/summary', title: 'Engineering health (2.3)' },
    { base: RT,  path: '/application-health', title: 'Runtime health (2.4)' },
    { base: KN,  path: '/summary', title: 'Knowledge health (2.5)' },
    { base: DEC, path: '/summary', title: 'Decision health (2.6)' },
    { base: PRD, path: '/summary', title: 'Prediction health (2.7)' },
    { base: REC, path: '/summary', title: 'Recommendation health (2.8)' },
    { base: LRN, path: '/summary', title: 'Learning health (2.9)' },
    { base: ENT, path: '/summary', title: 'Enterprise health (2.10)' },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Each card reflects the underlying engine's own measured summary. <b>Visible ≠ Healthy.</b></p>
      <div className="grid md:grid-cols-2 gap-4">
        {HEALTH.map((h) => <EndpointCard key={h.base + h.path} base={h.base} path={h.path} on={on[h.base]} title={h.title} icon={<Gauge className="w-4 h-4" />} />)}
      </div>
    </div>
  );
}

/* ── Part 3: Enterprise Observability ──────────────────────────────────────── */
function ObservabilitySection({ on }: { on: Record<string, boolean> }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Correlates the engines' measured observability + metrics signals (co-presence, not causation — Correlation ≠ Causation).</p>
      <div className="grid md:grid-cols-2 gap-4">
        <EndpointCard base={ENT} path="/correlation" on={on[ENT]} title="Cross-intelligence correlation (2.10)" icon={<GitBranch className="w-4 h-4" />} />
        <EndpointCard base={RT} path="/observability" on={on[RT]} title="Runtime observability (2.4)" icon={<Activity className="w-4 h-4" />} />
        <EndpointCard base={RT} path="/performance" on={on[RT]} title="Runtime performance (2.4)" icon={<Gauge className="w-4 h-4" />} />
        <EndpointCard base={ENG} path="/metrics" on={on[ENG]} title="Engineering metrics (2.3)" icon={<BarChart3 className="w-4 h-4" />} />
      </div>
    </div>
  );
}

/* ── Part 4: Governance Operations ─────────────────────────────────────────── */
function GovernanceSection({ on }: { on: Record<string, boolean> }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Composes the engines' governance + validation outputs. <b>Monitoring ≠ Governance; human approval mandatory.</b></p>
      <div className="grid md:grid-cols-2 gap-4">
        <EndpointCard base={R21} path="/governance" on={on[R21]} title="Registry governance (2.1)" icon={<ShieldCheck className="w-4 h-4" />} />
        <EndpointCard base={DEC} path="/governance" on={on[DEC]} title="Decision governance (2.6)" icon={<ShieldCheck className="w-4 h-4" />} />
        <EndpointCard base={ENG} path="/quality" on={on[ENG]} title="Engineering quality (2.3)" icon={<ShieldCheck className="w-4 h-4" />} />
        <EndpointCard base={ENG} path="/architecture" on={on[ENG]} title="Architecture status (2.3)" icon={<Boxes className="w-4 h-4" />} />
        <EndpointCard base={ENT} path="/validation" on={on[ENT]} title="Enterprise governance validation (2.10)" icon={<ShieldCheck className="w-4 h-4" />} />
      </div>
    </div>
  );
}

/* ── Part 5: Operational Intelligence ──────────────────────────────────────── */
function OperationalSection({ on }: { on: Record<string, boolean> }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Active risks, predictions, recommendations &amp; trends composed read-only. <b>Insight ≠ Decision</b> — nothing is auto-actioned.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <EndpointCard base={PRD} path="/risk" on={on[PRD]} title="Active risks (2.7)" icon={<AlertTriangle className="w-4 h-4" />} />
        <EndpointCard base={PRD} path="/trend" on={on[PRD]} title="Predicted trends (2.7)" icon={<BarChart3 className="w-4 h-4" />} />
        <EndpointCard base={REC} path="/opportunity" on={on[REC]} title="Active opportunities (2.8)" icon={<Lightbulb className="w-4 h-4" />} />
        <EndpointCard base={REC} path="/action" on={on[REC]} title="Recommended actions (2.8)" icon={<Compass className="w-4 h-4" />} />
        <EndpointCard base={ENT} path="/insights" on={on[ENT]} title="Enterprise insights (2.10)" icon={<Lightbulb className="w-4 h-4" />} />
      </div>
    </div>
  );
}

/* ── Part 6: Alert Intelligence (CLIENT-SIDE DERIVED, Alert ≠ Incident) ────── */
function AlertsSection({ on }: { on: Record<string, boolean> }) {
  // Iterate the CONSTANT TIERS array (stable hook order); gate each query by its engine flag.
  const results = TIERS.map((t) => ({
    tier: t,
    q: useQuery<any>({ queryKey: [t.base, '/validation', 'alerts'], queryFn: () => getJSON(`${t.base}/validation`), enabled: on[t.base] }), // eslint-disable-line react-hooks/rules-of-hooks
  }));
  const activeTiers = TIERS.filter((t) => on[t.base]);

  const alerts: Array<{ tier: string; path: string; status: string }> = [];
  for (const r of results) {
    if (!on[r.tier.base] || !r.q.data) continue;
    collectConcerns(r.q.data, r.tier.label, [], alerts);
  }
  const anyLoading = results.some((r) => on[r.tier.base] && r.q.isLoading);

  return (
    <div className="space-y-4">
      <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Alerts are <b>derived client-side</b> from each engine's own measured validation output. <b>Alert ≠
        Incident</b> — these are observations for human review; no action is ever taken automatically.
      </div>
      {activeTiers.length === 0 && <div className="text-sm text-gray-400">No engines enabled — no validation output to derive alerts from.</div>}
      {anyLoading && <div className="text-sm text-gray-400">Scanning engine validation output…</div>}
      {!anyLoading && activeTiers.length > 0 && alerts.length === 0 && (
        <div className="text-sm rounded-md p-4" style={{ background: '#F0FDF4', color: '#166534' }}>
          No derived alerts — every enabled engine's validation output is within its measured pass state.
        </div>
      )}
      {alerts.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Derived alerts ({num(alerts.length)})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="text-sm flex items-center justify-between gap-3 rounded border p-2">
                <div><b className="text-gray-700">{a.tier}</b> <span className="text-gray-500 text-xs">· {a.path}</span></div>
                <Tone s={a.status} />
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}
/** Recursively collect concern-status leaves from a validation object (depth-capped). */
function collectConcerns(obj: any, tier: string, path: string[], out: Array<{ tier: string; path: string; status: string }>) {
  if (path.length > 6 || obj == null) return;
  if (typeof obj === 'string') {
    if (CONCERN.has(obj.toLowerCase()) && /status|verdict|state/i.test(path[path.length - 1] ?? '')) {
      out.push({ tier, path: path.join('.'), status: obj });
    }
    return;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => collectConcerns(v, tier, [...path, String(i)], out)); return; }
  if (typeof obj === 'object') { for (const [k, v] of Object.entries(obj)) collectConcerns(v, tier, [...path, k], out); }
}

/* ── Part 7: Executive Operations Dashboard ────────────────────────────────── */
function ExecutiveSection({ on }: { on: Record<string, boolean> }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Enterprise-level KPIs &amp; indicators composed read-only from the enterprise tier (2.10).</p>
      <div className="grid md:grid-cols-2 gap-4">
        <EndpointCard base={ENT} path="/executive" on={on[ENT]} title="Executive intelligence (2.10)" icon={<LayoutDashboard className="w-4 h-4" />} />
        <EndpointCard base={ENT} path="/metrics" on={on[ENT]} title="Enterprise metrics — separate scores, no composite (2.10)" icon={<BarChart3 className="w-4 h-4" />} />
        <EndpointCard base={ENT} path="/organizational" on={on[ENT]} title="Organizational intelligence (2.10)" icon={<Boxes className="w-4 h-4" />} />
      </div>
    </div>
  );
}

/* ── Part 8: SuperAdmin Operations — intelligence registry search ──────────── */
function SuperAdminSection({ on }: { on: Record<string, boolean> }) {
  const [term, setTerm] = React.useState('');
  const reg = useQuery<any>({ queryKey: [ENT, '/registry'], queryFn: () => getJSON(`${ENT}/registry`), enabled: on[ENT] });
  const t = term.trim().toLowerCase();
  const filter = t ? (r: any) => JSON.stringify(r).toLowerCase().includes(t) : undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-md">
        <Search className="w-4 h-4 text-gray-400" />
        <Input placeholder="Search the intelligence registry…" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {!on[ENT] ? <EngineOff base={ENT} /> : (
        <DataTable q={reg} rowsKey="registry" filter={filter} cols={[
          ['canonical_name', 'Capability'], ['intelligence_kind', 'Kind'], ['business_domain', 'Domain'],
          ['activation_state', 'Activation', 'state'], ['lifecycle_state', 'Lifecycle', 'state'], ['repository_reference', 'Repository'],
        ]} emptyNote="— no registry entries (run Enterprise Intelligence discover to populate)" />
      )}
    </div>
  );
}

/* ── Part 9: Operations Validation ─────────────────────────────────────────── */
function ValidationSection({ on }: { on: Record<string, boolean> }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Each engine's own STRUCTURAL validation verdict, composed read-only. Verdicts are structural — not a production-readiness guarantee.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {TIERS.map((t) => (
          <EndpointCard key={t.base} base={t.base} path="/validation" on={on[t.base]} title={`${t.label} validation`} icon={<ShieldCheck className="w-4 h-4" />} />
        ))}
      </div>
    </div>
  );
}
