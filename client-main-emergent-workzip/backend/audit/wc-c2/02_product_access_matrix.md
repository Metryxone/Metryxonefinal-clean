# WC-C2 · Deliverable 2 — Product Access Matrix
_Generated 2026-06-10T05:36:05.041Z. What each product costs, what gates it in code TODAY, and whether payment actually controls access._

| Product | Intended paid | Priced SKU | Order path | Entitlement feature | Backend-enforced | Served-guard TODAY | Provisioning |
|---|---|---|---|---|---|---|---|
| CAPADEX stage ladder (Insight/Growth/Mastery) | Yes | YES (STAGE_PRICES 499/999/1999) | YES (capadex-payments create-order/verify/webhook) | YES (insight/growth/mastery_report) | ❌ | session UUID + completed + runtime flag | notification only |
| Package / Institute (subscription_packages) | Yes | YES (price col) | PARTIAL (admin/parent assign — not self-serve checkout) | NO (no feature map; deriveEntitlement excludes packages) | ❌ | child/student-keyed grant, unenforced | none |
| Mentor Intelligence | Yes | NO | NO | YES (mentor_access in CAP_MAS) | ❌ | product stub (mentor_bookings ABSENT, mentor_profiles=0) | none |
| Career Builder | No | NO | NO | NO (link lives in journey route, not entitlement map) | ❌ | requireAuth (RBAC, free surface) | n/a |
| LBI | No | NO | NO | NO | ❌ | engine, not a consumer-paid product | n/a |
| Employability Index / Passport | No | NO | NO | NO | ❌ | flag-gated engine, not a SKU | n/a |
| Longitudinal (repeat-assessment trend) | No | NO (= CAP_MAS rung, counted under ladder) | NO | NO (subsumed by mastery_report) | ❌ | session-derived; not a separate SKU | n/a |

## Reading this matrix
- **Backend-enforced = ❌ for every paid product.** No endpoint consults entitlement. For the CAPADEX ladder, paid-tier reports are served on **session-UUID possession** (see deliverable 4) — the paywall is a frontend convention, not a backend gate.
- **Only the CAPADEX stage ladder is a complete SKU** (priced + checkout order path + feature map). The Package/Institute model has a price but a **non-checkout** (admin/parent-assign) order path and **no entitlement feature map**.
- **Mentor** is named in the entitlement map (`mentor_access`) but is a product stub (mentor_bookings table ABSENT, mentor_profiles=0) — not sellable.
- **Career Builder / LBI / Employability / Longitudinal** are not consumer-paid SKUs (free surfaces or engines / subsumed rungs).
