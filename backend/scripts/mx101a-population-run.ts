/**
 * MX-101A — FULL competency coverage population run.
 *
 * Drives the MX-101X Question Factory generateDraftPack across the prioritized 419-competency
 * genome, producing the FULL DRAFT pipeline (~2,514 questions = 419 × 6-cell default pack).
 *
 * HONESTY GUARANTEES (founder guardrails):
 *   - DRAFT-only: every generated row lands status='draft' + quality_review_status='pending_review'
 *     with an INACTIVE map link, so LIVE (approved) coverage is UNCHANGED. No auto-approval.
 *   - Idempotent/resumable: competencies already holding a full actionable pack are skipped.
 *   - Reversible: all rows carry provenance='template_generated' + template_key LIKE 'qf-%'.
 *
 * Verifies before/after that approved coverage did NOT move (no inflation).
 *
 * Run: cd backend && npx tsx scripts/mx101a-population-run.ts            (FULL run)
 *      cd backend && npx tsx scripts/mx101a-population-run.ts --dry-run  (count only)
 *      cd backend && npx tsx scripts/mx101a-population-run.ts --tier 1   (one tier)
 */
import { Pool } from 'pg';
import { ensureQuestionFactorySchema } from '../services/question-factory';
import { generateBulkPopulation, getThreeAxisCoverage } from '../services/question-factory-population';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tierArg = args.indexOf('--tier');
  const tier = tierArg >= 0 ? parseInt(args[tierArg + 1], 10) : undefined;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('=== MX-101A Population Run ===');
    console.log(`mode: ${dryRun ? 'DRY-RUN (count only)' : 'FULL GENERATION'}${tier ? `  tier: ${tier}` : ''}`);

    await ensureQuestionFactorySchema(pool);

    const before = await getThreeAxisCoverage(pool);
    console.log('\n--- BEFORE ---');
    console.log(`genome competencies      : ${before.genome_competencies}`);
    console.log(`draft coverage           : ${before.draft_coverage.competencies} comps (${before.draft_coverage.pct}%), ${before.draft_coverage.questions} questions`);
    console.log(`approved coverage        : ${before.approved_coverage.competencies} comps (${before.approved_coverage.pct}%)`);
    console.log(`assessment-ready coverage: ${before.assessment_ready_coverage.competencies} comps (${before.assessment_ready_coverage.pct}%)`);

    const t0 = Date.now();
    const result = await generateBulkPopulation(pool, { tier, dryRun, createdBy: 'mx101a-population-run' });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('\n--- RUN RESULT ---');
    console.log(JSON.stringify(result, null, 2));
    console.log(`elapsed: ${secs}s`);

    if (!dryRun) {
      const after = await getThreeAxisCoverage(pool);
      console.log('\n--- AFTER ---');
      console.log(`draft coverage           : ${after.draft_coverage.competencies} comps (${after.draft_coverage.pct}%), ${after.draft_coverage.questions} questions`);
      console.log(`approved coverage        : ${after.approved_coverage.competencies} comps (${after.approved_coverage.pct}%)`);
      console.log(`assessment-ready coverage: ${after.assessment_ready_coverage.competencies} comps (${after.assessment_ready_coverage.pct}%)`);

      const inflated = after.approved_coverage.competencies !== before.approved_coverage.competencies
        || after.assessment_ready_coverage.competencies !== before.assessment_ready_coverage.competencies;
      console.log('\n--- HONESTY CHECK ---');
      if (inflated) {
        console.error('❌ FAIL: approved / assessment-ready coverage CHANGED — generation must NOT inflate live coverage.');
        process.exitCode = 1;
      } else {
        console.log('✅ PASS: approved + assessment-ready coverage UNCHANGED. Drafts added zero live coverage (honest).');
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
