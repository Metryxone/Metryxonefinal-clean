/**
 * seed-master-fixups.ts — idempotent remediation for capadex_concerns_master.
 *
 * Run:  npx tsx backend/scripts/seed-master-fixups.ts
 *
 * Performs two fixups (both safe to re-run):
 *   1. Inserts the canonical fallback row CONCERN_GEN_FALLBACK so the
 *      orphan `GENERAL_CONCERN` clarity bucket resolves into master.
 *      Guarded by NOT EXISTS — `concern_id` carries no unique index, so
 *      ON CONFLICT is not an option.
 *   2. Normalises typographical en-dash (U+2013) → ASCII hyphen in
 *      `common_indian_context`. Only touches rows that actually contain
 *      the character, so the row count reported on no-op runs is 0.
 *
 * Re-exported as `runMasterFixups()` so the sanity verifier
 * (`check-data-sanity.ts`) can invoke it before running its audits.
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../storage';

export type FixupReport = {
  fallbackInserted: boolean;
  fallbackAlreadyPresent: boolean;
  enDashRowsUpdated: number;
};

export async function runMasterFixups(): Promise<FixupReport> {
  // ── 1) Canonical fallback row ───────────────────────────────────────────────
  // `concern_id` is not unique in DDL, so we guard with NOT EXISTS. The row is
  // intentionally minimal: only the six columns the spec mandates plus the
  // mandatory join key. Other columns default to NULL — `pickQuestionsFromMaster`
  // joins on `relational_bridge_tag` alone, so the row is fully functional.
  const ins = await db.execute(sql`
    INSERT INTO capadex_concerns_master (
      concern_id, domain, concern_cluster, relational_bridge_tag,
      primary_persona, display_label
    )
    SELECT
      'CONCERN_GEN_FALLBACK',
      'General Well-being & Coping',
      'General or Unclassified Behavioral Concerns',
      'GENERAL_CONCERN',
      'Universal',
      'General Behavioral Reflection'
     WHERE NOT EXISTS (
       SELECT 1 FROM capadex_concerns_master WHERE concern_id = 'CONCERN_GEN_FALLBACK'
     )
    RETURNING concern_id;
  `);
  const insertedRows = ((ins as any).rows ?? ins) as Array<{ concern_id: string }>;
  const fallbackInserted = insertedRows.length > 0;

  // ── 2) En-dash → ASCII hyphen on common_indian_context ──────────────────────
  const upd = await db.execute(sql`
    UPDATE capadex_concerns_master
       SET common_indian_context = REPLACE(common_indian_context, '–', '-')
     WHERE common_indian_context LIKE '%–%'
    RETURNING concern_id;
  `);
  const updatedRows = ((upd as any).rows ?? upd) as Array<{ concern_id: string }>;
  const enDashRowsUpdated = updatedRows.length;

  return {
    fallbackInserted,
    fallbackAlreadyPresent: !fallbackInserted,
    enDashRowsUpdated,
  };
}

function printReport(r: FixupReport) {
  console.log('\n▶  capadex_concerns_master fixups');
  console.log(`   · CONCERN_GEN_FALLBACK : ${r.fallbackInserted ? 'inserted ✅' : 'already present — no-op ✅'}`);
  console.log(`   · en-dash → hyphen     : ${r.enDashRowsUpdated} row(s) updated ${r.enDashRowsUpdated === 0 ? '(no-op ✅)' : '✅'}`);
}

// ── CLI entry ────────────────────────────────────────────────────────────────
const invokedDirectly = (() => {
  try {
    // tsx ESM: import.meta.url === pathToFileURL(process.argv[1])
    const here = new URL(import.meta.url).pathname;
    return process.argv[1] && here.endsWith(process.argv[1].split('/').pop() ?? '');
  } catch {
    return true;
  }
})();

if (invokedDirectly) {
  runMasterFixups()
    .then(r => {
      printReport(r);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌  seed-master-fixups crashed:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}

export { printReport };
