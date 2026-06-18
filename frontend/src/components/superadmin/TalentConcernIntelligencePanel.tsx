import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Search, Plus, Network } from 'lucide-react';

interface Concern {
  id: number; concern_key: string; concern_name: string;
  competency_code: string; blueprint_key: string;
  concern_category: string; severity_level: string;
  signal_keys: string[];
  growth_indicators: string[]; risk_indicators: string[];
  assessment_indicators: string[];
  insight_logic: { insight_template?: string; threshold?: number; trigger_condition?: string; severity_escalation_rule?: string };
  recommendation_logic: { primary_action?: string; timeline_weeks?: number; success_metrics?: string[]; learning_resources?: string[] };
  feeds_readiness: boolean; feeds_digital_twin: boolean; feeds_outcome_prediction: boolean;
  is_active: boolean;
}
interface Stats {
  total: number; active: number;
  by_severity: { severity_level: string; count: number }[];
  by_category: { concern_category: string; count: number }[];
  by_blueprint: { blueprint_key: string; concern_count: number; competency_count: number }[];
  feed_links: { readiness_feed: string; twin_feed: string; prediction_feed: string };
}
interface Chain {
  total_concerns: number; blueprints_covered: number; competencies_covered: number;
  chain: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low: 'bg-green-100 text-green-700 border border-green-200',
};
const CAT_COLORS: Record<string, string> = {
  behavioral: 'bg-blue-100 text-blue-700',
  cognitive: 'bg-purple-100 text-purple-700',
  functional: 'bg-indigo-100 text-indigo-700',
  leadership: 'bg-pink-100 text-pink-700',
  emotional: 'bg-rose-100 text-rose-700',
};

export default function TalentConcernIntelligencePanel() {
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterSev, setFilterSev] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterBlueprint, setFilterBlueprint] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tab, setTab] = useState<'concerns' | 'chain' | 'stats'>('concerns');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ concern_key: '', concern_name: '', competency_code: '', blueprint_key: '', concern_category: 'behavioral', severity_level: 'moderate' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      if (filterSev) params.set('severity_level', filterSev);
      if (filterCat) params.set('concern_category', filterCat);
      if (filterBlueprint) params.set('blueprint_key', filterBlueprint);

      const [cR, sR, chR] = await Promise.all([
        fetch(`/api/admin/talent/concerns?${params}&refresh=1`, { credentials: 'include' }),
        fetch('/api/admin/talent/concerns/stats', { credentials: 'include' }),
        fetch('/api/admin/talent/concerns/chain/overview', { credentials: 'include' }),
      ]);
      if (!cR.ok) throw new Error(await cR.text());
      const cd = await cR.json();
      setConcerns(cd.concerns || []);
      if (sR.ok) setStats(await sR.json());
      if (chR.ok) setChain(await chR.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [search, filterSev, filterCat, filterBlueprint]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/admin/talent/concerns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Save failed'); }
      setShowForm(false);
      setForm({ concern_key: '', concern_name: '', competency_code: '', blueprint_key: '', concern_category: 'behavioral', severity_level: 'moderate' });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const blueprints = [...new Set(concerns.map(c => c.blueprint_key))].sort();

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Concern Intelligence Framework (D4)</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Competency → Concern → Signal chain · feeds D9 Readiness · D14 Digital Twin · D15 Outcome Prediction
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> Add Concern</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      {/* KPI strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Total Concerns', stats.total, 'bg-indigo-50 text-indigo-700'],
            ['Active', stats.active, 'bg-green-50 text-green-700'],
            ['Blueprints', stats.by_blueprint?.length || 0, 'bg-blue-50 text-blue-700'],
            ['→ Readiness (D9)', Number(stats.feed_links?.readiness_feed || 0), 'bg-orange-50 text-orange-700'],
            ['→ Outcome (D15)', Number(stats.feed_links?.prediction_feed || 0), 'bg-purple-50 text-purple-700'],
          ].map(([label, val, cls]) => (
            <div key={String(label)} className={`rounded-lg p-3 ${cls}`}>
              <div className="text-2xl font-bold">{val}</div>
              <div className="text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-gray-800 text-sm">New Concern</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['concern_key', 'concern_name', 'competency_code', 'blueprint_key'] as const).map(f => (
              <div key={f}><label className="text-xs text-gray-500 mb-1 block capitalize">{f.replace(/_/g, ' ')}</label>
                <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div><label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form.concern_category} onChange={e => setForm(p => ({ ...p, concern_category: e.target.value }))}>
                {['behavioral', 'cognitive', 'functional', 'leadership', 'emotional'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Severity</label>
              <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form.severity_level} onChange={e => setForm(p => ({ ...p, severity_level: e.target.value }))}>
                {['critical', 'high', 'moderate', 'low'].map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['concerns', 'All Concerns'], ['chain', 'D3→D4→D5 Chain'], ['stats', 'Analytics']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      {tab === 'concerns' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Search concerns…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filterSev} onChange={e => setFilterSev(e.target.value)}>
              <option value="">All Severities</option>
              {['critical', 'high', 'moderate', 'low'].map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {['behavioral', 'cognitive', 'functional', 'leadership', 'emotional'].map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filterBlueprint} onChange={e => setFilterBlueprint(e.target.value)}>
              <option value="">All Blueprints</option>
              {blueprints.map(b => <option key={b} value={b}>{b}</option>)}</select>
          </div>

          {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading concerns…</div> : (
            <div className="space-y-2">
              {concerns.map(c => (
                <div key={c.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${SEV_COLORS[c.severity_level] || 'bg-gray-100 text-gray-600'}`}>{c.severity_level}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{c.concern_name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${CAT_COLORS[c.concern_category] || 'bg-gray-100 text-gray-600'}`}>{c.concern_category}</span>
                    <span className="text-xs text-gray-400 font-mono">{c.competency_code}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {c.feeds_readiness && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">D9</span>}
                      {c.feeds_digital_twin && <span className="text-xs bg-indigo-100 text-indigo-600 px-1 rounded">D14</span>}
                      {c.feeds_outcome_prediction && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded">D15</span>}
                    </div>
                    {expanded === c.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {expanded === c.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      {/* Signal Keys */}
                      <div>
                        <div className="font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Signal Keys (D3)</div>
                        <div className="flex flex-wrap gap-1">{(c.signal_keys || []).map(s => <span key={s} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{s}</span>)}</div>
                      </div>

                      {/* Insight Logic */}
                      <div>
                        <div className="font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Insight Logic</div>
                        {c.insight_logic?.insight_template && (
                          <p className="text-gray-700 italic leading-relaxed bg-white border border-gray-200 rounded p-2">{c.insight_logic.insight_template}</p>
                        )}
                        {c.insight_logic?.trigger_condition && <div className="mt-1 text-gray-500">Trigger: <span className="font-mono text-indigo-600">{c.insight_logic.trigger_condition}</span> {c.insight_logic.threshold ? `(threshold: ${c.insight_logic.threshold})` : ''}</div>}
                        {c.insight_logic?.severity_escalation_rule && <div className="mt-1 text-orange-600">⚑ {c.insight_logic.severity_escalation_rule}</div>}
                      </div>

                      {/* Growth Indicators */}
                      <div>
                        <div className="font-semibold text-green-700 mb-1.5 uppercase tracking-wide">↑ Growth Indicators</div>
                        <ul className="space-y-0.5">{(c.growth_indicators || []).map((g, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{g}</li>)}</ul>
                      </div>

                      {/* Risk Indicators */}
                      <div>
                        <div className="font-semibold text-red-700 mb-1.5 uppercase tracking-wide">⚠ Risk Indicators</div>
                        <ul className="space-y-0.5">{(c.risk_indicators || []).map((r, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />{r}</li>)}</ul>
                      </div>

                      {/* Assessment Indicators */}
                      <div>
                        <div className="font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Assessment Indicators</div>
                        <ul className="space-y-0.5">{(c.assessment_indicators || []).map((a, i) => <li key={i} className="text-gray-600">• {a}</li>)}</ul>
                      </div>

                      {/* Recommendation */}
                      <div>
                        <div className="font-semibold text-indigo-700 mb-1.5 uppercase tracking-wide">Recommendation Logic</div>
                        {c.recommendation_logic?.primary_action && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded p-2 text-indigo-800 mb-2">{c.recommendation_logic.primary_action}</div>
                        )}
                        <div className="text-gray-500">Timeline: {c.recommendation_logic?.timeline_weeks || '—'} weeks</div>
                        {(c.recommendation_logic?.success_metrics || []).length > 0 && (
                          <div className="mt-1">
                            <div className="text-gray-500 mb-0.5">Success metrics:</div>
                            <ul className="space-y-0.5">{(c.recommendation_logic.success_metrics || []).map((m, i) => <li key={i} className="text-gray-600">✓ {m}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {concerns.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No concerns found</div>}
            </div>
          )}
        </>
      )}

      {tab === 'chain' && (
        <div className="space-y-4">
          {chain && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Network className="w-6 h-6 text-indigo-500" />
                <div>
                  <div className="font-semibold text-gray-800">{chain.chain}</div>
                  <div className="text-sm text-gray-500 mt-0.5">Complete intelligence chain from atomic signals through concern patterns to competency DNA</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[['Blueprints Covered', chain.blueprints_covered, 'text-blue-700'], ['Competencies Covered', chain.competencies_covered, 'text-indigo-700'], ['Total Concerns', chain.total_concerns, 'text-purple-700']].map(([label, val, cls]) => (
                  <div key={String(label)} className="bg-white rounded-lg p-4 text-center border border-white/80">
                    <div className={`text-3xl font-bold ${cls}`}>{val}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blueprint breakdown */}
          {stats?.by_blueprint && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-medium text-gray-500">Blueprint Coverage</div>
              <table className="w-full text-sm"><thead className="border-b border-gray-100">
                <tr>{['Blueprint', 'Concerns', 'Competencies Covered'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
              </thead><tbody className="divide-y divide-gray-50">
                {stats.by_blueprint.map((b, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{b.blueprint_key}</td>
                    <td className="px-4 py-2 font-bold text-indigo-700">{b.concern_count}</td>
                    <td className="px-4 py-2 text-gray-600">{b.competency_count}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Severity */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="font-medium text-gray-700 mb-3 text-sm">By Severity</div>
            <div className="space-y-2">
              {stats.by_severity.map(s => (
                <div key={s.severity_level} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium w-20 text-center ${SEV_COLORS[s.severity_level] || 'bg-gray-100 text-gray-600'}`}>{s.severity_level}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(Number(s.count) / stats.total) * 100}%` }} /></div>
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Category */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="font-medium text-gray-700 mb-3 text-sm">By Category</div>
            <div className="space-y-2">
              {stats.by_category.map(c => (
                <div key={c.concern_category} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium w-24 text-center ${CAT_COLORS[c.concern_category] || 'bg-gray-100 text-gray-600'}`}>{c.concern_category}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${(Number(c.count) / stats.total) * 100}%` }} /></div>
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{c.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feed links */}
          <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
            <div className="font-medium text-gray-700 mb-3 text-sm">Downstream Feed Links</div>
            <div className="grid grid-cols-3 gap-4">
              {[['→ D9 Readiness Engine', stats.feed_links?.readiness_feed, 'bg-orange-50 text-orange-700'],
                ['→ D14 Digital Twin', stats.feed_links?.twin_feed, 'bg-indigo-50 text-indigo-700'],
                ['→ D15 Outcome Prediction', stats.feed_links?.prediction_feed, 'bg-purple-50 text-purple-700']].map(([label, val, cls]) => (
                <div key={String(label)} className={`rounded-lg p-4 ${cls} text-center`}>
                  <div className="text-2xl font-bold">{val || 0}</div>
                  <div className="text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
