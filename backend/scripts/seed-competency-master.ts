/**
 * Phase 1.2 — Competency Master Enhancement seed (runner).
 *
 * Backfills one onto_competency_master_ext row per EXISTING competency with the
 * Status (derived from the existing `deprecated` flag) + the six module
 * eligibility flags (default baseline). Strictly ADDITIVE — never mutates
 * onto_competencies and NEVER creates a competency. Idempotent (ON CONFLICT DO
 * NOTHING) — safe to re-run; admin-curated rows are never overwritten.
 *
 * Usage:
 *   cd backend && npx tsx scripts/seed-competency-master.ts            # apply
 *   cd backend && npx tsx scripts/seed-competency-master.ts --dry-run  # report only, no writes
 */
import { Pool } from 'pg';
import {
  ELIGIBILITY_FLAGS,
  ensureCompetencyMasterSchema,
  runCompetencyMasterSeed,
} from '../services/competency-master';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const DRY = process.argv.includes('--dry-run');

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  try {
    if (DRY) {
      console.log('DRY-RUN — reporting without writing.\n');
      await ensureCompetencyMasterSchema(pool);
      const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies`)).rows[0]?.n ?? 0;
      const existing = (await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competency_master_ext`)).rows[0]?.n ?? 0;
      const dep = (await pool.query(`SELECT COUNT(*)::int AS n FROM onto_competencies WHERE deprecated`)).rows[0]?.n ?? 0;
      console.log(`Competencies total:        ${total}`);
      console.log(`Already enhanced:          ${existing}`);
      console.log(`Would insert (missing):    ${total - existing}`);
      console.log(`Status would derive:       active=${total - dep} deprecated=${dep}`);
      console.log(`Eligibility default:       ${ELIGIBILITY_FLAGS.map((f) => f.label).join(', ')} = true (source=default)`);
      return;
    }

    console.log('Seeding Competency Master extension (Status + eligibility)…');
    const result = await runCompetencyMasterSeed(pool);
    if (!result.ok) { console.error(`FAILED: ${result.error}`); process.exit(1); }
    console.log(`\nCompetencies total:   ${result.competencies_total}`);
    console.log(`Rows before:          ${result.rows_existing_before}`);
    console.log(`Rows inserted:        ${result.rows_inserted}`);
    console.log(`Rows total after:     ${result.rows_total_after}`);
    if (result.rows_total_after !== result.competencies_total) {
      console.error('\nERROR: enhanced rows != competencies total (coverage < 100%).');
      process.exit(1);
    }
    console.log('\nOK — every competency enhanced, no duplicates created.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
