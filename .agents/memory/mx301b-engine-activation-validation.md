---
name: MX-301B downstream-engine assessment-receipt validation
description: How to honestly validate that downstream intelligence engines RECEIVE a candidate's competency assessment (not just that routes are wired).
---

# Validating "engine received the assessment data"

A read-only harness (`backend/scripts/mx301b-career-intelligence-activation.ts`) probes the
LIVE HTTP surface for a demonstration candidate (id==email) and classifies each engine into
`received | wired_no_data | flag_gated | forbidden | broken`. Deliverables under
`backend/audit/mx-301b/` (PII masked to `user_<sha256>`).

## Durable rules (don't relearn these)
- **`received` ⇒ the engine's OWN `measurable` flag is true AND the candidate's measured
  values actually flow through.** A `measurable:true` envelope is NOT enough.
  **Why:** talent-matching returns `measurable:true` but `evidence_mix.measured=0`,
  every `actual_level` null, `match_pct=0` — because the candidate has domain-proxy ledger
  data (`onto_competency_profiles`) NOT precise `comp_*` levels
  (`onto_competency_question_map` ceiling). That is the documented precise⟂domain-proxy
  split — it MUST downgrade to `wired_no_data`, never `received`.
- **A mutation route (e.g. `POST /api/v2/career-builder/activate/:userId`) is probed
  UNAUTH-ONLY.** Never send an authed mutating request from a read-only validator.
  **Why:** gating order is `requireFoundation → requireActivation → requireAuth → handler`,
  so an unauth probe (flag-OFF→503, flag-ON→401) is always non-mutating and still proves
  the route is wired+gated; an authed POST under flag-ON would materialize `cg_user_*` rows.
- **Self-session auth is bound to the demo subject.** Only the demo candidate has a known
  password; a custom CLI subject must SKIP self-auth (self-scoped engines report an honest
  "not validated") rather than silently authenticate as the wrong principal.
- **flag-OFF (503) is an honest "not activated", not a defect** — report it with the exact
  one-line dev enable (`FF_*=1`), never flip the flag.

- **The generic payload detector only knows TOP-LEVEL shapes** (`gaps[]`, `overall_score`,
  `evidence_mix`…). Engines that nest their measured values — e.g. career-gap puts per-comp
  `actual_level` under `buckets.<type>.items[]` + `summary.most_material`, prioritization under
  `items[]`+`bands` — are FALSE-NEGATIVE `wired_no_data` until you add a shape-specific handler.
  **Why:** a `measurable:true` engine surfacing real derived gaps still read as no-data purely
  because the harness couldn't find the number. **How to apply:** add the handler BEFORE the
  generic block, and gate `received` on a GENUINE finite measured value (a finite `actual_level`,
  a non-empty measurable `items[]`) so the handler can never flip an empty/non-measurable payload.
- **The deliverable's narrative prose must be DERIVED from the verdict sets, never hardcoded.**
  **Why:** hand-written "root-cause" bullets and the verdict-tail dependency list silently went
  stale and contradicted the results table once an engine flipped to `received`. **How to apply:**
  build every per-engine explanation + the verdict dependency list conditionally from the live
  `wired_no_data`/`flag_gated` membership, so prose can never claim a now-RECEIVED engine is dark.
- **Domain-proxy actuals are a LEGITIMATE measured input for the developmental gap chain.** Once
  the role anchor resolves, career-gap/readiness/roadmap DERIVE per-comp `actual_level` from the
  candidate's 5 domain-proxy scores — that IS `received`. Only the hiring-facing precise match
  (`comp_*`) stays the honest ceiling. Don't lump the developmental chain in with the precise split.
