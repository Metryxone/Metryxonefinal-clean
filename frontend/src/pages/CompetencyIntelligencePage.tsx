import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Zap, Target, AlertTriangle,
  BookOpen, CheckCircle, ArrowLeft, RefreshCw, Brain, Calendar,
  Bell, BellOff, ArrowRight, Award,
} from 'lucide-react';

type TabId = 'trends' | 'forecast' | 'outcomes' | 'gaps' | 'interventions' | 'explain';

interface Props { onNavigate: (screen: string) => void; }

const TREND_COLORS: Record<string, string> = {
  accelerating: 'text-green-700 bg-green-50',
  improving:    'text-green-600 bg-green-50',
  stable:       'text-blue-600 bg-blue-50',
  plateau:      'text-amber-600 bg-amber-50',
  declining:    'text-red-600 bg-red-50',
};
const GAP_COLORS: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high:     'bg-orange-50 text-orange-700 border-orange-200',
  medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  low:      'bg-green-50 text-green-700 border-green-200',
};
const READINESS_COLORS: Record<string, string> = {
  ready:          'text-green-600',
  on_track:       'text-blue-600',
  needs_focus:    'text-amber-600',
  critical_gap:   'text-red-600',
  no_data:        'text-gray-400',
};
const INTERVENTION_TYPE_COLORS: Record<string, string> = {
  course:      'bg-blue-100 text-blue-700',
  practice:    'bg-purple-100 text-purple-700',
  project:     'bg-green-100 text-green-700',
  mentoring:   'bg-amber-100 text-amber-700',
  reading:     'bg-indigo-100 text-indigo-700',
  workshop:    'bg-pink-100 text-pink-700',
};

export default function CompetencyIntelligencePage({ onNavigate }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('trends');

  const [percentiles, setPercentiles] = useState<any[]>([]);
  const [reassessment, setReassessment] = useState<any>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [pushingGoals, setPushingGoals] = useState(false);
  const [goalsPushResult, setGoalsPushResult] = useState<{ pushed: number; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/competency/intelligence/summary', { credentials: 'include' });
      if (r.status === 503) { setError('Intelligence engine not enabled (FF_COMPETENCY_INTELLIGENCE=0)'); setLoading(false); return; }
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: any) { setError(e.message || 'Failed to load intelligence'); }
    finally { setLoading(false); }

    fetch('/api/competency/intelligence/percentiles', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.percentiles) setPercentiles(d.percentiles); })
      .catch(() => {});
    fetch('/api/competency/intelligence/reassessment-status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setReassessment(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSchedule = async (weeksAhead = 6) => {
    setScheduling(true);
    try {
      const r = await fetch('/api/competency/intelligence/schedule-reassessment', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks_ahead: weeksAhead }),
      });
      if (r.ok) {
        const d = await r.json();
        setScheduled(true);
        setReassessment((prev: any) => ({ ...prev, has_reminder: true, scheduled_date: d.scheduled_date }));
      }
    } catch {}
    setScheduling(false);
  };

  const handlePushGoals = async () => {
    setPushingGoals(true);
    setGoalsPushResult(null);
    try {
      const r = await fetch('/api/competency/intelligence/push-to-goals', {
        method: 'POST', credentials: 'include',
      });
      if (r.ok) {
        const d = await r.json();
        setGoalsPushResult({ pushed: d.pushed, message: d.message });
      }
    } catch {}
    setPushingGoals(false);
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'trends',        label: 'Trends & Velocity', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'forecast',      label: 'Forecast',           icon: <Zap className="w-4 h-4" /> },
    { id: 'outcomes',      label: 'Outcomes & Readiness', icon: <Target className="w-4 h-4" /> },
    { id: 'gaps',          label: 'Gap Priority',        icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'interventions', label: 'Interventions',       icon: <BookOpen className="w-4 h-4" /> },
    { id: 'explain',       label: 'Explainability',      icon: <CheckCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 py-4">
            <button onClick={() => onNavigate('career-builder')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900">Competency Intelligence</h1>
              <p className="text-xs text-gray-500">Trends · Velocity · Forecast · Outcomes · Interventions</p>
            </div>
            {data?.profile_context?.target_role && (
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                → {data.profile_context.target_role}
              </span>
            )}
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* KPI bar */}
          {data?.meta && (
            <div className="flex gap-6 pb-3 text-sm">
              <div className="text-center">
                <div className="font-bold text-gray-800">{data.meta.assessed_competencies}</div>
                <div className="text-xs text-gray-400">Assessed</div>
              </div>
              <div className="text-center">
                <div className={`font-bold ${data.meta.has_trend_data ? 'text-green-600' : 'text-gray-400'}`}>
                  {data.meta.has_trend_data ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-gray-400">Trend Data</div>
              </div>
              <div className="text-center">
                <div className={`font-bold ${data.meta.has_forecast_data ? 'text-blue-600' : 'text-gray-400'}`}>
                  {data.meta.has_forecast_data ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-gray-400">Forecast</div>
              </div>
              {data?.outcome_projection && (
                <div className="text-center">
                  <div className="font-bold text-indigo-600">{data.outcome_projection.overall_readiness_pct}%</div>
                  <div className="text-xs text-gray-400">Role Readiness</div>
                </div>
              )}
            </div>
          )}

          {/* Reassessment banner — single-session only, dismissable */}
          {reassessment?.needs_reassessment && !reassessment?.has_reminder && !scheduled && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <Brain className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-amber-800">Trend analysis is dormant — </span>
                <span className="text-amber-700">velocity, forecast &amp; readiness timeline unlock after your next assessment.</span>
              </div>
              <button
                onClick={() => handleSchedule(6)}
                disabled={scheduling}
                className="flex-shrink-0 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors">
                <Bell className="w-3.5 h-3.5" />
                {scheduling ? 'Scheduling…' : 'Remind me in 6 weeks'}
              </button>
            </div>
          )}
          {(reassessment?.has_reminder || scheduled) && reassessment?.scheduled_date && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs text-green-700">
              <BellOff className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Reassessment reminder set for <strong>{reassessment.scheduled_date}</strong>
                {reassessment.email_sent && ' · confirmation email sent'}.
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading intelligence…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* D1+D2: Trends & Velocity — with E5 percentile badges */}
            {tab === 'trends' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Per-competency score history and development velocity. Velocity requires ≥2 assessment sessions.</p>
                {(data.trends ?? []).length === 0 && (
                  <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200">No assessment data yet</div>
                )}
                <div className="grid gap-3">
                  {(data.trends ?? []).map((t: any) => {
                    const pctEntry = percentiles.find(p => p.competency_code === t.competency_code);
                    return (
                      <div key={t.competency_code} className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-800 text-sm">{t.competency_name}</span>
                              {/* E5: Percentile badge */}
                              {pctEntry?.percentile !== null && pctEntry?.percentile !== undefined && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                  pctEntry.percentile >= 75 ? 'bg-green-50 text-green-700 border-green-200' :
                                  pctEntry.percentile >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-gray-50 text-gray-600 border-gray-200'
                                }`}>
                                  <Award className="w-3 h-3" />
                                  {pctEntry.percentile_label}
                                  {pctEntry.sample_size > 0 && <span className="opacity-60">· {pctEntry.sample_size}p</span>}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{t.domain_name} · {t.observation_count} observation{t.observation_count !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-bold text-gray-800">{t.current_score ?? '—'}</div>
                            <div className="text-xs text-gray-400">current</div>
                          </div>
                        </div>

                        {t.velocity ? (
                          <div className="mt-3 flex flex-wrap gap-2 items-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TREND_COLORS[t.velocity.trend] ?? 'text-gray-500 bg-gray-50'}`}>
                              {t.velocity.trend}
                            </span>
                            <span className={`text-sm font-medium flex items-center gap-0.5 ${t.velocity.velocity_pts_per_30d > 0 ? 'text-green-600' : t.velocity.velocity_pts_per_30d < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                              {t.velocity.velocity_pts_per_30d > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : t.velocity.velocity_pts_per_30d < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                              {t.velocity.velocity_pts_per_30d > 0 ? '+' : ''}{t.velocity.velocity_pts_per_30d} pts/30d
                            </span>
                            <span className="text-xs text-gray-400">Δ {t.velocity.delta_score > 0 ? '+' : ''}{t.velocity.delta_score} total</span>
                            <span className="text-xs text-gray-400 ml-auto">consistency {t.velocity.consistency}%</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-400">Velocity requires ≥2 assessment sessions</div>
                        )}

                        {t.points.length > 1 && (
                          <div className="mt-2 flex items-end gap-1 h-8">
                            {t.points.map((p: any, i: number) => (
                              <div key={i} className="flex-1 bg-indigo-200 rounded-sm transition-all"
                                style={{ height: `${Math.max(8, (p.score / 100) * 32)}px` }}
                                title={`${Math.round(p.score)} pts`} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* D3+D4: Forecast */}
            {tab === 'forecast' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">6-month projection bands using EWMA-smoothed velocity. Bands widen with fewer sessions and lower consistency.</p>
                {(data.forecasts ?? []).length === 0 && (
                  <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200">
                    <div className="mb-2">Forecast requires ≥2 assessment sessions per competency</div>
                    {reassessment?.needs_reassessment && !reassessment?.has_reminder && !scheduled && (
                      <button onClick={() => handleSchedule(6)}
                        disabled={scheduling}
                        className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mx-auto disabled:opacity-50">
                        <Bell className="w-3.5 h-3.5" />
                        {scheduling ? 'Scheduling…' : 'Set reassessment reminder'}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid gap-3">
                  {(data.forecasts ?? []).map((f: any) => (
                    <div key={f.competency_code} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-800 text-sm">{f.competency_name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{f.horizon_months}m forecast · {f.sessions_used} sessions · confidence {f.confidence}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-gray-800">{f.forecast_score}</div>
                          <div className="text-xs text-gray-400">projected</div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-4 text-xs text-gray-500">
                        <span>Now: <strong>{f.current_score}</strong></span>
                        <span>Low: {f.lower_band}</span>
                        <span>High: {f.upper_band}</span>
                        <span className={`ml-auto font-medium ${f.trend_direction === 'up' ? 'text-green-600' : f.trend_direction === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                          {f.trend_direction === 'up' ? '↑' : f.trend_direction === 'down' ? '↓' : '→'} {f.velocity_pts_per_30d > 0 ? '+' : ''}{f.velocity_pts_per_30d} pts/30d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* D5+D7: Outcomes & Readiness */}
            {tab === 'outcomes' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Role readiness projection and per-competency readiness status.</p>

                {data.outcome_projection && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">Overall Role Readiness</h3>
                      <span className={`text-3xl font-bold ${data.outcome_projection.overall_readiness_pct >= 80 ? 'text-green-600' : data.outcome_projection.overall_readiness_pct >= 60 ? 'text-blue-600' : data.outcome_projection.overall_readiness_pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {data.outcome_projection.overall_readiness_pct}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-4">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${data.outcome_projection.overall_readiness_pct}%`,
                          background: data.outcome_projection.overall_readiness_pct >= 80 ? '#16a34a' : data.outcome_projection.overall_readiness_pct >= 60 ? '#2563eb' : data.outcome_projection.overall_readiness_pct >= 40 ? '#d97706' : '#dc2626'
                        }} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="font-bold text-gray-800">{data.outcome_projection.ready_count}</div>
                        <div className="text-xs text-gray-400">Ready</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="font-bold text-gray-800">{data.outcome_projection.on_track_count}</div>
                        <div className="text-xs text-gray-400">On track</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="font-bold text-amber-600">{data.outcome_projection.needs_focus_count}</div>
                        <div className="text-xs text-gray-400">Needs focus</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="font-bold text-red-600">{data.outcome_projection.critical_count}</div>
                        <div className="text-xs text-gray-400">Critical</div>
                      </div>
                    </div>
                    {data.outcome_projection.role_critical_count > 0 && (
                      <div className="text-xs text-indigo-600 mt-3">{data.outcome_projection.role_critical_count} role-critical competencies weighted 1.5×</div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 font-medium text-sm text-gray-700">Readiness Projection by Competency</div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{['Competency', 'Score', 'Target', 'Months to Ready', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(data.readiness_projection ?? []).map((r: any) => (
                        <tr key={r.competency_code} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-700">{r.competency_name}</div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-sm text-gray-700">{r.current_score}</td>
                          <td className="px-4 py-2.5 font-mono text-sm text-gray-500">{r.target_score}</td>
                          <td className="px-4 py-2.5 text-sm">
                            {r.months_to_target === 0 ? '✓' : r.months_to_target != null ? `${r.months_to_target}m` : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${READINESS_COLORS[r.readiness_status] ?? 'text-gray-400'}`}>
                              {r.readiness_status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!(data.readiness_projection ?? []).length && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No readiness data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* D6: Gap Priority — with E3 push-to-goals */}
            {tab === 'gaps' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-gray-500">Gaps sorted by priority score = severity × role-weight × (1 + decline penalty). Role-critical competencies weighted 1.5×.</p>
                  {/* E3: Push to Goals button */}
                  {(data.gap_priority ?? []).some((g: any) => g.gap_level !== 'low') && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {goalsPushResult && (
                        <span className={`text-xs font-medium ${goalsPushResult.pushed > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                          {goalsPushResult.message}
                        </span>
                      )}
                      <button
                        onClick={handlePushGoals}
                        disabled={pushingGoals}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors">
                        <ArrowRight className="w-3.5 h-3.5" />
                        {pushingGoals ? 'Pushing…' : 'Push top gaps to Goals'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid gap-3">
                  {(data.gap_priority ?? []).map((g: any, i: number) => (
                    <div key={g.competency_code} className={`bg-white rounded-lg border p-4 ${GAP_COLORS[g.gap_level]?.includes('border') ? '' : 'border-gray-200'}`}>
                      <div className="flex items-start gap-3">
                        <div className="text-lg font-bold text-gray-300 w-6 text-right flex-shrink-0">#{i + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800 text-sm">{g.competency_name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${GAP_COLORS[g.gap_level] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {g.gap_level}
                            </span>
                            {g.is_role_critical && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">critical role</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-400">{g.domain_name}</div>
                          <div className="mt-2 flex items-center gap-4 text-xs">
                            <span className="text-gray-600">Score: <strong>{g.current_score}</strong> vs target {g.target_score}</span>
                            <span className="text-gray-500">Gap: {g.severity} pts</span>
                            <span className={g.velocity_pts_per_30d < 0 ? 'text-red-500' : g.velocity_pts_per_30d > 0 ? 'text-green-600' : 'text-gray-400'}>
                              {g.velocity_pts_per_30d > 0 ? '+' : ''}{g.velocity_pts_per_30d} pts/30d
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-gray-600">{g.priority_score.toFixed(1)}</div>
                          <div className="text-xs text-gray-400">priority</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!(data.gap_priority ?? []).length && (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200">No gap data</div>
                  )}
                </div>
              </div>
            )}

            {/* D8: Interventions */}
            {tab === 'interventions' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Developmental actions mapped to your top priority gaps. Language policy: growth-oriented only, never clinical or suitability claims.</p>
                {(data.interventions ?? []).length === 0 && (
                  <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200">No intervention data — complete an assessment first</div>
                )}
                <div className="space-y-3">
                  {(data.interventions ?? []).map((iv: any, i: number) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${INTERVENTION_TYPE_COLORS[iv.intervention_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {iv.intervention_type?.replace(/_/g, ' ')}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-700 leading-relaxed">{iv.action}</div>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                            <span>{iv.competency_name}</span>
                            <span>·</span>
                            <span className={`${GAP_COLORS[iv.gap_level]?.split(' ')[0] ?? ''}`}>{iv.gap_level} gap</span>
                            <span>·</span>
                            <span>~{iv.horizon_weeks}w horizon</span>
                            {iv.is_role_critical && <span className="text-indigo-500 font-medium">· role critical</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* D10: Explainability */}
            {tab === 'explain' && data._explain && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                  <h3 className="font-semibold text-gray-800">How this intelligence was computed</h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ['Version', data._explain.methodology_version],
                      ['Sessions used', data._explain.sessions_used],
                      ['Forecast available', data._explain.forecast_available ? 'Yes' : 'No'],
                      ['Language policy', 'developmental only'],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400">{label}</div>
                        <div className="text-sm font-medium text-gray-700 mt-0.5">{String(value)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="text-xs font-medium text-blue-700 mb-1">Confidence note</div>
                    <div className="text-sm text-blue-800">{data._explain.confidence_note}</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Data sources</div>
                    <div className="flex gap-2 flex-wrap">
                      {(data._explain.data_sources ?? []).map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Limitations</div>
                    <ul className="space-y-1">
                      {(data._explain.limitations ?? []).map((l: string, i: number) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-gray-300 mt-0.5">•</span>{l}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <div className="text-xs font-medium text-yellow-700 mb-1">Language policy</div>
                    <div className="text-sm text-yellow-800">
                      All outputs are developmental readiness signals. This system never asserts hiring outcomes, promotion decisions, or suitability predictions.
                    </div>
                  </div>

                  {/* E1: Reassessment panel inside explainability */}
                  <div className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <div className="text-sm font-medium text-gray-700">Reassessment Schedule</div>
                    </div>
                    {reassessment?.has_reminder || scheduled ? (
                      <div className="text-sm text-gray-600">
                        Reminder set for <strong>{reassessment?.scheduled_date}</strong>.
                        {reassessment?.email_sent && ' Confirmation email sent.'}
                        <div className="mt-2 flex gap-2">
                          {[4, 6, 8].map(w => (
                            <button key={w} onClick={() => handleSchedule(w)} disabled={scheduling}
                              className="text-xs text-indigo-600 hover:text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg disabled:opacity-50">
                              Move to {w}w
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-500 mb-3">
                          {reassessment?.needs_reassessment
                            ? 'Single session detected — schedule your next assessment to unlock longitudinal intelligence.'
                            : 'Set a reminder to maintain your competency intelligence cadence.'}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {[4, 6, 8, 12].map(w => (
                            <button key={w} onClick={() => handleSchedule(w)} disabled={scheduling}
                              className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
                              {w} weeks
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {data.profile_context && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Assessment context</div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                      <div><span className="text-gray-400">Career stage:</span> {data.profile_context.career_stage ?? '—'}</div>
                      <div><span className="text-gray-400">Target role:</span> {data.profile_context.target_role ?? '—'}</div>
                      <div><span className="text-gray-400">Current role:</span> {data.profile_context.current_role ?? '—'}</div>
                      <div><span className="text-gray-400">Industry:</span> {data.profile_context.industry ?? '—'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
