import React, { useState, useEffect } from 'react';
import { Star, RefreshCw, AlertCircle, Target, BarChart2, Users } from 'lucide-react';

const P = { primary: '#4F46E5', green: '#10B981', orange: '#F59E0B', accent: '#7C3AED', red: '#EF4444' };

interface RecommendationAnalyticsData {
  summary: { total_users: string; total_recs: string; avg_rec_score: string };
  by_segment: Array<{ segment: string; avg_score: string; avg_readiness: string }>;
  readiness_distribution: Array<{ band: string; count: string }>;
  lifecycle_rates: Array<{ status: string; count: string; pct: string }>;
}

const BAND_COLOR: Record<string, string> = {
  'High (80+)': P.green, 'Medium (60-79)': P.primary,
  'Developing (40-59)': P.orange, 'Early (< 40)': P.red,
};

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-gray-300 mt-0.5">{sub}</div>}
    </div>
  );
}

function PieSlice({ segments }: { segments: Array<{ label: string; count: number; color: string }> }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  if (total === 0) return <div className="text-xs text-gray-400 text-center py-4">No data yet</div>;
  let cumulAngle = 0;
  const r = 40, cx = 50, cy = 50;
  const slices = segments.map(seg => {
    const angle = (seg.count / total) * 360;
    const start = cumulAngle;
    cumulAngle += angle;
    return { ...seg, startAngle: start, endAngle: cumulAngle };
  });
  function polarToXY(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
        {slices.map((seg, i) => {
          if (seg.count === 0) return null;
          const startPt = polarToXY(cx, cy, r, seg.startAngle);
          const endPt   = polarToXY(cx, cy, r, seg.endAngle);
          const large   = seg.endAngle - seg.startAngle > 180 ? 1 : 0;
          return (
            <path key={i}
              d={`M${cx},${cy} L${startPt.x},${startPt.y} A${r},${r} 0 ${large},1 ${endPt.x},${endPt.y} Z`}
              fill={seg.color} />
          );
        })}
      </svg>
      <div className="space-y-1.5 flex-1">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[11px] text-gray-600 flex-1">{seg.label}</span>
            <span className="text-[11px] font-bold" style={{ color: seg.color }}>{seg.count}</span>
            <span className="text-[10px] text-gray-400">{total > 0 ? Math.round((seg.count / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RecommendationAnalyticsPanel() {
  const [data, setData] = useState<RecommendationAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/career/pi/recommendation-analytics');
      const d = await r.json();
      if (d.ok) setData(d); else setError(d.error ?? 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="animate-spin text-indigo-500" size={20} /></div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm"><AlertCircle size={16} className="inline mr-1" />{error}</div>;
  if (!data) return null;

  const readinessPieSegs = data.readiness_distribution.map(r => ({
    label: r.band, count: Number(r.count), color: BAND_COLOR[r.band] ?? P.slate,
  }));

  const lifecyclePieSegs = data.lifecycle_rates.map(r => ({
    label: r.status.replace('_', ' '), count: Number(r.count),
    color: ['completed','saved','in_progress','viewed','proposed','dismissed']
      .reduce<string>((c, s, i) => r.status === s ? [P.green, P.accent, P.orange, P.primary, '#CBD5E1', '#E2E8F0'][i] : c, P.slate),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Star size={18} style={{ color: P.orange }} /> Recommendation Analytics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">User coverage · segment quality · readiness bands · lifecycle conversion</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Users with Recommendations" value={data.summary.total_users ?? 0} color={P.primary} />
        <StatCard label="Total Recommendations" value={data.summary.total_recs ?? 0} color={P.accent} />
        <StatCard label="Avg Recommendation Score" value={data.summary.avg_rec_score ? Number(data.summary.avg_rec_score).toFixed(2) : '—'} color={P.green} sub="out of 1.0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Readiness distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Target size={14} style={{ color: P.green }} /> Readiness Distribution
          </h3>
          <PieSlice segments={readinessPieSegs} />
        </div>

        {/* Lifecycle distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <BarChart2 size={14} style={{ color: P.primary }} /> Lifecycle Funnel
          </h3>
          <PieSlice segments={lifecyclePieSegs} />
        </div>
      </div>

      {/* By segment */}
      {data.by_segment.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Users size={14} style={{ color: P.accent }} /> Quality by Segment
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-400 font-medium">Segment</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Avg Rec Score</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Avg Readiness</th>
                  <th className="py-2 text-gray-400 font-medium w-32">Score Quality</th>
                </tr>
              </thead>
              <tbody>
                {data.by_segment.map((seg, i) => {
                  const score = Number(seg.avg_score);
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-800 capitalize">{seg.segment.replace('_', ' ')}</td>
                      <td className="py-2.5 text-right font-bold" style={{ color: score > 0.6 ? P.green : score > 0.4 ? P.orange : P.red }}>
                        {score.toFixed(3)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-700">{Number(seg.avg_readiness).toFixed(1)}%</td>
                      <td className="py-2.5 px-2">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${score * 100}%`, background: score > 0.6 ? P.green : score > 0.4 ? P.orange : P.red }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
