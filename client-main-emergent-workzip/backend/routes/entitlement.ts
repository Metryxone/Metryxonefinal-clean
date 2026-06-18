/**
 * Entitlement routes
 *
 * GET  /api/entitlement/check         — self-check (bearer token, returns own profile)
 * GET  /api/admin/entitlement/:email  — super-admin lookup by email
 *
 * Additive, read-only. Relies on entitlement-bridge.ts which is never-throws.
 */

import type { Express } from 'express';
import pg from 'pg';
import { getEntitlementProfile } from '../services/entitlement-bridge';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerEntitlementRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW
): void {
  const authOnly = [requireAuth];
  const adminChain = [requireAuth, requireSuperAdmin];

  app.get('/api/entitlement/check', ...authOnly, async (req: any, res) => {
    const email: string | undefined =
      req.user?.email ?? req.session?.email ?? (req.query.email as string | undefined);
    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }
    const profile = await getEntitlementProfile(email, pool);
    res.json(profile);
  });

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
