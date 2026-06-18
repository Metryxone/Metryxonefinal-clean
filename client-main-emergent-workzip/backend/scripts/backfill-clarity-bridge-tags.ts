#!/usr/bin/env tsx
/**
 * Backfill `master_bridge_tag` for UNMAPPED clarity rows.
 *
 * Re-derives the join key for every `capadex_clarity_questions` row currently on
 * the 'UNMAPPED' sentinel, using the shared classifier (curated prefix lookup →
 * token-heuristic against the master vocabulary). Rows that still fail both
 * lookups are left UNMAPPED — never fabricated.
 *
 *   npx tsx backend/scripts/backfill-clarity-bridge-tags.ts          # dry-run
 *   npx tsx backend/scripts/backfill-clarity-bridge-tags.ts --apply  # write
 */
import pg from 'pg';
import { resolveMasterBridgeTag, loadMasterVocabulary, UNMAPPED } from '../services/clarity-bridge-classifier';

const { Pool } = pg;

async function main(): Promise<number> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const masterVocab = await loadMasterVocabulary(pool);
    console.log(`Loaded ${masterVocab.size} master bridge-tag candidates.`);

    const { rows } = await pool.query(
      `SELECT id, concern_id, concern_id_prefix, concern
         FROM capadex_clarity_questions
        WHERE master_bridge_tag = $1`,
      [UNMAPPED],
    );
    console.log(`UNMAPPED rows to evaluate: ${rows.length}`);

    const updates: Array<{ id: number; tag: string }> = [];
    const dist: Record<string, number> = {};
    let stillUnmapped = 0;
    for (const r of rows) {
      const tag = resolveMasterBridgeTag(
        { concernId: r.concern_id, concernIdPrefix: r.concern_id_prefix, concern: r.concern },
        masterVocab,
      );
      if (tag === UNMAPPED) { stillUnmapped += 1; continue; }
      updates.push({ id: r.id, tag });
      dist[tag] = (dist[tag] ?? 0) + 1;
    }

    console.log(`\nResolvable: ${updates.length}   still UNMAPPED: ${stillUnmapped}`);
    console.log('Resolved bucket distribution:');
    for (const [tag, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${tag.padEnd(28)} ${n}`);
    }

    if (!apply) {
      console.log('\n[dry-run] No rows written. Re-run with --apply to persist.');
      return 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let written = 0;
      const CHUNK = 500;
      for (let i = 0; i < updates.length; i += CHUNK) {
        const chunk = updates.slice(i, i + CHUNK);
        const ids = chunk.map(u => u.id);
        const tags = chunk.map(u => u.tag);
        const r = await client.query(
          `UPDATE capadex_clarity_questions AS q
              SET master_bridge_tag = u.tag, updated_at = NOW()
             FROM unnest($1::int[], $2::text[]) AS u(id, tag)
            WHERE q.id = u.id`,
          [ids, tags],
        );
        written += r.rowCount ?? 0;
      }
      await client.query('COMMIT');
      console.log(`\n[apply] Updated ${written} rows.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return 0;
  } finally {
    await pool.end();
  }
}

main().then(code => process.exit(code)).catch(err => {
  console.error(err);
  process.exit(1);
});
