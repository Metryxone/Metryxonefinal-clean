/**
 * WC-3 L5D (Runtime) — Journey Projection Intelligence.
 *
 * Deterministic, pure projection along the APPROVED chain:
 *
 *     Question → Bridge Tag → Construct → Outcome → Journey Route
 *
 * Extends L5C Outcome Projection by composing the per-question outcome-model
 * confidence vector (services/wc3/outcome-projection.ts) onto the EXISTING journey
 * routes (`wc3_journey_routes.model_affinities`). It introduces NO new routes,
 * products, journey models, constructs, outcome models, ontology, or crosswalks, and
 * does NOT touch any of them. The module is additive: imported only by the L5D
 * build/measurement script and NOT wired into any live selection / routing path.
 *
 * Journey fit (mirrors the live journey-intelligence composition):
 *     fit(route) = Σ over reachable outcome models m of
 *                  ( route.model_affinities[m] × outcomeConfidence[m] )
 * Only outcome models actually reached by the question contribute — never fabricated.
 *
 * Derives, per bridge tag:
 *   - Primary Journey   — strongest reachable route
 *   - Secondary Journey — next-strongest route with real fit (else null)
 *   - Journey Confidence — min(primaryFit,1) × journey concentration
 *                          (folds in outcome confidence + route affinity + concentration)
 *   - Ambiguity         — 1 − concentration
 *
 * Honesty contract: a question with no outcome (UNMAPPED / construct→no-model) reaches
 * NO journey — primary_journey = null (orphan), never forced onto the mentoring fallback.
 * The mentoring fallback is a REAL route with real affinities; it only wins primary when
 * no specialised route outscores it.
 */

import {
  resolveConstructForBridgeTag,
  type CrosswalkEntry,
} from '../../data/bridge-tag-construct-crosswalk';
import { outcomeModelConfidences, type OutcomeModelLite } from './outcome-projection';

/** Minimal shape of a `wc3_journey_routes` row needed for projection. */
export interface JourneyRouteLite {
  route_key: string;
  display_label: string;
  model_affinities: Record<string, number>;
  corpus_status: string;
  is_fallback: boolean;
  fallback_priority: number;
}

export interface JourneyProjection {
  bridge_tag: string;
  /** Reachable outcome models (keys), for traceability. */
  outcome_models: string[];
  primary_journey: string | null;
  secondary_journey: string | null;
  /** 0..1 — min(primaryFit,1) × concentration. */
  journey_confidence: number;
  /** 0..1 — 1 − concentration. */
  ambiguity: number;
  /** Number of routes with real (>0) fit. */
  reachable_journeys: number;
  /** All routes with fit>0, primary first, then the remaining routes in raw-fit rank
   *  order (so ranked_journeys[0] === primary_journey even after an exam-guard demotion). */
  ranked_journeys: string[];
  /** true when the only route reached is the fallback (mentoring). */
  fallback_only: boolean;
  reason: string;
}

const round = (x: number, p = 3): number => {
  const f = 10 ** p;
  return Math.round(x * f) / f;
};

/** Mirror of the live journey resolver's calibration guard (journey-intelligence.ts). */
const EXAM_ROUTE_KEY = 'competitive_exam';
const EXAM_MODEL_KEY = 'exam_readiness';

/** Constructs a crosswalk entry contributes (HIGH → one; REVIEW → candidates). */
function entryConstructs(entry: CrosswalkEntry | null): string[] {
  if (!entry) return [];
  if (entry.status === 'HIGH_CONFIDENCE' && entry.construct) return [entry.construct];
  if (entry.status === 'REVIEW_REQUIRED' && entry.candidates) return entry.candidates;
  return [];
}

interface RouteFit {
  route: JourneyRouteLite;
  fit: number;
}

/** Total deterministic order: fit desc → fallback_priority asc → route_key asc. */
function rankFits(fits: RouteFit[]): RouteFit[] {
  return [...fits].sort((a, b) => {
    if (b.fit !== a.fit) return b.fit - a.fit;
    if (a.route.fallback_priority !== b.route.fallback_priority) {
      return a.route.fallback_priority - b.route.fallback_priority;
    }
    return a.route.route_key < b.route.route_key ? -1 : a.route.route_key > b.route.route_key ? 1 : 0;
  });
}

/**
 * Pure projection from a crosswalk entry onto the journey routes via the outcome
 * layer. No DB, no IO — fully deterministic given the same inputs.
 */
export function projectJourney(
  bridgeTag: string,
  entry: CrosswalkEntry | null,
  models: OutcomeModelLite[],
  routes: JourneyRouteLite[],
): JourneyProjection {
  const { confidences } = outcomeModelConfidences(entry, models);

  if (confidences.size === 0) {
    return {
      bridge_tag: bridgeTag,
      outcome_models: [],
      primary_journey: null,
      secondary_journey: null,
      journey_confidence: 0,
      ambiguity: 0,
      reachable_journeys: 0,
      ranked_journeys: [],
      fallback_only: false,
      reason: 'no reachable outcome model → no journey (orphan)',
    };
  }

  const fits: RouteFit[] = routes.map((route) => {
    let fit = 0;
    for (const [modelKey, conf] of confidences) {
      const aff = route.model_affinities[modelKey];
      if (aff && aff > 0) fit += aff * conf;
    }
    return { route, fit: round(fit) };
  });

  const ranked = rankFits(fits.filter((f) => f.fit > 0));
  const outcomeModels = [...confidences.keys()].sort();

  if (ranked.length === 0) {
    // Reachable outcome(s) exist but no route has affinity for them (structurally
    // impossible with the mentoring catch-all, but kept honest).
    return {
      bridge_tag: bridgeTag,
      outcome_models: outcomeModels,
      primary_journey: null,
      secondary_journey: null,
      journey_confidence: 0,
      ambiguity: 0,
      reachable_journeys: 0,
      ranked_journeys: [],
      fallback_only: false,
      reason: `outcome model(s) [${outcomeModels.join(', ')}] have no route affinity`,
    };
  }

  // Exam guard (mirrors the live resolver): the corpus-pending Competitive Exam route
  // may only be PRIMARY with DEDICATED exam evidence (an EXAM_*-prefixed construct in
  // exam_readiness). Otherwise it would win on a construct it SHARES with other models
  // (e.g. STRESS_MANAGEMENT / ACADEMIC_RECOVERY), steering a non-exam concern into exam
  // prep. When the guard fires the exam route is RETAINED as the secondary (never dropped
  // — invariant: exam pathway always supported), only demoted from primary.
  const examConstructs = models.find((m) => m.model_key === EXAM_MODEL_KEY)?.construct_keys ?? [];
  const hasDedicatedExam = entryConstructs(entry).some(
    (c) => c.startsWith('EXAM_') && examConstructs.includes(c),
  );
  let primaryIdx = 0;
  let examGuardApplied = false;
  if (!hasDedicatedExam && ranked[0].route.route_key === EXAM_ROUTE_KEY && ranked.length >= 2) {
    const altIdx = ranked.findIndex((f, i) => i > 0 && f.route.route_key !== EXAM_ROUTE_KEY);
    if (altIdx > 0) {
      primaryIdx = altIdx;
      examGuardApplied = true;
    }
  }

  const primary = ranked[primaryIdx];
  const secondary = examGuardApplied ? ranked[0] : (ranked[primaryIdx + 1] ?? null);
  const totalFit = ranked.reduce((s, f) => s + f.fit, 0);
  const concentration = primary.fit / totalFit;

  // Primary first, then remaining routes in raw-fit order — so consumers can rely on
  // ranked_journeys[0] === primary_journey even when the exam guard demoted the raw top.
  const orderedKeys = [
    primary.route.route_key,
    ...ranked.filter((f) => f.route.route_key !== primary.route.route_key).map((f) => f.route.route_key),
  ];

  return {
    bridge_tag: bridgeTag,
    outcome_models: outcomeModels,
    primary_journey: primary.route.route_key,
    secondary_journey: secondary ? secondary.route.route_key : null,
    journey_confidence: round(Math.min(primary.fit, 1) * concentration),
    ambiguity: round(1 - concentration),
    reachable_journeys: ranked.length,
    ranked_journeys: orderedKeys,
    fallback_only: ranked.length === 1 && primary.route.is_fallback,
    reason:
      `${outcomeModels.length} outcome model(s) → ${ranked.length} route(s); primary ${primary.route.route_key} (fit ${primary.fit})` +
      (examGuardApplied ? '; exam route demoted to secondary (no dedicated EXAM_ evidence)' : ''),
  };
}

/** Convenience: resolve the bridge tag via the crosswalk, then project. */
export function projectJourneyForBridgeTag(
  bridgeTag: string,
  models: OutcomeModelLite[],
  routes: JourneyRouteLite[],
): JourneyProjection {
  return projectJourney(bridgeTag, resolveConstructForBridgeTag(bridgeTag), models, routes);
}
