/**
 * Task #394 — Slow-request alerts fire when slow, stay quiet on thin data.
 *
 * Locks the null-until-enough-samples contract for the latency alert signals
 * (`http_request_latency_{p50,p95,p99}_ms` in services/ops/alerting.ts `collectSignals`,
 * fed by services/ops/metrics-registry.ts `snapshotLatencyPercentiles`).
 *
 * A regression that either (a) coerces a null percentile to 0, or (b) makes the
 * evaluator stop skipping null signals, would silently produce FALSE pages (paging
 * on insufficient data) or MISS real ones. This test proves both halves:
 *   1. THIN DATA — even when the few samples present are all SLOW (8000ms), p95/p99
 *      stay `null` (below the p95≥20 / p99≥100 minimum-sample floor) and NO latency
 *      alert event fires. This is the strong form of "stay quiet on thin data": slow
 *      data that would trip the threshold if it were computed must still not page.
 *   2. SLOW TAIL — once ≥100 samples exist with a slow tail, p95 (>1000ms) and p99
 *      (>2500ms) are real numbers that trip their seeded `gt` rules and fire durable
 *      `ops_alert_events`.
 *
 * Isolation: the flag is ON only in THIS process (node --test forks per file), and
 * the `ops_alert_rules` / `ops_alert_events` tables created by the flag-ON write path
 * are dropped in `after` (skipped for any that already existed, so a real store is
 * never clobbered). The in-process metrics histogram starts empty in an isolated
 * `tsx --test` run, so the thin-data case runs before any slow-tail samples exist.
 *
 * Run with:  cd backend && npx tsx --test tests/ops-latency-alerting.test.ts
 */

process.env.FF_OPERATIONAL_READINESS = '1'; // alerting write path + signals require the flag ON

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { observeHistogram, snapshotLatencyPercentiles } from '../services/ops/metrics-registry';
import { evaluateAlertRules } from '../services/ops/alerting';

const HAS_DB = !!process.env.DATABASE_URL;
const HIST = 'capadex_http_request_duration_ms';
const P95_SIGNAL = 'http_request_latency_p95_ms';
const P99_SIGNAL = 'http_request_latency_p99_ms';

let pool: Pool | null = null;
// Only drop tables this test created — never clobber a pre-existing real store.
let preExisted = { rules: false, events: false };

async function tableExists(p: Pool, name: string): Promise<boolean> {
  const r = await p.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
  return !!(r.rows[0] && r.rows[0].t);
}

before(async () => {
  if (!HAS_DB) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  preExisted.rules = await tableExists(pool, 'ops_alert_rules');
  preExisted.events = await tableExists(pool, 'ops_alert_events');
});

after(async () => {
  if (!pool) return;
  // Drop like the ops runtime tests — but only the tables we created ourselves.
  if (!preExisted.events) await pool.query('DROP TABLE IF EXISTS ops_alert_events');
  if (!preExisted.rules) await pool.query('DROP TABLE IF EXISTS ops_alert_rules');
  await pool.end();
});

test('THIN DATA: too few samples → p95/p99 null and NO latency alert fires (even when the data is slow)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  assert.ok(pool);

  // Only 10 samples, and ALL of them are slow (8000ms). If the percentile were computed
  // (or a null were coerced to a number) it would exceed both thresholds and page.
  for (let i = 0; i < 10; i++) observeHistogram(HIST, 8000, { method: 'GET' });

  const overall = snapshotLatencyPercentiles().overall;
  // p95 needs ≥20 samples, p99 needs ≥100 → both must be null (not 0, not a computed value).
  assert.equal(overall.p95_ms, null, 'p95 must be null below the 20-sample floor');
  assert.equal(overall.p99_ms, null, 'p99 must be null below the 100-sample floor');

  const res: any = await evaluateAlertRules(pool!);
  assert.equal(res.skipped, undefined, 'flag must be ON so evaluation runs');

  // The signals surfaced to the evaluator must be null (the coercion-to-0 regression guard).
  assert.equal(res.signals[P95_SIGNAL], null, 'p95 signal must be null (never coerced to 0)');
  assert.equal(res.signals[P99_SIGNAL], null, 'p99 signal must be null (never coerced to 0)');

  // No latency rule may fire on insufficient data.
  const latencyFires = (res.fired as any[]).filter((f) =>
    String(f.rule_name).toLowerCase().includes('latency'),
  );
  assert.equal(latencyFires.length, 0, 'no latency alert may fire on thin data');

  // And nothing durable was written for the latency signals.
  const ev = await pool!.query(
    `SELECT count(*)::int AS n FROM ops_alert_events WHERE signal IN ($1,$2)`,
    [P95_SIGNAL, P99_SIGNAL],
  );
  assert.equal(ev.rows[0].n, 0, 'no latency alert event may be persisted on thin data');
});

test('SLOW TAIL: enough samples with a slow tail → p95/p99 fire their gt rules', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  assert.ok(pool);

  // Add 90 fast samples on top of the 10 slow ones → 100 total (a genuine 10% slow tail).
  for (let i = 0; i < 90; i++) observeHistogram(HIST, 10, { method: 'GET' });

  const overall = snapshotLatencyPercentiles().overall;
  assert.notEqual(overall.p95_ms, null, 'p95 must be a real number with ≥100 samples');
  assert.notEqual(overall.p99_ms, null, 'p99 must be a real number with ≥100 samples');
  // Seeded thresholds: p95 gt 1000, p99 gt 2500 (see alerting.ts default rules).
  assert.ok((overall.p95_ms as number) > 1000, `p95 (${overall.p95_ms}) must exceed the 1000ms rule`);
  assert.ok((overall.p99_ms as number) > 2500, `p99 (${overall.p99_ms}) must exceed the 2500ms rule`);

  const res: any = await evaluateAlertRules(pool!);
  const firedSignals = new Set((res.fired as any[]).map((f) => f.rule_name));
  assert.ok(firedSignals.has('Request latency p95 high (ms)'), 'p95 rule must fire on a slow tail');
  assert.ok(firedSignals.has('Request latency p99 high (ms)'), 'p99 rule must fire on a slow tail');

  // Durable events were persisted for both latency signals.
  const ev = await pool!.query(
    `SELECT signal, observed FROM ops_alert_events WHERE signal IN ($1,$2) ORDER BY signal`,
    [P95_SIGNAL, P99_SIGNAL],
  );
  const persisted = ev.rows.map((r) => r.signal);
  assert.ok(persisted.includes(P95_SIGNAL), 'p95 event must be persisted');
  assert.ok(persisted.includes(P99_SIGNAL), 'p99 event must be persisted');
  for (const row of ev.rows) {
    assert.ok(Number(row.observed) > 0, `${row.signal} observed value must be a real (>0) latency`);
  }
});
