/**
 * CAPADEX Concern → Clarity-question Mapping Engine (2026-06-01).
 *
 * Builds a precise, persisted, reviewable link from every concern in
 * `capadex_concerns_master` to the curated clarity sub-topic(s) that actually
 * belong to it, populating `capadex_concern_clarity_map`.
 *
 * WHY THIS EXISTS (the root-cause fix, not a runtime workaround):
 * clarity questions are linked to master concerns only by the coarse
 * `relational_bridge_tag` (~56 buckets). One tag (e.g. ACADEMIC_COGNITIVE) pools
 * ~618 questions across many distinct concerns; a specific concern like "Academic
 * Focus" therefore drew generic family questions. Prior attempts ranked relevance
 * at request time from each QUESTION's prose — fragile (a focus question whose
 * wording lacks "focus" was treated as generic) and an endless keyword whack-a-mole.
 *
 * The clarity rows DO carry a finer curated sub-topic in their `concern` column
 * ("Lack of Academic Focus", "Poor Concentration During Studies", …). Matching the
 * master concern to that LABEL (not the noisy question text), once and offline,
 * captures ALL questions of a sub-topic — including ones whose individual wording
 * lacks the keyword — and makes relevance reviewable data instead of a per-request
 * guess. Concerns with no topical match are recorded as an explicit `orphan` marker
 * (never fabricated); the picker falls back to the whole bridge tag for those.
 *
 * The match is substring-based (a master concept stem found inside the clarity
 * `concern` label), mirroring the runtime resolver's stem+synonym expansion. Pure
 * `mapConcernToClarity()` is deterministic; all I/O lives in the orchestration.
 *
 * Run:
 *   npx tsx backend/scripts/seed-concern-clarity-map.ts             # replace (default)
 *   npx tsx backend/scripts/seed-concern-clarity-map.ts --dry-run
 */
import type { Pool, PoolClient } from 'pg';

// ── Tunables ──────────────────────────────────────────────────────────────────
const MAX_CLARITY_CONCERNS_PER_MASTER = 8; // cap mapped sub-topics; each carries ~25 Qs
const MIN_SCORE = 1;                        // ≥1 shared topical stem → a real match

// ── Topical stem extraction ──────────────────────────────────────────────────
// Self-contained mirror of the route's `conceptStemsFromConcern` /
// `expandResolverToken` (services must not import routes). The lexicons are stable
// data; if you change one side, mirror the other (see memory:
// capadex-clarity-picker-filters / concern-clarity-mapping). Substring matching
// (a master stem found inside the clarity label) makes the two sides robust to
// stemmer inconsistencies (e.g. "concentrat" ⊂ "concentration").
const RESOLVER_SYNONYM_GROUPS: string[][] = [
  ['stress', 'anxiet', 'pressure', 'tension', 'overwhelm', 'worry', 'panic', 'nervous'],
  ['exam', 'test', 'assessment', 'viva', 'paper'],
  ['motiv', 'drive', 'procrastinat', 'lazy', 'discipline'],
  ['focus', 'concentrat', 'distract', 'attention'],
  ['career', 'job', 'work', 'profession', 'employ', 'placement', 'workplace'],
  ['confiden', 'doubt', 'insecur', 'esteem', 'worth'],
  ['sleep', 'insomnia', 'tired', 'fatigue', 'exhaust'],
  ['lonely', 'lonel', 'isolat', 'alone', 'withdraw'],
  ['anger', 'angry', 'irritab', 'frustrat', 'temper', 'rage'],
  ['sad', 'depress', 'hopeless', 'empty'],
  ['phone', 'screen', 'gaming', 'internet', 'addict', 'scroll'],
  ['relationship', 'friend', 'peer', 'bully'],
];
// Group membership is matched by PREFIX overlap (≥4 chars), not exact key, so the
// light stemmer's inconsistencies don't break synonym bridging — e.g.
// "concentration" stems to "concentra", which still joins the focus/concentrat
// group because "concentrat".startsWith("concentra"). Exact-key lookup silently
// missed that and mapped a concentration concern to only its concentration
// sub-topic, not the synonymous "focus" one.
function synonymGroupFor(base: string, raw: string): string[] | null {
  for (const g of RESOLVER_SYNONYM_GROUPS) {
    if (g.some((m) =>
      m === raw ||
      (m.length >= 4 && base.length >= 4 && (base.startsWith(m) || m.startsWith(base))),
    )) {
      return g;
    }
  }
  return null;
}

const CONCERN_LABEL_STOPWORDS = new Set([
  'difficulty', 'difficulties', 'managing', 'maintaining', 'building', 'balancing', 'aligning',
  'lack', 'poor', 'weak', 'low', 'high', 'during', 'academic', 'studies', 'study', 'studying',
  'in', 'of', 'the', 'a', 'an', 'and', 'or', 'to', 'with', 'without', 'your', 'you', 'for', 'on', 'at',
  'across', 'large', 'long', 'consistent', 'effective', 'effectively', 'still', 'even', 'being',
  'ability', 'skills', 'skill', 'issues', 'issue', 'problem', 'problems', 'trouble', 'able', 'unable',
]);

function stem(t: string): string {
  const s = t.replace(/(?:ings?|edly|ed|ies|es|s|ly|ness|ment|tions?|ations?)$/i, (m) =>
    m === 'ies' ? 'y' : '');
  return s.length >= 4 ? s : t;
}

function expand(tok: string): string[] {
  const base = stem(tok);
  const out = new Set<string>([base]);
  const grp = synonymGroupFor(base, tok);
  if (grp) grp.forEach((s) => out.add(s));
  return Array.from(out);
}

/** Topical match-stems for a master concern from its label/search/cluster. */
export function conceptStems(label?: string | null, cluster?: string | null): string[] {
  const raw = `${label || ''} ${cluster || ''}`.toLowerCase();
  const out = new Set<string>();
  for (const t of raw.replace(/[^a-z0-9\s/-]/g, ' ').split(/\s+/)) {
    if (t.length < 4 || CONCERN_LABEL_STOPWORDS.has(t)) continue;
    for (const s of expand(t)) if (s.length >= 4) out.add(s);
  }
  return Array.from(out);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type ClarityMatchMethod = 'token_semantic' | 'orphan';

export interface ConcernInput {
  id: number;
  concern_id: string | null;
  display_label: string | null;
  concern_search: string | null;
  concern_cluster: string | null;
  relational_bridge_tag: string | null;
}

export interface ClarityCandidate {
  concern: string;       // original clarity `concern` label
  concernLower: string;  // lowercased for substring tests
  count: number;         // # clarity questions under this label in the tag
}

export interface ClarityMapRow {
  concern_pk: number;
  master_concern_id: string | null;
  relational_bridge_tag: string | null;
  clarity_concern: string;
  match_method: ClarityMatchMethod;
  score: number;
  question_count: number;
}

const ORPHAN_MARKER = '__orphan__';
const normTag = (t?: string | null) => (t || '').trim().toLowerCase();

// ── Pure mapping ──────────────────────────────────────────────────────────────
/**
 * Resolve one master concern to its precise clarity sub-topic(s) within its own
 * bridge-tag pool. A candidate matches when ANY of the concern's topical stems is
 * a substring of the candidate's clarity label. Ranked by stems-matched then
 * question volume, capped. No match → a single `orphan` marker row.
 */
export function mapConcernToClarity(
  concern: ConcernInput,
  clarityByTag: Map<string, ClarityCandidate[]>,
): ClarityMapRow[] {
  const tag = (concern.relational_bridge_tag || '').trim();
  const base: Omit<ClarityMapRow, 'clarity_concern' | 'match_method' | 'score' | 'question_count'> = {
    concern_pk: concern.id,
    master_concern_id: concern.concern_id,
    relational_bridge_tag: tag || null,
  };
  const orphan = (): ClarityMapRow[] => [{
    ...base, clarity_concern: ORPHAN_MARKER, match_method: 'orphan', score: 0, question_count: 0,
  }];

  if (!tag) return orphan();
  const candidates = clarityByTag.get(normTag(tag));
  if (!candidates || candidates.length === 0) return orphan();

  const stems = conceptStems(
    `${concern.display_label || ''} ${concern.concern_search || ''}`,
    concern.concern_cluster,
  );
  if (stems.length === 0) return orphan();

  const scored = candidates
    .map((c) => ({
      c,
      score: stems.reduce((n, s) => (c.concernLower.includes(s) ? n + 1 : n), 0),
    }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.c.count - a.c.count || a.c.concern.localeCompare(b.c.concern))
    .slice(0, MAX_CLARITY_CONCERNS_PER_MASTER);

  if (scored.length === 0) return orphan();
  return scored.map((x) => ({
    ...base,
    clarity_concern: x.c.concern,
    match_method: 'token_semantic' as const,
    score: x.score,
    question_count: x.c.count,
  }));
}

// ── Candidate load ────────────────────────────────────────────────────────────
export async function loadClarityCandidates(pool: Pool): Promise<Map<string, ClarityCandidate[]>> {
  const rs = await pool.query<{ master_bridge_tag: string; concern: string; n: string }>(
    `SELECT master_bridge_tag, concern, COUNT(*)::text AS n
       FROM capadex_clarity_questions
      WHERE concern IS NOT NULL AND TRIM(concern) <> ''
        AND master_bridge_tag IS NOT NULL AND TRIM(master_bridge_tag) <> ''
        AND question IS NOT NULL AND TRIM(question) <> ''
      GROUP BY master_bridge_tag, concern`,
  );
  const byTag = new Map<string, ClarityCandidate[]>();
  for (const r of rs.rows) {
    const key = normTag(r.master_bridge_tag);
    const arr = byTag.get(key) || [];
    arr.push({ concern: r.concern, concernLower: r.concern.toLowerCase(), count: Number(r.n) || 0 });
    byTag.set(key, arr);
  }
  return byTag;
}

// ── Schema (mirrors canonical migration 20260601_concern_clarity_map.sql) ──────
let schemaPromise: Promise<void> | null = null;
export function ensureConcernClarityMapSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS capadex_concern_clarity_map (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        concern_pk            INTEGER NOT NULL,
        master_concern_id     TEXT,
        relational_bridge_tag TEXT,
        clarity_concern       TEXT NOT NULL,
        match_method          VARCHAR(24) NOT NULL,
        score                 NUMERIC(8,4) NOT NULL DEFAULT 0,
        question_count        INTEGER NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_concern_clarity_map
        ON capadex_concern_clarity_map (concern_pk, clarity_concern);
      CREATE INDEX IF NOT EXISTS idx_concern_clarity_map_concern_id
        ON capadex_concern_clarity_map (master_concern_id);
      CREATE INDEX IF NOT EXISTS idx_concern_clarity_map_bridge
        ON capadex_concern_clarity_map (relational_bridge_tag);
      CREATE INDEX IF NOT EXISTS idx_concern_clarity_map_method
        ON capadex_concern_clarity_map (match_method);
    `)
    .then(() => undefined)
    .catch((err) => {
      schemaPromise = null;
      throw err;
    });
  return schemaPromise;
}

// ── Backfill orchestration (idempotent) ──────────────────────────────────────
export type BackfillMode = 'replace' | 'upsert' | 'append';

export interface ClarityBackfillStats {
  mode: BackfillMode;
  dry_run: boolean;
  concerns: number;
  mapped_concerns: number;
  orphan_concerns: number;
  rows_total: number;
  mapping_rows: number;
  orphan_rows: number;
  avg_mapped_per_concern: number;
  duration_ms: number;
}

const CONCERN_SELECT = `
  SELECT id, concern_id, display_label, concern_search, concern_cluster, relational_bridge_tag
    FROM capadex_concerns_master ORDER BY id`;

export async function runConcernClarityMapping(
  pool: Pool,
  opts: { mode?: BackfillMode; dryRun?: boolean } = {},
): Promise<ClarityBackfillStats> {
  const mode = opts.mode || 'replace';
  const dryRun = !!opts.dryRun;
  const started = Date.now();

  await ensureConcernClarityMapSchema(pool);
  const clarityByTag = await loadClarityCandidates(pool);
  const concerns = (await pool.query<ConcernInput>(CONCERN_SELECT)).rows;

  const allRows: ClarityMapRow[] = [];
  let mappedConcerns = 0;
  let orphanConcerns = 0;
  for (const c of concerns) {
    const rows = mapConcernToClarity(c, clarityByTag);
    if (rows.some((r) => r.match_method === 'token_semantic')) mappedConcerns++;
    else orphanConcerns++;
    allRows.push(...rows);
  }

  const mappingRows = allRows.filter((r) => r.match_method === 'token_semantic').length;
  const stats: ClarityBackfillStats = {
    mode, dry_run: dryRun,
    concerns: concerns.length,
    mapped_concerns: mappedConcerns,
    orphan_concerns: orphanConcerns,
    rows_total: allRows.length,
    mapping_rows: mappingRows,
    orphan_rows: allRows.filter((r) => r.match_method === 'orphan').length,
    avg_mapped_per_concern: mappedConcerns ? Number((mappingRows / mappedConcerns).toFixed(2)) : 0,
    duration_ms: 0,
  };

  if (!dryRun) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (mode === 'replace') await client.query('TRUNCATE capadex_concern_clarity_map');
      await insertRows(client, allRows, mode);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  stats.duration_ms = Date.now() - started;
  return stats;
}

async function insertRows(client: PoolClient, rows: ClarityMapRow[], mode: BackfillMode): Promise<void> {
  const CONFLICT =
    mode === 'append'
      ? 'ON CONFLICT (concern_pk, clarity_concern) DO NOTHING'
      : `ON CONFLICT (concern_pk, clarity_concern) DO UPDATE SET
           master_concern_id = EXCLUDED.master_concern_id,
           relational_bridge_tag = EXCLUDED.relational_bridge_tag,
           match_method = EXCLUDED.match_method,
           score = EXCLUDED.score,
           question_count = EXCLUDED.question_count,
           updated_at = NOW()`;

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const tuples: string[] = [];
    chunk.forEach((r, j) => {
      const b = j * 7;
      tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`);
      values.push(
        r.concern_pk, r.master_concern_id, r.relational_bridge_tag,
        r.clarity_concern, r.match_method, r.score, r.question_count,
      );
    });
    await client.query(
      `INSERT INTO capadex_concern_clarity_map
         (concern_pk, master_concern_id, relational_bridge_tag, clarity_concern, match_method, score, question_count)
       VALUES ${tuples.join(',')} ${CONFLICT}`,
      values,
    );
  }
}
