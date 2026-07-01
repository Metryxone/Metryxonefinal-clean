/**
 * CAPADEX 3.0 — Program 3 · Phase 3.4 Enterprise Assessment Delivery Engine — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build engineering-closure mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureAdSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The
 * additive overlay tables are:
 *   ad_launches       — launch records (mode/token/schedule/expiry/status) over the reused runtimes.
 *   ad_sessions       — candidate delivery-session lifecycle (start/resume/pause/…/multi-device).
 *   ad_responses      — candidate responses (save/update/draft/final/offline buffer/recovery).
 *   ad_events         — delivery + security events (secure session/validation/multi-login/copy/audit).
 *   ad_notifications  — delivery notification ledger (invitation/reminder/…/submission-confirmation).
 *
 * Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty).
 * This module NEVER scores/interprets/reports — it only launches, runs the session, and records.
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';

function assertEnabled(): void {
  if (!isFlagEnabled('assessmentDelivery')) {
    throw new Error('assessment_delivery_disabled');
  }
}

let schemaReady = false;
export async function ensureAdSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_launches (
      id           BIGSERIAL PRIMARY KEY,
      launch_key   TEXT UNIQUE NOT NULL,
      assessment_slug TEXT NOT NULL,
      title        TEXT,
      mode         TEXT NOT NULL DEFAULT 'invite',
      access_token TEXT,
      status       TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      expires_at   TIMESTAMPTZ,
      config       JSONB NOT NULL DEFAULT '{}'::jsonb,
      owner        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ad_sessions (
      id            BIGSERIAL PRIMARY KEY,
      session_key   TEXT UNIQUE NOT NULL,
      launch_key    TEXT,
      candidate_ref TEXT,
      status        TEXT NOT NULL DEFAULT 'started',
      device        TEXT,
      state         JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      submitted_at  TIMESTAMPTZ,
      expires_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ad_sessions_launch_idx ON ad_sessions(launch_key);
    CREATE TABLE IF NOT EXISTS ad_responses (
      id            BIGSERIAL PRIMARY KEY,
      session_key   TEXT NOT NULL,
      question_ref  TEXT NOT NULL,
      response      JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'draft',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (session_key, question_ref)
    );
    CREATE TABLE IF NOT EXISTS ad_events (
      id            BIGSERIAL PRIMARY KEY,
      session_key   TEXT,
      launch_key    TEXT,
      event_type    TEXT NOT NULL,
      severity      TEXT NOT NULL DEFAULT 'info',
      payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ad_events_session_idx ON ad_events(session_key);
    CREATE TABLE IF NOT EXISTS ad_notifications (
      id            BIGSERIAL PRIMARY KEY,
      launch_key    TEXT,
      session_key   TEXT,
      notif_type    TEXT NOT NULL,
      channel       TEXT NOT NULL DEFAULT 'email',
      recipient     TEXT,
      status        TEXT NOT NULL DEFAULT 'queued',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  schemaReady = true;
}

/** null on error (unreadable), 0 on no rows (empty). null ≠ 0. */
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0] ? Object.values(rows[0])[0] : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH — create / update / list / get a launch
// ─────────────────────────────────────────────────────────────────────────────
export interface LaunchInput {
  launch_key: string; assessment_slug: string; title?: string; mode?: string;
  access_token?: string; status?: string; scheduled_at?: string; expires_at?: string;
  config?: unknown; owner?: string;
}
export async function upsertLaunch(pool: Pool, input: LaunchInput): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO ad_launches (launch_key, assessment_slug, title, mode, access_token, status, scheduled_at, expires_at, config, owner)
     VALUES ($1,$2,$3,COALESCE($4,'invite'),$5,COALESCE($6,'draft'),$7,$8,COALESCE($9,'{}')::jsonb,$10)
     ON CONFLICT (launch_key) DO UPDATE SET
       assessment_slug=EXCLUDED.assessment_slug, title=EXCLUDED.title, mode=EXCLUDED.mode,
       access_token=EXCLUDED.access_token, status=EXCLUDED.status, scheduled_at=EXCLUDED.scheduled_at,
       expires_at=EXCLUDED.expires_at, config=EXCLUDED.config, owner=EXCLUDED.owner, updated_at=now()
     RETURNING *`,
    [input.launch_key, input.assessment_slug, input.title ?? null, input.mode ?? null, input.access_token ?? null,
      input.status ?? null, input.scheduled_at ?? null, input.expires_at ?? null,
      input.config ? JSON.stringify(input.config) : null, input.owner ?? null],
  );
  return rows[0];
}
export async function listLaunches(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(`SELECT * FROM ad_launches ORDER BY updated_at DESC LIMIT 500`);
  return rows;
}
export async function getLaunch(pool: Pool, launchKey: string): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(`SELECT * FROM ad_launches WHERE launch_key=$1`, [launchKey]);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION — start / heartbeat / transition / list
// ─────────────────────────────────────────────────────────────────────────────
export interface SessionInput {
  session_key: string; launch_key?: string; candidate_ref?: string;
  status?: string; device?: string; state?: unknown; expires_at?: string;
}
export async function startSession(pool: Pool, input: SessionInput): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO ad_sessions (session_key, launch_key, candidate_ref, status, device, state, expires_at)
     VALUES ($1,$2,$3,COALESCE($4,'started'),$5,COALESCE($6,'{}')::jsonb,$7)
     ON CONFLICT (session_key) DO UPDATE SET
       status=EXCLUDED.status, device=EXCLUDED.device, state=EXCLUDED.state,
       last_seen_at=now(), expires_at=EXCLUDED.expires_at
     RETURNING *`,
    [input.session_key, input.launch_key ?? null, input.candidate_ref ?? null, input.status ?? null,
      input.device ?? null, input.state ? JSON.stringify(input.state) : null, input.expires_at ?? null],
  );
  return rows[0];
}
export async function transitionSession(pool: Pool, sessionKey: string, status: string, state?: unknown): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const submitted = status === 'submitted' ? ', submitted_at=now()' : '';
  const { rows } = await pool.query(
    `UPDATE ad_sessions SET status=$2, last_seen_at=now()${submitted},
       state=COALESCE($3::jsonb, state) WHERE session_key=$1 RETURNING *`,
    [sessionKey, status, state ? JSON.stringify(state) : null],
  );
  return rows[0] ?? null;
}
export async function listSessions(pool: Pool, launchKey?: string): Promise<unknown[]> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = launchKey
    ? await pool.query(`SELECT * FROM ad_sessions WHERE launch_key=$1 ORDER BY started_at DESC LIMIT 500`, [launchKey])
    : await pool.query(`SELECT * FROM ad_sessions ORDER BY started_at DESC LIMIT 500`);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE — save/update (draft) / finalize
// ─────────────────────────────────────────────────────────────────────────────
export interface ResponseInput { session_key: string; question_ref: string; response?: unknown; status?: string }
export async function saveResponse(pool: Pool, input: ResponseInput): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO ad_responses (session_key, question_ref, response, status)
     VALUES ($1,$2,COALESCE($3,'{}')::jsonb,COALESCE($4,'draft'))
     ON CONFLICT (session_key, question_ref) DO UPDATE SET
       response=EXCLUDED.response, status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.session_key, input.question_ref, input.response ? JSON.stringify(input.response) : null, input.status ?? null],
  );
  return rows[0];
}
export async function listResponses(pool: Pool, sessionKey: string): Promise<unknown[]> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(`SELECT * FROM ad_responses WHERE session_key=$1 ORDER BY updated_at DESC`, [sessionKey]);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT — delivery + security events (audit)
// ─────────────────────────────────────────────────────────────────────────────
export interface EventInput { session_key?: string; launch_key?: string; event_type: string; severity?: string; payload?: unknown }
export async function recordEvent(pool: Pool, input: EventInput): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO ad_events (session_key, launch_key, event_type, severity, payload)
     VALUES ($1,$2,$3,COALESCE($4,'info'),COALESCE($5,'{}')::jsonb) RETURNING *`,
    [input.session_key ?? null, input.launch_key ?? null, input.event_type, input.severity ?? null,
      input.payload ? JSON.stringify(input.payload) : null],
  );
  return rows[0];
}
export async function listEvents(pool: Pool, sessionKey: string): Promise<unknown[]> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(`SELECT * FROM ad_events WHERE session_key=$1 ORDER BY created_at DESC LIMIT 500`, [sessionKey]);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION — delivery lifecycle notification ledger
// ─────────────────────────────────────────────────────────────────────────────
export interface NotificationInput { launch_key?: string; session_key?: string; notif_type: string; channel?: string; recipient?: string; status?: string }
export async function recordNotification(pool: Pool, input: NotificationInput): Promise<unknown> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO ad_notifications (launch_key, session_key, notif_type, channel, recipient, status)
     VALUES ($1,$2,$3,COALESCE($4,'email'),$5,COALESCE($6,'queued')) RETURNING *`,
    [input.launch_key ?? null, input.session_key ?? null, input.notif_type, input.channel ?? null,
      input.recipient ?? null, input.status ?? null],
  );
  return rows[0];
}
export async function listNotifications(pool: Pool, launchKey: string): Promise<unknown[]> {
  assertEnabled();
  await ensureAdSchema(pool);
  const { rows } = await pool.query(`SELECT * FROM ad_notifications WHERE launch_key=$1 ORDER BY created_at DESC LIMIT 500`, [launchKey]);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE — read-only adoption counts (null-safe; SEPARATE axis, never a gap)
// ─────────────────────────────────────────────────────────────────────────────
export async function launchCoverage(pool: Pool): Promise<{ launches: number | null; active: number | null; scheduled: number | null }> {
  return {
    launches: await count(pool, `SELECT COUNT(*)::int FROM ad_launches`),
    active: await count(pool, `SELECT COUNT(*)::int FROM ad_launches WHERE status IN ('active','published')`),
    scheduled: await count(pool, `SELECT COUNT(*)::int FROM ad_launches WHERE status='scheduled' OR scheduled_at IS NOT NULL`),
  };
}
export async function sessionCoverage(pool: Pool): Promise<{ sessions: number | null; active: number | null; submitted: number | null; resumed: number | null }> {
  return {
    sessions: await count(pool, `SELECT COUNT(*)::int FROM ad_sessions`),
    active: await count(pool, `SELECT COUNT(*)::int FROM ad_sessions WHERE status IN ('started','resumed','paused')`),
    submitted: await count(pool, `SELECT COUNT(*)::int FROM ad_sessions WHERE status='submitted'`),
    resumed: await count(pool, `SELECT COUNT(*)::int FROM ad_sessions WHERE status='resumed'`),
  };
}
export async function responseCoverage(pool: Pool): Promise<{ responses: number | null; final: number | null; drafts: number | null; sessions_with_responses: number | null }> {
  return {
    responses: await count(pool, `SELECT COUNT(*)::int FROM ad_responses`),
    final: await count(pool, `SELECT COUNT(*)::int FROM ad_responses WHERE status='final'`),
    drafts: await count(pool, `SELECT COUNT(*)::int FROM ad_responses WHERE status='draft'`),
    sessions_with_responses: await count(pool, `SELECT COUNT(DISTINCT session_key)::int FROM ad_responses`),
  };
}
export async function eventCoverage(pool: Pool): Promise<{ events: number | null; security_events: number | null; sessions: number | null }> {
  return {
    events: await count(pool, `SELECT COUNT(*)::int FROM ad_events`),
    security_events: await count(pool, `SELECT COUNT(*)::int FROM ad_events WHERE severity IN ('warn','warning','security','critical')`),
    sessions: await count(pool, `SELECT COUNT(DISTINCT session_key)::int FROM ad_events`),
  };
}
export async function notificationCoverage(pool: Pool): Promise<{ notifications: number | null; sent: number | null; launches: number | null }> {
  return {
    notifications: await count(pool, `SELECT COUNT(*)::int FROM ad_notifications`),
    sent: await count(pool, `SELECT COUNT(*)::int FROM ad_notifications WHERE status IN ('sent','delivered')`),
    launches: await count(pool, `SELECT COUNT(DISTINCT launch_key)::int FROM ad_notifications`),
  };
}
