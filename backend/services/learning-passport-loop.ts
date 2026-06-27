/**
 * MX-302G — Learning Intelligence ↔ Career Passport loop.
 *
 * The ONE genuinely-new feature of MX-302G: completing a learning/development
 * activity automatically refreshes the Career Passport, replacing the manual
 * "Sync" click. It reuses the EXISTING sync bridge (`syncPassportFromPlatform`)
 * and additionally records the completed activity in the passport's learning
 * history.
 *
 * Flag-gated by `learningPassportLoop` (default OFF):
 *   - `emitLearningActivityCompleted` is a NO-OP when OFF — no event row, no sync —
 *     so completion code paths are byte-identical legacy.
 *   - the bus listener (registered once at startup) and every worker re-check the
 *     flag and no-op when OFF (defence in depth).
 *   - NOTHING in this module runs when the flag is OFF, so the shared `cp_*`
 *     schema and the manual `/api/passport/sync` are untouched (byte-identical).
 *
 * Idempotency: the shared bridge currently lacks unique constraints, so its
 * `ON CONFLICT DO NOTHING` inserts are no-ops and a naive re-sync would DUPLICATE
 * rows. We deliberately do NOT alter the shared schema (that would change the
 * existing FF_CAREER_PASSPORT feature). Instead, the loop path runs a scoped,
 * never-throws dedup of PLATFORM-SOURCED rows for the single passport AFTER each
 * sync — keeping the passport clean without touching manual entries or the OFF
 * path. The append-only snapshot history (cp_passport_snapshots, if any) is never
 * mutated by this dedup; it only collapses exact re-inserts of platform rows.
 */
import type { Pool } from 'pg';
import { ADAPTIVE_EVENTS, emit, on, type AdaptiveEvent } from './adaptive-event-bus';
import { isLearningPassportLoopEnabled } from '../config/feature-flags';
import { syncPassportFromPlatform } from './career-passport-bridge';

export interface LearningActivityCompletion {
  userId: string;
  /** 'goal' | 'development' | 'certification' | 'learning_path' | … (descriptive). */
  activityType: string;
  refId?: string | null;
  title?: string | null;
  provider?: string | null;
  isDemo?: boolean;
}

export interface LoopSyncResult {
  passport_id: number;
  activity_recorded: boolean;
  bridge: Awaited<ReturnType<typeof syncPassportFromPlatform>> | null;
  deduped: number;
}

/**
 * Idempotently resolve (or create) the passport row id for a user. Mirrors the
 * private `ensurePassport` in routes/career-passport.ts so the loop is self
 * contained — the schema is owned/created by the passport routes/ensure-schema.
 * Returns null when cp_passport does not exist (FF_CAREER_PASSPORT never armed).
 */
async function ensurePassportForUser(pool: Pool, userId: string): Promise<number | null> {
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_passport (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [userId],
    );
    return (rows[0]?.id as number) ?? null;
  } catch {
    return null;
  }
}

/** Record the specific completed activity in the passport learning history.
 *  Idempotent via a NOT EXISTS guard on (source, source_ref) — no schema change. */
async function recordActivity(
  pool: Pool,
  passportId: number,
  completion: LearningActivityCompletion,
): Promise<boolean> {
  const title = String(completion.title ?? '').trim();
  if (!title) return false;
  const sourceRef = `loop:${completion.activityType}:${completion.refId ?? title}`.slice(0, 200);
  try {
    // Each $N is cast explicitly: a bare parameter in an INSERT...SELECT list is
    // NOT type-inferred from the target column, so without casts pg deduces a
    // different type from the SELECT-list use vs the NOT EXISTS use and throws
    // "inconsistent types deduced for parameter $N".
    const { rowCount } = await pool.query(
      `INSERT INTO cp_learning_history
         (passport_id, activity_type, title, provider, completed_at, source, source_ref)
       SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, NOW(), 'platform', $5::varchar
       WHERE NOT EXISTS (
         SELECT 1 FROM cp_learning_history
         WHERE passport_id = $1::int AND source = 'platform' AND source_ref = $5::varchar
       )`,
      [passportId, completion.activityType, title.slice(0, 300), completion.provider ?? 'MetryxOne', sourceRef],
    );
    return (rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Collapse exact re-inserts of PLATFORM-sourced rows for one passport, keeping
 *  the earliest id per natural key. Scoped, never-throws, leaves manual rows and
 *  the OFF path untouched. Returns the count of removed duplicate rows. */
async function dedupePlatformRows(pool: Pool, passportId: number): Promise<number> {
  let removed = 0;
  const run = async (sql: string) => {
    try { const r = await pool.query(sql, [passportId]); removed += r.rowCount ?? 0; } catch { /* ignore */ }
  };
  // cp_assessments — natural key: integrity_hash (sha256 of type:ref:user)
  await run(
    `DELETE FROM cp_assessments a USING cp_assessments b
     WHERE a.passport_id = $1 AND b.passport_id = a.passport_id
       AND a.integrity_hash IS NOT NULL AND a.integrity_hash = b.integrity_hash
       AND a.id > b.id`,
  );
  // cp_readiness_scores — natural key: (source_system, source_ref)
  await run(
    `DELETE FROM cp_readiness_scores a USING cp_readiness_scores b
     WHERE a.passport_id = $1 AND b.passport_id = a.passport_id
       AND a.source_ref IS NOT NULL AND a.source_ref = b.source_ref
       AND COALESCE(a.source_system,'') = COALESCE(b.source_system,'')
       AND a.id > b.id`,
  );
  // cp_competencies — natural key: skill_name for platform/profile-sourced rows
  await run(
    `DELETE FROM cp_competencies a USING cp_competencies b
     WHERE a.passport_id = $1 AND b.passport_id = a.passport_id
       AND a.source IN ('platform','profile') AND b.source IN ('platform','profile')
       AND LOWER(a.skill_name) = LOWER(b.skill_name)
       AND a.id > b.id`,
  );
  // cp_learning_history — natural key: (source, source_ref) for platform rows
  await run(
    `DELETE FROM cp_learning_history a USING cp_learning_history b
     WHERE a.passport_id = $1 AND b.passport_id = a.passport_id
       AND a.source = 'platform' AND b.source = 'platform'
       AND a.source_ref IS NOT NULL AND a.source_ref = b.source_ref
       AND a.id > b.id`,
  );
  return removed;
}

/**
 * Worker: refresh a passport from platform data + record the completed activity +
 * dedup platform rows. Flag-gated; never throws. Returns the result (or null when
 * skipped) so the founder script can assert it.
 */
export async function handleLearningActivity(
  pool: Pool,
  completion: LearningActivityCompletion,
): Promise<LoopSyncResult | null> {
  if (!isLearningPassportLoopEnabled()) return null; // flag OFF -> no auto-sync
  const uid = String(completion.userId ?? '').trim();
  if (!uid) return null;
  const passportId = await ensurePassportForUser(pool, uid);
  if (passportId == null) return null;

  const activity_recorded = await recordActivity(pool, passportId, completion);
  let bridge: LoopSyncResult['bridge'] = null;
  try { bridge = await syncPassportFromPlatform(uid, passportId, pool); } catch { bridge = null; }
  const deduped = await dedupePlatformRows(pool, passportId);
  return { passport_id: passportId, activity_recorded, bridge, deduped };
}

/**
 * Refresh-only auto-sync (no specific activity record). Used by the freshness
 * "refresh" surface. Flag-gated; never throws.
 */
export async function autoSyncPassportForUser(pool: Pool, userId: string): Promise<LoopSyncResult | null> {
  if (!isLearningPassportLoopEnabled()) return null;
  const uid = String(userId ?? '').trim();
  if (!uid) return null;
  const passportId = await ensurePassportForUser(pool, uid);
  if (passportId == null) return null;
  let bridge: LoopSyncResult['bridge'] = null;
  try { bridge = await syncPassportFromPlatform(uid, passportId, pool); } catch { bridge = null; }
  const deduped = await dedupePlatformRows(pool, passportId);
  return { passport_id: passportId, activity_recorded: false, bridge, deduped };
}

/**
 * Fire-and-forget signal that a learning activity completed. NO-OP when the flag
 * is OFF (no event persisted, no sync) so the calling completion path is
 * byte-identical legacy. When ON it emits on the adaptive bus (the listener runs
 * the worker); the userId travels in the payload because the bus `user_id` column
 * is numeric and career-seeker ids are UUID strings.
 */
export function emitLearningActivityCompleted(pool: Pool, completion: LearningActivityCompletion): void {
  if (!isLearningPassportLoopEnabled()) return; // flag OFF -> no-op (byte-identical)
  const uid = String(completion.userId ?? '').trim();
  if (!uid) return;
  try {
    emit({
      event_type: ADAPTIVE_EVENTS.LEARNING_ACTIVITY_COMPLETED,
      payload: {
        user_id: uid,
        activity_type: completion.activityType,
        ref_id: completion.refId ?? null,
        title: completion.title ?? null,
        provider: completion.provider ?? null,
        is_demo: completion.isDemo ?? false,
      },
    });
  } catch {
    /* fire-and-forget */
  }
}

let registered = false;

/**
 * Register the loop's bus listener exactly once (idempotent). Called at route
 * registration (startup). The listener re-checks the flag so a runtime flip is
 * honoured without a re-register.
 */
export function registerLearningPassportLoop(pool: Pool): void {
  if (registered) return;
  registered = true;
  on(ADAPTIVE_EVENTS.LEARNING_ACTIVITY_COMPLETED, async (e: AdaptiveEvent) => {
    if (!isLearningPassportLoopEnabled()) return; // defence in depth
    const p = (e.payload ?? {}) as any;
    const uid = String(p.user_id ?? '').trim();
    if (!uid) return;
    await handleLearningActivity(pool, {
      userId: uid,
      activityType: String(p.activity_type ?? 'activity'),
      refId: p.ref_id ?? null,
      title: p.title ?? null,
      provider: p.provider ?? null,
      isDemo: p.is_demo === true,
    });
  });
}
