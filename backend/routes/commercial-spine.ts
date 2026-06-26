/**
 * Task #5 — Commercial Runtime Spine routes.
 *
 * ADDITIVE · FLAG-GATED (default OFF) · runs alongside the existing B2C stage ladder.
 *
 * Three independently-flagged surfaces, all under /api/commercial:
 *   • Catalog            — isCommercialCatalogEnabled()        → /api/commercial/admin/catalog/* (super-admin CRUD)
 *   • Subscriptions      — isCommercialSubscriptionsEnabled()  → /api/commercial/admin/customers|subscriptions/* (super-admin)
 *   • Razorpay recurring — isCommercialRazorpayRecurringEnabled() → /api/commercial/razorpay/* (subscriptions/links/verify/webhook)
 *
 * Flag-OFF discipline (byte-identical legacy):
 *   • A flagged route returns 503 when its flag is OFF.
 *   • The lazy ensure-schema runs ONLY when at least one commercial flag is ON — so with every flag
 *     OFF, NO `comm_*` table is created (schema is unchanged too).
 *
 * Never-throws contract on reads; honest 4xx on bad input. TEST keys only for Razorpay.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  isCommercialCatalogEnabled,
  isCommercialSubscriptionsEnabled,
  isCommercialRazorpayRecurringEnabled,
} from '../config/feature-flags';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import { resolveDiscount, type CouponRow } from '../services/commercial/discount-resolver';
import {
  upsertCustomer, createSubscription, activateSubscription, renewSubscription,
  changePlan, cancelSubscription, expireSubscription, recordPaymentEvent,
  markPastDue, sweepGraceExpirations, refundSubscription,
  getLinkedStagePayments, isSegment,
  type Segment, type BillingInterval,
} from '../services/commercial/subscription-lifecycle-runtime';
import {
  getCreditBalance, listCreditEntries, issueCredit, applyCredit,
} from '../services/commercial/credit-ledger-runtime';
import { withIdempotency } from '../services/commercial/idempotency';
import {
  getRazorpayCreds, isRazorpayConfigured, verifyPaymentSignature, verifySubscriptionSignature,
  verifyWebhookSignature, createRazorpayPlan, createRazorpaySubscription, createRazorpayPaymentLink,
  createRazorpayRefund,
} from '../services/commercial/razorpay-client';
import { z } from 'zod';
import { validate, idParam } from '../lib/validate';

// ── Input-validation schemas (finding #6). Each schema requires ONLY the fields
//    the handler itself already requires (mirroring its `asStr`/`!x` 400 checks),
//    so valid requests stay byte-identical. Optional / value-checked / coerced
//    fields (asInt amounts, COALESCE patch bodies) are left to the handler.
//    Webhooks are intentionally NOT body-gated (signature-protected, Razorpay
//    controls the payload shape). ────────────────────────────────────────────
const reqStr = (max: number) => z.string().trim().min(1).max(max);
const reqEmail = z.string().trim().email().max(320);
const codeName = z.object({ code: reqStr(128), name: reqStr(256) });
const VS = {
  productCreate: codeName,
  planCreate: z.object({ product_id: reqStr(256), code: reqStr(128), name: reqStr(256) }),
  bundleCreate: codeName,
  promotionCreate: codeName,
  couponCreate: z.object({ code: reqStr(128) }),
  discountRuleCreate: codeName,
  customerCreate: z.object({ email: reqEmail }),
  razorpayPlan: z.object({ plan_id: reqStr(256) }),
  razorpaySubscribe: z.object({ email: reqEmail, plan_id: reqStr(256) }),
  razorpayVerify: z.object({ razorpay_payment_id: reqStr(256), razorpay_signature: reqStr(512) }),
  razorpayRefund: z.object({ razorpay_payment_id: reqStr(256) }),
};

const INTERVALS: BillingInterval[] = ['one_time', 'trial', 'monthly', 'quarterly', 'annual'];
const anyCommercialFlag = () =>
  isCommercialCatalogEnabled() || isCommercialSubscriptionsEnabled() || isCommercialRazorpayRecurringEnabled();

// 503 gate factory — returns a middleware that 503s when the given flag is OFF.
function gate(flagFn: () => boolean, name: string): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!flagFn()) {
      res.status(503).json({ error: 'feature_disabled', feature: name });
      return;
    }
    next();
  };
}

const asInt = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};
const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function registerCommercialSpineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // ── Lazy ensure-schema — runs ONLY when a commercial flag is ON (no DDL when fully OFF). ──
  app.use('/api/commercial', (req: Request, res: Response, next: NextFunction) => {
    if (!anyCommercialFlag()) return next();
    ensureCommercialSchema(pool).then(() => next()).catch((err) => {
      console.error('[commercial-spine] ensure-schema failed:', err instanceof Error ? err.message : String(err));
      res.status(503).json({ error: 'schema_unavailable' });
    });
  });

  const admin: RequestHandler[] = [requireAuth, requireSuperAdmin];
  const catalogGate = gate(isCommercialCatalogEnabled, 'commercial_catalog');
  const subsGate = gate(isCommercialSubscriptionsEnabled, 'commercial_subscriptions');
  const rzpGate = gate(isCommercialRazorpayRecurringEnabled, 'commercial_razorpay_recurring');

  // ════════════════════════════════════════════════════════════════════════════════════════
  //  CATALOG (super-admin CRUD)  — gated by commercialCatalog
  // ════════════════════════════════════════════════════════════════════════════════════════

  // ── Products ──
  app.get('/api/commercial/admin/catalog/products', catalogGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM comm_products ORDER BY sort_order, name`);
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/catalog/products', catalogGate, ...admin, validate({ body: VS.productCreate }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const code = asStr(b.code); const name = asStr(b.name);
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      const segment = isSegment(b.segment) ? b.segment : 'career_builder';
      const { rows } = await pool.query(
        `INSERT INTO comm_products (code,name,segment,description,is_active,sort_order,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
        [code, name, segment, asStr(b.description), b.is_active !== false, asInt(b.sort_order), b.metadata ? JSON.stringify(b.metadata) : null],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      next(e);
    }
  });
  app.patch('/api/commercial/admin/catalog/products/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const { rows } = await pool.query(
        `UPDATE comm_products SET
           name=COALESCE($2,name), segment=COALESCE($3,segment), description=COALESCE($4,description),
           is_active=COALESCE($5,is_active), sort_order=COALESCE($6,sort_order),
           metadata=COALESCE($7::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.name), isSegment(b.segment) ? b.segment : null, asStr(b.description),
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.sort_order != null ? asInt(b.sort_order) : null, b.metadata ? JSON.stringify(b.metadata) : null],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial/admin/catalog/products/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_products SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ── Plans ──
  app.get('/api/commercial/admin/catalog/plans', catalogGate, ...admin, async (req, res, next) => {
    try {
      const productId = asStr(req.query.product_id);
      const { rows } = await pool.query(
        `SELECT * FROM comm_plans ${productId ? 'WHERE product_id=$1' : ''} ORDER BY sort_order, name`,
        productId ? [productId] : []);
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/catalog/plans', catalogGate, ...admin, validate({ body: VS.planCreate }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const productId = asStr(b.product_id); const code = asStr(b.code); const name = asStr(b.name);
      if (!productId || !code || !name) return res.status(400).json({ error: 'product_id, code and name are required' });
      const interval = INTERVALS.includes(b.billing_interval) ? b.billing_interval : 'monthly';
      const { rows } = await pool.query(
        `INSERT INTO comm_plans (product_id,code,name,billing_interval,interval_count,price_paise,currency,trial_days,is_active,sort_order,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`,
        [productId, code, name, interval, asInt(b.interval_count, 1), asInt(b.price_paise),
         asStr(b.currency) || 'INR', asInt(b.trial_days), b.is_active !== false, asInt(b.sort_order),
         b.metadata ? JSON.stringify(b.metadata) : null],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      if (e?.code === '23503') return res.status(400).json({ error: 'unknown product_id' });
      next(e);
    }
  });
  app.patch('/api/commercial/admin/catalog/plans/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const interval = INTERVALS.includes(b.billing_interval) ? b.billing_interval : null;
      const { rows } = await pool.query(
        `UPDATE comm_plans SET
           name=COALESCE($2,name), billing_interval=COALESCE($3,billing_interval),
           interval_count=COALESCE($4,interval_count), price_paise=COALESCE($5,price_paise),
           currency=COALESCE($6,currency), trial_days=COALESCE($7,trial_days),
           is_active=COALESCE($8,is_active), sort_order=COALESCE($9,sort_order),
           razorpay_plan_id=COALESCE($10,razorpay_plan_id), metadata=COALESCE($11::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.name), interval,
         b.interval_count != null ? asInt(b.interval_count) : null,
         b.price_paise != null ? asInt(b.price_paise) : null, asStr(b.currency),
         b.trial_days != null ? asInt(b.trial_days) : null,
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.sort_order != null ? asInt(b.sort_order) : null, asStr(b.razorpay_plan_id),
         b.metadata ? JSON.stringify(b.metadata) : null],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial/admin/catalog/plans/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_plans SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ── Bundles (+ items) ──
  app.get('/api/commercial/admin/catalog/bundles', catalogGate, ...admin, async (req, res, next) => {
    try {
      const { rows: bundles } = await pool.query(`SELECT * FROM comm_bundles ORDER BY sort_order, name`);
      const { rows: items } = await pool.query(
        `SELECT bi.*, p.code AS plan_code, p.name AS plan_name, p.price_paise
         FROM comm_bundle_items bi JOIN comm_plans p ON p.id=bi.plan_id`);
      const byBundle: Record<string, any[]> = {};
      for (const it of items) (byBundle[it.bundle_id] ||= []).push(it);
      res.json({ rows: bundles.map((b) => ({ ...b, items: byBundle[b.id] || [] })) });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/catalog/bundles', catalogGate, ...admin, validate({ body: VS.bundleCreate }), async (req, res, next) => {
    const client = await pool.connect();
    try {
      const b = req.body || {};
      const code = asStr(b.code); const name = asStr(b.name);
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      const items: Array<{ plan_id: string; quantity?: number }> = Array.isArray(b.items) ? b.items : [];
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO comm_bundles (code,name,description,price_paise,currency,is_active,sort_order,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
        [code, name, asStr(b.description), b.price_paise != null ? asInt(b.price_paise) : null,
         asStr(b.currency) || 'INR', b.is_active !== false, asInt(b.sort_order),
         b.metadata ? JSON.stringify(b.metadata) : null]);
      const bundle = rows[0];
      for (const it of items) {
        const planId = asStr(it.plan_id);
        if (!planId) continue;
        await client.query(
          `INSERT INTO comm_bundle_items (bundle_id,plan_id,quantity) VALUES ($1,$2,$3)
           ON CONFLICT (bundle_id,plan_id) DO UPDATE SET quantity=EXCLUDED.quantity`,
          [bundle.id, planId, asInt(it.quantity, 1)]);
      }
      await client.query('COMMIT');
      res.status(201).json({ ...bundle, item_count: items.length });
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      if (e?.code === '23503') return res.status(400).json({ error: 'unknown plan_id in items' });
      next(e);
    } finally { client.release(); }
  });
  app.patch('/api/commercial/admin/catalog/bundles/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const { rows } = await pool.query(
        `UPDATE comm_bundles SET name=COALESCE($2,name), description=COALESCE($3,description),
           price_paise=COALESCE($4,price_paise), is_active=COALESCE($5,is_active),
           sort_order=COALESCE($6,sort_order), metadata=COALESCE($7::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.name), asStr(b.description),
         b.price_paise != null ? asInt(b.price_paise) : null,
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.sort_order != null ? asInt(b.sort_order) : null,
         b.metadata ? JSON.stringify(b.metadata) : null]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial/admin/catalog/bundles/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_bundles SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ── Promotions ──
  app.get('/api/commercial/admin/catalog/promotions', catalogGate, ...admin, async (_req, res, next) => {
    try { res.json({ rows: (await pool.query(`SELECT * FROM comm_promotions ORDER BY created_at DESC`)).rows }); }
    catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/catalog/promotions', catalogGate, ...admin, validate({ body: VS.promotionCreate }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const code = asStr(b.code); const name = asStr(b.name);
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      const { rows } = await pool.query(
        `INSERT INTO comm_promotions (code,name,description,starts_at,ends_at,is_active,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
        [code, name, asStr(b.description), b.starts_at || null, b.ends_at || null,
         b.is_active !== false, b.metadata ? JSON.stringify(b.metadata) : null]);
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      next(e);
    }
  });

  // ── Coupons ──
  app.get('/api/commercial/admin/catalog/coupons', catalogGate, ...admin, async (_req, res, next) => {
    try { res.json({ rows: (await pool.query(`SELECT * FROM comm_coupons ORDER BY created_at DESC`)).rows }); }
    catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/catalog/coupons', catalogGate, ...admin, validate({ body: VS.couponCreate }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const code = asStr(b.code);
      if (!code) return res.status(400).json({ error: 'code is required' });
      const dtype = b.discount_type === 'flat' ? 'flat' : 'percent';
      const { rows } = await pool.query(
        `INSERT INTO comm_coupons
           (code,description,discount_type,discount_value,currency,min_amount_paise,max_discount_paise,
            max_redemptions,applies_to,starts_at,ends_at,promotion_id,is_active,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb) RETURNING *`,
        [code.toUpperCase(), asStr(b.description), dtype, asInt(b.discount_value),
         asStr(b.currency) || 'INR', asInt(b.min_amount_paise),
         b.max_discount_paise != null ? asInt(b.max_discount_paise) : null,
         b.max_redemptions != null ? asInt(b.max_redemptions) : null,
         b.applies_to ? JSON.stringify(b.applies_to) : null,
         b.starts_at || null, b.ends_at || null, asStr(b.promotion_id),
         b.is_active !== false, b.metadata ? JSON.stringify(b.metadata) : null]);
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      if (e?.code === '23503') return res.status(400).json({ error: 'unknown promotion_id' });
      next(e);
    }
  });
  app.patch('/api/commercial/admin/catalog/coupons/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const { rows } = await pool.query(
        `UPDATE comm_coupons SET
           description=COALESCE($2,description), discount_value=COALESCE($3,discount_value),
           min_amount_paise=COALESCE($4,min_amount_paise), max_discount_paise=COALESCE($5,max_discount_paise),
           max_redemptions=COALESCE($6,max_redemptions), applies_to=COALESCE($7::jsonb,applies_to),
           starts_at=COALESCE($8,starts_at), ends_at=COALESCE($9,ends_at),
           is_active=COALESCE($10,is_active), metadata=COALESCE($11::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.description),
         b.discount_value != null ? asInt(b.discount_value) : null,
         b.min_amount_paise != null ? asInt(b.min_amount_paise) : null,
         b.max_discount_paise != null ? asInt(b.max_discount_paise) : null,
         b.max_redemptions != null ? asInt(b.max_redemptions) : null,
         b.applies_to ? JSON.stringify(b.applies_to) : null,
         b.starts_at || null, b.ends_at || null,
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.metadata ? JSON.stringify(b.metadata) : null]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial/admin/catalog/coupons/:id', catalogGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_coupons SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ── Discount rules ──
  app.get('/api/commercial/admin/catalog/discount-rules', catalogGate, ...admin, async (_req, res, next) => {
    try { res.json({ rows: (await pool.query(`SELECT * FROM comm_discount_rules ORDER BY priority DESC, name`)).rows }); }
    catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/catalog/discount-rules', catalogGate, ...admin, validate({ body: VS.discountRuleCreate }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const code = asStr(b.code); const name = asStr(b.name);
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      const RULE_TYPES = ['first_time', 'volume', 'segment', 'seasonal'];
      const ruleType = RULE_TYPES.includes(b.rule_type) ? b.rule_type : 'segment';
      const { rows } = await pool.query(
        `INSERT INTO comm_discount_rules (code,name,rule_type,config,priority,starts_at,ends_at,is_active,metadata)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
        [code, name, ruleType, b.config ? JSON.stringify(b.config) : null, asInt(b.priority),
         b.starts_at || null, b.ends_at || null, b.is_active !== false,
         b.metadata ? JSON.stringify(b.metadata) : null]);
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      next(e);
    }
  });

  // ── Quote (pure discount resolution; no fabrication on miss) ──
  app.post('/api/commercial/admin/catalog/quote', catalogGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      let basePaise = b.base_paise != null ? asInt(b.base_paise) : null;
      let planCode = asStr(b.plan_code);
      // If a plan_id is supplied, derive the base price + plan code from it.
      const planId = asStr(b.plan_id);
      if (planId) {
        const { rows } = await pool.query(`SELECT code, price_paise FROM comm_plans WHERE id=$1 LIMIT 1`, [planId]);
        if (!rows.length) return res.status(404).json({ error: 'unknown plan_id' });
        basePaise = Number(rows[0].price_paise);
        planCode = planCode || String(rows[0].code);
      }
      if (basePaise == null) return res.status(400).json({ error: 'base_paise or plan_id is required' });

      const couponCode = asStr(b.coupon_code);
      let coupon: CouponRow | null = null;
      if (couponCode) {
        const { rows } = await pool.query(`SELECT * FROM comm_coupons WHERE upper(code)=upper($1) LIMIT 1`, [couponCode]);
        coupon = (rows[0] as CouponRow) ?? null;
      }
      const result = resolveDiscount(coupon, {
        base_paise: basePaise, currency: asStr(b.currency) || 'INR',
        segment: asStr(b.segment), product_code: asStr(b.product_code), plan_code: planCode,
      });
      res.json(result);
    } catch (e) { next(e); }
  });

  // ════════════════════════════════════════════════════════════════════════════════════════
  //  CUSTOMERS + SUBSCRIPTIONS (super-admin)  — gated by commercialSubscriptions
  // ════════════════════════════════════════════════════════════════════════════════════════

  app.get('/api/commercial/admin/customers', subsGate, ...admin, async (req, res, next) => {
    try {
      const search = asStr(req.query.search);
      const { rows } = await pool.query(
        `SELECT * FROM comm_customers ${search ? 'WHERE email ILIKE $1 OR name ILIKE $1' : ''}
         ORDER BY created_at DESC LIMIT 200`,
        search ? [`%${search}%`] : []);
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/customers', subsGate, ...admin, validate({ body: VS.customerCreate }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const email = asStr(b.email);
      if (!email) return res.status(400).json({ error: 'email is required' });
      const customer = await upsertCustomer(pool, {
        email, name: asStr(b.name), phone: asStr(b.phone),
        segment: isSegment(b.segment) ? (b.segment as Segment) : undefined, user_id: asStr(b.user_id),
      });
      res.status(201).json(customer);
    } catch (e) { next(e); }
  });
  app.get('/api/commercial/admin/customers/:id', subsGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM comm_customers WHERE id=$1 LIMIT 1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      const customer = rows[0];
      const subs = (await pool.query(
        `SELECT * FROM comm_subscriptions WHERE customer_id=$1 ORDER BY created_at DESC`, [customer.id])).rows;
      const linked = await getLinkedStagePayments(pool, customer.email).catch(() => []);
      res.json({ ...customer, subscriptions: subs, linked_stage_payments: linked });
    } catch (e) { next(e); }
  });

  // ── Phase 6.3 — customer credit wallet ("Credits") ──────────────────────────────────────────
  // Distinct two-segment paths (/customers/:id/credit-*) — no collision with /customers/:id.
  app.get('/api/commercial/admin/customers/:id/credit-balance', subsGate, ...admin, async (req, res, next) => {
    try {
      const c = await pool.query(`SELECT id FROM comm_customers WHERE id=$1 LIMIT 1`, [req.params.id]);
      if (!c.rows.length) return res.status(404).json({ error: 'customer not found' });
      const balance_paise = await getCreditBalance(pool, req.params.id);
      res.json({ customer_id: req.params.id, balance_paise, currency: 'INR' });
    } catch (e) { next(e); }
  });

  app.get('/api/commercial/admin/customers/:id/credit-ledger', subsGate, ...admin, async (req, res, next) => {
    try {
      const c = await pool.query(`SELECT id FROM comm_customers WHERE id=$1 LIMIT 1`, [req.params.id]);
      if (!c.rows.length) return res.status(404).json({ error: 'customer not found' });
      const limit = asInt(req.query.limit, 100);
      const rows = await listCreditEntries(pool, req.params.id, { limit });
      const balance_paise = await getCreditBalance(pool, req.params.id);
      res.json({ customer_id: req.params.id, balance_paise, rows });
    } catch (e) { next(e); }
  });

  app.post('/api/commercial/admin/customers/:id/credit/issue', subsGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const amount = asInt(b.amount_paise);
      if (amount <= 0) return res.status(400).json({ error: 'amount_paise must be > 0' });
      const ref_type = asStr(b.ref_type);
      const ref_id = asStr(b.ref_id);
      // Dedup key for retried refund-to-credit (Task #29). Precedence:
      //   1) explicit Idempotency-Key header or body.idempotency_key (mirrors the refund route), else
      //   2) opt-in derivation from the refund identity (customer_id is implicit in the lookup):
      //      `ref:<ref_type>:<ref_id>` when the caller sets `dedupe_by_ref:true` and both refs exist.
      // Absent → unchanged append-only behaviour (existing key-less callers are byte-identical).
      const explicitKey = asStr(req.get('Idempotency-Key')) || asStr(b.idempotency_key);
      const refKey = (b.dedupe_by_ref === true && ref_type && ref_id) ? `ref:${ref_type}:${ref_id}` : null;
      const idempotency_key = explicitKey || refKey || null;
      const out = await issueCredit(pool, {
        customer_id: req.params.id, amount_paise: amount,
        reason: asStr(b.reason), ref_type, ref_id, idempotency_key,
      });
      if (out == null) return res.status(404).json({ error: 'customer not found' });
      // A replayed (deduped) credit is not a new resource → 200; a fresh grant → 201.
      res.status(out.deduped ? 200 : 201).json(out);
    } catch (e: any) {
      if (e?.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  });

  app.post('/api/commercial/admin/customers/:id/credit/apply', subsGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const amount = asInt(b.amount_paise);
      if (amount <= 0) return res.status(400).json({ error: 'amount_paise must be > 0' });
      const out = await applyCredit(pool, {
        customer_id: req.params.id, amount_paise: amount,
        reason: asStr(b.reason), ref_type: asStr(b.ref_type), ref_id: asStr(b.ref_id),
      });
      if (out == null) return res.status(404).json({ error: 'customer not found' });
      res.status(201).json(out);
    } catch (e: any) {
      // Fail-closed: an over-draw surfaces as 400 with the current balance, never a silent overdraft.
      if (e?.status === 400) {
        return res.status(400).json({ error: e.message, balance_paise: e.balance_paise });
      }
      next(e);
    }
  });

  // ── Phase 6.3 — subscription refund (writes the append-only comm_refunds ledger; status unchanged) ──
  // Two-segment literal path; no collision with /subscriptions/:id. Idempotent via Idempotency-Key.
  app.post('/api/commercial/admin/subscriptions/:id/refund', subsGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const amount_paise = b.amount_paise != null ? asInt(b.amount_paise) : null;
      const reason = asStr(b.reason);
      const razorpay_payment_id = asStr(b.razorpay_payment_id);
      const idemKey = asStr(req.get('Idempotency-Key'));
      const run = () => refundSubscription(pool, req.params.id, {
        amount_paise, reason: reason ?? undefined, razorpay_payment_id,
      });

      if (idemKey) {
        const outcome = await withIdempotency(pool, `sub:refund:${req.params.id}:${idemKey}`, 'sub_refund', async () => {
          const out = await run();
          return out ?? { __not_found: true };
        });
        if (outcome.replayed && outcome.response == null) {
          return res.status(409).json({ error: 'refund_in_progress', retry: true });
        }
        if ((outcome.response as any)?.__not_found) return res.status(404).json({ error: 'subscription not found' });
        return res.status(201).json({ ...(outcome.response as any), replayed: outcome.replayed });
      }

      const out = await run();
      if (out == null) return res.status(404).json({ error: 'subscription not found' });
      res.status(201).json(out);
    } catch (e: any) {
      // Abstain (no resolvable refund amount) surfaces as 400 — never a fabricated refund.
      if (e?.status === 400) return res.status(400).json({ error: e.message });
      next(e);
    }
  });

  app.get('/api/commercial/admin/subscriptions', subsGate, ...admin, async (req, res, next) => {
    try {
      const status = asStr(req.query.status); const segment = asStr(req.query.segment);
      const conds: string[] = []; const params: unknown[] = []; let p = 1;
      if (status) { conds.push(`status=$${p++}`); params.push(status); }
      if (segment) { conds.push(`segment=$${p++}`); params.push(segment); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT s.*, c.email FROM comm_subscriptions s JOIN comm_customers c ON c.id=s.customer_id
         ${where} ORDER BY s.created_at DESC LIMIT 200`, params);
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial/admin/subscriptions', subsGate, ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      // Resolve customer by id or email (email is the stable bridge key).
      let customerId = asStr(b.customer_id);
      const email = asStr(b.email);
      if (!customerId && email) {
        const c = await upsertCustomer(pool, { email, name: asStr(b.name), segment: isSegment(b.segment) ? b.segment : undefined });
        customerId = c.id;
      }
      if (!customerId) return res.status(400).json({ error: 'customer_id or email is required' });

      const segment: Segment = isSegment(b.segment) ? b.segment : 'career_builder';
      let interval: BillingInterval = INTERVALS.includes(b.billing_interval) ? b.billing_interval : 'monthly';
      let trialDays = asInt(b.trial_days);
      let amountPaise = b.amount_paise != null ? asInt(b.amount_paise) : null;
      const planId = asStr(b.plan_id);
      if (planId) {
        const { rows } = await pool.query(`SELECT billing_interval, trial_days, price_paise FROM comm_plans WHERE id=$1 LIMIT 1`, [planId]);
        if (!rows.length) return res.status(400).json({ error: 'unknown plan_id' });
        interval = rows[0].billing_interval;
        if (b.trial_days == null) trialDays = Number(rows[0].trial_days);
        if (amountPaise == null) amountPaise = Number(rows[0].price_paise);
      }
      const sub = await createSubscription(pool, {
        customer_id: customerId, plan_id: planId, bundle_id: asStr(b.bundle_id),
        segment, billing_interval: interval, trial_days: trialDays, amount_paise: amountPaise,
        razorpay_subscription_id: asStr(b.razorpay_subscription_id),
      });
      res.status(201).json(sub);
    } catch (e: any) {
      if (e?.code === '23503') return res.status(400).json({ error: 'unknown customer_id / plan_id / bundle_id' });
      next(e);
    }
  });
  app.get('/api/commercial/admin/subscriptions/:id', subsGate, ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM comm_subscriptions WHERE id=$1 LIMIT 1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      const events = (await pool.query(
        `SELECT * FROM comm_subscription_events WHERE subscription_id=$1 ORDER BY created_at ASC`, [req.params.id])).rows;
      res.json({ ...rows[0], events });
    } catch (e) { next(e); }
  });

  // Grace sweep (literal) MUST register BEFORE the `:id/...` transitions below, or `subscriptions/grace`
  // would be captured by the `:id` param. Expires every past_due subscription whose grace window elapsed.
  app.post('/api/commercial/admin/subscriptions/grace/sweep', subsGate, ...admin, async (req, res, next) => {
    try {
      const limit = req.body?.limit != null ? asInt(req.body.limit) : undefined;
      const out = await sweepGraceExpirations(pool, { limit });
      res.json(out);
    } catch (e) { next(e); }
  });

  // Each lifecycle transition is exposed as a flag-gated, super-admin, fail-closed POST. Supplying an
  // `Idempotency-Key` header makes the transition exactly-once (a duplicate replays the stored result),
  // reusing the same comm_idempotency_keys guard as the Razorpay verify/webhook paths.
  const transition = (
    path: string,
    fn: (id: string, body: any) => Promise<unknown | null>,
  ) => {
    app.post(`/api/commercial/admin/subscriptions/:id/${path}`, subsGate, ...admin, validate({ params: idParam }), async (req, res, next) => {
      try {
        const idemKey = asStr(req.get('Idempotency-Key'));
        if (idemKey) {
          const outcome = await withIdempotency(pool, `sub:${path}:${req.params.id}:${idemKey}`, `sub_${path}`, async () => {
            const out = await fn(req.params.id, req.body || {});
            return out == null ? { __not_found: true } : out;
          });
          if (outcome.replayed && outcome.response == null) {
            return res.status(409).json({ error: 'transition_in_progress', retry: true });
          }
          if ((outcome.response as any)?.__not_found) return res.status(404).json({ error: 'subscription not found' });
          return res.json({ ...(outcome.response as any), replayed: outcome.replayed });
        }
        const out = await fn(req.params.id, req.body || {});
        if (out == null) return res.status(404).json({ error: 'subscription not found' });
        res.json(out);
      } catch (e) { next(e); }
    });
  };
  transition('activate', (id, b) => activateSubscription(pool, id, { amount_paise: b.amount_paise != null ? asInt(b.amount_paise) : null }));
  transition('renew', (id, b) => renewSubscription(pool, id, { amount_paise: b.amount_paise != null ? asInt(b.amount_paise) : null }));
  transition('cancel', (id, b) => cancelSubscription(pool, id, { atPeriodEnd: !!b.at_period_end, reason: asStr(b.reason) || undefined }));
  transition('expire', (id) => expireSubscription(pool, id));
  transition('change-plan', async (id, b) => {
    const toPlan = asStr(b.to_plan_id);
    if (!toPlan) throw Object.assign(new Error('to_plan_id is required'), { status: 400 });
    const direction = b.direction === 'downgrade' ? 'downgrade' : 'upgrade';
    const interval: BillingInterval | undefined = INTERVALS.includes(b.billing_interval) ? b.billing_interval : undefined;
    return changePlan(pool, id, { to_plan_id: toPlan, to_billing_interval: interval, direction, amount_paise: b.amount_paise != null ? asInt(b.amount_paise) : null });
  });
  transition('past-due', (id, b) => markPastDue(pool, id, { reason: asStr(b.reason) || undefined }));

  // ════════════════════════════════════════════════════════════════════════════════════════
  //  RAZORPAY (recurring + payment links + idempotent verify/webhook)  — gated by commercialRazorpayRecurring
  // ════════════════════════════════════════════════════════════════════════════════════════

  // Create a Razorpay plan for an existing comm_plan (admin). Demo fallback when keyless.
  app.post('/api/commercial/razorpay/plan', rzpGate, ...admin, validate({ body: VS.razorpayPlan }), async (req, res, next) => {
    try {
      const planId = asStr((req.body || {}).plan_id);
      if (!planId) return res.status(400).json({ error: 'plan_id is required' });
      const { rows } = await pool.query(`SELECT * FROM comm_plans WHERE id=$1 LIMIT 1`, [planId]);
      if (!rows.length) return res.status(404).json({ error: 'unknown plan_id' });
      const plan = rows[0];
      const periodMap: Record<string, 'monthly' | 'quarterly' | 'yearly'> = { monthly: 'monthly', quarterly: 'quarterly', annual: 'yearly' };
      const period = periodMap[plan.billing_interval];
      if (!period) return res.status(400).json({ error: `plan billing_interval '${plan.billing_interval}' is not recurring` });
      const result = await createRazorpayPlan({
        period, interval: plan.interval_count, amountPaise: plan.price_paise, currency: plan.currency, name: plan.name });
      await pool.query(`UPDATE comm_plans SET razorpay_plan_id=$2, updated_at=now() WHERE id=$1`, [planId, result.data.id]);
      res.json({ razorpay_configured: result.configured, demo: result.demo, razorpay_plan_id: result.data.id });
    } catch (e) { next(e); }
  });

  // Create a recurring subscription. Links/creates the comm_subscription locally.
  app.post('/api/commercial/razorpay/subscribe', rzpGate, validate({ body: VS.razorpaySubscribe }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const email = asStr(b.email); const planId = asStr(b.plan_id);
      if (!email || !planId) return res.status(400).json({ error: 'email and plan_id are required' });
      const { rows } = await pool.query(`SELECT * FROM comm_plans WHERE id=$1 LIMIT 1`, [planId]);
      if (!rows.length) return res.status(404).json({ error: 'unknown plan_id' });
      const plan = rows[0];
      if (!plan.razorpay_plan_id) return res.status(400).json({ error: 'plan has no razorpay_plan_id — create the Razorpay plan first' });

      const customer = await upsertCustomer(pool, { email, name: asStr(b.name), phone: asStr(b.phone), segment: isSegment(b.segment) ? b.segment : undefined });
      const totalCount = asInt(b.total_count, 12);
      const rzp = await createRazorpaySubscription({
        planId: plan.razorpay_plan_id, totalCount, customerNotify: true,
        notes: { email, plan_code: String(plan.code), segment: customer.segment } });

      const sub = await createSubscription(pool, {
        customer_id: customer.id, plan_id: planId, segment: customer.segment as Segment,
        billing_interval: plan.billing_interval, trial_days: plan.trial_days, amount_paise: plan.price_paise,
        razorpay_subscription_id: rzp.data.id });
      res.status(201).json({
        razorpay_configured: rzp.configured, demo: rzp.demo,
        subscription_id: sub.id, razorpay_subscription_id: rzp.data.id, short_url: rzp.data.short_url ?? null });
    } catch (e) { next(e); }
  });

  // Create a one-time hosted payment link.
  app.post('/api/commercial/razorpay/payment-link', rzpGate, async (req, res, next) => {
    try {
      const b = req.body || {};
      const email = asStr(b.email);
      let amountPaise = b.amount_paise != null ? asInt(b.amount_paise) : null;
      const planId = asStr(b.plan_id);
      if (planId && amountPaise == null) {
        const { rows } = await pool.query(`SELECT price_paise FROM comm_plans WHERE id=$1 LIMIT 1`, [planId]);
        if (!rows.length) return res.status(404).json({ error: 'unknown plan_id' });
        amountPaise = Number(rows[0].price_paise);
      }
      if (amountPaise == null || amountPaise <= 0) return res.status(400).json({ error: 'amount_paise or a priced plan_id is required' });

      const customer = email ? await upsertCustomer(pool, { email, name: asStr(b.name) }) : null;
      const referenceId = `clink_${Date.now()}`;
      const rzp = await createRazorpayPaymentLink({
        amountPaise, currency: asStr(b.currency) || 'INR', description: asStr(b.description) || undefined,
        referenceId, customer: email ? { name: asStr(b.name) || undefined, email, contact: asStr(b.phone) || undefined } : undefined });

      const { rows } = await pool.query(
        `INSERT INTO comm_payment_links (customer_id,plan_id,email,amount_paise,currency,razorpay_payment_link_id,short_url,reference_id,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'created') RETURNING id`,
        [customer?.id ?? null, planId, email, amountPaise, asStr(b.currency) || 'INR', rzp.data.id, rzp.data.short_url, referenceId]);
      res.status(201).json({ razorpay_configured: rzp.configured, demo: rzp.demo, payment_link_id: rows[0].id, short_url: rzp.data.short_url, razorpay_payment_link_id: rzp.data.id });
    } catch (e) { next(e); }
  });

  // Idempotent verify — exactly-once via comm_idempotency_keys keyed on the order id.
  app.post('/api/commercial/razorpay/verify', rzpGate, validate({ body: VS.razorpayVerify }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const orderId = asStr(b.razorpay_order_id);
      const paymentId = asStr(b.razorpay_payment_id);
      const signature = asStr(b.razorpay_signature);
      const subscriptionDbId = asStr(b.subscription_id);
      if (!paymentId || !signature || (!orderId && !asStr(b.razorpay_subscription_id))) {
        return res.status(400).json({ error: 'razorpay_payment_id, razorpay_signature and (razorpay_order_id or razorpay_subscription_id) are required' });
      }
      const creds = getRazorpayCreds();
      const rzpSubId = asStr(b.razorpay_subscription_id);
      const idemKey = `verify:${orderId ?? rzpSubId}:${paymentId}`;

      const outcome = await withIdempotency(pool, idemKey, 'verify', async () => {
        // Signature check (demo mode: no creds → accept demo orders that begin with DEMO_).
        let valid = false;
        if (creds) {
          valid = rzpSubId
            ? verifySubscriptionSignature(paymentId, rzpSubId, signature, creds.keySecret)
            : verifyPaymentSignature(orderId!, paymentId, signature, creds.keySecret);
        } else {
          valid = (orderId ?? rzpSubId ?? '').startsWith('DEMO_');
        }
        if (!valid) return { ok: false, reason: 'signature_invalid' };

        if (subscriptionDbId) {
          // INTEGRITY: only activate a local subscription that is actually bound to the verified
          // razorpay subscription — never trust the caller-supplied subscription_id alone. This
          // closes an IDOR where any valid signature tuple could credit a different subscription.
          const { rows } = await pool.query(
            `SELECT razorpay_subscription_id FROM comm_subscriptions WHERE id=$1 LIMIT 1`, [subscriptionDbId]);
          if (!rows.length) return { ok: false, reason: 'subscription_not_found' };
          const linked = rows[0].razorpay_subscription_id as string | null;
          if (!rzpSubId || !linked || linked !== rzpSubId) {
            return { ok: false, reason: 'subscription_link_mismatch' };
          }
          await activateSubscription(pool, subscriptionDbId, {});
          await recordPaymentEvent(pool, { subscription_id: subscriptionDbId, succeeded: true, metadata: { razorpay_payment_id: paymentId } });
        }
        return { ok: true, subscription_id: subscriptionDbId ?? null };
      });

      // A null replay means a concurrent claim is still in flight — ask the caller to retry.
      if (outcome.replayed && outcome.response == null) {
        return res.status(409).json({ error: 'verification_in_progress', retry: true });
      }
      if ((outcome.response as any)?.ok === false) {
        return res.status(400).json({ ...(outcome.response as any), replayed: outcome.replayed });
      }
      res.json({ ...(outcome.response as any), replayed: outcome.replayed });
    } catch (e) { next(e); }
  });

  // Idempotent webhook — exactly-once via the Razorpay event id (or a body hash fallback).
  app.post('/api/commercial/razorpay/webhook', rzpGate, async (req, res, next) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      // HMAC over the EXACT received bytes (req.rawBody, captured in index.ts) — re-serializing
      // req.body re-orders/normalizes keys and breaks signature verification.
      const raw = (req as any).rawBody instanceof Buffer
        ? (req as any).rawBody.toString('utf8')
        : JSON.stringify(req.body ?? {});
      const configured = isRazorpayConfigured();
      if (configured) {
        // Real Razorpay traffic MUST be signed — fail CLOSED if the secret is missing or the
        // signature is absent/invalid. Never process forged lifecycle-changing events.
        if (!secret) return res.status(503).json({ error: 'webhook_secret_not_configured' });
        const sig = req.headers['x-razorpay-signature'] as string | undefined;
        if (!sig || !verifyWebhookSignature(raw, sig, secret)) {
          return res.status(400).json({ error: 'invalid webhook signature' });
        }
      } else if (secret) {
        // Keyless/demo mode but a secret is configured → still verify when a signature is present.
        const sig = req.headers['x-razorpay-signature'] as string | undefined;
        if (!sig || !verifyWebhookSignature(raw, sig, secret)) {
          return res.status(400).json({ error: 'invalid webhook signature' });
        }
      }
      const event = asStr(req.body?.event);
      const eventId = (req.headers['x-razorpay-event-id'] as string) || `wh_${event}_${asStr(req.body?.payload?.payment?.entity?.id) ?? Date.now()}`;

      const outcome = await withIdempotency(pool, `webhook:${eventId}`, 'webhook', async () => {
        const subId = asStr(req.body?.payload?.subscription?.entity?.id);
        // Map razorpay subscription events onto our local subscription via razorpay_subscription_id.
        if (subId) {
          const { rows } = await pool.query(`SELECT id FROM comm_subscriptions WHERE razorpay_subscription_id=$1 LIMIT 1`, [subId]);
          const localId = rows[0]?.id ?? null;
          if (localId) {
            if (event === 'subscription.charged') { await renewSubscription(pool, localId, {}); await recordPaymentEvent(pool, { subscription_id: localId, succeeded: true, metadata: { event } }); }
            else if (event === 'subscription.cancelled') await cancelSubscription(pool, localId, { reason: 'razorpay_webhook' });
            else if (event === 'subscription.completed' || event === 'subscription.expired') await expireSubscription(pool, localId);
            else if (event === 'subscription.activated') await activateSubscription(pool, localId, {});
          }
        }
        // Mark a payment link paid when applicable.
        const plinkId = asStr(req.body?.payload?.payment_link?.entity?.id);
        if (plinkId) await pool.query(`UPDATE comm_payment_links SET status='paid', updated_at=now() WHERE razorpay_payment_link_id=$1`, [plinkId]).catch(() => {});
        return { ok: true, event };
      });
      if (outcome.replayed && outcome.response == null) {
        return res.status(409).json({ error: 'webhook_in_progress', retry: true });
      }
      res.json({ ...(outcome.response as any), replayed: outcome.replayed });
    } catch (e) { next(e); }
  });

  // Refund a captured payment (admin).
  app.post('/api/commercial/razorpay/refund', rzpGate, ...admin, validate({ body: VS.razorpayRefund }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const paymentId = asStr(b.razorpay_payment_id);
      const amountPaise = asInt(b.amount_paise);
      if (!paymentId || amountPaise <= 0) return res.status(400).json({ error: 'razorpay_payment_id and amount_paise are required' });
      if (paymentId.startsWith('DEMO_')) return res.status(400).json({ error: 'demo payments cannot be refunded — no real charge exists' });
      if (!isRazorpayConfigured()) return res.status(400).json({ error: 'Razorpay not configured (TEST keys absent)' });
      const result = await createRazorpayRefund({ paymentId, amountPaise, notes: { reason: asStr(b.reason) || 'admin_refund' } });
      res.json({ ok: true, refund_id: result.data.id, status: result.data.status ?? null });
    } catch (e) { next(e); }
  });
}
