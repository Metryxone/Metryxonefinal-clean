/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Operational Readiness.
 *
 * Additive, flag-gated (`operationalReadiness`) DURABLE JOB QUEUE + Dead-Letter-Queue.
 * Closes GAP-OPS-2 (no durable queue / DLQ / retry-failure-processing-time persistence).
 *
 * Byte-identical OFF: every entry point returns early when the flag is OFF — NO table is
 * created (lazy ensure-schema runs only on the flag-ON write path), no worker is started.
 * Durable-queue tables therefore do not exist while the flag is OFF (schema-identical).
 */
import type { Pool } from 'pg';
import { isOperationalReadinessEnabled } from '../../config/feature-flags';

const QUEUE = 'ops_job_queue';
const DLQ = 'ops_job_dead_letter';
const DEFAULT_MAX_ATTEMPTS = 5;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS ${QUEUE} (
    id bigserial PRIMARY KEY,
    job_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',          -- pending|processing|succeeded|failed
    attempts int NOT NULL DEFAULT 0,
    max_attempts int NOT NULL DEFAULT ${DEFAULT_MAX_ATTEMPTS},
    last_error text,
    processing_ms int,
    available_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${QUEUE}_due_idx ON ${QUEUE} (status, available_at)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${DLQ} (
    id bigserial PRIMARY KEY,
    original_id bigint,
    job_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    attempts int NOT NULL,
    last_error text,
    dead_lettered_at timestamptz NOT NULL DEFAULT now()
  )`);
  schemaReady = true;
}

async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    return !!(r.rows[0] && r.rows[0].t);
  } catch {
    return false;
  }
}

type JobHandler = (payload: any) => Promise<void>;
const handlers = new Map<string, JobHandler>();
/** Register a durable-job handler. Consumers wire real async work through the queue. */
export function registerJobHandler(jobType: string, fn: JobHandler): void {
  handlers.set(jobType, fn);
}

/** Enqueue durable work. Returns {skipped:true} when the flag is OFF (byte-identical). */
export async function enqueueJob(
  pool: Pool,
  jobType: string,
  payload: any = {},
  opts: { maxAttempts?: number; availableAt?: Date } = {},
): Promise<{ ok: boolean; id?: number; skipped?: boolean; reason?: string }> {
  if (!isOperationalReadinessEnabled()) return { ok: false, skipped: true, reason: 'flag_off' };
  await ensureSchema(pool);
  const r = await pool.query(
    `INSERT INTO ${QUEUE} (job_type, payload, max_attempts, available_at)
     VALUES ($1, $2::jsonb, $3, $4) RETURNING id`,
    [jobType, JSON.stringify(payload ?? {}), opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, opts.availableAt ?? new Date()],
  );
  return { ok: true, id: Number(r.rows[0].id) };
}

/** Process one batch of due jobs. Records attempts, processing_ms, retries w/ backoff, DLQ. */
export async function runQueueOnce(
  pool: Pool,
  batch = 10,
): Promise<{ processed: number; succeeded: number; failed: number; deadLettered: number; skipped?: boolean }> {
  if (!isOperationalReadinessEnabled()) return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0, skipped: true };
  await ensureSchema(pool);
  const client = await pool.connect();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;
  try {
    const { rows } = await client.query(
      `UPDATE ${QUEUE} SET status='processing', updated_at=now()
       WHERE id IN (
         SELECT id FROM ${QUEUE}
         WHERE status='pending' AND available_at<=now()
         ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED
       )
       RETURNING id, job_type, payload, attempts, max_attempts`,
      [batch],
    );
    for (const job of rows) {
      processed++;
      const handler = handlers.get(job.job_type);
      const t0 = Date.now();
      try {
        if (!handler) throw new Error(`no handler registered for job_type=${job.job_type}`);
        await handler(job.payload);
        await client.query(
          `UPDATE ${QUEUE} SET status='succeeded', processing_ms=$2, updated_at=now() WHERE id=$1`,
          [job.id, Date.now() - t0],
        );
        succeeded++;
      } catch (e: any) {
        const attempts = Number(job.attempts) + 1;
        const errMsg = String(e?.message || e).slice(0, 1000);
        const procMs = Date.now() - t0;
        if (attempts >= Number(job.max_attempts)) {
          await client.query(
            `INSERT INTO ${DLQ} (original_id, job_type, payload, attempts, last_error)
             VALUES ($1, $2, $3::jsonb, $4, $5)`,
            [job.id, job.job_type, JSON.stringify(job.payload), attempts, errMsg],
          );
          await client.query(
            `UPDATE ${QUEUE} SET status='failed', attempts=$2, last_error=$3, processing_ms=$4, updated_at=now() WHERE id=$1`,
            [job.id, attempts, errMsg, procMs],
          );
          deadLettered++;
        } else {
          const backoffSec = Math.min(300, 2 ** attempts);
          await client.query(
            `UPDATE ${QUEUE} SET status='pending', attempts=$2, last_error=$3, processing_ms=$4,
               available_at=now() + ($5 || ' seconds')::interval, updated_at=now() WHERE id=$1`,
            [job.id, attempts, errMsg, procMs, String(backoffSec)],
          );
        }
        failed++;
      }
    }
  } finally {
    client.release();
  }
  return { processed, succeeded, failed, deadLettered };
}

/** Queue stats (null ≠ 0: table-absent → ready:false, never a fabricated 0). */
export async function getQueueStats(pool: Pool) {
  if (!(await tableReady(pool, QUEUE))) {
    return { ready: false, note: 'Durable-queue table absent until first enqueue (flag-ON). null ≠ 0.' };
  }
  const byStatus = await pool.query(`SELECT status, count(*)::int AS n FROM ${QUEUE} GROUP BY status`);
  const dlq = (await tableReady(pool, DLQ))
    ? await pool.query(`SELECT count(*)::int AS n FROM ${DLQ}`)
    : { rows: [{ n: 0 }] };
  const timing = await pool.query(
    `SELECT round(avg(processing_ms))::int AS avg_ms, max(processing_ms)::int AS max_ms
     FROM ${QUEUE} WHERE processing_ms IS NOT NULL`,
  );
  return {
    ready: true,
    by_status: Object.fromEntries(byStatus.rows.map((r: any) => [r.status, r.n])),
    dead_letter_count: dlq.rows[0]?.n ?? 0,
    processing_ms: { avg: timing.rows[0]?.avg_ms ?? null, max: timing.rows[0]?.max_ms ?? null },
  };
}

/** Recent dead-letter entries (durable failure record). */
export async function getDeadLetters(pool: Pool, limit = 50) {
  if (!(await tableReady(pool, DLQ))) return { ready: false, dead_letters: [] };
  const lim = Math.min(Math.max(limit, 1), 200);
  const r = await pool.query(
    `SELECT id, original_id, job_type, attempts, last_error, dead_lettered_at
     FROM ${DLQ} ORDER BY dead_lettered_at DESC LIMIT $1`,
    [lim],
  );
  return { ready: true, dead_letters: r.rows };
}

let workerTimer: NodeJS.Timeout | null = null;
/** Start the background worker (flag-ON only). Idempotent; unref'd so it never blocks exit. */
export function startQueueWorker(pool: Pool, intervalMs = 15000): void {
  if (workerTimer) return;
  if (!isOperationalReadinessEnabled()) return;
  workerTimer = setInterval(() => {
    runQueueOnce(pool).catch(() => {});
  }, intervalMs);
  if (typeof workerTimer.unref === 'function') workerTimer.unref();
}
