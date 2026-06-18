import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, X } from 'lucide-react';

interface HeatmapRow { rf_name: string; level_fit: string; count: number; avg_score: number; }
interface DepthRow { rf_name: string; future_relevance: string; talent_pool_size: number; senior_talent: number; high_performers: number; }
interface CritRow { rf_name: string; future_relevance: string; critical_gaps: number; }

const LEVELS = ['junior','mid','senior','lead','executive'] as const;
const LEVEL_SHORT: Record<string, string> = { junior:'JR', mid:'MID', senior:'SR', lead:'LD', executive:'EX' };
const RELEVANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  low:      'bg-gray-100 text-gray-500',
};

function heatColor(avg: number | null, count: number) {
  if (!count || avg === null) return 'bg-gray-50 text-gray-300';
  if (Number(avg) >= 75) return 'bg-green-100 text-green-800';
  if (Number(avg) >= 60) return 'bg-blue-100 text-blue-800';
  if (Number(avg) >= 45) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-50 text-red-700';
}

export default function TalentPipelinePanel() {
  const [data, setData] = useState<{ level_heatmap: HeatmapRow[]; depth_analysis: DepthRow[]; criticality_analysis: CritRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'heatmap'|'depth'|'criticality'>('heatmap');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/talent/pipeline', { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  // Build heatmap grid: rfName → level → {count, avg_score}
  const heatmapGrid = (() => {
    if (!data) return { rfs: [], grid: {} as Record<string, Record<string, HeatmapRow>> };
    const rfs = [...new Set(data.level_heatmap.map(r => r.rf_name))].sort();
    const grid: Record<string, Record<string, HeatmapRow>> = {};
    rfs.forEach(rf => { grid[rf] = {}; });
    data.level_heatmap.forEach(row => { grid[row.rf_name][row.level_fit] = row; });
    return { rfs, grid };
  })();

  const totalPool = data?.depth_analysis.reduce((s, r) => s + r.talent_pool_size, 0) ?? 0;
  const totalSenior = data?.depth_analysis.reduce((s, r) => s + r.senior_talent, 0) ?? 0;
  const totalHigh = data?.depth_analysis.reduce((s, r) => s + r.high_performers, 0) ?? 0;
  const totalCritical = data?.criticality_analysis.reduce((s, r) => s + r.critical_gaps, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Talent Pool', val: totalPool },
          { label: 'Senior+ Talent', val: totalSenior },
          { label: 'High Performers (70+)', val: totalHigh },
          { label: 'Critical Gap Users', val: totalCritical, color: totalCritical > 0 ? 'text-red-600' : 'text-gray-800' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${s.color || 'text-gray-800'}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['heatmap','Talent Heatmap'],['depth','Depth Analysis'],['criticality','Criticality']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
        <button onClick={load} className="ml-auto p-2 hover:bg-gray-50 rounded"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : !data ? null : (
        <>
          {/* Heatmap Tab */}
          {activeTab === 'heatmap' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
                <p className="text-xs font-semibold text-gray-600">Role Family × Career Level — Avg Score</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" />75+</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 inline-block" />60–74</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 inline-block" />45–59</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 inline-block" />&lt;45</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-2 text-gray-500 font-medium w-48">Role Family</th>
                      {LEVELS.map(l => <th key={l} className="text-center px-2 py-2 text-gray-500 font-medium w-20">{LEVEL_SHORT[l]}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {heatmapGrid.rfs.map(rf => (
                      <tr key={rf} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700 font-medium truncate max-w-[12rem]">{rf}</td>
                        {LEVELS.map(l => {
                          const cell = heatmapGrid.grid[rf]?.[l];
                          return (
                            <td key={l} className="px-2 py-2 text-center">
                              {cell ? (
                                <div className={`mx-auto rounded px-1.5 py-0.5 w-fit text-xs font-mono ${heatColor(cell.avg_score, cell.count)}`}>
                                  {Math.round(cell.avg_score)} <span className="text-gray-400">({cell.count})</span>
                                </div>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {heatmapGrid.rfs.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">No heatmap data — run Talent Scoring first</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Depth Tab */}
          {activeTab === 'depth' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Role Family</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">Relevance</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">Pool Size</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">Senior+ Talent</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">High Performers</th>
                    <th className="px-4 py-2 text-gray-500 font-medium">Pipeline Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.depth_analysis.map(row => {
                    const seniorPct = row.talent_pool_size > 0 ? (row.senior_talent / row.talent_pool_size) * 100 : 0;
                    const highPct = row.talent_pool_size > 0 ? (row.high_performers / row.talent_pool_size) * 100 : 0;
                    return (
                      <tr key={row.rf_name} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{row.rf_name}</td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${RELEVANCE_COLORS[row.future_relevance]}`}>{row.future_relevance}</span>
                        </td>
                        <td className="text-center px-3 py-2.5 text-gray-700 font-medium">{row.talent_pool_size}</td>
                        <td className="text-center px-3 py-2.5">
                          <span className="text-purple-700">{row.senior_talent}</span>
                          <span className="text-gray-400 ml-1">({Math.round(seniorPct)}%)</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className="text-green-700">{row.high_performers}</span>
                          <span className="text-gray-400 ml-1">({Math.round(highPct)}%)</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 items-center">
                            <div className="flex h-2 w-24 rounded-full overflow-hidden bg-gray-200">
                              <div className="bg-green-400 h-2" style={{ width: `${highPct}%` }} />
                            </div>
                            <span className="text-gray-400">{Math.round(highPct)}% high</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data.depth_analysis.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No depth data — run Talent Scoring first</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Criticality Tab */}
          {activeTab === 'criticality' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-3 bg-red-50 border-b border-red-100">
                <p className="text-xs text-red-700">Role families ranked by number of users with critical skill gaps. These represent the highest-priority talent development areas.</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Role Family</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">Relevance</th>
                    <th className="text-center px-3 py-2 text-red-500 font-medium">Critical Gap Users</th>
                    <th className="px-4 py-2 text-gray-500 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.criticality_analysis.sort((a, b) => b.critical_gaps - a.critical_gaps).map((row, i) => (
                    <tr key={row.rf_name} className={row.critical_gaps > 0 ? 'hover:bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {i < 3 && row.critical_gaps > 0 && <span className="mr-1 text-red-500">🔴</span>}
                        {row.rf_name}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded ${RELEVANCE_COLORS[row.future_relevance]}`}>{row.future_relevance}</span>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`font-bold text-sm ${row.critical_gaps > 0 ? 'text-red-600' : 'text-gray-400'}`}>{row.critical_gaps}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.critical_gaps === 0 ? (
                          <span className="text-green-600">✓ No critical gaps</span>
                        ) : (
                          <div className="w-24 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, row.critical_gaps * 10)}%` }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.criticality_analysis.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">No criticality data — run Talent Scoring first</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
