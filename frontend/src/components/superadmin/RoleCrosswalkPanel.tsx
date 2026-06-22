import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Link2, ShieldCheck, Wand2, AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86' };
const NONE = '__none__';

type CrosswalkRow = {
  onto_role_id: string;
  onto_title: string;
  ont_role_id: number | null;
  ont_role_code: string | null;
  match_method: string | null;
  confidence: string | null;
  verified: boolean | null;
  notes: string | null;
  ont_title: string | null;
  ont_code: string | null;
};
type OntRole = { id: number; code: string; title: string; };

const CONF_COLORS: Record<string, string> = { high: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-gray-100 text-gray-600' };

export default function RoleCrosswalkPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [mappedFilter, setMappedFilter] = useState('all');
  const [editRow, setEditRow] = useState<CrosswalkRow | null>(null);
  const [ontRoleId, setOntRoleId] = useState<string>('');
  const [verified, setVerified] = useState(false);
  const [notes, setNotes] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [resuggestConfirm, setResuggestConfirm] = useState(false);

  const { data, isLoading } = useQuery<{ items: CrosswalkRow[]; total: number }>({
    queryKey: ['/api/ontology/role-crosswalk', search, mappedFilter],
    queryFn: async () => {
      const res = await fetch(`/api/ontology/role-crosswalk?search=${encodeURIComponent(search.trim())}&mapped=${mappedFilter}&limit=200`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    staleTime: 15000,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const mappedCount = useMemo(() => items.filter(i => i.ont_role_id != null).length, [items]);
  const verifiedCount = useMemo(() => items.filter(i => i.verified).length, [items]);

  // ont_roles for the override dropdown.
  const { data: rolesData } = useQuery<{ items: OntRole[] }>({
    queryKey: ['/api/ontology/roles', 'crosswalk-picker'],
    queryFn: async () => {
      const res = await fetch('/api/ontology/roles?status=all&limit=1000', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load roles');
      return res.json();
    },
    staleTime: 60000,
  });
  const ontRoles = rolesData?.items ?? [];
  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return q ? ontRoles.filter(r => r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)) : ontRoles;
  }, [ontRoles, roleSearch]);

  const override = useMutation({
    mutationFn: async (payload: { onto_role_id: string; ont_role_id: string | null; verified: boolean; notes: string }) => {
      const res = await fetch('/api/ontology/role-crosswalk/override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ onto_role_id: payload.onto_role_id, ont_role_id: payload.ont_role_id, verified: payload.verified, notes: payload.notes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/role-crosswalk'] }); toast({ title: 'Mapping saved' }); setEditRow(null); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resuggest = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ontology/role-crosswalk/resuggest', { method: 'POST', credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Re-suggest failed'); }
      return res.json() as Promise<{ total: number; suggested: number; cleared: number; skipped: number }>;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['/api/ontology/role-crosswalk'] });
      toast({ title: 'Re-suggest complete', description: `${r.suggested} suggested · ${r.cleared} cleared · ${r.skipped} verified kept` });
      setResuggestConfirm(false);
    },
    onError: (e: Error) => toast({ title: 'Re-suggest error', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (row: CrosswalkRow) => {
    setEditRow(row);
    setOntRoleId(row.ont_role_id != null ? String(row.ont_role_id) : '');
    setVerified(!!row.verified);
    setNotes(row.notes || '');
    setRoleSearch('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Role Crosswalk</h2>
          <p className="text-sm text-gray-500">Persisted mapping: curated roles (onto) → O*NET roles (ont) — {mappedCount}/{items.length} shown mapped · {total} total · {verifiedCount} verified</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setResuggestConfirm(true)}><Wand2 className="h-4 w-4 mr-2" />Re-suggest mappings</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search roles…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={mappedFilter} onValueChange={setMappedFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/role-crosswalk'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Curated Role (onto)</TableHead>
                <TableHead>Mapped O*NET Role (ont)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8"><Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />No roles found</TableCell></TableRow>
              )}
              {items.map(i => (
                <TableRow key={i.onto_role_id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="font-medium">{i.onto_title}</div>
                    <code className="text-[11px] text-gray-400">{i.onto_role_id}</code>
                  </TableCell>
                  <TableCell>
                    {i.ont_role_id != null ? (
                      <div><div className="text-sm">{i.ont_title || '—'}</div><code className="text-[11px] text-gray-400">{i.ont_code}</code></div>
                    ) : <span className="text-xs text-gray-400">Unmapped</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{i.match_method || '—'}</TableCell>
                  <TableCell>{i.confidence ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONF_COLORS[i.confidence] || 'bg-gray-100 text-gray-600'}`}>{i.confidence}</span> : '—'}</TableCell>
                  <TableCell>{i.verified ? <ShieldCheck className="h-4 w-4 text-green-500" /> : <span className="text-xs text-gray-400">—</span>}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Link2 className="h-4 w-4 mr-1" />Map</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Override / Map Dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Map Role</DialogTitle></DialogHeader>
          {editRow && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-gray-50 border p-3">
                <div className="text-xs text-gray-500 mb-0.5">Curated role (onto)</div>
                <div className="font-medium">{editRow.onto_title}</div>
                <code className="text-[11px] text-gray-400">{editRow.onto_role_id}</code>
              </div>
              <div>
                <Label>O*NET Role (ont)</Label>
                <div className="relative mt-1 mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Filter O*NET roles…" value={roleSearch} onChange={e => setRoleSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={ontRoleId === '' ? NONE : ontRoleId} onValueChange={v => setOntRoleId(v === NONE ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NONE}>— Clear mapping —</SelectItem>
                    {filteredRoles.slice(0, 200).map(r => <SelectItem key={r.id} value={String(r.id)}>{r.title} <span className="text-gray-400">({r.code})</span></SelectItem>)}
                  </SelectContent>
                </Select>
                {filteredRoles.length > 200 && <p className="text-xs text-gray-400 mt-1">Showing first 200 — refine the filter to narrow.</p>}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cw-verified" checked={verified} onChange={e => setVerified(e.target.checked)} />
                <label htmlFor="cw-verified" className="text-sm">Mark as verified (human-confirmed; protected from re-suggest)</label>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional rationale for this mapping" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={() => editRow && override.mutate({ onto_role_id: editRow.onto_role_id, ont_role_id: ontRoleId === '' ? null : ontRoleId, verified, notes })} disabled={override.isPending} style={{ backgroundColor: BRAND.primary, color: 'white' }}>
              {override.isPending ? 'Saving…' : 'Save Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-suggest Confirm */}
      <Dialog open={resuggestConfirm} onOpenChange={(o) => { if (!resuggest.isPending) setResuggestConfirm(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Re-suggest all mappings?</DialogTitle></DialogHeader>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>This writes to the live database. It refreshes every <strong>non-verified</strong> mapping from the automatic title matcher and clears those it can no longer resolve. <strong>Verified mappings are never touched.</strong> This cannot be undone in bulk.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResuggestConfirm(false)} disabled={resuggest.isPending}>Cancel</Button>
            <Button onClick={() => resuggest.mutate()} disabled={resuggest.isPending} style={{ backgroundColor: BRAND.primary, color: 'white' }}>
              {resuggest.isPending ? 'Running…' : 'Run Re-suggest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
