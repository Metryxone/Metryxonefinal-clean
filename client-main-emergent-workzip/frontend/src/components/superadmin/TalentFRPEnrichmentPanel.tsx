import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Play, Zap } from 'lucide-react';

interface AutomationRisk {
  id: number; role_name: string; industry: string; risk_score: number; risk_band: string;
  timeline_years: number; exposed_tasks: string[]; resilient_tasks: string[]; upskill_priorities: string[];
}
interface AIReadiness {
  id: number; user_email: string; overall_ai_readiness: number; ai_readiness_band: string;
  ai_literacy_score: number; digital_fluency_score: number; learning_agility_score: number;
  adaptation_score: number; recommended_ai_upskills: string[];
}
interface FutureCompetency {
  id: number; blueprint_key: string; current_competency: string; future_competency: string;
  transition_type: string; time_horizon_years: number; ai_impact: string;
  critical_for_future: boolean; reskill_investment_weeks: number;
}

export default function TalentFRPEnrichmentPanel() {
  const [automationRisk, setAutomationRisk] = useState<AutomationRisk[]>([]);
  const [aiReadiness, setAiReadiness] = useState<AIReadiness[]>([]);
  const [futureMap, setFutureMap] = useState<FutureCompetency[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [computeResult, setComputeResult] = useState<any>(null);
  const [tab, setTab] = useState<'automation' | 'ai-readiness' | 'future-map'>('automation');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [arR, airR, fmR] = await Promise.all([
        fetch('/api/admin/frp/automation-risk', { credentials: 'include' }),
        fetch('/api/admin/frp/ai-readiness', { credentials: 'include' }),
        fetch('/api/admin/frp/future-competency-map', { credentials: 'include' }),
      ]);
      if (!arR.ok) throw new Error(await arR.text());
      const ard = await arR.json(); setAutomationRisk(ard.automation_risks || []);
      if (airR.ok) { const aid = await airR.json(); setAiReadiness(aid.scores || []); }
      if (fmR.ok) { const fmd = await fmR.json(); setFutureMap(fmd.transitions || []); }
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const compute = async () => {
    if (!email.trim()) return;
    setComputing(true); setError(''); setComputeResult(null);
    try {
      const r = await fetch(`/api/frp/ai-readiness/compute/${encodeURIComponent(email.trim())}`, { method: 'POST', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Compute failed'); }
      setComputeResult(await r.json()); await load();
    } catch (e: any) { setError(e.message); }
    finally { setComputing(false); }
  };

  const RISK_COLORS: Record<string, string> = { low: 'bg-green-100 text-green-700', very_low: 'bg-green-100 text-green-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-orange-100 text-orange-700', very_high: 'bg-red-100 text-red-700' };
  const BAND_COLORS: Record<string, string> = { ai_native: 'bg-green-100 text-green-700', ai_proficient: 'bg-blue-100 text-blue-700', ai_developing: 'bg-yellow-100 text-yellow-700', ai_resistant: 'bg-orange-100 text-orange-700', ai_unassessed: 'bg-gray-100 text-gray-500' };
  const TRANS_COLORS: Record<string, string> = { replace: 'bg-red-100 text-red-700', augment: 'bg-blue-100 text-blue-700', evolve: 'bg-green-100 text-green-700', emerge: 'bg-purple-100 text-purple-700' };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Future Readiness Enrichment (D13)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Automation risk · AI readiness · future competency map to 2030</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 rounded-lg p-4"><div className="text-2xl font-bold text-orange-700">{automationRisk.length}</div><div className="text-xs text-orange-600 mt-0.5">Role Automation Profiles</div></div>
        <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-2"><Zap className="w-5 h-5 text-blue-400" /><div><div className="text-2xl font-bold text-blue-700">{aiReadiness.length}</div><div className="text-xs text-blue-600">AI Readiness Profiles</div></div></div>
        <div className="bg-purple-50 rounded-lg p-4"><div className="text-2xl font-bold text-purple-700">{futureMap.length}</div><div className="text-xs text-purple-600 mt-0.5">Future Competency Nodes</div></div>
      </div>

      <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
        <input className="flex-1 bg-transparent text-sm outline-none" placeholder="User email to compute AI readiness…" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && compute()} />
        <button onClick={compute} disabled={computing || !email.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Play className="w-3.5 h-3.5" />{computing ? 'Computing…' : 'Compute AI Readiness'}</button>
      </div>

      {computeResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-blue-800 mb-2">AI Readiness Computed</div>
          <div className="grid grid-cols-3 gap-3">
            {[['Score', computeResult.overall_ai_readiness ?? '—'], ['Band', computeResult.ai_readiness_band ?? '—'], ['Literacy', computeResult.ai_literacy_score ?? '—']].map(([k, v]) => (
              <div key={String(k)} className="bg-white rounded p-2 text-center"><div className="font-bold text-gray-800">{v}</div><div className="text-xs text-gray-500">{k}</div></div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {[['automation', 'Automation Risk'], ['ai-readiness', 'AI Readiness'], ['future-map', 'Future Competency Map']].map(([k, label]) => <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>)}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading…</div> : tab === 'automation' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Role', 'Industry', 'Risk Score', 'Risk Band', 'Timeline', 'Exposed Tasks'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {automationRisk.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{r.role_name}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.industry}</td>
                <td className="px-3 py-2 font-bold text-gray-800">{r.risk_score}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${RISK_COLORS[r.risk_band] || 'bg-gray-100 text-gray-600'}`}>{r.risk_band}</span></td>
                <td className="px-3 py-2 text-gray-600">{r.timeline_years}yr</td>
                <td className="px-3 py-2 text-orange-600">{(r.exposed_tasks || []).length} tasks</td>
              </tr>
            ))}
            {automationRisk.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No automation risk profiles</td></tr>}
          </tbody></table>
        </div>
      ) : tab === 'ai-readiness' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['User', 'Overall Score', 'Band', 'AI Literacy', 'Digital Fluency', 'Learning Agility'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {aiReadiness.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.user_email?.slice(0, 20)}…</td>
                <td className="px-3 py-2 font-bold text-gray-800">{r.overall_ai_readiness}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${BAND_COLORS[r.ai_readiness_band] || 'bg-gray-100 text-gray-600'}`}>{r.ai_readiness_band?.replace('ai_', '')}</span></td>
                <td className="px-3 py-2 text-gray-600">{r.ai_literacy_score ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{r.digital_fluency_score ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{r.learning_agility_score ?? '—'}</td>
              </tr>
            ))}
            {aiReadiness.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No AI readiness profiles — compute for users</td></tr>}
          </tbody></table>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Current Competency', 'Future Competency', 'Transition', 'Horizon', 'Reskill (wk)', 'Critical'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {futureMap.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">{f.current_competency}</td>
                <td className="px-3 py-2 text-purple-700 font-medium">{f.future_competency}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${TRANS_COLORS[f.transition_type] || 'bg-gray-100 text-gray-600'}`}>{f.transition_type}</span></td>
                <td className="px-3 py-2 text-gray-600">{f.time_horizon_years}yr</td>
                <td className="px-3 py-2 text-gray-600">{f.reskill_investment_weeks}wk</td>
                <td className="px-3 py-2">{f.critical_for_future ? <span className="text-red-600 font-bold text-xs">✓</span> : <span className="text-gray-300">—</span>}</td>
              </tr>
            ))}
            {futureMap.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No future competency map data</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
