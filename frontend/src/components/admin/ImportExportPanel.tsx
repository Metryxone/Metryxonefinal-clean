/**
 * ImportExportPanel — unified import / export dialog for all three frameworks.
 * Export: download combined flat CSV (all data) or full JSON backup.
 * Import: upload CSV or JSON file → preview → upsert via POST.
 *         Includes "Download Template" button for blank CSV.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download, Upload, FileJson, FileSpreadsheet, CheckCircle2,
  AlertTriangle, Loader2, X, ArrowRight, ChevronDown, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── CSV / JSON parser ───────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportType {
  type: string;
  label: string;
  icon: 'csv' | 'json';
  description: string;
  templateHeaders?: string[];
}

interface ImportResult {
  inserted: number;
  updated: number;
  errors: string[];
}

interface Props {
  exportApi: string;
  importApi: string;
  exportTypes: ExportType[];
  color: string;
  frameworkName: string;
}

// ─── Trigger button ──────────────────────────────────────────────────────────

export function ImportExportButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs shrink-0"
        onClick={() => setOpen(true)}
      >
        <Download className="h-3.5 w-3.5" />
        Import / Export
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>
      <ImportExportDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

function ImportExportDialog({
  exportApi, importApi, exportTypes, color, frameworkName, open, onClose,
}: Props & { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState<'export' | 'import'>('export');

  // Import state
  const csvTypes = exportTypes.filter(t => t.icon === 'csv');
  const jsonTypes = exportTypes.filter(t => t.icon === 'json');
  const [importType, setImportType] = useState(csvTypes[0]?.type || '');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Export state
  const [downloading, setDownloading] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Sync importType whenever exportTypes changes (e.g. after HMR — stale state guard)
  useEffect(() => {
    if (!csvTypes.find(t => t.type === importType) && csvTypes.length > 0) {
      setImportType(csvTypes[0].type);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportTypes]);

  const reset = () => { setParsedRows(null); setFileName(''); setResult(null); };
  const handleClose = () => { reset(); setSection('export'); onClose(); };

  // ── Template download ─────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const et = exportTypes.find(t => t.type === activeImportType) ?? exportTypes.find(t => t.templateHeaders);
    if (!et?.templateHeaders) return;
    const csv = '\uFEFF' + et.templateHeaders.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${et.type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const doExport = async (type: string, isJson: boolean) => {
    setDownloading(type);
    try {
      const r = await fetch(`${exportApi}?type=${type}`, { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = r.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.href = url;
      a.download = match?.[1] || `export.${isJson ? 'json' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  };

  // ── Import file pick ──────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const rows = Array.isArray(data) ? data
            : Array.isArray(data[importType]) ? data[importType]
            : Array.isArray(data.rows) ? data.rows
            : null;
          if (!rows) throw new Error('JSON must be an array or contain the data type as a key');
          setParsedRows(rows);
        } else {
          const rows = parseCsv(text);
          if (rows.length === 0) throw new Error('No rows found in CSV');
          setParsedRows(rows);
        }
      } catch (err: any) {
        toast.error(`Parse error: ${err.message}`);
        setParsedRows(null);
      }
    };
    reader.readAsText(file);
  };

  // ── Import submit ─────────────────────────────────────────────────────────
  const doImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const r = await fetch(importApi, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: importType, rows: parsedRows }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      setResult(data);
      if (data.errors?.length === 0) {
        toast.success(`Import complete — ${data.inserted} inserted, ${data.updated} updated`);
      } else {
        toast.warning(`Import done with ${data.errors.length} error(s)`);
      }
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Guard: if importType no longer exists in config (stale state), fall back to first csv type
  const activeImportType = csvTypes.find(t => t.type === importType) ? importType : (csvTypes[0]?.type || '');
  const previewCols = parsedRows && parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
  const selectedExportType = exportTypes.find(t => t.type === activeImportType);
  const hasTemplate = !!selectedExportType?.templateHeaders;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: color }}
            />
            {frameworkName} — Import / Export
          </DialogTitle>
        </DialogHeader>

        {/* Section toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {(['export', 'import'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setSection(s); reset(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all"
              style={section === s ? { background: color, color: '#fff' } : { color: '#6b7280' }}
            >
              {s === 'export' ? <Download className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* ── EXPORT ── */}
        {section === 'export' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Download all framework data as a single flat CSV spreadsheet (domains + sub-level combined,
              including content and weightages) or a full JSON backup.
              CSV files can be edited in Excel and re-imported.
            </p>

            {csvTypes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">CSV Export</p>
                <div className="grid grid-cols-1 gap-2">
                  {csvTypes.map(t => (
                    <button
                      key={t.type}
                      onClick={() => doExport(t.type, false)}
                      disabled={downloading === t.type}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:border-gray-400 transition-all text-left disabled:opacity-50"
                    >
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: color + '18' }}
                      >
                        {downloading === t.type
                          ? <Loader2 className="h-4 w-4 animate-spin" style={{ color }} />
                          : <FileSpreadsheet className="h-4 w-4" style={{ color }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800">{t.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{t.description}</div>
                        {t.templateHeaders && (
                          <div className="text-[10px] text-gray-400 mt-1 font-mono truncate">
                            {t.templateHeaders.join(' · ')}
                          </div>
                        )}
                      </div>
                      <div
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: color + '18', color }}
                      >
                        .csv
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {jsonTypes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Full Backup</p>
                <div className="grid grid-cols-1 gap-2">
                  {jsonTypes.map(t => (
                    <button
                      key={t.type}
                      onClick={() => doExport(t.type, true)}
                      disabled={downloading === t.type}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:border-gray-400 transition-all text-left disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: '#344E8614' }}>
                        {downloading === t.type
                          ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#344E86' }} />
                          : <FileJson className="h-4 w-4" style={{ color: '#344E86' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800">{t.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{t.description}</div>
                      </div>
                      <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#344E8614', color: '#344E86' }}>
                        .json
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── IMPORT ── */}
        {section === 'import' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Import rows from a CSV or JSON file. Existing records are updated by code;
              new records are inserted. Download the template first to see the expected column format.
            </p>

            {/* Data type selector */}
            {csvTypes.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Type</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {csvTypes.map(t => (
                    <label
                      key={t.type}
                      className="flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-all"
                      style={importType === t.type ? { borderColor: color, background: color + '0D' } : {}}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={importType === t.type}
                        onChange={() => { setImportType(t.type); reset(); }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{ borderColor: importType === t.type ? color : '#d1d5db' }}
                      >
                        {importType === t.type && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Template download */}
            {hasTemplate && (
              <div
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: color + '40', background: color + '08' }}
              >
                <div>
                  <p className="text-xs font-semibold text-gray-700">Download Import Template</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Blank CSV with the correct column headers for{' '}
                    <span className="font-medium">{selectedExportType?.label}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="gap-1.5 text-xs shrink-0"
                  style={{ borderColor: color, color }}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Template
                </Button>
              </div>
            )}

            {/* File upload zone */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upload File</p>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                style={fileName ? { borderColor: color } : {}}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json"
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" style={{ color }} />
                    <span className="text-sm font-medium text-gray-700">{fileName}</span>
                    <button
                      onClick={e => { e.stopPropagation(); reset(); if (fileRef.current) fileRef.current.value = ''; }}
                      className="text-gray-400 hover:text-gray-600 ml-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Drop a CSV or JSON file here, or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">Supports .csv and .json formats</p>
                  </>
                )}
              </div>
            </div>

            {/* Preview table */}
            {parsedRows && parsedRows.length > 0 && !result && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</p>
                  <Badge variant="secondary" className="text-xs">
                    {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="border rounded-lg overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {previewCols.map(c => (
                          <th key={c} className="text-left px-2.5 py-1.5 font-semibold text-gray-600 whitespace-nowrap border-b">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 8).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          {previewCols.map(c => (
                            <td key={c} className="px-2.5 py-1 text-gray-700 max-w-[200px] truncate" title={String(row[c] ?? '')}>
                              {String(row[c] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 8 && (
                  <p className="text-[10px] text-gray-400 mt-1 text-center">
                    Showing 8 of {parsedRows.length} rows
                  </p>
                )}
              </div>
            )}

            {/* Import result */}
            {result && (
              <div className={`rounded-lg p-3 ${result.errors.length === 0 ? 'border' : 'bg-amber-50 border border-amber-200'}`}
                style={result.errors.length === 0 ? { background: '#344E8608', borderColor: '#344E8630' } : {}}>
                <div className="flex items-center gap-2 mb-1">
                  {result.errors.length === 0
                    ? <CheckCircle2 className="h-4 w-4" style={{ color: '#344E86' }} />
                    : <AlertTriangle className="h-4 w-4 text-amber-500" />
                  }
                  <span className="text-sm font-semibold">
                    {result.errors.length === 0 ? 'Import successful' : 'Import completed with errors'}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-600 mb-1">
                  <span><strong>{result.inserted}</strong> inserted</span>
                  <span><strong>{result.updated}</strong> updated</span>
                  {result.errors.length > 0 && (
                    <span className="text-red-600"><strong>{result.errors.length}</strong> errors</span>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5 max-h-24 overflow-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-[10px] text-red-600 font-mono">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Close</Button>
          {section === 'import' && !result && (
            <Button
              size="sm"
              disabled={!parsedRows || parsedRows.length === 0 || importing}
              onClick={doImport}
              style={{ background: color, color: '#fff' }}
              className="gap-1.5"
            >
              {importing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</>
                : <><ArrowRight className="h-3.5 w-3.5" />Import {parsedRows?.length || 0} rows</>
              }
            </Button>
          )}
          {section === 'import' && result && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { reset(); if (fileRef.current) fileRef.current.value = ''; }}
            >
              Import another file
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
