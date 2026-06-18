/**
 * /app/frontend/src/pages/LBIAdminPage.tsx
 * LBI Behavioural Framework — full admin page mirroring the Competency architecture.
 * 10 tabs: Overview · Domains · Subdomains · Age Bands · Items · Norms · Weights · Clusters · Learning · Versions
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Layers, GitBranch, Target, Sliders, BarChart3, History, Sparkles, BookOpen, Users, FileSpreadsheet, Search } from 'lucide-react';
import { NormsTab, WeightsTab, ClustersTab, LearningMappingsTab, VersionsTab } from '@/components/admin/parity-tabs';

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export default function LBIAdminPage({ onNavigate, embedded = false }: { onNavigate?: (p: string) => void; embedded?: boolean }) {
  const [tab, setTab] = useState<'overview' | 'domains' | 'subdomains' | 'age-bands' | 'items' | 'norms' | 'weights' | 'clusters' | 'versions' | 'learning'>('overview');

  const innerContent = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList className="flex flex-wrap mb-6 bg-white border shadow-sm h-auto p-1 gap-1">
        <TabsTrigger value="overview"><Sparkles className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
        <TabsTrigger value="domains"><Layers className="h-4 w-4 mr-1.5" />Domains</TabsTrigger>
        <TabsTrigger value="subdomains"><Target className="h-4 w-4 mr-1.5" />Subdomains</TabsTrigger>
        <TabsTrigger value="age-bands"><Users className="h-4 w-4 mr-1.5" />Age Bands</TabsTrigger>
        <TabsTrigger value="items"><FileSpreadsheet className="h-4 w-4 mr-1.5" />Items</TabsTrigger>
        <TabsTrigger value="norms"><BarChart3 className="h-4 w-4 mr-1.5" />Norms</TabsTrigger>
        <TabsTrigger value="weights"><Sliders className="h-4 w-4 mr-1.5" />Weights</TabsTrigger>
        <TabsTrigger value="clusters"><GitBranch className="h-4 w-4 mr-1.5" />Clusters</TabsTrigger>
        <TabsTrigger value="learning"><BookOpen className="h-4 w-4 mr-1.5" />Learning</TabsTrigger>
        <TabsTrigger value="versions"><History className="h-4 w-4 mr-1.5" />Versions</TabsTrigger>
      </TabsList>

      <TabsContent value="overview"><LbiOverview /></TabsContent>
      <TabsContent value="domains"><LbiSimpleList path="/api/lbi/domains" col1="domain_code" col2="domain_name" col3="description" /></TabsContent>
      <TabsContent value="subdomains"><LbiSimpleList path="/api/lbi/admin/subdomains" col1="subdomain_code" col2="subdomain_name" col3="domain_code" /></TabsContent>
      <TabsContent value="age-bands"><LbiSimpleList path="/api/lbi/admin/age-bands" col1="band_code" col2="band_name" col3="grade_range" /></TabsContent>
      <TabsContent value="items"><LbiItemsList /></TabsContent>
      <TabsContent value="norms"><NormsTab basePath="/api/lbi/admin/subdomain-norms" stagesPath="/api/lbi/admin/age-bands" stageKey="age_band_code" stageLabel="Age band" /></TabsContent>
      <TabsContent value="weights"><WeightsTab basePath="/api/lbi/admin/age-band-weights" stagesPath="/api/lbi/admin/age-bands" stageKey="age_band_code" stageLabel="Age band" /></TabsContent>
      <TabsContent value="clusters"><ClustersTab basePath="/api/lbi/admin/clusters" subdomainsPath="/api/lbi/admin/subdomains" /></TabsContent>
      <TabsContent value="learning"><LearningMappingsTab basePath="/api/lbi/admin/learning-mappings" subdomainsPath="/api/lbi/admin/subdomains" /></TabsContent>
      <TabsContent value="versions"><VersionsTab basePath="/api/lbi/admin/versions" summaryPath="/api/lbi/admin/engine-summary" /></TabsContent>
    </Tabs>
  );

  if (embedded) {
    return <div className="space-y-4">{innerContent}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50/30 px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('super-admin')} data-testid="lbi-back">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="lbi-page-title">
                <Layers className="h-7 w-7 text-blue-600" />
                LBI Behavioural Framework
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">19 domains · 97 subdomains · 6 age bands · stress, adjustment, discipline</p>
            </div>
          </div>
        </div>
        {innerContent}
      </div>
    </div>
  );
}

function LbiOverview() {
  const { isAuthenticated } = useAuth();
  const stats = useQuery<Record<string, number>>({ queryKey: ['/api/lbi/admin/engine-summary'], enabled: isAuthenticated, queryFn: () => jget('/api/lbi/admin/engine-summary') });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> LBI Engine Overview</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.data && Object.entries(stats.data).map(([k, v]) => (
            <div key={k} className="bg-gradient-to-br from-blue-50 to-white border rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-900">{v as number}</div>
              <div className="text-xs text-gray-500 mt-1">{k.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LbiSimpleList({ path, col1, col2, col3 }: { path: string; col1: string; col2: string; col3: string }) {
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


function LbiItemsList() {
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 50;

  const domains = useQuery<any[]>({ queryKey: ['/api/lbi/domains'], queryFn: () => jget('/api/lbi/domains') });
  const url = `/api/lbi/admin/questions-all?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&domain=${domain}`;
  const items = useQuery<{ questions: any[]; total: number; totalPages: number; page: number }>({
    queryKey: [url], queryFn: () => jget(url),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            LBI Question Bank
            <Badge variant="outline" className="ml-2" data-testid="lbi-items-count">{items.data?.total ?? 0}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-gray-400" />
              <Input
                placeholder="Search code or text…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-7 h-8 text-xs w-56"
                data-testid="lbi-items-search"
              />
            </div>
            <select
              className="border rounded-md px-2 h-8 text-xs"
              value={domain}
              onChange={e => { setDomain(e.target.value); setPage(1); }}
              data-testid="lbi-items-domain-filter"
            >
              <option value="all">All domains</option>
              {domains.data?.map((d: any) => (
                <option key={d.domain_code || d.id} value={d.domain_code}>{d.domain_code} — {d.domain_name}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">Items are mapped to subdomains × age bands. Bulk import via Super Admin → LBI question upload.</p>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Domain</th>
                <th className="text-left p-2">Subdomain</th>
                <th className="text-left p-2">Question</th>
                <th className="text-left p-2">Age band</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.data?.questions?.map((q: any) => (
                <tr key={q.id} className="hover:bg-gray-50" data-testid={`lbi-item-row-${q.id}`}>
                  <td className="p-2 font-mono text-[10px] text-gray-600">{q.questionCode || `Q${q.id}`}</td>
                  <td className="p-2 font-mono text-[10px]">{q.domainCode || '—'}</td>
                  <td className="p-2 font-mono text-[10px]">{q.subdomainCode || '—'}</td>
                  <td className="p-2">{(q.questionText || '').slice(0, 90)}{(q.questionText || '').length > 90 ? '…' : ''}</td>
                  <td className="p-2 font-mono text-[10px]">{q.ageBandCode || '—'}</td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px]">{q.status || 'active'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(items.data?.questions?.length ?? 0) === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm" data-testid="lbi-items-empty">No items match the filters</div>
          )}
        </div>
        {items.data && items.data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>Page {items.data.page} of {items.data.totalPages} · {items.data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="lbi-items-prev">Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= items.data.totalPages} onClick={() => setPage(p => p + 1)} data-testid="lbi-items-next">Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
