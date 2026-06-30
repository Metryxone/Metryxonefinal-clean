/**
 * CAPADEX WC-3 L6 — Longitudinal Foundation (Phase A).
 *
 * STORAGE + HISTORY CAPTURE ONLY. After a session completes, this appends an
 * immutable snapshot of that session's already-computed vector (concern / stage /
 * score / CSI) to `wc3_longitudinal_snapshots`. It does NOT compute trends,
 * trajectories, deltas, or any progression analytics — that is a later phase.
 * `wc3_longitudinal_trends` is created by the schema but never written here.
 *
 * Strictly additive + never-throws: the caller is gated on `isWc3LongitudinalEnabled()`.
 */
import type { Pool } from 'pg';
import { ensureWc3LongitudinalSchema } from './wc3-schema';
import { isCanonicalStoredStage, toCanonicalStoredStage } from '../../lib/lifecycle';

interface SnapshotInput {
  sessionId: string;
  userEmail?: string | null;
  userId?: string | null;
  concernName?: string | null;
  stageCode?: string | null;
  canonicalStage?: string | null;
  score?: number | null;
  scoreLevel?: string | null;
  csiScore?: number | null;
  csiStage?: string | null;
}

/**
 * Append one immutable longitudinal snapshot. Returns true on write, false on
 * any failure (never throws — the post-completion hook must not break).
 */
export async function captureLongitudinalSnapshot(pool: Pool, input: SnapshotInput): Promise<boolean> {
  try {
    await ensureWc3LongitudinalSchema(pool);
    // WRITE-SITE GUARD: `canonical_stage` MUST persist as an EXACT proper-cased canonical stored
    // label (or null) — the read-layer normalization parity (Task #306) holds only while stored
    // values are clean. Coerce any recognized representation (CAP_* code / alias / casing /
    // whitespace) to its canonical stored label; null out the unrecognized; and log LOUDLY when a
    // non-canonical value had to be coerced so a future caller passing junk is never silent.
    const rawCanonical = input.canonicalStage ?? null;
    const canonicalStage = toCanonicalStoredStage(rawCanonical);
    if (rawCanonical != null && String(rawCanonical).trim() !== '' && !isCanonicalStoredStage(rawCanonical)) {
      console.error(
        `[wc3-longitudinal] non-canonical canonical_stage coerced before persist: ${JSON.stringify(rawCanonical)} -> ${JSON.stringify(canonicalStage)} (session ${input.sessionId})`,
      );
    }
    const snapshot = {
      concern_name: input.concernName ?? null,
      stage_code: input.stageCode ?? null,
      canonical_stage: canonicalStage,
      score: input.score ?? null,
      score_level: input.scoreLevel ?? null,
      csi_score: input.csiScore ?? null,
      csi_stage: input.csiStage ?? null,
    };
    await pool.query(
      `INSERT INTO wc3_longitudinal_snapshots
         (session_id, user_email, user_id, concern_name, stage_code, canonical_stage,
          score, score_level, csi_score, csi_stage, snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        input.sessionId, input.userEmail ?? null, input.userId ?? null, input.concernName ?? null,
        input.stageCode ?? null, canonicalStage, input.score ?? null, input.scoreLevel ?? null,
        input.csiScore ?? null, input.csiStage ?? null, JSON.stringify(snapshot),
      ],
    );
    return true;
  } catch (err) {
    console.warn('[wc3-longitudinal] captureLongitudinalSnapshot failed (non-blocking):', err instanceof Error ? err.message : String(err));
    return false;
  }
}

export interface LongitudinalHistory {
  session_id: string;
  count: number;
  snapshots: Array<Record<string, any>>;
}

/**
 * Read-only raw snapshot history for the person behind a CAPADEX session.
 *
 * Ownership model: the CAPADEX funnel is anonymous and the SESSION UUID is the
 * implicit bearer/ownership token (identical to /signals, /explain, /guidance,
 * /pipeline). We resolve the session's email + user_id and aggregate that
 * person's snapshots across their sessions. PII-safe: the response NEVER includes
 * `user_email` / `user_id` (those columns are not selected). Returns null when
 * the session is unknown so the route can answer honestly. NO analytics — this is
 * purely the stored append-only history, oldest→newest.
 */
export async function getLongitudinalHistoryBySession(pool: Pool, sessionId: string): Promise<LongitudinalHistory | null> {
  await ensureWc3LongitudinalSchema(pool);
  // The session UUID is the bearer token: resolve whose history it grants.
  let email: string | null = null;
  let userId: string | null = null;
  try {
    const s = await pool.query(
      `SELECT guest_email FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (s.rows.length === 0) return null;
    email = s.rows[0]?.guest_email ?? null;
    if (email) {
      const u = await pool.query(`SELECT id FROM capadex_users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
      userId = u.rows[0]?.id ?? null;
    }
  } catch {
    return null;
  }

  // PII-safe projection: no user_email / user_id columns leave this function.
  const { rows } = await pool.query(
    `SELECT id, session_id, concern_name, stage_code, canonical_stage,
            score, score_level, csi_score, csi_stage, snapshot, captured_at
       FROM wc3_longitudinal_snapshots
      WHERE ($1::uuid IS NOT NULL AND user_id = $1::uuid)
         OR ($2::text IS NOT NULL AND LOWER(user_email) = LOWER($2))
         OR session_id = $3::uuid
      ORDER BY captured_at ASC`,
    [userId, email, sessionId],
  );
  return { session_id: sessionId, count: rows.length, snapshots: rows };
}
