import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Play, TrendingUp, AlertTriangle } from 'lucide-react';

interface Prediction {
  id: number; user_email: string; rf_name: string; blueprint_key: string;
  promotion_probability: number; role_success_probability: number;
  leadership_potential: number; future_employability: number;
  career_velocity: number; talent_risk: number; prediction_confidence: number;
  predicted_at: string;
}

export default function TalentOutcomePredictionPanel() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [highRisk, setHighRisk] = useState<any[]>([]);
  const [highPotential, setHighPotential] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [computeResult, setComputeResult] = useState<any>(null);
  const [tab, setTab] = useState<'all' | 'risk' | 'potential'>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [pR, rR, ptR] = await Promise.all([
        fetch('/api/admin/talent/predictions?limit=100', { credentials: 'include' }),
        fetch('/api/admin/talent/predictions/high-risk', { credentials: 'include' }),
        fetch('/api/admin/talent/predictions/high-potential', { credentials: 'include' }),
      ]);
      if (!pR.ok) throw new Error(await pR.text());
      const pd = await pR.json(); setPredictions(pd.rows || []); setKpi(pd.kpi || null);
      if (rR.ok) { const rd = await rR.json(); setHighRisk(rd.high_risk_talent || []); }
      if (ptR.ok) { const ptd = await ptR.json(); setHighPotential(ptd.high_potential_talent || []); }
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const compute = async () => {
    if (!email.trim()) return;
    setComputing(true); setError(''); setComputeResult(null);
    try {
      const r = await fetch(`/api/admin/talent/predictions/compute/${encodeURIComponent(email.trim())}`, { method: 'POST', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Compute failed'); }
      setComputeResult(await r.json()); await load();
    } catch (e: any) { setError(e.message); }
    finally { setComputing(false); }
  };

  const pct = (v: number) => `${Math.round((v || 0) * 100)}%`;
  const riskColor = (v: number) => v > 0.6 ? 'text-red-600' : v > 0.4 ? 'text-orange-500' : 'text-green-600';

  const allRows: any[] = tab === 'risk' ? highRisk : tab === 'potential' ? highPotential : predictions;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Outcome Prediction Engine (D15)</h2>
          <p className="text-sm text-gray-500 mt-0.5">6-factor talent outcome predictions — promotion · success · leadership · employability · velocity · risk</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4"><div className="text-2xl font-bold text-blue-700">{predictions.length}</div><div className="text-xs text-blue-600 mt-0.5">Total Predictions</div></div>
        <div className="bg-red-50 rounded-lg p-4 flex items-center gap-3"><AlertTriangle className="w-6 h-6 text-red-400" /><div><div className="text-2xl font-bold text-red-700">{highRisk.length}</div><div className="text-xs text-red-600">High Risk</div></div></div>
        <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-green-400" /><div><div className="text-2xl font-bold text-green-700">{highPotential.length}</div><div className="text-xs text-green-600">High Potential</div></div></div>
      </div>

      {kpi && (
        <div className="grid grid-cols-4 gap-3">
          {[['Avg Promo%', pct(kpi.avg_promo_prob), 'text-blue-700'], ['Avg Success%', pct(kpi.avg_success_prob), 'text-green-700'], ['Avg Leadership', pct(kpi.avg_leadership), 'text-purple-700'], ['Avg Risk', pct(kpi.avg_talent_risk), 'text-orange-600']].map(([k, v, cls]) => (
            <div key={String(k)} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${cls}`}>{v}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
        <input className="flex-1 bg-transparent text-sm outline-none" placeholder="User email to compute predictions…" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && compute()} />
        <button onClick={compute} disabled={computing || !email.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Play className="w-3.5 h-3.5" />{computing ? 'Computing…' : 'Compute'}</button>
      </div>

      {computeResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-green-800 mb-1">Predictions Computed — {computeResult.email}</div>
          <div className="text-green-700">{computeResult.predictions} role prediction(s) generated &middot; {computeResult.computed_at ? new Date(computeResult.computed_at).toLocaleString() : ''}</div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {[['all', 'All Predictions'], ['risk', 'High Risk'], ['potential', 'High Potential']].map(([k, label]) => <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>)}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading…</div> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['User', 'Role Family', 'Promo %', 'Success %', 'Leadership', 'Velocity', 'Risk', 'Confidence'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {allRows.map((p: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{(p.user_email || '')?.slice(0, 18)}…</td>
                <td className="px-3 py-2 text-gray-700 text-xs">{p.rf_name || '—'}</td>
                <td className="px-3 py-2 font-bold text-blue-700">{pct(p.promotion_probability)}</td>
                <td className="px-3 py-2 text-gray-700">{pct(p.role_success_probability)}</td>
                <td className="px-3 py-2 text-purple-700">{pct(p.leadership_potential)}</td>
                <td className="px-3 py-2 text-indigo-600">{pct(p.career_velocity)}</td>
                <td className="px-3 py-2 font-medium"><span className={riskColor(p.talent_risk)}>{pct(p.talent_risk)}</span></td>
                <td className="px-3 py-2 text-gray-500">{pct(p.prediction_confidence)}</td>
              </tr>
            ))}
            {allRows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No predictions yet — compute for a user to populate</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
