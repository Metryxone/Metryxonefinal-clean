# Program 2 · Phase 2.1 — 05 · Technical Debt Resolved

## Resolved this phase
| # | Item | Type | Resolution | Risk |
|---|---|---|---|---|
| R1 | Stray empty `backend/DcokerFile` (misspelled duplicate of `Dockerfile`) | Repository hygiene | Deleted (zero-byte, unreferenced) | None |
| R5 | **D1** — `POST /api/assessment-templates/seed` unauthenticated | Security (P0, approved) | Added `requireAuth` + inline super_admin guard (WC-C8A pattern). Verified: anon → 401 | Low — endpoint had **zero callers**; only privileged callers affected |
| R6 | **D2** — `GET /api/hr/jobs/:id` effectively public (public reg shadowed auth twin) | Security (P0, approved) | Added `requireAuth` to the served registration; removed the now-redundant **equivalent** dead twin. Verified: anon → 401; `/published` still 200 | Low — only the authenticated admin hook consumes it |
| R7 | **D4** — `routes/mei-v2.ts` wrote `mei_scores` then `mei_score_history` without a transaction | Data integrity (P2, approved) | Wrapped both inserts in `BEGIN/COMMIT` on a dedicated client with `ROLLBACK` + `release()` | None — same inserts, now atomic |
| R8 | Regression guard for the two P0 auth fixes | Test (additive) | Added `scripts/program2-2.1-authz-smoke.ts` (asserts seed→401, jobs/:id→401, published→200) | None — additive |

### CORRECTED finding — duplicate routes are NOT all redundant
Report 03 §6 originally listed 9 duplicate `routes.ts` registrations as "likely redundant." On per-pair handler comparison this was **too optimistic and is corrected here**: **only 1 of 9 pairs** (`GET /api/hr/jobs/:id`) is functionally equivalent — that dead twin was removed. The **other 8 pairs are DIVERGENT implementations** (the dead second copy adds/omits real logic, e.g. audit-log writes, pagination/filters, Zod validation, raw-SQL inserts). Removing those would silently lock in the currently-served behavior and discard a possibly-intended implementation — a **latent behavior decision**, not dead-code cleanup. They remain **NOT changed** and require per-pair human adjudication (see report 06 D3).

## Investigative debt resolved (claims closed with evidence)
These were *suspected* debts that verification **cleared** — closing them is itself a deliverable (prevents future wasted/destructive work):

| # | Suspected debt | Outcome |
|---|---|---|
| R2 | "17 orphan services to delete" | **Cleared** — all referenced; 0 true orphans (corrected `.js`-aware grep) |
| R3 | "`-v2` modules are dead duplicates" | **Cleared** — `-v2` is the active runtime (flags ON); both registered intentionally |
| R4 | "Logical duplicate services (adaptive-assessment / ai-governance)" | **Cleared** — distinct importers = specialization, not redundancy |

## Honest scope note
Only **one** code-affecting debt item (R1) was safely resolvable within the Enhancement-Only / No-Regression / Human-Approval constraints without the ability to run the full build+test gate in this environment. The substantive debt (duplicate routes, missing auth gate, schema dual-truth, non-transactional writes, convention drift) is **real but approval-gated** and itemized in report 06. Resolving it inside Phase 2.1 without sign-off would risk the very regressions the acceptance criteria forbid.
