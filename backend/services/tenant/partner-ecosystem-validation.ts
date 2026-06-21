/**
 * Phase 6.12 — Partner Ecosystem · PASS/WARN/FAIL honesty harness (READ-ONLY, compose-only).
 *
 * Composes buildPartnerEcosystem and asserts invariants that keep the partner program HONEST:
 *   - substrate present (WARN when not provisioned — honest absence, never a failure),
 *   - lifecycle states are within the supported enum (FAIL on an out-of-enum status — real corruption),
 *   - commission percentages are within [0,100] (FAIL out of bounds),
 *   - payout earned totals reconcile with the per-partner converted-referral amounts (FAIL on drift),
 *   - converted-without-amount is surfaced as a coverage gap (WARN), never silently dropped.
 *
 * GET-NEVER-WRITES: this only reads via buildPartnerEcosystem (to_regclass probes); no DDL.
 */
import pg from 'pg';
import { buildPartnerEcosystem } from './partner-ecosystem-engine';
import { AGREEMENT_STATUSES, REFERRAL_STATUSES } from './partner-ecosystem-actions';

type Status = 'PASS' | 'WARN' | 'FAIL';
interface Check { name: string; status: Status; detail: string; }
interface Area { area: string; status: Status; detail: string; checks: Check[]; }

function rollup(checks: Check[]): Status {
  if (checks.some((c) => c.status === 'FAIL')) return 'FAIL';
  if (checks.some((c) => c.status === 'WARN')) return 'WARN';
  return 'PASS';
}

export interface PartnerEcosystemValidation {
  generated_at: string;
  overall: Status;
  summary: { pass: number; warn: number; fail: number };
  areas: Area[];
}

export async function buildPartnerEcosystemValidation(pool: pg.Pool): Promise<PartnerEcosystemValidation> {
  const generated_at = new Date().toISOString();
  const areas: Area[] = [];
  const eco = await buildPartnerEcosystem(pool);

  // ── Substrate ────────────────────────────────────────────────────────────
  {
    const checks: Check[] = [];
    checks.push({
      name: 'agreements_table',
      status: eco.substrate.agreements_table ? 'PASS' : 'WARN',
      detail: eco.substrate.agreements_table ? 'tenant_partner_agreements present.' : 'not provisioned yet (run setup).',
    });
    checks.push({
      name: 'referrals_table',
      status: eco.substrate.referrals_table ? 'PASS' : 'WARN',
      detail: eco.substrate.referrals_table ? 'tenant_channel_referrals present.' : 'not provisioned yet (run setup).',
    });
    checks.push({
      name: 'events_table',
      status: eco.substrate.events_table ? 'PASS' : 'WARN',
      detail: eco.substrate.events_table ? 'tenant_partner_agreement_events present (lifecycle log).' : 'lifecycle log not provisioned yet (run setup).',
    });
    areas.push({ area: 'Substrate', status: rollup(checks), detail: 'Partner-program tables provisioned.', checks });
  }

  // ── Agreement lifecycle integrity ───────────────────────────────────────────
  {
    const checks: Check[] = [];
    const badStatus = eco.agreements.filter((a) => !(AGREEMENT_STATUSES as readonly string[]).includes(a.status));
    checks.push({
      name: 'agreement_status_in_enum',
      status: badStatus.length === 0 ? 'PASS' : 'FAIL',
      detail: badStatus.length === 0
        ? `all ${eco.agreements.length} agreement statuses within the supported lifecycle.`
        : `${badStatus.length} agreement(s) carry an out-of-enum status: ${[...new Set(badStatus.map((a) => a.status))].join(', ')}.`,
    });
    const badPct = eco.agreements.filter((a) => a.commission_pct != null && (a.commission_pct < 0 || a.commission_pct > 100));
    checks.push({
      name: 'agreement_commission_bounds',
      status: badPct.length === 0 ? 'PASS' : 'FAIL',
      detail: badPct.length === 0 ? 'all agreement commission percentages within [0,100].' : `${badPct.length} out of bounds.`,
    });
    if (eco.agreements.length === 0) {
      checks.push({ name: 'agreement_population', status: 'WARN', detail: 'no agreements recorded yet (honest empty).' });
    }
    areas.push({ area: 'Agreement Lifecycle', status: rollup(checks), detail: 'Lifecycle states + commission bounds are coherent.', checks });
  }

  // ── Referral attribution + status ───────────────────────────────────────────
  {
    const checks: Check[] = [];
    const badStatus = eco.referrals.filter((r) => !(REFERRAL_STATUSES as readonly string[]).includes(r.status));
    checks.push({
      name: 'referral_status_in_enum',
      status: badStatus.length === 0 ? 'PASS' : 'FAIL',
      detail: badStatus.length === 0
        ? `all ${eco.referrals.length} referral statuses within the supported set.`
        : `${badStatus.length} referral(s) carry an out-of-enum status.`,
    });
    const convertedNoTs = eco.referrals.filter((r) => r.status === 'converted' && !r.converted_at);
    checks.push({
      name: 'converted_has_timestamp',
      status: convertedNoTs.length === 0 ? 'PASS' : 'WARN',
      detail: convertedNoTs.length === 0 ? 'every converted referral carries a converted_at.' : `${convertedNoTs.length} converted referral(s) missing converted_at.`,
    });
    if (eco.referrals.length === 0) {
      checks.push({ name: 'referral_population', status: 'WARN', detail: 'no referrals recorded yet (honest empty).' });
    }
    areas.push({ area: 'Referral Attribution', status: rollup(checks), detail: 'Referral states + attribution are coherent.', checks });
  }

  // ── Payout reconciliation (honesty) ─────────────────────────────────────────
  {
    const checks: Check[] = [];
    // Re-derive earned per partner from the converted referrals and compare to the engine's payout totals.
    // Mirror the engine's earned-amount logic: stored commission_amount, else pct × deal_value when both present.
    const derived = new Map<number, number>();
    for (const r of eco.referrals) {
      if (r.status !== 'converted') continue;
      let amt = r.commission_amount;
      if (amt == null && r.deal_value != null && r.commission_pct != null) {
        amt = Math.round((r.commission_pct / 100) * r.deal_value * 100) / 100;
      }
      if (amt != null) {
        derived.set(r.channel_partner_tenant_id, (derived.get(r.channel_partner_tenant_id) ?? 0) + amt);
      }
    }
    let drift = 0;
    for (const p of eco.payouts) {
      const d = Math.round((derived.get(p.channel_partner_tenant_id) ?? 0) * 100) / 100;
      if (Math.abs(d - p.earned_commission) > 0.01) drift += 1;
    }
    checks.push({
      name: 'payout_reconciles',
      status: drift === 0 ? 'PASS' : 'FAIL',
      detail: drift === 0 ? 'payout earned totals reconcile with converted-referral amounts.' : `${drift} partner payout(s) drift from source referrals.`,
    });
    checks.push({
      name: 'payout_no_fabrication',
      status: eco.headline.converted_without_amount === 0 ? 'PASS' : 'WARN',
      detail: eco.headline.converted_without_amount === 0
        ? 'no converted referral lacks an amount.'
        : `${eco.headline.converted_without_amount} converted referral(s) lack a commission_amount — excluded from earned totals (coverage gap, not fabricated).`,
    });
    areas.push({ area: 'Payout Reconciliation', status: rollup(checks), detail: 'Earned totals trace honestly to source rows.', checks });
  }

  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const a of areas) {
    if (a.status === 'PASS') summary.pass += 1;
    else if (a.status === 'WARN') summary.warn += 1;
    else summary.fail += 1;
  }
  const overall: Status = summary.fail > 0 ? 'FAIL' : summary.warn > 0 ? 'WARN' : 'PASS';
  return { generated_at, overall, summary, areas };
}
