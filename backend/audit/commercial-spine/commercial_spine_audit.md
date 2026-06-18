# Commercial Spine Audit — Entitlement · Metering · Revenue

> Generated 2026-06-17T17:23:33.074Z · Task #7 Commercial Monetization Spine certification
> Structural (code/table/route exists) and Activation (real non-demo data) are SEPARATE axes — never composited.
> Demo/seed (`%@example.com`, `DEMO_*`) is EXCLUDED from all Activation metrics. Emails masked to `user_<sha256>`.

## Per-area verdict

| Area | Structural | Activation | Verdict |
|---|:--:|:--:|:--:|
| Entitlement (feature classes + enforcement) | ✅ | ❌ | **CONDITIONAL** |
| Usage Metering | ✅ | ❌ | **CONDITIONAL** |
| Revenue Intelligence (MRR/ARR/renewals/forecast) | ✅ | ❌ | **CONDITIONAL** |

**Overall:** Structural ✅ · Activation ❌ → **CONDITIONAL**

> No real non-demo commercial data yet — the spine is built and flag-gated but unsold. This is the HONEST dev-state baseline (Activation is earned by live sales, not engineering).

## Structural — tables

| Table | Present |
|---|:--:|
| `capadex_payments` | ✅ |
| `student_subscriptions` | ❌ |
| `comm_products` | ✅ |
| `comm_plans` | ✅ |
| `comm_customers` | ✅ |
| `comm_subscriptions` | ✅ |
| `comm_subscription_events` | ✅ |
| `comm_entitlement_grants` | ❌ |
| `comm_usage_events` | ❌ |

> `comm_entitlement_grants` / `comm_usage_events` are created lazily ONLY when their flag is ON; absence here with the flags OFF is the byte-identical-legacy default, not a defect.

## Structural — modules & routes

| Component | Present |
|---|:--:|
| Entitlement engine (feature classes) | ✅ |
| Plan-features parser | ✅ |
| Entitlement grants schema | ✅ |
| Entitlement routes | ✅ |
| Entitlement enforcement gate | ✅ |
| Metering schema | ✅ |
| Metering engine | ✅ |
| Metering routes | ✅ |
| Revenue intelligence (incl. recurring) | ✅ |
| Commercial read surface | ✅ |
| Migration (canonical reference) | ✅ |

## Structural — feature flags (must default OFF)

| Flag | Registered | Default OFF |
|---|:--:|:--:|
| `commercialEntitlementClasses` | ✅ | ✅ |
| `commercialUsageMetering` | ✅ | ✅ |
| `commercialRecurringRevenue` | ✅ | ✅ |

## Activation evidence (non-demo only)

### Entitlement
- Paying identities (non-demo): **0** (all incl. demo: 0)
- Active manual grants: **_n/a (not measurable)_**
- Active package grants: **_n/a (not measurable)_**

### Metering
- Usage events recorded: **_n/a (not measurable)_** across **_n/a (not measurable)_** identities
- Plans declaring quotas: **0**

### Revenue
- Active recurring subscriptions: **0**
- Recurring collections: **₹0** · One-time collections: **₹0**
- Months of payment history (forecast needs ≥2): **0**

## Honesty notes
- All Activation numbers exclude demo/seed identities and ledger rows.
- `n/a (not measurable)` means the underlying table/column is absent (distinct from a measured `0`).
- Forecast ABSTAINS below 2 months of data — no fabricated projection.
