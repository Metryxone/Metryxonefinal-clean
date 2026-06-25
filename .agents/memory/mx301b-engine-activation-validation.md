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

## Honest baseline at time of writing
3 received (Career Readiness, Promotion Signal, Employability Index — all consume the
EI/domain-proxy ledger) · 7 wired_no_data (skill-gap family unresolved role requirements;
learning roadmap downstream of gap; employer match = ledger split; interview = operator-input;
passport UNSYNCED until `POST /api/passport/sync`) · 2 flag_gated (Career Builder) · 0 broken.
