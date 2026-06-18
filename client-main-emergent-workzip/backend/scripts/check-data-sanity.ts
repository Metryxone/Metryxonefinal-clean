/**
 * check-data-sanity.ts — quick diagnostic for CAPADEX text tables.
 *
 * Run:  npx tsx backend/scripts/check-data-sanity.ts
 *
 * What it does:
 *   1. Audits the `capadex_concerns_master` schema for any age-band column
 *      and counts straight hyphens (-) vs typographical en-dashes (–) in
 *      each user-facing text column. The current schema stores age as
 *      integer `age_min` / `age_max`, so we widen the sweep to all text
 *      columns and flag any en-dash usage that would break a downstream
 *      `LIKE '%-%'` lookup.
 *   2. Mimics the Tier 1 picker join (`pickQuestionsFromMaster`) with a
 *      `LOWER(TRIM(...))` normalisation on both sides and reports how many
 *      clarity rows + how many unique bridge tags successfully resolve.
 *   3. Asserts ≥ 99 % of clarity question buckets join into the master
 *      taxonomy and exits non-zero if the threshold is breached.
 *
 * Uses the project's Drizzle handle (`backend/storage.ts → db`) and runs
 * raw SQL via `db.execute(sql\`…\`)` for speed and clarity.
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../storage';
import { runMasterFixups, printReport as printFixupReport } from './seed-master-fixups';

const EN_DASH = '\u2013'; // –
const HYPHEN = '-';

type Row = Record<string, unknown>;

async function q<T extends Row = Row>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query as any);
  // node-postgres returns `{ rows }`; drizzle's execute echoes the same shape.
  return ((res as any).rows ?? res) as T[];
}

function header(title: string) {
  console.log(`\n${'━'.repeat(78)}\n▶  ${title}\n${'━'.repeat(78)}`);
}

// ─── Task 1: en-dash vs hyphen sweep ──────────────────────────────────────────
async function auditDashes() {
  header('Task 1 — Hyphen vs en-dash audit on capadex_concerns_master');

  // List every text column on the master table.
  const cols = await q<{ column_name: string; data_type: string }>(sql`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_name = 'capadex_concerns_master'
       AND data_type IN ('text','character varying','varchar')
     ORDER BY ordinal_position;
  `);

  // Flag any column that looks like an age-band field.
  const ageBandLike = cols.filter(c => /age.*band|typical.*age/i.test(c.column_name));
  if (ageBandLike.length === 0) {
    console.log(
      '⚠️  No text column named like "typical_age_band" found. ' +
      'Master stores age as integer age_min / age_max — no dash characters possible there. ' +
      'Falling back to a full text-column sweep so any stray en-dash is still surfaced.',
    );
  } else {
    console.log(`Found ${ageBandLike.length} age-band-like text column(s): ${ageBandLike.map(c => c.column_name).join(', ')}`);
  }

  console.log(`\nScanning ${cols.length} text columns for en-dash (${EN_DASH}) vs hyphen (${HYPHEN})…\n`);
  console.log('column'.padEnd(28) + 'rows'.padStart(8) + 'hyphen'.padStart(10) + 'en-dash'.padStart(10) + '  flag');
  console.log('─'.repeat(78));

  let totalEnDash = 0;
  let totalHyphen = 0;
  for (const c of cols) {
    const col = c.column_name;
    // Identifier is whitelisted from information_schema — safe to inline.
    const rs = await q<{ rows: string; hyphen: string; endash: string }>(sql.raw(`
      SELECT COUNT(*)::text AS rows,
             COUNT(*) FILTER (WHERE "${col}" LIKE '%-%')::text AS hyphen,
             COUNT(*) FILTER (WHERE "${col}" LIKE '%${EN_DASH}%')::text AS endash
        FROM capadex_concerns_master
       WHERE "${col}" IS NOT NULL
    `));
    const r = rs[0];
    const rows = Number(r.rows);
    const hyphen = Number(r.hyphen);
    const endash = Number(r.endash);
    totalHyphen += hyphen;
    totalEnDash += endash;
    const flag = endash > 0 ? '⚠️  en-dash present' : '';
    console.log(
      col.padEnd(28) +
      String(rows).padStart(8) +
      String(hyphen).padStart(10) +
      String(endash).padStart(10) +
      '  ' + flag,
    );
  }

  console.log('─'.repeat(78));
  console.log(`TOTAL`.padEnd(28) + ''.padStart(8) + String(totalHyphen).padStart(10) + String(totalEnDash).padStart(10));
  console.log(
    `\nSummary: ${totalHyphen} hyphen occurrences, ${totalEnDash} en-dash occurrences across all text columns.`,
  );
  if (totalEnDash > 0) {
    console.log('⚠️  En-dashes detected — normalise to ASCII hyphens before any `LIKE \'%-%\'` joins.');
  } else {
    console.log('✅  No typographical en-dashes detected. Hyphen usage is consistent.');
  }
}

// ─── Task 2 + 3: Tier 1 picker join + coverage assertion ─────────────────────
async function auditBridgeJoin(): Promise<{ coveragePct: number; ok: boolean }> {
  header('Task 2 — Mock Tier 1 picker join (clarity.master_bridge_tag ↔ master.relational_bridge_tag)');

  // Total clarity rows + unique tag universe on each side.
  const totals = await q<{ clarity_rows: string; clarity_tags: string; master_rows: string; master_tags: string }>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM capadex_clarity_questions WHERE master_bridge_tag IS NOT NULL) AS clarity_rows,
      (SELECT COUNT(DISTINCT LOWER(TRIM(master_bridge_tag)))::text FROM capadex_clarity_questions WHERE master_bridge_tag IS NOT NULL) AS clarity_tags,
      (SELECT COUNT(*)::text FROM capadex_concerns_master) AS master_rows,
      (SELECT COUNT(DISTINCT LOWER(TRIM(relational_bridge_tag)))::text FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL) AS master_tags;
  `);
  const t = totals[0];
  const clarityRows = Number(t.clarity_rows);
  const clarityTags = Number(t.clarity_tags);
  const masterRows = Number(t.master_rows);
  const masterTags = Number(t.master_tags);

  // Joinable clarity rows under LOWER(TRIM(...)) on both sides. We use
  // EXISTS (not an inner JOIN) so a clarity row maps to a single master
  // bridge tag — many master rows share the same `relational_bridge_tag`
  // (~7.6 rows per tag), and a naive JOIN would Cartesian-inflate the
  // numerator past 100 %.
  const join = await q<{ joinable_rows: string; joinable_tags: string }>(sql`
    SELECT
      COUNT(*)::text AS joinable_rows,
      COUNT(DISTINCT LOWER(TRIM(cq.master_bridge_tag)))::text AS joinable_tags
      FROM capadex_clarity_questions cq
     WHERE cq.master_bridge_tag IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM capadex_concerns_master cm
          WHERE LOWER(TRIM(cm.relational_bridge_tag)) = LOWER(TRIM(cq.master_bridge_tag))
       );
  `);
  const j = join[0];
  const joinableRows = Number(j.joinable_rows);
  const joinableTags = Number(j.joinable_tags);

  console.log(`Master table: ${masterRows.toLocaleString()} rows · ${masterTags.toLocaleString()} unique bridge tags`);
  console.log(`Clarity table: ${clarityRows.toLocaleString()} rows · ${clarityTags.toLocaleString()} unique bridge tags`);
  console.log(`Joinable clarity rows: ${joinableRows.toLocaleString()} / ${clarityRows.toLocaleString()}`);
  console.log(`Joinable clarity tags: ${joinableTags.toLocaleString()} / ${clarityTags.toLocaleString()}`);

  header('Task 3 — Coverage check (≥ 99 % of clarity buckets must join into master)');

  const rowCoverage = clarityRows === 0 ? 0 : (joinableRows / clarityRows) * 100;
  const tagCoverage = clarityTags === 0 ? 0 : (joinableTags / clarityTags) * 100;
  console.log(`Row-level coverage:    ${rowCoverage.toFixed(2)}%  (${joinableRows.toLocaleString()} of ${clarityRows.toLocaleString()} clarity rows)`);
  console.log(`Bucket-level coverage: ${tagCoverage.toFixed(2)}%  (${joinableTags.toLocaleString()} of ${clarityTags.toLocaleString()} unique buckets)`);

  // Sample orphans for quick triage.
  if (tagCoverage < 100) {
    const orphans = await q<{ master_bridge_tag: string; n: string }>(sql`
      SELECT cq.master_bridge_tag, COUNT(*)::text AS n
        FROM capadex_clarity_questions cq
        LEFT JOIN capadex_concerns_master cm
          ON LOWER(TRIM(cq.master_bridge_tag)) = LOWER(TRIM(cm.relational_bridge_tag))
       WHERE cq.master_bridge_tag IS NOT NULL
         AND cm.relational_bridge_tag IS NULL
       GROUP BY cq.master_bridge_tag
       ORDER BY COUNT(*) DESC
       LIMIT 10;
    `);
    if (orphans.length > 0) {
      console.log(`\nTop ${orphans.length} orphan bridge tags (no matching master row):`);
      for (const o of orphans) console.log(`  · ${o.master_bridge_tag} — ${o.n} clarity row(s)`);
    }
  }

  const ok = tagCoverage >= 99;
  console.log(`\n${ok ? '✅' : '❌'}  Bucket coverage ${ok ? 'meets' : 'BELOW'} the 99% threshold.`);
  return { coveragePct: tagCoverage, ok };
}

// ─── Runner ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    // Step 3 of the remediation contract: fixups must run BEFORE the audit
    // so the verifier reflects the post-remediation state. The fixup is
    // fully idempotent (NOT EXISTS guard + targeted UPDATE), so re-running
    // the sanity check costs nothing on a clean DB.
    header('Pre-flight — running master fixups (idempotent)');
    const fix = await runMasterFixups();
    printFixupReport(fix);

    await auditDashes();
    const { ok } = await auditBridgeJoin();
    console.log(`\n${'━'.repeat(78)}\n▶  Done.\n${'━'.repeat(78)}\n`);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('\n❌  check-data-sanity crashed:', err instanceof Error ? err.message : err);
    process.exit(2);
  }
})();
