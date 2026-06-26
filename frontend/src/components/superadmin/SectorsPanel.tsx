import { BRAND } from '@/design-system/tokens';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Layers, RefreshCw, X, Check, Upload, Download, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';
import SubmitForReviewButton from './SubmitForReviewButton';


type Sector = { id: number; code: string; name: string; description?: string; is_active: boolean; status: string; sort_order: number; };
type Form = { code: string; name: string; description: string; is_active: boolean; status: string; sort_order: number; };
const EMPTY: Form = { code: '', name: '', description: '', is_active: true, status: 'draft', sort_order: 0 };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', published: 'bg-green-100 text-green-800', archived: 'bg-gray-100 text-gray-600' };

const IMPORT_COLUMNS = ['code', 'name', 'description', 'status', 'sort_order', 'is_active'];

// Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF).
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], val = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else inQ = false; }
      else val += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { cur.push(val); val = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cur.push(val); val = ''; rows.push(cur); cur = []; }
    else val += c;
  }
  if (val.length || cur.length) { cur.push(val); rows.push(cur); }
  const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ''));
  if (nonEmpty.length < 1) return [];
  const headers = nonEmpty[0].map(h => h.trim().toLowerCase());
  return nonEmpty.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
}

type ImportResult = { total: number; created: number; updated: number; failed: number; errors: { row: number; code?: string; error: string }[] };

export default function SectorsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [delConfirm, setDelConfirm] = useState<Sector | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data, isLoading } = useQuery<{ items: Sector[] }>({
    queryKey: ['/api/ontology/sectors', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/ontology/sectors?status=${statusFilter}&limit=200`, { credentials: 'include' });
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
      const url = editId ? `/api/ontology/sectors/${editId}` : '/api/ontology/sectors';
      const res = await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(f) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/sectors'] }); toast({ title: editId ? 'Sector updated' : 'Sector created' }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ontology/sectors/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/ontology/sectors'] }); toast({ title: 'Sector archived' }); setDelConfirm(null); },
  });

  const importMut = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const res = await fetch('/api/ontology/sectors/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ items: rows }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Import failed'); }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (r) => {
      setImportResult(r);
      qc.invalidateQueries({ queryKey: ['/api/ontology/sectors'] });
      toast({ title: 'Import complete', description: `${r.created} created · ${r.updated} updated · ${r.failed} failed` });
    },
    onError: (e: Error) => toast({ title: 'Import error', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => { setEditId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (i: Sector) => { setEditId(i.id); setForm({ code: i.code, name: i.name, description: i.description || '', is_active: i.is_active, status: i.status, sort_order: i.sort_order }); setDialogOpen(true); };
  const f = (k: keyof Form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const openImport = () => { setCsvText(''); setImportResult(null); setImportOpen(true); };
  const parsedRows = useMemo(() => parseCsv(csvText), [csvText]);
  const validRows = useMemo(() => parsedRows.filter(r => (r.code || '').trim() && (r.name || '').trim()), [parsedRows]);
  const invalidCount = parsedRows.length - validRows.length;
  const onCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };
  const downloadTemplate = () => {
    const csv = IMPORT_COLUMNS.join(',') + '\n' + 'SEC_EXAMPLE,Example Sector,Optional description,draft,0,true\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sectors_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const csvCell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const exportCsv = () => {
    if (!filtered.length) { toast({ title: 'Nothing to export', description: 'No sectors match the current filters.' }); return; }
    const lines = [IMPORT_COLUMNS.join(',')];
    for (const i of filtered) {
      lines.push([i.code, i.name, i.description, i.status, i.sort_order, i.is_active].map(csvCell).join(','));
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sectors_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Sectors</h2><p className="text-sm text-gray-500">Top-level sector taxonomy (parent of industries) — {filtered.length} entries</p></div>
        <div className="flex items-center gap-2">
          <SubmitForReviewButton entityType="sector" entityId="module" entityLabel="Sectors" />
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button variant="outline" onClick={openImport}><Upload className="h-4 w-4 mr-2" />Import CSV</Button>
          <Button onClick={openCreate} style={{ backgroundColor: BRAND.primary, color: 'white' }}><Plus className="h-4 w-4 mr-2" />Add Sector</Button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search sectors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => qc.invalidateQueries({ queryKey: ['/api/ontology/sectors'] })}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8"><Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />No sectors found</TableCell></TableRow>}
              {filtered.map(i => (
                <TableRow key={i.id} className="hover:bg-gray-50">
                  <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{i.code}</code></TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
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
          <DialogHeader><DialogTitle>{editId ? 'Edit Sector' : 'New Sector'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code <span className="text-red-500">*</span></Label><Input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} placeholder="SERVICES" disabled={!!editId} className="font-mono" />{editId && <p className="text-xs text-gray-400 mt-1">Code is immutable after creation</p>}</div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => f('sort_order', parseInt(e.target.value) || 0)} /></div>
            </div>
            <div><Label>Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Services" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} /></div>
            <div className="flex gap-4">
              <div className="flex-1"><Label>Status</Label><Select value={form.status} onValueChange={v => f('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
              <div className="flex items-end gap-2 pb-0.5"><input type="checkbox" id="sec-ia" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} /><label htmlFor="sec-ia" className="text-sm">Active</label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.code || !form.name} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{save.isPending ? 'Saving…' : (editId ? 'Update' : 'Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!importMut.isPending) setImportOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import Sectors from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-gray-600 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-gray-700 mb-1"><FileText className="h-3.5 w-3.5" />Expected columns</div>
              <code className="block bg-white rounded px-2 py-1 border text-[11px] mb-1">{IMPORT_COLUMNS.join(', ')}</code>
              <span><strong>code</strong> and <strong>name</strong> are required. Existing rows with the same <strong>code</strong> are updated (upsert). <strong>status</strong> = draft/published/archived; <strong>is_active</strong> = true/false.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download template</Button>
              <label className="inline-flex">
                <input type="file" accept=".csv,text/csv" onChange={onCsvFile} className="hidden" />
                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer hover:bg-gray-50"><Upload className="h-4 w-4" />Upload .csv file</span>
              </label>
            </div>
            <div>
              <Label>Or paste CSV content</Label>
              <Textarea value={csvText} onChange={e => { setCsvText(e.target.value); setImportResult(null); }} rows={6} placeholder={IMPORT_COLUMNS.join(',') + '\nSEC_SERVICES,Services,...,published,0,true'} className="font-mono text-xs" />
            </div>

            {csvText.trim() && !importResult && (
              <div className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-green-100 text-green-800">{validRows.length} valid</Badge>
                  {invalidCount > 0 && <Badge className="bg-red-100 text-red-800">{invalidCount} skipped (missing code/name)</Badge>}
                </div>
                {validRows.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded border">
                    <Table>
                      <TableHeader><TableRow className="bg-gray-50"><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {validRows.slice(0, 8).map((r, idx) => (
                          <TableRow key={idx}><TableCell className="font-mono text-xs">{(r.code || '').toUpperCase()}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-gray-500">{r.status || 'draft'}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {validRows.length > 8 && <div className="text-xs text-gray-400 px-3 py-1.5">…and {validRows.length - 8} more</div>}
                  </div>
                )}
              </div>
            )}

            {importResult && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                {importResult.failed === 0 ? (
                  <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 p-2.5 text-sm text-green-800">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span><strong>Import successful.</strong> All {importResult.total} row{importResult.total === 1 ? '' : 's'} processed — {importResult.created} created, {importResult.updated} updated.</span>
                  </div>
                ) : importResult.created + importResult.updated > 0 ? (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span><strong>Imported with errors.</strong> {importResult.created + importResult.updated} of {importResult.total} row{importResult.total === 1 ? '' : 's'} saved ({importResult.created} created, {importResult.updated} updated); {importResult.failed} failed — see details below.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-2.5 text-sm text-red-800">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span><strong>Import failed.</strong> None of the {importResult.total} row{importResult.total === 1 ? '' : 's'} could be saved — see errors below.</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">{importResult.created} created</Badge>
                  <Badge className="bg-blue-100 text-blue-800">{importResult.updated} updated</Badge>
                  {importResult.failed > 0 && <Badge className="bg-red-100 text-red-800">{importResult.failed} failed</Badge>}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-700">Errors ({importResult.errors.length})</div>
                    <div className="max-h-32 overflow-auto rounded border border-red-100 bg-red-50/40 p-2 text-xs text-red-700 space-y-0.5">
                      {importResult.errors.slice(0, 50).map((er, idx) => (<div key={idx}>Row {er.row}{er.code ? ` (${er.code})` : ''}: {er.error}</div>))}
                      {importResult.errors.length > 50 && <div className="text-red-400">…and {importResult.errors.length - 50} more</div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importMut.isPending}>{importResult ? 'Close' : 'Cancel'}</Button>
            {!importResult && (
              <Button onClick={() => importMut.mutate(validRows)} disabled={importMut.isPending || validRows.length === 0} style={{ backgroundColor: BRAND.primary, color: 'white' }}>
                {importMut.isPending ? 'Importing…' : `Import ${validRows.length} row${validRows.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Archive Sector?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Archive <strong>{delConfirm?.name}</strong>? This sets status to archived and hides it from active use.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => delConfirm && del.mutate(delConfirm.id)} disabled={del.isPending}>Archive</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
