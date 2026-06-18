/**
 * VX-D7A — Assessment Runtime Platform Extension
 * Proctoring framework, device tracking, runtime audit log.
 * Extends existing caf-runtime.ts — additive new tables and endpoints.
 * Flag-gated FF_CAREER_GRAPH=1. Never-throws. Additive.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

const PROCTORING_EVENT_TYPES = ['session_start','session_end','tab_switch','window_blur','fullscreen_exit','copy_attempt','paste_attempt','screenshot_attempt','multiple_faces_detected','no_face_detected','unusual_eye_movement','network_disruption','browser_back','page_reload','idle_warning','idle_timeout','manual_flag','review_passed','review_failed'] as const;

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_proctoring_log (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data JSONB DEFAULT '{}',
      severity TEXT CHECK (severity IN ('info','warning','critical')) DEFAULT 'info',
      is_flagged BOOLEAN DEFAULT false,
      auto_flagged BOOLEAN DEFAULT false,
      reviewer_note TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      client_timestamp TIMESTAMPTZ,
      server_timestamp TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS assessment_device_tracking (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      device_fingerprint TEXT,
      user_agent TEXT,
      browser_name TEXT,
      browser_version TEXT,
      os_name TEXT,
      ip_address TEXT,
      screen_resolution TEXT,
      viewport_size TEXT,
      timezone TEXT,
      languages TEXT[],
      is_mobile BOOLEAN DEFAULT false,
      trust_score NUMERIC(5,2) DEFAULT 100.0,
      registered_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS assessment_runtime_audit (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      actor_role TEXT,
      previous_state JSONB,
      new_state JSONB,
      metadata JSONB DEFAULT '{}',
      ip_address TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS assessment_integrity_scores (
      id SERIAL PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      total_events INTEGER DEFAULT 0,
      flagged_events INTEGER DEFAULT 0,
      critical_flags INTEGER DEFAULT 0,
      integrity_score NUMERIC(5,2) DEFAULT 100.0,
      trust_verdict TEXT CHECK (trust_verdict IN ('trusted','review_required','suspicious','rejected')) DEFAULT 'trusted',
      computed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_apl_session ON assessment_proctoring_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_apl_flagged ON assessment_proctoring_log(is_flagged);
    CREATE INDEX IF NOT EXISTS idx_adt_session ON assessment_device_tracking(session_id);
    CREATE INDEX IF NOT EXISTS idx_ara_session ON assessment_runtime_audit(session_id);
    CREATE INDEX IF NOT EXISTS idx_ais_session ON assessment_integrity_scores(session_id);
  `);
  ready = true;
}

function computeIntegrityScore(events: { severity: string; is_flagged: boolean }[]): { score: number; verdict: string } {
  const total = events.length;
  const flagged = events.filter(e => e.is_flagged).length;
  const critical = events.filter(e => e.severity === 'critical').length;
  const warnings = events.filter(e => e.severity === 'warning').length;
  let score = 100 - (critical * 25) - (warnings * 5) - (flagged * 10);
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 85 ? 'trusted' : score >= 65 ? 'review_required' : score >= 40 ? 'suspicious' : 'rejected';
  return { score: Math.round(score * 10) / 10, verdict };
}

export function registerVXAssessmentRuntimeExtendedRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let schemaReady = false;
  async function ensureReady() { if (!schemaReady) { await ensureSchema(pool); schemaReady = true; } }

  /* ── Proctoring Events ─────────────────────────────────────────────────── */
  app.post('/api/caf/sessions/:id/proctoring/event', requireAuth, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { event_type, event_data = {}, severity = 'info', client_timestamp } = req.body;
      const sessionId = req.params.id;
      const isAutoFlag = ['tab_switch','window_blur','multiple_faces_detected','no_face_detected','copy_attempt','screenshot_attempt'].includes(event_type);
      const isCritical = severity === 'critical' || ['multiple_faces_detected','screenshot_attempt'].includes(event_type);
      const row = await pool.query(
        'INSERT INTO assessment_proctoring_log(session_id,event_type,event_data,severity,is_flagged,auto_flagged,client_timestamp) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [sessionId, event_type, JSON.stringify(event_data), isCritical ? 'critical' : severity, isAutoFlag, isAutoFlag, client_timestamp]
      );
      // Recompute integrity score
      const events = await pool.query('SELECT severity, is_flagged FROM assessment_proctoring_log WHERE session_id=$1', [sessionId]);
      const { score, verdict } = computeIntegrityScore(events.rows);
      await pool.query(
        'INSERT INTO assessment_integrity_scores(session_id,total_events,flagged_events,critical_flags,integrity_score,trust_verdict,computed_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(session_id) DO UPDATE SET total_events=$2,flagged_events=$3,critical_flags=$4,integrity_score=$5,trust_verdict=$6,computed_at=NOW()',
        [sessionId, events.rows.length, events.rows.filter((e: any) => e.is_flagged).length, events.rows.filter((e: any) => e.severity === 'critical').length, score, verdict]
      ).catch(() => null);
      res.status(201).json({ event: row.rows[0], integrity_score: score, trust_verdict: verdict });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/caf/sessions/:id/proctoring/log', requireAuth, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const [events, integrity] = await Promise.all([
        pool.query('SELECT * FROM assessment_proctoring_log WHERE session_id=$1 ORDER BY server_timestamp ASC', [req.params.id]),
        pool.query('SELECT * FROM assessment_integrity_scores WHERE session_id=$1', [req.params.id]),
      ]);
      res.json({ session_id: req.params.id, events: events.rows, total: events.rows.length, integrity: integrity.rows[0] || null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/caf/sessions/:id/proctoring/flags', requireAuth, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const rows = await pool.query('SELECT * FROM assessment_proctoring_log WHERE session_id=$1 AND is_flagged=true ORDER BY severity DESC, server_timestamp ASC', [req.params.id]);
      res.json({ session_id: req.params.id, flags: rows.rows, flag_count: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/admin/caf/sessions/:id/proctoring/review/:eventId', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { is_flagged, reviewer_note } = req.body;
      const row = await pool.query('UPDATE assessment_proctoring_log SET is_flagged=$1,reviewer_note=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$4 AND session_id=$5 RETURNING *', [is_flagged, reviewer_note, 'superadmin', req.params.eventId, req.params.id]);
      res.json(row.rows[0] || { error: 'Event not found' });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  /* ── Device Tracking ───────────────────────────────────────────────────── */
  app.post('/api/caf/sessions/:id/device-register', requireAuth, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { device_fingerprint, user_agent, browser_name, browser_version, os_name, screen_resolution, viewport_size, timezone, languages = [], is_mobile = false } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const row = await pool.query(
        'INSERT INTO assessment_device_tracking(session_id,device_fingerprint,user_agent,browser_name,browser_version,os_name,ip_address,screen_resolution,viewport_size,timezone,languages,is_mobile) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
        [req.params.id, device_fingerprint, user_agent, browser_name, browser_version, os_name, ip, screen_resolution, viewport_size, timezone, languages, is_mobile]
      );
      await pool.query('INSERT INTO assessment_runtime_audit(session_id,action,metadata) VALUES($1,$2,$3)', [req.params.id, 'device_registered', JSON.stringify({ browser_name, os_name, is_mobile })]).catch(() => null);
      res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  /* ── Runtime Audit ─────────────────────────────────────────────────────── */
  app.get('/api/admin/caf/sessions/:id/audit', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const [audit, device, integrity] = await Promise.all([
        pool.query('SELECT * FROM assessment_runtime_audit WHERE session_id=$1 ORDER BY timestamp ASC', [req.params.id]),
        pool.query('SELECT * FROM assessment_device_tracking WHERE session_id=$1 ORDER BY registered_at DESC LIMIT 1', [req.params.id]),
        pool.query('SELECT * FROM assessment_integrity_scores WHERE session_id=$1', [req.params.id]),
      ]);
      res.json({ session_id: req.params.id, audit_trail: audit.rows, device: device.rows[0] || null, integrity: integrity.rows[0] || null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/caf/sessions/:id/security-report', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const [proctoring, device, audit, integrity] = await Promise.all([
        pool.query('SELECT event_type, severity, is_flagged, auto_flagged, server_timestamp FROM assessment_proctoring_log WHERE session_id=$1 ORDER BY server_timestamp', [req.params.id]),
        pool.query('SELECT * FROM assessment_device_tracking WHERE session_id=$1', [req.params.id]),
        pool.query('SELECT COUNT(*) as actions FROM assessment_runtime_audit WHERE session_id=$1', [req.params.id]),
        pool.query('SELECT * FROM assessment_integrity_scores WHERE session_id=$1', [req.params.id]),
      ]);
      res.json({ session_id: req.params.id, security_summary: { proctoring_events: proctoring.rows, device_registrations: device.rows, audit_actions: Number(audit.rows[0]?.actions || 0), integrity_report: integrity.rows[0] || null }, generated_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── Admin Overview ────────────────────────────────────────────────────── */
  app.get('/api/admin/vx/assessment-runtime/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const [integrity, flags, devices] = await Promise.all([
        pool.query('SELECT trust_verdict, COUNT(*) as count, ROUND(AVG(integrity_score),1) as avg_score FROM assessment_integrity_scores GROUP BY trust_verdict'),
        pool.query('SELECT event_type, COUNT(*) as count FROM assessment_proctoring_log WHERE is_flagged=true GROUP BY event_type ORDER BY count DESC LIMIT 10'),
        pool.query('SELECT browser_name, COUNT(*) as count FROM assessment_device_tracking WHERE browser_name IS NOT NULL GROUP BY browser_name ORDER BY count DESC'),
      ]);
      res.json({ integrity_distribution: integrity.rows, top_flag_types: flags.rows, device_breakdown: devices.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[vx-assessment-runtime-extended] VX-D7A routes registered — proctoring + device tracking + runtime audit');
}
