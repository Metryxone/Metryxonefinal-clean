# Program 2 · Phase 2.1 — 04 · Repository Cleanup Report

## 1. Cleanup APPLIED this phase (zero-risk only)
| Action | Target | Evidence it is safe | Behavior impact |
|---|---|---|---|
| **Delete** | `backend/DcokerFile` | Zero bytes (`wc -c` = 0); misspelling of `Dockerfile`; **no references** in `.replit`, `backend/scripts/`, or any `.ts/.json/.sh/.yaml`; the real `Dockerfile` (13 lines) is untouched | **None** — an empty, unreferenced file cannot participate in any build/deploy path |

That is the **only** change applied. Everything else below was investigated and **deliberately NOT changed** because the evidence did not justify a zero-regression edit.

## 2. Candidates investigated and REJECTED for removal (evidence did not justify)
| Candidate | Why rejected |
|---|---|
| 17 "orphan" services | **All 17 are actually imported** (verified `.js`-extension-aware). Zero true orphans. (report 02) |
| `-v2` route/service modules | The `-v2` modules are the **active** system (flags default ON); both `-v2` and bare are registered. Removal would regress. (report 01/02) |
| Logical "duplicate" service pairs (adaptive-assessment, ai-governance) | Distinct importers → specialization, not redundancy. (report 02) |
| `services/*-seed.ts`, `competency-master.ts` | Used by seed scripts; keeping seeders co-located is intentional. Not dead. |

## 3. Cleanup candidates REQUIRING APPROVAL (not applied — see report 06)
- 9 duplicate route registrations in `routes.ts` (per-pair, behavior/security review needed).
- Missing auth gate on `POST /api/assessment-templates/seed`.
- Non-transactional double-insert in `routes/mei-v2.ts`.
- Schema dual-truth reconciliation (Drizzle `schema.ts` vs lazy `ensureSchema`).
- Incremental validation/response/logging standardization.

## 4. Honesty statement
The repository is **already cleaner than naming heuristics suggested**. The headline "many duplicates/orphans" claim **did not survive verification**. Reporting a near-empty cleanup is the honest outcome; fabricating deletions to look productive would violate the no-regression and honesty constraints.
