/**
 * IntelligenceLayers — shared 6-tab intelligence panel consumed by all 5 report surfaces.
 *
 * Tabs:
 *   1. Patterns      — behavioral patterns + competency gap patterns + STRENGTHS
 *   2. Trends        — velocity & momentum per competency (with mini sparkbars)
 *   3. Forecast      — trajectory projection ranges
 *   4. Outcomes      — readiness projection + behavioural stage/outcome/journey
 *   5. Interventions — gap-targeted actions grouped by competency, re-ranked by behaviour
 *   6. Next Steps    — WC-7B activation envelope (decision + growth plan + mentor)
 *                      + cross-report development timeline
 *
 * Enhancements (all non-siloed, composing existing APIs):
 *   E1 · Longitudinal timeline built client-side from CIE trends[].points[].
 *   E2 · WC-7B activation surface via GET /api/capadex/session/:id/activation.
 *   E3 · Behavioral → competency re-rank: session patterns signal_codes modulate
 *        gap priority scores before rendering (client-side, no new engine).
 *   E4 · Data completeness transparency: each empty state derives the specific
 *        readiness signal from the already-fetched payload.
 *   E5 · Strengths section in Patterns tab from session.patterns.positive_factors.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Brain, TrendingUp, TrendingDown, Minus, BarChart2, Target, Zap,
  ChevronRight, ArrowUpRight, Clock, AlertTriangle, BookOpen, Briefcase,
  Users, Navigation, Star, CheckCircle2, ChevronDown, ChevronUp,
  Compass, Lightbulb, Activity,
} from 'lucide-react';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4', muted: '#64748B' };

export interface IntelligenceLayersProps {
  sessionId?: string | null;
  userId?: string | null;
  compact?: boolean;
  title?: string;
}

type LayerTab = 'patterns' | 'trends' | 'forecast' | 'outcomes' | 'interventions' | 'next-steps';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Metadata maps                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

const TRAJECTORY_META: Record<string, { color: string; bg: string; label: string }> = {
  accelerating:      { color: '#10B981', bg: '#ECFDF5', label: 'Accelerating' },
  growing:           { color: '#0891B2', bg: '#E0F7FA', label: 'Growing' },
  stable:            { color: '#6B7280', bg: '#F9FAFB', label: 'Stable' },
  plateauing:        { color: '#D97706', bg: '#FFFBEB', label: 'Plateauing' },
  declining:         { color: '#EF4444', bg: '#FEF2F2', label: 'Declining' },
  at_risk:           { color: '#DC2626', bg: '#FEF2F2', label: 'At Risk' },
  insufficient_data: { color: '#9CA3AF', bg: '#F9FAFB', label: 'No Data Yet' },
};

const READINESS_META: Record<string, { color: string; bg: string; label: string }> = {
  role_ready:        { color: '#10B981', bg: '#ECFDF5', label: 'Role Ready' },
  above_target:      { color: '#10B981', bg: '#ECFDF5', label: 'Above Target' },
  near_ready:        { color: '#0891B2', bg: '#E0F7FA', label: 'Near Ready' },
  in_progress:       { color: '#D97706', bg: '#FFFBEB', label: 'In Progress' },
  early_stage:       { color: '#EF4444', bg: '#FEF2F2', label: 'Early Stage' },
  unclassified:      { color: '#9CA3AF', bg: '#F9FAFB', label: 'Unclassified' },
  insufficient_data: { color: '#9CA3AF', bg: '#F9FAFB', label: 'No Data Yet' },
};

const GAP_META: Record<string, { color: string; bg: string }> = {
  critical: { color: '#DC2626', bg: '#FEF2F2' },
  high:     { color: '#D97706', bg: '#FFFBEB' },
  medium:   { color: '#CA8A04', bg: '#FEFCE8' },
  low:      { color: '#0B3C5D', bg: 'rgba(11,60,93,0.06)' },
  strength: { color: '#10B981', bg: '#ECFDF5' },
};

const MEI_BAND_LABEL: Record<string, string> = {
  hire_ready:      'Hire-Ready',
  career_ready:    'Career-Ready',
  building:        'Building',
  getting_started: 'Getting Started',
};

const MEI_BAND_COLOR: Record<string, { bg: string; color: string }> = {
  hire_ready:      { bg: '#ECFDF5', color: '#065F46' },
  career_ready:    { bg: '#EFF6FF', color: '#1E40AF' },
  building:        { bg: '#FFFBEB', color: '#92400E' },
  getting_started: { bg: '#FEF2F2', color: '#991B1B' },
};

// E3 · Behavioral domain keyword map — maps concern signal keywords → CIE domain codes
const DOMAIN_BOOST_KEYWORDS: Record<string, string[]> = {
  COG: ['cognitive', 'analytical', 'reasoning', 'thinking', 'problem', 'attention',
        'focus', 'concentration', 'memory', 'processing', 'logic'],
  LEA: ['leadership', 'team', 'coaching', 'mentoring', 'people', 'management',
        'influence', 'authority', 'guidance', 'delegation'],
  COM: ['communication', 'verbal', 'written', 'expression', 'speaking',
        'listening', 'articulation', 'clarity', 'presentation'],
  EXE: ['execution', 'project', 'accountability', 'delivery', 'planning',
        'organisation', 'organization', 'discipline', 'follow-through'],
  TEC: ['technical', 'digital', 'technology', 'tool', 'software', 'system'],
  ADA: ['adaptability', 'flexibility', 'change', 'resilience', 'agility', 'transition'],
};

function scoreBehavioralBoost(gapDomainCode: string, patterns: any[]): number {
  if (!patterns?.length) return 0;
  const keywords = DOMAIN_BOOST_KEYWORDS[gapDomainCode] ?? [];
  if (!keywords.length) return 0;
  let boost = 0;
  for (const p of patterns) {
    const text = [
      p.label ?? '', p.description ?? '',
      ...(p.signal_codes ?? []),
    ].join(' ').toLowerCase();
    for (const kw of keywords) {
      if (text.includes(kw)) { boost += 5; break; }
    }
  }
  return Math.min(boost, 20);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Shared micro-components                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function LayerEmpty({
  icon: Icon, message, sub, hint,
}: { icon: React.ElementType; message: string; sub?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'rgba(11,60,93,0.06)' }}>
        <Icon className="w-5 h-5" style={{ color: '#94A3B8' }} />
      </div>
      <p className="text-sm font-semibold text-gray-500">{message}</p>
      {sub  && <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">{sub}</p>}
      {hint && (
        <p className="text-[10px] mt-2 px-3 py-1.5 rounded-full font-medium"
          style={{ background: `${BRAND.accent}15`, color: BRAND.accent }}>
          → {hint}
        </p>
      )}
    </div>
  );
}

function ScoreBar({ score, max = 100, color = BRAND.primary }: {
  score: number; max?: number; color?: string;
}) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
      {label}
    </p>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main component                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

interface CIESummary {
  meta?: {
    assessed_competencies?: number;
    has_trend_data?: boolean;
    has_forecast_data?: boolean;
    generated_at?: string;
  };
  profile_context?: {
    career_stage?: string | null;
    target_role?: string | null;
    current_role?: string | null;
    role_critical_competencies?: string[];
  };
  trends?: any[];
  forecasts?: any[];
  gap_priority?: any[];
  readiness_projection?: any[];
  outcome_projection?: {
    overall_readiness_pct?: number;
    outcome_label?: string;
    assessed_competencies?: number;
  };
  interventions?: any[];
}

interface SessionData {
  patterns?: any;
  stage?: any;
  outcome?: any;
  journey?: any;
  activation?: any;
}

interface WCLData {
  ok?:     boolean;
  enabled?: boolean;
  wcl1?: {
    sessions:   number;
    trends:     {
      pattern_key:        string;
      label:              string;
      polarity:           'risk' | 'load' | 'protective';
      points:             number;
      first_value:        number;
      last_value:         number;
      delta:              number;
      slope_per_session:  number;
      direction:          string;
      confidence:         number;
    }[];
    note?: string | null;
  };
  wcl2?: {
    enabled:          boolean;
    sessions_per_30d: number;
    forecasts:        {
      pattern_key:        string;
      label:              string;
      polarity:           string;
      current_value:      number;
      slope_per_session:  number;
      d30: { projected: number; direction: string; label: string };
      d60: { projected: number; direction: string; label: string };
      d90: { projected: number; direction: string; label: string };
      confidence_band: string;
      basis: string;
    }[];
    note?: string | null;
  };
  wcl3?: {
    risk?: {
      level:       string;
      trajectory:  string;
      driver:      string | null;
      confidence:  number;
      d30_label:   string;
      d60_label:   string;
      d90_label:   string;
      explainability: string;
    };
    growth?: {
      trajectory:  string;
      driver:      string | null;
      confidence:  number;
      d30_label:   string;
      d60_label:   string;
      d90_label:   string;
      explainability: string;
    };
    outcome?: {
      likely_outcome:  string;
      confidence:      number;
      d30_label:       string;
      d60_label:       string;
      d90_label:       string;
      explainability:  string;
    };
  } | null;
}

export function IntelligenceLayers({
  sessionId,
  userId,
  compact = false,
  title = 'Intelligence Layers',
}: IntelligenceLayersProps) {
  const [activeTab, setActiveTab]   = useState<LayerTab>('patterns');
  const [cie, setCie]               = useState<CIESummary>({});
  const [session, setSession]       = useState<SessionData>({});
  const [wcl, setWcl]               = useState<WCLData>({});
  const [loading, setLoading]       = useState(true);
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [mei, setMei]               = useState<{
    score:       number;
    band:        string;
    bandLabel:   string;
    confidence?: number;
    narrative?:  string;
    dimensions?: Array<{ code: string; name: string; score: number; weight: number }>;
  } | null>(null);
  const [meiRecs, setMeiRecs]       = useState<Array<{ id: number; title: string; description: string; action_type: string; priority_score: number }>>([]);

  useEffect(() => {
    const safe = (p: Promise<Response>) =>
      p.then(r => (r.ok ? r.json() : null)).catch(() => null);

    const cieReq = safe(fetch('/api/competency/intelligence/summary', { credentials: 'include' }));
    const wclReq = sessionId
      ? safe(fetch(`/api/intelligence/wcl?sessionId=${sessionId}`, { credentials: 'include' }))
      : Promise.resolve(null);
    const meiReq = userId
      ? safe(fetch(`/api/mei/score/${userId}`, { credentials: 'include' }))
      : Promise.resolve(null);
    const meiNarrativeReq = userId
      ? safe(fetch(`/api/mei/narrative/${userId}?audience=candidate`, { credentials: 'include' }))
      : Promise.resolve(null);
    const meiRecsReq = userId
      ? safe(fetch(`/api/mei/recommendations/${userId}`, { credentials: 'include' }))
      : Promise.resolve(null);

    const sessionReqs: Promise<any>[] = sessionId ? [
      safe(fetch(`/api/capadex/session/${sessionId}/patterns`,   { credentials: 'include' })),
      safe(fetch(`/api/capadex/session/${sessionId}/stage`,      { credentials: 'include' })),
      safe(fetch(`/api/capadex/session/${sessionId}/outcome`,    { credentials: 'include' })),
      safe(fetch(`/api/capadex/session/${sessionId}/journey`,    { credentials: 'include' })),
      safe(fetch(`/api/capadex/session/${sessionId}/activation`, { credentials: 'include' })),
    ] : [];

    Promise.all([cieReq, wclReq, meiReq, meiNarrativeReq, meiRecsReq, ...sessionReqs]).then(
      ([cieData, wclData, meiData, meiNarrData, meiRecsData, patterns, stage, outcome, journey, activation]) => {
        setCie(cieData ?? {});
        setWcl(wclData ?? {});
        if (meiData?.ok && meiData?.score) {
          const s    = meiData.score;
          const band = String(s.band ?? '');
          setMei({
            score:      Math.round(Number(s.composite_score ?? 0)),
            band,
            bandLabel:  MEI_BAND_LABEL[band] ?? band,
            confidence: s.confidence != null ? Number(s.confidence) : undefined,
            narrative:  meiNarrData?.ok
              ? (meiNarrData.narrative?.band_narrative ?? undefined)
              : undefined,
            dimensions: Array.isArray(s.dimensions)
              ? s.dimensions.map((d: any) => ({
                  code:   String(d.code  ?? ''),
                  name:   String(d.name  ?? ''),
                  score:  Number(d.score ?? 0),
                  weight: Number(d.cal_weight ?? d.base_weight ?? 0),
                }))
              : undefined,
          });
        }
        if (meiRecsData?.ok && Array.isArray(meiRecsData.recommendations)) {
          setMeiRecs(meiRecsData.recommendations.slice(0, 5));
        }
        setSession({ patterns, stage, outcome, journey, activation });
        setLoading(false);
      }
    );
  }, [sessionId, userId]);

  /* ── E3: behaviorally re-ranked gaps ──────────────────────────────────── */
  const rankedGaps = useMemo(() => {
    const gaps: any[] = cie.gap_priority ?? [];
    const patterns: any[] = session.patterns?.patterns ?? [];
    if (!patterns.length) return gaps;
    return [...gaps]
      .map(g => ({
        ...g,
        _boosted_priority: (g.priority_score ?? 0) + scoreBehavioralBoost(g.domain_code ?? '', patterns),
      }))
      .sort((a, b) => b._boosted_priority - a._boosted_priority);
  }, [cie.gap_priority, session.patterns]);

  /* ── Grouped interventions (flat → nested by competency) ─────────────── */
  const groupedInterventions = useMemo(() => {
    const flat: any[] = cie.interventions ?? [];
    const map = new Map<string, { competency_code: string; competency_name: string; actions: any[] }>();
    for (const item of flat) {
      const key = item.competency_code ?? 'unknown';
      if (!map.has(key)) {
        map.set(key, { competency_code: key, competency_name: item.competency_name ?? key, actions: [] });
      }
      map.get(key)!.actions.push({
        action:        item.action,
        type:          item.intervention_type ?? item.type ?? 'course',
        horizon_weeks: item.horizon_weeks ?? 0,
      });
    }
    return Array.from(map.values());
  }, [cie.interventions]);

  /* ── E1: development timeline from CIE trends ──────────────────────────
     Each trend has points[]. Collect max up to 10 time points across all
     competencies to build a cross-domain timeline snapshot.                 */
  const developmentTimeline = useMemo(() => {
    const trends: any[] = cie.trends ?? [];
    if (!trends.length) return [];
    // Build a set of recent data points: one entry per competency, last 3 points each
    const entries: { label: string; code: string; first: number; last: number; delta: number; trend: string }[] = [];
    for (const t of trends) {
      const pts: any[] = t.points ?? [];
      if (pts.length < 1) continue;
      const first  = pts[0].score ?? 0;
      const last   = pts[pts.length - 1].score ?? 0;
      const delta  = last - first;
      const trend  = t.velocity?.trend ?? (delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable');
      entries.push({
        label: t.competency_name ?? t.competency_code,
        code:  t.competency_code,
        first, last, delta, trend,
      });
    }
    return entries.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [cie.trends]);

  const TABS: { id: LayerTab; label: string; icon: React.ElementType }[] = [
    { id: 'patterns',      label: 'Patterns',     icon: Brain      },
    { id: 'trends',        label: 'Trends',        icon: TrendingUp },
    { id: 'forecast',      label: 'Forecast',      icon: BarChart2  },
    { id: 'outcomes',      label: 'Outcomes',      icon: Target     },
    { id: 'interventions', label: 'Interventions', icon: Zap        },
    { id: 'next-steps',    label: 'Next Steps',    icon: Compass    },
  ];

  const pd = compact ? 'p-3' : 'p-4';

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className={`rounded-2xl border overflow-hidden ${compact ? 'mt-3' : 'mt-6'}`}
      style={{ borderColor: '#E2E8F0', background: '#FAFBFF' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: '#E2E8F0', background: '#fff' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${BRAND.primary}12` }}>
            <Brain className="w-3.5 h-3.5" style={{ color: BRAND.primary }} />
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: BRAND.primary }}>{title}</p>
            <p className="text-[9px] text-gray-400 leading-none mt-0.5">
              Patterns · Trends · Forecasts · Outcomes · Interventions · Next Steps
            </p>
          </div>
        </div>
        {loading && (
          <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
        )}
      </div>

      {/* ── MEI Score Framing Strip ──────────────────────────────────────── */}
      {mei && (
        <div className="px-4 py-2.5 border-b"
          style={{ borderColor: '#E2E8F0', background: `${BRAND.primary}05` }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-semibold tracking-widest uppercase"
                style={{ color: BRAND.primary, opacity: 0.55 }}>Employability Index</span>
              <span className="text-sm font-black leading-none" style={{ color: BRAND.primary }}>
                {mei.score}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: (MEI_BAND_COLOR[mei.band] ?? { bg: '#F3F4F6' }).bg,
                  color:      (MEI_BAND_COLOR[mei.band] ?? { color: '#374151' }).color,
                }}>
                {mei.bandLabel}
              </span>
              {mei.confidence != null && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{
                    background: mei.confidence >= 0.7 ? '#ECFDF5' : mei.confidence >= 0.4 ? '#FFFBEB' : '#F9FAFB',
                    color:      mei.confidence >= 0.7 ? '#065F46' : mei.confidence >= 0.4 ? '#92400E' : '#6B7280',
                  }}>
                  {Math.round(mei.confidence * 100)}% conf
                </span>
              )}
            </div>
            <span className="text-[9px] shrink-0" style={{ color: BRAND.primary, opacity: 0.35 }}>MEI™</span>
          </div>
          {mei.narrative && (
            <p className="text-[10px] text-gray-500 mt-1 leading-snug">{mei.narrative}</p>
          )}
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto border-b"
        style={{ borderColor: '#E2E8F0', background: '#fff', scrollbarWidth: 'none' as const }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0"
              style={{
                color:             active ? BRAND.primary : '#9CA3AF',
                borderBottomColor: active ? BRAND.primary : 'transparent',
                background:        active ? `${BRAND.primary}06` : 'transparent',
              }}>
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className={pd}>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1 · PATTERNS                                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'patterns' && (() => {
          const behavioralPatterns: any[] = session.patterns?.patterns ?? [];
          // Composite signals (burnout_cluster, hesitation_cluster, etc.)
          const composites: any[] = session.patterns?.composites ?? [];
          // E5 · strengths from positive_factors
          const strengths: any[] = session.patterns?.positive_factors ?? [];
          const criticalGaps = rankedGaps.filter((g: any) => ['critical', 'high'].includes(g.gap_level));

          if (!loading && !behavioralPatterns.length && !composites.length && !strengths.length && !criticalGaps.length) {
            const totalAssessed = cie.meta?.assessed_competencies ?? 0;
            return (
              <LayerEmpty icon={Brain}
                message="No patterns detected yet"
                sub="Pattern recognition activates once assessment data is available."
                hint={
                  totalAssessed === 0
                    ? 'Complete a competency assessment to begin'
                    : sessionId
                      ? 'Complete a CAPADEX session to unlock behavioural patterns'
                      : `${totalAssessed} competency${totalAssessed > 1 ? ' scores' : ' score'} recorded — patterns emerge with more sessions`
                }
              />
            );
          }

          return (
            <div className="space-y-5">
              {loading && <Spinner />}

              {/* Composite signals — co-activation clusters (burnout, hesitation, etc.) */}
              {composites.length > 0 && (
                <div>
                  <SectionHeader label="Composite Signal Clusters" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {composites.map((c: any, i: number) => (
                      <div key={i} className="rounded-xl border p-3 flex items-start gap-2.5"
                        style={{ borderColor: '#D9770630', background: '#FFFBEB' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: '#D9770620' }}>
                          <Activity className="w-3 h-3" style={{ color: '#D97706' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-0.5">
                            <p className="text-[11px] font-semibold text-gray-800 leading-snug truncate">
                              {c.label ?? (c.composite_key ?? '').replace(/_/g, ' ')}
                            </p>
                            {c.confidence != null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                                style={{
                                  background: c.confidence > 0.6 ? '#FFFBEB' : '#F9FAFB',
                                  color:      c.confidence > 0.6 ? '#D97706' : '#9CA3AF',
                                }}>
                                {Math.round(c.confidence * 100)}%
                              </span>
                            )}
                          </div>
                          {c.matched_count != null && (
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              {c.matched_count} of {c.minimum_count} signals co-activated
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* E5 · Strengths subsection */}
              {strengths.length > 0 && (
                <div>
                  <SectionHeader label="Identified Strengths" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {strengths.map((s: any, i: number) => (
                      <div key={i} className="rounded-xl border p-3 flex items-start gap-2.5"
                        style={{ borderColor: '#10B98130', background: '#ECFDF5' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: '#10B98120' }}>
                          <Star className="w-3 h-3" style={{ color: '#10B981' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-gray-800 leading-snug">
                            {s.label ?? s.factor ?? s.name ?? 'Strength'}
                          </p>
                          {s.description && (
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{s.description}</p>
                          )}
                          {s.confidence != null && (
                            <span className="text-[9px] font-bold mt-1 inline-block"
                              style={{ color: '#10B981' }}>
                              {Math.round(s.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Behavioural patterns */}
              {behavioralPatterns.length > 0 && (
                <div>
                  <SectionHeader label="Behavioural Patterns" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {behavioralPatterns.map((p: any, i: number) => (
                      <div key={i} className="rounded-xl border p-3"
                        style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                        <div className="flex items-start justify-between mb-1.5">
                          <p className="text-xs font-semibold text-gray-800 flex-1 pr-2 leading-snug">
                            {p.label ?? p.pattern_type ?? 'Pattern'}
                          </p>
                          {p.confidence != null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                              style={{
                                background: p.confidence > 0.7 ? '#ECFDF5' : p.confidence > 0.4 ? '#FFFBEB' : '#F9FAFB',
                                color:      p.confidence > 0.7 ? '#10B981' : p.confidence > 0.4 ? '#D97706' : '#9CA3AF',
                              }}>
                              {Math.round(p.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-[10px] text-gray-500 leading-relaxed">{p.description}</p>
                        )}
                        {Array.isArray(p.signal_codes) && p.signal_codes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.signal_codes.slice(0, 4).map((s: string) => (
                              <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(11,60,93,0.08)', color: BRAND.primary }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* E3 · Gap patterns — behaviourally re-ranked when session present */}
              {criticalGaps.length > 0 && (
                <div>
                  <SectionHeader label={
                    session.patterns?.patterns?.length
                      ? 'Competency Gap Patterns (behaviourally re-ranked)'
                      : 'Competency Gap Patterns'
                  } />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {criticalGaps.map((g: any, i: number) => {
                      const meta      = GAP_META[g.gap_level] ?? GAP_META.medium;
                      const boosted   = (g._boosted_priority ?? g.priority_score ?? 0) > (g.priority_score ?? 0);
                      return (
                        <div key={i} className="rounded-xl border p-3 flex items-center gap-3"
                          style={{ borderColor: meta.color + '30', background: meta.bg }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: meta.color + '15' }}>
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] font-semibold text-gray-800 truncate capitalize">
                                {g.competency_name ?? (g.competency_code ?? '').replace(/_/g, ' ')}
                              </p>
                              {boosted && (
                                <span className="text-[8px] px-1 py-0.5 rounded font-bold shrink-0"
                                  style={{ background: `${BRAND.accent}20`, color: BRAND.accent }}>
                                  ↑ SIGNAL
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold uppercase" style={{ color: meta.color }}>
                                {g.gap_level}
                              </span>
                              {g.is_role_critical && (
                                <span className="text-[9px] px-1 py-0.5 rounded font-semibold"
                                  style={{ background: '#0B3C5D15', color: '#0B3C5D' }}>
                                  Role Critical
                                </span>
                              )}
                            </div>
                          </div>
                          {g._boosted_priority != null && (
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black" style={{ color: meta.color }}>
                                {Math.round(g._boosted_priority)}
                              </p>
                              <p className="text-[9px] text-gray-400">priority</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2 · TRENDS                                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'trends' && (() => {
          const trends: any[] = cie.trends ?? [];

          // E4 · specific empty-state hint
          if (!loading && !trends.length) {
            const assessed = cie.meta?.assessed_competencies ?? 0;
            const hasTrend = cie.meta?.has_trend_data ?? false;
            return (
              <LayerEmpty icon={TrendingUp}
                message="No trend data yet"
                sub={
                  assessed === 0
                    ? 'Complete a competency assessment first.'
                    : hasTrend === false
                      ? 'Trends activate after 2 or more assessment sessions.'
                      : 'No velocity detected in current sessions.'
                }
                hint={
                  assessed === 0
                    ? 'Take your first competency assessment'
                    : `${assessed} score${assessed > 1 ? 's' : ''} recorded — complete one more session to unlock trends`
                }
              />
            );
          }

          return (
            <div className="space-y-3">
              {loading && <Spinner />}
              {trends.map((t: any, i: number) => {
                const v         = t.velocity ?? {};
                const trend     = v.trend ?? 'stable';
                const isUp      = trend === 'improving';
                const isDown    = trend === 'declining';
                const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
                const tColor    = isUp ? '#10B981' : isDown ? '#EF4444' : '#9CA3AF';
                const points: any[] = t.points ?? [];
                const latest    = points.length ? points[points.length - 1].score : null;

                return (
                  <div key={i} className="rounded-xl border p-3.5"
                    style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-800 flex-1 truncate pr-3 capitalize">
                        {t.competency_name ?? (t.competency_code ?? '').replace(/_/g, ' ')}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {latest != null && (
                          <span className="text-sm font-black" style={{ color: BRAND.primary }}>
                            {Math.round(latest)}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                          style={{ background: tColor + '15' }}>
                          <TrendIcon className="w-2.5 h-2.5" style={{ color: tColor }} />
                          {v.velocity_pts_per_30d != null && (
                            <span className="text-[9px] font-bold" style={{ color: tColor }}>
                              {v.velocity_pts_per_30d > 0 ? '+' : ''}
                              {(Math.round(v.velocity_pts_per_30d * 10) / 10).toFixed(1)}/mo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ScoreBar score={latest ?? 0}
                      color={isUp ? '#10B981' : isDown ? '#EF4444' : BRAND.primary} />
                    {points.length > 1 && (
                      <div className="flex items-end gap-0.5 mt-2 h-6">
                        {points.slice(-10).map((pt: any, j: number) => {
                          const h = Math.max(3, Math.min(24, (pt.score / 100) * 24));
                          return (
                            <div key={j} className="flex-1 rounded-sm"
                              style={{ height: `${h}px`, background: tColor + '50', minWidth: 3 }} />
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[9px] text-gray-400">{points.length} sessions</span>
                      {v.momentum_score != null && (
                        <span className="text-[9px] text-gray-400">
                          Momentum: <strong>{Math.round(v.momentum_score)}</strong>
                        </span>
                      )}
                      {v.delta_score != null && (
                        <span className="text-[9px]"
                          style={{ color: v.delta_score >= 0 ? '#10B981' : '#EF4444' }}>
                          {v.delta_score >= 0 ? '+' : ''}{Math.round(v.delta_score)} vs last
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ── WCL1 · Behavioural Pattern Trends ───────────────────────── */}
              {(wcl.wcl1?.trends ?? []).length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2 px-0.5">
                    <div className="w-1 h-4 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                    <p className="text-[11px] font-bold text-amber-700">Behavioural Pattern Trends</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: '#FEF3C7', color: '#92400E' }}>
                      {wcl.wcl1!.trends.length} pattern{wcl.wcl1!.trends.length > 1 ? 's' : ''} · {wcl.wcl1!.sessions} sessions
                    </span>
                  </div>
                  <div className="space-y-2">
                    {wcl.wcl1!.trends.map((t, i) => {
                      const isRisk  = t.polarity === 'risk';
                      const isProt  = t.polarity === 'protective';
                      const rising  = t.direction === 'improving';
                      const worsens = isRisk ? rising : isProt ? !rising : false;
                      const neutral = t.direction === 'stable';
                      const tColor  = neutral ? '#9CA3AF' : worsens ? '#EF4444' : '#10B981';
                      const TIcon   = neutral ? Minus : worsens ? TrendingUp : TrendingDown;
                      return (
                        <div key={i} className="rounded-lg border p-2.5 flex items-center gap-3"
                          style={{ borderColor: tColor + '25', background: tColor + '06' }}>
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: tColor + '18' }}>
                            <TIcon className="w-3 h-3" style={{ color: tColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-gray-800 truncate">{t.label}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium capitalize"
                                style={{ background: '#F1F5F9', color: '#64748B' }}>
                                {t.polarity}
                              </span>
                              <span className="text-[9px] text-gray-400">{t.points} sessions</span>
                              {t.confidence > 0 && (
                                <span className="text-[9px] text-gray-400">
                                  {Math.round(t.confidence * 100)}% conf
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold" style={{ color: tColor }}>
                              {t.delta >= 0 ? '+' : ''}{t.delta}%
                            </p>
                            <p className="text-[9px] text-gray-400">{t.first_value}→{t.last_value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* ── MEI EI Dimension Profile ──────────────────────────── */}
              {mei?.dimensions && mei.dimensions.length > 0 && (
                <div>
                  <SectionHeader label="EI Dimension Profile" />
                  <div className="space-y-2">
                    {mei.dimensions.map((dim, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <p className="text-[10px] text-gray-600 shrink-0 truncate"
                          style={{ width: '7.5rem' }}>{dim.name}</p>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: '#F1F5F9' }}>
                          <div className="h-full rounded-full"
                            style={{
                              width:      `${Math.min(100, Math.max(0, dim.score))}%`,
                              background: dim.score >= 70 ? '#10B981'
                                        : dim.score >= 45 ? BRAND.primary
                                        : '#EF4444',
                            }} />
                        </div>
                        <span className="text-[10px] font-bold shrink-0 w-6 text-right"
                          style={{ color: BRAND.primary }}>
                          {Math.round(dim.score)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3 · FORECAST                                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'forecast' && (() => {
          const forecasts: any[] = cie.forecasts ?? [];

          // E4 · specific empty hint
          if (!loading && !forecasts.length) {
            const hasTrend = cie.meta?.has_trend_data ?? false;
            const assessed = cie.meta?.assessed_competencies ?? 0;
            return (
              <LayerEmpty icon={BarChart2}
                message="Forecast unavailable"
                sub={
                  assessed === 0 ? 'Complete a competency assessment first.' :
                  !hasTrend     ? 'Forecasting requires trend history from 2+ sessions.' :
                                  'Insufficient velocity data to project a trajectory.'
                }
                hint={
                  assessed === 0  ? 'Take your first competency assessment' :
                  !hasTrend       ? 'Complete a second assessment session to unlock forecasts' :
                                    'Forecasts appear once consistent velocity is detected'
                }
              />
            );
          }

          return (
            <div className="space-y-3">
              {loading && <Spinner />}
              {forecasts.map((f: any, i: number) => {
                const traj = TRAJECTORY_META[f.trajectory_type] ?? TRAJECTORY_META.stable;
                const lo   = f.forecast_lower    != null ? Math.min(99, Math.max(1, f.forecast_lower))    : null;
                const hi   = f.forecast_upper    != null ? Math.min(99, Math.max(1, f.forecast_upper))    : null;
                const mid  = f.forecast_midpoint != null ? Math.min(99, Math.max(1, f.forecast_midpoint)) : null;
                return (
                  <div key={i} className="rounded-xl border p-3.5"
                    style={{ borderColor: traj.color + '25', background: '#fff' }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 pr-3">
                        <p className="text-xs font-semibold text-gray-800 capitalize">
                          {f.competency_name ?? (f.competency_code ?? '').replace(/_/g, ' ')}
                        </p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block"
                          style={{ background: traj.bg, color: traj.color }}>
                          {traj.label}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black" style={{ color: BRAND.primary }}>
                          {Math.round(f.current_score ?? 0)}
                        </p>
                        <p className="text-[9px] text-gray-400">current</p>
                      </div>
                    </div>
                    {mid != null && lo != null && hi != null && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-5 relative rounded-lg overflow-hidden"
                          style={{ background: '#F1F5F9' }}>
                          <div className="absolute inset-y-0 rounded-lg"
                            style={{ left: `${lo}%`, right: `${100 - hi}%`, background: traj.color + '28' }} />
                          <div className="absolute inset-y-0 w-0.5 rounded"
                            style={{ left: `${mid}%`, background: traj.color }} />
                        </div>
                        <div className="text-right shrink-0 w-24">
                          <p className="text-[11px] font-bold" style={{ color: traj.color }}>
                            {Math.round(f.forecast_midpoint)} projected
                          </p>
                          <p className="text-[9px] text-gray-400">
                            {Math.round(f.forecast_lower ?? 0)}–{Math.round(f.forecast_upper ?? 0)} range
                          </p>
                        </div>
                      </div>
                    )}
                    {f.confidence_band && (
                      <p className="text-[9px] text-gray-400 mt-1.5">
                        Confidence band: <strong className="text-gray-600">{f.confidence_band}</strong>
                      </p>
                    )}
                  </div>
                );
              })}

              {/* ── WCL2 · 30/60/90-Day Behavioural Horizon ─────────────────── */}
              {(wcl.wcl2?.forecasts ?? []).length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2 px-0.5">
                    <div className="w-1 h-4 rounded-full shrink-0" style={{ background: '#6366F1' }} />
                    <p className="text-[11px] font-bold" style={{ color: '#4338CA' }}>
                      30 · 60 · 90-Day Pattern Projections
                    </p>
                    {(wcl.wcl2!.sessions_per_30d ?? 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: '#EEF2FF', color: '#4338CA' }}>
                        {wcl.wcl2!.sessions_per_30d.toFixed(1)} sessions/30d
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {wcl.wcl2!.forecasts.map((f, i) => {
                      const isRisk = f.polarity === 'risk';
                      const slope  = f.slope_per_session;
                      const rising = slope > 0;
                      const tColor = isRisk
                        ? (rising ? '#EF4444' : '#10B981')
                        : (rising ? '#10B981' : '#EF4444');
                      const confColor = f.confidence_band === 'high' ? '#10B981'
                                      : f.confidence_band === 'moderate' ? '#D97706'
                                      : '#9CA3AF';
                      return (
                        <div key={i} className="rounded-lg border overflow-hidden"
                          style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                          <div className="px-3 py-2 flex items-center justify-between"
                            style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                            <p className="text-[11px] font-bold text-gray-800">{f.label}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium capitalize"
                                style={{ background: confColor + '18', color: confColor }}>
                                {f.confidence_band}
                              </span>
                              <span className="text-[9px] text-gray-400 capitalize">{f.polarity}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 divide-x divide-slate-100">
                            {(['30d', '60d', '90d'] as const).map((lbl) => {
                              const pt = lbl === '30d' ? f.d30 : lbl === '60d' ? f.d60 : f.d90;
                              const d  = pt.projected - f.current_value;
                              const dColor = isRisk
                                ? (d > 0 ? '#EF4444' : '#10B981')
                                : (d > 0 ? '#10B981' : '#EF4444');
                              return (
                                <div key={lbl} className="px-2 py-2 text-center">
                                  <p className="text-[9px] text-gray-400 mb-0.5">{lbl}</p>
                                  <p className="text-sm font-black" style={{ color: tColor }}>
                                    {pt.projected}%
                                  </p>
                                  <p className="text-[9px] font-semibold" style={{ color: dColor }}>
                                    {d >= 0 ? '+' : ''}{d}%
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 4 · OUTCOMES                                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'outcomes' && (() => {
          const outcomes: any[]       = cie.readiness_projection ?? [];
          const overallPct: number | null = cie.outcome_projection?.overall_readiness_pct ?? null;
          const stage                 = session.stage?.stage ?? null;
          const capadexOutcome        = session.outcome?.outcome ?? null;
          const journey               = session.journey?.journey ?? null;
          const targetRole            = cie.profile_context?.target_role;

          // E4 · specific empty hint
          if (!loading && !outcomes.length && !stage && !capadexOutcome) {
            return (
              <LayerEmpty icon={Target}
                message="No outcome projections yet"
                sub={
                  !targetRole
                    ? 'Outcome models need a target role to project readiness against.'
                    : cie.meta?.assessed_competencies === 0
                      ? 'Complete a competency assessment to generate outcome projections.'
                      : 'Not enough data yet — complete more assessments to activate projections.'
                }
                hint={
                  !targetRole
                    ? 'Set your target role in your profile to unlock outcomes'
                    : 'Complete your competency assessment to see readiness projections'
                }
              />
            );
          }

          return (
            <div className="space-y-4">
              {loading && <Spinner />}

              {overallPct != null && (
                <div className="rounded-xl p-3.5"
                  style={{ background: `${BRAND.primary}08`, border: `1px solid ${BRAND.primary}20` }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>
                      Overall Readiness
                      {targetRole && <span className="font-normal text-gray-500"> · {targetRole}</span>}
                    </p>
                    <span className="text-lg font-black" style={{ color: BRAND.primary }}>
                      {Math.round(overallPct)}%
                    </span>
                  </div>
                  <ScoreBar score={overallPct}
                    color={overallPct >= 70 ? '#10B981' : overallPct >= 40 ? BRAND.accent : '#F59E0B'} />
                  {cie.outcome_projection?.outcome_label && (
                    <p className="text-[10px] font-semibold mt-1.5 capitalize" style={{ color: BRAND.muted }}>
                      {cie.outcome_projection.outcome_label.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
              )}

              {stage && (
                <div className="rounded-xl border p-3.5"
                  style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                  <SectionHeader label="Behavioural Stage" />
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${BRAND.accent}20` }}>
                      <Navigation className="w-4 h-4" style={{ color: BRAND.accent }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{stage.name ?? stage.code}</p>
                      {stage.description && (
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{stage.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {capadexOutcome && (
                <div className="rounded-xl border p-3.5"
                  style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                  <SectionHeader label="Behavioural Outcome Model" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-800 capitalize">
                      {(capadexOutcome.model_code ?? '').replace(/_/g, ' ')}
                    </p>
                    {capadexOutcome.confidence != null && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#ECFDF5', color: '#10B981' }}>
                        {Math.round(capadexOutcome.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {Array.isArray(capadexOutcome.interventions) && capadexOutcome.interventions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {capadexOutcome.interventions.slice(0, 4).map((iv: string, j: number) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full capitalize"
                          style={{ background: `${BRAND.accent}15`, color: BRAND.accent }}>
                          {iv.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {outcomes.length > 0 && (
                <div>
                  <SectionHeader label="Competency Readiness" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {outcomes.map((o: any, i: number) => {
                      const meta = READINESS_META[o.readiness_status] ?? READINESS_META.unclassified;
                      return (
                        <div key={i} className="rounded-xl border p-3"
                          style={{ borderColor: meta.color + '25', background: '#fff' }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] font-semibold text-gray-800 flex-1 truncate pr-2">
                              {o.competency_name ?? (o.competency_code ?? '').replace(/_/g, ' ')}
                            </p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                              style={{ background: meta.bg, color: meta.color }}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-gray-400 mb-1.5">
                            <span>Now: <strong className="text-gray-600">{Math.round(o.current_score ?? 0)}</strong></span>
                            <ChevronRight className="w-2.5 h-2.5" />
                            <span>Target: <strong className="text-gray-600">{Math.round(o.target_score ?? 0)}</strong></span>
                            {o.months_to_target != null && o.months_to_target > 0 && (
                              <span style={{ color: meta.color }}>~{Math.round(o.months_to_target)}mo</span>
                            )}
                          </div>
                          <ScoreBar score={o.current_score ?? 0} color={meta.color} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {journey && (
                <div className="rounded-xl border p-3.5"
                  style={{ borderColor: `${BRAND.accent}30`, background: `${BRAND.accent}06` }}>
                  <SectionHeader label="Recommended Journey" />
                  <div className="flex items-start gap-2">
                    <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: BRAND.accent }} />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{journey.primary_route}</p>
                      {journey.route_reason && (
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{journey.route_reason}</p>
                      )}
                      {journey.expected_advancement && (
                        <p className="text-[10px] font-semibold mt-1.5" style={{ color: BRAND.accent }}>
                          {journey.expected_advancement}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── WCL3 · Risk / Growth / Outcome Projections ──────────────── */}
              {wcl.wcl3 && (wcl.wcl3.risk || wcl.wcl3.growth || wcl.wcl3.outcome) && (
                <div className="rounded-xl border overflow-hidden"
                  style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                  <div className="px-3.5 py-2.5 border-b flex items-center gap-2"
                    style={{ borderColor: '#F1F5F9', background: '#F8FAFC' }}>
                    <Activity className="w-3.5 h-3.5" style={{ color: BRAND.primary }} />
                    <p className="text-[11px] font-bold" style={{ color: BRAND.primary }}>
                      Behavioural Projection
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
                      style={{ background: `${BRAND.primary}12`, color: BRAND.primary }}>
                      90-day horizon
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">

                    {wcl.wcl3.risk && (
                      <div className="px-3.5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-gray-700">Risk Projection</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                              style={{
                                background: wcl.wcl3.risk.level === 'high'     ? '#FEE2E2'
                                          : wcl.wcl3.risk.level === 'moderate' ? '#FEF3C7' : '#ECFDF5',
                                color:      wcl.wcl3.risk.level === 'high'     ? '#B91C1C'
                                          : wcl.wcl3.risk.level === 'moderate' ? '#92400E' : '#065F46',
                              }}>
                              {wcl.wcl3.risk.level}
                            </span>
                            <span className="text-[9px] text-gray-400 capitalize">{wcl.wcl3.risk.trajectory}</span>
                          </div>
                        </div>
                        {wcl.wcl3.risk.driver && (
                          <p className="text-[10px] text-gray-500 mb-1.5">
                            Driver: <strong>{wcl.wcl3.risk.driver}</strong>
                          </p>
                        )}
                        <div className="grid grid-cols-3 gap-1">
                          {[['30d', wcl.wcl3.risk.d30_label], ['60d', wcl.wcl3.risk.d60_label], ['90d', wcl.wcl3.risk.d90_label]].map(([h, l]) => (
                            <div key={h} className="rounded p-1.5 text-center" style={{ background: '#F9FAFB' }}>
                              <p className="text-[8px] text-gray-400 font-medium mb-0.5">{h}</p>
                              <p className="text-[9px] text-gray-700 leading-snug">{l}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {wcl.wcl3.growth && (
                      <div className="px-3.5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-gray-700">Growth Projection</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                            style={{
                              background: ['accelerating','growing'].includes(wcl.wcl3.growth.trajectory) ? '#ECFDF5'
                                        : wcl.wcl3.growth.trajectory === 'declining' ? '#FEE2E2' : '#F1F5F9',
                              color:      ['accelerating','growing'].includes(wcl.wcl3.growth.trajectory) ? '#065F46'
                                        : wcl.wcl3.growth.trajectory === 'declining' ? '#B91C1C' : '#475569',
                            }}>
                            {wcl.wcl3.growth.trajectory}
                          </span>
                        </div>
                        {wcl.wcl3.growth.driver && (
                          <p className="text-[10px] text-gray-500 mb-1.5">
                            Driver: <strong>{wcl.wcl3.growth.driver}</strong>
                          </p>
                        )}
                        <div className="grid grid-cols-3 gap-1">
                          {[['30d', wcl.wcl3.growth.d30_label], ['60d', wcl.wcl3.growth.d60_label], ['90d', wcl.wcl3.growth.d90_label]].map(([h, l]) => (
                            <div key={h} className="rounded p-1.5 text-center" style={{ background: '#F9FAFB' }}>
                              <p className="text-[8px] text-gray-400 font-medium mb-0.5">{h}</p>
                              <p className="text-[9px] text-gray-700 leading-snug">{l}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {wcl.wcl3.outcome && (
                      <div className="px-3.5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-gray-700">Outcome Projection</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                            style={{
                              background: wcl.wcl3.outcome.likely_outcome === 'positive' ? '#ECFDF5'
                                        : wcl.wcl3.outcome.likely_outcome === 'at_risk'  ? '#FEE2E2' : '#FEF3C7',
                              color:      wcl.wcl3.outcome.likely_outcome === 'positive' ? '#065F46'
                                        : wcl.wcl3.outcome.likely_outcome === 'at_risk'  ? '#B91C1C' : '#92400E',
                            }}>
                            {wcl.wcl3.outcome.likely_outcome.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 mb-1.5">
                          {[['30d', wcl.wcl3.outcome.d30_label], ['60d', wcl.wcl3.outcome.d60_label], ['90d', wcl.wcl3.outcome.d90_label]].map(([h, l]) => (
                            <div key={h} className="rounded p-1.5 text-center" style={{ background: '#F9FAFB' }}>
                              <p className="text-[8px] text-gray-400 font-medium mb-0.5">{h}</p>
                              <p className="text-[9px] text-gray-700 leading-snug">{l}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-gray-400 leading-snug">
                          {wcl.wcl3.outcome.explainability}
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 5 · INTERVENTIONS                                           */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'interventions' && (() => {
          const journey    = session.journey?.journey ?? null;
          const allGaps    = cie.gap_priority ?? [];
          const hasGaps    = allGaps.length > 0;
          const targetRole = cie.profile_context?.target_role;

          // E4 · specific empty hint
          if (!loading && !groupedInterventions.length && !journey) {
            return (
              <LayerEmpty icon={Zap}
                message={
                  !hasGaps
                    ? 'No critical gaps — you\'re on track!'
                    : 'No interventions mapped yet'
                }
                sub={
                  !hasGaps && !targetRole
                    ? 'Set a target role to compare against and surface any gaps.'
                    : !hasGaps
                      ? 'All assessed competencies meet your target — well done.'
                      : 'Gaps exist but no intervention library rows are mapped yet.'
                }
                hint={
                  !hasGaps && !targetRole ? 'Set your target role in your profile' : undefined
                }
              />
            );
          }

          const TYPE_ICON: Record<string, React.ElementType> = {
            mentoring: Users, mentorship: Users,
            course:    BookOpen,
            project:   Briefcase, stretch: Briefcase,
            skill:     Zap, practice: Zap,
            habit:     Clock,
          };

          return (
            <div className="space-y-4">
              {loading && <Spinner />}

              {journey?.secondary_route && (
                <div className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${BRAND.accent}15` }}>
                    <Navigation className="w-3.5 h-3.5" style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Suggested pathway</p>
                    <p className="text-xs font-semibold text-gray-800">{journey.secondary_route}</p>
                  </div>
                </div>
              )}

              {groupedInterventions.map((item, i) => {
                const actions: any[] = item.actions ?? [];
                if (!actions.length) return null;
                return (
                  <div key={i} className="rounded-xl border overflow-hidden"
                    style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                    <div className="px-3.5 py-2 border-b"
                      style={{ borderColor: '#F1F5F9', background: `${BRAND.primary}04` }}>
                      <p className="text-[11px] font-bold capitalize" style={{ color: BRAND.primary }}>
                        {item.competency_name.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {actions.map((a: any, j: number) => {
                        const IType = TYPE_ICON[a.type] ?? Zap;
                        return (
                          <div key={j} className="px-3.5 py-2.5 flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${BRAND.accent}15` }}>
                              <IType className="w-3 h-3" style={{ color: BRAND.accent }} />
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] font-medium text-gray-800 leading-snug">{a.action}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium capitalize"
                                  style={{ background: '#F1F5F9', color: '#64748B' }}>
                                  {a.type}
                                </span>
                                {a.horizon_weeks > 0 && (
                                  <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />{a.horizon_weeks}w
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 6 · NEXT STEPS  (E1 + E2)                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'next-steps' && (() => {
          const activation = session.activation;
          const decision   = activation?.decision ?? null;
          const growthPlan = activation?.growthPlan ?? null;
          const mentor     = activation?.mentor ?? null;
          const noSession  = !sessionId;
          const notEnabled = activation?.enabled === false;
          const degraded   = activation?.degraded === true;

          return (
            <div className="space-y-4">
              {loading && <Spinner />}

              {/* ── MEI Personalised Recommendations ──────────────────── */}
              {!loading && meiRecs.length > 0 && (
                <div>
                  <SectionHeader label="Your Personalised Next Steps" />
                  <div className="space-y-2">
                    {meiRecs.map((rec, i) => (
                      <div key={i} className="rounded-xl border p-3"
                        style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${BRAND.primary}10` }}>
                            <ArrowUpRight className="w-3 h-3" style={{ color: BRAND.primary }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-gray-800 leading-snug">{rec.title}</p>
                            {rec.description && (
                              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                                {rec.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {rec.action_type && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium capitalize"
                                  style={{ background: '#F1F5F9', color: '#64748B' }}>
                                  {rec.action_type.replace(/_/g, ' ')}
                                </span>
                              )}
                              {rec.priority_score > 0 && (
                                <span className="text-[9px] text-gray-400">
                                  priority {Math.round(rec.priority_score * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── E2: WC-7B Activation Envelope ─────────────────────── */}
              {!loading && noSession && meiRecs.length === 0 && (
                <div className="rounded-xl p-4 text-center"
                  style={{ background: `${BRAND.primary}06`, border: `1px solid ${BRAND.primary}15` }}>
                  <Compass className="w-8 h-8 mx-auto mb-2" style={{ color: BRAND.muted }} />
                  <p className="text-xs font-semibold text-gray-600">
                    Decision intelligence requires a CAPADEX session
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Complete a CAPADEX behavioural assessment to unlock personalised next steps.
                  </p>
                </div>
              )}

              {!loading && !noSession && notEnabled && (
                <div className="rounded-xl p-4 text-center"
                  style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <Lightbulb className="w-7 h-7 mx-auto mb-2" style={{ color: '#D97706' }} />
                  <p className="text-xs font-semibold text-gray-600">Decision orchestrator is off</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Next Steps activate when the decision intelligence feature is enabled.
                  </p>
                </div>
              )}

              {!loading && !noSession && !notEnabled && degraded && (
                <div className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: '#F9FAFB', border: '1px solid #E2E8F0' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#D97706' }} />
                  <p className="text-[11px] text-gray-500">
                    Decision engine is warming up — showing available intelligence below.
                  </p>
                </div>
              )}

              {decision && (
                <div className="rounded-xl border p-4"
                  style={{ borderColor: `${BRAND.primary}25`, background: `${BRAND.primary}06` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <SectionHeader label="Decision Intelligence" />
                      <p className="text-sm font-bold" style={{ color: BRAND.primary }}>
                        {(decision.stage_label ?? decision.stage ?? 'Stage assessed').replace(/_/g, ' ')}
                      </p>
                      {decision.outcome_model && (
                        <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
                          {decision.outcome_model.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                        style={{
                          background: decision.confidence > 0.7 ? '#ECFDF5' :
                                      decision.confidence > 0.4 ? '#FFFBEB' : '#F9FAFB',
                          color:      decision.confidence > 0.7 ? '#10B981' :
                                      decision.confidence > 0.4 ? '#D97706' : '#9CA3AF',
                        }}>
                        <Activity className="w-3 h-3" />
                        <span className="text-[10px] font-bold">
                          {Math.round((decision.confidence ?? 0) * 100)}% confidence
                        </span>
                      </div>
                      {decision.ambiguity && (
                        <p className="text-[9px] text-amber-500 mt-1">⚠ competing signals</p>
                      )}
                    </div>
                  </div>
                  {decision.primary_why?.length > 0 && (
                    <ul className="space-y-1 mt-2">
                      {decision.primary_why.slice(0, 3).map((why: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color: BRAND.accent }} />
                          <span className="text-[10px] text-gray-600 leading-snug">{why}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {decision.route && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2"
                      style={{ borderColor: `${BRAND.primary}15` }}>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" style={{ color: BRAND.accent }} />
                      <p className="text-[11px] font-semibold capitalize" style={{ color: BRAND.primary }}>
                        Recommended route: {decision.route.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Growth plan slot */}
              {growthPlan != null && (
                <div className="rounded-xl border p-3.5"
                  style={{
                    borderColor: growthPlan.ready ? '#10B98130' : '#E2E8F0',
                    background: '#fff',
                  }}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: growthPlan.ready ? '#ECFDF5' : '#F9FAFB' }}>
                      <Target className="w-3.5 h-3.5"
                        style={{ color: growthPlan.ready ? '#10B981' : '#9CA3AF' }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-800">Growth Plan</p>
                      <p className="text-[9px] text-gray-400">
                        {growthPlan.ready ? 'Ready' : growthPlan.reason?.replace(/_/g, ' ') ?? 'Not ready'}
                      </p>
                    </div>
                    {growthPlan.ready && (
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: '#ECFDF5', color: '#10B981' }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {growthPlan.plan?.title && (
                    <p className="text-[11px] font-semibold text-gray-700 mt-1">{growthPlan.plan.title}</p>
                  )}
                  {growthPlan.plan?.description && (
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                      {growthPlan.plan.description}
                    </p>
                  )}
                </div>
              )}

              {/* Mentor slot */}
              {mentor != null && (
                <div className="rounded-xl border p-3.5"
                  style={{
                    borderColor: mentor.ready ? `${BRAND.accent}30` : '#E2E8F0',
                    background: '#fff',
                  }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: mentor.ready ? `${BRAND.accent}15` : '#F9FAFB' }}>
                      <Users className="w-3.5 h-3.5"
                        style={{ color: mentor.ready ? BRAND.accent : '#9CA3AF' }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-800">Mentor Match</p>
                      <p className="text-[9px] text-gray-400">
                        {mentor.ready ? 'Mentor matching is available' : mentor.reason?.replace(/_/g, ' ') ?? 'Not ready'}
                      </p>
                    </div>
                    {mentor.ready && (
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${BRAND.accent}15`, color: BRAND.accent }}>
                        READY
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── E1: Cross-report development timeline ─────────────── */}
              {developmentTimeline.length > 0 && (
                <div className="rounded-xl border overflow-hidden"
                  style={{ borderColor: '#E2E8F0', background: '#fff' }}>
                  <button
                    className="w-full flex items-center justify-between px-3.5 py-3"
                    style={{ background: `${BRAND.primary}04` }}
                    onClick={() => setExpandedTimeline(v => !v)}>
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" style={{ color: BRAND.primary }} />
                      <p className="text-[11px] font-bold" style={{ color: BRAND.primary }}>
                        Development Timeline
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: `${BRAND.primary}12`, color: BRAND.primary }}>
                        {developmentTimeline.length} competencies
                      </span>
                    </div>
                    {expandedTimeline
                      ? <ChevronUp className="w-3.5 h-3.5" style={{ color: BRAND.muted }} />
                      : <ChevronDown className="w-3.5 h-3.5" style={{ color: BRAND.muted }} />
                    }
                  </button>

                  {expandedTimeline && (
                    <div className="divide-y divide-slate-50">
                      {developmentTimeline.map((entry, i) => {
                        const isUp   = entry.trend === 'improving';
                        const isDown = entry.trend === 'declining';
                        const TIcon  = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
                        const tColor = isUp ? '#10B981' : isDown ? '#EF4444' : '#9CA3AF';
                        return (
                          <div key={i} className="px-3.5 py-2.5 flex items-center gap-3">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: tColor + '15' }}>
                              <TIcon className="w-3 h-3" style={{ color: tColor }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-gray-800 truncate capitalize">
                                {entry.label}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-gray-400">
                                  Start: <strong>{Math.round(entry.first)}</strong>
                                </span>
                                <ChevronRight className="w-2.5 h-2.5 text-gray-300" />
                                <span className="text-[9px] text-gray-400">
                                  Latest: <strong>{Math.round(entry.last)}</strong>
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[11px] font-bold"
                                style={{ color: tColor }}>
                                {entry.delta >= 0 ? '+' : ''}{Math.round(entry.delta)}
                              </p>
                              <p className="text-[9px] text-gray-400">change</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!expandedTimeline && (
                    <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
                      {developmentTimeline.slice(0, 4).map((entry, i) => {
                        const isUp   = entry.trend === 'improving';
                        const isDown = entry.trend === 'declining';
                        const tColor = isUp ? '#10B981' : isDown ? '#EF4444' : '#9CA3AF';
                        return (
                          <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold"
                            style={{ background: tColor + '12', color: tColor }}>
                            <span className="capitalize max-w-[80px] truncate">{entry.label}</span>
                            <span>{entry.delta >= 0 ? '+' : ''}{Math.round(entry.delta)}</span>
                          </div>
                        );
                      })}
                      {developmentTimeline.length > 4 && (
                        <span className="text-[9px] text-gray-400">
                          +{developmentTimeline.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* E4 · cold-start state for Next Steps with no data anywhere */}
              {!loading && !decision && !growthPlan && !mentor && !developmentTimeline.length && !noSession && !notEnabled && !meiRecs.length && (
                <LayerEmpty icon={Compass}
                  message="Next steps are computing"
                  sub="The decision orchestrator needs stage, outcome, and journey data to compose your activation envelope."
                  hint="Complete a full CAPADEX session to unlock personalised next steps"
                />
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
