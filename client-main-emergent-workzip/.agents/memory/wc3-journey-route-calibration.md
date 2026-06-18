---
name: WC-3 journey route calibration
description: Why a plausible persona can be misrouted by the WC-3 L3 journey engine, and what's actually a calibration (not structural) fault.
---

# WC-3 journey routing — calibration traps

WC-3 L3 journey ranks routes by `Σ model_affinity(route,model) · model_confidence`.
DEV activation across 5 personas surfaced an emergent misroute that is NOT visible
from reading any single file — it falls out of the catalog + confidence interplay.

## The misroute (real finding, not a harness artifact)
A Parent (constructs FAMILY_DYNAMICS, EMOTIONAL_REGULATION, STRESS_MANAGEMENT) routes to
**competitive_exam**, not lbi/mentoring. Three independent causes compound:
1. **Shared constructs leak across models.** `STRESS_MANAGEMENT` sits in BOTH
   `confidence_stability` AND `exam_readiness` `construct_keys`. One shared construct
   fully activates `exam_readiness`.
2. **Outcome model confidence is quantized at 0.76** — a 1-construct overlap scores the
   SAME as a 3-construct overlap. So a coincidental single hit ties a strongly-evidenced
   model. (This flat-0.76 is the proximate enabler.)
3. **`competitive_exam` has the catalog's highest single affinity (0.90) to
   `exam_readiness`** → it wins the route fit even off one leaked construct.

**Why it matters:** don't "fix" this by tuning the harness or seeding different
constructs — the inputs were plausible. The fault is calibration: make model confidence
overlap-proportional (matched/total), and/or require an EXAM_* construct (not a shared
one) before `competitive_exam` can be PRIMARY.

## Resolution (applied — R1 + R2, both calibration, no schema change)
- **R1:** L2 model confidence is now `stage·0.5 + (actions?0.3:0) + min(1, overlap/3)·0.2`
  — an overlap-DEPTH term breaks the flat-0.76 tie (saturates at 3 matched constructs).
  R1 alone does NOT fix the parent: `exam_readiness`'s 0.90 affinity still beats `lbi`
  even at reduced confidence. The depth term is necessary but not sufficient.
- **R2 (the actual fix):** in `buildJourney`, `competitive_exam` may be PRIMARY only when
  `exam_readiness` matched ≥1 **dedicated** `EXAM_*`-prefixed construct. Absent that, when
  it holds top raw fit AND ≥2 real candidates exist, it is DEMOTED to secondary (kept
  supported — invariant b) and the next non-exam real candidate becomes primary.
  **Keep the candidate list in honest raw-fit order** (exam stays rank-0 with its true
  higher fit); only the chosen primary/secondary differ, and `route_reason` explains it.
- **Chose the guard over deleting `STRESS_MANAGEMENT` from the exam model** — exam-stress
  is a legitimate exam-readiness signal; the guard kills the spurious PRIMARY without
  discarding real corroborating signal.
- **Persistence nuance:** the transient `reason='exam_guard_demoted'` is NOT stored in
  `wc3_journey_state` (only `degraded` rows persist a `reason` on re-read); the persisted
  `route_reason` text carries the explanation. A machine-readable demotion code would need
  a new column (schema change — deliberately not done).

## Other durable notes
- **Missing-home personas are honest findings.** `learning_effectiveness`'s highest route
  affinity is `competitive_exam` (0.70) → general young learners have no non-exam home;
  `FAMILY_DYNAMICS` is in NO outcome model (orphan, correctly ignored). These are catalog
  coverage gaps, not bugs to paper over.
- **Always-route invariant holds**, but an all-activated scenario set does NOT exercise
  the empty-spine Mentoring fallback. Any activation suite needs a no-construct case.
- **Validating WC-3 without the full UI:** seed `capadex_sessions` + active
  `behavioural_hypotheses` constructs (the exact input L2 reads) and call the real
  resolvers in hook order (stage→snapshot→outcome→journey). Only the construct vector is
  synthetic; all routing logic runs for real. Clean up synthetic rows after measuring.
