// ── SUPER-ADMIN EMPLOYER ONBOARDING ────────────────────────────────────────────
// Lets a super admin provision an employer end-to-end: creates the employer-admin
// login (username + password), the organization, the owner membership, and the
// company profile. account_type='employer' is set server-side ONLY (never client-
// settable) — mirrors the self-register path in employer-portal.ts.
//
// Guarded by requireAuth + requireSuperAdmin. Additive; touches only employer_*
// tables + the users row it creates. Honest counts come from rowCount, not input.
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ensureSchema as ensureEmployerSchema } from './employer-portal';
import { ensureSecuritySchema } from './employer-security';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function uid(): string {
  return randomUUID();
}

export function registerEmployerAdminRoutes(
  app: Express,
  pool: Pool,
  requireAuth: any,
  requireSuperAdmin: any,
  hashPassword: (password: string) => Promise<string>,
): void {
  // ── List onboarded employers (with honest, query-derived counts) ──────────────
  app.get('/api/admin/employers', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureEmployerSchema(pool);
      await ensureSecuritySchema(pool);
      const { rows } = await pool.query(`
        SELECT o.id AS org_id, o.name AS org_name, o.owner_id, o.created_at,
               u.username AS admin_email, u.full_name AS admin_name, u.account_type,
               cp.industry, cp.location, cp.website,
               (SELECT COUNT(*) FROM employer_candidates ec WHERE ec.employer_id = o.id) AS candidate_count,
               (SELECT COUNT(*) FROM employer_jobs       ej WHERE ej.employer_id = o.id) AS job_count
          FROM employer_organizations o
          LEFT JOIN users u ON u.id = o.owner_id
          LEFT JOIN employer_company_profiles cp ON cp.employer_id = o.id
         ORDER BY o.created_at DESC NULLS LAST
      `);
      res.json({
        employers: rows.map((r: any) => ({
          orgId: r.org_id,
          orgName: r.org_name || '',
          ownerId: r.owner_id,
          adminEmail: r.admin_email || '',
          adminName: r.admin_name || '',
          accountType: r.account_type || '',
          industry: r.industry || '',
          location: r.location || '',
          website: r.website || '',
          candidateCount: Number(r.candidate_count) || 0,
          jobCount: Number(r.job_count) || 0,
          createdAt: r.created_at,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? 'list_error' });
    }
  });

  // ── Onboard a new employer: admin user + org + owner membership + company ──────
  app.post('/api/admin/employers', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const client = await pool.connect();
    let began = false;
    try {
      await ensureEmployerSchema(pool);
      await ensureSecuritySchema(pool);

      const body = (req.body || {}) as Record<string, any>;
      const companyName = String(body.companyName || '').trim();
      const adminEmail = String(body.adminEmail || '').trim().toLowerCase();
      const adminPassword = String(body.adminPassword || '');
      const adminName = String(body.adminName || '').trim();
      const industry = String(body.industry || '').trim();
      const location = String(body.location || '').trim();
      const website = String(body.website || '').trim();

      if (!companyName) return res.status(400).json({ message: 'companyName is required' });
      if (!EMAIL_RE.test(adminEmail)) return res.status(400).json({ message: 'A valid adminEmail is required' });
      if (adminPassword.length < 8) return res.status(400).json({ message: 'adminPassword must be at least 8 characters' });

      // Case-insensitive username uniqueness
      const existing = await client.query(`SELECT id FROM users WHERE lower(username) = $1 LIMIT 1`, [adminEmail]);
      if (existing.rows.length) return res.status(409).json({ message: 'An account with this email already exists' });

      const hashed = await hashPassword(adminPassword);

      await client.query('BEGIN');
      began = true;

      // Create the employer-admin login. Role 'hr_recruiter' routes to the Employer
      // Portal on login; account_type='employer' is provisioned server-side here.
      const userRow = await client.query(
        `INSERT INTO users (username, password, full_name, role, roles, email, account_type)
         VALUES ($1, $2, $3, 'hr_recruiter', ARRAY['hr_recruiter']::text[], $1, 'employer')
         RETURNING id`,
        [adminEmail, hashed, adminName || companyName],
      );
      const userId = userRow.rows[0].id as string;

      // org.id = userId keeps existing employer_id scoping intact (mirrors self-register)
      await client.query(
        `INSERT INTO employer_organizations (id, name, owner_id)
         VALUES ($1, $2, $1) ON CONFLICT DO NOTHING`,
        [userId, companyName],
      );
      await client.query(
        `INSERT INTO employer_members (id, org_id, user_id, role, status)
         VALUES ($1, $2, $2, 'owner', 'active') ON CONFLICT (org_id, user_id) DO NOTHING`,
        [uid(), userId],
      );
      await client.query(
        `INSERT INTO employer_company_profiles (id, employer_id, name, industry, location, website)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (employer_id) DO UPDATE SET
           name = EXCLUDED.name, industry = EXCLUDED.industry,
           location = EXCLUDED.location, website = EXCLUDED.website, updated_at = now()`,
        [uid(), userId, companyName, industry, location, website],
      );

      await client.query('COMMIT');
      began = false;

      res.json({
        success: true,
        orgId: userId,
        adminEmail,
        adminName: adminName || companyName,
        companyName,
        loginRole: 'Corporate',
        note: 'Employer admin can sign in with role "Corporate" and these credentials.',
      });
    } catch (e: any) {
      if (began) { try { await client.query('ROLLBACK'); } catch { /* noop */ } }
      // Race: a concurrent insert can win the unique-username check → surface as 409 not 500
      if (e?.code === '23505') return res.status(409).json({ message: 'An account with this email already exists' });
      res.status(500).json({ message: e?.message ?? 'onboard_error' });
    } finally {
      client.release();
    }
  });

  // ── Reset an employer admin's password ────────────────────────────────────────
  app.post('/api/admin/employers/:orgId/reset-password', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSecuritySchema(pool);
      const orgId = String(req.params.orgId);
      const newPassword = String((req.body || {}).newPassword || '');
      if (newPassword.length < 8) return res.status(400).json({ message: 'newPassword must be at least 8 characters' });
      const owner = await pool.query(`SELECT owner_id FROM employer_organizations WHERE id = $1`, [orgId]);
      if (!owner.rows.length) return res.status(404).json({ message: 'Employer not found' });
      const ownerId = owner.rows[0].owner_id as string;
      const hashed = await hashPassword(newPassword);
      const upd = await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, ownerId]);
      if (!upd.rowCount) return res.status(404).json({ message: 'Employer admin user not found' });
      res.json({ success: true, orgId, ownerId });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? 'reset_error' });
    }
  });
}
