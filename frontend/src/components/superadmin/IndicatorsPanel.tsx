import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Activity, RefreshCw } from 'lucide-react';
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
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };
const POLARITY_COLORS: Record<string, string> = { positive: 'bg-green-100 text-green-700', negative: 'bg-red-100 text-red-700', neutral: 'bg-gray-100 text-gray-600' };
const SIGNAL_TYPES = ['behavioural', 'cognitive', 'emotional', 'contextual', 'relational'];

type Indicator = { id: number; code: string; label: string; concern_bridge_tag: string; signal_type: string; polarity: string; weight: number; description?: string; is_active: boolean; status: string; };
type Form = { code: string; label: string; concern_bridge_tag: string; signal_type: string; polarity: string; weight: number; description: string; observable_threshold: string; is_active: boolean; status: string; };
const EMPTY: Form = { code: '', label: '', concern_bridge_tag: '', signal_type: 'behavioural', polarity: 'negative', weight: 0.5, description: '', observable_threshold: '', is_active: true, status: 'draft' };

export default function IndicatorsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<Indicator | null>(null);

  const { data, isLoading } = useQuery<{ items: Indicator[] }>({
    queryKey: ['/api/ontology/indicators', signalFilter, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ status: statusFilter, signal_type: signalFilter, limit: '500' });
      const res = await fetch(`/api/ontology/indicators?${p}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed'); return res.json();
    },
    staleTime: 15000,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter(i => i.label.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.concern_bridge_tag.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const url = editId ? `/api/ontology/indicators/${editId}` : '/api/ontology/indicators';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(fm) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/indicators'] }); toast({ title: editId ? 'Indicator updated' : 'Indicator created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/indicators/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/indicators'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const openEdit = (i: Indicator) => { setEditId(i.id); setForm({ code: i.code, label: i.label, concern_bridge_tag: i.concern_bridge_tag, signal_type: i.signal_type, polarity: i.polarity, weight: i.weight, description: i.description || '', observable_threshold: '', is_active: i.is_active, status: i.status }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Indicators</h2><p className="text-sm text-gray-500">Observable behavioural indicators linked to concerns — {filtered.length} entries</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="indicator" entityId="module" entityLabel="Indicators" />
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Indicator</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search indicators…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={signalFilter} onValueChange={setSignalFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{SIGNAL_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/indicators'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Label</TableHead><TableHead>Bridge Tag</TableHead><TableHead>Type</TableHead><TableHead>Polarity</TableHead><TableHead>Weight</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8"><Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />No indicators found</TableCell></TableRow>}
              {filtered.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                  <TableCell className="font-medium text-sm max-w-xs truncate">{i.label}</TableCell>
                  <TableCell><code className="text-xs text-blue-600">{i.concern_bridge_tag}</code></TableCell>
                  <TableCell><span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{i.signal_type}</span></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${POLARITY_COLORS[i.polarity] || ''}`}>{i.polarity}</span></TableCell>
                  <TableCell className="text-sm">{i.weight.toFixed(3)}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Indicator' : 'New Indicator'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="IND_AVOID_ACCOUNTABILITY" /></div>
            <div><Label>Label <span className="text-red-500">*</span></Label><Input value={form.label} onChange={e => f('label', e.target.value)} placeholder="Avoidance of accountability situations" /></div>
            <div><Label>Concern Bridge Tag <span className="text-red-500">*</span></Label><Input value={form.concern_bridge_tag} onChange={e => f('concern_bridge_tag', e.target.value)} placeholder="identity_self_worth" className="font-mono text-sm" /><p className="text-xs text-gray-400 mt-1">Must match capadex_concerns_master.relational_bridge_tag</p></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Signal Type</Label><Select value={form.signal_type} onValueChange={v => f('signal_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SIGNAL_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Polarity</Label><Select value={form.polarity} onValueChange={v => f('polarity', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="positive">Positive</SelectItem><SelectItem value="negative">Negative</SelectItem><SelectItem value="neutral">Neutral</SelectItem></SelectContent></Select></div>
              <div><Label>Weight</Label><Input type="number" min={0.001} max={1} step={0.001} value={form.weight} onChange={e => f('weight', parseFloat(e.target.value))} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div><Label>Observable Threshold</Label><Input value={form.observable_threshold} onChange={e => f('observable_threshold', e.target.value)} placeholder="Detectable when pattern appears ≥3 sessions" /></div>
            <div className="flex gap-4">
              <div className="flex-1"><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
              <div className="flex items-end gap-2 pb-0.5"><input type="checkbox" id="iia" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} /><label htmlFor="iia" className="text-sm">Active</label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.label || !form.concern_bridge_tag} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Indicator?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.code}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
