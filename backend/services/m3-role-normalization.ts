/**
 * Phase 3 — AI Role Normalization Engine (v3.0.0)
 * Deterministic 16-dim hash-based pseudo-embedding (pgvector-ready).
 * resolveTitle() resolves raw → canonical via: exact → alias → embedding-cosine.
 * Logs every resolution to m3_role_normalization_history.
 */
import type { Pool } from 'pg';
export const ROLE_NORMALIZATION_VERSION = '3.0.0';

const DIM = 16;
const STOP = new Set(['the','a','of','for','at','on','and','or','to','with','sr','sr.','jr','jr.']);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t));
}

/** Stable string hash (djb2 variant). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function embed(text: string): number[] {
  const v = new Array(DIM).fill(0);
  const toks = tokenize(text);
  if (toks.length === 0) return v;
  for (const t of toks) {
    const h = hash(t);
    const idx = h % DIM;
    const sign = ((h >>> 8) & 1) === 0 ? 1 : -1;
    v[idx] += sign * (1 + ((h >>> 16) % 7) / 10);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => +(x / norm).toFixed(4));
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na * nb);
  return d === 0 ? 0 : +(dot / d).toFixed(4);
}

export function createRoleNormalization(pool: Pool) {
  async function resolveTitle(rawTitle: string, sessionId?: string) {
    const norm = rawTitle.trim();
    // 1. exact
    const exact = await pool.query(
      `SELECT id AS market_role_id, market_title, ontology_role_id, 1.0::float AS similarity
       FROM m3_market_roles WHERE LOWER(market_title) = LOWER($1) LIMIT 1`, [norm]);
    if (exact.rows[0]) {
      const r = exact.rows[0];
      await log(r.market_role_id, 1.0, 'exact', sessionId, norm);
      return { ...r, method: 'exact' };
    }
    // 2. alias
    const alias = await pool.query(
      `SELECT mr.id AS market_role_id, mr.market_title, mr.ontology_role_id, mra.similarity::float
       FROM m3_market_role_aliases mra
       JOIN m3_market_roles mr ON mr.id = mra.market_role_id
       WHERE LOWER(mra.alias_title) = LOWER($1)
       ORDER BY mra.similarity DESC LIMIT 1`, [norm]);
    if (alias.rows[0]) {
      const r = alias.rows[0];
      await log(r.market_role_id, r.similarity, 'alias', sessionId, norm);
      return { ...r, method: 'alias' };
    }
    // 3. embedding cosine over all known market roles
    const e = embed(norm);
    const { rows: pool_ } = await pool.query(
      `SELECT id AS market_role_id, market_title, ontology_role_id, embedding FROM m3_market_roles WHERE embedding IS NOT NULL`);
    let best: any = null;
    for (const r of pool_) {
      const sim = cosine(e, (r.embedding as number[]) ?? []);
      if (!best || sim > best.similarity) best = { ...r, similarity: sim };
    }
    if (best && best.similarity >= 0.55) {
      delete best.embedding;
      await log(best.market_role_id, best.similarity, 'embedding', sessionId, norm);
      return { ...best, method: 'embedding' };
    }
    // 4. unresolved → emerging candidate
    const candId = `merc_${Date.now().toString(36)}`;
    await pool.query(
      `INSERT INTO m3_emerging_role_candidates(id, raw_title, observed_count, distinct_aliases, emergence_score, status)
       VALUES ($1,$2,1,1,55,'candidate') ON CONFLICT (id) DO NOTHING`, [candId, norm]);
    await log(null, 0, 'unresolved', sessionId, norm);
    return { market_role_id: null, market_title: null, ontology_role_id: null, similarity: 0, method: 'unresolved', emerging_candidate_id: candId };
  }

  async function log(target: string | null, sim: number, method: string, sessionId: string | undefined, raw: string) {
    try {
      const id = `mrnh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
      await pool.query(
        `INSERT INTO m3_role_normalization_history(id, raw_title, resolved_to, similarity, method, user_session_id)
         VALUES ($1,$2,$3,$4,$5,$6)`, [id, raw, target, sim, method, sessionId ?? null]);
    } catch { /* non-blocking */ }
  }

  async function similar(rawTitle: string, k = 5) {
    const e = embed(rawTitle);
    const { rows } = await pool.query(
      `SELECT id AS market_role_id, market_title, ontology_role_id, embedding FROM m3_market_roles WHERE embedding IS NOT NULL`);
    return rows
      .map(r => ({ market_role_id: r.market_role_id, market_title: r.market_title,
                   ontology_role_id: r.ontology_role_id, similarity: cosine(e, (r.embedding as number[]) ?? []) }))
      .sort((a, b) => b.similarity - a.similarity).slice(0, k);
  }

  async function clusters() {
    // Lightweight k-mean-style grouping by argmax cosine to seed cluster centroids = market_titles
    const { rows } = await pool.query(
      `SELECT id, market_title, embedding FROM m3_market_roles WHERE embedding IS NOT NULL`);
    const out: Record<string, { label: string; members: string[] }> = {};
    for (const r of rows) {
      let best: { id: string; sim: number } | null = null;
      for (const c of rows) {
        if (c.id === r.id) continue;
        const sim = cosine(r.embedding as number[], c.embedding as number[]);
        if (!best || sim > best.sim) best = { id: c.id, sim };
      }
      const key = best?.sim && best.sim > 0.6 ? best.id : r.id;
      out[key] = out[key] ?? { label: rows.find((x: any) => x.id === key)?.market_title ?? r.market_title, members: [] };
      out[key].members.push(r.market_title);
    }
    return Object.values(out);
  }

  return { resolveTitle, similar, clusters };
}
