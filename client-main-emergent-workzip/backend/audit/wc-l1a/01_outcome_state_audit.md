# Deliverable 1 — Outcome State Audit (`wc3_outcome_state`)
_Generated 2026-06-08T16:54:03.604Z_

## 1. Why Outcome state is not being persisted
Two independent reasons, BOTH must be addressed:

**(a) The persistence path has produced no rows for any existing session.**
- The writer `resolveSessionOutcomes` is wired into `postCompletionHooks` (Phase B block), gated on
  `isWc3OutcomeEnabled()` (`FF_WC3_OUTCOME`, **ON** in the Backend API workflow).
- `postCompletionHooks` runs only at session completion and is **fire-and-forget + never-throws**, so
  from the data alone two causes are indistinguishable: (i) **no session has completed since the
  hook/flags were activated** — newest completion is **7d** old (`updated_at` window
  2026-05-17T16:45:27.342Z → 2026-06-01T09:51:56.734Z); or (ii) the hook **ran but wrote nothing /
  failed silently**. R1 (one live completion) disambiguates. Either way: no rows, and no backfill script.

**(b) Even when run, the Outcome resolver writes NOTHING for these sessions (honest UNCLASSIFIED).**
`resolveSessionOutcomes` only persists when the session has ACTIVE behavioural constructs
(`loadSessionConstructs`):
| Tier | Source | Availability here |
|---|---|---|
| 1 | `behavioural_hypotheses` (lifecycle='active', construct_key) | **0 rows system-wide** → none |
| 2 | `capadex_session_patterns.construct_key` | **column does not exist** → tier unavailable |
| 3 (flag) | crosswalk: `primary_construct_key` ∪ concern-bridge-tag construct (needs `FF_WC3_OUTCOME_CROSSWALK`, currently **OFF**) | `primary_construct_key` on **2/9**; non-UNMAPPED bridge tag on **1/9** |

With no constructs, every model fails to match → `unclassified: true` → **no row written** (by design,
never fabricated).

## 2. Do persistence hooks already exist?
**Yes.** Fully implemented and wired: `resolveSessionOutcomes` (UPSERT on `(session_id, model_key)`)
+ companion `wc3_outcome_actions`, plus the read path `getSessionOutcomes` and GET
`/api/capadex/session/:id/outcome`. The code is correct and never-throws; it simply has no input.

## 3. Is backfill possible using existing intelligence?
**Not meaningfully today.**
- **Under current runtime flags** (crosswalk **OFF**): classifiable =
  **0/9** (tier-1 empty, tier-2 unavailable, tier-3 gated off).
- **If `FF_WC3_OUTCOME_CROSSWALK` were enabled**: upper bound **3/9**
  candidate sessions (2 carry a `primary_construct_key`, 1 a non-UNMAPPED bridge
  tag) — and even then only IF the bridge tag resolves to a construct (not asserted here).
- Corpus is ready (`wc3_outcome_models`=8, `intervention_library`=140); the
  block is the empty per-session spine, not reference data.

## Per-session spine availability (completed sessions)
| Session | Email | active hyp (tier-1) | primary_construct_key | bridge tag (tier-3) |
|---|---|---|---|---|
| `0731f92c…` | yes | 0 | no | — |
| `b883418d…` | yes | 0 | no | — |
| `7828d7a3…` | yes | 0 | no | — |
| `4349237c…` | no | 0 | yes | — |
| `4c9b6c0b…` | no | 0 | yes | — |
| `d0f54fc4…` | no | 0 | no | — |
| `a0924499…` | no | 0 | no | — |
| `11111111…` | yes | 0 | no | — |
| `1cd9ca07…` | yes | 0 | no | EXAMINATION_STRESS |

## Coverage
- Outcome State Coverage = **0/9 = 0.0%**.

> **Honest ceiling:** Outcome cannot be populated by re-running compute alone — it is blocked upstream
> on behavioural-spine capture (`behavioural_hypotheses`) and/or enabling the crosswalk over sessions
> that carry a resolvable construct/bridge tag. See the Remediation Roadmap. Nothing is fabricated.
