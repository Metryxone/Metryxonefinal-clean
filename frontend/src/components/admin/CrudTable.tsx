/**
 * CrudTable — generic Add / Edit / Delete table used by FrameworkPanel
 * for Domains, Subdomains, and Items tabs.
 */
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Save, Search, AlertCircle, Download, Upload, Filter, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

/* ── CSV helpers ────────────────────────────────────────────────────────── */
function parseCsvLine(line: string): string[] {
  const result: string[] = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ',') { result.push(cur); cur = ''; } else cur += ch; }
  }
  result.push(cur); return result;
}
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.replace(/^\uFEFF/,'').trim());
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    return Object.fromEntries(headers.map((h,i) => [h,(vals[i]??'').trim()]));
  });
}
function toCsv(headers: string[], rows: Record<string, any>[]): string {
  const esc = (v: any) => { const s = String(v??''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

/* ── Inline Import Modal ─────────────────────────────────────────────────── */
function CrudImportModal({
  importApi, importType, templateHeaders, onClose, invalidate,
}: { importApi: string; importType: string; templateHeaders: string[]; onClose: () => void; invalidate: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string,string>[]>([]);
  const [status, setStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle');
  const [result, setResult] = useState<{inserted:number;updated:number;errors:string[]}|null>(null);
  const [errMsg, setErrMsg] = useState('');

  const downloadTemplate = () => {
    const blob = new Blob([templateHeaders.join(',') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${importType}-template.csv`; a.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCsv(ev.target?.result as string);
      if (!rows.length) { setErrMsg('No valid rows found — check column headers.'); setStatus('error'); return; }
      setPreview(rows.slice(0,5)); setStatus('idle'); setResult(null);
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    const file = fileRef.current?.files?.[0]; if (!file) return;
    setStatus('uploading');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const resp = await fetch(importApi, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: importType, rows }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Import failed');
      setResult(data); setStatus('done');
      invalidate();
    } catch (e: any) { setErrMsg(e.message); setStatus('error'); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Import {importType} (CSV)</DialogTitle>
          <DialogDescription>Upserts on the primary key — existing rows are updated, new rows are inserted.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Template */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <div className="flex-1 text-xs text-blue-800">
              <span className="font-medium">Download the CSV template</span>
              <span className="text-blue-500 ml-1">— required columns are pre-filled</span>
            </div>
            <Button size="sm" variant="outline" className="text-blue-700 border-blue-200 text-xs h-7" onClick={downloadTemplate}>
              <Download className="h-3 w-3 mr-1" /> Template
            </Button>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile}
              className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Preview (first {preview.length} rows)</p>
              <div className="border rounded overflow-hidden text-[10px]">
                <table className="w-full"><thead className="bg-gray-50 text-gray-500">
                  <tr>{Object.keys(preview[0]).slice(0,5).map(h => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr>
                </thead><tbody className="divide-y">
                  {preview.map((row,i) => <tr key={i}>{Object.values(row).slice(0,5).map((v,j) => <td key={j} className="px-2 py-1 text-gray-700 truncate max-w-[100px]">{v||'—'}</td>)}</tr>)}
                </tbody></table>
              </div>
            </div>
          )}

          {status === 'error' && <div className="bg-red-50 border border-red-100 rounded px-3 py-2 text-xs text-red-700">{errMsg}</div>}
          {status === 'done' && result && (
            <div className="bg-green-50 border border-green-100 rounded px-3 py-2 text-xs text-green-800 space-y-1">
              <p className="font-semibold">Import complete — {result.inserted} inserted · {result.updated} updated</p>
              {result.errors?.length > 0 && <p className="text-red-600">{result.errors.length} errors: {result.errors.slice(0,3).join(', ')}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" disabled={!preview.length || status === 'uploading' || status === 'done'} onClick={doImport}
            className="bg-[#344E86] hover:bg-[#2a3f6d] text-white text-xs">
            {status === 'uploading' ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ColDef {
  key: string;
  label: string;
  mono?: boolean;
  truncate?: boolean;
}

interface CrudTableProps {
  apiPath: string;
  adminApiPath: string;
  cols: ColDef[];
  fields: FieldDef[];
  title: string;
  color: string;
  defaultValues?: Record<string, any>;
  invalidateKeys?: string[];
  filterKeys?: string[];
  exportApi?: string;
  exportType?: string;
  importApi?: string;
  importType?: string;
  importTemplateHeaders?: string[];
}

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: 'include', ...opts });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `${r.status}`);
  }
  return r.json();
}

export function CrudTable({
  apiPath, adminApiPath, cols, fields, title, color, defaultValues = {}, invalidateKeys = [],
  filterKeys, exportApi, exportType, importApi, importType, importTemplateHeaders,
}: CrudTableProps) {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit'; row: Record<string, any> } | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const qc = useQueryClient();

  const data = useQuery<any[] | null, Error>({
    queryKey: [apiPath],
    queryFn: async () => {
      const r = await fetch(apiPath, { credentials: 'include' });
      if (r.status === 401) throw new Error('401');
      if (r.status === 403) throw new Error('403');
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
    staleTime: 0,
  });

  const allRows = Array.isArray(data.data) ? data.data : [];

  // Build unique option lists for each filter column
  const filterOptions: Record<string, string[]> = {};
  (filterKeys ?? []).forEach(key => {
    filterOptions[key] = [...new Set(allRows.map((r: any) => String(r[key] ?? '')).filter(Boolean))].sort();
  });

  const filterCount = Object.values(activeFilters).filter(Boolean).length;

  const rows = allRows.filter((r: any) => {
    if (search) {
      const q = search.toLowerCase();
      if (!cols.some(c => String(r[c.key] ?? '').toLowerCase().includes(q))) return false;
    }
    for (const [key, val] of Object.entries(activeFilters)) {
      if (val && String(r[key] ?? '') !== val) return false;
    }
    return true;
  });

  const clearFilters = () => { setActiveFilters({}); setSearch(''); };

  const doExport = () => {
    if (exportApi && exportType) {
      window.open(`${exportApi}?type=${exportType}`, '_blank');
    } else {
      // Fallback: export currently visible rows as CSV
      const headers = cols.map(c => c.key);
      const csv = toCsv(headers, rows);
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${title.toLowerCase().replace(/\s+/g,'-')}.csv`; a.click();
    }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [apiPath] });
    invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };

  const addMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      apiFetch(adminApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => { setDialog(null); invalidate(); toast.success(`${title} created`); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, any> }) =>
      apiFetch(`${adminApiPath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => { setDialog(null); invalidate(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${adminApiPath}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setDeleting(null); invalidate(); toast.success(`${title} deleted`); },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    const empty: Record<string, any> = { ...defaultValues };
    fields.forEach(f => {
      if (empty[f.key] === undefined) {
        empty[f.key] = f.type === 'number' ? '' : f.type === 'boolean' ? true : '';
      }
    });
    setDialog({ mode: 'add', row: empty });
  };

  const openEdit = (row: any) => setDialog({ mode: 'edit', row: { ...row } });

  const setField = (key: string, val: any) =>
    setDialog(d => d ? { ...d, row: { ...d.row, [key]: val } } : d);

  const handleSubmit = () => {
    if (!dialog) return;
    for (const f of fields) {
      if (f.required && !dialog.row[f.key] && dialog.row[f.key] !== 0) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    const body = { ...dialog.row };
    if (dialog.mode === 'add') {
      addMutation.mutate(body);
    } else {
      editMutation.mutate({ id: body.id, body });
    }
  };

  const pending = addMutation.isPending || editMutation.isPending;

  const hasActiveFiltersOrSearch = search || filterCount > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-2">
          {/* Top row: title + action buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {title}
              <Badge variant="outline" className="text-xs">
                {rows.length}{hasActiveFiltersOrSearch ? ` of ${allRows.length}` : ''}
              </Badge>
              {hasActiveFiltersOrSearch && (
                <button onClick={clearFilters} className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 ml-1">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-gray-400" />
                <Input
                  placeholder={`Search…`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 h-8 text-xs w-36"
                />
              </div>

              {/* Filter toggle (only when filterKeys provided) */}
              {filterKeys && filterKeys.length > 0 && (
                <Button
                  variant="outline" size="sm"
                  className={`h-8 text-xs gap-1 ${filterCount > 0 ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}`}
                  onClick={() => setShowFilters(f => !f)}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {filterCount > 0 && (
                    <Badge className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[9px]" style={{ backgroundColor: color, color: 'white' }}>
                      {filterCount}
                    </Badge>
                  )}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </Button>
              )}

              {/* Export */}
              {(exportApi || rows.length > 0) && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={doExport}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              )}

              {/* Import */}
              {importApi && importType && importTemplateHeaders && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowImport(true)}>
                  <Upload className="h-3.5 w-3.5" /> Import
                </Button>
              )}

              {/* Add */}
              <Button
                size="sm"
                onClick={openAdd}
                className="h-8 text-white text-xs"
                style={{ backgroundColor: color }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add {title}
              </Button>
            </div>
          </div>

          {/* Filter dropdown row */}
          {showFilters && filterKeys && filterKeys.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border rounded-lg">
              {filterKeys.map(key => {
                const col = cols.find(c => c.key === key);
                const label = col?.label ?? key;
                return (
                  <div key={key} className="flex flex-col gap-0.5 min-w-[110px]">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
                    <select
                      className="border rounded px-2 h-7 text-xs bg-white"
                      value={activeFilters[key] ?? ''}
                      onChange={e => setActiveFilters(f => ({ ...f, [key]: e.target.value }))}
                    >
                      <option value="">All</option>
                      {(filterOptions[key] ?? []).map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {filterCount > 0 && (
                <button
                  className="self-end text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5 pb-0.5"
                  onClick={() => setActiveFilters({})}
                >
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Import modal */}
      {showImport && importApi && importType && importTemplateHeaders && (
        <CrudImportModal
          importApi={importApi}
          importType={importType}
          templateHeaders={importTemplateHeaders}
          onClose={() => setShowImport(false)}
          invalidate={invalidate}
        />
      )}

      <CardContent>
        {data.isError ? (
          <div className={`flex items-center justify-between gap-3 text-sm rounded-lg px-4 py-3 ${
            data.error?.message === '401'
              ? 'text-red-700 bg-red-50 border border-red-100'
              : data.error?.message === '403'
              ? 'text-orange-700 bg-orange-50 border border-orange-100'
              : 'text-amber-700 bg-amber-50 border border-amber-100'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {data.error?.message === '401'
                  ? 'Not authenticated — your session may have expired. Log out and log back in as super admin.'
                  : data.error?.message === '403'
                  ? 'Access denied — super admin privileges required for this section.'
                  : `Request failed (${data.error?.message ?? 'unknown error'}). Check that the backend is running.`}
              </span>
            </div>
            <button
              onClick={() => data.refetch()}
              className="shrink-0 text-xs font-semibold px-3 py-1 rounded-md border transition-colors"
              style={{ borderColor: 'currentColor', opacity: 0.7 }}
            >
              Retry
            </button>
          </div>
        ) : data.isFetched && data.data === null ? (
          <div className="flex items-center justify-between gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Data unavailable — database table may not be migrated yet for this framework.</span>
            </div>
            <button
              onClick={() => data.refetch()}
              className="shrink-0 text-xs font-semibold px-3 py-1 rounded-md border border-amber-400 text-amber-700 transition-colors hover:bg-amber-100"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-y-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0 z-10">
                  <tr>
                    {cols.map(c => (
                      <th key={c.key} className="text-left px-3 py-2 font-semibold">{c.label}</th>
                    ))}
                    <th className="px-3 py-2 text-right w-20 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.isLoading
                    ? [1,2,3,4].map(i => (
                        <tr key={i}>
                          <td colSpan={cols.length + 1} className="px-3 py-2">
                            <div className="h-5 bg-gray-100 rounded animate-pulse w-full" />
                          </td>
                        </tr>
                      ))
                    : rows.map((row, idx) => (
                        <tr key={row.id ?? idx} className="hover:bg-gray-50 group">
                          {cols.map(c => (
                            <td
                              key={c.key}
                              className={`px-3 py-2 ${c.mono ? 'font-mono text-xs text-gray-600' : 'text-gray-900'} ${c.truncate ? 'max-w-xs truncate' : ''}`}
                            >
                              {typeof row[c.key] === 'boolean'
                                ? <Badge variant={row[c.key] ? 'default' : 'secondary'} className="text-[10px]">{row[c.key] ? 'Active' : 'Inactive'}</Badge>
                                : (row[c.key] ?? '—')}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-900"
                                onClick={() => openEdit(row)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                onClick={() => setDeleting(row)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {!data.isLoading && rows.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {hasActiveFiltersOrSearch
                    ? 'No results match your filters.'
                    : `No ${title.toLowerCase()} yet. Click "Add ${title}" to get started.`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Add / Edit Dialog ─────────────────────────────────────────── */}
        <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialog?.mode === 'add' ? `Add ${title}` : `Edit ${title}`}</DialogTitle>
              <DialogDescription>
                {dialog?.mode === 'add'
                  ? `Fill in the details to create a new ${title.toLowerCase()}.`
                  : `Update the ${title.toLowerCase()} record.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              {fields.map(f => (
                <div key={f.key}>
                  <Label className="text-xs text-gray-700">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  {f.type === 'textarea' ? (
                    <Textarea
                      value={dialog?.row[f.key] ?? ''}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="text-sm mt-1"
                      rows={3}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                      value={dialog?.row[f.key] ?? ''}
                      onChange={e => setField(f.key, e.target.value)}
                    >
                      <option value="">Select…</option>
                      {f.options?.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'boolean' ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="checkbox"
                        checked={!!dialog?.row[f.key]}
                        onChange={e => setField(f.key, e.target.checked)}
                        className="rounded h-4 w-4"
                      />
                      <span className="text-sm text-gray-600">{f.placeholder || 'Enabled'}</span>
                    </div>
                  ) : (
                    <Input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={dialog?.row[f.key] ?? ''}
                      onChange={e =>
                        setField(f.key, f.type === 'number'
                          ? (e.target.value === '' ? '' : Number(e.target.value))
                          : e.target.value)
                      }
                      placeholder={f.placeholder}
                      className="text-sm mt-1"
                    />
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={pending}
                className="text-white"
                style={{ backgroundColor: color }}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {dialog?.mode === 'add' ? 'Create' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Confirm ────────────────────────────────────────────── */}
        <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete{' '}
                <strong>
                  {deleting?.[cols[1]?.key] || deleting?.[cols[0]?.key] || 'this record'}
                </strong>
                ? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleting?.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
