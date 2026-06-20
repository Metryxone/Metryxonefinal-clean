/**
 * PHASE 4.2 — Career Fit Engine (per-role fit decomposition).
 *
 * A PURE, read-only, never-throws helper that decomposes the fit between ONE
 * already-composed subject signal-set and ONE catalog role (`cg_roles`) into a
 * transparent, weighted set of fit COMPONENTS, yielding a `match_percentage`, a
 * SEPARATE `match_confidence` band, and a templated `match_explanation`.
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - It NEVER recomputes an upstream competency / readiness / EI score — it only
 *     reads the already-composed subject signals and the role AS-STORED.
 *   - The role CATALOG (`cg_roles`) carries MARKET attributes (function, seniority,
 *     demand, growth, automation risk) — it does NOT carry per-role competency
 *     REQUIREMENTS. Therefore a real, requirement-backed competency fit exists ONLY
 *     for the subject's ANCHOR role (via role-readiness-v2's role_match). For every
 *     OTHER role the competency-requirement component is ABSENT (not fabricated),
 *     the match is driven by the subject's measured capability SUPPLY (competency /
 *     readiness / EI) plus categorical function/seniority alignment, and the
 *     confidence is capped at 'Provisional' — a directional signal, never a verdict.
 *   - Match% (a blend of PRESENT components) and Confidence (whether the per-role
 *     requirement axis is real) are TWO SEPARATE axes — never composited.
 *   - A component with no real data is `present:false` and contributes nothing; the
 *     weighted average renormalizes over present components only (no false spread).
 *   - Outputs are DEVELOPMENTAL / MARKET SIGNALS ONLY — never hiring/promotion/
 *     suitability predictions.
 */

import type { CgRole } from './career-graph-engine.js';

export const CAREER_FIT_VERSION = '4.2.0';

/** Confidence is a SEPARATE axis from match%. Provisional = no per-role
 *  competency-requirement backing (driven by supply + categorical alignment). */
export type MatchConfidenceBand = 'High' | 'Moderate' | 'Provisional' | 'Low' | 'None';

/** Developmental match band derived from the match_percentage thresholds. */
export type MatchBand = 'Strong' | 'Good' | 'Partial' | 'Low' | 'Unmeasured';

/** The fit components, in display order. Keys are STABLE config identifiers. */
export type FitComponentKey =
  | 'competency_fit'      // REAL per-role requirement fit — ANCHOR role only.
  | 'capability_fit'      // subject competency profile overall (supply).
  | 'readiness_fit'       // subject Phase-4.3 present-state readiness (supply).
  | 'ei_fit'              // subject EI overall (supply).
  | 'function_alignment'  // role function_area vs the anchor's function (per-role).
  | 'seniority_alignment';// role seniority vs the anchor's seniority (per-role).

export const FIT_COMPONENT_ORDER: FitComponentKey[] = [
  'competency_fit',
  'capability_fit',
  'readiness_fit',
  'ei_fit',
  'function_alignment',
  'seniority_alignment',
];

export const FIT_COMPONENT_LABELS: Record<FitComponentKey, string> = {
  competency_fit: 'Role Competency Fit',
  capability_fit: 'Competency Profile',
  readiness_fit: 'Career Readiness',
  ei_fit: 'Behavioural (EI) Profile',
  function_alignment: 'Function Alignment',
  seniority_alignment: 'Seniority Alignment',
};

/** Disclosed config (config-as-data): weights / caps / thresholds / templates.
 *  Lives in the match engine's DEFAULT_MATCHING_RULES (admin-editable table). */
export interface MatchingRules {
  version: string;
  /** Per-component blend weights (renormalized over PRESENT components). */
  weights: Record<FitComponentKey, number>;
  caps: {
    /** How many top matches to surface. */
    top_n: number;
    /** Categorical alignment scores (0..100). */
    function_aligned: number;
    function_other: number;
    seniority_aligned: number;
    seniority_other: number;
    /** Non-anchor confidence is never raised above this. */
    max_non_anchor_confidence: MatchConfidenceBand;
  };
  /** Match% → band thresholds (half-open: score >= value). */
  thresholds: { strong: number; good: number; partial: number };
  /** {role}/{function}/{match}/{band} templates. */
  templates: {
    anchor: string;
    aligned: string;
    market: string;
    not_measurable: string;
  };
}

/** The already-composed subject signal-set (built ONCE by the match engine).
 *  Every field is honest-nullable; absent data => the component is not present. */
export interface SubjectSignals {
  measurable: boolean;
  competency: { measured: boolean; overall_score: number | null } | null;
  readiness: { measurable: boolean; score: number | null; band: string | null } | null;
  ei: { measurable: boolean; score: number | null; band: string | null } | null;
  anchor: {
    role_id: string | null;
    role_title: string | null;
    /** cg_roles match of the anchor title (null when unmatched). */
    catalog_role_id: number | null;
    function_area: string | null;
    seniority: string | null;
    /** REAL requirement-backed fit for the anchor role (role_match.score). */
    competency_fit_score: number | null;
    fit_band: string | null;
  } | null;
  /** Subject-level confidence band derived from the measured profile. */
  confidence_band: MatchConfidenceBand;
}

export interface FitComponent {
  key: FitComponentKey;
  label: string;
  weight: number;
  present: boolean;
  /** 0..100 component score, or null when absent. */
  score: number | null;
  /** weight * score, or null when absent (for transparency). */
  contribution: number | null;
  basis: string;
}

export interface RoleFit {
  catalog_role_id: number;
  role_key: string;
  role_title: string;
  function_area: string;
  seniority: string;
  is_anchor: boolean;
  measurable: boolean;
  /** Blend of PRESENT components (renormalized) — null when nothing present. */
  match_percentage: number | null;
  match_band: MatchBand;
  /** SEPARATE axis: whether the per-role requirement fit is real. */
  match_confidence: MatchConfidenceBand;
  /** Coverage = fraction of declared components backed by real data. */
  coverage: { present: number; total: number; coverage_pct: number };
  components: FitComponent[];
  match_explanation: string;
  /** The composed evidence used — never a fabricated number. */
  evidence: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp0to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? vars[k] : `{${k}}`));
}

function bandFor(rules: MatchingRules, pct: number | null): MatchBand {
  if (pct == null || !Number.isFinite(pct)) return 'Unmeasured';
  if (pct >= rules.thresholds.strong) return 'Strong';
  if (pct >= rules.thresholds.good) return 'Good';
  if (pct >= rules.thresholds.partial) return 'Partial';
  return 'Low';
}

const CONFIDENCE_RANK: Record<MatchConfidenceBand, number> = {
  None: 0,
  Low: 1,
  Provisional: 2,
  Moderate: 3,
  High: 4,
};

/** Cap a confidence band so it never exceeds the configured non-anchor ceiling. */
function capConfidence(band: MatchConfidenceBand, ceiling: MatchConfidenceBand): MatchConfidenceBand {
  return CONFIDENCE_RANK[band] <= CONFIDENCE_RANK[ceiling] ? band : ceiling;
}

/** Map a measured-profile band string to a SEPARATE confidence axis. */
export function bandToConfidence(band: string | null, measurable: boolean): MatchConfidenceBand {
  if (!measurable || !band) return 'None';
  const b = band.toLowerCase();
  if (b.includes('high') || b.includes('strong') || b.includes('advanced') || b.includes('excellent')) return 'High';
  if (b.includes('moder') || b.includes('good') || b.includes('proficient') || b.includes('developing')) return 'Moderate';
  if (b.includes('low') || b.includes('emerging') || b.includes('early') || b.includes('limited') || b.includes('partial')) return 'Low';
  return 'Moderate';
}

// ---------------------------------------------------------------------------
// Per-role fit decomposition (PURE)
// ---------------------------------------------------------------------------

/**
 * Decompose the fit between the composed subject signals and ONE catalog role.
 * Introduces NO new upstream score — only a disclosed weighted blend over the
 * PRESENT components, renormalized so absent components never inflate the result.
 */
export function computeRoleFit(
  role: CgRole,
  signals: SubjectSignals,
  rules: MatchingRules,
): RoleFit {
  const anchor = signals.anchor;
  const isAnchor =
    anchor != null &&
    ((anchor.catalog_role_id != null && anchor.catalog_role_id === role.id) ||
      (anchor.role_title != null &&
        anchor.role_title.trim().toLowerCase() === role.title.trim().toLowerCase()));

  const anchorFunction = anchor?.function_area ?? null;
  const anchorSeniority = anchor?.seniority ?? null;

  const raw: Array<{ key: FitComponentKey; present: boolean; score: number | null; basis: string }> = [];

  // 1. competency_fit — REAL requirement-backed fit, ANCHOR role only.
  if (isAnchor && anchor?.competency_fit_score != null) {
    raw.push({
      key: 'competency_fit',
      present: true,
      score: clamp0to100(anchor.competency_fit_score),
      basis: `Requirement-backed role-readiness fit for your anchor role (${anchor.fit_band ?? 'measured'}).`,
    });
  } else {
    raw.push({
      key: 'competency_fit',
      present: false,
      score: null,
      basis: isAnchor
        ? 'Anchor role has no scored requirement fit — competency component absent (not fabricated).'
        : 'The role catalog has no per-role competency requirements — this component is real only for your anchor role (absent here, not fabricated).',
    });
  }

  // 2. capability_fit — subject competency profile overall (supply).
  const capOk = signals.competency?.measured === true && signals.competency.overall_score != null;
  raw.push({
    key: 'capability_fit',
    present: capOk,
    score: capOk ? clamp0to100(signals.competency!.overall_score as number) : null,
    basis: capOk
      ? 'Your measured competency profile (capability supply, identical across roles).'
      : 'No measured competency profile (component absent).',
  });

  // 3. readiness_fit — Phase-4.3 present-state readiness (supply).
  const rdOk = signals.readiness?.measurable === true && signals.readiness.score != null;
  raw.push({
    key: 'readiness_fit',
    present: rdOk,
    score: rdOk ? clamp0to100(signals.readiness!.score as number) : null,
    basis: rdOk
      ? `Your composed present-state career readiness (${signals.readiness!.band ?? 'measured'}, identical across roles).`
      : 'Career readiness not measurable (component absent).',
  });

  // 4. ei_fit — EI overall (supply).
  const eiOk = signals.ei?.measurable === true && signals.ei.score != null;
  raw.push({
    key: 'ei_fit',
    present: eiOk,
    score: eiOk ? clamp0to100(signals.ei!.score as number) : null,
    basis: eiOk
      ? `Your measured behavioural (EI) profile (${signals.ei!.band ?? 'measured'}, identical across roles).`
      : 'EI profile not measurable (component absent).',
  });

  // 5. function_alignment — role function vs anchor function (per-role categorical).
  if (anchorFunction) {
    const aligned = role.function_area === anchorFunction;
    raw.push({
      key: 'function_alignment',
      present: true,
      score: aligned ? clamp0to100(rules.caps.function_aligned) : clamp0to100(rules.caps.function_other),
      basis: aligned
        ? `Same function as your anchor (${anchorFunction}).`
        : `Different function from your anchor (${anchorFunction} → ${role.function_area}).`,
    });
  } else {
    raw.push({
      key: 'function_alignment',
      present: false,
      score: null,
      basis: 'No catalog-matched anchor function — alignment cannot be assessed (absent).',
    });
  }

  // 6. seniority_alignment — role seniority vs anchor seniority (per-role categorical).
  if (anchorSeniority) {
    const aligned = role.seniority === anchorSeniority;
    raw.push({
      key: 'seniority_alignment',
      present: true,
      score: aligned ? clamp0to100(rules.caps.seniority_aligned) : clamp0to100(rules.caps.seniority_other),
      basis: aligned
        ? `Same seniority as your anchor (${anchorSeniority}).`
        : `Different seniority from your anchor (${anchorSeniority} → ${role.seniority}).`,
    });
  } else {
    raw.push({
      key: 'seniority_alignment',
      present: false,
      score: null,
      basis: 'No catalog-matched anchor seniority — alignment cannot be assessed (absent).',
    });
  }

  // Build components in display order with disclosed weights + contributions.
  const components: FitComponent[] = FIT_COMPONENT_ORDER.map((key) => {
    const r = raw.find((x) => x.key === key)!;
    const weight = rules.weights[key] ?? 0;
    const contribution = r.present && r.score != null ? round1(weight * r.score) : null;
    return {
      key,
      label: FIT_COMPONENT_LABELS[key],
      weight,
      present: r.present,
      score: r.score,
      contribution,
      basis: r.basis,
    };
  });

  // Weighted average over PRESENT components only (renormalized — no false spread).
  let weightSum = 0;
  let weighted = 0;
  for (const c of components) {
    if (c.present && c.score != null && c.weight > 0) {
      weightSum += c.weight;
      weighted += c.weight * c.score;
    }
  }
  const measurable = weightSum > 0;
  const matchPct = measurable ? round1(weighted / weightSum) : null;
  const matchBand = bandFor(rules, matchPct);

  const presentCount = components.filter((c) => c.present).length;
  const totalCount = components.length;
  const coveragePct = Math.round((presentCount / totalCount) * 100);

  // Confidence is a SEPARATE axis. Anchor (real requirement fit) inherits the
  // subject's measured confidence; every other role is capped at the configured
  // non-anchor ceiling (Provisional) — a directional signal, never a verdict.
  let confidence: MatchConfidenceBand;
  if (!measurable) {
    confidence = 'None';
  } else if (isAnchor && anchor?.competency_fit_score != null) {
    confidence = signals.confidence_band === 'None' ? 'Provisional' : signals.confidence_band;
  } else {
    confidence = capConfidence(
      signals.confidence_band === 'None' ? 'Provisional' : signals.confidence_band,
      rules.caps.max_non_anchor_confidence,
    );
  }

  const vars = {
    role: role.title,
    function: role.function_area,
    match: matchPct != null ? String(matchPct) : 'n/a',
    band: matchBand,
  };
  let explanation: string;
  if (!measurable) {
    explanation = fill(rules.templates.not_measurable, vars);
  } else if (isAnchor && anchor?.competency_fit_score != null) {
    explanation = fill(rules.templates.anchor, vars);
  } else if (anchorFunction && role.function_area === anchorFunction) {
    explanation = fill(rules.templates.aligned, vars);
  } else {
    explanation = fill(rules.templates.market, vars);
  }

  return {
    catalog_role_id: role.id,
    role_key: role.role_key,
    role_title: role.title,
    function_area: role.function_area,
    seniority: role.seniority,
    is_anchor: isAnchor,
    measurable,
    match_percentage: matchPct,
    match_band: matchBand,
    match_confidence: confidence,
    coverage: { present: presentCount, total: totalCount, coverage_pct: coveragePct },
    components,
    match_explanation: explanation,
    evidence: {
      role_key: role.role_key,
      function_area: role.function_area,
      seniority: role.seniority,
      demand_score: role.demand_score,
      growth_30mo: role.growth_30mo,
      automation_risk: role.automation_risk,
      is_anchor: isAnchor,
      anchor_function: anchorFunction,
      anchor_seniority: anchorSeniority,
      requirement_backed: isAnchor && anchor?.competency_fit_score != null,
    },
  };
}
