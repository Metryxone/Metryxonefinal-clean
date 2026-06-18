/**
 * Reclassify POSITIVE atomic signals out of the GENERAL_CONCERN catch-all into an
 * explicit STRENGTH_SIGNAL bucket.
 *
 * Why: ~8,970 of the GENERAL_CONCERN atomic signals are positive *capability*
 * signals (strengths). They have no specific concern to attach to, so leaving them
 * in a bucket literally named "GENERAL_CONCERN" made them look like an unmapped
 * gap. Moving them to STRENGTH_SIGNAL is accurate (driven purely by
 * signal_category='positive') and lets the ontology panel show every signal as
 * deliberately classified (concern · strength · review) — 0 left as a misleading
 * leftover.
 *
 * Usage (from repo root):
 *   npx tsx backend/scripts/audit/classify-strength-signals.ts            # dry-run (default, no writes)
 *   npx tsx backend/scripts/audit/classify-strength-signals.ts --apply    # perform the update in a txn
 *   npx tsx backend/scripts/audit/classify-strength-signals.ts --revert   # roll back using the audit ledger
 *
 * Dry-run writes audit artifacts to audit/atomic-bridge/:
 *   - strengths.csv        (the rollback ledger: id, atomic_signal_id, family, old_tag, new_tag)
 *   - strengths-summary.json
 *
 * Safety:
 *   - Scoped strictly to signal_category='positive' AND relational_bridge_tag='GENERAL_CONCERN'.
 *   - Idempotent: re-running --apply changes nothing once rows are moved.
 *   - Leaves the remaining GENERAL_CONCERN rows (negative + ambiguous review queue)
 *     in place, preserving the concern-signal-mapping-engine bridge_fallback pool.
 *   - Live assessment scoring keys off atomic_signal_id (omega-x), not the bridge
 *     tag, so runtime behaviour is unchanged.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { GENERAL_CONCERN_TAG, STRENGTH_SIGNAL_TAG } from '../../services/atomic-bridge-resolver';

const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
const OUT_DIR = join(process.cwd(), 'audit', 'atomic-bridge');
const LEDGER = join(OUT_DIR, 'strengths.csv');

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

    // 1) Load the candidate rows (positive + catch-all only).
    const { rows } = await pool.query<{ id: number; atomic_signal_id: string; family_name: string }>(
      `SELECT id, atomic_signal_id, family_name
         FROM capadex_atomic_signals
        WHERE signal_category = 'positive'
          AND relational_bridge_tag = $1`,
      [GENERAL_CONCERN_TAG],
    );

    // 2) Build the ledger.
    const ledger = rows.map(r => ({
      id: r.id,
      atomic_signal_id: r.atomic_signal_id,
      family: r.family_name,
      old_tag: GENERAL_CONCERN_TAG,
      new_tag: STRENGTH_SIGNAL_TAG,
    }));

    // 3) Write audit artifacts.
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(LEDGER, toCsv(ledger, ['id', 'atomic_signal_id', 'family', 'old_tag', 'new_tag']));
    const summary = {
      generated_at: new Date().toISOString(),
      mode: APPLY ? 'apply' : 'dry-run',
      positive_general_concern_total: rows.length,
      target_tag: STRENGTH_SIGNAL_TAG,
    };
    writeFileSync(join(OUT_DIR, 'strengths-summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));

    // 4) Apply (optional).
    if (!APPLY) {
      console.log(`\nDRY-RUN. Audit written to ${OUT_DIR}. Re-run with --apply to update the DB.`);
      return;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `UPDATE capadex_atomic_signals
            SET relational_bridge_tag = $1, updated_at = now()
          WHERE signal_category = 'positive'
            AND relational_bridge_tag = $2`,
        [STRENGTH_SIGNAL_TAG, GENERAL_CONCERN_TAG],
      );
      await client.query('COMMIT');
      console.log(`\nAPPLIED. ${res.rowCount} positive rows moved GENERAL_CONCERN → ${STRENGTH_SIGNAL_TAG}.`);
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
  const ids = lines.map(l => parseInt(l.split(',')[0], 10)).filter(Number.isFinite);
  if (!ids.length) { console.log('Ledger empty; nothing to revert.'); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Guarded: only roll back rows still holding STRENGTH_SIGNAL and still positive,
    // so later manual curation on those ids is never clobbered.
    const res = await client.query(
      `UPDATE capadex_atomic_signals
          SET relational_bridge_tag = $1, updated_at = now()
        WHERE id = ANY($2::int[])
          AND signal_category = 'positive'
          AND relational_bridge_tag = $3`,
      [GENERAL_CONCERN_TAG, ids, STRENGTH_SIGNAL_TAG],
    );
    await client.query('COMMIT');
    console.log(`REVERTED ${res.rowCount} rows back to GENERAL_CONCERN.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
