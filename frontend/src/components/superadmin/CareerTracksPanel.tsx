import { BRAND } from '@/design-system/tokens';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, TrendingUp, RefreshCw } from 'lucide-react';
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
const TRACK_TYPE_COLORS: Record<string, string> = { ic: 'bg-blue-100 text-blue-700', management: 'bg-purple-100 text-purple-700', specialist: 'bg-teal-100 text-teal-700', hybrid: 'bg-orange-100 text-orange-700' };

type Track = { id: number; code: string; name: string; description?: string; track_type: string; is_active: boolean; status: string; sort_order: number; };
type Form = { code: string; name: string; description: string; track_type: string; is_active: boolean; status: string; sort_order: number; };
const EMPTY: Form = { code: '', name: '', description: '', track_type: 'ic', is_active: true, status: 'draft', sort_order: 0 };

export default function CareerTracksPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<Track | null>(null);

  const { data, isLoading } = useQuery<{ items: Track[] }>({
    queryKey: ['/api/ontology/career-tracks'],
    queryFn: async () => { const res = await fetch('/api/ontology/career-tracks?status=all', { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 15000,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (typeFilter !== 'all' && i.track_type !== typeFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, typeFilter]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const url = editId ? `/api/ontology/career-tracks/${editId}` : '/api/ontology/career-tracks';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(fm) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/career-tracks'] }); toast({ title: editId ? 'Track updated' : 'Track created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/career-tracks/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/career-tracks'] }); toast({ title: 'Track archived' }); setDelConfirm(null); },
  });

  const openEdit = (i: Track) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: i.description || '', track_type: i.track_type, is_active: i.is_active, status: i.status, sort_order: i.sort_order }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Career Tracks</h2><p className="text-sm text-gray-500">Career progression pathways — {filtered.length} tracks</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="career-track" entityId="module" entityLabel="Career Tracks" />
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Track</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search tracks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="ic">IC Track</SelectItem><SelectItem value="management">Management</SelectItem><SelectItem value="specialist">Specialist</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/career-tracks'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Track Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8"><TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />No career tracks found</TableCell></TableRow>}
              {filtered.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${TRACK_TYPE_COLORS[i.track_type] || 'bg-gray-100'}`}>{i.track_type}</span></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || ''}`}>{i.status}</span></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Career Track' : 'New Career Track'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="SWE_IC" /></div>
              <div><Label>Track Type</Label><Select value={form.track_type} onValueChange={v => f('track_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ic">Individual Contributor</SelectItem><SelectItem value="management">Management</SelectItem><SelectItem value="specialist">Specialist</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Software Engineer IC Track" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={3} /></div>
            <div className="flex gap-4">
              <div className="flex-1"><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
              <div className="flex items-end gap-2 pb-0.5"><input type="checkbox" id="ict" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} /><label htmlFor="ict" className="text-sm">Active</label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Track?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
