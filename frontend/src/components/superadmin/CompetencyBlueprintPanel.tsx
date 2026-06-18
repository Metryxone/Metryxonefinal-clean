import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Download, RefreshCw, X, Check, AlertCircle } from 'lucide-react';

interface Blueprint {
  id: number;
  name: string;
  description: string;
  applicable_layers: string[];
  applicable_families: string[];
  future_relevance: 'critical' | 'high' | 'moderate' | 'low';
  is_active: boolean;
  competency_count: number;
  weight_total: number;
}

interface Competency {
  cb_id: number;
  competency_id: string;
  competency_name: string;
  weight: number;
  criticality: 'essential' | 'important' | 'supporting';
}

const RELEVANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
};
const CRITICALITY_COLORS: Record<string, string> = {
  essential:  'bg-red-50 text-red-600 border-red-200',
  important:  'bg-blue-50 text-blue-600 border-blue-200',
  supporting: 'bg-gray-50 text-gray-500 border-gray-200',
};

const LAYERS = ['Execution', 'Managerial', 'Leadership', 'Strategic'];
const RELEVANCE_OPTIONS = ['critical', 'high', 'moderate', 'low'];
const CRITICALITY_OPTIONS = ['essential', 'important', 'supporting'];
const emptyForm = () => ({ name: '', description: '', applicable_layers: [] as string[], future_relevance: 'high' as const });
const emptyCompForm = () => ({ competency_id: '', competency_name: '', weight: '', criticality: 'important' as const });

export default function CompetencyBlueprintPanel() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Blueprint | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [compMap, setCompMap] = useState<Record<number, { competencies: Competency[]; weight_total: number }>>({});
  const [addingComp, setAddingComp] = useState<number | null>(null);
  const [compForm, setCompForm] = useState(emptyCompForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async (q = search) => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/talent/blueprints?search=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      setBlueprints(await r.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [search]);

  const loadSummary = useCallback(async () => {
    try { const r = await fetch('/api/admin/talent/summary', { credentials: 'include' }); if (r.ok) setSummary(await r.json()); } catch {}
  }, []);

  useEffect(() => { load(); loadSummary(); }, []);

  const loadComps = async (cbId: number) => {
    try {
      const r = await fetch(`/api/admin/talent/blueprints/${cbId}/competencies`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setCompMap(prev => ({ ...prev, [cbId]: d })); }
    } catch {}
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!compMap[id]) loadComps(id);
  };

  const startEdit = (bp: Blueprint) => {
    setEditing(bp);
    setForm({ name: bp.name, description: bp.description, applicable_layers: [...bp.applicable_layers], future_relevance: bp.future_relevance });
    setCreating(false);
  };
  const startCreate = () => { setEditing(null); setForm(emptyForm()); setCreating(true); };
  const cancel = () => { setEditing(null); setCreating(false); setForm(emptyForm()); };

  const save = async () => {
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true); setError('');
    try {
      const url = editing ? `/api/admin/talent/blueprints/${editing.id}` : '/api/admin/talent/blueprints';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...form, is_active: true }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Save failed'); }
      cancel(); await load(); await loadSummary();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`Delete blueprint "${name}"?`)) return;
    try { await fetch(`/api/admin/talent/blueprints/${id}`, { method: 'DELETE', credentials: 'include' }); await load(); await loadSummary(); }
    catch (e: any) { setError(e.message); }
  };

  const removeComp = async (cbId: number, compId: string) => {
    try { await fetch(`/api/admin/talent/blueprints/${cbId}/competencies/${compId}`, { method: 'DELETE', credentials: 'include' }); await loadComps(cbId); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const saveComp = async (cbId: number) => {
    const cid = compForm.competency_id.trim();
    if (!cid || !compForm.weight) return setError('Name and weight are required');
    setSaving(true); setError('');
    try {
      const r = await fetch(`/api/admin/talent/blueprints/${cbId}/competencies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          competency_id: cid.toLowerCase().replace(/\s+/g, '_'),
          competency_name: compForm.competency_name || cid,
          weight: Number(compForm.weight),
          criticality: compForm.criticality,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed'); }
      setAddingComp(null); setCompForm(emptyCompForm()); await loadComps(cbId); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleLayer = (l: string) =>
    setForm(prev => ({ ...prev, applicable_layers: prev.applicable_layers.includes(l) ? prev.applicable_layers.filter(x => x !== l) : [...prev.applicable_layers, l] }));

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'Blueprints', val: summary.blueprints }, { label: 'Competency Mappings', val: summary.competency_mappings }, { label: 'Blueprint-RF Mappings', val: summary.blueprint_mappings }].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{s.val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(search)}
            placeholder="Search blueprints…" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => load(search)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        <button onClick={() => window.open('/api/admin/talent/export/blueprints.csv', '_blank')} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"><Download className="w-4 h-4" /> Export</button>
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" /> New Blueprint</button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {(creating || editing) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">{creating ? 'New Competency Blueprint' : `Edit — ${editing?.name}`}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Technical Engineering" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Future Relevance</label>
              <select value={form.future_relevance} onChange={e => setForm(p => ({ ...p, future_relevance: e.target.value as any }))}
                className="mt-1 w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {RELEVANCE_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="mt-1 w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Applicable Layers</label>
            <div className="flex gap-2 flex-wrap">
              {LAYERS.map(l => (
                <button key={l} type="button" onClick={() => toggleLayer(l)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.applicable_layers.includes(l) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancel} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : blueprints.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No blueprints found</div>
      ) : (
        <div className="space-y-2">
          {blueprints.map(bp => (
            <div key={bp.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <button onClick={() => toggleExpand(bp.id)} className="p-1 hover:bg-gray-100 rounded">
                  {expandedId === bp.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 text-sm">{bp.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${RELEVANCE_COLORS[bp.future_relevance]}`}>{bp.future_relevance}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{bp.description}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                  <span>{bp.competency_count} competencies</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(Number(bp.weight_total), 100)}%` }} />
                    </div>
                    <span className={`font-mono ${Number(bp.weight_total) === 100 ? 'text-green-600' : 'text-orange-500'}`}>{bp.weight_total}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(bp)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                  <button onClick={() => remove(bp.id, bp.name)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>

              {expandedId === bp.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-medium text-gray-600">Competencies & Weights</p>
                    <button onClick={() => { setAddingComp(bp.id); setCompForm(emptyCompForm()); }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      <Plus className="w-3 h-3" /> Add Competency
                    </button>
                  </div>

                  {addingComp === bp.id && (
                    <div className="bg-white border border-blue-200 rounded p-3 mb-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Name *</label>
                          <input value={compForm.competency_name} onChange={e => setCompForm(p => ({ ...p, competency_name: e.target.value }))}
                            placeholder="e.g. Strategic Vision" className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">ID (auto if blank)</label>
                          <input value={compForm.competency_id} onChange={e => setCompForm(p => ({ ...p, competency_id: e.target.value }))}
                            placeholder="e.g. strategic_vision" className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Weight (%) *</label>
                          <input type="number" min="1" max="100" value={compForm.weight} onChange={e => setCompForm(p => ({ ...p, weight: e.target.value }))}
                            placeholder="e.g. 25" className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Criticality</label>
                          <select value={compForm.criticality} onChange={e => setCompForm(p => ({ ...p, criticality: e.target.value as any }))}
                            className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs">
                            {CRITICALITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setAddingComp(null)} className="text-xs px-3 py-1 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
                        <button onClick={() => saveComp(bp.id)} disabled={saving} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {compMap[bp.id] ? (
                    compMap[bp.id].competencies.length > 0 ? (
                      <div className="space-y-1">
                        {compMap[bp.id].competencies.map(c => (
                          <div key={c.competency_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${CRITICALITY_COLORS[c.criticality]}`}>{c.criticality}</span>
                            <span className="text-xs font-medium text-gray-700 flex-1">{c.competency_name}</span>
                            <span className="text-xs font-mono text-gray-400">{c.competency_id}</span>
                            <div className="w-20 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.weight}%` }} />
                            </div>
                            <span className="text-xs font-mono text-gray-600 w-10 text-right">{c.weight}%</span>
                            <button onClick={() => removeComp(bp.id, c.competency_id)} className="p-0.5 hover:bg-red-50 rounded">
                              <X className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        ))}
                        <div className={`text-xs text-right mt-1 font-medium ${compMap[bp.id].weight_total === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                          Total: {compMap[bp.id].weight_total}% {compMap[bp.id].weight_total === 100 ? '✓' : `(${100 - compMap[bp.id].weight_total}% remaining)`}
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-400">No competencies yet.</p>
                  ) : <p className="text-xs text-gray-400">Loading…</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
