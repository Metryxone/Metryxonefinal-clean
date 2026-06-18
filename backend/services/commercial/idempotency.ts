/**
 * Task #5 — Commercial Runtime Spine · exactly-once idempotency guard.
 *
 * Wraps a side-effecting handler (verify / webhook) so a repeated request with the same
 * natural key runs the side effect AT MOST ONCE. The stored response is replayed on a repeat.
 *
 * The unique key is the natural request identifier supplied by the caller, e.g. the Razorpay
 * event id for a webhook, or `verify:${order_id}` for a verify call. We INSERT a claim row first
 * (ON CONFLICT DO NOTHING) — if the insert claims the key we run `fn` and persist its response;
 * if the key already existed we return the previously stored response (`replayed:true`).
 */
import type { Pool } from 'pg';

export interface IdempotentOutcome<T> {
  replayed: boolean;
  response: T;
}

/**
 * Run `fn` exactly once per (idempotency_key). On a repeat call the stored JSON response is
 * returned with `replayed:true`. A failed `fn` is NOT cached as success — the claim row is
 * removed so the operation can be retried.
 */
export async function withIdempotency<T>(
  pool: Pool,
  idempotencyKey: string,
  scope: string,
  fn: () => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  // Attempt to claim the key. A conflicting (already-present) key yields zero rows.
  const claim = await pool.query(
    `INSERT INTO comm_idempotency_keys (idempotency_key, scope, status, response)
     VALUES ($1, $2, 'completed', NULL)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [idempotencyKey, scope],
  );

  if (claim.rows.length === 0) {
    // Key already processed — replay the stored response (may be NULL if a concurrent claim is
    // still in flight; callers treat a null replay as "already handled").
    const prior = await pool.query(
      `SELECT response FROM comm_idempotency_keys WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    return { replayed: true, response: (prior.rows[0]?.response ?? null) as T };
  }

  try {
    const result = await fn();
    await pool.query(
      `UPDATE comm_idempotency_keys SET status='completed', response=$2::jsonb
       WHERE idempotency_key=$1`,
      [idempotencyKey, JSON.stringify(result ?? null)],
    );
    return { replayed: false, response: result };
  } catch (err) {
    // Release the claim so the failed operation can be retried later (do not cache failures as done).
    await pool
      .query(`DELETE FROM comm_idempotency_keys WHERE idempotency_key=$1`, [idempotencyKey])
      .catch(() => {});
    throw err;
  }
}
