import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Zap, Target, BookOpen, Activity, ChevronRight, Loader2, RefreshCw,
  Shield, Lightbulb, BarChart2, Clock, Award, ArrowUp, ArrowDown,
  Info, FileText, Sparkles, CheckCheck, Star, Share2,
  BookMarked, Briefcase, Heart, GraduationCap
} from 'lucide-react';

const BRAND = '#344E86';
const API = '/api';

type DashTab = 'overview' | 'behavior' | 'trends' | 'recommendations' | 'report' | 'forecast' | 'outcomes' | 'comparative' | 'share';

const DIM_LABELS: Record<string, string> = {
  consistency_score: 'Consistency', persistence_score: 'Persistence',
  attention_score: 'Attention',     adaptability_score: 'Adaptability',
  velocity_score: 'Velocity',
};

const DIM_COLORS: Record<string, string> = {
  consistency_score: '#344E86', persistence_score: '#4ECDC4',
  attention_score: '#6366F1',   adaptability_score: '#10B981',
  velocity_score: '#F59E0B',
};

const BAND_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high:        { label: 'High Performer',  color: '#10B981', bg: '#D1FAE5' },
  developing:  { label: 'Developing',      color: '#344E86', bg: '#EEF2FF' },
  emerging:    { label: 'Emerging',        color: '#F59E0B', bg: '#FEF3C7' },
  early_stage: { label: 'Early Stage',     color: '#6B7280', bg: '#F3F4F6' },
  no_data:     { label: 'Not Yet Scored',  color: '#9CA3AF', bg: '#F9FAFB' },
};

const DIR_ICON: Record<string, React.ReactNode> = {
  improving:        <ArrowUp size={13} className="text-green-500" />,
  declining:        <ArrowDown size={13} className="text-red-400" />,
  stable:           <Minus size={13} className="text-gray-400" />,
  insufficient_data:<Minus size={13} className="text-gray-300" />,
};

const EFFORT_CONFIG: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Low effort',    cls: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium effort', cls: 'bg-yellow-100 text-yellow-700' },
  high:   { label: 'High effort',   cls: 'bg-red-100 text-red-700' },
};

function ScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0;
  const dash = pct * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={BRAND} strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="central"
        fill={BRAND} fontSize={size * 0.22} fontWeight="700"
        style={{ transform: `rotate(90deg) translate(0px, -${size}px)`, fontFamily: 'inherit' }}>
        {score != null ? Math.round(score) : '—'}
      </text>
    </svg>
  );
}

function DimBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const band = score == null ? 'no_data' : score >= 65 ? 'strong' : score >= 42 ? 'developing' : 'needs_focus';
  const bandCls = band === 'strong' ? 'text-green-600' : band === 'developing' ? 'text-blue-600' : band === 'needs_focus' ? 'text-amber-600' : 'text-gray-400';
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-gray-600 font-medium">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className={`w-16 text-xs font-semibold text-right ${bandCls}`}>
        {score != null ? Math.round(score) : '—'}
      </div>
    </div>
  );
}

function RiskBadge({ severity }: { severity: string }) {
  const cfg = severity === 'high' ? 'bg-red-100 text-red-700'
    : severity === 'medium' ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${cfg}`}>{severity}</span>;
}

interface LBIDashboardProps {
  email?: string;
}

function MiniSparkline({ prev, curr, color }: { prev: number | null; curr: number | null; color: string }) {
  if (prev == null || curr == null) return null;
  const W = 56; const H = 24; const pad = 4;
  const lo = Math.min(prev, curr, 0); const hi = Math.max(prev, curr, 1);
  const range = hi - lo || 1;
  const toY = (v: number) => H - pad - ((v - lo) / range) * (H - 2 * pad);
  const x1 = pad; const x2 = W - pad;
  const y1 = toY(prev); const y2 = toY(curr);
  return (
    <svg width={W} height={H} className="shrink-0">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={x1} cy={y1} r={3} fill={color} opacity={0.4} />
      <circle cx={x2} cy={y2} r={3.5} fill={color} />
    </svg>
  );
}

export default function LBIDashboard({ email }: LBIDashboardProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [stakeholderType, setStakeholderType] = useState<'learner' | 'parent' | 'counselor' | 'employer'>('learner');

  const emailParam = email ? `?email=${encodeURIComponent(email)}` : '';

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['lbi-learner-profile', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/learner-profile${emailParam}`);
      if (!r.ok) throw new Error('Failed to load LBI profile');
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['lbi-trends', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/trends/behavior${emailParam}`);
      if (!r.ok) throw new Error('Failed to load trends');
      return r.json();
    },
    enabled: activeTab === 'trends' || activeTab === 'overview',
    staleTime: 60_000,
  });

  const { data: risksData } = useQuery({
    queryKey: ['lbi-risks', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/risk-profile${emailParam}`);
      if (!r.ok) throw new Error('Failed to load risks');
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: recsData, isLoading: recsLoading } = useQuery({
    queryKey: ['lbi-recommendations', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/recommendations${emailParam}&limit=15`);
      if (!r.ok) throw new Error('Failed to load recommendations');
      return r.json();
    },
    enabled: activeTab === 'recommendations',
    staleTime: 60_000,
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['lbi-report-latest', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/report/latest${emailParam}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: activeTab === 'report',
    staleTime: 300_000,
  });

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['lbi-forecast', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/forecast${emailParam}`);
      if (!r.ok) throw new Error('forecast failed');
      return r.json();
    },
    enabled: activeTab === 'forecast' || activeTab === 'trends',
    staleTime: 120_000,
  });

  const { data: outcomesData, isLoading: outcomesLoading } = useQuery({
    queryKey: ['lbi-outcomes', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/outcomes${emailParam}`);
      if (!r.ok) throw new Error('outcomes failed');
      return r.json();
    },
    enabled: activeTab === 'outcomes',
    staleTime: 120_000,
  });

  const { data: comparativeData, isLoading: comparativeLoading } = useQuery({
    queryKey: ['lbi-comparative', email],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/comparative${emailParam}`);
      if (!r.ok) throw new Error('comparative failed');
      return r.json();
    },
    enabled: activeTab === 'comparative',
    staleTime: 120_000,
  });

  const { data: stakeholderData, isLoading: stakeholderLoading } = useQuery({
    queryKey: ['lbi-stakeholder-report', email, stakeholderType],
    queryFn: async () => {
      const r = await fetch(`${API}/lbi/report/stakeholder/${stakeholderType}${emailParam}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: activeTab === 'share',
    staleTime: 300_000,
  });

  const actionMutation = useMutation({
    mutationFn: async (recId: number) => {
      const r = await fetch(`${API}/lbi/recommendations/${recId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lbi-recommendations', email] }),
  });

  async function handleGenerateReport() {
    setGeneratingReport(true);
    try {
      const emailBody = email ? { email } : {};
      await fetch(`${API}/lbi/report/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'standard', ...emailBody }),
      });
      await qc.invalidateQueries({ queryKey: ['lbi-report-latest', email] });
    } finally { setGeneratingReport(false); }
  }

  const learner   = profile?.learner;
  const behavior  = profile?.behavior;
  const velocity  = profile?.velocity;
  const lbi       = learner?.overall_lbi;
  const band      = BAND_CONFIG[learner?.lbi_band ?? 'no_data'];
  const activeRisks = risksData?.active_risks ?? [];

  const TABS: { id: DashTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',        label: 'Overview',         icon: <Brain size={15} /> },
    { id: 'behavior',        label: 'Behaviour Profile',icon: <Activity size={15} /> },
    { id: 'trends',          label: 'Learning Trends',  icon: <TrendingUp size={15} /> },
    { id: 'forecast',        label: 'Forecast',         icon: <Sparkles size={15} /> },
    { id: 'outcomes',        label: 'Outcomes',         icon: <Target size={15} /> },
    { id: 'comparative',     label: 'Comparative',      icon: <BarChart2 size={15} /> },
    { id: 'recommendations', label: 'Recommendations',  icon: <Lightbulb size={15} /> },
    { id: 'report',          label: 'My Report',        icon: <FileText size={15} /> },
    { id: 'share',           label: 'Share Report',     icon: <Share2 size={15} /> },
  ];

  if (profileLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Loading your learning profile…
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'inherit' }}>
            Learning Behaviour Index
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Your personalised learning behaviour profile — 5 dimensions, real-time intelligence.
          </p>
        </div>
        {activeRisks.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
            <AlertTriangle size={13} />
            {activeRisks.length} attention area{activeRisks.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-[#344E86] text-[#344E86]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Score card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3">
            <ScoreRing score={lbi} size={96} />
            <div>
              <div className="text-center text-sm font-semibold text-gray-700">Overall LBI</div>
              <div className="flex justify-center mt-1">
                <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: band.bg, color: band.color }}>
                  {band.label}
                </span>
              </div>
            </div>
            {learner?.learning_style && (
              <div className="text-xs text-center text-gray-500">
                Style: <span className="font-semibold capitalize text-gray-700">{learner.learning_style}</span>
              </div>
            )}
            <div className="text-xs text-gray-400">{learner?.sessions_analyzed ?? 0} session{learner?.sessions_analyzed !== 1 ? 's' : ''} analyzed</div>
          </div>

          {/* Strengths + Focus */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Star size={12} /> Top Strengths
              </div>
              {(learner?.top_strengths ?? []).length === 0
                ? <p className="text-xs text-gray-400">Complete more sessions to reveal your strengths.</p>
                : (learner?.top_strengths ?? []).map((s: any) => (
                  <div key={s.dimension} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{s.label}</span>
                    <span className="text-sm font-bold" style={{ color: BRAND }}>{Math.round(s.score)}</span>
                  </div>
                ))
              }
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target size={12} /> Focus Areas
              </div>
              {(learner?.focus_areas ?? []).length === 0
                ? <p className="text-xs text-gray-400">Complete an assessment to see your focus areas.</p>
                : (learner?.focus_areas ?? []).map((f: any) => (
                  <div key={f.dimension} className="py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{f.label}</span>
                      <span className="text-sm font-bold text-amber-600">{Math.round(f.score)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{f.message}</p>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Quick trends + risks */}
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Learning Direction
              </div>
              {trendsData?.learning_trend ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {DIR_ICON[trendsData.learning_trend.overall_direction]}
                    <span className="text-sm font-semibold capitalize text-gray-700">
                      {trendsData.learning_trend.overall_direction.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Arc: <span className="capitalize font-medium text-gray-700">{(trendsData.learning_trend.engagement_arc ?? '').replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Sessions last 30 days: <span className="font-medium text-gray-700">{trendsData.learning_trend.sessions_30d}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Complete multiple sessions to unlock trend data.</p>
              )}
            </div>

            {activeRisks.length > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Attention Areas
                </div>
                {activeRisks.slice(0, 2).map((r: any) => (
                  <div key={r.risk_type} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-amber-800 capitalize">{r.risk_type.replace('_', ' ')}</span>
                    <RiskBadge severity={r.severity} />
                  </div>
                ))}
                <button onClick={() => setActiveTab('behavior')}
                  className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-0.5 hover:underline">
                  View details <ChevronRight size={11} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Behaviour Profile ─────────────────────────────────────────────── */}
      {activeTab === 'behavior' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900">Dimension Breakdown</h3>
            <div className="space-y-3">
              {Object.keys(DIM_LABELS).map(dim => {
                const d = (behavior?.dimensions ?? []).find((x: any) => x.key === dim);
                return (
                  <DimBar key={dim} label={DIM_LABELS[dim]} score={d?.score ?? null}
                    color={DIM_COLORS[dim]} />
                );
              })}
            </div>
            <div className="pt-2 border-t border-gray-100">
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Strong ≥65</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Developing 42–64</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Needs focus &lt;42</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {behavior?.style_narrative && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Your Learning Style
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold mb-3"
                  style={{ background: '#EEF2FF', color: BRAND }}>
                  <Sparkles size={13} />
                  <span className="capitalize">{behavior?.dominant_style}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{behavior.style_narrative}</p>
              </div>
            )}

            {activeRisks.length > 0 ? (
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 space-y-3">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <Shield size={12} /> Risk Indicators
                </div>
                {activeRisks.map((r: any) => (
                  <div key={r.risk_type} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-amber-800 capitalize">{r.risk_type.replace(/_/g, ' ')}</span>
                      <RiskBadge severity={r.severity} />
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">{r.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 rounded-2xl border border-green-100 p-5 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-green-700">No active risk indicators</div>
                  <div className="text-xs text-green-600 mt-0.5">Your learning behaviour profile looks healthy.</div>
                </div>
              </div>
            )}

            {behavior?.behavioral_summary && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Info size={12} /> Behavioural Summary
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{behavior.behavioral_summary}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Learning Trends ───────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        trendsLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading trends…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Learning trend summary */}
            {trendsData?.learning_trend ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Overall Direction</div>
                  <div className="flex items-center justify-center gap-1 font-semibold text-sm capitalize text-gray-800">
                    {DIR_ICON[trendsData.learning_trend.overall_direction]}
                    {trendsData.learning_trend.overall_direction.replace('_', ' ')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Engagement Arc</div>
                  <div className="text-sm font-semibold text-gray-800 capitalize">
                    {(trendsData.learning_trend.engagement_arc ?? '').replace('_', ' ')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Sessions (30d)</div>
                  <div className="text-sm font-semibold text-gray-800">{trendsData.learning_trend.sessions_30d}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Weekly Improvement</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {trendsData.learning_trend.avg_weekly_improvement != null
                      ? `${trendsData.learning_trend.avg_weekly_improvement > 0 ? '+' : ''}${Number(trendsData.learning_trend.avg_weekly_improvement).toFixed(1)} pts/wk`
                      : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 text-sm text-blue-700">
                <Info size={14} className="inline mr-1.5" />
                Complete at least 2 CAPADEX sessions to unlock your learning trend analysis.
              </div>
            )}

            {/* Per-dimension trends */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(trendsData?.behavior_trends ?? []).map((t: any) => {
                const dimColor = DIM_COLORS[t.dimension] ?? BRAND;
                const prev = t.current_score != null && t.delta != null ? t.current_score - t.delta : null;
                const curr = t.current_score;
                const dirColor = t.direction === 'improving' ? '#10B981' : t.direction === 'declining' ? '#EF4444' : '#6B7280';
                return (
                  <div key={t.dimension} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-800">{t.dimension_label}</span>
                      <div className="flex items-center gap-1.5">
                        <MiniSparkline prev={prev} curr={curr} color={dimColor} />
                      </div>
                    </div>
                    <div className="flex items-end gap-3 mb-2">
                      <div>
                        <div className="text-2xl font-black" style={{ color: dimColor }}>
                          {curr != null ? Math.round(curr) : '—'}
                        </div>
                        <div className="text-[10px] text-gray-400">current</div>
                      </div>
                      {t.delta != null && (
                        <div className="mb-1 flex items-center gap-1">
                          <span className="text-sm font-bold" style={{ color: dirColor }}>
                            {t.delta > 0 ? '+' : ''}{Number(t.delta).toFixed(1)}
                          </span>
                          {DIR_ICON[t.direction]}
                        </div>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, curr ?? 0)}%`, backgroundColor: dimColor }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium capitalize`} style={{ color: dirColor }}>
                        {(t.direction ?? '').replace('_', ' ')}
                      </span>
                      <span className="text-gray-400">{t.snapshots_analyzed} snapshot{t.snapshots_analyzed !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
              {(trendsData?.behavior_trends ?? []).length === 0 && (
                <div className="col-span-3 text-center py-10 text-gray-400 text-sm">
                  No trend data yet. Complete additional CAPADEX sessions to activate trend tracking.
                </div>
              )}
              {/* E10: Projected trajectory when < 2 snapshots */}
              {(trendsData?.behavior_trends ?? []).length === 0 && (forecastData?.forecasts ?? []).length > 0 && (
                <div className="col-span-3 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} style={{ color: BRAND }} />
                    <p className="text-xs font-semibold text-gray-600">Projected Trajectory</p>
                    <span className="text-[10px] text-gray-400 italic">directional only — complete a 2nd session for real trends</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(forecastData.forecasts ?? []).slice(0, 4).map((fc: any) => {
                      const col = fc.polarity === 'protective' ? '#10B981' : fc.polarity === 'risk' ? '#EF4444' : '#F59E0B';
                      return (
                        <div key={fc.pattern_key} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl text-xs border border-gray-100">
                          <div className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: col }} />
                          <div>
                            <p className="font-semibold text-gray-800">{fc.label}</p>
                            <p className="text-gray-400 capitalize mt-0.5">{fc.polarity} · {fc.confidence_band} conf.</p>
                            {fc.d30?.projected != null && (
                              <p className="text-gray-500 mt-0.5">30d: <span className="font-medium" style={{ color: col }}>{fc.d30.projected.toFixed(1)}</span></p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── Recommendations ───────────────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        recsLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading recommendations…
          </div>
        ) : (
          <div className="space-y-3">
            {(recsData?.recommendations ?? []).length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Lightbulb size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No recommendations yet. Complete a CAPADEX session to generate your personalised action plan.</p>
              </div>
            ) : (() => {
              const active = (recsData?.recommendations ?? []).filter((r: any) => !r.is_actioned);
              const done   = (recsData?.recommendations ?? []).filter((r: any) => r.is_actioned);
              const RecCard = ({ rec }: { rec: any }) => (
                <div className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${rec.is_actioned ? 'opacity-55 border-gray-100' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {rec.is_actioned && <CheckCheck size={13} className="text-green-500 shrink-0" />}
                        <span className="text-sm font-semibold text-gray-900 leading-snug">{rec.title}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">
                          {DIM_LABELS[rec.target_dimension] ?? rec.target_dimension}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${EFFORT_CONFIG[rec.effort_level]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                          {EFFORT_CONFIG[rec.effort_level]?.label ?? rec.effort_level}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{rec.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {rec.time_to_complete && <span className="flex items-center gap-1"><Clock size={11} /> {rec.time_to_complete}</span>}
                        {rec.estimated_impact > 0 && <span className="flex items-center gap-1"><Zap size={11} /> +{rec.estimated_impact} pts est.</span>}
                      </div>
                    </div>
                    {!rec.is_actioned && (
                      <button onClick={() => actionMutation.mutate(rec.id)}
                        disabled={actionMutation.isPending}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border-2 transition-all hover:bg-green-50 hover:border-green-400 hover:text-green-700"
                        style={{ borderColor: `${BRAND}30`, color: BRAND }}>
                        <CheckCheck size={12} /> Done
                      </button>
                    )}
                  </div>
                </div>
              );
              return (
                <div className="space-y-5">
                  {active.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb size={14} style={{ color: BRAND }} />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Active</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{active.length}</span>
                      </div>
                      {active.map((rec: any) => <RecCard key={rec.id} rec={rec} />)}
                    </div>
                  )}
                  {done.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCheck size={14} className="text-green-500" />
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{done.length}</span>
                      </div>
                      {done.map((rec: any) => <RecCard key={rec.id} rec={rec} />)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )
      )}

      {/* ── Report ────────────────────────────────────────────────────────── */}
      {activeTab === 'report' && (
        reportLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading report…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">LBI Standard Report</h3>
                {reportData?.generated_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generated {new Date(reportData.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <button onClick={handleGenerateReport} disabled={generatingReport}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: BRAND }}>
                {generatingReport ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {reportData ? 'Regenerate' : 'Generate Report'}
              </button>
            </div>

            {!reportData && !generatingReport && (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <FileText size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 mb-1">No report generated yet.</p>
                <p className="text-xs text-gray-400">Click "Generate Report" to create your full LBI analysis.</p>
              </div>
            )}

            {reportData?.report_data && (
              <div className="space-y-3">
                {/* Executive summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                      <Brain size={16} style={{ color: BRAND }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Executive Summary</span>
                    {reportData.overall_lbi != null && (
                      <span className="ml-auto text-sm font-bold" style={{ color: BRAND }}>
                        LBI: {Math.round(reportData.overall_lbi)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {reportData.report_data.executive_summary}
                  </p>
                </div>

                {/* Key insights */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles size={14} style={{ color: BRAND }} /> Key Insights
                  </h4>
                  <ul className="space-y-2">
                    {(reportData.report_data.key_insights ?? []).map((ins: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: BRAND }} />
                        {ins}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Top recommendations preview */}
                {(reportData.report_data.recommendations ?? []).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Recommendations</h4>
                    <div className="space-y-2">
                      {reportData.report_data.recommendations.slice(0, 3).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ background: BRAND }}>{i + 1}</div>
                          {r.title}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setActiveTab('recommendations')}
                      className="text-xs font-medium mt-3 flex items-center gap-0.5 hover:underline"
                      style={{ color: BRAND }}>
                      View all recommendations <ChevronRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* ── Forecast ──────────────────────────────────────────────────────── */}
      {activeTab === 'forecast' && (
        forecastLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading forecasts…
          </div>
        ) : (
          <div className="space-y-4">
            {forecastData?.note && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>{forecastData.note}</span>
              </div>
            )}
            {(forecastData?.forecasts ?? []).length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 mb-1">No forecast data yet.</p>
                <p className="text-xs text-gray-400">Complete at least 2 CAPADEX sessions to unlock 30/60/90-day projections.</p>
              </div>
            ) : (
              (forecastData?.forecasts ?? []).map((fc: any) => {
                const polarityColor = fc.polarity === 'protective' ? '#10B981' : fc.polarity === 'risk' ? '#EF4444' : '#F59E0B';
                const polarityBg   = fc.polarity === 'protective' ? '#F0FDF4' : fc.polarity === 'risk' ? '#FEF2F2' : '#FFFBEB';
                return (
                  <div key={fc.pattern_key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: polarityColor }} />
                        <span className="text-sm font-semibold text-gray-900">{fc.label}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ backgroundColor: polarityBg, color: polarityColor }}>
                        {fc.polarity}
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400 capitalize">{fc.confidence_band} confidence</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-700">{fc.current_value?.toFixed(1) ?? '—'}</div>
                        <div className="text-[10px] text-gray-400">Now</div>
                      </div>
                      {[fc.d30, fc.d60, fc.d90].filter(Boolean).map((d: any) => (
                        <div key={d.days} className="text-center p-2 rounded-lg"
                          style={{ backgroundColor: polarityBg }}>
                          <div className="text-lg font-bold" style={{ color: polarityColor }}>
                            {d.projected?.toFixed(1) ?? '—'}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: polarityColor }}>{d.days}d</div>
                          <div className="text-[9px] text-gray-400 capitalize">{d.direction?.replace('_', ' ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )
      )}

      {/* ── Outcomes ──────────────────────────────────────────────────────── */}
      {activeTab === 'outcomes' && (
        outcomesLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading outcomes…
          </div>
        ) : (
          <div className="space-y-4">
            {!outcomesData?.session_id ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Target size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 mb-1">No completed CAPADEX session found.</p>
                <p className="text-xs text-gray-400">Complete a CAPADEX assessment to unlock outcome projections.</p>
              </div>
            ) : (outcomesData?.outcomes?.models ?? []).length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Target size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No outcome models resolved for this session yet.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Info size={12} className="shrink-0" />
                  Session: <span className="font-mono">{outcomesData.session_id}</span>
                </div>
                {(outcomesData.outcomes.models ?? []).map((oc: any, i: number) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{oc.display_label ?? oc.model_key}</p>
                        {oc.model_key && oc.display_label && (
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{oc.model_key}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {oc.gap_normalized != null && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            oc.gap_normalized >= 0.7 ? 'bg-red-100 text-red-700' :
                            oc.gap_normalized >= 0.4 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            Gap: {Math.round(oc.gap_normalized * 100)}%
                          </span>
                        )}
                        {oc.confidence != null && (
                          <span className="text-[10px] text-gray-400">
                            {Math.round(oc.confidence * 100)}% conf.
                          </span>
                        )}
                      </div>
                    </div>
                    {(oc.actions ?? []).length > 0 && (
                      <ul className="space-y-1">
                        {oc.actions.slice(0, 4).map((a: any, j: number) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <ChevronRight size={11} className="mt-0.5 shrink-0" style={{ color: BRAND }} />
                            {typeof a === 'string' ? a : (a.intervention_text ?? JSON.stringify(a))}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )
      )}

      {/* ── Comparative ───────────────────────────────────────────────────── */}
      {activeTab === 'comparative' && (
        comparativeLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading comparative data…
          </div>
        ) : (
          <div className="space-y-4">
            {comparativeData?.note === 'user_not_found' ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <BarChart2 size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">Register an account to unlock peer benchmarking.</p>
              </div>
            ) : comparativeData?.peer_comparison?.suppressed ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <BarChart2 size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 mb-1">Peer cohort too small for comparison.</p>
                <p className="text-xs text-gray-400">Benchmarks require a minimum cohort size for privacy.</p>
              </div>
            ) : (
              <>
                {comparativeData?.percentile_rank && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-900">Your Percentile</span>
                      <span className="text-xs text-gray-400">{comparativeData.peer_comparison?.k_size ?? '—'} peers</span>
                    </div>
                    <div className="flex items-end gap-3 mb-2">
                      <span className="text-4xl font-black" style={{ color: BRAND }}>
                        {comparativeData.percentile_rank.percentile}
                      </span>
                      <span className="text-sm text-gray-500 mb-1">{comparativeData.percentile_rank.label}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${comparativeData.percentile_rank.percentile}%`, background: BRAND }} />
                    </div>
                  </div>
                )}
                {comparativeData?.peer_comparison && !comparativeData.peer_comparison.suppressed && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-900 mb-3">Vs. Cohort Average</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: BRAND }}>
                          {comparativeData.peer_comparison.user_ei_score?.toFixed(1) ?? '—'}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Your Score</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${
                          (comparativeData.peer_comparison.difference_from_avg ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {(comparativeData.peer_comparison.difference_from_avg ?? 0) >= 0 ? '+' : ''}
                          {comparativeData.peer_comparison.difference_from_avg?.toFixed(1) ?? '—'}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">vs. Average</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-600">
                          {comparativeData.peer_comparison.cohort_avg_score?.toFixed(1) ?? '—'}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Cohort Avg.</div>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                        comparativeData.peer_comparison.relative_position === 'above_average' ? 'bg-green-100 text-green-700' :
                        comparativeData.peer_comparison.relative_position === 'below_average' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {(comparativeData.peer_comparison.relative_position ?? 'average').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )}
                {(comparativeData?.cohort_benchmarks ?? []).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-900 mb-3">Cohort Benchmarks</p>
                    <div className="space-y-2">
                      {comparativeData.cohort_benchmarks.map((bm: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                          <span className="capitalize">{(bm.metric ?? '').replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold" style={{ color: BRAND }}>{bm.user_value?.toFixed(1) ?? '—'}</span>
                            <span className="text-gray-400">avg: {bm.cohort_avg?.toFixed(1) ?? '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      )}

      {/* ── Share Report ─────────────────────────────────────────────────── */}
      {activeTab === 'share' && (() => {
        const AUDIENCE_CONFIG: Record<string, { label: string; desc: string; icon: React.ReactNode; color: string; bg: string }> = {
          learner:   { label: 'For You',            desc: 'Your personal learning portrait — for self-reflection and growth.',             icon: <BookMarked size={18} />,   color: '#344E86', bg: '#EEF2FF' },
          parent:    { label: 'For Your Parents',   desc: 'A clear family-facing view of your learning journey.',                         icon: <Heart size={18} />,        color: '#EC4899', bg: '#FDF2F8' },
          counselor: { label: 'For Your Counselor', desc: 'Clinical-grade behavioural insights for professional guidance conversations.',  icon: <GraduationCap size={18} />, color: '#8B5CF6', bg: '#F5F3FF' },
          employer:  { label: 'For a Recruiter',    desc: 'Workplace-relevant behavioural intelligence for professional evaluation.',      icon: <Briefcase size={18} />,    color: '#F59E0B', bg: '#FFFBEB' },
        };
        const aud = AUDIENCE_CONFIG[stakeholderType];
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Choose Your Audience</h3>
              <p className="text-xs text-gray-500 mb-4">Each report is written for its specific reader — same data, different language and focus.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(AUDIENCE_CONFIG) as Array<'learner'|'parent'|'counselor'|'employer'>).map(key => {
                  const cfg = AUDIENCE_CONFIG[key];
                  const sel = stakeholderType === key;
                  return (
                    <button key={key} onClick={() => setStakeholderType(key)}
                      className={`text-left p-4 rounded-2xl border-2 transition-all ${sel ? 'shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
                      style={sel ? { borderColor: cfg.color, background: cfg.bg } : {}}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                        style={{ backgroundColor: sel ? cfg.color : '#E5E7EB' }}>
                        <span style={{ color: sel ? '#fff' : '#9CA3AF' }}>{cfg.icon}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 leading-snug">{cfg.label}</p>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {stakeholderLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" /> Composing {aud?.label?.toLowerCase()} report…
              </div>
            ) : !stakeholderData ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Share2 size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No report available yet.</p>
                <p className="text-xs text-gray-400 mt-1">Complete a CAPADEX session to generate shareable behavioural reports.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl p-5 text-white relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${aud?.color ?? BRAND}, ${(aud?.color ?? BRAND)}AA)` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      {aud?.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{aud?.label}</p>
                      <p className="text-[10px] opacity-75">Learning Behaviour Intelligence Report</p>
                    </div>
                    {stakeholderData.generated_at && (
                      <span className="ml-auto text-[10px] opacity-60">
                        {new Date(stakeholderData.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {stakeholderData.meta?.overall_lbi != null && (
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-3xl font-black">{Math.round(stakeholderData.meta.overall_lbi)}</div>
                        <div className="text-[10px] opacity-70">Overall LBI</div>
                      </div>
                      {stakeholderData.meta?.learning_style && (
                        <div className="bg-white/20 rounded-xl px-3 py-1.5">
                          <div className="text-xs font-semibold capitalize">{stakeholderData.meta.learning_style}</div>
                          <div className="text-[10px] opacity-70">Learning Style</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {(stakeholderData.sections ?? []).map((sec: any, i: number) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
                        style={{ backgroundColor: aud?.color ?? BRAND }}>{i + 1}</span>
                      {sec.title}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{sec.content}</p>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const txt = (stakeholderData.sections ?? []).map((s: any) => `${s.title}\n\n${s.content}`).join('\n\n---\n\n');
                    navigator.clipboard?.writeText(txt).catch(() => null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-sm font-medium transition-all hover:bg-gray-50"
                  style={{ borderColor: `${aud?.color ?? BRAND}50`, color: aud?.color ?? BRAND }}>
                  <Share2 size={14} /> Copy full report to clipboard
                </button>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
