# WC-L5 · Deliverable 3 — Memory Recall (cross-session continuity)
_Generated 2026-06-10T04:43:53.119Z. Read-only._

**Memory Recall Rate** = of the users with ≥2 completed sessions, the fraction whose earlier-session memory
is retrievable at a later session (via the read-only retrieval engine `getMemoryTimeline`). This is a
CROSS-SESSION continuity measure — the denominator is the **2** longitudinal users, never the
9 completed sessions.

| Metric | Value |
|---|---|
| Longitudinal users (≥2 sessions) | 2 |
| Users whose memory spans ≥2 sessions | 2 |
| **Recall rate** | **100.0%** (2/2) |
| Anonymous sessions excluded (no email key) | 4 |

## Per-user recall (masked)
| user | distinct sessions with memory | memory rows |
|---|---|---|
| user_65454b2b8b | 2 | 36 |
| user_4b262cc8a5 | 2 | 30 |

## Round-trip fidelity (STRUCTURAL axis)
Persist→retrieve fidelity: for every emailed user the read-only retrieval engine returns EXACTLY the rows
persisted in `wcl5_memory` (count parity). Users checked: **3** · exact match:
**3** · all match: **YES**. Fidelity is a property of the code
(persistence ↔ retrieval), independent of how much data exists.

## Honest ceiling
Only **2** users have a second session, so the recall numerator can never exceed 2
today regardless of engine quality. **4** anonymous completed sessions carry no email and are
structurally excluded from recall. Both are true data ceilings — reported, never engineered around.
