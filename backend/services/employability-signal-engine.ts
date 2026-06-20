/**
 * Phase 3.8 — Employability Signal Engine (evaluator).
 *
 * PURE COMPOSITION over the EXISTING employability substrate. For one subject it
 * evaluates the curated signal rules (signal-rules.ts) against the subject's
 * measured competency proficiency and reports which higher-order employability
 * signals fire (e.g. Leadership Potential, Innovation Potential, Career Risk).
 *
 * Honesty contract (mirrors the rest of the chain):
 *   - Two honest, never-fabricated inputs:
 *       1. The rules and library are curated (signal-rules.ts / signal-library.ts).
 *       2. The subject's actual proficiency per competency is the SAME
 *          domain-proxy used by the role/industry/function readiness engines:
 *          competency -> onto_domain -> the subject's measured domain score.
 *          Competencies whose domain was not measured are UNMEASURED (a Coverage
 *          gap), never a fabricated 0.
 *   - A signal fires ONLY when every contributing competency is measured AND
 *     satisfies its direction. If any input is unmeasured the signal is
 *     'indeterminate' (could fire once measured), never fired on partial evidence.
 *   - Coverage (share of conditions measurable) and firing are SEPARATE axes.
 *   - Multiple competencies in a rule can currently resolve through ONE domain
 *     proxy (e.g. Communication/Collaboration/Leadership all map to the
 *     interpersonal domain); that is disclosed per-signal (distinct_domains).
 *   - Never throws — degrades to an honest unmeasured/unavailable result.
 *   - Developmental signal only — NEVER a hiring/promotion/placement verdict.
 */

import type { Pool } from 'pg';
import { getProfile, MEASURABLE_ONTO_DOMAINS } from './competency-runtime.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import {
  SIGNAL_LIBRARY,
  SIGNAL_LIBRARY_VERSION,
  getSignalDefinition,
  type SignalDefinition,
} from './signal-library.js';
import {
  SIGNAL_RULES,
  SIGNAL_LOW_MAX_SCORE,
  SIGNAL_STRONG_MIN_SCORE,
  getSignalRule,
  type SignalDirection,
} from './signal-rules.js';

export const EMPLOYABILITY_SIGNAL_ENGINE_VERSION = 'phase-3.8';

export type ConditionState = 'strong' | 'moderate' | 'low' | 'unmeasured';
export type SignalStatus = 'fired' | 'not_met' | 'indeterminate' | 'unmeasured';

export interface EvaluatedCondition {
  competency_id: string;
  competency_name: string | null;
  onto_domain: string | null;
  direction: SignalDirection;
  actual_score: number | null; // 0..100 domain-proxy scaled score
  actual_band: string | null;
  state: ConditionState;
  satisfied: boolean | null; // null when unmeasured
}

export interface EvaluatedSignal {
  signal_id: string;
  name: string;
  description: string;
  polarity: SignalDefinition['polarity'];
  category: string;
  status: SignalStatus;
  fired: boolean;
  conditions: EvaluatedCondition[];
  conditions_total: number;
  conditions_measured: number;
  coverage_pct: number; // measured conditions / total
  distinct_domains: string[]; // distinct onto_domains the conditions resolve through
  confidence_band: 'measured' | 'provisional' | 'unmeasured';
  rationale: string;
  notes: string[];
}

export interface EmployabilitySignals {
  ok: boolean;
  subject_id: string;
  version: string;
  library_version: string;
  available: boolean; // the curated catalog has signals to evaluate
  measurable: boolean; // the subject has at least one measured domain
  signals_fired: EvaluatedSignal[]; // status === 'fired'
  signals: EvaluatedSignal[]; // every signal evaluated
  summary: {
    total_signals: number;
    fired: number;
    positive_fired: number;
    risk_fired: number;
    indeterminate: number;
    unmeasured: number;
    conditions_total: number;
    conditions_measured: number;
    coverage_pct: number | null;
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

// ---------------------------------------------------------------------------
// Band label for a scaled score (kept local & deterministic; mirrors bandFor
// thresholds so the engine never depends on a measured-row to know a band).
// ---------------------------------------------------------------------------
function bandLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 35) return 'Emerging';
  return 'Early';
}

function classify(score: number | null): ConditionState {
  if (score == null || !Number.isFinite(score)) return 'unmeasured';
  if (score >= SIGNAL_STRONG_MIN_SCORE) return 'strong';
  if (score < SIGNAL_LOW_MAX_SCORE) return 'low';
  return 'moderate';
}

function isSatisfied(direction: SignalDirection, state: ConditionState): boolean | null {
  if (state === 'unmeasured') return null;
  if (direction === 'strong') return state === 'strong';
  return state === 'low'; // direction === 'low'
}

/** Map competency_id -> { name, domain } for a set of competencies. */
async function competencyMeta(
  pool: Pool,
  competencyIds: string[],
): Promise<Map<string, { name: string | null; domain: string | null }>> {
  const out = new Map<string, { name: string | null; domain: string | null }>();
  if (competencyIds.length === 0) return out;
  const { rows } = await pool.query(
    `SELECT id, canonical_name, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`,
    [competencyIds],
  );
  for (const r of rows as any[]) out.set(r.id, { name: r.canonical_name ?? null, domain: r.domain_id ?? null });
  return out;
}

function emptyEiSummary(eiProfile: EiProfile): EmployabilitySignals['ei_profile_summary'] {
  return {
    measurable: eiProfile.overall_ei.measurable,
    ei_score: eiProfile.overall_ei.ei_score,
    band: eiProfile.overall_ei.band,
    coverage_pct: eiProfile.overall_ei.coverage_pct,
    confidence: eiProfile.confidence,
  };
}

/**
 * Evaluate every curated signal for one subject. Read-only; never throws.
 */
export async function computeEmployabilitySignals(
  pool: Pool,
  subjectId: string,
): Promise<EmployabilitySignals> {
  const sid = String(subjectId ?? '').trim();
  const now = new Date().toISOString();

  // Best-effort EI confidence context. buildEiProfile never throws.
  const eiProfile = await buildEiProfile(pool, sid);

  // Resolve subject domain-proxy scores. Guarded so a lookup failure degrades to
  // an honest unmeasured result rather than throwing (never-throws contract).
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
    return {
      ok: true,
      subject_id: sid,
      version: EMPLOYABILITY_SIGNAL_ENGINE_VERSION,
      library_version: SIGNAL_LIBRARY_VERSION,
      available: SIGNAL_LIBRARY.length > 0,
      measurable: false,
      signals_fired: [],
      signals: [],
      summary: {
        total_signals: SIGNAL_LIBRARY.length,
        fired: 0,
        positive_fired: 0,
        risk_fired: 0,
        indeterminate: 0,
        unmeasured: SIGNAL_LIBRARY.length,
        conditions_total: 0,
        conditions_measured: 0,
        coverage_pct: null,
      },
      ei_profile_summary: emptyEiSummary(eiProfile),
      language_policy: LANGUAGE_POLICY,
      notes: [`Subject proficiency could not be resolved: ${err?.message ?? 'unknown error'}. Signals are unmeasured (not assumed).`],
      generated_at: now,
    };
  }

  // Collect every competency referenced by any rule, resolve name + domain once.
  const allCompetencyIds = Array.from(
    new Set(SIGNAL_RULES.flatMap((r) => r.conditions.map((c) => c.competency_id))),
  );
  let meta: Map<string, { name: string | null; domain: string | null }>;
  try {
    meta = await competencyMeta(pool, allCompetencyIds);
  } catch {
    meta = new Map();
  }

  const signals: EvaluatedSignal[] = [];
  let conditionsTotal = 0;
  let conditionsMeasured = 0;

  for (const def of SIGNAL_LIBRARY) {
    const rule = getSignalRule(def.signal_id);
    if (!rule) {
      // A library entry with no rule is an honest configuration gap, not a fire.
      signals.push({
        signal_id: def.signal_id,
        name: def.name,
        description: def.description,
        polarity: def.polarity,
        category: def.category,
        status: 'unmeasured',
        fired: false,
        conditions: [],
        conditions_total: 0,
        conditions_measured: 0,
        coverage_pct: 0,
        distinct_domains: [],
        confidence_band: 'unmeasured',
        rationale: 'No firing rule is defined for this signal — it cannot be evaluated (not assumed).',
        notes: ['No matching rule in signal-rules.ts — reported as unmeasured (configuration gap, never fabricated).'],
      });
      continue;
    }

    const conditions: EvaluatedCondition[] = [];
    const domainsSeen = new Set<string>();
    let measuredCount = 0;
    let anyFailMeasured = false;
    let anyUnmeasured = false;
    let allSatisfied = true;

    for (const cond of rule.conditions) {
      const m = meta.get(cond.competency_id) ?? { name: null, domain: null };
      const domain = m.domain;
      const usable = !!(domain && MEASURABLE_ONTO_DOMAINS.has(domain) && domScore.has(domain));
      const score = usable ? (domScore.get(domain as string) as number) : null;
      const state = classify(score);
      const satisfied = isSatisfied(cond.direction, state);
      if (domain) domainsSeen.add(domain);

      conditionsTotal += 1;
      if (state === 'unmeasured') {
        anyUnmeasured = true;
        allSatisfied = false;
      } else {
        measuredCount += 1;
        conditionsMeasured += 1;
        if (satisfied === false) {
          anyFailMeasured = true;
          allSatisfied = false;
        }
      }

      conditions.push({
        competency_id: cond.competency_id,
        competency_name: m.name,
        onto_domain: domain,
        direction: cond.direction,
        actual_score: score,
        actual_band: score != null ? bandLabel(score) : null,
        state,
        satisfied,
      });
    }

    const total = rule.conditions.length;
    // Status: a definitively-failed measured condition makes the signal not_met
    // even if other inputs are unmeasured (it can never fire). Otherwise: all
    // satisfied -> fired; some unmeasured -> indeterminate; none measured -> unmeasured.
    let status: SignalStatus;
    if (measuredCount === 0) status = 'unmeasured';
    else if (anyFailMeasured) status = 'not_met';
    else if (anyUnmeasured) status = 'indeterminate';
    else status = allSatisfied ? 'fired' : 'not_met';

    const coverage = total > 0 ? Math.round((measuredCount / total) * 1000) / 10 : 0;
    const confidence_band: EvaluatedSignal['confidence_band'] =
      measuredCount === 0 ? 'unmeasured' : measuredCount === total ? 'measured' : 'provisional';

    const distinctDomains = Array.from(domainsSeen).sort();
    const notes: string[] = [];
    if (status === 'fired') {
      notes.push(`${def.name} fired — all ${total} contributing competenc${total === 1 ? 'y is' : 'ies are'} measured and satisfy the rule.`);
    } else if (status === 'indeterminate') {
      const missing = conditions.filter((c) => c.state === 'unmeasured').map((c) => c.competency_name ?? c.competency_id);
      notes.push(`Indeterminate — the measured inputs do not contradict the rule, but ${missing.length} input(s) are unmeasured (${missing.join(', ')}). Not fired on partial evidence.`);
    } else if (status === 'not_met') {
      notes.push(`${def.name} does not fire — at least one measured competency does not meet its required direction.`);
    } else {
      notes.push('Unmeasured — none of the contributing competencies have a measured score for this subject (not assumed).');
    }
    if (distinctDomains.length > 0 && distinctDomains.length < total) {
      notes.push(`Measured via a domain-PROXY: ${total} competencies currently resolve through ${distinctDomains.length} distinct domain${distinctDomains.length === 1 ? '' : 's'} (${distinctDomains.join(', ')}), so they share a score until finer-grained competency scoring is populated.`);
    } else {
      notes.push('Measured via a domain-PROXY: each competency inherits its onto-domain score; precision upgrades automatically when finer-grained scoring is populated.');
    }

    signals.push({
      signal_id: def.signal_id,
      name: def.name,
      description: def.description,
      polarity: def.polarity,
      category: def.category,
      status,
      fired: status === 'fired',
      conditions,
      conditions_total: total,
      conditions_measured: measuredCount,
      coverage_pct: coverage,
      distinct_domains: distinctDomains,
      confidence_band,
      rationale: rule.rationale,
      notes,
    });
  }

  const fired = signals.filter((s) => s.fired);
  const measurable = domScore.size > 0 && profileMeasured;

  const notes: string[] = [
    'Signals COMPOSE measured competency strengths/weaknesses against a curated rule library — they are developmental indicators, never hiring/promotion/placement verdicts.',
  ];
  if (!profileMeasured) {
    notes.push('No scored profile for this subject yet — generate and score an assessment first. Every signal is unmeasured (not assumed).');
  } else if (!measurable) {
    notes.push('The subject has a profile but no measurable domains cover the signal competencies — signals are unmeasured (not assumed).');
  } else {
    notes.push(`${fired.length} of ${signals.length} signals fired. Coverage (share of rule conditions with a measured score) is reported separately from firing.`);
    const indeterminate = signals.filter((s) => s.status === 'indeterminate').length;
    if (indeterminate > 0) notes.push(`${indeterminate} signal(s) are indeterminate — some contributing competencies are unmeasured, so the signal is neither confirmed nor ruled out (never fired on partial evidence).`);
  }

  const coveragePct = conditionsTotal > 0 ? Math.round((conditionsMeasured / conditionsTotal) * 1000) / 10 : null;

  return {
    ok: true,
    subject_id: sid,
    version: EMPLOYABILITY_SIGNAL_ENGINE_VERSION,
    library_version: SIGNAL_LIBRARY_VERSION,
    available: SIGNAL_LIBRARY.length > 0,
    measurable,
    signals_fired: fired,
    signals,
    summary: {
      total_signals: signals.length,
      fired: fired.length,
      positive_fired: fired.filter((s) => s.polarity === 'positive').length,
      risk_fired: fired.filter((s) => s.polarity === 'risk').length,
      indeterminate: signals.filter((s) => s.status === 'indeterminate').length,
      unmeasured: signals.filter((s) => s.status === 'unmeasured').length,
      conditions_total: conditionsTotal,
      conditions_measured: conditionsMeasured,
      coverage_pct: coveragePct,
    },
    ei_profile_summary: emptyEiSummary(eiProfile),
    language_policy: LANGUAGE_POLICY,
    notes,
    generated_at: now,
  };
}

/**
 * Return the curated signal catalog (library + rules) — read-only, no DB touch.
 * Lets the admin surface enumerate what signals CAN be derived and how.
 */
export function getSignalCatalog(): {
  version: string;
  library_version: string;
  signals: Array<SignalDefinition & {
    conditions: Array<{ competency_id: string; direction: SignalDirection }>;
    rationale: string;
  }>;
  thresholds: { strong_min_score: number; low_max_score: number };
  generated_at: string;
} {
  return {
    version: EMPLOYABILITY_SIGNAL_ENGINE_VERSION,
    library_version: SIGNAL_LIBRARY_VERSION,
    signals: SIGNAL_LIBRARY.map((def) => {
      const rule = getSignalRule(def.signal_id);
      return {
        ...def,
        conditions: rule ? rule.conditions.map((c) => ({ competency_id: c.competency_id, direction: c.direction })) : [],
        rationale: rule?.rationale ?? 'No rule defined.',
      };
    }),
    thresholds: { strong_min_score: SIGNAL_STRONG_MIN_SCORE, low_max_score: SIGNAL_LOW_MAX_SCORE },
    generated_at: new Date().toISOString(),
  };
}

// Re-export the definition lookup for any consumer that needs it.
export { getSignalDefinition };
