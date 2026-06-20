/**
 * Phase 3.4 — EI Profile History.
 *
 * Append-only persistence for candidate Employability Profile snapshots
 * (`buildEiProfile`). Lets the SuperAdmin capture a point-in-time profile and
 * review how Overall EI / risks / growth potential move over time.
 *
 * Honesty / discipline contract:
 *   - WRITE path only: the lazy ensure-schema (CREATE TABLE) runs ONLY when a
 *     snapshot is persisted (POST). Read paths probe with to_regclass and
 *     degrade to an empty list — they NEVER issue DDL. This keeps the flag-OFF
 *     path byte-identical (zero DDL) since the routes are flag-gated upstream.
 *   - Append-only: snapshots are never mutated in place.
 *   - The full profile JSON is stored verbatim alongside denormalised headline
 *     columns (for cheap listing) — the JSON remains the source of truth.
 */

import type { Pool } from 'pg';
import type { EiProfile } from './ei-profile-engine.js';

export const EI_PROFILE_HISTORY_VERSION = 'phase-3.4';

let schemaPromise: Promise<void> | null = null;

/** Lazy schema — mirrors migrations/20260620_ei_profile_snapshots.sql. WRITE path only. */
export function ensureEiProfileHistorySchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ei_profile_snapshots (
          id              SERIAL PRIMARY KEY,
          subject_id      VARCHAR(160) NOT NULL,
          role_id         VARCHAR(160),
          measurable      BOOLEAN      NOT NULL DEFAULT false,
          ei_score        NUMERIC(6,2),
          ei_band         VARCHAR(40),
          coverage_pct    NUMERIC(6,2),
          confidence_score NUMERIC(6,2),
          confidence_band VARCHAR(20),
          strength_count  INT          NOT NULL DEFAULT 0,
          development_count INT        NOT NULL DEFAULT 0,
          risk_count      INT          NOT NULL DEFAULT 0,
          growth_level    VARCHAR(20),
          engine_version  VARCHAR(40)  NOT NULL,
          profile         JSONB        NOT NULL,
          captured_by     VARCHAR(160),
          created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_eips_subject ON ei_profile_snapshots (subject_id, created_at DESC);`);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function tableExists(pool: Pool): Promise<boolean> {
  const { rows } = await pool.query(`SELECT to_regclass('public.ei_profile_snapshots') AS reg`);
  return !!rows[0]?.reg;
}

export interface EiProfileSnapshotRow {
  id: number;
  subject_id: string;
  role_id: string | null;
  measurable: boolean;
  ei_score: number | null;
  ei_band: string | null;
  coverage_pct: number | null;
  confidence_score: number | null;
  confidence_band: string | null;
  strength_count: number;
  development_count: number;
  risk_count: number;
  growth_level: string | null;
  engine_version: string;
  captured_by: string | null;
  created_at: string;
}

function mapHeadline(r: any): EiProfileSnapshotRow {
  return {
    id: r.id,
    subject_id: r.subject_id,
    role_id: r.role_id,
    measurable: r.measurable,
    ei_score: r.ei_score != null ? Number(r.ei_score) : null,
    ei_band: r.ei_band,
    coverage_pct: r.coverage_pct != null ? Number(r.coverage_pct) : null,
    confidence_score: r.confidence_score != null ? Number(r.confidence_score) : null,
    confidence_band: r.confidence_band,
    strength_count: Number(r.strength_count) || 0,
    development_count: Number(r.development_count) || 0,
    risk_count: Number(r.risk_count) || 0,
    growth_level: r.growth_level,
    engine_version: r.engine_version,
    captured_by: r.captured_by,
    created_at: r.created_at,
  };
}

/** Persist one profile snapshot (append-only). Creates the table on first write. */
export async function persistEiProfile(
  pool: Pool,
  profile: EiProfile,
  capturedBy?: string | null,
): Promise<EiProfileSnapshotRow> {
  await ensureEiProfileHistorySchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO ei_profile_snapshots
       (subject_id, role_id, measurable, ei_score, ei_band, coverage_pct,
        confidence_score, confidence_band, strength_count, development_count,
        risk_count, growth_level, engine_version, profile, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, subject_id, role_id, measurable, ei_score, ei_band, coverage_pct,
               confidence_score, confidence_band, strength_count, development_count,
               risk_count, growth_level, engine_version, captured_by, created_at`,
    [
      profile.subject_id,
      profile.role_id,
      profile.measurable,
      profile.overall_ei.ei_score,
      profile.overall_ei.band,
      profile.overall_ei.coverage_pct,
      profile.confidence.score,
      profile.confidence.band,
      profile.strength_areas.length,
      profile.development_areas.length,
      profile.critical_risks.length,
      profile.growth_potential.level,
      profile.version,
      JSON.stringify(profile),
      capturedBy ?? null,
    ],
  );
  return mapHeadline(rows[0]);
}

/** List snapshot headlines for one subject (newest first). Read-only; no DDL. */
export async function listEiProfileHistory(pool: Pool, subjectId: string, limit = 50): Promise<EiProfileSnapshotRow[]> {
  if (!(await tableExists(pool))) return [];
  const cap = Math.max(1, Math.min(200, Number(limit) || 50));
  const { rows } = await pool.query(
    `SELECT id, subject_id, role_id, measurable, ei_score, ei_band, coverage_pct,
            confidence_score, confidence_band, strength_count, development_count,
            risk_count, growth_level, engine_version, captured_by, created_at
       FROM ei_profile_snapshots
      WHERE subject_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT ${cap}`,
    [String(subjectId ?? '').trim()],
  );
  return (rows as any[]).map(mapHeadline);
}

/** Fetch one full snapshot (headline + stored profile JSON). Read-only; no DDL. */
export async function getEiProfileSnapshot(
  pool: Pool,
  snapshotId: number,
): Promise<(EiProfileSnapshotRow & { profile: EiProfile }) | null> {
  if (!(await tableExists(pool))) return null;
  const { rows } = await pool.query(
    `SELECT id, subject_id, role_id, measurable, ei_score, ei_band, coverage_pct,
            confidence_score, confidence_band, strength_count, development_count,
            risk_count, growth_level, engine_version, captured_by, created_at, profile
       FROM ei_profile_snapshots WHERE id = $1`,
    [snapshotId],
  );
  if (rows.length === 0) return null;
  const headline = mapHeadline(rows[0]);
  return { ...headline, profile: rows[0].profile as EiProfile };
}

/** Lightweight overview for the admin panel header. Read-only; no DDL. */
export async function getEiProfileOverview(pool: Pool): Promise<{
  total_snapshots: number;
  distinct_subjects: number;
  avg_ei_score: number | null;
}> {
  if (!(await tableExists(pool))) {
    return { total_snapshots: 0, distinct_subjects: 0, avg_ei_score: null };
  }
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total_snapshots,
            COUNT(DISTINCT subject_id)::int AS distinct_subjects,
            AVG(ei_score) FILTER (WHERE ei_score IS NOT NULL) AS avg_ei_score
       FROM ei_profile_snapshots`,
  );
  const r = rows[0] ?? {};
  return {
    total_snapshots: Number(r.total_snapshots) || 0,
    distinct_subjects: Number(r.distinct_subjects) || 0,
    avg_ei_score: r.avg_ei_score != null ? Math.round(Number(r.avg_ei_score) * 10) / 10 : null,
  };
}
