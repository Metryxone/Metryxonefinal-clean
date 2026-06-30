# Program 2 · Phase 2.2 — 01 · Technical Debt Inventory

**Mode:** Implementation · Enhancement-Only · Search-Before-Modify · Reuse-Before-Build · Repository-evidence only.
**Precondition:** Program 2 · Phase 2.1 (Repository Architecture Alignment) = COMPLETE + user-approved. Verified satisfied.
**Honesty contract:** every number below is MEASURED from the live repository (ripgrep / `wc -l` / import verification). Nothing estimated. Intentional architecture is NOT counted as debt. Coverage ⟂ Confidence ⟂ Severity are separate axes.

## 0. Scope note (no double-counting with 2.1)
Phase 2.1 already inventoried + resolved the **`routes.ts` + architecture-alignment** debt surface (drift A1–A5; debt items D1–D11). Phase 2.2 re-scans the **whole repository** (442 services, 248 scripts, ORM, lib, error-handling/logging/dead-code/dependency patterns) for *additional* measurable debt and resolves what is **clearly safe and non-breaking**. Items already owned by 2.1 are referenced, not re-counted, here.

## 1. Repository size (measured)
| Surface | Count / size |
|---|---|
| Backend `.ts` total lines | 437,529 |
| `routes/*.ts` modules | 332 |
| `services/*.ts` | 442 |
| `scripts/*.ts` | 248 |
| `lib/*.ts` | 12 |
| `routes.ts` monolith | 14,362 lines |
| `shared/schema.ts` | 3,569 lines |
| Largest files | `routes.ts` 14,362 · `storage.ts` 5,057 · `routes/capadex.ts` 4,462 · `shared/schema.ts` 3,569 · `routes/capadex-concern-intelligence.ts` 3,117 · `config/feature-flags.ts` 2,928 · `services/competency-runtime.ts` 2,827 · `routes/employer-portal.ts` 2,495 · `email.ts` 2,080 |

## 2. Debt by category (measured, repository-backed)

| Category | Measured signal | Severity | Disposition |
|---|---|---|---|
| **Large files** | 9 files > 2,000 lines; `routes.ts` 14,362 | Medium | **Policy-bound** — split is rewrite-shaped, forbidden by this phase ("DO NOT split files unless clearly justified / No new architecture"). Carried from 2.1 A1/D10. |
| **Long methods** | Requires AST tooling (not present) | — | **Honest NULL / DEFERRED** — the existing `engineering-intelligence` engine reports the same (AST signals deferred, never estimated). |
| **Duplicate code** | Route-registration duplicates already removed in 2.1 (D2/D3, 9 pairs). Residual: a copy-pasted never-throws read-helper idiom (`tableReady`/`scalar`/`rows`/`pct`) recurs across many composer services | Low–Medium | See report 03. Helper consolidation = high-churn across 442 services → **register, on-touch only** (not bulk-refactored here). |
| **Dead code / unused services** | 9 candidates flagged by an exploratory scan → **all 9 disproven** (each is genuinely imported/registered). **0 true dead services.** | — | **No deletion.** Confirms 2.1 "0 orphans". See report 03 §3. |
| **Unused APIs** | Duplicate/shadowed route registrations were the only real instance — resolved in 2.1 (D2/D3) | — | Closed by 2.1. |
| **Legacy / deprecated modules** | `-v2` + bare pairs co-exist, but `-v2` are the **active** runtime (flags default ON) — not deprecated | — | No safe removal (2.1 A4). |
| **Circular dependencies** | See report 04 — no evidence of import cycles that break or risk runtime; hub coupling concentrated in `routes.ts` | Low | Coupling is the monolith problem (policy-bound). |
| **Tight coupling** | `routes.ts` is the central hub (14k lines, ~all domains) | Medium | Same as Large files (policy-bound). |
| **High complexity** | Requires AST (cyclomatic) — not present | — | **Honest NULL / DEFERRED.** |
| **Missing validation** | `lib/validate.ts` exists (Zod); adoption split (modular routes adopt, legacy `routes.ts` uses ad-hoc checks) | Low–Medium | **Policy-bound, on-touch** (2.1 D6/D7). Standardizing legacy response shapes is client-breaking → not done. |
| **Missing error handling** | Unguarded handlers of the D8 class resolved in 2.1. Repo-wide: **6 runtime sites** silently swallowed *rare/important* failures (schema-ensure middleware, unified-profile source reads, report enrichment) | Low | **RESOLVED this phase** → report 02. |
| **Missing logging** | `lib/logger.ts` exists; 4,538 `console.*` call sites (intentional convention) | Low | **Policy-bound, on-touch** (2.1 D9). Bulk migration is not justified. |
| **Missing tests** | 63 test files alongside 248 scripts (many are smoke/e2e) | Low | Adding tests is additive; not required to resolve existing debt. No change. |

## 3. Marker scan (measured)
| Signal | Count | Note |
|---|---|---|
| `@ts-ignore` / `@ts-nocheck` | **0** | Clean. |
| DDL-batch-swallow bug class (`CREATE TABLE … .catch(()=>null)`) | **0** | The historically-documented bug class is fully absent. |
| `TODO`/`FIXME`/`HACK`/`XXX` markers | **12** | 9 are inside the platform's own debt-scanner services (`engineering-intelligence.ts`, `platform-evolution-intelligence.ts`, `report-pack.ts`, `ai-governance-schema.ts`, `mx700-1.40-validate.ts`) i.e. the literal strings are scanner logic, not debt; 1 false positive (`?domain_code=XXX` comment); **2 genuine** (`routes.ts:6726` mentor-reset-email note — a *feature* note, out of scope for "no new business features"; `exam-ready.v1.routes.ts:176` Razorpay plan-lookup stub that already fails honestly with HTTP 500 when unconfigured). |
| `.catch(() => null/{}/undefined)` | 750 | The platform's **intentional never-throws read-composer convention** (`null ≠ 0`). Not debt. |
| `console.*` | 4,538 | Logging convention (see Missing logging). |
| Empty `catch {}` blocks | 52 total | 46 are intentional (smoke/audit/test cleanup, safe-parse fallbacks, never-throws reads); **6 runtime sites** with silent swallow of rare/important failures were resolved (report 02). |

## 4. Honest headline
The repository is **lean and intentionally architected**. The measurable, *safely-resolvable* technical debt was substantially harvested in Phase 2.1. The large remaining items (route monolith, schema dual-truth, validation/response/logging standardization) are **architecture-rewrite-shaped and explicitly forbidden** by this phase's constraints; they remain policy-bound + on-touch (report 07). Phase 2.2's genuinely-new safe resolution is a small, surgical error-handling/observability improvement (report 02). Fabricating larger "resolution" would violate the honesty + no-regression constraints.
