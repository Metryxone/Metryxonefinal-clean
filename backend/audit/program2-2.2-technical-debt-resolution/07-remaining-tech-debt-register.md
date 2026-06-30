# Program 2 · Phase 2.2 — 07 · Remaining Technical Debt Register

Prioritized register of debt that **remains after** Phase 2.1 + 2.2. Each item states *why it was not resolved here* (almost all: forbidden by this phase's enhancement-only / no-rewrite / no-breaking-change constraints) and the safe path to resolve it later. Honesty: these are real, open items — not closed.

## Launch-Critical
**None.** No item in this register blocks launch; all are quality/structure debt, not functional or security defects. (Security gates were addressed in 2.1 D1/D8 and the pre-existing security phases; re-verified by the authz smoke.)

## High
| ID | Item | Why open | Safe resolution path |
|---|---|---|---|
| R-H1 | `routes.ts` monolith (14,362 lines) — coupling + change-risk hub | Splitting is rewrite-shaped; this phase forbids file splits / new architecture / breaking changes. Carried from 2.1 A1/D10. | Dedicated, approved refactor phase: extract domain route groups into `routes/*` modules one domain at a time, each behind an authz + behavior smoke. |

## Medium
| ID | Item | Why open | Safe resolution path |
|---|---|---|---|
| R-M1 | Schema dual-truth: Drizzle `shared/schema.ts` ⟂ lazy `ensureSchema` raw SQL | Reconciling the source-of-truth is rewrite-shaped + risk across all newer tables. Carried from 2.1 A3/D5. | Pick one canonical path per table family; migrate incrementally with parity tests. |
| R-M2 | Other large files (`storage.ts` 5,057, `routes/capadex.ts` 4,462, `schema.ts` 3,569, `capadex-concern-intelligence.ts` 3,117, `competency-runtime.ts` 2,827, `employer-portal.ts` 2,495, `email.ts` 2,080) | Same split constraint as R-H1. | On-touch modularization during feature work. |
| R-M3 | Copy-pasted never-throws read-helper idiom (`tableReady`/`scalar`/`rows`/`pct`) across many composer services | Extracting a shared `lib/` helper touches a large fraction of 442 services with regression surface under a no-regression mandate (report 03 §4). | Add `lib/db-read.ts`; adopt **on-touch** only, never a big-bang sweep. |
| R-M4 | Validation adoption split — `lib/validate.ts` (Zod) used by modular routes, ad-hoc checks in legacy `routes.ts` | Standardizing legacy input handling risks behavior change. Carried from 2.1 D6/D7. | On-touch: gate handlers with `lib/validate` as they are edited. |

## Low
| ID | Item | Why open | Safe resolution path |
|---|---|---|---|
| R-L1 | 4,538 `console.*` call sites vs canonical `lib/logger.ts` | Bulk migration is disruptive with no behavior gain. Carried from 2.1 D9; this phase models on-touch adoption (3 files). | On-touch `console.*` → `logger` during edits. |
| R-L2 | 46 remaining intentional empty `catch {}` (safe-parse / never-throws / script cleanup) | Intentional; logging would be noise (report 02 §2). | None required; annotate only if a specific path later proves to hide a real failure. |
| R-L3 | Response-envelope inconsistency across legacy vs modular routes | Standardizing is client-breaking. Carried from 2.1 D7. | Additive/versioned envelope, not in scope here. |
| R-L4 | Genuine TODO at `exam-ready.v1.routes.ts:176` (Razorpay plan-lookup stub) | Already fails honestly (HTTP 500 when unconfigured); fixing = adding business/payment functionality, out of scope ("no new features"). | Implement under a commerce phase with Razorpay config. |

## Deferred / Honest-NULL (cannot measure in this environment)
| ID | Item | Why |
|---|---|---|
| R-D1 | Long-method + cyclomatic-complexity inventory | Requires AST tooling not present; the platform's own `engineering-intelligence` engine reports these as DEFERRED, never estimated. |
| R-D2 | Transitive circular-dependency proof | Requires a graph tool (`madge`); static import scan found no runtime-breaking cycle but completeness is not claimed (report 04 §2). |

## Out of scope by mandate (noted, not actioned)
- `mentor-reset-email` TODO (`routes.ts:6726`) — a feature note; "no new business features."
- Adding test coverage — additive; not required to *resolve* existing debt.
