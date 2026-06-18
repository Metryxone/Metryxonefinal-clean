/**
 * CAPADEX Signal Grounding Runtime (WC-1B-R).
 *
 * Read-only consumer of the WC-1B signal-grounding layer:
 *   - `capadex_bridge_tag_signal_grounding`  (bridge_tag ↔ atomic signal links)
 *   - `capadex_bridge_tag_family_grounding`  (bridge_tag ↔ signal family rollup)
 *
 * WC-1B grounded these tables as ONTOLOGY DATA only; nothing in the live runtime
 * consumed them. This module is the single source of truth for that consumption,
 * shared by the four runtime surfaces (activation seeding, resolver evidence,
 * question ranking, explainability lineage). It NEVER writes, NEVER creates
 * signals/concerns/tags, and is fully flag-gated by callers
 * (`isSignalGroundingRuntimeEnabled`).
 *
 * Over-activation guardrail (critical):
 *   A single bridge tag grounds, on average, ~79 atomic signals (max 200). Seeding
 *   all of them would flood the Signal → Composite → Pattern spine and destroy
 *   precision. So grounded seeds are always RANKED (similarity desc), CAPPED
 *   (`GROUNDED_SEED_CAP`), confidence-PENALISED (`GROUNDING_PENALTY`, because a
 *   family-level lexical match is weaker evidence than a curated Tier-3 mapping),
 *   and the caller only uses them to FILL THE GAP left by curated seeds.
 */
import type { Pool } from 'pg';
import type { ConcernSeedDef } from './concern-signal-seeding';

// ── Tunables ──────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000;
/** Hard cap on grounded seeds contributed per session (precision over recall). */
export const GROUNDED_SEED_CAP = 8;
/** Family-level lexical grounding is weaker evidence than a curated Tier-3 map. */
const GROUNDING_PENALTY = 0.6;
/** Lineage read cap (explainability surface). */
const LINEAGE_SIGNAL_CAP = 25;

// ── Caches (process-wide, short TTL) ─────────────────────────────────────────
const bridgeTagByPk = new Map<number, { tag: string | null; loadedAt: number }>();
const seedDefsByTag = new Map<string, { defs: ConcernSeedDef[]; loadedAt: number }>();
const summaryByTag = new Map<string, { summary: GroundedSummary; loadedAt: number }>();

export interface GroundedSummary {
  bridge_tag: string;
  grounded: boolean;
  grounded_signal_count: number;
  grounded_family_count: number;
  mean_similarity: number;
}

export interface GroundedSignalRow {
  atomic_signal_id: string;
  atomic_signal_name: string | null;
  signal_family: string;
  domain_name: string | null;
  similarity: number;
  evidence_strength: string | null;
}

export interface GroundedLineage {
  bridge_tag: string;
  grounded: boolean;
  families: { signal_family: string; domain_name: string | null; similarity: number; atomic_signal_count: number }[];
  signals: GroundedSignalRow[];
}

/** Suffix-stripping core-token normaliser (mirrors the composite/pattern bridge). */
export function groundingCoreToken(raw: unknown): string {
  let t = String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  // Strip the same conventional signal suffixes the pattern engine collapses, so
  // grounded tokens line up with the ontology token space where they overlap.
  t = t.replace(/_(pattern|patterns|behavior|behaviour|behaviors|behaviours|indicator|indicators|signal|signals|loop|tendency|tendencies|cluster)$/g, '');
  return t;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function bandFor(conf: number): string {
  if (conf >= 0.7) return 'strong';
  if (conf >= 0.4) return 'moderate';
  return 'weak';
}

/**
 * Resolve a master concern PK → its `relational_bridge_tag`. Read-only + cached.
 * Returns null (never throws) when absent.
 */
export async function resolveBridgeTagForConcernPk(pool: Pool, pk: number | null | undefined): Promise<string | null> {
  if (typeof pk !== 'number' || !Number.isFinite(pk)) return null;
  const now = Date.now();
  const cached = bridgeTagByPk.get(pk);
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.tag;

  let tag: string | null = null;
  try {
    const res = await pool.query<{ relational_bridge_tag: string | null }>(
      `SELECT relational_bridge_tag FROM capadex_concerns_master WHERE id = $1 LIMIT 1`,
      [pk],
    );
    const raw = (res.rows[0]?.relational_bridge_tag ?? '').trim();
    tag = raw.length > 0 ? raw : null;
  } catch (err) {
    console.error('[signal-grounding] bridge-tag resolve failed (continuing):', err);
    tag = null;
  }
  bridgeTagByPk.set(pk, { tag, loadedAt: now });
  return tag;
}

const bridgeTagByConcernId = new Map<string, { tag: string | null; loadedAt: number }>();

/**
 * Resolve a master `concern_id` (text) → its `relational_bridge_tag`. Read-only +
 * cached. The `/analyze` path carries the text concern_id (not the numeric pk),
 * so this is the resolver-evidence entrypoint. Returns null (never throws).
 */
export async function resolveBridgeTagForConcernId(pool: Pool, concernId: string | null | undefined): Promise<string | null> {
  const id = String(concernId ?? '').trim();
  if (!id) return null;
  const now = Date.now();
  const cached = bridgeTagByConcernId.get(id);
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.tag;

  let tag: string | null = null;
  try {
    const res = await pool.query<{ relational_bridge_tag: string | null }>(
      `SELECT relational_bridge_tag FROM capadex_concerns_master WHERE concern_id = $1 LIMIT 1`,
      [id],
    );
    const raw = (res.rows[0]?.relational_bridge_tag ?? '').trim();
    tag = raw.length > 0 ? raw : null;
  } catch (err) {
    console.error('[signal-grounding] bridge-tag (concern_id) resolve failed (continuing):', err);
    tag = null;
  }
  bridgeTagByConcernId.set(id, { tag, loadedAt: now });
  return tag;
}

/**
 * Load capped, ranked, confidence-penalised grounded seed defs for a bridge tag,
 * shaped EXACTLY like the curated `ConcernSeedDef` so the caller can feed them
 * through the existing `buildSeedSignals` → `runActivation` path (no duplicate
 * activation logic). Ranked by similarity desc, deduped by core-token signal_key,
 * capped at `GROUNDED_SEED_CAP`. Read-only + cached per tag. Never throws.
 */
export async function loadGroundedSeedDefs(
  pool: Pool,
  bridgeTag: string | null | undefined,
  cap: number = GROUNDED_SEED_CAP,
): Promise<ConcernSeedDef[]> {
  const tag = String(bridgeTag ?? '').trim();
  if (!tag) return [];
  const now = Date.now();
  const cached = seedDefsByTag.get(tag);
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.defs.slice(0, cap);

  let defs: ConcernSeedDef[] = [];
  try {
    const res = await pool.query<{
      atomic_signal_id: string; atomic_signal_name: string | null;
      signal_family: string; similarity: string | number | null; evidence_strength: string | null;
    }>(
      `SELECT atomic_signal_id, atomic_signal_name, signal_family, similarity, evidence_strength
         FROM capadex_bridge_tag_signal_grounding
        WHERE bridge_tag = $1
        ORDER BY similarity DESC NULLS LAST, atomic_signal_id ASC
        LIMIT 400`,
      [tag],
    );
    const seen = new Set<string>();
    for (const r of res.rows) {
      const key = groundingCoreToken(r.atomic_signal_name || r.signal_family || r.atomic_signal_id);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const sim = clamp01(Number(r.similarity) || 0);
      const confidence = clamp01(sim * GROUNDING_PENALTY);
      if (confidence <= 0) continue;
      defs.push({
        signal_key: key,
        signal_ref: r.atomic_signal_id,
        confidence,
        confidence_band: bandFor(confidence),
        match_method: 'wc1b_grounded',
      });
    }
  } catch (err) {
    console.error('[signal-grounding] grounded seed-def load failed (continuing without grounding):', err);
    defs = [];
  }

  seedDefsByTag.set(tag, { defs, loadedAt: now });
  return defs.slice(0, cap);
}

const RANK_TOKEN_STOP = new Set([
  'and', 'the', 'for', 'with', 'general', 'concern', 'signal', 'signals', 'family',
  'behavior', 'behaviour', 'pattern', 'patterns', 'indicator', 'indicators', 'self',
]);
const rankTokensByTag = new Map<string, { tokens: string[]; loadedAt: number }>();

/**
 * Lexical ranking tokens derived from a bridge tag's grounded families/signals
 * (Phase 4). These are appended to a concern's topical stems so clarity rows that
 * mention grounded vocabulary surface first — an ADDITIVE re-rank nudge only
 * (same question set, same content). Capped + deduped. Read-only + cached. Never
 * throws. Empty when the tag is ungrounded → ranking is byte-identical.
 */
export async function loadGroundedRankTokens(
  pool: Pool,
  bridgeTag: string | null | undefined,
  cap = 8,
): Promise<string[]> {
  const tag = String(bridgeTag ?? '').trim();
  if (!tag) return [];
  const now = Date.now();
  const cached = rankTokensByTag.get(tag);
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.tokens.slice(0, cap);

  let tokens: string[] = [];
  try {
    const res = await pool.query<{ signal_family: string; atomic_signal_name: string | null; similarity: string | null }>(
      `SELECT signal_family, atomic_signal_name, similarity
         FROM capadex_bridge_tag_signal_grounding
        WHERE bridge_tag = $1
        ORDER BY similarity DESC NULLS LAST, atomic_signal_id ASC
        LIMIT 120`,
      [tag],
    );
    const seen = new Set<string>();
    for (const r of res.rows) {
      const source = `${r.atomic_signal_name || ''} ${r.signal_family || ''}`.toLowerCase();
      for (const tok of source.split(/[^a-z0-9]+/)) {
        if (tok.length < 4 || RANK_TOKEN_STOP.has(tok) || seen.has(tok)) continue;
        seen.add(tok);
        tokens.push(tok);
        if (tokens.length >= cap) break;
      }
      if (tokens.length >= cap) break;
    }
  } catch (err) {
    console.error('[signal-grounding] rank-token load failed (continuing):', err);
    tokens = [];
  }
  rankTokensByTag.set(tag, { tokens, loadedAt: now });
  return tokens.slice(0, cap);
}

/** Aggregate grounding stats for a bridge tag (resolver evidence). Cached. */
export async function groundedSummary(pool: Pool, bridgeTag: string | null | undefined): Promise<GroundedSummary> {
  const tag = String(bridgeTag ?? '').trim();
  const empty: GroundedSummary = {
    bridge_tag: tag, grounded: false, grounded_signal_count: 0, grounded_family_count: 0, mean_similarity: 0,
  };
  if (!tag) return empty;
  const now = Date.now();
  const cached = summaryByTag.get(tag);
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.summary;

  let summary = empty;
  try {
    const res = await pool.query<{ sig: string; mean_sim: string | null }>(
      `SELECT COUNT(*)::int AS sig, AVG(similarity) AS mean_sim
         FROM capadex_bridge_tag_signal_grounding WHERE bridge_tag = $1`,
      [tag],
    );
    const fam = await pool.query<{ fam: string }>(
      `SELECT COUNT(*)::int AS fam FROM capadex_bridge_tag_family_grounding WHERE bridge_tag = $1`,
      [tag],
    );
    const sigCount = Number(res.rows[0]?.sig) || 0;
    summary = {
      bridge_tag: tag,
      grounded: sigCount > 0,
      grounded_signal_count: sigCount,
      grounded_family_count: Number(fam.rows[0]?.fam) || 0,
      mean_similarity: Number(res.rows[0]?.mean_sim) || 0,
    };
  } catch (err) {
    console.error('[signal-grounding] summary load failed (continuing):', err);
    summary = empty;
  }
  summaryByTag.set(tag, { summary, loadedAt: now });
  return summary;
}

/**
 * Full read-only grounding lineage for a bridge tag (explainability surface):
 * families + top-N atomic signals. Never throws.
 */
export async function loadGroundedLineage(pool: Pool, bridgeTag: string | null | undefined): Promise<GroundedLineage> {
  const tag = String(bridgeTag ?? '').trim();
  const empty: GroundedLineage = { bridge_tag: tag, grounded: false, families: [], signals: [] };
  if (!tag) return empty;
  try {
    const fam = await pool.query<{
      signal_family: string; domain_name: string | null; similarity: string | null; atomic_signal_count: number;
    }>(
      `SELECT signal_family, domain_name, similarity, atomic_signal_count
         FROM capadex_bridge_tag_family_grounding
        WHERE bridge_tag = $1
        ORDER BY similarity DESC NULLS LAST, signal_family ASC`,
      [tag],
    );
    const sig = await pool.query<{
      atomic_signal_id: string; atomic_signal_name: string | null; signal_family: string;
      domain_name: string | null; similarity: string | null; evidence_strength: string | null;
    }>(
      `SELECT atomic_signal_id, atomic_signal_name, signal_family, domain_name, similarity, evidence_strength
         FROM capadex_bridge_tag_signal_grounding
        WHERE bridge_tag = $1
        ORDER BY similarity DESC NULLS LAST, atomic_signal_id ASC
        LIMIT $2`,
      [tag, LINEAGE_SIGNAL_CAP],
    );
    return {
      bridge_tag: tag,
      grounded: sig.rows.length > 0,
      families: fam.rows.map((r) => ({
        signal_family: r.signal_family,
        domain_name: r.domain_name,
        similarity: Number(r.similarity) || 0,
        atomic_signal_count: Number(r.atomic_signal_count) || 0,
      })),
      signals: sig.rows.map((r) => ({
        atomic_signal_id: r.atomic_signal_id,
        atomic_signal_name: r.atomic_signal_name,
        signal_family: r.signal_family,
        domain_name: r.domain_name,
        similarity: Number(r.similarity) || 0,
        evidence_strength: r.evidence_strength,
      })),
    };
  } catch (err) {
    console.error('[signal-grounding] lineage load failed (continuing):', err);
    return empty;
  }
}
