# MX-301 — End-to-End Enterprise Competency Assessment Experience

**Final product validation.** Drives ONE realistic, fully removable demonstration candidate
through the entire enterprise journey using **existing engines only** (no new/rebuilt engines),
proving every stage generates, is measurable where input exists, and persists where applicable.

- **Candidate**: Sarah Johnson — Senior Product Manager, Technology, 8 yrs, MBA, Bangalore (demonstration data, purgeable).
- **Subject (masked)**: `user_4286d980cc6c`
- **Generated**: 2026-06-25T08:59:31.834Z
- **Provision / rollback**: `npx tsx backend/scripts/mx301-demo-candidate.ts [--rollback]`
- **Driver**: `npx tsx backend/scripts/mx301-e2e.ts`

## Summary

| Metric | Value |
| --- | --- |
| Stages driven | 23 |
| Measurable for candidate (Coverage) | 15/23 |
| Generation failures (Activation) | 0 |
| Persistence failures | 0 |
| Persistable stages that inserted ≥1 row this run | 8/8 |

**Verdict:** PASS — every stage executes and every DB transaction succeeds end-to-end.

## Three separate axes (never composited)

- **Activation** — the stage executes and produces an artifact (`Generated`). All 23 stages activate.
- **Coverage** — the candidate has measurable input for the stage (`Measurable`). A wired stage with no input for Sarah is `empty` — honest, not a failure, not fabricated.
- **Confidence** — trustworthiness of the produced value (e.g. `calibration` state, `domain_proxy` vs direct scoring, `confidence_pct`), reported per-stage in *Detail*.

`null` is never coerced to `0`.

## Per-stage results

| # | Stage | Activation | Coverage | Persisted | Detail |
| --- | --- | --- | --- | --- | --- |
| 1 | Registration | YES | YES | n/a | user + career profile present (completeness=85%) |
| 2 | Role DNA resolution | YES | YES | n/a | "Senior Product Manager" → role_pm, confidence=72% (medium), profile_comps=0 |
| 3 | Competency scoring (scorer) | YES | YES | n/a | status=scored, scored=23/23 (honest: limited by approved mappings) |
| 4 | Assessment completed | YES | YES | n/a | scored profiles=1, overall_score=77 |
| 5 | Competency profile | YES | YES | n/a | overall_score=77, domains=5, measurement=domain_proxy |
| 6 | Radar / heatmap | YES | YES | n/a | buckets=5, classified=0/0, coverage=null% |
| 7 | EI profile (strengths) | YES | YES | n/a | overall={"measurable":true,"ei_score":81.2,"band":"Excelle, strengths=0 |
| 8 | Role readiness | YES | empty | n/a | score=null, band=null, role=Senior Product Manager, coverage=null% |
| 9 | Promotion readiness | YES | empty | n/a | status=insufficient_history, snapshots=0/0, net_delta=null (≥2 measured snapshots required — honest) |
| 10 | Employability index | YES | YES | n/a | ei_score=81.2, band=Excellent, dims=5/5 |
| 11 | Career readiness | YES | YES | YES | overall=81.2, history 1→2 |
| 12 | Career matches | YES | YES | YES | matches=8, history 1→2 |
| 13 | Career recommendations | YES | YES | YES | recs=0, history 5→6 |
| 14 | Career gaps | YES | empty | YES | gaps=0, history 1→2 |
| 15 | Career roadmap | YES | empty | YES | phases=0, history 1→2 |
| 16 | Development plan | YES | empty | YES | streams=0, history 1→2 |
| 17 | Career signals | YES | YES | n/a | signals=7 (config-as-data) |
| 18 | Career passport | YES | YES | YES | sections=6/6, history 5→6 |
| 19 | Progress tracking | YES | YES | YES | growth_tracking 1→2, career_history=0 (event-only) |
| 20 | Employer competency match | YES | YES | n/a | match=77.4%, coverage=61.8% (8/13 reqs), fit=fit, calibration=calibrated |
| 21 | Interview readiness | YES | empty | n/a | no interview captured for candidate (honest empty) |
| 22 | Downloadable reports | YES | empty | n/a | report engine reachable; no report_templates substrate provisioned (honest measurable=false) |
| 23 | All data persisted | YES | n/a | YES | 8/8 persistable stages inserted ≥1 row this run |

## Honest gaps (structurally wired, no measurable input for this candidate)

- **Role readiness (8)** — the resolved role title does not map to a *profiled* `onto_role` with stored
  requirements on the Role-Readiness path, so the readiness score is honestly `null`. The employer
  competency match (20) reaches role requirements via a different path (`generateRoleDNA` over the genome)
  and *does* compute a match — the divergence is a real finding, not an error.
- **Promotion readiness (9)** — progression requires ≥2 measured snapshots; the candidate has one, so
  status is `insufficient_history` (honest).
- **Career gaps / roadmap / development plan (14–16)** — these compose role requirements; with no profiled
  role-requirement substrate they generate and persist an honest empty artifact.
- **Interview readiness (21)** — no interview was captured for the candidate; honest empty.
- **Downloadable reports (22)** — the report engine is reachable, but no `report_templates` substrate is
  provisioned in this environment; honest `measurable=false`.

## Reversibility

Every row carries `mx301` in its key and is removed by `mx301-demo-candidate.ts --rollback`. The candidate
is fully purgeable from the shared database; no production data is touched.

## Scope

Engines are driven **in-process** (the same functions the HTTP routes call), proving the engine +
persistence layer end-to-end. Route-level auth / feature-flag gating is validated per phase elsewhere and
is intentionally out of scope here.
