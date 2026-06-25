import { BRAND } from '@/design-system/tokens';
/**
 * Phase 4 — Career Intelligence admin panel.
 *
 * Read-only viewer over `/api/career-intelligence/:subject` (+ `/validation`).
 * COMPOSES the Phase 3 Competency-EI engines (profile, dimensions, role/industry/
 * function readiness, signals, recommendations, history) into ONE career-
 * intelligence envelope across the six career deliverables — Career Readiness,
 * Career Pathways, Career Planning, Career Growth, Career Development and the
 * Career Builder cohesion summary. It never recomputes a score and never
 * fabricates: Coverage (data exists) and Confidence (trustworthy) are shown as
 * two SEPARATE axes, and `domain_proxy` caps are disclosed.
 *
 * The panel is only mounted when the `careerIntelligence` flag probe succeeds
 * (the nav item self-hides when OFF, keeping flag-OFF UI byte-identical).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Compass, Gauge, Layers, ShieldAlert, Target, Route, Map, Sparkles,
  TrendingUp, ClipboardList, AlertTriangle, CheckCircle2, Info, Search,
  GitBranch, GraduationCap, ArrowRight, Clock,
} from 'lucide-react';



interface CovConf {
  coverage: { measurable: boolean; coverage_pct: number | null; detail: string };
  confidence: { band: string; basis: string; caps: string[]; domain_proxy_capped: boolean };
}
interface ReadinessSurface {
  role: {
    role_id: string | null; role_title: string | null; measurable: boolean;
    score: number | null; band: string | null; fit_band: string;
    capped_by_critical: boolean; blocking_gaps: number; axes: CovConf;
  };
  industries: { available_count: number; measurable_count: number; items: Array<{
    industry_id: string; industry_name: string | null; available: boolean; measurable: boolean; score: number | null; band: string | null;
  }> };
  functions: { available_count: number; measurable_count: number; items: Array<{
    function_id: string; function_name: string | null; available: boolean; measurable: boolean; score: number | null; band: string | null;
  }> };
  notes: string[];
}
interface PathwaysSurface {
  anchor_role: { role_id: string | null; role_title: string | null; readiness_score: number | null; readiness_band: string | null; fit_band: string };
  gating_gaps: Array<{ competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null; gap: number; criticality: string; blocking: boolean }>;
  growth_headroom: Array<{ ei_dimension_id: string; dimension_name: string; headroom: number }>;
  axes: CovConf; note: string;
}
interface PlanningSurface {
  focus_areas: Array<{ competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null; gap: number; criticality: string; blocking: boolean }>;
  plan_actions: Array<{ recommendation_id: string; category: string; title: string; priority: string; rationale: string }>;
  growth_plan_inputs: { role_id: string | null; role_title: string | null; measurable: boolean; overall_ei: number | null; focus_competencies: string[] };
  axes: CovConf; notes: string[];
}
interface GrowthSurface {
  growth_potential: { level: string; score: number | null; rationale?: string };
  history: { assessment_runs: number; ei_snapshots: number; measured_snapshots: number; dimension_series: number };
  axes: CovConf; notes: string[];
}
interface DevelopmentSurface {
  accounting: { total_rules: number; emitted: number; not_applicable: number; withheld: number; coverage_pct: number | null; by_category: Record<string, number>; by_priority: Record<string, number> };
  emitted: Array<{ recommendation_id: string; category: string; title: string; priority: string; rationale?: string }>;
  axes: CovConf; notes: string[];
}
interface BuilderSummary {
  measurable: boolean; overall_ei: number | null; overall_band: string | null;
  role_title: string | null; role_fit_band: string; emitted_recommendations: number;
  growth_potential_level: string;
  surfaces: Array<{ id: string; label: string; measurable: boolean; note: string }>;
}
interface Envelope {
  ok: boolean; subject_id: string; version: string; generated_at: string; measurable: boolean;
  axes: CovConf;
  career_readiness: ReadinessSurface;
  career_pathways: PathwaysSurface;
  career_planning: PlanningSurface;
  career_growth: GrowthSurface;
  career_development: DevelopmentSurface;
  career_builder: BuilderSummary;
  source_versions: Record<string, string>;
  language_policy: { disclaimer: string; allowed_terms?: string[]; disallowed_terms?: string[] };
  notes: string[];
}

interface ValidationArea {
  id: string; label: string; status: string; measurable?: boolean | null;
  checks: Array<{ label: string; status: string; detail: string }>; notes?: string[];
}
interface ValidationResult {
  version: string; subject_id: string; ok: boolean;
  summary: { areas_total: number; areas_pass: number; areas_warn: number; areas_fail: number; checks_total: number; checks_pass: number; checks_warn: number; checks_fail: number };
  areas: ValidationArea[];
}

// MX-74X — Career Path engine envelope (read-only, graph-backed).
interface PathAxes {
  coverage: { measurable: boolean; coverage_pct: number | null; detail: string };
  confidence: { band: string; basis: string; caps: string[] };
}
interface CareerPathEnvelope {
  subject_id: string; measurable: boolean;
  anchor: { role_id: number | null; role_title: string | null; catalog_role_id: number | null; seniority: string | null };
  path: Array<{
    step: number; role_id: number; role_title: string; seniority: string | null;
    transition: { edge_type: string; transition_probability: number | null; avg_months_transition: number | null } | null;
  }>;
  lateral_options: Array<{ role_id: number; role_title: string; seniority: string | null; edge_type: string; transition_probability: number | null }>;
  canonical_track: { track_key: string; name: string | null; from_anchor: Array<{ step_order: number; role_id: number; role_title: string }> } | null;
  summary: { advancement_steps: number; lateral_options: number; terminal_role: string | null; horizon_months: number | null };
  axes: PathAxes; notes: string[];
}
// MX-74X — Learning Path engine envelope (read-only, gap→action→horizon).
interface LearningPathEnvelope {
  subject_id: string; measurable: boolean;
  steps: Array<{
    competency_id: string; competency_name: string | null; gap: number | null; blocking: boolean;
    horizon: string; priority_band: string; development_action: string; rec_backed: boolean;
  }>;
  unmapped_recommendations: Array<{ rec_type: string; title: string }>;
  timeline: { total_estimated_weeks: number | null; total_estimated_months: number | null; basis: string; disclaimer: string };
  summary: { total_steps: number; rec_backed_steps: number; blocking_steps: number; immediate_steps: number; unmapped_recommendations: number };
  axes: PathAxes; notes: string[];
}

const BAND_COLOR: Record<string, string> = {
  Excellent: '#15803d', Strong: '#16a34a', Developing: '#ca8a04', Emerging: '#ea580c', Early: '#dc2626',
  ready: '#16a34a', approaching: '#ca8a04', developing: '#ea580c', emerging: '#dc2626',
};
const CONF_COLOR: Record<string, string> = {
  High: '#15803d', Moderate: '#ca8a04', Limited: '#ea580c', Low: '#dc2626', None: '#6b7280',
};
const STATUS_COLOR: Record<string, string> = { pass: '#16a34a', warn: '#ca8a04', fail: '#dc2626' };

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function CareerIntelligencePanel() {
  const [subjectInput, setSubjectInput] = useState('demo_subj_pm');
  const [subject, setSubject] = useState('demo_subj_pm');

  const env = useQuery<{ data: Envelope }>({
    queryKey: ['/api/career-intelligence', subject],
    queryFn: () => getJSON(`/api/career-intelligence/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const val = useQuery<{ data: ValidationResult }>({
    queryKey: ['/api/career-intelligence', subject, 'validation'],
    queryFn: () => getJSON(`/api/career-intelligence/${encodeURIComponent(subject)}/validation`),
    enabled: !!subject,
  });
  // MX-74X — two newly-activated missing-link engines, surfaced read-only.
  const pathQ = useQuery<{ data: CareerPathEnvelope }>({
    queryKey: ['/api/career-path', subject],
    queryFn: () => getJSON(`/api/career-path/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const learnQ = useQuery<{ data: LearningPathEnvelope }>({
    queryKey: ['/api/learning-path', subject],
    queryFn: () => getJSON(`/api/learning-path/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });

  const d = env.data?.data;
  const v = val.data?.data;
  const cp = pathQ.data?.data;
  const lp = learnQ.data?.data;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
            <Compass className="h-6 w-6" /> Career Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Composes the Phase 3 EI engines into six career surfaces — Readiness · Pathways · Planning ·
            Growth · Development · Builder. Read-only · additive · flag-gated. Coverage and Confidence
            shown as separate axes; nothing fabricated.
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
          placeholder="Subject id (e.g. demo_subj_pm)"
          data-testid="input-ci-subject"
        />
        <button
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: BRAND.primary }}
          onClick={() => setSubject(subjectInput.trim())}
          data-testid="button-ci-load"
        >Load</button>
      </div>

      {env.isLoading && <div className="text-gray-500 text-sm">Loading…</div>}
      {env.isError && <div className="text-red-600 text-sm">Failed to load career intelligence.</div>}

      {d && !d.measurable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Not measurable</p>
            <p className="text-sm text-amber-700 mt-1">
              {d.notes?.[0] ?? 'This subject has no measured EI profile to compose career intelligence from.'}
            </p>
          </div>
        </div>
      )}

      {d && d.measurable && (
        <>
          {/* Builder summary + top axes — two separate axes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Gauge className="h-4 w-4" /> Overall EI (developmental)
              </div>
              <div className="text-5xl font-bold" style={{ color: BAND_COLOR[d.career_builder.overall_band ?? ''] ?? BRAND.primary }}>
                {d.career_builder.overall_ei ?? '—'}
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: BAND_COLOR[d.career_builder.overall_band ?? ''] ?? '#6b7280' }}>
                {d.career_builder.overall_band ?? 'n/a'}
              </div>
              {d.career_builder.role_title && <div className="text-xs text-gray-400 mt-2">Anchor role: {d.career_builder.role_title}</div>}
            </div>
            <CoverageCard axes={d.axes} />
            <ConfidenceCard axes={d.axes} />
          </div>

          {/* Career Builder cohesion — the six-surface shell */}
          <Section icon={<Compass className="h-4 w-4" />} title="Career Builder — surface cohesion">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {d.career_builder.surfaces.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">{s.label}</span>
                    {s.measurable
                      ? <span className="text-[10px] uppercase tracking-wide text-green-700 bg-green-50 px-1.5 py-0.5 rounded">measurable</span>
                      : <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">provisional</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{s.note}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Career Readiness */}
          <Section icon={<Target className="h-4 w-4" />} title="Career Readiness — role · industry · function">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Role</div>
                <div className="text-sm font-semibold text-gray-800">{d.career_readiness.role.role_title ?? '—'}</div>
                {d.career_readiness.role.measurable ? (
                  <>
                    <div className="text-3xl font-bold mt-1" style={{ color: BAND_COLOR[d.career_readiness.role.band ?? ''] ?? BRAND.primary }}>
                      {d.career_readiness.role.score ?? '—'}
                      <span className="text-sm font-medium ml-2">{d.career_readiness.role.band}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">fit: {d.career_readiness.role.fit_band}</div>
                    {d.career_readiness.role.capped_by_critical && (
                      <div className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        Fit capped by {d.career_readiness.role.blocking_gaps} critical gap(s)
                      </div>
                    )}
                  </>
                ) : <div className="text-xs text-gray-400 italic mt-1">Not measurable</div>}
              </div>
              <CountCard
                label="Industry readiness"
                measurable={d.career_readiness.industries.measurable_count}
                available={d.career_readiness.industries.available_count}
                items={d.career_readiness.industries.items.map(i => ({ id: i.industry_id, name: i.industry_name, measurable: i.measurable, score: i.score, band: i.band }))}
              />
              <CountCard
                label="Function readiness"
                measurable={d.career_readiness.functions.measurable_count}
                available={d.career_readiness.functions.available_count}
                items={d.career_readiness.functions.items.map(f => ({ id: f.function_id, name: f.function_name, measurable: f.measurable, score: f.score, band: f.band }))}
              />
            </div>
            <AxesRow axes={d.career_readiness.role.axes} />
          </Section>

          {/* Career Pathways */}
          <Section icon={<Route className="h-4 w-4" />} title="Career Pathways — EI-grounded overlay">
            <p className="text-xs text-gray-400 mb-3">{d.career_pathways.note}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Gating gaps ({d.career_pathways.gating_gaps.length})</div>
                {d.career_pathways.gating_gaps.length === 0 && <Empty text="No measured gating gaps." />}
                {d.career_pathways.gating_gaps.map((g, i) => (
                  <div key={i} className="border-l-2 border-amber-400 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-800">{g.competency_name ?? g.competency_id}</div>
                    <div className="text-xs text-gray-500">{g.actual_level ?? '?'} → {g.required_level} · gap {g.gap} · {g.criticality}{g.blocking ? ' · blocking' : ''}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Growth headroom ({d.career_pathways.growth_headroom.length})</div>
                {d.career_pathways.growth_headroom.length === 0 && <Empty text="No dimension headroom surfaced." />}
                {d.career_pathways.growth_headroom.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1">
                    <Map className="h-3.5 w-3.5 text-gray-400" />
                    <span className="flex-1 text-gray-700">{h.dimension_name}</span>
                    <span className="text-gray-500">+{h.headroom}</span>
                  </div>
                ))}
              </div>
            </div>
            <AxesRow axes={d.career_pathways.axes} />
          </Section>

          {/* MX-74X — Career Path (graph-backed, real cg_role_edges) */}
          <Section icon={<GitBranch className="h-4 w-4" />} title="Career Path — graph-backed progression (MX-74X)">
            {pathQ.isLoading && <div className="text-xs text-gray-400">Loading path…</div>}
            {cp && !cp.measurable && (
              <Empty text={cp.notes?.[0] ?? 'No graph-backed path could be derived for this subject.'} />
            )}
            {cp && cp.measurable && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wide text-gray-500">Advancement</span>
                  {cp.path.map((w, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-gray-300" />}
                      <span className="inline-flex flex-col items-start rounded-lg border px-2.5 py-1">
                        <span className="text-sm font-medium text-gray-800">{w.role_title}</span>
                        <span className="text-[10px] text-gray-400">
                          {w.seniority ?? 'unranked'}
                          {w.transition && ` · ${w.transition.edge_type}`}
                          {w.transition?.transition_probability != null && ` · p=${w.transition.transition_probability}`}
                          {w.transition?.avg_months_transition != null && ` · ${w.transition.avg_months_transition}mo`}
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
                {cp.lateral_options.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Lateral options ({cp.lateral_options.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {cp.lateral_options.map((l, i) => (
                        <span key={i} className="text-xs rounded-full bg-gray-50 border px-2 py-0.5 text-gray-600">
                          {l.role_title} <span className="text-gray-400">({l.edge_type})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {cp.canonical_track && (
                  <div className="text-xs text-gray-500 mt-2">
                    Canonical track: <span className="font-medium text-gray-700">{cp.canonical_track.name ?? cp.canonical_track.track_key}</span>
                    {' · '}{cp.canonical_track.from_anchor.length} step(s) from anchor
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  {cp.summary.advancement_steps} advancement step(s) · terminal: {cp.summary.terminal_role ?? '—'}
                  {cp.summary.horizon_months != null && ` · ~${cp.summary.horizon_months}mo horizon`}
                </div>
                <AxesRow axes={cp.axes as unknown as CovConf} />
              </>
            )}
          </Section>

          {/* MX-74X — Learning Path (gap → action → horizon) */}
          <Section icon={<GraduationCap className="h-4 w-4" />} title="Learning Path — sequenced development (MX-74X)">
            {learnQ.isLoading && <div className="text-xs text-gray-400">Loading learning path…</div>}
            {lp && !lp.measurable && (
              <Empty text={lp.notes?.[0] ?? 'No measurable roadmap to sequence into a learning path.'} />
            )}
            {lp && lp.measurable && (
              <>
                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                  <MiniStat label="Steps" value={lp.summary.total_steps} color={BRAND.primary} />
                  <MiniStat label="Rec-backed" value={lp.summary.rec_backed_steps} color="#16a34a" />
                  <MiniStat label="Blocking" value={lp.summary.blocking_steps} color="#dc2626" />
                  <MiniStat label="Immediate" value={lp.summary.immediate_steps} color="#ca8a04" />
                </div>
                {lp.steps.map((s, i) => (
                  <div key={i} className="border-l-2 pl-3 py-1" style={{ borderColor: s.blocking ? '#dc2626' : '#4ECDC4' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{i + 1}. {s.competency_name ?? s.competency_id}</span>
                      {s.gap != null && <span className="text-[10px] text-gray-400">gap {s.gap}</span>}
                      {s.rec_backed
                        ? <span className="text-[10px] uppercase tracking-wide text-green-700 bg-green-50 px-1.5 py-0.5 rounded">rec-backed</span>
                        : <span className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">no rec</span>}
                    </div>
                    <div className="text-xs text-gray-500">{s.development_action}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" /> {s.horizon}</div>
                  </div>
                ))}
                <div className="text-xs text-gray-500 mt-2">
                  Est. timeline: {lp.timeline.total_estimated_months != null ? `~${lp.timeline.total_estimated_months} month(s)` : 'n/a'}
                  {lp.summary.unmapped_recommendations > 0 && ` · ${lp.summary.unmapped_recommendations} unmapped recommendation(s)`}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{lp.timeline.disclaimer}</p>
                <AxesRow axes={lp.axes as unknown as CovConf} />
              </>
            )}
          </Section>

          {/* Career Planning */}
          <Section icon={<ClipboardList className="h-4 w-4" />} title="Career Planning — focus areas → growth plan">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Focus areas ({d.career_planning.focus_areas.length})</div>
                {d.career_planning.focus_areas.length === 0 && <Empty text="No measured role gaps to focus on." />}
                {d.career_planning.focus_areas.map((f, i) => (
                  <div key={i} className="border-l-2 border-blue-400 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-800">{f.competency_name ?? f.competency_id}</div>
                    <div className="text-xs text-gray-500">gap {f.gap} · {f.criticality}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Plan actions ({d.career_planning.plan_actions.length})</div>
                {d.career_planning.plan_actions.length === 0 && <Empty text="No emitted recommendations to adopt." />}
                {d.career_planning.plan_actions.map((a, i) => (
                  <div key={i} className="border-l-2 border-teal-400 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-800">{a.title}</div>
                    <div className="text-xs text-gray-500">{a.category} · {a.priority}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              M5 growth-plan inputs: overall EI {d.career_planning.growth_plan_inputs.overall_ei ?? '—'} · {d.career_planning.growth_plan_inputs.focus_competencies.length} focus competencies
            </div>
            <AxesRow axes={d.career_planning.axes} />
          </Section>

          {/* Career Growth + Development */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section icon={<TrendingUp className="h-4 w-4" />} title="Career Growth Intelligence">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-teal-500" />
                <div>
                  <div className="text-sm font-medium text-gray-800">Growth potential: {d.career_growth.growth_potential.level}</div>
                  <div className="text-xs text-gray-500">score {d.career_growth.growth_potential.score ?? '—'}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-3 space-y-0.5">
                <div>EI snapshots: {d.career_growth.history.ei_snapshots} (measured {d.career_growth.history.measured_snapshots})</div>
                <div>Assessment runs: {d.career_growth.history.assessment_runs} · dimension series: {d.career_growth.history.dimension_series}</div>
              </div>
              <AxesRow axes={d.career_growth.axes} />
            </Section>

            <Section icon={<Layers className="h-4 w-4" />} title="Career Development Intelligence">
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Emitted" value={d.career_development.accounting.emitted} color="#16a34a" />
                <MiniStat label="Not applicable" value={d.career_development.accounting.not_applicable} color="#6b7280" />
                <MiniStat label="Withheld" value={d.career_development.accounting.withheld} color="#ca8a04" />
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Coverage {d.career_development.accounting.coverage_pct != null ? `${d.career_development.accounting.coverage_pct}%` : 'n/a'} of {d.career_development.accounting.total_rules} rules · abstention preserved (never fabricated)
              </div>
              {d.career_development.emitted.slice(0, 5).map((e, i) => (
                <div key={i} className="border-l-2 border-green-400 pl-3 py-1 mt-1">
                  <div className="text-sm font-medium text-gray-800">{e.title}</div>
                  <div className="text-xs text-gray-500">{e.category} · {e.priority}</div>
                </div>
              ))}
              <AxesRow axes={d.career_development.axes} />
            </Section>
          </div>

          {/* Validation summary */}
          {v && (
            <Section icon={<CheckCircle2 className="h-4 w-4" />} title={`Composition validation — ${v.summary.areas_pass}/${v.summary.areas_total} areas · ${v.summary.checks_pass}/${v.summary.checks_total} checks`}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {v.areas.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{a.label}</span>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: STATUS_COLOR[a.status] ?? '#6b7280' }}>
                        {a.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {a.checks.filter(c => c.status === 'pass').length}/{a.checks.length} checks pass
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Language policy */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">{d.language_policy.disclaimer}</p>
          </div>

          {d.notes.length > 0 && (
            <div className="text-xs text-gray-400">
              {d.notes.map((n, i) => <div key={i}>note: {n}</div>)}
            </div>
          )}
        </>
      )}
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

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

function CoverageCard({ axes }: { axes: CovConf }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
        <Layers className="h-4 w-4" /> Coverage <span className="text-gray-300">(how much measured)</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: BRAND.primary }}>
        {axes.coverage.coverage_pct != null ? `${axes.coverage.coverage_pct}%` : 'n/a'}
      </div>
      <div className="text-xs text-gray-500 mt-1">{axes.coverage.detail}</div>
    </div>
  );
}

function ConfidenceCard({ axes }: { axes: CovConf }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
        <ShieldAlert className="h-4 w-4" /> Confidence <span className="text-gray-300">(how trustworthy)</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: CONF_COLOR[axes.confidence.band] ?? '#6b7280' }}>
        {axes.confidence.band}
      </div>
      <div className="text-xs text-gray-400 mt-1">basis: {axes.confidence.basis}</div>
      {axes.confidence.caps.map((c, i) => (
        <div key={i} className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {c}
        </div>
      ))}
    </div>
  );
}

function AxesRow({ axes }: { axes: CovConf }) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t flex-wrap">
      <span className="flex items-center gap-1">
        <Layers className="h-3 w-3" /> Coverage: {axes.coverage.coverage_pct != null ? `${axes.coverage.coverage_pct}%` : 'n/a'}
      </span>
      <span className="flex items-center gap-1">
        <ShieldAlert className="h-3 w-3" /> Confidence: <span style={{ color: CONF_COLOR[axes.confidence.band] ?? '#6b7280' }}>{axes.confidence.band}</span>
      </span>
      {axes.confidence.domain_proxy_capped && <span className="text-amber-600">domain-proxy capped</span>}
    </div>
  );
}

function CountCard({ label, measurable, available, items }: {
  label: string; measurable: number; available: number;
  items: Array<{ id: string; name: string | null; measurable: boolean; score: number | null; band: string | null }>;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="text-sm text-gray-700">{measurable} measurable / {available} available</div>
      <div className="mt-2 space-y-1">
        {items.slice(0, 4).map((it) => (
          <div key={it.id} className="flex items-center justify-between text-xs">
            <span className="text-gray-600 truncate mr-2">{it.name ?? it.id}</span>
            {it.measurable
              ? <span className="font-medium" style={{ color: BAND_COLOR[it.band ?? ''] ?? '#6b7280' }}>{it.score ?? '—'}</span>
              : <span className="text-gray-400 italic">n/a</span>}
          </div>
        ))}
        {items.length === 0 && <Empty text="None available." />}
      </div>
    </div>
  );
}
