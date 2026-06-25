/**
 * MX-301 blueprint seed — grounds the demo candidate's gap-engine stage.
 *
 * The MX-301 demo candidate's career_seeker_profile references
 * blueprint_id='mx301_blueprint', but getBlueprint() reads
 * onto_assessment_blueprints + onto_blueprint_competency_map — where no such row
 * existed → the gap-engine API returned 404 (blueprint_not_found).
 *
 * This seed creates that blueprint, GROUNDED ENTIRELY in real genome data: the
 * onto_role_competency_profiles rows for role_pm (Product Manager) are copied
 * verbatim into onto_blueprint_competency_map. Nothing is fabricated — required
 * levels, weights and criticality come straight from the curated Role-DNA.
 *
 * Additive + reversible: `--rollback` removes the blueprint + its competency map.
 * No other rows are touched. Safe to re-run (idempotent upsert).
 *
 *   cd backend && npx tsx scripts/mx301-blueprint-seed.ts            # seed
 *   cd backend && npx tsx scripts/mx301-blueprint-seed.ts --rollback # remove
 */
import pg from 'pg';

const { Pool } = pg;

const BLUEPRINT_ID = 'mx301_blueprint';
const SOURCE_ROLE_ID = 'role_pm'; // real onto_roles id ("Product Manager")
const BLUEPRINT_NAME = 'MX-301 Senior Product Manager';

async function rollback(pool: pg.Pool): Promise<void> {
  await pool.query(`DELETE FROM onto_blueprint_competency_map WHERE blueprint_id = $1`, [BLUEPRINT_ID]);
  await pool.query(`DELETE FROM onto_assessment_blueprints WHERE id = $1`, [BLUEPRINT_ID]);
  console.log(`Rollback: removed blueprint "${BLUEPRINT_ID}" + its competency map.`);
}

async function seed(pool: pg.Pool): Promise<void> {
  // Verify the grounding role exists with real competency requirements.
  const role = await pool.query(`SELECT id, title FROM onto_roles WHERE id = $1`, [SOURCE_ROLE_ID]);
  if (role.rowCount === 0) {
    throw new Error(`grounding role "${SOURCE_ROLE_ID}" not found in onto_roles — refusing to fabricate a blueprint`);
  }
  const reqs = await pool.query(
    `SELECT competency_id, required_level, weight, criticality
       FROM onto_role_competency_profiles
      WHERE role_id = $1 AND active = true
      ORDER BY competency_id`,
    [SOURCE_ROLE_ID],
  );
  if (reqs.rowCount === 0) {
    throw new Error(`role "${SOURCE_ROLE_ID}" has no active competency requirements — refusing to seed an empty blueprint`);
  }

  // Base blueprint row (source_role_id FK → onto_roles, ON DELETE SET NULL).
  await pool.query(
    `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, description, source_role_id, source, active)
     VALUES ($1, $1, $2, $3, $4, 'derived', true)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description,
           source_role_id = EXCLUDED.source_role_id, active = true, updated_at = now()`,
    [
      BLUEPRINT_ID,
      BLUEPRINT_NAME,
      `Derived from Role-DNA of ${role.rows[0].title} (${SOURCE_ROLE_ID}). MX-301 demonstration blueprint — grounded in onto_role_competency_profiles, no fabricated requirements.`,
      SOURCE_ROLE_ID,
    ],
  );

  // Competency map — copied verbatim from the curated Role-DNA.
  let n = 0;
  for (const r of reqs.rows) {
    await pool.query(
      `INSERT INTO onto_blueprint_competency_map
         (blueprint_id, competency_id, required_level, weight, criticality, source, active)
       VALUES ($1, $2, $3, $4, $5, 'derived', true)
       ON CONFLICT (blueprint_id, competency_id) DO UPDATE
         SET required_level = EXCLUDED.required_level, weight = EXCLUDED.weight,
             criticality = EXCLUDED.criticality, active = true, updated_at = now()`,
      [BLUEPRINT_ID, r.competency_id, r.required_level, r.weight, r.criticality],
    );
    n++;
  }
  console.log(`Seeded blueprint "${BLUEPRINT_ID}" (${BLUEPRINT_NAME}) from ${role.rows[0].title} Role-DNA: ${n} competencies.`);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    if (process.argv.includes('--rollback')) {
      await rollback(pool);
    } else {
      await seed(pool);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
