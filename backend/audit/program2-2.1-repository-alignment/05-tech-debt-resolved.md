# Program 2 · Phase 2.1 — 05 · Technical Debt Resolved

## Resolved this phase
| # | Item | Type | Resolution | Risk |
|---|---|---|---|---|
| R1 | Stray empty `backend/DcokerFile` (misspelled duplicate of `Dockerfile`) | Repository hygiene | Deleted (zero-byte, unreferenced) | None |

## Investigative debt resolved (claims closed with evidence)
These were *suspected* debts that verification **cleared** — closing them is itself a deliverable (prevents future wasted/destructive work):

| # | Suspected debt | Outcome |
|---|---|---|
| R2 | "17 orphan services to delete" | **Cleared** — all referenced; 0 true orphans (corrected `.js`-aware grep) |
| R3 | "`-v2` modules are dead duplicates" | **Cleared** — `-v2` is the active runtime (flags ON); both registered intentionally |
| R4 | "Logical duplicate services (adaptive-assessment / ai-governance)" | **Cleared** — distinct importers = specialization, not redundancy |

## Honest scope note
Only **one** code-affecting debt item (R1) was safely resolvable within the Enhancement-Only / No-Regression / Human-Approval constraints without the ability to run the full build+test gate in this environment. The substantive debt (duplicate routes, missing auth gate, schema dual-truth, non-transactional writes, convention drift) is **real but approval-gated** and itemized in report 06. Resolving it inside Phase 2.1 without sign-off would risk the very regressions the acceptance criteria forbid.
