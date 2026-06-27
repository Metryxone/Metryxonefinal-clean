/**
 * MX-302E — Campus Placement & Company Intelligence routes.
 *
 * Two student-facing surfaces (Placement Hub + Company Explorer) over a net-new
 * substrate. Strictly additive + reversible + flag-gated (`campusPlacement`,
 * FF_CAMPUS_PLACEMENT, default OFF):
 *   - OFF → every DATA route 503s BEFORE any auth/DB/DDL touch → byte-identical
 *     legacy behaviour (the ensure-schema is never reached, so no new tables).
 *   - `/enabled` is UNGATED (platform convention, MX-302B): it always returns
 *     200 `{enabled:<flag>}` so the UI hides the tab on `{enabled:false}`.
 *
 * Honesty: null ≠ 0, no fabricated CTC, k-anonymity ≥ 30 on cross-student
 * aggregates, Company DNA only from real role-DNA / market signal. Student
 * personal rows are strictly user-scoped (IDOR-safe); company/curated rows are
 * tenant-scoped (NULL tenant = platform-global).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { isFlagEnabled } from '../config/feature-flags';
import { ensureCampusPlacementSchema, campusPlacementTablesReady } from '../services/campus-placement-schema';
import {
  evaluateEligibility,
  composePackageAnalytics,
  composeCompanyDNA,
  composePlacementReadiness,
} from '../services/campus-placement-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('campusPlacement')) {
    return res.status(503).json({ ok: false, error: 'campus_placement_disabled' });
  }
  next();
}

const uid = (req: Request): string | null => {
  const u = (req as any).user;
  return u && u.id != null ? String(u.id) : null;
};

const tenantOf = (req: Request): string | null => {
  const u = (req as any).user;
  return u && (u.tenant_id ?? u.tenantId) != null ? String(u.tenant_id ?? u.tenantId) : null;
};

export function registerCampusPlacementRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
): void {
  // ── Flag probe — UNGATED (platform convention, MX-302B): always 200 with the
  //    current flag state so the UI hides the tab on {enabled:false}. Only DATA
  //    routes 503 when OFF; this probe never does. ──
  app.get('/api/campus-placement/enabled', async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: isFlagEnabled('campusPlacement') });
  });

  // Tenant-visible filter: rows owned by the caller's tenant OR platform-global (NULL).
  const tenantFilter = (req: Request, alias = '') => {
    const t = tenantOf(req);
    const col = alias ? `${alias}.tenant_id` : 'tenant_id';
    return t ? { clause: `(${col} = $T OR ${col} IS NULL)`, value: t } : { clause: `${col} IS NULL`, value: null };
  };

  // ── Placement calendar (read-only; published/global events) ──────────────
  app.get('/api/campus-placement/calendar', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, events: [], empty: true });
      const tf = tenantFilter(req);
      const params: any[] = [];
      let sql = `SELECT id, company_id, drive_id, internship_id, program_id, event_type, title,
                        event_date, event_time, location, description, status
                   FROM placement_calendar WHERE status = 'scheduled'`;
      if (tf.value != null) { params.push(tf.value); sql += ` AND ${tf.clause.replace('$T', `$${params.length}`)}`; }
      else { sql += ` AND tenant_id IS NULL`; }
      sql += ` ORDER BY event_date NULLS LAST LIMIT 200`;
      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, events: rows });
    } catch (err) {
      console.error('[campus-placement] calendar error:', err);
      res.json({ ok: true, events: [], degraded: true });
    }
  });

  // ── Internship marketplace ───────────────────────────────────────────────
  app.get('/api/campus-placement/internships', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, internships: [], empty: true });
      const tf = tenantFilter(req, 'i');
      const params: any[] = [];
      let sql = `SELECT i.*, c.name AS company_name FROM internships i
                   LEFT JOIN companies c ON c.id = i.company_id
                  WHERE i.status = 'active'`;
      if (tf.value != null) { params.push(tf.value); sql += ` AND ${tf.clause.replace('$T', `$${params.length}`)}`; }
      else { sql += ` AND i.tenant_id IS NULL`; }
      sql += ` ORDER BY i.apply_deadline NULLS LAST LIMIT 200`;
      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, internships: rows });
    } catch (err) {
      console.error('[campus-placement] internships error:', err);
      res.json({ ok: true, internships: [], degraded: true });
    }
  });

  // ── Graduate programs ────────────────────────────────────────────────────
  app.get('/api/campus-placement/graduate-programs', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, programs: [], empty: true });
      const tf = tenantFilter(req, 'g');
      const params: any[] = [];
      let sql = `SELECT g.*, c.name AS company_name FROM graduate_programs g
                   LEFT JOIN companies c ON c.id = g.company_id
                  WHERE g.status = 'active'`;
      if (tf.value != null) { params.push(tf.value); sql += ` AND ${tf.clause.replace('$T', `$${params.length}`)}`; }
      else { sql += ` AND g.tenant_id IS NULL`; }
      sql += ` ORDER BY g.apply_deadline NULLS LAST LIMIT 200`;
      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, programs: rows });
    } catch (err) {
      console.error('[campus-placement] graduate-programs error:', err);
      res.json({ ok: true, programs: [], degraded: true });
    }
  });

  // ── Company drives (LIST — literal before /:id) ──────────────────────────
  app.get('/api/campus-placement/drives', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, drives: [], empty: true });
      const tf = tenantFilter(req, 'd');
      const params: any[] = [];
      let sql = `SELECT d.*, c.name AS company_name FROM campus_drives d
                   LEFT JOIN companies c ON c.id = d.company_id
                  WHERE d.status = 'published'`;
      if (tf.value != null) { params.push(tf.value); sql += ` AND ${tf.clause.replace('$T', `$${params.length}`)}`; }
      else { sql += ` AND d.tenant_id IS NULL`; }
      sql += ` ORDER BY d.drive_date NULLS LAST LIMIT 200`;
      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, drives: rows });
    } catch (err) {
      console.error('[campus-placement] drives error:', err);
      res.json({ ok: true, drives: [], degraded: true });
    }
  });

  // ── Company Explorer (LIST — literal before /:id) ────────────────────────
  app.get('/api/campus-placement/company-explorer', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, companies: [], empty: true });
      const tf = tenantFilter(req);
      const params: any[] = [];
      let sql = `SELECT id, name, industry, hq_location, size_band, description FROM companies
                  WHERE status = 'active'`;
      if (tf.value != null) { params.push(tf.value); sql += ` AND ${tf.clause.replace('$T', `$${params.length}`)}`; }
      else { sql += ` AND tenant_id IS NULL`; }
      sql += ` ORDER BY name LIMIT 300`;
      const { rows } = await pool.query(sql, params);
      res.json({ ok: true, companies: rows });
    } catch (err) {
      console.error('[campus-placement] company-explorer error:', err);
      res.json({ ok: true, companies: [], degraded: true });
    }
  });

  // ── Company DNA (Company Explorer drill-down) ────────────────────────────
  app.get('/api/campus-placement/company-explorer/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, company: null, empty: true });
      // Tenant-scoped inside the engine: a company outside the caller's scope → null → 404 (no IDOR leak).
      const dna = await composeCompanyDNA(pool, String(req.params.id), { userId: uid(req) ?? undefined, tenantId: tenantOf(req) });
      if (!dna) return res.status(404).json({ ok: false, error: 'company_not_found' });
      res.json({ ok: true, company: dna });
    } catch (err) {
      console.error('[campus-placement] company DNA error:', err);
      res.json({ ok: true, company: null, degraded: true });
    }
  });

  // ── Single drive (param route — AFTER literal /drives + /company-explorer) ─
  app.get('/api/campus-placement/drives/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, drive: null, empty: true });
      // Tenant + status scoped: out-of-scope or unpublished drive → 404 (no IDOR leak).
      const tf = tenantFilter(req, 'd');
      const params: any[] = [String(req.params.id)];
      let sql = `SELECT d.*, c.name AS company_name FROM campus_drives d
                   LEFT JOIN companies c ON c.id = d.company_id
                  WHERE d.id = $1 AND d.status = 'published'`;
      if (tf.value != null) { params.push(tf.value); sql += ` AND ${tf.clause.replace('$T', `$${params.length}`)}`; }
      else { sql += ` AND d.tenant_id IS NULL`; }
      const { rows } = await pool.query(sql, params);
      if (rows.length === 0) return res.status(404).json({ ok: false, error: 'drive_not_found' });
      res.json({ ok: true, drive: rows[0] });
    } catch (err) {
      console.error('[campus-placement] drive error:', err);
      res.json({ ok: true, drive: null, degraded: true });
    }
  });

  // ── Student profile (eligibility inputs) — GET + UPSERT ──────────────────
  app.get('/api/campus-placement/student-profile', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const { rows } = await pool.query(`SELECT * FROM campus_student_profiles WHERE user_id = $1`, [userId]);
      res.json({ ok: true, profile: rows[0] ?? null });
    } catch (err) {
      console.error('[campus-placement] get student-profile error:', err);
      res.json({ ok: true, profile: null, degraded: true });
    }
  });

  app.put('/api/campus-placement/student-profile', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const b = req.body ?? {};
      const num = (v: any) => (v === '' || v == null ? null : Number(v));
      const int = (v: any) => (v === '' || v == null ? null : parseInt(String(v), 10));
      await pool.query(
        `INSERT INTO campus_student_profiles (user_id, cgpa, branch, backlogs, batch_year, tenth_pct, twelfth_pct, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (user_id) DO UPDATE SET
           cgpa = EXCLUDED.cgpa, branch = EXCLUDED.branch, backlogs = EXCLUDED.backlogs,
           batch_year = EXCLUDED.batch_year, tenth_pct = EXCLUDED.tenth_pct,
           twelfth_pct = EXCLUDED.twelfth_pct, updated_at = now()`,
        [userId, num(b.cgpa), b.branch ?? null, int(b.backlogs), int(b.batch_year), num(b.tenth_pct), num(b.twelfth_pct)],
      );
      const { rows } = await pool.query(`SELECT * FROM campus_student_profiles WHERE user_id = $1`, [userId]);
      res.json({ ok: true, profile: rows[0] ?? null });
    } catch (err) {
      console.error('[campus-placement] put student-profile error:', err);
      res.status(500).json({ ok: false, error: 'save_failed' });
    }
  });

  // ── Eligibility check for a drive ────────────────────────────────────────
  app.get('/api/campus-placement/eligibility/:driveId', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, result: null, empty: true });
      const driveId = String(req.params.driveId);
      // Tenant + status scoped: out-of-scope or unpublished drive → 404 (no IDOR leak).
      const tf = tenantFilter(req);
      const dParams: any[] = [driveId];
      let dSql = `SELECT eligibility_cgpa, eligibility_branches, eligibility_max_backlogs, eligibility_batch_years
                    FROM campus_drives WHERE id = $1 AND status = 'published'`;
      if (tf.value != null) { dParams.push(tf.value); dSql += ` AND ${tf.clause.replace('$T', `$${dParams.length}`)}`; }
      else { dSql += ` AND tenant_id IS NULL`; }
      const drive = (await pool.query(dSql, dParams)).rows[0];
      if (!drive) return res.status(404).json({ ok: false, error: 'drive_not_found' });
      const profile = (await pool.query(
        `SELECT cgpa, branch, backlogs, batch_year FROM campus_student_profiles WHERE user_id = $1`,
        [userId],
      )).rows[0] ?? null;
      const result = evaluateEligibility(
        driveId,
        {
          eligibility_cgpa: drive.eligibility_cgpa != null ? Number(drive.eligibility_cgpa) : null,
          eligibility_branches: Array.isArray(drive.eligibility_branches) ? drive.eligibility_branches : null,
          eligibility_max_backlogs: drive.eligibility_max_backlogs != null ? Number(drive.eligibility_max_backlogs) : null,
          eligibility_batch_years: Array.isArray(drive.eligibility_batch_years) ? drive.eligibility_batch_years.map(Number) : null,
        },
        profile
          ? {
              cgpa: profile.cgpa != null ? Number(profile.cgpa) : null,
              branch: profile.branch ?? null,
              backlogs: profile.backlogs != null ? Number(profile.backlogs) : null,
              batch_year: profile.batch_year != null ? Number(profile.batch_year) : null,
            }
          : null,
      );
      res.json({ ok: true, result });
    } catch (err) {
      console.error('[campus-placement] eligibility error:', err);
      res.json({ ok: true, result: null, degraded: true });
    }
  });

  // ── Package analytics (real offers + market; k-anon cohort) ──────────────
  app.get('/api/campus-placement/package-analytics', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, analytics: null, empty: true });
      res.json({ ok: true, analytics: await composePackageAnalytics(pool, userId) });
    } catch (err) {
      console.error('[campus-placement] package-analytics error:', err);
      res.json({ ok: true, analytics: null, degraded: true });
    }
  });

  // ── Placement readiness ──────────────────────────────────────────────────
  app.get('/api/campus-placement/readiness', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      if (!(await campusPlacementTablesReady(pool))) return res.json({ ok: true, readiness: null, empty: true });
      res.json({ ok: true, readiness: await composePlacementReadiness(pool, userId) });
    } catch (err) {
      console.error('[campus-placement] readiness error:', err);
      res.json({ ok: true, readiness: null, degraded: true });
    }
  });

  // ── Applications tracker (student-scoped CRUD) ───────────────────────────
  app.get('/api/campus-placement/applications', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const { rows } = await pool.query(
        `SELECT * FROM campus_applications WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId],
      );
      res.json({ ok: true, applications: rows });
    } catch (err) {
      console.error('[campus-placement] applications list error:', err);
      res.json({ ok: true, applications: [], degraded: true });
    }
  });

  app.post('/api/campus-placement/applications', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const b = req.body ?? {};
      const id = randomUUID();
      await pool.query(
        `INSERT INTO campus_applications (id, user_id, target_type, target_id, company_name, role_title, status, applied_at, notes, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, userId, b.target_type ?? 'external', b.target_id ?? null, b.company_name ?? null, b.role_title ?? null,
         b.status ?? 'interested', b.applied_at ?? null, b.notes ?? null, b.source ?? 'manual'],
      );
      const { rows } = await pool.query(`SELECT * FROM campus_applications WHERE id = $1`, [id]);
      res.json({ ok: true, application: rows[0] });
    } catch (err) {
      console.error('[campus-placement] applications create error:', err);
      res.status(500).json({ ok: false, error: 'create_failed' });
    }
  });

  app.put('/api/campus-placement/applications/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const b = req.body ?? {};
      // user_id in WHERE → IDOR-safe (a student can only mutate their own rows).
      const { rowCount } = await pool.query(
        `UPDATE campus_applications SET
           status = COALESCE($3, status), company_name = COALESCE($4, company_name),
           role_title = COALESCE($5, role_title), applied_at = COALESCE($6, applied_at),
           notes = COALESCE($7, notes), updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [String(req.params.id), userId, b.status ?? null, b.company_name ?? null, b.role_title ?? null, b.applied_at ?? null, b.notes ?? null],
      );
      if (!rowCount) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`SELECT * FROM campus_applications WHERE id = $1`, [String(req.params.id)]);
      res.json({ ok: true, application: rows[0] });
    } catch (err) {
      console.error('[campus-placement] applications update error:', err);
      res.status(500).json({ ok: false, error: 'update_failed' });
    }
  });

  app.delete('/api/campus-placement/applications/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const { rowCount } = await pool.query(
        `DELETE FROM campus_applications WHERE id = $1 AND user_id = $2`,
        [String(req.params.id), userId],
      );
      if (!rowCount) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true });
    } catch (err) {
      console.error('[campus-placement] applications delete error:', err);
      res.status(500).json({ ok: false, error: 'delete_failed' });
    }
  });

  // ── Offers tracker (student-scoped CRUD; drives package analytics) ───────
  app.get('/api/campus-placement/offers', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const { rows } = await pool.query(`SELECT * FROM offers WHERE user_id = $1 ORDER BY offer_date DESC NULLS LAST`, [userId]);
      res.json({ ok: true, offers: rows });
    } catch (err) {
      console.error('[campus-placement] offers list error:', err);
      res.json({ ok: true, offers: [], degraded: true });
    }
  });

  app.post('/api/campus-placement/offers', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const b = req.body ?? {};
      // CTC null when not supplied — null ≠ 0, never coerced to 0.
      const ctc = b.ctc === '' || b.ctc == null ? null : Number(b.ctc);
      const id = randomUUID();
      await pool.query(
        `INSERT INTO offers (id, user_id, application_id, company_name, role_title, offer_type, ctc, currency, location, offer_date, joining_date, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, userId, b.application_id ?? null, b.company_name ?? null, b.role_title ?? null, b.offer_type ?? 'full_time',
         ctc, b.currency ?? 'INR', b.location ?? null, b.offer_date ?? null, b.joining_date ?? null, b.status ?? 'received', b.notes ?? null],
      );
      const { rows } = await pool.query(`SELECT * FROM offers WHERE id = $1`, [id]);
      res.json({ ok: true, offer: rows[0] });
    } catch (err) {
      console.error('[campus-placement] offers create error:', err);
      res.status(500).json({ ok: false, error: 'create_failed' });
    }
  });

  app.put('/api/campus-placement/offers/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const b = req.body ?? {};
      const ctc = b.ctc === '' ? null : b.ctc == null ? undefined : Number(b.ctc);
      const { rowCount } = await pool.query(
        `UPDATE offers SET
           company_name = COALESCE($3, company_name), role_title = COALESCE($4, role_title),
           offer_type = COALESCE($5, offer_type), ctc = CASE WHEN $6::numeric IS NOT NULL OR $7::boolean THEN $6 ELSE ctc END,
           currency = COALESCE($8, currency), location = COALESCE($9, location),
           offer_date = COALESCE($10, offer_date), joining_date = COALESCE($11, joining_date),
           status = COALESCE($12, status), notes = COALESCE($13, notes), updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [String(req.params.id), userId, b.company_name ?? null, b.role_title ?? null, b.offer_type ?? null,
         ctc ?? null, ctc === null, b.currency ?? null, b.location ?? null, b.offer_date ?? null, b.joining_date ?? null,
         b.status ?? null, b.notes ?? null],
      );
      if (!rowCount) return res.status(404).json({ ok: false, error: 'not_found' });
      const { rows } = await pool.query(`SELECT * FROM offers WHERE id = $1`, [String(req.params.id)]);
      res.json({ ok: true, offer: rows[0] });
    } catch (err) {
      console.error('[campus-placement] offers update error:', err);
      res.status(500).json({ ok: false, error: 'update_failed' });
    }
  });

  app.delete('/api/campus-placement/offers/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const { rowCount } = await pool.query(`DELETE FROM offers WHERE id = $1 AND user_id = $2`, [String(req.params.id), userId]);
      if (!rowCount) return res.status(404).json({ ok: false, error: 'not_found' });
      res.json({ ok: true });
    } catch (err) {
      console.error('[campus-placement] offers delete error:', err);
      res.status(500).json({ ok: false, error: 'delete_failed' });
    }
  });

  // ── Import device-local FresherHub applications (best-effort, disclosed) ──
  app.post('/api/campus-placement/import-local', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
      await ensureCampusPlacementSchema(pool);
      const items: any[] = Array.isArray(req.body?.applications) ? req.body.applications : [];
      let imported = 0;
      for (const it of items.slice(0, 500)) {
        if (!it || typeof it !== 'object') continue;
        await pool.query(
          `INSERT INTO campus_applications (id, user_id, target_type, company_name, role_title, status, notes, source)
           VALUES ($1,$2,'external',$3,$4,$5,$6,'imported')`,
          [randomUUID(), userId, it.company_name ?? it.company ?? null, it.role_title ?? it.role ?? null,
           it.status ?? 'interested', it.notes ?? null],
        );
        imported += 1;
      }
      res.json({ ok: true, imported, note: 'Imported from your device. Originals remain on your device until you remove them.' });
    } catch (err) {
      console.error('[campus-placement] import-local error:', err);
      res.status(500).json({ ok: false, error: 'import_failed' });
    }
  });
}
