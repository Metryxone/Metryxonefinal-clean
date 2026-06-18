---
name: WC-L4 Intervention Intelligence (first action layer)
description: How CAPADEX's first adaptive ACTION layer composes interventions honestly — one generator, the rest annotate, polarity traps, honest ceilings.
---

# WC-L4 — Intervention Intelligence (compose-only action layer)

The "first adaptive action layer" must COMPOSE, never produce. Getting this right is mostly about
discipline over what is allowed to GENERATE an intervention vs merely annotate it.

## The one rule that prevents fabrication: exactly ONE generator
- The ONLY thing allowed to *generate* an intervention is the already-curated, **library-backed**
  L2 Outcome actions (`wc3_outcome_actions` → `intervention_library`, surfaced via `getSessionOutcomes`).
  Each intervention IS a real library row (its uuid + `intervention_text`). Never invent program names
  (e.g. "Confidence Builder") — that is new ontology = fabrication.
- Stage / Journey / Decision / User / Trend / Forecast are **priority/context ANNOTATIONS only**. They
  raise priority and add context; they can never create an intervention. Wiring an "annotation" as a
  generator is the classic over-reach here.

**Why:** an action layer is where fabrication is most tempting (it's the user-facing payoff). Anchoring
generation on a curated library with a real FK makes "never generic" structural, not a promise.

## Confidence is INHERITED, never blended
- Confidence = the generating outcome model's own confidence. When one library row is surfaced by >1
  model, keep the **MAX** contributor (selection), never average. Record every contributor in `sources`.

## Degraded sources contribute ZERO (honest ceiling, not a low-confidence vote)
- Journey/Decision frequently resolve to the degraded mentoring-fallback / NULL-outcome path. That is a
  *routing guarantee*, not evidence of need → it contributes **zero** context (only the `degraded:true`
  marker is recorded). In dev, Decision was **100% degraded** (0 real / 6 of 6) — a true data ceiling,
  reported as such, not engineered around.

## The non-obvious honest gap: annotations can't generate
- A user can have a genuine **concern trend** (e.g. lakshman, ≥2 sessions) yet **no library-backed action**
  on their sessions → those trend concerns attach to **nothing**. This is correct (annotations don't
  generate), and reporting it honestly (trend concerns exist at user level but realized-on-intervention = 0)
  is the finding, not a bug to "fix".

## Polarity trap (must be encoded in the registry)
- `directionOf(slope)` is a **pure numeric slope sign** — NOT polarity-aware. For positive-progression
  metrics a `declining` slope is the concern; for the `behaviour_risk` dim and the `risk` forecast kind a
  RISING value (`improving`) is the concern. `isTrendConcern`/`isForecastConcern` encode per-metric /
  per-kind polarity so a *falling risk* trend is never mis-read as a problem. Trend metric names are
  PREFIXED (`behaviour_confidence`, not `confidence`) — match exactly or the lookup silently misses.

## Dual-axis reporting (never merge)
- **Structural Readiness** = is it built/wired (flag, registry, generator, annotations, hook, persistence)
  — a property of the CODE (5/5 in dev). **Activation Readiness** = is real intelligence flowing
  (generator fires, real journey/decision context, trend/forecast consumption) — bounded by the data
  ceiling (2/5 in dev). Keep them separate; Activation < Structural is the honest, expected state.

## Forecast annotations have a flag dependency worth disclosing
- Forecast concern annotations require `FF_FORECAST_INTELLIGENCE` ON when the engine runs. The default
  Backend API workflow does NOT enable it, so in current prod they'd be **absent**. The backfill enabled
  it to realise forecasts wherever the ≥2-session trend exists — disclose this in the audit, don't let a
  flag-off read as a data gap.

## Mechanics that bit / matter
- Two services already named `intervention-engine.ts` / `intervention-intelligence.ts` exist at
  `services/` root — the WC-L4 ones live under `services/wc3/`.
- `composeInterventions` outer catch must set a distinct `compose_error` meta flag, NOT fold the error
  into `outcome_unclassified` — otherwise a real failure masquerades as an "honest empty spine".
- Persist = UPSERT on PK `(session_id, intervention_id)` + stale-prune (`NOT (id = ANY($2::uuid[]))`),
  so re-runs are idempotent (verified: stays 6 rows). Cast the prune array to `::uuid[]`.
- Backfill must force the live-workflow flag set ON for its own process (separate `tsx` process inherits
  none of the workflow env) + the WC-L4 flag + Forecast flag.
