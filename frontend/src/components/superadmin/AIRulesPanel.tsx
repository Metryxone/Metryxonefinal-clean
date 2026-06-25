import { BRAND } from '@/design-system/tokens';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Bot, RefreshCw, ShieldCheck, ShieldAlert, Play, Pause, CheckCircle, Clock, ChevronDown, ChevronRight as ChevRight, History } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';
import SubmitForReviewButton from './SubmitForReviewButton';


const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', in_review: 'bg-blue-100 text-blue-700', approved: 'bg-indigo-100 text-indigo-700', active: 'bg-green-100 text-green-800', suspended: 'bg-orange-100 text-orange-700', archived: 'bg-gray-100 text-gray-600' };
const RISK_COLORS: Record<string, string> = { low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const TYPE_COLORS: Record<string, string> = { scoring: 'bg-blue-100 text-blue-700', routing: 'bg-teal-100 text-teal-700', suppression: 'bg-red-100 text-red-700', language: 'bg-purple-100 text-purple-700', recommendation: 'bg-green-100 text-green-700', threshold: 'bg-orange-100 text-orange-700', safety: 'bg-pink-100 text-pink-700' };
const RULE_TYPES = ['scoring', 'routing', 'suppression', 'language', 'recommendation', 'threshold', 'safety'];
const APPLIES_TO = ['all', 'capadex', 'lbi', 'sdi', 'competency', 'career', 'reports', 'benchmarks'];

type AIRule = { id: number; code: string; name: string; rule_type: string; applies_to: string; priority: number; is_enabled: boolean; risk_level: string; status: string; requires_dual_approval: boolean; approved_by?: string; rationale?: string; };
type Form = { code: string; name: string; description: string; rule_type: string; applies_to: string; priority: number; risk_level: string; rationale: string; requires_dual_approval: boolean; };
const EMPTY: Form = { code: '', name: '', description: '', rule_type: 'scoring', applies_to: 'all', priority: 5, risk_level: 'low', rationale: '', requires_dual_approval: false };

export default function AIRulesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<AIRule | null>(null);
  const [auditRule, setAuditRule] = useState<number | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [approveDialog, setApproveDialog] = useState<AIRule | null>(null);

  const { data, isLoading } = useQuery<{ items: AIRule[] }>({
    queryKey: ['/api/ontology/ai-rules', typeFilter, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ rule_type: typeFilter, status: statusFilter });
      const res = await fetch(`/api/ontology/ai-rules?${p}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed'); return res.json();
    },
    staleTime: 15000,
  });

  const { data: auditData } = useQuery<{ entries: any[] }>({
    queryKey: ['/api/ontology/ai-rules', auditRule, 'audit'],
    queryFn: async () => { if (!auditRule) return { entries: [] }; const res = await fetch(`/api/ontology/ai-rules/${auditRule}/audit-log`, { credentials: 'include' }); if (!res.ok) throw new Error('Failed'); return res.json(); },
    enabled: !!auditRule,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (typeFilter !== 'all' && i.rule_type !== typeFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, typeFilter, statusFilter]);

  const save = useMutation({
    mutationFn: async (fm: Form) => {
      const url = editId ? `/api/ontology/ai-rules/${editId}` : '/api/ontology/ai-rules';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(fm) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/ai-rules'] }); toast({ title: editId ? 'Rule updated' : 'Rule created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const approve = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await fetch(`/api/ontology/ai-rules/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ note }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Approve failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/ai-rules'] }); toast({ title: 'Rule approved' }); setApproveDialog(null); setApproveNote(''); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const enable = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ontology/ai-rules/${id}/enable`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/ai-rules'] }); toast({ title: 'Rule enabled' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const suspend = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ontology/ai-rules/${id}/suspend`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/ai-rules'] }); toast({ title: 'Rule suspended' }); },
  });

  const del = useMutation({
    mutationFn: async (id: number) => { const res = await fetch(`/api/ontology/ai-rules/${id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/ai-rules'] }); toast({ title: 'Archived' }); setDelConfirm(null); },
  });

  const openEdit = (i: AIRule) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: '', rule_type: i.rule_type, applies_to: i.applies_to, priority: i.priority, risk_level: i.risk_level, rationale: i.rationale || '', requires_dual_approval: i.requires_dual_approval }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>AI Rules</h2>
          <p className="text-sm text-gray-500">Governance rules for scoring, routing, suppression, and language policy — {filtered.length} rules</p>
        </div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="ai-rule" entityId="module" entityLabel="AI Rules" />
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setDialogOpen(true); }} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />New Rule</Button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <ShieldAlert className="inline h-4 w-4 mr-1" /><strong>Governance Notice:</strong> AI Rules require approval before activation. High/critical risk rules require dual approval (maker + checker). Rules are off by default.
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search rules…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{RULE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/ai-rules'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Applies To</TableHead><TableHead>Risk</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8"><Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />No AI rules defined</TableCell></TableRow>}
              {filtered.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{i.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {i.is_enabled && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Play className="h-2.5 w-2.5" />Enabled</span>}
                      {i.requires_dual_approval && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Dual approval</span>}
                    </div>
                  </TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[i.rule_type] || 'bg-gray-100'}`}>{i.rule_type}</span></TableCell>
                  <TableCell className="text-sm text-gray-600">{i.applies_to}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[i.risk_level] || 'bg-gray-100'}`}>{i.risk_level}</span></TableCell>
                  <TableCell className="text-sm font-mono">{i.priority}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] || ''}`}>{i.status}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {i.status === 'draft' && <Button variant="ghost" size="sm" onClick={() => setApproveDialog(i)} title="Approve"><CheckCircle className="h-4 w-4 text-green-500" /></Button>}
                      {i.status === 'approved' && !i.is_enabled && <Button variant="ghost" size="sm" onClick={() => enable.mutate(i.id)} title="Enable"><Play className="h-4 w-4 text-green-600" /></Button>}
                      {i.status === 'active' && i.is_enabled && <Button variant="ghost" size="sm" onClick={() => suspend.mutate(i.id)} title="Suspend"><Pause className="h-4 w-4 text-orange-500" /></Button>}
                      <Button variant="ghost" size="sm" onClick={() => setAuditRule(auditRule === i.id ? null : i.id)} title="Audit log"><History className="h-4 w-4 text-gray-400" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDelConfirm(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Audit Log inline */}
      {auditRule && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Audit Log — Rule #{auditRule}</p>
          {(auditData?.entries || []).length === 0 ? <p className="text-sm text-gray-400">No audit entries.</p> : (
            <div className="space-y-1 text-sm">{(auditData?.entries || []).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 text-xs text-gray-600 py-1 border-b last:border-0">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="font-mono">{new Date(e.changed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_COLORS[e.action] || 'bg-gray-100 text-gray-600'}`}>{e.action}</span>
                <span>{e.changed_by}</span>
                {e.change_note && <span className="text-gray-400 italic">{e.change_note}</span>}
              </div>
            ))}</div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit AI Rule' : 'New AI Rule'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} disabled={!!editId} className="font-mono" placeholder="RULE_LANG_NO_SUITABILITY" /></div>
              <div><Label>Priority (1–10)</Label><Input type="number" min={1} max={10} value={form.priority} onChange={e => f('priority', parseInt(e.target.value) || 5)} /></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Suppress suitability language" /></div>
            <div><Label>Description <span className="text-red-500">*</span></Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} placeholder="Prevents suitability/hiring language in all outputs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rule Type</Label><Select value={form.rule_type} onValueChange={v => f('rule_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RULE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Applies To</Label><Select value={form.applies_to} onValueChange={v => f('applies_to', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{APPLIES_TO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Rationale</Label><Textarea value={form.rationale} onChange={e => f('rationale', e.target.value)} rows={2} placeholder="Why this rule exists and what it prevents..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Risk Level</Label><Select value={form.risk_level} onValueChange={v => f('risk_level', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
              <div className="flex items-end gap-2 pb-0.5"><input type="checkbox" id="irda" checked={form.requires_dual_approval} onChange={e => f('requires_dual_approval', e.target.checked)} /><label htmlFor="irda" className="text-sm">Requires dual approval</label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name || !form.description} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Approve AI Rule</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">Approve <strong>{approveDialog?.name}</strong>? Once approved, it can be enabled.</p>
            <div><Label>Approval Note</Label><Textarea value={approveNote} onChange={e => setApproveNote(e.target.value)} rows={2} placeholder="Reviewed and approved for activation..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button><Button onClick={() => approveDialog && approve.mutate({ id: approveDialog.id, note: approveNote })} disabled={approve.isPending} style={{ backgroundColor: '#10b981', color: 'white' }}><CheckCircle className="h-4 w-4 mr-2" />{approve.isPending ? 'Approving…' : 'Approve Rule'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Rule?</DialogTitle></DialogHeader><p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>? This will disable it and log the action.</p><DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)}>Archive</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
