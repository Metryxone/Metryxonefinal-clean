# 03 · Business Domain Model

ONE consolidated business-domain model. Each domain: scope, primary substrate (repo evidence), status. Carried
from Operating-Model cert `03_BUSINESS_DOMAIN_VALIDATION.md` + reconciled against code.

| # | Business domain | Scope | Primary substrate (evidence) | Status |
|---|---|---|---|---|
| D1 | **Identity & Access** | Auth, roles, MFA, RBAC, consent | `account_type`, `staff_roles`, MFA, CSRF, rate-limit | **IMPLEMENTED** |
| D2 | **CAPADEX Assessment Core** | Concern/behavior assessment, clarity, signals | `capadex.ts`, `capadex-concern-banks.ts`, signal ontology | **IMPLEMENTED** |
| D3 | **Competency Intelligence** | Competency ontology, frameworks, runtime scoring | `onto_*`, `competency_*`, 12-layer ontology | **IMPLEMENTED** |
| D4 | **Career Intelligence** | Career builder, readiness, match, roadmap, passport | `career-*` services, `job_postings`, talent-match | **IMPLEMENTED** |
| D5 | **Lifecycle & Progression** | Stage model, progression, journey | CAP_* stages, `career-progression-engine.ts` | **PARTIAL** (progression derived) |
| D6 | **AI Operating Model** | Observe/diagnose/recommend/explain/govern | AI services, `ai-governance-v2.ts` | **IMPLEMENTED** (LLM unvalidated) |
| D7 | **Recommendation & Intervention** | Next-actions, interventions, opportunities | recommendation aggregators, M5 growth plan | **IMPLEMENTED** (effectiveness uncaptured) |
| D8 | **Reports & Analytics** | Report factory, dashboards, benchmarks | Report Factory, pdfkit, k_min=30 | **IMPLEMENTED** |
| D9 | **Employer / Hiring** | Job posting, assessment, interview, talent match | 7 `employer_*` tables, hiring funnel | **IMPLEMENTED** |
| D10 | **Education / Institution** | Campus, institute/faculty/parent dashboards | institutional-intelligence (MX-302H), k-anon | **PARTIAL** (some personas thin) |
| D11 | **Commercial / Monetization** | Packages, entitlement, payments, invoicing | `capadex_payments`, subscription packages, GST | **PARTIAL** (pkg→entitlement gap) |
| D12 | **Platform Governance & Lifecycle Intelligence** | Capability catalog, lifecycle, governance engines | MX-700/MX-800 tiers | **DORMANT** (default-OFF) |
| D13 | **Outcome & KPI** | Realized-outcome capture, success KPIs | MX-102X composer, outcome models | **MISSING (machinery present, data null)** |

## Domain-level findings (honest)
- **13 domains; 7 fully implemented, 4 partial, 1 dormant, 1 missing-as-realized.** No domain is duplicated.
- **The model's center of gravity is D2–D4 (assessment → competency → career)** — the genuinely mature core.
- **D13 (Outcome & KPI) is the keystone gap** — it is *defined* but not *realized*; it is what blocks the
  product from proving impact (consistent with the prior cert's "back-half" finding).
- **D12 (platform governance intelligence) is vast but dormant** — built, validated, default-OFF (not debt).
- **No "missing business domain"** in the sense of an unrepresented area of the product; the gaps are
  *maturity within* domains (D5/D10/D11) and *realization* (D13), not absent domains.

## Reconciliation note
Prior docs variously listed "19 domain profiles" (`docs/CAPADEX.md`, referring to the 19 CAPADEX **concern-
domain** profiles) and "12 business capabilities" (engineering constitution). These are **different axes**:
*concern-domain profiles* (D2 internal taxonomy) ≠ *business domains* (this model). This model is the canonical
**business** domain list; the 19 concern-domains live inside D2.
