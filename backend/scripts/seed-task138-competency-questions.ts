/**
 * Task #138 — per-competency questions (lever 1). THIN CLI WRAPPER.
 *
 * The seed logic now lives in services/task138-competency-seed.ts (single source of truth,
 * shared with the idempotent backend-startup hook ensureTask138CompetencySeed). This wrapper
 * just runs the question-authoring step against DATABASE_URL. Run with --apply to write; default
 * dry run. See the service file header for the full honesty/safety contract.
 */
import { Pool } from 'pg';
import { seedCompetencyQuestions } from '../services/task138-competency-seed';

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await seedCompetencyQuestions(pool, apply);
    console.log(
      `${apply ? 'APPLIED' : 'DRY-RUN'}: ${r.templates} templates, ${r.mapRows} new active map rows, ${r.skippedComps} competencies skipped.`,
    );
    if (!apply) console.log('Re-run with --apply to write.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
