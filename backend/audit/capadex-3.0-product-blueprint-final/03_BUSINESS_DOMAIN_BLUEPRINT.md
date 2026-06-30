# 03 · Business Domain Blueprint

ONE canonical business-domain model with **hierarchy, relationships, and ownership**. Every capability belongs
to exactly ONE domain. Carried from Phase 0.1 (03) + Operating-Model `03`, reconciled against code.

## Domain register (canonical, 13 domains)
| # | Domain | Scope | Primary substrate (evidence) | Status | Owning surface |
|---|---|---|---|---|---|
| D1 | **Identity & Access** | Auth, roles, MFA, RBAC, consent | `account_type`, `staff_roles`, MFA, CSRF, rate-limit | IMPLEMENTED | Platform/Security |
| D2 | **CAPADEX Assessment Core** | Concern/behavior assessment, clarity, signals | `capadex.ts`, `capadex-concern-banks.ts`, signal ontology | IMPLEMENTED | Assessment |
| D3 | **Competency Intelligence** | Competency ontology, frameworks, runtime scoring | `onto_*`, `competency_*`, 12-layer ontology | IMPLEMENTED | Assessment |
| D4 | **Career Intelligence** | Career builder, readiness, match, roadmap, passport | `career-*`, `job_postings`, talent-match | IMPLEMENTED | Career |
| D5 | **Lifecycle & Progression** | Stage model, progression, journey | CAP_* stages, `career-progression-engine.ts` | PARTIAL (progression derived) | Lifecycle |
| D6 | **AI Operating Model** | Observe/diagnose/recommend/explain/govern | AI services, `ai-governance-v2.ts` | IMPLEMENTED (LLM unvalidated) | AI |
| D7 | **Recommendation & Intervention** | Next-actions, interventions, opportunities | recommendation aggregators, M5 growth plan | IMPLEMENTED (effectiveness uncaptured) | Recommendation |
| D8 | **Reports & Analytics** | Report factory, dashboards, benchmarks | Report Factory, pdfkit, k_min=30 | IMPLEMENTED | Reporting |
| D9 | **Employer / Hiring** | Job posting, assessment, interview, talent match | 7 `employer_*` tables, hiring funnel | IMPLEMENTED | Employer |
| D10 | **Education / Institution** | Campus, institute/faculty/parent dashboards | institutional-intelligence (MX-302H), k-anon | PARTIAL (some personas thin) | Education |
| D11 | **Commercial / Monetization** | Packages, entitlement, payments, invoicing | `capadex_payments`, subscription packages, GST | PARTIAL (pkg→entitlement gap) | Commercial |
| D12 | **Platform Governance & Lifecycle Intelligence** | Capability catalog, lifecycle, governance engines | MX-700/MX-800 tiers | DORMANT (default-OFF) | Platform |
| D13 | **Outcome & KPI** | Realized-outcome capture, success KPIs | MX-102X composer, outcome models | MISSING-as-realized (machinery present, data null) | Outcome |

## Domain hierarchy (grouped)
```
MetryxOne platform
├── Foundation        : D1 Identity & Access · D12 Platform Governance Intelligence (dormant)
├── Intelligence core : D2 Assessment · D3 Competency · D4 Career   ← center of gravity (mature)
├── Reasoning         : D6 AI Operating Model · D7 Recommendation & Intervention
├── Progression       : D5 Lifecycle & Progression
├── Delivery surfaces : D8 Reports/Analytics · D9 Employer/Hiring · D10 Education/Institution
├── Commercial        : D11 Commercial / Monetization
└── Proof             : D13 Outcome & KPI   ← keystone gap (defined, not realized)
```

## Domain relationships (canonical dependency edges)
- **D2 → D3 → D4** : assessment feeds competency feeds career (the mature spine).
- **D2/D3/D4 → D6** : intelligence core is the substrate the AI operating model reasons over.
- **D6 → D7** : AI diagnosis produces recommendations/interventions.
- **D5** sequences D2–D4 across stages; **D8** reports over all of D2–D7, D9, D10.
- **D9, D10** are persona-delivery surfaces composing D2–D4 + D7 + D8 with k-anon (D10).
- **D11** gates access to all delivery surfaces (entitlement); is stage-agnostic and AI-free **by design**.
- **D12** observes the whole platform (lifecycle/governance) but is **dormant** (default-OFF).
- **D13** depends on D5 (re-measure) + D8 (measure) + adoption; it is the **terminal proof layer** every other
  domain ultimately traces into.

## Domain ownership (single owner per domain)
Each domain has exactly one owning surface (table above). No capability is co-owned. Cross-domain composition
is allowed (e.g. D9 composes D2–D4) but **ownership is singular** — the owning surface is authoritative for that
domain's contract.

## Findings (honest)
- **13 domains: 7 IMPLEMENTED, 4 PARTIAL (D5/D10/D11 + D6's LLM), 1 DORMANT (D12), 1 MISSING-as-realized (D13).**
- **No domain is duplicated; no business area is unrepresented.** Gaps are *maturity within* domains (D5/D10/D11)
  and *realization* (D13), not absent domains.
- **D13 is the keystone gap** — defined but not realized; it is what blocks proving impact.
- The "19 concern-domain profiles" (`docs/CAPADEX.md`) live **inside D2** and are a different axis from these
  business domains — do not conflate.

## Verdict
**ONE business domain model, with hierarchy, relationships, and singular ownership. FROZEN.**
