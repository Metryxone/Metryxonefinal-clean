/**
 * Phase 6.12 — Partner Ecosystem · referral deal-value auto-resolution guard tests.
 *
 * Locks the behaviour shipped in Task #41 (auto-resolution of a referred tenant's realized deal value is
 * the DEFAULT on conversion) so a regression in the resolver, the route's link_deal tri-state handling,
 * or the write path cannot silently reopen the "converted with no deal value / no payout" gap that
 * Task #37 had to backfill.
 *
 * Pure, DB-free: a configurable fake pg.Pool answers exactly the queries transitionReferral /
 * createChannelReferral / resolveReferredTenantDealValue issue (tenant existence + contact_email,
 * the two realized-revenue ledgers, the current referral row) and parses the dynamic INSERT/UPDATE so
 * the returned row reflects what was actually written. ensure-schema DDL is a no-op.
 *
 * Run with:  cd backend && npx tsx --test tests/partner-ecosystem-referral-deal-value.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createChannelReferral,
  transitionReferral,
} from '../services/tenant/partner-ecosystem-actions';
import { registerMultiTenantArchitectureRoutes } from '../routes/multi-tenant-architecture';

// ── Configurable fake pg.Pool ───────────────────────────────────────────────
// A scenario describes the live world the helpers read: which tenants exist (+ their contact_email),
// how much realized revenue each email has in each ledger, and the current referral row (for transitions).

interface TenantRow { email: string | null }
interface Scenario {
  tenants: Record<number, TenantRow>;
  /** recurring (comm_subscription_events) revenue in PAISE, keyed by lowercased email */
  recurringPaise: Record<string, number>;
  /** one-time (capadex_payments) revenue in PAISE, keyed by lowercased email */
  onetimePaise: Record<string, number>;
  /** the referral row returned by the "current referral" SELECT in transitionReferral */
  referralRow: Record<string, any> | null;
  /** when true, the INSERT in createChannelReferral throws a unique-violation */
  insertDuplicate?: boolean;
}

function normWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

class FakePool {
  scenario: Scenario;
  /** every (text, params) issued — lets tests assert what was (not) written */
  captured: { text: string; params: any[] }[] = [];

  constructor(scenario: Scenario) {
    this.scenario = scenario;
  }

  async query(text: string, params: any[] = []): Promise<any> {
    this.captured.push({ text, params });
    const s = normWs(text).toLowerCase();
    const sc = this.scenario;

    // to_regclass probe → report all referenced tables present so the resolver reads both ledgers.
    if (s.includes('to_regclass')) {
      const name = String(params[0] ?? '').replace(/^public\./, '');
      return { rows: [{ reg: name || null }], rowCount: 1 };
    }

    // tenant existence: SELECT 1 FROM tenants WHERE id = $1
    if (s.startsWith('select 1 from tenants where id =')) {
      const id = Number(params[0]);
      return { rows: id in sc.tenants ? [{ '?column?': 1 }] : [], rowCount: id in sc.tenants ? 1 : 0 };
    }

    // tenant contact_email: SELECT contact_email FROM tenants WHERE id = $1
    if (s.startsWith('select contact_email from tenants where id =')) {
      const id = Number(params[0]);
      const t = sc.tenants[id];
      return { rows: t ? [{ contact_email: t.email }] : [], rowCount: t ? 1 : 0 };
    }

    // recurring ledger sum
    if (s.includes('from comm_subscription_events')) {
      const email = String(params[0] ?? '').toLowerCase();
      return { rows: [{ paise: sc.recurringPaise[email] ?? 0 }], rowCount: 1 };
    }

    // one-time ledger sum
    if (s.includes('from capadex_payments')) {
      const email = String(params[0] ?? '').toLowerCase();
      return { rows: [{ paise: sc.onetimePaise[email] ?? 0 }], rowCount: 1 };
    }

    // current referral row for a transition
    if (s.startsWith('select id, status, channel_partner_tenant_id') && s.includes('from tenant_channel_referrals')) {
      return sc.referralRow
        ? { rows: [{ ...sc.referralRow }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }

    // INSERT (createChannelReferral) — parse the column list and map to params, return the written row.
    if (s.startsWith('insert into tenant_channel_referrals')) {
      if (sc.insertDuplicate) {
        const err: any = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }
      const cols = normWs(text).match(/insert into tenant_channel_referrals\s*\(([^)]+)\)/i)?.[1] ?? '';
      const columns = cols.split(',').map((c) => c.trim());
      const row: Record<string, any> = { id: 999, referred_at: new Date() };
      columns.forEach((c, idx) => { row[c] = params[idx]; });
      return { rows: [row], rowCount: 1 };
    }

    // UPDATE (transitionReferral) — parse the SET clause, merge over the current row, return it.
    if (s.startsWith('update tenant_channel_referrals set')) {
      const setClause = normWs(text).match(/set\s+(.*?)\s+where\s+id\s*=/i)?.[1] ?? '';
      const row: Record<string, any> = { ...(sc.referralRow ?? {}), id: Number(params[params.length - 1]) };
      for (const frag of setClause.split(',')) {
        const m = frag.match(/(\w+)\s*=\s*\$(\d+)/);
        if (m) row[m[1]] = params[Number(m[2]) - 1];
      }
      return { rows: [row], rowCount: 1 };
    }

    // ensure-schema DDL, agreement-event inserts, anything else → harmless no-op.
    return { rows: [], rowCount: 0 };
  }
}

/** A standard partner(1) → referred-tenant(2) world; tenant 2 has realized revenue unless overridden. */
function baseScenario(over: Partial<Scenario> = {}): Scenario {
  return {
    tenants: { 1: { email: 'partner@example.com' }, 2: { email: 'referred@example.com' } },
    recurringPaise: { 'referred@example.com': 50000 }, // ₹500 recurring
    onetimePaise: {},
    referralRow: null,
    ...over,
  };
}

function pendingReferral(extra: Record<string, any> = {}): Record<string, any> {
  return {
    id: 5,
    status: 'pending',
    channel_partner_tenant_id: 1,
    referred_tenant_id: 2,
    commission_pct: 10,
    currency: 'INR',
    ...extra,
  };
}

// ─── transitionReferral: auto-resolution is the default ──────────────────────

test('transition → converted with realized revenue and no deal_value auto-links from the ledger (not manual)', async () => {
  const sc = baseScenario({ referralRow: pendingReferral() });
  const pool = new FakePool(sc) as any;

  const out = await transitionReferral(pool, 5, 'converted', {}); // link_deal undefined → auto-resolve

  assert.equal(out.deal_value, 500, 'deal value resolved from the recurring ledger (₹500)');
  assert.equal(out.deal_value_source, 'comm_subscriptions', 'provenance is the ledger, NOT manual');
  assert.notEqual(out.deal_value_source, 'manual');
  // payout auto-derives as pct × deal_value: 10% of ₹500 = ₹50.
  assert.equal(out.commission_amount, 50);
  assert.equal(out.commission_amount_source, 'derived');
});

test('transition → converted auto-resolves combined recurring + one-time revenue (linked_ledger)', async () => {
  const sc = baseScenario({
    referralRow: pendingReferral(),
    recurringPaise: { 'referred@example.com': 30000 }, // ₹300
    onetimePaise: { 'referred@example.com': 20000 },   // ₹200
  });
  const pool = new FakePool(sc) as any;

  const out = await transitionReferral(pool, 5, 'converted', {});
  assert.equal(out.deal_value, 500, '₹300 + ₹200 summed across ledgers');
  assert.equal(out.deal_value_source, 'linked_ledger', 'two ledgers contributed → linked_ledger provenance');
});

// ─── transitionReferral: opt-out / explicit / honest-gap paths ───────────────

test('transition → converted with link_deal:false does NOT auto-resolve even when revenue exists', async () => {
  const sc = baseScenario({ referralRow: pendingReferral() });
  const pool = new FakePool(sc) as any;

  const out = await transitionReferral(pool, 5, 'converted', { link_deal: false });

  // Nothing should have been written for deal_value/source.
  const update = pool.captured.find((q: any) => /update tenant_channel_referrals set/i.test(q.text));
  assert.ok(update, 'an UPDATE was issued');
  assert.ok(!/deal_value\s*=/i.test(normWs(update.text)), 'deal_value column is NOT in the SET clause');
  assert.ok(!/deal_value_source\s*=/i.test(normWs(update.text)), 'deal_value_source is NOT in the SET clause');
  // and with no deal value there is no auto-derived commission either.
  assert.ok(!/commission_amount\s*=/i.test(normWs(update.text)), 'no derived commission written');
  assert.equal(out.deal_value_source, undefined, 'no ledger provenance fabricated');
});

test('transition → converted with explicit deal_value records it as manual (wins over the ledger)', async () => {
  const sc = baseScenario({ referralRow: pendingReferral() });
  const pool = new FakePool(sc) as any;

  const out = await transitionReferral(pool, 5, 'converted', { deal_value: 1000 });

  assert.equal(out.deal_value, 1000, 'explicit operator value used verbatim');
  assert.equal(out.deal_value_source, 'manual', 'explicit value is tagged manual, not the ledger');
  assert.equal(out.commission_amount, 100, '10% of ₹1000 derived');
  assert.equal(out.commission_amount_source, 'derived');
});

test('transition → converted for a tenant with NO realized revenue stays an honest gap (null, never fabricated)', async () => {
  const sc = baseScenario({
    referralRow: pendingReferral(),
    recurringPaise: {},
    onetimePaise: {},
  });
  const pool = new FakePool(sc) as any;

  const out = await transitionReferral(pool, 5, 'converted', {}); // default auto-resolve, but nothing to find

  const update = pool.captured.find((q: any) => /update tenant_channel_referrals set/i.test(q.text));
  assert.ok(!/deal_value\s*=/i.test(normWs(update!.text)), 'no deal_value written when none is real');
  assert.equal(out.deal_value_source, undefined, 'no provenance invented for an empty ledger');
});

// ─── createChannelReferral: same coverage when created already converted ─────

test('create (status converted) with realized revenue + no deal_value auto-links from the ledger', async () => {
  const sc = baseScenario();
  const pool = new FakePool(sc) as any;

  const out = await createChannelReferral(pool, {
    channel_partner_tenant_id: 1,
    referred_tenant_id: 2,
    referral_code: 'REF-AUTO',
    commission_pct: 10,
    status: 'converted',
  });

  assert.equal(out.deal_value, 500);
  assert.equal(out.deal_value_source, 'comm_subscriptions');
  assert.notEqual(out.deal_value_source, 'manual');
  assert.equal(out.commission_amount, 50);
  assert.equal(out.commission_amount_source, 'derived');
});

test('create (status converted) with link_deal:false opts out of auto-resolution', async () => {
  const sc = baseScenario();
  const pool = new FakePool(sc) as any;

  const out = await createChannelReferral(pool, {
    channel_partner_tenant_id: 1,
    referred_tenant_id: 2,
    referral_code: 'REF-OPTOUT',
    commission_pct: 10,
    status: 'converted',
    link_deal: false,
  });

  assert.equal(out.deal_value, null, 'no deal value linked');
  assert.equal(out.deal_value_source, null, 'no provenance set');
  assert.equal(out.commission_amount, null, 'no derived commission without a deal value');
});

test('create (status converted) with explicit deal_value is recorded as manual', async () => {
  const sc = baseScenario();
  const pool = new FakePool(sc) as any;

  const out = await createChannelReferral(pool, {
    channel_partner_tenant_id: 1,
    referred_tenant_id: 2,
    referral_code: 'REF-MANUAL',
    commission_pct: 10,
    status: 'converted',
    deal_value: 2000,
  });

  assert.equal(out.deal_value, 2000);
  assert.equal(out.deal_value_source, 'manual');
  assert.equal(out.commission_amount, 200, '10% of ₹2000');
  assert.equal(out.commission_amount_source, 'derived');
});

test('create (status converted) for a tenant with no revenue stays an honest gap', async () => {
  const sc = baseScenario({ recurringPaise: {}, onetimePaise: {} });
  const pool = new FakePool(sc) as any;

  const out = await createChannelReferral(pool, {
    channel_partner_tenant_id: 1,
    referred_tenant_id: 2,
    referral_code: 'REF-GAP',
    commission_pct: 10,
    status: 'converted',
  });

  assert.equal(out.deal_value, null, 'null, never fabricated');
  assert.equal(out.deal_value_source, null);
});

test('create with status pending does NOT auto-resolve a deal value (only on conversion)', async () => {
  const sc = baseScenario();
  const pool = new FakePool(sc) as any;

  const out = await createChannelReferral(pool, {
    channel_partner_tenant_id: 1,
    referred_tenant_id: 2,
    referral_code: 'REF-PENDING',
    commission_pct: 10,
    // status omitted → defaults to pending
  });

  assert.equal(out.status, 'pending');
  assert.equal(out.deal_value, null, 'no deal value resolved while pending');
  assert.equal(out.deal_value_source, null);
});

// ─── Route layer: link_deal tri-state is preserved (undefined ≠ false) ───────
// Capture the real transition route handler and exercise it with a fake req/res + the fake pool, proving
// the route maps an ABSENT link_deal to undefined (auto-resolve) and false to an explicit opt-out — and
// never coerces undefined into false.

function captureReferralTransitionHandler(pool: any) {
  const noop: any = (_req: any, _res: any, next?: any) => (next ? next() : undefined);
  let handler: any = null;
  const fakeApp: any = {
    use: () => {},
    get: () => {},
    post: (path: string, ...handlers: any[]) => {
      if (path.endsWith('/partner-ecosystem/referrals/:id/transition')) {
        handler = handlers[handlers.length - 1];
      }
    },
  };
  registerMultiTenantArchitectureRoutes(fakeApp, pool, noop, noop);
  assert.ok(handler, 'referral transition route handler was registered');
  return handler;
}

async function invoke(handler: any, body: any) {
  const req: any = { params: { id: '5' }, body };
  let captured: any = null;
  let statusCode = 200;
  const res: any = {
    status(code: number) { statusCode = code; return res; },
    json(payload: any) { captured = payload; return res; },
  };
  await handler(req, res);
  return { status: statusCode, body: captured };
}

test('route: ABSENT link_deal → undefined → auto-resolves on conversion (not coerced to false)', async () => {
  const sc = baseScenario({ referralRow: pendingReferral() });
  const pool = new FakePool(sc) as any;
  const handler = captureReferralTransitionHandler(pool);

  const { body } = await invoke(handler, { status: 'converted' }); // no link_deal key at all

  assert.equal(body.deal_value, 500, 'undefined link_deal still auto-resolves — proves no coercion to false');
  assert.equal(body.deal_value_source, 'comm_subscriptions');
});

test('route: link_deal:false → explicit opt-out, no auto-resolution', async () => {
  const sc = baseScenario({ referralRow: pendingReferral() });
  const pool = new FakePool(sc) as any;
  const handler = captureReferralTransitionHandler(pool);

  const { body } = await invoke(handler, { status: 'converted', link_deal: false });

  assert.equal(body.deal_value_source, undefined, 'opt-out honored — no ledger provenance');
});

test('route: link_deal:true → forces auto-resolution on conversion', async () => {
  const sc = baseScenario({ referralRow: pendingReferral() });
  const pool = new FakePool(sc) as any;
  const handler = captureReferralTransitionHandler(pool);

  const { body } = await invoke(handler, { status: 'converted', link_deal: true });

  assert.equal(body.deal_value, 500);
  assert.equal(body.deal_value_source, 'comm_subscriptions');
});
