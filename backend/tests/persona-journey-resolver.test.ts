/**
 * Task #361 — Persona Journey Router (Phase 3.2A) Step-5 resolver regression guard.
 *
 * The wizard's Step 5 ("Your intelligent journey") calls GET /api/persona-journey/route and shows
 * an amber "we couldn't map a journey" fallback whenever the backend returns `resolved:false`. This
 * test proves the DETERMINISTIC resolver actually returns a resolved journey — with a real label and
 * lifecycle stages — for real (legacyKey, persona, ageBand, goal) selections, so a resolver
 * regression (renamed journey key, dropped mapping, broken registry compose) fails loudly here
 * instead of silently degrading every user to the honest fallback.
 *
 * It also locks the HONEST not-resolved path for an unmapped selection, so the fallback stays
 * intentional (a B2B/admin/unknown persona) and not the accidental result of a broken resolver.
 *
 * Pure, DB-free: the resolver reads no tables (it composes static registries). The router flag is
 * forced ON in-process BEFORE importing the route module — the shared workflow env is never touched.
 *
 * Run with:  cd backend && npx tsx --test tests/persona-journey-resolver.test.ts
 */
process.env.FF_PERSONA_JOURNEY_ROUTER = '1';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import type { Server } from 'http';

import { registerPersonaJourneyRoutes } from '../routes/persona-journey';

let server: Server;

before(async () => {
  const app = express();
  registerPersonaJourneyRoutes(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Issue a GET against the in-process server and parse the JSON body. */
function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: d ? JSON.parse(d) : null }));
      })
      .on('error', reject);
  });
}

/** Assert a route response is a fully-resolved journey with a label + traversable lifecycle stages. */
function assertResolvedJourney(body: any, expectedJourneyKey: string) {
  assert.equal(body.ok, true, 'response ok');
  assert.equal(body.resolved, true, 'journey resolved (not the amber fallback)');
  assert.ok(body.journey, 'journey object present');
  assert.equal(body.journey.key, expectedJourneyKey, `journey key is ${expectedJourneyKey}`);
  assert.ok(
    typeof body.journey.label === 'string' && body.journey.label.length > 0,
    'journey has a non-empty label',
  );
  assert.ok(body.lifecycle, 'lifecycle block present');
  assert.ok(Array.isArray(body.lifecycle.stages), 'lifecycle.stages is an array');
  assert.ok(body.lifecycle.stages.length > 0, 'lifecycle has at least one traversed stage');
  for (const s of body.lifecycle.stages) {
    assert.ok(typeof s.code === 'string' && s.code.length > 0, 'stage has a code');
    assert.ok(typeof s.label === 'string' && s.label.length > 0, 'stage has a label');
  }
  assert.ok(body.lifecycle.entryStage, 'lifecycle has an entry stage');
  assert.ok(Array.isArray(body.assessments), 'assessments is an array');
}

test('flag ON: /enabled probe reports enabled', async () => {
  const r = await get('/api/persona-journey/enabled');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.enabled, true);
});

test('student selection resolves to the student_career journey with lifecycle stages', async () => {
  const r = await get(
    '/api/persona-journey/route?legacyKey=student&persona=campus_student&ageBand=17-24&goal=career&timeline=short',
  );
  assert.equal(r.status, 200);
  assertResolvedJourney(r.body, 'student_career');
});

test('professional selection resolves to the professional_progression journey with lifecycle stages', async () => {
  const r = await get(
    '/api/persona-journey/route?legacyKey=professional&persona=people_manager&ageBand=24-45&goal=growth&timeline=medium',
  );
  assert.equal(r.status, 200);
  assertResolvedJourney(r.body, 'professional_progression');
});

test('proxy (parent) selection resolves to the parent_support journey with lifecycle stages', async () => {
  const r = await get('/api/persona-journey/route?legacyKey=parent&persona=parent&ageBand=6-14');
  assert.equal(r.status, 200);
  assertResolvedJourney(r.body, 'parent_support');
});

test('legacyKey-only fallback (no sub-persona) still resolves a journey', async () => {
  // The wizard may emit only a legacyKey when a sub-persona is not selected; the resolver must
  // fall back to LEGACY_KEY_TO_JOURNEY rather than degrade to the amber fallback.
  const r = await get('/api/persona-journey/route?legacyKey=jobseeker&ageBand=17-24');
  assert.equal(r.status, 200);
  assertResolvedJourney(r.body, 'fresher_placement');
});

test('unmapped (B2B/admin/unknown) selection honestly returns resolved:false — the fallback stays intentional', async () => {
  const r = await get('/api/persona-journey/route?legacyKey=&persona=unknown_admin&ageBand=');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.resolved, false, 'unmapped persona is honestly not resolved');
  assert.equal(r.body.reason, 'no_assessment_journey', 'honest reason surfaced');
  assert.ok(!r.body.journey, 'no fabricated journey for an unmapped persona');
});
