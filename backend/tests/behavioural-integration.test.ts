/**
 * Behavioural Intelligence Phase 2 — integration tests (architect follow-ups).
 *
 * Covers the three follow-ups the architect flagged as next-actions:
 *   1. `language_policy` present on **401, 403, and fallback** envelopes for
 *      all six behavioural endpoints.
 *   2. `getLatestSnapshot()` counts only rows from the latest snapshot batch
 *      (not all historical rows for the user).
 *   3. `/diagnose/profile` and `/snapshot` ignore client-supplied `user_id`
 *      and persist only to the authenticated session user.
 *
 * Run with:  cd backend && npx tsx --test tests/behavioural-integration.test.ts
 *
 * Requirements: DATABASE_URL pointing at a Postgres with the Phase 2 migration
 * applied. The DB test isolates writes under unique synthetic user IDs and
 * cleans up after itself.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'node:net';
import pg from 'pg';

import { registerBehaviouralIntelligenceRoutes } from '../routes/behavioural-intelligence.ts';
import { persistBehaviouralSnapshot, getLatestSnapshot } from '../services/behavioural-memory.ts';
import { extractAndScore } from '../services/evidence-extractor.ts';
import { detectContradictions } from '../services/contradiction-detector.ts';

// ── shared fixtures ────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface Harness {
  url: string;
  close: () => Promise<void>;
  setUser: (id: string | null) => void;
}

/** Build a tiny express app that mounts the behavioural router with a
 *  configurable auth stub — lets us simulate authenticated/unauthenticated/
 *  cross-user requests without spinning up the full server. */
async function buildHarness(): Promise<Harness> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  let user: { id: string } | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (user) {
      // @ts-expect-error passport-shaped fields used by requireAuth
      req.user = user;
      // @ts-expect-error passport extends req
      req.isAuthenticated = () => true;
    } else {
      // @ts-expect-error passport extends req
      req.isAuthenticated = () => false;
    }
    next();
  });

  registerBehaviouralIntelligenceRoutes({ app, pool });

  const server = app.listen(0);
  await new Promise<void>(r => server.on('listening', () => r()));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>(r => server.close(() => r())),
    setUser: (id) => { user = id ? { id } : null; },
  };
}

let harness: Harness;
const TEST_USER_A = `__bsig_test_user_a_${Date.now()}`;
const TEST_USER_B = `__bsig_test_user_b_${Date.now()}`;

before(async () => { harness = await buildHarness(); });
after(async () => {
  await harness.close();
  // best-effort cleanup of any synthetic rows we wrote
  await pool.query(
    `DELETE FROM bsig_signal_snapshots     WHERE user_id IN ($1, $2)`,
    [TEST_USER_A, TEST_USER_B]).catch(() => {});
  await pool.query(
    `DELETE FROM bsig_evidence              WHERE user_id IN ($1, $2)`,
    [TEST_USER_A, TEST_USER_B]).catch(() => {});
  await pool.query(
    `DELETE FROM bsig_contradiction_history WHERE user_id IN ($1, $2)`,
    [TEST_USER_A, TEST_USER_B]).catch(() => {});
  await pool.query(
    `DELETE FROM bsig_audit_logs            WHERE user_id IN ($1, $2)`,
    [TEST_USER_A, TEST_USER_B]).catch(() => {});
  await pool.end();
});

// ── 1. language_policy on every envelope (401 / 403 / fallback / success) ──

test('language_policy: 401 on unauthenticated /diagnose/profile carries policy', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/behavioural/diagnose/profile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'whoever' }),
  });
  assert.equal(r.status, 401);
  const body = await r.json() as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.fallback_reason, 'authentication_required');
  assert.ok(body.language_policy, 'language_policy missing from 401 envelope');
});

test('language_policy: 401 on unauthenticated /evolution/:userId carries policy', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/behavioural/evolution/anyone`);
  assert.equal(r.status, 401);
  const body = await r.json() as Record<string, unknown>;
  assert.ok(body.language_policy, 'language_policy missing from 401 envelope');
});

test('language_policy: 401 on unauthenticated /snapshot carries policy', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/behavioural/snapshot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: [] }),
  });
  assert.equal(r.status, 401);
  const body = await r.json() as Record<string, unknown>;
  assert.ok(body.language_policy, 'language_policy missing from 401 envelope');
});

test('language_policy: 403 on cross-user /evolution/:userId carries policy', async () => {
  harness.setUser(TEST_USER_A);
  const r = await fetch(`${harness.url}/api/behavioural/evolution/${TEST_USER_B}`);
  assert.equal(r.status, 403);
  const body = await r.json() as Record<string, unknown>;
  assert.equal(body.fallback_reason, 'cross_user_read_forbidden');
  assert.ok(body.language_policy, 'language_policy missing from 403 envelope');
});

test('language_policy: public /taxonomy + /diagnose + /recommendations all carry policy', async () => {
  harness.setUser(null);
  const tax = await (await fetch(`${harness.url}/api/behavioural/taxonomy`)).json();
  assert.ok(tax.language_policy);

  const diag = await (await fetch(`${harness.url}/api/behavioural/diagnose`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: [{ source_type: 'resume', source_id: 'r1', text: 'I led x.' }] }),
  })).json();
  assert.ok(diag.language_policy);

  const recs = await (await fetch(`${harness.url}/api/behavioural/recommendations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: [{ source_type: 'resume', source_id: 'r1', text: 'I think maybe.' }] }),
  })).json();
  assert.ok(recs.language_policy);
});

test('language_policy: fallback envelope (no-sources /diagnose/profile) carries policy', async () => {
  harness.setUser(TEST_USER_A);  // user has no career_seeker_profiles row
  const r = await fetch(`${harness.url}/api/behavioural/diagnose/profile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, unknown>;
  assert.equal(body.fallback, true);
  assert.equal(body.fallback_reason, 'no_text_sources_available');
  assert.ok(body.language_policy, 'language_policy missing from fallback envelope');
});

// ── 2. getLatestSnapshot counts only the latest batch ──────────────────────

test('getLatestSnapshot: counts only rows in the most recent snapshot batch', async () => {
  // Persist two batches with different shapes and verify the count
  // matches the LATEST batch only (not the historical total).
  const srcA = [{ source_type: 'resume' as const, source_id: 'r1',
    text: 'I owned the relaunch and delivered the platform shipping in 6 months.' }];
  const { scores: scoresA } = extractAndScore(srcA);
  const contradictionsA = detectContradictions(srcA, scoresA);
  await persistBehaviouralSnapshot(pool, {
    user_id: TEST_USER_B, scores: scoresA, sources: srcA, contradictions: contradictionsA,
  });
  // Ensure batch-2 timestamp is strictly later than batch-1.
  await new Promise(r => setTimeout(r, 20));
  const srcB = [{ source_type: 'resume' as const, source_id: 'r2',
    text: 'I increased revenue by 30%. Saved $250K. Iterated v1 v2 v3 weekly.' }];
  const { scores: scoresB } = extractAndScore(srcB);
  const contradictionsB = detectContradictions(srcB, scoresB);
  await persistBehaviouralSnapshot(pool, {
    user_id: TEST_USER_B, scores: scoresB, sources: srcB, contradictions: contradictionsB,
  });

  const latest = await getLatestSnapshot(pool, TEST_USER_B);
  assert.ok(latest.snapshot_ts, 'expected a snapshot_ts to be returned');
  assert.equal(latest.signal_count, scoresB.length,
    `latest_signal_count should equal scoresB.length (${scoresB.length}), got ${latest.signal_count}`);

  // Sanity: independent COUNT proves historical row count is strictly greater,
  // so we're definitely not just returning the global total.
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bsig_signal_snapshots WHERE user_id = $1`, [TEST_USER_B]);
  const total = Number(rows[0]?.n ?? 0);
  assert.ok(total > scoresB.length,
    `historical total (${total}) should exceed latest batch size (${scoresB.length}) — fixture failed`);
});

// ── 3. authz: client-supplied user_id is ignored, session id is canonical ──

test('authz: /snapshot persists to session user even when client sends a different user_id', async () => {
  // Authenticate as USER_A but try to write to USER_B via the body.
  harness.setUser(TEST_USER_A);
  const before = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bsig_signal_snapshots WHERE user_id = $1`, [TEST_USER_B]);
  const beforeB = Number(before.rows[0]?.n ?? 0);

  const r = await fetch(`${harness.url}/api/behavioural/snapshot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: TEST_USER_B,   // <-- attacker tries to write into B
      sources: [{ source_type: 'resume', source_id: 'attack', text: 'I owned the relaunch and delivered v1 v2 v3.' }],
    }),
  });
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, unknown>;
  assert.equal(body.ok, true);

  // USER_B's row count must NOT have grown.
  const after = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bsig_signal_snapshots WHERE user_id = $1`, [TEST_USER_B]);
  const afterB = Number(after.rows[0]?.n ?? 0);
  assert.equal(afterB, beforeB, 'snapshot must NOT have been written to the attacker-supplied user_id');

  // USER_A should have received the write.
  const a = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bsig_signal_snapshots WHERE user_id = $1`, [TEST_USER_A]);
  assert.ok(Number(a.rows[0]?.n ?? 0) > 0, 'snapshot must have been written to the session user');
});

test('authz: /evolution/:userId blocks cross-user reads even when authenticated', async () => {
  harness.setUser(TEST_USER_A);
  const r = await fetch(`${harness.url}/api/behavioural/evolution/${TEST_USER_B}`);
  assert.equal(r.status, 403);
});

test('authz: /evolution/:userId allows self-reads', async () => {
  harness.setUser(TEST_USER_A);
  const r = await fetch(`${harness.url}/api/behavioural/evolution/${TEST_USER_A}`);
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.user_id, TEST_USER_A);
});
