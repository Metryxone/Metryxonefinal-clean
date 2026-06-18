/**
 * CAPADEX Ontology Audit — CLI.
 *
 * Runs the five ontology audits (signal, composite, relationship, contradiction,
 * intervention) via `services/ontology-audit-service.ts`, prints the compact
 * contract summary as JSON to stdout, and writes the extended readiness report
 * to a file.
 *
 * Read-only. Makes no writes to the database.
 *
 * Usage:
 *   tsx backend/scripts/ontology-audit.ts                 # print summary + write report
 *   tsx backend/scripts/ontology-audit.ts --out=path.json # custom report path
 *   tsx backend/scripts/ontology-audit.ts --summary-only  # skip report file
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { runOntologyAudit } from '../services/ontology-audit-service';

function getFlag(name: string): string | boolean {
  const arg = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!arg) return false;
  const eq = arg.indexOf('=');
  return eq === -1 ? true : arg.slice(eq + 1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const summaryOnly = getFlag('summary-only') === true;
  const outFlag = getFlag('out');
  const outPath = typeof outFlag === 'string' && outFlag
    ? resolve(process.cwd(), outFlag)
    : resolve(__dirname, 'ontology-readiness-report.json');

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  try {
    const report = await runOntologyAudit(db);

    // 1. Compact contract summary -> stdout.
    process.stdout.write(JSON.stringify(report.summary, null, 2) + '\n');

    // 2. Extended readiness report -> file + console digest.
    if (!summaryOnly) {
      writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
      console.error(`\nReadiness report written to: ${outPath}`);
    }

    const a = report.audits;
    console.error('\n── Ontology readiness digest ────────────────────────────');
    console.error(`  readiness score              : ${report.readiness_score}%`);
    console.error(`  domains / families           : ${report.summary.total_domains} / ${report.summary.total_families}`);
    console.error(`  signals (atomic) / composites: ${report.summary.total_signals} / ${report.summary.total_composites}`);
    console.error(`  relationships / interventions: ${report.summary.total_relationships} / ${report.summary.total_interventions}`);
    console.error(`  contradiction tokens         : ${report.summary.total_contradictions}`);
    console.error(`  orphaned signals             : ${a.signal_coverage.orphaned_count}`);
    console.error(`  orphaned composites          : ${a.composite_coverage.orphaned_count}`);
    console.error(`  atomic intervention coverage : ${a.signal_coverage.intervention_mapping_coverage_pct}%`);
    console.error(`  edge duplicates / dangling   : ${a.relationship_edges.duplicate_edge_groups.length} / ${a.relationship_edges.dangling_edges.length}`);
    console.error(`  isolated buckets (missing rel): ${report.summary.missing_relationships.join(', ') || '—'}`);
    console.error(`  buckets missing intervention : ${report.summary.missing_interventions.join(', ') || '—'}`);
    console.error('──────────────────────────────────────────────────────────');
    console.error('\nRepair plan (run scripts/ontology-repair.ts to apply):');
    console.error(`  intervention placeholders to insert: ${report.repair_plan.intervention_backfill.length}`);
    console.error(`  inverse edges to insert            : ${report.repair_plan.inverse_edge_backfill.length}`);
    console.error(`  isolated buckets (SME curation)    : ${report.repair_plan.manual_curation_required.isolated_buckets.length}`);
    console.error(`  atomic rows w/o intervention map   : ${report.repair_plan.manual_curation_required.atomic_signals_without_intervention_mapping}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
