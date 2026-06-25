# MX-301 Phase 3 — Enterprise Report Pack

**Option C (Enhanced Hybrid Enterprise Validation).** A presentation-quality enterprise pack of
**16 reports** for one realistic, fully removable demonstration candidate, persisted into the
live Report Factory and exported in **four formats each (64 files total)**.

- **Candidate**: Sarah Johnson — Senior Product Manager, Technology, 8 yrs, MBA, Bangalore (demonstration data, purgeable).
- **Subject (masked)**: `user_4286d980cc6c`
- **White-label**: MetryxOne (primary `#0B2447`, accent `#2E8B8B`)
- **Generated**: 2026-06-25T17:17:46.911Z
- **Build / rollback**: `npx tsx backend/scripts/mx301-report-pack.ts [--rollback]`
- **Provision candidate first**: `npx tsx backend/scripts/mx301-demo-candidate.ts`

## Every report ships the SAME fixed enterprise layout (9 sections)

Executive Summary · Candidate Information · Assessment Summary · Visualizations · Interpretation ·
Recommendations · Confidence Level · Data Source · Generated Timestamp.

Formats: **PDF + HTML + JSON + CSV** (preview = HTML). The no-empty guard refuses to emit the pack if any
report is structurally incomplete — **16/16 reports passed** with no blank charts or empty tables.

## Three separate axes (never composited)

- **Activation** — the report generated and persisted. All 16 reports activate.
- **Coverage** — the candidate has measurable input for that report. **12/16** are measured;
  the rest render a professional *"Insufficient validated data"* state — honest, not a failure, not fabricated.
- **Confidence** — trustworthiness of the produced value (calibration / domain-proxy vs direct), reported per report.

`null` is never coerced to `0`.

## Per-report state

| Report | Measurable | Coverage | Confidence | State |
| --- | --- | --- | --- | --- |
| Executive Summary | YES | n/a | Provisional | measured |
| Competency Profile | YES | n/a | Provisional | measured |
| Competency Radar | empty | n/a | n/a | insufficient data (honest) |
| Competency Heatmap | empty | n/a | n/a | insufficient data (honest) |
| Strengths | YES | 100% | Moderate | measured |
| Development Areas | YES | 100% | Moderate | measured |
| Role Readiness | empty | n/a | n/a | insufficient data (honest) |
| Promotion Readiness | YES | n/a | Moderate | measured |
| Employability Index | YES | 100% | Moderate | measured |
| Career Recommendations | YES | n/a | Provisional | measured |
| Learning Roadmap | YES | n/a | Provisional | measured |
| Skill Gap | empty | n/a | n/a | insufficient data (honest) |
| Interview Readiness | YES | n/a | Operator-recorded | measured |
| Employer Competency Match | YES | 61.8% | Calibrated | measured |
| Career Passport | YES | 100% | Moderate | measured |
| Action Plan | YES | n/a | Provisional | measured |

## Interview enrichment (demonstration input)

A real interview was scheduled and **4 panel scores** were recorded for the demonstration candidate (tagged `mx301`, fully purgeable), so the Interview Readiness report renders measured data rather than an empty state.

## Dashboard sync (super-admin Reports Console)

The pack is persisted into the live `rf_generated_reports` table the super-admin console reads:

| Surface | Rows |
| --- | --- |
| Generated reports (tenant `mx301`, complete) | 16 |
| Pack templates | 16 |
| White-label config | 1 |

**In sync:** YES — DB rows match the generated pack.

## Reversibility & safety

Every row is tagged `mx301` / tenant `mx301` and removed by `--rollback`. Engines are driven in-process
(the same functions the HTTP routes call) behind `FF_REPORT_FACTORY`; the build is additive and reversible and
touches no production data. The candidate email is masked to an irreversible pseudonym in every committed file.

## Scope

This validates the report **product** (composition, fixed layout, four-format export, honest empty states,
dashboard persistence) for one demonstration candidate. Route-level auth / feature-flag gating is validated per
phase elsewhere and is intentionally out of scope here.
