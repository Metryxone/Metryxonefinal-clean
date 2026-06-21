---
name: Partner Ecosystem (Phase 6.12)
description: Honest payout model + lifecycle gating for the tenant partner program built over the 6.11 multi-tenant console.
---

# Partner Ecosystem (Phase 6.12)

Additive partner program over the Phase 6.11 multi-tenant relationship tables
(`tenant_partner_agreements`, `tenant_channel_referrals`). Lives under route base
`/api/admin/tenant-architecture/console/partner-ecosystem/*`, gated by its OWN flag
`partnerEcosystem` (`FF_PARTNER_ECOSYSTEM`) — independent of the `tenantManagementConsole`
flag that gates the parent panel.

## Honest payout model (the core design decision)
Earned commission = SUM(`commission_amount`) over CONVERTED referrals **that actually
carry an amount**. A converted referral with NO amount is surfaced as an explicit
coverage gap (`converted_without_amount`), never back-filled.

**Why:** the relationship schema has no deal/transaction value to multiply
`commission_pct` against, so a percentage alone cannot yield a payout. Inferring one
would fabricate revenue. The gap is the honest finding.

**How to apply:** if a future phase adds deal value, payout can multiply pct×value; until
then, the amount must be supplied explicitly on conversion (`/referrals/:id/transition`
accepts `commission_amount`). Never derive earned totals from pct alone.

## Lifecycle gating
- Agreement lifecycle: `draft → active → suspended/expired → terminated` (terminal).
  Legacy `pending` retained. Transitions enforced by `AGREEMENT_TRANSITIONS` map; the
  status CHECK on `tenant_partner_agreements` was widened (drop-then-add, idempotent) to
  add `draft`. Append-only `tenant_partner_agreement_events` logs every move.
- Referral: only a `pending` referral can change (`converted/expired/rejected`), the rest
  are terminal. `converted_at` is set on conversion, cleared otherwise.

## Discipline traps that bit here
- **Shared panel helper collision**: `MultiTenantArchitecturePanel.tsx` already defines a
  `Stat` helper — a second top-level `function Stat` builds fine under tsx but FAILS the
  vite/esbuild build ("symbol already declared"). The only real launch gate is the
  frontend vite build, so always run it after adding helpers to a large shared panel.
- **GET-never-writes**: the read engine + validation harness use `to_regclass` probes
  only; the lazy `ensurePartnerEcosystemSchema` (DDL) runs ONLY on the explicit write
  POSTs, so flag-OFF executes zero DDL → byte-identical.
