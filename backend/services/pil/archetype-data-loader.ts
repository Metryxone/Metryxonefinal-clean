/**
 * CAPADEX PIL — Phase 2 shared data loader (read-only).
 *
 * SINGLE SOURCE OF TRUTH for sub-phases 2A (read-only inputs) + 2B (per-concern
 * relationship context) + 2B(ii) (behavior-evidence propagation through the
 * relationship graph). The Phase-2 runner AND the Phase-2.1 diagnostic both import
 * this so the contexts they reason over can never drift apart.
 *
 * Reads ONLY existing CAPADEX/Phase-1.5/1.6 tables. Writes nothing.
 */
import type { Pool, PoolClient } from 'pg';
import { BEHAVIOR_CATEGORIES, type BehaviorCategory, type ConcernContext } from './archetype-intelligence-engine.js';

export type Queryable = Pool | PoolClient;

export interface OntologyRow { concern_id: string; concern_name: string; canonical_type: string; }
export interface CapPair { capability_concern_id: string; capability_name: string; problem_concern_id: string; problem_name: string; mapping_reason: string | null; }
export interface FamilyRow { family_name: string; concern_count: number; primary_concern_ids: string[]; }
export interface SimRow { concern_a: string; concern_b: string; }
export interface BehRow { capability_id: string; behavior_category: BehaviorCategory; n: string; }
export interface FamCovRow { family_name: string; coverage_pct: string; }

export interface ArchetypeInputs {
  ontology: OntologyRow[];
  capPairs: CapPair[];
  families: FamilyRow[];
  simPairs: SimRow[];
  framing: Map<string, { cap: string; prob: string; reason: string }>;
  behByConcern: Map<string, Partial<Record<BehaviorCategory, number>>>;
  propByConcern: Map<string, Partial<Record<BehaviorCategory, number>>>;
  familyCoverageOf: Map<string, number>;
  contexts: ConcernContext[];
  /** convenience counts for logging */
  behaviorGroundedConcerns: number;
}

/**
 * Load all read-only inputs and build the relationship-grounded per-concern contexts.
 * Behaviour-preserving extraction of runner sub-phases 2A + 2B + 2B(ii).
 */
export async function loadArchetypeContexts(db: Queryable): Promise<ArchetypeInputs> {
  // ── 2A — read-only inputs ──────────────────────────────────────────────────
  const ontology = (await db.query<OntologyRow>(
    'SELECT concern_id, concern_name, canonical_type FROM normalized_concern_ontology')).rows;
  const capPairs = (await db.query<CapPair>(
    'SELECT capability_concern_id, capability_name, problem_concern_id, problem_name, mapping_reason FROM capability_problem_map')).rows;
  const families = (await db.query<FamilyRow>(
    'SELECT family_name, concern_count, primary_concern_ids FROM concern_families')).rows;
  const simPairs = (await db.query<SimRow>(
    'SELECT concern_a, concern_b FROM construct_similarity_map ORDER BY concern_a, concern_b')).rows;
  const behRows = (await db.query<BehRow>(
    'SELECT capability_id, behavior_category, COUNT(DISTINCT behavior_id)::text AS n FROM capability_problem_behavior_map GROUP BY 1,2')).rows;
  const famCov = (await db.query<FamCovRow>(
    'SELECT family_name, coverage_pct FROM family_behavior_coverage')).rows;
  const familyCoverageOf = new Map<string, number>();
  for (const r of famCov) familyCoverageOf.set(r.family_name, Number(r.coverage_pct) || 0);

  // ── 2B — per-concern relationship context ──────────────────────────────────
  const framing = new Map<string, { cap: string; prob: string; reason: string }>();
  for (const p of capPairs) {
    framing.set(p.capability_concern_id, { cap: p.capability_name, prob: p.problem_name, reason: p.mapping_reason || '' });
  }
  const behByConcern = new Map<string, Partial<Record<BehaviorCategory, number>>>();
  for (const r of behRows) {
    const m = behByConcern.get(r.capability_id) ?? {};
    m[r.behavior_category] = (m[r.behavior_category] ?? 0) + Number(r.n);
    behByConcern.set(r.capability_id, m);
  }

  // ── 2B(ii) — propagate behavior evidence through the RELATIONSHIP GRAPH ─────
  const propByConcern = new Map<string, Partial<Record<BehaviorCategory, number>>>();
  const addProp = (id: string, src?: Partial<Record<BehaviorCategory, number>>) => {
    if (!src) return;
    const m = propByConcern.get(id) ?? {};
    for (const cat of BEHAVIOR_CATEGORIES) if (src[cat]) m[cat] = (m[cat] ?? 0) + (src[cat] ?? 0);
    propByConcern.set(id, m);
  };
  const isDirect = (id: string) => framing.has(id) || behByConcern.has(id);
  for (const s of simPairs) {
    if (!isDirect(s.concern_a) && behByConcern.has(s.concern_b)) addProp(s.concern_a, behByConcern.get(s.concern_b));
    if (!isDirect(s.concern_b) && behByConcern.has(s.concern_a)) addProp(s.concern_b, behByConcern.get(s.concern_a));
  }
  for (const f of families) {
    // Phase 2.3: the `family_behavior_coverage.coverage_pct<=0` skip was redundant AND
    // over-conservative — it blocked propagation from ~49 families that DO contain a
    // directly-grounded primary sibling but whose coverage_pct metadata is 0/absent.
    // The `grounded.length === 0` guard below already requires REAL sibling behavior, so
    // we propagate whenever such evidence exists regardless of the coverage_pct field.
    // No fabrication: every propagated signature is summed from real grounded siblings.
    const ids = Array.isArray(f.primary_concern_ids) ? f.primary_concern_ids : [];
    const grounded = ids.filter((id) => behByConcern.has(id));
    if (grounded.length === 0) continue;
    const famSig: Partial<Record<BehaviorCategory, number>> = {};
    for (const gid of grounded) for (const cat of BEHAVIOR_CATEGORIES) { const n = behByConcern.get(gid)?.[cat] ?? 0; if (n) famSig[cat] = (famSig[cat] ?? 0) + n; }
    for (const id of ids) if (!isDirect(id)) addProp(id, famSig);
  }

  const contexts: ConcernContext[] = ontology.map((c) => {
    const f = framing.get(c.concern_id);
    return {
      concernId: c.concern_id,
      concernName: c.concern_name,
      canonicalType: c.canonical_type,
      capabilityName: f?.cap,
      problemName: f?.prob,
      mappingReason: f?.reason,
      hasDirectCapabilityProblem: framing.has(c.concern_id),
      behaviorCounts: behByConcern.get(c.concern_id) ?? {},
      propagatedBehaviorCounts: propByConcern.get(c.concern_id) ?? {},
    };
  });

  return {
    ontology, capPairs, families, simPairs,
    framing, behByConcern, propByConcern, familyCoverageOf,
    contexts,
    behaviorGroundedConcerns: new Set(behRows.map((r) => r.capability_id)).size,
  };
}
