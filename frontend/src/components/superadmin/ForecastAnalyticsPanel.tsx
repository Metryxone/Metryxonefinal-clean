import React, { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, AlertCircle, Activity, Brain, ClipboardList } from 'lucide-react';

const P = { primary: '#4F46E5', green: '#10B981', orange: '#F59E0B', accent: '#7C3AED', red: '#EF4444', slate: '#64748B' };

interface ForecastAnalyticsData {
  mei_trends_weekly: Array<{ snapshot_date: string; avg_score: string; user_count: string }>;
  lbi_trend_directions: Array<{ direction: string; count: string }>;
  growth_plan_by_status: Array<{ status: string; count: string; avg_ei_lift: string }>;
  growth_plan_by_type: Array<{ type: string; count: string }>;
}

const DIR_COLOR: Record<string, string> = {
  improving: P.green, stable: P.slate, declining: P.red, insufficient_data: '#CBD5E1',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function MiniTimeline({ points }: { points: Array<{ date: string; score: number; users: number }> }) {
  if (points.length < 2) return (
    <div className="py-8 text-center">
      <Activity size={20} className="mx-auto mb-2 text-gray-200" />
      <p className="text-xs text-gray-400">Need 2+ weeks of data for trend</p>
    </div>
  );
  const scores = points.map(p => p.score);
  const min = Math.min(...scores) - 2;
  const max = Math.max(...scores) + 2;
  const range = max - min || 1;
  const w = 300, h = 60, pad = 8;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map(v => h - pad - ((v.score - min) / range) * (h - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="fg-mei" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={P.primary} stopOpacity="0.2" />
            <stop offset="100%" stopColor={P.primary} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`${pathD} L${xs[xs.length-1]},${h-pad} L${xs[0]},${h-pad} Z`} fill="url(#fg-mei)" />
        <path d={pathD} stroke={P.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x.toFixed(1)} cy={ys[i].toFixed(1)} r={3}
            fill="#fff" stroke={P.primary} strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {points.map((p, i) => (
          <div key={i} className="text-center">
            <div className="text-[9px] text-gray-400">{new Date(p.date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</div>
            <div className="text-[10px] font-bold" style={{ color: P.primary }}>{p.score.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ForecastAnalyticsPanel() {
  const [data, setData] = useState<ForecastAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/career/pi/forecast-analytics');
      const d = await r.json();
      if (d.ok) setData(d); else setError(d.error ?? 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="animate-spin text-indigo-500" size={20} /></div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm"><AlertCircle size={16} className="inline mr-1" />{error}</div>;
  if (!data) return null;

  const meiPts = (data.mei_trends_weekly ?? []).reverse().map(r => ({
    date: r.snapshot_date, score: Number(r.avg_score), users: Number(r.user_count),
  }));

  const totalPlanItems = data.growth_plan_by_status.reduce((s, r) => s + Number(r.count), 0);
  const completedItems = data.growth_plan_by_status.find(r => r.status === 'completed');
  const completionRate = totalPlanItems > 0
    ? Math.round((Number(completedItems?.count ?? 0) / totalPlanItems) * 100)
    : 0;

  const maxPlanStatus = Math.max(...data.growth_plan_by_status.map(r => Number(r.count)), 1);
  const maxPlanType   = Math.max(...data.growth_plan_by_type.map(r => Number(r.count)), 1);

  const improvingLbi  = data.lbi_trend_directions.find(d => d.direction === 'improving');
  const decliningLbi  = data.lbi_trend_directions.find(d => d.direction === 'declining');
  const stableLbi     = data.lbi_trend_directions.find(d => d.direction === 'stable');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} style={{ color: P.green }} /> Forecast Analytics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">MEI trends · LBI directions · growth plan completion</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.green }}>{Number(improvingLbi?.count ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">↑ LBI Improving</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.slate }}>{Number(stableLbi?.count ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">→ Stable</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.red }}>{Number(decliningLbi?.count ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">↓ Declining</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.primary }}>{completionRate}%</div>
          <div className="text-xs text-gray-400 mt-1">Plan Completion</div>
        </div>
      </div>

      {/* MEI trend chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
          <Activity size={14} style={{ color: P.primary }} /> Platform MEI Trend (weekly avg)
        </h3>
        <MiniTimeline points={meiPts} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Growth plan by status */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <ClipboardList size={14} style={{ color: P.accent }} /> Growth Plan Status
          </h3>
          {data.growth_plan_by_status.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No growth plan data yet</p>
          ) : (
            <div className="space-y-3">
              {data.growth_plan_by_status.map(row => {
                const statusColor: Record<string, string> = { planned: P.slate, in_progress: P.orange, completed: P.green, skipped: '#CBD5E1' };
                return (
                  <div key={row.status} className="flex items-center gap-3">
                    <span className="text-xs text-gray-700 w-24 capitalize">{row.status.replace('_', ' ')}</span>
                    <Bar value={Number(row.count)} max={maxPlanStatus} color={statusColor[row.status] ?? P.primary} />
                    <span className="text-xs font-bold w-6 text-right text-gray-700">{row.count}</span>
                    <span className="text-[10px] text-gray-400 w-16 text-right">+{Number(row.avg_ei_lift).toFixed(1)} EI avg</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Growth plan by type */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Brain size={14} style={{ color: P.green }} /> Plan Items by Type
          </h3>
          {data.growth_plan_by_type.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No type data yet</p>
          ) : (
            <div className="space-y-3">
              {data.growth_plan_by_type.map(row => (
                <div key={row.type} className="flex items-center gap-3">
                  <span className="text-xs text-gray-700 w-24 capitalize">{row.type}</span>
                  <Bar value={Number(row.count)} max={maxPlanType} color={P.primary} />
                  <span className="text-xs font-bold w-6 text-right text-gray-700">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
