/**
 * /app/frontend/src/pages/SDIAdminPage.tsx
 * Student Development Index — full admin page mirroring the Competency architecture.
 * 9 tabs: Overview · Domains · Subdomains · Stages · Items · Norms · Weights · Clusters · Learning · Versions
 */
import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Layers, GitBranch, Target, Sliders, BarChart3, History, Sparkles, BookOpen, Users, FileSpreadsheet, Download, Upload, X, Filter, ChevronDown } from 'lucide-react';
import { NormsTab, WeightsTab, ClustersTab, LearningMappingsTab, VersionsTab } from '@/components/admin/parity-tabs';

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export default function SDIAdminPage({ onNavigate, embedded = false }: { onNavigate?: (p: string) => void; embedded?: boolean }) {
  const [tab, setTab] = useState<'overview' | 'domains' | 'subdomains' | 'stages' | 'items' | 'norms' | 'weights' | 'clusters' | 'versions' | 'learning'>('overview');

  const innerContent = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList className="flex flex-wrap mb-6 bg-white border shadow-sm h-auto p-1 gap-1">
        <TabsTrigger value="overview"><Sparkles className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
        <TabsTrigger value="domains"><Layers className="h-4 w-4 mr-1.5" />Domains</TabsTrigger>
        <TabsTrigger value="subdomains"><Target className="h-4 w-4 mr-1.5" />Subdomains</TabsTrigger>
        <TabsTrigger value="stages"><Users className="h-4 w-4 mr-1.5" />Stages</TabsTrigger>
        <TabsTrigger value="items"><FileSpreadsheet className="h-4 w-4 mr-1.5" />Items</TabsTrigger>
        <TabsTrigger value="norms"><BarChart3 className="h-4 w-4 mr-1.5" />Norms</TabsTrigger>
        <TabsTrigger value="weights"><Sliders className="h-4 w-4 mr-1.5" />Weights</TabsTrigger>
        <TabsTrigger value="clusters"><GitBranch className="h-4 w-4 mr-1.5" />Clusters</TabsTrigger>
        <TabsTrigger value="learning"><BookOpen className="h-4 w-4 mr-1.5" />Learning</TabsTrigger>
        <TabsTrigger value="versions"><History className="h-4 w-4 mr-1.5" />Versions</TabsTrigger>
      </TabsList>

      <TabsContent value="overview"><SdiOverview /></TabsContent>
      <TabsContent value="domains"><SdiSimpleList path="/api/sdi/admin/domains" col1="domain_code" col2="domain_name" col3="category" /></TabsContent>
      <TabsContent value="subdomains"><SdiSimpleList path="/api/sdi/subdomains" col1="subdomain_code" col2="subdomain_name" col3="domain_code" /></TabsContent>
      <TabsContent value="stages"><SdiSimpleList path="/api/sdi/admin/stages" col1="stage_code" col2="stage_name" col3="description" /></TabsContent>
      <TabsContent value="items"><SdiItemsList /></TabsContent>
      <TabsContent value="norms"><NormsTab basePath="/api/sdi/admin/subdomain-norms" stagesPath="/api/sdi/admin/stages" stageKey="stage_code" stageLabel="Stage" /></TabsContent>
      <TabsContent value="weights"><WeightsTab basePath="/api/sdi/admin/stage-weights" stagesPath="/api/sdi/admin/stages" stageKey="stage_code" stageLabel="Stage" /></TabsContent>
      <TabsContent value="clusters"><ClustersTab basePath="/api/sdi/admin/clusters" subdomainsPath="/api/sdi/subdomains" /></TabsContent>
      <TabsContent value="learning"><LearningMappingsTab basePath="/api/sdi/admin/learning-mappings" subdomainsPath="/api/sdi/subdomains" /></TabsContent>
      <TabsContent value="versions"><VersionsTab basePath="/api/sdi/admin/versions" summaryPath="/api/sdi/admin/engine-summary" /></TabsContent>
    </Tabs>
  );

  if (embedded) {
    return <div className="space-y-4">{innerContent}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50/30 px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('super-admin')} data-testid="sdi-back">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="sdi-page-title">
                <Sparkles className="h-7 w-7 text-violet-600" />
                CAPADEX
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Capability &amp; Potential Development Exchange · 4 stages: Curiosity → Insight → Growth → Mastery · Students · Parents · Employers · Employees · Job Market</p>
            </div>
          </div>
        </div>
        {innerContent}
      </div>
    </div>
  );
}

function SdiOverview() {
  const { isAuthenticated } = useAuth();
  const stats = useQuery<Record<string, number>>({ queryKey: ['/api/sdi/admin/engine-summary'], enabled: isAuthenticated, queryFn: () => jget('/api/sdi/admin/engine-summary') });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" /> CAPADEX Engine Overview
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Multi-stakeholder capability intelligence — serving students, parents, employers, employees and job market analysts across four progressive stages: <span className="font-medium text-violet-700">Curiosity</span> (free entry) · <span className="font-medium text-violet-700">Insight</span> · <span className="font-medium text-violet-700">Growth</span> · <span className="font-medium text-violet-700">Mastery</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.data && Object.entries(stats.data).map(([k, v]) => (
            <div key={k} className="bg-gradient-to-br from-violet-50 to-white border rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-900">{v as number}</div>
              <div className="text-xs text-gray-500 mt-1">{k.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SdiSimpleList({ path, col1, col2, col3 }: { path: string; col1: string; col2: string; col3: string }) {
  const data = useQuery<any[]>({ queryKey: [path], queryFn: () => jget(path) });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2">{col2.replace(/_/g, ' ')}<Badge variant="outline" className="ml-2">{data.data?.length ?? 0}</Badge></CardTitle></CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
              <tr>
                <th className="text-left p-2">{col1.replace(/_/g, ' ')}</th>
                <th className="text-left p-2">{col2.replace(/_/g, ' ')}</th>
                <th className="text-left p-2">{col3.replace(/_/g, ' ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.data?.map((row: any) => (
                <tr key={row.id || row[col1]} className="hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs text-gray-600">{row[col1]}</td>
                  <td className="p-2 font-medium">{row[col2]}</td>
                  <td className="p-2 text-xs text-gray-500">{row[col3] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data.data?.length ?? 0) === 0 && <div className="text-center py-8 text-gray-400 text-sm">No items yet</div>}
        </div>
      </CardContent>
    </Card>
  );
}

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CAP_CUR: { bg: '#EEF6FF', text: '#2563EB', border: '#BFDBFE' },
  CAP_INS: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  CAP_GRW: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  CAP_MAS: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
};
const STAGE_LABELS: Record<string, string> = {
  CAP_CUR: 'Curiosity', CAP_INS: 'Insight', CAP_GRW: 'Growth', CAP_MAS: 'Mastery',
};

/* ── CSV helpers ─────────────────────────────────────────────────────── */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return row;
  });
}

function buildCsvTemplate(): string {
  const headers = ['subdomain_code','item_code','item_type','difficulty','question',
                   'concern_name','stage_code','age_band','polarity','weight',
                   'anchor','focus_area','layer_tag','expected_time','language_code','is_active'];
  const example = ['SDI_BEH_ENVIRONMENT','SDI_BEH_ENV_001','standard','3',
                   'Do you adjust your workspace to maximise focus?',
                   'Screen Distraction','CAP_CUR','19+','positive','1',
                   'false','Physical Setup','Layer 1','30','en','true'];
  return [headers.join(','), example.join(',')].join('\n');
}

/* ── Import Modal ────────────────────────────────────────────────────── */
function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState<Record<string,string>[]>([]);
  const [result, setResult] = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const downloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate()], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'sdi-items-template.csv'; a.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('parsing'); setPreview([]); setResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCsv(ev.target?.result as string);
        if (rows.length === 0) { setErrMsg('No valid rows found — check headers.'); setStatus('error'); return; }
        setPreview(rows.slice(0, 5));
        setStatus('idle');
      } catch (e: any) { setErrMsg(e.message); setStatus('error'); }
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setStatus('uploading');
    const text = await file.text();
    const rows = parseCsv(text);
    try {
      const resp = await fetch('/api/sdi/admin/import', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'items', rows }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      setStatus('done');
      qc.invalidateQueries({ queryKey: ['/api/sdi/items'] });
    } catch (e: any) { setErrMsg(e.message); setStatus('error'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Import Items (CSV)</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Upserts on item_code — existing rows are updated, new rows are inserted</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Template download */}
          <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
            <FileSpreadsheet className="h-5 w-5 text-violet-500 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-violet-800">Download CSV template</p>
              <p className="text-[10px] text-violet-500 mt-0.5">Required columns: subdomain_code, item_code, question. Others are optional.</p>
            </div>
            <Button size="sm" variant="outline" className="text-violet-700 border-violet-200 hover:bg-violet-100 text-xs" onClick={downloadTemplate}>
              <Download className="h-3 w-3 mr-1" /> Template
            </Button>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Select CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile}
              className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer" />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preview (first {preview.length} rows)</p>
              <div className="border rounded-lg overflow-hidden text-[10px]">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>{Object.keys(preview[0]).slice(0,5).map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).slice(0,5).map((v, j) => (
                          <td key={j} className="px-2 py-1.5 text-gray-700 truncate max-w-[120px]">{v || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Showing first 5 columns · {preview.length} rows previewed</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-xs text-red-700">{errMsg}</div>
          )}

          {/* Result */}
          {status === 'done' && result && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-xs text-green-800 space-y-1">
              <p className="font-semibold">Import complete</p>
              <p>{result.inserted} rows inserted · {result.updated} rows updated</p>
              {result.errors?.length > 0 && (
                <details className="mt-1">
                  <summary className="text-red-600 cursor-pointer">{result.errors.length} errors</summary>
                  <ul className="mt-1 space-y-0.5 text-[10px] text-red-600">{result.errors.map((e,i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" disabled={preview.length === 0 || status === 'uploading' || status === 'done'}
            onClick={doImport}
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
            {status === 'uploading' ? 'Importing…' : `Import ${preview.length > 0 ? '(preview loaded)' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── SdiItemsList ─────────────────────────────────────────────────────── */
function SdiItemsList() {
  const [search, setSearch]             = useState('');
  const [filterStage, setFilterStage]   = useState('');
  const [filterAge, setFilterAge]       = useState('');
  const [filterConcern, setFilterConcern] = useState('');
  const [filterSubdomain, setFilterSubdomain] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterDiff, setFilterDiff]     = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [showImport, setShowImport]     = useState(false);

  const items = useQuery<any[]>({ queryKey: ['/api/sdi/items'], queryFn: () => jget('/api/sdi/items') });
  const allItems = items.data ?? [];

  /* Unique option lists */
  const stages     = [...new Set(allItems.map((i: any) => i.stage_code).filter(Boolean))].sort() as string[];
  const ageBands   = [...new Set(allItems.map((i: any) => i.age_band).filter(Boolean))].sort() as string[];
  const concerns   = [...new Set(allItems.map((i: any) => i.concern_name).filter(Boolean))].sort() as string[];
  const subdomains = [...new Set(allItems.map((i: any) => i.subdomain_code).filter(Boolean))].sort() as string[];
  const types      = [...new Set(allItems.map((i: any) => i.item_type).filter(Boolean))].sort() as string[];
  const diffs      = [...new Set(allItems.map((i: any) => String(i.difficulty)).filter(Boolean))].sort() as string[];

  const activeFilters = [filterStage, filterAge, filterConcern, filterSubdomain, filterType, filterDiff, search].filter(Boolean).length;

  const filtered = allItems.filter((it: any) => {
    if (filterStage     && it.stage_code     !== filterStage)     return false;
    if (filterAge       && it.age_band       !== filterAge)       return false;
    if (filterConcern   && it.concern_name   !== filterConcern)   return false;
    if (filterSubdomain && it.subdomain_code !== filterSubdomain) return false;
    if (filterType      && it.item_type      !== filterType)      return false;
    if (filterDiff      && String(it.difficulty) !== filterDiff)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!it.question?.toLowerCase().includes(q) &&
          !it.item_code?.toLowerCase().includes(q) &&
          !it.subdomain_code?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const clearAll = useCallback(() => {
    setSearch(''); setFilterStage(''); setFilterAge(''); setFilterConcern('');
    setFilterSubdomain(''); setFilterType(''); setFilterDiff('');
  }, []);

  const exportCsv = () => {
    window.open('/api/sdi/admin/export?type=items', '_blank');
  };

  const sel = (val: string, set: (v: string) => void, opts: string[], placeholder: string, labelMap?: Record<string,string>) => (
    <select value={val} onChange={e => set(e.target.value)}
      className="h-8 px-2 pr-7 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-violet-400 bg-white appearance-none cursor-pointer">
      <option value="">{placeholder}</option>
      {opts.map(o => <option key={o} value={o}>{labelMap?.[o] ?? o}</option>)}
    </select>
  );

  return (
    <>
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      <Card>
        <CardHeader className="pb-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Item Bank</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {filtered.length.toLocaleString()}{filtered.length !== allItems.length ? `/${allItems.length.toLocaleString()}` : ''} items
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowFilters(f => !f)}>
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilters > 0 && (
                  <span className="bg-violet-600 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{activeFilters}</span>
                )}
                <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setShowImport(true)}>
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </Button>
            </div>
          </div>

          {/* Search always visible */}
          <div className="mt-3">
            <input type="text" placeholder="Search by question, code or subdomain…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 px-3 rounded-md border border-gray-200 text-xs w-80 focus:outline-none focus:border-violet-400" />
          </div>

          {/* Collapsible filter row */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-full mb-0.5">Filter by</span>
              {sel(filterStage,   setFilterStage,   stages,     'All Stages',     STAGE_LABELS)}
              {sel(filterAge,     setFilterAge,     ageBands,   'All Age Bands')}
              {sel(filterConcern, setFilterConcern, concerns,   'All Concerns')}
              {sel(filterSubdomain, setFilterSubdomain, subdomains, 'All Subdomains')}
              {sel(filterType,    setFilterType,    types,      'All Types')}
              {sel(filterDiff,    setFilterDiff,    diffs,      'All Difficulties')}
              {activeFilters > 0 && (
                <button onClick={clearAll}
                  className="h-8 px-3 rounded-md border border-gray-200 text-xs text-gray-500 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center gap-1">
                  <X className="h-3 w-3" /> Clear all
                </button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Loading / Empty */}
          {items.isLoading && (
            <div className="text-center py-10 text-gray-400 text-sm">Loading items…</div>
          )}
          {!items.isLoading && allItems.length === 0 && (
            <div className="text-center py-10 text-gray-400 border border-dashed rounded-lg text-sm">
              No SDI items yet — use <strong>Import CSV</strong> to populate the question bank
            </div>
          )}
          {!items.isLoading && allItems.length > 0 && filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 border border-dashed rounded-lg text-sm">
              No items match the current filters
              <button onClick={clearAll} className="block mx-auto mt-2 text-xs text-violet-600 hover:underline">Clear filters</button>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[620px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold w-44">Code</th>
                      <th className="px-3 py-2.5 text-left font-semibold w-44">Subdomain</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Question</th>
                      <th className="px-3 py-2.5 text-left font-semibold w-28">Type</th>
                      <th className="px-3 py-2.5 text-left font-semibold w-16">Diff.</th>
                      <th className="px-3 py-2.5 text-left font-semibold w-24">Stage</th>
                      <th className="px-3 py-2.5 text-left font-semibold w-16">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((it: any) => {
                      const sc  = it.stage_code as string;
                      const col = STAGE_COLORS[sc] || { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' };
                      const isAnchor = it.anchor || it.item_type === 'anchor';
                      return (
                        <tr key={it.id} className="hover:bg-violet-50/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-[10px] text-gray-600 block leading-tight">{it.item_code || '—'}</span>
                            {isAnchor && (
                              <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                Anchor
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">{it.subdomain_code || '—'}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-xs text-gray-900 leading-snug line-clamp-2">{it.question}</p>
                            {it.focus_area && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{it.focus_area}{it.layer_tag ? ` · ${it.layer_tag}` : ''}</p>
                            )}
                            {it.concern_name && (
                              <p className="text-[10px] text-violet-500 mt-0.5">{it.concern_name}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-medium">{it.item_type || 'standard'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-xs font-semibold text-gray-700">{it.difficulty ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {sc ? (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                                {STAGE_LABELS[sc] || sc}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-[10px] text-gray-500">{it.age_band || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > 100 && (
                <div className="px-3 py-2 bg-gray-50 border-t text-[10px] text-gray-400 text-right">
                  Showing all {filtered.length.toLocaleString()} matching items
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
