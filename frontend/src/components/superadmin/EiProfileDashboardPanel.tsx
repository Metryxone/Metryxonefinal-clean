/**
 * Phase 3.4 + 3.5 — Candidate Employability Profile dashboard.
 *
 * Read-only viewer over:
 *   - GET  /api/competency-ei/profile/:subject            (3.4 EI Profile Engine)
 *   - POST /api/competency-ei/profile/:subject/snapshot   (3.4 history capture)
 *   - GET  /api/competency-ei/profile/:subject/history     (3.4 history)
 *   - GET  /api/competency-ei/role-readiness-v2/:subject   (3.5 Role Readiness V2)
 *
 * Surfaces the candidate profile (Overall EI · Dimension Scores · Strength Areas
 * · Development Areas · Critical Risks · Growth Potential) and the five-component
 * V2 role view (Readiness · Match · Gap · Risk · Potential). COMPOSES already-
 * computed numbers — nothing is recomputed here. Coverage (how much measured) and
 * Confidence (how trustworthy) are shown as SEPARATE axes; unmeasurable surfaces
 * show a reason, never a fabricated 0.
 *
 * Only mounted when the `competencyEi` flag probe succeeds (nav self-hides when
 * OFF, keeping flag-OFF UI byte-identical). Snapshot capture is an EXPLICIT POST.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck, Gauge, ShieldAlert, Sparkles, Target, TrendingUp, Camera,
  AlertTriangle, CheckCircle2, Info, History as HistoryIcon, Search, Layers, Building2,
  LayoutDashboard, Activity, ArrowUp, ArrowDown, Minus,
  ShieldCheck, XCircle, ChevronDown, ChevronRight,
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#5B7BD5' };

const BAND_COLOR: Record<string, string> = {
  Excellent: '#15803d', Strong: '#16a34a', Developing: '#ca8a04',
  Emerging: '#ea580c', Early: '#dc2626',
};
const CONF_COLOR: Record<string, string> = {
  High: '#15803d', Moderate: '#ca8a04', Limited: '#ea580c', Low: '#dc2626', None: '#6b7280',
};
const LEVEL_COLOR: Record<string, string> = {
  High: '#16a34a', Medium: '#ca8a04', Moderate: '#ca8a04', Low: '#dc2626', Unmeasured: '#6b7280',
};
const RISK_COLOR: Record<string, string> = {
  Low: '#16a34a', Medium: '#ca8a04', High: '#dc2626', Unmeasured: '#6b7280',
};
const FIT_COLOR: Record<string, string> = {
  strong: '#15803d', good: '#16a34a', partial: '#ca8a04', low: '#dc2626', unmeasured: '#6b7280',
};
const SIGNAL_STATUS_COLOR: Record<string, string> = {
  fired: '#16a34a', not_met: '#dc2626', indeterminate: '#ca8a04', unmeasured: '#6b7280',
};
const SIGNAL_STATUS_LABEL: Record<string, string> = {
  fired: 'Fired', not_met: 'Not Met', indeterminate: 'Indeterminate', unmeasured: 'Unmeasured',
};
const SIGNAL_STATE_COLOR: Record<string, string> = {
  strong: '#16a34a', moderate: '#ca8a04', low: '#dc2626', unmeasured: '#6b7280',
};
const REC_STATUS_COLOR: Record<string, string> = {
  emitted: '#16a34a', not_applicable: '#6b7280', withheld: '#ca8a04',
};
const REC_STATUS_LABEL: Record<string, string> = {
  emitted: 'Recommended', not_applicable: 'Not Needed', withheld: 'Withheld',
};
const REC_PRIORITY_COLOR: Record<string, string> = {
  high: '#dc2626', medium: '#ca8a04', low: '#16a34a',
};
const REC_CATEGORY_LABEL: Record<string, string> = {
  development: 'Development', certification: 'Certification', project: 'Project',
  experience: 'Experience', behavioral: 'Behavioral',
};

interface ConfidenceShape { score: number; band: string; measurement: string; caps: string[]; factors: string[]; }
interface DimensionScore {
  ei_dimension_id: string; dimension_name: string; measurable: boolean;
  score: number | null; band: string | null; coverage_pct: number; reason?: string;
}
interface StrengthArea { ei_dimension_id: string; dimension_name: string; score: number; band: string; rationale: string; }
interface DevelopmentArea { ei_dimension_id: string; dimension_name: string; score: number; band: string; headroom: number; rationale: string; }
interface CriticalRisk { type: string; ei_dimension_id: string | null; dimension_name: string | null; detail: string; severity: string; }
interface GrowthPotential {
  level: string; score: number | null;
  improvable_dimensions: Array<{ ei_dimension_id: string; dimension_name: string; headroom: number }>;
  drivers: string[]; reason: string | null;
}
interface EiProfile {
  ok: boolean; subject_id: string; role_id: string | null; version: string; measurable: boolean;
  overall_ei: { measurable: boolean; ei_score: number | null; band: string | null; coverage_pct: number };
  confidence: ConfidenceShape;
  dimension_scores: DimensionScore[];
  strength_areas: StrengthArea[];
  development_areas: DevelopmentArea[];
  critical_risks: CriticalRisk[];
  growth_potential: GrowthPotential;
  notes: string[];
}

interface Factor { key: string; label: string; contribution: number; }
interface RoleRisk { level: string; score: number | null; blocking_gaps: number; factors: Factor[]; notes: string[]; }
interface RolePotential { level: string; score: number | null; closable_gaps: number; factors: Factor[]; notes: string[]; }
interface RoleReadinessV2 {
  ok: boolean; subject_id: string; role_id: string | null; role_title: string | null;
  version: string; measurable: boolean;
  readiness: { measured: boolean; score: number | null; band: string | null; label: string | null; coverage_pct: number | null };
  role_match: { fit_band: string; label: string; score: number | null; capped_by_critical: boolean };
  role_gap: {
    top_gap: { competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null; gap: number; criticality: string; blocking: boolean } | null;
    gap_areas: any[]; critical_gaps: any[]; blocking_gaps: number;
  };
  role_risk: RoleRisk;
  role_potential: RolePotential;
  ei_profile_summary: { measurable: boolean; ei_score: number | null; band: string | null; coverage_pct: number; confidence: ConfidenceShape };
  language_policy: { disclaimer: string };
  notes: string[];
}

interface IndustryReadiness {
  ok: boolean; subject_id: string; industry_id: string; industry_name: string | null;
  version: string; available: boolean; measurable: boolean;
  requirement_source: string; role_count: number; competency_count: number;
  readiness: { measured: boolean; score: number | null; band: string | null; label: string | null; coverage_pct: number | null };
  industry_fit: { fit_band: string; label: string; score: number | null; capped_by_critical: boolean };
  industry_gap: {
    top_gap: { competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null; gap: number; criticality: string; blocking: boolean } | null;
    gap_areas: any[]; critical_gaps: any[]; blocking_gaps: number;
  };
  notes: string[];
}
interface IndustryReadinessList {
  subject_id: string; version: string; industries: IndustryReadiness[]; notes: string[];
}

interface FunctionReadiness {
  ok: boolean; subject_id: string; function_id: string; function_name: string | null;
  industry_id: string | null; version: string; available: boolean; measurable: boolean;
  requirement_source: string; role_count: number; competency_count: number;
  readiness: { measured: boolean; score: number | null; band: string | null; label: string | null; coverage_pct: number | null };
  function_fit: { fit_band: string; label: string; score: number | null; capped_by_critical: boolean };
  function_gap: {
    top_gap: { competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null; gap: number; criticality: string; blocking: boolean } | null;
    gap_areas: any[]; critical_gaps: any[]; blocking_gaps: number;
  };
  notes: string[];
}
interface FunctionReadinessList {
  subject_id: string; version: string; functions: FunctionReadiness[]; notes: string[];
}

interface SignalCondition {
  competency_id: string; competency_name: string | null; onto_domain: string | null;
  direction: 'strong' | 'low'; actual_score: number | null; actual_band: string | null;
  state: 'strong' | 'moderate' | 'low' | 'unmeasured'; satisfied: boolean | null;
}
interface EvaluatedSignal {
  signal_id: string; name: string; description: string; polarity: 'positive' | 'risk'; category: string;
  status: 'fired' | 'not_met' | 'indeterminate' | 'unmeasured'; fired: boolean;
  conditions: SignalCondition[]; conditions_total: number; conditions_measured: number;
  coverage_pct: number; distinct_domains: string[];
  confidence_band: 'measured' | 'provisional' | 'unmeasured'; rationale: string; notes: string[];
}
interface EmployabilitySignals {
  ok: boolean; subject_id: string; version: string; available: boolean; measurable: boolean;
  signals_fired: EvaluatedSignal[]; signals: EvaluatedSignal[];
  summary: {
    total_signals: number; fired: number; positive_fired: number; risk_fired: number;
    indeterminate: number; unmeasured: number; conditions_total: number;
    conditions_measured: number; coverage_pct: number | null;
  };
  notes: string[];
}

interface RecTriggerEval {
  kind: 'domain_state' | 'signal';
  onto_domain?: string; domain_label?: string; direction?: 'below_strong' | 'low';
  actual_score?: number | null; actual_band?: string | null;
  signal_id?: string; signal_status?: string;
  measured: boolean; satisfied: boolean | null; summary: string;
}
interface EvaluatedRecommendation {
  recommendation_id: string; category: string; title: string; description: string;
  status: 'emitted' | 'not_applicable' | 'withheld';
  priority: 'high' | 'medium' | 'low' | null;
  confidence_band: 'measured' | 'provisional' | 'unmeasured';
  trigger: RecTriggerEval; rationale: string; notes: string[];
}
interface EmployabilityRecommendations {
  ok: boolean; subject_id: string; version: string; available: boolean; measurable: boolean;
  recommendations: EvaluatedRecommendation[];
  not_applicable: EvaluatedRecommendation[]; withheld: EvaluatedRecommendation[];
  summary: {
    total_rules: number; emitted: number; not_applicable: number; withheld: number;
    coverage_pct: number | null;
    by_category: Record<string, number>;
    by_priority: { high: number; medium: number; low: number };
  };
  notes: string[];
}

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function EiProfileDashboardPanel() {
  const qc = useQueryClient();
  const [subjectInput, setSubjectInput] = useState('demo_subj_swe');
  const [subject, setSubject] = useState('demo_subj_swe');

  const profile = useQuery<{ data: EiProfile }>({
    queryKey: ['/api/competency-ei/profile', subject],
    queryFn: () => getJSON(`/api/competency-ei/profile/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const v2 = useQuery<{ data: RoleReadinessV2 }>({
    queryKey: ['/api/competency-ei/role-readiness-v2', subject],
    queryFn: () => getJSON(`/api/competency-ei/role-readiness-v2/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const industries = useQuery<{ data: IndustryReadinessList }>({
    queryKey: ['/api/competency-ei/industry-readiness', subject],
    queryFn: () => getJSON(`/api/competency-ei/industry-readiness/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const functions = useQuery<{ data: FunctionReadinessList }>({
    queryKey: ['/api/competency-ei/function-readiness', subject],
    queryFn: () => getJSON(`/api/competency-ei/function-readiness/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const signals = useQuery<{ data: EmployabilitySignals }>({
    queryKey: ['/api/competency-ei/employability-signals', subject],
    queryFn: () => getJSON(`/api/competency-ei/employability-signals/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const recommendations = useQuery<{ data: EmployabilityRecommendations }>({
    queryKey: ['/api/competency-ei/recommendations', subject],
    queryFn: () => getJSON(`/api/competency-ei/recommendations/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const history = useQuery<{ data: any[] }>({
    queryKey: ['/api/competency-ei/profile', subject, 'history'],
    queryFn: () => getJSON(`/api/competency-ei/profile/${encodeURIComponent(subject)}/history`),
    enabled: !!subject,
  });

  // Phase 3.10 — consolidated EI Dashboard (audience-scoped projection).
  const [audience, setAudience] = useState<'candidate' | 'admin'>('admin');
  const dashboard = useQuery<{ data: any }>({
    queryKey: ['/api/competency-ei/dashboard', subject, audience],
    queryFn: () =>
      getJSON(`/api/competency-ei/${audience}-dashboard/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });

  // Phase 3.11 — History & Progression (read-only; composes persisted history).
  const progression = useQuery<{ data: any }>({
    queryKey: ['/api/competency-ei/progression', subject],
    queryFn: () => getJSON(`/api/competency-ei/progression/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const eiHistory = useQuery<{ data: any }>({
    queryKey: ['/api/competency-ei/history', subject],
    queryFn: () => getJSON(`/api/competency-ei/history/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });

  // Phase 3.12 — Super Admin Validation (read-only 10-area honesty/invariant harness).
  const superValidation = useQuery<{ data: any }>({
    queryKey: ['/api/competency-ei/super-validation', subject],
    queryFn: () => getJSON(`/api/competency-ei/super-validation/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });

  const snapshot = useMutation({
    mutationFn: () =>
      fetch(`/api/competency-ei/profile/${encodeURIComponent(subject)}/snapshot`, {
        method: 'POST', credentials: 'include',
      }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/competency-ei/profile', subject, 'history'] });
    },
  });

  const p = profile.data?.data;
  const r = v2.data?.data;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
            <UserCheck className="h-6 w-6" /> Candidate Employability Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Composes the employability scoring chain into a candidate profile (Overall EI, dimensions,
            strengths, development areas, critical risks, growth potential), a five-component role view,
            industry & function readiness, employability signals, recommendations, and a consolidated
            audience-scoped EI Dashboard with Trend Analysis, a History &amp; Progression view
            (assessment history, EI history, growth / improvement / decline), and a 10-area Super Admin
            Validation harness. Read-only · additive · flag-gated. <span className="text-gray-400">Phase 3.4 + 3.5 + 3.6 + 3.7 + 3.8 + 3.9 + 3.10 + 3.11 + 3.12</span>
          </p>
        </div>
      </div>

      {/* Subject selector */}
      <div className="bg-white rounded-xl border p-4 flex items-center gap-3 flex-wrap">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[220px]"
          value={subjectInput}
          onChange={(e) => setSubjectInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSubject(subjectInput.trim()); }}
          placeholder="Subject id (e.g. demo_subj_swe)"
          data-testid="input-eiprofile-subject"
        />
        <button
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: BRAND.primary }}
          onClick={() => setSubject(subjectInput.trim())}
          data-testid="button-eiprofile-load"
        >Load</button>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-1.5 disabled:opacity-50"
          style={{ color: BRAND.primary, borderColor: BRAND.primary }}
          disabled={snapshot.isPending || !p?.measurable}
          onClick={() => snapshot.mutate()}
          data-testid="button-eiprofile-snapshot"
          title={p?.measurable ? 'Append an immutable profile snapshot' : 'Not measurable — nothing to capture'}
        >
          <Camera className="h-4 w-4" /> {snapshot.isPending ? 'Capturing…' : 'Capture Snapshot'}
        </button>
      </div>

      {/* ===================== Phase 3.10 — EI Dashboard ===================== */}
      {(() => {
        const d = dashboard.data?.data;
        const overallScore = d?.overall_ei?.ei_score ?? d?.headline?.overall_ei ?? null;
        const overallBand = d?.overall_ei?.band ?? d?.headline?.band ?? null;
        const roleBand = d?.role_readiness?.readiness?.band ?? d?.role_readiness?.band ?? null;
        const roleTitle = d?.role_readiness?.role_title ?? null;
        const industryBest = d?.industry_readiness?.best ?? d?.industry_best ?? null;
        const functionBest = d?.function_readiness?.best ?? d?.function_best ?? null;
        const signalsFired = d?.signals?.summary?.fired ?? d?.supportive_signals?.length ?? null;
        const recsCount = d?.recommendations?.summary?.emitted
          ?? (Array.isArray(d?.recommendations) ? d.recommendations.length : null);
        const t = d?.trend;
        const dirColor = t?.direction === 'improving' ? '#16a34a'
          : t?.direction === 'declining' ? '#dc2626' : '#6b7280';
        const DirIcon = t?.direction === 'improving' ? ArrowUp
          : t?.direction === 'declining' ? ArrowDown : Minus;
        const maxScore = Math.max(1, ...(t?.points ?? []).map((p: any) => p.ei_score ?? 0));

        return (
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: BRAND.primary }}>
                <LayoutDashboard className="h-5 w-5" /> EI Dashboard
                <span className="text-xs font-normal text-gray-400">(Phase 3.10 · composed)</span>
              </h2>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {(['candidate', 'admin'] as const).map((a) => (
                  <button
                    key={a}
                    className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors"
                    style={audience === a
                      ? { backgroundColor: BRAND.primary, color: '#fff' }
                      : { color: '#6b7280' }}
                    onClick={() => setAudience(a)}
                    data-testid={`button-eidash-audience-${a}`}
                  >{a}</button>
                ))}
              </div>
            </div>

            {dashboard.isLoading && <div className="text-gray-500 text-sm">Loading dashboard…</div>}
            {dashboard.isError && <div className="text-red-600 text-sm">Failed to load dashboard.</div>}

            {d && d.status === 'unmeasured' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                {d.headline?.summary ?? 'Not yet measured — complete an assessment to generate this dashboard.'}
              </div>
            )}

            {d && d.status !== 'unmeasured' && (
              <>
                {/* Consolidated headline cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Overall EI', value: overallScore ?? '—', sub: overallBand ?? 'n/a', color: BAND_COLOR[overallBand ?? ''] ?? BRAND.primary },
                    { label: 'Role Readiness', value: roleBand ?? '—', sub: roleTitle ?? 'no role', color: BAND_COLOR[roleBand ?? ''] ?? '#6b7280' },
                    { label: 'Industry (best)', value: industryBest?.band ?? '—', sub: industryBest?.name ?? industryBest?.id ?? 'unmeasured', color: BAND_COLOR[industryBest?.band ?? ''] ?? '#6b7280' },
                    { label: 'Function (best)', value: functionBest?.band ?? '—', sub: functionBest?.name ?? functionBest?.id ?? 'unmeasured', color: BAND_COLOR[functionBest?.band ?? ''] ?? '#6b7280' },
                    { label: 'Signals fired', value: signalsFired ?? '—', sub: 'developmental', color: BRAND.primary },
                    { label: 'Recommendations', value: recsCount ?? '—', sub: 'emitted', color: BRAND.primary },
                  ].map((c) => (
                    <div key={c.label} className="border rounded-lg p-3 text-center">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">{c.label}</div>
                      <div className="text-xl font-bold mt-1 truncate" style={{ color: c.color }}>{c.value}</div>
                      <div className="text-[11px] text-gray-400 truncate" title={String(c.sub)}>{c.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Trend Analysis */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Activity className="h-4 w-4" /> Trend Analysis
                    </div>
                    {t?.available && (
                      <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: dirColor }}>
                        <DirIcon className="h-4 w-4" />
                        {t.direction}
                        {t.delta != null && <span>({t.delta > 0 ? '+' : ''}{t.delta} pts)</span>}
                      </div>
                    )}
                  </div>

                  {!t?.available ? (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                      {t?.message ?? 'Trend unavailable.'}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end gap-2 h-24">
                        {(t.points ?? []).filter((pt: any) => pt.ei_score != null).map((pt: any, i: number) => (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${pt.ei_score} (${pt.band ?? 'n/a'}) · ${new Date(pt.captured_at).toLocaleDateString()}`}>
                            <div className="text-[10px] text-gray-500">{pt.ei_score}</div>
                            <div
                              className="w-full rounded-t"
                              style={{ height: `${Math.max(6, ((pt.ei_score ?? 0) / maxScore) * 72)}px`, backgroundColor: BAND_COLOR[pt.band ?? ''] ?? BRAND.accent }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {t.message} {t.snapshots_measured}/{t.snapshots_total} snapshots measured.
                      </div>
                    </>
                  )}
                </div>

                {/* Admin-only honesty diagnostics */}
                {audience === 'admin' && d.diagnostics && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      Honesty diagnostics (Coverage vs firing are separate axes)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-gray-600">
                      {(d.diagnostics.data_availability ?? []).map((s: any) => (
                        <div key={s.section} className="flex items-center gap-2">
                          {s.available
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            : <Info className="h-3.5 w-3.5 text-gray-400" />}
                          <span className="font-medium">{s.section}</span>
                          <span className="text-gray-400">— {s.available ? 'available' : (s.reason ?? 'unavailable')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-2">
                      Recommendations: {d.diagnostics.recommendations?.emitted ?? 0} emitted ·{' '}
                      {d.diagnostics.recommendations?.not_applicable ?? 0} not needed ·{' '}
                      {d.diagnostics.recommendations?.withheld ?? 0} withheld ·{' '}
                      profile coverage {d.diagnostics.profile?.coverage_pct ?? 0}%.
                    </div>
                  </div>
                )}

                {audience === 'candidate' && d.disclaimer && (
                  <div className="text-[11px] text-gray-400 italic">{d.disclaimer}</div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ============== Phase 3.11 — History & Progression ============== */}
      {(() => {
        const prog = progression.data?.data;
        const hist = eiHistory.data?.data;
        const ov = prog?.overall;
        const ready = ov?.status === 'ready';
        const dir = ov?.direction as ('growth' | 'decline' | 'stable' | null) | undefined;
        const dirColor = dir === 'growth' ? '#16a34a' : dir === 'decline' ? '#dc2626' : '#6b7280';
        const DirIcon = dir === 'growth' ? ArrowUp : dir === 'decline' ? ArrowDown : Minus;
        const growth = prog?.rollup?.growth_areas ?? [];
        const decline = prog?.rollup?.decline_areas ?? [];
        const assessRuns = hist?.assessment_history?.runs ?? [];
        const eiSnaps = hist?.ei_history?.snapshots ?? [];

        return (
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: BRAND.primary }}>
                <Activity className="h-5 w-5" /> History &amp; Progression
              </h2>
              <span className="text-xs font-normal text-gray-400">(Phase 3.11 · composed)</span>
            </div>

            {(progression.isLoading || eiHistory.isLoading) && (
              <div className="text-gray-500 text-sm">Loading history…</div>
            )}

            {/* Overall progression headline */}
            {ready ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${dirColor}14` }}>
                  <DirIcon className="h-5 w-5" style={{ color: dirColor }} />
                  <span className="font-semibold capitalize" style={{ color: dirColor }}>{dir}</span>
                  <span className="text-sm text-gray-600">
                    net {ov.net_delta >= 0 ? '+' : ''}{ov.net_delta} pts across {ov.snapshots_measured} measured snapshot(s)
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-600 flex items-start gap-2">
                <Info className="h-4 w-4 text-gray-400 mt-0.5" />
                <span>{ov?.message ?? 'Not enough measured snapshots to assess progression yet (at least two are required).'}</span>
              </div>
            )}

            {/* Growth / Improvement / Decline rollup */}
            {ready && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1 mb-2">
                    <ArrowUp className="h-3.5 w-3.5 text-green-600" /> Growth / Improvement
                  </div>
                  {growth.length ? growth.map((g: any) => (
                    <div key={g.ei_dimension_id} className="flex justify-between text-sm py-0.5">
                      <span className="truncate">{g.dimension_name ?? g.ei_dimension_id}</span>
                      <span className="text-green-600 font-medium">+{g.net_delta}</span>
                    </div>
                  )) : <div className="text-xs text-gray-400 italic">No dimension improvements measured.</div>}
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1 mb-2">
                    <ArrowDown className="h-3.5 w-3.5 text-red-600" /> Decline
                  </div>
                  {decline.length ? decline.map((g: any) => (
                    <div key={g.ei_dimension_id} className="flex justify-between text-sm py-0.5">
                      <span className="truncate">{g.dimension_name ?? g.ei_dimension_id}</span>
                      <span className="text-red-600 font-medium">{g.net_delta}</span>
                    </div>
                  )) : <div className="text-xs text-gray-400 italic">No dimension declines measured.</div>}
                </div>
              </div>
            )}

            {prog?.rollup?.improvement_summary && (
              <div className="text-xs text-gray-500 italic">{prog.rollup.improvement_summary}</div>
            )}

            {/* History timelines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="border rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                  Assessment History ({hist?.assessment_history?.count ?? 0})
                </div>
                {assessRuns.length ? assessRuns.slice(0, 8).map((run: any) => (
                  <div key={run.id} className="flex justify-between text-xs py-0.5 text-gray-600">
                    <span>{new Date(run.created_at).toLocaleDateString()}</span>
                    <span>{run.ei_score ?? '—'} {run.ei_band ? `(${run.ei_band})` : ''}</span>
                  </div>
                )) : <div className="text-xs text-gray-400 italic">No scoring runs captured yet.</div>}
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                  EI History ({hist?.ei_history?.count ?? 0})
                </div>
                {eiSnaps.length ? eiSnaps.slice(0, 8).map((s: any) => (
                  <div key={s.id} className="flex justify-between text-xs py-0.5 text-gray-600">
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                    <span>{s.ei_score ?? '—'} {s.ei_band ? `(${s.ei_band})` : ''}</span>
                  </div>
                )) : <div className="text-xs text-gray-400 italic">No EI snapshots captured yet.</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============== Phase 3.12 — Super Admin Validation ============== */}
      {subject && <SuperValidationSection query={superValidation} />}

      {profile.isLoading && <div className="text-gray-500 text-sm">Loading profile…</div>}
      {profile.isError && <div className="text-red-600 text-sm">Failed to load profile.</div>}

      {p && !p.measurable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Not measurable</p>
            <p className="text-sm text-amber-700 mt-1">
              {p.notes?.[0] ?? 'This subject has no measured employability profile.'}
            </p>
          </div>
        </div>
      )}

      {p && p.measurable && (
        <>
          {/* Overall EI + Coverage + Confidence — separate axes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Gauge className="h-4 w-4" /> Overall EI
              </div>
              <div className="text-5xl font-bold" style={{ color: BAND_COLOR[p.overall_ei.band ?? ''] ?? BRAND.primary }}>
                {p.overall_ei.ei_score ?? '—'}
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: BAND_COLOR[p.overall_ei.band ?? ''] ?? '#6b7280' }}>
                {p.overall_ei.band ?? 'n/a'} <span className="text-gray-400">(developmental band)</span>
              </div>
              {p.role_id && <div className="text-xs text-gray-400 mt-2">Role: {p.role_id}</div>}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Layers className="h-4 w-4" /> Coverage <span className="text-gray-300">(how much measured)</span>
              </div>
              <MeterRow label="EI coverage" pct={p.overall_ei.coverage_pct} />
              <div className="text-xs text-gray-500 mt-2">
                {p.dimension_scores.filter((d) => d.measurable).length}/{p.dimension_scores.length} dimensions measurable
              </div>
            </div>

            <ConfidenceCard conf={p.confidence} />
          </div>

          {/* Dimension scores */}
          <Section icon={<Target className="h-4 w-4" />} title={`Dimension Scores (${p.dimension_scores.length})`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {p.dimension_scores.map((d) => (
                <div key={d.ei_dimension_id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-800">{d.dimension_name}</div>
                    {d.measurable && d.score != null ? (
                      <div className="text-xl font-bold" style={{ color: BAND_COLOR[d.band ?? ''] ?? BRAND.primary }}>
                        {d.score}<span className="text-xs font-medium ml-1.5">{d.band}</span>
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-gray-400 italic">Not measurable</div>
                    )}
                  </div>
                  {d.measurable && d.score != null
                    ? <div className="mt-1.5"><MeterRow label="Coverage" pct={d.coverage_pct} /></div>
                    : <div className="text-xs text-gray-400 mt-1">{d.reason ?? 'No mapped, measured competencies.'}</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* Strengths + Development + Risks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section icon={<Sparkles className="h-4 w-4 text-green-600" />} title={`Strength Areas (${p.strength_areas.length})`}>
              {p.strength_areas.length === 0 && <Empty text="No strength-level dimensions surfaced." />}
              {p.strength_areas.map((s) => (
                <div key={s.ei_dimension_id} className="border-l-2 border-green-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{s.dimension_name} <span className="text-green-700">· {s.score}</span></div>
                  <div className="text-xs text-gray-500">{s.rationale}</div>
                </div>
              ))}
            </Section>

            <Section icon={<Target className="h-4 w-4 text-amber-600" />} title={`Development Areas (${p.development_areas.length})`}>
              {p.development_areas.length === 0 && <Empty text="No development gaps surfaced." />}
              {p.development_areas.map((dv) => (
                <div key={dv.ei_dimension_id} className="border-l-2 border-amber-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{dv.dimension_name} <span className="text-amber-700">· {dv.score ?? '?'}</span></div>
                  <div className="text-xs text-gray-500">{dv.rationale}</div>
                </div>
              ))}
            </Section>

            <Section icon={<ShieldAlert className="h-4 w-4 text-red-600" />} title={`Critical Risks (${p.critical_risks.length})`}>
              {p.critical_risks.length === 0 && <Empty text="No critical risks flagged." />}
              {p.critical_risks.map((cr, i) => (
                <div key={`${cr.type}-${cr.ei_dimension_id ?? i}`} className="border-l-2 border-red-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{cr.dimension_name ?? cr.type.replace(/_/g, ' ')} <span className="text-[10px] uppercase tracking-wide text-gray-400">{cr.severity}</span></div>
                  <div className="text-xs text-gray-500">{cr.detail}</div>
                </div>
              ))}
            </Section>
          </div>

          {/* Growth potential */}
          <Section icon={<TrendingUp className="h-4 w-4" style={{ color: BRAND.accent }} />} title="Growth Potential">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: LEVEL_COLOR[p.growth_potential.level] ?? BRAND.primary }}>
                  {p.growth_potential.score ?? '—'}
                </div>
                <div className="text-xs font-medium" style={{ color: LEVEL_COLOR[p.growth_potential.level] ?? '#6b7280' }}>
                  {p.growth_potential.level}
                </div>
              </div>
              <div className="flex-1 min-w-[240px]">
                {p.growth_potential.drivers.map((dr, i) => (
                  <div key={i} className="text-xs text-gray-600">• {dr}</div>
                ))}
                <div className="text-[11px] text-gray-400 mt-1.5">{p.growth_potential.reason}</div>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ============ Phase 3.5 — Role Readiness V2 ============ */}
      <div className="border-t pt-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: BRAND.primary }}>
          <Gauge className="h-5 w-5" /> Role Readiness V2 <span className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Phase 3.5</span>
        </h2>
        {v2.isLoading && <div className="text-gray-500 text-sm">Loading role readiness…</div>}
        {v2.isError && <div className="text-red-600 text-sm">Failed to load role readiness.</div>}

        {r && !r.measurable && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 mt-2">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Role readiness unmeasured</p>
              <p className="text-sm text-amber-700 mt-1">{r.notes?.[0] ?? 'No scored profile or no linked role.'}</p>
            </div>
          </div>
        )}

        {r && r.measurable && (
          <div className="space-y-4 mt-3">
            <div className="text-sm text-gray-600">
              Role: <span className="font-semibold text-gray-800">{r.role_title ?? r.role_id ?? '—'}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <V2Card label="Readiness" value={r.readiness.score} suffix="%" sub={r.readiness.label ?? r.readiness.band ?? ''} color={BAND_COLOR[r.readiness.band ?? ''] ?? BRAND.primary} />
              <V2Card label="Match" value={r.role_match.score} suffix="%" sub={r.role_match.label} color={BRAND.accent} />
              <V2Card label="Gap" value={r.role_gap.gap_areas.length} sub={r.role_gap.blocking_gaps > 0 ? `${r.role_gap.blocking_gaps} critical` : 'no critical'} color={r.role_gap.blocking_gaps > 0 ? '#dc2626' : '#6b7280'} />
              <V2Card label="Risk" value={r.role_risk.score} sub={r.role_risk.level} color={RISK_COLOR[r.role_risk.level] ?? '#6b7280'} />
              <V2Card label="Potential" value={r.role_potential.score} sub={r.role_potential.level} color={LEVEL_COLOR[r.role_potential.level] ?? '#6b7280'} />
            </div>

            {/* Coverage caveat */}
            {r.readiness.coverage_pct != null && r.readiness.coverage_pct < 100 && (
              <div className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {Math.round(100 - r.readiness.coverage_pct)}% of role weight unassessed — readiness is provisional (Coverage and readiness are separate axes).
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section icon={<Target className="h-4 w-4 text-amber-600" />} title="Top Gap">
                {r.role_gap.top_gap ? (
                  <div className="border-l-2 border-amber-400 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-800">{r.role_gap.top_gap.competency_name ?? r.role_gap.top_gap.competency_id}</div>
                    <div className="text-xs text-gray-500">
                      {r.role_gap.top_gap.actual_level ?? '?'} → {r.role_gap.top_gap.required_level} · gap {r.role_gap.top_gap.gap}
                      {r.role_gap.top_gap.blocking && <span className="text-red-600"> · critical</span>}
                    </div>
                  </div>
                ) : <Empty text="No gaps — role requirements met." />}
              </Section>

              <Section icon={<ShieldAlert className="h-4 w-4 text-red-600" />} title={`Risk Factors (${r.role_risk.factors.length})`}>
                {r.role_risk.factors.length === 0 && <Empty text="No risk factors." />}
                {r.role_risk.factors.map((f) => (
                  <FactorRow key={f.key} f={f} />
                ))}
                {r.role_risk.notes.map((n, i) => <div key={i} className="text-[11px] text-gray-400 mt-1">{n}</div>)}
              </Section>

              <Section icon={<TrendingUp className="h-4 w-4" style={{ color: BRAND.accent }} />} title={`Potential Factors (${r.role_potential.factors.length})`}>
                {r.role_potential.factors.length === 0 && <Empty text="No potential factors." />}
                {r.role_potential.factors.map((f) => (
                  <FactorRow key={f.key} f={f} />
                ))}
                {r.role_potential.notes.map((n, i) => <div key={i} className="text-[11px] text-gray-400 mt-1">{n}</div>)}
              </Section>
            </div>
          </div>
        )}
      </div>

      {/* ============ Phase 3.6 — Industry Readiness ============ */}
      <div className="border-t pt-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: BRAND.primary }}>
          <Building2 className="h-5 w-5" /> Industry Readiness <span className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Phase 3.6</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Readiness, fit, and gaps against each industry's aggregated competency demand (derived from its roles).
          Coverage and readiness are separate axes; unseeded industries are reported as unavailable, never assumed.
        </p>
        {industries.isLoading && <div className="text-gray-500 text-sm">Loading industry readiness…</div>}
        {industries.isError && <div className="text-red-600 text-sm">Failed to load industry readiness.</div>}

        {industries.data?.data && (
          <>
            {industries.data.data.industries.length === 0 && (
              <Empty text={industries.data.data.notes?.[0] ?? 'No industries available.'} />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {industries.data.data.industries.map((ind) => (
                <div key={ind.industry_id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-gray-800">{ind.industry_name ?? ind.industry_id}</div>
                    <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full"
                      style={{ color: FIT_COLOR[ind.industry_fit.fit_band] ?? '#6b7280', backgroundColor: (FIT_COLOR[ind.industry_fit.fit_band] ?? '#6b7280') + '1a' }}>
                      {ind.industry_fit.label}
                    </span>
                  </div>

                  {!ind.available && (
                    <div className="text-xs text-amber-700 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {ind.notes?.find((n) => /unavailable|no role|not in the curated/i.test(n)) ?? ind.notes?.[ind.notes.length - 1] ?? 'Unavailable.'}
                    </div>
                  )}

                  {ind.available && !ind.measurable && (
                    <div className="text-xs text-amber-700 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Requirements derived from {ind.role_count} role(s) · {ind.competency_count} competencies — but this subject has no scores covering them (unmeasured, not assumed).
                    </div>
                  )}

                  {ind.available && ind.measurable && (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-2">
                        <V2Card label="Readiness" value={ind.readiness.score} suffix="%" sub={ind.readiness.label ?? ind.readiness.band ?? ''} color={BAND_COLOR[ind.readiness.band ?? ''] ?? BRAND.primary} />
                        <V2Card label="Coverage" value={ind.readiness.coverage_pct} suffix="%" sub={`${ind.competency_count} comp · ${ind.role_count} roles`} color={BRAND.accent} />
                        <V2Card label="Critical Gaps" value={ind.industry_gap.blocking_gaps} sub={ind.industry_gap.blocking_gaps > 0 ? 'blocking' : 'none'} color={ind.industry_gap.blocking_gaps > 0 ? '#dc2626' : '#16a34a'} />
                      </div>
                      {ind.readiness.coverage_pct != null && ind.readiness.coverage_pct < 100 && (
                        <div className="text-xs text-amber-700 flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="h-3.5 w-3.5" /> {Math.round(100 - ind.readiness.coverage_pct)}% of industry demand unassessed — readiness is provisional.
                        </div>
                      )}
                      {ind.industry_gap.top_gap ? (
                        <div className="border-l-2 border-amber-400 pl-3 py-1">
                          <div className="text-[11px] uppercase tracking-wide text-gray-400">Top Gap</div>
                          <div className="text-sm font-medium text-gray-800">{ind.industry_gap.top_gap.competency_name ?? ind.industry_gap.top_gap.competency_id}</div>
                          <div className="text-xs text-gray-500">
                            {ind.industry_gap.top_gap.actual_level ?? '?'} → {ind.industry_gap.top_gap.required_level} · gap {ind.industry_gap.top_gap.gap}
                            {ind.industry_gap.top_gap.blocking && <span className="text-red-600"> · critical</span>}
                          </div>
                        </div>
                      ) : <Empty text="No gaps — industry demand met." />}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ============ Phase 3.7 — Function Readiness ============ */}
      <div className="border-t pt-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: BRAND.primary }}>
          <Layers className="h-5 w-5" /> Function Readiness <span className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Phase 3.7</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Readiness, fit, and gaps against each function's aggregated competency demand (derived from its roles).
          Coverage and readiness are separate axes; unseeded functions are reported as unavailable, never assumed.
        </p>
        {functions.isLoading && <div className="text-gray-500 text-sm">Loading function readiness…</div>}
        {functions.isError && <div className="text-red-600 text-sm">Failed to load function readiness.</div>}

        {functions.data?.data && (
          <>
            {functions.data.data.functions.length === 0 && (
              <Empty text={functions.data.data.notes?.[0] ?? 'No functions available.'} />
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {functions.data.data.functions.map((fn) => (
                <div key={fn.function_id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-gray-800">{fn.function_name ?? fn.function_id}</div>
                    <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full"
                      style={{ color: FIT_COLOR[fn.function_fit.fit_band] ?? '#6b7280', backgroundColor: (FIT_COLOR[fn.function_fit.fit_band] ?? '#6b7280') + '1a' }}>
                      {fn.function_fit.label}
                    </span>
                  </div>

                  {!fn.available && (
                    <div className="text-xs text-amber-700 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {fn.notes?.find((n) => /unavailable|no role|not in the curated/i.test(n)) ?? fn.notes?.[fn.notes.length - 1] ?? 'Unavailable.'}
                    </div>
                  )}

                  {fn.available && !fn.measurable && (
                    <div className="text-xs text-amber-700 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Requirements derived from {fn.role_count} role(s) · {fn.competency_count} competencies — but this subject has no scores covering them (unmeasured, not assumed).
                    </div>
                  )}

                  {fn.available && fn.measurable && (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-2">
                        <V2Card label="Readiness" value={fn.readiness.score} suffix="%" sub={fn.readiness.label ?? fn.readiness.band ?? ''} color={BAND_COLOR[fn.readiness.band ?? ''] ?? BRAND.primary} />
                        <V2Card label="Coverage" value={fn.readiness.coverage_pct} suffix="%" sub={`${fn.competency_count} comp · ${fn.role_count} roles`} color={BRAND.accent} />
                        <V2Card label="Critical Gaps" value={fn.function_gap.blocking_gaps} sub={fn.function_gap.blocking_gaps > 0 ? 'blocking' : 'none'} color={fn.function_gap.blocking_gaps > 0 ? '#dc2626' : '#16a34a'} />
                      </div>
                      {fn.readiness.coverage_pct != null && fn.readiness.coverage_pct < 100 && (
                        <div className="text-xs text-amber-700 flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="h-3.5 w-3.5" /> {Math.round(100 - fn.readiness.coverage_pct)}% of function demand unassessed — readiness is provisional.
                        </div>
                      )}
                      {fn.function_gap.top_gap ? (
                        <div className="border-l-2 border-amber-400 pl-3 py-1">
                          <div className="text-[11px] uppercase tracking-wide text-gray-400">Top Gap</div>
                          <div className="text-sm font-medium text-gray-800">{fn.function_gap.top_gap.competency_name ?? fn.function_gap.top_gap.competency_id}</div>
                          <div className="text-xs text-gray-500">
                            {fn.function_gap.top_gap.actual_level ?? '?'} → {fn.function_gap.top_gap.required_level} · gap {fn.function_gap.top_gap.gap}
                            {fn.function_gap.top_gap.blocking && <span className="text-red-600"> · critical</span>}
                          </div>
                        </div>
                      ) : <Empty text="No gaps — function demand met." />}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ============ Phase 3.8 — Employability Signals ============ */}
      <div className="border-t pt-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: BRAND.primary }}>
          <Gauge className="h-5 w-5" /> Employability Signals <span className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Phase 3.8</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Higher-order signals composed from measured competency strengths/weaknesses against a curated rule library.
          A signal fires only when every contributing competency is measured and satisfies the rule — never on partial
          evidence (shown as indeterminate). Developmental signals only, never hiring/promotion verdicts.
        </p>
        {signals.isLoading && <div className="text-gray-500 text-sm">Loading employability signals…</div>}
        {signals.isError && <div className="text-red-600 text-sm">Failed to load employability signals.</div>}

        {signals.data?.data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <V2Card label="Signals Fired" value={signals.data.data.summary.fired} sub={`of ${signals.data.data.summary.total_signals}`} color={BRAND.primary} />
              <V2Card label="Positive" value={signals.data.data.summary.positive_fired} sub="potential" color="#16a34a" />
              <V2Card label="Risk" value={signals.data.data.summary.risk_fired} sub="to support" color="#dc2626" />
              <V2Card label="Coverage" value={signals.data.data.summary.coverage_pct} suffix="%" sub="conditions measured" color={BRAND.accent} />
            </div>
            {!signals.data.data.measurable && (
              <div className="text-xs text-amber-700 flex items-start gap-1.5 mb-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {signals.data.data.notes?.find((n) => /unmeasured|no scored|no measurable/i.test(n)) ?? signals.data.data.notes?.[1] ?? 'Unmeasured.'}
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {signals.data.data.signals.map((sig) => (
                <div key={sig.signal_id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-bold text-gray-800">{sig.name}</div>
                    <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full"
                      style={{ color: SIGNAL_STATUS_COLOR[sig.status] ?? '#6b7280', backgroundColor: (SIGNAL_STATUS_COLOR[sig.status] ?? '#6b7280') + '1a' }}>
                      {SIGNAL_STATUS_LABEL[sig.status] ?? sig.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{sig.description}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium"
                      style={{ color: sig.polarity === 'risk' ? '#dc2626' : '#16a34a', backgroundColor: (sig.polarity === 'risk' ? '#dc2626' : '#16a34a') + '1a' }}>
                      {sig.polarity}
                    </span>
                    <span className="text-[11px] text-gray-400">Coverage {sig.coverage_pct}% · {sig.confidence_band}</span>
                  </div>
                  <div className="space-y-1">
                    {sig.conditions.map((c) => (
                      <div key={c.competency_id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-600">
                          {c.direction === 'low' ? 'Low' : 'Strong'} {c.competency_name ?? c.competency_id}
                        </span>
                        <span className="font-medium shrink-0" style={{ color: SIGNAL_STATE_COLOR[c.state] ?? '#6b7280' }}>
                          {c.actual_score != null ? `${c.actual_score} ${c.actual_band ?? ''}` : 'unmeasured'}
                          {c.satisfied === true && ' ✓'}
                          {c.satisfied === false && ' ✕'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {sig.distinct_domains.length > 0 && sig.distinct_domains.length < sig.conditions_total && (
                    <div className="text-[11px] text-amber-700 flex items-start gap-1.5 mt-2">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" /> {sig.conditions_total} competencies resolve through {sig.distinct_domains.length} domain proxy(ies) — they currently share a score.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ============ Phase 3.9 — Employability Recommendations ============ */}
      <div className="border-t pt-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: BRAND.primary }}>
          <Gauge className="h-5 w-5" /> Employability Recommendations <span className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Phase 3.9</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Actionable recommendations composed from measured capability gaps/strengths and Phase-3.8 signals against a
          curated rule library (Development · Certification · Project · Experience · Behavioral). A recommendation is
          surfaced only when its trigger is measured and satisfied; an unmeasured trigger is withheld (never recommended
          on absent evidence) and a measured-but-untriggered one is shown as Not Needed. Developmental suggestions only,
          never hiring/promotion verdicts.
        </p>
        {recommendations.isLoading && <div className="text-gray-500 text-sm">Loading recommendations…</div>}
        {recommendations.isError && <div className="text-red-600 text-sm">Failed to load recommendations.</div>}

        {recommendations.data?.data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <V2Card label="Recommended" value={recommendations.data.data.summary.emitted} sub={`of ${recommendations.data.data.summary.total_rules} rules`} color={BRAND.primary} />
              <V2Card label="High Priority" value={recommendations.data.data.summary.by_priority.high} sub="urgent" color="#dc2626" />
              <V2Card label="Withheld" value={recommendations.data.data.summary.withheld} sub="unmeasured" color="#ca8a04" />
              <V2Card label="Coverage" value={recommendations.data.data.summary.coverage_pct} suffix="%" sub="triggers measured" color={BRAND.accent} />
            </div>
            {!recommendations.data.data.measurable && (
              <div className="text-xs text-amber-700 flex items-start gap-1.5 mb-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {recommendations.data.data.notes?.find((n) => /no scored|no measurable|withheld/i.test(n)) ?? recommendations.data.data.notes?.[1] ?? 'Unmeasured.'}
              </div>
            )}
            {recommendations.data.data.recommendations.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                {recommendations.data.data.recommendations.map((rec) => (
                  <div key={rec.recommendation_id} className="bg-white rounded-xl border p-5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-sm font-bold text-gray-800">{rec.title}</div>
                      {rec.priority && (
                        <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full"
                          style={{ color: REC_PRIORITY_COLOR[rec.priority] ?? '#6b7280', backgroundColor: (REC_PRIORITY_COLOR[rec.priority] ?? '#6b7280') + '1a' }}>
                          {rec.priority}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{rec.description}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium"
                        style={{ color: BRAND.accent, backgroundColor: BRAND.accent + '1a' }}>
                        {REC_CATEGORY_LABEL[rec.category] ?? rec.category}
                      </span>
                      <span className="text-[11px] text-gray-400">{rec.confidence_band}</span>
                    </div>
                    <div className="text-xs text-gray-600">{rec.trigger.summary}</div>
                  </div>
                ))}
              </div>
            )}
            {recommendations.data.data.measurable && recommendations.data.data.recommendations.length === 0 && (
              <div className="text-xs text-gray-500 flex items-start gap-1.5 mb-3">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" /> No recommendations are triggered for this subject — measured capabilities are at or above the relevant thresholds and no risk signal fired.
              </div>
            )}
            {(recommendations.data.data.not_applicable.length > 0 || recommendations.data.data.withheld.length > 0) && (
              <div className="bg-gray-50 rounded-xl border p-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-2">Not surfaced (honesty ledger)</div>
                <div className="space-y-1">
                  {[...recommendations.data.data.not_applicable, ...recommendations.data.data.withheld].map((rec) => (
                    <div key={rec.recommendation_id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-600">{REC_CATEGORY_LABEL[rec.category] ?? rec.category} · {rec.title}</span>
                      <span className="font-medium shrink-0" style={{ color: REC_STATUS_COLOR[rec.status] ?? '#6b7280' }}>
                        {REC_STATUS_LABEL[rec.status] ?? rec.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* History */}
      <Section icon={<HistoryIcon className="h-4 w-4" />} title={`Profile Snapshot History (${history.data?.data?.length ?? 0})`}>
        {(history.data?.data?.length ?? 0) === 0 && <Empty text="No snapshots captured yet." />}
        {(history.data?.data ?? []).map((h: any) => (
          <div key={h.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
            <span className="text-gray-600">{new Date(h.created_at).toLocaleString()}</span>
            <span className="font-medium" style={{ color: BAND_COLOR[h.ei_band] ?? '#6b7280' }}>
              {h.ei_score ?? '—'} {h.ei_band ?? ''}
            </span>
            <span className="text-xs text-gray-400">
              {h.strength_count}S · {h.development_count}D · {h.risk_count}R · conf {h.confidence_band}
            </span>
          </div>
        ))}
      </Section>

      {/* Language policy */}
      {r?.language_policy?.disclaimer && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800">{r.language_policy.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function V2Card({ label, value, suffix, sub, color }: { label: string; value: number | null; suffix?: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value ?? '—'}{value != null && suffix ? suffix : ''}
      </div>
      <div className="text-[11px] font-medium mt-0.5" style={{ color }}>{sub}</div>
    </div>
  );
}

function FactorRow({ f }: { f: { label: string; contribution: number } }) {
  const positive = f.contribution >= 0;
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-0.5">
      <span className="text-gray-600">{f.label}</span>
      <span className="font-medium shrink-0" style={{ color: positive ? '#16a34a' : '#dc2626' }}>
        {positive ? '+' : ''}{f.contribution}
      </span>
    </div>
  );
}

function ConfidenceCard({ conf }: { conf: ConfidenceShape }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
        <ShieldAlert className="h-4 w-4" /> Confidence <span className="text-gray-300">(how trustworthy)</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: CONF_COLOR[conf.band] ?? '#6b7280' }}>
        {conf.score}<span className="text-base font-medium ml-2">{conf.band}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">measurement: {conf.measurement}</div>
      {conf.caps.map((c, i) => (
        <div key={i} className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {c}
        </div>
      ))}
      {conf.factors.map((f, i) => (
        <div key={i} className="text-xs text-gray-500 mt-1">• {f}</div>
      ))}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">{icon} {title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-gray-400 italic">{text}</div>;
}

function MeterRow({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="flex items-center gap-2 text-xs mb-1.5">
      <div className="w-28 text-gray-500 shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
        {pct != null && <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: BRAND.accent }} />}
      </div>
      <div className="w-12 text-right text-gray-600">{pct != null ? `${pct}%` : 'n/a'}</div>
    </div>
  );
}

// ---- Phase 3.12 — Super Admin Validation ------------------------------------

type ValStatus = 'pass' | 'warn' | 'fail';

const VAL_STYLE: Record<ValStatus, { bg: string; fg: string; border: string; label: string }> = {
  pass: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0', label: 'PASS' },
  warn: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a', label: 'WARN' },
  fail: { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', label: 'FAIL' },
};

function ValStatusIcon({ status }: { status: ValStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4" style={{ color: VAL_STYLE.pass.fg }} />;
  if (status === 'warn') return <AlertTriangle className="h-4 w-4" style={{ color: VAL_STYLE.warn.fg }} />;
  return <XCircle className="h-4 w-4" style={{ color: VAL_STYLE.fail.fg }} />;
}

function ValBadge({ status }: { status: ValStatus }) {
  const s = VAL_STYLE[status];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: s.bg, color: s.fg, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}

function ValAreaCard({ area }: { area: any }) {
  const [open, setOpen] = useState(false);
  const status: ValStatus = area.status;
  const s = VAL_STYLE[status];
  const counts = {
    pass: area.checks.filter((c: any) => c.status === 'pass').length,
    warn: area.checks.filter((c: any) => c.status === 'warn').length,
    fail: area.checks.filter((c: any) => c.status === 'fail').length,
  };
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: s.border }}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ backgroundColor: s.bg }}
        onClick={() => setOpen((o) => !o)}
        data-testid={`button-supervalidation-area-${area.id}`}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
        <ValStatusIcon status={status} />
        <span className="font-medium text-sm text-gray-800 flex-1 truncate">{area.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">{area.scope}</span>
        <span className="text-[11px] text-gray-500">
          {counts.pass}✓ {counts.warn}⚠ {counts.fail}✕
        </span>
        <ValBadge status={status} />
      </button>
      {open && (
        <div className="px-3 py-2 bg-white space-y-1.5">
          {area.checks.map((c: any) => (
            <div key={c.id} className="flex items-start gap-2 text-xs">
              <ValStatusIcon status={c.status} />
              <div className="flex-1">
                <div className="text-gray-700 font-medium">{c.label}</div>
                <div className="text-gray-500">{c.detail}</div>
              </div>
            </div>
          ))}
          {area.notes?.map((n: string, i: number) => (
            <div key={i} className="text-[11px] text-gray-400 italic flex items-start gap-1 pt-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" /> {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuperValidationSection({ query }: { query: any }) {
  const result = query.data?.data;
  const summary = result?.summary;

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: BRAND.primary }}>
          <ShieldCheck className="h-5 w-5" /> Super Admin Validation
        </h2>
        <span className="text-xs font-normal text-gray-400">(Phase 3.12 · read-only · composes every EI engine)</span>
        {result && (
          <span className="ml-auto">
            <ValBadge status={result.ok ? 'pass' : 'fail'} />
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Ten honesty &amp; structural invariants across the EI chain and platform governance. A <b>WARN</b> is an
        honest absence (not measurable / insufficient data / empty taxonomy) — never a failure. A <b>FAIL</b> is a
        real invariant break (out-of-bounds score, band/score mismatch, fabricated fire or recommendation).
      </p>

      {query.isLoading && <div className="text-gray-500 text-sm">Running validation…</div>}
      {query.isError && <div className="text-red-600 text-sm">Failed to run validation.</div>}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ['Areas passed', summary.areas_pass, 'pass'],
            ['Areas warned', summary.areas_warn, 'warn'],
            ['Areas failed', summary.areas_fail, 'fail'],
            ['Checks', `${summary.checks_pass}✓ / ${summary.checks_warn}⚠ / ${summary.checks_fail}✕`, summary.checks_fail > 0 ? 'fail' : summary.checks_warn > 0 ? 'warn' : 'pass'],
          ] as [string, any, ValStatus][]).map(([label, value, st]) => {
            const s = VAL_STYLE[st];
            return (
              <div key={label} className="rounded-lg border p-3" style={{ backgroundColor: s.bg, borderColor: s.border }}>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
                <div className="text-lg font-bold mt-0.5" style={{ color: s.fg }}>{value}</div>
              </div>
            );
          })}
        </div>
      )}

      {result?.areas && (
        <div className="space-y-2">
          {result.areas.map((a: any) => <ValAreaCard key={a.id} area={a} />)}
        </div>
      )}

      {result && (
        <div className="text-[11px] text-gray-400">
          Subject <span className="font-mono">{result.subject_id || '—'}</span> · v{result.version} ·{' '}
          {result.generated_at ? new Date(result.generated_at).toLocaleString() : ''}
        </div>
      )}
    </div>
  );
}
