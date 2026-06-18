/**
 * CAPADEX PIL — Phase 6B: Runtime Intelligence Experience Layer (read-only).
 *
 *   Surfaces the ALREADY-RESOLVED runtime intelligence (Phase 6 guidance bundle +
 *   Phase 6A pipeline lineage + the canon strength profile) to three stakeholder
 *   audiences, plus a per-recommendation explainability view:
 *
 *     Student   → Top Archetypes · Key Problems · Emotional Indicators ·
 *                 Immediate Actions · 7-Day Actions · Growth Opportunities
 *     Parent    → Child Strengths · Growth Areas · Home Support Actions ·
 *                 Intervention Suggestions
 *     Counselor → Priority Risks · Priority Interventions · Recommended Follow-Ups ·
 *                 Progress Monitoring
 *     Explain   → full Response→…→Intervention lineage + "Why am I seeing this?"
 *
 * CANON (strict, identical to Phase 6 / 6A):
 *   - ADDITIVE & READ-ONLY: no writes, no recompute, no AI, no new content. Every
 *     value was authored/derived by an existing engine and persisted; this module
 *     only composes, filters, and re-frames it per audience.
 *   - DETERMINISTIC: same session → same summary (ordered + capped inputs).
 *   - GRACEFUL DEGRADATION: a missing input yields an empty section with an honest
 *     note — NEVER fabricated. Strengths come ONLY from the canon strength profile
 *     (CSI positive_factors / positive longitudinal), NEVER from raw concern signals
 *     (signals are concern-DIAGNOSTIC, not strengths). Never throws.
 *
 * The flag gate + HTTP surface live in the route; this module is the engine.
 */
import type { Pool } from 'pg';
import {
  buildGuidanceForSession,
  type GuidanceBundle,
} from './runtime-guidance-engine';
import {
  buildPipelineForSession,
  type PipelineResult,
  type PipelineHop,
  type PipelineSignal,
} from './pipeline-resolver';
import { discoverStrengths, type StrengthProfile, type StrengthItem } from '../strength-discovery-engine';

// ── Public shapes ────────────────────────────────────────────────────────────
export type StakeholderLens = 'student' | 'parent' | 'counselor';

export interface SummaryItem {
  text: string;
  label?: string | null;
  meta?: string | null;
  severity?: 'high' | 'moderate' | 'low' | null;
}

export interface SummarySection {
  key: string;
  title: string;
  items: SummaryItem[];
  /** Honest note shown when the section has no sourced content (never fabricated). */
  note?: string | null;
}

export interface StakeholderSummary {
  stakeholder: StakeholderLens;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  degraded: boolean;
  reason: string | null;
  sections: SummarySection[];
}

export interface RuntimeSummaryResult {
  enabled: true;
  degraded: boolean;
  reason: string | null;
  session_id: string;
  generated_at: string;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  summaries: Record<StakeholderLens, StakeholderSummary>;
}

export interface ExplainabilityRecommendation {
  intervention_type: string;
  intervention_text: string;
  /** Ordered, honest "why am I seeing this?" — the resolved lineage hop chain. */
  why: { step: number; label: string; summary: string }[];
}

export interface RuntimeExplainabilityResult {
  enabled: true;
  degraded: boolean;
  reason: string | null;
  session_id: string;
  generated_at: string;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  /** Full Response→…→Intervention lineage (pipeline hops, unmodified). */
  lineage: PipelineHop[];
  /** Each surfaced recommendation paired with its resolved lineage rationale. */
  recommendations: ExplainabilityRecommendation[];
}

const STAKEHOLDERS: StakeholderLens[] = ['student', 'parent', 'counselor'];

// ── Small read-only helpers (pure) ───────────────────────────────────────────

/** Pretty an enum-ish token: 'immediate_actions' → 'Immediate Actions'. */
function humanizeToken(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The activated signals captured for the session live in pipeline hop #1. */
function signalsFromPipeline(pipeline: PipelineResult): PipelineSignal[] {
  const hop = pipeline.hops.find((h) => h.key === 'response_to_signal');
  const data = (hop?.data ?? null) as { signals?: PipelineSignal[] } | null;
  const signals = Array.isArray(data?.signals) ? data!.signals! : [];
  // GENERAL_CONCERN catch-all signals are not real emotional indicators — drop them.
  return signals.filter((s) => !/general[_-]?concern/i.test(String(s.signal_key)));
}

/** Severity normaliser — maps the stored string onto a 3-level band. */
function severityBand(raw: string | null): 'high' | 'moderate' | 'low' {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('high') || s.includes('severe') || s.includes('critical') || s.includes('dominant')) return 'high';
  if (s.includes('low') || s.includes('mild') || s.includes('minimal')) return 'low';
  return 'moderate';
}

const SEVERITY_RANK: Record<'high' | 'moderate' | 'low', number> = { high: 0, moderate: 1, low: 2 };

// Canon (mirrors capadex-intervention-engine ACTIONABLE_LIFECYCLES): only these
// lifecycle states represent live, actionable risk. Suppressed/weakened/archived
// rows are deliberately de-emphasised and must never surface as priority risks.
const ACTIONABLE_RISK_LIFECYCLES = new Set(['active', 'dominant']);

/** Interventions filtered + ordered so "immediate" surfaces first (deterministic). */
function orderedInterventions(guidance: GuidanceBundle): { type: string; text: string }[] {
  const ivs = (guidance.interventions ?? []).filter((i) => i && i.text);
  const weight = (t: string): number => {
    const k = t.toLowerCase();
    if (k.includes('immediate')) return 0;
    if (k.includes('week') || k.includes('short')) return 1;
    if (k.includes('habit') || k.includes('skill')) return 2;
    return 3;
  };
  return [...ivs].sort((a, b) => {
    const wa = weight(a.type), wb = weight(b.type);
    if (wa !== wb) return wa - wb;
    return a.type.localeCompare(b.type);
  });
}

function strengthItems(profile: StrengthProfile | null): StrengthItem[] {
  if (!profile) return [];
  // Canon order: explicit strengths, then resilience, coping, success patterns.
  return [
    ...profile.strengths,
    ...profile.resilience,
    ...profile.coping,
    ...profile.success_patterns,
  ];
}

// ── Pure section builders (fully testable, no DB) ────────────────────────────

export function buildStudentSummary(
  guidance: GuidanceBundle,
  pipeline: PipelineResult,
): StakeholderSummary {
  const concernLabel = concernLabelOf(pipeline);
  const signals = signalsFromPipeline(pipeline);
  const ivs = orderedInterventions(guidance);
  const plan = guidance.action_plan;
  const growth = guidance.growth_pathway;

  const immediate = ivs.filter((i) => i.type.toLowerCase().includes('immediate'));
  const weekly = ivs.filter((i) => /week|short/.test(i.type.toLowerCase()));
  const longer = ivs.filter((i) => !immediate.includes(i) && !weekly.includes(i));

  const sections: SummarySection[] = [
    section('top_archetypes', 'Top Archetypes',
      guidance.archetype
        ? [{ text: guidance.archetype.name ?? guidance.archetype.key, label: 'Behavioural archetype' }]
        : [],
      'No behavioural archetype could be confidently resolved.'),
    section('key_problems', 'Key Problems',
      (guidance.human_problems ?? []).map((p) => ({ text: p.problem_statement })),
      'No mapped problem statements for this concern.'),
    section('emotional_indicators', 'Emotional Indicators',
      signals.map((s) => ({
        text: s.description || humanizeToken(s.signal_key),
        label: humanizeToken(s.signal_key),
        meta: s.lifecycle_state ? humanizeToken(s.lifecycle_state) : null,
        severity: severityBand(s.severity),
      })),
      'No behavioural signals were activated for this session.'),
    section('immediate_actions', 'Immediate Actions',
      [
        ...(plan?.step_immediate ? [{ text: plan.step_immediate, label: 'First step' }] : []),
        ...immediate.map((i) => ({ text: i.text, label: humanizeToken(i.type) })),
      ],
      'No immediate actions available yet.'),
    section('seven_day_actions', '7-Day Actions',
      [
        ...(plan?.step_week ? [{ text: plan.step_week, label: 'This week' }] : []),
        ...weekly.map((i) => ({ text: i.text, label: humanizeToken(i.type) })),
      ],
      'No 7-day actions available yet.'),
    section('growth_opportunities', 'Growth Opportunities',
      [
        ...(growth?.summary ? [{ text: growth.summary, label: 'Where this leads' }] : []),
        ...(plan?.step_month ? [{ text: plan.step_month, label: 'This month' }] : []),
        ...(plan?.step_quarter ? [{ text: plan.step_quarter, label: 'This quarter' }] : []),
        ...longer.map((i) => ({ text: i.text, label: humanizeToken(i.type) })),
      ],
      'No longer-term growth pathway available yet.'),
  ];

  return finalizeSummary('student', guidance, concernLabel, sections);
}

export function buildParentSummary(
  guidance: GuidanceBundle,
  pipeline: PipelineResult,
  strengths: StrengthProfile | null,
): StakeholderSummary {
  const concernLabel = concernLabelOf(pipeline);
  const ivs = orderedInterventions(guidance);
  const plan = guidance.action_plan;
  const growth = guidance.growth_pathway;

  // Home Support Actions = the immediate / habit-forming interventions, framed for
  // home; Intervention Suggestions = the structured plan + remaining interventions.
  const homeSupport = ivs.filter((i) => /immediate|habit|skill|week|short/.test(i.type.toLowerCase()));
  const otherIvs = ivs.filter((i) => !homeSupport.includes(i));

  const strengthRows = strengthItems(strengths);

  const sections: SummarySection[] = [
    // CANON: strengths come ONLY from the canon strength profile, never from signals.
    section('child_strengths', 'Child Strengths',
      strengthRows.map((s) => ({
        text: s.label,
        label: humanizeToken(s.source),
        meta: s.evidence || null,
      })),
      'No strength signals have been captured yet — they appear once positive indicators are detected.'),
    section('growth_areas', 'Growth Areas',
      [
        ...(concernLabel ? [{ text: concernLabel, label: 'Focus area' }] : []),
        ...(guidance.human_problems ?? []).map((p) => ({ text: p.problem_statement })),
      ],
      'No growth areas mapped for this concern.'),
    section('home_support_actions', 'Home Support Actions',
      [
        ...(plan?.step_immediate ? [{ text: plan.step_immediate, label: 'Start here' }] : []),
        ...homeSupport.map((i) => ({ text: i.text, label: humanizeToken(i.type) })),
      ],
      'No home support actions available yet.'),
    section('intervention_suggestions', 'Intervention Suggestions',
      [
        ...(plan?.step_month ? [{ text: plan.step_month, label: 'This month' }] : []),
        ...(plan?.step_quarter ? [{ text: plan.step_quarter, label: 'This quarter' }] : []),
        ...otherIvs.map((i) => ({ text: i.text, label: humanizeToken(i.type) })),
        ...(growth?.summary ? [{ text: growth.summary, label: 'Longer-term pathway' }] : []),
      ],
      'No additional intervention suggestions available yet.'),
  ];

  return finalizeSummary('parent', guidance, concernLabel, sections);
}

export function buildCounselorSummary(
  guidance: GuidanceBundle,
  pipeline: PipelineResult,
): StakeholderSummary {
  const concernLabel = concernLabelOf(pipeline);
  const signals = signalsFromPipeline(pipeline);
  const ivs = orderedInterventions(guidance);
  const plan = guidance.action_plan;
  const behaviours = guidance.behaviours ?? [];
  const intents = guidance.search_intents ?? [];

  // Priority Risks = ACTIONABLE activated signals ranked by severity (high → low),
  // deterministic. Canon: only 'active'/'dominant' lifecycle states are real
  // runtime risks — Phase-2 suppressed/weakened/archived rows are de-emphasised
  // and MUST NOT surface as counselor priority risks (mirrors the intervention
  // engine's ACTIONABLE_LIFECYCLES). Missing lifecycle → excluded (not actionable).
  const risks = signals
    .filter((s) => ACTIONABLE_RISK_LIFECYCLES.has(String(s.lifecycle_state ?? '').toLowerCase()))
    .sort((a, b) => {
    const ra = SEVERITY_RANK[severityBand(a.severity)];
    const rb = SEVERITY_RANK[severityBand(b.severity)];
    if (ra !== rb) return ra - rb;
    const sa = a.strength ?? 0, sb = b.strength ?? 0;
    if (sa !== sb) return sb - sa;
    return a.signal_key.localeCompare(b.signal_key);
  });

  const reviewWindow = plan?.total_days
    ? `Review window: ${plan.total_days} day${plan.total_days === 1 ? '' : 's'}`
    : null;

  const sections: SummarySection[] = [
    section('priority_risks', 'Priority Risks',
      risks.map((s) => ({
        text: s.description || humanizeToken(s.signal_key),
        label: humanizeToken(s.signal_key),
        meta: [s.lifecycle_state ? humanizeToken(s.lifecycle_state) : null,
               s.confidence != null ? `confidence ${(s.confidence * 100).toFixed(0)}%` : null]
              .filter(Boolean).join(' · ') || null,
        severity: severityBand(s.severity),
      })),
      'No risk-bearing signals were activated for this session.'),
    section('priority_interventions', 'Priority Interventions',
      ivs.map((i) => ({ text: i.text, label: humanizeToken(i.type) })),
      'No mapped interventions for this archetype.'),
    section('recommended_follow_ups', 'Recommended Follow-Ups',
      [
        ...(plan?.step_week ? [{ text: plan.step_week, label: 'Within a week' }] : []),
        ...(plan?.step_month ? [{ text: plan.step_month, label: 'Within a month' }] : []),
        ...(plan?.step_quarter ? [{ text: plan.step_quarter, label: 'Within a quarter' }] : []),
        ...intents.map((s) => ({ text: s.search_phrase, label: humanizeToken(s.intent_type) })),
      ],
      'No structured follow-up checkpoints available yet.'),
    section('progress_monitoring', 'Progress Monitoring',
      [
        ...(reviewWindow ? [{ text: reviewWindow, label: 'Cadence' }] : []),
        ...behaviours.map((b) => ({
          text: b.behavior_statement,
          label: b.behavior_category ? humanizeToken(b.behavior_category) : 'Observable marker',
        })),
        ...risks.slice(0, 5).map((s) => ({
          text: `Re-measure: ${humanizeToken(s.signal_key)}`,
          label: 'Signal to track',
        })),
      ],
      'No observable markers available to monitor yet.'),
  ];

  return finalizeSummary('counselor', guidance, concernLabel, sections);
}

// ── Explainability assembler (pure) ──────────────────────────────────────────

/**
 * Pure: pair every surfaced intervention with its resolved lineage chain so the UI
 * can answer "Why am I seeing this?" for each recommendation. The "why" is the set
 * of RESOLVED hops (1..7) in order — every recommendation shares the same forward
 * chain because the pipeline is a single lineage per session.
 */
export function assembleExplainability(
  guidance: GuidanceBundle,
  pipeline: PipelineResult,
): RuntimeExplainabilityResult {
  const why = pipeline.hops
    .filter((h) => h.resolved)
    .map((h) => ({ step: h.step, label: h.label, summary: h.summary }));

  const recommendations: ExplainabilityRecommendation[] = orderedInterventions(guidance).map((i) => ({
    intervention_type: i.type,
    intervention_text: i.text,
    why,
  }));

  return {
    enabled: true,
    degraded: pipeline.degraded,
    reason: pipeline.reason,
    session_id: pipeline.session_id,
    generated_at: pipeline.generated_at,
    archetype: guidance.archetype,
    concern_label: concernLabelOf(pipeline),
    lineage: pipeline.hops,
    recommendations,
  };
}

// ── Shared finalizers (pure) ─────────────────────────────────────────────────

function concernLabelOf(pipeline: PipelineResult): string | null {
  const hop = pipeline.hops.find((h) => h.key === 'signal_to_concern');
  const data = (hop?.data ?? null) as { concern_label?: string | null } | null;
  return data?.concern_label ?? null;
}

function section(key: string, title: string, items: SummaryItem[], emptyNote: string): SummarySection {
  return { key, title, items, note: items.length ? null : emptyNote };
}

function finalizeSummary(
  stakeholder: StakeholderLens,
  guidance: GuidanceBundle,
  concernLabel: string | null,
  sections: SummarySection[],
): StakeholderSummary {
  return {
    stakeholder,
    archetype: guidance.archetype,
    concern_label: concernLabel,
    degraded: guidance.degraded,
    reason: guidance.reason,
    sections,
  };
}

// ── DB orchestrators (read-only, never throw) ────────────────────────────────

async function loadInputs(pool: Pool, sessionId: string): Promise<{
  guidance: GuidanceBundle;
  pipeline: PipelineResult;
  strengths: StrengthProfile | null;
}> {
  const [guidance, pipeline] = await Promise.all([
    buildGuidanceForSession(pool, sessionId),
    buildPipelineForSession(pool, sessionId),
  ]);
  // Strengths are best-effort and canon-gated (CSI / longitudinal only).
  const strengths = await discoverStrengths(pool, sessionId).catch(() => null);
  return { guidance, pipeline, strengths };
}

export async function buildStakeholderSummary(
  pool: Pool,
  sessionId: string,
  stakeholder: StakeholderLens,
): Promise<StakeholderSummary> {
  const { guidance, pipeline, strengths } = await loadInputs(pool, sessionId);
  if (stakeholder === 'parent') return buildParentSummary(guidance, pipeline, strengths);
  if (stakeholder === 'counselor') return buildCounselorSummary(guidance, pipeline);
  return buildStudentSummary(guidance, pipeline);
}

export async function buildRuntimeSummary(pool: Pool, sessionId: string): Promise<RuntimeSummaryResult> {
  const { guidance, pipeline, strengths } = await loadInputs(pool, sessionId);
  const summaries: Record<StakeholderLens, StakeholderSummary> = {
    student: buildStudentSummary(guidance, pipeline),
    parent: buildParentSummary(guidance, pipeline, strengths),
    counselor: buildCounselorSummary(guidance, pipeline),
  };
  return {
    enabled: true,
    degraded: pipeline.degraded,
    reason: pipeline.reason,
    session_id: sessionId,
    generated_at: pipeline.generated_at,
    archetype: guidance.archetype,
    concern_label: concernLabelOf(pipeline),
    summaries,
  };
}

export async function buildRuntimeExplainability(
  pool: Pool,
  sessionId: string,
): Promise<RuntimeExplainabilityResult> {
  const [guidance, pipeline] = await Promise.all([
    buildGuidanceForSession(pool, sessionId),
    buildPipelineForSession(pool, sessionId),
  ]);
  return assembleExplainability(guidance, pipeline);
}

export function isStakeholderLens(v: unknown): v is StakeholderLens {
  return v === 'student' || v === 'parent' || v === 'counselor';
}

export { STAKEHOLDERS };
