# Phase 6 — Commercial Platform Reconciliation Audit

**Task:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION-PHASE-6 (Commercial Platform Activation)
**Mode:** Additive · flag-gated (default OFF, flag-OFF byte-identical) · compose-never-recompute · honesty-first
**Scope:** Reconcile the EIGHT commercial subsystems that already exist behind default-OFF flags against the
live development database. Report **Structural** (code/schema exists) and **Activation** (real data flowing)
as two SEPARATE axes — never composited. A missing count is `null`/absent, never `0`. Nothing here is
fabricated; empty subsystems are honest Coverage gaps, not failures.

> PII note: this audit reports only aggregate row counts. No tenant names, emails, or customer
> identifiers are reproduced.

---

## 1. Method

- Live DB probed via `to_regclass` (existence) + `COUNT(*)` (population) against `DATABASE_URL`.
- Composed pure read engines exercised through the new read-only Phase-6 validation engine
  (`services/commercial-platform-validation-engine.ts`) — **zero DDL, zero writes**.
- Validation engine result captured against the current (mostly empty) substrate:
  **8 areas → 1 PASS / 7 WARN / 0 FAIL** (`status: warn`, `measurable_areas: 1`). FAIL-free is the
  honest expected outcome when the commercial substrate is unprovisioned with data.

---

## 2. Live grounding (row counts, dev DB — June 2026)

| Table | Exists | Rows | Note |
|---|---|---:|---|
| `comm_products` | ✅ | 0 | catalog empty |
| `comm_plans` | ✅ | 0 | catalog empty |
| `comm_bundles` | ✅ | 0 | catalog empty |
| `comm_coupons` | ✅ | 0 | catalog empty |
| `comm_subscriptions` | ✅ | 0 | recurring model unprovisioned |
| `comm_entitlement_grants` | ✅ | 0 | no manual grants |
| `comm_usage_events` | ✅ | 0 | no metering events |
| `tenants` | ✅ | **4** | **only populated commercial table** |
| `capadex_payments` | ✅ | 0 | one-time revenue ledger empty |
| `student_subscriptions` | ✅ | 0 | legacy package model empty |
| `subscription_packages` | ✅ | 0 | package catalog empty |
| `inv_invoices` | ✅ | 0 | invoice ledger empty |
| `gov_audit_framework` | ✅ | 0 | no audit-framework rows |
| `governance_events` | ✅ | 0 | no governance events |
| `rbac_approval_requests` | ✅ | 0 | no approvals raised |
| `rbac_role_hierarchies` | ✅ | **9** | RBAC definitions seeded |
| `rbac_permission_groups` | ✅ | **8** | permission groups seeded |
| `aig_alerts` | ✅ | **500** | AI-governance alerts populated |
| `anl_fact_events` | ❌ | — | enterprise warehouse fact table **absent** |

**Headline:** Structural coverage is ~complete (every commercial table exists except the `anl_*`
warehouse fact table). Activation is near-zero — only `tenants` (4), governance definitions
(`rbac_role_hierarchies` 9, `rbac_permission_groups` 8) and `aig_alerts` (500) carry real rows. No
catalog, no subscriptions, no payments, no entitlement grants, no invoices.

---

## 3. Subsystem reconciliation (Structural vs Activation)

| # | Subsystem | Flag | Service(s) / route(s) | Tables | Structural | Activation | Real gap |
|---|---|---|---|---|---|---|---|
| 1 | Commercial Layer | `commercialActivation` | `wc7c/*`, `routes/commercial.ts` | `comm_products/plans/bundles/coupons` | ✅ schema + engines | ❌ catalog empty | No products/plans seeded. WARN (Coverage gap). |
| 2 | Institution Layer | (tenant infra) | `routes/tenants.ts` | `tenants` | ✅ | ✅ 4 tenants | **Only measurable subsystem.** PASS; seat invariants hold. |
| 3 | Subscription Intelligence | `commercialActivation` | `wc7c/subscription-lifecycle.ts` | `comm_subscriptions`, `student_subscriptions` | ✅ engine composes | ❌ 0 subs (both models) | No recurring or package subs. Lifecycle engine degraded over empty substrate. |
| 4 | Entitlement Intelligence | `commercialEntitlementEnforcement` | `wc7c/entitlement-engine.ts` | `comm_entitlement_grants`, `comm_subscriptions` | ✅ engine composes | ❌ 0 grants, `coverage_pct=null` | `coverage_pct` correctly `null` (zero paying identities — not 0). |
| 5 | Revenue Intelligence | `commercialActivation` | `wc7c/revenue-intelligence.ts` | `capadex_payments` + `comm_subscriptions` | ✅ engine composes | ❌ 0 payments, MRR/ARR ₹0 | Revenue composes one-time ledger + recurring model (no 2nd ledger). Degraded. |
| 6 | Platform Governance | `governanceRbacV2` / AI-gov | `rbac_*`, `gov_*`, `aig_*` | `rbac_role_hierarchies/permission_groups`, `aig_alerts`, `governance_events` | ✅ | ⚠️ partial (RBAC defs + 500 alerts; 0 audit/approval rows) | Definitions + alerts real; audit/approval ledgers empty. |
| 7 | Customer Success Intelligence | `commercialActivation` | `wc7c/renewal-engine.ts`, `wc7c/upsell-engine.ts` | composes subs/grants/payments | ✅ engines compose | ❌ no substrate → empty pipeline | Renewal/upsell pipelines empty (no subs). Behavioural upsell triggers stubbed (see §4). |
| 8 | Enterprise Readiness | (enterprise infra) | `enterprise-intelligence.ts` | `anl_*` warehouse | ⚠️ engine present, fact table absent | ❌ `anl_fact_events` absent | Warehouse fact table not provisioned. WARN (honest absence). |

---

## 4. Honest gaps carried forward (not fabricated, not "fixed" by inventing data)

- **G1 — Identity↔subscription↔entitlement bridge.** RESOLVED by re-grounding (no migration needed).
  The live `users` table DOES carry `email` (cols: `id, username, password, full_name, role, roles,
  created_at, email, phone, account_type`). The commercial identity join is **email-based and already
  consistent**: `users.email ↔ comm_customers.email ↔ comm_entitlement_grants.email` /
  `comm_usage_events.email` / `capadex_payments.email`, with `comm_subscriptions.customer_id →
  comm_customers.id` (and `comm_customers.user_id` available for a hard FK). Grants are email-keyed by
  design (soft identity, no FK to `users`). See T004 / `02-activation-and-decisions.md` §A.
- **G2 — Behavioural upsell triggers.** `behavioural_at_risk` / `behavioural_power_user` upsell triggers
  are honestly stubbed (no behavioural-signal→upsell taxonomy built). Tracked in T004; kept stubbed with
  a documented reason unless real signal wiring is in scope.
- **G3 — Enterprise warehouse.** `anl_fact_events` (and the `anl_*` fact layer) is absent in dev. The
  enterprise engine reports a WARN/honest absence rather than synthesising warehouse rows.
- **G4 — Activation = 0 by design.** Catalog/subscriptions/payments/grants/invoices are empty. This is the
  pre-activation baseline; T003 exercises them in TEST/demo mode (`@example.com`, self-cleaning) without
  polluting real data. Razorpay defaults to TEST/demo; live keys are an owner decision (T005).

---

## 5. Conclusion

Structural readiness is **~complete**; Activation is **near-zero** (only `tenants`, governance
definitions, and `aig_alerts` carry real rows). The Phase-6 validation harness reflects this honestly:
**1 PASS / 7 WARN / 0 FAIL**. No subsystem is inflated; every empty subsystem is reported as a Coverage
gap (WARN), and no data was fabricated to manufacture activation. Remaining work: T003 (TEST-mode E2E
smoke), T004 (identity bridge + CS triggers — owner decision), T005 (activation switch list + Razorpay
decision + verify + STOP for approval).
