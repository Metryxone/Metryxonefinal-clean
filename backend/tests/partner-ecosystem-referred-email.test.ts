/**
 * Phase 6.12 — Partner Ecosystem · referred-tenant email attach/correct guard tests.
 *
 * Locks the negative paths of the "Unlinkable Converted Referrals" fix (setReferralReferredTenantEmail +
 * the POST .../partner-ecosystem/referrals/:id/referred-email route). Admins can attach/correct a
 * referred tenant's contact_email to make a converted referral auto-linkable; a regression could let a
 * malformed email through, write to a referral with no referred tenant / a non-existent tenant, or fail
 * to re-diagnose the row afterward — all of which quietly reopen the revenue-linkage gap.
 *
 * Two layers, both DB-free:
 *   1. Validation layer — a configurable fake pg.Pool answers exactly the queries the write helper issues
 *      (current referral row, tenant existence + contact_email, the UPDATE that persists the email, and
 *      the two realized-revenue ledgers the re-diagnosis reads). The route handler is captured directly so
 *      each negative path returns the right status/code and the happy path writes tenants.contact_email
 *      and returns an honest re-diagnosis (no_email → no_realized_revenue OR linkable).
 *   2. Flag-gate + CSRF layer — an ephemeral HTTP app mounts the REAL csrfProtection() middleware plus the
 *      real partner flag gate, proving partnerEcosystem OFF → 503, a cookie-authenticated POST with no
 *      CSRF token → 403, and (flag ON + valid token) the mutation reaches the handler.
 *
 * Run with:  cd backend && npx tsx --test tests/partner-ecosystem-referred-email.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';

import { setReferralReferredTenantEmail } from '../services/tenant/partner-ecosystem-actions';
import { registerMultiTenantArchitectureRoutes } from '../routes/multi-tenant-architecture';
import { csrfProtection, CSRF_COOKIE, CSRF_HEADER } from '../lib/csrf';

// ── Configurable fake pg.Pool ───────────────────────────────────────────────
// A scenario describes the live world the helper reads: the current referral row (status +
// referred_tenant_id), which tenants exist (+ contact_email), and each tenant's realized revenue in the
// two ledgers (for the post-write re-diagnosis). The UPDATE mutates the scenario so the re-diagnosis sees
// the freshly-written email — exactly as the real DB would.

interface TenantRow { email: string | null }
interface Scenario {
  /** the referral row returned by the "current referral" SELECT (null → not found) */
  referralRow: Record<string, any> | null;
  tenants: Record<number, TenantRow>;
  /** recurring (comm_subscription_events) revenue in PAISE, keyed by lowercased email */
  recurringPaise: Record<string, number>;
  /** one-time (capadex_payments) revenue in PAISE, keyed by lowercased email */
  onetimePaise: Record<string, number>;
}

function normWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

class FakePool {
  scenario: Scenario;
  captured: { text: string; params: any[] }[] = [];

  constructor(scenario: Scenario) {
    this.scenario = scenario;
  }

  async query(text: string, params: any[] = []): Promise<any> {
    this.captured.push({ text, params });
    const s = normWs(text).toLowerCase();
    const sc = this.scenario;

    // to_regclass probe → report every referenced table present so the ledgers are read.
    if (s.includes('to_regclass')) {
      const name = String(params[0] ?? '').replace(/^public\./, '');
      return { rows: [{ reg: name || null }], rowCount: 1 };
    }

    // current referral row: SELECT id, status, referred_tenant_id FROM tenant_channel_referrals WHERE id = $1
    if (s.startsWith('select id, status, referred_tenant_id') && s.includes('from tenant_channel_referrals')) {
      return sc.referralRow
        ? { rows: [{ ...sc.referralRow }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }

    // tenant existence: SELECT 1 FROM tenants WHERE id = $1
    if (s.startsWith('select 1 from tenants where id =')) {
      const id = Number(params[0]);
      const present = id in sc.tenants;
      return { rows: present ? [{ '?column?': 1 }] : [], rowCount: present ? 1 : 0 };
    }

    // tenant contact_email: SELECT contact_email FROM tenants WHERE id = $1
    if (s.startsWith('select contact_email from tenants where id =')) {
      const id = Number(params[0]);
      const t = sc.tenants[id];
      return { rows: t ? [{ contact_email: t.email }] : [], rowCount: t ? 1 : 0 };
    }

    // persist the email: UPDATE tenants SET contact_email = $1 WHERE id = $2 → mutate the scenario.
    if (s.startsWith('update tenants set contact_email =')) {
      const id = Number(params[1]);
      if (sc.tenants[id]) sc.tenants[id].email = params[0];
      else sc.tenants[id] = { email: params[0] };
      return { rows: [], rowCount: 1 };
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

    // ensure-schema DDL and anything else → harmless no-op.
    return { rows: [], rowCount: 0 };
  }
}

/** A converted referral (id 5) pointing at referred tenant 2, which starts WITH NO email (the gap). */
function convertedReferralScenario(over: Partial<Scenario> = {}): Scenario {
  return {
    referralRow: { id: 5, status: 'converted', referred_tenant_id: 2 },
    tenants: { 1: { email: 'partner@example.com' }, 2: { email: null } },
    recurringPaise: {},
    onetimePaise: {},
    ...over,
  };
}

// ── Capture the real referred-email route handler ────────────────────────────

function captureReferredEmailHandler(pool: any) {
  const noop: any = (_req: any, _res: any, next?: any) => (next ? next() : undefined);
  let handler: any = null;
  const fakeApp: any = {
    use: () => {},
    get: () => {},
    post: (path: string, ...handlers: any[]) => {
      if (path.endsWith('/partner-ecosystem/referrals/:id/referred-email')) {
        handler = handlers[handlers.length - 1];
      }
    },
  };
  registerMultiTenantArchitectureRoutes(fakeApp, pool, noop, noop);
  assert.ok(handler, 'referred-email route handler was registered');
  return handler;
}

async function invoke(handler: any, id: string, body: any) {
  const req: any = { params: { id }, body };
  let captured: any = null;
  let statusCode = 200;
  const res: any = {
    status(code: number) { statusCode = code; return res; },
    json(payload: any) { captured = payload; return res; },
  };
  await handler(req, res);
  return { status: statusCode, body: captured };
}

// ─── Validation layer: negative paths ────────────────────────────────────────

test('missing contact_email → 400 invalid_input (no email fabricated)', async () => {
  const pool = new FakePool(convertedReferralScenario()) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '5', {}); // no contact_email key

  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_input');
  // nothing was written to tenants.
  assert.ok(!pool.captured.some((q: any) => /update tenants set contact_email/i.test(q.text)), 'no email persisted');
});

test('malformed contact_email → 400 invalid_input (garbage rejected)', async () => {
  const pool = new FakePool(convertedReferralScenario()) as any;
  const handler = captureReferredEmailHandler(pool);

  for (const bad of ['not-an-email', 'foo@bar', '@no-local.com', 'spaces in@x.com', 'a@b@c.com']) {
    const { status, body } = await invoke(handler, '5', { contact_email: bad });
    assert.equal(status, 400, `"${bad}" should be rejected`);
    assert.equal(body.error, 'invalid_input', `"${bad}" → invalid_input`);
  }
  assert.ok(!pool.captured.some((q: any) => /update tenants set contact_email/i.test(q.text)), 'no bad email persisted');
});

test('referral with no referred tenant → 400 invalid_input', async () => {
  const sc = convertedReferralScenario({ referralRow: { id: 5, status: 'converted', referred_tenant_id: null } });
  const pool = new FakePool(sc) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '5', { contact_email: 'valid@example.com' });

  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_input');
  assert.match(String(body.message), /no referred tenant/i);
});

test('non-existent referral → 404 not_found', async () => {
  const pool = new FakePool(convertedReferralScenario({ referralRow: null })) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '404', { contact_email: 'valid@example.com' });

  assert.equal(status, 404);
  assert.equal(body.error, 'not_found');
});

test('non-integer id → 400 invalid_id (route guard, before the helper)', async () => {
  const pool = new FakePool(convertedReferralScenario()) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, 'abc', { contact_email: 'valid@example.com' });

  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_id');
});

test('referral that is not converted → 400 invalid_state', async () => {
  const sc = convertedReferralScenario({ referralRow: { id: 5, status: 'pending', referred_tenant_id: 2 } });
  const pool = new FakePool(sc) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '5', { contact_email: 'valid@example.com' });

  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_state');
});

test('referred tenant does not exist → 404 tenant_not_found', async () => {
  // referral points at tenant 2 but only tenant 1 exists.
  const sc = convertedReferralScenario({ tenants: { 1: { email: 'partner@example.com' } } });
  const pool = new FakePool(sc) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '5', { contact_email: 'valid@example.com' });

  assert.equal(status, 404);
  assert.equal(body.error, 'tenant_not_found');
});

// ─── Validation layer: happy paths (write + honest re-diagnosis) ─────────────

test('happy path with no realized revenue → writes contact_email + re-diagnoses no_email → no_realized_revenue', async () => {
  const sc = convertedReferralScenario(); // tenant 2 has no email, no revenue
  const pool = new FakePool(sc) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '5', { contact_email: 'Referred@Example.com' });

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.referred_tenant_id, 2);
  assert.equal(body.contact_email, 'Referred@Example.com', 'operator email persisted verbatim (trimmed)');

  // the email was actually written to tenants.
  const upd = pool.captured.find((q: any) => /update tenants set contact_email/i.test(q.text));
  assert.ok(upd, 'an UPDATE tenants was issued');
  assert.equal(upd.params[0], 'Referred@Example.com');
  assert.equal(Number(upd.params[1]), 2);

  // re-diagnosis: had an email now but no revenue → honest no_realized_revenue (never fabricated).
  assert.equal(body.diagnosis.reason, 'no_realized_revenue');
  assert.equal(body.diagnosis.has_email, true);
  assert.equal(body.diagnosis.resolved, null);
});

test('happy path with realized revenue → re-diagnoses no_email → linkable (deal value now attachable)', async () => {
  const sc = convertedReferralScenario({
    recurringPaise: { 'referred@example.com': 30000 }, // ₹300
    onetimePaise: { 'referred@example.com': 20000 },   // ₹200 → linked_ledger, ₹500 total
  });
  const pool = new FakePool(sc) as any;
  const handler = captureReferredEmailHandler(pool);

  const { status, body } = await invoke(handler, '5', { contact_email: 'referred@example.com' });

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.diagnosis.reason, 'linkable', 'revenue now matches → conversion is auto-linkable');
  assert.equal(body.diagnosis.has_email, true);
  assert.ok(body.diagnosis.resolved, 'resolved deal value is present');
  assert.equal(body.diagnosis.resolved.value, 500, '₹300 + ₹200 across both ledgers');
  assert.equal(body.diagnosis.resolved.source, 'linked_ledger');
});

// ─── Flag-gate + CSRF layer (ephemeral HTTP app, REAL csrf + flag middleware) ──

const ROUTE = '/api/admin/tenant-architecture/console/partner-ecosystem/referrals/5/referred-email';

/** Build an ephemeral app with the REAL csrf middleware + real partner routes (auth stubbed). */
async function startApp(scenario: Scenario) {
  const pool = new FakePool(scenario) as any;
  const app = express();
  app.use(express.json());
  app.use(csrfProtection());
  const pass = (_req: any, _res: any, next: any) => next();
  registerMultiTenantArchitectureRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** Fetch a valid CSRF token + cookie from the bootstrap endpoint. */
async function getCsrf(base: string): Promise<{ token: string; cookie: string }> {
  const res = await fetch(`${base}/api/csrf-token`);
  const body: any = await res.json();
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0]; // mx.csrf=<value>
  return { token: body.token, cookie };
}

test('flag partnerEcosystem OFF → referred-email POST returns 503 (byte-identical gate)', async () => {
  const prev = process.env.FF_PARTNER_ECOSYSTEM;
  process.env.FF_PARTNER_ECOSYSTEM = '0';
  const { base, close } = await startApp(convertedReferralScenario());
  try {
    const { token, cookie } = await getCsrf(base);
    const res = await fetch(`${base}${ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, [CSRF_HEADER]: token },
      body: JSON.stringify({ contact_email: 'valid@example.com' }),
    });
    assert.equal(res.status, 503, 'flag OFF gates the mutation with a valid CSRF token present');
    const body: any = await res.json();
    assert.equal(body.flag, 'partnerEcosystem');
  } finally {
    if (prev === undefined) delete process.env.FF_PARTNER_ECOSYSTEM; else process.env.FF_PARTNER_ECOSYSTEM = prev;
    await close();
  }
});

test('CSRF: cookie-authenticated POST with no token → 403 (mutation blocked)', async () => {
  const prev = process.env.FF_PARTNER_ECOSYSTEM;
  process.env.FF_PARTNER_ECOSYSTEM = '1'; // flag ON so only CSRF can block it
  const { base, close } = await startApp(convertedReferralScenario());
  try {
    // Present an ambient session cookie but NO csrf token → the guard must reject.
    const res = await fetch(`${base}${ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'mx.sid=fake-session' },
      body: JSON.stringify({ contact_email: 'valid@example.com' }),
    });
    assert.equal(res.status, 403, 'no CSRF token → 403 even with the flag ON');
    const body: any = await res.json();
    assert.equal(body.error, 'csrf_token_invalid');
  } finally {
    if (prev === undefined) delete process.env.FF_PARTNER_ECOSYSTEM; else process.env.FF_PARTNER_ECOSYSTEM = prev;
    await close();
  }
});

test('flag ON + valid CSRF token → mutation reaches the handler (200 happy path)', async () => {
  const prev = process.env.FF_PARTNER_ECOSYSTEM;
  process.env.FF_PARTNER_ECOSYSTEM = '1';
  const { base, close } = await startApp(convertedReferralScenario({
    recurringPaise: { 'referred@example.com': 50000 }, // ₹500 → linkable after write
  }));
  try {
    const { token, cookie } = await getCsrf(base);
    const res = await fetch(`${base}${ROUTE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, [CSRF_HEADER]: token },
      body: JSON.stringify({ contact_email: 'referred@example.com' }),
    });
    assert.equal(res.status, 200, 'valid token + flag ON → handler runs');
    const body: any = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.diagnosis.reason, 'linkable');
  } finally {
    if (prev === undefined) delete process.env.FF_PARTNER_ECOSYSTEM; else process.env.FF_PARTNER_ECOSYSTEM = prev;
    await close();
  }
});
