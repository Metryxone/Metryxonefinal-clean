import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Users, RefreshCw, Check, X, ChevronDown, ListChecks } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '@/hooks/use-toast';
import SubmitForReviewButton from './SubmitForReviewButton';

const BRAND = { primary: '#344E86' };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };
const SENIORITY_COLORS: Record<string, string> = { intern: 'bg-gray-100 text-gray-600', junior: 'bg-blue-100 text-blue-700', mid: 'bg-indigo-100 text-indigo-700', senior: 'bg-purple-100 text-purple-700', lead: 'bg-orange-100 text-orange-700', principal: 'bg-red-100 text-red-700', manager: 'bg-green-100 text-green-700', sr_manager: 'bg-green-100 text-green-800', director: 'bg-teal-100 text-teal-700', vp: 'bg-pink-100 text-pink-700', c_suite: 'bg-yellow-100 text-yellow-800' };
const SENIORITY_LEVELS = ['intern','junior','mid','senior','lead','principal','manager','sr_manager','director','vp','c_suite'];

type Role = { id: number; code: string; title: string; role_family_id?: number; role_family_name?: string; seniority_level: string; description?: string; is_leadership: boolean; is_active: boolean; status: string; min_years_experience?: number; };
type RoleComp = { id: number; code: string; name: string; category?: string; competency_type?: string; importance_tier?: string; weight?: number; min_proficiency?: string; target_proficiency?: string; source?: string; };
type RoleFamily = { id: number; code: string; name: string; department_id?: number; is_active: boolean; status: string; };
type Dept = { id: number; name: string; code: string; };
type RoleForm = { code: string; title: string; role_family_id: string; seniority_level: string; description: string; responsibilities: string; min_years_experience: number; is_leadership: boolean; is_active: boolean; status: string; sort_order: number; };
type FamForm = { code: string; name: string; description: string; department_id: string; career_track_archetype: string; is_active: boolean; status: string; sort_order: number; };
const EMPTY_ROLE: RoleForm = { code: '', title: '', role_family_id: '', seniority_level: 'mid', description: '', responsibilities: '', min_years_experience: 0, is_leadership: false, is_active: true, status: 'draft', sort_order: 0 };
const EMPTY_FAM: FamForm = { code: '', name: '', description: '', department_id: '', career_track_archetype: 'ic', is_active: true, status: 'draft', sort_order: 0 };

export default function RolesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('roles');
  const [search, setSearch] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE);
  const [famForm, setFamForm] = useState<FamForm>(EMPTY_FAM);
  const [famDialog, setFamDialog] = useState(false);
  const [famEditId, setFamEditId] = useState<number | null>(null);
  const [delConfirm, setDelConfirm] = useState<{ id: number; name: string; type: 'role' | 'family' } | null>(null);
  const [compRole, setCompRole] = useState<Role | null>(null);

  const { data: rolesData, isLoading: rolesLoading } = useQuery<{ items: Role[] }>({
    queryKey: ['/api/ontology/roles', seniorityFilter, search],
    queryFn: async () => { const res = await fetch(`/api/ontology/roles?status=all&limit=300`, { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 15000,
  });
  const { data: famData } = useQuery<{ items: RoleFamily[] }>({
    queryKey: ['/api/ontology/role-families'],
    queryFn: async () => { const res = await fetch('/api/ontology/role-families?status=all&limit=200', { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 30000,
  });
  const { data: deptData } = useQuery<{ items: Dept[] }>({
    queryKey: ['/api/ontology/departments', 'all'],
    queryFn: async () => { const res = await fetch('/api/ontology/departments?status=all&limit=200', { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 60000,
  });

  const roles = rolesData?.items ?? [];
  const families = famData?.items ?? [];
  const depts = deptData?.items ?? [];

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter(r => {
      if (seniorityFilter !== 'all' && r.seniority_level !== seniorityFilter) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [roles, search, seniorityFilter]);

  const saveRole = useMutation({
    mutationFn: async (fm: RoleForm) => {
      const payload = { ...fm, role_family_id: fm.role_family_id ? parseInt(fm.role_family_id) : null, responsibilities: fm.responsibilities ? fm.responsibilities.split('\n').filter(Boolean) : [] };
      const url = editId ? `/api/ontology/roles/${editId}` : '/api/ontology/roles';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/roles'] }); toast({ title: editId ? 'Role updated' : 'Role created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveFam = useMutation({
    mutationFn: async (fm: FamForm) => {
      const payload = { ...fm, department_id: fm.department_id ? parseInt(fm.department_id) : null };
      const url = famEditId ? `/api/ontology/role-families/${famEditId}` : '/api/ontology/role-families';
      const res = await fetch(url, { method: famEditId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/role-families'] }); toast({ title: famEditId ? 'Family updated' : 'Family created' }); setFamDialog(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (d: { id: number; type: string }) => {
      const path = d.type === 'role' ? 'roles' : 'role-families';
      const res = await fetch(`/api/ontology/${path}/${d.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/roles'] }); qc.invalidateQueries({ queryKey: ['/api/ontology/role-families'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const { data: compData, isLoading: compLoading } = useQuery<{ items: RoleComp[]; total: number; native: number; derived: number }>({
    queryKey: ['/api/ontology/roles', compRole?.id, 'competencies'],
    enabled: !!compRole,
    queryFn: async () => { const res = await fetch(`/api/ontology/roles/${compRole!.id}/competencies`, { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    staleTime: 15000,
  });

  const rf = (k: keyof RoleForm, v: unknown) => setRoleForm(p => ({ ...p, [k]: v }));
  const ff = (k: keyof FamForm, v: unknown) => setFamForm(p => ({ ...p, [k]: v }));

  const openCreateRole = () => { setEditId(null); setRoleForm(EMPTY_ROLE); setDialogOpen(true); };
  const openEditRole = (r: Role) => { setEditId(r.id); setRoleForm({ code: r.code, title: r.title, role_family_id: r.role_family_id ? String(r.role_family_id) : '', seniority_level: r.seniority_level, description: r.description || '', responsibilities: '', min_years_experience: r.min_years_experience || 0, is_leadership: r.is_leadership, is_active: r.is_active, status: r.status, sort_order: 0 }); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Roles & Role Families</h2><p className="text-sm text-gray-500">{roles.length} roles · {families.length} families</p></div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger><TabsTrigger value="families">Role Families ({families.length})</TabsTrigger></TabsList>

        <TabsContent value="roles" className="space-y-3">
          <div className="flex gap-3 items-center justify-between">
            <div className="flex gap-3">
              <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search roles…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" /></div>
              <Select value={seniorityFilter} onValueChange={setSeniorityFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Levels</SelectItem>{SENIORITY_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex items-center gap-2">
              <SubmitForReviewButton entityType="role" entityId="module" entityLabel="Roles" />
              <Button onClick={openCreateRole} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Role</Button>
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Family</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {rolesLoading && <TableRow><TableCell colSpan={6} className="text-center py-8"><RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" /></TableCell></TableRow>}
                {!rolesLoading && filteredRoles.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8"><Users className="h-8 w-8 mx-auto mb-2 opacity-30" />No roles found</TableCell></TableRow>}
                {filteredRoles.map(r => (
                  <TableRow key={r.id} className="hover:bg-gray-50">
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.code}</code></TableCell>
                    <TableCell className="font-medium">{r.title}{r.is_leadership && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Leader</span>}</TableCell>
                    <TableCell className="text-sm text-gray-500">{r.role_family_name || '—'}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${SENIORITY_COLORS[r.seniority_level] || 'bg-gray-100'}`}>{r.seniority_level}</span></TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setCompRole(r)} title="View competencies"><ListChecks className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => openEditRole(r)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDelConfirm({ id: r.id, name: r.title, type: 'role' })} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="families" className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => { setFamEditId(null); setFamForm(EMPTY_FAM); setFamDialog(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Family</Button></div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Track Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {families.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">No role families found</TableCell></TableRow>}
                {families.map(f => (
                  <TableRow key={f.id} className="hover:bg-gray-50">
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{f.code}</code></TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{f.status}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status] || ''}`}>{f.status}</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setFamEditId(f.id); setFamForm({ code: f.code, name: f.name, description: '', department_id: '', career_track_archetype: 'ic', is_active: f.is_active, status: f.status, sort_order: 0 }); setFamDialog(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDelConfirm({ id: f.id, name: f.name, type: 'family' })} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit Role' : 'New Role'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={roleForm.code} onChange={e => rf('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="SWE_MID" /></div>
              <div><Label>Seniority</Label><Select value={roleForm.seniority_level} onValueChange={v => rf('seniority_level', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SENIORITY_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Title <span className="text-red-500">*</span></Label><Input value={roleForm.title} onChange={e => rf('title', e.target.value)} placeholder="Software Engineer II" /></div>
            <div><Label>Role Family</Label><Select value={roleForm.role_family_id || 'none'} onValueChange={v => rf('role_family_id', v === 'none' ? '' : v)}><SelectTrigger><SelectValue placeholder="Select family" /></SelectTrigger><SelectContent><SelectItem value="none">— None —</SelectItem>{families.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description</Label><Textarea value={roleForm.description} onChange={e => rf('description', e.target.value)} rows={2} /></div>
            <div><Label>Responsibilities (one per line)</Label><Textarea value={roleForm.responsibilities} onChange={e => rf('responsibilities', e.target.value)} rows={3} placeholder="Designs and implements..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Years Exp.</Label><Input type="number" min={0} value={roleForm.min_years_experience} onChange={e => rf('min_years_experience', parseInt(e.target.value) || 0)} /></div>
              <div><Label>Status</Label><Select value={roleForm.status} onValueChange={v => rf('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><input type="checkbox" id="il" checked={roleForm.is_leadership} onChange={e => rf('is_leadership', e.target.checked)} /><label htmlFor="il" className="text-sm">Leadership role</label></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="ira" checked={roleForm.is_active} onChange={e => rf('is_active', e.target.checked)} /><label htmlFor="ira" className="text-sm">Active</label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => saveRole.mutate(roleForm)} disabled={saveRole.isPending || !roleForm.code || !roleForm.title} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{saveRole.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family Dialog */}
      <Dialog open={famDialog} onOpenChange={setFamDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{famEditId ? 'Edit Role Family' : 'New Role Family'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={famForm.code} onChange={e => ff('code', e.target.value.toUpperCase())} disabled={!!famEditId} className="font-mono" placeholder="SWE_FAMILY" /></div>
              <div><Label>Track Archetype</Label><Select value={famForm.career_track_archetype} onValueChange={v => ff('career_track_archetype', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ic">Individual Contributor</SelectItem><SelectItem value="management">Management</SelectItem><SelectItem value="specialist">Specialist</SelectItem><SelectItem value="cross_functional">Cross-functional</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={famForm.name} onChange={e => ff('name', e.target.value)} placeholder="Software Engineer Family" /></div>
            <div><Label>Department</Label><Select value={famForm.department_id || 'none'} onValueChange={v => ff('department_id', v === 'none' ? '' : v)}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent><SelectItem value="none">— None —</SelectItem>{depts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description</Label><Textarea value={famForm.description} onChange={e => ff('description', e.target.value)} rows={2} /></div>
            <div className="flex gap-4">
              <div className="flex-1"><Label>Status</Label><Select value={famForm.status} onValueChange={v => ff('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div>
              <div className="flex items-end gap-2 pb-0.5"><input type="checkbox" id="ifa" checked={famForm.is_active} onChange={e => ff('is_active', e.target.checked)} /><label htmlFor="ifa" className="text-sm">Active</label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFamDialog(false)}>Cancel</Button><Button onClick={() => saveFam.mutate(famForm)} disabled={saveFam.isPending || !famForm.code || !famForm.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{saveFam.isPending ? 'Saving…' : (famEditId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Competencies Viewer */}
      <Dialog open={!!compRole} onOpenChange={() => setCompRole(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Competencies — {compRole?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {compLoading && <div className="text-center py-8"><RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>}
            {!compLoading && compData && (
              <>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{compData.native} O*NET / curated</span>
                  {compData.derived > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{compData.derived} estimated / inherited</span>}
                  <span className="text-gray-400">· {compData.total} total</span>
                </div>
                {compData.derived > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                    <span className="font-semibold">Estimated / inherited</span> rows were derived from sibling occupations because this role has no native O*NET ratings. Treat them as approximate, not measured.
                  </p>
                )}
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50"><TableHead>Competency</TableHead><TableHead>Tier</TableHead><TableHead>Weight</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(compData.items ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">No competencies linked to this role</TableCell></TableRow>}
                      {(compData.items ?? []).map(c => {
                        const isDerived = c.source === 'onet_derived';
                        return (
                          <TableRow key={c.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{c.name}<div className="text-xs text-gray-400 font-mono">{c.code}</div></TableCell>
                            <TableCell className="text-sm text-gray-600 capitalize">{c.importance_tier || '—'}</TableCell>
                            <TableCell className="text-sm text-gray-600">{c.weight != null ? Number(c.weight).toFixed(2) : '—'}</TableCell>
                            <TableCell>
                              {isDerived
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">Estimated / inherited</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">{c.source === 'onet' ? 'O*NET' : c.source === 'seeded' ? 'Curated' : (c.source || 'O*NET')}</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCompRole(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>?</p>
          <DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate({ id: delConfirm.id, type: delConfirm.type })}>Archive</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
