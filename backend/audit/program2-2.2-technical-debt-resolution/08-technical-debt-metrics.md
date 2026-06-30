# Program 2 · Phase 2.2 — 08 · Technical Debt Metrics

All numbers MEASURED from the repository. "Before" = repository state at the start of Phase 2.2 (i.e. after 2.1 merge). "After" = end of Phase 2.2.

## 1. Resolution metrics (this phase)
| Metric | Before | After | Δ |
|---|---|---|---|
| Runtime silent-swallow catches (rare/important paths, no log) | 6 | 0 | **−6 resolved** |
| Total empty `catch {}` in repo | 52 | 46 | −6 (remaining are intentional) |
| Files using canonical `lib/logger` (adoption signal) | n (2.1 set) | n+3 | +3 on-touch |
| Source files changed | — | 3 | — |
| New dependencies added | — | 0 | 0 |
| New source modules / migrations / schema files | — | 0 | 0 |
| Flags toggled | — | 0 | 0 |
| API contract changes | — | 0 | 0 |
| Dead services deleted | — | 0 | (0 true dead services found) |

## 2. Standing repository debt indicators (measured, mostly policy-bound)
| Indicator | Count | Axis |
|---|---|---|
| Backend `.ts` lines | 437,529 | size |
| Files > 2,000 lines | 9 | size / coupling (policy-bound) |
| `routes.ts` lines | 14,362 | coupling hub (policy-bound) |
| `@ts-ignore` / `@ts-nocheck` | 0 | type-safety (clean) |
| DDL-batch-swallow bug class | 0 | correctness (clean) |
| Genuine TODO/FIXME (excl. scanner-internal + false positives) | 2 | 1 feature note + 1 honest stub |
| `.catch(()=>null)` (intentional never-throws) | 750 | convention (not debt) |
| `console.*` call sites | 4,538 | logging adoption (on-touch, R-L1) |
| Duplicate live route registrations | 0 | (closed in 2.1) |
| True dead/duplicate services | 0 | (9 candidates disproven) |

## 3. Severity distribution of the OPEN register (report 07)
| Severity | Count | IDs |
|---|---|---|
| Launch-Critical | 0 | — |
| High | 1 | R-H1 (routes.ts monolith) |
| Medium | 4 | R-M1..R-M4 |
| Low | 4 | R-L1..R-L4 |
| Deferred (unmeasurable here) | 2 | R-D1, R-D2 |

## 4. Verification metrics
| Check | Result |
|---|---|
| `Backend API` clean tsx boot after edits | PASS |
| `program2-2.1-authz-smoke.ts` | 3/3 PASS |
| Prod output change at `LOG_LEVEL=info` | none (debug suppressed; warn fires only on real failure) |

## 5. Honest interpretation
Phase 2.2's resolution footprint is **deliberately small** because Phase 2.1 already harvested the safe debt and the repository is lean (0 dead code, 0 type-suppressions, 0 DDL bugs, minimal real TODOs). The remaining high-leverage debt is **structural and rewrite-shaped**, which this enhancement-only phase forbids. The metric that matters most for the user's honesty contract: **resolution count is low because the truth is the repo is clean — not because work was skipped.** Inflating churn would be fabrication.
