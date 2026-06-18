/**
 * CAPADEX PIL — Phase 2.2 governance layer (durable human overrides).
 *
 * The Phase-2 runner TRUNCATEs and rebuilds all six archetype tables on every run.
 * Human review decisions must therefore live in a SEPARATE durable table that the
 * runner NEVER truncates, and be re-applied as an OVERRIDE LAYER on top of the
 * deterministic assignment every run. The deterministic algorithm stays byte-identical;
 * the human decision wins; the decision survives re-runs.
 *
 * `applyGovernance` is PURE (no DB) so it is unit-testable like the rest of the engine.
 * The DB helpers (schema + decision CRUD) own the durable `archetype_governance_decisions`
 * table and the additive concern-map columns that record override provenance.
 *
 * CONTRACT: zero active decisions → `applyGovernance` is a no-op and the pipeline output
 * is byte-identical to Phase 2.1. A human override is justified by human judgment, NOT
 * by the relationship graph — so it is provenance-tagged (`method='human_override'`,
 * `governed=true`) and never silently inflates the relationship-grounding metric.
 */
import type { Pool, PoolClient } from 'pg';
import {
  ARCHETYPES, effectiveBehavior, type Assignment, type ConcernContext,
} from './archetype-intelligence-engine.js';

export type Queryable = Pool | PoolClient;

export type DecisionType = 'reassign' | 'reject' | 'resolve_unmatched' | 'approve';
export const DECISION_TYPES: DecisionType[] = ['reassign', 'reject', 'resolve_unmatched', 'approve'];

export interface GovernanceDecision {
  concernId: string;
  decisionType: DecisionType;
  targetArchetypeKey: string | null;
  rationale: string;
  decidedBy: string;
}

export interface GovernanceSummary {
  reassign: number;
  reject: number;
  resolve_unmatched: number;
  approve: number;
  skipped: number;
  skippedReasons: string[];
  active: number;
}

export interface GovernanceApplyResult {
  /** post-override assignments (cloned — inputs untouched) */
  assignments: Assignment[];
  /** ids dropped back to the unmatched queue by a human reject */
  rejectedIds: Set<string>;
  /** ids touched by any active decision (reassign / resolve / approve) */
  governedIds: Set<string>;
  summary: GovernanceSummary;
}

const ARCH_KEYS = new Set(ARCHETYPES.map((a) => a.key));

/**
 * Re-apply human governance decisions on top of the deterministic assignment.
 * Pure + deterministic. With an empty decision list this is an identity transform
 * (the byte-identical guarantee). At most one active decision per concern (the table
 * keys on concern_id UNIQUE), so decisions never conflict with one another.
 */
export function applyGovernance(
  assignments: Assignment[],
  ctxOf: Map<string, ConcernContext>,
  decisions: GovernanceDecision[],
): GovernanceApplyResult {
  const byId = new Map<string, Assignment>(assignments.map((a) => [a.concernId, { ...a }]));
  const rejectedIds = new Set<string>();
  const governedIds = new Set<string>();
  const summary: GovernanceSummary = {
    reassign: 0, reject: 0, resolve_unmatched: 0, approve: 0,
    skipped: 0, skippedReasons: [], active: decisions.length,
  };

  for (const d of decisions) {
    const a = byId.get(d.concernId);
    if (!a) {
      summary.skipped++;
      summary.skippedReasons.push(`${d.concernId}: concern not present in ontology`);
      continue;
    }
    const needsTarget = d.decisionType === 'reassign' || d.decisionType === 'resolve_unmatched';
    if (needsTarget && (!d.targetArchetypeKey || !ARCH_KEYS.has(d.targetArchetypeKey))) {
      summary.skipped++;
      summary.skippedReasons.push(`${d.concernId}: invalid target archetype "${d.targetArchetypeKey}"`);
      continue;
    }

    switch (d.decisionType) {
      case 'reassign':
      case 'resolve_unmatched': {
        const wasUnmatched = a.archetypeKey == null;
        a.archetypeKey = d.targetArchetypeKey!;
        a.method = 'human_override';
        // A previously-unmatched concern carried no effective score/grounding; recover
        // its intrinsic relationship evidence (honest) and its best candidate score.
        if (wasUnmatched) {
          a.score = a.bestScore;
          const ctx = ctxOf.get(d.concernId);
          if (ctx) a.grounding = effectiveBehavior(ctx).grounding;
        }
        governedIds.add(d.concernId);
        if (d.decisionType === 'reassign') summary.reassign++; else summary.resolve_unmatched++;
        break;
      }
      case 'reject': {
        a.archetypeKey = null;
        a.method = 'unmatched';
        rejectedIds.add(d.concernId);
        governedIds.add(d.concernId);
        summary.reject++;
        break;
      }
      case 'approve': {
        // Sign-off only: endorses the deterministic assignment, changes no routing.
        governedIds.add(d.concernId);
        summary.approve++;
        break;
      }
    }
  }

  return { assignments: [...byId.values()], rejectedIds, governedIds, summary };
}

// ── Durable persistence (the table the runner NEVER truncates) ────────────────

/**
 * Idempotent, additive schema. Creates the durable decisions table and extends the
 * existing concern-map with override provenance (a `governed` flag + `human_override`
 * as a third assignment_method). Never touches any pre-Phase-2.2 data.
 */
export async function ensureGovernanceSchema(db: Queryable): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS archetype_governance_decisions (
      decision_id SERIAL PRIMARY KEY,
      concern_id TEXT NOT NULL UNIQUE,
      decision_type TEXT NOT NULL
        CHECK (decision_type IN ('reassign','reject','resolve_unmatched','approve')),
      target_archetype_key TEXT,
      rationale TEXT NOT NULL DEFAULT '',
      decided_by TEXT NOT NULL DEFAULT 'superadmin',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS archetype_governance_active_idx
      ON archetype_governance_decisions(active);

    -- additive provenance on the concern map (idempotent)
    ALTER TABLE archetype_concern_map
      ADD COLUMN IF NOT EXISTS governed BOOLEAN NOT NULL DEFAULT false;

    -- widen assignment_method to allow human_override (drop the auto-named inline
    -- CHECK if present, then install a named 3-value CHECK).
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'archetype_concern_map_assignment_method_check') THEN
        ALTER TABLE archetype_concern_map
          DROP CONSTRAINT archetype_concern_map_assignment_method_check;
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'archetype_concern_method_chk') THEN
        ALTER TABLE archetype_concern_map ADD CONSTRAINT archetype_concern_method_chk
          CHECK (assignment_method IN ('signature','signature+behavior','human_override'));
      END IF;
    END $$;
  `);
}

export async function upsertDecision(db: Queryable, d: GovernanceDecision): Promise<void> {
  await db.query(
    `INSERT INTO archetype_governance_decisions
       (concern_id, decision_type, target_archetype_key, rationale, decided_by, active, updated_at)
     VALUES ($1,$2,$3,$4,$5,true,now())
     ON CONFLICT (concern_id) DO UPDATE SET
       decision_type        = EXCLUDED.decision_type,
       target_archetype_key = EXCLUDED.target_archetype_key,
       rationale            = EXCLUDED.rationale,
       decided_by           = EXCLUDED.decided_by,
       active               = true,
       updated_at           = now()`,
    [d.concernId, d.decisionType, d.targetArchetypeKey, d.rationale, d.decidedBy],
  );
}

/** Soft-retract a decision so the next rebuild reverts that concern to deterministic. */
export async function deactivateDecision(db: Queryable, concernId: string): Promise<boolean> {
  const r = await db.query(
    `UPDATE archetype_governance_decisions SET active = false, updated_at = now()
     WHERE concern_id = $1 AND active = true`,
    [concernId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listActiveDecisions(db: Queryable): Promise<GovernanceDecision[]> {
  const rows = (await db.query(
    `SELECT concern_id, decision_type, target_archetype_key, rationale, decided_by
     FROM archetype_governance_decisions WHERE active = true`,
  )).rows as any[];
  return rows.map((r) => ({
    concernId: r.concern_id,
    decisionType: r.decision_type as DecisionType,
    targetArchetypeKey: r.target_archetype_key ?? null,
    rationale: r.rationale ?? '',
    decidedBy: r.decided_by ?? 'superadmin',
  }));
}

export interface DecisionRecord extends GovernanceDecision {
  decisionId: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listAllDecisions(db: Queryable): Promise<DecisionRecord[]> {
  const rows = (await db.query(
    `SELECT decision_id, concern_id, decision_type, target_archetype_key, rationale,
            decided_by, active, created_at, updated_at
     FROM archetype_governance_decisions
     ORDER BY active DESC, updated_at DESC`,
  )).rows as any[];
  return rows.map((r) => ({
    decisionId: r.decision_id,
    concernId: r.concern_id,
    decisionType: r.decision_type as DecisionType,
    targetArchetypeKey: r.target_archetype_key ?? null,
    rationale: r.rationale ?? '',
    decidedBy: r.decided_by ?? 'superadmin',
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
