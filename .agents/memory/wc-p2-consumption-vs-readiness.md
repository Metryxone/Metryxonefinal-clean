---
name: WC-P2 consumption vs readiness measurement
description: How to honestly measure personalization/decision consumption activation without inflating to a >90% target.
---

# WC-P2 — Consumption Rate vs Activation Readiness

When measuring whether user-facing surfaces "consume" intelligence (CAPADEX WC-P2 levers:
A decision-driven activations, B report personalization, C rec personalization, D longitudinal),
report **two INDEPENDENT metrics, never merged**:

1. **Consumption Rate** — did the surface *consume* the intelligence it was given? A provenance
   check that the lever read real resolved intelligence and emitted a grounded block. Honest
   `false` where the session genuinely has none to consume.
2. **Activation Readiness** — did the consumed intelligence resolve to a *fully-fired, actionable*
   output (`ready:true` / full personalization / all layers / trend established)?

**Why:** the original measure conflated the two (counted only `ready:true` and labelled it
"consumption"), which *understated* genuine consumption and merged two distinct questions. The spec
literally asks for "Consumption Coverage / Decision Consumption Rate" — those are consumption, not
readiness. Conversely you must NOT relabel readiness as consumption to hit a target either.

**How to apply:**
- Population = **completed sessions** (`status='completed'`) for the headline — only those produce
  decisions/reports/recs. ALSO print the all-sessions view in the same deliverables so the
  completed-only headline can't be read as cherry-picking.
- A slot is "consumed but not ready" by design: e.g. Commercial reads `decision.confidence` and
  returns `show_options` (consumed, not ready) on low-confidence cold-start — never auto-recommends.
- **Anti-gaming (architect-required):** a consumption classifier built on a negative sentinel list
  must ALSO treat any `*error*/*fail*/*exception*` reason as NOT consumed, and product consumption
  must require explicit decision evidence (non-empty `composed_from`), not just `null==null` route
  parity. Emit a **measurement-integrity ledger** listing every distinct reason code seen and how it
  was classified, so a new reason code can never silently inflate the rate.

**Honest cold-start residuals (real data, not wiring gaps — do NOT fabricate to fix):**
- Report personalization stays low because completed sessions are anonymous self-assessments with
  **null persona**; only sessions with a populated Unified Behavior Graph contribute a source.
- Longitudinal is 0% because `wc3_longitudinal_snapshots` has no repeat-session history yet — a
  single assessment cannot establish a trajectory and none is invented.
- The >90% target is met on the consumption side for the decision-driven activations + recs, and is
  honestly below target for report personalization + longitudinal. Report it as-is; never merge the
  two metrics to manufacture a passing headline.
