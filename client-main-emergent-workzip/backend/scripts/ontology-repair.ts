/**
 * CAPADEX Ontology Repair — idempotent missing-data backfill.
 *
 * Closes the additive gaps surfaced by the audit. SAFE, INSERT-ONLY repairs:
 *
 *   A. intervention_library backfill — for each ontology bridge-tag bucket with
 *      no matching `construct_key`, insert ONE placeholder intervention row,
 *      `is_active = false` (catalogued but NOT auto-served live until an admin
 *      reviews/activates it). Idempotent via WHERE NOT EXISTS on construct_key.
 *
 *   B. adaptive_ontology_edges inverse backfill — for each APPROVED edge A->B
 *      with no inverse B->A, insert the inverse as status='draft' (admin
 *      promotes). Correlation is symmetric, so this is deterministic, not a
 *      fabricated relationship. Idempotent via WHERE NOT EXISTS on the pair.
 *
 * GUARDRAILS (per Phase 1 brief):
 *   - Never deletes or updates production records (insert-only).
 *   - Never regenerates ontology — does NOT invent correlations for isolated
 *     buckets, does NOT overwrite atomic intervention_mapping/contradiction
 *     columns. Those are reported for SME curation only.
 *   - Idempotent, batched, wrapped in a single db.transaction().
 *   - No schema changes.
 *
 * Usage:
 *   tsx backend/scripts/ontology-repair.ts            # DRY RUN (default) — plan only
 *   tsx backend/scripts/ontology-repair.ts --apply    # execute inside a transaction
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { runOntologyAudit, type InverseEdgeCandidate } from '../services/ontology-audit-service';

const BATCH_SIZE = 100;
// Stable key for a transaction-scoped advisory lock: serialises concurrent
// `--apply` runs to a single writer so `WHERE NOT EXISTS` stays race-free even
// without a unique constraint on the natural keys. Auto-released on commit/rollback.
const ADVISORY_LOCK_KEY = 482411300;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const apply = process.argv.includes('--apply');

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  try {
    const report = await runOntologyAudit(db);

    // Dedupe candidates in-memory so a single run never issues redundant inserts.
    const intervention_backfill = Array.from(new Set(report.repair_plan.intervention_backfill));
    const inverseEdgeMap = new Map<string, InverseEdgeCandidate>();
    for (const e of report.repair_plan.inverse_edge_backfill) {
      inverseEdgeMap.set(`${e.source_bucket}\u0000${e.target_bucket}`, e);
    }
    const inverse_edge_backfill = Array.from(inverseEdgeMap.values());

    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (use --apply to write)'}`);
    console.log(`\nPlanned backfills:`);
    console.log(`  A. intervention_library placeholders: ${intervention_backfill.length}`);
    intervention_backfill.forEach((k) => console.log(`       + construct_key=${k} (is_active=false, placeholder)`));
    console.log(`  B. inverse edges (draft):             ${inverse_edge_backfill.length}`);
    inverse_edge_backfill.forEach((e) =>
      console.log(`       + ${e.source_bucket} -> ${e.target_bucket} (weight ${e.weight})`),
    );
    console.log(`\nNot auto-repaired (require SME curation):`);
    console.log(`  - isolated buckets: ${report.repair_plan.manual_curation_required.isolated_buckets.join(', ') || '—'}`);
    console.log(`  - atomic rows without intervention mapping: ${report.repair_plan.manual_curation_required.atomic_signals_without_intervention_mapping}`);

    if (!apply) {
      console.log('\nDry run complete — no changes written.');
      return;
    }

    if (intervention_backfill.length === 0 && inverse_edge_backfill.length === 0) {
      console.log('\nNothing to backfill — ontology already covers all additive gaps.');
      return;
    }

    let interventionsInserted = 0;
    let edgesInserted = 0;

    await db.transaction(async (tx) => {
      // Single-writer guard: serialises concurrent --apply runs so the
      // WHERE NOT EXISTS dedupe is race-free without a schema change.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      // ── A. intervention_library placeholders (batched, idempotent) ──────
      for (const batch of chunk(intervention_backfill, BATCH_SIZE)) {
        for (const constructKey of batch) {
          const res = (await tx.execute(sql`
            INSERT INTO intervention_library
              (construct_key, confidence_band, emotional_load_band, persona,
               intervention_text, rationale, safety_level, is_active)
            SELECT ${constructKey}, 'low', 'low', 'student',
                   ${'Developmental support placeholder for ' + constructKey + '. Provides structured reflection and guided practice while specific guidance is curated. Developmental signal only — not a hiring, clinical, or suitability judgement.'},
                   'Auto-backfilled by ontology-repair to close an intervention-mapping gap. Inactive placeholder pending SME review.',
                   'informational', false
            WHERE NOT EXISTS (
              SELECT 1 FROM intervention_library WHERE construct_key = ${constructKey}
            )
          `)) as unknown as { rowCount?: number };
          interventionsInserted += res.rowCount ?? 0;
        }
      }

      // ── B. inverse edges as draft (batched, idempotent) ─────────────────
      for (const batch of chunk<InverseEdgeCandidate>(inverse_edge_backfill, BATCH_SIZE)) {
        for (const e of batch) {
          const res = (await tx.execute(sql`
            INSERT INTO adaptive_ontology_edges (source_bucket, target_bucket, weight, status)
            SELECT ${e.source_bucket}, ${e.target_bucket}, ${e.weight}, 'draft'
            WHERE NOT EXISTS (
              SELECT 1 FROM adaptive_ontology_edges
              WHERE source_bucket = ${e.source_bucket} AND target_bucket = ${e.target_bucket}
            )
          `)) as unknown as { rowCount?: number };
          edgesInserted += res.rowCount ?? 0;
        }
      }
    }, { isolationLevel: 'serializable' });

    console.log(`\nApplied (committed):`);
    console.log(`  intervention_library rows inserted: ${interventionsInserted}`);
    console.log(`  adaptive_ontology_edges inserted  : ${edgesInserted}`);
    console.log('Re-run scripts/ontology-audit.ts to confirm gaps are closed.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
