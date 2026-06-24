# MX-77X · Section 11 — Employer Workforce UI (design, not built this phase)

**Status:** DESIGN ONLY (no employer-facing build this phase — scope is SuperAdmin activation +
docs). Documented so the reachable employer surface is explicit and honest.

## Existing employer substrate (already live)
- **TIG** (`/api/employer/tig`, Engines 1–8) — 72 nodes / 1680 edges / 40 intelligence rows on the
  seeded employer pipeline (40 candidates / 1 job). Employer auth is SESSION-only (requireAuth).
- **Employer Portal (EP-98)** — `employer_*` tables, candidate drawer surfacing Coverage (domains)
  vs Confidence (calibration) SEPARATELY.

## Reachable employer workforce views (when surfaced)
| View | Source | Employer value |
|---|---|---|
| Pipeline skill-gap | `m5_organizational_skill_gaps` + obsolescence | gaps in the candidate pool vs role target |
| Succession / bench | `m5_succession_*` | internal successor readiness bands (developmental) |
| Mobility | derived from succession candidates | internal move readiness |
| Talent risk | `wos_workforce_risk` / `wos_ai_exposure` | attrition / AI-exposure risk signal |
| Calibration | `tig_calibration` | success-probability calibration (uncalibrated < 30 outcomes) |

## Honesty constraints (must carry into any employer build)
- **Developmental signals only** — never hiring / promotion / suitability verdicts (platform language
  policy + the console disclaimer).
- **Decision-SUPPORT not decision** — advance / targeted / gather_more / development_focus, never
  hire/no-hire (MX-100X P5 precedent).
- **k-anonymity k≥30** — cohort comparisons suppressed below 30 distinct subjects.
- **Calibration fails closed** — borrowed prior never upgrades TRUST; `uncalibrated` until ≥30 real
  Hired/Rejected outcomes.
- **Coverage ⟂ Confidence** surfaced separately in the candidate drawer.

## Reachability ceiling
- Employer surface is hiring-pipeline scoped, NOT a resident-workforce HRIS console; org-wide
  workforce planning belongs to the M5 layer behind the SuperAdmin console.
