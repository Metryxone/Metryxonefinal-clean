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
/**
 * `baseFilter` (default-region ONLY): a SQL predicate restricting what the DEFAULT region (IN)
 * counts/serves from the backing table. It exists so REAL region-native rows (e.g. US/EU/ME/APAC
 * market signals, region market-benchmark cohorts) can live in the SAME backing table without
 * leaking into India's base read. Because these region-native rows did not exist before, applying
 * the filter keeps the default region byte-identical to prior behaviour. `null` = no restriction.
 * Non-default regions read ONLY the region-scoped overlay, so the filter never applies to them.
 */
export const NON_DEFAULT_REGION_CODES = REGIONS.filter((r) => !r.is_default).map((r) => `'${r.code}'`).join(',');
export const SURFACES = [
  { key: 'role_library', table: 'onto_roles', idColumn: 'id', labelColumn: 'title', label: 'Role Libraries', baseFilter: null as string | null },
  { key: 'benchmarks', table: 'bench_cohorts', idColumn: 'id', labelColumn: 'name', label: 'Benchmarks', baseFilter: "cohort_type <> 'region'" as string | null },
  { key: 'competency_models', table: 'onto_competencies', idColumn: 'id', labelColumn: 'canonical_name', label: 'Competency Models', baseFilter: null as string | null },
  { key: 'readiness_models', table: 'career_readiness_history', idColumn: 'id', labelColumn: 'overall_band', label: 'Readiness Models', baseFilter: null as string | null },
  { key: 'demand_intelligence', table: 'wos_market_signals', idColumn: 'id', labelColumn: 'signal_type', label: 'Demand Intelligence', baseFilter: `geography IS NULL OR geography NOT IN (${NON_DEFAULT_REGION_CODES})` as string | null },
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
  // baseFilter restricts the default region to its non-region-native rows (byte-identical to before).
  const globalCounts: Record<string, number | null> = {};
  for (const s of SURFACES) {
    const where = s.baseFilter ? ` WHERE ${s.baseFilter}` : '';
    globalCounts[s.key] = (await tableExists(pool, s.table))
      ? await scalarInt(pool, `SELECT COUNT(*)::int n FROM ${s.table}${where}`)
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
// Region-aware CONTENT resolution (read-only) — the "localized read" path
// ---------------------------------------------------------------------------
/**
 * One resolved content item for a region/surface. `label` is joined from the surface's backing
 * table (never PII — title/name/band/signal_type only); `detail` carries the overlay's curation note.
 */
export interface RegionContentItem {
  entity_ref: string;
  label: string | null;
  detail?: unknown;
}

export interface SurfaceContent {
  surface: SurfaceKey;
  label: string;
  backing_table: string;
  /**
   * Where the content came from:
   *  - 'base'    → DEFAULT region: the real backing table (== today, India-centric).
   *  - 'overlay' → non-default region: the curated region-tagged set (LOCALIZED).
   *  - 'empty'   → non-default region with no curated content (honest empty; NOT base fallback).
   *  - null      → backing/overlay table unreadable (distinct from empty).
   */
  source: 'base' | 'overlay' | 'empty' | null;
  localized: boolean;
  count: number | null;
  items: RegionContentItem[];
}

export interface RegionContent {
  version: string;
  region: RegionCode;
  name: string;
  is_default: boolean;
  surfaces: SurfaceContent[];
  note: string;
}

/**
 * Resolve the CONTENT a region effectively serves, per surface — the region-aware read.
 *
 * - DEFAULT region (IN) returns each backing table's real content (`source:'base'`), exactly as
 *   today. The platform is India-centric, so this is the un-overlaid behaviour.
 * - NON-DEFAULT regions return ONLY the curated region-tagged overlay (`source:'overlay'`) joined
 *   back to the backing table for labels. When a surface has no overlay rows, it resolves to
 *   `source:'empty'` — it does NOT silently fall back to the base/un-localized set. This is the
 *   behaviour the "localized content instead of base fallback" requirement asks for.
 *
 * Strictly read-only: `to_regclass` probes + SELECT only, never DDL. `items` are capped per surface
 * so a content read can't dump the whole genome; `count` is the honest full size.
 */
export async function resolveRegionContent(
  pool: Pool,
  region: RegionCode,
  opts: { limit?: number } = {},
): Promise<RegionContent> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 500));
  const meta = REGIONS.find((r) => r.code === region)!;
  const overlayPresent = await tableExists(pool, 'global_region_content');

  const surfaces: SurfaceContent[] = [];
  for (const s of SURFACES) {
    const backingOk = await tableExists(pool, s.table);

    // DEFAULT region → base content straight from the backing table (== today).
    if (meta.is_default) {
      if (!backingOk) {
        surfaces.push({ surface: s.key, label: s.label, backing_table: s.table, source: null, localized: false, count: null, items: [] });
        continue;
      }
      const baseWhere = s.baseFilter ? ` WHERE ${s.baseFilter}` : '';
      const count = await scalarInt(pool, `SELECT COUNT(*)::int n FROM ${s.table}${baseWhere}`);
      let items: RegionContentItem[] = [];
      try {
        const { rows } = await pool.query(
          `SELECT ${s.idColumn}::text AS ref, ${s.labelColumn}::text AS label
             FROM ${s.table}${baseWhere} ORDER BY ${s.idColumn} LIMIT $1`,
          [limit],
        );
        items = rows.map((r) => ({ entity_ref: String(r.ref), label: r.label ?? null }));
      } catch {
        /* degrade: keep count, items empty */
      }
      surfaces.push({ surface: s.key, label: s.label, backing_table: s.table, source: 'base', localized: false, count, items });
      continue;
    }

    // NON-DEFAULT region → curated overlay only (localized); never base fallback.
    if (!overlayPresent) {
      surfaces.push({ surface: s.key, label: s.label, backing_table: s.table, source: 'empty', localized: false, count: 0, items: [] });
      continue;
    }
    let count = 0;
    let items: RegionContentItem[] = [];
    try {
      // Join overlay → backing table for labels. LEFT JOIN so a tagged-but-since-deleted ref still
      // shows (label null) rather than vanishing, but coverage stays honest to the overlay rows.
      const joinSelect = backingOk
        ? `SELECT g.entity_ref AS ref, b.${s.labelColumn}::text AS label, g.detail AS detail
             FROM global_region_content g
             LEFT JOIN ${s.table} b ON b.${s.idColumn}::text = g.entity_ref
            WHERE g.surface = $1 AND g.region_code = $2
            ORDER BY g.entity_ref LIMIT $3`
        : `SELECT g.entity_ref AS ref, NULL::text AS label, g.detail AS detail
             FROM global_region_content g
            WHERE g.surface = $1 AND g.region_code = $2
            ORDER BY g.entity_ref LIMIT $3`;
      const cnt = await scalarInt(
        pool,
        `SELECT COUNT(*)::int n FROM global_region_content WHERE surface = $1 AND region_code = $2`,
        [s.key, region],
      );
      count = cnt ?? 0;
      const { rows } = await pool.query(joinSelect, [s.key, region, limit]);
      items = rows.map((r) => ({ entity_ref: String(r.ref), label: r.label ?? null, detail: r.detail }));
    } catch {
      surfaces.push({ surface: s.key, label: s.label, backing_table: s.table, source: null, localized: false, count: null, items: [] });
      continue;
    }
    surfaces.push({
      surface: s.key,
      label: s.label,
      backing_table: s.table,
      source: count > 0 ? 'overlay' : 'empty',
      localized: count > 0,
      count,
      items,
    });
  }

  return {
    version: GLOBAL_COMPETENCY_VERSION,
    region,
    name: meta.name,
    is_default: meta.is_default,
    surfaces,
    note: meta.is_default
      ? 'Default region (IN) serves base content directly from each backing table (== today; India-centric).'
      : 'Non-default region serves ONLY its curated region-tagged overlay (localized). Surfaces with no ' +
        'curated content resolve to empty \u2014 they do NOT fall back to the base/un-localized set.',
  };
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
  /** Refs that exist in the backing table and are now tagged (written + already-present). */
  applied_refs: string[];
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
    applied_refs: valid,
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

/**
 * Targeted untag: remove specific (surface, region, entity_ref) overlay rows. This is the granular
 * inverse of {@link assignRegionContent} — it deletes ONLY the overlay rows it was asked to, so a
 * single curated entity can be removed from a region without dropping the whole phase's overlay.
 * Strictly removes overlay rows (never touches the backing entity). Idempotent: already-absent refs
 * simply count 0 deleted. Returns {deleted, tableExisted} mirroring the bulk rollback shape.
 */
export async function untagRegionContent(
  pool: Pool,
  opts: { surface: SurfaceKey; region: RegionCode; entityRefs: string[] },
): Promise<{ deleted: number; deleted_refs: string[]; requested_refs: string[]; tableExisted: boolean }> {
  const refs = Array.from(new Set(opts.entityRefs.map((r) => String(r).trim()).filter(Boolean)));
  if (!(await tableExists(pool, 'global_region_content'))) {
    return { deleted: 0, deleted_refs: [], requested_refs: refs, tableExisted: false };
  }
  if (!refs.length) return { deleted: 0, deleted_refs: [], requested_refs: refs, tableExisted: true };
  const res = await pool.query(
    `DELETE FROM global_region_content
       WHERE surface = $1 AND region_code = $2 AND entity_ref = ANY($3::text[])
     RETURNING entity_ref`,
    [opts.surface, opts.region, refs],
  );
  return {
    deleted: res.rowCount ?? 0,
    deleted_refs: res.rows.map((r) => String(r.entity_ref)),
    requested_refs: refs,
    tableExisted: true,
  };
}

// ---------------------------------------------------------------------------
// Audit trail (who changed what, when) — write on POST paths, read-only GET.
// ---------------------------------------------------------------------------
/**
 * Every region-content mutation (assign / untag / bulk rollback) is recorded here so a super-admin
 * can review who changed what, when, and — critically — which refs were ACTUALLY applied versus
 * REJECTED. The honesty contract: rejected/failed refs are stored in `rejected_refs`, NEVER counted
 * as applied. This is an append-only ledger; it is never mutated in place.
 */
export type RegionAuditAction = 'assign' | 'untag' | 'rollback';

let auditSchemaReady = false;
export async function ensureRegionAuditSchema(pool: Pool): Promise<void> {
  if (auditSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_region_content_audit (
      id             BIGSERIAL PRIMARY KEY,
      action         TEXT NOT NULL,
      surface        TEXT,
      region_code    TEXT,
      actor_id       TEXT,
      actor_email    TEXT,
      requested_refs TEXT[] NOT NULL DEFAULT '{}',
      applied_refs   TEXT[] NOT NULL DEFAULT '{}',
      rejected_refs  TEXT[] NOT NULL DEFAULT '{}',
      applied_count  INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grca_region ON global_region_content_audit (region_code)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grca_surface ON global_region_content_audit (surface)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grca_created ON global_region_content_audit (created_at DESC)');
  auditSchemaReady = true;
}

export interface RegionAuditActor {
  id?: string | null;
  email?: string | null;
}

export interface RegionAuditEntry {
  action: RegionAuditAction;
  surface?: SurfaceKey | string | null;
  region?: RegionCode | string | null;
  actor?: RegionAuditActor;
  requestedRefs?: string[];
  appliedRefs?: string[];
  rejectedRefs?: string[];
  detail?: object;
}

/**
 * Append one audit record. Best-effort: a failure to record an audit row must NEVER break the
 * underlying mutation (the mutation already succeeded), so this swallows errors and returns false.
 * Honesty: `appliedRefs` are refs that actually took effect; `rejectedRefs` never overlap with them.
 */
export async function recordRegionAudit(pool: Pool, entry: RegionAuditEntry): Promise<boolean> {
  try {
    await ensureRegionAuditSchema(pool);
    const requested = Array.from(new Set((entry.requestedRefs ?? []).map((r) => String(r))));
    const applied = Array.from(new Set((entry.appliedRefs ?? []).map((r) => String(r))));
    const rejected = Array.from(new Set((entry.rejectedRefs ?? []).map((r) => String(r))));
    await pool.query(
      `INSERT INTO global_region_content_audit
         (action, surface, region_code, actor_id, actor_email,
          requested_refs, applied_refs, rejected_refs, applied_count, rejected_count, detail)
       VALUES ($1,$2,$3,$4,$5,$6::text[],$7::text[],$8::text[],$9,$10,$11::jsonb)`,
      [
        entry.action,
        entry.surface ?? null,
        entry.region ?? null,
        entry.actor?.id ?? null,
        entry.actor?.email ?? null,
        requested,
        applied,
        rejected,
        applied.length,
        rejected.length,
        JSON.stringify(entry.detail ?? {}),
      ],
    );
    return true;
  } catch (err) {
    console.error('[global-competency] audit record failed (mutation unaffected):', err);
    return false;
  }
}

export interface RegionAuditRow {
  id: number;
  action: RegionAuditAction;
  surface: string | null;
  region_code: string | null;
  actor_id: string | null;
  actor_email: string | null;
  requested_refs: string[];
  applied_refs: string[];
  rejected_refs: string[];
  applied_count: number;
  rejected_count: number;
  detail: unknown;
  created_at: string;
}

export interface RegionAuditLog {
  present: boolean;
  entries: RegionAuditRow[];
  limit: number;
}

/**
 * Read recent audit entries (most recent first), optionally filtered by region/surface. Read-only:
 * `to_regclass` probe + SELECT only, never DDL. `present:false` = no audit yet (distinct from empty).
 */
export async function listRegionAudit(
  pool: Pool,
  opts: { region?: string; surface?: string; limit?: number } = {},
): Promise<RegionAuditLog> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 500));
  if (!(await tableExists(pool, 'global_region_content_audit'))) {
    return { present: false, entries: [], limit };
  }
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.region) {
    params.push(opts.region);
    where.push(`region_code = $${params.length}`);
  }
  if (opts.surface) {
    params.push(opts.surface);
    where.push(`surface = $${params.length}`);
  }
  params.push(limit);
  const sql = `
    SELECT id, action, surface, region_code, actor_id, actor_email,
           requested_refs, applied_refs, rejected_refs, applied_count, rejected_count,
           detail, created_at
      FROM global_region_content_audit
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length}`;
  try {
    const { rows } = await pool.query(sql, params);
    return {
      present: true,
      limit,
      entries: rows.map((r) => ({
        id: Number(r.id),
        action: r.action,
        surface: r.surface ?? null,
        region_code: r.region_code ?? null,
        actor_id: r.actor_id ?? null,
        actor_email: r.actor_email ?? null,
        requested_refs: r.requested_refs ?? [],
        applied_refs: r.applied_refs ?? [],
        rejected_refs: r.rejected_refs ?? [],
        applied_count: Number(r.applied_count ?? 0),
        rejected_count: Number(r.rejected_count ?? 0),
        detail: r.detail,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      })),
    };
  } catch (err) {
    console.error('[global-competency] audit list failed:', err);
    return { present: true, entries: [], limit };
  }
}
