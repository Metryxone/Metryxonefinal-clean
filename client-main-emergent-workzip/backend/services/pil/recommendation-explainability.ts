/**
 * CAPADEX PIL — Phase 7: Recommendation Explainability (pure, read-only).
 *
 *   Stitches the honest lineage behind every generated recommendation:
 *
 *     Concern → Capability → Problem → Behavior → Archetype → Intervention
 *             → Recommendation   (the NEW 8th node)
 *
 *   For each rec it takes the resolved pipeline hops up to the rec's `anchor_hop`
 *   (chainTo, reused from 6C) and APPENDS a synthetic `intervention_to_recommendation`
 *   node naming the recommendation. It then computes EXPLAINABILITY COVERAGE — the
 *   fraction of recs that resolve to ≥1 real lineage hop plus the rec node — overall
 *   and per category.
 *
 * CANON (6C honesty lesson): statement-coverage ≠ chain-completeness. A rec is "traced"
 *   only when a REAL resolved hop supports it (coverage is honest, never inflated), and
 *   `chain_complete` is reported SEPARATELY (all 7 hops resolved). Never throws.
 */
import type { PipelineHop, HopKey } from './pipeline-resolver';
import { HOP_ORDER, chainTo } from './report-explainability-engine';
import type {
  GeneratedRecommendation,
  CategoryRecommendations,
  GeneratedRecommendationSet,
} from './recommendation-generator';
import type { RecCategory } from './recommendation-catalog';

// ── Public shapes ────────────────────────────────────────────────────────────
export interface RecTraceNode {
  step: number;
  key: string;
  label: string;
  summary: string;
}

export interface TracedRecommendation extends GeneratedRecommendation {
  trace: RecTraceNode[];
  traced: boolean;        // ≥1 real resolved hop supports this rec
  chain_complete: boolean; // all 7 lineage hops resolved (full chain to Intervention)
}

export interface TracedCategory {
  category: RecCategory;
  items: TracedRecommendation[];
  note: string | null;
}

export interface CategoryCoverage {
  category: RecCategory;
  total: number;
  traced: number;
  coverage: number; // 0..1
}

export interface RecExplainabilityCoverage {
  total_recommendations: number;
  traced_recommendations: number;
  coverage: number;           // 0..1, 4dp
  fully_traceable: boolean;   // coverage === 1
  chain_complete_count: number;
  unresolved_hops: number;    // hops in the lineage not resolved (honest caveat)
  by_category: CategoryCoverage[];
  lineage: PipelineHop[];
}

export interface TracedRecommendationSet {
  stakeholder: GeneratedRecommendationSet['stakeholder'];
  active_constructs: GeneratedRecommendationSet['active_constructs'];
  categories: TracedCategory[];
  explainability: RecExplainabilityCoverage;
}

const REC_HOP_KEY = 'intervention_to_recommendation';
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** All 7 lineage hops resolved → the rec traces the complete chain to Intervention. */
function chainComplete(lineage: PipelineHop[]): boolean {
  return HOP_ORDER.every((k) => lineage.find((h) => h.key === k)?.resolved === true);
}

function unresolvedHops(lineage: PipelineHop[]): number {
  return HOP_ORDER.filter((k) => lineage.find((h) => h.key === k)?.resolved !== true).length;
}

/** Build the ordered Concern→…→Intervention→Recommendation trace for one rec. */
function traceRecommendation(rec: GeneratedRecommendation, lineage: PipelineHop[]): RecTraceNode[] {
  const anchor = (rec.anchor_hop ?? null) as HopKey | null;
  const lineageTrace: RecTraceNode[] = anchor ? chainTo(lineage, anchor) : [];
  const recNode: RecTraceNode = {
    step: HOP_ORDER.length + 1,
    key: REC_HOP_KEY,
    label: 'Intervention → Recommendation',
    summary: `Recommendation derived from the ${rec.anchor_construct} construct (${rec.category} · ${rec.sub_type}).`,
  };
  return [...lineageTrace, recNode];
}

/**
 * Pure: attach a full trace to every rec and compute overall + per-category coverage.
 * Coverage of an empty set is 1 (vacuously — nothing unsupported).
 */
export function attachRecommendationExplainability(
  set: GeneratedRecommendationSet,
  lineage: PipelineHop[],
): TracedRecommendationSet {
  const complete = chainComplete(lineage);
  const by_category: CategoryCoverage[] = [];
  const tracedCategories: TracedCategory[] = [];
  let total = 0;
  let traced = 0;
  let chainCompleteCount = 0;

  for (const cat of set.categories as CategoryRecommendations[]) {
    let catTraced = 0;
    const items: TracedRecommendation[] = cat.items.map((rec) => {
      const trace = traceRecommendation(rec, lineage);
      // "traced" requires ≥1 REAL resolved lineage hop (not just the rec node).
      const isTraced = trace.length > 1;
      if (isTraced) catTraced += 1;
      if (complete) chainCompleteCount += 1;
      return { ...rec, trace, traced: isTraced, chain_complete: complete };
    });
    total += items.length;
    traced += catTraced;
    by_category.push({
      category: cat.category,
      total: items.length,
      traced: catTraced,
      coverage: items.length ? round4(catTraced / items.length) : 1,
    });
    tracedCategories.push({ category: cat.category, items, note: cat.note });
  }

  const coverage = total ? round4(traced / total) : 1;
  return {
    stakeholder: set.stakeholder,
    active_constructs: set.active_constructs,
    categories: tracedCategories,
    explainability: {
      total_recommendations: total,
      traced_recommendations: traced,
      coverage,
      fully_traceable: coverage === 1,
      chain_complete_count: chainCompleteCount,
      unresolved_hops: unresolvedHops(lineage),
      by_category,
      lineage,
    },
  };
}

export { REC_HOP_KEY };
