import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, AlertCircle, X, Edit2, Check } from 'lucide-react';

interface RoleFamily { id: number; name: string; future_relevance: string; }
interface LevelProfile {
  id: number; rf_id: number; rf_name: string; level: string;
  title_examples: string[]; experience_years_min: number; experience_years_max: number | null;
  key_responsibilities: string[]; must_have_skills: string[]; nice_to_have_skills: string[];
  competency_thresholds: Record<string, number>;
  salary_band_min: number; salary_band_max: number; headcount_ratio: number;
}

const LEVELS = ['junior','mid','senior','lead','executive'] as const;
const LEVEL_LABELS: Record<string, string> = { junior:'Junior (0–2 yrs)', mid:'Mid-Level (2–5 yrs)', senior:'Senior (5–8 yrs)', lead:'Lead (8–12 yrs)', executive:'Executive (12+ yrs)' };
const LEVEL_COLORS: Record<string, string> = { junior:'bg-green-100 text-green-700', mid:'bg-blue-100 text-blue-700', senior:'bg-purple-100 text-purple-700', lead:'bg-orange-100 text-orange-700', executive:'bg-red-100 text-red-700' };

const fmt = (n: number | null | undefined) => n == null ? '—' : `₹${(n/100000).toFixed(1)}L`;

export default function LevelProfilePanel() {
  const [families, setFamilies] = useState<RoleFamily[]>([]);
  const [profiles, setProfiles] = useState<LevelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRf, setSelectedRf] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<LevelProfile>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const loadFamilies = useCallback(async () => {
    const r = await fetch('/api/admin/talent/role-families', { credentials: 'include' });
    if (r.ok) setFamilies(await r.json());
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let url = '/api/admin/talent/level-profiles?';
      if (selectedRf) url += `rf_id=${selectedRf}&`;
      if (selectedLevel) url += `level=${selectedLevel}`;
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      setProfiles(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [selectedRf, selectedLevel]);

  const loadSummary = useCallback(async () => {
    const r = await fetch('/api/admin/talent/level-profiles/summary', { credentials: 'include' });
    if (r.ok) setSummary(await r.json());
  }, []);

  useEffect(() => { loadFamilies(); loadSummary(); }, []);
  useEffect(() => { loadProfiles(); }, [selectedRf, selectedLevel]);

  const startEdit = (lp: LevelProfile) => {
    setEditingId(lp.id);
    setEditForm({
      title_examples: lp.title_examples,
      experience_years_min: lp.experience_years_min,
      experience_years_max: lp.experience_years_max ?? undefined,
      key_responsibilities: lp.key_responsibilities,
      must_have_skills: lp.must_have_skills,
      nice_to_have_skills: lp.nice_to_have_skills,
      salary_band_min: lp.salary_band_min,
      salary_band_max: lp.salary_band_max,
    });
  };

  const saveEdit = async (id: number) => {
    setSaving(true); setError('');
    try {
      const body = {
        ...editForm,
        title_examples: typeof editForm.title_examples === 'string' ? (editForm.title_examples as any).split(',').map((s: string) => s.trim()).filter(Boolean) : editForm.title_examples,
        key_responsibilities: typeof editForm.key_responsibilities === 'string' ? (editForm.key_responsibilities as any).split('\n').filter(Boolean) : editForm.key_responsibilities,
        must_have_skills: typeof editForm.must_have_skills === 'string' ? (editForm.must_have_skills as any).split(',').map((s: string) => s.trim()).filter(Boolean) : editForm.must_have_skills,
        nice_to_have_skills: typeof editForm.nice_to_have_skills === 'string' ? (editForm.nice_to_have_skills as any).split(',').map((s: string) => s.trim()).filter(Boolean) : editForm.nice_to_have_skills,
      };
      const r = await fetch(`/api/admin/talent/level-profiles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Save failed'); }
      setEditingId(null); await loadProfiles();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const grouped = profiles.reduce<Record<string, LevelProfile[]>>((acc, p) => {
    const key = p.rf_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{summary.total_profiles}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Level Profiles</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{(summary.families||[]).filter((f: any) => f.level_count === 5).length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Fully Profiled Families</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{(summary.families||[]).filter((f: any) => f.level_count < 5).length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Incomplete Families</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={selectedRf ?? ''} onChange={e => setSelectedRf(e.target.value ? Number(e.target.value) : null)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]">
          <option value="">All Role Families</option>
          {families.map(rf => <option key={rf.id} value={rf.id}>{rf.name}</option>)}
        </select>
        <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
        <button onClick={loadProfiles} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([rfName, lvlProfiles]) => (
            <div key={rfName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-200">
                <span className="font-semibold text-gray-800 text-sm">{rfName}</span>
                <div className="flex gap-1 ml-2">
                  {LEVELS.map(l => (
                    <span key={l} className={`text-xs px-1.5 py-0.5 rounded ${lvlProfiles.find(p => p.level === l) ? LEVEL_COLORS[l] : 'bg-gray-100 text-gray-300'}`}>{l}</span>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {lvlProfiles.sort((a, b) => LEVELS.indexOf(a.level as any) - LEVELS.indexOf(b.level as any)).map(lp => (
                  <div key={lp.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => setExpandedId(expandedId === lp.id ? null : lp.id)} className="p-1 hover:bg-gray-100 rounded">
                        {expandedId === lp.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${LEVEL_COLORS[lp.level]}`}>{LEVEL_LABELS[lp.level]}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700">{lp.title_examples.slice(0,2).join(' · ')}</span>
                      </div>
                      <span className="text-xs text-gray-400">{fmt(lp.salary_band_min)} – {fmt(lp.salary_band_max)}</span>
                      <button onClick={() => editingId === lp.id ? setEditingId(null) : startEdit(lp)} className="p-1.5 hover:bg-gray-100 rounded">
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>

                    {expandedId === lp.id && editingId !== lp.id && (
                      <div className="px-8 pb-4 grid grid-cols-2 gap-4 text-xs text-gray-600 bg-gray-50">
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Title Examples</p>
                          <ul className="space-y-0.5">{lp.title_examples.map(t => <li key={t}>• {t}</li>)}</ul>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Experience</p>
                          <p>{lp.experience_years_min}–{lp.experience_years_max ?? '∞'} years</p>
                          <p className="mt-1 font-semibold text-gray-700">Thresholds</p>
                          <p>Primary BP: {lp.competency_thresholds?.primary_blueprint ?? '—'}%</p>
                          <p>Secondary BP: {lp.competency_thresholds?.secondary_blueprint ?? '—'}%</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Key Responsibilities</p>
                          <ul className="space-y-0.5">{lp.key_responsibilities.map(r => <li key={r}>• {r}</li>)}</ul>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Must-Have Skills</p>
                          <div className="flex flex-wrap gap-1">{lp.must_have_skills.map(s => <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{s}</span>)}</div>
                          <p className="font-semibold text-gray-700 mb-1 mt-2">Nice-to-Have</p>
                          <div className="flex flex-wrap gap-1">{lp.nice_to_have_skills.map(s => <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{s}</span>)}</div>
                        </div>
                      </div>
                    )}

                    {editingId === lp.id && (
                      <div className="px-8 pb-4 bg-blue-50 border-t border-blue-100 space-y-3">
                        <p className="text-xs font-semibold text-blue-700 pt-3">Editing {LEVEL_LABELS[lp.level]}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-600">Title Examples (comma-separated)</label>
                            <input value={Array.isArray(editForm.title_examples) ? editForm.title_examples.join(', ') : editForm.title_examples || ''} onChange={e => setEditForm(p => ({ ...p, title_examples: e.target.value as any }))} className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-600">Salary Min (₹)</label>
                              <input type="number" value={editForm.salary_band_min || ''} onChange={e => setEditForm(p => ({ ...p, salary_band_min: Number(e.target.value) }))} className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Salary Max (₹)</label>
                              <input type="number" value={editForm.salary_band_max || ''} onChange={e => setEditForm(p => ({ ...p, salary_band_max: Number(e.target.value) }))} className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Must-Have Skills (comma-separated)</label>
                            <input value={Array.isArray(editForm.must_have_skills) ? editForm.must_have_skills.join(', ') : editForm.must_have_skills || ''} onChange={e => setEditForm(p => ({ ...p, must_have_skills: e.target.value as any }))} className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Nice-to-Have (comma-separated)</label>
                            <input value={Array.isArray(editForm.nice_to_have_skills) ? editForm.nice_to_have_skills.join(', ') : editForm.nice_to_have_skills || ''} onChange={e => setEditForm(p => ({ ...p, nice_to_have_skills: e.target.value as any }))} className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1 text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 bg-white">Cancel</button>
                          <button onClick={() => saveEdit(lp.id)} disabled={saving} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {profiles.length === 0 && <div className="text-center py-12 text-gray-400">No level profiles found</div>}
        </div>
      )}
    </div>
  );
}
