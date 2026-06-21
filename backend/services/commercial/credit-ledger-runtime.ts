/**
 * Phase 6.3 — Payment Engine · Customer credit wallet ("Credits").
 *
 * APPEND-ONLY ledger over comm_credit_ledger. The balance is ALWAYS derived (SUM of credit − debit) —
 * never a stored mutable column. issue/apply serialize on a per-customer row lock so concurrent writers
 * cannot race the balance. apply (a debit) is FAIL-CLOSED: it refuses to overdraw the wallet.
 *
 * Distinct from comm_refunds (gateway money-back to the original instrument) — a credit is internal
 * store value the customer can spend on future invoices. We NEVER fabricate value: every entry carries
 * a positive amount and an auditable balance_after snapshot.
 */
import type { Pool, PoolClient } from 'pg';

export interface CreditEntryRow {
  id: string;
  customer_id: string;
  entry_type: 'credit' | 'debit';
  amount_paise: number;
  currency: string;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  balance_after_paise: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreditMutationResult {
  entry: CreditEntryRow;
  balance_paise: number;
}

const asPositiveInt = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n <= 0) {
    throw Object.assign(new Error('amount_paise must be a positive integer'), { status: 400 });
  }
  return n;
};

/** Derived balance = SUM(credit) − SUM(debit). Reads on a client when inside a txn, else the pool. */
async function balanceFor(q: Pool | PoolClient, customerId: string): Promise<number> {
  const { rows } = await q.query(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount_paise ELSE -amount_paise END), 0) AS balance
       FROM comm_credit_ledger WHERE customer_id = $1`,
    [customerId],
  );
  return Number(rows[0]?.balance ?? 0);
}

/** Public read: current derived wallet balance in paise (0 when the customer has no entries). */
export async function getCreditBalance(pool: Pool, customerId: string): Promise<number> {
  return balanceFor(pool, customerId);
}

/** Public read: append-only ledger entries (most recent first). */
export async function listCreditEntries(
  pool: Pool, customerId: string, opts: { limit?: number } = {},
): Promise<CreditEntryRow[]> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const { rows } = await pool.query(
    `SELECT * FROM comm_credit_ledger WHERE customer_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [customerId, limit],
  );
  return rows as CreditEntryRow[];
}

export interface CreditMutationInput {
  customer_id: string;
  amount_paise: number;
  currency?: string | null;
  reason?: string | null;
  ref_type?: string | null;
  ref_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

async function appendEntry(
  client: PoolClient, entryType: 'credit' | 'debit', amount: number, balanceAfter: number, input: CreditMutationInput,
): Promise<CreditEntryRow> {
  const { rows } = await client.query(
    `INSERT INTO comm_credit_ledger
       (customer_id, entry_type, amount_paise, currency, reason, ref_type, ref_id, balance_after_paise, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
    [
      input.customer_id, entryType, amount, input.currency || 'INR',
      input.reason ?? null, input.ref_type ?? null, input.ref_id ?? null,
      balanceAfter, input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
  return rows[0] as CreditEntryRow;
}

/**
 * Add store credit to a customer's wallet. Serializes on the customer row so the derived balance
 * snapshot is consistent under concurrency. Returns null when the customer does not exist.
 */
export async function issueCredit(pool: Pool, input: CreditMutationInput): Promise<CreditMutationResult | null> {
  const amount = asPositiveInt(input.amount_paise);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query(`SELECT id FROM comm_customers WHERE id = $1 FOR UPDATE`, [input.customer_id]);
    if (!c.rows.length) { await client.query('ROLLBACK'); return null; }
    const after = (await balanceFor(client, input.customer_id)) + amount;
    const entry = await appendEntry(client, 'credit', amount, after, input);
    await client.query('COMMIT');
    return { entry, balance_paise: after };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Spend store credit (a debit). FAIL-CLOSED: throws a 400-tagged `insufficient_credit_balance` rather
 * than overdrawing the wallet. Serializes on the customer row. Returns null when the customer does not
 * exist.
 */
export async function applyCredit(pool: Pool, input: CreditMutationInput): Promise<CreditMutationResult | null> {
  const amount = asPositiveInt(input.amount_paise);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query(`SELECT id FROM comm_customers WHERE id = $1 FOR UPDATE`, [input.customer_id]);
    if (!c.rows.length) { await client.query('ROLLBACK'); return null; }
    const current = await balanceFor(client, input.customer_id);
    if (amount > current) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('insufficient_credit_balance'), { status: 400, balance_paise: current });
    }
    const after = current - amount;
    const entry = await appendEntry(client, 'debit', amount, after, input);
    await client.query('COMMIT');
    return { entry, balance_paise: after };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
