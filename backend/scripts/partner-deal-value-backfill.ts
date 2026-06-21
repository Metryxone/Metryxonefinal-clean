/**
 * Partner Referral Deal-Value Backfill
 * ─────────────────────────────────────
 * Task #34 added deal-value capture + auto-derived commissions GOING FORWARD. Referrals that were already
 * 'converted' before that change carry no deal_value and therefore no payout. This one-time, idempotent
 * backfill links each such row to its referred tenant's REAL realized revenue and derives the earned
 * commission, shrinking the historical coverage gap — without ever fabricating a value.
 *
 * For every converted referral with a referred_tenant_id and BOTH commission_amount AND deal_value NULL:
 *   • call resolveReferredTenantDealValue(pool, referredTenantId) (the same live-ledger resolver the
 *     write path uses);
 *   • when it returns a value → write deal_value + deal_value_source, and when commission_pct is present
 *     derive commission_amount = pct × deal_value with commission_amount_source = 'derived';
 *   • when it resolves to null → leave the row untouched (an honest, unlinkable coverage gap).
 *
 * Re-runnable safely: the WHERE clause only ever selects rows where deal_value AND commission_amount are
 * still NULL, so a second run is a no-op on rows already filled.
 *
 * NOTE: a task-agent run writes to the ISOLATED env DB. To take effect on production this script must be
 * re-run against the live/prod DATABASE_URL.
 *
 * Usage:  cd backend && npx tsx scripts/partner-deal-value-backfill.ts [--dry-run]
 */
import { Pool } from 'pg';
import { resolveReferredTenantDealValue } from '../services/tenant/partner-ecosystem-actions';
import { ensurePartnerEcosystemSchema } from '../services/tenant/partner-ecosystem-schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

interface CandidateRow {
  id: number;
  referred_tenant_id: number;
  commission_pct: string | number | null;
}

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]).catch(() => ({ rows: [{ reg: null }] }));
  return r.rows[0]?.reg != null;
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Partner Referral Deal-Value Backfill');
  console.log('══════════════════════════════════════════');
  console.log(`  Mode:    ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('──────────────────────────────────────────\n');

  if (!(await tableExists('tenant_channel_referrals'))) {
    console.log('tenant_channel_referrals does not exist — nothing to backfill (partner ecosystem not provisioned).');
    await pool.end();
    return;
  }

  // Ensure the additive deal_value / *_source columns exist (idempotent; mirrors the write-path schema).
  // This makes the backfill self-contained on an env where the flag-gated lazy ensure has not yet run.
  await ensurePartnerEcosystemSchema(pool);

  // Only converted referrals with a referred tenant AND no payout yet (deal_value AND amount both NULL).
  // This predicate is what makes the script re-runnable: filled rows drop out of the candidate set.
  const res = await pool.query(
    `SELECT id, referred_tenant_id, commission_pct
       FROM tenant_channel_referrals
      WHERE status = 'converted'
        AND referred_tenant_id IS NOT NULL
        AND commission_amount IS NULL
        AND deal_value IS NULL
      ORDER BY id ASC`,
  );
  const candidates = res.rows as CandidateRow[];
  console.log(`Eligible converted referrals (no deal_value / no commission_amount): ${candidates.length}\n`);

  if (candidates.length === 0) {
    console.log('Nothing to backfill.');
    await pool.end();
    return;
  }

  let linked = 0;        // deal_value resolved + written
  let derived = 0;       // commission_amount also derived (pct present)
  let dealOnly = 0;      // deal_value written but pct absent → amount stays a gap
  let unlinkable = 0;    // resolver returned null → honest gap, untouched
  let failed = 0;

  for (const row of candidates) {
    try {
      const resolved = await resolveReferredTenantDealValue(pool, Number(row.referred_tenant_id));
      if (!resolved) {
        unlinkable++;
        continue;
      }

      const pct = row.commission_pct == null ? null : Number(row.commission_pct);
      let amount: number | null = null;
      let amountSource: string | null = null;
      if (pct != null && Number.isFinite(pct)) {
        amount = Math.round((pct / 100) * resolved.value * 100) / 100;
        amountSource = 'derived';
      }

      if (dryRun) {
        linked++;
        if (amount != null) derived++; else dealOnly++;
        console.log(
          `  [dry-run] referral ${row.id}: deal_value=${resolved.value} (${resolved.source})` +
          (amount != null ? `, commission_amount=${amount} (derived, pct=${pct})` : `, commission_amount stays NULL (no commission_pct)`),
        );
        continue;
      }

      // Idempotent write: re-assert the NULL guard so a concurrent run can't double-write.
      await pool.query(
        `UPDATE tenant_channel_referrals
            SET deal_value = $1,
                deal_value_source = $2,
                commission_amount = COALESCE($3, commission_amount),
                commission_amount_source = COALESCE($4, commission_amount_source)
          WHERE id = $5
            AND deal_value IS NULL
            AND commission_amount IS NULL`,
        [resolved.value, resolved.source, amount, amountSource, row.id],
      );
      linked++;
      if (amount != null) derived++; else dealOnly++;
    } catch (e) {
      failed++;
      console.warn(`\n[deal-value-backfill] referral ${row.id}: ${(e as Error).message}`);
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Backfill Results');
  console.log('══════════════════════════════════════════');
  console.log(`  Candidates:               ${candidates.length}`);
  console.log(`  Linked (deal_value set):  ${linked}`);
  console.log(`    ├─ commission derived:  ${derived}`);
  console.log(`    └─ deal-only (no pct):  ${dealOnly}`);
  console.log(`  Unlinkable (honest gap):  ${unlinkable}`);
  console.log(`  Failed:                   ${failed}`);
  console.log(`\n  Completed: ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════\n');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
