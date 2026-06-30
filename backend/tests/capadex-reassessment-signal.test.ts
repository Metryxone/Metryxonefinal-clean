/**
 * Task #314 — Re-assessment reminder appears on REVISIT, not just after finishing.
 *
 * Task #307 made the read-only "Re-assessment recommended" / "Eligible for exit
 * assessment" banner surface when a returning user reopens a previous report,
 * by threading a `reassessment` field through GET /api/capadex/report/:session_id.
 * Because this is a flag-gated longitudinal signal, the field can silently
 * regress (stop flowing through the report response, or stop being reconstructed
 * by the frontend revisit path). This suite is the regression guard.
 *
 * It exercises the report route's `reassessment` wiring over an HTTP request:
 * the route assembles the field by calling the REAL
 * `getReassessmentSignal` (backend/services/capadex/progression-outcome-capture)
 * which in turn calls the REAL `getLongitudinalHistoryBySession`. A stub pool
 * feeds controlled snapshot rows (no real DB), so the assertions are about the
 * field's SHAPE and FLAG-GATING — the contract the frontend depends on.
 *
 *   - flag ON,  fresh snapshots          → reassessment present, not eligible
 *   - flag ON,  stale snapshots (>=180d) → eligible_for_reassessment = true
 *   - flag ON,  Mastery snapshot         → eligible_for_exit = true
 *   - flag ON,  unknown session          → reassessment = null (honest)
 *   - flag OFF                           → reassessment = null (byte-identical legacy)
 *
 * A final source-contract check proves the real report route in
 * backend/routes/capadex.ts still spreads `reassessment` into res.json, and that
 * the frontend revisit reconstruction (loadCapadexReport) threads it into the
 * rendered StageJourneyPanel.
 *
 * The flag is toggled per-scenario via FF_LONGITUDINAL_OUTCOME_CAPTURE;
 * isFlagEnabled reads process.env fresh on every call, so no re-import is needed.
 *
 * Run with:  npx tsx backend/tests/capadex-reassessment-signal.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer, type Server, type AddressInfo } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';

import { getReassessmentSignal, REASSESSMENT_FRESHNESS_DAYS } from '../services/capadex/progression-outcome-capture';
import { LIFECYCLE_STAGE_CODES, STAGE_CODE_TO_LABEL } from '../lib/lifecycle';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// ── Async-capable test runner (matches the repo's other tsx test files) ───────
let passed = 0;
let failed = 0;
const queue: Array<() => Promise<void>> = [];
function test(label: string, fn: () => void | Promise<void>) {
  queue.push(async () => {
    try {
      await fn();
      console.log(`  ✓  ${label}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗  ${label}`);
      console.error(`     ${err?.message ?? err}`);
      failed++;
    }
  });
}

// ── Stub pool: satisfies getLongitudinalHistoryBySession + its ensure-schema
//    DDL without a real database. The session UUID is the ownership bearer; we
//    control the snapshot rows the read returns. ────────────────────────────────
type StubOpts = { sessionExists: boolean; snapshots: Array<Record<string, any>> };
function makeStubPool(opts: StubOpts) {
  return {
    query: async (sql: string, _params?: any[]) => {
      const s = String(sql);
      if (/FROM\s+capadex_sessions/i.test(s)) {
        return opts.sessionExists ? { rows: [{ guest_email: null }] } : { rows: [] };
      }
      if (/FROM\s+capadex_users/i.test(s)) return { rows: [] };
      if (/FROM\s+wc3_longitudinal_snapshots/i.test(s)) return { rows: opts.snapshots };
      // All CREATE TABLE / index / other ensure-schema DDL → harmless no-op.
      return { rows: [] };
    },
  } as any;
}

const MASTERY_STAGE_CODE = LIFECYCLE_STAGE_CODES[LIFECYCLE_STAGE_CODES.length - 1];
const MASTERY_CANONICAL = STAGE_CODE_TO_LABEL[MASTERY_STAGE_CODE];

const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const snapshot = (over: Record<string, any> = {}) => ({
  id: 1,
  session_id: '11111111-1111-1111-1111-111111111111',
  concern_name: 'career_clarity',
  stage_code: 'CAP_AWARE',
  canonical_stage: 'Awareness',
  score: 42,
  score_level: 'developing',
  csi_score: null,
  csi_stage: null,
  snapshot: {},
  captured_at: daysAgoIso(10),
  ...over,
});

// ── Mount a minimal report route that mirrors the production wiring: it calls
//    the REAL getReassessmentSignal and spreads `reassessment` into res.json,
//    exactly as backend/routes/capadex.ts does. ────────────────────────────────
function buildApp(pool: any) {
  const app = express();
  app.get('/api/capadex/report/:session_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { session_id } = req.params;
      let reassessment = null;
      try {
        reassessment = await getReassessmentSignal(pool, String(session_id));
      } catch {
        reassessment = null;
      }
      // Legacy fields elided — we assert only the field under test.
      res.json({ reportId: session_id, reassessment });
    } catch (err) {
      next(err);
    }
  });
  return app;
}

async function getReport(server: Server, sessionId: string): Promise<any> {
  const { port } = server.address() as AddressInfo;
  const resp = await fetch(`http://127.0.0.1:${port}/api/capadex/report/${sessionId}`);
  return resp.json();
}

const SID = '11111111-1111-1111-1111-111111111111';

// ── Suite ─────────────────────────────────────────────────────────────────────
console.log('\nGET /api/capadex/report/:session_id — reassessment field on revisit');

test('flag ON: fresh snapshots surface a shaped, not-yet-eligible reassessment signal', async () => {
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1';
  const pool = makeStubPool({ sessionExists: true, snapshots: [snapshot({ captured_at: daysAgoIso(10) })] });
  const server = createServer(buildApp(pool)).listen(0);
  try {
    const body = await getReport(server, SID);
    const r = body.reassessment;
    assert.ok(r && typeof r === 'object', 'reassessment must be present (not null) when flag ON');
    // Shape contract the frontend StageJourneyPanel depends on.
    assert.equal(typeof r.snapshot_count, 'number');
    assert.equal(typeof r.eligible_for_reassessment, 'boolean');
    assert.equal(typeof r.eligible_for_exit, 'boolean');
    assert.equal(typeof r.reached_mastery, 'boolean');
    assert.equal(typeof r.reason, 'string');
    assert.equal(r.snapshot_count, 1);
    assert.equal(r.eligible_for_reassessment, false, 'a 10-day-old snapshot is still fresh');
    assert.equal(r.eligible_for_exit, false, 'no Mastery snapshot → not exit-eligible');
  } finally {
    server.close();
  }
});

test('flag ON: a stale snapshot (>= freshness window) makes re-assessment recommended on revisit', async () => {
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1';
  const stale = snapshot({ captured_at: daysAgoIso(REASSESSMENT_FRESHNESS_DAYS + 5) });
  const pool = makeStubPool({ sessionExists: true, snapshots: [stale] });
  const server = createServer(buildApp(pool)).listen(0);
  try {
    const body = await getReport(server, SID);
    const r = body.reassessment;
    assert.ok(r, 'reassessment present when flag ON');
    assert.equal(r.eligible_for_reassessment, true, 'stale evidence → re-assessment recommended');
    assert.ok((r.age_days ?? 0) >= REASSESSMENT_FRESHNESS_DAYS);
    assert.match(r.reason, /re-assessment is recommended/i);
  } finally {
    server.close();
  }
});

test('flag ON: reaching Mastery surfaces exit-assessment eligibility on revisit', async () => {
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1';
  const mastered = snapshot({
    canonical_stage: MASTERY_CANONICAL,
    stage_code: MASTERY_STAGE_CODE,
    captured_at: daysAgoIso(3),
  });
  const pool = makeStubPool({ sessionExists: true, snapshots: [mastered] });
  const server = createServer(buildApp(pool)).listen(0);
  try {
    const body = await getReport(server, SID);
    const r = body.reassessment;
    assert.ok(r, 'reassessment present when flag ON');
    assert.equal(r.reached_mastery, true);
    assert.equal(r.eligible_for_exit, true, 'Mastery snapshot → eligible for exit assessment');
    assert.match(r.reason, /exit assessment/i);
  } finally {
    server.close();
  }
});

test('flag ON: unknown session resolves to a null reassessment (honest, never fabricated)', async () => {
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1';
  const pool = makeStubPool({ sessionExists: false, snapshots: [] });
  const server = createServer(buildApp(pool)).listen(0);
  try {
    const body = await getReport(server, SID);
    assert.equal(body.reassessment, null, 'no session history → null, not a zeroed object');
  } finally {
    server.close();
  }
});

test('flag OFF: reassessment is null — byte-identical legacy response (no field surfaced)', async () => {
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '0';
  // Even with snapshots present, the OFF path must not surface the signal.
  const pool = makeStubPool({ sessionExists: true, snapshots: [snapshot()] });
  const server = createServer(buildApp(pool)).listen(0);
  try {
    const body = await getReport(server, SID);
    assert.equal(body.reassessment, null, 'flag OFF → reassessment null regardless of accrued evidence');
  } finally {
    server.close();
  }
});

// ── Source-contract checks: the real route + frontend revisit path still thread
//    the field end-to-end (guards against the wiring being deleted). ────────────
console.log('\nEnd-to-end wiring contract (real route + frontend revisit reconstruction)');

test('real GET /api/capadex/report/:session_id route assembles + returns reassessment', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'backend/routes/capadex.ts'), 'utf8');
  const routeIdx = src.indexOf("app.get('/api/capadex/report/:session_id',");
  assert.ok(routeIdx >= 0, 'report route must exist');
  // Scope the search to the report GET handler (up to the next route registration).
  const nextRouteIdx = src.indexOf("app.get('/api/capadex/report/:session_id/pdf'", routeIdx);
  const handler = src.slice(routeIdx, nextRouteIdx > 0 ? nextRouteIdx : routeIdx + 6000);
  assert.match(handler, /getReassessmentSignal\(pool,\s*String\(session_id\)\)/, 'route must call getReassessmentSignal');
  assert.match(handler, /\breassessment\b/, 'route response must include the reassessment field');
});

test('frontend loadCapadexReport (revisit) threads reassessment into report state', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'frontend/src/components/FreeAssessmentModal.tsx'), 'utf8');
  assert.match(src, /reassessment:\s*data\.reassessment\s*\|\|\s*null/, 'loadCapadexReport must reconstruct reassessment from the report response');
});

test('StageJourneyPanel consumes reassessment to render the revisit banner', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'frontend/src/components/assessment/phases/StageJourneyPanel.tsx'), 'utf8');
  assert.match(src, /reassessment\?:\s*ReassessmentSignal\s*\|\s*null/, 'panel must accept a reassessment prop');
  assert.match(src, /reassessment\.eligible_for_exit\s*\|\|\s*reassessment\.eligible_for_reassessment/, 'panel must gate the banner on the eligibility flags');
});

// ── Run ─────────────────────────────────────────────────────────────────────
(async () => {
  for (const t of queue) await t();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
