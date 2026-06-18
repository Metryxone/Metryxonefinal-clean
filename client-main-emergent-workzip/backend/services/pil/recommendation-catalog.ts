/**
 * CAPADEX PIL — Phase 7: Recommendation Catalog (loader, read-only).
 *
 *   Loads the authored `recommendation_library` reference catalog (the ONLY authored
 *   data in Phase 7) and provides deterministic matching helpers. Every catalog row is
 *   anchored on a behavioural CONSTRUCT key and scoped to a category × sub_type ×
 *   stakeholder. The generator selects rows whose anchor construct is ACTIVE in the
 *   session — a recommendation can never fire without a supporting construct (no
 *   orphans), and the copy is construct-specific (never generic).
 *
 * CANON: read-only, deterministic, cached, never throws (missing table → empty catalog
 *   → the generator degrades to honest empty categories).
 */
import type { Pool } from 'pg';

export type RecCategory = 'career' | 'learning' | 'project' | 'development';
export type RecStakeholder = 'student' | 'parent' | 'counselor' | 'institution';

export const REC_CATEGORIES: RecCategory[] = ['career', 'learning', 'project', 'development'];
export const REC_STAKEHOLDERS: RecStakeholder[] = ['student', 'parent', 'counselor', 'institution'];

export const CATEGORY_SUBTYPES: Record<RecCategory, string[]> = {
  career: ['cluster', 'pathway', 'exploration'],
  learning: ['course', 'certification', 'pathway'],
  project: ['research', 'portfolio', 'team', 'leadership'],
  development: ['communication', 'leadership', 'critical_thinking', 'career_readiness'],
};

export interface CatalogEntry {
  recommendation_key: string;
  category: RecCategory;
  sub_type: string;
  anchor_construct: string;
  stakeholder: RecStakeholder;
  title: string;
  description: string;
  rationale: string;
  priority: number;
}

// ── 60s cache (mirrors loadInterventionRuntime / loadCompositeRuntime style) ─────
let CACHE: { at: number; entries: CatalogEntry[] } | null = null;
const TTL_MS = 60_000;

/** Load the active catalog (cached 60s). Never throws — missing table → []. */
export async function loadCatalog(pool: Pool, opts?: { forceRefresh?: boolean }): Promise<CatalogEntry[]> {
  if (!opts?.forceRefresh && CACHE && Date.now() - CACHE.at < TTL_MS) return CACHE.entries;
  try {
    const { rows } = await pool.query(
      `SELECT recommendation_key, category, sub_type, anchor_construct, stakeholder,
              title, description, rationale, priority
         FROM recommendation_library
        WHERE is_active
        ORDER BY category, anchor_construct, sub_type, stakeholder`,
    );
    const entries: CatalogEntry[] = rows.map((r) => ({
      recommendation_key: r.recommendation_key,
      category: r.category as RecCategory,
      sub_type: r.sub_type,
      anchor_construct: r.anchor_construct,
      stakeholder: r.stakeholder as RecStakeholder,
      title: r.title,
      description: r.description,
      rationale: r.rationale,
      priority: Number(r.priority ?? 2),
    }));
    CACHE = { at: Date.now(), entries };
    return entries;
  } catch {
    return CACHE?.entries ?? [];
  }
}

/** Deterministic ordering: priority asc, then construct, sub_type, key. */
function sortEntries(a: CatalogEntry, b: CatalogEntry): number {
  return (
    a.priority - b.priority ||
    a.anchor_construct.localeCompare(b.anchor_construct) ||
    a.sub_type.localeCompare(b.sub_type) ||
    a.recommendation_key.localeCompare(b.recommendation_key)
  );
}

/**
 * Pure: select catalog entries whose anchor construct is active in the session, for a
 * given stakeholder and (optionally) category. Deterministic order. Returns [] when no
 * active construct matches — the generator turns that into an honest empty category.
 */
export function selectCatalog(
  catalog: CatalogEntry[],
  args: { constructs: string[]; stakeholder: RecStakeholder; category?: RecCategory },
): CatalogEntry[] {
  const active = new Set(args.constructs);
  return catalog
    .filter(
      (e) =>
        e.stakeholder === args.stakeholder &&
        active.has(e.anchor_construct) &&
        (!args.category || e.category === args.category),
    )
    .sort(sortEntries);
}

/** Reset the cache (test hook). */
export function __resetCatalogCache(): void {
  CACHE = null;
}
