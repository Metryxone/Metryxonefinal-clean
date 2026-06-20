/**
 * Smoke test — Phase 4.7 Career Recommendation engine.
 *
 * Proves the additive / honesty / GET-never-writes contracts WITHOUT the HTTP
 * layer (route gating is verified separately via curl). Run:
 *
 *   cd backend && npx tsx scripts/smoke-career-recommendation.ts
 *
 * Checks:
 *  1. buildCareerRecommendations never-throws for a non-existent subject → honest
 *     empty/market-only envelope (ok=true).
 *  2. Exactly the 6 canonical groups, in canonical order.
 *  3. Honesty: every market-only item (personalized=false) is 'Provisional';
 *     personalized_count + market_only_count === total_recommendations; by_type sums.
 *  4. GET-never-writes: a build creates NONE of the 3 career_recommendation_* tables
 *     (probed via to_regclass before/after) and reads config from 'defaults'.
 *  5. Seed path (admin POST) creates the schema + inserts inline defaults; config
 *     then reads from 'db'.
 *  6. History is append-only via the explicit snapshot path only.
 *  7. Cleanup restores a pristine (defaults-source) dev DB.
 */
import { Pool } from 'pg';
import {
  buildCareerRecommendations,
  loadLibrary,
  loadRules,
  seedCareerRecommendationConfig,
  persistCareerRecommendationSnapshot,
  listCareerRecommendationHistory,
  RECOMMENDATION_TYPE_ORDER,
  DEFAULT_RECOMMENDATION_LIBRARY,
  DEFAULT_RECOMMENDATION_RULES,
} from '../services/career-recommendation-aggregator';

const REC_TABLES = [
  'career_recommendation_library',
  'career_recommendation_rules',
  'career_recommendation_history',
];

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

async function regclass(pool: Pool, name: string): Promise<boolean> {
  const r = await pool
    .query(`SELECT to_regclass($1) AS t`, [`public.${name}`])
    .catch(() => ({ rows: [{ t: null }] as Array<{ t: string | null }> }));
  return Boolean(r.rows[0]?.t);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const subject = `smoke-rec-${Date.now()}`;

  try {
    // --- Baseline: drop the 3 tables so GET-never-writes is meaningful --------
    for (const t of REC_TABLES) {
      await pool.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    const beforeExist = await Promise.all(REC_TABLES.map((t) => regclass(pool, t)));
    ok(beforeExist.every((e) => e === false), 'baseline: 3 rec tables absent', beforeExist);

    // --- 1/2/3: never-throws + groups + honesty (read path) ------------------
    const env = await buildCareerRecommendations(pool, subject);
    ok(env.ok === true, 'build never-throws (ok=true) for non-existent subject');
    ok(env.subject_id === subject, 'subject echoed');

    const order = env.groups.map((g) => g.rec_type);
    ok(
      order.length === RECOMMENDATION_TYPE_ORDER.length &&
        order.every((t, i) => t === RECOMMENDATION_TYPE_ORDER[i]),
      'exactly the 6 canonical groups in canonical order',
      order,
    );

    const items = env.groups.flatMap((g) => g.items);
    const marketOnly = items.filter((i) => !i.personalized);
    ok(
      marketOnly.every((i) => i.confidence_band === 'Provisional'),
      'every market-only item is Provisional (honesty: not personalized)',
      marketOnly.map((i) => i.confidence_band),
    );
    ok(
      env.summary.personalized_count + env.summary.market_only_count ===
        env.summary.total_recommendations,
      'personalized + market_only === total',
      env.summary,
    );
    const byTypeSum = Object.values(env.summary.by_type).reduce((a, b) => a + b, 0);
    ok(byTypeSum === env.summary.total_recommendations, 'by_type sums to total', {
      byTypeSum,
      total: env.summary.total_recommendations,
    });
    ok(items.length === env.summary.total_recommendations, 'item count === total', {
      items: items.length,
      total: env.summary.total_recommendations,
    });

    // --- 3b: per-rec_type personalization/confidence honesty invariants ------
    // Market-only types NEVER consume the subject's profile in their content, so
    // every item MUST be non-personalized + Provisional. role/career are the only
    // genuinely-personalized types, and role's personalization must match the
    // disclosed evidence (same_function_as_anchor) — a claim it cannot make falsely.
    const MARKET_ONLY_TYPES = ['industry', 'function', 'future_role', 'alternative_career'];
    const marketTypeItems = items.filter((i) => MARKET_ONLY_TYPES.includes(i.rec_type));
    ok(
      marketTypeItems.every((i) => i.personalized === false && i.confidence_band === 'Provisional'),
      'market-only types (industry/function/future_role/alternative_career) are always non-personalized + Provisional',
      marketTypeItems.map((i) => ({ t: i.rec_type, p: i.personalized, c: i.confidence_band })),
    );
    const roleItems = items.filter((i) => i.rec_type === 'role');
    ok(
      roleItems.every(
        (i) =>
          i.personalized === Boolean((i.evidence as Record<string, unknown>)?.same_function_as_anchor) &&
          i.confidence_band === (i.personalized ? i.confidence_band : 'Provisional') &&
          (i.personalized || i.confidence_band === 'Provisional'),
      ),
      'role personalization matches disclosed anchor evidence; non-personalized role items are Provisional',
      roleItems.map((i) => ({ p: i.personalized, c: i.confidence_band, a: (i.evidence as Record<string, unknown>)?.same_function_as_anchor })),
    );
    const careerItems = items.filter((i) => i.rec_type === 'career');
    ok(
      careerItems.every((i) => i.personalized === true),
      'career recs are always personalized (consume measured readiness; honest-empty otherwise)',
      careerItems.map((i) => i.personalized),
    );

    // --- 4: GET-never-writes — build created NONE of the 3 tables -------------
    const afterExist = await Promise.all(REC_TABLES.map((t) => regclass(pool, t)));
    ok(afterExist.every((e) => e === false), 'GET-never-writes: build created no rec tables', afterExist);
    ok(
      env.config.library_source === 'defaults' && env.config.rules_source === 'defaults',
      'config reads from inline defaults (no DDL on read)',
      env.config,
    );

    // --- 5: seed path (admin POST) creates schema + inserts defaults ----------
    const seeded = await seedCareerRecommendationConfig(pool);
    ok(
      seeded.library === DEFAULT_RECOMMENDATION_LIBRARY.length &&
        seeded.rules === DEFAULT_RECOMMENDATION_RULES.length,
      'seed inserted all inline defaults',
      seeded,
    );
    const seededExist = await Promise.all(REC_TABLES.map((t) => regclass(pool, t)));
    ok(seededExist.every((e) => e === true), 'seed (POST) created all 3 tables', seededExist);

    const lib = await loadLibrary(pool);
    const rules = await loadRules(pool);
    ok(lib.source === 'db' && lib.library.length === DEFAULT_RECOMMENDATION_LIBRARY.length, 'library now reads from db', {
      source: lib.source,
      n: lib.library.length,
    });
    ok(rules.source === 'db' && rules.rules.length === DEFAULT_RECOMMENDATION_RULES.length, 'rules now reads from db', {
      source: rules.source,
      n: rules.rules.length,
    });

    const env2 = await buildCareerRecommendations(pool, subject);
    ok(
      env2.config.library_source === 'db' && env2.config.rules_source === 'db',
      'build consumes db config after seed',
      env2.config,
    );

    // --- 6: history is append-only via the explicit snapshot path -------------
    const h0 = await listCareerRecommendationHistory(pool, subject);
    ok(h0.exists === true && h0.count === 0, 'history table exists, empty for subject', h0);
    await persistCareerRecommendationSnapshot(pool, env2);
    const h1 = await listCareerRecommendationHistory(pool, subject);
    ok(h1.count === 1, 'snapshot appended (count=1)', h1.count);
    await persistCareerRecommendationSnapshot(pool, env2);
    const h2 = await listCareerRecommendationHistory(pool, subject);
    ok(h2.count === 2, 'append-only: second snapshot does not overwrite (count=2)', h2.count);

    // --- 7: cleanup — restore pristine (defaults-source) dev DB ---------------
    for (const t of REC_TABLES) {
      await pool.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    const cleaned = await Promise.all(REC_TABLES.map((t) => regclass(pool, t)));
    ok(cleaned.every((e) => e === false), 'cleanup: rec tables dropped (dev DB pristine)', cleaned);
  } finally {
    await pool.end();
  }

  console.log(`\nSmoke result: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Smoke crashed:', e);
  process.exit(1);
});
