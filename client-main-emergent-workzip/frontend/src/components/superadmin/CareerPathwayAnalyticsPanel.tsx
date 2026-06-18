import React, { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, AlertCircle, BarChart2, Users, Route } from 'lucide-react';

const P = { primary: '#4F46E5', green: '#10B981', orange: '#F59E0B', accent: '#7C3AED', red: '#EF4444' };

const SEG_COLOR: Record<string, string> = {
  next_step: P.green, quick_win: P.accent, lateral: P.primary,
  stretch: P.orange, pivot: P.red,
};

interface AnalyticsData {
  segment_distribution: Array<{ segment: string; count: string }>;
  top_recommended_roles: Array<{ role_title: string; domain: string; rec_count: string; avg_score: string }>;
  lifecycle_distribution: Array<{ status: string; count: string }>;
  total_recommendations: number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  );
}

export default function CareerPathwayAnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/career/pi/pathway-analytics');
      const d = await r.json();
      if (d.ok) setData(d); else setError(d.error ?? 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="animate-spin text-indigo-500" size={20} /></div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm"><AlertCircle size={16} className="inline mr-1" />{error}</div>;
  if (!data) return null;

  const maxSeg = Math.max(...data.segment_distribution.map(s => Number(s.count)), 1);
  const maxRole = Math.max(...data.top_recommended_roles.map(r => Number(r.rec_count)), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Route size={18} style={{ color: P.primary }} /> Career Pathway Analytics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Segment distribution · top recommended roles · lifecycle</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-bold" style={{ color: P.primary }}>{data.total_recommendations.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Total Recommendations</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-bold" style={{ color: P.green }}>{data.segment_distribution.length}</div>
          <div className="text-xs text-gray-400 mt-1">Active Segments</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-bold" style={{ color: P.accent }}>
            {data.lifecycle_distribution.find(l => l.status === 'completed')?.count ?? 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">Paths Achieved</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Segment distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <BarChart2 size={14} style={{ color: P.primary }} /> Recommendation Segments
          </h3>
          <div className="space-y-3">
            {data.segment_distribution.map(seg => (
              <div key={seg.segment} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 w-24 capitalize">{seg.segment.replace('_', ' ')}</span>
                <Bar value={Number(seg.count)} max={maxSeg} color={SEG_COLOR[seg.segment] ?? P.primary} />
                <span className="text-xs font-bold w-8 text-right" style={{ color: SEG_COLOR[seg.segment] ?? P.primary }}>
                  {seg.count}
                </span>
              </div>
            ))}
            {data.segment_distribution.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">No recommendation data yet</p>
            )}
          </div>
        </div>

        {/* Lifecycle distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <TrendingUp size={14} style={{ color: P.green }} /> Recommendation Lifecycle
          </h3>
          <div className="space-y-3">
            {['proposed','viewed','saved','in_progress','completed','dismissed'].map(status => {
              const row = data.lifecycle_distribution.find(l => l.status === status);
              const count = Number(row?.count ?? 0);
              const maxLC = Math.max(...data.lifecycle_distribution.map(l => Number(l.count)), 1);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-gray-700 w-24 capitalize">{status.replace('_', ' ')}</span>
                  <Bar value={count} max={maxLC} color={P.primary} />
                  <span className="text-xs font-bold w-8 text-right text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top recommended roles */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
          <Users size={14} style={{ color: P.accent }} /> Top Recommended Roles
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-400 font-medium">Role</th>
                <th className="text-left py-2 text-gray-400 font-medium">Domain</th>
                <th className="text-right py-2 text-gray-400 font-medium">Users</th>
                <th className="text-right py-2 text-gray-400 font-medium">Avg Score</th>
                <th className="py-2 text-gray-400 font-medium w-32">Popularity</th>
              </tr>
            </thead>
            <tbody>
              {data.top_recommended_roles.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 font-medium text-gray-800">{r.role_title}</td>
                  <td className="py-2.5 text-gray-500">{r.domain}</td>
                  <td className="py-2.5 text-right font-bold" style={{ color: P.primary }}>{r.rec_count}</td>
                  <td className="py-2.5 text-right font-bold" style={{ color: P.green }}>{Number(r.avg_score).toFixed(2)}</td>
                  <td className="py-2.5 px-2">
                    <Bar value={Number(r.rec_count)} max={maxRole} color={P.accent} />
                  </td>
                </tr>
              ))}
              {data.top_recommended_roles.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">No recommendation data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
