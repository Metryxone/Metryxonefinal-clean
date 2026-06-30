# 3 · Customer Journey Matrix

End-to-end workflow verification from actual route/service implementation. Verdict reflects whether the
*workflow* is complete (API existence ≠ complete workflow per the honesty contract).

| # | Journey | Verdict | Evidence | Gap to close before launch |
|---|---|---|---|---|
| 1 | Registration | **COMPLETE** | `routes.ts /api/register` — limiter, password policy, user+child creation, hashing | none structural |
| 2 | Authentication + MFA | **COMPLETE** | `/api/login`, `/api/admin/mfa/verify`; super-admin MFA mandatory; Firebase auth in `firebase-auth.ts` | needs Zoho creds in prod for MFA email delivery |
| 3 | Free assessment (CAPADEX) → report | **COMPLETE** | `routes/capadex.ts` `/session/start`→`/respond`→`/complete`; scoring + cognitive state; `omega-report.ts` | none structural; report quality depends on seeded banks (present) |
| 4 | Career Builder | **PARTIAL** | `career-seeker.ts` + `career-*` services: rich read/gap/readiness | active roadmap-modification ("builder") paths thin; verify write/persist E2E |
| 5 | Learning / interventions | **PARTIAL** | `intervention-engine.ts` recommends | intervention *execution* is fallback-heavy; close the "do the intervention" loop |
| 6 | Employer / recruiter hiring | **COMPLETE** | `job-posting-engine.ts` (Create→Submit→Approve→Publish FSM), `interview-intelligence.ts`, `employer-portal.ts` | strongest journey; validate under real multi-tenant load |
| 7 | Institutional dashboards | **PARTIAL** | `institutional-intelligence.ts` (univ/faculty/parent) behind flag | placement & accreditation are honest-unavailable stubs pending data integration |
| 8 | Reports & analytics | **COMPLETE** | `omega-report.ts`, `report-pack.ts`, `enterprise-analytics.ts`, `workforce-analytics.ts` | analytics values are honest-empty without traffic (expected pre-launch) |
| 9 | Admin | **COMPLETE** | `routes.ts` `/api/admin/*` (curriculum, psychometrics, KYC, users, onboarding) | none structural |
| 10 | SuperAdmin | **COMPLETE** | `superadmin-command-center.ts` control tower + monitoring + snapshots | none structural |
| 11 | Commercial / payments / entitlements | **COMPLETE** | `capadex-payments.ts` Razorpay order→verify→webhook; `entitlement.ts` | **demo-mode fallback active when keys missing — must be disabled/keyed for prod**; package→entitlement linkage gap (memory) |

## Cross-cutting journey findings
- **Dual persistence** (Drizzle/pool + custom `storage` layer) across most journeys — works, but a long-term
  maintainability cost (see Architecture Debt Register).
- **Idempotent boot seeding** (assessment templates, curriculum, super-admin, role library, question banks)
  confirmed in boot logs — journeys have their reference data on a clean DB.
- **Pre-launch data reality:** journeys 4/5/7/8 will read "honest empty/zero" until real users generate data.
  This is correct behavior (null ≠ 0), **not** a defect — but it means these journeys cannot be
  *outcome-validated* until pilot traffic exists.

## Journey readiness summary
- **8 of 11 COMPLETE** structurally (Registration, Auth+MFA, Assessment, Employer, Reports, Admin,
  SuperAdmin, Commercial).
- **3 of 11 PARTIAL** (Career Builder builder-paths, Learning intervention execution, Institutional
  placement/accreditation).
- **0 of 11 BLOCKED / MISSING** structurally.
- The only journey carrying a hard launch toggle is **#11 Commercial** (demo-mode payments must be turned off
  with real Razorpay keys before charging customers).
