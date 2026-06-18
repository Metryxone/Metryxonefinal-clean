/**
 * CAPADEX PIL — Phase 6C: Report Section Engine (pure, read-only).
 *
 *   Phase 6B surfaces runtime intelligence as three live stakeholder summaries.
 *   Phase 6C *formalises* those into structured, export-ready REPORTS. This module
 *   is the first of three 6C engines: it RESHAPES the already-composed 6B
 *   `StakeholderSummary` (+ the canon strength profile + the guidance bundle) into
 *   the 6C report-section taxonomy — relabelling, reordering, and adding the two
 *   sections 6B did not carry (Student "Strengths"; Parent "Suggested Conversations").
 *
 *   It also assigns each section a lineage `anchor` — the deepest node in the
 *   Response→Signal→Concern→Capability→Problem→Behavior→Archetype→Intervention
 *   chain that its content genuinely derives from — so the explainability engine can
 *   attach an honest per-statement trace. Strength items additionally carry a
 *   `self_trace` built from their OWN CSI evidence (strengths are NOT part of the
 *   concern-diagnostic chain — they trace to the response + positive signal).
 *
 * CANON (strict, identical to Phase 6/6A/6B):
 *   - ADDITIVE & READ-ONLY: no writes, no recompute, no AI, no new content. Every
 *     value was authored/derived by an existing engine; this module only re-frames.
 *   - DETERMINISTIC: same inputs → same sections (ordered, no randomness).
 *   - GRACEFUL DEGRADATION: an empty source section yields an empty report section
 *     with the honest note carried through — NEVER fabricated. Never throws.
 */
import type { HopKey } from './pipeline-resolver';
import type { GuidanceBundle } from './runtime-guidance-engine';
import type { StakeholderSummary, SummarySection, SummaryItem } from './stakeholder-summary-engine';
import type { StrengthProfile, StrengthItem } from '../strength-discovery-engine';

// ── Public shapes ────────────────────────────────────────────────────────────
export type ReportType = 'student' | 'parent' | 'counselor' | 'institution';

/** A single trace node in the explainability chain (resolved lineage hop). */
export interface TraceNode {
  step: number;
  key: string;
  label: string;
  summary: string;
}

export interface ReportItem {
  text: string;
  label?: string | null;
  meta?: string | null;
  severity?: 'high' | 'moderate' | 'low' | null;
  /**
   * Overrides the lineage-derived trace for statements that legitimately sit
   * OUTSIDE the concern-diagnostic chain (strengths → CSI positive evidence).
   * When present, the explainability engine uses this verbatim.
   */
  self_trace?: TraceNode[];
}

export interface ReportSection {
  key: string;
  title: string;
  items: ReportItem[];
  /** Honest note shown when the section has no sourced content (never fabricated). */
  note: string | null;
  /** Deepest lineage hop this section's content derives from (drives the trace). */
  anchor: HopKey;
}

// ── Small pure helpers ───────────────────────────────────────────────────────

/** Find a 6B summary section by key (returns null if the lens never built it). */
function find(summary: StakeholderSummary, key: string): SummarySection | null {
  return summary.sections.find((s) => s.key === key) ?? null;
}

/** Carry the 6B items verbatim (text/label/meta/severity) — no new content. */
function carry(items: SummaryItem[]): ReportItem[] {
  return items.map((i) => ({
    text: i.text,
    label: i.label ?? null,
    meta: i.meta ?? null,
    severity: i.severity ?? null,
  }));
}

/**
 * Reshape one 6B section into a 6C report section: relabel + re-anchor, preserve
 * the items and the honest empty-note. Missing source section → empty + generic note.
 */
function reshape(
  source: SummarySection | null,
  key: string,
  title: string,
  anchor: HopKey,
  fallbackNote: string,
): ReportSection {
  const items = source ? carry(source.items) : [];
  return {
    key,
    title,
    items,
    note: items.length ? null : (source?.note ?? fallbackNote),
    anchor,
  };
}

const round0 = (n: number) => Math.round(n * 100);

/**
 * Strength items → report items with a `self_trace` built from their own evidence.
 * Canon: strengths come ONLY from the strength profile (CSI positive_factors /
 * positive longitudinal), never from raw concern signals.
 */
function strengthItems(profile: StrengthProfile | null): ReportItem[] {
  if (!profile) return [];
  const all: StrengthItem[] = [
    ...profile.strengths,
    ...profile.resilience,
    ...profile.coping,
    ...profile.success_patterns,
  ];
  return all.map((s) => ({
    text: s.label,
    label: humanize(s.source),
    meta: s.evidence || null,
    severity: null,
    self_trace: [
      {
        step: 1,
        key: 'response_to_signal',
        label: 'Response → Signal (positive)',
        summary: s.evidence
          ? `Positive evidence: ${s.evidence}`
          : `Derived from ${humanize(s.source)}.`,
      },
      {
        step: 2,
        key: 'signal_to_strength',
        label: 'Signal → Strength',
        summary: `Strength surfaced via ${humanize(s.source)} (confidence ${round0(s.confidence)}%).`,
      },
    ],
  }));
}

function humanize(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Per-stakeholder report section builders (pure) ───────────────────────────

/**
 * STUDENT report:
 *   Strengths · Growth Areas · Top Archetypes · Emotional Indicators ·
 *   Immediate Actions · 7-Day Plan · Development Roadmap
 *
 * `summary` is the 6B student StakeholderSummary; `strengths` is the canon profile
 * (the Strengths section is student-new — 6B kept strengths parent-only).
 */
export function buildStudentReportSections(
  summary: StakeholderSummary,
  strengths: StrengthProfile | null,
): ReportSection[] {
  const strengthRows = strengthItems(strengths);
  return [
    {
      key: 'strengths',
      title: 'Strengths',
      items: strengthRows,
      note: strengthRows.length ? null
        : 'No strength signals have been captured yet — they appear once positive indicators are detected.',
      anchor: 'response_to_signal',
    },
    reshape(find(summary, 'key_problems'), 'growth_areas', 'Growth Areas',
      'capability_to_problem', 'No growth areas mapped for this concern.'),
    reshape(find(summary, 'top_archetypes'), 'top_archetypes', 'Top Archetypes',
      'behavior_to_archetype', 'No behavioural archetype could be confidently resolved.'),
    reshape(find(summary, 'emotional_indicators'), 'emotional_indicators', 'Emotional Indicators',
      'signal_to_concern', 'No behavioural signals were activated for this session.'),
    reshape(find(summary, 'immediate_actions'), 'immediate_actions', 'Immediate Actions',
      'archetype_to_intervention', 'No immediate actions available yet.'),
    reshape(find(summary, 'seven_day_actions'), 'seven_day_plan', '7-Day Plan',
      'archetype_to_intervention', 'No 7-day actions available yet.'),
    reshape(find(summary, 'growth_opportunities'), 'development_roadmap', 'Development Roadmap',
      'archetype_to_intervention', 'No longer-term growth pathway available yet.'),
  ];
}

/**
 * PARENT report:
 *   Child Strengths · Development Opportunities · Home Support Actions ·
 *   Suggested Conversations · Parent Guidance
 *
 * `summary` is the 6B parent StakeholderSummary; `guidance` supplies the
 * search-intent / problem content reframed as conversation prompts.
 */
export function buildParentReportSections(
  summary: StakeholderSummary,
  guidance: GuidanceBundle,
): ReportSection[] {
  // Suggested Conversations: surface the ALREADY-AUTHORED search intents + mapped
  // problems for a parent audience (re-labelled, not invented). Empty → honest note.
  const conversationItems: ReportItem[] = [
    ...(guidance.search_intents ?? []).map((s) => ({
      text: `Explore together: ${s.search_phrase}`,
      label: humanize(s.intent_type),
      meta: null,
      severity: null as 'high' | 'moderate' | 'low' | null,
    })),
    ...(guidance.human_problems ?? []).map((p) => ({
      text: `Ask about: ${p.problem_statement}`,
      label: 'Conversation starter',
      meta: null,
      severity: null as 'high' | 'moderate' | 'low' | null,
    })),
  ];

  return [
    reshape(find(summary, 'child_strengths'), 'child_strengths', 'Child Strengths',
      'response_to_signal',
      'No strength signals have been captured yet — they appear once positive indicators are detected.'),
    reshape(find(summary, 'growth_areas'), 'development_opportunities', 'Development Opportunities',
      'capability_to_problem', 'No development opportunities mapped for this concern.'),
    reshape(find(summary, 'home_support_actions'), 'home_support_actions', 'Home Support Actions',
      'archetype_to_intervention', 'No home support actions available yet.'),
    {
      key: 'suggested_conversations',
      title: 'Suggested Conversations',
      items: conversationItems,
      note: conversationItems.length ? null
        : 'No conversation prompts available yet — they appear once intents or problems are mapped.',
      anchor: 'problem_to_behavior',
    },
    reshape(find(summary, 'intervention_suggestions'), 'parent_guidance', 'Parent Guidance',
      'archetype_to_intervention', 'No additional parent guidance available yet.'),
  ];
}

/**
 * COUNSELOR report:
 *   Priority Risks · Priority Interventions · Follow-Up Recommendations ·
 *   Monitoring Guidance
 *
 * Direct 1:1 reshape of the 6B counselor summary (whose Priority Risks are already
 * restricted to actionable 'active'/'dominant' lifecycle states — canon).
 */
export function buildCounselorReportSections(summary: StakeholderSummary): ReportSection[] {
  return [
    reshape(find(summary, 'priority_risks'), 'priority_risks', 'Priority Risks',
      'signal_to_concern', 'No risk-bearing signals were activated for this session.'),
    reshape(find(summary, 'priority_interventions'), 'priority_interventions', 'Priority Interventions',
      'archetype_to_intervention', 'No mapped interventions for this archetype.'),
    reshape(find(summary, 'recommended_follow_ups'), 'follow_up_recommendations', 'Follow-Up Recommendations',
      'archetype_to_intervention', 'No structured follow-up checkpoints available yet.'),
    reshape(find(summary, 'progress_monitoring'), 'monitoring_guidance', 'Monitoring Guidance',
      'problem_to_behavior', 'No observable markers available to monitor yet.'),
  ];
}

export { humanize, strengthItems };
