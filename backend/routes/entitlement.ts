/**
 * Entitlement routes
 *
 * Legacy (unchanged, always on):
 *   GET  /api/entitlement/check                 — self-check (bearer token, returns own profile)
 *   GET  /api/admin/entitlement/:email          — super-admin lookup by email
 *   GET  /api/admin/entitlement-summary         — super-admin per-stage payment summary
 *
 * Task #7 generalized feature-class entitlement (flag `commercialEntitlementClasses`, default OFF →
 * every route below 503s and NO comm_entitlement_grants table is created → byte-identical legacy):
 *   GET  /api/admin/entitlement/feature-classes        — system-wide class coverage overview
 *   GET  /api/admin/entitlement/grants                 — list manual grants (optional ?email=)
 *   POST /api/admin/entitlement/grants                 — grant a feature (class or named feature) to an identity
 *   POST /api/admin/entitlement/grants/:id/revoke      — revoke a grant (append-only status flip)
 *
 * Additive, read-mostly. Mutations are super-admin only and fail CLOSED (503 when flag off /
 * schema unavailable). Literal sub-paths are registered BEFORE `/:email` so the param route can't
 * swallow them (see replit.md "Express route order").
 */

import type { Express } from 'express';
import pg from 'pg';
import { getEntitlementProfile } from '../services/entitlement-bridge';
import { buildFeatureClassOverview } from '../services/wc7c/entitlement-engine';
import { ensureEntitlementGrantsSchema } from '../services/commercial/entitlement-grants-schema';
import { isCommercialEntitlementClassesEnabled } from '../config/feature-flags';
import { isFeatureClass } from '../services/commercial/plan-features';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerEntitlementRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW
): void {
  const authOnly = [requireAuth];
  const adminChain = [requireAuth, requireSuperAdmin];

  // FLAG OFF → 503 fail-closed; never touches the (uncreated) comm_entitlement_grants table.
  const requireClassesFlag: GuardMW = (_req, res, next) => {
    if (!isCommercialEntitlementClassesEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'commercialEntitlementClasses' });
    }
    next();
  };
  // Lazy-create the grants table ONLY when the flag is on (runs after requireClassesFlag).
  const ensureGrants: GuardMW = async (_req, res, next) => {
    try {
      await ensureEntitlementGrantsSchema(pool);
      next();
    } catch (err) {
      console.error('[entitlement-grants schema]', err);
      res.status(503).json({ error: 'schema_unavailable' });
    }
  };
  const classesChain = [requireAuth, requireSuperAdmin, requireClassesFlag, ensureGrants];

  app.get('/api/entitlement/check', ...authOnly, async (req: any, res) => {
    const email: string | undefined =
      req.user?.email ?? req.session?.email ?? (req.query.email as string | undefined);
    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }
    const profile = await getEntitlementProfile(email, pool);
    res.json(profile);
  });

  // ── Task #7 generalized feature classes — LITERAL paths BEFORE `/:email` ──────────────────────

  app.get('/api/admin/entitlement/feature-classes', ...classesChain, async (_req: any, res) => {
    try {
      const overview = await buildFeatureClassOverview(pool);
      res.json(overview);
    } catch (err) {
      console.error('[entitlement feature-classes]', err);
      res.status(500).json({ error: 'overview failed' });
    }
  });

  app.get('/api/admin/entitlement/grants', ...classesChain, async (req: any, res) => {
    try {
      const email = (req.query.email as string | undefined)?.trim();
      const params: any[] = [];
      let where = '';
      if (email) { params.push(email); where = `WHERE lower(email) = lower($1)`; }
      const { rows } = await pool.query(
        `SELECT id, email, feature, status, reason, granted_by, expires_at, revoked_by, revoked_at,
                created_at, updated_at
           FROM comm_entitlement_grants ${where}
          ORDER BY created_at DESC LIMIT 500`,
        params,
      );
      res.json({ grants: rows, count: rows.length });
    } catch (err) {
      console.error('[entitlement grants list]', err);
      res.status(500).json({ error: 'list failed' });
    }
  });

  app.post('/api/admin/entitlement/grants', ...classesChain, async (req: any, res) => {
    try {
      const email = String(req.body?.email ?? '').trim();
      const feature = String(req.body?.feature ?? '').trim();
      const reason = req.body?.reason != null ? String(req.body.reason) : null;
      const expiresAt = req.body?.expires_at != null ? new Date(req.body.expires_at) : null;
      if (!email || !feature) return res.status(400).json({ error: 'email and feature required' });
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ error: 'invalid expires_at' });
      }
      const grantedBy = req.user?.email ?? req.session?.email ?? 'super_admin';
      const { rows } = await pool.query(
        `INSERT INTO comm_entitlement_grants (email, feature, reason, granted_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, feature, status, reason, granted_by, expires_at, created_at`,
        [email, feature, reason, grantedBy, expiresAt],
      );
      res.status(201).json({ grant: rows[0], is_feature_class: isFeatureClass(feature) });
    } catch (err) {
      console.error('[entitlement grant create]', err);
      res.status(500).json({ error: 'grant failed' });
    }
  });

  app.post('/api/admin/entitlement/grants/:id/revoke', ...classesChain, async (req: any, res) => {
    try {
      const { id } = req.params;
      const revokedBy = req.user?.email ?? req.session?.email ?? 'super_admin';
      const { rows } = await pool.query(
        `UPDATE comm_entitlement_grants
            SET status = 'revoked', revoked_by = $2, revoked_at = now(), updated_at = now()
          WHERE id = $1 AND status = 'active'
          RETURNING id, email, feature, status, revoked_by, revoked_at`,
        [id, revokedBy],
      );
      if (rows.length === 0) return res.status(404).json({ error: 'active grant not found' });
      res.json({ grant: rows[0] });
    } catch (err) {
      console.error('[entitlement grant revoke]', err);
      res.status(500).json({ error: 'revoke failed' });
    }
  });

  // ── Legacy param + summary routes (registered AFTER the literal paths above) ──────────────────

  app.get('/api/admin/entitlement/:email', ...adminChain, async (req: any, res) => {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: 'email required' });
    const profile = await getEntitlementProfile(email, pool);
    res.json(profile);
  });

  app.get('/api/admin/entitlement-summary', ...adminChain, async (_req: any, res) => {
    try {
      const result = await pool.query(`
        SELECT
          stage_code,
          COUNT(DISTINCT email) AS unique_payers,
          COUNT(*) AS total_payments,
          SUM(amount_paise) AS total_paise
        FROM capadex_payments
        WHERE status = 'paid'
        GROUP BY stage_code
        ORDER BY stage_code
      `);
      const totalPayers = await pool.query(
        `SELECT COUNT(DISTINCT email) AS n FROM capadex_payments WHERE status='paid'`
      );
      res.json({
        by_stage: result.rows.map(r => ({
          stage_code:      r.stage_code,
          unique_payers:   Number(r.unique_payers),
          total_payments:  Number(r.total_payments),
          revenue_inr:     Math.round(Number(r.total_paise ?? 0) / 100),
        })),
        total_unique_payers: Number(totalPayers.rows[0]?.n ?? 0),
        checked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[entitlement-summary]', err);
      res.status(500).json({ error: 'summary failed' });
    }
  });
}
