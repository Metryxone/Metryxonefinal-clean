import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Download, RefreshCw, X, Check, AlertCircle } from 'lucide-react';

interface RoleFamily {
  id: number;
  name: string;
  description: string;
  industries: string[];
  layers: string[];
  roles_covered: string[];
  future_relevance: 'critical' | 'high' | 'moderate' | 'low';
  is_active: boolean;
  role_count: number;
  blueprint_count: number;
}

interface BlueprintMapping {
  cb_id: number;
  weight: number;
  is_primary: boolean;
  blueprint_name: string;
  blueprint_description: string;
  blueprint_future_relevance: string;
}

const RELEVANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
};

const LAYERS = ['Execution', 'Managerial', 'Leadership', 'Strategic'];
const RELEVANCE_OPTIONS = ['critical', 'high', 'moderate', 'low'];
const emptyForm = () => ({ name: '', description: '', industries: '', layers: [] as string[], future_relevance: 'high' as const });

export default function RoleFamilyPanel() {
  const [families, setFamilies] = useState<RoleFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<RoleFamily | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [blueprintMap, setBlueprintMap] = useState<Record<number, BlueprintMapping[]>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async (q = search) => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/talent/role-families?search=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      setFamilies(await r.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [search]);

  const loadSummary = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/talent/summary', { credentials: 'include' });
      if (r.ok) setSummary(await r.json());
    } catch {}
  }, []);

  useEffect(() => { load(); loadSummary(); }, []);

  const loadBlueprints = async (rfId: number) => {
    if (blueprintMap[rfId]) return;
    try {
      const r = await fetch(`/api/admin/talent/role-families/${rfId}/blueprints`, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setBlueprintMap(prev => ({ ...prev, [rfId]: data.blueprints || [] }));
      }
    } catch {}
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadBlueprints(id);
  };

  const startEdit = (rf: RoleFamily) => {
    setEditing(rf);
    setForm({ name: rf.name, description: rf.description, industries: rf.industries.join(', '), layers: [...rf.layers], future_relevance: rf.future_relevance });
    setCreating(false);
  };

  const startCreate = () => { setEditing(null); setForm(emptyForm()); setCreating(true); };
  const cancel = () => { setEditing(null); setCreating(false); setForm(emptyForm()); };

  const save = async () => {
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true); setError('');
    const body = {
      name: form.name.trim(),
      description: form.description,
      industries: form.industries.split(',').map((s: string) => s.trim()).filter(Boolean),
      layers: form.layers,
      future_relevance: form.future_relevance,
      is_active: true,
    };
    try {
      const url = editing ? `/api/admin/talent/role-families/${editing.id}` : '/api/admin/talent/role-families';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Save failed'); }
      cancel(); await load(); await loadSummary();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This will also remove all role and blueprint mappings.`)) return;
    try { await fetch(`/api/admin/talent/role-families/${id}`, { method: 'DELETE', credentials: 'include' }); await load(); await loadSummary(); }
    catch (e: any) { setError(e.message); }
  };

  const toggleLayer = (l: string) =>
    setForm(prev => ({ ...prev, layers: prev.layers.includes(l) ? prev.layers.filter(x => x !== l) : [...prev.layers, l] }));

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Role Families', val: summary.role_families },
            { label: 'Blueprint Mappings', val: summary.blueprint_mappings },
            { label: 'Role Assignments', val: summary.role_assignments },
          ].map(s => (
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
            placeholder="Search role families…" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => load(search)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        <button onClick={() => window.open('/api/admin/talent/export/role-families.csv', '_blank')} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"><Download className="w-4 h-4" /> Export</button>
        <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" /> New Family</button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {(creating || editing) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">{creating ? 'New Role Family' : `Edit — ${editing?.name}`}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Software Engineering" />
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
            <label className="text-xs font-medium text-gray-600">Industries (comma-separated)</label>
            <input value={form.industries} onChange={e => setForm(p => ({ ...p, industries: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Technology, Healthcare, Finance" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Layers</label>
            <div className="flex gap-2 flex-wrap">
              {LAYERS.map(l => (
                <button key={l} type="button" onClick={() => toggleLayer(l)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.layers.includes(l) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
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
      ) : families.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No role families found</div>
      ) : (
        <div className="space-y-2">
          {families.map(rf => (
            <div key={rf.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <button onClick={() => toggleExpand(rf.id)} className="p-1 hover:bg-gray-100 rounded">
                  {expandedId === rf.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 text-sm">{rf.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${RELEVANCE_COLORS[rf.future_relevance]}`}>{rf.future_relevance}</span>
                    {!rf.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">inactive</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{rf.description}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span title="Blueprints mapped">🗂 {rf.blueprint_count}</span>
                  <span title="Roles assigned">👤 {rf.role_count}</span>
                  <div className="flex items-center gap-1">
                    {rf.layers.map(l => <span key={l} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{l}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(rf)} className="p-1.5 hover:bg-gray-100 rounded" title="Edit"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
                  <button onClick={() => remove(rf.id, rf.name)} className="p-1.5 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>

              {expandedId === rf.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-3">
                    <div><span className="font-medium">Industries:</span> {rf.industries.join(', ') || '—'}</div>
                    <div><span className="font-medium">Layers:</span> {rf.layers.join(', ') || '—'}</div>
                  </div>
                  {blueprintMap[rf.id] ? (
                    blueprintMap[rf.id].length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-2">Blueprint Mappings</p>
                        <div className="space-y-1">
                          {blueprintMap[rf.id].map(bp => (
                            <div key={bp.cb_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-1.5">
                              {bp.is_primary && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>}
                              <span className="text-xs font-medium text-gray-700 flex-1">{bp.blueprint_name}</span>
                              <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${bp.weight}%` }} />
                              </div>
                              <span className="text-xs font-mono text-gray-600 w-10 text-right">{bp.weight}%</span>
                            </div>
                          ))}
                          <div className="text-xs text-gray-400 text-right mt-1">
                            Total: {blueprintMap[rf.id].reduce((s, b) => s + Number(b.weight), 0)}%
                          </div>
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-400">No blueprint mappings yet.</p>
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
