import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

type AdminTab = 'overview' | 'scores' | 'gaps' | 'trends';

export default function CompetencyIntelligenceAdminPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/competency-intelligence/overview', { credentials: 'include' });
      if (r.status === 503) { setError('FF_COMPETENCY_INTELLIGENCE not enabled'); setLoading(false); return; }
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: 'KPIs' },
    { id: 'scores', label: 'Competency Scores' },
    { id: 'gaps', label: 'Top Gaps' },
    { id: 'trends', label: 'Trend Distribution' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Competency Intelligence (D9 Admin)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Population-level competency trends · gaps · forecast coverage · velocity distribution</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Users Assessed', data.kpi.total_users, 'bg-indigo-50 text-indigo-700'],
              ['Total Scores', data.kpi.total_scores, 'bg-blue-50 text-blue-700'],
              ['Users Forecasted', data.kpi.users_forecasted, 'bg-green-50 text-green-700'],
              ['Competencies Forecasted', data.kpi.competencies_forecasted, 'bg-purple-50 text-purple-700'],
            ].map(([label, val, cls]) => (
              <div key={String(label)} className={`rounded-lg p-4 ${cls}`}>
                <div className="text-2xl font-bold">{val}</div>
                <div className="text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Domain summary */}
          {data.domain_summary?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-3">Domain Summary (avg score, sorted ascending)</div>
              <div className="space-y-2">
                {data.domain_summary.map((d: any) => (
                  <div key={d.domain_code} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-gray-500 truncate">{d.domain_name}</div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${d.avg_score}%`,
                          backgroundColor: d.avg_score >= 70 ? '#22c55e' : d.avg_score >= 55 ? '#f59e0b' : '#ef4444',
                        }} />
                    </div>
                    <div className="text-xs font-mono text-gray-700 w-8 text-right">{d.avg_score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>{t.label}</button>
            ))}
          </div>

          {tab === 'scores' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Competency', 'Domain', 'Avg Score', 'Min', 'Max', 'Users'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.competency_scores.map((r: any) => (
                    <tr key={r.competency_code} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{r.competency_name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">{r.domain_code}</td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${r.avg_score >= 70 ? 'text-green-600' : r.avg_score >= 55 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {r.avg_score}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{r.min_score}</td>
                      <td className="px-3 py-2 text-gray-500">{r.max_score}</td>
                      <td className="px-3 py-2 text-gray-500">{r.user_count}</td>
                    </tr>
                  ))}
                  {!data.competency_scores.length && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No score data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'gaps' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Competencies where population average is below 65 (mid-stage anchor)</p>
              {data.top_gaps.map((g: any, i: number) => (
                <div key={g.competency_code} className="bg-white border border-red-100 rounded-lg p-4 flex items-center gap-4">
                  <div className="text-lg font-bold text-gray-200 w-6">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-700">{g.competency_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Avg score: <strong className="text-red-500">{g.avg_score}</strong> · {g.gap_count} users below target</div>
                  </div>
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
              ))}
              {!data.top_gaps.length && (
                <div className="text-center py-8 text-gray-400 bg-white border border-gray-200 rounded-lg">No gaps detected — all averages above threshold</div>
              )}
            </div>
          )}

          {tab === 'trends' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Velocity trend distribution from persisted development velocity snapshots</p>
              {data.trend_distribution.length > 0 ? (
                data.trend_distribution.map((t: any) => (
                  <div key={t.trend} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                    {t.trend === 'accelerating' || t.trend === 'steady' ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className="capitalize font-medium text-gray-700 w-32">{t.trend?.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${Math.min(100, t.count * 5)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-8 text-right">{t.count}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 bg-white border border-gray-200 rounded-lg">
                  No trend snapshots yet — users need ≥2 assessment sessions
                </div>
              )}
            </div>
          )}

          {tab === 'overview' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
              <div className="font-medium text-gray-700 mb-2">System Status</div>
              <div className="space-y-1">
                <div>Version: <span className="font-mono text-gray-700">{data._version}</span></div>
                <div>Generated: <span className="text-gray-700">{new Date(data.generated_at).toLocaleString()}</span></div>
                <div>Flag: <span className="font-mono text-green-600">FF_COMPETENCY_INTELLIGENCE=1</span></div>
              </div>
            </div>
          )}
        </>
      )}

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading intelligence overview…</div>}
    </div>
  );
}
