/**
 * CAPADEX PIL — Phase 2.2 Archetype Intelligence API (read-only + governance).
 *
 * Surfaces the persisted Phase-2 archetype tables to the SuperAdmin "Archetype
 * Intelligence" panel, and exposes the durable human-governance workflow. Reads are
 * SELECTs over the six archetype tables; governance writes upsert/retract a decision in
 * the durable `archetype_governance_decisions` table and then trigger a full deterministic
 * rebuild + override re-apply (the algorithm stays byte-identical; the human decision wins;
 * decisions survive runner re-runs).
 *
 * Endpoints (all requireAuth + requireSuperAdmin), base /api/admin/pil/archetypes:
 *   GET  /stats              — readiness scorecard (recomputed honestly from persisted state)
 *   GET  /library            — archetype library + validation (strong/moderate/weak)
 *   GET  /library.csv        — library export (formula-safe)         [literal before /:key]
 *   GET  /concerns           — paginated concern map (filter archetype/grounding/governed)
 *   GET  /unmatched          — unmatched review queue
 *   GET  /unmatched.csv      — unmatched export                      [literal before /:key]
 *   GET  /decisions          — governance decision audit log
 *   GET  /:key               — one archetype: definition + validation + members
 *   POST /governance         — record a decision → rebuild  { concern_id, decision_type, ... }
 *   DELETE /governance/:concernId — retract a decision → rebuild
 *   POST /rebuild            — force a deterministic rebuild (re-applies active decisions)
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  ARCHETYPES, discoveryReadiness, balanceScore, similarityCapture,
} from '../services/pil/archetype-intelligence-engine.js';
import { rebuildArchetypeTables } from '../services/pil/archetype-pipeline.js';
import {
  upsertDecision, deactivateDecision, listAllDecisions, ensureGovernanceSchema,
  DECISION_TYPES, type DecisionType,
} from '../services/pil/archetype-governance.js';

const ARCH_KEYS = new Set(ARCHETYPES.map((a) => a.key));

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface StatsShape {
  generated_at: string;
  total_concerns: number;
  assigned: number;
  unmatched: number;
  coverage: number;
  archetype_count: number;
  status_counts: { strong: number; moderate: number; weak: number };
  grounding: { direct_cpb: number; propagated: number; name_only: number };
  relationship_grounding: number;
  mean_coherence: number;
  balance: number;
  similarity_capture: { evaluated: number; captured: number; ratio: number };
  readiness: number;
  governance: { active: number; reassign: number; reject: number; resolve_unmatched: number; approve: number };
  weak_archetypes: Array<{ archetype_key: string; archetype_name: string; member_count: number; coherence: number; notes: string; grounding_ceiling: number; weak_reason: string; stabilization_recommendation: string }>;
}

// Short cache — persisted tables only change on a rebuild (governance write / runner).
const CACHE_TTL_MS = 60_000;
let _statsCache: { at: number; data: StatsShape } | null = null;
function invalidate(): void { _statsCache = null; }

async function computeStats(pool: Pool): Promise<StatsShape> {
  const [lib, val, mapAgg, mapRows, unmatchedCnt, totalCnt, sim, decisions] = await Promise.all([
    pool.query(`SELECT archetype_key, archetype_name, member_count FROM archetype_library`),
    pool.query(`SELECT archetype_key, member_count, coherence, validation_status, notes, grounding_ceiling, weak_reason, stabilization_recommendation FROM archetype_validation`),
    pool.query(`SELECT grounding_source, COUNT(*)::int AS n FROM archetype_concern_map GROUP BY grounding_source`),
    pool.query(`SELECT concern_id, archetype_key FROM archetype_concern_map`),
    pool.query(`SELECT COUNT(*)::int AS n FROM archetype_unmatched_review`),
    pool.query(`SELECT COUNT(*)::int AS n FROM normalized_concern_ontology`),
    pool.query(`SELECT concern_a, concern_b FROM construct_similarity_map`),
    pool.query(`SELECT decision_type, COUNT(*)::int AS n FROM archetype_governance_decisions WHERE active = true GROUP BY decision_type`),
  ]);

  const assigned = mapRows.rows.length;
  const totalConcerns = Number(totalCnt.rows[0]?.n ?? 0);
  const unmatched = Number(unmatchedCnt.rows[0]?.n ?? 0);
  const coverage = totalConcerns === 0 ? 0 : assigned / totalConcerns;

  const grounding = { direct_cpb: 0, propagated: 0, name_only: 0 } as Record<string, number>;
  for (const r of mapAgg.rows) grounding[r.grounding_source] = Number(r.n);
  const relationshipGrounded = grounding.direct_cpb + grounding.propagated;
  const relationshipGrounding = assigned === 0 ? 0 : relationshipGrounded / assigned;

  const statusCounts = { strong: 0, moderate: 0, weak: 0 } as Record<string, number>;
  for (const r of val.rows) statusCounts[r.validation_status] = (statusCounts[r.validation_status] ?? 0) + 1;
  const nonEmpty = val.rows.filter((r: any) => Number(r.member_count) > 0);
  const meanCoherence = nonEmpty.length ? nonEmpty.reduce((s: number, r: any) => s + Number(r.coherence), 0) / nonEmpty.length : 0;
  const balance = balanceScore(lib.rows.map((r: any) => Number(r.member_count)));

  const assignOf = new Map<string, string | null>(mapRows.rows.map((r: any) => [r.concern_id, r.archetype_key]));
  const cap = similarityCapture(sim.rows.map((r: any) => [r.concern_a, r.concern_b] as [string, string]), assignOf);

  const readiness = discoveryReadiness({ coverage, relationshipGrounding, similarityCapture: cap.ratio, meanCoherence, balance });

  const gov = { active: 0, reassign: 0, reject: 0, resolve_unmatched: 0, approve: 0 } as Record<string, number>;
  for (const r of decisions.rows) { gov[r.decision_type] = Number(r.n); gov.active += Number(r.n); }

  const weak = val.rows
    .filter((r: any) => r.validation_status === 'weak')
    .map((r: any) => ({ archetype_key: r.archetype_key, archetype_name: lib.rows.find((l: any) => l.archetype_key === r.archetype_key)?.archetype_name ?? r.archetype_key, member_count: Number(r.member_count), coherence: Number(r.coherence), notes: r.notes, grounding_ceiling: Number(r.grounding_ceiling ?? 0), weak_reason: r.weak_reason ?? '', stabilization_recommendation: r.stabilization_recommendation ?? 'none' }))
    .sort((a, b) => a.member_count - b.member_count);

  return {
    generated_at: new Date().toISOString(),
    total_concerns: totalConcerns,
    assigned,
    unmatched,
    coverage: Math.round(coverage * 10000) / 10000,
    archetype_count: ARCHETYPES.length,
    status_counts: statusCounts as StatsShape['status_counts'],
    grounding: grounding as StatsShape['grounding'],
    relationship_grounding: Math.round(relationshipGrounding * 10000) / 10000,
    mean_coherence: Math.round(meanCoherence * 10000) / 10000,
    balance: Math.round(balance * 10000) / 10000,
    similarity_capture: cap,
    readiness,
    governance: gov as StatsShape['governance'],
    weak_archetypes: weak,
  };
}

async function getStats(pool: Pool, force = false): Promise<StatsShape> {
  if (!force && _statsCache && Date.now() - _statsCache.at < CACHE_TTL_MS) return _statsCache.data;
  const data = await computeStats(pool);
  _statsCache = { at: Date.now(), data };
  return data;
}

export function registerPilArchetypeRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  const base = '/api/admin/pil/archetypes';

  // GET /stats — readiness scorecard
  app.get(`${base}/stats`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureGovernanceSchema(pool);
      const stats = await getStats(pool, req.query.refresh === '1');
      res.json({ ok: true, stats });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype stats failed' });
    }
  });

  // GET /library — library + validation joined
  app.get(`${base}/library`, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = (await pool.query(`
        SELECT l.archetype_key, l.archetype_name, l.definition, l.primary_behavior_category,
               l.stage_note, l.member_count, l.capability_count, l.problem_count,
               l.behavior_grounded_count,
               v.coherence, v.distinctiveness, v.validation_status, v.notes,
               v.grounding_ceiling, v.weak_reason, v.stabilization_recommendation
        FROM archetype_library l
        LEFT JOIN archetype_validation v ON v.archetype_key = l.archetype_key
        ORDER BY l.member_count DESC, l.archetype_key`)).rows;
      res.json({ ok: true, count: rows.length, library: rows });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype library failed' });
    }
  });

  // GET /library.csv — literal route BEFORE param /:key
  app.get(`${base}/library.csv`, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = (await pool.query(`
        SELECT l.archetype_key, l.archetype_name, l.primary_behavior_category, l.stage_note,
               l.member_count, l.capability_count, l.problem_count, l.behavior_grounded_count,
               v.coherence, v.distinctiveness, v.validation_status, v.notes,
               v.grounding_ceiling, v.weak_reason, v.stabilization_recommendation
        FROM archetype_library l
        LEFT JOIN archetype_validation v ON v.archetype_key = l.archetype_key
        ORDER BY l.member_count DESC, l.archetype_key`)).rows;
      const header = ['archetype_key', 'archetype_name', 'primary_behavior_category', 'stage_note', 'member_count', 'capability_count', 'problem_count', 'behavior_grounded_count', 'coherence', 'distinctiveness', 'validation_status', 'notes', 'grounding_ceiling', 'weak_reason', 'stabilization_recommendation'];
      const lines = [header.join(',')];
      for (const r of rows) lines.push(header.map((h) => csvEscape((r as any)[h])).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="archetype_library.csv"');
      res.send(lines.join('\n'));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype library csv failed' });
    }
  });

  // GET /concerns — paginated concern map (filters: archetype, grounding, governed)
  app.get(`${base}/concerns`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const where: string[] = [];
      const params: unknown[] = [];
      const archetype = String(req.query.archetype || '').trim();
      if (archetype && ARCH_KEYS.has(archetype)) { params.push(archetype); where.push(`archetype_key = $${params.length}`); }
      const grounding = String(req.query.grounding || '').trim();
      if (['direct_cpb', 'propagated', 'name_only'].includes(grounding)) { params.push(grounding); where.push(`grounding_source = $${params.length}`); }
      if (String(req.query.governed || '') === '1') where.push('governed = true');
      const q = String(req.query.q || '').trim();
      if (q) { params.push(`%${q}%`); where.push(`(concern_name ILIKE $${params.length} OR concern_id ILIKE $${params.length})`); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = Number((await pool.query(`SELECT COUNT(*)::int AS n FROM archetype_concern_map ${whereSql}`, params)).rows[0]?.n ?? 0);
      params.push(limit); params.push(offset);
      const rows = (await pool.query(`
        SELECT concern_id, concern_name, canonical_type, archetype_key, assignment_score,
               token_matches, assignment_method, grounding_source, governed
        FROM archetype_concern_map ${whereSql}
        ORDER BY archetype_key, concern_name
        LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
      res.json({ ok: true, total, limit, offset, count: rows.length, concerns: rows });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype concerns failed' });
    }
  });

  // GET /unmatched — review queue
  app.get(`${base}/unmatched`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const q = String(req.query.q || '').trim();
      const params: unknown[] = [];
      let whereSql = '';
      if (q) { params.push(`%${q}%`); whereSql = `WHERE (concern_name ILIKE $1 OR concern_id ILIKE $1)`; }
      const total = Number((await pool.query(`SELECT COUNT(*)::int AS n FROM archetype_unmatched_review ${whereSql}`, params)).rows[0]?.n ?? 0);
      params.push(limit); params.push(offset);
      const rows = (await pool.query(`
        SELECT concern_id, concern_name, canonical_type, best_archetype_key, best_score, reason
        FROM archetype_unmatched_review ${whereSql}
        ORDER BY best_score DESC, concern_name
        LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
      res.json({ ok: true, total, limit, offset, count: rows.length, unmatched: rows });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype unmatched failed' });
    }
  });

  // GET /unmatched.csv — literal route BEFORE param /:key
  app.get(`${base}/unmatched.csv`, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = (await pool.query(`
        SELECT concern_id, concern_name, canonical_type, best_archetype_key, best_score, reason
        FROM archetype_unmatched_review ORDER BY best_score DESC, concern_name`)).rows;
      const header = ['concern_id', 'concern_name', 'canonical_type', 'best_archetype_key', 'best_score', 'reason'];
      const lines = [header.join(',')];
      for (const r of rows) lines.push(header.map((h) => csvEscape((r as any)[h])).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="archetype_unmatched_review.csv"');
      res.send(lines.join('\n'));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype unmatched csv failed' });
    }
  });

  // GET /decisions — governance audit log
  app.get(`${base}/decisions`, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureGovernanceSchema(pool);
      const raw = await listAllDecisions(pool);
      // Snake_case to match the public envelope used by every other route + the panel.
      const decisions = raw.map((d) => ({
        concern_id: d.concernId,
        decision_type: d.decisionType,
        target_archetype_key: d.targetArchetypeKey ?? null,
        rationale: d.rationale ?? '',
        decided_by: d.decidedBy,
        active: d.active,
        created_at: d.createdAt ?? null,
        updated_at: d.updatedAt ?? null,
      }));
      res.json({ ok: true, count: decisions.length, decisions });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype decisions failed' });
    }
  });

  // GET /:key — one archetype detail + members (param route LAST among GETs)
  app.get(`${base}/:key`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const key = String(req.params.key || '').trim();
      if (!ARCH_KEYS.has(key)) return res.status(404).json({ ok: false, error: 'archetype not found' });
      const lib = (await pool.query(`
        SELECT l.archetype_key, l.archetype_name, l.definition, l.primary_behavior_category,
               l.stage_note, l.signature_tokens, l.member_count, l.capability_count,
               l.problem_count, l.behavior_grounded_count,
               v.coherence, v.distinctiveness, v.validation_status, v.notes,
               v.grounding_ceiling, v.weak_reason, v.stabilization_recommendation
        FROM archetype_library l
        LEFT JOIN archetype_validation v ON v.archetype_key = l.archetype_key
        WHERE l.archetype_key = $1`, [key])).rows[0] || null;
      const profile = (await pool.query(`
        SELECT behavior_category, behavior_count, pct FROM archetype_behavior_profile
        WHERE archetype_key = $1 ORDER BY behavior_count DESC`, [key])).rows;
      const members = (await pool.query(`
        SELECT concern_id, concern_name, canonical_type, assignment_score, token_matches,
               assignment_method, grounding_source, governed
        FROM archetype_concern_map WHERE archetype_key = $1
        ORDER BY assignment_score DESC, concern_name LIMIT 1000`, [key])).rows;
      res.json({ ok: true, archetype: lib, behavior_profile: profile, members, member_sample_capped: members.length >= 1000 });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'archetype detail failed' });
    }
  });

  // POST /governance — record/replace a decision then rebuild
  app.post(`${base}/governance`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const concernId = String(body.concern_id || '').trim();
      const decisionType = String(body.decision_type || '').trim() as DecisionType;
      const targetRaw = body.target_archetype_key;
      const target = targetRaw == null || String(targetRaw).trim() === '' ? null : String(targetRaw).trim();
      const rationale = String(body.rationale || '').trim();
      const decidedBy = String(body.decided_by || (req as any).user?.email || 'superadmin').trim();

      if (!concernId) return res.status(400).json({ ok: false, error: 'concern_id is required' });
      if (!DECISION_TYPES.includes(decisionType)) return res.status(400).json({ ok: false, error: `decision_type must be one of ${DECISION_TYPES.join(', ')}` });
      const needsTarget = decisionType === 'reassign' || decisionType === 'resolve_unmatched';
      if (needsTarget && (!target || !ARCH_KEYS.has(target))) return res.status(400).json({ ok: false, error: 'a valid target_archetype_key is required for reassign/resolve_unmatched' });

      await upsertDecision(pool, { concernId, decisionType, targetArchetypeKey: needsTarget ? target : null, rationale, decidedBy });
      const result = await rebuildArchetypeTables(pool);
      invalidate();
      res.json({ ok: true, applied: { concern_id: concernId, decision_type: decisionType, target_archetype_key: needsTarget ? target : null }, governance: result.governance, assigned: result.assignedCount, unmatched: result.unmatchedCount, readiness: result.readiness });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'governance write failed' });
    }
  });

  // DELETE /governance/:concernId — retract a decision then rebuild
  app.delete(`${base}/governance/:concernId`, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const concernId = String(req.params.concernId || '').trim();
      if (!concernId) return res.status(400).json({ ok: false, error: 'concern_id is required' });
      const removed = await deactivateDecision(pool, concernId);
      const result = await rebuildArchetypeTables(pool);
      invalidate();
      res.json({ ok: true, removed, governance: result.governance, assigned: result.assignedCount, unmatched: result.unmatchedCount, readiness: result.readiness });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'governance retract failed' });
    }
  });

  // POST /rebuild — force deterministic rebuild (re-applies active decisions)
  app.post(`${base}/rebuild`, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await rebuildArchetypeTables(pool);
      invalidate();
      res.json({ ok: true, governance: result.governance, assigned: result.assignedCount, unmatched: result.unmatchedCount, readiness: result.readiness, status_counts: result.statusCounts });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'rebuild failed' });
    }
  });
}
