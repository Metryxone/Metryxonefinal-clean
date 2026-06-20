/**
 * Phase 3.9 — Employability Recommendation Engine (evaluator).
 *
 * PURE COMPOSITION over the EXISTING employability substrate. For one subject it
 * evaluates the curated recommendation rules (recommendation-rules.ts) against:
 *   - the subject's measured onto-domain scores (getProfile — the same domain
 *     scores used by the readiness engines), and
 *   - the Phase-3.8 employability signals (computeEmployabilitySignals — REUSED,
 *     never recomputed),
 * and emits actionable recommendations across five categories (development,
 * certification, project, experience, behavioral).
 *
 * Honesty contract (mirrors the rest of the chain):
 *   - A recommendation is EMITTED only when its trigger is MEASURED and satisfied.
 *   - A measured-but-unsatisfied trigger is 'not_applicable' (the subject does
 *     not need it now) — an honest non-recommendation, never a fabricated rec.
 *   - An unmeasured trigger (or an indeterminate signal) is 'withheld' — we never
 *     recommend on absent evidence; it would need assessment first.
 *   - Coverage (share of rules whose trigger is measurable) and the number of
 *     emitted recommendations are SEPARATE axes.
 *   - Confidence is INHERITED (domain triggers are directly measured; signal
 *     triggers inherit the signal's confidence band) — never invented.
 *   - Never throws — degrades to an honest withheld/unavailable result.
 *   - Developmental suggestions only — NEVER hiring/promotion/placement verdicts.
 */

import type { Pool } from 'pg';
import { getProfile, MEASURABLE_ONTO_DOMAINS, ONTO_DOMAIN_LABEL } from './competency-runtime.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import {
  computeEmployabilitySignals,
  type EmployabilitySignals,
} from './employability-signal-engine.js';
import {
  RECOMMENDATION_LIBRARY,
  RECOMMENDATION_LIBRARY_VERSION,
  type RecommendationCategory,
  type RecommendationDefinition,
  getRecommendationDefinition,
} from './recommendation-library.js';
import {
  RECOMMENDATION_RULES,
  REC_BELOW_STRONG_MAX_SCORE,
  REC_LOW_MAX_SCORE,
  getRecommendationRule,
  type RecommendationPriority,
  type RecommendationRule,
} from './recommendation-rules.js';

export const EI_RECOMMENDATION_ENGINE_VERSION = 'phase-3.9';

export type RecommendationStatus = 'emitted' | 'not_applicable' | 'withheld';

export interface RecommendationTriggerEval {
  kind: 'domain_state' | 'signal';
  // domain_state
  onto_domain?: string;
  domain_label?: string;
  direction?: 'below_strong' | 'low';
  actual_score?: number | null;
  actual_band?: string | null;
  // signal
  signal_id?: string;
  signal_status?: EmployabilitySignals['signals'][number]['status'];
  // shared
  measured: boolean;
  satisfied: boolean | null; // null when unmeasured/indeterminate
  summary: string;
}

export interface EvaluatedRecommendation {
  recommendation_id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  status: RecommendationStatus;
  priority: RecommendationPriority | null; // only meaningful when emitted
  confidence_band: 'measured' | 'provisional' | 'unmeasured';
  trigger: RecommendationTriggerEval;
  rationale: string;
  notes: string[];
}

export interface EmployabilityRecommendations {
  ok: boolean;
  subject_id: string;
  version: string;
  library_version: string;
  available: boolean; // the curated catalog has recommendations to evaluate
  measurable: boolean; // the subject has at least one measured domain
  recommendations: EvaluatedRecommendation[]; // status === 'emitted'
  by_category: Record<RecommendationCategory, EvaluatedRecommendation[]>; // emitted, grouped
  not_applicable: EvaluatedRecommendation[];
  withheld: EvaluatedRecommendation[];
  evaluated: EvaluatedRecommendation[]; // every rule, every status
  summary: {
    total_rules: number;
    emitted: number;
    not_applicable: number;
    withheld: number;
    coverage_pct: number | null; // measurable triggers / total rules
    by_category: Record<RecommendationCategory, number>; // emitted per category
    by_priority: { high: number; medium: number; low: number };
  };
  ei_profile_summary: {
    measurable: boolean;
    ei_score: number | null;
    band: string | null;
    coverage_pct: number;
    confidence: EiProfile['confidence'];
  };
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
  generated_at: string;
}

const CATEGORIES: RecommendationCategory[] = [
  'development',
  'certification',
  'project',
  'experience',
  'behavioral',
];

function emptyByCategory<T>(make: () => T): Record<RecommendationCategory, T> {
  return CATEGORIES.reduce((acc, c) => {
    acc[c] = make();
    return acc;
  }, {} as Record<RecommendationCategory, T>);
}

function bandLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 35) return 'Emerging';
  return 'Early';
}

function emptyEiSummary(eiProfile: EiProfile): EmployabilityRecommendations['ei_profile_summary'] {
  return {
    measurable: eiProfile.overall_ei.measurable,
    ei_score: eiProfile.overall_ei.ei_score,
    band: eiProfile.overall_ei.band,
    coverage_pct: eiProfile.overall_ei.coverage_pct,
    confidence: eiProfile.confidence,
  };
}

/**
 * Derive the final priority from the rule baseline + measured severity.
 * Deterministic: a domain at the 'low' band lifts a development rec to 'high';
 * positive-signal leverage recs stay at their baseline.
 */
function derivePriority(
  rule: RecommendationRule,
  domScore: number | null,
): RecommendationPriority {
  if (rule.trigger.type === 'domain_state' && domScore != null) {
    if (domScore < REC_LOW_MAX_SCORE) return 'high'; // a real gap is urgent
    return rule.base_priority;
  }
  return rule.base_priority;
}

function makeEmpty(def: RecommendationDefinition, status: RecommendationStatus, trigger: RecommendationTriggerEval, rationale: string, notes: string[]): EvaluatedRecommendation {
  return {
    recommendation_id: def.recommendation_id,
    category: def.category,
    title: def.title,
    description: def.description,
    status,
    priority: null,
    confidence_band: status === 'emitted' ? 'measured' : 'unmeasured',
    trigger,
    rationale,
    notes,
  };
}

/**
 * Evaluate every curated recommendation rule for one subject. Read-only; never throws.
 */
export async function computeEmployabilityRecommendations(
  pool: Pool,
  subjectId: string,
): Promise<EmployabilityRecommendations> {
  const sid = String(subjectId ?? '').trim();
  const now = new Date().toISOString();

  const eiProfile = await buildEiProfile(pool, sid);

  const base = (notes: string[]): EmployabilityRecommendations => ({
    ok: true,
    subject_id: sid,
    version: EI_RECOMMENDATION_ENGINE_VERSION,
    library_version: RECOMMENDATION_LIBRARY_VERSION,
    available: RECOMMENDATION_LIBRARY.length > 0,
    measurable: false,
    recommendations: [],
    by_category: emptyByCategory<EvaluatedRecommendation[]>(() => []),
    not_applicable: [],
    withheld: [],
    evaluated: [],
    summary: {
      total_rules: RECOMMENDATION_RULES.length,
      emitted: 0,
      not_applicable: 0,
      withheld: RECOMMENDATION_RULES.length,
      coverage_pct: RECOMMENDATION_RULES.length > 0 ? 0 : null,
      by_category: emptyByCategory<number>(() => 0),
      by_priority: { high: 0, medium: 0, low: 0 },
    },
    ei_profile_summary: emptyEiSummary(eiProfile),
    language_policy: LANGUAGE_POLICY,
    notes,
    generated_at: now,
  });

  // Resolve subject domain-proxy scores. Guarded -> degrade to withheld.
  const domScore = new Map<string, number>();
  let profileMeasured = false;
  try {
    const profile = await getProfile(pool, sid);
    profileMeasured = profile.measured;
    if (profile.measured) {
      for (const d of profile.domain_scores) {
        if (MEASURABLE_ONTO_DOMAINS.has(d.onto_domain)) domScore.set(d.onto_domain, d.scaled_score);
      }
    }
  } catch (err: any) {
    const out = base([`Subject domains could not be resolved: ${err?.message ?? 'unknown error'}. All recommendations are withheld (not assumed).`]);
    out.withheld = RECOMMENDATION_LIBRARY.map((def) => {
      const rule = getRecommendationRule(def.recommendation_id);
      return makeEmpty(def, 'withheld', triggerForWithheld(rule), rule?.rationale ?? 'No rule defined.', ['Withheld — subject data unavailable (never recommended on absent evidence).']);
    });
    out.evaluated = out.withheld;
    return out;
  }

  // Reuse Phase-3.8 signals (compose, never recompute). Never throws.
  let signals: EmployabilitySignals | null = null;
  try {
    signals = await computeEmployabilitySignals(pool, sid);
  } catch {
    signals = null;
  }
  const signalStatus = new Map<string, EmployabilitySignals['signals'][number]>();
  if (signals) for (const s of signals.signals) signalStatus.set(s.signal_id, s);

  const evaluated: EvaluatedRecommendation[] = [];

  for (const def of RECOMMENDATION_LIBRARY) {
    const rule = getRecommendationRule(def.recommendation_id);
    if (!rule) {
      evaluated.push(makeEmpty(def, 'withheld', { kind: 'domain_state', measured: false, satisfied: null, summary: 'No firing rule defined.' }, 'No firing rule is defined for this recommendation — it cannot be evaluated (not assumed).', ['No matching rule in recommendation-rules.ts — withheld (configuration gap, never fabricated).']));
      continue;
    }

    if (rule.trigger.type === 'domain_state') {
      const dom = rule.trigger.onto_domain;
      const usable = MEASURABLE_ONTO_DOMAINS.has(dom) && domScore.has(dom);
      const score = usable ? (domScore.get(dom) as number) : null;
      const ceiling = rule.trigger.direction === 'low' ? REC_LOW_MAX_SCORE : REC_BELOW_STRONG_MAX_SCORE;
      const measured = score != null;
      const satisfied = measured ? (score as number) < ceiling : null;
      const trigger: RecommendationTriggerEval = {
        kind: 'domain_state',
        onto_domain: dom,
        domain_label: ONTO_DOMAIN_LABEL[dom] ?? dom,
        direction: rule.trigger.direction,
        actual_score: score,
        actual_band: score != null ? bandLabel(score) : null,
        measured,
        satisfied,
        summary: measured
          ? `${ONTO_DOMAIN_LABEL[dom] ?? dom} measured at ${score} (${bandLabel(score as number)})${satisfied ? ` — below the ${rule.trigger.direction === 'low' ? 'Developing' : 'Strong'} threshold` : ' — at or above threshold, recommendation not needed'}`
          : `${ONTO_DOMAIN_LABEL[dom] ?? dom} is unmeasured for this subject`,
      };

      let status: RecommendationStatus;
      const notes: string[] = [];
      if (!measured) {
        status = 'withheld';
        notes.push('Withheld — the contributing capability is unmeasured for this subject (never recommended on absent evidence).');
      } else if (satisfied) {
        status = 'emitted';
        notes.push(`${def.title} — ${trigger.summary}.`);
      } else {
        status = 'not_applicable';
        notes.push(`Not applicable — ${trigger.summary} (no gap, so no recommendation).`);
      }

      const rec = makeEmpty(def, status, trigger, rule.rationale, notes);
      if (status === 'emitted') {
        rec.priority = derivePriority(rule, score);
        rec.confidence_band = 'measured';
      } else {
        rec.confidence_band = measured ? 'measured' : 'unmeasured';
      }
      evaluated.push(rec);
      continue;
    }

    // signal trigger
    const sig = signalStatus.get(rule.trigger.signal_id) ?? null;
    const sigStatus = sig?.status ?? 'unmeasured';
    // Evaluable when the signal is conclusively fired or not_met; indeterminate
    // / unmeasured cannot be evaluated -> withheld (some inputs unmeasured).
    const conclusive = sigStatus === 'fired' || sigStatus === 'not_met';
    const measured = conclusive;
    const satisfied = conclusive ? sigStatus === 'fired' : null;
    const trigger: RecommendationTriggerEval = {
      kind: 'signal',
      signal_id: rule.trigger.signal_id,
      signal_status: sigStatus,
      measured,
      satisfied,
      summary: sig
        ? `Signal "${sig.name}" is ${sigStatus}`
        : `Signal ${rule.trigger.signal_id} is unavailable`,
    };

    let status: RecommendationStatus;
    const notes: string[] = [];
    if (!conclusive) {
      status = 'withheld';
      notes.push(`Withheld — the "${sig?.name ?? rule.trigger.signal_id}" signal is ${sigStatus} (some contributing competencies unmeasured); never recommended on absent evidence.`);
    } else if (satisfied) {
      status = 'emitted';
      notes.push(`${def.title} — ${sig?.name ?? rule.trigger.signal_id} fired.`);
    } else {
      status = 'not_applicable';
      notes.push(`Not applicable — the "${sig?.name ?? rule.trigger.signal_id}" signal did not fire (no trigger).`);
    }

    const rec = makeEmpty(def, status, trigger, rule.rationale, notes);
    if (status === 'emitted') {
      rec.priority = rule.base_priority;
      // Inherit the signal's confidence band (measured/provisional).
      rec.confidence_band = sig?.confidence_band === 'provisional' ? 'provisional' : 'measured';
    } else {
      rec.confidence_band = conclusive ? 'measured' : 'unmeasured';
    }
    evaluated.push(rec);
  }

  const emitted = evaluated.filter((r) => r.status === 'emitted');
  const notApplicable = evaluated.filter((r) => r.status === 'not_applicable');
  const withheld = evaluated.filter((r) => r.status === 'withheld');
  const measurable = domScore.size > 0 && profileMeasured;

  // Sort emitted by priority (high>medium>low) then category order for stable display.
  const prioRank: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
  emitted.sort((a, b) => (prioRank[a.priority ?? 'low'] - prioRank[b.priority ?? 'low']) || (CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)));

  const byCategory = emptyByCategory<EvaluatedRecommendation[]>(() => []);
  for (const r of emitted) byCategory[r.category].push(r);

  const byCategoryCount = emptyByCategory<number>(() => 0);
  for (const r of emitted) byCategoryCount[r.category] += 1;

  const byPriority = { high: 0, medium: 0, low: 0 };
  for (const r of emitted) if (r.priority) byPriority[r.priority] += 1;

  const measurableRules = evaluated.filter((r) => r.trigger.measured).length;
  const coveragePct = RECOMMENDATION_RULES.length > 0
    ? Math.round((measurableRules / RECOMMENDATION_RULES.length) * 1000) / 10
    : null;

  const notes: string[] = [
    'Recommendations COMPOSE measured capability gaps/strengths and Phase-3.8 signals against a curated rule library — developmental suggestions only, never hiring/promotion/placement verdicts.',
  ];
  if (!profileMeasured) {
    notes.push('No scored profile for this subject yet — generate and score an assessment first. All recommendations are withheld (not assumed).');
  } else if (!measurable) {
    notes.push('The subject has a profile but no measurable domains cover the recommendation triggers — recommendations are withheld (not assumed).');
  } else {
    notes.push(`${emitted.length} recommendation(s) emitted across ${CATEGORIES.filter((c) => byCategoryCount[c] > 0).length} categor(y/ies); ${notApplicable.length} not applicable; ${withheld.length} withheld (unmeasured triggers). Coverage is reported separately from the count.`);
  }

  return {
    ok: true,
    subject_id: sid,
    version: EI_RECOMMENDATION_ENGINE_VERSION,
    library_version: RECOMMENDATION_LIBRARY_VERSION,
    available: RECOMMENDATION_LIBRARY.length > 0,
    measurable,
    recommendations: emitted,
    by_category: byCategory,
    not_applicable: notApplicable,
    withheld,
    evaluated,
    summary: {
      total_rules: RECOMMENDATION_RULES.length,
      emitted: emitted.length,
      not_applicable: notApplicable.length,
      withheld: withheld.length,
      coverage_pct: coveragePct,
      by_category: byCategoryCount,
      by_priority: byPriority,
    },
    ei_profile_summary: emptyEiSummary(eiProfile),
    language_policy: LANGUAGE_POLICY,
    notes,
    generated_at: now,
  };
}

function triggerForWithheld(rule: RecommendationRule | null): RecommendationTriggerEval {
  if (!rule) return { kind: 'domain_state', measured: false, satisfied: null, summary: 'No rule defined.' };
  if (rule.trigger.type === 'domain_state') {
    return {
      kind: 'domain_state',
      onto_domain: rule.trigger.onto_domain,
      domain_label: ONTO_DOMAIN_LABEL[rule.trigger.onto_domain] ?? rule.trigger.onto_domain,
      direction: rule.trigger.direction,
      actual_score: null,
      actual_band: null,
      measured: false,
      satisfied: null,
      summary: `${ONTO_DOMAIN_LABEL[rule.trigger.onto_domain] ?? rule.trigger.onto_domain} unavailable`,
    };
  }
  return { kind: 'signal', signal_id: rule.trigger.signal_id, signal_status: 'unmeasured', measured: false, satisfied: null, summary: `Signal ${rule.trigger.signal_id} unavailable` };
}

/**
 * Return the curated recommendation catalog (library + rules) — read-only, no DB.
 */
export function getRecommendationCatalog(): {
  version: string;
  library_version: string;
  recommendations: Array<RecommendationDefinition & {
    trigger: RecommendationRule['trigger'] | null;
    base_priority: RecommendationPriority | null;
    rationale: string;
  }>;
  thresholds: { below_strong_max_score: number; low_max_score: number };
  categories: RecommendationCategory[];
  generated_at: string;
} {
  return {
    version: EI_RECOMMENDATION_ENGINE_VERSION,
    library_version: RECOMMENDATION_LIBRARY_VERSION,
    recommendations: RECOMMENDATION_LIBRARY.map((def) => {
      const rule = getRecommendationRule(def.recommendation_id);
      return {
        ...def,
        trigger: rule?.trigger ?? null,
        base_priority: rule?.base_priority ?? null,
        rationale: rule?.rationale ?? 'No rule defined.',
      };
    }),
    thresholds: { below_strong_max_score: REC_BELOW_STRONG_MAX_SCORE, low_max_score: REC_LOW_MAX_SCORE },
    categories: CATEGORIES,
    generated_at: new Date().toISOString(),
  };
}

export { getRecommendationDefinition };
