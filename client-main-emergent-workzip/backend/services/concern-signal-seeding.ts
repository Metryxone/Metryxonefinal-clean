/**
 * CAPADEX Concern → Signal Seeding (Task #17).
 *
 * Wires the persisted concern→signal mappings (`capadex_concern_signal_map`,
 * built additively/read-only by Task #16) into the LIVE signal-activation runtime
 * so that a concern's curated Tier-3 signals actually fire the
 * Signal → Composite → Pattern → Intervention spine during a real assessment.
 *
 * Why this is needed:
 *   The activation runtime keys answer-evidence by *concern bucket* (the coarse
 *   `primary_construct_key`, ~20 constructs). Composites/patterns/interventions,
 *   however, only form when active signals match the 20 richly-named Tier-3
 *   ontology tokens (`career_confusion`, `fear_of_failure`, …). For the ~2270
 *   concerns whose bucket token is not itself a Tier-3 token, the spine never
 *   fired. The concern→signal map already records, per concern, exactly which
 *   Tier-3 signals to monitor — this module reads those mappings and seeds them.
 *
 * Quality guardrails (no fabricated intelligence):
 *   - Only **strong / moderate Tier-3** mappings are seeded. Weak
 *     `bridge_fallback` rows (GENERAL_CONCERN), orphan markers, and the coarse
 *     bridge-tag-level atomic links are deliberately ignored — they carry no
 *     concern-specific precision.
 *   - Seed strength is **data-driven**: it is the user's measured answer
 *     intensity for the session, scaled by the mapping confidence. A user who
 *     does not endorse the concern produces near-zero seeds, so the spine stays
 *     quiet. Nothing is invented from an empty session.
 *   - When a session's concern resolves to no mapping (absent / orphaned), the
 *     seed set is empty and activation behaviour is byte-identical to before.
 *
 * The seed *definitions* (which signals + their mapping confidence) are loaded
 * read-only and cached before the activation transaction; the per-session
 * scaling into concrete `SeedSignal`s is a pure function applied inside the txn
 * against the committed evidence (so replays converge — same idempotency
 * invariant as the rest of the spine).
 */
import type { Pool } from 'pg';
import type { EvidenceObject } from './evidence-engine';
import type { SeedSignal } from './signal-activation-runtime';

// ── Tunables ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000;
/** Minimum token-match percentage to bind a session concern to a master concern. */
const RESOLVE_THRESHOLD = 60;
/** Answer evidence sources that reflect concern endorsement intensity. */
const ANSWER_SOURCES = new Set(['assessment', 'short_assessment', 'clarity']);
/** Floor below which a scaled seed is not worth injecting. */
const MIN_SEED_STRENGTH = 0.05;

const STOPWORDS = new Set([
  'i', 'im', 'am', 'my', 'me', 'we', 'our', 'you', 'your',
  'a', 'an', 'the', 'this', 'that', 'it', 'is', 'are', 'was', 'were',
  'have', 'has', 'had', 'will', 'would', 'can', 'and', 'or', 'but', 'of',
  'to', 'for', 'from', 'with', 'about', 'on', 'in', 'at', 'by', 'feel', 'feels', 'feeling',
  'very', 'really', 'quite', 'severe', 'severely', 'extreme', 'extremely',
  'bit', 'little', 'lot', 'lots', 'much', 'many', 'some', 'any', 'more', 'most',
  'general', 'concern', 'issue', 'issues', 'problem', 'problems',
]);

/** One curated Tier-3 mapping for a concern, ready to be scaled per session. */
export interface ConcernSeedDef {
  /** The Tier-3 signal token (e.g. `career_confusion`) — already core-token shaped. */
  signal_key: string;
  signal_ref: string;
  /** Mapping confidence (0..1) from the concern→signal engine. */
  confidence: number;
  confidence_band: string;
  match_method: string;
}

interface CacheEntry {
  defs: ConcernSeedDef[];
  loadedAt: number;
}

interface ResolveEntry {
  pk: number | null;
  loadedAt: number;
}

/** keyed by resolved master concern PK → its Tier-3 seed defs. */
const seedDefCache = new Map<number, CacheEntry>();
/** keyed by lowercased session concern_name → resolved master concern PK. */
const resolveCache = new Map<string, ResolveEntry>();

function tokenise(text: string): string[] {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s/-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  )).slice(0, 6);
}

/**
 * Resolve a session's free-text `concern_name` to the curated Tier-3 seed defs
 * of its best-matching master concern. Read-only and cached process-wide.
 *
 * Mirrors the live picker's token-overlap resolution (`resolveMasterConcernIdFromText`)
 * so seeding binds to the SAME concern the questions were drawn from. Returns an
 * empty list (never throws) when no concern matches confidently or the concern
 * has no strong/moderate Tier-3 mapping — yielding graceful, identical-behaviour
 * degradation in the activation runtime.
 */
export async function loadConcernSeedDefs(
  pool: Pool,
  concernName: string | null | undefined,
  masterConcernPk?: number | null,
  force = false,
): Promise<ConcernSeedDef[]> {
  // Fast path (Task #19): the session row already carries the master concern PK
  // resolved once at /start. Skip text resolution entirely and load that
  // concern's mappings straight from the map — deterministic per session and
  // immune to the resolution cache window.
  let pk: number | null =
    typeof masterConcernPk === 'number' && Number.isFinite(masterConcernPk) ? masterConcernPk : null;

  // Back-compat (in-flight sessions started before this column existed, NULL
  // value, or callers that don't pass it): resolve from the free-text concern
  // name exactly as before.
  if (pk === null) {
    pk = await resolveSeedConcernPk(pool, concernName, force);
  }
  if (pk === null) return [];

  return loadSeedDefsByPk(pool, pk, force);
}

/**
 * Resolve a session's free-text `concern_name` to its best-matching master
 * concern PK (`capadex_concerns_master.id`), mirroring the live picker's
 * token-overlap resolution (`resolveMasterConcernIdFromText`) and the ≥60% gate.
 * Read-only and cached process-wide. Returns null (never throws) when no concern
 * matches confidently. This is the value persisted on the session row at /start.
 */
export async function resolveSeedConcernPk(
  pool: Pool,
  concernName: string | null | undefined,
  force = false,
): Promise<number | null> {
  const name = String(concernName || '').trim();
  if (!name) return null;
  const cacheKey = name.toLowerCase();
  const now = Date.now();
  const cached = resolveCache.get(cacheKey);
  if (!force && cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.pk;

  let pk: number | null = null;
  try {
    const tokens = tokenise(name);
    if (tokens.length > 0) {
      const tokenParams = tokens.map((t) => `%${t}%`);
      const matchExpr = tokens.map((_, i) => `(CASE WHEN haystack LIKE $${i + 1} THEN 1 ELSE 0 END)`).join(' + ');
      const anyMatchExpr = tokens.map((_, i) => `haystack LIKE $${i + 1}`).join(' OR ');

      // Resolve the best matching master concern_pk by token overlap, applying
      // the same ≥RESOLVE_THRESHOLD% gate the picker uses.
      const res = await pool.query<{ id: number }>(
        `WITH base AS (
           SELECT id,
                  (${matchExpr}) AS matched
             FROM (
               SELECT id,
                      LOWER(COALESCE(display_label,'') || ' '
                         || COALESCE(concern_cluster,'') || ' '
                         || COALESCE(common_indian_context,'')) AS haystack
                 FROM capadex_concerns_master
             ) h
            WHERE (${anyMatchExpr})
         )
         SELECT id FROM base
          WHERE matched * 100.0 / ${tokens.length} >= ${RESOLVE_THRESHOLD}
          ORDER BY matched DESC, id ASC
          LIMIT 1`,
        tokenParams,
      );
      if (res.rows.length > 0) {
        const candidate = Number(res.rows[0].id);
        if (Number.isFinite(candidate)) pk = candidate;
      }
    }
  } catch (err) {
    console.error('[concern-seeding] concern-pk resolution failed (continuing without seeds):', err);
    pk = null;
  }

  resolveCache.set(cacheKey, { pk, loadedAt: now });
  return pk;
}

/**
 * Load the strong/moderate Tier-3 seed defs for an already-resolved master
 * concern PK. Read-only and cached process-wide by PK. Never throws.
 */
async function loadSeedDefsByPk(pool: Pool, pk: number, force = false): Promise<ConcernSeedDef[]> {
  const now = Date.now();
  const cached = seedDefCache.get(pk);
  if (!force && cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.defs;

  let defs: ConcernSeedDef[] = [];
  try {
    const res = await pool.query<{
      signal_ref: string; signal_name: string; confidence: string | number;
      confidence_band: string; match_method: string;
    }>(
      `SELECT m.signal_ref, m.signal_name, m.confidence, m.confidence_band, m.match_method
         FROM capadex_concern_signal_map m
        WHERE m.concern_pk = $1
          AND m.signal_tier = 'tier3'
          AND m.confidence_band IN ('strong','moderate')
          AND m.match_method NOT IN ('bridge_fallback','orphan')
        ORDER BY m.confidence DESC, m.signal_ref ASC`,
      [pk],
    );

    defs = res.rows.map((r) => ({
      signal_key: String(r.signal_name || '').trim(),
      signal_ref: r.signal_ref,
      confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
      confidence_band: r.confidence_band,
      match_method: r.match_method,
    })).filter((d) => d.signal_key.length > 0 && d.confidence > 0);
  } catch (err) {
    console.error('[concern-seeding] seed-def load failed (continuing without seeds):', err);
    defs = [];
  }

  seedDefCache.set(pk, { defs, loadedAt: now });
  return defs;
}

/**
 * Pure scaling of curated seed defs → concrete activation seeds for one session.
 *
 * Concern intensity = mean strength of the session's answer evidence (how
 * strongly the user is endorsing the assessed items). Each seed's strength is
 * `intensity × mapping_confidence`, so seeds amplify the spine only in proportion
 * to genuine user signal — never fabricated. Deterministic given the evidence
 * set, so re-running over the full evidence converges (idempotent).
 */
export function buildSeedSignals(defs: ConcernSeedDef[], evidence: EvidenceObject[]): SeedSignal[] {
  if (!defs.length || !evidence.length) return [];

  let sum = 0;
  let n = 0;
  for (const e of evidence) {
    if (!ANSWER_SOURCES.has(e.source_type)) continue;
    sum += e.strength;
    n += 1;
  }
  if (n === 0) return [];
  const intensity = sum / n; // 0..1

  const out: SeedSignal[] = [];
  for (const d of defs) {
    const strength = intensity * d.confidence;
    if (strength < MIN_SEED_STRENGTH) continue;
    out.push({
      signal_key: d.signal_key,
      strength,
      confidence: d.confidence,
      match_method: d.match_method,
      signal_ref: d.signal_ref,
    });
  }
  return out;
}
