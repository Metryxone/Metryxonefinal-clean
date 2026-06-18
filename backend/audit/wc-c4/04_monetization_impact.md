# WC-C4 · Deliverable 4 — Monetization Impact
_Generated 2026-06-10T07:29:55.423Z. Live ledger via `buildEntitlementOverview` + `capadex_payments`._

## Revenue surfaces protected
- **14/14** paid CAPADEX surfaces now require entitlement when the flag is ON.
- Coverage axis (surface guarded) is SEPARATE from impact axis (sessions actually blocked) — never merged.

## Live paying population (real recorded payments — not estimates)
| Metric | Value |
|---|---|
| paid ledger rows (`capadex_payments` status='paid') | 0 |
| paying identities (distinct paid emails) | 0 |
| entitled identities (resolver grants ≥1 feature) | 0 |
| entitlement coverage | n/a |
| active package grants | 0 |
| ledger degraded | false |

## Impact on the current session population
| Metric | Value |
|---|---|
| total sessions | 27 |
| sessions on a PAID stage | 4 |
| sessions that WOULD be blocked (402) flag ON | 4 (14.8% of all) |
| sessions allowed (free or entitled) | 23 |

## Honest reading
- The live ledger holds **0 paid rows** (and 6 pending — pending never entitles). The
  per-identity gate resolves entitlement from `capadex_payments status='paid'` ONLY.
- **4 session(s)** carry a PAID `stage_code` (CAP_INS → requires `insight_report`) with NO owned paid stage, so flag ON the gate returns **402** on their paid surfaces (blocked-session status: 3 replaced, 1 in_progress). This is the gate working as designed — paid-tier content is no longer free.
- It also means enabling the flag is **NOT byte-identical on the current data**: those 4 unpaid paid-stage session(s) lose access until a real payment exists. Byte-identical is guaranteed ONLY with the flag OFF (deliverable 5: 0 DB touch).
- These are the *monetization target* the gate creates: identities that reached a paid tier without paying are now required to pay. Whether they convert is earned, not claimed here.
- Coverage (surface guarded) and impact (sessions blocked) are reported as separate axes; the gate is the prerequisite that makes paid stages defensible, not a revenue lift on its own.
