import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Briefcase, RefreshCw, X, Check } from 'lucide-react';
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
type Fn = { id: number; code: string; name: string; description?: string; is_cross_industry: boolean; is_active: boolean; status: string; sort_order: number; };
type Form = { code: string; name: string; description: string; is_cross_industry: boolean; is_active: boolean; status: string; sort_order: number; };
const EMPTY: Form = { code: '', name: '', description: '', is_cross_industry: false, is_active: true, status: 'draft', sort_order: 0 };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };

export default function FunctionsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<Fn | null>(null);

  const { data, isLoading } = useQuery<{ items: Fn[] }>({
    queryKey: ['/api/ontology/functions', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/ontology/functions?status=${statusFilter}&limit=200`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    staleTime: 15000,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const url = editId ? `/api/ontology/functions/${editId}` : '/api/ontology/functions';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(f) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/functions'] }); toast({ title: editId ? 'Function updated' : 'Function created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ontology/functions/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/functions'] }); toast({ title: 'Function archived' }); setDelConfirm(null); },
  });

  const openCreate = () => { setEditId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (i: Fn) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: i.description || '', is_cross_industry: i.is_cross_industry, is_active: i.is_active, status: i.status, sort_order: i.sort_order }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Functions</h2><p className="text-sm text-gray-500">Business functions across industries — {filtered.length} entries</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="function" entityId="module" entityLabel="Functions" />
          <Button onClick={openCreate} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Function</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search functions…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/functions'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Cross-Industry</TableHead><TableHead>Status</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8"><Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />No functions found</TableCell></TableRow>}
              {filtered.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>{i.is_cross_industry ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Universal</span> : <span className="text-xs text-gray-400">Industry-specific</span>}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || ''}`}>{i.status}</span></TableCell>
                  <TableCell>{i.is_active ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-400" />}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Function' : 'New Function'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} placeholder="ENGINEERING" disabled={!!editId} className="font-mono" /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => f('sort_order', parseInt(e.target.value) || 0)} /></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Engineering" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div className="flex gap-4">
              <div className="flex-1"><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2"><input type="checkbox" id="ci" checked={form.is_cross_industry} onChange={e => f('is_cross_industry', e.target.checked)} /><label htmlFor="ci" className="text-sm">Cross-industry</label></div>
                <div className="flex items-center gap-2"><input type="checkbox" id="ia2" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} /><label htmlFor="ia2" className="text-sm">Active</label></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Function?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p>
          <DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
