/**
 * Global Competency Engine — MX-100X Phase 8 (structural framework; additive, flag-gated, reversible).
 *
 * WHAT THIS IS
 * ------------
 * A NEW, isolated layer that threads an ADDITIVE region dimension through the five
 * global-deployability surfaces WITHOUT mutating any existing table, engine, the curated
 * `onto_*` genome, the benchmark tables, or the workforce-signal (`wos_*`) tables:
 *
 *   1) Role Libraries        → onto_roles
 *   2) Benchmarks            → bench_cohorts
 *   3) Competency Models     → onto_competencies
 *   4) Readiness Models      → career_readiness_history
 *   5) Demand Intelligence   → wos_market_signals
 *
 * The threading mechanism is a single overlay table (`global_region_content`) that tags an
 * EXISTING entity (in its surface's own id/code space) to a region. Coverage is reported on
 * two honest axes that are NEVER conflated:
 *   - the DEFAULT region (IN/India) inherits today's REAL global content count directly from
 *     each backing table (the platform is India-centric today), and
 *   - every non-default region (ME/EU/US/APAC) reports ONLY overlay rows → honest ZEROS until
 *     curated content is assigned.
 *
 * HONESTY CONTRACT
 * ----------------
 * - Reads use a `to_regclass` probe + degrade (never DDL on a read path; null = unreadable,
 *   distinct from 0 = readable-but-empty).
 * - This phase delivers a STRUCTURAL framework + coverage reporting ONLY. It never authors,
 *   infers, or fabricates regional benchmarks / roles / demand content. A region with no
 *   assigned content reports has_content:false — it is never given invented data.
 * - Every overlay row carries `provenance` so the full effect is reversible by deleting that
 *   provenance (or dropping the table). Nothing existing is altered.
 */
import type { Pool } from 'pg';

export const GLOBAL_COMPETENCY_VERSION = 'phase8-global-competency-1.0.0';
export const GLOBAL_REGION_PROVENANCE = 'phase8_global_competency';

/** Canonical region registry. IN (India) is the default — it == today's behaviour. */
export const DEFAULT_REGION = 'IN';
export const REGIONS = [
  { code: 'IN', name: 'India', is_default: true },
  { code: 'ME', name: 'Middle East', is_default: false },
  { code: 'EU', name: 'Europe', is_default: false },
  { code: 'US', name: 'United States', is_default: false },
  { code: 'APAC', name: 'Asia-Pacific', is_default: false },
] as const;

export type RegionCode = (typeof REGIONS)[number]['code'];

export function isValidRegion(code: string): code is RegionCode {
  return REGIONS.some((r) => r.code === code);
}

/**
 * Each surface maps 1:1 to ONE canonical backing table. The default region inherits this
 * table's existing content count; non-default regions count region-tagged overlay rows only.
 * `idExpr` is the column treated as the entity reference for overlay assignment.
 */
export const SURFACES = [
  { key: 'role_library', table: 'onto_roles', idColumn: 'id', label: 'Role Libraries' },
  { key: 'benchmarks', table: 'bench_cohorts', idColumn: 'id', label: 'Benchmarks' },
  { key: 'competency_models', table: 'onto_competencies', idColumn: 'id', label: 'Competency Models' },
  { key: 'readiness_models', table: 'career_readiness_history', idColumn: 'id', label: 'Readiness Models' },
  { key: 'demand_intelligence', table: 'wos_market_signals', idColumn: 'id', label: 'Demand Intelligence' },
] as const;

export type SurfaceKey = (typeof SURFACES)[number]['key'];

export function isValidSurface(key: string): key is SurfaceKey {
  return SURFACES.some((s) => s.key === key);
}

// ---------------------------------------------------------------------------
// Read-only helpers (never DDL)
// ---------------------------------------------------------------------------
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [`public.${name}`]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}

async function scalarInt(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0]?.n;
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Coverage reporting (read-only, to_regclass-probed)
// ---------------------------------------------------------------------------
export interface SurfaceCoverage {
  surface: SurfaceKey;
  label: string;
  backing_table: string;
  /** Real count from the backing table (DEFAULT region only); null = table absent/unreadable. */
  global_content: number | null;
  /** Overlay rows assigning existing entities of this surface to THIS region. */
  assigned_overlay: number | null;
  /** What this region effectively serves: default = global table; non-default = overlay only. */
  effective_content: number | null;
  has_content: boolean;
}

export interface RegionCoverage {
  code: RegionCode;
  name: string;
  is_default: boolean;
  surfaces: SurfaceCoverage[];
  surfaces_with_content: number;
  total_effective_content: number | null;
}

export interface GlobalCoverage {
  version: string;
  default_region: string;
  overlay_table_present: boolean;
  regions: RegionCoverage[];
  note: string;
}

/**
 * Per-region × per-surface coverage. Default region inherits the real backing-table counts;
 * non-default regions count overlay rows (0 until content is assigned). Never fabricates.
 */
export async function computeRegionCoverage(pool: Pool): Promise<GlobalCoverage> {
  const overlayPresent = await tableExists(pool, 'global_region_content');

  // Real global counts per surface (DEFAULT region inheritance). null = unreadable.
  const globalCounts: Record<string, number | null> = {};
  for (const s of SURFACES) {
    globalCounts[s.key] = (await tableExists(pool, s.table))
      ? await scalarInt(pool, `SELECT COUNT(*)::int n FROM ${s.table}`)
      : null;
  }

  // Overlay assignment counts grouped by (surface, region). Empty map when absent.
  const overlayCounts: Record<string, number> = {}; // key = `${surface}::${region}`
  if (overlayPresent) {
    try {
      const { rows } = await pool.query(
        `SELECT surface, region_code, COUNT(*)::int n
           FROM global_region_content
          GROUP BY surface, region_code`,
      );
      for (const r of rows) overlayCounts[`${r.surface}::${r.region_code}`] = Number(r.n);
    } catch {
      /* degrade silently — overlayCounts stays empty (honest zeros) */
    }
  }

  const regions: RegionCoverage[] = REGIONS.map((region) => {
    const surfaces: SurfaceCoverage[] = SURFACES.map((s) => {
      const assigned = overlayPresent ? (overlayCounts[`${s.key}::${region.code}`] ?? 0) : null;
      const effective = region.is_default ? globalCounts[s.key] : assigned;
      return {
        surface: s.key,
        label: s.label,
        backing_table: s.table,
        global_content: region.is_default ? globalCounts[s.key] : null,
        assigned_overlay: assigned,
        effective_content: effective,
        has_content: effective != null && effective > 0,
      };
    });
    const measurable = surfaces.map((x) => x.effective_content).filter((v): v is number => v != null);
    return {
      code: region.code,
      name: region.name,
      is_default: region.is_default,
      surfaces,
      surfaces_with_content: surfaces.filter((x) => x.has_content).length,
      total_effective_content: measurable.length ? measurable.reduce((a, b) => a + b, 0) : null,
    };
  });

  return {
    version: GLOBAL_COMPETENCY_VERSION,
    default_region: DEFAULT_REGION,
    overlay_table_present: overlayPresent,
    regions,
    note:
      'Default region (IN) inherits today\u2019s real global content from each backing table; non-default ' +
      'regions report ONLY region-tagged overlay rows (honest zeros until curated content is assigned). ' +
      'Structural framework + coverage only \u2014 no regional content is ever fabricated. ' +
      'null = backing table absent/unreadable (distinct from 0 = readable-but-empty).',
  };
}

export async function computeRegionCoverageFor(
  pool: Pool,
  region: RegionCode,
): Promise<RegionCoverage | null> {
  const all = await computeRegionCoverage(pool);
  return all.regions.find((r) => r.code === region) ?? null;
}

// ---------------------------------------------------------------------------
// Schema (WRITE path only) + assignment + rollback
// ---------------------------------------------------------------------------
let schemaReady = false;
export async function ensureGlobalRegionSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_region_content (
      id           BIGSERIAL PRIMARY KEY,
      surface      TEXT NOT NULL,
      region_code  TEXT NOT NULL,
      entity_ref   TEXT NOT NULL,
      provenance   TEXT NOT NULL DEFAULT 'phase8_global_competency',
      detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_grc_surface_region_entity
       ON global_region_content (surface, region_code, entity_ref)`,
  );
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grc_region ON global_region_content (region_code)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grc_surface ON global_region_content (surface)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grc_provenance ON global_region_content (provenance)');
  schemaReady = true;
}

/**
 * HONESTY GUARD: split candidate refs into those that EXIST in the surface's backing table and
 * those that do not. Region-tagging may ONLY apply to real existing entities — tagging an
 * arbitrary/nonexistent ref would fabricate regional coverage. Returns valid=[] when the table
 * is unreadable (fail-closed: never tag against a table we cannot verify).
 */
export async function validateEntityRefs(
  pool: Pool,
  surface: SurfaceKey,
  refs: string[],
): Promise<{ valid: string[]; invalid: string[] }> {
  const meta = SURFACES.find((s) => s.key === surface)!;
  const unique = Array.from(new Set(refs.map((r) => String(r).trim()).filter(Boolean)));
  if (!unique.length) return { valid: [], invalid: [] };
  if (!(await tableExists(pool, meta.table))) {
    return { valid: [], invalid: unique }; // fail-closed: cannot verify → reject all
  }
  try {
    const { rows } = await pool.query(
      `SELECT ${meta.idColumn}::text AS ref FROM ${meta.table} WHERE ${meta.idColumn}::text = ANY($1::text[])`,
      [unique],
    );
    const found = new Set(rows.map((r) => String(r.ref)));
    return {
      valid: unique.filter((r) => found.has(r)),
      invalid: unique.filter((r) => !found.has(r)),
    };
  } catch {
    return { valid: [], invalid: unique }; // fail-closed on query error
  }
}

export interface AssignResult {
  surface: SurfaceKey;
  region: RegionCode;
  requested: number;
  written: number;
  skipped: number;
  rejected: number;
  rejected_refs: string[];
  provenance: string;
}

/**
 * Region-tag EXISTING entities (by their own id) to a region. Idempotent per
 * (surface, region, entity). Strictly additive; never creates the entity, never fabricates
 * content — it only declares "this existing entity is part of region R's curated set".
 * Refs that do NOT exist in the backing table are REJECTED (never inserted) so coverage can
 * never be inflated by nonexistent entities.
 */
export async function assignRegionContent(
  pool: Pool,
  opts: { surface: SurfaceKey; region: RegionCode; entityRefs: string[]; provenance?: string; detail?: object },
): Promise<AssignResult> {
  await ensureGlobalRegionSchema(pool);
  const provenance = opts.provenance ?? GLOBAL_REGION_PROVENANCE;
  const { valid, invalid } = await validateEntityRefs(pool, opts.surface, opts.entityRefs);
  let written = 0;
  for (const ref of valid) {
    const res = await pool.query(
      `INSERT INTO global_region_content (surface, region_code, entity_ref, provenance, detail)
         VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (surface, region_code, entity_ref) DO NOTHING`,
      [opts.surface, opts.region, ref, provenance, JSON.stringify(opts.detail ?? {})],
    );
    written += res.rowCount ?? 0;
  }
  return {
    surface: opts.surface,
    region: opts.region,
    requested: valid.length + invalid.length,
    written,
    skipped: valid.length - written,
    rejected: invalid.length,
    rejected_refs: invalid,
    provenance,
  };
}

export async function rollbackRegionContent(
  pool: Pool,
  provenance: string = GLOBAL_REGION_PROVENANCE,
): Promise<{ deleted: number; tableExisted: boolean }> {
  if (!(await tableExists(pool, 'global_region_content'))) {
    return { deleted: 0, tableExisted: false };
  }
  const res = await pool.query('DELETE FROM global_region_content WHERE provenance = $1', [provenance]);
  return { deleted: res.rowCount ?? 0, tableExisted: true };
}
