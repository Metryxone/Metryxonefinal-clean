import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
/**
 * EI Intelligence Panel — Report Intelligence v2
 *
 * Consumes GET /api/ei/intelligence (7 shared-engine layers):
 *   Forecast     — WCL2 horizon projections (30/60/90 day)
 *   Outcomes     — WCL3 risk + growth + outcome derivation
 *   Comparative  — peer position + percentile + cohort benchmarks
 *   Trajectory   — EI score trend + projected score
 *   Interventions — top-5 causal recommendations
 *
 * Auth-scoped (no userId param — uses session cookie).
 * Every tab gracefully degrades when data is absent.
 */
import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, BarChart2, Target,
  Zap, Users, Navigation, ArrowUpRight, Activity,
  ChevronRight, AlertCircle, CheckCircle2, Lightbulb, FileText,
} from 'lucide-react';



// ── Types ─────────────────────────────────────────────────────────────────────

interface EIForecast {
  enabled: boolean;
  sessions_per_30d: number;
  forecasts: Array<{
    pattern_key: string; label: string; polarity: string;
    current_value: number; slope_per_session: number;
    d30: { projected: number; direction: string; label: string };
    d60: { projected: number; direction: string; label: string };
    d90: { projected: number; direction: string; label: string };
    confidence_band: string;
  }>;
  note?: string | null;
}

interface EIOutcomes {
  risk?: { level: string; trajectory: string; d30_label: string; d60_label: string; d90_label: string; confidence: number; explainability: string };
  growth?: { trajectory: string; d30_label: string; d60_label: string; d90_label: string; confidence: number; explainability: string };
  outcome?: { likely_outcome: string; d30_label: string; d60_label: string; d90_label: string; confidence: number; explainability: string };
}

interface EIComparative {
  peer_comparison: { user_ei_score: number | null; cohort_avg_score: number | null; relative_position: string; cohort_size: number; suppressed: boolean; suppressed_reason?: string };
  percentile_rank: { percentile: number | null; label: string; cohort_size: number; suppressed: boolean };
  cohort_benchmarks: Array<{ dimension: string; cohort_size: number; avg_score: number | null; suppressed: boolean }>;
  occupation_benchmark: { occupation_title: string; avg_ei_score: number | null; cohort_size: number; suppressed: boolean } | null;
  readiness_benchmark: { pct_cohort_ready: number | null; pct_cohort_near_ready: number | null; user_readiness_band: string | null; cohort_size: number; suppressed: boolean } | null;
}

interface EIBreakdown {
  technicalScore:    number;
  softScore:         number;
  experienceScore:   number;
  certScore:         number;
  projectScore:      number;
  completenessScore: number;
}

interface EITrajectory {
  enabled: boolean;
  current_score?: number;
  current_band?: string;
  direction?: string;
  slope_per_snapshot?: number;
  projected?: { d30: number; d60: number; d90: number };
  confidence?: string;
  snapshots_used?: number;
  reason?: string;
  breakdown?: EIBreakdown | null;
}

interface EIIntervention {
  id: string; title: string; description?: string;
  action_type: string; causal_score: number;
  expected_ei_lift?: { low: number; high: number };
  effort_hours?: number | null;
  competency_name?: string | null;
  is_ready_now?: boolean;
}

interface EIReportSection {
  id: string; title: string; type: string; content: string; data?: unknown;
}

interface EIReport {
  title: string;
  generated_at: string;
  sections: EIReportSection[];
  meta: {
    snapshot_count: number;
    trajectory_enabled: boolean;
    peer_benchmarked: boolean;
    career_context: boolean;
    computation_ms?: number;
  };
}

interface EIIntelligenceData {
  ok: boolean;
  forecast?: EIForecast;
  outcomes?: EIOutcomes | null;
  comparative?: EIComparative | null;
  trajectory?: EITrajectory;
  interventions?: EIIntervention[];
  meta?: {
    has_forecast: boolean; has_outcomes: boolean; has_comparative: boolean;
    has_trajectory: boolean; has_interventions: boolean; has_report: boolean;
    snapshot_count: number; generated_at: string;
  };
}

type EITab = 'forecast' | 'outcomes' | 'comparative' | 'trajectory' | 'interventions' | 'report';

// ── Micro-components ──────────────────────────────────────────────────────────

function Empty({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'rgba(11,60,93,0.06)' }}>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function Pill({ label, color = BRAND.primary, bg }: { label: string; color?: string; bg?: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background: bg ?? `${color}15` }}>
      {label}
    </span>
  );
}

function Bar({ value, max = 100, color = BRAND.primary }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full" style={{ background: '#F1F5F9' }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function DirectionIcon({ dir }: { dir?: string }) {
  if (dir === 'improving' || dir === 'accelerating' || dir === 'growing')
    return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (dir === 'declining' || dir === 'at_risk')
    return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

function HorizonGrid({ d30, d60, d90 }: { d30: string; d60: string; d90: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {[{ label: '30 days', val: d30 }, { label: '60 days', val: d60 }, { label: '90 days', val: d90 }].map(h => (
        <div key={h.label} className="rounded-lg p-2 text-center border border-gray-100" style={{ background: '#F8FAFC' }}>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{h.label}</p>
          <p className="text-xs font-semibold text-gray-800">{h.val}</p>
        </div>
      ))}
    </div>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

function ForecastTab({ data }: { data?: EIForecast }) {
  if (!data?.enabled || !data.forecasts?.length) {
    return (
      <Empty icon={TrendingUp} label="No forecast data yet"
        sub="Forecast activates after completing multiple behavioural assessments." />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-400 mb-1">
        Based on {data.sessions_per_30d.toFixed(1)} sessions / 30 days
      </p>
      {data.forecasts.slice(0, 5).map(f => (
        <div key={f.pattern_key} className="rounded-xl border border-gray-100 p-3"
          style={{ background: '#F8FAFC' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-800">{f.label}</span>
            <div className="flex items-center gap-1">
              <DirectionIcon dir={f.d30.direction} />
              <Pill label={f.confidence_band} />
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mb-1.5">
            Current: {f.current_value.toFixed(1)} · Slope: {f.slope_per_session >= 0 ? '+' : ''}{f.slope_per_session.toFixed(2)}/session
          </div>
          <HorizonGrid d30={f.d30.label} d60={f.d60.label} d90={f.d90.label} />
        </div>
      ))}
    </div>
  );
}

function OutcomesTab({ data }: { data?: EIOutcomes | null }) {
  if (!data) {
    return (
      <Empty icon={Target} label="Outcome projections unavailable"
        sub="Requires forecast data from multiple completed sessions." />
    );
  }
  const sections = [
    { key: 'risk',    label: 'Risk Projection',    item: data.risk,    color: '#EF4444' },
    { key: 'growth',  label: 'Growth Projection',  item: data.growth,  color: '#10B981' },
    { key: 'outcome', label: 'Likely Outcome',      item: data.outcome, color: BRAND.primary },
  ] as const;

  return (
    <div className="space-y-3">
      {sections.map(s => !s.item ? null : (
        <div key={s.key} className="rounded-xl border border-gray-100 p-3" style={{ background: '#F8FAFC' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
            <Pill label={`${Math.round((s.item.confidence ?? 0) * 100)}% confidence`} color={s.color} />
          </div>
          {'level' in s.item && <p className="text-xs text-gray-600 mb-1">Level: {(s.item as any).level}</p>}
          {'trajectory' in s.item && <p className="text-xs text-gray-600 mb-1 capitalize">{(s.item as any).trajectory}</p>}
          {'likely_outcome' in s.item && <p className="text-xs font-medium text-gray-800 mb-1">{(s.item as any).likely_outcome}</p>}
          <HorizonGrid d30={s.item.d30_label} d60={s.item.d60_label} d90={s.item.d90_label} />
          {s.item.explainability && (
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">{s.item.explainability}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ComparativeTab({ data }: { data?: EIComparative | null }) {
  if (!data) {
    return <Empty icon={Users} label="Comparative data unavailable" sub="Requires snapshot history." />;
  }
  const { peer_comparison: pc, percentile_rank: pr, readiness_benchmark: rb } = data;

  return (
    <div className="space-y-4">
      {/* Peer Position */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Your Position</p>
        {pc.suppressed ? (
          <p className="text-xs text-gray-400 italic">{pc.suppressed_reason ?? 'Cohort too small (k-anonymity enforced)'}</p>
        ) : (
          <div className="rounded-xl border border-gray-100 p-3 space-y-2" style={{ background: '#F8FAFC' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Your EI Score</span>
              <span className="text-sm font-bold" style={{ color: BRAND.primary }}>{pc.user_ei_score?.toFixed(1) ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Cohort Average</span>
              <span className="text-sm font-semibold text-gray-700">{pc.cohort_avg_score?.toFixed(1) ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Position</span>
              <Pill label={pc.relative_position.replace(/_/g, ' ')}
                color={pc.relative_position === 'above_average' ? '#10B981' : pc.relative_position === 'below_average' ? '#EF4444' : '#6B7280'} />
            </div>
            <p className="text-[10px] text-gray-400">Based on {pc.cohort_size} users</p>
          </div>
        )}
      </div>

      {/* Percentile */}
      {!pr.suppressed && pr.percentile !== null && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Percentile</p>
          <div className="rounded-xl border border-gray-100 p-3" style={{ background: '#F8FAFC' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold" style={{ color: BRAND.primary }}>{pr.percentile}th</span>
              <Pill label={pr.label} color={BRAND.accent} />
            </div>
            <Bar value={pr.percentile} color={BRAND.primary} />
          </div>
        </div>
      )}

      {/* Readiness Benchmark */}
      {rb && !rb.suppressed && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Readiness vs Cohort</p>
          <div className="rounded-xl border border-gray-100 p-3 space-y-2" style={{ background: '#F8FAFC' }}>
            {rb.pct_cohort_ready !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Cohort Ready %</span>
                <span className="text-sm font-semibold text-green-600">{rb.pct_cohort_ready}%</span>
              </div>
            )}
            {rb.pct_cohort_near_ready !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Near-Ready %</span>
                <span className="text-sm font-semibold text-blue-600">{rb.pct_cohort_near_ready}%</span>
              </div>
            )}
            {rb.user_readiness_band && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Your Band</span>
                <Pill label={rb.user_readiness_band} />
              </div>
            )}
            <p className="text-[10px] text-gray-400">Based on {rb.cohort_size} users</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TrajectoryTab({ data }: { data?: EITrajectory }) {
  if (!data?.enabled) {
    return (
      <Empty icon={Navigation} label="Trajectory data building"
        sub={data?.reason === 'no_snapshots'
          ? 'Complete your first EI resolve to begin tracking trajectory.'
          : `${data?.snapshots ?? 1} snapshot recorded. Trajectory activates after 2 or more.`}
      />
    );
  }
  const { current_score, current_band, direction, slope_per_snapshot, projected, confidence, snapshots_used } = data;
  const dirColor = direction === 'improving' ? '#10B981' : direction === 'declining' ? '#EF4444' : '#6B7280';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 p-4" style={{ background: '#F8FAFC' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Current EI Score</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-3xl font-bold" style={{ color: BRAND.primary }}>{current_score}</span>
              {current_band && <Pill label={current_band} />}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <DirectionIcon dir={direction} />
              <span className="text-sm font-semibold capitalize" style={{ color: dirColor }}>{direction}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {(slope_per_snapshot ?? 0) >= 0 ? '+' : ''}{slope_per_snapshot?.toFixed(2)} / snapshot
            </p>
          </div>
        </div>
        <Bar value={current_score ?? 0} color={BRAND.primary} />
      </div>

      {projected && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Projected Score</p>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: '30 days', val: projected.d30 }, { label: '60 days', val: projected.d60 }, { label: '90 days', val: projected.d90 }].map(p => {
              const diff = p.val - (current_score ?? 0);
              return (
                <div key={p.label} className="rounded-lg border border-gray-100 p-2.5 text-center" style={{ background: '#F8FAFC' }}>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide">{p.label}</p>
                  <p className="text-lg font-bold my-0.5" style={{ color: BRAND.primary }}>{p.val}</p>
                  <p className={`text-[10px] font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {diff >= 0 ? '+' : ''}{diff}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.breakdown && (() => {
        const BD = [
          { key: 'technicalScore',    label: 'Technical',     color: '#3B82F6' },
          { key: 'experienceScore',   label: 'Experience',    color: '#10B981' },
          { key: 'softScore',         label: 'Behavioural',   color: '#8B5CF6' },
          { key: 'certScore',         label: 'Certifications', color: '#F59E0B' },
          { key: 'projectScore',      label: 'Projects',      color: '#EC4899' },
          { key: 'completenessScore', label: 'Profile Depth', color: '#6B7280' },
        ] as const;
        return (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2.5">Score Breakdown</p>
            <div className="space-y-2">
              {BD.map(({ key, label, color }) => {
                const val = (data.breakdown as any)?.[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 shrink-0" style={{ width: 90 }}>{label}</span>
                    <div className="flex-1"><Bar value={val} color={color} /></div>
                    <span className="text-[10px] font-semibold w-7 text-right" style={{ color }}>{Math.round(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <p className="text-[10px] text-gray-400 text-center">
        Based on {snapshots_used} snapshots · Confidence: {confidence}
      </p>
    </div>
  );
}

function InterventionsTab({ data }: { data?: EIIntervention[] }) {
  if (!data?.length) {
    return (
      <Empty icon={Zap} label="No interventions yet"
        sub="Interventions activate after your competency profile is built." />
    );
  }
  return (
    <div className="space-y-2.5">
      {data.map((rec, i) => (
        <div key={rec.id ?? i} className="rounded-xl border border-gray-100 p-3" style={{ background: '#F8FAFC' }}>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `${BRAND.accent}20` }}>
              <Lightbulb className="w-3 h-3" style={{ color: BRAND.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-semibold text-gray-800 leading-tight">{rec.title}</span>
                <Pill label={rec.action_type.replace(/_/g, ' ')} />
              </div>
              {rec.description && (
                <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{rec.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {rec.expected_ei_lift && (
                  <span className="text-[10px] text-green-600 font-medium">
                    +{rec.expected_ei_lift.low}–{rec.expected_ei_lift.high} EI pts
                  </span>
                )}
                {rec.effort_hours != null && (
                  <span className="text-[10px] text-gray-400">{rec.effort_hours}h effort</span>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">
                  Score: {(rec.causal_score * 100).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportTab({ data, loading, history = [] }: { data?: EIReport | null; loading: boolean; history?: any[] }) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
      </div>
    );
  }
  if (!data?.sections?.length) {
    return (
      <Empty icon={FileText} label="Report not yet generated"
        sub="Complete assessments and EI measurements to generate your intelligence report." />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-xs font-bold text-gray-700">{data.title}</h4>
        <span className="text-[9px] text-gray-400 ml-auto">
          {new Date(data.generated_at).toLocaleDateString()}
        </span>
      </div>
      {data.sections.map(s => (
        <div key={s.id} className="rounded-xl border border-gray-100 p-3" style={{ background: '#F8FAFC' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: BRAND.primary }}>
            {s.title}
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">{s.content}</p>
        </div>
      ))}
      <p className="text-[9px] text-gray-300 text-center mt-2">
        {data.meta.snapshot_count} snapshot{data.meta.snapshot_count === 1 ? '' : 's'} ·{' '}
        {data.meta.trajectory_enabled ? 'Trajectory active' : 'Trajectory pending'} ·{' '}
        {data.meta.peer_benchmarked ? 'Peer benchmarked' : 'Peer data building'}
      </p>

      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">
            Report History · {history.length} archived
          </p>
          <div className="space-y-1.5">
            {history.map((h: any, i: number) => (
              <div key={h.id ?? i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                <FileText className="w-3 h-3 text-gray-300 shrink-0" />
                <span className="text-[10px] text-gray-500 flex-1">
                  {new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {h.snapshot_count > 0 && ` · ${h.snapshot_count} snapshots`}
                </span>
                <span className="text-[9px] text-gray-300">{h.section_count} sections</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface EIIntelligencePanelProps {
  className?: string;
  userId?: string;
}

const TAB_CONFIG: Array<{
  id: EITab;
  label: string;
  icon: React.ElementType;
  metaKey: keyof NonNullable<EIIntelligenceData['meta']>;
}> = [
  { id: 'forecast',      label: 'Forecast',      icon: TrendingUp, metaKey: 'has_forecast' },
  { id: 'outcomes',      label: 'Outcomes',       icon: Target,     metaKey: 'has_outcomes' },
  { id: 'comparative',   label: 'Peer Position',  icon: Users,      metaKey: 'has_comparative' },
  { id: 'trajectory',    label: 'Trajectory',     icon: Navigation, metaKey: 'has_trajectory' },
  { id: 'interventions', label: 'Interventions',  icon: Zap,        metaKey: 'has_interventions' },
  { id: 'report',        label: 'Report',         icon: FileText,   metaKey: 'has_report' },
];

export function EIIntelligencePanel({ className = '', userId }: EIIntelligencePanelProps) {
  const [tab, setTab] = useState<EITab>('trajectory');
  const [data, setData] = useState<EIIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData]       = useState<EIReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFetched, setReportFetched] = useState(false);
  const [reportHistory, setReportHistory] = useState<any[]>([]);

  const adminSuffix = userId ? `?adminUserId=${encodeURIComponent(userId)}` : '';

  useEffect(() => {
    setData(null); setLoading(true); setReportFetched(false); setReportData(null); setReportHistory([]);
    fetch(`/api/ei/intelligence${adminSuffix}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  // Lazy-fetch report + history when Report tab is first selected
  useEffect(() => {
    if (tab !== 'report' || reportFetched) return;
    setReportLoading(true);
    setReportFetched(true);
    fetch(`/api/ei/intelligence/report-summary${adminSuffix}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setReportData(d?.report ?? null); setReportLoading(false); })
      .catch(() => setReportLoading(false));
    fetch(`/api/ei/intelligence/report-history${adminSuffix}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setReportHistory(d?.history ?? []))
      .catch(() => {});
  }, [tab, reportFetched]);

  const meta = data?.meta;

  return (
    <div className={`rounded-2xl border border-gray-200 overflow-hidden ${className}`}
      style={{ background: '#FFFFFF' }}>

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100"
        style={{ background: 'linear-gradient(135deg, rgba(11,60,93,0.03) 0%, rgba(78,205,196,0.04) 100%)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${BRAND.primary}12` }}>
            <BarChart2 className="w-4 h-4" style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: BRAND.primary }}>
              Employability Intelligence
            </h3>
            <p className="text-[10px] text-gray-400">
              World-class readiness · 8 shared intelligence layers
            </p>
          </div>
          {meta && (
            <div className="ml-auto flex items-center gap-1.5">
              {meta.has_trajectory && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {!meta.has_trajectory && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
              <span className="text-[10px] text-gray-400">{meta.snapshot_count} snapshots</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
        {TAB_CONFIG.map(t => {
          const active = tab === t.id;
          const hasData = meta?.[t.metaKey];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors shrink-0 relative"
              style={{
                color: active ? BRAND.primary : '#94A3B8',
                background: active ? `${BRAND.primary}06` : 'transparent',
                borderBottom: active ? `2px solid ${BRAND.primary}` : '2px solid transparent',
              }}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {hasData && !active && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 absolute top-2 right-2" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4 max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
          </div>
        ) : (
          <>
            {tab === 'forecast'      && <ForecastTab      data={data?.forecast} />}
            {tab === 'outcomes'      && <OutcomesTab      data={data?.outcomes} />}
            {tab === 'comparative'   && <ComparativeTab   data={data?.comparative} />}
            {tab === 'trajectory'    && <TrajectoryTab    data={data?.trajectory} />}
            {tab === 'interventions' && <InterventionsTab data={data?.interventions} />}
            {tab === 'report'        && <ReportTab        data={reportData} loading={reportLoading} history={reportHistory} />}
          </>
        )}
      </div>

      {/* Footer */}
      {meta?.generated_at && (
        <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[9px] text-gray-300">
            EI Intelligence v1 · {new Date(meta.generated_at).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-3 text-[9px] text-gray-300">
            {([
              ['F', meta.has_forecast],
              ['O', meta.has_outcomes],
              ['C', meta.has_comparative],
              ['T', meta.has_trajectory],
              ['I', meta.has_interventions],
              ['R', meta.has_report],
            ] as [string, boolean][]).map(([k, v]) => (
              <span key={k} style={{ color: v ? '#10B981' : '#D1D5DB' }}>{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
