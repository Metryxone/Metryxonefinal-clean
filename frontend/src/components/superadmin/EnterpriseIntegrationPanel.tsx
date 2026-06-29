import { BRAND } from '@/design-system/tokens';
/**
 * MX-800 Phase 2.13 — Enterprise Intelligence Integration Platform (Part 9 SuperAdmin console).
 *
 * READ-ONLY SuperAdmin console for the enterprise-integration tier. Unlike the 2.11 Operations Center (which
 * composed the prior tiers CLIENT-SIDE), this console reads the 2.13 backend, which composes the EXISTING
 * MX-800 2.1–2.12 + MX-700 1.41/1.37 + workflow/report services SERVER-SIDE into one integration view. The
 * whole console is gated by the `enterpriseIntelligenceIntegration` flag (the dashboard probes /feature-flag
 * before mounting) → flag-OFF is byte-identical legacy. This panel adds NO new backend / service / migration
 * / business logic — it surfaces the already-shipped 2.13 read endpoints.
 *
 * HONESTY (Integrated ≠ Unified · Unified ≠ Operational · Connected ≠ Orchestrated · Composition ≠
 * Duplication · Dashboard ≠ Platform · Built ≠ Activated · Present ≠ Populated · null ≠ 0 · human approval
 * mandatory): each section renders the tier's MEASURED output verbatim — null/absent renders "—", never a
 * fake 0; enterprise_readiness is deliberately withheld (honest-null); reachable/present states are toned but
 * never asserted as "operational".
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Boxes, Brain, GitBranch, Info, LayoutDashboard, Network, Plug, ShieldCheck, Workflow as WorkflowIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BASE = '/api/admin/enterprise-intelligence-integration';

/* ── honest formatters (null ≠ 0) ─────────────────────────────────────────── */
function num(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}
function pct(n?: number | null) { return n == null || Number.isNaN(n) ? '—' : `${num(n)}%`; }
function dash(s?: any) { return s == null || s === '' ? '—' : String(s); }
function bool(b?: any) { return b == null ? '—' : b ? 'yes' : 'no'; }

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
function use2013<T = any>(path: string, enabled = true) {
  return useQuery<T>({ queryKey: [BASE, path], queryFn: () => getJSON(`${BASE}${path}`), enabled, staleTime: 30_000 });
}

const STATE_TONE: Record<string, { bg: string; fg: string }> = {
  pass: { bg: '#DCFCE7', fg: '#166534' }, structural_validated: { bg: '#E0E7FF', fg: '#3730A3' },
  active: { bg: '#DCFCE7', fg: '#166534' }, reachable: { bg: '#DCFCE7', fg: '#166534' }, present: { bg: '#DCFCE7', fg: '#166534' },
  partial: { bg: '#FEF3C7', fg: '#92400E' }, deferred: { bg: '#FEF3C7', fg: '#92400E' },
  fail: { bg: '#FEE2E2', fg: '#991B1B' }, absent: { bg: '#FEE2E2', fg: '#991B1B' }, unreachable: { bg: '#FEE2E2', fg: '#991B1B' },
  dormant: { bg: '#F3F4F6', fg: '#6B7280' }, unmeasured: { bg: '#F3F4F6', fg: '#6B7280' },
};
function Tone({ s }: { s?: any }) {
  if (s == null || s === '') return <span style={{ color: '#9CA3AF' }}>—</span>;
  const t = STATE_TONE[String(s).toLowerCase()] ?? { bg: '#F3F4F6', fg: '#374151' };
  return <Badge style={{ background: t.bg, color: t.fg, border: 'none' }}>{String(s)}</Badge>;
}
function Bool({ b }: { b?: any }) { return b == null ? <span style={{ color: '#9CA3AF' }}>—</span> : <Tone s={b ? 'reachable' : 'unreachable'} />; }

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BRAND.ink }}>{value}</div>
    </CardContent></Card>
  );
}
function Loading() { return <div className="text-sm text-gray-400">Loading…</div>; }
function ErrState() { return <div className="text-sm text-gray-400">Unable to load this section.</div>; }

function SimpleTable({ cols, rows, empty }: { cols: Array<[string, string, ('state' | 'bool' | 'pct')?]>; rows: any[]; empty?: string }) {
  if (!rows || rows.length === 0) return <div className="text-sm text-gray-400">{empty ?? '— no rows'}</div>;
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
                    : kind === 'bool' ? <Bool b={r[k]} />
                    : kind === 'pct' ? pct(r[k])
                    : Array.isArray(r[k]) ? (r[k].length ? r[k].join(', ') : '—')
                    : typeof r[k] === 'boolean' ? bool(r[k])
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

/* ══════════════════════════════════════════════════════════════════════════ */
type TabId = 'integration' | 'services' | 'registry' | 'api' | 'dependencies' | 'workflow';

export default function EnterpriseIntegrationPanel() {
  const [tab, setTab] = React.useState<TabId>('integration');
  const TABS: Array<[TabId, string]> = [
    ['integration', 'Integration'], ['services', 'Services'], ['registry', 'Registry'],
    ['api', 'Interoperability'], ['dependencies', 'Coordination'], ['workflow', 'Metrics & Workflow'],
  ];
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Plug className="w-6 h-6" /> Enterprise Intelligence Integration Platform
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          A unified, read-only integration console. The 2.13 backend REGISTERS the existing MX-800 2.1–2.12
          intelligence/enterprise tiers + MX-700 1.41/1.37 platform tiers + workflow / report services and
          COMPOSES their read-only summaries — it never invokes, runs, or activates an engine.
          <i> Integrated ≠ Unified · Unified ≠ Operational · Composition ≠ Duplication · Built ≠ Activated ·
          human approval remains mandatory.</i>
        </p>
      </div>
      <div className="flex gap-1 flex-wrap border-b">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? 'border-current' : 'border-transparent text-gray-500'}`}
            style={tab === id ? { color: BRAND.primary } : {}}>{label}</button>
        ))}
      </div>
      {tab === 'integration' && <IntegrationSection />}
      {tab === 'services' && <ServicesSection />}
      {tab === 'registry' && <RegistrySection />}
      {tab === 'api' && <InteroperabilitySection />}
      {tab === 'dependencies' && <CoordinationSection />}
      {tab === 'workflow' && <MetricsWorkflowSection />}
    </div>
  );
}

/* ── Integration: catalog totals + cross-intelligence channels ─────────────── */
function IntegrationSection() {
  const cat = use2013('/catalog');
  const cross = use2013('/cross-intelligence');
  if (cat.isLoading) return <Loading />;
  if (cat.isError) return <ErrState />;
  const t = cat.data?.totals ?? {};
  const channels = cross.data?.channels ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Boxes className="w-4 h-4" />} label="Integrated services" value={num(t.services)} />
        <Stat icon={<Activity className="w-4 h-4" />} label="Substrate present" value={num(t.present)} />
        <Stat icon={<Brain className="w-4 h-4" />} label="Summary getters" value={num(t.getter_backed)} />
        <Stat icon={<ShieldCheck className="w-4 h-4" />} label="Integration records" value={num(t.integration_records)} />
      </div>
      <Card><CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4" /> Cross-intelligence channels</CardTitle>
        <CardDescription>The 9 governed intelligence channels composed for reachability. Connected ≠ Orchestrated; the engine is never invoked.</CardDescription>
      </CardHeader>
        <CardContent>
          {cross.isLoading ? <Loading /> : cross.isError ? <ErrState /> : (
            <SimpleTable cols={[['name', 'Channel'], ['tier', 'Tier'], ['reachable', 'Reachable', 'bool'], ['flag_state', 'Flag', 'bool'], ['note', 'Note']]} rows={channels} />
          )}
        </CardContent></Card>
    </div>
  );
}

/* ── Services: composition grouped by kind ─────────────────────────────────── */
function ServicesSection() {
  const comp = use2013('/service-composition');
  if (comp.isLoading) return <Loading />;
  if (comp.isError) return <ErrState />;
  const groups = comp.data?.groups ?? [];
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">All integrated services grouped by kind. Each getter-backed service is composed for reachability; non-getter services show reachable "—" (registered by existence). <b>Composition ≠ Duplication.</b></p>
      {groups.map((g: any) => (
        <Card key={g.service_kind}><CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Boxes className="w-4 h-4" /> {g.service_kind} · {num(g.reachable)}/{num(g.of_getters)} getters reachable</CardTitle>
        </CardHeader>
          <CardContent>
            <SimpleTable cols={[['name', 'Service'], ['tier', 'Tier'], ['present', 'Present', 'bool'], ['summary_key', 'Getter'], ['reachable', 'Reachable', 'bool']]} rows={g.services ?? []} />
          </CardContent></Card>
      ))}
    </div>
  );
}

/* ── Registry: persisted registry rows (after POST /discover) ──────────────── */
function RegistrySection() {
  const reg = use2013('/registry');
  if (reg.isLoading) return <Loading />;
  if (reg.isError) return <ErrState />;
  if (reg.data?.present === false) {
    return (
      <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#FFFBEB', color: '#92400E' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        The persisted registry is empty — run <b>POST /discover</b> (flag-ON) to populate it from the curated
        catalog. <i>null ≠ 0; nothing is fabricated.</i>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Persisted registry ({num(reg.data?.count)} rows). <code>lifecycle_state</code> + <code>owner</code> are human-managed and preserved across re-discovery; <code>present</code>/<code>table_count</code>/<code>flag_state</code> are derived and refreshed.</p>
      <SimpleTable cols={[['name', 'Service'], ['service_kind', 'Kind'], ['tier', 'Tier'], ['present', 'Present', 'bool'], ['table_count', 'Rows'], ['flag_state', 'Flag', 'bool'], ['lifecycle_state', 'Lifecycle', 'state'], ['owner', 'Owner']]} rows={reg.data?.registry ?? []} />
    </div>
  );
}

/* ── Interoperability: descriptive contract conformance ────────────────────── */
function InteroperabilitySection() {
  const io = use2013('/interoperability');
  if (io.isLoading) return <Loading />;
  if (io.isError) return <ErrState />;
  const contracts = io.data?.contracts ?? [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">DESCRIPTIVE contract conformance the tier reads the services against — these are standards, <b>NOT runtime-enforced gates</b>. Standardized ≠ Enforced.</p>
      <SimpleTable cols={[['contract', 'Contract'], ['conforming', 'Conforming'], ['of', 'Of'], ['basis', 'Basis'], ['measured', 'Measured', 'bool']]} rows={contracts} />
      <p className="text-xs text-gray-400">{dash(io.data?.contract_note)}</p>
    </div>
  );
}

/* ── Coordination: metadata-level routing + explainability ─────────────────── */
function CoordinationSection() {
  const co = use2013('/coordination');
  if (co.isLoading) return <Loading />;
  if (co.isError) return <ErrState />;
  const routes = co.data?.coordination_routes ?? [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">METADATA-level routing of which existing service answers which enterprise concern domain. It never executes, decides, or approves. <b>Connected ≠ Orchestrated.</b></p>
      <SimpleTable cols={[['concern_domain', 'Concern domain'], ['service', 'Service'], ['service_kind', 'Kind'], ['tier', 'Tier'], ['reachable', 'Reachable', 'bool']]} rows={routes} />
    </div>
  );
}

/* ── Metrics & Workflow: 6 separate scores + validation ────────────────────── */
function MetricsWorkflowSection() {
  const m = use2013('/metrics');
  const v = use2013('/validation');
  if (m.isLoading) return <Loading />;
  if (m.isError) return <ErrState />;
  const scores = m.data?.scores ?? [];
  return (
    <div className="space-y-4">
      <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Six <b>SEPARATE</b> measured scores — there is deliberately <b>NO composite/overall</b>. <code>enterprise_readiness</code>
        is honest-null (deferred): operational readiness needs runtime + outcome evidence. <b>Integrated ≠ Operational.</b>
      </div>
      <Card><CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><WorkflowIcon className="w-4 h-4" /> Enterprise metrics</CardTitle>
      </CardHeader>
        <CardContent>
          <SimpleTable cols={[['metric', 'Metric'], ['axis', 'Axis'], ['score', 'Score', 'pct'], ['note', 'Note']]} rows={scores} />
        </CardContent></Card>
      <Card><CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Network className="w-4 h-4" /> Integration validation</CardTitle>
        <CardDescription>STRUCTURAL only (existence + population + reachability). Not a runtime/operational verdict.</CardDescription>
      </CardHeader>
        <CardContent className="space-y-2">
          {v.isLoading ? <Loading /> : v.isError ? <ErrState /> : (
            <>
              <div className="flex items-center gap-2 text-sm"><span className="text-gray-600">Verdict</span><Tone s={v.data?.verdict} /></div>
              <SimpleTable cols={[['check', 'Check'], ['status', 'Status', 'state'], ['detail', 'Detail']]} rows={v.data?.checks ?? []} />
            </>
          )}
        </CardContent></Card>
    </div>
  );
}
