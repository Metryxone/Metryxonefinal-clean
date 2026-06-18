import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface IndustryBench {
  industry: string; blueprint_key: string;
  percentile_25: number; percentile_50: number; percentile_75: number; percentile_90: number;
  top_performer_threshold: number; sample_size: number;
}
interface RoleBench {
  rf_name: string; layer: string;
  composite_p25: number; composite_p50: number; composite_p75: number;
  ei_p50: number; lbi_p50: number; sample_size: number;
}
interface LayerBench {
  layer: string;
  composite_p25: number; composite_p50: number; composite_p75: number; composite_p90: number;
}

export default function TalentBenchmarkEnginePanel() {
  const [industry, setIndustry] = useState<IndustryBench[]>([]);
  const [role, setRole] = useState<RoleBench[]>([]);
  const [layer, setLayer] = useState<LayerBench[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'industry' | 'role' | 'layer'>('industry');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [iR, rR, lR] = await Promise.all([
        fetch('/api/admin/talent/benchmarks/industry', { credentials: 'include' }),
        fetch('/api/admin/talent/benchmarks/role', { credentials: 'include' }),
        fetch('/api/admin/talent/benchmarks/layer', { credentials: 'include' }),
      ]);
      if (!iR.ok) throw new Error(await iR.text());
      const id = await iR.json(); setIndustry(id.benchmarks || []);
      if (rR.ok) { const rd = await rR.json(); setRole(rd.benchmarks || []); }
      if (lR.ok) { const ld = await lR.json(); setLayer(ld.benchmarks || []); }
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Benchmark Engine (D17)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Industry · Role · Layer percentile benchmarks</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Industry Benchmarks', industry.length, 'bg-blue-50 text-blue-700'],
          ['Role Benchmarks', role.length, 'bg-purple-50 text-purple-700'],
          ['Layer Benchmarks', layer.length, 'bg-green-50 text-green-700'],
        ].map(([label, val, cls]) => (
          <div key={String(label)} className={`rounded-lg p-4 ${cls}`}>
            <div className="text-2xl font-bold">{val}</div>
            <div className="text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[['industry', 'Industry Benchmarks'], ['role', 'Role Benchmarks'], ['layer', 'Layer Benchmarks']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading benchmarks…</div> : tab === 'industry' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Industry', 'Blueprint', 'P25', 'P50 (median)', 'P75', 'P90', 'Top Thresh.', 'N'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {industry.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700">{r.industry}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.blueprint_key}</td>
                <td className="px-3 py-2 text-gray-500">{r.percentile_25}</td>
                <td className="px-3 py-2 font-bold text-gray-800">{r.percentile_50}</td>
                <td className="px-3 py-2 text-gray-500">{r.percentile_75}</td>
                <td className="px-3 py-2 text-green-600 font-medium">{r.percentile_90}</td>
                <td className="px-3 py-2 text-orange-600">{r.top_performer_threshold}</td>
                <td className="px-3 py-2 text-gray-400">{r.sample_size}</td>
              </tr>
            ))}
            {industry.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No industry benchmarks</td></tr>}
          </tbody></table>
        </div>
      ) : tab === 'role' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Role Family', 'Layer', 'P25', 'P50 (median)', 'P75', 'EI P50', 'LBI P50', 'N'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {role.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700">{r.rf_name}</td>
                <td className="px-3 py-2 text-gray-500 text-xs capitalize">{r.layer}</td>
                <td className="px-3 py-2 text-gray-500">{r.composite_p25}</td>
                <td className="px-3 py-2 font-bold text-blue-700">{r.composite_p50}</td>
                <td className="px-3 py-2 text-gray-500">{r.composite_p75}</td>
                <td className="px-3 py-2 text-purple-700">{r.ei_p50}</td>
                <td className="px-3 py-2 text-green-700">{r.lbi_p50}</td>
                <td className="px-3 py-2 text-gray-400">{r.sample_size}</td>
              </tr>
            ))}
            {role.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No role benchmarks</td></tr>}
          </tbody></table>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Layer', 'P25', 'P50 (median)', 'P75', 'P90'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {layer.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-700 capitalize">{r.layer}</td>
                <td className="px-3 py-2 text-gray-500">{r.composite_p25}</td>
                <td className="px-3 py-2 font-bold text-gray-800">{r.composite_p50}</td>
                <td className="px-3 py-2 text-gray-500">{r.composite_p75}</td>
                <td className="px-3 py-2 text-green-600">{r.composite_p90}</td>
              </tr>
            ))}
            {layer.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No layer benchmarks</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
