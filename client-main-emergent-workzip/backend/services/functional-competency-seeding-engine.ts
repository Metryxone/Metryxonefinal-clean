/**
 * Functional Competency Seeding Engine — Phase 2.
 *
 * Produces per-role competency buckets (mandatory / supporting / adjacent /
 * emerging) by READING existing role→competency expectations (gro_* tables)
 * and adjacent-role mappings. Never writes to upstream tables.
 *
 * Persistence to `role_functional_competencies` + `role_competency_seed_logs`
 * is best-effort and never throws.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ADAPTIVE_EVENTS, emit } from './adaptive-event-bus';

export const FUNCTIONAL_SEEDING_VERSION = '1.0.0';

export type SeedBucket = 'mandatory' | 'supporting' | 'adjacent' | 'emerging';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type CompetencyTarget = {
  competencyId: string;
  competencyName: string;
  category: 'functional' | 'behavioral' | 'cognitive' | 'leadership' | 'execution' | 'strategic';
  priority: Priority;
  weight: number;
  evidenceRequired: boolean;
  confidenceThreshold?: number;
};

export type SeedResult = {
  roleId: string;
  buckets: Record<SeedBucket, CompetencyTarget[]>;
  totals: Record<SeedBucket, number>;
  source_health: { gro_expectations_ok: boolean; adjacency_ok: boolean };
};

function priorityFromCriticality(c?: number): Priority {
  if (c == null) return 'medium';
  if (c >= 0.9) return 'critical';
  if (c >= 0.75) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

async function safe<T>(p: Promise<T>): Promise<{ ok: boolean; data: T | null }> {
  try { return { ok: true, data: await p }; } catch { return { ok: false, data: null }; }
}

export async function seedRoleCompetencies(pool: Pool, roleId: string): Promise<SeedResult> {
  const direct = await safe(pool.query(
    `SELECT competency_id, criticality_weight, minimum_score, median_score, maximum_score
       FROM gro_role_competency_expectations
       WHERE role_id = $1 AND deleted_at IS NULL`,
    [roleId],
  ));

  const adjacentRoles = await safe(pool.query(
    `SELECT adjacent_role_id FROM mobility_adjacent_role_mappings
       WHERE role_id = $1 LIMIT 8`,
    [roleId],
  ));

  const directRows = (direct.data?.rows ?? []) as any[];
  const mandatory: CompetencyTarget[] = [];
  const supporting: CompetencyTarget[] = [];
  for (const r of directRows) {
    const c = Number(r.criticality_weight ?? 0.5);
    const t: CompetencyTarget = {
      competencyId: String(r.competency_id),
      competencyName: String(r.competency_id),
      category: 'functional',
      priority: priorityFromCriticality(c),
      weight: c,
      evidenceRequired: c >= 0.75,
      confidenceThreshold: c >= 0.9 ? 0.7 : c >= 0.75 ? 0.6 : undefined,
    };
    if (c >= 0.75) mandatory.push(t); else supporting.push(t);
  }

  const seenIds = new Set(directRows.map((r) => String(r.competency_id)));

  // Adjacent: pull top competencies from neighbouring roles (deduped).
  const adjacent: CompetencyTarget[] = [];
  const adjRoleIds = (adjacentRoles.data?.rows ?? []).map((r: any) => r.adjacent_role_id).filter(Boolean);
  if (adjRoleIds.length > 0) {
    const adjRows = await safe(pool.query(
      `SELECT competency_id, AVG(criticality_weight) AS w
         FROM gro_role_competency_expectations
         WHERE role_id = ANY($1::text[]) AND deleted_at IS NULL
         GROUP BY competency_id
         ORDER BY w DESC LIMIT 25`,
      [adjRoleIds],
    ));
    for (const r of (adjRows.data?.rows ?? []) as any[]) {
      const cid = String(r.competency_id);
      if (seenIds.has(cid)) continue;
      seenIds.add(cid);
      const w = Number(r.w ?? 0.4);
      adjacent.push({
        competencyId: cid, competencyName: cid, category: 'functional',
        priority: priorityFromCriticality(w * 0.8), weight: w * 0.7, evidenceRequired: false,
      });
    }
  }

  // Emerging: deferred — Phase 2 leaves the bucket discoverable but empty unless
  // a market-signal source is available. We never fabricate signals.
  const emerging: CompetencyTarget[] = [];

  return {
    roleId,
    buckets: { mandatory, supporting, adjacent, emerging },
    totals: { mandatory: mandatory.length, supporting: supporting.length, adjacent: adjacent.length, emerging: emerging.length },
    source_health: { gro_expectations_ok: direct.ok, adjacency_ok: adjacentRoles.ok },
  };
}

/** Best-effort persist + audit. Never throws. */
export async function persistSeedResult(
  pool: Pool, result: SeedResult, opts: { shadowMode: boolean; correlationId?: string } = { shadowMode: true },
): Promise<{ ok: boolean; error?: string; correlation_id: string }> {
  const corr = opts.correlationId ?? randomUUID();
  const start = Date.now();
  let status: 'success' | 'partial' | 'failed' = 'success';
  let error: string | undefined;
  try {
    for (const bucket of ['mandatory', 'supporting', 'adjacent', 'emerging'] as SeedBucket[]) {
      for (const t of result.buckets[bucket]) {
        await pool.query(
          `INSERT INTO role_functional_competencies
             (role_id, competency_id, competency_name, bucket, priority, weight,
              evidence_required, confidence_threshold, version, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,NOW())`,
          [result.roleId, t.competencyId, t.competencyName, bucket, t.priority, t.weight,
           t.evidenceRequired, t.confidenceThreshold ?? null],
        ).catch(() => { status = 'partial'; });
      }
    }
  } catch (err) {
    status = 'failed'; error = (err as Error).message;
  }
  try {
    await pool.query(
      `INSERT INTO role_competency_seed_logs
         (role_id, correlation_id, operation, status, shadow_mode, duration_ms, outputs)
       VALUES ($1,$2,'seed',$3,$4,$5,$6::jsonb)`,
      [result.roleId, corr, status, opts.shadowMode, Date.now() - start, JSON.stringify(result.totals)],
    );
  } catch { /* swallow */ }

  emit({ event_type: ADAPTIVE_EVENTS.ROLE_COMPETENCIES_SEEDED, correlation_id: corr,
         payload: { role_id: result.roleId, totals: result.totals, status } });

  return { ok: status !== 'failed', error, correlation_id: corr };
}
