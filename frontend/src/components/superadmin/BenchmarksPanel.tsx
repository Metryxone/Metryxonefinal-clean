import { BRAND } from '@/design-system/tokens';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, BarChart3, RefreshCw, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';
import SubmitForReviewButton from './SubmitForReviewButton';


const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };
const TYPE_COLORS: Record<string, string> = { role: 'bg-blue-100 text-blue-700', industry: 'bg-purple-100 text-purple-700', function: 'bg-teal-100 text-teal-700', seniority: 'bg-orange-100 text-orange-700', custom: 'bg-pink-100 text-pink-700' };

type Benchmark = { id: number; code: string; name: string; benchmark_type: string; sample_size: number; is_suppressed: boolean; role_title?: string; item_count: number; status: string; is_active: boolean; };
type Form = { code: string; name: string; description: string; benchmark_type: string; role_id: string; industry_id: string; function_id: string; seniority_level: string; sample_size: number; status: string; };
const EMPTY: Form = { code: '', name: '', description: '', benchmark_type: 'role', role_id: '', industry_id: '', function_id: '', seniority_level: '', sample_size: 0, status: 'draft' };

export default function BenchmarksPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<Benchmark | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ items: Benchmark[] }>({
    queryKey: ['/api/ontology/benchmarks', typeFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ benchmark_type: typeFilter, status: 'all' });
      const res = await fetch(`/api/ontology/benchmarks?${p}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed'); return res.json();
    },
    staleTime: 15000,
  });

  const { data: itemsData } = useQuery<{ items: any[] }>({
    queryKey: ['/api/ontology/benchmarks', expanded, 'items'],
    queryFn: async () => {
      if (!expanded) return { items: [] };
      const res = await fetch(`/api/ontology/benchmarks/${expanded}/items`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed'); return res.json();
    },
    enabled: !!expanded,
    staleTime: 15000,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (typeFilter !== 'all' && i.benchmark_type !== typeFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, typeFilter]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const payload = { ...fm, role_id: fm.role_id ? parseInt(fm.role_id) : null, industry_id: fm.industry_id ? parseInt(fm.industry_id) : null, function_id: fm.function_id ? parseInt(fm.function_id) : null };
      const url = editId ? `/api/ontology/benchmarks/${editId}` : '/api/ontology/benchmarks';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/benchmarks'] }); toast({ title: editId ? 'Updated' : 'Created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/benchmarks/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/benchmarks'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const openEdit = (i: Benchmark) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: '', benchmark_type: i.benchmark_type, role_id: '', industry_id: '', function_id: '', seniority_level: '', sample_size: i.sample_size, status: i.status }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Benchmarks</h2><p className="text-sm text-gray-500">Role & industry competency benchmarks — {filtered.length} benchmarks · k_min=30 enforced</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="benchmark" entityId="module" entityLabel="Benchmarks" />
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Benchmark</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search benchmarks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="role">Role</SelectItem><SelectItem value="industry">Industry</SelectItem><SelectItem value="function">Function</SelectItem><SelectItem value="seniority">Seniority</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/benchmarks'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead></TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Sample Size</TableHead><TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8"><BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />No benchmarks found</TableCell></TableRow>}
              {filtered.map(i => (
                <React.Fragment key={i.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell><Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === i.id ? null : i.id)}>{expanded === i.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></TableCell>
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                    <TableCell className="font-medium">{i.name}{i.is_suppressed && <span className="ml-2 inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" />Suppressed (k&lt;30)</span>}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[i.benchmark_type] || 'bg-gray-100'}`}>{i.benchmark_type}</span></TableCell>
                    <TableCell className="text-sm">{i.sample_size > 0 ? i.sample_size.toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-sm">{i.item_count}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || ''}`}>{i.status}</span></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  {expanded === i.id && (
                    <TableRow><TableCell colSpan={8} className="bg-gray-50 p-0">
                      <div className="p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Competency Items ({(itemsData?.items || []).length})</p>
                        {(itemsData?.items || []).length === 0 ? <p className="text-sm text-gray-400">No benchmark items yet. Add via API.</p> : (
                          <table className="w-full text-xs"><thead><tr className="text-gray-400"><th className="text-left pb-1">Competency</th><th>p25</th><th>p50</th><th>p75</th><th>p90</th><th>Mean</th></tr></thead>
                          <tbody>{(itemsData?.items || []).map((bi: any) => <tr key={bi.id}><td className="py-0.5">{bi.competency_name || bi.competency_code}</td><td className="text-center">{bi.p25_score ?? '—'}</td><td className="text-center">{bi.p50_score ?? '—'}</td><td className="text-center">{bi.p75_score ?? '—'}</td><td className="text-center">{bi.p90_score ?? '—'}</td><td className="text-center">{bi.mean_score ?? '—'}</td></tr>)}</tbody></table>
                        )}
                      </div>
                    </TableCell></TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Benchmark' : 'New Benchmark'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="BENCH_SWE_MID" /></div>
              <div><Label>Type</Label><Select value={form.benchmark_type} onValueChange={v => f('benchmark_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="role">Role</SelectItem><SelectItem value="industry">Industry</SelectItem><SelectItem value="function">Function</SelectItem><SelectItem value="seniority">Seniority</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Mid-Level Software Engineer Benchmark" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sample Size</Label><Input type="number" min={0} value={form.sample_size} onChange={e => f('sample_size', parseInt(e.target.value) || 0)} />{form.sample_size > 0 && form.sample_size < 30 && <p className="text-xs text-orange-600 mt-1">⚠ Below k=30 — will be suppressed</p>}</div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Benchmark?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
