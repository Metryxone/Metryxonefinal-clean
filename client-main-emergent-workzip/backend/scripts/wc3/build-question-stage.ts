/**
 * WC-3 L5A — build Question Stage Intelligence for the entire clarity pool.
 *
 * Derives Primary/Secondary canonical stage + Stage Confidence for every clarity question
 * (from question_type/response_type/polarity/narrative_style) and upserts into
 * `wc3_question_intelligence`. Idempotent — safe to re-run. Prints the four validation
 * metrics required by the L5A report.
 *
 * Usage: npx tsx scripts/wc3/build-question-stage.ts
 */
import { Pool } from 'pg';
import { buildQuestionStageIntelligence } from '../../services/wc3/question-stage-intelligence';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const t0 = Date.now();
    const report = await buildQuestionStageIntelligence(pool);
    const ms = Date.now() - t0;
    console.log(JSON.stringify({ ...report, elapsed_ms: ms }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
