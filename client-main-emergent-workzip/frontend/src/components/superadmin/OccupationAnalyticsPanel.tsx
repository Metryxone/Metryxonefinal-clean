import React, { useState, useEffect } from 'react';
import { Briefcase, RefreshCw, AlertCircle, TrendingUp, Code, Map } from 'lucide-react';

const P = { primary: '#4F46E5', green: '#10B981', orange: '#F59E0B', accent: '#7C3AED', red: '#EF4444' };

interface OccupationData {
  top_roles_by_demand: Array<{ title: string; domain: string; demand_score: number; growth_36mo: number; salary_p50: number }>;
  domain_distribution: Array<{ domain: string; role_count: string; avg_demand: string }>;
  top_demanded_skills: Array<{ skill_name: string; role_count: string; avg_required: string }>;
  track_popularity: Array<{ track_name: string; waypoint_count: string }>;
  total_roles: number;
}

function fmtSalary(n: number) {
  return n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : `₹${(n / 100000).toFixed(0)}L`;
}

function Bar({ value, max, color, height = 2 }: { value: number; max: number; color: string; height?: number }) {
  return (
    <div style={{ height: `${height * 4}px` }} className="bg-gray-100 rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export default function OccupationAnalyticsPanel() {
  const [data, setData] = useState<OccupationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/career/pi/occupation-analytics');
      const d = await r.json();
      if (d.ok) setData(d); else setError(d.error ?? 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="animate-spin text-indigo-500" size={20} /></div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm"><AlertCircle size={16} className="inline mr-1" />{error}</div>;
  if (!data) return null;

  const maxSkill = Math.max(...data.top_demanded_skills.map(s => Number(s.role_count)), 1);
  const maxDomain = Math.max(...data.domain_distribution.map(d => Number(d.role_count)), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={18} style={{ color: P.accent }} /> Occupation Analytics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Role demand · domain coverage · skill demand · career tracks</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-bold" style={{ color: P.primary }}>200</div>
          <div className="text-xs text-gray-400 mt-1">Total Roles</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-bold" style={{ color: P.green }}>{data.domain_distribution.length}</div>
          <div className="text-xs text-gray-400 mt-1">Domains</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
          <div className="text-3xl font-bold" style={{ color: P.orange }}>{data.top_demanded_skills.length}</div>
          <div className="text-xs text-gray-400 mt-1">Tracked Skills</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Domain distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Map size={14} style={{ color: P.primary }} /> Roles by Domain
          </h3>
          <div className="space-y-2.5">
            {data.domain_distribution.map(d => (
              <div key={d.domain} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 w-28 truncate">{d.domain}</span>
                <Bar value={Number(d.role_count)} max={maxDomain} color={P.primary} />
                <span className="text-xs font-bold w-6 text-right text-gray-600">{d.role_count}</span>
                <span className="text-[10px] text-gray-400 w-14 text-right">{d.avg_demand}/100 avg</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top skills in demand */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Code size={14} style={{ color: P.green }} /> Most Demanded Skills
          </h3>
          <div className="space-y-2.5">
            {data.top_demanded_skills.map(s => (
              <div key={s.skill_name} className="flex items-center gap-3">
                <span className="text-xs text-gray-700 w-28 truncate">{s.skill_name}</span>
                <Bar value={Number(s.role_count)} max={maxSkill} color={P.green} />
                <span className="text-xs font-bold w-6 text-right text-gray-600">{s.role_count}</span>
                <span className="text-[10px] text-gray-400 w-10 text-right">L{s.avg_required}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top roles by demand */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
          <TrendingUp size={14} style={{ color: P.orange }} /> Top Roles by Market Demand
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-400 font-medium">#</th>
                <th className="text-left py-2 text-gray-400 font-medium">Role</th>
                <th className="text-left py-2 text-gray-400 font-medium">Domain</th>
                <th className="text-right py-2 text-gray-400 font-medium">Demand</th>
                <th className="text-right py-2 text-gray-400 font-medium">Growth 36m</th>
                <th className="text-right py-2 text-gray-400 font-medium">Salary P50</th>
              </tr>
            </thead>
            <tbody>
              {data.top_roles_by_demand.slice(0, 12).map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 text-gray-400">{i + 1}</td>
                  <td className="py-2.5 font-medium text-gray-800">{r.title}</td>
                  <td className="py-2.5 text-gray-500">{r.domain}</td>
                  <td className="py-2.5 text-right">
                    <span className="font-bold" style={{ color: r.demand_score >= 70 ? P.green : r.demand_score >= 50 ? P.orange : P.red }}>
                      {r.demand_score}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-bold" style={{ color: P.green }}>+{r.growth_36mo}%</td>
                  <td className="py-2.5 text-right text-gray-700">{fmtSalary(r.salary_p50)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Track popularity */}
      {data.track_popularity.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Career Track Coverage</h3>
          <div className="flex flex-wrap gap-2">
            {data.track_popularity.map(t => (
              <div key={t.track_name} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-center min-w-[100px]">
                <div className="text-xs font-semibold text-gray-700">{t.track_name}</div>
                <div className="text-[10px] text-gray-400">{t.waypoint_count} waypoints</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
