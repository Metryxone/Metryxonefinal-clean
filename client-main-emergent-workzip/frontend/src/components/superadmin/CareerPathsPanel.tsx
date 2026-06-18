import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, GitBranch, RefreshCw, ArrowRight, ChevronDown, ChevronRight as ChevRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';
import SubmitForReviewButton from './SubmitForReviewButton';

const BRAND = { primary: '#344E86' };
const PATH_COLORS: Record<string, string> = { linear: 'bg-blue-100 text-blue-700', lateral: 'bg-teal-100 text-teal-700', cross_functional: 'bg-purple-100 text-purple-700', entry: 'bg-green-100 text-green-700', exit: 'bg-orange-100 text-orange-700' };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };

type CareerPath = { id: number; code: string; name: string; path_type: string; typical_months?: number; difficulty?: string; from_role_title?: string; to_role_title?: string; milestone_count: number; status: string; };
type Form = { code: string; name: string; description: string; path_type: string; typical_months: string; difficulty: string; status: string; sort_order: number; };
const EMPTY: Form = { code: '', name: '', description: '', path_type: 'linear', typical_months: '', difficulty: 'medium', status: 'draft', sort_order: 0 };

export default function CareerPathsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<CareerPath | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ items: CareerPath[] }>({
    queryKey: ['/api/ontology/career-paths', typeFilter],
    queryFn: async () => { const res = await fetch(`/api/ontology/career-paths?status=all`, { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 15000,
  });

  const { data: milestonesData } = useQuery<{ items: any[] }>({
    queryKey: ['/api/ontology/career-paths', expanded, 'milestones'],
    queryFn: async () => { if (!expanded) return { items: [] }; const res = await fetch(`/api/ontology/career-paths/${expanded}/milestones`, { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    enabled: !!expanded,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (typeFilter !== 'all' && i.path_type !== typeFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, typeFilter]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const payload = { ...fm, typical_months: fm.typical_months ? parseInt(fm.typical_months) : null };
      const url = editId ? `/api/ontology/career-paths/${editId}` : '/api/ontology/career-paths';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/career-paths'] }); toast({ title: editId ? 'Updated' : 'Created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/career-paths/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/career-paths'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const openEdit = (i: CareerPath) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: '', path_type: i.path_type, typical_months: i.typical_months ? String(i.typical_months) : '', difficulty: i.difficulty || 'medium', status: i.status, sort_order: 0 }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Career Paths</h2><p className="text-sm text-gray-500">Role-to-role progression paths with milestones — {filtered.length} paths</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="career-path" entityId="module" entityLabel="Career Paths" />
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Path</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search paths…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="linear">Linear</SelectItem><SelectItem value="lateral">Lateral</SelectItem><SelectItem value="cross_functional">Cross-functional</SelectItem><SelectItem value="entry">Entry</SelectItem><SelectItem value="exit">Exit</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/career-paths'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead></TableHead><TableHead>Code</TableHead><TableHead>Path</TableHead><TableHead>Type</TableHead><TableHead>Duration</TableHead><TableHead>Milestones</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8"><GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />No career paths defined</TableCell></TableRow>}
              {filtered.map(i => (
                <React.Fragment key={i.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell><Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === i.id ? null : i.id)}>{expanded === i.id ? <ChevronDown className="h-4 w-4" /> : <ChevRight className="h-4 w-4" />}</Button></TableCell>
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                    <TableCell className="font-medium">
                      {i.from_role_title ? <span className="text-sm">{i.from_role_title} <ArrowRight className="inline h-3 w-3 mx-1 text-gray-400" /> {i.to_role_title || '?'}</span> : i.name}
                    </TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${PATH_COLORS[i.path_type] || 'bg-gray-100'}`}>{i.path_type}</span></TableCell>
                    <TableCell className="text-sm text-gray-500">{i.typical_months ? `${i.typical_months}mo` : '—'}</TableCell>
                    <TableCell className="text-sm">{i.milestone_count}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || ''}`}>{i.status}</span></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  {expanded === i.id && (
                    <TableRow><TableCell colSpan={8} className="bg-gray-50 p-0"><div className="p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Milestones ({(milestonesData?.items || []).length})</p>
                      {(milestonesData?.items || []).length === 0 ? <p className="text-sm text-gray-400">No milestones yet.</p> : (
                        <div className="space-y-1">{(milestonesData?.items || []).map((m: any, idx: number) => <div key={m.id} className="flex items-start gap-2 text-sm"><span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">Step {m.step_number || idx + 1}</span><span>{m.title}</span>{m.is_required && <span className="text-xs text-gray-400 ml-auto">Required</span>}</div>)}</div>
                      )}
                    </div></TableCell></TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Career Path' : 'New Career Path'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="PATH_SWE_TO_LEAD" /></div>
              <div><Label>Path Type</Label><Select value={form.path_type} onValueChange={v => f('path_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="linear">Linear</SelectItem><SelectItem value="lateral">Lateral</SelectItem><SelectItem value="cross_functional">Cross-functional</SelectItem><SelectItem value="entry">Entry</SelectItem><SelectItem value="exit">Exit</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Software Engineer → Tech Lead" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Typical Months</Label><Input type="number" min={1} value={form.typical_months} onChange={e => f('typical_months', e.target.value)} placeholder="18" /></div>
              <div><Label>Difficulty</Label><Select value={form.difficulty} onValueChange={v => f('difficulty', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Path?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
