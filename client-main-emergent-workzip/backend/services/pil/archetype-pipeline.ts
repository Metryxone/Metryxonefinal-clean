/**
 * CAPADEX PIL — Phase 2.2 archetype pipeline (shared compute + persist).
 *
 * Extracted from the Phase-2 CLI runner so the SAME deterministic compute + persist is
 * reused by the runner AND the governance API — they can never drift. The pipeline:
 *   1. loads read-only inputs via the shared loader,
 *   2. runs the deterministic archetype assignment (byte-identical to Phase 2.1),
 *   3. re-applies durable human governance decisions as a pure override layer,
 *   4. recomputes every downstream metric from the POST-override assignment (honest),
 *   5. persists the six archetype tables in one transaction.
 *
 * Reversibility + "survives re-runs" are automatic: every rebuild re-applies ALL active
 * decisions from the durable table; deactivating a decision and rebuilding reverts that
 * concern to its deterministic assignment. Zero active decisions → byte-identical output.
 */
import { Pool, type PoolClient } from 'pg';
import {
  ARCHETYPES, BEHAVIOR_CATEGORIES, assignArchetype, similarityCapture,
  classifyValidation, discoveryReadiness, balanceScore,
  effectiveBehavior, classifyWeakReason, recommendStabilization, groundingCeiling, pickLeakTarget,
  type BehaviorCategory, type ConcernContext, type Assignment, type WeakReason,
} from './archetype-intelligence-engine.js';
import { loadArchetypeContexts } from './archetype-data-loader.js';
import {
  applyGovernance, ensureGovernanceSchema, listActiveDecisions,
  type GovernanceDecision, type GovernanceSummary,
} from './archetype-governance.js';

type Queryable = Pool | PoolClient;

export interface ProfileRow { key: string; category: BehaviorCategory; count: number; pct: number; }
export interface ValRow { key: string; members: number; caps: number; probs: number; grounded: number; coherence: number; distinct: number; status: string; notes: string; ceiling: number; weakReason: WeakReason; recommendation: string; }
export interface FamMapRow { family: string; key: string; count: number; total: number; share: number; primary: boolean; }
export interface UnmatchedRow { id: string; name: string; type: string; bestKey: string; bestScore: number; reason: string; }
export interface LibRow { key: string; name: string; def: string; primary: BehaviorCategory; stage: string; tokens: string[]; members: number; caps: number; probs: number; grounded: number; }

export interface ArchetypeComputeResult {
  // raw inputs (counts only — for the runner log)
  inputCounts: { ontology: number; capPairs: number; families: number; simPairs: number; behaviorGroundedConcerns: number; familyCoverage: number };
  // post-override assignment + lookups
  assignments: Assignment[];
  ctxOf: Map<string, ConcernContext>;
  membersByArch: Map<string, string[]>;
  groundedByArch: Map<string, number>;
  // rows for persist + CSV
  libRows: LibRow[];
  profileRows: ProfileRow[];
  valRows: ValRow[];
  unmatchedRows: UnmatchedRow[];
  famMapRows: FamMapRow[];
  governedIds: Set<string>;
  // headline metrics (post-override, honest)
  total: number;
  assignedCount: number;
  unmatchedCount: number;
  noAnchor: number;
  coverage: number;
  meanCoherence: number;
  balance: number;
  groundingCounts: Record<string, number>;
  relationshipGrounded: number;
  relationshipGrounding: number;
  cap: { evaluated: number; captured: number; ratio: number };
  fragmentedFamilies: number;
  readiness: number;
  statusCounts: Record<string, number>;
  // governance
  governance: GovernanceSummary;
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }

/**
 * Deterministic compute + governance override layer. Read-only (no DB writes). Pass the
 * active governance decisions to apply them; omit/empty → byte-identical Phase 2.1 output.
 */
export async function computeArchetypeResult(
  pool: Pool,
  decisions: GovernanceDecision[] = [],
): Promise<ArchetypeComputeResult> {
  const {
    ontology, capPairs, families, simPairs,
    contexts, behaviorGroundedConcerns, familyCoverageOf,
  } = await loadArchetypeContexts(pool);

  // ── deterministic assignment ───────────────────────────────────────────────
  const baseAssignments: Assignment[] = contexts.map(assignArchetype);
  const ctxOf = new Map<string, ConcernContext>(contexts.map((c) => [c.concernId, c]));

  // ── governance override layer (pure; empty decisions → identity) ────────────
  const gov = applyGovernance(baseAssignments, ctxOf, decisions);
  const assignments = gov.assignments;
  const { governedIds, rejectedIds, summary: governance } = gov;

  const assignOf = new Map<string, string | null>();
  for (const a of assignments) assignOf.set(a.concernId, a.archetypeKey);
  const membersByArch = new Map<string, string[]>();
  for (const a of ARCHETYPES) membersByArch.set(a.key, []);
  for (const a of assignments) if (a.archetypeKey) membersByArch.get(a.archetypeKey)!.push(a.concernId);

  // ── per-archetype behavior profile + capability/problem counts ──────────────
  const profileRows: ProfileRow[] = [];
  const capCountByArch = new Map<string, number>();
  const probCountByArch = new Map<string, number>();
  const groundedByArch = new Map<string, number>();
  const coherenceByArch = new Map<string, number>();

  const ceilingByArch = new Map<string, number>();
  for (const arch of ARCHETYPES) {
    const members = membersByArch.get(arch.key)!;
    const catTotals: Record<BehaviorCategory, number> = Object.fromEntries(
      BEHAVIOR_CATEGORIES.map((c) => [c, 0])) as Record<BehaviorCategory, number>;
    // `grounded` keeps its column meaning: members carrying DIRECT first-hand behaviors.
    // `effGrounded` is the coherence denominator: members with an EFFECTIVE dominant
    // (direct OR propagated) — consistent with how assignArchetype already grounds picks.
    let grounded = 0; let coherent = 0; let caps = 0; let probs = 0; let effGrounded = 0;
    const memberCtxs: ConcernContext[] = [];
    for (const id of members) {
      const ctx = ctxOf.get(id)!;
      memberCtxs.push(ctx);
      if (ctx.canonicalType === 'Capability') caps++;
      if (ctx.canonicalType === 'Problem') probs++;
      const counts = ctx.behaviorCounts;
      const cats = Object.keys(counts) as BehaviorCategory[];
      if (cats.length > 0) {
        grounded++;
        for (const cat of cats) catTotals[cat] += counts[cat] ?? 0;
      }
      // Coherence uses the EFFECTIVE dominant (real direct OR real propagated evidence).
      // name_only members have no dominant → they contribute to NEITHER numerator nor
      // denominator, so they still honestly DEPRESS the per-archetype ceiling (below) but
      // never inflate coherence.
      const dom = effectiveBehavior(ctx).dominant;
      if (dom != null) {
        effGrounded++;
        if (dom === arch.primaryCategory) coherent++;
      }
    }
    const totalBeh = BEHAVIOR_CATEGORIES.reduce((s, c) => s + catTotals[c], 0);
    for (const c of BEHAVIOR_CATEGORIES) {
      if (catTotals[c] > 0) profileRows.push({ key: arch.key, category: c, count: catTotals[c], pct: Math.round((catTotals[c] / totalBeh) * 10000) / 100 });
    }
    capCountByArch.set(arch.key, caps);
    probCountByArch.set(arch.key, probs);
    groundedByArch.set(arch.key, grounded);
    coherenceByArch.set(arch.key, effGrounded === 0 ? 0 : Math.round((coherent / effGrounded) * 10000) / 10000);
    ceilingByArch.set(arch.key, groundingCeiling(memberCtxs));
  }

  // ── distinctiveness (per-archetype internal similarity retention) ────────────
  // `leakInto` also records WHICH other archetype each archetype's external similarity
  // pairs land in, so a merge recommendation can name the closest sibling (derived from
  // the real bottom-up similarity signal, never hardcoded).
  const simTouch = new Map<string, { internal: number; external: number }>();
  const leakInto = new Map<string, Map<string, number>>();
  for (const a of ARCHETYPES) { simTouch.set(a.key, { internal: 0, external: 0 }); leakInto.set(a.key, new Map()); }
  const bumpLeak = (from: string, to: string) => { const m = leakInto.get(from)!; m.set(to, (m.get(to) ?? 0) + 1); };
  for (const sp of simPairs) {
    const ka = assignOf.get(sp.concern_a) ?? null;
    const kb = assignOf.get(sp.concern_b) ?? null;
    if (ka == null || kb == null) continue;
    if (ka === kb) { simTouch.get(ka)!.internal++; }
    else { simTouch.get(ka)!.external++; simTouch.get(kb)!.external++; bumpLeak(ka, kb); bumpLeak(kb, ka); }
  }
  const distinctByArch = new Map<string, number>();
  const leakTargetByArch = new Map<string, string | null>();
  for (const a of ARCHETYPES) {
    const t = simTouch.get(a.key)!;
    const denom = t.internal + t.external;
    distinctByArch.set(a.key, denom === 0 ? 0 : Math.round((t.internal / denom) * 10000) / 10000);
    leakTargetByArch.set(a.key, pickLeakTarget(leakInto.get(a.key)!));
  }

  const cap = similarityCapture(simPairs.map((s) => [s.concern_a, s.concern_b] as [string, string]), assignOf);

  // ── validation rows ─────────────────────────────────────────────────────────
  const valRows: ValRow[] = ARCHETYPES.map((a) => {
    const members = membersByArch.get(a.key)!.length;
    const coherence = coherenceByArch.get(a.key)!;
    const status = classifyValidation(coherence, members);
    const grounded = groundedByArch.get(a.key)!;
    const distinct = distinctByArch.get(a.key)!;
    const ceiling = ceilingByArch.get(a.key)!;
    const weakReason = classifyWeakReason({ status, memberCount: members, distinctiveness: distinct });
    const recommendation = recommendStabilization(weakReason, leakTargetByArch.get(a.key) ?? null);
    const notes = grounded === 0
      ? 'no behavior-grounded members — coherence not measurable from behaviors'
      : `${grounded}/${members} members behavior-grounded`;
    return {
      key: a.key, members, caps: capCountByArch.get(a.key)!, probs: probCountByArch.get(a.key)!,
      grounded, coherence, distinct, status, notes, ceiling, weakReason, recommendation,
    };
  });

  // ── concern-family roll-up ──────────────────────────────────────────────────
  const famMapRows: FamMapRow[] = [];
  let fragmentedFamilies = 0;
  for (const f of families) {
    const ids = Array.isArray(f.primary_concern_ids) ? f.primary_concern_ids : [];
    const counts = new Map<string, number>();
    let assigned = 0;
    for (const id of ids) {
      const k = assignOf.get(id);
      if (!k) continue;
      assigned++;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (counts.size === 0) continue;
    const max = Math.max(...counts.values());
    if (counts.size >= 2) fragmentedFamilies++;
    for (const [k, n] of counts) {
      famMapRows.push({ family: f.family_name, key: k, count: n, total: ids.length, share: Math.round((n / (assigned || 1)) * 10000) / 100, primary: n === max });
    }
  }

  // ── unmatched review (human rejects carry an explicit reason) ────────────────
  const unmatched = assignments.filter((a) => a.archetypeKey == null);
  const unmatchedRows: UnmatchedRow[] = unmatched.map((a) => {
    const ctx = ctxOf.get(a.concernId)!;
    const reason = rejectedIds.has(a.concernId)
      ? 'manually rejected by reviewer (human override)'
      : a.tokenMatches === 0
        ? 'no construct-token anchor in any archetype'
        : 'token anchor present but combined score below assignment threshold';
    return { id: a.concernId, name: ctx.concernName, type: ctx.canonicalType, bestKey: a.bestArchetypeKey, bestScore: a.bestScore, reason };
  });

  // ── readiness (post-override) ───────────────────────────────────────────────
  const total = assignments.length;
  const assignedCount = total - unmatched.length;
  const coverage = total === 0 ? 0 : assignedCount / total;
  const nonEmpty = valRows.filter((v) => v.members > 0);
  const meanCoherence = nonEmpty.length ? nonEmpty.reduce((s, v) => s + v.coherence, 0) / nonEmpty.length : 0;
  const balance = balanceScore(ARCHETYPES.map((a) => membersByArch.get(a.key)!.length));
  const groundingCounts = { direct_cpb: 0, propagated: 0, name_only: 0 } as Record<string, number>;
  for (const a of assignments) if (a.archetypeKey) groundingCounts[a.grounding]++;
  const relationshipGrounded = groundingCounts.direct_cpb + groundingCounts.propagated;
  const relationshipGrounding = assignedCount === 0 ? 0 : relationshipGrounded / assignedCount;
  const readiness = discoveryReadiness({ coverage, relationshipGrounding, similarityCapture: cap.ratio, meanCoherence, balance });
  const noAnchor = unmatched.filter((a) => a.tokenMatches === 0).length;

  // ── archetype library rows ──────────────────────────────────────────────────
  const libRows: LibRow[] = ARCHETYPES.map((a) => ({
    key: a.key, name: a.name, def: a.definition, primary: a.primaryCategory, stage: a.stageNote, tokens: a.tokens,
    members: membersByArch.get(a.key)!.length, caps: capCountByArch.get(a.key)!, probs: probCountByArch.get(a.key)!, grounded: groundedByArch.get(a.key)!,
  }));

  const statusCounts: Record<string, number> = { strong: 0, moderate: 0, weak: 0 };
  for (const v of valRows) statusCounts[v.status]++;

  return {
    inputCounts: { ontology: ontology.length, capPairs: capPairs.length, families: families.length, simPairs: simPairs.length, behaviorGroundedConcerns, familyCoverage: familyCoverageOf.size },
    assignments, ctxOf, membersByArch, groundedByArch,
    libRows, profileRows, valRows, unmatchedRows, famMapRows, governedIds,
    total, assignedCount, unmatchedCount: unmatched.length, noAnchor, coverage,
    meanCoherence, balance, groundingCounts, relationshipGrounded, relationshipGrounding,
    cap, fragmentedFamilies, readiness, statusCounts, governance,
  };
}

// ── persistence ───────────────────────────────────────────────────────────────

async function chunkedInsert(
  db: Queryable,
  build: (rows: unknown[][]) => { text: string; values: unknown[] },
  rows: unknown[][],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { text, values } = build(chunk);
    await db.query(text, values);
  }
}
function placeholders(rows: unknown[][], cols: number): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const groups = rows.map((r, ri) => {
    const ph = r.map((_v, ci) => `$${ri * cols + ci + 1}`);
    values.push(...r);
    return `(${ph.join(',')})`;
  });
  return { text: groups.join(','), values };
}

/** Canonical lazy schema for the six Phase-2 archetype tables (mirrors the migration). */
export async function ensureSchema(db: Queryable): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS archetype_library (
      archetype_id SERIAL PRIMARY KEY,
      archetype_key TEXT NOT NULL UNIQUE,
      archetype_name TEXT NOT NULL,
      definition TEXT NOT NULL DEFAULT '',
      primary_behavior_category TEXT NOT NULL
        CHECK (primary_behavior_category IN ('Academic','Career','Social','Emotional','Cognitive','Leadership','Self-Management','Learning')),
      stage_note TEXT NOT NULL DEFAULT '',
      signature_tokens JSONB NOT NULL DEFAULT '[]'::jsonb,
      member_count INTEGER NOT NULL DEFAULT 0,
      capability_count INTEGER NOT NULL DEFAULT 0,
      problem_count INTEGER NOT NULL DEFAULT 0,
      behavior_grounded_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS archetype_concern_map (
      map_id SERIAL PRIMARY KEY,
      archetype_id INTEGER NOT NULL REFERENCES archetype_library(archetype_id) ON DELETE CASCADE,
      archetype_key TEXT NOT NULL,
      concern_id TEXT NOT NULL UNIQUE,
      concern_name TEXT NOT NULL DEFAULT '',
      canonical_type TEXT NOT NULL DEFAULT '',
      assignment_score NUMERIC(6,4) NOT NULL DEFAULT 0 CHECK (assignment_score >= 0 AND assignment_score <= 1),
      token_matches INTEGER NOT NULL DEFAULT 0,
      assignment_method TEXT NOT NULL DEFAULT 'signature',
      grounding_source TEXT NOT NULL DEFAULT 'name_only',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS archetype_concern_map_arch_idx ON archetype_concern_map(archetype_id);
    CREATE TABLE IF NOT EXISTS archetype_behavior_profile (
      profile_id SERIAL PRIMARY KEY,
      archetype_id INTEGER NOT NULL REFERENCES archetype_library(archetype_id) ON DELETE CASCADE,
      archetype_key TEXT NOT NULL,
      behavior_category TEXT NOT NULL
        CHECK (behavior_category IN ('Academic','Career','Social','Emotional','Cognitive','Leadership','Self-Management','Learning')),
      behavior_count INTEGER NOT NULL DEFAULT 0,
      pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (archetype_id, behavior_category)
    );
    CREATE TABLE IF NOT EXISTS archetype_validation (
      validation_id SERIAL PRIMARY KEY,
      archetype_id INTEGER NOT NULL REFERENCES archetype_library(archetype_id) ON DELETE CASCADE,
      archetype_key TEXT NOT NULL UNIQUE,
      member_count INTEGER NOT NULL DEFAULT 0,
      capability_count INTEGER NOT NULL DEFAULT 0,
      problem_count INTEGER NOT NULL DEFAULT 0,
      behavior_grounded_count INTEGER NOT NULL DEFAULT 0,
      coherence NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (coherence >= 0 AND coherence <= 1),
      distinctiveness NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (distinctiveness >= 0 AND distinctiveness <= 1),
      validation_status TEXT NOT NULL DEFAULT 'weak' CHECK (validation_status IN ('strong','moderate','weak')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS archetype_unmatched_review (
      review_id SERIAL PRIMARY KEY,
      concern_id TEXT NOT NULL UNIQUE,
      concern_name TEXT NOT NULL DEFAULT '',
      canonical_type TEXT NOT NULL DEFAULT '',
      best_archetype_key TEXT NOT NULL DEFAULT '',
      best_score NUMERIC(6,4) NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS archetype_family_map (
      id SERIAL PRIMARY KEY,
      family_name TEXT NOT NULL,
      archetype_key TEXT NOT NULL,
      concern_count INTEGER NOT NULL DEFAULT 0,
      family_total INTEGER NOT NULL DEFAULT 0,
      share_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (family_name, archetype_key)
    );
    ALTER TABLE archetype_concern_map ADD COLUMN IF NOT EXISTS grounding_source TEXT NOT NULL DEFAULT 'name_only';
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'archetype_concern_grounding_chk') THEN
        ALTER TABLE archetype_concern_map ADD CONSTRAINT archetype_concern_grounding_chk
          CHECK (grounding_source IN ('direct_cpb','propagated','name_only'));
      END IF;
    END $$;
    -- Phase 2.3 — honest stabilization fields (additive; nullable defaults keep prior rows valid).
    ALTER TABLE archetype_validation ADD COLUMN IF NOT EXISTS grounding_ceiling NUMERIC(5,4) NOT NULL DEFAULT 0;
    ALTER TABLE archetype_validation ADD COLUMN IF NOT EXISTS weak_reason TEXT NOT NULL DEFAULT '';
    ALTER TABLE archetype_validation ADD COLUMN IF NOT EXISTS stabilization_recommendation TEXT NOT NULL DEFAULT 'none';
  `);
}

/** Persist a computed result into the six tables in one transaction (governance-aware). */
export async function persistArchetypeResult(pool: Pool, result: ArchetypeComputeResult): Promise<void> {
  await ensureSchema(pool);
  await ensureGovernanceSchema(pool);
  const { libRows, assignments, ctxOf, profileRows, valRows, unmatchedRows, famMapRows, governedIds } = result;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE archetype_library, archetype_concern_map, archetype_behavior_profile, archetype_validation, archetype_unmatched_review, archetype_family_map RESTART IDENTITY CASCADE');

    await chunkedInsert(client, (chunk) => {
      const { text, values } = placeholders(chunk, 10);
      return { text: `INSERT INTO archetype_library (archetype_key, archetype_name, definition, primary_behavior_category, stage_note, signature_tokens, member_count, capability_count, problem_count, behavior_grounded_count) VALUES ${text}`, values };
    }, libRows.map((r) => [r.key, r.name, r.def, r.primary, r.stage, JSON.stringify(r.tokens), r.members, r.caps, r.probs, r.grounded]));

    const keyToId = new Map<string, number>();
    for (const row of (await client.query<{ archetype_id: number; archetype_key: string }>('SELECT archetype_id, archetype_key FROM archetype_library')).rows) keyToId.set(row.archetype_key, row.archetype_id);

    const concernMapRows = assignments.filter((a) => a.archetypeKey).map((a) => {
      const ctx = ctxOf.get(a.concernId)!;
      return [keyToId.get(a.archetypeKey!), a.archetypeKey, a.concernId, ctx.concernName, ctx.canonicalType, a.score, a.tokenMatches, a.method, a.grounding, governedIds.has(a.concernId)];
    });
    if (concernMapRows.length) await chunkedInsert(client, (chunk) => {
      const { text, values } = placeholders(chunk, 10);
      return { text: `INSERT INTO archetype_concern_map (archetype_id, archetype_key, concern_id, concern_name, canonical_type, assignment_score, token_matches, assignment_method, grounding_source, governed) VALUES ${text}`, values };
    }, concernMapRows);

    if (profileRows.length) await chunkedInsert(client, (chunk) => {
      const { text, values } = placeholders(chunk, 5);
      return { text: `INSERT INTO archetype_behavior_profile (archetype_id, archetype_key, behavior_category, behavior_count, pct) VALUES ${text}`, values };
    }, profileRows.map((r) => [keyToId.get(r.key), r.key, r.category, r.count, r.pct]));

    await chunkedInsert(client, (chunk) => {
      const { text, values } = placeholders(chunk, 13);
      return { text: `INSERT INTO archetype_validation (archetype_id, archetype_key, member_count, capability_count, problem_count, behavior_grounded_count, coherence, distinctiveness, validation_status, notes, grounding_ceiling, weak_reason, stabilization_recommendation) VALUES ${text}`, values };
    }, valRows.map((r) => [keyToId.get(r.key), r.key, r.members, r.caps, r.probs, r.grounded, r.coherence, r.distinct, r.status, r.notes, r.ceiling, r.weakReason ?? '', r.recommendation]));

    if (unmatchedRows.length) await chunkedInsert(client, (chunk) => {
      const { text, values } = placeholders(chunk, 6);
      return { text: `INSERT INTO archetype_unmatched_review (concern_id, concern_name, canonical_type, best_archetype_key, best_score, reason) VALUES ${text}`, values };
    }, unmatchedRows.map((r) => [r.id, r.name, r.type, r.bestKey, r.bestScore, r.reason]));

    if (famMapRows.length) await chunkedInsert(client, (chunk) => {
      const { text, values } = placeholders(chunk, 6);
      return { text: `INSERT INTO archetype_family_map (family_name, archetype_key, concern_count, family_total, share_pct, is_primary) VALUES ${text}`, values };
    }, famMapRows.map((r) => [r.family, r.key, r.count, r.total, r.share, r.primary]));

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Full rebuild: load active decisions → deterministic compute + override layer →
 * persist. The single entry point used by the governance API after any decision change.
 */
export async function rebuildArchetypeTables(pool: Pool): Promise<ArchetypeComputeResult> {
  await ensureGovernanceSchema(pool);
  const decisions = await listActiveDecisions(pool);
  const result = await computeArchetypeResult(pool, decisions);
  await persistArchetypeResult(pool, result);
  return result;
}

export { round4 };
