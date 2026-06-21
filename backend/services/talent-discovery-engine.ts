/**
 * PHASE 5.4 — Talent Discovery Engine (services).
 *
 * Three deliverable engines over the EXISTING candidate substrate
 * (`employer_candidates`) plus FOUR new additive persistence tables for the
 * curation surfaces (pools / shortlists / saved searches):
 *   - candidate_search_engine : Search Candidates · Filter Candidates
 *   - talent_discovery_engine : Talent Segmentation · Shortlists · Saved Searches
 *   - talent_pools            : Talent Pools (membership management)
 *
 * Design contract:
 *   - Additive: candidate reads are read-only over employer_candidates; the four
 *     new tables (talent_pools, talent_pool_members, talent_shortlists,
 *     talent_shortlist_members, talent_saved_searches) are net-new, gated behind
 *     the flag, and only ever touched on explicit writes.
 *   - GET-never-writes: read paths use to_regclass probes; the lazy
 *     ensureTalentDiscoverySchema (DDL) runs ONLY on write paths.
 *   - IDOR-safe: created_by / added_by are the authenticated principal, never
 *     client-supplied.
 *   - never-throws: every op returns a typed EngineResult; routes map codes to
 *     HTTP status. No fabrication — absent data degrades to empty + a note.
 *   - Honesty: candidate ids are validated against employer_candidates before
 *     membership is recorded, so a pool/shortlist can never hold phantom members.
 */

import type { Pool, PoolClient } from 'pg';

export const TALENT_DISCOVERY_ENGINE_VERSION = '5.4.0';

export interface Actor {
  id: string;
  role: string;
}

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input', message: string): EngineResult =>
  ({ ok: false, code, message });

type Executor = Pool | PoolClient;

// ── lazy additive schema (write-path only) ──────────────────────────────────
let schemaReady = false;
export async function ensureTalentDiscoverySchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS talent_pools (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        segment_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by text NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS talent_pool_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id uuid NOT NULL REFERENCES talent_pools(id) ON DELETE CASCADE,
        candidate_id text NOT NULL REFERENCES employer_candidates(id) ON DELETE CASCADE,
        note text,
        added_by text NOT NULL REFERENCES users(id),
        added_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (pool_id, candidate_id)
      );
      CREATE TABLE IF NOT EXISTS talent_shortlists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        job_id text,
        created_by text NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS talent_shortlist_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shortlist_id uuid NOT NULL REFERENCES talent_shortlists(id) ON DELETE CASCADE,
        candidate_id text NOT NULL REFERENCES employer_candidates(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'shortlisted',
        note text,
        added_by text NOT NULL REFERENCES users(id),
        added_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (shortlist_id, candidate_id)
      );
      CREATE TABLE IF NOT EXISTS talent_saved_searches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        filters jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by text NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_talent_pool_members_pool ON talent_pool_members (pool_id);
      CREATE INDEX IF NOT EXISTS idx_talent_pool_members_cand ON talent_pool_members (candidate_id);
      CREATE INDEX IF NOT EXISTS idx_talent_shortlist_members_sl ON talent_shortlist_members (shortlist_id);
      CREATE INDEX IF NOT EXISTS idx_talent_shortlist_members_cand ON talent_shortlist_members (candidate_id);
    `);
    schemaReady = true;
  } catch {
    // never throw — degrade; a write may still succeed if the objects already exist.
  }
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

async function withTxn<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

// ── candidate_search_engine: Search + Filter ────────────────────────────────

export interface SearchParams {
  q?: string;
  role?: string;
  location?: string;
  stage?: string;
  source?: string;
  employerId?: string;
  skills?: string[];
  tags?: string[];
  minEi?: number;
  maxEi?: number;
  minMatch?: number;
  minRating?: number;
  pooled?: boolean;
  sort?: string; // one of SORTABLE
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

const SORTABLE: Record<string, string> = {
  created_at: 'created_at',
  ei_score: 'ei_score',
  match_score: 'match_score',
  rating: 'rating',
  name: 'name',
  applied_date: 'applied_date',
};

const num = (v: any): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function buildWhere(p: SearchParams): { where: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (p.q && String(p.q).trim()) {
    const like = `%${String(p.q).trim()}%`;
    clauses.push(
      `(name ILIKE $${i} OR email ILIKE $${i} OR candidate_role ILIKE $${i} OR location ILIKE $${i} OR education ILIKE $${i} OR skills::text ILIKE $${i})`,
    );
    params.push(like); i++;
  }
  if (p.role) { clauses.push(`candidate_role ILIKE $${i}`); params.push(`%${p.role}%`); i++; }
  if (p.location) { clauses.push(`location ILIKE $${i}`); params.push(`%${p.location}%`); i++; }
  if (p.stage) { clauses.push(`stage = $${i}`); params.push(p.stage); i++; }
  if (p.source) { clauses.push(`source = $${i}`); params.push(p.source); i++; }
  if (p.employerId) { clauses.push(`employer_id = $${i}`); params.push(p.employerId); i++; }
  if (Array.isArray(p.skills) && p.skills.length) { clauses.push(`skills @> $${i}::jsonb`); params.push(JSON.stringify(p.skills)); i++; }
  if (Array.isArray(p.tags) && p.tags.length) { clauses.push(`tags @> $${i}::jsonb`); params.push(JSON.stringify(p.tags)); i++; }
  if (num(p.minEi) !== undefined) { clauses.push(`ei_score >= $${i}`); params.push(num(p.minEi)); i++; }
  if (num(p.maxEi) !== undefined) { clauses.push(`ei_score <= $${i}`); params.push(num(p.maxEi)); i++; }
  if (num(p.minMatch) !== undefined) { clauses.push(`match_score >= $${i}`); params.push(num(p.minMatch)); i++; }
  if (num(p.minRating) !== undefined) { clauses.push(`rating >= $${i}`); params.push(num(p.minRating)); i++; }
  if (p.pooled === true) { clauses.push(`pooled IS TRUE`); }
  if (p.pooled === false) { clauses.push(`(pooled IS FALSE OR pooled IS NULL)`); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const CANDIDATE_COLS =
  `id, employer_id, job_id, job_title, name, email, phone, location, candidate_role,
   experience, skills, education, ei_score, match_score, source, stage, notes, rating,
   tags, pooled, applied_date, created_at, updated_at`;

export async function searchCandidates(pool: Pool, p: SearchParams): Promise<EngineResult> {
  if (!(await relExists(pool, 'employer_candidates'))) {
    return ok({ candidates: [], total: 0, limit: 0, offset: 0, note: 'employer_candidates not provisioned' });
  }
  const { where, params } = buildWhere(p);
  const sortCol = SORTABLE[p.sort ?? 'created_at'] ?? 'created_at';
  const dir = p.dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(num(p.limit) ?? 50, 1), 200);
  const offset = Math.max(num(p.offset) ?? 0, 0);
  try {
    const countRes = await pool.query(`SELECT count(*)::int AS n FROM employer_candidates ${where}`, params);
    const total = countRes.rows?.[0]?.n ?? 0;
    const rowsRes = await pool.query(
      `SELECT ${CANDIDATE_COLS} FROM employer_candidates ${where}
       ORDER BY ${sortCol} ${dir} NULLS LAST, id ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return ok({ candidates: rowsRes.rows, total, limit, offset });
  } catch (e: any) {
    return ok({ candidates: [], total: 0, limit, offset, note: `search degraded: ${e?.message ?? 'db error'}` });
  }
}

export async function getCandidate(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'employer_candidates'))) return err('not_found', 'employer_candidates not provisioned');
  try {
    const r = await pool.query(`SELECT ${CANDIDATE_COLS} FROM employer_candidates WHERE id = $1`, [id]);
    if (!r.rows[0]) return err('not_found', 'candidate not found');
    return ok(r.rows[0]);
  } catch (e: any) {
    return err('not_found', `candidate unreadable: ${e?.message ?? 'db error'}`);
  }
}

// ── talent_discovery_engine: Talent Segmentation ────────────────────────────
// Read-only aggregation over employer_candidates along a whitelisted dimension.

const SEGMENT_DIMENSIONS: Record<string, string> = {
  stage: `COALESCE(NULLIF(stage,''), 'unknown')`,
  role: `COALESCE(NULLIF(candidate_role,''), 'unknown')`,
  location: `COALESCE(NULLIF(location,''), 'unknown')`,
  source: `COALESCE(NULLIF(source,''), 'unknown')`,
  rating: `COALESCE(rating::text, 'unrated')`,
  ei_band: `CASE WHEN ei_score IS NULL THEN 'unscored'
                 WHEN ei_score >= 80 THEN 'high (80-100)'
                 WHEN ei_score >= 60 THEN 'proficient (60-79)'
                 WHEN ei_score >= 40 THEN 'developing (40-59)'
                 ELSE 'low (0-39)' END`,
  match_band: `CASE WHEN match_score IS NULL THEN 'unscored'
                    WHEN match_score >= 80 THEN 'high (80-100)'
                    WHEN match_score >= 60 THEN 'medium (60-79)'
                    WHEN match_score >= 40 THEN 'low (40-59)'
                    ELSE 'poor (0-39)' END`,
};

export function segmentDimensions(): string[] {
  return Object.keys(SEGMENT_DIMENSIONS);
}

export async function segmentCandidates(pool: Pool, dimension: string, p: SearchParams): Promise<EngineResult> {
  const expr = SEGMENT_DIMENSIONS[dimension];
  if (!expr) return err('invalid_input', `unknown dimension '${dimension}' (allowed: ${segmentDimensions().join('|')})`);
  if (!(await relExists(pool, 'employer_candidates'))) {
    return ok({ dimension, segments: [], total: 0, note: 'employer_candidates not provisioned' });
  }
  const { where, params } = buildWhere(p);
  try {
    const r = await pool.query(
      `SELECT ${expr} AS bucket, count(*)::int AS count FROM employer_candidates ${where}
       GROUP BY bucket ORDER BY count DESC, bucket ASC`,
      params,
    );
    const total = r.rows.reduce((s: number, row: any) => s + Number(row.count), 0);
    return ok({ dimension, segments: r.rows, total });
  } catch (e: any) {
    return ok({ dimension, segments: [], total: 0, note: `segmentation degraded: ${e?.message ?? 'db error'}` });
  }
}

// ── shared membership validation ────────────────────────────────────────────
async function validateCandidateIds(exec: Executor, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const r = await exec.query(`SELECT id FROM employer_candidates WHERE id = ANY($1)`, [ids]);
  const found = new Set(r.rows.map((x: any) => x.id));
  return ids.filter((id) => !found.has(id));
}

// ── talent_pools ────────────────────────────────────────────────────────────

export async function createPool(pool: Pool, actor: Actor, body: any): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  if (!actor?.id) return err('invalid_input', 'authenticated actor required');
  const name = String(body?.name ?? '').trim();
  if (!name) return err('invalid_input', 'name is required');
  const rules = body?.segmentRules && typeof body.segmentRules === 'object' ? body.segmentRules : {};
  try {
    const r = await pool.query(
      `INSERT INTO talent_pools (name, description, segment_rules, created_by)
       VALUES ($1,$2,$3::jsonb,$4) RETURNING *`,
      [name, body?.description ?? null, JSON.stringify(rules), actor.id],
    );
    return ok(r.rows[0]);
  } catch (e: any) {
    return err('invalid_input', `could not create pool: ${e?.message ?? 'db error'}`);
  }
}

export async function listPools(pool: Pool): Promise<EngineResult> {
  if (!(await relExists(pool, 'talent_pools'))) return ok({ pools: [], note: 'talent_pools not provisioned' });
  try {
    const r = await pool.query(
      `SELECT p.*, COALESCE(m.cnt, 0) AS member_count
         FROM talent_pools p
         LEFT JOIN (SELECT pool_id, count(*)::int AS cnt FROM talent_pool_members GROUP BY pool_id) m
           ON m.pool_id = p.id
        ORDER BY p.created_at DESC LIMIT 500`,
    );
    return ok({ pools: r.rows });
  } catch {
    return ok({ pools: [], note: 'talent_pools unreadable' });
  }
}

export async function getPool(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'talent_pools'))) return err('not_found', 'talent_pools not provisioned');
  try {
    const p = await pool.query(`SELECT * FROM talent_pools WHERE id = $1`, [id]);
    if (!p.rows[0]) return err('not_found', 'pool not found');
    const m = await pool.query(
      `SELECT m.candidate_id, m.note, m.added_at, c.name, c.candidate_role, c.email, c.ei_score, c.match_score, c.stage
         FROM talent_pool_members m
         LEFT JOIN employer_candidates c ON c.id = m.candidate_id
        WHERE m.pool_id = $1 ORDER BY m.added_at DESC`,
      [id],
    );
    return ok({ ...p.rows[0], members: m.rows });
  } catch (e: any) {
    return err('not_found', `pool unreadable: ${e?.message ?? 'db error'}`);
  }
}

export async function addToPool(pool: Pool, actor: Actor, id: string, candidateIds: any): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  const ids: string[] = Array.isArray(candidateIds) ? candidateIds.map(String) : [];
  if (!ids.length) return err('invalid_input', 'candidateIds[] required');
  const exists = await pool.query(`SELECT id FROM talent_pools WHERE id = $1`, [id]);
  if (!exists.rows[0]) return err('not_found', 'pool not found');
  try {
    const result = await withTxn(pool, async (c) => {
      const missing = await validateCandidateIds(c, ids);
      if (missing.length) return { missing };
      for (const cid of ids) {
        await c.query(
          `INSERT INTO talent_pool_members (pool_id, candidate_id, added_by)
           VALUES ($1,$2,$3) ON CONFLICT (pool_id, candidate_id) DO NOTHING`,
          [id, cid, actor.id],
        );
      }
      await c.query(`UPDATE talent_pools SET updated_at = now() WHERE id = $1`, [id]);
      const cnt = await c.query(`SELECT count(*)::int AS n FROM talent_pool_members WHERE pool_id = $1`, [id]);
      return { member_count: cnt.rows[0].n };
    });
    if ('missing' in result) return err('invalid_input', `unknown candidate id(s): ${result.missing.join(', ')}`);
    return ok({ pool_id: id, member_count: result.member_count });
  } catch (e: any) {
    return err('invalid_input', `could not add to pool: ${e?.message ?? 'db error'}`);
  }
}

export async function removeFromPool(pool: Pool, id: string, candidateId: string): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  try {
    const r = await pool.query(
      `DELETE FROM talent_pool_members WHERE pool_id = $1 AND candidate_id = $2 RETURNING candidate_id`,
      [id, candidateId],
    );
    if (!r.rows[0]) return err('not_found', 'member not in pool');
    return ok({ pool_id: id, removed: candidateId });
  } catch (e: any) {
    return err('invalid_input', `could not remove from pool: ${e?.message ?? 'db error'}`);
  }
}

export async function deletePool(pool: Pool, id: string): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  try {
    const r = await pool.query(`DELETE FROM talent_pools WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows[0]) return err('not_found', 'pool not found');
    return ok({ deleted: id });
  } catch (e: any) {
    return err('invalid_input', `could not delete pool: ${e?.message ?? 'db error'}`);
  }
}

// ── shortlists ───────────────────────────────────────────────────────────────

export async function createShortlist(pool: Pool, actor: Actor, body: any): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  if (!actor?.id) return err('invalid_input', 'authenticated actor required');
  const name = String(body?.name ?? '').trim();
  if (!name) return err('invalid_input', 'name is required');
  try {
    const r = await pool.query(
      `INSERT INTO talent_shortlists (name, job_id, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [name, body?.jobId ?? body?.job_id ?? null, actor.id],
    );
    return ok(r.rows[0]);
  } catch (e: any) {
    return err('invalid_input', `could not create shortlist: ${e?.message ?? 'db error'}`);
  }
}

export async function listShortlists(pool: Pool): Promise<EngineResult> {
  if (!(await relExists(pool, 'talent_shortlists'))) return ok({ shortlists: [], note: 'talent_shortlists not provisioned' });
  try {
    const r = await pool.query(
      `SELECT s.*, COALESCE(m.cnt, 0) AS member_count
         FROM talent_shortlists s
         LEFT JOIN (SELECT shortlist_id, count(*)::int AS cnt FROM talent_shortlist_members GROUP BY shortlist_id) m
           ON m.shortlist_id = s.id
        ORDER BY s.created_at DESC LIMIT 500`,
    );
    return ok({ shortlists: r.rows });
  } catch {
    return ok({ shortlists: [], note: 'talent_shortlists unreadable' });
  }
}

export async function getShortlist(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'talent_shortlists'))) return err('not_found', 'talent_shortlists not provisioned');
  try {
    const s = await pool.query(`SELECT * FROM talent_shortlists WHERE id = $1`, [id]);
    if (!s.rows[0]) return err('not_found', 'shortlist not found');
    const m = await pool.query(
      `SELECT m.candidate_id, m.status, m.note, m.added_at, c.name, c.candidate_role, c.email, c.ei_score, c.match_score, c.stage
         FROM talent_shortlist_members m
         LEFT JOIN employer_candidates c ON c.id = m.candidate_id
        WHERE m.shortlist_id = $1 ORDER BY m.added_at DESC`,
      [id],
    );
    return ok({ ...s.rows[0], members: m.rows });
  } catch (e: any) {
    return err('not_found', `shortlist unreadable: ${e?.message ?? 'db error'}`);
  }
}

export async function addToShortlist(pool: Pool, actor: Actor, id: string, candidateIds: any): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  const ids: string[] = Array.isArray(candidateIds) ? candidateIds.map(String) : [];
  if (!ids.length) return err('invalid_input', 'candidateIds[] required');
  const exists = await pool.query(`SELECT id FROM talent_shortlists WHERE id = $1`, [id]);
  if (!exists.rows[0]) return err('not_found', 'shortlist not found');
  try {
    const result = await withTxn(pool, async (c) => {
      const missing = await validateCandidateIds(c, ids);
      if (missing.length) return { missing };
      for (const cid of ids) {
        await c.query(
          `INSERT INTO talent_shortlist_members (shortlist_id, candidate_id, added_by)
           VALUES ($1,$2,$3) ON CONFLICT (shortlist_id, candidate_id) DO NOTHING`,
          [id, cid, actor.id],
        );
      }
      await c.query(`UPDATE talent_shortlists SET updated_at = now() WHERE id = $1`, [id]);
      const cnt = await c.query(`SELECT count(*)::int AS n FROM talent_shortlist_members WHERE shortlist_id = $1`, [id]);
      return { member_count: cnt.rows[0].n };
    });
    if ('missing' in result) return err('invalid_input', `unknown candidate id(s): ${result.missing.join(', ')}`);
    return ok({ shortlist_id: id, member_count: result.member_count });
  } catch (e: any) {
    return err('invalid_input', `could not add to shortlist: ${e?.message ?? 'db error'}`);
  }
}

export async function setShortlistMemberStatus(pool: Pool, id: string, candidateId: string, status: string): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  const s = String(status ?? '').trim();
  if (!s) return err('invalid_input', 'status is required');
  try {
    const r = await pool.query(
      `UPDATE talent_shortlist_members SET status = $1 WHERE shortlist_id = $2 AND candidate_id = $3 RETURNING *`,
      [s, id, candidateId],
    );
    if (!r.rows[0]) return err('not_found', 'member not in shortlist');
    return ok(r.rows[0]);
  } catch (e: any) {
    return err('invalid_input', `could not update member: ${e?.message ?? 'db error'}`);
  }
}

export async function removeFromShortlist(pool: Pool, id: string, candidateId: string): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  try {
    const r = await pool.query(
      `DELETE FROM talent_shortlist_members WHERE shortlist_id = $1 AND candidate_id = $2 RETURNING candidate_id`,
      [id, candidateId],
    );
    if (!r.rows[0]) return err('not_found', 'member not in shortlist');
    return ok({ shortlist_id: id, removed: candidateId });
  } catch (e: any) {
    return err('invalid_input', `could not remove from shortlist: ${e?.message ?? 'db error'}`);
  }
}

export async function deleteShortlist(pool: Pool, id: string): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  try {
    const r = await pool.query(`DELETE FROM talent_shortlists WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows[0]) return err('not_found', 'shortlist not found');
    return ok({ deleted: id });
  } catch (e: any) {
    return err('invalid_input', `could not delete shortlist: ${e?.message ?? 'db error'}`);
  }
}

// ── saved searches ───────────────────────────────────────────────────────────

export async function createSavedSearch(pool: Pool, actor: Actor, body: any): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  if (!actor?.id) return err('invalid_input', 'authenticated actor required');
  const name = String(body?.name ?? '').trim();
  if (!name) return err('invalid_input', 'name is required');
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};
  try {
    const r = await pool.query(
      `INSERT INTO talent_saved_searches (name, filters, created_by) VALUES ($1,$2::jsonb,$3) RETURNING *`,
      [name, JSON.stringify(filters), actor.id],
    );
    return ok(r.rows[0]);
  } catch (e: any) {
    return err('invalid_input', `could not create saved search: ${e?.message ?? 'db error'}`);
  }
}

export async function listSavedSearches(pool: Pool): Promise<EngineResult> {
  if (!(await relExists(pool, 'talent_saved_searches'))) return ok({ saved_searches: [], note: 'talent_saved_searches not provisioned' });
  try {
    const r = await pool.query(`SELECT * FROM talent_saved_searches ORDER BY created_at DESC LIMIT 500`);
    return ok({ saved_searches: r.rows });
  } catch {
    return ok({ saved_searches: [], note: 'talent_saved_searches unreadable' });
  }
}

export async function getSavedSearch(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'talent_saved_searches'))) return err('not_found', 'talent_saved_searches not provisioned');
  try {
    const r = await pool.query(`SELECT * FROM talent_saved_searches WHERE id = $1`, [id]);
    if (!r.rows[0]) return err('not_found', 'saved search not found');
    return ok(r.rows[0]);
  } catch (e: any) {
    return err('not_found', `saved search unreadable: ${e?.message ?? 'db error'}`);
  }
}

export async function runSavedSearch(pool: Pool, id: string, overrides?: Partial<SearchParams>): Promise<EngineResult> {
  const got = await getSavedSearch(pool, id);
  if (!got.ok) return got;
  const filters = (got.data.filters ?? {}) as SearchParams;
  return searchCandidates(pool, { ...filters, ...(overrides ?? {}) });
}

export async function deleteSavedSearch(pool: Pool, id: string): Promise<EngineResult> {
  await ensureTalentDiscoverySchema(pool);
  try {
    const r = await pool.query(`DELETE FROM talent_saved_searches WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows[0]) return err('not_found', 'saved search not found');
    return ok({ deleted: id });
  } catch (e: any) {
    return err('invalid_input', `could not delete saved search: ${e?.message ?? 'db error'}`);
  }
}
