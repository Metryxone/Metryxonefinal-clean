# 10 · Technical Debt Enhancement Matrix

**Honesty:** "Debt" here = measured structural risk, not bugs. Most of what looks like debt (158 OFF flags,
20 `-v2` files) is **deliberate, clean, flag-gated additive architecture** — that is *governance surface*,
not rot. Real debt is concentrated in a few monoliths, test/CI thinness, and parallel-version cleanup.

## Measured signals
| Signal | Measured | Interpretation |
|---|---|---|
| `routes.ts` size | 14,504 lines | **real debt** — one mega-route file |
| Largest FE files | EmployerPortalPage 10,160 · CareerBuilderPage 8,754 · UnifiedParentDashboard 5,948 | **real debt** — monoliths |
| `-v2` files | 20 (5 with v1 sibling mounted) | parallel-version cleanup candidates (review, not auto-delete) |
| OFF feature flags | 158 / 190 | **deliberate dormancy**, not debt — lifecycle-governed |
| Live tables vs Drizzle | 1,441 vs 134 | schema drift / lazy-ensure tables outside canonical schema — governance gap |
| Real TODO/FIXME | ~2–4 actionable | **very low** — codebase is not littered with markers |
| Tests | 62 test files; no CI gate | **real debt** — coverage unknown, not enforced |

## Enhancement opportunities
| ID | Enhancement | Evidence | Impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| TD-1 | **Decompose monoliths** (`routes.ts` 14.5k; EmployerPortal 10k; CareerBuilder 8.7k) into domain modules — behavior-preserving | wc -l | maintainability, regression-safety, perf (ties UXE-1/PE-1) | medium | L | **High** |
| TD-2 | **Establish CI + coverage gate** (lint + frontend build + isolation + targeted tests) — workflows exist but aren't a gate | 62 tests, no CI | prevents regressions; enterprise expectation | low | M | **High** |
| TD-3 | **Resolve parallel `-v2` versions** — explicit deprecate/retire decisions (lifecycle engine exists) for the 5 mounted v1+v2 pairs | 20 -v2 files | removes ambiguity, dead-path risk | low | M | Medium |
| TD-4 | **Canonicalize schema** — reconcile 1,441 live tables vs 134 Drizzle (document lazy-ensure tables; migrate canonical ones into `schema.ts`) | information_schema vs pgTable | schema clarity, drift control | medium | L | Medium |
| TD-5 | **Tidy `replit.md`** (now ~23.6k tokens) — move detail to docs/, keep README lean (flagged by system) | replit.md size | contributor onboarding | low | S | Low |
| TD-6 | **Dependency hygiene** — audit + dedupe (mockup-sandbox hoisted-dep traps recorded in memory) | memory: mockup-sandbox-hoisted-deps | build stability | low | M | Low |
| TD-7 | **Dead-code / orphan-module sweep** using the platform's own evolution-intelligence markers scan | MX-700 1.40 markers engine | smaller surface | low | M | Low |

## What is NOT debt (do not "fix")
- **158 OFF flags / MX-700 & MX-800 dormant engines** — clean, byte-identical-OFF, lifecycle-tracked.
  Activating them to "reduce debt" would be the opposite of correct. **Leave OFF until evidence justifies.**
- **`-v2` additive phases that have no v1** — intended successors, not duplicates.

## Technical-debt enhancement summary
Real debt is **narrow and well-known**: a few monoliths (TD-1) and the absence of an enforced CI/coverage gate
(TD-2). Both are **High** and both are behavior-preserving. The large flag/table counts are **governed
dormancy and lazy-schema**, not rot — the enhancement there is *documentation/governance*, never activation.
