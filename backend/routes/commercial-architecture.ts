/**
 * Task #6 (Phase 6.1) — Commercial Architecture routes.
 *
 * ADDITIVE · FLAG-GATED (`commercialArchitecture`, env `FF_COMMERCIAL_ARCHITECTURE`, default OFF).
 *
 * Surfaces the net-new catalog layer over the EXISTING comm_* spine:
 *   • SKU layer            — comm_skus              (sku_master)
 *   • Add-ons              — comm_addons + comm_sku_addons
 *   • Entitlement Framework — comm_features + comm_plan_entitlements
 *
 * Flag-OFF discipline (byte-identical legacy):
 *   • Every route returns 503 `feature_disabled` BEFORE any DB touch (synchronous gate).
 *   • The lazy ensure-schema runs ONLY when the flag is ON — so with the flag OFF, NONE of the
 *     new comm_* tables are created (schema unchanged too).
 *
 * Access control:
 *   • Admin CRUD (super-admin) under /api/commercial-architecture/admin/* — requireAuth + requireSuperAdmin.
 *   • PUBLIC read at /api/commercial-architecture/catalog — returns is_active=true rows ONLY (drafts
 *     stay hidden), so a draft-seeded catalog is honestly empty until an operator activates it.
 *
 * Never-throws on reads; honest 4xx on bad input; literal sub-paths registered BEFORE any /:id.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCommercialArchitectureEnabled } from '../config/feature-flags.js';
import { ensureArchitectureSchema } from '../services/commercial/architecture-schema.js';
import { FEATURE_CLASSES } from '../services/commercial/plan-features.js';

const SEGMENTS = ['career_builder', 'employer', 'institution', 'enterprise', 'government'] as const;
const INTERVALS = ['one_time', 'trial', 'monthly', 'quarterly', 'annual'] as const;
const ADDON_TYPES = ['feature_unlock', 'report_pack', 'seat_pack', 'usage_pack', 'support'] as const;

const isSegment = (v: unknown): v is (typeof SEGMENTS)[number] =>
  typeof v === 'string' && (SEGMENTS as readonly string[]).includes(v);
const isInterval = (v: unknown): v is (typeof INTERVALS)[number] =>
  typeof v === 'string' && (INTERVALS as readonly string[]).includes(v);
const isAddonType = (v: unknown): v is (typeof ADDON_TYPES)[number] =>
  typeof v === 'string' && (ADDON_TYPES as readonly string[]).includes(v);
const isFeatureClass = (v: unknown): boolean =>
  typeof v === 'string' && (FEATURE_CLASSES as readonly string[]).includes(v);

const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const asInt = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};
const asIntOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const asJson = (v: unknown): string | null => (v && typeof v === 'object' ? JSON.stringify(v) : null);

/** A field is "present" once a caller supplies a non-empty value (so we can tell
 *  "omitted" from "supplied-but-invalid" and return an honest 4xx for the latter). */
const isPresent = (v: unknown): boolean => v !== undefined && v !== null && v !== '';
/** Present-but-invalid against a guard → caller should 400 (never silently coerce). */
const badEnum = (v: unknown, ok: (x: unknown) => boolean): boolean => isPresent(v) && !ok(v);
/** Present-but-not-a-non-negative-integer → caller should 400. */
const badNonNegInt = (v: unknown): boolean => {
  if (!isPresent(v)) return false;
  const n = Number(v);
  return !Number.isFinite(n) || Math.trunc(n) < 0;
};
/** Map a pg constraint error to an honest 4xx; returns true once it has responded. */
const sentDbError = (e: any, res: Response, msgs: { dup?: string; fk?: string } = {}): boolean => {
  if (e?.code === '23505') { res.status(409).json({ error: msgs.dup || 'duplicate key' }); return true; }
  if (e?.code === '23503') { res.status(400).json({ error: msgs.fk || 'referenced row does not exist' }); return true; }
  if (e?.code === '23514') { res.status(400).json({ error: 'value violates a constraint (check the allowed range/enum)' }); return true; }
  return false;
};

export function registerCommercialArchitectureRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // ── Flag gate FIRST — synchronous 503 before any DB touch when OFF. ──
  const gate: RequestHandler = (_req: Request, res: Response, next: NextFunction) => {
    if (!isCommercialArchitectureEnabled()) {
      res.status(503).json({ error: 'feature_disabled', feature: 'commercial_architecture' });
      return;
    }
    next();
  };

  // ── Lazy ensure-schema — runs ONLY when the flag is ON (no DDL when OFF). ──
  app.use('/api/commercial-architecture', (req: Request, res: Response, next: NextFunction) => {
    if (!isCommercialArchitectureEnabled()) return next(); // gate on each route emits the 503
    ensureArchitectureSchema(pool).then(() => next()).catch((err) => {
      console.error('[commercial-architecture] ensure-schema failed:', err instanceof Error ? err.message : String(err));
      res.status(503).json({ error: 'schema_unavailable' });
    });
  });

  const admin: RequestHandler[] = [gate, requireAuth, requireSuperAdmin];

  // ════════════════════════════════════════════════════════════════════════════
  //  PUBLIC catalog (active rows only — drafts hidden)
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/api/commercial-architecture/catalog', gate, async (_req, res, next) => {
    try {
      const [products, plans, skus, addons, features, entitlements] = await Promise.all([
        pool.query(`SELECT * FROM comm_products WHERE is_active=true ORDER BY sort_order, name`),
        pool.query(`SELECT * FROM comm_plans WHERE is_active=true ORDER BY sort_order, name`),
        pool.query(`SELECT * FROM comm_skus WHERE is_active=true ORDER BY sort_order, name`),
        pool.query(`SELECT * FROM comm_addons WHERE is_active=true ORDER BY sort_order, name`),
        pool.query(`SELECT * FROM comm_features WHERE is_active=true ORDER BY sort_order, name`),
        pool.query(`SELECT pe.* FROM comm_plan_entitlements pe
                      JOIN comm_plans p ON p.id = pe.plan_id AND p.is_active=true`),
      ]);
      res.json({
        ok: true,
        products: products.rows, plans: plans.rows, skus: skus.rows,
        addons: addons.rows, features: features.rows, plan_entitlements: entitlements.rows,
      });
    } catch (e) { next(e); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  SKU layer (sku_master) — super-admin CRUD
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/api/commercial-architecture/admin/skus', ...admin, async (req, res, next) => {
    try {
      const productId = asStr(req.query.product_id);
      const { rows } = await pool.query(
        `SELECT * FROM comm_skus ${productId ? 'WHERE product_id=$1' : ''} ORDER BY sort_order, name`,
        productId ? [productId] : [],
      );
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial-architecture/admin/skus', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const sku_code = asStr(b.sku_code); const name = asStr(b.name);
      if (!sku_code || !name) return res.status(400).json({ error: 'sku_code and name are required' });
      if (badEnum(b.segment, isSegment)) return res.status(400).json({ error: `invalid segment; allowed: ${SEGMENTS.join(', ')}` });
      if (badNonNegInt(b.price_paise)) return res.status(400).json({ error: 'price_paise must be a non-negative integer or null' });
      const segment = isSegment(b.segment) ? b.segment : 'career_builder';
      const { rows } = await pool.query(
        `INSERT INTO comm_skus (sku_code,name,product_id,plan_id,segment,price_paise,currency,is_active,sort_order,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
        [sku_code, name, asStr(b.product_id), asStr(b.plan_id), segment, asIntOrNull(b.price_paise),
         asStr(b.currency) || 'INR', b.is_active !== false, asInt(b.sort_order), asJson(b.metadata)],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate sku_code' });
      if (e?.code === '23503') return res.status(400).json({ error: 'product_id or plan_id does not exist' });
      next(e);
    }
  });
  app.patch('/api/commercial-architecture/admin/skus/:id', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (badEnum(b.segment, isSegment)) return res.status(400).json({ error: `invalid segment; allowed: ${SEGMENTS.join(', ')}` });
      if (badNonNegInt(b.price_paise)) return res.status(400).json({ error: 'price_paise must be a non-negative integer or null' });
      const { rows } = await pool.query(
        `UPDATE comm_skus SET
           name=COALESCE($2,name), product_id=COALESCE($3,product_id), plan_id=COALESCE($4,plan_id),
           segment=COALESCE($5,segment), price_paise=COALESCE($6,price_paise), currency=COALESCE($7,currency),
           is_active=COALESCE($8,is_active), sort_order=COALESCE($9,sort_order),
           metadata=COALESCE($10::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.name), asStr(b.product_id), asStr(b.plan_id),
         isSegment(b.segment) ? b.segment : null, asIntOrNull(b.price_paise), asStr(b.currency),
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.sort_order != null ? asInt(b.sort_order) : null, asJson(b.metadata)],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e: any) {
      if (sentDbError(e, res, { dup: 'duplicate sku_code', fk: 'product_id or plan_id does not exist' })) return;
      next(e);
    }
  });
  app.delete('/api/commercial-architecture/admin/skus/:id', ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_skus SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  Add-ons — super-admin CRUD
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/api/commercial-architecture/admin/addons', ...admin, async (_req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM comm_addons ORDER BY sort_order, name`);
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial-architecture/admin/addons', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const code = asStr(b.code); const name = asStr(b.name);
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      if (badEnum(b.addon_type, isAddonType)) return res.status(400).json({ error: `invalid addon_type; allowed: ${ADDON_TYPES.join(', ')}` });
      if (badEnum(b.segment, isSegment)) return res.status(400).json({ error: `invalid segment; allowed: ${SEGMENTS.join(', ')}` });
      if (badEnum(b.billing_interval, isInterval)) return res.status(400).json({ error: `invalid billing_interval; allowed: ${INTERVALS.join(', ')}` });
      if (badNonNegInt(b.price_paise)) return res.status(400).json({ error: 'price_paise must be a non-negative integer' });
      const { rows } = await pool.query(
        `INSERT INTO comm_addons (code,name,addon_type,segment,price_paise,currency,billing_interval,is_active,sort_order,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
        [code, name, isAddonType(b.addon_type) ? b.addon_type : 'feature_unlock',
         isSegment(b.segment) ? b.segment : 'career_builder', asInt(b.price_paise),
         asStr(b.currency) || 'INR', isInterval(b.billing_interval) ? b.billing_interval : 'one_time',
         b.is_active !== false, asInt(b.sort_order), asJson(b.metadata)],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      next(e);
    }
  });
  app.patch('/api/commercial-architecture/admin/addons/:id', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (badEnum(b.addon_type, isAddonType)) return res.status(400).json({ error: `invalid addon_type; allowed: ${ADDON_TYPES.join(', ')}` });
      if (badEnum(b.segment, isSegment)) return res.status(400).json({ error: `invalid segment; allowed: ${SEGMENTS.join(', ')}` });
      if (badEnum(b.billing_interval, isInterval)) return res.status(400).json({ error: `invalid billing_interval; allowed: ${INTERVALS.join(', ')}` });
      if (badNonNegInt(b.price_paise)) return res.status(400).json({ error: 'price_paise must be a non-negative integer' });
      const { rows } = await pool.query(
        `UPDATE comm_addons SET
           name=COALESCE($2,name), addon_type=COALESCE($3,addon_type), segment=COALESCE($4,segment),
           price_paise=COALESCE($5,price_paise), currency=COALESCE($6,currency),
           billing_interval=COALESCE($7,billing_interval), is_active=COALESCE($8,is_active),
           sort_order=COALESCE($9,sort_order), metadata=COALESCE($10::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.name), isAddonType(b.addon_type) ? b.addon_type : null,
         isSegment(b.segment) ? b.segment : null, b.price_paise != null ? asInt(b.price_paise) : null,
         asStr(b.currency), isInterval(b.billing_interval) ? b.billing_interval : null,
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.sort_order != null ? asInt(b.sort_order) : null, asJson(b.metadata)],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial-architecture/admin/addons/:id', ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_addons SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ── SKU ↔ add-on links ──
  app.get('/api/commercial-architecture/admin/sku-addons', ...admin, async (req, res, next) => {
    try {
      const skuId = asStr(req.query.sku_id);
      const { rows } = await pool.query(
        `SELECT sa.*, a.code AS addon_code, a.name AS addon_name, a.price_paise AS addon_price_paise
           FROM comm_sku_addons sa JOIN comm_addons a ON a.id = sa.addon_id
          ${skuId ? 'WHERE sa.sku_id=$1' : ''} ORDER BY a.sort_order, a.name`,
        skuId ? [skuId] : [],
      );
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial-architecture/admin/sku-addons', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const sku_id = asStr(b.sku_id); const addon_id = asStr(b.addon_id);
      if (!sku_id || !addon_id) return res.status(400).json({ error: 'sku_id and addon_id are required' });
      if (badNonNegInt(b.quantity)) return res.status(400).json({ error: 'quantity must be a non-negative integer' });
      const { rows } = await pool.query(
        `INSERT INTO comm_sku_addons (sku_id,addon_id,quantity,is_included)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [sku_id, addon_id, asInt(b.quantity, 1), b.is_included !== false],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'sku already linked to this addon' });
      if (e?.code === '23503') return res.status(400).json({ error: 'sku_id or addon_id does not exist' });
      next(e);
    }
  });
  app.delete('/api/commercial-architecture/admin/sku-addons/:id', ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`DELETE FROM comm_sku_addons WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id });
    } catch (e) { next(e); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  Entitlement Framework — feature catalog (super-admin CRUD)
  // ════════════════════════════════════════════════════════════════════════════
  app.get('/api/commercial-architecture/admin/features', ...admin, async (_req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM comm_features ORDER BY sort_order, name`);
      res.json({ rows, feature_classes: FEATURE_CLASSES });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial-architecture/admin/features', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const code = asStr(b.code); const name = asStr(b.name);
      if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
      const fc = b.feature_class == null || b.feature_class === '' ? null
        : (isFeatureClass(b.feature_class) ? b.feature_class : undefined);
      if (fc === undefined) return res.status(400).json({ error: 'feature_class must be one of FEATURE_CLASSES or null' });
      const { rows } = await pool.query(
        `INSERT INTO comm_features (code,name,feature_class,description,is_metered,is_active,sort_order,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
        [code, name, fc, asStr(b.description), b.is_metered === true, b.is_active !== false,
         asInt(b.sort_order), asJson(b.metadata)],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'duplicate code' });
      next(e);
    }
  });
  app.patch('/api/commercial-architecture/admin/features/:id', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const fc = b.feature_class === undefined ? null
        : (b.feature_class === null || b.feature_class === '' ? null
          : (isFeatureClass(b.feature_class) ? b.feature_class : undefined));
      if (fc === undefined) return res.status(400).json({ error: 'feature_class must be one of FEATURE_CLASSES or null' });
      const { rows } = await pool.query(
        `UPDATE comm_features SET
           name=COALESCE($2,name),
           feature_class=CASE WHEN $9::boolean THEN $3 ELSE feature_class END,
           description=COALESCE($4,description), is_metered=COALESCE($5,is_metered),
           is_active=COALESCE($6,is_active), sort_order=COALESCE($7,sort_order),
           metadata=COALESCE($8::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asStr(b.name), fc, asStr(b.description),
         typeof b.is_metered === 'boolean' ? b.is_metered : null,
         typeof b.is_active === 'boolean' ? b.is_active : null,
         b.sort_order != null ? asInt(b.sort_order) : null, asJson(b.metadata),
         b.feature_class !== undefined],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial-architecture/admin/features/:id', ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `UPDATE comm_features SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id, soft_deleted: true });
    } catch (e) { next(e); }
  });

  // ── Plan → feature(+quota) entitlement mapping ──
  app.get('/api/commercial-architecture/admin/plan-entitlements', ...admin, async (req, res, next) => {
    try {
      const planId = asStr(req.query.plan_id);
      const { rows } = await pool.query(
        `SELECT pe.*, f.name AS feature_name, f.feature_class
           FROM comm_plan_entitlements pe JOIN comm_features f ON f.code = pe.feature_code
          ${planId ? 'WHERE pe.plan_id=$1' : ''} ORDER BY pe.feature_code`,
        planId ? [planId] : [],
      );
      res.json({ rows });
    } catch (e) { next(e); }
  });
  app.post('/api/commercial-architecture/admin/plan-entitlements', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const plan_id = asStr(b.plan_id); const feature_code = asStr(b.feature_code);
      if (!plan_id || !feature_code) return res.status(400).json({ error: 'plan_id and feature_code are required' });
      if (badEnum(b.quota_period, isInterval)) return res.status(400).json({ error: `invalid quota_period; allowed: ${INTERVALS.join(', ')}` });
      if (badNonNegInt(b.quota)) return res.status(400).json({ error: 'quota must be a non-negative integer or null (unlimited)' });
      const { rows } = await pool.query(
        `INSERT INTO comm_plan_entitlements (plan_id,feature_code,quota,quota_period,metadata)
         VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
        [plan_id, feature_code, asIntOrNull(b.quota), isInterval(b.quota_period) ? b.quota_period : 'monthly', asJson(b.metadata)],
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e?.code === '23505') return res.status(409).json({ error: 'plan already entitled to this feature' });
      if (e?.code === '23503') return res.status(400).json({ error: 'plan_id or feature_code does not exist' });
      next(e);
    }
  });
  app.patch('/api/commercial-architecture/admin/plan-entitlements/:id', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (badEnum(b.quota_period, isInterval)) return res.status(400).json({ error: `invalid quota_period; allowed: ${INTERVALS.join(', ')}` });
      if (badNonNegInt(b.quota)) return res.status(400).json({ error: 'quota must be a non-negative integer or null (unlimited)' });
      const { rows } = await pool.query(
        `UPDATE comm_plan_entitlements SET
           quota=CASE WHEN $3::boolean THEN $2 ELSE quota END,
           quota_period=COALESCE($4,quota_period), metadata=COALESCE($5::jsonb,metadata), updated_at=now()
         WHERE id=$1 RETURNING *`,
        [req.params.id, asIntOrNull(b.quota), b.quota !== undefined,
         isInterval(b.quota_period) ? b.quota_period : null, asJson(b.metadata)],
      );
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });
  app.delete('/api/commercial-architecture/admin/plan-entitlements/:id', ...admin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`DELETE FROM comm_plan_entitlements WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      res.json({ ok: true, id: rows[0].id });
    } catch (e) { next(e); }
  });
}
