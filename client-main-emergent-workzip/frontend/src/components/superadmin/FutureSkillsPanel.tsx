import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
const CAT_COLORS: Record<string, string> = { digital: 'bg-blue-100 text-blue-700', ai_ml: 'bg-purple-100 text-purple-700', green: 'bg-green-100 text-green-700', human: 'bg-pink-100 text-pink-700', data: 'bg-indigo-100 text-indigo-700', leadership: 'bg-orange-100 text-orange-700', creative: 'bg-yellow-100 text-yellow-800', cross_functional: 'bg-teal-100 text-teal-700' };
const HORIZON_COLORS: Record<string, string> = { now: 'bg-red-100 text-red-700', '1_2_years': 'bg-orange-100 text-orange-700', '3_5_years': 'bg-blue-100 text-blue-700', '5_plus_years': 'bg-gray-100 text-gray-600' };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };

type FutureSkill = { id: number; code: string; name: string; skill_category: string; emergence_horizon: string; demand_trend: string; description?: string; is_active: boolean; status: string; };
type Form = { code: string; name: string; description: string; skill_category: string; emergence_horizon: string; demand_trend: string; relevance_industries: string; relevance_functions: string; is_active: boolean; status: string; };
const EMPTY: Form = { code: '', name: '', description: '', skill_category: 'digital', emergence_horizon: 'now', demand_trend: 'growing', relevance_industries: '', relevance_functions: '', is_active: true, status: 'draft' };

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'emerging' || trend === 'growing') return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

export default function FutureSkillsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [horizonFilter, setHorizonFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<FutureSkill | null>(null);

  const { data, isLoading } = useQuery<{ items: FutureSkill[] }>({
    queryKey: ['/api/ontology/future-skills', catFilter, horizonFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ skill_category: catFilter, status: 'all' });
      const res = await fetch(`/api/ontology/future-skills?${p}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed'); return res.json();
    },
    staleTime: 15000,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (horizonFilter !== 'all' && i.emergence_horizon !== horizonFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, horizonFilter]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const payload = { ...fm, relevance_industries: fm.relevance_industries ? fm.relevance_industries.split(',').map(s => s.trim()).filter(Boolean) : null, relevance_functions: fm.relevance_functions ? fm.relevance_functions.split(',').map(s => s.trim()).filter(Boolean) : null };
      const url = editId ? `/api/ontology/future-skills/${editId}` : '/api/ontology/future-skills';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/future-skills'] }); toast({ title: editId ? 'Updated' : 'Created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/future-skills/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/future-skills'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const openEdit = (i: FutureSkill) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: i.description || '', skill_category: i.skill_category, emergence_horizon: i.emergence_horizon, demand_trend: i.demand_trend, relevance_industries: '', relevance_functions: '', is_active: i.is_active, status: i.status }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Future Skills</h2><p className="text-sm text-gray-500">Emerging and future-critical skill catalogue — {filtered.length} skills</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="future-skill" entityId="module" entityLabel="Future Skills" />
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Skill</Button>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search skills…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem><SelectItem value="digital">Digital</SelectItem><SelectItem value="ai_ml">AI/ML</SelectItem><SelectItem value="green">Green</SelectItem><SelectItem value="human">Human</SelectItem><SelectItem value="data">Data</SelectItem><SelectItem value="leadership">Leadership</SelectItem><SelectItem value="creative">Creative</SelectItem><SelectItem value="cross_functional">Cross-functional</SelectItem></SelectContent></Select>
        <Select value={horizonFilter} onValueChange={setHorizonFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Horizons</SelectItem><SelectItem value="now">Now</SelectItem><SelectItem value="1_2_years">1–2 years</SelectItem><SelectItem value="3_5_years">3–5 years</SelectItem><SelectItem value="5_plus_years">5+ years</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/future-skills'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Horizon</TableHead><TableHead>Trend</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8"><Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />No future skills defined</TableCell></TableRow>}
              {filtered.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[i.skill_category] || 'bg-gray-100'}`}>{i.skill_category}</span></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${HORIZON_COLORS[i.emergence_horizon] || 'bg-gray-100'}`}>{i.emergence_horizon.replace(/_/g, ' ')}</span></TableCell>
                  <TableCell><div className="flex items-center gap-1"><TrendIcon trend={i.demand_trend} /><span className="text-xs text-gray-600">{i.demand_trend}</span></div></TableCell>
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
          <DialogHeader><DialogTitle>{editId ? 'Edit Future Skill' : 'New Future Skill'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="FS_PROMPT_ENGINEERING" /></div>
              <div><Label>Category</Label><Select value={form.skill_category} onValueChange={v => f('skill_category', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="digital">Digital</SelectItem><SelectItem value="ai_ml">AI/ML</SelectItem><SelectItem value="green">Green</SelectItem><SelectItem value="human">Human</SelectItem><SelectItem value="data">Data</SelectItem><SelectItem value="leadership">Leadership</SelectItem><SelectItem value="creative">Creative</SelectItem><SelectItem value="cross_functional">Cross-functional</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Prompt Engineering" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emergence Horizon</Label><Select value={form.emergence_horizon} onValueChange={v => f('emergence_horizon', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Now</SelectItem><SelectItem value="1_2_years">1–2 years</SelectItem><SelectItem value="3_5_years">3–5 years</SelectItem><SelectItem value="5_plus_years">5+ years</SelectItem></SelectContent></Select></div>
              <div><Label>Demand Trend</Label><Select value={form.demand_trend} onValueChange={v => f('demand_trend', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="emerging">Emerging</SelectItem><SelectItem value="growing">Growing</SelectItem><SelectItem value="stable">Stable</SelectItem><SelectItem value="declining">Declining</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Relevant Industries <span className="text-xs text-gray-400">(comma-separated codes)</span></Label><Input value={form.relevance_industries} onChange={e => f('relevance_industries', e.target.value)} placeholder="TECH, FINTECH, HEALTHCARE" /></div>
            <div><Label>Relevant Functions <span className="text-xs text-gray-400">(comma-separated codes)</span></Label><Input value={form.relevance_functions} onChange={e => f('relevance_functions', e.target.value)} placeholder="ENGINEERING, PRODUCT, DATA" /></div>
            <div className="flex gap-4">
              <div className="flex-1"><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
              <div className="flex items-end gap-2 pb-0.5"><input type="checkbox" id="ifs" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} /><label htmlFor="ifs" className="text-sm">Active</label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Skill?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
