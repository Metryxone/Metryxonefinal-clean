import React, { useState, useEffect } from 'react';
import { ArrowRight, RefreshCw, AlertCircle, CheckCircle, Network, Target } from 'lucide-react';

const P = { primary: '#4F46E5', green: '#10B981', orange: '#F59E0B', accent: '#7C3AED', red: '#EF4444', slate: '#64748B' };

interface TransitionData {
  edge_type_breakdown: Array<{ edge_type: string; count: string; avg_transition_prob: string }>;
  completed_transitions: number;
  monthly_readiness_trend: Array<{ month: string; avg_readiness: string; user_count: string }>;
  intervention_by_status: Array<{ status: string; count: string }>;
  outcome_by_type: Array<{ type: string; count: string }>;
}

const EDGE_TYPE_LABEL: Record<string, string> = {
  promotion: 'Promotion', lateral: 'Lateral Move', stretch: 'Stretch',
  pivot: 'Career Pivot', reentry: 'Re-entry',
};
const EDGE_COLOR: Record<string, string> = {
  promotion: P.green, lateral: P.primary, stretch: P.orange, pivot: P.red, reentry: P.accent,
};
const OUTCOME_LABEL: Record<string, string> = {
  role_change: 'Role Change', salary_increase: 'Salary Increase', promotion: 'Promotion',
  skill_acquired: 'Skill Acquired', certification: 'Certification', other: 'Other',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full"
        style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export default function TransitionAnalyticsPanel() {
  const [data, setData] = useState<TransitionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/career/pi/transition-analytics');
      const d = await r.json();
      if (d.ok) setData(d); else setError(d.error ?? 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><RefreshCw className="animate-spin text-indigo-500" size={20} /></div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm"><AlertCircle size={16} className="inline mr-1" />{error}</div>;
  if (!data) return null;

  const maxEdge       = Math.max(...(data.edge_type_breakdown ?? []).map(e => Number(e.count)), 1);
  const maxIntervention = Math.max(...(data.intervention_by_status ?? []).map(i => Number(i.count)), 1);
  const maxOutcome    = Math.max(...(data.outcome_by_type ?? []).map(o => Number(o.count)), 1);

  const totalInterventions = data.intervention_by_status.reduce((s, r) => s + Number(r.count), 0);
  const completedInterventions = Number(data.intervention_by_status.find(r => r.status === 'completed')?.count ?? 0);
  const interventionCompletionRate = totalInterventions > 0
    ? Math.round((completedInterventions / totalInterventions) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowRight size={18} style={{ color: P.accent }} /> Transition Analytics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Transition types · readiness trends · interventions · outcomes</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.green }}>{data.completed_transitions}</div>
          <div className="text-xs text-gray-400 mt-1">Completed Transitions</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.primary }}>{totalInterventions}</div>
          <div className="text-xs text-gray-400 mt-1">Total Interventions</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.orange }}>{interventionCompletionRate}%</div>
          <div className="text-xs text-gray-400 mt-1">Intervention Completion</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <div className="text-2xl font-bold" style={{ color: P.accent }}>
            {data.outcome_by_type.reduce((s, r) => s + Number(r.count), 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Recorded Outcomes</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transition type breakdown */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Network size={14} style={{ color: P.primary }} /> Transition Type Breakdown (Graph Edges)
          </h3>
          {data.edge_type_breakdown.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No edge data</p>
          ) : (
            <div className="space-y-3">
              {data.edge_type_breakdown.map(edge => (
                <div key={edge.edge_type} className="flex items-center gap-3">
                  <span className="text-xs text-gray-700 w-28">{EDGE_TYPE_LABEL[edge.edge_type] ?? edge.edge_type}</span>
                  <Bar value={Number(edge.count)} max={maxEdge} color={EDGE_COLOR[edge.edge_type] ?? P.primary} />
                  <span className="text-xs font-bold w-8 text-right text-gray-700">{edge.count}</span>
                  <span className="text-[10px] text-gray-400 w-12 text-right">
                    {(Number(edge.avg_transition_prob) * 100).toFixed(0)}% prob
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intervention status */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <Target size={14} style={{ color: P.orange }} /> Intervention Tracking
          </h3>
          {data.intervention_by_status.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No interventions logged yet</p>
          ) : (
            <div className="space-y-3">
              {data.intervention_by_status.map(row => {
                const c: Record<string, string> = { planned: P.slate, started: P.orange, completed: P.green, cancelled: P.red };
                return (
                  <div key={row.status} className="flex items-center gap-3">
                    <span className="text-xs text-gray-700 w-20 capitalize">{row.status}</span>
                    <Bar value={Number(row.count)} max={maxIntervention} color={c[row.status] ?? P.primary} />
                    <span className="text-xs font-bold w-6 text-right text-gray-700">{row.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly readiness trend */}
      {data.monthly_readiness_trend.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Readiness Trend</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-400 font-medium">Month</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Avg Readiness</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Users</th>
                  <th className="py-2 text-gray-400 font-medium w-40">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly_readiness_trend.map((row, i) => {
                  const score = Number(row.avg_readiness);
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 text-gray-700">
                        {new Date(row.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 text-right font-bold"
                        style={{ color: score >= 70 ? P.green : score >= 50 ? P.orange : P.red }}>
                        {score.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{row.user_count}</td>
                      <td className="py-2.5 px-2">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${score}%`, background: score >= 70 ? P.green : score >= 50 ? P.orange : P.red }} />
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

      {/* Outcomes by type */}
      {data.outcome_by_type.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
            <CheckCircle size={14} style={{ color: P.green }} /> Recorded Outcomes
          </h3>
          <div className="flex flex-wrap gap-3">
            {data.outcome_by_type.map(row => (
              <div key={row.type} className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-center min-w-[110px]">
                <div className="text-lg font-bold" style={{ color: P.primary }}>{row.count}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{OUTCOME_LABEL[row.type] ?? row.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
