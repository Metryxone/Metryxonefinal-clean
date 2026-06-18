/**
 * MEI Chain Trigger
 * ─────────────────
 * Fire-and-forget service that runs the full EI intelligence chain after a
 * competency assessment completes. Idempotent (UPSERT), never throws, purely
 * additive.
 *
 * Chain:
 *   resolveProfile → computeMEIScore → persist (mei_scores + mei_score_history)
 *     → computeRecommendations (mei_user_recommendations)
 *     → runUcipPipeline        (ucip_profiles)
 */
import type { Pool } from 'pg';
import { computeMEIScore, mapProfileToMEIInput, ensureMEISchema } from './mei-scoring-engine';
import { computeRecommendations } from './mei-recommendation-engine';
import { runUcipPipeline } from './ucip-builder-pipeline';

let schemaReady = false;
async function bootSchema(pool: Pool) {
  if (!schemaReady) {
    await ensureMEISchema(pool).catch(() => {});
    schemaReady = true;
  }
}

/** Resolve career profile for a userId from career_seeker_profiles. */
async function resolveCareerProfile(pool: Pool, userId: string): Promise<Record<string, unknown> | null> {
  const res = await pool.query(
    `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (res.rows.length === 0) return null;
  const data: Record<string, unknown> = (res.rows[0].data as Record<string, unknown>) ?? {};

  const asmt = await pool.query(
    `SELECT score FROM competency_assessments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as { score: unknown }[] }));
  if (asmt.rows.length > 0) data.assessmentScore = asmt.rows[0].score;

  const cap = await pool.query(
    `SELECT session_data FROM capadex_reports WHERE session_id IN (
       SELECT id FROM capadex_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
     ) LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] as { session_data: Record<string, unknown> }[] }));
  if (cap.rows.length > 0) {
    const sd = (cap.rows[0].session_data as Record<string, unknown>) ?? {};
    data.capadexScore = sd.overallScore ?? sd.score ?? null;
  }

  return data;
}

/**
 * Compute and persist MEI score for a user. Returns the composite score or
 * null if the user has no career profile.
 */
async function computeAndPersistMEI(
  pool: Pool,
  userId: string
): Promise<{ composite_score: number; band: string; output: Record<string, unknown> } | null> {
  const profile = await resolveCareerProfile(pool, userId);
  if (!profile) return null;

  const input = mapProfileToMEIInput(profile, {
    industryCode: (profile.targetIndustry as string) ?? null,
    roleLevelCode: null,
  });
  const output = await computeMEIScore(pool, input);

  await pool.query(
    `INSERT INTO mei_scores
       (user_id, composite_score, band, confidence, industry_code, role_level_code,
        breakdown, calibration_trace, data_sources, computed_at, version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),'2.0')
     ON CONFLICT (user_id) DO UPDATE SET
       composite_score=$2, band=$3, confidence=$4, industry_code=$5,
       role_level_code=$6, breakdown=$7, calibration_trace=$8,
       data_sources=$9, computed_at=NOW()`,
    [
      userId, output.composite_score, output.band, output.confidence,
      output.industry_code, output.role_level_code,
      JSON.stringify({ dimensions: output.dimensions }),
      JSON.stringify(output.calibration_trace ?? {}),
      output.data_sources ?? [],
    ]
  );

  await pool.query(
    `INSERT INTO mei_score_history
       (user_id,composite_score,band,confidence,industry_code,role_level_code,
        breakdown,snapshot_trigger,version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'post_assessment','2.0')`,
    [
      userId, output.composite_score, output.band, output.confidence,
      output.industry_code, output.role_level_code,
      JSON.stringify({ dimensions: output.dimensions }),
    ]
  );

  return { composite_score: output.composite_score, band: output.band, output: output as unknown as Record<string, unknown> };
}

/**
 * Trigger the full EI intelligence chain for a user.
 * Fire-and-forget: never throws, every stage independently fault-tolerant.
 *
 * Stages:
 *   1. MEI score compute + persist
 *   2. Recommendation generation
 *   3. UCIP profile rebuild
 */
export async function triggerMEIChain(pool: Pool, userId: string): Promise<void> {
  if (!userId || !userId.trim()) return;

  try {
    await bootSchema(pool);

    const result = await computeAndPersistMEI(pool, userId);
    if (!result) {
      return;
    }

    const scoreOutput = result.output as Parameters<typeof computeRecommendations>[2];
    computeRecommendations(pool, userId, scoreOutput)
      .catch((e: Error) => console.warn('[mei-chain] recs failed:', e.message));

    runUcipPipeline(pool, userId, 'rebuild')
      .catch((e: Error) => console.warn('[mei-chain] ucip failed:', e.message));

  } catch (err) {
    console.warn('[mei-chain] trigger failed for user', userId, (err as Error).message);
  }
}

/**
 * Backfill MEI chain for a batch of userIds.
 * Chunked, resumable, observable.
 */
export async function backfillMEIChain(
  pool: Pool,
  userIds: string[],
  opts: { chunkSize?: number; onProgress?: (done: number, total: number, userId: string, ok: boolean) => void } = {}
): Promise<{ ok: number; skipped: number; failed: number }> {
  const { chunkSize = 5, onProgress } = opts;
  let ok = 0; let skipped = 0; let failed = 0;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (uid) => {
        try {
          await bootSchema(pool);
          const result = await computeAndPersistMEI(pool, uid);
          if (!result) { skipped++; onProgress?.(ok + skipped + failed, userIds.length, uid, false); return; }

          const scoreOutput = result.output as Parameters<typeof computeRecommendations>[2];
          await computeRecommendations(pool, uid, scoreOutput).catch(() => {});
          await runUcipPipeline(pool, uid, 'rebuild').catch(() => {});
          ok++;
          onProgress?.(ok + skipped + failed, userIds.length, uid, true);
        } catch (e) {
          failed++;
          onProgress?.(ok + skipped + failed, userIds.length, uid, false);
          console.warn('[mei-backfill] user', uid, (e as Error).message);
        }
      })
    );
  }
  return { ok, skipped, failed };
}
