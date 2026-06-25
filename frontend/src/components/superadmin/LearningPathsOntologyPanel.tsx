import { BRAND } from '@/design-system/tokens';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, BookOpen, RefreshCw, ChevronDown, ChevronRight as ChevRight, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';


const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };
const DIFF_COLORS: Record<string, string> = { beginner: 'bg-green-100 text-green-700', intermediate: 'bg-blue-100 text-blue-700', advanced: 'bg-purple-100 text-purple-700' };
const STEP_TYPE_COLORS: Record<string, string> = { module: 'bg-blue-100 text-blue-700', assessment: 'bg-orange-100 text-orange-700', project: 'bg-green-100 text-green-700', reflection: 'bg-purple-100 text-purple-700', coaching: 'bg-pink-100 text-pink-700', peer_activity: 'bg-teal-100 text-teal-700' };

type LearningPath = { id: number; code: string; name: string; difficulty: string; delivery_mode: string; duration_weeks?: number; target_role_title?: string; step_count: number; status: string; };
type Step = { id: number; step_number: number; title: string; step_type: string; duration_hours?: number; is_required: boolean; };
type PathForm = { code: string; name: string; description: string; difficulty: string; delivery_mode: string; duration_weeks: string; status: string; sort_order: number; };
type StepForm = { title: string; description: string; step_type: string; duration_hours: string; is_required: boolean; };
const EMPTY_PATH: PathForm = { code: '', name: '', description: '', difficulty: 'intermediate', delivery_mode: 'blended', duration_weeks: '', status: 'draft', sort_order: 0 };
const EMPTY_STEP: StepForm = { title: '', description: '', step_type: 'module', duration_hours: '', is_required: true };

export default function LearningPathsOntologyPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PathForm>(EMPTY_PATH);
  const [delConfirm, setDelConfirm] = useState<LearningPath | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [stepDialog, setStepDialog] = useState<number | null>(null);
  const [stepForm, setStepForm] = useState<StepForm>(EMPTY_STEP);

  const { data, isLoading } = useQuery<{ items: LearningPath[] }>({
    queryKey: ['/api/ontology/learning-paths', diffFilter],
    queryFn: async () => { const res = await fetch('/api/ontology/learning-paths?status=all', { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 15000,
  });

  const { data: stepsData } = useQuery<{ items: Step[] }>({
    queryKey: ['/api/ontology/learning-paths', expanded, 'steps'],
    queryFn: async () => { if (!expanded) return { items: [] }; const res = await fetch(`/api/ontology/learning-paths/${expanded}/steps`, { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    enabled: !!expanded,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (diffFilter !== 'all' && i.difficulty !== diffFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, diffFilter]);

  const save = useMutation({
    mutationFn: async (fm: PathForm) => {
      const payload = { ...fm, duration_weeks: fm.duration_weeks ? parseInt(fm.duration_weeks) : null };
      const url = editId ? `/api/ontology/learning-paths/${editId}` : '/api/ontology/learning-paths';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/learning-paths'] }); toast({ title: editId ? 'Updated' : 'Created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/learning-paths/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/learning-paths'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const addStep = useMutation({
    mutationFn: async ({ pathId, sf }: { pathId: number; sf: StepForm }) => {
      const payload = { ...sf, duration_hours: sf.duration_hours ? parseFloat(sf.duration_hours) : null };
      const res = await fetch(`/api/ontology/learning-paths/${pathId}/steps`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to add step');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/learning-paths', expanded, 'steps'] }); toast({ title: 'Step added' }); setStepDialog(null); setStepForm(EMPTY_STEP); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteStep = useMutation({
    mutationFn: async ({ pathId, stepId }: { pathId: number; stepId: number }) => {
      const res = await fetch(`/api/ontology/learning-paths/${pathId}/steps/${stepId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/ontology/learning-paths', expanded, 'steps'] }),
  });

  const openEdit = (i: LearningPath) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: '', difficulty: i.difficulty, delivery_mode: i.delivery_mode, duration_weeks: i.duration_weeks ? String(i.duration_weeks) : '', status: i.status, sort_order: 0 }); setDialogOpen(true); };
  const f = (k: keyof PathForm, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const sf = (k: keyof StepForm, v: unknown) => setStepForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Learning Paths</h2><p className="text-sm text-gray-500">Structured step-by-step learning journeys — {filtered.length} paths</p></div>
        <Button onClick={() => { setEditId(null); setForm(EMPTY_PATH); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Path</Button>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search paths…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={diffFilter} onValueChange={setDiffFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Levels</SelectItem><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/learning-paths'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead></TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Mode</TableHead><TableHead>Duration</TableHead><TableHead>Steps</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-gray-400 py-8"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />No learning paths defined</TableCell></TableRow>}
              {filtered.map(i => (
                <React.Fragment key={i.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell><Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === i.id ? null : i.id)}>{expanded === i.id ? <ChevronDown className="h-4 w-4" /> : <ChevRight className="h-4 w-4" />}</Button></TableCell>
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                    <TableCell className="font-medium">{i.name}{i.target_role_title && <div className="text-xs text-gray-400">→ {i.target_role_title}</div>}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${DIFF_COLORS[i.difficulty] || 'bg-gray-100'}`}>{i.difficulty}</span></TableCell>
                    <TableCell className="text-sm text-gray-500">{i.delivery_mode}</TableCell>
                    <TableCell className="text-sm text-gray-500">{i.duration_weeks ? `${i.duration_weeks}w` : '—'}</TableCell>
                    <TableCell className="text-sm">{i.step_count}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || ''}`}>{i.status}</span></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                  {expanded === i.id && (
                    <TableRow><TableCell colSpan={9} className="bg-gray-50 p-0"><div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500">Steps ({(stepsData?.items || []).length})</p>
                        <Button size="sm" variant="outline" onClick={() => { setStepDialog(i.id); setStepForm(EMPTY_STEP); }}><Plus className="h-3 w-3 mr-1" />Add Step</Button>
                      </div>
                      {(stepsData?.items || []).length === 0 ? <p className="text-sm text-gray-400">No steps yet.</p> : (
                        <div className="space-y-1">{(stepsData?.items || []).map((s: Step) => (
                          <div key={s.id} className="flex items-center gap-2 text-sm bg-white rounded px-3 py-1.5 border">
                            <GripVertical className="h-3 w-3 text-gray-300" />
                            <span className="text-xs font-mono text-gray-400 w-6">{s.step_number}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${STEP_TYPE_COLORS[s.step_type] || 'bg-gray-100'}`}>{s.step_type}</span>
                            <span className="flex-1 font-medium">{s.title}</span>
                            {s.duration_hours && <span className="text-xs text-gray-400">{s.duration_hours}h</span>}
                            {!s.is_required && <span className="text-xs text-gray-400">optional</span>}
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => deleteStep.mutate({ pathId: i.id, stepId: s.id })}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        ))}</div>
                      )}
                    </div></TableCell></TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Path Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Learning Path' : 'New Learning Path'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="LP_SWE_FUNDAMENTALS" /></div>
              <div><Label>Duration (weeks)</Label><Input type="number" value={form.duration_weeks} onChange={e => f('duration_weeks', e.target.value)} placeholder="12" /></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Software Engineering Fundamentals" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Difficulty</Label><Select value={form.difficulty} onValueChange={v => f('difficulty', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent></Select></div>
              <div><Label>Delivery Mode</Label><Select value={form.delivery_mode} onValueChange={v => f('delivery_mode', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="self_paced">Self-paced</SelectItem><SelectItem value="instructor_led">Instructor-led</SelectItem><SelectItem value="blended">Blended</SelectItem><SelectItem value="coaching">Coaching</SelectItem></SelectContent></Select></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Step Dialog */}
      <Dialog open={stepDialog !== null} onOpenChange={() => setStepDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Learning Step</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title <span className="text-red-500">*</span></Label><Input value={stepForm.title} onChange={e => sf('title', e.target.value)} placeholder="Introduction to Clean Code" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Step Type</Label><Select value={stepForm.step_type} onValueChange={v => sf('step_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="module">Module</SelectItem><SelectItem value="assessment">Assessment</SelectItem><SelectItem value="project">Project</SelectItem><SelectItem value="reflection">Reflection</SelectItem><SelectItem value="coaching">Coaching</SelectItem><SelectItem value="peer_activity">Peer Activity</SelectItem></SelectContent></Select></div>
              <div><Label>Duration (hours)</Label><Input type="number" value={stepForm.duration_hours} onChange={e => sf('duration_hours', e.target.value)} placeholder="2.5" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={stepForm.description} onChange={e => sf('description', e.target.value)} rows={2} /></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="isr" checked={stepForm.is_required} onChange={e => sf('is_required', e.target.checked)} /><label htmlFor="isr" className="text-sm">Required step</label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStepDialog(null)}>Cancel</Button><Button onClick={() => stepDialog && addStep.mutate({ pathId: stepDialog, sf: stepForm })} disabled={addStep.isPending || !stepForm.title} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{addStep.isPending ? 'Adding…' : 'Add Step'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Path?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
