/**
 * Resolve NEGATIVE GENERAL_CONCERN atomic signals → specific concern bridge tags.
 *
 * Usage (from repo root):
 *   npx tsx backend/scripts/audit/resolve-negative-general-concern.ts            # dry-run (default, no writes)
 *   npx tsx backend/scripts/audit/resolve-negative-general-concern.ts --apply    # perform the update in a txn
 *   npx tsx backend/scripts/audit/resolve-negative-general-concern.ts --revert   # roll back using the audit ledger
 *
 * Dry-run writes audit artifacts to audit/atomic-bridge/:
 *   - resolved.csv   (the rollback ledger: id, atomic_signal_id, family, old_tag, new_tag)
 *   - flagged.csv    (families left as GENERAL_CONCERN for human review, with counts)
 *   - summary.json   (aggregate stats)
 *
 * Safety:
 *   - Validates every resolver target tag exists in capadex_concerns_master; aborts otherwise.
 *   - Scoped strictly to signal_category='negative' AND relational_bridge_tag='GENERAL_CONCERN'.
 *   - Idempotent: re-running --apply changes nothing once rows are remapped.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  resolveNegativeAtomicBridge,
  RESOLVER_TARGET_TAGS,
  GENERAL_CONCERN_TAG,
} from '../../services/atomic-bridge-resolver';

const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
const OUT_DIR = join(process.cwd(), 'audit', 'atomic-bridge');
const LEDGER = join(OUT_DIR, 'resolved.csv');

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  return [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n') + '\n';
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (REVERT) return await revert(pool);

    // 1) Validate every target tag really exists in the master (real joins).
    const masterTags = new Set(
      (await pool.query(`SELECT DISTINCT relational_bridge_tag AS t FROM capadex_concerns_master`))
        .rows.map(r => r.t),
    );
    const missing = [...RESOLVER_TARGET_TAGS].filter(t => !masterTags.has(t));
    if (missing.length) {
      console.error('ABORT — these resolver target tags are not in capadex_concerns_master:', missing);
      process.exit(1);
    }

    // 2) Load the candidate rows (negative + catch-all only).
    const { rows } = await pool.query<{ id: number; atomic_signal_id: string; family_name: string }>(
      `SELECT id, atomic_signal_id, family_name
         FROM capadex_atomic_signals
        WHERE signal_category = 'negative'
          AND relational_bridge_tag = $1`,
      [GENERAL_CONCERN_TAG],
    );

    // 3) Resolve.
    const resolved: Record<string, unknown>[] = [];
    const flaggedCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const r of rows) {
      const res = resolveNegativeAtomicBridge(r.family_name);
      if (res.resolved_tag) {
        resolved.push({
          id: r.id,
          atomic_signal_id: r.atomic_signal_id,
          family: r.family_name,
          old_tag: GENERAL_CONCERN_TAG,
          new_tag: res.resolved_tag,
        });
        tagCounts.set(res.resolved_tag, (tagCounts.get(res.resolved_tag) ?? 0) + 1);
      } else {
        flaggedCounts.set(r.family_name, (flaggedCounts.get(r.family_name) ?? 0) + 1);
      }
    }

    // 4) Write audit artifacts.
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(LEDGER, toCsv(resolved, ['id', 'atomic_signal_id', 'family', 'old_tag', 'new_tag']));
    const flaggedRows = [...flaggedCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([family, n]) => ({ family, count: n }));
    writeFileSync(join(OUT_DIR, 'flagged.csv'), toCsv(flaggedRows, ['family', 'count']));
    const summary = {
      generated_at: new Date().toISOString(),
      mode: APPLY ? 'apply' : 'dry-run',
      negative_general_concern_total: rows.length,
      resolved_total: resolved.length,
      flagged_total: rows.length - resolved.length,
      distinct_target_tags: tagCounts.size,
      by_target_tag: Object.fromEntries([...tagCounts.entries()].sort((a, b) => b[1] - a[1])),
      flagged_families: flaggedRows.length,
    };
    writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));

    // 5) Apply (optional).
    if (!APPLY) {
      console.log(`\nDRY-RUN. Audit written to ${OUT_DIR}. Re-run with --apply to update the DB.`);
      return;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let updated = 0;
      // Group by target tag → one UPDATE per tag (scoped + idempotent).
      const byTag = new Map<string, number[]>();
      for (const r of resolved) {
        const tag = r.new_tag as string;
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push(r.id as number);
      }
      for (const [tag, ids] of byTag) {
        const res = await client.query(
          `UPDATE capadex_atomic_signals
              SET relational_bridge_tag = $1, updated_at = now()
            WHERE id = ANY($2::int[])
              AND signal_category = 'negative'
              AND relational_bridge_tag = $3`,
          [tag, ids, GENERAL_CONCERN_TAG],
        );
        updated += res.rowCount ?? 0;
      }
      await client.query('COMMIT');
      console.log(`\nAPPLIED. ${updated} rows remapped from GENERAL_CONCERN → specific concern tags.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function revert(pool: Pool) {
  if (!existsSync(LEDGER)) {
    console.error(`No ledger at ${LEDGER}; nothing to revert.`);
    process.exit(1);
  }
  const lines = readFileSync(LEDGER, 'utf8').trim().split('\n').slice(1);
  // Group ids by the new_tag the apply step assigned (col 5) so revert can be
  // guarded — only roll back rows that STILL hold that exact tag and are still
  // negative, never clobbering later manual curation on the same ids.
  const byTag = new Map<string, number[]>();
  for (const l of lines) {
    const cols = l.split(',');
    const id = parseInt(cols[0], 10);
    const newTag = (cols[4] ?? '').trim();
    if (!Number.isFinite(id) || !newTag) continue;
    if (!byTag.has(newTag)) byTag.set(newTag, []);
    byTag.get(newTag)!.push(id);
  }
  if (!byTag.size) { console.log('Ledger empty; nothing to revert.'); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let reverted = 0;
    for (const [newTag, ids] of byTag) {
      const res = await client.query(
        `UPDATE capadex_atomic_signals
            SET relational_bridge_tag = $1, updated_at = now()
          WHERE id = ANY($2::int[])
            AND signal_category = 'negative'
            AND relational_bridge_tag = $3`,
        [GENERAL_CONCERN_TAG, ids, newTag],
      );
      reverted += res.rowCount ?? 0;
    }
    await client.query('COMMIT');
    console.log(`REVERTED ${reverted} rows back to GENERAL_CONCERN.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
