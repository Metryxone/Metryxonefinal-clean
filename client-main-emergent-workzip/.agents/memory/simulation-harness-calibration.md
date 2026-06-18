---
name: CAPADEX simulation harness calibration
description: How to keep the black-box validation harness honest — polarity, concern remap, seed-coverage, and "allowed to fail".
---

The 0C simulation harness drives the REAL CAPADEX public HTTP endpoints (black-box,
never mocks) to validate the pipeline pre-production. When tuning its metrics, these
non-obvious truths matter (each cost real debugging to find against the live engine):

## Polarity — the simulant emits LIVED answers, not pre-scored ones
CAPADEX assessment items are predominantly distress-worded, polarity `(-)`. A
struggling persona AGREES with them (high raw value); the ENGINE reverse-scores that
into a LOW health score. So `simulateAnswer` must NOT reverse on `(-)` — it reverses
only on `(+)` (capability-worded) items.
**Why:** an early version reversed on `(-)`, which made high-severity personas answer
LOW → engine scored them HEALTHY (80–100). `confidenceAccuracy` was inverted.
**How to apply:** severity drives raw agreement; reverse-keying belongs to the engine,
never the simulant. Default missing polarity to `(-)`.

## concernMatch is SEMANTIC, not string-equal
The engine intentionally resolves fine-grained concerns onto coarse master-bucket
labels (e.g. requested `Performance Anxiety` → report `Anxiety & Overthinking`,
`Burnout`/`Decision Fatigue`/`Stress Management` → `Exam Stress`). Exact string
equality on `report.concernName` is the WRONG fidelity check.
**Why:** string-equality scored ~0.33 even when routing was semantically fine.
**How to apply:** credit a resolved label that shares vocabulary with the persona's
concept tokens (or contains a concern keyword ≥4 chars). A genuinely-off remap
(`Burnout`→`Exam Stress`) still scores 0 — that's a REAL routing finding worth surfacing.

## Seed-coverage is a separate dimension, not a relevance failure
A `404` at `/start` means the concern has no seeded questions (a DB data gap). Mark
the run `notSeeded` and bail; exclude it from quality aggregates (which average over
`ok` runs) and count it in `concernCoverage` (soft target ≥0.8) with the unseeded
list surfaced. Some spec personas' concerns may have no seeded question bank — the
harness reports the live unseeded list per run; never hardcode which concerns are
missing (the seed state changes as content is authored).

## The harness is ALLOWED to fail
Its job is to surface pre-production gaps, not to pass. A `fail` verdict (e.g.
relevance ~0.64 vs the 0.85 target, driven by master-bucket mis-routing + unseeded
concerns) is a legitimate, actionable result. Never re-weight metrics just to turn
the verdict green — that destroys the validation's entire purpose.

## Zero-impact contract
Sim sessions are uniquely-emailed (`sim+<tag>-<id>@simulation.metryx`) and purged
after each run by `cleanupSessions` across ALL session-scoped tables — including
`capadex_behavior_graph` and `capadex_runtime_sessions`, which are generated
non-blocking on completion and would otherwise leak.
**Trap:** `session_id` is UUID in several spine tables (composites/patterns/
interventions/behavior_graph) but TEXT in others. A `DELETE ... WHERE session_id =
ANY($1::text[])` throws a type-mismatch on the UUID tables; if that error is
swallowed by a bare `catch {}`, sim rows leak silently into the live DB. Cast on
BOTH sides (`session_id::text = ANY($1::text[])`) and only swallow "table does not
exist" — log every other cleanup error. When smoke-testing by hand, clean up your
own probe sessions too (they share the `@simulation.metryx` domain).
