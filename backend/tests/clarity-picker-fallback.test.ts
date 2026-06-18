/**
 * Clarity-question 3-tier fallback chain — integration verification
 *
 * Verifies that the source labelling and cascade order documented in
 * `capadex-concern-intelligence.ts` holds:
 *
 *   Tier 1: Master Curated (bridge tag join)  → clarity_source = 'master_curated'
 *   Tier 2: Adaptive Question Bank            → clarity_source = 'adaptive_bank'
 *   Tier 3: Static Fallback                   → clarity_source = 'static_fallback'
 *
 * We exercise the public `POST /api/capadex/concern/analyze` route in-process
 * and assert that `clarity_source` is one of the documented values and that
 * at least one clarification question always ships (CAPADEX invariant: the
 * assessment never 404s and never freezes on an empty clarify phase).
 *
 * Run with:  npx tsx backend/tests/clarity-picker-fallback.test.ts
 *
 * Requires a live DATABASE_URL — gracefully skips if missing.
 */

import assert from 'node:assert/strict';
import express from 'express';
import { Pool } from 'pg';
import { classifyBridgeTagRoute } from '../services/bridge-tag-resolver';

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    if (err instanceof Error && err.message === '__SKIP__') {
      console.log(`  ⊝  ${label} (skipped)`);
      skipped++;
      return;
    }
    console.error(`  ✗  ${label}`);
    console.error(err);
    failed++;
  }
}

const PORT = 9787;

async function bootApp(): Promise<{ pool: Pool; close: () => Promise<void>; url: string }> {
  if (!process.env.DATABASE_URL) throw new Error('__SKIP__');
  const realPool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Read-only guard: any INSERT/UPDATE/DELETE issued by the route layer
  // (e.g. persistRuntimeContext → capadex_runtime_sessions) is short-circuited
  // to an empty result so test runs never pollute a live DB.
  const pool = new Proxy(realPool, {
    get(target, prop, recv) {
      if (prop === 'query') {
        return (sql: unknown, params?: unknown) => {
          const text = typeof sql === 'string' ? sql : (sql as { text?: string })?.text ?? '';
          if (/^\s*(insert|update|delete|truncate)\s/i.test(text)) {
            return Promise.resolve({ rows: [], rowCount: 0 });
          }
          return (target.query as (s: unknown, p?: unknown) => Promise<unknown>).call(target, sql, params);
        };
      }
      return Reflect.get(target, prop, recv);
    },
  }) as Pool;
  const app = express();
  app.use(express.json());
  const { registerConcernIntelligenceRoutes } = await import('../routes/capadex-concern-intelligence');
  registerConcernIntelligenceRoutes(app, pool);
  return new Promise((resolve, reject) => {
    const srv = app.listen(PORT, () => resolve({
      pool,
      url: `http://localhost:${PORT}`,
      close: () => new Promise<void>((res) => srv.close(() => pool.end().then(() => res()).catch(() => res()))),
    }));
    srv.on('error', reject);
  });
}

console.log('\n── Clarity-question 3-tier cascade ─────────────────────────────────────');

void (async () => {
  // Resolver regression (DB-independent): the orphan bridge tag
  // LEARNING_INTERVENTION (sole concern "Poor concentration during classes")
  // must route to DISCIPLINE_HABITS via the hand-verified override — NOT fall to
  // the greedy /LEARNING|LEARNER/ keyword rule that maps it to the adult
  // career-adaptability bucket LEARNING_ADAPTABILITY. Regression guard for the
  // "10-year-old got career questions" bug.
  await test('Resolver — LEARNING_INTERVENTION overrides to DISCIPLINE_HABITS (not career bucket)', async () => {
    const r = classifyBridgeTagRoute('LEARNING_INTERVENTION');
    assert.equal(r.target, 'DISCIPLINE_HABITS', `expected DISCIPLINE_HABITS, got ${r.target}`);
    assert.equal(r.route, 'override', `expected override route, got ${r.route}`);
    assert.notEqual(r.target, 'LEARNING_ADAPTABILITY', 'must NOT route to the adult career-adaptability bucket');
  });

  let ctx: { pool: Pool; close: () => Promise<void>; url: string } | null = null;
  try {
    try {
      ctx = await bootApp();
    } catch (err) {
      if (err instanceof Error && err.message === '__SKIP__') {
        console.log('  ⊝  DATABASE_URL missing — skipping live-DB tier tests');
        skipped += 3;
        console.log(`\n  Result: ${passed} passed, ${failed} failed, ${skipped} skipped`);
        return;
      }
      throw err;
    }

    const { url } = ctx;

    const post = (body: Record<string, unknown>) => fetch(`${url}/api/capadex/concern/analyze`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const envelope = (text: string, extras: Record<string, unknown> = {}) => ({
      raw_concern_text: text,
      primary_persona: 'mid_career_professional',
      is_proxy: false,
      target_age_band: '24-45',
      assessee_name: 'Test User',
      contextual_anchor: 'unit-test',
      persona: 'professional',
      age: 32,
      ...extras,
    });

    await test('Tier 1 — seeded master concern_id MUST resolve to master_curated', async () => {
      // CONCERN_ACA_1019 has 975 curated clarity rows joined via bridge tag —
      // the master tier MUST fire. Anything else is a cascade regression.
      const res = await post(envelope('academic stress', { concern_id: 'CONCERN_ACA_1019' }));
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.equal(j.clarity_source, 'master_curated', `expected master_curated, got ${j.clarity_source}`);
      assert.ok(j.clarification_questions.length >= 2, `master tier must ship ≥2 questions, got ${j.clarification_questions.length}`);
      // Master-tier ids are prefixed `mcq_` by pickQuestionsFromMaster.
      assert.ok(j.clarification_questions.every((q: { id: string }) => /^mcq_/.test(q.id)),
        `master ids must start with mcq_, got ${j.clarification_questions.map((q: {id:string}) => q.id).join(',')}`);
    });

    await test('Tier 1 → Tier 2/3 — bogus concern_id falls through to lower tier', async () => {
      const res = await post(envelope('work stress', { concern_id: 'CONCERN_DOES_NOT_EXIST_999999' }));
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.notEqual(j.clarity_source, 'master_curated', 'unknown id must NOT be labelled master_curated');
      assert.ok(['adaptive_bank', 'static_fallback'].includes(j.clarity_source),
        `expected fallthrough, got ${j.clarity_source}`);
      assert.ok(j.clarification_questions.length > 0, 'fallback tiers must always populate questions');
    });

    await test('Tier 3 — truly unknown free text still ships questions (CAPADEX never-empty invariant)', async () => {
      const res = await post(envelope('zzz_xyz_no_such_concern_phrase'));
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.ok(j.clarification_questions.length > 0, 'static fallback must populate questions');
      assert.ok(['adaptive_bank', 'static_fallback', 'master_curated'].includes(j.clarity_source));
    });

    await test('Child focus concern (CONCERN_ACA_1348, age 6-14, proxy) must NOT serve adult career questions', async () => {
      // Regression for the reported bug: a 10-year-old's "classroom focus"
      // concern leaked adult career/industry clarity questions because the
      // orphan tag LEARNING_INTERVENTION remapped to LEARNING_ADAPTABILITY.
      const res = await post({
        raw_concern_text: 'classroom focus',
        primary_persona: 'parent',
        is_proxy: true,
        target_age_band: '6-14',
        assessee_name: 'Abhi',
        contextual_anchor: 'school',
        concern_id: 'CONCERN_ACA_1348',
        age: 10,
      });
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.ok(j.clarification_questions.length >= 2, `expected ≥2 questions, got ${j.clarification_questions.length}`);
      const adult = /career|industry|professional|workplace|institution(al)?|employ|placement|corporate/i;
      const leaked = j.clarification_questions.filter((q: { question: string }) => adult.test(q.question));
      assert.equal(leaked.length, 0,
        `child concern must not serve adult career/industry questions, leaked: ${leaked.map((q: {question:string}) => q.question).join(' | ')}`);
    });

    await test('clarity_source value is always one of the documented enum values', async () => {
      const cases = [
        envelope('exam stress', { age: 17, target_age_band: '14-17', primary_persona: 'campus_student', persona: 'student' }),
        envelope('burnout at work', { age: 35 }),
        envelope('something vague', { age: 25 }),
      ];
      for (const c of cases) {
        const res = await post(c);
        const j = await res.json();
        assert.ok(['master_curated', 'adaptive_bank', 'static_fallback'].includes(j.clarity_source),
          `case ${JSON.stringify(c)} → source=${j.clarity_source}`);
      }
    });
  } finally {
    if (ctx) await ctx.close();
  }

  console.log(`\n  Result: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
})();
