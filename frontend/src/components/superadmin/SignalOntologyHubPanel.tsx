/**
 * SignalOntologyHubPanel — read-only browser for the 4-tier Behavioural
 * Signal Ontology (capadex_domains | capadex_families | capadex_signals |
 * capadex_atomic_signals). Mounted as the "Signal Ontology" inner tab inside
 * the CAPADEX Framework panel (gated by FwConfig.signalOntologyPanel).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Network, Layers, Activity, Atom, Search, Download, RefreshCw,
  Eye, AlertCircle, Filter, X, CheckCircle2,
} from 'lucide-react';

const RESOURCE_TABS = [
  { id: 'domains',  label: 'Domains',  icon: Network,  total: 20      },
  { id: 'families', label: 'Families', icon: Layers,   total: 400     },
  { id: 'signals',  label: 'Signals',  icon: Activity, total: 20      },
  { id: 'atomic',   label: 'Atomic',   icon: Atom,     total: 15972   },
] as const;
type ResourceId = typeof RESOURCE_TABS[number]['id'];

// Per-resource preview columns for the table view (everything else lives in
// the detail drawer). Keeps the row dense but legible at 1280px+.
const PREVIEW_COLS: Record<ResourceId, { key: string; label: string; mono?: boolean; truncate?: number }[]> = {
  domains: [
    { key: 'domain_id', label: 'ID', mono: true },
    { key: 'domain_name', label: 'Name' },
    { key: 'primary_focus', label: 'Focus', truncate: 60 },
    { key: 'relational_bridge_tag', label: 'Bridge' },
  ],
  families: [
    { key: 'family_id', label: 'ID', mono: true },
    { key: 'domain_id', label: 'Domain', mono: true },
    { key: 'family_name', label: 'Name' },
    { key: 'relational_bridge_tag', label: 'Bridge' },
  ],
  signals: [
    { key: 'signal_id', label: 'ID', mono: true },
    { key: 'signal_name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'adaptive_importance', label: 'Adaptive' },
    { key: 'relational_bridge_tag', label: 'Bridge' },
  ],
  atomic: [
    { key: 'atomic_signal_id', label: 'ID', mono: true, truncate: 28 },
    { key: 'family_id', label: 'Family', mono: true },
    { key: 'atomic_signal_name', label: 'Name', truncate: 36 },
    { key: 'signal_category', label: 'Category' },
    { key: 'adaptive_importance', label: 'Adaptive' },
    { key: 'signal_status', label: 'Status' },
    { key: 'relational_bridge_tag', label: 'Bridge' },
  ],
};

const BRIDGE_COLOR: Record<string, string> = {
  GENERAL_CONCERN:    'bg-gray-100 text-gray-600 border-gray-300',
  ADJUSTMENT_COPING:  'bg-blue-50 text-blue-700 border-blue-300',
  CAREER_READINESS:   'bg-emerald-50 text-emerald-700 border-emerald-300',
  DISCIPLINE_HABITS:  'bg-amber-50 text-amber-700 border-amber-300',
  EXAM_STRESS:        'bg-rose-50 text-rose-700 border-rose-300',
  COLLEGE_ADAPT:      'bg-violet-50 text-violet-700 border-violet-300',
};

async function safeFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function truncate(v: unknown, max: number): string {
  if (v == null) return '—';
  const s = String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function BridgePill({ tag }: { tag: string | null | undefined }) {
  if (!tag) return <span className="text-gray-400 text-[10px]">—</span>;
  const cls = BRIDGE_COLOR[tag] ?? 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {tag}
    </span>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────
export default function SignalOntologyHubPanel() {
  const [resource, setResource] = useState<ResourceId>('domains');

  const stats = useQuery<{
    domains: number; families: number; signals: number;
    atomic_signals: number; atomic_bridge_buckets: number;
    atomic_strength_signals?: number;
    atomic_review_queue?: number;
    atomic_unsorted?: number;
    atomic_resolved?: number;
    atomic_resolved_pct?: number;
    atomic_general_concern: number;
    atomic_general_positive?: number;
    atomic_general_negative?: number;
    atomic_general_other?: number;
  }>({
    queryKey: ['/api/admin/capadex/ontology-hub/stats'],
    queryFn: () => safeFetch('/api/admin/capadex/ontology-hub/stats'),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      {/* Top stats strip */}
      <Card className="border-0 shadow-sm" style={{ borderLeft: '4px solid #2563eb' }}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Behavioural Signal Ontology
              </h3>
              <p className="text-xs text-gray-500">
                4-tier hierarchical catalogue: Domains → Families → Signals → Atomic Signals.
                Each atomic signal resolves to a specific <strong>concern</strong> or a
                <strong> strength</strong>, with ambiguous ones held in a small <strong>review queue</strong> —
                joins to <code className="bg-gray-100 px-1 rounded text-[10px]">capadex_concerns_master</code> via <code className="bg-gray-100 px-1 rounded text-[10px]">relational_bridge_tag</code>.
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => stats.refetch()}
              className="shrink-0"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
            <StatBox label="Domains"   value={stats.data?.domains}        loading={stats.isLoading} />
            <StatBox label="Families"  value={stats.data?.families}       loading={stats.isLoading} />
            <StatBox label="Signals"   value={stats.data?.signals}        loading={stats.isLoading} />
            <StatBox label="Atomic"    value={stats.data?.atomic_signals} loading={stats.isLoading} />
            <StatBox label="Bridge buckets" value={stats.data?.atomic_bridge_buckets} hint="concern + strength + review tags" loading={stats.isLoading} />
            <StatBox
              label="Strengths"
              value={stats.data?.atomic_strength_signals}
              suffix={stats.data?.atomic_strength_signals != null && stats.data.atomic_signals
                ? ` (${Math.round((stats.data.atomic_strength_signals ?? 0) / stats.data.atomic_signals * 100)}%)`
                : ''}
              hint="positive capability signals"
              loading={stats.isLoading}
            />
            <StatBox
              label="Needs review"
              value={stats.data?.atomic_review_queue ?? stats.data?.atomic_general_concern}
              hint="ambiguous — pending human authoring"
              loading={stats.isLoading}
            />
          </div>
          {stats.data?.atomic_resolved_pct != null && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{stats.data.atomic_resolved_pct}% resolved</strong> to a specific concern or strength.
                The remaining {(stats.data.atomic_review_queue ?? stats.data.atomic_general_concern ?? 0).toLocaleString()} ambiguous
                signals are held in a human-review queue, and <strong>{(stats.data.atomic_unsorted ?? 0).toLocaleString()}</strong> are
                unsorted — a true 100% needs human authoring of the review queue, not auto-mapping.
              </span>
            </div>
          )}
          {stats.error && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Stats unavailable — backend may not be reachable. {String(stats.error)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inner sub-tab bar */}
      <div className="flex flex-wrap gap-1 border-b">
        {RESOURCE_TABS.map(t => {
          const Icon = t.icon;
          const active = resource === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setResource(t.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition-all"
              style={{
                borderBottomColor: active ? '#2563eb' : 'transparent',
                color: active ? '#2563eb' : '#6b7280',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span className="text-[10px] text-gray-400">({t.total.toLocaleString()})</span>
            </button>
          );
        })}
      </div>

      {/* Resource table — remounted per-tab so filter/page state resets */}
      <ResourceBrowser key={resource} resource={resource} />
    </div>
  );
}

function StatBox({
  label, value, loading, suffix, hint,
}: { label: string; value?: number; loading: boolean; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-blue-50 p-3 text-center">
      <div className="text-xl font-bold text-blue-700">
        {loading ? '…' : (value ?? 0).toLocaleString()}
        {suffix && <span className="text-xs font-medium text-blue-600">{suffix}</span>}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">{label}</div>
      {hint && !loading && (
        <div className="text-[9px] text-gray-400 mt-0.5 normal-case tracking-normal">{hint}</div>
      )}
    </div>
  );
}

// ─── Resource Browser ──────────────────────────────────────────────────────
function ResourceBrowser({ resource }: { resource: ResourceId }) {
  const [search, setSearch] = useState('');
  const [facetFilters, setFacetFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const pageSize = 50;

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, facetFilters]);

  const facets = useQuery<Record<string, string[]>>({
    queryKey: [`/api/admin/capadex/ontology-hub/${resource}/facets`],
    queryFn: () => safeFetch(`/api/admin/capadex/ontology-hub/${resource}/facets`),
    staleTime: 5 * 60_000,
  });

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) p.set('search', search);
    Object.entries(facetFilters).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  }, [search, facetFilters, page]);

  const list = useQuery<{ rows: any[]; total: number; page: number; pageSize: number }>({
    queryKey: [`/api/admin/capadex/ontology-hub/${resource}`, qs],
    queryFn: () => safeFetch(`/api/admin/capadex/ontology-hub/${resource}?${qs}`),
    keepPreviousData: true,
  } as any);

  const cols = PREVIEW_COLS[resource];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / pageSize)) : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" />
            {resource.charAt(0).toUpperCase() + resource.slice(1)}
            <Badge variant="outline" className="ml-1 text-xs">
              {list.data?.total?.toLocaleString() ?? '—'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-gray-400" />
              <Input
                placeholder="Search id / name / text…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-7 h-8 text-xs w-56"
              />
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => {
                // Export uses same filter state, never includes pagination
                const exportQs = new URLSearchParams();
                if (search) exportQs.set('search', search);
                Object.entries(facetFilters).forEach(([k, v]) => { if (v) exportQs.set(k, v); });
                window.open(
                  `/api/admin/capadex/ontology-hub/${resource}/export.csv?${exportQs.toString()}`,
                  '_blank',
                );
              }}
            >
              <Download className="h-3 w-3 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Facet filter row */}
        {facets.data && Object.keys(facets.data).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(facets.data).map(([col, values]) => (
              <div key={col} className="flex items-center gap-1">
                <label className="text-[10px] uppercase text-gray-500 font-medium">
                  {col.replace(/_/g, ' ')}
                </label>
                <select
                  value={facetFilters[col] ?? ''}
                  onChange={e => setFacetFilters(f => ({ ...f, [col]: e.target.value }))}
                  className="border rounded h-7 px-2 text-xs max-w-[200px] truncate"
                >
                  <option value="">all</option>
                  {/* Cap at 1000 to cover family_id (400 distinct values for
                      atomic resource) plus headroom for future growth. Bridge
                      tag has 6 values; domain_id 20; everything else is tiny. */}
                  {values.slice(0, 1000).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  {values.length > 1000 && (
                    <option disabled>… {values.length - 1000} more (refine search)</option>
                  )}
                </select>
                {facetFilters[col] && (
                  <button
                    onClick={() => setFacetFilters(f => { const c = { ...f }; delete c[col]; return c; })}
                    className="text-gray-400 hover:text-gray-700"
                    aria-label={`Clear ${col}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
              <tr>
                {cols.map(c => (
                  <th key={c.key} className="text-left px-3 py-2 whitespace-nowrap">{c.label}</th>
                ))}
                <th className="text-left px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.isLoading && (
                <tr><td colSpan={cols.length + 1} className="text-center py-8 text-gray-400">Loading…</td></tr>
              )}
              {list.error && (
                <tr><td colSpan={cols.length + 1} className="text-center py-8 text-amber-600 bg-amber-50">
                  <div className="flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load — {String(list.error)}
                  </div>
                </td></tr>
              )}
              {!list.isLoading && !list.error && list.data?.rows.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-blue-50/50">
                  {cols.map(c => {
                    const v = row[c.key];
                    if (c.key === 'relational_bridge_tag') {
                      return <td key={c.key} className="px-3 py-2"><BridgePill tag={v} /></td>;
                    }
                    const display = c.truncate ? truncate(v, c.truncate) : (v ?? '—');
                    return (
                      <td key={c.key} className={`px-3 py-2 ${c.mono ? 'font-mono text-[10px]' : ''}`}>
                        {display}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost" size="sm" className="h-6 px-2"
                      onClick={() => setDetailId(row.id)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!list.isLoading && !list.error && (list.data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={cols.length + 1} className="text-center py-10 text-gray-400">
                  No rows match the current filters
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {list.data && list.data.total > pageSize && (
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>
              Page {list.data.page} of {totalPages} · {list.data.total.toLocaleString()} total
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>

      {detailId !== null && (
        <DetailDrawer
          resource={resource}
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </Card>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────
function DetailDrawer({
  resource, id, onClose,
}: { resource: ResourceId; id: number; onClose: () => void }) {
  const detail = useQuery<any>({
    queryKey: [`/api/admin/capadex/ontology-hub/${resource}/${id}`],
    queryFn: () => safeFetch(`/api/admin/capadex/ontology-hub/${resource}/${id}`),
  });

  return (
    <div
      role="dialog"
      aria-labelledby="ontology-detail-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <h3 id="ontology-detail-title" className="text-sm font-bold flex items-center gap-2">
            <Atom className="h-4 w-4 text-blue-600" />
            {resource.charAt(0).toUpperCase() + resource.slice(1)} detail
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {detail.isLoading && <div className="text-sm text-gray-400">Loading…</div>}
          {detail.error && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              {String(detail.error)}
            </div>
          )}
          {detail.data && (
            <>
              <DetailGrid data={detail.data} />
              {detail.data.parent_family && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500 mb-2">Parent Family</h4>
                  <DetailGrid data={detail.data.parent_family} compact />
                </div>
              )}
              {detail.data.parent_domain && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500 mb-2">Parent Domain</h4>
                  <DetailGrid data={detail.data.parent_domain} compact />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailGrid({ data, compact }: { data: any; compact?: boolean }) {
  const entries = Object.entries(data).filter(
    ([k]) => !['parent_family', 'parent_domain', 'created_at', 'updated_at'].includes(k),
  );
  return (
    <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1'} gap-1.5 text-xs`}>
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col py-1 border-b border-gray-100 last:border-0">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
            {k.replace(/_/g, ' ')}
          </span>
          <span className="text-gray-800 break-words">
            {v === null || v === undefined || v === ''
              ? <span className="text-gray-300">—</span>
              : k === 'relational_bridge_tag' ? <BridgePill tag={String(v)} /> : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}
