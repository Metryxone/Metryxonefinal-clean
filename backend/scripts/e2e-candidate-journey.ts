/**
 * e2e-candidate-journey.ts — end-to-end candidate-journey validation.
 *
 * Run: npx tsx backend/scripts/e2e-candidate-journey.ts [subjectId]
 *
 * Drives ONE subject through all 12 journey stages IN-PROCESS (the same engine
 * functions the super-admin HTTP routes call), then PROVES persistence with a
 * strict before/after row-count DELTA per persistable stage — i.e. THIS run
 * inserted a row, not merely "a row exists" (which pre-existing data could mask).
 *
 * Honesty-first: a stage that is structurally wired but has no measurable input
 * for this subject reports generated=true, measurable=false (NOT a failure, NOT
 * fabricated). A persistable stage that throws is recorded persisted=false (it
 * is NOT silently dropped from the denominator). The process exits non-zero on
 * any generation or persistence failure so automation cannot read a false PASS.
 *
 * This script EXERCISES write paths (persist*), so it is NOT read-only; it is an
 * integration test of the engine + persistence layer and runs only against an
 * explicitly demo subject. Route-level auth/flag gating is validated separately
 * per phase (flag-OFF 503 / flag-ON 401) and is intentionally out of scope here.
 */
import { Pool } from 'pg';

import { getProfile } from '../services/competency-runtime.js';
import { buildEiProfile } from '../services/ei-profile-engine.js';
import {
  buildCareerMatch,
  persistCareerMatchSnapshot,
  listCareerMatchHistory,
} from '../services/career-match-engine.js';
import {
  buildCareerReadiness,
  persistCareerReadinessSnapshot,
  listCareerReadinessHistory,
} from '../services/career-readiness-aggregator.js';
import {
  buildCareerGap,
  persistCareerGapSnapshot,
  listCareerGapHistory,
} from '../services/career-gap-engine.js';
import {
  buildCareerRoadmap,
  persistCareerRoadmapSnapshot,
  listCareerRoadmapHistory,
} from '../services/career-roadmap-engine.js';
import {
  buildCareerDevelopment,
  persistCareerDevelopmentSnapshot,
  listCareerDevelopmentHistory,
} from '../services/career-development-engine.js';
import {
  generateCareerPassport,
  persistPassportSnapshot,
  listPassportHistory,
} from '../services/passport-generator.js';
import { buildCareerSignals } from '../services/career-signal-engine.js';
import {
  persistCareerProgressionSnapshot,
  buildCareerProgression,
  listGrowthTracking,
  listCareerHistory,
} from '../services/career-progression-engine.js';

interface StageResult {
  n: number;
  stage: string;
  generated: boolean;
  measurable: boolean | 'n/a';
  persisted: boolean | 'n/a';
  detail: string;
}

function pickMeasurable(env: any): boolean | 'n/a' {
  if (env == null) return 'n/a';
  if (typeof env.measurable === 'boolean') return env.measurable;
  if (env._meta && typeof env._meta.measurable === 'boolean') return env._meta.measurable;
  if (env.coverage && typeof env.coverage.measurable === 'boolean') return env.coverage.measurable;
  return 'n/a';
}

async function readCount(fn: (pool: Pool, sid: string) => Promise<any>, pool: Pool, sid: string): Promise<number> {
  try {
    const r = await fn(pool, sid);
    if (r == null) return 0;
    if (typeof r.count === 'number') return r.count;
    if (Array.isArray(r.items)) return r.items.length;
    if (Array.isArray(r)) return r.length;
    return 0;
  } catch {
    return 0;
  }
}

async function main() {
  const subjectId = process.argv[2] ?? 'demo_subj_pm';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const results: StageResult[] = [];

  // persistable=true marks a stage that MUST insert a row this run; on error it
  // is recorded persisted=false (never silently excluded from the denominator).
  const run = async (
    n: number,
    stage: string,
    persistable: boolean,
    fn: () => Promise<{ generated: boolean; measurable: boolean | 'n/a'; persisted: boolean | 'n/a'; detail: string }>,
  ) => {
    try {
      const r = await fn();
      results.push({ n, stage, ...r });
    } catch (e: any) {
      results.push({
        n,
        stage,
        generated: false,
        measurable: 'n/a',
        persisted: persistable ? false : 'n/a',
        detail: `ERROR: ${String(e?.message ?? e).slice(0, 160)}`,
      });
    }
  };

  try {
    // 1. Candidate completes assessment (competency data must already exist)
    await run(1, 'Assessment completed', false, async () => {
      const prof: any = await getProfile(pool, subjectId);
      const has = !!prof && prof.measured === true;
      return {
        generated: has,
        measurable: has,
        persisted: 'n/a',
        detail: has
          ? `scored profiles=${prof.history_count}, overall_score=${prof.overall_score ?? 'null'}`
          : 'no scored assessment for subject',
      };
    });

    // 2. Competency profile generated
    await run(2, 'Competency profile', false, async () => {
      const prof: any = await getProfile(pool, subjectId);
      return {
        generated: !!prof,
        measurable: prof?.measured ?? false,
        persisted: 'n/a',
        detail: prof
          ? `overall_score=${prof.overall_score ?? 'null'}, domain_scores=${(prof.domain_scores ?? []).length}, measurement=${prof.measurement}`
          : 'absent',
      };
    });

    // 3. EI profile generated
    await run(3, 'EI profile', false, async () => {
      const ei: any = await buildEiProfile(pool, subjectId);
      const overall = ei?.overall?.score ?? ei?.overall?.value ?? ei?.overall_ei ?? ei?.score ?? 'n/a';
      return {
        generated: !!ei,
        measurable: pickMeasurable(ei),
        persisted: 'n/a',
        detail: ei ? `overall=${typeof overall === 'object' ? JSON.stringify(overall).slice(0, 60) : overall}` : 'absent',
      };
    });

    // 4. Career matches generated + persisted (before/after delta proof)
    await run(4, 'Career matches', true, async () => {
      const before = await readCount(listCareerMatchHistory as any, pool, subjectId);
      const env = await buildCareerMatch(pool, subjectId);
      await persistCareerMatchSnapshot(pool, env as any);
      const after = await readCount(listCareerMatchHistory as any, pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: after > before,
        detail: `matches=${(env as any)?.matches?.length ?? (env as any)?.roles?.length ?? 0}, history_rows ${before}→${after}`,
      };
    });

    // 5. Career readiness generated + persisted
    await run(5, 'Career readiness', true, async () => {
      const before = await readCount(listCareerReadinessHistory as any, pool, subjectId);
      const env = await buildCareerReadiness(pool, subjectId);
      await persistCareerReadinessSnapshot(pool, env as any);
      const after = await readCount(listCareerReadinessHistory as any, pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: after > before,
        detail: `overall=${(env as any)?.overall?.score ?? (env as any)?.overall ?? 'n/a'}, history_rows ${before}→${after}`,
      };
    });

    // 6. Career gaps generated + persisted
    await run(6, 'Career gaps', true, async () => {
      const before = await readCount(listCareerGapHistory as any, pool, subjectId);
      const env = await buildCareerGap(pool, subjectId);
      await persistCareerGapSnapshot(pool, env as any);
      const after = await readCount(listCareerGapHistory as any, pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: after > before,
        detail: `gaps=${(env as any)?.gaps?.length ?? 0}, history_rows ${before}→${after}`,
      };
    });

    // 7. Career roadmap generated + persisted
    await run(7, 'Career roadmap', true, async () => {
      const before = await readCount(listCareerRoadmapHistory as any, pool, subjectId);
      const env = await buildCareerRoadmap(pool, subjectId);
      await persistCareerRoadmapSnapshot(pool, env as any);
      const after = await readCount(listCareerRoadmapHistory as any, pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: after > before,
        detail: `phases=${(env as any)?.phases?.length ?? 0}, history_rows ${before}→${after}`,
      };
    });

    // 8. Development plan generated + persisted
    await run(8, 'Development plan', true, async () => {
      const before = await readCount(listCareerDevelopmentHistory as any, pool, subjectId);
      const env = await buildCareerDevelopment(pool, subjectId);
      await persistCareerDevelopmentSnapshot(pool, env as any);
      const after = await readCount(listCareerDevelopmentHistory as any, pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: after > before,
        detail: `streams=${(env as any)?.streams?.length ?? 0}, history_rows ${before}→${after}`,
      };
    });

    // 9. Career passport generated + persisted
    await run(9, 'Career passport', true, async () => {
      const before = await readCount(listPassportHistory as any, pool, subjectId);
      const profile = await generateCareerPassport(pool, subjectId);
      await persistPassportSnapshot(pool, profile as any);
      const after = await readCount(listPassportHistory as any, pool, subjectId);
      return {
        generated: !!profile,
        measurable: (profile as any)?.measurable ?? 'n/a',
        persisted: after > before,
        detail: `sections=${(profile as any)?.coverage?.sections_present}/${(profile as any)?.coverage?.sections_total}, history_rows ${before}→${after}`,
      };
    });

    // 10. Signals generated (config-as-data: no per-subject persist row)
    await run(10, 'Signals', false, async () => {
      const env = await buildCareerSignals(pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: 'n/a',
        detail: `signals=${(env as any)?.signals?.length ?? 0} (config-as-data, no per-subject row)`,
      };
    });

    // 11. Progress tracking enabled — proven by a growth_tracking row INCREMENT
    //     this run. career_history is event-only (appends a row ONLY when the
    //     readiness band / anchor role CHANGES between snapshots), so it can be
    //     legitimately 0 for two identical snapshots — reported, never forced.
    await run(11, 'Progress tracking', true, async () => {
      const growthBefore = await readCount(listGrowthTracking as any, pool, subjectId);
      await persistCareerProgressionSnapshot(pool, subjectId);
      const growthAfter = await readCount(listGrowthTracking as any, pool, subjectId);
      const env = await buildCareerProgression(pool, subjectId);
      const hist = await readCount(listCareerHistory as any, pool, subjectId);
      return {
        generated: !!env,
        measurable: pickMeasurable(env),
        persisted: growthAfter > growthBefore,
        detail: `growth_tracking_rows ${growthBefore}→${growthAfter}, career_history_rows=${hist} (event-only)`,
      };
    });

    // 12. All data persisted — every persistable stage inserted a row this run
    await run(12, 'All data persisted', false, async () => {
      const persistable = results.filter((r) => r.persisted !== 'n/a');
      const ok = persistable.filter((r) => r.persisted === true).length;
      return {
        generated: true,
        measurable: 'n/a',
        persisted: persistable.length > 0 && ok === persistable.length,
        detail: `${ok}/${persistable.length} persistable stages inserted ≥1 row this run`,
      };
    });

    // ---- Report ----
    console.log('='.repeat(82));
    console.log(`CANDIDATE JOURNEY E2E  subject=${subjectId}`);
    console.log('='.repeat(82));
    for (const r of results) {
      const gen = r.generated ? 'GEN✓' : 'GEN✗';
      const meas = r.measurable === 'n/a' ? 'meas=n/a' : r.measurable ? 'meas✓' : 'meas-empty';
      const pers = r.persisted === 'n/a' ? 'persist=n/a' : r.persisted ? 'persist✓' : 'persist✗';
      console.log(`${String(r.n).padStart(2)}. ${r.stage.padEnd(22)} ${gen.padEnd(5)} ${meas.padEnd(11)} ${pers.padEnd(11)} — ${r.detail}`);
    }
    console.log('='.repeat(82));
    const genFail = results.filter((r) => !r.generated).length;
    const persFail = results.filter((r) => r.persisted === false).length;
    console.log(`SUMMARY: stages=${results.length}  generation_failures=${genFail}  persistence_failures=${persFail}`);
    if (genFail > 0 || persFail > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
