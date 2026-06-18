/**
 * WC-3 L5B — build Question Context Intelligence for the entire clarity pool.
 *
 * Derives Primary/Secondary life-CONTEXT + Context Confidence + `context_explicit` +
 * relevance_risk for every clarity question (from a tightened, sense-disambiguated
 * question lexicon corroborated by the joined concern ontology) and upserts into
 * `wc3_question_context`. Idempotent — safe to re-run. Prints the validation metrics
 * required by the L5B deltas report. Honours the honesty contract: the ~80% context-neutral
 * mass is stamped GENERAL (never force-tagged), ambiguity → UNRESOLVED.
 *
 * Usage: npx tsx scripts/wc3/build-question-context.ts
 */
import { Pool } from 'pg';
import { buildQuestionContextIntelligence } from '../../services/wc3/question-context-intelligence';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const t0 = Date.now();
    const report = await buildQuestionContextIntelligence(pool);
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
