# Program 2 · Phase 2.1 — 05 · Technical Debt Resolved

## Resolved this phase
| # | Item | Type | Resolution | Risk |
|---|---|---|---|---|
| R1 | Stray empty `backend/DcokerFile` (misspelled duplicate of `Dockerfile`) | Repository hygiene | Deleted (zero-byte, unreferenced) | None |
| R5 | **D1** — `POST /api/assessment-templates/seed` unauthenticated | Security (P0, approved) | Added `requireAuth` + inline super_admin guard (WC-C8A pattern). Verified: anon → 401 | Low — endpoint had **zero callers**; only privileged callers affected |
| R6 | **D2** — `GET /api/hr/jobs/:id` effectively public (public reg shadowed auth twin) | Security (P0, approved) | Added `requireAuth` to the served registration; removed the now-redundant **equivalent** dead twin. Verified: anon → 401; `/published` still 200 | Low — only the authenticated admin hook consumes it |
| R7 | **D4** — `routes/mei-v2.ts` wrote `mei_scores` then `mei_score_history` without a transaction | Data integrity (P2, approved) | Wrapped both inserts in `BEGIN/COMMIT` on a dedicated client with `ROLLBACK` + `release()` | None — same inserts, now atomic |
| R8 | Regression guard for the two P0 auth fixes | Test (additive) | Added `scripts/program2-2.1-authz-smoke.ts` (asserts seed→401, jobs/:id→401, published→200) | None — additive |
| R9 | **D3** — 8 DIVERGENT dead duplicate route registrations (`/api/hr/jobs` GET+POST, `/api/hr/applications` GET, `/api/hr/mentors` GET, `/api/institute/students` GET+POST, `/api/lbi/sessions` GET+POST) | Dead-code removal (P1, approved) | Removed the shadowed second registration in each pair; kept the served (first) handler — it carries the safer/richer logic in every case. Express serves the first match so removal is runtime-neutral | None — dead code that never executed |

### CORRECTED finding — duplicate routes were NOT all redundant (now resolved)
Report 03 §6 originally listed 9 duplicate `routes.ts` registrations as "likely redundant." On per-pair handler comparison this was **too optimistic and is corrected**: **only 1 of 9 pairs** (`GET /api/hr/jobs/:id`) was functionally equivalent — removed under D2. The **other 8 pairs were DIVERGENT implementations** (the dead second copy adds/omits real logic, e.g. audit-log writes, pagination/filters, Zod validation, raw-SQL inserts, institute scoping). Removing them is a **behavior decision**, so it required explicit human approval rather than being auto-applied as cleanup.

**Resolution (user-approved):** adjudicated per-pair — in all 8 the **first (served) registration is canonical** (richer/safer logic); the shadowed second registrations never executed (Express serves the first match), so removal is **runtime-neutral**. All 8 dead duplicates were removed (R9 above); served handlers and non-duplicated routes are untouched. See report 06 D3 for the per-pair table and verification.

## Investigative debt resolved (claims closed with evidence)
These were *suspected* debts that verification **cleared** — closing them is itself a deliverable (prevents future wasted/destructive work):

| # | Suspected debt | Outcome |
|---|---|---|
| R2 | "17 orphan services to delete" | **Cleared** — all referenced; 0 true orphans (corrected `.js`-aware grep) |
| R3 | "`-v2` modules are dead duplicates" | **Cleared** — `-v2` is the active runtime (flags ON); both registered intentionally |
| R4 | "Logical duplicate services (adaptive-assessment / ai-governance)" | **Cleared** — distinct importers = specialization, not redundancy |

## Honest scope note
Only **one** code-affecting debt item (R1) was safely resolvable within the Enhancement-Only / No-Regression / Human-Approval constraints without the ability to run the full build+test gate in this environment. The substantive debt (duplicate routes, missing auth gate, schema dual-truth, non-transactional writes, convention drift) is **real but approval-gated** and itemized in report 06. Resolving it inside Phase 2.1 without sign-off would risk the very regressions the acceptance criteria forbid.
