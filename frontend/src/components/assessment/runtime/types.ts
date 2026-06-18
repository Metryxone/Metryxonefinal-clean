// Phase 6B — Runtime Intelligence Experience Layer (frontend mirror of the
// backend stakeholder-summary-engine shapes). Read-only display types only.

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

export interface RuntimeSummary {
  enabled: boolean;
  degraded: boolean;
  reason: string | null;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  summaries: Record<StakeholderLens, StakeholderSummary>;
}

export interface ExplainHop {
  step: number;
  key: string;
  label: string;
  resolved: boolean;
  summary: string;
  data: unknown;
}

export interface ExplainRec {
  intervention_type: string;
  intervention_text: string;
  why: { step: number; label: string; summary: string }[];
}

export interface RuntimeExplainability {
  enabled: boolean;
  degraded: boolean;
  reason: string | null;
  session_id: string;
  generated_at: string;
  archetype: { key: string; name: string | null } | null;
  concern_label: string | null;
  lineage: ExplainHop[];
  recommendations: ExplainRec[];
}

// The report's B palette is passed through as props so the panels never drift
// from the report's single source of truth for colours.
export type Palette = Record<string, string>;

// Display-only normalisation: strip authored slot braces + de-snake.
export const humanise = (s: string): string =>
  String(s ?? '').replace(/\{([^}]+)\}/g, (_m, t: string) => String(t).replace(/_/g, ' '));

export const prettify = (s: string): string =>
  String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
