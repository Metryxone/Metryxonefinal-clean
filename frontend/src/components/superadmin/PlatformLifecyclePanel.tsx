import { BRAND } from '@/design-system/tokens';
/**
 * MX-700 Phase 1.37 — Platform Lifecycle Foundation (READ-ONLY founder console, super-admin).
 *
 * Surfaces the missing platform-lifecycle foundations implemented in 1.37:
 *   - Capability Catalog (discovered from the live repository, never duplicated)
 *   - Platform Lifecycle Registry + Lifecycle Metadata
 *   - Capability Ownership (owners shown "—" when unassigned — honest, never fabricated)
 *   - Lifecycle State Engine (append-only history)
 *   - Lifecycle Relationships (measured edges)
 *   - Validation + Repository Health (real gaps, never invented)
 *
 * The tab is only rendered when the `platformLifecycleFoundation` flag is ON (the dashboard
 * probes /api/admin/platform-lifecycle/feature-flag before mounting) → flag-OFF byte-identical.
 *
 * HONESTY: null renders "—" (missing), never a fake 0. Discovery records only measured repo
 * facts; activation reflects live flag runtime (built ≠ activated).
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes, RefreshCw, AlertTriangle, Info, ShieldCheck, GitBranch,
  Layers, Database, ListChecks, FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BASE = '/api/admin/platform-lifecycle';

function num(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}
function dash(s?: string | null) { return s == null || s === '' ? '—' : s; }

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const STATE_TONE: Record<string, { bg: string; fg: string }> = {
  active:      { bg: '#DCFCE7', fg: '#166534' },
  dormant:     { bg: '#FEF3C7', fg: '#92400E' },
  implemented: { bg: '#E0E7FF', fg: '#3730A3' },
  released:    { bg: '#DBEAFE', fg: '#1E40AF' },
  deprecated:  { bg: '#FFEDD5', fg: '#9A3412' },
  retired:     { bg: '#FEE2E2', fg: '#991B1B' },
  archived:    { bg: '#F3F4F6', fg: '#374151' },
};
function StateBadge({ s }: { s?: string | null }) {
  if (!s) return <span style={{ color: '#9CA3AF' }}>—</span>;
  const t = STATE_TONE[s] ?? { bg: '#F3F4F6', fg: '#374151' };
  return <Badge style={{ background: t.bg, color: t.fg, border: 'none' }}>{s}</Badge>;
}

export default function PlatformLifecyclePanel() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<'overview' | 'catalog' | 'registry' | 'ownership' | 'relationships' | 'validation' | 'health'>('overview');

  const summary = useQuery<any>({ queryKey: [`${BASE}/summary`], queryFn: () => getJSON(`${BASE}/summary`) });
  const validation = useQuery<any>({ queryKey: [`${BASE}/validation`], queryFn: () => getJSON(`${BASE}/validation`), enabled: tab === 'validation' || tab === 'overview' });
  const health = useQuery<any>({ queryKey: [`${BASE}/health`], queryFn: () => getJSON(`${BASE}/health`), enabled: tab === 'health' });
  const catalog = useQuery<any>({ queryKey: [`${BASE}/capabilities`], queryFn: () => getJSON(`${BASE}/capabilities?limit=1000`), enabled: tab === 'catalog' });
  const registry = useQuery<any>({ queryKey: [`${BASE}/registry`], queryFn: () => getJSON(`${BASE}/registry?limit=2000`), enabled: tab === 'registry' });
  const ownership = useQuery<any>({ queryKey: [`${BASE}/ownership`], queryFn: () => getJSON(`${BASE}/ownership?limit=2000`), enabled: tab === 'ownership' });
  const relationships = useQuery<any>({ queryKey: [`${BASE}/relationships`], queryFn: () => getJSON(`${BASE}/relationships?limit=2000`), enabled: tab === 'relationships' });

  const discover = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/discover`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE] }); qc.invalidateQueries(); },
  });

  const sum = summary.data;
  const discovered = sum?.discovered;

  const TABS: Array<[typeof tab, string]> = [
    ['overview', 'Overview'], ['catalog', 'Capability Catalog'], ['registry', 'Lifecycle Registry'],
    ['ownership', 'Ownership'], ['relationships', 'Relationships'], ['validation', 'Validation'], ['health', 'Repository Health'],
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.ink }}>
            <Boxes className="w-6 h-6" /> Platform Lifecycle Foundation
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Capability catalog, lifecycle registry, ownership, state engine and relationships — a read-only index over the
            repository's single source of truth. Owners/docs shown “—” are honest gaps, never fabricated.
          </p>
        </div>
        <Button onClick={() => discover.mutate()} disabled={discover.isPending} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${discover.isPending ? 'animate-spin' : ''}`} />
          {discover.isPending ? 'Discovering…' : 'Run Repository Discovery'}
        </Button>
      </div>

      {discover.isSuccess && (
        <div className="text-xs rounded-md p-3" style={{ background: '#ECFDF5', color: '#065F46' }}>
          Discovery complete — {num(discover.data?.counts?.registry_total)} registry entities,
          {' '}{num(discover.data?.counts?.flags)} flags, {num(discover.data?.counts?.modules)} route modules,
          {' '}{num(discover.data?.counts?.services)} services, {num(discover.data?.counts?.migrations)} migrations,
          {' '}{num(discover.data?.counts?.docs)} docs, {num(discover.data?.counts?.relationships)} relationships.
        </div>
      )}

      {!discovered && summary.isSuccess && (
        <div className="text-sm rounded-md p-4 flex items-start gap-2" style={{ background: '#FFFBEB', color: '#92400E' }}>
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          The foundation is installed but discovery has not run yet. Click <b>Run Repository Discovery</b> to index the live repository.
        </div>
      )}

      <div className="flex gap-1 flex-wrap border-b">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? 'border-current' : 'border-transparent text-gray-500'}`}
            style={tab === id ? { color: BRAND.primary } : {}}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<Layers className="w-4 h-4" />} label="Registry entities" value={num(sum?.totals?.registry)} />
            <Stat icon={<Boxes className="w-4 h-4" />} label="Catalog capabilities" value={num(sum?.totals?.catalog)} />
            <Stat icon={<GitBranch className="w-4 h-4" />} label="Relationships" value={num(sum?.totals?.relationships)} />
            <Stat icon={<ListChecks className="w-4 h-4" />} label="State transitions" value={num(sum?.totals?.state_transitions)} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <BreakdownCard title="By entity type" icon={<Database className="w-4 h-4" />} rows={sum?.by_entity_type} keyName="entity_type" />
            <BreakdownCard title="By lifecycle state" icon={<ShieldCheck className="w-4 h-4" />} rows={sum?.by_lifecycle_state} keyName="lifecycle_state" />
            <BreakdownCard title="By activation" icon={<RefreshCw className="w-4 h-4" />} rows={sum?.by_activation} keyName="activation_state" />
          </div>
          {validation.data?.ready && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Validation snapshot</CardTitle>
                <CardDescription>{validation.data?.note}</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(validation.data.checks).map(([k, v]) => (
                  <div key={k} className="text-sm flex justify-between rounded border p-2">
                    <span className="text-gray-600">{k.replace(/_/g, ' ')}</span>
                    <b>{num(v as number)}</b>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <p className="text-xs text-gray-400">Lifecycle states: {(sum?.states ?? []).join(' → ')}</p>
        </div>
      )}

      {tab === 'catalog' && <DataTable q={catalog} cols={[
        ['canonical_name', 'Capability'], ['source_kind', 'Source'], ['business_domain', 'Domain'],
        ['activation_status', 'Activation', 'state'], ['lifecycle_state', 'State', 'state'], ['repository_reference', 'Repository'],
      ]} />}

      {tab === 'registry' && <DataTable q={registry} cols={[
        ['entity_identifier', 'Entity'], ['entity_type', 'Type'], ['lifecycle_state', 'State', 'state'],
        ['activation_state', 'Activation'], ['feature_flag', 'Flag'], ['migration_date', 'Migration date'], ['repository_reference', 'Repository'],
      ]} />}

      {tab === 'ownership' && (
        <>
          <p className="text-xs text-gray-500 mb-2">Owners shown “—” are <b>unassigned</b> — the honest finding from Phase 1.36 (no formal ownership layer existed). Never fabricated.</p>
          <DataTable q={ownership} cols={[
            ['capability_key', 'Capability'], ['business_owner', 'Business owner'], ['engineering_owner', 'Engineering owner'],
            ['architect_owner', 'Architect owner'], ['repository_location', 'Repository'], ['documentation_location', 'Docs'],
          ]} />
        </>
      )}

      {tab === 'relationships' && <DataTable q={relationships} cols={[
        ['from_uid', 'From'], ['relationship_type', 'Relationship'], ['to_uid', 'To'], ['evidence', 'Evidence'],
      ]} />}

      {tab === 'validation' && <ChecksCard q={validation} title="Validation" icon={<AlertTriangle className="w-4 h-4" />} />}
      {tab === 'health' && (
        <>
          <ChecksCard q={health} title="Repository Health" icon={<ShieldCheck className="w-4 h-4" />} />
          {health.data?.broken_reference_sample?.length > 0 && (
            <Card className="mt-3"><CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Broken reference sample</CardTitle></CardHeader>
              <CardContent className="text-xs font-mono space-y-1">
                {health.data.broken_reference_sample.map((s: string) => <div key={s}>{s}</div>)}
              </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BRAND.ink }}>{value}</div>
    </CardContent></Card>
  );
}

function BreakdownCard({ title, icon, rows, keyName }: { title: string; icon: React.ReactNode; rows?: any[]; keyName: string }) {
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {(!rows || rows.length === 0) && <div className="text-xs text-gray-400">— no data</div>}
        {(rows ?? []).map((r) => (
          <div key={String(r[keyName])} className="text-sm flex justify-between">
            <span className="text-gray-600">{dash(r[keyName])}</span><b>{num(r.n)}</b>
          </div>
        ))}
      </CardContent></Card>
  );
}

function ChecksCard({ q, title, icon }: { q: any; title: string; icon: React.ReactNode }) {
  if (q.isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (!q.data?.ready) return <div className="text-sm text-gray-400">Run discovery first.</div>;
  return (
    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
      {q.data?.note && <CardDescription>{q.data.note}</CardDescription>}</CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(q.data.checks).map(([k, v]) => (
          <div key={k} className="text-sm flex justify-between rounded border p-3">
            <span className="text-gray-600">{k.replace(/_/g, ' ')}</span>
            <b style={{ color: (v as number) > 0 ? '#B45309' : '#166534' }}>{num(v as number)}</b>
          </div>
        ))}
      </CardContent></Card>
  );
}

function DataTable({ q, cols }: { q: any; cols: Array<[string, string, string?]> }) {
  if (q.isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (!q.data?.ready) return <div className="text-sm text-gray-400">Run discovery first.</div>;
  const rows: any[] = q.data.rows ?? [];
  if (rows.length === 0) return <div className="text-sm text-gray-400">— no rows</div>;
  return (
    <div className="rounded border overflow-auto max-h-[70vh]">
      <Table>
        <TableHeader><TableRow>{cols.map(([, label]) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map(([k, , kind]) => (
                <TableCell key={k} className="text-xs">
                  {kind === 'state' ? <StateBadge s={r[k]} />
                    : Array.isArray(r[k]) ? (r[k].length ? r[k].join(', ') : '—')
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
