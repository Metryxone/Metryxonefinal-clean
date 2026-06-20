/**
 * PHASE 4.9 — Career Passport Foundation: Passport Generator.
 *
 * Top-level generation + append-only persistence for the composed Career
 * Passport. COMPOSES the passport context loader (career-passport-engine.ts)
 * and the section stitcher (passport-profile.ts) — it adds NO new intelligence.
 *
 * Honesty / safety contract:
 *   - `generateCareerPassport` is read-only & never-throws: it loads the context
 *     and stitches the six components. ZERO DDL on this path (the loader probes
 *     the competency-runtime schema before the only DDL-capable source).
 *   - The ONLY write path is `persistPassportSnapshot` (reached only from the
 *     explicit POST route, behind the flag gate). It lazily ensures the
 *     append-only `career_passport_snapshots` schema, mirroring the migration.
 *   - `listPassportHistory` is read-only and uses a to_regclass probe so a GET
 *     NEVER triggers DDL — an absent table => honest empty.
 *   - Append-only: snapshots are never mutated in place.
 *
 * Distinct from the existing Career Passport subsystem (cp_* tables,
 * `careerPassport`, /api/passport/*). This persists a generated COMPOSITION
 * snapshot, not the user-editable cp_* portfolio.
 */

import type { Pool } from 'pg';
import { loadPassportContext } from './career-passport-engine.js';
import { buildPassportProfile, type CareerPassportProfile } from './passport-profile.js';

export const PASSPORT_GENERATOR_VERSION = '4.9.0';

/** Generate the composed passport for a subject. Read-only & never-throws. */
export async function generateCareerPassport(
  pool: Pool,
  subjectId: string,
): Promise<CareerPassportProfile> {
  const ctx = await loadPassportContext(pool, subjectId);
  return buildPassportProfile(ctx);
}

// ---------------------------------------------------------------------------
// Append-only persistence (explicit POST path only — NEVER on a GET).
// The DDL here is reached ONLY behind the careerPassportFoundation flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerPassportSnapshotSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_passport_snapshots (
      id                     BIGSERIAL PRIMARY KEY,
      subject_id             TEXT NOT NULL,
      sections_total         INTEGER NOT NULL DEFAULT 0,
      sections_present       INTEGER NOT NULL DEFAULT 0,
      coverage_pct           NUMERIC,
      measurable             BOOLEAN NOT NULL DEFAULT FALSE,
      competency_present     BOOLEAN NOT NULL DEFAULT FALSE,
      ei_present             BOOLEAN NOT NULL DEFAULT FALSE,
      career_profile_present BOOLEAN NOT NULL DEFAULT FALSE,
      readiness_present      BOOLEAN NOT NULL DEFAULT FALSE,
      achievements_count     INTEGER NOT NULL DEFAULT 0,
      journey_events         INTEGER NOT NULL DEFAULT 0,
      snapshot               JSONB NOT NULL,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_passport_snapshots_subject
       ON career_passport_snapshots (subject_id, created_at DESC)`,
  );
}

export interface CareerPassportSnapshotRow {
  id: number;
  subject_id: string;
  sections_total: number;
  sections_present: number;
  coverage_pct: number | null;
  measurable: boolean;
  competency_present: boolean;
  ei_present: boolean;
  career_profile_present: boolean;
  readiness_present: boolean;
  achievements_count: number;
  journey_events: number;
  created_at: string;
}

/** Append-only — NEVER updates an existing row. */
export async function persistPassportSnapshot(
  pool: Pool,
  profile: CareerPassportProfile,
): Promise<CareerPassportSnapshotRow> {
  await ensureCareerPassportSnapshotSchema(pool);
  const s = profile.sections;
  const achievementsCount =
    (s.achievements.data as any)?.count != null ? Number((s.achievements.data as any).count) : 0;
  const journeyEvents =
    (s.career_journey.data as any)?.count != null ? Number((s.career_journey.data as any).count) : 0;

  const r = await pool.query(
    `INSERT INTO career_passport_snapshots
       (subject_id, sections_total, sections_present, coverage_pct, measurable,
        competency_present, ei_present, career_profile_present, readiness_present,
        achievements_count, journey_events, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, subject_id, sections_total, sections_present, coverage_pct, measurable,
               competency_present, ei_present, career_profile_present, readiness_present,
               achievements_count, journey_events, created_at`,
    [
      profile.subject_id,
      profile.coverage.sections_total,
      profile.coverage.sections_present,
      profile.coverage.coverage_pct,
      profile.measurable,
      s.competency_profile.present,
      s.ei_profile.present,
      s.career_profile.present,
      s.career_readiness.present,
      achievementsCount,
      journeyEvents,
      JSON.stringify(profile),
    ],
  );
  return r.rows[0] as CareerPassportSnapshotRow;
}

/** Read-only history. Uses a to_regclass probe so a GET NEVER triggers DDL —
 *  if no snapshot has ever been persisted the table is absent => honest empty. */
export async function listPassportHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerPassportSnapshotRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_passport_snapshots') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, sections_total, sections_present, coverage_pct, measurable,
              competency_present, ei_present, career_profile_present, readiness_present,
              achievements_count, journey_events, created_at
       FROM career_passport_snapshots
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as CareerPassportSnapshotRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as CareerPassportSnapshotRow[] };
}
