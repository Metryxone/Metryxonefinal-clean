/**
 * WC-1B-R validation harness runner. Drives the EXISTING simulation harness
 * (runSimulation → real public HTTP endpoints) against the server on
 * `process.env.PORT`. The grounding flag lives in the SERVER process, so
 * before/after is controlled by which server (flag OFF vs ON) we point at.
 *
 * Usage: PORT=8080 npx tsx scripts/wc1b-r/run-harness.ts <label> <seed>
 * Writes audit/wc1b-r/harness_<label>.json
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runSimulation } from '../../services/simulation/simulation-engine';

async function main() {
  const label = process.argv[2] || 'run';
  const seed = Number(process.argv[3] || 20260604);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await runSimulation(pool, { seed, profileCount: 200 });
    mkdirSync('audit/wc1b-r', { recursive: true });
    const out = `audit/wc1b-r/harness_${label}.json`;
    writeFileSync(out, JSON.stringify(result, null, 2));
    const m = result.metrics;
    console.log(`[${label}] seed=${seed} port=${process.env.PORT || '8080'}`);
    console.log(`  verdict=${result.validation.verdict} sample=${result.sampleSize}`);
    console.log(`  relevance=${m.relevance.toFixed(4)} cov=${m.relevanceCoverage.toFixed(4)} concept=${m.relevanceConcept.toFixed(4)} concernMatch=${m.relevanceConcernMatch.toFixed(4)}`);
    console.log(`  concernCoverage=${m.concernCoverage.toFixed(4)} questionQuality=${m.questionQuality.toFixed(4)} reportUsefulness=${m.reportUsefulness.toFixed(4)}`);
    console.log(`  signalConfidence=${m.signalConfidence.toFixed(4)} patternConfidence=${m.patternConfidence.toFixed(4)} recommendationQuality=${m.recommendationQuality.toFixed(4)}`);
    console.log(`  coverage=${JSON.stringify(m.coverage)}`);
    console.log(`  -> ${out}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
