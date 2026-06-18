---
name: CAPADEX → Career Builder behaviour bridge
description: Non-obvious constraints when wiring a user-level behaviour profile into Career-OS ranking engines
---

## Per-job ranking modifiers must use a per-job feature, not a user-level scalar
**Rule:** A user-level scalar (e.g. executionReadiness) added equally to every item in a
comparator CANCELS and reorders nothing. A *monotonic* transform of the existing score
(e.g. `fit + k*(fit-50)`) ALSO preserves order. To actually reorder, the modifier must
multiply a per-item feature that is independent of the existing sort key.
**Why:** `rankJobsForUser` first shipped `(b.fit+execMod)-(a.fit+execMod)` (no-op) and then a
monotonic `fit + execGap*(fit-50)` (still no-op). Only `fit + followThrough*W*stageMomentum(status)`
— where `stageMomentum` derives from each job's pipeline `status` — genuinely reorders.
**How to apply:** When making any ranking "X-aware" where X is a user-level trait, find a
per-row dimension X should interact with (job status, role family, intervention effort). Verify
with a tiny standalone sort over crafted rows BEFORE claiming it works — comparator bugs are
silent and tsc-clean. Also size the weight: a boost smaller than typical score gaps never
flips anything (weight 8 over ~8-pt fit gaps did nothing; 12 was needed).

## "No behaviour change when data absent" needs a real-data gate, not just "profile exists"
**Rule:** A backend that returns a NEUTRAL fallback object (rather than null/404) will silently
override legacy heuristics unless the consumer gates on a real-data marker.
**Why:** `buildCareerBehaviorProfileForUser` returns `{profile: neutralProfile(), session_id: null}`
when no session is linked. The frontend originally adopted any truthy `profile`, shifting users
with zero behavioural data onto neutral-55 outputs — violating the fallback guarantee.
**How to apply:** Gate adoption on the provenance field (`session_id` non-null here; elsewhere
`sources.length`/`confidence`). Treat a neutral fallback as "no data," not "data = neutral."
