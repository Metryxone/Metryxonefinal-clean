/**
 * Task #7 — Usage metering routes (flag `commercialUsageMetering`, default OFF → every route 503s and
 * NO comm_usage_events table is created → byte-identical legacy).
 *
 *   POST /api/commercial/metering/record   — record a metered action (FAIL CLOSED if over quota → 429)
 *   GET  /api/commercial/metering/check    — evaluate quota WITHOUT recording (?usage_type=&email=)
 *   GET  /api/admin/commercial/metering/overview — super-admin system-wide usage overview
 *
 * record/check require auth; the metered identity is ALWAYS the server-authenticated principal. A
 * client-supplied email is honoured ONLY for a super-admin (acting on behalf of) — a normal user can
 * never meter/inspect another identity (no IDOR / quota sabotage). overview is super-admin only.
 *
 * When the entitlement-classes + enforcement flags are ON, recording a metered action whose usage_type
 * is itself a feature class also requires entitlement to that class (fails closed 402/503).
 */
import type { Express } from 'express';
import pg from 'pg';
import { ensureMeteringSchema } from '../services/commercial/metering-schema';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import {
  recordUsage, checkQuota, buildUsageOverview, isUsageType,
  checkCreditDimension, spendCredits, listPlanQuotas, upsertPlanQuotas,
  listUsageOverrides, upsertUsageOverride, deleteUsageOverride,
} from '../services/commercial/metering-engine';
import { buildIdentityConsumption, buildDimensionOverview, buildUsageTrend } from '../services/commercial/consumption-engine';
import {
  isCommercialUsageMeteringEnabled,
  isCommercialEntitlementEnforcementEnabled,
  isCommercialEntitlementClassesEnabled,
} from '../config/feature-flags';
import { isFeatureClass, isQuotaDimension, type FeatureClass, type UsageType } from '../services/commercial/plan-features';
import { evaluateFeatureClassEntitlement } from '../services/wc7c/require-entitlement';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerCommercialMeteringRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireMeteringFlag: GuardMW = (_req, res, next) => {
    if (!isCommercialUsageMeteringEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'commercialUsageMetering' });
    }
    next();
  };
  const ensureSchema: GuardMW = async (_req, res, next) => {
    try {
      await ensureMeteringSchema(pool);
      next();
    } catch (err) {
      console.error('[metering schema]', err);
      res.status(503).json({ error: 'schema_unavailable' });
    }
  };
  // Write chains bootstrap the ledger schema (write path). Read chains do NOT — GET-never-writes:
  // consumption/balance/overview probe table existence and degrade to honest empties instead of DDL.
  const ensureCreditSchema: GuardMW = async (_req, res, next) => {
    try {
      await ensureCommercialSchema(pool);
      next();
    } catch (err) {
      console.error('[metering credit schema]', err);
      res.status(503).json({ error: 'schema_unavailable' });
    }
  };
  const userChain = [requireAuth, requireMeteringFlag, ensureSchema];
  const userReadChain = [requireAuth, requireMeteringFlag];
  const adminReadChain = [requireAuth, requireSuperAdmin, requireMeteringFlag];
  const creditWriteChain = [requireAuth, requireMeteringFlag, ensureCreditSchema];
  // Quota config lives on comm_plans.metadata; the write path bootstraps the catalog schema (after the
  // flag gate → byte-identical OFF, no schema created when metering is disabled).
  const adminQuotaWriteChain = [requireAuth, requireSuperAdmin, requireMeteringFlag, ensureCreditSchema];

  const isSuperAdmin = (req: any): boolean => {
    const roles = req.user?.roles || [];
    return roles.includes('super_admin') || req.user?.role === 'super_admin';
  };
  // Identity is ALWAYS the server-authenticated principal. A client-supplied email (`override`) is
  // honoured ONLY for a super-admin (admin tooling acting on behalf of an identity). A normal user
  // can never meter or inspect ANOTHER identity — this closes the IDOR / quota-sabotage hole.
  const resolveEmail = (req: any, override?: unknown): string | null => {
    const principal = req.user?.email ?? req.session?.email;
    const chosen = isSuperAdmin(req) && override != null ? String(override) : principal;
    const trimmed = typeof chosen === 'string' ? chosen.trim() : '';
    return trimmed || null;
  };

  app.post('/api/commercial/metering/record', ...userChain, async (req: any, res) => {
    try {
      const email = resolveEmail(req, req.body?.email);
      const usageType = String(req.body?.usage_type ?? '').trim();
      if (!email) return res.status(400).json({ error: 'email required' });
      if (!isUsageType(usageType)) return res.status(400).json({ error: 'invalid usage_type' });
      // Feature-class enforcement: when both flags are ON, a metered action whose usage_type IS a
      // feature class (views/searches/exports/assessments/api) requires entitlement to that class.
      // Fails CLOSED (402/503). Usage-only types (unlocks/downloads) carry no class → nothing to gate.
      if (
        isCommercialEntitlementEnforcementEnabled() &&
        isCommercialEntitlementClassesEnabled() &&
        isFeatureClass(usageType)
      ) {
        const verdict = await evaluateFeatureClassEntitlement(pool, email, usageType as FeatureClass);
        if (!verdict.allowed) return res.status(verdict.status).json(verdict.body);
      }
      const result = await recordUsage(pool, {
        email,
        usageType: usageType as UsageType,
        quantity: req.body?.quantity,
        subscriptionId: req.body?.subscription_id ?? null,
        metadata: req.body?.metadata ?? null,
      });
      if (!result.recorded) {
        // FAIL CLOSED — over a declared quota; event not written.
        return res.status(429).json({ error: 'quota_exceeded', quota: result.quota });
      }
      res.status(201).json(result);
    } catch (err) {
      console.error('[metering record]', err);
      res.status(500).json({ error: 'record failed' });
    }
  });

  app.get('/api/commercial/metering/check', ...userReadChain, async (req: any, res) => {
    try {
      const email = resolveEmail(req, req.query?.email);
      const usageType = String(req.query?.usage_type ?? '').trim();
      if (!email) return res.status(400).json({ error: 'email required' });
      if (!isUsageType(usageType)) return res.status(400).json({ error: 'invalid usage_type' });
      const quota = await checkQuota(pool, email, usageType as UsageType);
      res.json(quota);
    } catch (err) {
      console.error('[metering check]', err);
      res.status(500).json({ error: 'check failed' });
    }
  });

  app.get('/api/admin/commercial/metering/overview', ...adminReadChain, async (_req: any, res) => {
    try {
      const overview = await buildUsageOverview(pool);
      res.json(overview);
    } catch (err) {
      console.error('[metering overview]', err);
      res.status(500).json({ error: 'overview failed' });
    }
  });

  // ── Credits dimension (consumable balance via the credit ledger) ───────────────────────────────
  // Spend (draw down) credits. FAIL CLOSED on no customer / insufficient balance (never overdraws).
  app.post('/api/commercial/metering/credits/spend', ...creditWriteChain, async (req: any, res) => {
    try {
      const email = resolveEmail(req, req.body?.email);
      if (!email) return res.status(400).json({ error: 'email required' });
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
      const result = await spendCredits(pool, email, amount, {
        reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
        refType: typeof req.body?.ref_type === 'string' ? req.body.ref_type : null,
        refId: typeof req.body?.ref_id === 'string' ? req.body.ref_id : null,
        metadata: req.body?.metadata ?? null,
      });
      if (!result.spent) {
        const status = result.reason === 'insufficient_balance' ? 402 : 400;
        return res.status(status).json({ error: result.reason, state: result.state });
      }
      res.status(201).json(result);
    } catch (err) {
      console.error('[metering credits spend]', err);
      res.status(500).json({ error: 'spend failed' });
    }
  });

  // Read the current credit balance WITHOUT mutating (read-only: no schema bootstrap).
  app.get('/api/commercial/metering/credits/balance', ...userReadChain, async (req: any, res) => {
    try {
      const email = resolveEmail(req, req.query?.email);
      if (!email) return res.status(400).json({ error: 'email required' });
      const state = await checkCreditDimension(pool, email);
      res.json(state);
    } catch (err) {
      console.error('[metering credits balance]', err);
      res.status(500).json({ error: 'balance failed' });
    }
  });

  // ── Consumption view (all eight dimensions, read-only) ─────────────────────────────────────────
  app.get('/api/commercial/metering/consumption', ...userReadChain, async (req: any, res) => {
    try {
      const email = resolveEmail(req, req.query?.email);
      if (!email) return res.status(400).json({ error: 'email required' });
      const consumption = await buildIdentityConsumption(pool, email);
      res.json(consumption);
    } catch (err) {
      console.error('[metering consumption]', err);
      res.status(500).json({ error: 'consumption failed' });
    }
  });

  // System-wide consumption overview by business dimension (super-admin, read-only).
  app.get('/api/admin/commercial/metering/dimensions', ...adminReadChain, async (_req: any, res) => {
    try {
      const overview = await buildDimensionOverview(pool);
      res.json(overview);
    } catch (err) {
      console.error('[metering dimensions overview]', err);
      res.status(500).json({ error: 'dimensions overview failed' });
    }
  });

  // ── Quota configuration (super-admin) ──────────────────────────────────────────────────────────
  // List every plan with its declared per-dimension quotas (editable business dimensions). Read-only;
  // honest empty catalog when the commercial substrate is absent.
  app.get('/api/admin/commercial/metering/quotas', ...adminReadChain, async (_req: any, res) => {
    try {
      const overview = await listPlanQuotas(pool);
      res.json(overview);
    } catch (err) {
      console.error('[metering quotas list]', err);
      res.status(500).json({ error: 'quotas list failed' });
    }
  });

  // Upsert a plan's declared per-dimension quotas. Touches ONLY comm_plans.metadata.quotas for the
  // editable dimensions; empty/null clears a quota (→ unmetered). Reflects immediately in the
  // consumption view since resolveQuotaWindow reads the plan metadata live.
  app.put('/api/admin/commercial/metering/quotas/:planId', ...adminQuotaWriteChain, async (req: any, res) => {
    try {
      const planId = String(req.params.planId ?? '').trim();
      if (!planId) return res.status(400).json({ error: 'planId required' });
      const quotas = req.body?.quotas;
      if (quotas == null || typeof quotas !== 'object' || Array.isArray(quotas)) {
        return res.status(400).json({ error: 'quotas object required' });
      }
      const result = await upsertPlanQuotas(pool, planId, quotas as Record<string, unknown>);
      if (!result.ok) {
        if (result.reason === 'not_found') return res.status(404).json({ error: 'plan not found' });
        return res.status(400).json({ error: 'invalid quota value (expected a non-negative integer)' });
      }
      res.json({ ok: true, plan: result.plan });
    } catch (err) {
      console.error('[metering quotas upsert]', err);
      res.status(500).json({ error: 'quotas upsert failed' });
    }
  });

  // ── Per-identity quota overrides (super-admin) ─────────────────────────────────────────────────
  // A per-identity override sets a limit for ONE customer + dimension that takes precedence over their
  // plan quota in resolveQuotaWindow (regardless of subscription). Overrides live in the metering schema
  // (comm_usage_overrides), so the write chain uses ensureSchema (ensureMeteringSchema) to bootstrap it.
  const adminOverrideWriteChain = [requireAuth, requireSuperAdmin, requireMeteringFlag, ensureSchema];

  // List every standing override (read-only; honest empty when the substrate is absent).
  app.get('/api/admin/commercial/metering/overrides', ...adminReadChain, async (_req: any, res) => {
    try {
      const overview = await listUsageOverrides(pool);
      res.json(overview);
    } catch (err) {
      console.error('[metering overrides list]', err);
      res.status(500).json({ error: 'overrides list failed' });
    }
  });

  // Set (or replace) a per-identity override. Body: { email, usage_type, limit, note? }. Reflects
  // immediately in the identity's consumption view since resolveQuotaWindow reads the override live.
  app.put('/api/admin/commercial/metering/overrides', ...adminOverrideWriteChain, async (req: any, res) => {
    try {
      const email = String(req.body?.email ?? '').trim();
      const usageType = String(req.body?.usage_type ?? '').trim();
      if (!email) return res.status(400).json({ error: 'email required' });
      if (!isQuotaDimension(usageType)) return res.status(400).json({ error: 'invalid usage_type' });
      const result = await upsertUsageOverride(pool, email, usageType, req.body?.limit, req.body?.note);
      if (!result.ok) return res.status(400).json({ error: 'invalid limit (expected a non-negative integer)' });
      res.json({ ok: true, override: result.override });
    } catch (err) {
      console.error('[metering overrides upsert]', err);
      res.status(500).json({ error: 'overrides upsert failed' });
    }
  });

  // Clear a per-identity override (the identity falls back to their plan quota). Reads email + usage_type
  // from the body OR the query string (DELETE clients differ on body support).
  app.delete('/api/admin/commercial/metering/overrides', ...adminOverrideWriteChain, async (req: any, res) => {
    try {
      const email = String(req.body?.email ?? req.query?.email ?? '').trim();
      const usageType = String(req.body?.usage_type ?? req.query?.usage_type ?? '').trim();
      if (!email) return res.status(400).json({ error: 'email required' });
      if (!isQuotaDimension(usageType)) return res.status(400).json({ error: 'invalid usage_type' });
      const result = await deleteUsageOverride(pool, email, usageType);
      res.json({ ok: true, deleted: result.deleted });
    } catch (err) {
      console.error('[metering overrides delete]', err);
      res.status(500).json({ error: 'overrides delete failed' });
    }
  });

  // System-wide consumption TREND over time by business dimension (super-admin, read-only).
  // ?granularity=week|month (default week) & ?periods=N (1..52, default 8 weeks / 6 months).
  app.get('/api/admin/commercial/metering/trends', ...adminReadChain, async (req: any, res) => {
    try {
      const trend = await buildUsageTrend(pool, {
        granularity: typeof req.query?.granularity === 'string' ? req.query.granularity : undefined,
        periods: req.query?.periods,
      });
      res.json(trend);
    } catch (err) {
      console.error('[metering trends]', err);
      res.status(500).json({ error: 'trends failed' });
    }
  });
}
