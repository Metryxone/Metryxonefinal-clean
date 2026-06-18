/**
 * CAPADEX PIL — Phase 7: Recommendation Generator (pure, read-only).
 *
 *   COMPOSES resolved session intelligence into categorized recommendations. Given the
 *   session's ACTIVE constructs (each with the source that justifies it) + the resolved
 *   pipeline lineage + the authored catalog, it selects construct-anchored catalog rows
 *   and emits Career / Learning / Project / Development recommendations.
 *
 *   NO new scoring, NO new archetypes, NO fabrication. A recommendation fires ONLY for
 *   a construct that is genuinely active in the session AND backed by ≥1 resolved
 *   lineage hop → no orphans. Each rec records the deepest resolved hop it anchors to,
 *   so the explainability engine can stitch an honest Concern→…→Intervention→
 *   Recommendation trace.
 *
 * CANON: pure, deterministic, never throws. Empty active set / empty catalog → honest
 *   empty categories with notes (never invented content).
 */
import type { PipelineHop, HopKey } from './pipeline-resolver';
import { HOP_ORDER } from './report-explainability-engine';
import {
  type CatalogEntry,
  type RecCategory,
  type RecStakeholder,
  REC_CATEGORIES,
  selectCatalog,
} from './recommendation-catalog';

// ── Public shapes ────────────────────────────────────────────────────────────
export type ConstructSource = 'intervention' | 'concern';

export interface ActiveConstruct {
  key: string;
  source: ConstructSource;
}

export interface GeneratedRecommendation {
  recommendation_key: string;
  category: RecCategory;
  sub_type: string;
  anchor_construct: string;
  source: ConstructSource;
  /** Deepest RESOLVED lineage hop that justifies this rec (drives the honest trace). */
  anchor_hop: HopKey | null;
  title: string;
  description: string;
  rationale: string;
  rank: number;
}

export interface CategoryRecommendations {
  category: RecCategory;
  items: GeneratedRecommendation[];
  note: string | null;
}

export interface GeneratedRecommendationSet {
  stakeholder: RecStakeholder;
  active_constructs: ActiveConstruct[];
  categories: CategoryRecommendations[];
}

// Each construct anchors at the hop that genuinely justifies it; the trace then runs
// to the deepest RESOLVED hop at-or-before this preferred depth (never overclaims).
const PREFERRED_ANCHOR: Record<ConstructSource, HopKey> = {
  intervention: 'archetype_to_intervention',
  concern: 'signal_to_concern',
};

const PER_CATEGORY_CAP = 16;

/** Deepest resolved hop at-or-before `preferred`; falls back to deepest resolved hop. */
export function deepestResolvedHop(lineage: PipelineHop[], preferred: HopKey): HopKey | null {
  const cap = HOP_ORDER.indexOf(preferred);
  let bestCapped: { key: HopKey; idx: number } | null = null;
  let bestAny: { key: HopKey; idx: number } | null = null;
  for (const h of lineage) {
    if (!h.resolved) continue;
    const idx = HOP_ORDER.indexOf(h.key as HopKey);
    if (idx < 0) continue;
    if (!bestAny || idx > bestAny.idx) bestAny = { key: h.key as HopKey, idx };
    if (idx <= cap && (!bestCapped || idx > bestCapped.idx)) bestCapped = { key: h.key as HopKey, idx };
  }
  return (bestCapped ?? bestAny)?.key ?? null;
}

/**
 * Pure: build the full recommendation set for one stakeholder. Deterministic order;
 * honest empty categories when nothing matches.
 */
export function generateRecommendations(
  catalog: CatalogEntry[],
  activeConstructs: ActiveConstruct[],
  lineage: PipelineHop[],
  stakeholder: RecStakeholder,
): GeneratedRecommendationSet {
  // Construct → its justifying source (intervention beats concern for deepest trace).
  const sourceOf = new Map<string, ConstructSource>();
  for (const ac of activeConstructs) {
    const prev = sourceOf.get(ac.key);
    if (!prev || (prev === 'concern' && ac.source === 'intervention')) sourceOf.set(ac.key, ac.source);
  }
  const constructs = [...sourceOf.keys()];
  const anchorHopOf = new Map<string, HopKey | null>();
  for (const [k, src] of sourceOf) anchorHopOf.set(k, deepestResolvedHop(lineage, PREFERRED_ANCHOR[src]));

  const categories: CategoryRecommendations[] = REC_CATEGORIES.map((category) => {
    const matches = selectCatalog(catalog, { constructs, stakeholder, category });
    const items: GeneratedRecommendation[] = matches.slice(0, PER_CATEGORY_CAP).map((e, i) => ({
      recommendation_key: e.recommendation_key,
      category: e.category,
      sub_type: e.sub_type,
      anchor_construct: e.anchor_construct,
      source: sourceOf.get(e.anchor_construct)!,
      anchor_hop: anchorHopOf.get(e.anchor_construct) ?? null,
      title: e.title,
      description: e.description,
      rationale: e.rationale,
      rank: i + 1,
    }));
    const note =
      items.length > 0
        ? null
        : constructs.length === 0
        ? 'No resolved intelligence yet — recommendations appear once the assessment activates behavioural constructs.'
        : 'No catalog entry matched the active constructs for this category yet.';
    return { category, items, note };
  });

  return {
    stakeholder,
    active_constructs: activeConstructs.filter((ac) => sourceOf.get(ac.key) === ac.source),
    categories,
  };
}
