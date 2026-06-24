---
name: Ecosystem-activation re-certification questions
description: Why a re-certification question set must live in the service, and how discipline questions differ from journey-step questions
---

# Ecosystem-activation re-certification (read-only journey validation)

A re-certification / "N questions" surface is consumed by THREE clients at once: the offline report
script, the `/certification` API route, and the SuperAdmin panel. **The question set must be built
ONCE in the service (single source of truth), never split** — e.g. service emits Q1–5 and the report
script appends Q6–8 inline. That split silently makes the API + UI show only the subset.
**Why:** the panel/API read `certification().questions`; anything only the script knows is invisible to them.

## Two kinds of questions need two axes
- **Journey-step questions** (data-backed): carry a real `activation` boolean and are the ONLY ones
  counted in `activation_steps_live / activation_steps_total`.
- **Discipline questions** (verified by construction, not row data — e.g. "flag-OFF byte-identical?",
  "wiring intact?", "axes reported separately?"): give them an explicit `activation_na: true` and
  **exclude them from the activation count**. Without `activation_na` a falsy `activation` renders as
  "no data yet", which dishonestly implies a missing measurement for something that has no data axis
  at all.

## Structural ⟂ Activation discipline (the whole point of the surface)
- Verdict is STRUCTURAL only (= % of journey key tables present; PASS≥85 / PARTIAL≥60 / FAIL).
- Activation (live rows per step) is reported ALONGSIDE, never composited into the structural score.
- Honest healthy early state = high structural (machinery built) + low activation (no adoption yet).
  Low activation is NOT a failure and must not drag the verdict down.
- `null` (table absent, via `to_regclass`) stays distinct from `0` (table empty). Never `?? 0`.

**How to apply:** when adding/auditing any flag-gated read-only "certification" composer, put the full
question array in the service, tag non-data questions `activation_na`, and base both the activation
count and the verdict on the right subset.
