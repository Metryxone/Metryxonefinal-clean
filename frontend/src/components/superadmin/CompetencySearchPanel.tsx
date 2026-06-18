import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Info, RefreshCw, X, ArrowUpDown, ArrowUp, ArrowDown, Boxes, Layers, Briefcase, Building2, Network, GitBranch, Download, Tag, CheckSquare, Square } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', gray: '#6b7280' };

const TYPE_STYLE: Record<string, string> = {
  behavioral: 'bg-purple-100 text-purple-700 border-purple-300',
  cognitive: 'bg-blue-100 text-blue-700 border-blue-300',
  functional: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  technical: 'bg-amber-100 text-amber-700 border-amber-300',
  future_skills: 'bg-rose-100 text-rose-700 border-rose-300',
};

interface CompetencyResult {
  id: string; canonical_name: string; slug: string | null; definition: string | null;
  domain_id: string | null; domain_name: string | null; family_id: string | null; family_name: string | null;
  type_key: string | null; type_label: string | null; type_confidence: number | null; type_needs_review: boolean | null;
  scientific_type: string | null; trainability: string | null; stability_level: string | null; complexity_level: string | null;
  leadership_relevance: string | null; role_relevance: string | null; deprecated: boolean; micro_count: number; role_count: number;
}
interface SearchResponse {
  results: CompetencyResult[]; total: number; limit: number; offset: number; sort: string; order: 'asc' | 'desc'; applied_filters: Record<string, unknown>;
}
interface Facets {
  types: { type_key: string; label: string; count: number }[];
  domains: { id: string; name: string; count: number }[];
  families: { id: string; domain_id: string | null; name: string; count: number }[];
  industries: { id: string; name: string }[];
  functions: { id: string; industry_id: string | null; name: string }[];
  departments: { id: string; function_id: string | null; name: string }[];
  roles: { id: string; title: string; role_family_id: string | null }[];
  trainability: string[]; stability_level: string[]; complexity_level: string[];
}
interface Summary {
  competencies_total: number; competencies_active: number; competencies_deprecated: number;
  competencies_typed: number; competencies_untyped: number; domains: number; families: number;
  micro_competencies: number; industries: number; functions: number; departments: number; roles: number;
  type_breakdown: { type_key: string; label: string; count: number }[]; findings: string[];
}
interface MicroResult {
  id: number; parent_competency_id: string | null; parent_name: string | null;
  child_competency_id: string | null; child_name: string | null; micro_label: string | null; micro_slug: string | null; source: string | null; active: boolean;
}

interface Filters {
  q: string; type: string; domain_id: string; family_id: string; industry_id: string;
  function_id: string; department_id: string; role_id: string; micro: string;
  trainability: string; stability_level: string; complexity_level: string; include_deprecated: boolean;
}
const EMPTY_FILTERS: Filters = {
  q: '', type: '', domain_id: '', family_id: '', industry_id: '', function_id: '', department_id: '',
  role_id: '', micro: '', trainability: '', stability_level: '', complexity_level: '', include_deprecated: false,
};

const SORT_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'domain', label: 'Domain' },
  { key: 'family', label: 'Family' }, { key: 'complexity', label: 'Complexity' }, { key: 'micro', label: 'Micros' }, { key: 'roles', label: 'Roles' },
];

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: (color || BRAND.primary) + '15' }}>
            <Icon className="h-5 w-5" style={{ color: color || BRAND.primary }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeBadge({ k, label }: { k: string | null; label: string | null }) {
  if (!k) return <span className="text-gray-300 text-xs">untyped</span>;
  return <Badge className={`${TYPE_STYLE[k] ?? 'bg-gray-100 text-gray-600 border-gray-300'} text-[10px] capitalize`}>{label ?? k}</Badge>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function CompetencySearchPanel() {
  const [view, setView] = React.useState<'competencies' | 'micro'>('competencies');
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = React.useState('name');
  const [order, setOrder] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = React.useState('');
  const [bulkMsg, setBulkMsg] = React.useState<string | null>(null);
  const [microQ, setMicroQ] = React.useState('');
  const PAGE_SIZE = 50;

  const set = (k: keyof Filters, v: string | boolean) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };

  const summaryQ = useQuery({
    queryKey: ['cmp-search-summary'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/search/summary', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('summary failed');
      return (await r.json()).data as Summary;
    },
  });
  const facetsQ = useQuery({
    queryKey: ['cmp-search-facets'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/search/facets', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('facets failed');
      return (await r.json()).data as Facets;
    },
  });

  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (filters.q) p.set('q', filters.q);
    if (filters.type) p.set('type', filters.type);
    if (filters.domain_id) p.set('domain_id', filters.domain_id);
    if (filters.family_id) p.set('family_id', filters.family_id);
    if (filters.industry_id) p.set('industry_id', filters.industry_id);
    if (filters.function_id) p.set('function_id', filters.function_id);
    if (filters.department_id) p.set('department_id', filters.department_id);
    if (filters.role_id) p.set('role_id', filters.role_id);
    if (filters.micro) p.set('micro', filters.micro);
    if (filters.trainability) p.set('trainability', filters.trainability);
    if (filters.stability_level) p.set('stability_level', filters.stability_level);
    if (filters.complexity_level) p.set('complexity_level', filters.complexity_level);
    if (filters.include_deprecated) p.set('include_deprecated', '1');
    p.set('sort', sort); p.set('order', order);
    p.set('limit', String(PAGE_SIZE)); p.set('offset', String(page * PAGE_SIZE));
    return p.toString();
  }, [filters, sort, order, page]);

  const searchQ = useQuery({
    queryKey: ['cmp-search', qs],
    queryFn: async () => {
      const r = await fetch(`/api/competency-intelligence/search?${qs}`, { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('search failed');
      return (await r.json()).data as SearchResponse;
    },
    enabled: view === 'competencies',
  });

  const microResQ = useQuery({
    queryKey: ['cmp-micro-search', microQ],
    queryFn: async () => {
      const p = new URLSearchParams(); if (microQ) p.set('q', microQ);
      const r = await fetch(`/api/competency-intelligence/search/micro-competencies?${p.toString()}`, { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('micro search failed');
      return (await r.json()).data as { results: MicroResult[]; total: number };
    },
    enabled: view === 'micro',
  });

  const disabled = (summaryQ.data as any)?.__disabled;
  const toggleSort = (key: string) => {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setOrder('asc'); }
    setPage(0);
  };
  const SortIcon = ({ k }: { k: string }) => sort !== k ? <ArrowUpDown className="h-3 w-3 inline opacity-30" /> : order === 'asc' ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />;

  const results = (searchQ.data as SearchResponse | undefined)?.results ?? [];
  const total = (searchQ.data as SearchResponse | undefined)?.total ?? 0;
  const pageIds = results.map((r) => r.id);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleRow = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllPage = () => setSelected((s) => { const n = new Set(s); if (allSelectedOnPage) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; });

  const runBulk = async (operation: 'export' | 'assign_type') => {
    setBulkMsg(null);
    const ids = Array.from(selected);
    if (ids.length === 0) { setBulkMsg('Select at least one competency first.'); return; }
    const body: Record<string, unknown> = { operation, competency_ids: ids };
    if (operation === 'assign_type') {
      if (!bulkType) { setBulkMsg('Pick a type to assign.'); return; }
      body.type_key = bulkType;
    }
    const r = await fetch('/api/admin/competency-intelligence/search/bulk', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) { setBulkMsg(`Bulk ${operation} failed (${r.status}).`); return; }
    const data = (await r.json()).data as { affected: number; skipped: { id: string; reason: string }[]; exported?: CompetencyResult[] };
    if (operation === 'export' && data.exported) {
      const cols = ['id', 'canonical_name', 'type_key', 'domain_name', 'family_name', 'complexity_level', 'trainability', 'stability_level', 'micro_count', 'role_count', 'deprecated'];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...data.exported.map((row) => cols.map((c) => esc((row as any)[c])).join(','))].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = `competencies_export_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
      setBulkMsg(`Exported ${data.affected} competenc${data.affected === 1 ? 'y' : 'ies'}${data.skipped.length ? ` (${data.skipped.length} skipped)` : ''}.`);
    } else {
      setBulkMsg(`Assigned type to ${data.affected} competenc${data.affected === 1 ? 'y' : 'ies'}${data.skipped.length ? ` (${data.skipped.length} skipped)` : ''}. Marked for review.`);
      searchQ.refetch(); summaryQ.refetch(); facetsQ.refetch();
    }
  };

  if (summaryQ.isLoading) return <div className="p-6 text-sm text-gray-500">Loading search & discovery…</div>;
  if (disabled) {
    return (
      <div className="p-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/60">
          <CardContent className="pt-6 pb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700">Search & Discovery is disabled</p>
              <p className="text-sm text-gray-500 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-100 rounded">FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1</code> to enable
                faceted search across the competency genome. Flag OFF keeps every existing screen byte-identical.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (summaryQ.isError || !summaryQ.data) return <div className="p-6 text-sm text-red-600">Failed to load search & discovery.</div>;

  const summary = summaryQ.data as Summary;
  const facets = facetsQ.data as Facets | undefined;
  const families = facets?.families.filter((f) => !filters.domain_id || f.domain_id === filters.domain_id) ?? [];
  const functions = facets?.functions.filter((f) => !filters.industry_id || f.industry_id === filters.industry_id) ?? [];
  const departments = facets?.departments.filter((d) => !filters.function_id || d.function_id === filters.function_id) ?? [];
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'q').length + (filters.q ? 1 : 0);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="h-5 w-5" style={{ color: BRAND.primary }} /> Search & Discovery
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Faceted search across the competency genome — by competency, type, role, industry, department, function and
            micro-competency. Read-only discovery over existing data; bulk actions operate only on your selection.
          </p>
        </div>
        <button onClick={() => { summaryQ.refetch(); facetsQ.refetch(); searchQ.refetch(); }} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md px-3 py-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Boxes} label="Competencies" value={summary.competencies_total} sub={`${summary.competencies_typed} typed · ${summary.competencies_untyped} untyped`} />
        <MetricCard icon={Layers} label="Taxonomy" value={`${summary.domains}·${summary.families}`} sub="domains · families" color={BRAND.accent} />
        <MetricCard icon={Building2} label="Role taxonomy" value={summary.roles} sub={`${summary.industries} ind · ${summary.departments} dept · ${summary.functions} fn`} color={BRAND.primary} />
        <MetricCard icon={GitBranch} label="Micro-competencies" value={summary.micro_competencies} sub={summary.micro_competencies > 0 ? 'searchable' : 'none defined yet'} color={summary.micro_competencies > 0 ? BRAND.success : BRAND.gray} />
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {([['competencies', 'Competency Search', Boxes], ['micro', 'Micro Competency', GitBranch]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ---- COMPETENCY SEARCH ---- */}
      {view === 'competencies' && (
        <div className="flex gap-6 items-start">
          {/* Filters sidebar */}
          <div className="w-64 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Filter className="h-4 w-4" /> Filters{activeFilterCount > 0 && <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px]">{activeFilterCount}</Badge>}</span>
              {activeFilterCount > 0 && <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(0); }} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5"><X className="h-3 w-3" /> Clear</button>}
            </div>
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Search competency…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <FilterSelect label="Type" value={filters.type} onChange={(v) => set('type', v)} options={(facets?.types ?? []).map((t) => ({ value: t.type_key, label: `${t.label} (${t.count})` }))} />
            <FilterSelect label="Domain" value={filters.domain_id} onChange={(v) => { set('domain_id', v); set('family_id', ''); }} options={(facets?.domains ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.count})` }))} />
            <FilterSelect label="Family" value={filters.family_id} onChange={(v) => set('family_id', v)} options={families.map((f) => ({ value: f.id, label: `${f.name} (${f.count})` }))} />
            <div className="pt-1 border-t border-gray-100" />
            <FilterSelect label="Industry" value={filters.industry_id} onChange={(v) => { set('industry_id', v); set('function_id', ''); set('department_id', ''); }} options={(facets?.industries ?? []).map((i) => ({ value: i.id, label: i.name }))} />
            <FilterSelect label="Function" value={filters.function_id} onChange={(v) => { set('function_id', v); set('department_id', ''); }} options={functions.map((f) => ({ value: f.id, label: f.name }))} />
            <FilterSelect label="Department" value={filters.department_id} onChange={(v) => set('department_id', v)} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
            <FilterSelect label="Role" value={filters.role_id} onChange={(v) => set('role_id', v)} options={(facets?.roles ?? []).map((r) => ({ value: r.id, label: r.title }))} />
            <div className="pt-1 border-t border-gray-100" />
            <FilterSelect label="Trainability" value={filters.trainability} onChange={(v) => set('trainability', v)} options={(facets?.trainability ?? []).map((t) => ({ value: t, label: t }))} />
            <FilterSelect label="Stability" value={filters.stability_level} onChange={(v) => set('stability_level', v)} options={(facets?.stability_level ?? []).map((t) => ({ value: t, label: t }))} />
            <FilterSelect label="Complexity" value={filters.complexity_level} onChange={(v) => set('complexity_level', v)} options={(facets?.complexity_level ?? []).map((t) => ({ value: t, label: t }))} />
            <label className="flex items-center gap-2 text-sm text-gray-600 pt-1">
              <input type="checkbox" checked={filters.include_deprecated} onChange={(e) => set('include_deprecated', e.target.checked)} /> Include deprecated
            </label>
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Toolbar: count + sort + bulk */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500">{total} result{total === 1 ? '' : 's'}{selected.size > 0 && <span className="text-blue-600 font-medium"> · {selected.size} selected</span>}</span>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-400">Sort</span>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} className="border rounded-md px-2 py-1 bg-white text-sm">
                  {SORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <button onClick={() => { setOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setPage(0); }} className="border rounded-md p-1 hover:bg-gray-50">{order === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}</button>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => runBulk('export')} disabled={selected.size === 0} className="flex items-center gap-1.5 text-sm border rounded-md px-2.5 py-1.5 disabled:opacity-40 hover:bg-gray-50"><Download className="h-3.5 w-3.5" /> Export</button>
                <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} className="border rounded-md px-2 py-1.5 bg-white text-sm">
                  <option value="">Assign type…</option>
                  {(facets?.types ?? []).map((t) => <option key={t.type_key} value={t.type_key}>{t.label}</option>)}
                </select>
                <button onClick={() => runBulk('assign_type')} disabled={selected.size === 0 || !bulkType} className="flex items-center gap-1.5 text-sm border rounded-md px-2.5 py-1.5 disabled:opacity-40 hover:bg-gray-50"><Tag className="h-3.5 w-3.5" /> Apply</button>
              </div>
            </div>
            {bulkMsg && <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">{bulkMsg}</div>}

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-gray-400 border-b border-gray-100">
                      <th className="py-2 px-3 w-8"><button onClick={toggleAllPage}>{allSelectedOnPage ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                      <th className="py-2 px-2 font-medium cursor-pointer" onClick={() => toggleSort('name')}>Competency <SortIcon k="name" /></th>
                      <th className="py-2 px-2 font-medium cursor-pointer" onClick={() => toggleSort('type')}>Type <SortIcon k="type" /></th>
                      <th className="py-2 px-2 font-medium cursor-pointer" onClick={() => toggleSort('domain')}>Domain <SortIcon k="domain" /></th>
                      <th className="py-2 px-2 font-medium cursor-pointer" onClick={() => toggleSort('family')}>Family <SortIcon k="family" /></th>
                      <th className="py-2 px-2 font-medium cursor-pointer" onClick={() => toggleSort('micro')}>Micros <SortIcon k="micro" /></th>
                      <th className="py-2 px-2 font-medium cursor-pointer" onClick={() => toggleSort('roles')}>Roles <SortIcon k="roles" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className={`border-t border-gray-50 hover:bg-gray-50/60 ${r.deprecated ? 'opacity-50' : ''} ${selected.has(r.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="py-2 px-3"><button onClick={() => toggleRow(r.id)}>{selected.has(r.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">{r.canonical_name}{r.deprecated && <Badge className="bg-gray-200 text-gray-500 border-gray-300 text-[9px] ml-1.5">deprecated</Badge>}</div>
                          <div className="font-mono text-[10px] text-gray-400">{r.id}</div>
                        </td>
                        <td className="py-2 px-2"><TypeBadge k={r.type_key} label={r.type_label} />{r.type_needs_review && <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[9px] ml-1">review</Badge>}</td>
                        <td className="py-2 px-2 text-gray-600">{r.domain_name ?? '—'}</td>
                        <td className="py-2 px-2 text-gray-600">{r.family_name ?? '—'}</td>
                        <td className="py-2 px-2 text-gray-600">{r.micro_count > 0 ? r.micro_count : <span className="text-gray-300">0</span>}</td>
                        <td className="py-2 px-2 text-gray-600">{r.role_count > 0 ? r.role_count : <span className="text-gray-300">0</span>}</td>
                      </tr>
                    ))}
                    {results.length === 0 && !searchQ.isLoading && (
                      <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">No competencies match these filters.</td></tr>
                    )}
                    {searchQ.isLoading && <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">Searching…</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
                <div className="flex items-center gap-2">
                  <button disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))} className="border rounded-md px-3 py-1 disabled:opacity-40 hover:bg-gray-50">Prev</button>
                  <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)} className="border rounded-md px-3 py-1 disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- MICRO COMPETENCY SEARCH ---- */}
      {view === 'micro' && (
        <div className="space-y-4">
          {summary.micro_competencies === 0 ? (
            <Card className="border-dashed border-amber-300 bg-amber-50/40">
              <CardContent className="pt-6 pb-6 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-700">No micro-competencies defined yet</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Micro-competency search reads <code className="px-1 bg-white rounded border">onto_competency_hierarchy</code>, which has no
                    active rows yet, so this view is honestly empty and is never seeded with placeholders.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative max-w-md">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={microQ} onChange={(e) => setMicroQ(e.target.value)} placeholder="Search micro-competency or parent…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-gray-400 border-b border-gray-100">
                        <th className="py-2 px-3 font-medium">Micro-competency</th>
                        <th className="py-2 px-2 font-medium">Parent competency</th>
                        <th className="py-2 px-2 font-medium">Linked competency</th>
                        <th className="py-2 px-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((microResQ.data as any)?.results ?? []).map((m: MicroResult) => (
                        <tr key={m.id} className={`border-t border-gray-50 ${m.active ? '' : 'opacity-50'}`}>
                          <td className="py-2 px-3 text-gray-900 font-medium">{m.micro_label ?? m.child_name ?? '—'}{m.micro_slug && <span className="font-mono text-[10px] text-gray-400 ml-2">{m.micro_slug}</span>}</td>
                          <td className="py-2 px-2 text-gray-600">{m.parent_name ?? '—'}</td>
                          <td className="py-2 px-2 text-gray-600">{m.child_name ?? <span className="text-gray-300">named only</span>}</td>
                          <td className="py-2 px-2"><Badge className="bg-gray-100 text-gray-500 border-gray-300 text-[10px] capitalize">{m.source ?? '—'}</Badge></td>
                        </tr>
                      ))}
                      {((microResQ.data as any)?.results ?? []).length === 0 && !microResQ.isLoading && (
                        <tr><td colSpan={4} className="py-10 text-center text-gray-400 text-sm">No micro-competencies match this search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
