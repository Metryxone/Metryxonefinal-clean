import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle,
  Target, Activity, Brain, Clock, Award, ArrowRight
} from 'lucide-react';

const P = {
  primary: '#4F46E5', green: '#10B981', orange: '#F59E0B',
  accent: '#7C3AED', red: '#EF4444', slate: '#64748B',
};

interface ForecastPoint {
  month: number; label: string; mei_score: number; readiness: number; behaviour_lift: number;
}

interface ForecastSummary {
  projected_mei_6mo: number;
  projected_readiness_6mo: number;
  eta_to_ready_months: number | null;
  trend_direction: string;
  data_confidence: string;
}

interface ForecastData {
  current: {
    mei_score: number; readiness: number; earned_ei: number;
    improving_dims: number; target_role: string | null;
  };
  projection: ForecastPoint[];
  summary: ForecastSummary;
  generated_at: string;
}

const TREND_ICON: Record<string, React.ReactNode> = {
  accelerating: <TrendingUp size={14} style={{ color: P.green }} />,
  improving:    <TrendingUp size={14} style={{ color: P.primary }} />,
  stable:       <Minus      size={14} style={{ color: P.slate }} />,
  declining:    <TrendingDown size={14} style={{ color: P.red }} />,
};
const TREND_COLOR: Record<string, string> = {
  accelerating: P.green, improving: P.primary, stable: P.slate, declining: P.red,
};
const CONF_COLOR: Record<string, string> = {
  high: P.green, moderate: P.orange, low: P.red,
};

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

// Simple inline SVG line chart
function SparkLine({ points, color, height = 60 }: { points: number[]; color: string; height?: number }) {
  if (points.length < 2) return <div style={{ height }} className="flex items-center justify-center text-xs text-gray-300">No data</div>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const pad = 6;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaD = `${pathD} L${xs[xs.length-1]},${h - pad} L${xs[0]},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`fg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#fg-${color.replace('#','')})`} />
      <path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === points.length - 1 ? 4 : 2.5}
          fill={i === points.length - 1 ? color : '#fff'}
          stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

export function ForecastDashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/career/pi/forecast/${userId}`);
      const d = await r.json();
      if (d.ok) setData(d);
      else setError(d.error ?? 'Failed to load forecast');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="animate-spin" size={20} style={{ color: P.primary }} />
      <span className="ml-2 text-sm text-gray-500">Building forecast…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
      <AlertCircle size={20} className="mx-auto mb-2 text-red-400" />
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: P.primary, color: '#fff' }}>Retry</button>
    </div>
  );

  if (!data) return null;
  const { current, projection, summary } = data;

  const meiPoints    = projection.map(p => p.mei_score);
  const readyPoints  = projection.map(p => p.readiness);
  const labels       = projection.map(p => p.label);

  const meiDelta    = (projection[6]?.mei_score ?? current.mei_score) - current.mei_score;
  const readyDelta  = (projection[6]?.readiness ?? current.readiness) - current.readiness;
  const trendColor  = TREND_COLOR[summary.trend_direction] ?? P.slate;
  const confColor   = CONF_COLOR[summary.data_confidence] ?? P.orange;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Career Forecast</h1>
          <p className="text-xs text-gray-400 mt-0.5">6-month projection based on current trajectory</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} style={{ color: P.primary }} />
            <span className="text-[10px] text-gray-400 font-medium">MEI Now</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: P.primary }}>{current.mei_score}<span className="text-sm font-medium text-gray-400">%</span></div>
          <div className="text-[11px] mt-1" style={{ color: meiDelta >= 0 ? P.green : P.red }}>
            {meiDelta >= 0 ? '+' : ''}{meiDelta.toFixed(1)}% in 6 months
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={12} style={{ color: P.green }} />
            <span className="text-[10px] text-gray-400 font-medium">Role Readiness</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: P.green }}>{current.readiness}<span className="text-sm font-medium text-gray-400">%</span></div>
          <div className="text-[11px] mt-1" style={{ color: readyDelta >= 0 ? P.green : P.red }}>
            → {summary.projected_readiness_6mo.toFixed(1)}% projected
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            {TREND_ICON[summary.trend_direction] ?? <Minus size={12} />}
            <span className="text-[10px] text-gray-400 font-medium">Trend</span>
          </div>
          <div className="text-sm font-bold capitalize" style={{ color: trendColor }}>
            {summary.trend_direction}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 capitalize">
            Confidence: <span style={{ color: confColor }}>{summary.data_confidence}</span>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} style={{ color: P.orange }} />
            <span className="text-[10px] text-gray-400 font-medium">ETA to Ready</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: P.orange }}>
            {summary.eta_to_ready_months !== null
              ? summary.eta_to_ready_months === 0 ? 'Now!' : `${summary.eta_to_ready_months} mo`
              : '> 6 mo'}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">to 80% readiness</div>
        </div>
      </div>

      {/* Target role */}
      {current.target_role && (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
          <Award size={16} style={{ color: P.accent }} />
          <div>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Target role</span>
            <p className="text-sm font-semibold text-gray-800">{current.target_role}</p>
          </div>
          <div className="ml-auto text-[11px] text-gray-400">
            {current.improving_dims} dimension{current.improving_dims !== 1 ? 's' : ''} improving
          </div>
        </div>
      )}

      {/* MEI chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
          <Activity size={14} style={{ color: P.primary }} /> Employability Index — 6 Month Projection
        </h3>
        <SparkLine points={meiPoints} color={P.primary} height={80} />
        <div className="flex justify-between mt-2">
          {labels.map(l => (
            <span key={l} className="text-[9px] text-gray-400">{l}</span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {meiPoints.map((v, i) => i % 2 === 0 && (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-12">{labels[i]}</span>
              <MiniBar pct={v} color={P.primary} />
              <span className="text-[10px] font-semibold w-8 text-right" style={{ color: P.primary }}>{v.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Readiness chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
          <Target size={14} style={{ color: P.green }} /> Role Readiness — 6 Month Projection
        </h3>
        <SparkLine points={readyPoints} color={P.green} height={80} />
        <div className="flex justify-between mt-2">
          {labels.map(l => (
            <span key={l} className="text-[9px] text-gray-400">{l}</span>
          ))}
        </div>
        {/* Readiness 80% threshold indicator */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <div className="w-3 h-0.5 rounded" style={{ background: '#94A3B8' }} />
          <span className="text-gray-400">80% readiness threshold (hire-ready signal)</span>
          {summary.eta_to_ready_months !== null && summary.eta_to_ready_months > 0 && (
            <span className="ml-auto font-semibold" style={{ color: P.green }}>
              Projected at +{summary.eta_to_ready_months} months
            </span>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-400 text-center">
        Forecast is directional and extrapolated from {summary.data_confidence} confidence data.
        Projections improve as you complete more assessments and log growth plan progress.
      </p>
    </div>
  );
}
