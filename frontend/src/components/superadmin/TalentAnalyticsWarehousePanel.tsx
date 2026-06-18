import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Play, Database } from 'lucide-react';

export default function TalentAnalyticsWarehousePanel() {
  const [executive, setExecutive] = useState<any>(null);
  const [kpiList, setKpiList] = useState<any[]>([]);
  const [factTables, setFactTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'kpis' | 'facts'>('dashboard');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [eR, kR, fR] = await Promise.all([
        fetch('/api/admin/talent/warehouse/executive-dashboard', { credentials: 'include' }),
        fetch('/api/admin/talent/warehouse/kpis', { credentials: 'include' }),
        fetch('/api/admin/talent/warehouse/fact-tables', { credentials: 'include' }),
      ]);
      if (!eR.ok) throw new Error(await eR.text());
      setExecutive(await eR.json());
      if (kR.ok) { const kd = await kR.json(); setKpiList(kd.kpis || []); }
      if (fR.ok) { const fd = await fR.json(); setFactTables(fd.fact_tables || []); }
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const triggerLoad = async () => {
    setLoadingData(true);
    try {
      await fetch('/api/admin/talent/warehouse/load', { method: 'POST', credentials: 'include' });
      await fetch('/api/admin/talent/warehouse/compute-kpis', { method: 'POST', credentials: 'include' });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setLoadingData(false); }
  };

  const kpiMap: Record<string, number> = {};
  for (const k of kpiList) kpiMap[k.kpi_key] = Number(k.kpi_value);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Analytics Warehouse (D20)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Executive dashboard · KPI store · fact tables · predictive analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={triggerLoad} disabled={loadingData} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Play className="w-3.5 h-3.5" />{loadingData ? 'Loading…' : 'Load & Compute'}</button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="flex gap-1 border-b border-gray-200">
        {[['dashboard', 'Executive Dashboard'], ['kpis', 'KPIs'], ['facts', 'Fact Tables']].map(([k, label]) => <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>)}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading warehouse…</div> : tab === 'dashboard' ? (
        <div className="space-y-4">
          {executive ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[['RF Segments', executive.rf_distribution?.length ?? 0, 'bg-blue-50 text-blue-700'], ['Readiness Bands', executive.readiness_band_distribution?.length ?? 0, 'bg-green-50 text-green-700'], ['Top RFs', executive.top_rfs_by_score?.length ?? 0, 'bg-purple-50 text-purple-700'], ['Insights', executive.insights?.length ?? 0, 'bg-orange-50 text-orange-700']].map(([label, val, cls]) => (
                  <div key={String(label)} className={`rounded-lg p-4 ${cls}`}><div className="text-2xl font-bold">{val}</div><div className="text-xs mt-0.5">{label}</div></div>
                ))}
              </div>
              {executive.risk_profile && (
                <div className="grid grid-cols-3 gap-3">
                  {[['High Risk', executive.risk_profile.high_risk, 'text-red-600'], ['Medium Risk', executive.risk_profile.medium_risk, 'text-orange-500'], ['Low Risk', executive.risk_profile.low_risk, 'text-green-600']].map(([k, v, cls]) => (
                    <div key={String(k)} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <div className={`text-xl font-bold ${cls}`}>{v ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{k}</div>
                    </div>
                  ))}
                </div>
              )}
              {(executive.insights?.length ?? 0) > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <div className="font-medium text-indigo-800 mb-2 text-sm">Top Insights</div>
                  <ul className="space-y-1">{executive.insights.map((insight: string, i: number) => <li key={i} className="text-sm text-indigo-700 flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>{insight}</li>)}</ul>
                </div>
              )}
              {executive.top_rfs_by_score?.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">Top Role Families by Score</div>
                  <table className="w-full text-sm"><tbody className="divide-y divide-gray-100">
                    {executive.top_rfs_by_score.map((rf: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{rf.rf_name}</td>
                        <td className="px-4 py-2 text-indigo-700 font-bold">{rf.avg_score}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{rf.headcount} people</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </>
          ) : <div className="text-center py-12 text-gray-400 text-sm">No warehouse data. Click "Load & Compute" to populate.</div>}
        </div>
      ) : tab === 'kpis' ? (
        <div className="space-y-4">
          {kpiList.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {kpiList.map((kpi: any, i: number) => (
                <div key={i} className="rounded-lg p-4 border border-gray-200 bg-white">
                  <div className="text-2xl font-bold text-gray-800">{Number(kpi.kpi_value)}{kpi.kpi_unit === 'percentage' ? '%' : kpi.kpi_unit === 'count' ? '' : ` ${kpi.kpi_unit || ''}`}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{kpi.kpi_name}</div>
                  {kpi.kpi_period && <div className="text-xs text-gray-400 mt-0.5">{kpi.kpi_period}</div>}
                </div>
              ))}
            </div>
          ) : <div className="text-center py-12 text-gray-400 text-sm">No KPIs yet. Run compute.</div>}
        </div>
      ) : (
        <div className="space-y-3">
          {factTables.map((ft: any, i: number) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 flex items-center gap-4">
              <Database className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-gray-800 text-sm">{ft.table_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{ft.description}</div>
              </div>
              <span className="text-xs text-gray-400">{ft.row_count} rows</span>
            </div>
          ))}
          {factTables.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No fact tables loaded</div>}
        </div>
      )}
    </div>
  );
}
