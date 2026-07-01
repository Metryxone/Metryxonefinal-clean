/**
 * Data-Retention Enforcement Scheduler (Phase 2.4 remediation — CMP-M2).
 *
 * A flag-gated background loop that ENFORCES retention for SAFE, well-defined
 * categories only. Mirrors the ai-governance-scheduler shape: idempotent single
 * start, unref'd intervals, never-throws.
 *
 * SAFE mutations only:
 *   1. Expire stale consents — status granted→expired past expires_at (reversible).
 *   2. Purge expired/used MFA codes older than 24h (transient security tokens).
 *   3. Stamp data_retention_policies.last_executed for the audit trail.
 *   4. DRY-RUN count of what user_data retention WOULD affect (NO deletion).
 *
 * It NEVER auto-deletes user accounts: the canonical `users` table has no
 * last-activity/last-login signal, so an inactivity purge cannot be honest here.
 * Account erasure is handled as an admin-reviewed request (CMP-M3), never silently.
 *
 * Byte-identical OFF incl. schema: retention_execution_log is created only inside
 * start(), which returns immediately unless the flag is ON.
 */
import type { Pool } from 'pg';
import { isRetentionEnforcementEnabled } from '../config/feature-flags';

const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
let started = false;

async function ensureSchema(pool: Pool): Promise<void> {
  // Guarded: only ever called from start(), which asserts the flag first.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS retention_execution_log (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      executed_at       timestamptz NOT NULL DEFAULT now(),
      consents_expired  integer NOT NULL DEFAULT 0,
      mfa_codes_purged  integer NOT NULL DEFAULT 0,
      policies_stamped  integer NOT NULL DEFAULT 0,
      user_data_dry_run integer,
      note              text
    )
  `);
}

async function runOnce(pool: Pool): Promise<void> {
  let consentsExpired = 0, mfaPurged = 0, policiesStamped = 0;
  let userDataDryRun: number | null = null;

  // 1. Expire stale consents (reversible status change)
  try {
    const r = await pool.query(
      `UPDATE consent_records
          SET status='expired', updated_at=now()
        WHERE status='granted' AND expires_at IS NOT NULL AND expires_at < now()`);
    consentsExpired = r.rowCount ?? 0;
  } catch (e: any) { console.warn('[retention] consent-expiry error:', e.message); }

  // 2. Purge expired/used MFA codes older than 24h (transient tokens)
  try {
    const r = await pool.query(
      `DELETE FROM mfa_codes
        WHERE (used = true OR expires_at < now())
          AND created_at < now() - interval '1 day'`);
    mfaPurged = r.rowCount ?? 0;
  } catch (e: any) { console.warn('[retention] mfa-purge error:', e.message); }

  // 3. Stamp active retention policies for the audit trail
  try {
    const r = await pool.query(
      `UPDATE data_retention_policies
          SET last_executed=now(), updated_at=now()
        WHERE is_active = true`);
    policiesStamped = r.rowCount ?? 0;
  } catch (e: any) { console.warn('[retention] policy-stamp error:', e.message); }

  // 4. Dry-run: how many users WOULD be affected by user_data retention (NO deletion).
  //    Honest measurement only — `users` has no activity column, so this counts by
  //    account age against the shortest active user_data policy, if one exists.
  try {
    const { rows } = await pool.query<{ days: number }>(
      `SELECT MIN(retention_period_days) AS days
         FROM data_retention_policies
        WHERE is_active = true AND data_category = 'user_data'`);
    const days = rows[0]?.days;
    if (days != null && Number.isFinite(Number(days))) {
      const { rows: c } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM users
          WHERE created_at < now() - ($1 || ' days')::interval`, [String(days)]);
      userDataDryRun = Number(c[0]?.n ?? 0);
    }
  } catch (e: any) { console.warn('[retention] user-data dry-run error:', e.message); }

  try {
    await pool.query(
      `INSERT INTO retention_execution_log
         (consents_expired, mfa_codes_purged, policies_stamped, user_data_dry_run, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [consentsExpired, mfaPurged, policiesStamped, userDataDryRun,
       'safe-category enforcement; no account auto-deletion']);
  } catch (e: any) { console.warn('[retention] log-insert error:', e.message); }

  console.log(`[retention] run — consents_expired=${consentsExpired} mfa_purged=${mfaPurged} policies_stamped=${policiesStamped} user_data_dry_run=${userDataDryRun}`);
}

export function startRetentionScheduler(pool: Pool): void {
  if (started) return;
  if (!isRetentionEnforcementEnabled()) return;
  started = true;
  console.log('[retention] enforcement scheduler starting — every 6h (safe categories only)');
  ensureSchema(pool)
    .then(() => {
      runOnce(pool);
      setInterval(() => runOnce(pool), RETENTION_INTERVAL_MS).unref();
    })
    .catch(err => console.warn('[retention] schema init error:', err.message));
}
