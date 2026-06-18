import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, Briefcase, GraduationCap, Brain, FolderOpen,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus,
  Clock, Zap, Target, Award, BarChart3, Users, AlertCircle,
  CheckSquare, ExternalLink, RefreshCw, Info, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntelligenceLayers } from '../shared/IntelligenceLayers';
import { EIIntelligencePanel } from '../ei/EIIntelligencePanel';

// ── Types ────────────────────────────────────────────────────────────────────

interface CompetencyScore {
  code: string; name: string;
  raw_score: number; norm_score: number;
  max_raw: number; is_gated: boolean; gate_met: boolean;
  weight: number;
}
interface SubdimScore {
  code: string; name: string;
  score: number; weighted_score: number; within_dim_weight: number;
  competencies: CompetencyScore[];
}
interface DimScore {
  code: string; name: string;
  base_weight: number; cal_weight: number;
  score: number; contribution: number; max_points: number;
  subdimensions: SubdimScore[];
}
interface MEIScore {
  composite_score: number;
  band: 'getting_started' | 'building' | 'career_ready' | 'hire_ready';
  confidence: number;
  industry_code: string | null;
  role_level_code: string | null;
  dimensions: DimScore[];
  calibration_trace: { raw_weights: Record<string,number>; cal_weights: Record<string,number>; sum_check: number };
  data_sources: string[];
  version: string;
  computed_at?: string;
}
interface BenchmarkResult {
  cohort_key: string;
  sample_size: number;
  percentile_rank: number | null;
  gap_to_median: number | null;
  gap_to_p75: number | null;
  p25: number | null; p50: number | null; p75: number | null; p90: number | null;
  dimension_gaps: Array<{ dimension_code: string; user_score: number; cohort_p50: number; gap: number }>;
  suppressed: boolean;
  suppression_reason?: string;
}
interface NarrativeOutput {
  band_narrative: string;
  strength_narratives: Array<{ dimension_code: string; dimension_name: string; text: string }>;
  gap_narratives: Array<{ dimension_code: string; dimension_name: string; text: string }>;
  composite_insights: string[];
  action_directive: string;
  audience: string;
}
interface Recommendation {
  id: number; code: string; title: string; description: string;
  action_type: string; dimension_code: string | null;
  estimated_point_gain: number | null; effort_level: string;
  time_to_complete: string | null; link_path: string | null;
  priority_score: number; point_impact: number; is_actioned: boolean;
}
interface ForecastData {
  insufficient_data: boolean;
  data_points: number;
  slope: number | null;
  trend: 'improving' | 'stable' | 'declining';
  historical: Array<{ score: number; computed_at: string }>;
  projected: Array<{ session_offset: number; label: string; score: number }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_COLORS: Record<string, { bg: string; bar: string; text: string; icon: React.ReactNode }> = {
  validated_proficiency:   { bg:'bg-indigo-50', bar:'bg-indigo-500', text:'text-indigo-700', icon:<CheckCircle className="h-4 w-4 text-indigo-500"/> },
  professional_experience: { bg:'bg-sky-50',    bar:'bg-sky-500',    text:'text-sky-700',    icon:<Briefcase className="h-4 w-4 text-sky-500"/> },
  knowledge_foundation:    { bg:'bg-emerald-50',bar:'bg-emerald-500',text:'text-emerald-700',icon:<GraduationCap className="h-4 w-4 text-emerald-500"/> },
  behavioural_intelligence:{ bg:'bg-amber-50',  bar:'bg-amber-500',  text:'text-amber-700',  icon:<Brain className="h-4 w-4 text-amber-500"/> },
  portfolio_signal:        { bg:'bg-violet-50', bar:'bg-violet-500', text:'text-violet-700', icon:<FolderOpen className="h-4 w-4 text-violet-500"/> },
};

const BAND_CONFIG = {
  hire_ready:    { label:'Hire-Ready',    bg:'bg-green-100',  text:'text-green-800',  border:'border-green-300',  ring:'bg-green-500' },
  career_ready:  { label:'Career-Ready',  bg:'bg-blue-100',   text:'text-blue-800',   border:'border-blue-300',   ring:'bg-blue-500'  },
  building:      { label:'Building',      bg:'bg-yellow-100', text:'text-yellow-800', border:'border-yellow-300', ring:'bg-yellow-500'},
  getting_started:{ label:'Getting Started',bg:'bg-gray-100', text:'text-gray-700',   border:'border-gray-300',   ring:'bg-gray-400'  },
};

const EFFORT_CONFIG: Record<string,{ label:string; bg:string; text:string }> = {
  low:    { label:'Low effort',    bg:'bg-green-100',  text:'text-green-700'  },
  medium: { label:'Med effort',    bg:'bg-yellow-100', text:'text-yellow-700' },
  high:   { label:'High effort',   bg:'bg-red-100',    text:'text-red-700'    },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreGauge({ score, band }: { score: number; band: MEIScore['band'] }) {
  const cfg = BAND_CONFIG[band];
  const pct = Math.min(score / 99, 1);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const dash = circ * pct;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10"/>
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={band === 'hire_ready' ? '#22c55e' : band === 'career_ready' ? '#3b82f6' : band === 'building' ? '#eab308' : '#9ca3af'}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-500">/ 99</span>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {cfg.label}
      </span>
    </div>
  );
}

function DimensionBar({ dim, expandedSd, onToggleSd }: {
  dim: DimScore;
  expandedSd: string | null;
  onToggleSd: (code: string) => void;
}) {
  const cfg = DIM_COLORS[dim.code] ?? DIM_COLORS.portfolio_signal;
  const pct = Math.round(dim.score * 100);
  const pts = Math.round(dim.contribution * 10) / 10;
  const maxPts = Math.round(dim.max_points);
  const isExpanded = expandedSd === dim.code;

  return (
    <div className={`rounded-lg border border-gray-100 overflow-hidden`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => onToggleSd(dim.code)}
      >
        {cfg.icon}
        <span className="flex-1 text-sm font-medium text-gray-800 text-left">{dim.name}</span>
        <span className={`text-xs font-semibold ${cfg.text}`}>{pct}%</span>
        <span className="text-xs text-gray-500 w-20 text-right">{pts} / {maxPts} pts</span>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400"/> : <ChevronRight className="h-4 w-4 text-gray-400"/>}
      </button>
      <div className="px-4 pb-2">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${cfg.bar} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-gray-50 pt-2">
          {dim.subdimensions.map(sd => {
            const sdPct = Math.round(sd.score * 100);
            return (
              <div key={sd.code} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-40 truncate flex-shrink-0">{sd.name}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${cfg.bar} opacity-60 rounded-full`} style={{ width:`${sdPct}%` }}/>
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{sdPct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec, onAction }: { rec: Recommendation; onAction: (id:number) => void }) {
  const effort = EFFORT_CONFIG[rec.effort_level] ?? EFFORT_CONFIG.medium;
  return (
    <div className={`rounded-lg border p-4 transition-opacity ${rec.is_actioned ? 'opacity-50 bg-gray-50 border-gray-100' : 'bg-white border-gray-200 hover:border-blue-200'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onAction(rec.id)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 transition-colors ${rec.is_actioned ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-blue-400'}`}
        >
          {rec.is_actioned && <CheckCircle className="w-4 h-4 text-white"/>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900">{rec.title}</span>
            {rec.estimated_point_gain && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                +{rec.point_impact > 0 ? rec.point_impact.toFixed(1) : rec.estimated_point_gain} pts
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{rec.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${effort.bg} ${effort.text}`}>
              {effort.label}
            </span>
            {rec.time_to_complete && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3"/>{rec.time_to_complete}
              </span>
            )}
            {rec.link_path && !rec.is_actioned && (
              <a
                href={rec.link_path}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 ml-auto"
              >
                Go <ExternalLink className="h-3 w-3"/>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BenchmarkPanel({ bm, dims }: { bm: BenchmarkResult; dims: DimScore[] }) {
  if (bm.suppressed) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
        <Users className="h-8 w-8 text-gray-300 mx-auto mb-2"/>
        <p className="text-sm text-gray-500">
          {bm.suppression_reason === 'no_cohort_data'
            ? 'No cohort data available for your profile yet.'
            : `Not enough similar profiles yet (${bm.suppression_reason?.replace('cohort_too_small(', '').replace(')', '')}). Check back as more profiles are scored.`}
        </p>
      </div>
    );
  }

  const [industry, role, yoe] = bm.cohort_key.split(':');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900">
            {bm.percentile_rank !== null ? `Top ${100 - bm.percentile_rank}%` : '—'}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {[industry !== 'any' ? industry : '', role !== 'any' ? role : '', yoe !== 'any' ? `${yoe}yr YoE` : '']
              .filter(Boolean).join(' · ') || 'Global cohort'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Based on</p>
          <p className="text-sm font-semibold text-gray-700">{bm.sample_size} profiles</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {bm.gap_to_median !== null && (
          <div className={`rounded-lg p-3 ${bm.gap_to_median >= 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
            <div className="flex items-center gap-1 mb-1">
              {bm.gap_to_median >= 0
                ? <TrendingUp className="h-4 w-4 text-green-600"/>
                : <TrendingDown className="h-4 w-4 text-amber-600"/>}
              <span className="text-xs text-gray-600">vs. median</span>
            </div>
            <p className={`text-lg font-bold ${bm.gap_to_median >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
              {bm.gap_to_median >= 0 ? '+' : ''}{bm.gap_to_median?.toFixed(1)}
            </p>
          </div>
        )}
        {bm.gap_to_p75 !== null && (
          <div className={`rounded-lg p-3 ${bm.gap_to_p75 >= 0 ? 'bg-green-50' : 'bg-blue-50'}`}>
            <div className="flex items-center gap-1 mb-1">
              {bm.gap_to_p75 >= 0
                ? <TrendingUp className="h-4 w-4 text-green-600"/>
                : <Minus className="h-4 w-4 text-blue-600"/>}
              <span className="text-xs text-gray-600">vs. top 25%</span>
            </div>
            <p className={`text-lg font-bold ${bm.gap_to_p75 >= 0 ? 'text-green-700' : 'text-blue-700'}`}>
              {bm.gap_to_p75 >= 0 ? '+' : ''}{bm.gap_to_p75?.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      {bm.dimension_gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Dimension gaps vs. cohort median</p>
          <div className="space-y-2">
            {bm.dimension_gaps.map(dg => {
              const cfg = DIM_COLORS[dg.dimension_code];
              const dimObj = dims.find(d => d.code === dg.dimension_code);
              return (
                <div key={dg.dimension_code} className="flex items-center gap-2">
                  {cfg?.icon}
                  <span className="text-xs text-gray-600 w-36 truncate flex-shrink-0">{dimObj?.name ?? dg.dimension_code}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dg.gap >= 0 ? 'bg-green-400' : 'bg-amber-400'}`}
                      style={{ width:`${Math.min(Math.abs(dg.gap), 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-12 text-right ${dg.gap >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {dg.gap >= 0 ? '+' : ''}{dg.gap}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MEIDashboardProps {
  userId: string;
  className?: string;
}

export default function MEIDashboard({ userId, className = '' }: MEIDashboardProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview'|'dimensions'|'recommendations'|'benchmark'|'history'>('overview');
  const [expandedSd, setExpandedSd] = useState<string | null>(null);
  const [showAllRecs, setShowAllRecs] = useState(false);

  const { data: scoreData, isLoading: scoreLoading, error: scoreError } = useQuery<{ ok:boolean; score:MEIScore; cached:boolean }>({
    queryKey: ['mei-score', userId],
    queryFn: () => fetch(`/api/mei/score/${userId}`).then(r => r.json()),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: benchmarkData, isLoading: bmLoading } = useQuery<{ ok:boolean; benchmark:BenchmarkResult }>({
    queryKey: ['mei-benchmark', userId],
    queryFn: () => fetch(`/api/mei/benchmark/${userId}`).then(r => r.json()),
    enabled: !!userId && activeTab === 'benchmark',
  });

  const { data: narrativeData } = useQuery<{ ok:boolean; narrative:NarrativeOutput }>({
    queryKey: ['mei-narrative', userId],
    queryFn: () => fetch(`/api/mei/narrative/${userId}?audience=candidate`).then(r => r.json()),
    enabled: !!userId && activeTab === 'overview',
  });

  const { data: recsData, isLoading: recsLoading } = useQuery<{ ok:boolean; recommendations:Recommendation[] }>({
    queryKey: ['mei-recs', userId],
    queryFn: () => fetch(`/api/mei/recommendations/${userId}`).then(r => r.json()),
    enabled: !!userId,
  });

  const actionRec = useMutation({
    mutationFn: (recId: number) =>
      fetch(`/api/mei/recommendations/${userId}/${recId}/action`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mei-recs', userId] }),
  });

  const { data: forecastData, isLoading: forecastLoading } = useQuery<{ ok: boolean; forecast: ForecastData }>({
    queryKey: ['mei-forecast', userId],
    queryFn: () => fetch(`/api/mei/forecast/${userId}`).then(r => r.json()),
    enabled: !!userId && activeTab === 'history',
    staleTime: 10 * 60 * 1000,
  });

  const score = scoreData?.score;
  const narrative = narrativeData?.narrative;
  const benchmark = benchmarkData?.benchmark;
  const recs = recsData?.recommendations ?? [];
  const unactionedRecs = recs.filter(r => !r.is_actioned);
  const actionedRecs   = recs.filter(r => r.is_actioned);
  const displayRecs    = showAllRecs ? recs : unactionedRecs.slice(0, 6);

  const toggleSd = (code: string) => setExpandedSd(prev => prev === code ? null : code);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (scoreLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1,2,3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"/>
        ))}
      </div>
    );
  }

  // ── Error / no profile ─────────────────────────────────────────────────────
  if (scoreError || !score) {
    return (
      <div className={`rounded-xl border border-dashed border-gray-200 p-8 text-center ${className}`}>
        <Target className="h-10 w-10 text-gray-300 mx-auto mb-3"/>
        <h3 className="text-base font-semibold text-gray-700 mb-1">Your Employability Index</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
          Complete your Career Builder profile to calculate your MEI score. Add your experience, skills, and education to get started.
        </p>
        <a href="/career-builder?tab=profile">
          <Button variant="outline" size="sm">Complete Profile</Button>
        </a>
      </div>
    );
  }

  const band = BAND_CONFIG[score.band];
  const confidencePct = Math.round(score.confidence * 100);

  return (
    <div className={`space-y-4 ${className}`}>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreGauge score={score.composite_score} band={score.band}/>

          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Employability Index</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {score.industry_code && score.role_level_code
                  ? `Calibrated for ${score.industry_code} · ${score.role_level_code}`
                  : 'Uncalibrated — add industry & role for a tailored score'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                confidencePct >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                confidencePct >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                <Info className="h-3 w-3"/>
                {confidencePct}% data coverage
              </div>
              {score.computed_at && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3"/>
                  Updated {new Date(score.computed_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {confidencePct < 60 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"/>
                Score based on limited data — add more profile signal for a fuller picture.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { id:'overview',        label:'Overview',       icon:<Zap className="h-3.5 w-3.5"/> },
          { id:'dimensions',      label:'Dimensions',     icon:<BarChart3 className="h-3.5 w-3.5"/> },
          { id:'recommendations', label:'Actions',        icon:<Target className="h-3.5 w-3.5"/> },
          { id:'benchmark',       label:'Benchmark',      icon:<Users className="h-3.5 w-3.5"/> },
          { id:'history',         label:'History',        icon:<History className="h-3.5 w-3.5"/> },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ───────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick dimension summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Dimension Summary</h3>
            <div className="space-y-2">
              {score.dimensions.map(dim => {
                const cfg = DIM_COLORS[dim.code] ?? DIM_COLORS.portfolio_signal;
                const pct = Math.round(dim.score * 100);
                const pts = Math.round(dim.contribution * 10) / 10;
                return (
                  <div key={dim.code} className="flex items-center gap-3">
                    {cfg.icon}
                    <span className="text-xs text-gray-600 w-44 truncate flex-shrink-0">{dim.name}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width:`${pct}%` }}/>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-16 text-right">{pts} / {Math.round(dim.max_points)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Narrative */}
          {narrative && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Your Profile Story</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{narrative.band_narrative}</p>

              {narrative.strength_narratives.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Strengths</p>
                  {narrative.strength_narratives.map(s => (
                    <div key={s.dimension_code} className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                      <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5"/>
                      <p className="text-xs text-green-800">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {narrative.gap_narratives.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opportunities</p>
                  {narrative.gap_narratives.map(g => (
                    <div key={g.dimension_code} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <TrendingDown className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5"/>
                      <p className="text-xs text-amber-800">{g.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {narrative.composite_insights.length > 0 && (
                <div className="space-y-1.5">
                  {narrative.composite_insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5"/>
                      <p className="text-xs text-blue-800">{insight}</p>
                    </div>
                  ))}
                </div>
              )}

              {narrative.action_directive && (
                <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                  <Award className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-indigo-800 font-medium">{narrative.action_directive}</p>
                </div>
              )}
            </div>
          )}

          {/* Top recommendation */}
          {unactionedRecs.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Action</h3>
              <RecommendationCard rec={unactionedRecs[0]} onAction={id => actionRec.mutate(id)}/>
            </div>
          )}
        </div>
      )}

      {/* ── Dimensions tab ─────────────────────────────────────────────────── */}
      {activeTab === 'dimensions' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-800">Dimension Breakdown</h3>
            <span className="text-xs text-gray-400">Click to drill down</span>
          </div>
          {score.dimensions.map(dim => (
            <DimensionBar key={dim.code} dim={dim} expandedSd={expandedSd} onToggleSd={toggleSd}/>
          ))}
          {(score.industry_code || score.role_level_code) && (
            <p className="text-xs text-gray-400 pt-1 flex items-center gap-1">
              <Info className="h-3 w-3"/>
              Weights calibrated for {[score.industry_code, score.role_level_code].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* ── Recommendations tab ─────────────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Action Plan</h3>
            <span className="text-xs text-gray-400">{unactionedRecs.length} remaining</span>
          </div>

          {recsLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"/>)}
            </div>
          )}

          {!recsLoading && recs.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50"/>
              <p className="text-sm">No recommendations yet — complete your profile first.</p>
            </div>
          )}

          <div className="space-y-2">
            {displayRecs.map(rec => (
              <RecommendationCard key={rec.id} rec={rec} onAction={id => actionRec.mutate(id)}/>
            ))}
          </div>

          {!showAllRecs && (unactionedRecs.length > 6 || actionedRecs.length > 0) && (
            <button
              onClick={() => setShowAllRecs(true)}
              className="w-full text-xs text-blue-600 hover:text-blue-700 py-2 border border-dashed border-blue-200 rounded-lg"
            >
              Show all {recs.length} recommendations ({actionedRecs.length} completed)
            </button>
          )}
        </div>
      )}

      {/* ── Benchmark tab ──────────────────────────────────────────────────── */}
      {activeTab === 'benchmark' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Cohort Benchmark</h3>
            <span className="text-xs text-gray-400">k-anonymity ≥ 10 profiles</span>
          </div>
          {bmLoading
            ? <div className="h-32 bg-gray-100 rounded-lg animate-pulse"/>
            : benchmark
              ? <BenchmarkPanel bm={benchmark} dims={score.dimensions}/>
              : <div className="text-center py-6 text-gray-400 text-sm">Benchmark data unavailable.</div>
          }
        </div>
      )}

      {/* ── History & Forecast tab ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {forecastLoading && (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse"/>)}
            </div>
          )}

          {!forecastLoading && (() => {
            const fc = forecastData?.forecast;
            if (!fc) return (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <History className="h-8 w-8 text-gray-300 mx-auto mb-2"/>
                <p className="text-sm text-gray-500">History unavailable.</p>
              </div>
            );

            const TREND_CONFIG = {
              improving: { label: 'Improving', icon: <TrendingUp className="h-4 w-4 text-green-600"/>, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
              stable:    { label: 'Stable',    icon: <Minus      className="h-4 w-4 text-blue-600"/>,  color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200'  },
              declining: { label: 'Declining', icon: <TrendingDown className="h-4 w-4 text-amber-600"/>, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            };
            const trendCfg = TREND_CONFIG[fc.trend];

            if (fc.insufficient_data) {
              return (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <History className="h-8 w-8 text-gray-300 mx-auto mb-2"/>
                  <p className="text-sm font-medium text-gray-700 mb-1">Not enough history yet</p>
                  <p className="text-xs text-gray-500">
                    {fc.data_points === 0
                      ? 'No score history found. Complete an assessment to start tracking your EI trajectory.'
                      : 'Need at least 2 assessment sessions to compute a trend. Come back after your next session.'}
                  </p>
                  {fc.data_points === 1 && fc.historical.length === 1 && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                      <Award className="h-4 w-4 text-gray-500"/>
                      <span className="text-sm font-semibold text-gray-800">{fc.historical[0].score}</span>
                      <span className="text-xs text-gray-400">First score recorded</span>
                    </div>
                  )}
                </div>
              );
            }

            const allScores = [...fc.historical.map(h => h.score), ...fc.projected.map(p => p.score)];
            const minS = Math.max(0, Math.min(...allScores) - 5);
            const maxS = Math.min(99, Math.max(...allScores) + 5);
            const range = Math.max(maxS - minS, 1);
            const W = 320; const H = 80;
            const nPoints = fc.historical.length + fc.projected.length;
            const xStep = nPoints > 1 ? W / (nPoints - 1) : W;
            const toY = (s: number) => H - ((s - minS) / range) * H;
            const histPts = fc.historical.map((h, i) => ({ x: i * xStep, y: toY(h.score) }));
            const projPts = fc.projected.map((p, i) => ({ x: (fc.historical.length + i) * xStep, y: toY(p.score) }));
            const histPath = histPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const lastHist = histPts[histPts.length - 1];
            const projPath = projPts.length > 0 ? `M${lastHist.x.toFixed(1)},${lastHist.y.toFixed(1)} ` + projPts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : '';

            return (
              <>
                {/* Trend summary */}
                <div className={`rounded-xl border p-4 ${trendCfg.bg} ${trendCfg.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {trendCfg.icon}
                      <span className={`text-sm font-semibold ${trendCfg.color}`}>{trendCfg.label}</span>
                    </div>
                    {fc.slope !== null && (
                      <span className="text-xs text-gray-500">
                        {fc.slope > 0 ? '+' : ''}{fc.slope} pts/session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    Based on {fc.data_points} assessment{fc.data_points !== 1 ? 's' : ''}
                    {fc.slope !== null && fc.slope > 0 && '. Your score is growing with each assessment.'}
                    {fc.slope !== null && fc.slope < 0 && '. Consider focusing on the Action Plan to improve.'}
                    {fc.slope !== null && fc.slope === 0 && '. Your score has held steady across sessions.'}
                  </p>
                </div>

                {/* Sparkline chart */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Score Trajectory</h3>
                  <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${W} ${H + 4}`} className="w-full max-w-md" style={{ minWidth: 240 }}>
                      {histPath && (
                        <path d={histPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      )}
                      {projPath && (
                        <path d={projPath} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round"/>
                      )}
                      {histPts.map((p, i) => (
                        <circle key={`h${i}`} cx={p.x} cy={p.y} r="3.5" fill="#3b82f6"/>
                      ))}
                      {projPts.map((p, i) => (
                        <circle key={`p${i}`} cx={p.x} cy={p.y} r="3" fill="white" stroke="#9ca3af" strokeWidth="1.5"/>
                      ))}
                    </svg>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 bg-blue-500 rounded"/>
                      <span className="text-xs text-gray-500">Historical</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 bg-gray-400 rounded" style={{ borderTop: '2px dashed #9ca3af', background: 'none' }}/>
                      <span className="text-xs text-gray-500">Projected</span>
                    </div>
                  </div>
                </div>

                {/* Forecast table */}
                {fc.projected.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Score Forecast</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Directional extrapolation based on your trend. Actual scores depend on profile actions taken.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {fc.projected.map(p => {
                        const delta = p.score - fc.historical[fc.historical.length - 1].score;
                        return (
                          <div key={p.session_offset} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                            <p className="text-xs text-gray-500 mb-1">{p.label}</p>
                            <p className="text-xl font-bold text-gray-900">{p.score}</p>
                            <p className={`text-xs font-medium mt-0.5 ${delta >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                              {delta >= 0 ? '+' : ''}{Math.round(delta * 10) / 10}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Score log */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Assessment Log</h3>
                  <div className="space-y-2">
                    {[...fc.historical].reverse().map((h, i) => {
                      const prev = fc.historical[fc.historical.length - 2 - i];
                      const delta = prev ? h.score - prev.score : null;
                      const bandKey = score.band;
                      const bandCfg = BAND_CONFIG[bandKey];
                      return (
                        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-400 w-28 shrink-0">
                            {new Date(h.computed_at).toLocaleDateString()}
                          </span>
                          <span className="text-sm font-bold text-gray-900 w-8">{h.score}</span>
                          {delta !== null && (
                            <span className={`text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                              {delta >= 0 ? '+' : ''}{Math.round(delta * 10) / 10}
                            </span>
                          )}
                          <div className="flex-1"/>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${bandCfg.bg} ${bandCfg.text}`}>
                            {bandCfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="px-4 sm:px-6 pb-6">
        <EIIntelligencePanel className="mb-6" />
        <IntelligenceLayers title="Employability Intelligence Layers" userId={userId} />
      </div>

    </div>
  );
}
