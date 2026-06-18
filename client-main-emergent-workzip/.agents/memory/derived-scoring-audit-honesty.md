---
name: Derived scoring/prioritization audit honesty
description: Rules for a prioritization/scoring audit layered on a prior grounding audit — map readiness deterministically, never silently upgrade a stub, flag safety overrides as explicit tier exceptions.
---

When an audit **scores or prioritizes** decisions on top of a prior **grounding** audit
(e.g. DC-2 over DC-1), every readiness/maturity sub-score must be a **deterministic map** of the
prior audit's verified status: `real→5 · gated-real→4 · partial→3 · stub→2 · absent/missing→1`.
Impact/value dims (user/business/revenue/future) stay **design estimates** and must be labelled
as such; DIS / activation-lift / conversion-lift numbers are **directional**, not forecasts
(there is no decision telemetry until the decision object ships).

**Why:** the architect honesty pass repeatedly catches the **same class of error** — a
stub/absent surface silently scored as "partial" (e.g. an institution bulk/cohort mentor-
allocation surface that the grounding audit marked ✗ scored as 3; a crisis path marked P scored
as gated-real 4), and a **safety force-elevated row blended into a "quick-win" tier** whose
definition it actually violates. These inflate the picture exactly where honesty matters most.

**How to apply:**
1. Add a **grounding-traceability appendix** mapping each readiness cell → prior-audit source
   status, so the map can't drift into overstatement.
2. When force-elevating a safety/crisis decision into a "ready-now" tier, mark it an explicit
   **EXCEPTION** (its true readiness/difficulty unchanged) — never relabel it as meeting the
   tier criterion.
3. **Recompute composites** after any cell correction (mean of applicable readiness; priority =
   impact × readiness).
4. Expect a Fail on the first architect pass for this class of overstatement; fix the specific
   cells rather than arguing — then the traceability appendix prevents recurrence next phase.

**Two recurring phrasing traps (caught on the WC-7A activation-maturity audit):**
- **Eligibility ≠ achieved.** Do not write "N layers reach 90% via small moves" when the
  projection table only shows them *eligible* to reach 90% without a large build (e.g. they sit at
  85–88 after the small tier). The architect reads the table, not the intent — say "can reach 90%
  WITHOUT a large build" and add an explicit eligibility table (per layer: highest tier needed +
  whether a greenfield build is required). The honest core is usually "small where it can be,
  large where it must be" — name the few layers with a hard floor.
- **Reused metric name = different unit must be disambiguated up front.** When a new composite
  borrows an existing acronym (e.g. "AIS 2.0" Activation score vs the prior "AIS" Assessment
  score), state the two are different units and never compared, in a table near the top — or the
  reader silently conflates them.
