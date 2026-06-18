// ============================================================
// Competency Assessment Factory — Session Manager
// backend/services/caf/session-manager.ts
//
// Lifecycle: draft → in_progress ↔ paused → completed | expired | invalidated
// Integrity: response time floor, pause limits, concurrent session guard
// ============================================================

import { Pool } from 'pg';
import {
  SessionStatus,
  SessionState,
  SessionContext,
  AdaptiveState,
  DrawnQuestion,
  CAFAssessment,
} from './types.js';

// ── Constants ────────────────────────────────────────────────

export const DRAFT_TTL_HOURS       = 24;
export const IN_PROGRESS_TTL_DAYS  = 7;
export const MAX_PAUSES            = 3;
export const MIN_COMPLETION_RATIO  = 0.60;
export const RESPONSE_TIME_FLOOR_S = 2.0;   // faster = flagged (possible random clicking)

// ── Session record (DB row shape) ────────────────────────────

export interface SessionRow {
  id:                 string;
  assessment_id:      number;
  user_id:            string;
  status:             SessionStatus;
  context:            SessionContext;
  question_order:     DrawnQuestion[];
  current_position:   number;
  adaptive_state:     AdaptiveState;
  pause_count:        number;
  time_spent_seconds: number;
  started_at:         Date | null;
  paused_at:          Date | null;
  completed_at:       Date | null;
  expires_at:         Date | null;
  ip_address:         string | null;
  user_agent:         string | null;
  proctoring_events:  unknown[];
  flagged:            boolean;
  flag_reason:        string | null;
  created_at:         Date;
  updated_at:         Date;
}

// ── CRUD helpers ─────────────────────────────────────────────

export async function getSession(pool: Pool, sessionId: string): Promise<SessionRow | null> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT * FROM caf_sessions WHERE id = $1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function getUserActiveSession(
  pool:         Pool,
  userId:       string,
  assessmentId: number,
): Promise<SessionRow | null> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT * FROM caf_sessions
     WHERE user_id = $1 AND assessment_id = $2 AND status = 'in_progress'
     ORDER BY created_at DESC LIMIT 1`,
    [userId, assessmentId],
  );
  return rows[0] ?? null;
}

// ── Create DRAFT session ─────────────────────────────────────

export interface CreateSessionParams {
  assessmentId:  number;
  userId:        string;
  context:       SessionContext;
  questionOrder: DrawnQuestion[];
  priorTheta?:   number;
  ipAddress?:    string;
  userAgent?:    string;
}

export async function createSession(
  pool:   Pool,
  params: CreateSessionParams,
): Promise<SessionRow> {
  const expiresAt = new Date(Date.now() + DRAFT_TTL_HOURS * 3600 * 1000);
  const adaptiveState: AdaptiveState = {
    theta:   params.priorTheta ?? 0.0,
    se:      1.0,
    history: [],
  };

  const { rows } = await pool.query<SessionRow>(
    `INSERT INTO caf_sessions
       (assessment_id, user_id, status, context, question_order, current_position,
        adaptive_state, pause_count, time_spent_seconds, expires_at, ip_address, user_agent)
     VALUES ($1,$2,'draft',$3,$4,0,$5,0,0,$6,$7,$8)
     RETURNING *`,
    [
      params.assessmentId,
      params.userId,
      JSON.stringify(params.context),
      JSON.stringify(params.questionOrder),
      JSON.stringify(adaptiveState),
      expiresAt,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ],
  );
  return rows[0];
}

// ── Begin session (DRAFT → IN_PROGRESS) ─────────────────────

export async function beginSession(pool: Pool, sessionId: string): Promise<SessionRow> {
  const session = await getSession(pool, sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
  if (session.status !== 'draft') throw Object.assign(new Error('Session is not in draft state'), { status: 409 });

  const expiresAt = new Date(Date.now() + IN_PROGRESS_TTL_DAYS * 86400 * 1000);

  const { rows } = await pool.query<SessionRow>(
    `UPDATE caf_sessions
     SET status='in_progress', started_at=NOW(), expires_at=$2, updated_at=NOW()
     WHERE id=$1 AND status='draft'
     RETURNING *`,
    [sessionId, expiresAt],
  );
  if (!rows[0]) throw Object.assign(new Error('Failed to begin session'), { status: 409 });
  return rows[0];
}

// ── Pause session ─────────────────────────────────────────────

export async function pauseSession(pool: Pool, sessionId: string): Promise<SessionRow> {
  const session = await getSession(pool, sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
  if (session.status !== 'in_progress') throw Object.assign(new Error('Session not in_progress'), { status: 409 });

  if (session.pause_count >= MAX_PAUSES) {
    // Auto-complete instead of allowing another pause
    return completeSession(pool, sessionId, 'auto_pause_limit');
  }

  const { rows } = await pool.query<SessionRow>(
    `UPDATE caf_sessions
     SET status='paused', paused_at=NOW(), pause_count=pause_count+1, updated_at=NOW()
     WHERE id=$1 AND status='in_progress'
     RETURNING *`,
    [sessionId],
  );
  if (!rows[0]) throw Object.assign(new Error('Pause failed'), { status: 409 });
  return rows[0];
}

// ── Resume session ────────────────────────────────────────────

export async function resumeSession(
  pool:      Pool,
  sessionId: string,
  ipAddress?: string,
): Promise<SessionRow> {
  const session = await getSession(pool, sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
  if (session.status !== 'paused') throw Object.assign(new Error('Session is not paused'), { status: 409 });

  // Check expiry
  if (session.expires_at && session.expires_at < new Date()) {
    await expireSession(pool, sessionId);
    throw Object.assign(new Error('Session has expired'), { status: 410 });
  }

  const expiresAt = new Date(Date.now() + IN_PROGRESS_TTL_DAYS * 86400 * 1000);

  // Flag if IP changed (proctoring signal)
  const proctoringEvent = ipAddress && session.ip_address && ipAddress !== session.ip_address
    ? [{ type: 'ip_change', from: session.ip_address, to: ipAddress, at: new Date().toISOString() }]
    : [];

  const { rows } = await pool.query<SessionRow>(
    `UPDATE caf_sessions
     SET status='in_progress', paused_at=NULL, expires_at=$2,
         ip_address=COALESCE($3, ip_address),
         proctoring_events = proctoring_events || $4::jsonb,
         updated_at=NOW()
     WHERE id=$1 AND status='paused'
     RETURNING *`,
    [sessionId, expiresAt, ipAddress ?? null, JSON.stringify(proctoringEvent)],
  );
  if (!rows[0]) throw Object.assign(new Error('Resume failed'), { status: 409 });
  return rows[0];
}

// ── Complete session ──────────────────────────────────────────

export async function completeSession(
  pool:      Pool,
  sessionId: string,
  _reason?:  string,
): Promise<SessionRow> {
  const { rows } = await pool.query<SessionRow>(
    `UPDATE caf_sessions
     SET status='completed', completed_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND status IN ('in_progress','paused')
     RETURNING *`,
    [sessionId],
  );
  if (!rows[0]) throw Object.assign(new Error('Cannot complete session in current state'), { status: 409 });
  return rows[0];
}

// ── Expire session ────────────────────────────────────────────

export async function expireSession(pool: Pool, sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE caf_sessions SET status='expired', updated_at=NOW()
     WHERE id=$1 AND status IN ('draft','in_progress','paused')`,
    [sessionId],
  );
}

// ── Invalidate session (admin) ────────────────────────────────

export async function invalidateSession(
  pool:          Pool,
  sessionId:     string,
  invalidatedBy: string,
  reason:        string,
): Promise<SessionRow> {
  const { rows } = await pool.query<SessionRow>(
    `UPDATE caf_sessions
     SET status='invalidated', flagged=true, flag_reason=$2,
         invalidated_by=$3, invalidated_at=NOW(), updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [sessionId, reason, invalidatedBy],
  );
  if (!rows[0]) throw Object.assign(new Error('Session not found'), { status: 404 });

  // Void scores (set score_rule_id = null marks as invalidated)
  await pool.query(
    `UPDATE caf_scores SET score_rule_id = NULL WHERE session_id=$1`,
    [sessionId],
  );

  return rows[0];
}

// ── Update position + adaptive state ────────────────────────

export async function updateSessionProgress(
  pool:          Pool,
  sessionId:     string,
  newPosition:   number,
  adaptiveState: AdaptiveState,
  additionalTimeS?: number,
): Promise<void> {
  await pool.query(
    `UPDATE caf_sessions
     SET current_position=$2,
         adaptive_state=$3,
         time_spent_seconds = time_spent_seconds + $4,
         updated_at=NOW()
     WHERE id=$1`,
    [sessionId, newPosition, JSON.stringify(adaptiveState), additionalTimeS ?? 0],
  );
}

// ── Flag proctoring event ─────────────────────────────────────

export async function addProctoringEvent(
  pool:      Pool,
  sessionId: string,
  event:     { type: string; [key: string]: unknown },
): Promise<void> {
  await pool.query(
    `UPDATE caf_sessions
     SET proctoring_events = proctoring_events || $2::jsonb,
         flagged = true,
         flag_reason = COALESCE(flag_reason, $3),
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId, JSON.stringify([{ ...event, at: new Date().toISOString() }]), event.type],
  );
}

// ── Check response time integrity ────────────────────────────

export function checkResponseIntegrity(
  timeTakenS:        number,
  questionType:      string,
  floorSeconds:      number = RESPONSE_TIME_FLOOR_S,
): { flagged: boolean; reason?: string } {
  if (timeTakenS < floorSeconds) {
    return {
      flagged: true,
      reason:  `Response time ${timeTakenS.toFixed(1)}s is below floor (${floorSeconds}s) for ${questionType}`,
    };
  }
  return { flagged: false };
}

// ── Cron: expire stale sessions ───────────────────────────────

export async function expireStaleSessionsBatch(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE caf_sessions
     SET status='expired', updated_at=NOW()
     WHERE status IN ('draft','in_progress','paused')
       AND expires_at IS NOT NULL
       AND expires_at < NOW()`,
  );
  return rowCount ?? 0;
}

// ── Session state summary ─────────────────────────────────────

export function sessionSummary(row: SessionRow): {
  position:            number;
  total:               number;
  pct_complete:        number;
  time_spent_seconds:  number;
  time_remaining_secs: number | null;
  is_complete:         boolean;
  status:              SessionStatus;
} {
  const total       = row.question_order.length;
  const position    = row.current_position;
  const pctComplete = total > 0 ? position / total : 0;

  // Compute time remaining
  let timeRemaining: number | null = null;
  // (assessment time_limit handled at route level with assessment config)

  return {
    position,
    total,
    pct_complete:        pctComplete,
    time_spent_seconds:  row.time_spent_seconds,
    time_remaining_secs: timeRemaining,
    is_complete:         pctComplete >= MIN_COMPLETION_RATIO,
    status:              row.status,
  };
}
