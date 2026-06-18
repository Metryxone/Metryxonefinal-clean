/**
 * Role-DNA competency seed — routine.
 *
 * Populates the curated `onto_*` competency ontology, including the
 * `onto_dna_profiles` + `onto_role_weights` tables that back the Role DNA
 * endpoint (`GET /api/ontology/roles/:id/dna`, see services/competency-ontology.ts).
 *
 * Why this exists: the `onto_*` taxonomy lives entirely in two SQL migration
 * files (20260523_competency_ontology_phase1.sql for schema,
 * 20260523_competency_ontology_seed.sql for the curated rows) but the project
 * has no migration runner, so on a fresh dev database those tables are created
 * empty and the Role DNA pane renders nothing. This routine applies both files.
 *
 * Idempotent: the schema file is CREATE TABLE/INDEX IF NOT EXISTS and the seed
 * file is INSERT ... ON CONFLICT DO NOTHING, so it is safe to re-run.
 *
 * Note: this is a DIFFERENT namespace from services/ontology-seed.ts, which
 * seeds the `ont_*` (no trailing "o") tables. The Role DNA endpoint reads the
 * `onto_*` tables seeded here.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Pool } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const SCHEMA_FILE = '20260523_competency_ontology_phase1.sql';
const SEED_FILE = '20260523_competency_ontology_seed.sql';

export interface RoleDnaSeedResult {
  ok: boolean;
  counts: {
    roles: number;
    dna_profiles: number;
    role_weights: number;
    competencies: number;
  };
  rolesWithDna: { id: string; title: string; weights: number }[];
  error?: string;
}

export async function runRoleDnaSeed(pool: Pool): Promise<RoleDnaSeedResult> {
  const empty = { roles: 0, dna_profiles: 0, role_weights: 0, competencies: 0 };
  try {
    // 1. Ensure schema (idempotent CREATE IF NOT EXISTS).
    const schemaSql = readFileSync(join(MIGRATIONS_DIR, SCHEMA_FILE), 'utf8');
    await pool.query(schemaSql);

    // 2. Apply curated seed (idempotent ON CONFLICT DO NOTHING).
    const seedSql = readFileSync(join(MIGRATIONS_DIR, SEED_FILE), 'utf8');
    await pool.query(seedSql);

    // 3. Report counts + verify DNA is non-empty for the demo roles.
    const counts = await pool.query<{
      roles: string; dna_profiles: string; role_weights: string; competencies: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM onto_roles)        AS roles,
        (SELECT COUNT(*) FROM onto_dna_profiles) AS dna_profiles,
        (SELECT COUNT(*) FROM onto_role_weights) AS role_weights,
        (SELECT COUNT(*) FROM onto_competencies) AS competencies
    `);
    const c = counts.rows[0];

    const rolesWithDna = await pool.query<{ id: string; title: string; weights: string }>(`
      SELECT r.id, r.title,
             COUNT(w.id) AS weights
      FROM onto_roles r
      JOIN onto_dna_profiles p ON p.role_id = r.id AND p.is_current = TRUE
      JOIN onto_role_weights w ON w.dna_profile_id = p.id
      WHERE r.deprecated = FALSE
      GROUP BY r.id, r.title
      ORDER BY r.id
    `);

    return {
      ok: true,
      counts: {
        roles: Number(c.roles),
        dna_profiles: Number(c.dna_profiles),
        role_weights: Number(c.role_weights),
        competencies: Number(c.competencies),
      },
      rolesWithDna: rolesWithDna.rows.map(r => ({
        id: r.id, title: r.title, weights: Number(r.weights),
      })),
    };
  } catch (err: any) {
    return { ok: false, counts: empty, rolesWithDna: [], error: err?.message ?? 'Unknown error' };
  }
}
