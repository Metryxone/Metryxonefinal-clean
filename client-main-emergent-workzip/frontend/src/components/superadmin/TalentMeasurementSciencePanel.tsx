import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Calculator } from 'lucide-react';

interface Formula { id: number; formula_name: string; target_metric: string; formula_expression: string; formula_version: number; status: string; }
interface WeightConfig { id: number; weight_config_key: string; config_name: string; blueprint_key: string; total_weight: number; version: number; status: string; signal_weights: Record<string, number>; }
interface BandConfig { id: number; band_config_key: string; config_name: string; metric: string; version: number; is_active: boolean; bands: any; }

export default function TalentMeasurementSciencePanel() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [signalWeights, setSignalWeights] = useState<WeightConfig[]>([]);
  const [bands, setBands] = useState<BandConfig[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'formulas' | 'weights' | 'bands'>('overview');
  const [computingNorms, setComputingNorms] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [fR, swR, bR, oR] = await Promise.all([
        fetch('/api/admin/talent/measurement/formulas', { credentials: 'include' }),
        fetch('/api/admin/talent/measurement/signal-weights', { credentials: 'include' }),
        fetch('/api/admin/talent/measurement/score-bands', { credentials: 'include' }),
        fetch('/api/admin/talent/measurement/overview', { credentials: 'include' }),
      ]);
      if (!fR.ok) throw new Error(await fR.text());
      const fd = await fR.json(); setFormulas(fd.formulas || []);
      if (swR.ok) { const sd = await swR.json(); setSignalWeights(sd.configs || []); }
      if (bR.ok) { const bd = await bR.json(); setBands(bd.configs || []); }
      if (oR.ok) setOverview(await oR.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const computeNorms = async () => {
    setComputingNorms(true);
    try {
      const r = await fetch('/api/admin/talent/measurement/norm-groups/compute', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('Norm computation failed');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setComputingNorms(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Measurement Science (D8)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Scoring formulas · signal weight configs · score band configs · norm groups</p>
        </div>
        <div className="flex gap-2">
          <button onClick={computeNorms} disabled={computingNorms} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"><Calculator className="w-3.5 h-3.5" />{computingNorms ? 'Computing…' : 'Recompute Norms'}</button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="flex gap-1 border-b border-gray-200">
        {[['overview', 'Overview'], ['formulas', 'Formulas'], ['weights', 'Signal Weights'], ['bands', 'Score Bands']].map(([k, label]) => <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>)}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading…</div> : tab === 'overview' ? (
        <div className="space-y-4">
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['Total Formulas', overview.scoring_formulas?.total, 'bg-blue-50 text-blue-700'], ['Active Formulas', overview.scoring_formulas?.active, 'bg-green-50 text-green-700'], ['Signal Weight Configs', overview.signal_weight_configs?.total, 'bg-purple-50 text-purple-700'], ['Competency Weight Configs', overview.competency_weight_configs?.total, 'bg-orange-50 text-orange-700']].map(([label, val, cls]) => (
                <div key={String(label)} className={`rounded-lg p-4 ${cls}`}><div className="text-2xl font-bold">{val ?? 0}</div><div className="text-xs mt-0.5">{label}</div></div>
              ))}
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            Last norm group computed: {overview?.last_norm_computed_at ? new Date(overview.last_norm_computed_at).toLocaleString() : 'Never'}
          </div>
        </div>
      ) : tab === 'formulas' ? (
        <div className="space-y-2">
          {formulas.map(f => (
            <div key={f.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{f.formula_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{f.target_metric}</span>
                  <span className="text-xs text-gray-400">v{f.formula_version}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${f.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.status}</span>
                </div>
              </div>
              <code className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded block">{f.formula_expression}</code>
            </div>
          ))}
          {formulas.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No formulas configured</div>}
        </div>
      ) : tab === 'weights' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Config Name', 'Blueprint', 'Total Weight', 'Version', 'Status'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {signalWeights.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{w.config_name}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{w.blueprint_key || '—'}</td>
                <td className="px-3 py-2 font-bold text-indigo-700">{w.total_weight}</td>
                <td className="px-3 py-2 text-gray-500">v{w.version}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{w.status}</span></td>
              </tr>
            ))}
            {signalWeights.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No signal weight configs</td></tr>}
          </tbody></table>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Config Name', 'Metric', 'Version', 'Status'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {bands.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{b.config_name}</td>
                <td className="px-3 py-2 text-gray-600">{b.metric}</td>
                <td className="px-3 py-2 text-gray-500">v{b.version}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
            {bands.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">No score band configs</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
