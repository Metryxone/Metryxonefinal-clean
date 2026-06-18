import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Brain, Target, Zap, CheckCircle, AlertCircle,
  ArrowRight, RefreshCw, Star, Clock, DollarSign, Activity,
  ChevronDown, ChevronUp, Award
} from 'lucide-react';

const P = {
  primary: '#4F46E5', green: '#10B981', orange: '#F59E0B',
  accent: '#7C3AED', red: '#EF4444', slate: '#64748B',
};

interface PathwayRec {
  role_id: number; role_title: string; domain: string; segment: string;
  rec_score: number; readiness_score: number; market_score: number;
  salary_delta_pct: number; transition_prob: number; behaviour_fit: number;
  intelligence_score: number; lifecycle_status: string;
  intelligence_signals: {
    mei_score: number; mei_band: string; lbi_score: number; lbi_band: string;
    improving_dims: string[]; mei_lift: number; lbi_lift: number; trend_bonus: number;
  };
}

interface IntelligenceSummary {
  mei_score: number; mei_band: string; lbi_score: number; lbi_band: string;
  avg_readiness: number; total_recommendations: number; improving_dimensions: string[];
}

const SEG_COLOR: Record<string, string> = {
  next_step: P.green, quick_win: P.accent, lateral: P.primary,
  stretch: P.orange, pivot: P.red,
};
const SEG_LABEL: Record<string, string> = {
  next_step: 'Next Step', quick_win: 'Quick Win', lateral: 'Lateral',
  stretch: 'Stretch', pivot: 'Pivot',
};
const STATUS_COLOR: Record<string, string> = {
  proposed: '#94A3B8', viewed: P.primary, saved: P.accent,
  in_progress: P.orange, completed: P.green, dismissed: '#CBD5E1',
};

function ScoreBadge({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center bg-white border border-gray-100 rounded-xl p-2 min-w-[60px]">
      <span className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}

export function PathwayExplorerPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<{ intelligence_summary: IntelligenceSummary; recommendations: PathwayRec[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/career/pi/pathway-intelligence/${userId}`);
      const d = await r.json();
      if (d.ok) setData(d);
      else setError(d.error ?? 'Failed to load');
    } catch (e) { setError('Network error'); }
    finally { setLoading(false); }
  }

  async function updateLifecycle(roleId: number, segment: string, status: string) {
    setUpdating(roleId);
    try {
      await fetch('/api/career/pi/recommendation-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_id: roleId, segment, status }),
      });
      await load();
    } finally { setUpdating(null); }
  }

  const segments = ['all', 'next_step', 'quick_win', 'lateral', 'stretch', 'pivot'];
  const filtered = (data?.recommendations ?? []).filter(r =>
    filter === 'all' || r.segment === filter
  );

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="animate-spin" size={20} style={{ color: P.primary }} />
      <span className="ml-2 text-sm text-gray-500">Loading pathway intelligence…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
      <AlertCircle size={20} className="mx-auto mb-2 text-red-400" />
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={load} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: P.primary, color: '#fff' }}>Retry</button>
    </div>
  );

  const summary = data?.intelligence_summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pathway Explorer</h1>
          <p className="text-xs text-gray-400 mt-0.5">Intelligence-driven career paths ranked by EI · LBI · market fit</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Intelligence Summary */}
      {summary && (
        <div className="rounded-2xl p-5 border shadow-sm" style={{ background: `linear-gradient(135deg, ${P.primary}08, ${P.accent}08)`, borderColor: `${P.primary}20` }}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: P.primary }}>Intelligence Summary</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Activity size={12} style={{ color: P.primary }} />
                  <span className="text-xs text-gray-700">MEI: <strong>{summary.mei_score}%</strong> <span className="text-gray-400">({summary.mei_band})</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Brain size={12} style={{ color: P.accent }} />
                  <span className="text-xs text-gray-700">LBI: <strong>{summary.lbi_score}%</strong> <span className="text-gray-400">({summary.lbi_band})</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Target size={12} style={{ color: P.green }} />
                  <span className="text-xs text-gray-700">Avg Readiness: <strong>{summary.avg_readiness}%</strong></span>
                </div>
              </div>
              {summary.improving_dimensions.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-2">
                  Improving: {summary.improving_dimensions.slice(0, 3).join(', ')}{summary.improving_dimensions.length > 3 ? ` +${summary.improving_dimensions.length - 3}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-center bg-white rounded-xl p-3 border border-gray-100 min-w-[64px]">
                <div className="text-[9px] text-gray-400">Paths</div>
                <div className="text-lg font-bold" style={{ color: P.primary }}>{summary.total_recommendations}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Segment filter */}
      <div className="flex flex-wrap gap-2">
        {segments.map(seg => (
          <button key={seg} onClick={() => setFilter(seg)}
            className="text-xs font-medium px-3 py-1.5 rounded-xl border transition-all"
            style={filter === seg
              ? { background: seg === 'all' ? P.primary : SEG_COLOR[seg] ?? P.primary, color: '#fff', borderColor: 'transparent' }
              : { borderColor: '#e2e8f0', color: '#64748B' }}>
            {seg === 'all' ? 'All Paths' : SEG_LABEL[seg] ?? seg}
            {seg !== 'all' && (
              <span className="ml-1 opacity-70">({(data?.recommendations ?? []).filter(r => r.segment === seg).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Recommendation cards */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <TrendingUp size={20} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">No pathways in this segment yet</p>
          <p className="text-xs text-gray-400 mt-1">Complete your profile and assessment to unlock recommendations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => {
            const isExpanded = expanded === rec.role_id;
            const segColor = SEG_COLOR[rec.segment] ?? P.primary;
            const statusColor = STATUS_COLOR[rec.lifecycle_status] ?? '#94A3B8';
            const intelligenceLift = rec.intelligence_signals.mei_lift + rec.intelligence_signals.lbi_lift + rec.intelligence_signals.trend_bonus;

            return (
              <div key={rec.role_id}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden hover:border-gray-200 transition-all">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: segColor }}>{SEG_LABEL[rec.segment] ?? rec.segment}</span>
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full border"
                          style={{ borderColor: statusColor, color: statusColor }}>
                          {rec.lifecycle_status.replace('_', ' ')}
                        </span>
                        {intelligenceLift > 0 && (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                            +{intelligenceLift} intelligence lift
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-gray-900">{rec.role_title}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">{rec.domain}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] text-gray-400">Score</div>
                        <div className="text-lg font-bold" style={{ color: segColor }}>{Math.round(rec.intelligence_score)}%</div>
                      </div>
                      <button onClick={() => setExpanded(isExpanded ? null : rec.role_id)}
                        className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <ScoreBadge score={rec.readiness_score} label="Readiness" color={segColor} />
                    <ScoreBadge score={rec.market_score} label="Market" color={P.green} />
                    <ScoreBadge score={Math.round(rec.behaviour_fit * 100)} label="Behaviour" color={P.accent} />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {rec.lifecycle_status !== 'saved' && rec.lifecycle_status !== 'in_progress' && rec.lifecycle_status !== 'completed' && (
                      <button
                        onClick={() => updateLifecycle(rec.role_id, rec.segment, 'saved')}
                        disabled={updating === rec.role_id}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50"
                        style={{ borderColor: P.primary, color: P.primary }}>
                        {updating === rec.role_id ? <RefreshCw size={10} className="animate-spin inline mr-1" /> : <Star size={10} className="inline mr-1" />}
                        Save Path
                      </button>
                    )}
                    {rec.lifecycle_status === 'saved' && (
                      <button
                        onClick={() => updateLifecycle(rec.role_id, rec.segment, 'in_progress')}
                        disabled={updating === rec.role_id}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-white"
                        style={{ background: P.orange }}>
                        Start Working Toward This
                      </button>
                    )}
                    {rec.lifecycle_status === 'in_progress' && (
                      <button
                        onClick={() => updateLifecycle(rec.role_id, rec.segment, 'completed')}
                        disabled={updating === rec.role_id}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-white"
                        style={{ background: P.green }}>
                        <CheckCircle size={10} className="inline mr-1" />Mark Achieved
                      </button>
                    )}
                    {rec.lifecycle_status !== 'dismissed' && rec.lifecycle_status !== 'completed' && (
                      <button
                        onClick={() => updateLifecycle(rec.role_id, rec.segment, 'dismissed')}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-600">
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <DollarSign size={12} className="mx-auto mb-1" style={{ color: P.green }} />
                        <div className="text-[10px] text-gray-400">Salary Delta</div>
                        <div className="text-sm font-bold" style={{ color: rec.salary_delta_pct >= 0 ? P.green : P.red }}>
                          {rec.salary_delta_pct >= 0 ? '+' : ''}{rec.salary_delta_pct}%
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <Zap size={12} className="mx-auto mb-1" style={{ color: P.orange }} />
                        <div className="text-[10px] text-gray-400">Transition Prob</div>
                        <div className="text-sm font-bold text-gray-800">{Math.round(rec.transition_prob * 100)}%</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <Activity size={12} className="mx-auto mb-1" style={{ color: P.primary }} />
                        <div className="text-[10px] text-gray-400">MEI Score</div>
                        <div className="text-sm font-bold text-gray-800">{rec.intelligence_signals.mei_score}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <Brain size={12} className="mx-auto mb-1" style={{ color: P.accent }} />
                        <div className="text-[10px] text-gray-400">LBI Score</div>
                        <div className="text-sm font-bold text-gray-800">{rec.intelligence_signals.lbi_score}</div>
                      </div>
                    </div>
                    {rec.intelligence_signals.improving_dims.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Improving behavioural dimensions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.intelligence_signals.improving_dims.map(d => (
                            <span key={d} className="text-[11px] font-medium px-2 py-0.5 rounded-full text-green-700 bg-green-50 border border-green-100">
                              ↑ {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
