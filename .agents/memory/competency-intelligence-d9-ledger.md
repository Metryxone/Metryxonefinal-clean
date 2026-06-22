---
name: Competency Intelligence (D9 Admin) canonical ledger
description: Which tables the D9 admin overview must read, and why it showed zeros.
---

# Competency Intelligence D9 admin — read the canonical scoring ledger

The D9 admin overview (`/api/admin/competency-intelligence/overview`) must derive
population scores from **`onto_competency_profiles`** — the live, append-only scoring
ledger. Take the latest profile per `subject_id`, then expand the `profile` JSONB
(array of per-onto-domain entries `{label, onto_domain, scaled_score, ...}`) into
per-domain rows. Competency granularity here is the **onto domain** (`dom_*`), not the
legacy COG/COM bank codes.

**Why:** the panel originally read `cra_scores` / `p4_development_velocity` /
`competency_forecasts`, all of which are **empty, unwired telemetry tables** nothing
populates — so every KPI rendered 0 even though real scores existed. Forecast/velocity
panels legitimately stay empty until longitudinal (≥2-session) data exists; that is an
honest data gap, not a wiring bug.

**How to apply:** any new population-level competency metric reads the `onto_*` ledger
(profiles for scores, score_runs for finer per-competency detail), never `cra_scores`.
A clearly-labelled `demo_ci_*` cohort can be seeded to populate every panel for demos
(purgeable; `scripts/seed-competency-intelligence-demo.ts --purge`).
