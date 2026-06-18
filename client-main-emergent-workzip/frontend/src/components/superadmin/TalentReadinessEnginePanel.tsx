import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Play, Search } from 'lucide-react';

interface ReadinessRow {
  user_email: string; readiness_type: string; rf_name: string;
  readiness_score: number; readiness_band: string;
  success_probability: number; confidence: number;
}
interface PipelineRow { readiness_type: string; readiness_band: string; cnt: number; avg_score: number; }

export default function TalentReadinessEnginePanel() {
  const [rows, setRows] = useState<ReadinessRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [computeResult, setComputeResult] = useState<any>(null);
  const [tab, setTab] = useState<'records' | 'pipeline'>('records');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rR, pR] = await Promise.all([
        fetch('/api/admin/talent/readiness?limit=100', { credentials: 'include' }),
        fetch('/api/admin/talent/readiness/pipeline', { credentials: 'include' }),
      ]);
      if (!rR.ok) throw new Error(await rR.text());
      const rd = await rR.json();
      setRows(rd.rows || []);
      if (pR.ok) { const pd = await pR.json(); setPipeline(pd.readiness_overview || []); }
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const compute = async () => {
    if (!email.trim()) return;
    setComputing(true); setError(''); setComputeResult(null);
    try {
      const r = await fetch(`/api/admin/talent/readiness/compute/${encodeURIComponent(email.trim())}`, { method: 'POST', credentials: 'include' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Compute failed'); }
      setComputeResult(await r.json());
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setComputing(false); }
  };

  const BAND_COLORS: Record<string, string> = {
    ready_now: 'bg-green-100 text-green-700',
    ready_6m: 'bg-blue-100 text-blue-700',
    not_ready: 'bg-red-100 text-red-700',
    ready: 'bg-green-100 text-green-700',
    near_ready: 'bg-blue-100 text-blue-700',
    developing: 'bg-yellow-100 text-yellow-700',
    early: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Talent Readiness Engine (D9)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Role readiness, succession pipeline, time-to-ready projections</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input className="flex-1 bg-transparent text-sm outline-none" placeholder="User email to compute readiness…" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && compute()} />
        <button onClick={compute} disabled={computing || !email.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Play className="w-3.5 h-3.5" />{computing ? 'Computing…' : 'Compute'}</button>
      </div>

      {computeResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <div className="font-medium text-green-800 mb-2">Readiness Computed</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{(computeResult.readiness || []).map((r: any, i: number) => (
            <div key={i} className="bg-white rounded p-2 text-center">
              <div className="font-bold text-gray-800">{r.readiness_score}</div>
              <div className="text-xs text-gray-500">{r.readiness_type}</div>
              <div className={`text-xs mt-1 px-1.5 py-0.5 rounded inline-block ${BAND_COLORS[r.readiness_band] || 'bg-gray-100 text-gray-600'}`}>{r.readiness_band}</div>
            </div>
          ))}</div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {(['records', 'pipeline'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'records' ? 'Readiness Records' : 'Overview by Band'}</button>)}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading…</div> : tab === 'records' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['User', 'Type', 'Role Family', 'Score', 'Band', 'Success Prob.', 'Confidence'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.user_email}</td>
                <td className="px-3 py-2 text-gray-600">{r.readiness_type}</td>
                <td className="px-3 py-2 text-gray-600">{r.rf_name || '—'}</td>
                <td className="px-3 py-2 font-bold text-gray-800">{r.readiness_score}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${BAND_COLORS[r.readiness_band] || 'bg-gray-100 text-gray-600'}`}>{r.readiness_band}</span></td>
                <td className="px-3 py-2 text-gray-600">{r.success_probability != null ? `${Math.round(Number(r.success_probability) * 100)}%` : '—'}</td>
                <td className="px-3 py-2 text-gray-500">{Math.round((Number(r.confidence) || 0) * 100)}%</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No readiness records yet — compute a user first</td></tr>}
          </tbody></table>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Readiness Type', 'Band', 'Count', 'Avg Score'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {pipeline.map((p, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 capitalize">{p.readiness_type}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${BAND_COLORS[p.readiness_band] || 'bg-gray-100 text-gray-600'}`}>{p.readiness_band}</span></td>
                <td className="px-3 py-2 font-bold text-gray-800">{p.cnt}</td>
                <td className="px-3 py-2 text-gray-600">{p.avg_score}</td>
              </tr>
            ))}
            {pipeline.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">No pipeline data yet</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
