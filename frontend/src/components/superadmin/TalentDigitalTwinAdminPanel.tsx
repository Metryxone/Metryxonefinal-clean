import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Play, Cpu } from 'lucide-react';

interface TwinPrediction {
  id: number; user_email: string;
  predicted_his_3m: number; predicted_his_6m: number; predicted_his_12m: number;
  predicted_readiness_band: string; growth_trajectory: string;
  intervention_priority: string; prediction_confidence: number; predicted_at: string;
}

export default function TalentDigitalTwinAdminPanel() {
  const [twins, setTwins] = useState<TwinPrediction[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [email, setEmail] = useState('');
  const [computeResult, setComputeResult] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/talent/twin?limit=100', { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setTwins(d.rows || []);
      setKpi(d.kpi || null);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const synthesize = async () => {
    if (!email.trim()) return;
    setSynthesizing(true); setError(''); setComputeResult(null);
    try {
      const r = await fetch(`/api/admin/talent/twin/synthesize/${encodeURIComponent(email.trim())}`, { method: 'POST', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Synthesis failed'); }
      setComputeResult(await r.json()); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSynthesizing(false); }
  };

  const TRAJ_COLORS: Record<string, string> = {
    accelerating: 'bg-green-100 text-green-700', steady: 'bg-blue-100 text-blue-700',
    plateauing: 'bg-yellow-100 text-yellow-700', declining: 'bg-red-100 text-red-700',
    insufficient_data: 'bg-gray-100 text-gray-500',
  };
  const PRIORITY_COLORS: Record<string, string> = { urgent: 'text-red-600', high: 'text-orange-500', medium: 'text-yellow-600', low: 'text-green-600', none: 'text-gray-400' };

  const trajectoryDist = twins.reduce<Record<string, number>>((acc, t) => { acc[t.growth_trajectory] = (acc[t.growth_trajectory] || 0) + 1; return acc; }, {});

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Talent Digital Twin (D14)</h2>
          <p className="text-sm text-gray-500 mt-0.5">6-state digital twin synthesis — growth trajectory, HIS projections, intervention priority</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {['accelerating', 'steady', 'plateauing', 'declining', 'insufficient_data'].map(traj => (
          <div key={traj} className={`rounded-lg p-3 text-center ${TRAJ_COLORS[traj] || 'bg-gray-100 text-gray-600'}`}>
            <div className="text-xl font-bold">{trajectoryDist[traj] || 0}</div>
            <div className="text-xs mt-0.5 capitalize">{traj.replace('_', ' ')}</div>
          </div>
        ))}
      </div>

      {kpi && (
        <div className="grid grid-cols-4 gap-3">
          {[['Total', kpi.total, 'text-gray-800'], ['Avg HIS 12m', kpi.avg_his_12m, 'text-blue-700'], ['Avg Confidence', `${Math.round((kpi.avg_confidence || 0) * 100)}%`, 'text-indigo-700'], ['Urgent', kpi.urgent_interventions, 'text-red-600']].map(([k, v, cls]) => (
            <div key={String(k)} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${cls}`}>{v}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
        <Cpu className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input className="flex-1 bg-transparent text-sm outline-none" placeholder="User email to synthesize twin…" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && synthesize()} />
        <button onClick={synthesize} disabled={synthesizing || !email.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Play className="w-3.5 h-3.5" />{synthesizing ? 'Synthesizing…' : 'Synthesize'}</button>
      </div>

      {computeResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-indigo-800 mb-2">Twin Synthesized — {computeResult.email}</div>
          <div className="grid grid-cols-3 gap-3">
            {[['Trajectory', computeResult.trajectory], ['Confidence', `${Math.round((computeResult.overall_confidence || 0) * 100)}%`], ['Priority', computeResult.intervention_priority]].map(([k, v]) => (
              <div key={String(k)} className="bg-white rounded p-2 text-center"><div className="font-bold text-gray-800">{v || '—'}</div><div className="text-xs text-gray-500">{k}</div></div>
            ))}
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading twins…</div> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['User', 'Trajectory', 'HIS 3m', 'HIS 12m', 'Readiness Band', 'Priority', 'Confidence', 'Date'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {twins.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{t.user_email?.slice(0, 20)}…</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TRAJ_COLORS[t.growth_trajectory] || 'bg-gray-100 text-gray-600'}`}>{t.growth_trajectory?.replace('_', ' ')}</span></td>
                <td className="px-3 py-2 text-gray-600">{t.predicted_his_3m ?? '—'}</td>
                <td className="px-3 py-2 font-bold text-indigo-700">{t.predicted_his_12m ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{t.predicted_readiness_band || '—'}</td>
                <td className="px-3 py-2 font-medium"><span className={PRIORITY_COLORS[t.intervention_priority] || 'text-gray-500'}>{t.intervention_priority}</span></td>
                <td className="px-3 py-2 text-gray-700">{Math.round((t.prediction_confidence || 0) * 100)}%</td>
                <td className="px-3 py-2 text-gray-400 text-xs">{t.predicted_at ? new Date(t.predicted_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {twins.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No digital twins yet — synthesize for a user to populate</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
