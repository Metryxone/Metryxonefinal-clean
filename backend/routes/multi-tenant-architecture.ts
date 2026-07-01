/**
 * Phase 6.11 — Multi-Tenant Architecture console routes (flag `tenantManagementConsole`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY console, super-admin only.
 *
 *   GET  /api/admin/tenant-architecture/console/ping          — FE tab gating probe (200/503)
 *   GET  /api/admin/tenant-architecture/console/management    — unified 5-category tenant management view
 *   GET  /api/admin/tenant-architecture/console/isolation     — tenant_id coverage audit + renormalized index
 *   GET  /api/admin/tenant-architecture/console/configuration — branding/permissions/tier/seat-cap config
 *   GET  /api/admin/tenant-architecture/console/enforcement   — opt-in RLS enforcement status (read-only)
 *   GET  /api/admin/tenant-architecture/console/validation    — PASS/WARN/FAIL honesty harness
 *   POST /api/admin/tenant-architecture/console/setup         — ensure relationship schema (DDL — write path)
 *   POST /api/admin/tenant-architecture/console/enforcement/arm    — arm RLS on additive tables (sub-flag gated)
 *   POST /api/admin/tenant-architecture/console/enforcement/disarm — reverse arming (restore byte-identical)
 *
 * GET-NEVER-WRITES: read engines probe table existence with to_regclass and degrade to honest empties;
 * DDL (relationship schema ensure + RLS arm) lives ONLY on the explicit POST paths. The global
 * `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate fronts every route here (unauth → 401).
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildTenantManagement } from '../services/tenant/tenant-management-engine';
import { buildTenantIsolationAudit } from '../services/tenant/tenant-isolation-engine';
import { buildTenantConfiguration } from '../services/tenant/tenant-configuration-engine';
import { buildTenantValidation } from '../services/tenant/tenant-validation-view';
import {
  getEnforcementStatus,
  armTenantIsolationEnforcement,
  disarmTenantIsolationEnforcement,
} from '../services/tenant/tenant-isolation-enforcement';
import { ensureTenantRelationshipSchema } from '../services/tenant/tenant-relationship-schema';
import { ensurePartnerEcosystemSchema } from '../services/tenant/partner-ecosystem-schema';
import { buildPartnerEcosystem, buildUnlinkableReferrals, type PartnerEcosystemFilter } from '../services/tenant/partner-ecosystem-engine';
import { buildPartnerEcosystemValidation } from '../services/tenant/partner-ecosystem-validation';
import {
  upsertPartnerAgreement,
  transitionAgreement,
  listAgreementEvents,
  createChannelReferral,
  transitionReferral,
  resolveReferralDealValue,
  setReferralReferredTenantEmail,
  PartnerActionError,
  PARTNER_TYPES,
  AGREEMENT_STATUSES,
  AGREEMENT_TRANSITIONS,
  REFERRAL_STATUSES,
  REFERRAL_TRANSITIONS,
} from '../services/tenant/partner-ecosystem-actions';
import {
  isTenantManagementConsoleEnabled,
  isTenantIsolationEnforcementEnabled,
  isPartnerEcosystemEnabled,
} from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerMultiTenantArchitectureRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isTenantManagementConsoleEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'tenantManagementConsole' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  app.get('/api/admin/tenant-architecture/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/tenant-architecture/console/management', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantManagement(pool));
    } catch (err) {
      console.error('[multi-tenant management]', err);
      res.status(500).json({ error: 'management failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/isolation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantIsolationAudit(pool));
    } catch (err) {
      console.error('[multi-tenant isolation]', err);
      res.status(500).json({ error: 'isolation failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/configuration', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantConfiguration(pool));
    } catch (err) {
      console.error('[multi-tenant configuration]', err);
      res.status(500).json({ error: 'configuration failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/enforcement', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await getEnforcementStatus(pool));
    } catch (err) {
      console.error('[multi-tenant enforcement status]', err);
      res.status(500).json({ error: 'enforcement status failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/validation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantValidation(pool));
    } catch (err) {
      console.error('[multi-tenant validation]', err);
      res.status(500).json({ error: 'validation failed' });
    }
  });

  // ── Write paths (DDL / RLS) — explicit POST only ─────────────────────────────
  app.post('/api/admin/tenant-architecture/console/setup', ...adminReadChain, async (_req: any, res) => {
    try {
      await ensureTenantRelationshipSchema(pool);
      res.json({ ok: true, message: 'Relationship schema ensured.' });
    } catch (err) {
      console.error('[multi-tenant setup]', err);
      res.status(500).json({ error: 'setup failed' });
    }
  });

  app.post('/api/admin/tenant-architecture/console/enforcement/arm', ...adminReadChain, async (_req: any, res) => {
    if (!isTenantIsolationEnforcementEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'tenantIsolationEnforcement' });
    }
    try {
      res.json(await armTenantIsolationEnforcement(pool));
    } catch (err) {
      console.error('[multi-tenant enforcement arm]', err);
      res.status(500).json({ error: 'arm failed' });
    }
  });

  app.post('/api/admin/tenant-architecture/console/enforcement/disarm', ...adminReadChain, async (_req: any, res) => {
    if (!isTenantIsolationEnforcementEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'tenantIsolationEnforcement' });
    }
    try {
      res.json(await disarmTenantIsolationEnforcement(pool));
    } catch (err) {
      console.error('[multi-tenant enforcement disarm]', err);
      res.status(500).json({ error: 'disarm failed' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Phase 6.12 — Partner Ecosystem (flag `partnerEcosystem`, default OFF → every route 503s →
  // byte-identical legacy). Reads are GET-never-writes (engine probes to_regclass, no DDL); the
  // lifecycle write paths are explicit POSTs that run the (flag-gated) lazy ensure-schema.
  // ══════════════════════════════════════════════════════════════════════════════
  const requirePartnerFlag: GuardMW = (_req, res, next) => {
    if (!isPartnerEcosystemEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'partnerEcosystem' });
    }
    next();
  };
  // Partner routes use the global super-admin chain plus their own flag (independent of the console flag).
  const partnerChain = [requireAuth, requireSuperAdmin, requirePartnerFlag];

  const handlePartnerError = (err: any, res: any, label: string) => {
    if (err instanceof PartnerActionError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error(`[partner-ecosystem ${label}]`, err);
    return res.status(500).json({ error: `${label} failed` });
  };

  // CSV serialization helper — neutralises spreadsheet formula injection + quotes special chars.
  const csvEscape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const sendCsv = (res: any, filename: string, header: string[], rows: any[]) => {
    const lines = [header.map(csvEscape).join(',')];
    for (const r of rows) lines.push(header.map((h) => csvEscape(r[h])).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines.join('\n'));
  };
  const csvStamp = () => new Date().toISOString().slice(0, 10);

  // ── Reads (literal sub-paths registered before any /:id param routes) ──────────
  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/ping', ...partnerChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/meta', ...partnerChain, (_req: any, res) => {
    res.json({
      partner_types: PARTNER_TYPES,
      agreement_statuses: AGREEMENT_STATUSES,
      agreement_transitions: AGREEMENT_TRANSITIONS,
      referral_statuses: REFERRAL_STATUSES,
      referral_transitions: REFERRAL_TRANSITIONS,
    });
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/validation', ...partnerChain, async (_req: any, res) => {
    try {
      res.json(await buildPartnerEcosystemValidation(pool));
    } catch (err) {
      handlePartnerError(err, res, 'validation');
    }
  });

  // ── CSV exports (literal sub-paths — MUST be registered before /agreements/:id and /referrals/:id) ──
  // Optional, additive query params ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=... filter rows for periodic
  // reporting. Absent params = full export (byte-identical to before). Read-only — never fabricates.
  const exportFilter = (req: any): PartnerEcosystemFilter => ({
    from: typeof req.query?.from === 'string' ? req.query.from : null,
    to: typeof req.query?.to === 'string' ? req.query.to : null,
    status: typeof req.query?.status === 'string' ? req.query.status : null,
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/agreements/export.csv', ...partnerChain, async (req: any, res) => {
    try {
      const eco = await buildPartnerEcosystem(pool, exportFilter(req));
      const header = ['id', 'agreement_code', 'tenant_id', 'tenant_name', 'tenant_code', 'partner_type',
        'status', 'commission_pct', 'start_date', 'end_date', 'updated_at'];
      sendCsv(res, `partner_agreements_${csvStamp()}.csv`, header, eco.agreements);
    } catch (err) {
      handlePartnerError(err, res, 'agreements export');
    }
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/referrals/export.csv', ...partnerChain, async (req: any, res) => {
    try {
      const eco = await buildPartnerEcosystem(pool, exportFilter(req));
      const header = ['id', 'referral_code', 'channel_partner_tenant_id', 'channel_partner_name',
        'referred_tenant_id', 'referred_tenant_name', 'status', 'commission_pct', 'commission_amount',
        'currency', 'referred_at', 'converted_at'];
      sendCsv(res, `partner_referrals_${csvStamp()}.csv`, header, eco.referrals);
    } catch (err) {
      handlePartnerError(err, res, 'referrals export');
    }
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/payouts/export.csv', ...partnerChain, async (req: any, res) => {
    try {
      const eco = await buildPartnerEcosystem(pool, exportFilter(req));
      const header = ['channel_partner_tenant_id', 'channel_partner_name', 'referrals_total', 'converted',
        'pending', 'expired', 'rejected', 'earned_commission', 'currencies', 'converted_without_amount'];
      const rows = eco.payouts.map((p) => ({ ...p, currencies: p.currencies.join('/') }));
      sendCsv(res, `partner_payouts_${csvStamp()}.csv`, header, rows);
    } catch (err) {
      handlePartnerError(err, res, 'payouts export');
    }
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/agreements/:id/events', ...partnerChain, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    try {
      res.json({ events: await listAgreementEvents(pool, id) });
    } catch (err) {
      handlePartnerError(err, res, 'agreement events');
    }
  });

  // Honest coverage gap: converted referrals with a referred tenant but no deal value / amount, each
  // diagnosed (no_email vs no_realized_revenue vs linkable) so an admin can act. READ-ONLY (literal —
  // registered before /referrals/:id param routes).
  app.get('/api/admin/tenant-architecture/console/partner-ecosystem/referrals/unlinkable', ...partnerChain, async (_req: any, res) => {
    try {
      res.json(await buildUnlinkableReferrals(pool));
    } catch (err) {
      handlePartnerError(err, res, 'unlinkable referrals');
    }
  });

  app.get('/api/admin/tenant-architecture/console/partner-ecosystem', ...partnerChain, async (_req: any, res) => {
    try {
      res.json(await buildPartnerEcosystem(pool));
    } catch (err) {
      handlePartnerError(err, res, 'overview');
    }
  });

  // ── Writes (explicit POST — DDL via ensure-schema runs here, flag-gated) ───────
  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/setup', ...partnerChain, async (_req: any, res) => {
    try {
      await ensurePartnerEcosystemSchema(pool);
      res.json({ ok: true, message: 'Partner ecosystem schema ensured.' });
    } catch (err) {
      handlePartnerError(err, res, 'setup');
    }
  });

  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/agreements', ...partnerChain, async (req: any, res) => {
    try {
      const actor = req.user?.email ?? req.session?.user?.email ?? null;
      res.json(await upsertPartnerAgreement(pool, req.body ?? {}, actor));
    } catch (err) {
      handlePartnerError(err, res, 'upsert agreement');
    }
  });

  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/agreements/:id/transition', ...partnerChain, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    try {
      const actor = req.user?.email ?? req.session?.user?.email ?? null;
      const { status, note } = req.body ?? {};
      res.json(await transitionAgreement(pool, id, String(status ?? ''), { note: note ?? null, actor }));
    } catch (err) {
      handlePartnerError(err, res, 'transition agreement');
    }
  });

  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/referrals', ...partnerChain, async (req: any, res) => {
    try {
      res.json(await createChannelReferral(pool, req.body ?? {}));
    } catch (err) {
      handlePartnerError(err, res, 'create referral');
    }
  });

  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/referrals/:id/transition', ...partnerChain, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    try {
      const { status, commission_amount, referred_tenant_id, deal_value, link_deal } = req.body ?? {};
      res.json(await transitionReferral(pool, id, String(status ?? ''), {
        commission_amount: commission_amount === undefined ? undefined : commission_amount,
        referred_tenant_id: referred_tenant_id === undefined ? undefined : referred_tenant_id,
        deal_value: deal_value === undefined ? undefined : deal_value,
        // Tri-state: undefined → auto-resolve (the default on conversion); false → explicit opt-out; true → force.
        link_deal: link_deal === undefined ? undefined : link_deal === true,
      }));
    } catch (err) {
      handlePartnerError(err, res, 'transition referral');
    }
  });

  // Resolve a missing deal value on an ALREADY-converted referral (from the unlinkable-referrals view):
  // an explicit deal_value (manual), or link_deal=true to auto-resolve from the referred tenant's ledgers.
  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/referrals/:id/resolve-deal-value', ...partnerChain, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    try {
      const { deal_value, link_deal } = req.body ?? {};
      res.json(await resolveReferralDealValue(pool, id, {
        deal_value: deal_value === undefined ? undefined : deal_value,
        link_deal: link_deal === true,
      }));
    } catch (err) {
      handlePartnerError(err, res, 'resolve referral deal value');
    }
  });

  // Attach/correct the referred tenant's contact email on an already-converted referral (from the
  // unlinkable-referrals view): writes tenants.contact_email so the conversion becomes auto-linkable,
  // then re-diagnoses the row. WRITE PATH (ensure-schema via the helper), never fabricates.
  app.post('/api/admin/tenant-architecture/console/partner-ecosystem/referrals/:id/referred-email', ...partnerChain, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    try {
      const { contact_email } = req.body ?? {};
      res.json(await setReferralReferredTenantEmail(pool, id, contact_email));
    } catch (err) {
      handlePartnerError(err, res, 'set referred tenant email');
    }
  });
}
