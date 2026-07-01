/**
 * Data-Subject Rights (DSAR) — Phase 2.4 remediation (CMP-M3).
 *
 * Authenticated self-service:
 *   GET  /api/data-rights/enabled          flag probe (ungated)
 *   GET  /api/data-rights/export           export the caller's OWN data (portability)
 *   POST /api/data-rights/erasure-request  file an erasure request (admin-reviewed)
 *   GET  /api/data-rights/erasure-request  list the caller's own requests
 * Admin (super-admin):
 *   GET  /api/data-rights/admin/erasure-requests             list all
 *   POST /api/data-rights/admin/erasure-requests/:id/resolve set status + note
 *
 * Erasure is NON-DESTRUCTIVE here: filing a request never deletes data. Actual
 * deletion is an explicit, owner-decided operation performed after review.
 *
 * Byte-identical OFF incl. schema: every data route flag-gates (503) BEFORE any
 * work/auth/DDL, and erasure_requests is created only on the first authenticated
 * hit while the flag is ON.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isDataSubjectRightsEnabled } from '../config/feature-flags';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS erasure_requests (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         varchar NOT NULL,
      user_email      text,
      reason          text,
      status          text NOT NULL DEFAULT 'pending',
      requested_at    timestamptz NOT NULL DEFAULT now(),
      resolved_at     timestamptz,
      resolved_by     varchar,
      resolution_note text
    )
  `);
  schemaReady = true;
}

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isDataSubjectRightsEnabled()) {
    return res.status(503).json({ error: 'data_subject_rights_disabled' });
  }
  next();
}

export function registerDataRightsRoutes(app: Express, pool: Pool, requireAuth: Mw, requireSuperAdmin: Mw): void {
  // Ungated flag probe so UIs can show/hide the panel.
  app.get('/api/data-rights/enabled', (_req, res) => {
    res.json({ enabled: isDataSubjectRightsEnabled() });
  });

  // Export the caller's own data (portability).
  app.get('/api/data-rights/export', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const uid = String((req.user as any)?.id ?? '');
      if (!uid) return res.status(401).json({ error: 'not_authenticated' });

      const { rows: userRows } = await pool.query(
        `SELECT id, username, full_name, role, roles, email, phone, account_type, created_at
           FROM users WHERE id = $1`, [uid]);
      const consents = await pool.query(
        `SELECT id, consent_type, consent_version, status, granted_at, revoked_at, expires_at,
                data_categories, processing_purposes, lawful_basis, retention_period, created_at
           FROM consent_records WHERE entity_id = $1 ORDER BY created_at DESC`, [uid])
        .then(r => r.rows).catch(() => [] as any[]);
      const erasures = await pool.query(
        `SELECT id, reason, status, requested_at, resolved_at, resolution_note
           FROM erasure_requests WHERE user_id = $1 ORDER BY requested_at DESC`, [uid])
        .then(r => r.rows).catch(() => [] as any[]);

      const bundle = {
        generated_at: new Date().toISOString(),
        subject_id: uid,
        account: userRows[0] ?? null,   // password never selected
        consents,
        erasure_requests: erasures,
        note: 'Self-service data export (portability). Contains only records you own.',
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="my-data-${uid}.json"`);
      return res.status(200).send(JSON.stringify(bundle, null, 2));
    } catch (e: any) {
      return res.status(500).json({ error: 'export_failed', detail: e.message });
    }
  });

  // File an erasure request (non-destructive).
  app.post('/api/data-rights/erasure-request', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const uid = String((req.user as any)?.id ?? '');
      if (!uid) return res.status(401).json({ error: 'not_authenticated' });
      const email = (req.user as any)?.email ?? null;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 2000) : null;
      const { rows } = await pool.query(
        `INSERT INTO erasure_requests (user_id, user_email, reason)
         VALUES ($1,$2,$3) RETURNING id, status, requested_at`, [uid, email, reason]);
      return res.status(201).json({ request: rows[0], note: 'Filed for review. No data has been deleted.' });
    } catch (e: any) {
      return res.status(500).json({ error: 'request_failed', detail: e.message });
    }
  });

  app.get('/api/data-rights/erasure-request', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const uid = String((req.user as any)?.id ?? '');
      const { rows } = await pool.query(
        `SELECT id, reason, status, requested_at, resolved_at, resolution_note
           FROM erasure_requests WHERE user_id = $1 ORDER BY requested_at DESC`, [uid]);
      return res.json({ requests: rows });
    } catch (e: any) {
      return res.status(500).json({ error: 'list_failed', detail: e.message });
    }
  });

  // ── Admin surfaces ──────────────────────────────────────────────────────────
  app.get('/api/data-rights/admin/erasure-requests', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const { rows } = await pool.query(
        `SELECT * FROM erasure_requests ORDER BY requested_at DESC LIMIT 500`);
      return res.json({ requests: rows });
    } catch (e: any) {
      return res.status(500).json({ error: 'list_failed', detail: e.message });
    }
  });

  app.post('/api/data-rights/admin/erasure-requests/:id/resolve', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const status = String(req.body?.status ?? '');
      const allowed = ['reviewing', 'completed', 'rejected', 'pending'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid_status', allowed });
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 2000) : null;
      const resolver = String((req.user as any)?.id ?? '');
      const { rows } = await pool.query(
        `UPDATE erasure_requests
            SET status=$1, resolution_note=$2, resolved_by=$3,
                resolved_at = CASE WHEN $1 IN ('completed','rejected') THEN now() ELSE resolved_at END
          WHERE id=$4 RETURNING *`, [status, note, resolver, req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
      return res.json({ request: rows[0] });
    } catch (e: any) {
      return res.status(500).json({ error: 'resolve_failed', detail: e.message });
    }
  });
}
