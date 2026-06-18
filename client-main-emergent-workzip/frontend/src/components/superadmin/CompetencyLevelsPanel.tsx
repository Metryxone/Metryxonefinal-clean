import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Target, RefreshCw } from 'lucide-react';
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
const LEVEL_COLORS: Record<string, string> = { foundational: 'bg-gray-100 text-gray-700', developing: 'bg-blue-100 text-blue-700', proficient: 'bg-green-100 text-green-700', advanced: 'bg-purple-100 text-purple-700', expert: 'bg-yellow-100 text-yellow-800' };
const LEVELS = ['foundational', 'developing', 'proficient', 'advanced', 'expert'];
const LEVEL_DEFAULTS: Record<string, { min: number; max: number; num: number }> = { foundational: { min: 0, max: 39.99, num: 1 }, developing: { min: 40, max: 59.99, num: 2 }, proficient: { min: 60, max: 74.99, num: 3 }, advanced: { min: 75, max: 89.99, num: 4 }, expert: { min: 90, max: 100, num: 5 } };

type CLevel = { id: number; competency_code: string; competency_name: string; proficiency_level: string; level_number: number; score_band_min: number; score_band_max: number; behavioural_anchors: string[]; sample_evidence?: string[]; learning_actions?: string[]; is_active: boolean; };
type Form = { competency_code: string; competency_name: string; proficiency_level: string; level_number: number; score_band_min: number; score_band_max: number; behavioural_anchors: string; sample_evidence: string; learning_actions: string; is_active: boolean; };
const EMPTY: Form = { competency_code: '', competency_name: '', proficiency_level: 'proficient', level_number: 3, score_band_min: 60, score_band_max: 74.99, behavioural_anchors: '', sample_evidence: '', learning_actions: '', is_active: true };

export default function CompetencyLevelsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<CLevel | null>(null);

  const { data, isLoading } = useQuery<{ items: CLevel[] }>({
    queryKey: ['/api/ontology/competency-levels', levelFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (levelFilter !== 'all') params.set('competency_code', levelFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/ontology/competency-levels?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 15000,
  });

  const items = data?.items ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, CLevel[]>();
    items.forEach(i => { if (!map.has(i.competency_code)) map.set(i.competency_code, []); map.get(i.competency_code)!.push(i); });
    return map;
  }, [items]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const payload = {
        ...fm,
        behavioural_anchors: fm.behavioural_anchors.split('\n').filter(Boolean),
        sample_evidence: fm.sample_evidence ? fm.sample_evidence.split('\n').filter(Boolean) : null,
        learning_actions: fm.learning_actions ? fm.learning_actions.split('\n').filter(Boolean) : null,
      };
      const url = editId ? `/api/ontology/competency-levels/${editId}` : '/api/ontology/competency-levels';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/competency-levels'] }); toast({ title: 'Saved' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/competency-levels/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/competency-levels'] }); toast({ title: 'Deleted' }); setDelConfirm(null); },
  });

  const openCreate = () => { setEditId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (i: CLevel) => {
    setEditId(i.id);
    setForm({ competency_code: i.competency_code, competency_name: i.competency_name, proficiency_level: i.proficiency_level, level_number: i.level_number, score_band_min: i.score_band_min, score_band_max: i.score_band_max, behavioural_anchors: (i.behavioural_anchors || []).join('\n'), sample_evidence: (i.sample_evidence || []).join('\n'), learning_actions: (i.learning_actions || []).join('\n'), is_active: i.is_active });
    setDialogOpen(true);
  };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const onLevelChange = (level: string) => { const d = LEVEL_DEFAULTS[level]; setForm(p => ({ ...p, proficiency_level: level, level_number: d?.num ?? p.level_number, score_band_min: d?.min ?? p.score_band_min, score_band_max: d?.max ?? p.score_band_max })); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Competency Levels</h2><p className="text-sm text-gray-500">Proficiency band anchors per competency — {items.length} anchors across {grouped.size} competencies</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="competency-level" entityId="module" entityLabel="Competency Levels" />
          <Button onClick={openCreate} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Level Anchor</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search competency…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={levelFilter} onValueChange={setLevelFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Levels</SelectItem>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/competency-levels'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Competency</TableHead><TableHead>Level</TableHead><TableHead>Band</TableHead><TableHead>Anchors</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8"><Target className="h-8 w-8 mx-auto mb-2 opacity-30" />No level anchors defined yet</TableCell></TableRow>}
              {items.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><div className="font-medium text-sm">{i.competency_name || i.competency_code}</div><code className="text-xs text-gray-400">{i.competency_code}</code></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_COLORS[i.proficiency_level] || 'bg-gray-100'}`}>{i.proficiency_level} (L{i.level_number})</span></TableCell>
                  <TableCell className="text-sm text-gray-500">{i.score_band_min}–{i.score_band_max}</TableCell>
                  <TableCell className="text-sm text-gray-500">{(i.behavioural_anchors || []).length} anchors</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit Level Anchor' : 'New Level Anchor'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Competency Code <span className="text-red-500">*</span></Label><Input value={form.competency_code} onChange={e => f('competency_code', e.target.value.toUpperCase())} placeholder="CRITICAL_THINKING" className="font-mono" /></div>
              <div><Label>Proficiency Level <span className="text-red-500">*</span></Label><Select value={form.proficiency_level} onValueChange={onLevelChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Competency Name</Label><Input value={form.competency_name} onChange={e => f('competency_name', e.target.value)} placeholder="Critical Thinking" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Score Min</Label><Input type="number" value={form.score_band_min} onChange={e => f('score_band_min', parseFloat(e.target.value))} /></div>
              <div><Label>Score Max</Label><Input type="number" value={form.score_band_max} onChange={e => f('score_band_max', parseFloat(e.target.value))} /></div>
            </div>
            <div><Label>Behavioural Anchors <span className="text-red-500">*</span> <span className="text-xs text-gray-400">(one per line, min 2)</span></Label><Textarea value={form.behavioural_anchors} onChange={e => f('behavioural_anchors', e.target.value)} rows={4} placeholder="Applies structured frameworks to break down complex problems&#10;Identifies root causes rather than symptoms&#10;Validates assumptions with evidence" /></div>
            <div><Label>Sample Evidence <span className="text-xs text-gray-400">(one per line)</span></Label><Textarea value={form.sample_evidence} onChange={e => f('sample_evidence', e.target.value)} rows={3} placeholder="Led root cause analysis for P0 incident..." /></div>
            <div><Label>Learning Actions <span className="text-xs text-gray-400">(one per line)</span></Label><Textarea value={form.learning_actions} onChange={e => f('learning_actions', e.target.value)} rows={3} placeholder="Complete Systems Thinking course..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.competency_code || !form.proficiency_level || !form.behavioural_anchors.trim()} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Delete Level Anchor?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Remove the <strong>{delConfirm?.proficiency_level}</strong> anchor for <strong>{delConfirm?.competency_code}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Delete</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
