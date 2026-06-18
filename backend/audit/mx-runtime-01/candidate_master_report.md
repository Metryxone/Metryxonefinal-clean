# WS4 — Candidate Master Report
**Task:** MX-RUNTIME-01 · **Date:** 2026-06-17 · **Method:** additive schema + read-only backfill

## What was built
Four **additive** tables that unify candidate identity across all 5 platform systems
without touching existing data (`candidate_master.sql`):

| Table | Purpose |
|---|---|
| `candidate_master` | identity hub, keyed by normalized email (`candidate_key`) |
| `candidate_source_registry` | per-(candidate, system) presence + record counts |
| `candidate_activation_history` | one event per system a candidate is active in |
| `candidate_profile_completion` | rollup: which of 5 systems each candidate spans |

## Identity model
**Email is the universal join key.** Each system stores identity differently:
- CAPADEX → `capadex_sessions.guest_email`
- Career Builder / Competency / EI → `user_id` → `users.email`
- Employer → `employer_candidates.email`

All normalized via `lower(trim(email))`. The backfill is **read-only** over live
rows — every master row traces back to a real source record; nothing is fabricated.

## Measured results (live DB counts)
| Metric | Count |
|---|---|
| `candidate_master` total | **117** |
| Registered (has `user_id`) | **102** |
| Demo-flagged (`is_demo`) | **117** |
| `candidate_source_registry` present rows | **205** |
| `candidate_activation_history` events | **205** |
| `candidate_profile_completion` rows | **117** |

### Cross-system coverage (the unification proof)
| Systems spanned | Candidates |
|---|---|
| 5 (career+capadex+competency+ei+employer) | **7** |
| 4 | **11** |
| 3 | **2** |
| 2 | **24** |
| 1 | **72** |
| 0 | 1 |

The 7 candidates spanning all 5 systems are the employer-pooled demo candidates
(`mxrt_cand_001…008`) who also completed CAPADEX, competency, and career flows — a
genuine end-to-end identity link across the entire platform.

### Per-system presence
| System | Candidates |
|---|---|
| career_builder | 101 |
| capadex | 56 |
| competency | 20 |
| ei (derived) | 20 |
| employer | 8 |

## Honest notes / caveats
- **`is_demo` = 100%.** Every unified candidate is demo seed. The table is structurally
  correct and ready for real data, but currently contains only synthetic identities.
- **EI is derived, not standalone.** There is no realized-outcome / employability store
  in dev; EI presence is inferred from `cra_profiles` existence. Flagged as `ei`
  (derived) rather than claimed as an independent system.
- **The "0 systems" row** is one user (`users` row) whose email matched no source
  activity — kept honestly rather than dropped.
- **Long tail (72 single-system).** Most candidates touched only Career Builder
  (the 100-registration step). Deep multi-system overlap is limited to the 18
  candidates with ≥4 systems — reported, not inflated.
