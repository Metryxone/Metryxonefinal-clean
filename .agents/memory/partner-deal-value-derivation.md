---
name: Partner referral deal-value & commission derivation
description: How converted partner referrals capture a deal value and auto-derive the payout (Phase 6.12)
---

# Partner referral deal-value & commission derivation

A converted `tenant_channel_referrals` row can carry `deal_value` (NUMERIC, currency
units = rupees), `deal_value_source`, and `commission_amount_source`
('explicit'|'derived'). Earned payout = stored `commission_amount` OR, when absent
but `deal_value`+`commission_pct` both present, derived as `pct/100 × deal_value`.
The engine derives at READ time too (back-stop for rows linked before a writer baked
the amount); `converted_without_amount` now counts only the genuinely non-derivable.

**Linkage path (no tenant_id on commercial tables):** `tenants.contact_email` →
- recurring: `comm_subscription_events.amount_paise` (event_type IN payment_succeeded/renewed)
  JOIN `comm_customers` on email
- one-time: `capadex_payments.amount_paise` WHERE status='paid' AND email match
Ledger money is **PAISE**; divide by 100 → rupees. `resolveReferredTenantDealValue`
to_regclass-probes each table, never throws, returns **null** (honest gap) when the
tenant has no email or no realized revenue — never fabricates a value.

**Why:** the payout surface previously only summed manually-typed amounts; without a
deal value there was nothing to multiply `commission_pct` against, so every
unpriced conversion was a coverage gap.

**How to apply:** keep the derivation math identical in all three places it lives —
`transitionReferral`/`createChannelReferral` (write), engine payout loop (read),
and `partner-ecosystem-validation.ts` reconciliation — or payouts drift. The engine
GET must stay byte-identical when columns are absent: it probes `columnExists` and
SELECTs `NULL::numeric`/`NULL::text` fallbacks rather than reaching ensure-schema
(DDL lives only on the POST/setup path). MTAPanel.tsx convert button uses a
window.prompt: number=explicit, blank=link_deal auto-resolve, "none"=no value.

**Historical backfill** (`scripts/partner-deal-value-backfill.ts`): fills pre-feature
converted rows. It must call `ensurePartnerEcosystemSchema` FIRST — the deal_value /
*_source columns are write-path lazy and absent until some POST runs. Re-runnable
because the candidate WHERE only selects `status='converted' AND referred_tenant_id
IS NOT NULL AND commission_amount IS NULL AND deal_value IS NULL` (filled rows drop
out); the UPDATE re-asserts the NULL guard. Task-agent runs only touch the ISOLATED
env — re-run against prod DATABASE_URL to actually shrink the live gap.
