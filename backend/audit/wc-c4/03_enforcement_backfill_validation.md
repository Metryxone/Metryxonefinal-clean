# WC-C4 · Deliverable 3 — Enforcement Projection Over the Live Session Population
_Generated 2026-06-10T07:29:55.423Z. Flag ON (`FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT=1`); every session driven through the REAL `requireEntitlement` handler._

Flag state during projection: ON = **true**. Sessions evaluated: **27**.

## Decision distribution (real middleware outcomes)
| Decision | Sessions | Meaning |
|---|---|---|
| `allow_free` | 23 | CAP_CUR / null / unknown stage / not-found → `next()` (no paid content) |
| `allow_entitled` | 0 | paid stage AND identity owns the report feature → `next()` |
| `block_402` | 4 | paid stage, identity does NOT own it → 402 `entitlement_required` |
| `fail_503` | 0 | ledger fault → 503 `entitlement_unavailable` (fail-closed) |

## Session stage distribution
| stage_code | sessions | gate treatment |
|---|---|---|
| CAP_CUR | 23 | free / unknown → never gated |
| CAP_INS | 4 | paid → requires `insight_report` |

## Blocked sample (PII-masked; ≤25)
Blocked-session status breakdown: **3 replaced, 1 in_progress**.

| session | stage | session status | identity | required_feature | reason |
|---|---|---|---|---|---|
| 572ce3ce… | CAP_INS | replaced | user_4b262cc8a5 | `insight_report` | no_entitlement |
| b91f7939… | CAP_INS | replaced | user_4b262cc8a5 | `insight_report` | no_entitlement |
| aa95dcc5… | CAP_INS | replaced | user_4b262cc8a5 | `insight_report` | no_entitlement |
| 3c977f08… | CAP_INS | in_progress | user_4b262cc8a5 | `insight_report` | no_entitlement |
