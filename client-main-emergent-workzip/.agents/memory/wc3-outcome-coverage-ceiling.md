---
name: WC-3 outcome/journey coverage ceiling
description: Why CAPADEX WC-3 outcome+journey coverage caps at ~80% and what can vs cannot lift it — the two-ceiling structure across the L5C/L5D/WC-10 chain.
---

# WC-3 outcome & journey coverage ceiling

The clarity-bank intelligence chain is Question → Bridge Tag → **Construct** (L5C crosswalk) →
**Outcome model** (7 wc3_outcome_models) → **Journey route** (6 wc3_journey_routes). Coverage is
bounded by TWO distinct ceilings — confusing them leads to chasing unreachable targets.

## The two ceilings (do not conflate)
- **Construct-reachability ceiling** — fraction of questions whose bridge tag resolves to ≥1
  construct at all (HIGH construct or any REVIEW candidate). This is the HARD max for any change
  on the OUTCOME-MODEL side. You cannot route a question to an outcome if it has no construct.
- **Outcome coverage** — fraction whose construct(s) land in some model's `construct_keys`. Always
  ≤ the construct ceiling. The gap between them is the **residual-construct** set (constructs that
  resolve fine but sit in no model).

## Why journey coverage == outcome coverage
Journey is strictly downstream of outcome; the `mentoring` route is a fallback with affinity for
all 7 models, so every outcome-bearing question reaches ≥1 route (≈100% journey-among-outcome).
So Δoutcome ≈ Δjourney, and a 4-layer arithmetic mean (stage+context+outcome+journey)/4 sits BELOW
the 3-layer mean because the journey layer just re-inherits the outcome ceiling — a higher mean is
not a real readiness gain.

## The three levers (WC-10 audit finding)
1. **Outcome-model expansion** — fold residual constructs into existing `construct_keys` (e.g.
   CAREER_GROWTH→career_clarity, DIGITAL_DISCIPLINE→decision_quality). Reversible data edit, no new
   models. Lifts coverage toward the construct ceiling and STOPS there.
2. **New outcome model** — only for residuals with no defensible existing fit (PHYSICAL_WELLBEING →
   a holistic_wellbeing model). SAFETY_THREATS stays unmapped (crisis-escalation path, not a
   developmental outcome) — do NOT force it into a behavioural model.
3. **Crosswalk reduction of UNMAPPED/ABSENT** — the ONLY lever that lifts the construct ceiling
   itself (REVIEW→HIGH, UNMAPPED→construct). Required to exceed the construct ceiling.

**Why this matters:** "expand the outcome models to hit 90%" is impossible when the construct
ceiling is below 90% — model expansion caps at the ceiling. Reaching 90%+ outcome/journey (and
~97% 3-layer QI) REQUIRES the crosswalk lever too. Report this honestly; never fabricate coverage
or force a residual construct into a semantically-wrong model to hit a target.

## How to apply
- WC-10 audit = `backend/scripts/wc3/wc10-outcome-coverage-audit.ts` (SELECT-only; simulates folds
  against CLONED in-memory models, never mutates wc3_outcome_models) → `backend/audit/wc-10/`.
- Build the construct gap-matrix universe from the authoritative `CONSTRUCTS` registry
  (behavioural-constructs.ts), NOT the observed/model union — else zero-volume UNUSED constructs
  silently vanish and a "all N constructs" claim becomes false.
- Residual count (no-outcome questions) < per-construct candidate volume: a REVIEW tag can offer a
  model-reaching candidate that "rescues" the outcome, so its other (residual) candidate still
  appears in candidate totals but not in the residual set. Document the distinction in the report.
