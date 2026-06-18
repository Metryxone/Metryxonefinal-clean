import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, Plus, X, Star } from 'lucide-react';

interface RoleFamily {
  id: number;
  name: string;
  future_relevance: string;
  blueprint_count: number;
}
interface Blueprint {
  id: number;
  name: string;
  future_relevance: string;
}
interface BpMapping {
  cb_id: number;
  weight: number;
  is_primary: boolean;
  blueprint_name: string;
  blueprint_description: string;
  blueprint_future_relevance: string;
}
interface MappingData {
  blueprints: BpMapping[];
  weight_total: number;
}

const RELEVANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  low:      'bg-gray-100 text-gray-500',
};

export default function BlueprintMappingPanel() {
  const [families, setFamilies] = useState<RoleFamily[]>([]);
  const [allBlueprints, setAllBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mappingMap, setMappingMap] = useState<Record<number, MappingData>>({});
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ cb_id: '', weight: '', is_primary: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rfRes, cbRes, sumRes] = await Promise.all([
        fetch('/api/admin/talent/role-families', { credentials: 'include' }),
        fetch('/api/admin/talent/blueprints', { credentials: 'include' }),
        fetch('/api/admin/talent/summary', { credentials: 'include' }),
      ]);
      if (rfRes.ok) setFamilies(await rfRes.json());
      if (cbRes.ok) setAllBlueprints(await cbRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const loadMappings = async (rfId: number) => {
    try {
      const r = await fetch(`/api/admin/talent/role-families/${rfId}/blueprints`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setMappingMap(prev => ({ ...prev, [rfId]: d })); }
    } catch {}
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!mappingMap[id]) loadMappings(id);
  };

  const addMapping = async (rfId: number) => {
    if (!addForm.cb_id || !addForm.weight) return setError('Blueprint and weight are required');
    const w = Number(addForm.weight);
    if (w <= 0 || w > 100) return setError('Weight must be 1–100');
    setSaving(true); setError('');
    try {
      const r = await fetch(`/api/admin/talent/role-families/${rfId}/blueprints`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ cb_id: Number(addForm.cb_id), weight: w, is_primary: addForm.is_primary }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed'); }
      setAddingFor(null); setAddForm({ cb_id: '', weight: '', is_primary: false });
      await loadMappings(rfId); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const removeMapping = async (rfId: number, cbId: number) => {
    try {
      await fetch(`/api/admin/talent/role-families/${rfId}/blueprints/${cbId}`, { method: 'DELETE', credentials: 'include' });
      await loadMappings(rfId); await load();
    } catch (e: any) { setError(e.message); }
  };

  const availableBlueprints = (rfId: number) => {
    const mapped = (mappingMap[rfId]?.blueprints || []).map(b => b.cb_id);
    return allBlueprints.filter(b => !mapped.includes(b.id));
  };

  const weightColor = (total: number) => {
    if (total === 100) return 'text-green-600';
    if (total > 100) return 'text-red-600';
    return 'text-orange-500';
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Coverage Overview</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 max-h-52 overflow-y-auto pr-1">
            {(summary.role_family_coverage || []).map((row: any) => (
              <div key={row.name} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-gray-700 truncate">{row.name}</span>
                <div className="w-16 bg-gray-200 rounded-full h-1.5 shrink-0">
                  <div
                    className={`h-1.5 rounded-full ${Number(row.weight_total) === 100 ? 'bg-green-500' : Number(row.weight_total) > 0 ? 'bg-orange-400' : 'bg-gray-300'}`}
                    style={{ width: `${Math.min(Number(row.weight_total), 100)}%` }}
                  />
                </div>
                <span className={`font-mono w-10 text-right shrink-0 ${weightColor(Number(row.weight_total))}`}>{row.weight_total}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 text-xs text-gray-500">
            <span>✅ Balanced (100%): {(summary.role_family_coverage||[]).filter((r: any) => Number(r.weight_total) === 100).length}</span>
            <span>⚠️ Partial: {(summary.role_family_coverage||[]).filter((r: any) => Number(r.weight_total) > 0 && Number(r.weight_total) < 100).length}</span>
            <span>❌ Unmapped: {(summary.role_family_coverage||[]).filter((r: any) => Number(r.weight_total) === 0).length}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {families.map(rf => {
            const mapping = mappingMap[rf.id];
            const total = mapping?.weight_total ?? null;
            return (
              <div key={rf.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => toggleExpand(rf.id)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left">
                  {expandedId === rf.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  <span className="flex-1 font-medium text-sm text-gray-800">{rf.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${RELEVANCE_COLORS[rf.future_relevance]}`}>{rf.future_relevance}</span>
                  {total !== null ? (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${total === 100 ? 'bg-green-100 text-green-700' : total > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      {total}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{rf.blueprint_count} blueprints</span>
                  )}
                </button>

                {expandedId === rf.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {mapping ? (
                      <>
                        {mapping.blueprints.length > 0 ? (
                          <div className="space-y-1 mb-3">
                            {mapping.blueprints.map(bp => (
                              <div key={bp.cb_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2">
                                {bp.is_primary && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" title="Primary blueprint" />}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-gray-800">{bp.blueprint_name}</div>
                                  <div className="text-xs text-gray-400 truncate">{bp.blueprint_description}</div>
                                </div>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${RELEVANCE_COLORS[bp.blueprint_future_relevance]}`}>{bp.blueprint_future_relevance}</span>
                                <div className="w-24 bg-gray-200 rounded-full h-1.5 shrink-0">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${bp.weight}%` }} />
                                </div>
                                <span className="text-xs font-mono text-gray-700 w-10 text-right shrink-0">{bp.weight}%</span>
                                <button onClick={() => removeMapping(rf.id, bp.cb_id)} className="p-0.5 hover:bg-red-50 rounded ml-1">
                                  <X className="w-3 h-3 text-red-400" />
                                </button>
                              </div>
                            ))}
                            <div className={`text-xs text-right font-medium ${weightColor(Number(mapping.weight_total))}`}>
                              Total: {mapping.weight_total}%
                              {Number(mapping.weight_total) === 100 ? ' ✓ Balanced' : Number(mapping.weight_total) > 100 ? ' ✗ Exceeds 100%' : ` (${100 - Number(mapping.weight_total)}% remaining)`}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mb-3">No blueprint mappings yet. Add one below.</p>
                        )}

                        {addingFor === rf.id ? (
                          <div className="bg-white border border-blue-200 rounded p-3 space-y-2">
                            <p className="text-xs font-medium text-gray-600">Add Blueprint Mapping</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <label className="text-xs text-gray-500">Blueprint</label>
                                <select value={addForm.cb_id} onChange={e => setAddForm(p => ({ ...p, cb_id: e.target.value }))}
                                  className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs">
                                  <option value="">Select blueprint…</option>
                                  {availableBlueprints(rf.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Weight (%)</label>
                                <input type="number" min="1" max="100" value={addForm.weight} onChange={e => setAddForm(p => ({ ...p, weight: e.target.value }))}
                                  placeholder="e.g. 40" className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={addForm.is_primary} onChange={e => setAddForm(p => ({ ...p, is_primary: e.target.checked }))} className="rounded" />
                              Mark as primary blueprint
                            </label>
                            {mapping && (
                              <p className="text-xs text-gray-400">Current total: {mapping.weight_total}% — remaining: {100 - Number(mapping.weight_total)}%</p>
                            )}
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setAddingFor(null)} className="text-xs px-3 py-1 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
                              <button onClick={() => addMapping(rf.id)} disabled={saving} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                {saving ? 'Adding…' : 'Add Mapping'}
                              </button>
                            </div>
                          </div>
                        ) : availableBlueprints(rf.id).length > 0 && (
                          <button onClick={() => { setAddingFor(rf.id); setAddForm({ cb_id: '', weight: '', is_primary: false }); }}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                            <Plus className="w-3 h-3" /> Add blueprint mapping
                          </button>
                        )}
                      </>
                    ) : <p className="text-xs text-gray-400">Loading…</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
