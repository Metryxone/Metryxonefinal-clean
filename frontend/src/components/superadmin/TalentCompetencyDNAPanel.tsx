import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface DNA {
  id: number; competency_code: string; competency_name: string; blueprint_key: string;
  future_relevance: string; micro_competencies: any[]; behavior_indicators: any[];
  is_foundational: boolean; development_timeline_weeks: number;
  proficiency_levels: Record<string, any>;
}

export default function TalentCompetencyDNAPanel() {
  const [records, setRecords] = useState<DNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/talent/competency-dna?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`, { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setRecords(d.rows || []);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const FR_COLORS: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Competency DNA Profiles (D5)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Signal fingerprints per competency — micro-competencies, behavior indicators, proficiency levels</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[['DNA Profiles', records.length, 'bg-indigo-50 text-indigo-700'], ['Blueprints', new Set(records.map(r => r.blueprint_key)).size, 'bg-blue-50 text-blue-700'], ['Foundational', records.filter(r => r.is_foundational).length, 'bg-green-50 text-green-700']].map(([label, val, cls]) => (
          <div key={String(label)} className={`rounded-lg p-4 ${cls}`}><div className="text-2xl font-bold">{val}</div><div className="text-xs mt-0.5">{label}</div></div>
        ))}
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Search DNA profiles…" value={search} onChange={e => setSearch(e.target.value)} /></div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading DNA profiles…</div> : (
        <div className="space-y-2">
          {records.map(r => (
            <div key={r.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <span className="font-mono text-xs text-gray-500 w-32 flex-shrink-0">{r.competency_code}</span>
                <span className="flex-1 text-sm font-medium text-gray-800">{r.competency_name}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FR_COLORS[r.future_relevance] || 'bg-gray-100 text-gray-600'}`}>{r.future_relevance || '—'}</span>
                {r.is_foundational && <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">Foundational</span>}
                <span className="text-xs text-gray-500">{r.development_timeline_weeks}w dev</span>
                {expanded === r.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </button>
              {expanded === r.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-medium text-gray-600 mb-1">Micro-Competencies ({Array.isArray(r.micro_competencies) ? r.micro_competencies.length : 0})</div>
                    <div className="flex flex-wrap gap-1">{(Array.isArray(r.micro_competencies) ? r.micro_competencies : []).map((s: any, i: number) => <span key={i} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{typeof s === 'string' ? s : s.name || JSON.stringify(s)}</span>)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-600 mb-1">Behavior Indicators ({Array.isArray(r.behavior_indicators) ? r.behavior_indicators.length : 0})</div>
                    <div className="flex flex-wrap gap-1">{(Array.isArray(r.behavior_indicators) ? r.behavior_indicators : []).map((s: any, i: number) => <span key={i} className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{typeof s === 'string' ? s : s.name || JSON.stringify(s)}</span>)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="font-medium text-gray-600 mb-1">Proficiency Levels</div>
                    <div className="space-y-1">{Object.entries(r.proficiency_levels || {}).map(([k, v]) => (
                      <div key={k}><span className="font-medium text-gray-500">{k}:</span> <span className="text-gray-600">{typeof v === 'string' ? v : JSON.stringify(v)}</span></div>
                    ))}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {records.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No DNA profiles found</div>}
        </div>
      )}
    </div>
  );
}
