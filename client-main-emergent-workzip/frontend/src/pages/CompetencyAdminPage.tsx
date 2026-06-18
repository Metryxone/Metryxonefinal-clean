import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Upload, Download, Trash2, Edit2, RefreshCw, Layers, GitBranch, Target, Briefcase, Sliders, BarChart3, FileSpreadsheet, AlertCircle, CheckCircle2, Sparkles, Users, History, Save } from 'lucide-react';

const API = ''; // use relative URLs (same origin)

interface Domain { id: string; code: string; name: string; description?: string; color?: string; weight: number; display_order: number; is_active: boolean; subdomains?: any[] }
interface Competency { id: string; domain_id: string; code: string; name: string; description?: string; competency_type: string; proficiency_levels: Record<string,string>; is_active: boolean; display_order: number }
interface Cluster { id: string; code: string; name: string; description?: string; competencies: { id: string; code: string; name: string }[] }
interface Item { id: string; competency_id: string; competency_code?: string; competency_name?: string; code: string; item_type: string; difficulty: number; level: number; question: string; expected_time: number; options: { id: string; text: string; score_value: number }[] }
interface RoleSummary { role_code: string; role_name: string; competency_count: number }
interface RoleWeight { id: string; role_code: string; competency_id: string; competency_code: string; competency_name: string; domain_code: string; weight: number; weight_type: string }
interface StageNorm { id: string; stage_code: string; stage_name: string; competency_id: string; competency_code: string; competency_name: string; min_score: number; median_score: number; top10_score: number }

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(API + url, { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jsend(method: 'POST'|'PATCH'|'DELETE', url: string, body?: any) {
  const r = await fetch(API + url, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}

export default function CompetencyAdminPage({ onNavigate, embedded = false }: { onNavigate?: (p: string) => void; embedded?: boolean }) {
  const [tab, setTab] = useState<'domains'|'competencies'|'clusters'|'items'|'roles'|'norms'|'cohorts'|'versions'|'sdi'>('domains');

  // Embedded mode: just the Tabs (no outer wrapper, no header). Used inside Super Admin Dashboard.
  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/competency/responses/export', '_blank')} data-testid="btn-export-responses">
            <Download className="h-4 w-4 mr-1.5" />Export Responses CSV
          </Button>
          <StatsStrip />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} data-testid="competency-tabs">
          <TabsList className="flex flex-wrap mb-4 bg-white border shadow-sm h-auto p-1 gap-1">
            <TabsTrigger value="domains" data-testid="tab-domains"><Layers className="h-4 w-4 mr-1.5" />Domains</TabsTrigger>
            <TabsTrigger value="competencies" data-testid="tab-competencies"><Target className="h-4 w-4 mr-1.5" />Competencies</TabsTrigger>
            <TabsTrigger value="clusters" data-testid="tab-clusters"><GitBranch className="h-4 w-4 mr-1.5" />Clusters</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items"><FileSpreadsheet className="h-4 w-4 mr-1.5" />Items</TabsTrigger>
            <TabsTrigger value="roles" data-testid="tab-roles"><Briefcase className="h-4 w-4 mr-1.5" />Role Weights</TabsTrigger>
            <TabsTrigger value="norms" data-testid="tab-norms"><BarChart3 className="h-4 w-4 mr-1.5" />Stage Norms</TabsTrigger>
            <TabsTrigger value="cohorts" data-testid="tab-cohorts"><Users className="h-4 w-4 mr-1.5" />Cohorts</TabsTrigger>
            <TabsTrigger value="versions" data-testid="tab-versions"><History className="h-4 w-4 mr-1.5" />Versions</TabsTrigger>
            <TabsTrigger value="sdi" data-testid="tab-sdi"><Sparkles className="h-4 w-4 mr-1.5" />CAPADEX</TabsTrigger>
          </TabsList>

          <TabsContent value="domains"><DomainsTab /></TabsContent>
          <TabsContent value="competencies"><CompetenciesTab /></TabsContent>
          <TabsContent value="clusters"><ClustersTab /></TabsContent>
          <TabsContent value="items"><ItemsTab /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
          <TabsContent value="norms"><NormsTab /></TabsContent>
          <TabsContent value="cohorts"><CohortsTab /></TabsContent>
          <TabsContent value="versions"><VersionsTab /></TabsContent>
          <TabsContent value="sdi"><SdiTab /></TabsContent>
        </Tabs>
      </div>
    );
  }

  // Standalone mode (default): full page with header.
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-6 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.('super-admin')}
              data-testid="btn-back-superadmin"
              className="hover:bg-white/80"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">
                Professional Competency Framework
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure domains, competencies, clusters, items, role weights and stage norms
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => window.open('/api/competency/responses/export', '_blank')} data-testid="btn-export-responses-page">
              <Download className="h-4 w-4 mr-1.5" />Export Responses CSV
            </Button>
            <StatsStrip />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} data-testid="competency-tabs">
          <TabsList className="flex flex-wrap mb-6 bg-white border shadow-sm h-auto p-1 gap-1">
            <TabsTrigger value="domains" data-testid="tab-domains"><Layers className="h-4 w-4 mr-1.5" />Domains</TabsTrigger>
            <TabsTrigger value="competencies" data-testid="tab-competencies"><Target className="h-4 w-4 mr-1.5" />Competencies</TabsTrigger>
            <TabsTrigger value="clusters" data-testid="tab-clusters"><GitBranch className="h-4 w-4 mr-1.5" />Clusters</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items"><FileSpreadsheet className="h-4 w-4 mr-1.5" />Items</TabsTrigger>
            <TabsTrigger value="roles" data-testid="tab-roles"><Briefcase className="h-4 w-4 mr-1.5" />Role Weights</TabsTrigger>
            <TabsTrigger value="norms" data-testid="tab-norms"><BarChart3 className="h-4 w-4 mr-1.5" />Stage Norms</TabsTrigger>
            <TabsTrigger value="cohorts" data-testid="tab-cohorts"><Users className="h-4 w-4 mr-1.5" />Cohorts</TabsTrigger>
            <TabsTrigger value="versions" data-testid="tab-versions"><History className="h-4 w-4 mr-1.5" />Versions</TabsTrigger>
            <TabsTrigger value="sdi" data-testid="tab-sdi"><Sparkles className="h-4 w-4 mr-1.5" />CAPADEX</TabsTrigger>
          </TabsList>

          <TabsContent value="domains"><DomainsTab /></TabsContent>
          <TabsContent value="competencies"><CompetenciesTab /></TabsContent>
          <TabsContent value="clusters"><ClustersTab /></TabsContent>
          <TabsContent value="items"><ItemsTab /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
          <TabsContent value="norms"><NormsTab /></TabsContent>
          <TabsContent value="cohorts"><CohortsTab /></TabsContent>
          <TabsContent value="versions"><VersionsTab /></TabsContent>
          <TabsContent value="sdi"><SdiTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------------- Stats strip ---------------- */
function StatsStrip() {
  const { data } = useQuery({
    queryKey: ['/api/competency/stats'],
    queryFn: () => jget<any>('/api/competency/stats'),
  });
  if (!data) return null;
  const tiles = [
    { l: 'Domains', v: data.domains, c: 'text-indigo-600 bg-indigo-50' },
    { l: 'Competencies', v: data.competencies, c: 'text-fuchsia-600 bg-fuchsia-50' },
    { l: 'Items', v: data.assessment_items, c: 'text-emerald-600 bg-emerald-50' },
    { l: 'Role Weights', v: data.role_weights, c: 'text-amber-600 bg-amber-50' },
  ];
  return (
    <div className="hidden md:flex gap-2" data-testid="stats-strip">
      {tiles.map(t => (
        <div key={t.l} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${t.c}`}>
          <span className="opacity-70 mr-1.5">{t.l}</span><span className="text-base">{t.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ============== DOMAINS TAB ============== */
function DomainsTab() {
  const { data: domains = [], refetch } = useQuery({
    queryKey: ['/api/competency/domains', 'flat'],
    queryFn: () => jget<Domain[]>('/api/competency/domains'),
  });
  const [editing, setEditing] = useState<Domain | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Top-level groupings of competencies. Color is used in radar charts.</p>
        <Button onClick={() => setAdding(true)} data-testid="btn-add-domain"><Plus className="h-4 w-4 mr-1.5" />Add Domain</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="domain-list">
        {domains.map(d => (
          <Card key={d.id} className="hover:shadow-md transition-shadow" data-testid={`domain-${d.code}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color || '#9ca3af' }} />
                  <span className="text-xs font-mono text-gray-500">{d.code}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(d)} data-testid={`btn-edit-${d.code}`}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                    onClick={async () => {
                      if (!confirm(`Delete domain ${d.name}? All competencies inside will also be deleted.`)) return;
                      try { await jsend('DELETE', `/api/competency/domains/${d.id}`); toast.success('Deleted'); refetch(); }
                      catch (e: any) { toast.error(e.message); }
                    }}
                    data-testid={`btn-delete-${d.code}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold text-base">{d.name}</h3>
              {d.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-[10px]">weight {d.weight}</Badge>
                <Badge variant="outline" className="text-[10px]">order {d.display_order}</Badge>
                {!d.is_active && <Badge variant="destructive" className="text-[10px]">inactive</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {(adding || editing) && (
        <DomainDialog
          domain={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { refetch(); setAdding(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function DomainDialog({ domain, onClose, onSaved }: { domain: Domain | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(domain?.code || '');
  const [name, setName] = useState(domain?.name || '');
  const [description, setDescription] = useState(domain?.description || '');
  const [color, setColor] = useState(domain?.color || '#6366f1');
  const [weight, setWeight] = useState(String(domain?.weight ?? 1));
  const [order, setOrder] = useState(String(domain?.display_order ?? 0));
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="domain-dialog">
        <DialogHeader>
          <DialogTitle>{domain ? 'Edit Domain' : 'Add Domain'}</DialogTitle>
          <DialogDescription>Domains group competencies. Use a unique code (e.g., COG, FUNC).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={!!domain} data-testid="input-domain-code" placeholder="e.g., COG" /></div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-domain-name" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-domain-desc" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} data-testid="input-domain-color" /></div>
            <div><Label>Weight</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} data-testid="input-domain-weight" /></div>
            <div><Label>Order</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} data-testid="input-domain-order" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving || !code || !name}
            onClick={async () => {
              setSaving(true);
              try {
                const body = { code, name, description, color, weight: parseFloat(weight), display_order: parseInt(order) };
                if (domain) await jsend('PATCH', `/api/competency/domains/${domain.id}`, body);
                else await jsend('POST', '/api/competency/domains', body);
                toast.success(domain ? 'Updated' : 'Created');
                onSaved();
              } catch (e: any) { toast.error(e.message); }
              finally { setSaving(false); }
            }}
            data-testid="btn-save-domain"
          >{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== COMPETENCIES TAB ============== */
function CompetenciesTab() {
  const { data: domains = [] } = useQuery({ queryKey: ['/api/competency/domains', 'flat'], queryFn: () => jget<Domain[]>('/api/competency/domains') });
  const [domainId, setDomainId] = useState<string>('all');
  const { data: competencies = [], refetch } = useQuery({
    queryKey: ['/api/competency/competencies', domainId],
    queryFn: () => jget<Competency[]>(domainId === 'all' ? '/api/competency/competencies' : `/api/competency/competencies?domain_id=${domainId}`),
  });
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Competency | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = competencies.filter(c => !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={domainId} onValueChange={setDomainId}>
            <SelectTrigger className="w-56" data-testid="select-domain-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {domains.map(d => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search by code or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" data-testid="input-comp-search" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/api/competency/competencies/template', '_blank')} data-testid="btn-download-template">
            <Download className="h-4 w-4 mr-1.5" />Template
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)} data-testid="btn-import-csv">
            <Upload className="h-4 w-4 mr-1.5" />Import CSV
          </Button>
          <Button onClick={() => setAdding(true)} data-testid="btn-add-competency"><Plus className="h-4 w-4 mr-1.5" />Add Competency</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto" data-testid="competency-table">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Domain</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-12">No competencies match your filters.</td></tr>
                ) : filtered.map(c => {
                  const dom = domains.find(d => d.id === c.domain_id);
                  return (
                    <tr key={c.id} className="border-t hover:bg-gray-50/60" data-testid={`row-${c.code}`}>
                      <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2">
                        {dom && <Badge variant="outline" className="text-[10px]" style={{ borderColor: dom.color, color: dom.color }}>{dom.code}</Badge>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 capitalize">{c.competency_type}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{c.display_order}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600"
                          onClick={async () => {
                            if (!confirm(`Delete ${c.name}?`)) return;
                            try { await jsend('DELETE', `/api/competency/competencies/${c.id}`); toast.success('Deleted'); refetch(); }
                            catch (e: any) { toast.error(e.message); }
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {(adding || editing) && (
        <CompetencyDialog
          competency={editing}
          domains={domains}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { refetch(); setAdding(false); setEditing(null); }}
        />
      )}
      {showImport && <ImportDialog title="Import Competencies (CSV)" endpoint="/api/competency/competencies/import" templateUrl="/api/competency/competencies/template" onClose={() => setShowImport(false)} onDone={() => { refetch(); setShowImport(false); }} />}
    </div>
  );
}

function CompetencyDialog({ competency, domains, onClose, onSaved }: { competency: Competency | null; domains: Domain[]; onClose: () => void; onSaved: () => void }) {
  const [domainId, setDomainId] = useState(competency?.domain_id || domains[0]?.id || '');
  const [code, setCode] = useState(competency?.code || '');
  const [name, setName] = useState(competency?.name || '');
  const [description, setDescription] = useState(competency?.description || '');
  const [type, setType] = useState(competency?.competency_type || 'behavioral');
  const [order, setOrder] = useState(String(competency?.display_order ?? 0));
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="competency-dialog">
        <DialogHeader>
          <DialogTitle>{competency ? 'Edit Competency' : 'Add Competency'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label>Domain</Label>
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger data-testid="select-comp-domain"><SelectValue /></SelectTrigger>
              <SelectContent>{domains.map(d => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={!!competency} placeholder="e.g., COG_C25" data-testid="input-comp-code" /></div>
            <div><Label>Order</Label><Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} data-testid="input-comp-order" /></div>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-comp-name" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-comp-desc" /></div>
          <div><Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-comp-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cognitive">Cognitive</SelectItem>
                <SelectItem value="functional">Functional</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="interpersonal">Interpersonal</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving || !code || !name || !domainId}
            onClick={async () => {
              setSaving(true);
              try {
                const body: any = { domain_id: domainId, code, name, description, competency_type: type, display_order: parseInt(order) };
                if (competency) await jsend('PATCH', `/api/competency/competencies/${competency.id}`, body);
                else await jsend('POST', '/api/competency/competencies', body);
                toast.success(competency ? 'Updated' : 'Created');
                onSaved();
              } catch (e: any) { toast.error(e.message); }
              finally { setSaving(false); }
            }}
            data-testid="btn-save-comp"
          >{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== IMPORT DIALOG (reusable for CSV imports) ============== */
function ImportDialog({ title, endpoint, templateUrl, onClose, onDone }: { title: string; endpoint: string; templateUrl: string; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created?: number; updated?: number; skipped?: number; total?: number; errors?: any[] } | null>(null);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(API + endpoint, { method: 'POST', credentials: 'include', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Upload failed');
      setResult(d);
      const c = d.created || 0;
      if (c > 0) toast.success(`${c} rows imported`);
      else toast.warning('No new rows imported');
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Download the template, fill it in, then upload below. The first import row should reference real codes that already exist in the system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(templateUrl, '_blank')} data-testid="btn-dl-template">
              <Download className="h-4 w-4 mr-1.5" />Download Template CSV
            </Button>
          </div>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-gray-50/50">
            <input
              ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="input-csv-file"
            />
            {file ? (
              <div>
                <FileSpreadsheet className="h-10 w-10 mx-auto text-emerald-600 mb-2" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; setResult(null); }}>Choose different file</Button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-testid="btn-pick-file">Choose CSV file</Button>
                <p className="text-xs text-gray-400 mt-2">UTF-8 CSV, max 5 MB</p>
              </div>
            )}
          </div>
          {result && (
            <div className="border rounded-lg p-3 bg-white">
              <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                <div className="bg-emerald-50 text-emerald-700 rounded p-2"><div className="text-xl font-bold">{result.created ?? 0}</div>created</div>
                <div className="bg-blue-50 text-blue-700 rounded p-2"><div className="text-xl font-bold">{result.updated ?? 0}</div>updated</div>
                <div className="bg-amber-50 text-amber-700 rounded p-2"><div className="text-xl font-bold">{result.skipped ?? 0}</div>skipped</div>
                <div className="bg-red-50 text-red-700 rounded p-2"><div className="text-xl font-bold">{result.errors?.length ?? 0}</div>errors</div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />Errors (first {Math.min(50, result.errors.length)})
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-red-50/50 rounded p-2 text-xs font-mono space-y-1">
                    {result.errors.map((e: any, i: number) => (
                      <div key={i}>Row {e.row}: {e.message}</div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-2 text-xs"
                    onClick={() => navigator.clipboard.writeText(result.errors!.map((e: any) => `Row ${e.row}: ${e.message}`).join('\n'))}>
                    Copy errors
                  </Button>
                </div>
              )}
              {result.errors?.length === 0 && (result.created || 0) + (result.updated || 0) > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />All rows processed cleanly.</div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={busy || !file} onClick={upload} data-testid="btn-upload-csv">
            {busy ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
            {busy ? 'Importing...' : 'Import'}
          </Button>
          {result && (result.created || 0) + (result.updated || 0) > 0 && (
            <Button variant="default" onClick={onDone} data-testid="btn-done-import">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== CLUSTERS TAB ============== */
function ClustersTab() {
  const { data: clusters = [], refetch } = useQuery({ queryKey: ['/api/competency/clusters'], queryFn: () => jget<Cluster[]>('/api/competency/clusters') });
  const { data: competencies = [] } = useQuery({ queryKey: ['/api/competency/competencies'], queryFn: () => jget<Competency[]>('/api/competency/competencies') });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Cluster | null>(null);

  const remove = async (c: Cluster) => {
    if (!confirm(`Delete cluster "${c.name}"? This will unmap ${c.competencies.length} competencies.`)) return;
    try {
      await jsend('DELETE', `/api/competency/clusters/${c.id}`);
      toast.success('Cluster deleted');
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Group competencies into reporting clusters (e.g., Problem Solving, Communication). Click a card to manage its competency mapping.</p>
        <Button onClick={() => setAdding(true)} data-testid="btn-add-cluster"><Plus className="h-4 w-4 mr-1.5" />Add Cluster</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="cluster-list">
        {clusters.map(cl => (
          <Card key={cl.id} data-testid={`cluster-${cl.code}`} className="hover:border-indigo-200 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-gray-500">{cl.code}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{cl.competencies.length} comps</Badge>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(cl)} data-testid={`edit-cluster-${cl.code}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => remove(cl)} data-testid={`delete-cluster-${cl.code}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <h3 className="font-semibold text-base">{cl.name}</h3>
              {cl.description && <p className="text-xs text-gray-500 mt-1">{cl.description}</p>}
              <div className="flex flex-wrap gap-1 mt-2">
                {cl.competencies.slice(0, 6).map(c => (
                  <Badge key={c.id} variant="outline" className="text-[10px] font-mono">{c.code}</Badge>
                ))}
                {cl.competencies.length > 6 && <Badge variant="outline" className="text-[10px]">+{cl.competencies.length - 6}</Badge>}
                {cl.competencies.length === 0 && <span className="text-[10px] text-amber-600 italic">No competencies mapped — click edit</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {clusters.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400 border border-dashed rounded-lg">
            <GitBranch className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No clusters yet. Click "Add Cluster" above to create one.</p>
          </div>
        )}
      </div>
      {adding && <ClusterDialog competencies={competencies} onClose={() => setAdding(false)} onSaved={() => { refetch(); setAdding(false); }} />}
      {editing && <ClusterEditDialog cluster={editing} competencies={competencies} onClose={() => setEditing(null)} onSaved={() => { refetch(); setEditing(null); }} />}
    </div>
  );
}

function ClusterEditDialog({ cluster, competencies, onClose, onSaved }: { cluster: Cluster; competencies: Competency[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(cluster.name);
  const [description, setDescription] = useState(cluster.description || '');
  const [picked, setPicked] = useState<string[]>(cluster.competencies.map(c => c.id));
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = competencies.filter(c =>
    !filter || c.code.toLowerCase().includes(filter.toLowerCase()) || c.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Cluster — {cluster.code}</DialogTitle>
          <DialogDescription>Adjust the competencies mapped to this cluster.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={cluster.code} disabled /></div>
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-cluster-edit-name" /></div>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Mapped competencies ({picked.length} of {competencies.length})</Label>
              <Input className="w-44 h-7 text-xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto p-2 grid grid-cols-2 gap-1 mt-1">
              {filtered.map(c => (
                <label key={c.id} className={`text-xs flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer ${picked.includes(c.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter(x => x !== c.id))} />
                  <span className="font-mono text-gray-500">{c.code}</span> — {c.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !name} onClick={async () => {
            setSaving(true);
            try {
              await jsend('PATCH', `/api/competency/clusters/${cluster.id}`, { name, description, competency_ids: picked });
              toast.success('Cluster updated');
              onSaved();
            } catch (e: any) { toast.error(e.message); }
            finally { setSaving(false); }
          }} data-testid="btn-save-cluster-edit">
            {saving && <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClusterDialog({ competencies, onClose, onSaved }: { competencies: Competency[]; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create Cluster</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., CLU_PROBLEM" data-testid="input-cluster-code" /></div>
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-cluster-name" /></div>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-cluster-desc" /></div>
          <div>
            <Label>Map competencies ({picked.length} selected)</Label>
            <div className="border rounded-md max-h-64 overflow-y-auto p-2 grid grid-cols-2 gap-1 mt-1">
              {competencies.map(c => (
                <label key={c.id} className="text-xs flex items-center gap-1.5 hover:bg-gray-50 px-1 py-0.5 rounded cursor-pointer">
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter(x => x !== c.id))} />
                  <span className="font-mono text-gray-500">{c.code}</span> — {c.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !code || !name} onClick={async () => {
            setSaving(true);
            try {
              await jsend('POST', '/api/competency/clusters', { code, name, description, competency_ids: picked });
              toast.success('Cluster created');
              onSaved();
            } catch (e: any) { toast.error(e.message); }
            finally { setSaving(false); }
          }}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== ITEMS TAB ============== */
function ItemsTab() {
  const { data: items = [], refetch } = useQuery({ queryKey: ['/api/competency/items'], queryFn: () => jget<Item[]>('/api/competency/items') });
  const { data: competencies = [] } = useQuery({ queryKey: ['/api/competency/competencies'], queryFn: () => jget<Competency[]>('/api/competency/competencies') });
  const [showImport, setShowImport] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [aiDraftFor, setAiDraftFor] = useState<string | null>(null);

  const filtered = items.filter(i => !search || i.code.toLowerCase().includes(search.toLowerCase()) || i.question.toLowerCase().includes(search.toLowerCase()) || (i.competency_code || '').toLowerCase().includes(search.toLowerCase()));

  const aiDraft = async (competencyId: string, code: string, language: string) => {
    setAiDraftFor(code);
    try {
      const r = await fetch('/api/competency/items/ai-draft', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competency_id: competencyId, language }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'AI draft failed');
      toast.success(`AI-drafted ${d.item.code} in ${language.toUpperCase()}`);
      refetch();
    } catch (e: any) { toast.error(e.message); }
    finally { setAiDraftFor(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Input placeholder="Search code, competency or question…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-80" data-testid="input-item-search" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('/api/competency/items/template', '_blank')}><Download className="h-4 w-4 mr-1.5" />Template</Button>
          <Button variant="outline" onClick={() => setShowImport(true)} data-testid="btn-import-items"><Upload className="h-4 w-4 mr-1.5" />Import CSV</Button>
          <CompetencyAiDraftPicker competencies={competencies} onDraft={aiDraft} busyCode={aiDraftFor} />
          <Button onClick={() => setAdding(true)} data-testid="btn-add-item"><Plus className="h-4 w-4 mr-1.5" />Add Item</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Competency</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Question</th>
                  <th className="px-3 py-2 text-left">Options</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-12">No items yet. Use Import CSV to bulk-load.</td></tr>
                ) : filtered.map(it => (
                  <tr key={it.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-3 py-2 font-mono text-xs">{it.code}</td>
                    <td className="px-3 py-2 text-xs">{it.competency_code} — <span className="text-gray-500">{it.competency_name}</span></td>
                    <td className="px-3 py-2 text-xs capitalize">{it.item_type} · L{it.level} · D{it.difficulty}</td>
                    <td className="px-3 py-2 text-xs max-w-md truncate" title={it.question}>{it.question}</td>
                    <td className="px-3 py-2 text-xs">{it.options.length}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={async () => {
                        if (!confirm('Delete this item?')) return;
                        try { await jsend('DELETE', `/api/competency/items/${it.id}`); toast.success('Deleted'); refetch(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {showImport && <ImportDialog title="Import Assessment Items (CSV)" endpoint="/api/competency/items/import" templateUrl="/api/competency/items/template" onClose={() => setShowImport(false)} onDone={() => { refetch(); setShowImport(false); }} />}
      {adding && <ItemDialog competencies={competencies} onClose={() => setAdding(false)} onSaved={() => { refetch(); setAdding(false); }} />}
    </div>
  );
}

function ItemDialog({ competencies, onClose, onSaved }: { competencies: Competency[]; onClose: () => void; onSaved: () => void }) {
  const [competencyId, setCompetencyId] = useState(competencies[0]?.id || '');
  const [code, setCode] = useState('');
  const [question, setQuestion] = useState('');
  const [itemType, setItemType] = useState('mcq');
  const [difficulty, setDifficulty] = useState('3');
  const [level, setLevel] = useState('3');
  const [expectedTime, setExpectedTime] = useState('60');
  const [options, setOptions] = useState<{ text: string; score_value: string }[]>([
    { text: '', score_value: '0' }, { text: '', score_value: '0' }, { text: '', score_value: '0' }, { text: '', score_value: '0' },
  ]);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add Assessment Item</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Competency</Label>
              <Select value={competencyId} onValueChange={setCompetencyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">{competencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Item Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., COG_C02_I01" data-testid="input-item-code" /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Type</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">MCQ</SelectItem>
                  <SelectItem value="scenario">Scenario</SelectItem>
                  <SelectItem value="case">Case</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="simulation">Simulation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Difficulty (1-5)</Label><Input type="number" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} /></div>
            <div><Label>Level (1-5)</Label><Input type="number" min={1} max={5} value={level} onChange={(e) => setLevel(e.target.value)} /></div>
            <div><Label>Time (sec)</Label><Input type="number" value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)} /></div>
          </div>
          <div><Label>Question</Label><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} data-testid="input-item-question" /></div>
          <div>
            <Label>Options (text + score 0–100)</Label>
            <div className="space-y-2 mt-1">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" value={o.text} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                  <Input className="w-24" type="number" min={0} max={100} value={o.score_value} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, score_value: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !code || !question || !competencyId} onClick={async () => {
            setSaving(true);
            try {
              await jsend('POST', '/api/competency/items', {
                competency_id: competencyId, code, item_type: itemType, difficulty: parseInt(difficulty), level: parseInt(level),
                question, expected_time: parseInt(expectedTime),
                options: options.filter(o => o.text.trim()).map(o => ({ text: o.text, score_value: parseFloat(o.score_value) || 0 })),
              });
              toast.success('Item created');
              onSaved();
            } catch (e: any) { toast.error(e.message); }
            finally { setSaving(false); }
          }}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== ROLES TAB ============== */
function RolesTab() {
  const { data: roles = [], refetch: refetchRoles } = useQuery({ queryKey: ['/api/competency/role-weights'], queryFn: () => jget<RoleSummary[]>('/api/competency/role-weights') });
  const [pickedRole, setPickedRole] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Each role assigns a weight (and weight-type) to every competency. These drive Employability Index.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/competency/role-weights/template', '_blank')}>
            <Download className="h-4 w-4 mr-1.5" />Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} data-testid="btn-import-roles">
            <Upload className="h-4 w-4 mr-1.5" />Import CSV
          </Button>
          <Button onClick={() => setAdding(true)} data-testid="btn-add-role"><Plus className="h-4 w-4 mr-1.5" />Configure Role</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base">Roles</CardTitle></CardHeader>
          <CardContent className="p-0">
            {roles.length === 0 ? (
              <p className="text-xs text-gray-400 p-4 text-center">No roles configured. Click "Configure Role" to begin.</p>
            ) : (
              <div className="divide-y">
                {roles.map(r => (
                  <button key={r.role_code} onClick={() => setPickedRole(r.role_code)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${pickedRole === r.role_code ? 'bg-indigo-50/50' : ''}`}
                    data-testid={`role-${r.role_code}`}
                  >
                    <div className="text-sm font-medium">{r.role_name}</div>
                    <div className="text-xs text-gray-500">{r.role_code} · {r.competency_count} competencies</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">{pickedRole ? `Weights for ${pickedRole}` : 'Select a role'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {pickedRole ? <RoleWeightTable roleCode={pickedRole} /> : <p className="text-xs text-gray-400 p-6 text-center">Pick a role from the list to view its weights.</p>}
          </CardContent>
        </Card>
      </div>
      {adding && <RoleConfigDialog onClose={() => setAdding(false)} onSaved={() => { refetchRoles(); setAdding(false); }} />}
      {showImport && <ImportDialog title="Import Role Weights (CSV)" endpoint="/api/competency/role-weights/import" templateUrl="/api/competency/role-weights/template" onClose={() => setShowImport(false)} onDone={() => { refetchRoles(); setShowImport(false); }} />}
    </div>
  );
}

function RoleWeightTable({ roleCode }: { roleCode: string }) {
  const { data: rows = [] } = useQuery({ queryKey: ['/api/competency/role-weights', roleCode], queryFn: () => jget<RoleWeight[]>(`/api/competency/role-weights?role_code=${roleCode}`) });
  return (
    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left">Domain</th>
            <th className="px-3 py-2 text-left">Competency</th>
            <th className="px-3 py-2 text-right">Weight</th>
            <th className="px-3 py-2 text-left">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-1.5 font-mono text-xs">{r.domain_code}</td>
              <td className="px-3 py-1.5 text-xs">{r.competency_code} — <span className="text-gray-500">{r.competency_name}</span></td>
              <td className="px-3 py-1.5 text-right font-mono">{r.weight}</td>
              <td className="px-3 py-1.5 text-xs">
                <Badge variant="outline" className="text-[10px] capitalize">{r.weight_type}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleConfigDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: competencies = [] } = useQuery({ queryKey: ['/api/competency/competencies'], queryFn: () => jget<Competency[]>('/api/competency/competencies') });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  // weight per competency: 1 default; type 'core'
  const [weights, setWeights] = useState<Record<string, { weight: number; weight_type: string }>>({});
  const [saving, setSaving] = useState(false);

  const setWeight = (id: string, weight: number) => setWeights({ ...weights, [id]: { ...(weights[id] || { weight: 1, weight_type: 'core' }), weight } });
  const setType = (id: string, weight_type: string) => setWeights({ ...weights, [id]: { ...(weights[id] || { weight: 1, weight_type: 'core' }), weight_type } });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="role-config-dialog">
        <DialogHeader>
          <DialogTitle>Configure Role Weights</DialogTitle>
          <DialogDescription>Default weight is 1.0 (=Core). Bump key competencies to 1.5–2.0 and set type to differentiator/supporting where useful.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Role Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., PM_L3" data-testid="input-role-code" /></div>
            <div><Label>Role Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product Manager (L3)" data-testid="input-role-name" /></div>
          </div>
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Code</th>
                  <th className="px-2 py-1.5 text-left">Name</th>
                  <th className="px-2 py-1.5 text-right">Weight</th>
                  <th className="px-2 py-1.5 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {competencies.map(c => (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1 font-mono text-xs">{c.code}</td>
                    <td className="px-2 py-1 text-xs">{c.name}</td>
                    <td className="px-2 py-1 text-right">
                      <Input className="h-7 w-20 text-right" type="number" step="0.1" min={0} max={3}
                        value={weights[c.id]?.weight ?? 1}
                        onChange={(e) => setWeight(c.id, parseFloat(e.target.value) || 1)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={weights[c.id]?.weight_type ?? 'core'} onValueChange={(v) => setType(c.id, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="core">Core</SelectItem>
                          <SelectItem value="differentiator">Differentiator</SelectItem>
                          <SelectItem value="supporting">Supporting</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !code || !name} onClick={async () => {
            setSaving(true);
            try {
              const list = competencies.map(c => ({ competency_id: c.id, weight: weights[c.id]?.weight ?? 1, weight_type: weights[c.id]?.weight_type ?? 'core' }));
              await jsend('POST', '/api/competency/role-weights', { role_code: code, role_name: name, weights: list });
              toast.success(`Saved weights for ${list.length} competencies`);
              onSaved();
            } catch (e: any) { toast.error(e.message); }
            finally { setSaving(false); }
          }} data-testid="btn-save-role">{saving ? 'Saving...' : 'Save Role'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== STAGE NORMS TAB ============== */
function NormsTab() {
  const stages = ['FOUND', 'EXEC', 'LEAD', 'STRAT', 'EXEC2'];
  const [stage, setStage] = useState('EXEC');
  const { data: rows = [], refetch } = useQuery({ queryKey: ['/api/competency/stage-norms', stage], queryFn: () => jget<StageNorm[]>(`/api/competency/stage-norms?stage_code=${stage}`) });
  const [edits, setEdits] = useState<Record<string, { min?: number; median?: number; top10?: number }>>({});
  const [showImport, setShowImport] = useState(false);

  const save = async (n: StageNorm) => {
    const e = edits[n.id]; if (!e) return;
    try {
      await jsend('PATCH', `/api/competency/stage-norms/${n.id}`, { min_score: e.min, median_score: e.median, top10_score: e.top10 });
      toast.success('Saved');
      setEdits({ ...edits, [n.id]: {} });
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {stages.map(s => (
            <Button key={s} size="sm" variant={s === stage ? 'default' : 'outline'} onClick={() => setStage(s)} data-testid={`stage-${s}`}>{s}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/competency/stage-norms/template', '_blank')}>
            <Download className="h-4 w-4 mr-1.5" />Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} data-testid="btn-import-norms">
            <Upload className="h-4 w-4 mr-1.5" />Import CSV
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Competency</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">Median</th>
                  <th className="px-3 py-2 text-right">Top 10%</th>
                  <th className="px-3 py-2 text-right">Save</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(n => {
                  const e = edits[n.id] || {};
                  return (
                    <tr key={n.id} className="border-t">
                      <td className="px-3 py-1.5 text-xs"><span className="font-mono text-gray-500">{n.competency_code}</span> — {n.competency_name}</td>
                      <td className="px-3 py-1 text-right">
                        <Input className="h-7 w-20 text-right" type="number" defaultValue={n.min_score} onChange={(ev) => setEdits({ ...edits, [n.id]: { ...e, min: parseFloat(ev.target.value) } })} />
                      </td>
                      <td className="px-3 py-1 text-right">
                        <Input className="h-7 w-20 text-right" type="number" defaultValue={n.median_score} onChange={(ev) => setEdits({ ...edits, [n.id]: { ...e, median: parseFloat(ev.target.value) } })} />
                      </td>
                      <td className="px-3 py-1 text-right">
                        <Input className="h-7 w-20 text-right" type="number" defaultValue={n.top10_score} onChange={(ev) => setEdits({ ...edits, [n.id]: { ...e, top10: parseFloat(ev.target.value) } })} />
                      </td>
                      <td className="px-3 py-1 text-right">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => save(n)}>Save</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {showImport && <ImportDialog title="Import Stage Norms (CSV)" endpoint="/api/competency/stage-norms/import" templateUrl="/api/competency/stage-norms/template" onClose={() => setShowImport(false)} onDone={() => { refetch(); setShowImport(false); }} />}
    </div>
  );
}

/* AI-draft picker — small dialog letting admin pick a competency and draft an item */
const ITEM_LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'हिन्दी (Hindi)' }, { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' }, { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' }, { code: 'zh', name: '中文 (Simplified)' }, { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' }, { code: 'ta', name: 'தமிழ்' }, { code: 'te', name: 'తెలుగు' },
  { code: 'kn', name: 'ಕನ್ನಡ' }, { code: 'mr', name: 'मराठी' }, { code: 'bn', name: 'বাংলা' },
];

function CompetencyAiDraftPicker({ competencies, onDraft, busyCode }: { competencies: Competency[]; onDraft: (id: string, code: string, language: string) => void; busyCode: string | null }) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string>('');
  const [language, setLanguage] = useState('en');
  const [search, setSearch] = useState('');
  const filtered = competencies.filter(c => !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="btn-ai-draft" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
        <Sparkles className="h-4 w-4 mr-1.5" />AI Draft
      </Button>
      {open && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent className="max-w-xl" data-testid="ai-draft-dialog">
            <DialogHeader>
              <DialogTitle>AI-Draft Assessment Item</DialogTitle>
              <DialogDescription>Pick a competency and language. Claude will draft a realistic scenario + 4 scored options. You can edit it after.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger data-testid="select-ai-language"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">{ITEM_LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input placeholder="Search competency by code or name…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-ai-search" />
              <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                {filtered.slice(0, 100).map(c => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="radio" name="ai-comp" value={c.id} checked={pickedId === c.id} onChange={() => setPickedId(c.id)} />
                    <span className="font-mono text-xs text-gray-500 w-24">{c.code}</span>
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                disabled={!pickedId || !!busyCode}
                onClick={() => {
                  const c = competencies.find(x => x.id === pickedId);
                  if (c) {
                    onDraft(c.id, c.code, language);
                    setOpen(false);
                    setPickedId('');
                  }
                }}
                data-testid="btn-confirm-ai-draft"
              >
                {busyCode ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                {busyCode ? `Drafting ${busyCode}...` : `Draft Item (${language.toUpperCase()})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


// ─── COHORTS TAB ─────────────────────────────────────────────────────────
interface Cohort {
  id: string; name: string; role_code?: string; role_name?: string;
  experience_min: number; experience_max: number; location?: string;
  industry?: string; notes?: string; is_active: boolean; created_at?: string;
}
function CohortsTab() {
  const cohorts = useQuery<Cohort[]>({ queryKey: ['competency.cohorts'], queryFn: () => jget('/api/competency/cohorts') });
  const roles = useQuery<RoleSummary[]>({ queryKey: ['competency.roles'], queryFn: () => jget('/api/competency/role-weights') });
  const [editing, setEditing] = useState<Partial<Cohort> | null>(null);

  const save = useMutation({
    mutationFn: async (c: Partial<Cohort>) => {
      if (c.id) return jsend('PATCH', `/api/competency/cohorts/${c.id}`, c);
      return jsend('POST', '/api/competency/cohorts', c);
    },
    onSuccess: () => { setEditing(null); cohorts.refetch(); toast.success('Cohort saved'); },
    onError: (e: any) => toast.error(e.message || 'Save failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => jsend('DELETE', `/api/competency/cohorts/${id}`),
    onSuccess: () => { cohorts.refetch(); toast.success('Cohort deleted'); },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            Benchmark Cohorts
            <Badge variant="outline" className="ml-2">{cohorts.data?.length || 0}</Badge>
          </CardTitle>
          <Button size="sm" onClick={() => setEditing({ name: '', experience_min: 0, experience_max: 5, is_active: true })} data-testid="btn-add-cohort">
            <Plus className="h-4 w-4 mr-1.5" />Add Cohort
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">Define cohort rules used by the Benchmark Engine — e.g. "Junior Engineers — India · 1-3y experience". The scoring engine compares user scores against the median/top-10 of their cohort.</p>
        <div className="space-y-2">
          {cohorts.data?.map(c => (
            <div key={c.id} data-testid={`cohort-row-${c.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:border-indigo-200">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{c.name}</span>
                  {!c.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.role_code && <span className="mr-3">{c.role_code} · {c.role_name}</span>}
                  <span className="mr-3">{c.experience_min}-{c.experience_max} years</span>
                  {c.location && <span className="mr-3">📍 {c.location}</span>}
                  {c.industry && <span>🏢 {c.industry}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm('Delete this cohort?')) remove.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {cohorts.data?.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No cohorts yet. Add your first cohort above.</p>
            </div>
          )}
        </div>

        {/* Edit dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Edit cohort' : 'New cohort'}</DialogTitle>
              <DialogDescription>Cohorts drive the benchmark engine. Define role + experience range + location.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Cohort name *</Label>
                <Input value={editing?.name || ''} onChange={e => setEditing(s => ({ ...s!, name: e.target.value }))} placeholder="e.g. Mid-level Engineers — Global" data-testid="input-cohort-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select value={editing?.role_code || ''} onValueChange={v => {
                    const r = roles.data?.find(x => x.role_code === v);
                    setEditing(s => ({ ...s!, role_code: v, role_name: r?.role_name }));
                  }}>
                    <SelectTrigger data-testid="select-cohort-role"><SelectValue placeholder="Any role" /></SelectTrigger>
                    <SelectContent>
                      {roles.data?.map(r => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={editing?.location || ''} onChange={e => setEditing(s => ({ ...s!, location: e.target.value }))} placeholder="Global / India / APAC" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min experience (years)</Label>
                  <Input type="number" min={0} value={editing?.experience_min ?? 0} onChange={e => setEditing(s => ({ ...s!, experience_min: parseInt(e.target.value || '0') }))} />
                </div>
                <div>
                  <Label>Max experience (years)</Label>
                  <Input type="number" min={0} value={editing?.experience_max ?? 99} onChange={e => setEditing(s => ({ ...s!, experience_max: parseInt(e.target.value || '0') }))} />
                </div>
              </div>
              <div>
                <Label>Industry</Label>
                <Input value={editing?.industry || ''} onChange={e => setEditing(s => ({ ...s!, industry: e.target.value }))} placeholder="Tech / Sales / Data" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={editing?.notes || ''} onChange={e => setEditing(s => ({ ...s!, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save.mutate(editing!)} disabled={!editing?.name || save.isPending} data-testid="btn-save-cohort">
                {save.isPending && <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── VERSIONS TAB ────────────────────────────────────────────────────────
interface Version {
  id: string; version: number; label: string; notes?: string; changed_by?: string;
  change_summary: Record<string, number>; created_at: string;
}
function VersionsTab() {
  const versions = useQuery<Version[]>({ queryKey: ['competency.versions'], queryFn: () => jget('/api/competency/versions') });
  const summary = useQuery<Record<string, number>>({ queryKey: ['competency.engine-summary'], queryFn: () => jget('/api/competency/engine-summary') });
  const [showSnap, setShowSnap] = useState(false);
  const [snapForm, setSnapForm] = useState<{ label: string; notes: string }>({ label: '', notes: '' });

  const create = useMutation({
    mutationFn: () => jsend('POST', '/api/competency/versions', snapForm),
    onSuccess: () => { setShowSnap(false); setSnapForm({ label: '', notes: '' }); versions.refetch(); toast.success('Version snapshot saved'); },
    onError: (e: any) => toast.error(e.message || 'Snapshot failed'),
  });

  return (
    <div className="space-y-4">
      {/* Engine summary stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> Engine Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {summary.data && [
              ['Domains', summary.data.domains],
              ['Competencies', summary.data.competencies],
              ['Items', summary.data.assessment_items],
              ['Stage Norms', summary.data.stage_norms],
              ['Role Weights', summary.data.role_weights],
              ['Cohorts', summary.data.cohorts],
              ['Configs', summary.data.scoring_configs],
              ['Mappings', summary.data.learning_mappings],
              ['Versions', summary.data.versions],
              ['Active v', summary.data.current_version],
              ['Roles', summary.data.roles],
              ['CAPADEX', summary.data.sdi_domains],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-gradient-to-br from-slate-50 to-white border rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{value as number}</div>
                <div className="text-xs text-gray-500">{label as string}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-600" /> Version History
              <Badge variant="outline" className="ml-2">{versions.data?.length || 0}</Badge>
            </CardTitle>
            <Button size="sm" onClick={() => setShowSnap(true)} data-testid="btn-create-version">
              <Save className="h-4 w-4 mr-1.5" />Take Snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">Take a versioned snapshot before any large change to the framework. Each version captures a summary of all configurable items.</p>
          <div className="space-y-3">
            {versions.data?.map(v => (
              <div key={v.id} data-testid={`version-row-${v.version}`} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">v{v.version}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{v.label}</div>
                  {v.notes && <div className="text-xs text-gray-500 mt-0.5">{v.notes}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(v.change_summary || {}).map(([k, val]) => (
                      <Badge key={k} variant="outline" className="text-[10px]">{k}: {val as number}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {versions.data?.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <History className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">No versions yet. Take your first snapshot.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSnap} onOpenChange={setShowSnap}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Take version snapshot</DialogTitle>
            <DialogDescription>Captures current state of all configurable items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input value={snapForm.label} onChange={e => setSnapForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Q1 2026 launch" data-testid="input-version-label" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={snapForm.notes} onChange={e => setSnapForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="What changed?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnap(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending} data-testid="btn-save-version">
              {create.isPending && <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />}Save Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CAPADEX TAB ──────────────────────────────────────────────────────────
interface SdiDomain {
  id: number; domain_code: string; domain_name: string; description?: string;
  icon_key: string; color: string; category?: string; weightage: number;
  display_order: number; status: string; is_active: boolean;
}
interface SdiSubdomain {
  id: number; domain_code: string; subdomain_code: string; subdomain_name: string;
  description?: string; display_order: number; is_active: boolean;
}
interface SdiItem {
  id: number; subdomain_code: string; item_code: string; item_type: string;
  difficulty: number; question: string; expected_time: number; scoring_type: string;
  language_code: string; is_active: boolean;
  options: Array<{ id: number; option_text: string; score_value: number; display_order: number }>;
}

function SdiTab() {
  const [section, setSection] = useState<'domains'|'subdomains'|'items'>('domains');
  const stats = useQuery<Record<string, number>>({ queryKey: ['sdi.stats'], queryFn: () => jget('/api/sdi/admin/stats') });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              CAPADEX Configuration
            </CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{stats.data?.domains ?? 0} domains</Badge>
              <Badge variant="outline">{stats.data?.subdomains ?? 0} subdomains</Badge>
              <Badge variant="outline">{stats.data?.items ?? 0} items</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 border-b pb-2 mb-4">
            {[['domains','Domains'],['subdomains','Subdomains'],['items','Question Bank']].map(([k, label]) => (
              <button
                key={k}
                data-testid={`sdi-section-${k}`}
                onClick={() => setSection(k as any)}
                className={`px-3 py-1.5 text-sm rounded-md ${section === k ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
              >{label}</button>
            ))}
          </div>
          {section === 'domains'    && <SdiDomainsManager onUpdate={() => stats.refetch()} />}
          {section === 'subdomains' && <SdiSubdomainsManager onUpdate={() => stats.refetch()} />}
          {section === 'items'      && <SdiItemsManager onUpdate={() => stats.refetch()} />}
        </CardContent>
      </Card>
    </div>
  );
}

function SdiDomainsManager({ onUpdate }: { onUpdate: () => void }) {
  const q = useQuery<SdiDomain[]>({ queryKey: ['sdi.domains'], queryFn: () => jget('/api/sdi/admin/domains') });
  const [editing, setEditing] = useState<Partial<SdiDomain> | null>(null);
  const save = useMutation({
    mutationFn: async (d: Partial<SdiDomain>) =>
      d.id ? jsend('PATCH', `/api/sdi/admin/domains/${d.id}`, d) : jsend('POST', '/api/sdi/admin/domains', d),
    onSuccess: () => { setEditing(null); q.refetch(); onUpdate(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => jsend('DELETE', `/api/sdi/admin/domains/${id}`),
    onSuccess: () => { q.refetch(); onUpdate(); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing({ is_active: true, weightage: 1, display_order: 99 })} data-testid="btn-add-sdi-domain">
          <Plus className="h-4 w-4 mr-1.5" />Add Domain
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {q.data?.map(d => (
          <div key={d.id} data-testid={`sdi-domain-${d.domain_code}`} className="p-3 rounded-lg border hover:border-indigo-200">
            <div className="flex items-start justify-between mb-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${d.color}18`, color: d.color }}>{d.domain_code}</span>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${d.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(d)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => { if (confirm(`Delete ${d.domain_code}?`)) del.mutate(d.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{d.domain_name}</p>
            {d.category && <p className="text-[10px] text-gray-400 mt-0.5">{d.category}</p>}
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit CAPADEX domain' : 'New CAPADEX domain'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={editing?.domain_code || ''} onChange={e => setEditing(s => ({ ...s!, domain_code: e.target.value.toUpperCase() }))} placeholder="e.g. NEW-19" /></div>
              <div><Label>Category</Label><Input value={editing?.category || ''} onChange={e => setEditing(s => ({ ...s!, category: e.target.value }))} placeholder="Cognitive / Emotional…" /></div>
            </div>
            <div><Label>Name *</Label><Input value={editing?.domain_name || ''} onChange={e => setEditing(s => ({ ...s!, domain_name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={editing?.description || ''} onChange={e => setEditing(s => ({ ...s!, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Color</Label><Input type="color" value={editing?.color || '#344E86'} onChange={e => setEditing(s => ({ ...s!, color: e.target.value }))} /></div>
              <div><Label>Weight</Label><Input type="number" step="0.1" value={editing?.weightage ?? 1} onChange={e => setEditing(s => ({ ...s!, weightage: parseFloat(e.target.value) }))} /></div>
              <div><Label>Order</Label><Input type="number" value={editing?.display_order ?? 99} onChange={e => setEditing(s => ({ ...s!, display_order: parseInt(e.target.value) }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sdi-d-active" checked={editing?.is_active !== false} onChange={e => setEditing(s => ({ ...s!, is_active: e.target.checked }))} />
              <Label htmlFor="sdi-d-active" className="cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.domain_code || !editing?.domain_name || save.isPending} data-testid="btn-save-sdi-domain">
              {save.isPending && <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SdiSubdomainsManager({ onUpdate }: { onUpdate: () => void }) {
  const domains = useQuery<SdiDomain[]>({ queryKey: ['sdi.domains'], queryFn: () => jget('/api/sdi/admin/domains') });
  const subs = useQuery<SdiSubdomain[]>({ queryKey: ['sdi.subdomains'], queryFn: () => jget('/api/sdi/subdomains') });
  const [editing, setEditing] = useState<Partial<SdiSubdomain> | null>(null);
  const [filter, setFilter] = useState<string>('');

  const save = useMutation({
    mutationFn: async (s: Partial<SdiSubdomain>) =>
      s.id ? jsend('PATCH', `/api/sdi/admin/subdomains/${s.id}`, s) : jsend('POST', '/api/sdi/admin/subdomains', s),
    onSuccess: () => { setEditing(null); subs.refetch(); onUpdate(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => jsend('DELETE', `/api/sdi/admin/subdomains/${id}`),
    onSuccess: () => { subs.refetch(); onUpdate(); toast.success('Deleted'); },
  });

  const filtered = subs.data?.filter(s => !filter || s.domain_code === filter) || [];
  const grouped = filtered.reduce((acc: Record<string, SdiSubdomain[]>, s) => { (acc[s.domain_code] ||= []).push(s); return acc; }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <select className="border rounded-md px-2 py-1 text-sm" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-sdi-domain-filter">
          <option value="">All domains</option>
          {domains.data?.map(d => <option key={d.id} value={d.domain_code}>{d.domain_code} — {d.domain_name}</option>)}
        </select>
        <Button size="sm" onClick={() => setEditing({ domain_code: filter || domains.data?.[0]?.domain_code, is_active: true, display_order: 99 })} data-testid="btn-add-sdi-subdomain">
          <Plus className="h-4 w-4 mr-1.5" />Add Subdomain
        </Button>
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).map(([dc, list]) => {
          const dom = domains.data?.find(d => d.domain_code === dc);
          return (
            <div key={dc} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 flex items-center gap-2">
                <span className="font-bold" style={{ color: dom?.color }}>{dc}</span>
                <span>—</span>
                <span>{dom?.domain_name}</span>
                <Badge variant="outline" className="ml-auto">{list.length} subdomains</Badge>
              </div>
              <div className="divide-y">
                {list.map(s => (
                  <div key={s.id} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-gray-500">{s.subdomain_code}</span>
                        <span className="text-sm font-medium">{s.subdomain_name}</span>
                        {!s.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(s)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm(`Delete ${s.subdomain_code}?`)) del.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg">
            <Layers className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No subdomains for this filter</p>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit subdomain' : 'New subdomain'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Domain *</Label>
              <select className="w-full border rounded-md px-2 py-2 text-sm" value={editing?.domain_code || ''} onChange={e => setEditing(s => ({ ...s!, domain_code: e.target.value }))}>
                {domains.data?.map(d => <option key={d.id} value={d.domain_code}>{d.domain_code} — {d.domain_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={editing?.subdomain_code || ''} onChange={e => setEditing(s => ({ ...s!, subdomain_code: e.target.value.toUpperCase() }))} /></div>
              <div><Label>Order</Label><Input type="number" value={editing?.display_order ?? 99} onChange={e => setEditing(s => ({ ...s!, display_order: parseInt(e.target.value) }))} /></div>
            </div>
            <div><Label>Name *</Label><Input value={editing?.subdomain_name || ''} onChange={e => setEditing(s => ({ ...s!, subdomain_name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={editing?.description || ''} onChange={e => setEditing(s => ({ ...s!, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.domain_code || !editing?.subdomain_code || !editing?.subdomain_name || save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SdiItemsManager({ onUpdate }: { onUpdate: () => void }) {
  const domains = useQuery<SdiDomain[]>({ queryKey: ['sdi.domains'], queryFn: () => jget('/api/sdi/admin/domains') });
  const subs = useQuery<SdiSubdomain[]>({ queryKey: ['sdi.subdomains'], queryFn: () => jget('/api/sdi/subdomains') });
  const items = useQuery<SdiItem[]>({ queryKey: ['sdi.items'], queryFn: () => jget('/api/sdi/items') });
  const [editing, setEditing] = useState<Partial<SdiItem> | null>(null);

  const save = useMutation({
    mutationFn: (i: Partial<SdiItem>) => jsend('POST', '/api/sdi/admin/items', i),
    onSuccess: () => { setEditing(null); items.refetch(); onUpdate(); toast.success('Item created'); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: number) => jsend('DELETE', `/api/sdi/admin/items/${id}`),
    onSuccess: () => { items.refetch(); onUpdate(); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Question bank for CAPADEX assessments. Each item belongs to a subdomain.</p>
        <Button size="sm" onClick={() => setEditing({ item_type: 'likert5', difficulty: 3, expected_time: 30, scoring_type: 'auto', language_code: 'en', is_active: true })} data-testid="btn-add-sdi-item">
          <Plus className="h-4 w-4 mr-1.5" />Add Item
        </Button>
      </div>
      <div className="space-y-2">
        {items.data?.map(it => {
          const sub = subs.data?.find(s => s.subdomain_code === it.subdomain_code);
          const dom = domains.data?.find(d => d.domain_code === sub?.domain_code);
          return (
            <div key={it.id} data-testid={`sdi-item-${it.item_code}`} className="p-3 border rounded-lg hover:border-indigo-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${dom?.color || '#888'}18`, color: dom?.color || '#888' }}>{sub?.domain_code}</span>
                    <span className="text-[10px] font-mono text-gray-400">{it.subdomain_code}</span>
                    <span className="text-[10px] font-mono text-gray-400">{it.item_code}</span>
                    <Badge variant="outline" className="text-[10px]">{it.item_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">D{it.difficulty}</Badge>
                  </div>
                  <p className="text-sm mt-1">{it.question}</p>
                  {it.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {it.options.map(o => (
                        <Badge key={o.id} variant="outline" className="text-[10px]">{o.option_text} ({o.score_value})</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 shrink-0" onClick={() => { if (confirm('Delete this item?')) del.mutate(it.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          );
        })}
        {(items.data?.length ?? 0) === 0 && (
          <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No items in the CAPADEX question bank yet</p>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New CAPADEX assessment item</DialogTitle>
            <DialogDescription>Default options are 5-point Likert (Strongly disagree → Strongly agree). Override below if needed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subdomain *</Label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={editing?.subdomain_code || ''} onChange={e => setEditing(s => ({ ...s!, subdomain_code: e.target.value }))}>
                  <option value="">Select…</option>
                  {subs.data?.map(s => <option key={s.id} value={s.subdomain_code}>{s.subdomain_code} — {s.subdomain_name}</option>)}
                </select>
              </div>
              <div><Label>Item code *</Label><Input value={editing?.item_code || ''} onChange={e => setEditing(s => ({ ...s!, item_code: e.target.value.toUpperCase() }))} placeholder="e.g. ACF_S1_Q01" data-testid="input-sdi-item-code" /></div>
            </div>
            <div><Label>Question *</Label><Textarea value={editing?.question || ''} onChange={e => setEditing(s => ({ ...s!, question: e.target.value }))} rows={3} data-testid="input-sdi-item-question" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={editing?.item_type || 'likert5'} onChange={e => setEditing(s => ({ ...s!, item_type: e.target.value }))}>
                  <option value="likert5">Likert 5-point</option>
                  <option value="mcq">MCQ</option>
                  <option value="scenario">Scenario</option>
                  <option value="behavioral">Behavioral</option>
                </select>
              </div>
              <div><Label>Difficulty (1–5)</Label><Input type="number" min={1} max={5} value={editing?.difficulty ?? 3} onChange={e => setEditing(s => ({ ...s!, difficulty: parseInt(e.target.value) }))} /></div>
              <div><Label>Expected time (s)</Label><Input type="number" value={editing?.expected_time ?? 30} onChange={e => setEditing(s => ({ ...s!, expected_time: parseInt(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.subdomain_code || !editing?.item_code || !editing?.question || save.isPending} data-testid="btn-save-sdi-item">
              {save.isPending && <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />}Save Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

