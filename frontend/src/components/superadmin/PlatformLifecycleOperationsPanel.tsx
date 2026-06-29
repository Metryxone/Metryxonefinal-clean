import { BRAND } from '@/design-system/tokens';
/**
 * MX-700 Phase 1.42 — Platform Lifecycle Operations & SuperAdmin Governance Platform.
 *
 * READ-ONLY SuperAdmin console that COMPOSES the already-shipped lifecycle read APIs:
 *   - 1.37 Foundation     /api/admin/platform-lifecycle
 *   - 1.38 Management      /api/admin/platform-lifecycle-management
 *   - 1.39 Intelligence    /api/admin/platform-lifecycle-intelligence
 *   - 1.40 Evolution       /api/admin/platform-evolution-intelligence
 *   - 1.41 Automation      /api/admin/platform-lifecycle-automation
 *
 * This phase adds NO new data endpoint, NO service, NO migration, NO business logic — it is a
 * presentation layer over existing measured getters. The whole console is gated by the
 * `platformLifecycleOperations` flag (the dashboard probes /feature-flag before mounting) → flag-OFF
 * is byte-identical legacy.
 *
 * HONESTY (Dashboard ≠ Runtime · Visible ≠ Operational · Built ≠ Activated · null ≠ 0):
 *   - Each section independently probes its underlying engine's `/enabled` flag and renders an honest
 *     "engine not enabled" notice when that backend is OFF — it never fabricates zeros or data.
 *   - null/absent renders "—" (missing), never a fake 0. Measured values are shown verbatim; ratios
 *     are not silently re-scaled.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes, RefreshCw, AlertTriangle, Info, ShieldCheck, GitBranch, Layers, Database,
  ListChecks, FileText, Activity, Search, Gauge, Wrench, Tag, ScrollText, Power,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/* ── engine bases (existing 1.37–1.41 read APIs) ──────────────────────────── */
const F = '/api/admin/platform-lifecycle';                 // 1.37 Foundation
const I = '/api/admin/platform-lifecycle-intelligence';    // 1.39 Intelligence
const E = '/api/admin/platform-evolution-intelligence';    // 1.40 Evolution
const A = '/api/admin/platform-lifecycle-automation';      // 1.41 Automation

const ENGINE_LABEL: Record<string, string> = {
  [F]: 'Platform Lifecycle Foundation (1.37)',
  [I]: 'Platform Lifecycle Intelligence (1.39)',
  [E]: 'Platform Evolution Intelligence (1.40)',
  [A]: 'Platform Lifecycle Automation (1.41)',
};

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
  active: { bg: '#DCFCE7', fg: '#166534' }, dormant: { bg: '#FEF3C7', fg: '#92400E' },
  implemented: { bg: '#E0E7FF', fg: '#3730A3' }, released: { bg: '#DBEAFE', fg: '#1E40AF' },
  deprecated: { bg: '#FFEDD5', fg: '#9A3412' }, retired: { bg: '#FEE2E2', fg: '#991B1B' },
  archived: { bg: '#F3F4F6', fg: '#374151' },
  pass: { bg: '#DCFCE7', fg: '#166534' }, attention: { bg: '#FEF3C7', fg: '#92400E' },
  unmeasurable: { bg: '#F3F4F6', fg: '#6B7280' }, measured: { bg: '#DCFCE7', fg: '#166534' },
  unmeasured: { bg: '#F3F4F6', fg: '#6B7280' },
};
function Tone({ s }: { s?: string | null }) {
  if (!s) return <span style={{ color: '#9CA3AF' }}>—</span>;
  const t = STATE_TONE[s] ?? { bg: '#F3F4F6', fg: '#374151' };
  return <Badge style={{ background: t.bg, color: t.fg, border: 'none' }}>{s}</Badge>;
}

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
      <span><b>{ENGINE_LABEL[base]}</b> is not enabled. This section composes that engine — turning the
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

function BreakdownCard({ title, icon, rows, keyName, valName = 'n' }: { title: string; icon?: React.ReactNode; rows?: any[]; keyName: string; valName?: string }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {(!rows || rows.length === 0) && <div className="text-xs text-gray-400">— no data</div>}
        {(rows ?? []).map((r, i) => (
          <div key={`${r[keyName]}-${i}`} className="text-sm flex justify-between">
            <span className="text-gray-600">{dash(r[keyName])}</span><b>{num(r[valName])}</b>
          </div>
        ))}
      </CardContent></Card>
  );
}

function ChecksGrid({ checks, title, icon }: { checks?: Record<string, any> | null; title: string; icon?: React.ReactNode }) {
  const entries = checks ? Object.entries(checks).filter(([, v]) => typeof v === 'number' || v == null) : [];
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {entries.length === 0 && <div className="text-xs text-gray-400">— no data</div>}
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm flex justify-between rounded border p-3">
            <span className="text-gray-600">{k.replace(/_/g, ' ')}</span>
            <b style={{ color: typeof v === 'number' && v > 0 ? '#B45309' : '#166534' }}>{num(v as number)}</b>
          </div>
        ))}
      </CardContent></Card>
  );
}

/** Measured-area renderer for {key:{measured_value,issues,status,basis}} (automation/governance). */
function MeasuredAreas({ areas, title, icon, passRate }: { areas?: Record<string, any> | null; title: string; icon?: React.ReactNode; passRate?: number | null }) {
  const entries = areas ? Object.entries(areas) : [];
  return (
    <Card><CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle>
      {passRate !== undefined && <CardDescription>Pass rate: <b>{num(passRate)}</b></CardDescription>}
    </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && <div className="text-xs text-gray-400">— no data</div>}
        {entries.map(([k, v]: [string, any]) => (
          <div key={k} className="rounded border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">{k.replace(/_/g, ' ')}</span>
              <Tone s={v?.status} />
            </div>
            <div className="text-xs text-gray-500 mt-1 flex gap-4 flex-wrap">
              <span>value: <b>{num(v?.measured_value)}</b></span>
              <span>issues: <b>{num(v?.issues)}</b></span>
              {v?.basis && <span>basis: {dash(v.basis)}</span>}
            </div>
          </div>
        ))}
      </CardContent></Card>
  );
}

/** Generic recursive key/value renderer for loosely-typed nested objects (audit, validation). */
function RecursiveKV({ data, title, icon }: { data?: Record<string, any> | null; title: string; icon?: React.ReactNode }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(!data || Object.keys(data).length === 0) && <div className="text-xs text-gray-400">— no data</div>}
        {data && Object.entries(data).map(([k, v]) => <KVNode key={k} k={k} v={v} depth={0} />)}
      </CardContent></Card>
  );
}
function KVNode({ k, v, depth }: { k: string; v: any; depth: number }) {
  const label = k.replace(/_/g, ' ');
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
  else val = dash(v);
  return (
    <div className="text-sm flex justify-between gap-4" style={{ marginLeft: depth * 12 }}>
      <span className="text-gray-600">{label}</span><b className="text-right">{val}</b>
    </div>
  );
}

/** Read-only data table from a react-query result with { rows | items } envelope. */
function DataTable({ q, cols, rowsKey = 'rows', emptyNote }: { q: any; cols: Array<[string, string, 'state'?]>; rowsKey?: string; emptyNote?: string }) {
  if (q.isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (q.isError) return <div className="text-sm text-gray-400">Unable to load.</div>;
  const rows: any[] = q.data?.[rowsKey] ?? [];
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
type TabId = 'lifecycle' | 'capability' | 'repository' | 'tech-debt' | 'version' | 'governance' | 'observability' | 'admin';

export default function PlatformLifecycleOperationsPanel() {
  const [tab, setTab] = React.useState<TabId>('lifecycle');

  const fOn = useEngineEnabled(F).data?.enabled === true;
  const iOn = useEngineEnabled(I).data?.enabled === true;
  const eOn = useEngineEnabled(E).data?.enabled === true;
  const aOn = useEngineEnabled(A).data?.enabled === true;
  const anyOn = fOn || iOn || eOn || aOn;

  const TABS: Array<[TabId, string]> = [
    ['lifecycle', 'Lifecycle'], ['capability', 'Capability'], ['repository', 'Repository'],
    ['tech-debt', 'Technical Debt'], ['version', 'Version'], ['governance', 'Governance'],
    ['observability', 'Observability'], ['admin', 'Administration'],
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.ink }}>
          <Boxes className="w-6 h-6" /> Platform Lifecycle Operations
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          A unified, read-only operations &amp; governance console composing the existing platform-lifecycle
          intelligence engines (1.37–1.41). Each section reflects the live state of its underlying engine —
          sections whose engine flag is OFF show an honest notice, never fabricated data.
        </p>
      </div>

      {!anyOn && (
        <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#FFFBEB', color: '#92400E' }}>
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          None of the underlying lifecycle engines (1.37–1.41) are currently enabled. This console is exposed,
          but it has no engine data to compose yet — enable the engine flags to populate the sections below.
        </div>
      )}

      <div className="flex gap-1 flex-wrap border-b">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? 'border-current' : 'border-transparent text-gray-500'}`}
            style={tab === id ? { color: BRAND.primary } : {}}>{label}</button>
        ))}
      </div>

      {tab === 'lifecycle' && <LifecycleSection fOn={fOn} iOn={iOn} />}
      {tab === 'capability' && <CapabilitySection fOn={fOn} iOn={iOn} />}
      {tab === 'repository' && <RepositorySection fOn={fOn} iOn={iOn} eOn={eOn} />}
      {tab === 'tech-debt' && <TechDebtSection eOn={eOn} />}
      {tab === 'version' && <VersionSection eOn={eOn} />}
      {tab === 'governance' && <GovernanceSection aOn={aOn} />}
      {tab === 'observability' && <ObservabilitySection iOn={iOn} eOn={eOn} aOn={aOn} />}
      {tab === 'admin' && <AdministrationSection fOn={fOn} eOn={eOn} />}
    </div>
  );
}

/* ── Lifecycle (Part 2): 1.37 /summary + 1.39 /metrics,/health ────────────── */
function LifecycleSection({ fOn, iOn }: { fOn: boolean; iOn: boolean }) {
  const summary = useQuery<any>({ queryKey: [F, 'summary'], queryFn: () => getJSON(`${F}/summary`), enabled: fOn });
  const metrics = useQuery<any>({ queryKey: [I, 'metrics'], queryFn: () => getJSON(`${I}/metrics`), enabled: iOn });
  const health = useQuery<any>({ queryKey: [I, 'health'], queryFn: () => getJSON(`${I}/health`), enabled: iOn });
  const c = summary.data?.counts; const m = metrics.data?.metrics; const h = health.data?.health;
  return (
    <div className="space-y-4">
      {!fOn && <EngineOff base={F} />}
      {fOn && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<Layers className="w-4 h-4" />} label="Registry entities" value={num(c?.registry)} />
            <Stat icon={<Boxes className="w-4 h-4" />} label="Capabilities" value={num(c?.capabilities)} />
            <Stat icon={<GitBranch className="w-4 h-4" />} label="Relationships" value={num(c?.relationships)} />
            <Stat icon={<ListChecks className="w-4 h-4" />} label="State history" value={num(c?.history)} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <BreakdownCard title="By lifecycle state" icon={<ShieldCheck className="w-4 h-4" />} rows={summary.data?.registry_by_state} keyName="lifecycle_state" />
            <BreakdownCard title="By entity type" icon={<Database className="w-4 h-4" />} rows={summary.data?.registry_by_type} keyName="entity_type" />
            <ChecksGrid title="Missing metadata (honest gaps)" icon={<AlertTriangle className="w-4 h-4" />} checks={c ? {
              missing_owners: c.missing_owners, missing_documentation: c.missing_documentation,
              missing_lifecycle_states: c.missing_lifecycle_states, duplicate_capability_ids: c.duplicate_capability_ids,
            } : null} />
          </div>
        </>
      )}
      {!iOn && <EngineOff base={I} />}
      {iOn && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4" /> Lifecycle metrics</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <KV label="active" v={m?.active_total} /><KV label="deprecated" v={m?.deprecated_total} />
              <KV label="retired" v={m?.retired_total} /><KV label="adoption rate" v={m?.adoption_rate} />
            </CardContent></Card>
          <ChecksGrid title="Lifecycle health (measured ⟂ scores)" icon={<Activity className="w-4 h-4" />} checks={h ? {
            completeness: h.completeness, consistency: h.consistency, coverage: h.coverage,
            compliance: h.compliance, readiness: h.readiness, stability: h.stability,
          } : null} />
        </div>
      )}
    </div>
  );
}
function KV({ label, v }: { label: string; v?: number | null }) {
  return <div className="text-sm flex justify-between rounded border p-2"><span className="text-gray-600">{label}</span><b>{num(v)}</b></div>;
}

/* ── Capability (Part 3): 1.37 catalog/ownership/relationships + 1.39 compat ─ */
function CapabilitySection({ fOn, iOn }: { fOn: boolean; iOn: boolean }) {
  const [sub, setSub] = React.useState('catalog');
  const catalog = useQuery<any>({ queryKey: [F, 'capabilities'], queryFn: () => getJSON(`${F}/capabilities?limit=1000`), enabled: fOn && sub === 'catalog' });
  const ownership = useQuery<any>({ queryKey: [F, 'ownership'], queryFn: () => getJSON(`${F}/ownership?limit=2000`), enabled: fOn && sub === 'ownership' });
  const rels = useQuery<any>({ queryKey: [F, 'relationships'], queryFn: () => getJSON(`${F}/relationships?limit=2000`), enabled: fOn && sub === 'dependencies' });
  const compat = useQuery<any>({ queryKey: [I, 'compatibility'], queryFn: () => getJSON(`${I}/compatibility`), enabled: iOn && sub === 'compatibility' });
  return (
    <div className="space-y-4">
      <SubTabs active={sub} onChange={setSub} tabs={[['catalog', 'Catalog'], ['ownership', 'Ownership'], ['dependencies', 'Dependencies'], ['compatibility', 'Compatibility']]} />
      {sub === 'catalog' && (!fOn ? <EngineOff base={F} /> : <DataTable q={catalog} cols={[
        ['canonical_name', 'Capability'], ['source_kind', 'Source'], ['business_domain', 'Domain'],
        ['activation_status', 'Activation', 'state'], ['lifecycle_state', 'State', 'state'], ['repository_reference', 'Repository'],
      ]} />)}
      {sub === 'ownership' && (!fOn ? <EngineOff base={F} /> : <>
        <p className="text-xs text-gray-500">Owners shown “—” are <b>unassigned</b> honest gaps — never fabricated.</p>
        <DataTable q={ownership} cols={[
          ['capability_key', 'Capability'], ['business_owner', 'Business owner'], ['engineering_owner', 'Engineering owner'],
          ['architect_owner', 'Architect owner'], ['repository_location', 'Repository'], ['documentation_location', 'Docs'],
        ]} />
      </>)}
      {sub === 'dependencies' && (!fOn ? <EngineOff base={F} /> : <DataTable q={rels} cols={[
        ['from_uid', 'From'], ['relationship_type', 'Relationship'], ['to_uid', 'To'], ['evidence', 'Evidence'],
      ]} />)}
      {sub === 'compatibility' && (!iOn ? <EngineOff base={I} /> : (
        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Backward compatibility</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <KV label="breaking" v={compat.data?.compatibility?.backward?.breaking_count} />
              <KV label="compatible" v={compat.data?.compatibility?.backward?.compatible_count} />
              <KV label="ratio" v={compat.data?.compatibility?.backward?.compatibility_ratio} />
            </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Migration ordering</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <KV label="ordering regressions" v={compat.data?.compatibility?.migration?.ordering_regressions} />
              <KV label="version gaps" v={compat.data?.compatibility?.migration?.version_gaps} />
              <KV label="monotonic ratio" v={compat.data?.compatibility?.migration?.monotonic_ratio} />
            </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Schema stability</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <KV label="drift indicators" v={compat.data?.compatibility?.schema?.drift_indicators} />
              <KV label="stability score" v={compat.data?.compatibility?.schema?.stability_score} />
            </CardContent></Card>
        </div>
      ))}
    </div>
  );
}

/* ── Repository (Part 4): 1.37 /health + 1.39 /repository-health + 1.40 /evolution ─ */
function RepositorySection({ fOn, iOn, eOn }: { fOn: boolean; iOn: boolean; eOn: boolean }) {
  const fHealth = useQuery<any>({ queryKey: [F, 'health'], queryFn: () => getJSON(`${F}/health`), enabled: fOn });
  const repoHealth = useQuery<any>({ queryKey: [I, 'repository-health'], queryFn: () => getJSON(`${I}/repository-health`), enabled: iOn });
  const evolution = useQuery<any>({ queryKey: [E, 'evolution'], queryFn: () => getJSON(`${E}/evolution`), enabled: eOn });
  return (
    <div className="space-y-4">
      {!fOn ? <EngineOff base={F} /> : <>
        <ChecksGrid title="Foundation health checks" icon={<ShieldCheck className="w-4 h-4" />} checks={fHealth.data?.checks} />
        {fHealth.data?.broken_reference_sample?.length > 0 && (
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Broken reference sample</CardTitle></CardHeader>
            <CardContent className="text-xs font-mono space-y-1">
              {fHealth.data.broken_reference_sample.map((s: any, i: number) => <div key={i}>{dash(s.uid)} → {dash(s.ref)}</div>)}
            </CardContent></Card>
        )}
      </>}
      {!iOn ? <EngineOff base={I} /> : <>
        <ChecksGrid title="Repository health intelligence" icon={<Database className="w-4 h-4" />} checks={repoHealth.data?.checks} />
        {repoHealth.data?.large_file_sample?.length > 0 && (
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Large files</CardTitle></CardHeader>
            <CardContent className="text-xs font-mono space-y-1">
              {repoHealth.data.large_file_sample.map((s: any, i: number) => <div key={i}>{dash(s.file)} — {num(s.lines)} lines</div>)}
            </CardContent></Card>
        )}
      </>}
      {!eOn ? <EngineOff base={E} /> : (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Repository evolution</CardTitle>
          {evolution.data?.note && <CardDescription>{evolution.data.note}</CardDescription>}</CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KV label="total evolution events" v={evolution.data?.total_evolution_events} />
              <KV label="migration velocity" v={evolution.data?.migration_velocity} />
            </div>
            <BreakdownCard title="By evolution type" rows={evolution.data?.by_type} keyName="evolution_type" />
          </CardContent></Card>
      )}
    </div>
  );
}

/* ── Technical Debt (Part 5): 1.40 /technical-debt ────────────────────────── */
function TechDebtSection({ eOn }: { eOn: boolean }) {
  const td = useQuery<any>({ queryKey: [E, 'technical-debt'], queryFn: () => getJSON(`${E}/technical-debt`), enabled: eOn });
  if (!eOn) return <EngineOff base={E} />;
  const reg = td.data?.registry; const mk = td.data?.repository_markers;
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4" /> Tracked debt registry</CardTitle>
          <CardDescription>Markers ≠ tracked debt ≠ bugs. {reg?.table_present ? '' : 'Registry table not present yet.'}</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            <KV label="total items" v={reg?.total_items} /><KV label="resolved items" v={reg?.resolved_items} />
            <KV label="resolution rate" v={reg?.resolution_rate} />
            <BreakdownCard title="By status" rows={reg?.by_status} keyName="status" />
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4" /> Repository markers (measured)</CardTitle>
          <CardDescription>{num(mk?.files_scanned)} files scanned · {num(mk?.total)} markers</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <KV label="TODO" v={mk?.counts?.TODO} /><KV label="FIXME" v={mk?.counts?.FIXME} />
            <KV label="HACK" v={mk?.counts?.HACK} /><KV label="XXX" v={mk?.counts?.XXX} />
          </CardContent></Card>
      </div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Debt items</CardTitle></CardHeader>
        <CardContent>
          <DataTable q={{ data: td.data?.registry_items, isLoading: td.isLoading, isError: td.isError }} cols={[
            ['title', 'Title'], ['debt_category', 'Category'], ['priority', 'Priority'], ['severity', 'Severity'],
            ['status', 'Status', 'state'], ['debt_owner', 'Owner'], ['repository_reference', 'Repository'],
          ]} emptyNote="— no tracked debt items (honest: empty registry, not zero debt)" />
        </CardContent></Card>
    </div>
  );
}

/* ── Version (Part 6): 1.40 /version,/deprecation,/retirement ──────────────── */
function VersionSection({ eOn }: { eOn: boolean }) {
  const [sub, setSub] = React.useState('version');
  const version = useQuery<any>({ queryKey: [E, 'version'], queryFn: () => getJSON(`${E}/version`), enabled: eOn && sub === 'version' });
  const dep = useQuery<any>({ queryKey: [E, 'deprecation'], queryFn: () => getJSON(`${E}/deprecation`), enabled: eOn && sub === 'deprecation' });
  const ret = useQuery<any>({ queryKey: [E, 'retirement'], queryFn: () => getJSON(`${E}/retirement`), enabled: eOn && sub === 'retirement' });
  if (!eOn) return <EngineOff base={E} />;
  return (
    <div className="space-y-4">
      <SubTabs active={sub} onChange={setSub} tabs={[['version', 'Version'], ['deprecation', 'Deprecation'], ['retirement', 'Retirement']]} />
      {sub === 'version' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Version coverage</CardTitle>
            {version.data?.note && <CardDescription>{version.data.note}</CardDescription>}</CardHeader>
            <CardContent className="space-y-1">
              <KV label="version ledger records" v={version.data?.version_ledger_records} />
              <KV label="capability version coverage" v={version.data?.coverage?.capability_version_coverage} />
              <KV label="migration version coverage" v={version.data?.coverage?.migration_version_coverage} />
              <KV label="capabilities versioned" v={version.data?.counts?.capabilities_versioned} />
              <KV label="migrations versioned" v={version.data?.counts?.migrations_versioned} />
            </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Repository (git)</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-sm flex justify-between"><span className="text-gray-600">git available</span><b>{version.data?.git?.available ? 'yes' : 'no'}</b></div>
              <div className="text-sm flex justify-between"><span className="text-gray-600">last commit</span><b>{dash(version.data?.git?.last_commit_at)}</b></div>
              {version.data?.git?.note && <p className="text-xs text-gray-400">{version.data.git.note}</p>}
            </CardContent></Card>
        </div>
      )}
      {sub === 'deprecation' && <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="total" value={num(dep.data?.total_deprecations)} />
          <Stat label="with replacement" value={num(dep.data?.with_replacement)} />
          <Stat label="with migration target" value={num(dep.data?.with_migration_target)} />
        </div>
        <DataTable q={dep} rowsKey="items" cols={[
          ['lifecycle_uid', 'Lifecycle'], ['deprecation_status', 'Status', 'state'], ['replacement_reference', 'Replacement'], ['migration_target', 'Migration target'],
        ]} emptyNote="— no deprecations (honest empty, not fabricated)" />
      </>}
      {sub === 'retirement' && <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="total" value={num(ret.data?.total_retirements)} />
          <Stat label="approved" value={num(ret.data?.approved)} />
          <Stat label="archived" value={num(ret.data?.archived)} />
          <Stat label="knowledge preserved" value={num(ret.data?.knowledge_preserved)} />
        </div>
        <DataTable q={ret} rowsKey="items" cols={[
          ['lifecycle_uid', 'Lifecycle'], ['retirement_status', 'Status', 'state'], ['approval_status', 'Approval'], ['archive_reference', 'Archive'], ['knowledge_preservation', 'Knowledge kept'],
        ]} emptyNote="— no retirements (honest empty, not fabricated)" />
      </>}
    </div>
  );
}

/* ── Governance (Part 7): 1.41 compliance/policies/quality-gates/validation/automation/governance/audit ─ */
function GovernanceSection({ aOn }: { aOn: boolean }) {
  const [sub, setSub] = React.useState('compliance');
  const compliance = useQuery<any>({ queryKey: [A, 'compliance'], queryFn: () => getJSON(`${A}/compliance`), enabled: aOn && sub === 'compliance' });
  const policies = useQuery<any>({ queryKey: [A, 'policies'], queryFn: () => getJSON(`${A}/policies`), enabled: aOn && sub === 'policies' });
  const gates = useQuery<any>({ queryKey: [A, 'quality-gates'], queryFn: () => getJSON(`${A}/quality-gates`), enabled: aOn && sub === 'quality-gates' });
  const validation = useQuery<any>({ queryKey: [A, 'continuous-validation'], queryFn: () => getJSON(`${A}/continuous-validation`), enabled: aOn && sub === 'validation' });
  const automation = useQuery<any>({ queryKey: [A, 'automation'], queryFn: () => getJSON(`${A}/automation`), enabled: aOn && sub === 'automation' });
  const governance = useQuery<any>({ queryKey: [A, 'governance'], queryFn: () => getJSON(`${A}/governance`), enabled: aOn && sub === 'governance' });
  const audit = useQuery<any>({ queryKey: [A, 'audit'], queryFn: () => getJSON(`${A}/audit`), enabled: aOn && sub === 'audit' });
  if (!aOn) return <EngineOff base={A} />;
  return (
    <div className="space-y-4">
      <SubTabs active={sub} onChange={setSub} tabs={[
        ['compliance', 'Compliance'], ['policies', 'Policies'], ['quality-gates', 'Quality Gates'],
        ['validation', 'Continuous Validation'], ['automation', 'Automation'], ['governance', 'Governance'], ['audit', 'Audit'],
      ]} />
      {sub === 'compliance' && <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="policies" value={num(compliance.data?.totals?.policies)} />
          <Stat label="evaluated" value={num(compliance.data?.totals?.evaluated)} />
          <Stat label="blocking violations" value={num(compliance.data?.totals?.blocking_violations)} />
          <Stat label="overall compliance" value={num(compliance.data?.overall_compliance)} />
        </div>
        <DataTable q={compliance} rowsKey="policies" cols={[
          ['title', 'Policy'], ['policy_domain', 'Domain'], ['severity', 'Severity'], ['kind', 'Kind'],
          ['evaluated', 'Evaluated'], ['violations', 'Violations'], ['compliance_ratio', 'Ratio'],
        ]} />
      </>}
      {sub === 'policies' && <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="built-in policies" value={num(policies.data?.builtin_count)} />
          <Stat label="custom policies" value={num(policies.data?.custom_count)} />
        </div>
        <DataTable q={{ data: { rows: policies.data?.builtin }, isLoading: policies.isLoading, isError: policies.isError }} cols={[
          ['title', 'Built-in policy'], ['policy_domain', 'Domain'], ['severity', 'Severity'], ['scope', 'Scope'],
        ]} />
        <DataTable q={{ data: { rows: policies.data?.custom }, isLoading: policies.isLoading, isError: policies.isError }} cols={[
          ['title', 'Custom policy'], ['policy_domain', 'Domain'], ['rule_kind', 'Rule'], ['severity', 'Severity'], ['enabled', 'Enabled'],
        ]} emptyNote="— no custom policies registered" />
      </>}
      {sub === 'quality-gates' && (
        <div className="grid md:grid-cols-3 gap-4">
          {gates.data?.gates && Object.entries(gates.data.gates).map(([k, g]: [string, any]) => (
            <Card key={k}><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between gap-2">
              <span>{k.replace(/_/g, ' ')}</span><Tone s={g?.status} /></CardTitle>
              <CardDescription>score: {num(g?.score)}</CardDescription></CardHeader>
              <CardContent className="space-y-1">
                {g?.checks && Object.keys(g.checks).map((ck) => <div key={ck} className="text-xs text-gray-500">{ck.replace(/_/g, ' ')}</div>)}
              </CardContent></Card>
          ))}
          {!gates.data?.gates && <div className="text-sm text-gray-400">— no data</div>}
        </div>
      )}
      {sub === 'validation' && <RecursiveKV title={`Continuous validation (overall: ${num(validation.data?.overall_success_rate)})`} icon={<ListChecks className="w-4 h-4" />} data={validation.data?.validation_summary} />}
      {sub === 'automation' && <MeasuredAreas title="Lifecycle automation checks" icon={<RefreshCw className="w-4 h-4" />} areas={automation.data?.checks} passRate={automation.data?.pass_rate} />}
      {sub === 'governance' && <MeasuredAreas title="Continuous governance areas" icon={<ShieldCheck className="w-4 h-4" />} areas={governance.data?.areas} passRate={governance.data?.pass_rate} />}
      {sub === 'audit' && <RecursiveKV title="Governance audit" icon={<ScrollText className="w-4 h-4" />} data={audit.data?.audit} />}
    </div>
  );
}

/* ── Observability (Part 8): 1.39 + 1.40 + 1.41 /metrics + 1.39 /compatibility ─ */
function ObservabilitySection({ iOn, eOn, aOn }: { iOn: boolean; eOn: boolean; aOn: boolean }) {
  const iMetrics = useQuery<any>({ queryKey: [I, 'metrics'], queryFn: () => getJSON(`${I}/metrics`), enabled: iOn });
  const eMetrics = useQuery<any>({ queryKey: [E, 'metrics'], queryFn: () => getJSON(`${E}/metrics`), enabled: eOn });
  const aMetrics = useQuery<any>({ queryKey: [A, 'metrics'], queryFn: () => getJSON(`${A}/metrics`), enabled: aOn });
  const im = iMetrics.data?.metrics; const em = eMetrics.data?.evolution_metrics; const am = aMetrics.data?.automation_metrics;
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Each engine reports its own SEPARATE measured scores — these are deliberately not composited into one "overall".</p>
      {!iOn ? <EngineOff base={I} /> : (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4" /> Lifecycle metrics (1.39)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KV label="registry total" v={im?.registry_total} /><KV label="capability total" v={im?.capability_total} />
            <KV label="active" v={im?.active_total} /><KV label="deprecated" v={im?.deprecated_total} />
            <KV label="retired" v={im?.retired_total} /><KV label="adoption rate" v={im?.adoption_rate} />
          </CardContent></Card>
      )}
      {!eOn ? <EngineOff base={E} /> : (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Evolution metrics (1.40)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KV label="lifecycle entities" v={em?.total_lifecycle_entities} /><KV label="evolution records" v={em?.total_evolution_records} />
            <KV label="evolution velocity" v={em?.evolution_velocity} />
          </CardContent></Card>
      )}
      {!aOn ? <EngineOff base={A} /> : (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Automation metrics (1.41)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KV label="checks evaluated" v={am?.total_checks_evaluated} /><KV label="pass rate" v={am?.pass_rate} />
            <KV label="automation coverage" v={am?.automation_coverage} /><KV label="compliance score" v={am?.compliance_score} />
            <KV label="governance score" v={am?.governance_score} />
          </CardContent></Card>
      )}
    </div>
  );
}

/* ── Administration (Part 9): client-side search over already-fetched datasets ─ */
function AdministrationSection({ fOn, eOn }: { fOn: boolean; eOn: boolean }) {
  const [term, setTerm] = React.useState('');
  const capabilities = useQuery<any>({ queryKey: [F, 'capabilities'], queryFn: () => getJSON(`${F}/capabilities?limit=1000`), enabled: fOn });
  const registry = useQuery<any>({ queryKey: [F, 'registry'], queryFn: () => getJSON(`${F}/registry?limit=2000`), enabled: fOn });
  const rels = useQuery<any>({ queryKey: [F, 'relationships'], queryFn: () => getJSON(`${F}/relationships?limit=2000`), enabled: fOn });
  const td = useQuery<any>({ queryKey: [E, 'technical-debt'], queryFn: () => getJSON(`${E}/technical-debt`), enabled: eOn });
  const dep = useQuery<any>({ queryKey: [E, 'deprecation'], queryFn: () => getJSON(`${E}/deprecation`), enabled: eOn });
  const ret = useQuery<any>({ queryKey: [E, 'retirement'], queryFn: () => getJSON(`${E}/retirement`), enabled: eOn });

  const groups: Array<{ label: string; rows: any[]; fields: string[] }> = [
    { label: 'Capabilities', rows: capabilities.data?.rows ?? [], fields: ['canonical_name', 'business_domain', 'lifecycle_state', 'repository_reference'] },
    { label: 'Lifecycle registry', rows: registry.data?.rows ?? [], fields: ['entity_identifier', 'entity_type', 'lifecycle_state', 'feature_flag'] },
    { label: 'Dependencies', rows: rels.data?.rows ?? [], fields: ['from_uid', 'relationship_type', 'to_uid'] },
    { label: 'Technical debt', rows: td.data?.registry_items?.rows ?? [], fields: ['title', 'debt_category', 'priority', 'status'] },
    { label: 'Deprecations', rows: dep.data?.items ?? [], fields: ['lifecycle_uid', 'deprecation_status', 'replacement_reference'] },
    { label: 'Retirements', rows: ret.data?.items ?? [], fields: ['lifecycle_uid', 'retirement_status', 'approval_status'] },
  ];
  const q = term.trim().toLowerCase();
  const filtered = groups.map((g) => ({
    ...g,
    matches: q.length < 2 ? [] : g.rows.filter((r) => g.fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))),
  }));
  const total = filtered.reduce((s, g) => s + g.matches.length, 0);

  return (
    <div className="space-y-4">
      {!fOn && !eOn && <><EngineOff base={F} /><EngineOff base={E} /></>}
      <div className="flex items-center gap-2 max-w-lg">
        <Search className="w-4 h-4 text-gray-400" />
        <Input placeholder="Search lifecycle, capabilities, dependencies, debt, versions…" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {q.length >= 2 && <p className="text-xs text-gray-500">{num(total)} matches across {filtered.filter((g) => g.matches.length > 0).length} categories.</p>}
      {q.length < 2 && <p className="text-xs text-gray-400">Type at least 2 characters to search across the loaded lifecycle datasets.</p>}
      {filtered.filter((g) => g.matches.length > 0).map((g) => (
        <Card key={g.label}><CardHeader className="pb-2"><CardTitle className="text-sm">{g.label} ({num(g.matches.length)})</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-[40vh] overflow-auto">
            {g.matches.map((r, i) => (
              <div key={i} className="text-xs border rounded p-2 flex gap-3 flex-wrap">
                {g.fields.map((f) => <span key={f} className="text-gray-600"><b className="text-gray-400">{f}:</b> {dash(String(r[f] ?? ''))}</span>)}
              </div>
            ))}
          </CardContent></Card>
      ))}
    </div>
  );
}
