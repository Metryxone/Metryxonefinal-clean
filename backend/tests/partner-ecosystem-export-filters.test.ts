/**
 * Phase 6.12 — Partner Ecosystem · export-filter regression guard tests.
 *
 * Locks the date-range / status filtering shipped on partner exports (Task #36) so a regression can never
 * silently reopen the two honesty guarantees the filter was built to protect:
 *   (1) an EMPTY filter is byte-identical to the old full export (no filter path unchanged), and
 *   (2) filters only ever REMOVE rows — they never fabricate or back-fill data — and payouts are always
 *       recomputed from the FILTERED referrals (an excluded referral's commission drops out of the totals).
 *
 * Pure, DB-free: a configurable fake pg.Pool answers exactly the queries buildPartnerEcosystem() issues
 * (to_regclass substrate probes, the deal_value column probe, the agreements SELECT, the referrals SELECT).
 * Referrals carry explicit commission_amount with no deal_value, so the ledger re-resolution loop is never
 * entered and the payout math is exercised directly over the filtered set.
 *
 * Run with:  cd backend && npx tsx --test tests/partner-ecosystem-export-filters.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPartnerEcosystem } from '../services/tenant/partner-ecosystem-engine';

// ── Raw DB rows exactly as the SELECTs return them (engine maps + filters after) ─────────────

interface RawAgreementRow {
  id: number;
  tenant_id: number;
  partner_type: string;
  agreement_code: string;
  status: string;
  commission_pct: number | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
  tenant_name: string | null;
  tenant_code: string | null;
}

interface RawReferralRow {
  id: number;
  channel_partner_tenant_id: number;
  referred_tenant_id: number | null;
  referral_code: string;
  status: string;
  commission_pct: number | null;
  commission_amount: number | null;
  currency: string;
  referred_at: string | null;
  converted_at: string | null;
  channel_partner_name: string | null;
  referred_tenant_name: string | null;
  // deal columns are absent (column probe → false) so the ledger loop is never entered.
  deal_value?: number | null;
  deal_value_source?: string | null;
  commission_amount_source?: string | null;
}

interface Scenario {
  agreementsTable: boolean;
  referralsTable: boolean;
  eventsTable: boolean;
  agreements: RawAgreementRow[];
  referrals: RawReferralRow[];
}

function normWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

class FakePool {
  scenario: Scenario;
  constructor(scenario: Scenario) {
    this.scenario = scenario;
  }

  async query(text: string, params: any[] = []): Promise<any> {
    const s = normWs(text).toLowerCase();
    const sc = this.scenario;

    // Substrate presence probes.
    if (s.includes('to_regclass')) {
      const name = String(params[0] ?? '').replace(/^public\./, '');
      const present =
        (name === 'tenant_partner_agreements' && sc.agreementsTable) ||
        (name === 'tenant_channel_referrals' && sc.referralsTable) ||
        (name === 'tenant_partner_agreement_events' && sc.eventsTable);
      return { rows: [{ reg: present ? name : null }], rowCount: 1 };
    }

    // Deal-value column probe → report absent so the SELECT uses the NULL fallback path.
    if (s.includes('from information_schema.columns')) {
      return { rows: [], rowCount: 0 };
    }

    // Agreements SELECT.
    if (s.includes('from tenant_partner_agreements')) {
      return { rows: sc.agreements.map((r) => ({ ...r })), rowCount: sc.agreements.length };
    }

    // Referrals SELECT.
    if (s.includes('from tenant_channel_referrals')) {
      return { rows: sc.referrals.map((r) => ({ ...r })), rowCount: sc.referrals.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

// ── A fixed world: 4 referrals across 2 partners, spread over distinct dates/statuses ─────────
// R1 converted 2024-01-15 (partner 1, ₹100)   R2 pending  2024-02-20 (partner 1)
// R3 converted 2024-03-10 (partner 2, ₹200)   R4 expired  2024-01-05 (partner 1)

function referral(over: Partial<RawReferralRow>): RawReferralRow {
  return {
    id: 0,
    channel_partner_tenant_id: 1,
    referred_tenant_id: 9,
    referral_code: 'REF',
    status: 'pending',
    commission_pct: 10,
    commission_amount: null,
    currency: 'INR',
    referred_at: null,
    converted_at: null,
    channel_partner_name: 'Partner One',
    referred_tenant_name: 'Referred Co',
    deal_value: null,
    deal_value_source: null,
    commission_amount_source: null,
    ...over,
  };
}

function baseScenario(): Scenario {
  return {
    agreementsTable: true,
    referralsTable: true,
    eventsTable: true,
    agreements: [
      {
        id: 1, tenant_id: 1, partner_type: 'reseller', agreement_code: 'AG-1', status: 'active',
        commission_pct: 10, start_date: '2024-01-01', end_date: '2024-12-31', updated_at: '2024-01-02T00:00:00.000Z',
        tenant_name: 'Partner One', tenant_code: 'P1',
      },
      {
        id: 2, tenant_id: 2, partner_type: 'affiliate', agreement_code: 'AG-2', status: 'suspended',
        commission_pct: 5, start_date: '2024-03-01', end_date: null, updated_at: '2024-03-05T00:00:00.000Z',
        tenant_name: 'Partner Two', tenant_code: 'P2',
      },
    ],
    referrals: [
      referral({ id: 1, channel_partner_tenant_id: 1, status: 'converted', commission_amount: 100, referred_at: '2024-01-15T00:00:00.000Z', converted_at: '2024-01-20T00:00:00.000Z', channel_partner_name: 'Partner One' }),
      referral({ id: 2, channel_partner_tenant_id: 1, status: 'pending', referred_at: '2024-02-20T00:00:00.000Z', channel_partner_name: 'Partner One' }),
      referral({ id: 3, channel_partner_tenant_id: 2, status: 'converted', commission_amount: 200, referred_at: '2024-03-10T00:00:00.000Z', converted_at: '2024-03-12T00:00:00.000Z', channel_partner_name: 'Partner Two' }),
      referral({ id: 4, channel_partner_tenant_id: 1, status: 'expired', referred_at: '2024-01-05T00:00:00.000Z', channel_partner_name: 'Partner One' }),
    ],
  };
}

function payoutFor(eco: Awaited<ReturnType<typeof buildPartnerEcosystem>>, partnerId: number) {
  return eco.payouts.find((p) => p.channel_partner_tenant_id === partnerId) ?? null;
}

// ── (1) Baseline: no filter (undefined) ──────────────────────────────────────────────────────

test('baseline (no filter): all rows kept, by-status + payouts computed over the full set', async () => {
  const pool = new FakePool(baseScenario()) as any;
  const eco = await buildPartnerEcosystem(pool);

  assert.equal(eco.referrals.length, 4, 'all 4 referrals present');
  assert.deepEqual(eco.headline.referrals_by_status, { converted: 2, pending: 1, expired: 1 });
  assert.equal(eco.headline.total_earned_commission, 300, '₹100 + ₹200 across both converted referrals');
  assert.equal(payoutFor(eco, 1)!.earned_commission, 100, 'partner 1 earns from R1 only');
  assert.equal(payoutFor(eco, 2)!.earned_commission, 200, 'partner 2 earns from R3');

  // (1) The unfiltered call must NOT carry a "Filtered export" note.
  assert.ok(!eco.notes.some((n) => n.startsWith('Filtered export')), 'no Filtered export note on the full export');
});

test('byte-identical: an EMPTY filter ({}) equals no filter at all (only generated_at may differ)', async () => {
  const a = await buildPartnerEcosystem(new FakePool(baseScenario()) as any);
  const b = await buildPartnerEcosystem(new FakePool(baseScenario()) as any, {});
  const c = await buildPartnerEcosystem(new FakePool(baseScenario()) as any, { from: null, to: null, status: null });

  const strip = (x: any) => ({ ...x, generated_at: '<ts>' });
  assert.deepEqual(strip(b), strip(a), '{} filter is byte-identical to no filter');
  assert.deepEqual(strip(c), strip(a), 'all-null filter is byte-identical to no filter');
  assert.ok(!b.notes.some((n) => n.startsWith('Filtered export')), 'empty {} filter adds no Filtered export note');
});

// ── (2a) Date-only filter ─────────────────────────────────────────────────────────────────────

test('date-only filter keeps only referrals whose referred/converted date is in-window; payouts recompute', async () => {
  const pool = new FakePool(baseScenario()) as any;
  const eco = await buildPartnerEcosystem(pool, { from: '2024-02-01', to: '2024-03-31' });

  // R2 (2024-02-20 pending) and R3 (2024-03-10 converted) survive; R1 + R4 (January) are excluded.
  assert.deepEqual(eco.referrals.map((r) => r.id).sort(), [2, 3]);
  assert.deepEqual(eco.headline.referrals_by_status, { pending: 1, converted: 1 });

  // Payouts derive from the FILTERED set: partner 1 no longer earns R1's ₹100.
  assert.equal(eco.headline.total_earned_commission, 200, 'only R3 (₹200) remains');
  assert.equal(payoutFor(eco, 1)!.earned_commission, 0, "partner 1's excluded R1 commission is gone");
  assert.equal(payoutFor(eco, 2)!.earned_commission, 200);

  assert.ok(eco.notes.some((n) => n.startsWith('Filtered export')), 'filtered call carries the Filtered export note');
});

// ── (2b) Status-only filter ───────────────────────────────────────────────────────────────────

test('status-only filter keeps exact-status matches only; payouts recompute over them', async () => {
  const pool = new FakePool(baseScenario()) as any;
  const eco = await buildPartnerEcosystem(pool, { status: 'converted' });

  assert.deepEqual(eco.referrals.map((r) => r.id).sort(), [1, 3], 'only the two converted referrals remain');
  assert.deepEqual(eco.headline.referrals_by_status, { converted: 2 });
  assert.equal(eco.headline.total_earned_commission, 300, 'both converted commissions still counted');
  assert.equal(payoutFor(eco, 1)!.earned_commission, 100);
  assert.equal(payoutFor(eco, 2)!.earned_commission, 200);

  // The SAME status string is applied to agreements too: neither agreement is 'converted',
  // so all agreements are excluded (filters only ever remove — never invent an 'active' match).
  assert.deepEqual(eco.agreements, []);
  assert.deepEqual(eco.headline.agreements_by_status, {});
});

test('status-only filter matching an agreement status keeps that agreement (exact match only)', async () => {
  const pool = new FakePool(baseScenario()) as any;
  const eco = await buildPartnerEcosystem(pool, { status: 'active' });

  // Only the 'active' agreement (AG-1) survives; AG-2 is 'suspended'. No referral is 'active'.
  assert.deepEqual(eco.agreements.map((a) => a.id), [1]);
  assert.deepEqual(eco.headline.agreements_by_status, { active: 1 });
  assert.equal(eco.referrals.length, 0, 'no referral carries the "active" status');
  assert.equal(eco.headline.total_earned_commission, 0);
});

// ── (2c) Combined date + status filter ────────────────────────────────────────────────────────

test('combined date+status filter applies BOTH predicates (intersection); payouts recompute', async () => {
  const pool = new FakePool(baseScenario()) as any;
  const eco = await buildPartnerEcosystem(pool, { from: '2024-02-01', to: '2024-03-31', status: 'converted' });

  // In-window = {R2 pending, R3 converted}; intersect status=converted ⇒ only R3.
  assert.deepEqual(eco.referrals.map((r) => r.id), [3]);
  assert.deepEqual(eco.headline.referrals_by_status, { converted: 1 });
  assert.equal(eco.headline.total_earned_commission, 200, 'only R3 (₹200) survives both predicates');
  assert.equal(payoutFor(eco, 2)!.earned_commission, 200);
  assert.equal(payoutFor(eco, 1), null, 'partner 1 has no referral left in the filtered set');
});

// ── (2d) Filters only ever REMOVE rows — never fabricate ──────────────────────────────────────

test('filters only remove rows: every filtered result is a subset of the baseline, never invented', async () => {
  const baseline = await buildPartnerEcosystem(new FakePool(baseScenario()) as any);
  const baselineIds = new Set(baseline.referrals.map((r) => r.id));

  for (const f of [
    { from: '2024-02-01', to: '2024-03-31' },
    { status: 'converted' },
    { from: '2024-02-01', to: '2024-03-31', status: 'converted' },
    { from: '2025-01-01', to: '2025-12-31' }, // window with no rows at all
  ]) {
    const eco = await buildPartnerEcosystem(new FakePool(baseScenario()) as any, f);
    assert.ok(eco.referrals.length <= baseline.referrals.length, `filter ${JSON.stringify(f)} never grows the set`);
    for (const r of eco.referrals) {
      assert.ok(baselineIds.has(r.id), `referral ${r.id} came from the baseline, not fabricated`);
    }
    // Earned total can only shrink or hold — never exceed the baseline.
    assert.ok(
      eco.headline.total_earned_commission <= baseline.headline.total_earned_commission,
      `filter ${JSON.stringify(f)} never inflates earned commission`,
    );
  }
});

test('empty-window filter yields zero rows and zero payouts (honest empty, not an error)', async () => {
  const eco = await buildPartnerEcosystem(new FakePool(baseScenario()) as any, { from: '2025-01-01', to: '2025-12-31' });
  assert.equal(eco.referrals.length, 0);
  assert.deepEqual(eco.headline.referrals_by_status, {});
  assert.equal(eco.headline.total_earned_commission, 0);
  assert.equal(eco.degraded, false, 'an empty window is not a degraded read');
  assert.ok(eco.notes.some((n) => n.startsWith('Filtered export')), 'still records that a filter was applied');
});
