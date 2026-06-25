/**
 * Task #145 — author + approve + active-map behavioural MCQs for the Backend /
 * Senior Backend Engineer role-DNA competencies that lacked questions (lever 1 of
 * the precise per-competency scoring gate).
 *
 * Thin wrapper. The single source of truth (question content + write logic) lives
 * in services/role-bridge-activation.ts and runs at boot (index.ts). This script
 * remains for manual/CLI runs against a target DATABASE_URL. Idempotent on
 * template_key; pass --apply to write (default is a no-write report).
 */
import { Pool } from 'pg';
import { seedCompetencyQuestions, COMPS } from '../services/role-bridge-activation';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!apply) {
    const total = COMPS.reduce((n, c) => n + c.questions.length, 0);
    console.log(`DRY-RUN: would author/approve ${total} questions across ${COMPS.length} competencies. Pass --apply to run.`);
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await seedCompetencyQuestions(pool);
    r.notes.forEach((n) => console.log(n));
    console.log('\n' + '='.repeat(60));
    console.log(`APPLIED: ${r.templates} templates upserted, ${r.mapRows} question-map rows added, ${r.skippedComps} competencies skipped.`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
