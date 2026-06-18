import { useState, useRef } from 'react';
import { Download, Upload, FileDown, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const MODULES = [
  { id: 'industries',        label: 'Industries',          requiredCols: 'code, name' },
  { id: 'functions',         label: 'Functions',           requiredCols: 'code, name' },
  { id: 'departments',       label: 'Departments',         requiredCols: 'code, name' },
  { id: 'role-families',     label: 'Role Families',       requiredCols: 'code, name' },
  { id: 'roles',             label: 'Roles',               requiredCols: 'code, title' },
  { id: 'career-tracks',     label: 'Career Tracks',       requiredCols: 'code, name' },
  { id: 'career-paths',      label: 'Career Paths',        requiredCols: 'code, name' },
  { id: 'competency-levels', label: 'Competency Levels',   requiredCols: 'competency_code, proficiency_level' },
  { id: 'indicators',        label: 'Indicators',          requiredCols: 'code, label, concern_bridge_tag' },
  { id: 'benchmarks',        label: 'Benchmarks',          requiredCols: 'code, name' },
  { id: 'future-skills',     label: 'Future Skills',       requiredCols: 'code, name' },
  { id: 'ai-rules',          label: 'AI Rules',            requiredCols: 'code, name, description' },
] as const;

type ModuleId = typeof MODULES[number]['id'];

interface ImportResult {
  inserted: number;
  updated:  number;
  errors:   { row: number; error: string }[];
  results:  { row: number; status: string; code?: string; error?: string }[];
}

export default function OntologyImportExportPanel() {
  const [selectedModule, setSelectedModule] = useState<ModuleId>('industries');
  const [exportStatus,   setExportStatus]   = useState<string>('all');
  const [importLoading,  setImportLoading]  = useState(false);
  const [importResult,   setImportResult]   = useState<ImportResult | null>(null);
  const [importError,    setImportError]    = useState('');
  const [csvText,        setCsvText]        = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const mod = MODULES.find(m => m.id === selectedModule)!;

  // ── Export ─────────────────────────────────────────────────────────────────
  function handleExport() {
    const params = exportStatus !== 'all' ? `?status=${exportStatus}` : '';
    window.open(`/api/ontology/${selectedModule}/export.csv${params}`, '_blank');
  }

  // ── Template download ──────────────────────────────────────────────────────
  function handleTemplate() {
    window.open(`/api/ontology/${selectedModule}/template.csv`, '_blank');
  }

  // ── File pick → read CSV text ──────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setCsvText((ev.target?.result as string) ?? '');
      setImportResult(null);
      setImportError('');
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!csvText.trim()) { setImportError('Paste or upload a CSV first.'); return; }
    setImportLoading(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await fetch(`/api/ontology/${selectedModule}/import`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? 'Import failed'); return; }
      setImportResult(data as ImportResult);
      if (data.inserted > 0 || data.updated > 0) setCsvText('');
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileDown className="w-5 h-5 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-800">Ontology Import / Export</h2>
      </div>

      {/* Module selector */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {MODULES.map(m => (
          <button
            key={m.id}
            onClick={() => { setSelectedModule(m.id); setImportResult(null); setImportError(''); }}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors text-left ${
              selectedModule === m.id
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Selected module summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-1">
        <div className="font-semibold text-slate-700">{mod.label}</div>
        <div className="text-slate-500">Required CSV columns: <code className="bg-white border border-slate-200 px-1 rounded">{mod.requiredCols}</code></div>
        <div className="text-slate-500">Import behaviour: rows are upserted by <code className="bg-white border border-slate-200 px-1 rounded">code</code> (or equivalent unique key) — existing rows are updated, new rows are inserted.</div>
      </div>

      {/* Export + Template row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="col-span-2 flex items-center gap-2">
          <select
            value={exportStatus}
            onChange={e => setExportStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"
          >
            <option value="all">All statuses</option>
            {['draft','published','archived'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <button
          onClick={handleTemplate}
          className="flex items-center gap-2 px-4 py-2 text-xs bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
        >
          <FileDown className="w-3.5 h-3.5" /> Download Template
        </button>
      </div>

      {/* Import section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50"
            >
              Choose file…
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
            {csvText && (
              <button onClick={() => { setCsvText(''); setImportResult(null); setImportError(''); }}>
                <XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
        </div>

        <textarea
          value={csvText}
          onChange={e => { setCsvText(e.target.value); setImportResult(null); setImportError(''); }}
          rows={8}
          placeholder={`Paste CSV here, or choose a file above.\nFirst row must be the header row.\nRequired: ${mod.requiredCols}`}
          className="w-full px-4 py-3 text-xs font-mono focus:outline-none resize-none"
          spellCheck={false}
        />

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={!csvText.trim() || importLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
          >
            {importLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {importLoading ? 'Importing…' : 'Run Import'}
          </button>
          <span className="text-xs text-slate-400">
            Rows with errors are skipped. Successful rows are upserted immediately.
          </span>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {importError}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Inserted', value: importResult.inserted, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle className="w-4 h-4" /> },
              { label: 'Updated',  value: importResult.updated,  color: 'text-blue-700 bg-blue-50 border-blue-200',         icon: <RefreshCw className="w-4 h-4" /> },
              { label: 'Errors',   value: importResult.errors.length, color: 'text-red-700 bg-red-50 border-red-200',   icon: <XCircle className="w-4 h-4" /> },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl p-3 flex items-center gap-3 ${s.color}`}>
                {s.icon}
                <div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs opacity-80">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Error table */}
          {importResult.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 border-b border-red-200">
                Row Errors ({importResult.errors.length})
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Row #</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importResult.errors.map(e => (
                    <tr key={e.row}>
                      <td className="px-4 py-2 font-mono text-slate-700">{e.row}</td>
                      <td className="px-4 py-2 text-red-600">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
