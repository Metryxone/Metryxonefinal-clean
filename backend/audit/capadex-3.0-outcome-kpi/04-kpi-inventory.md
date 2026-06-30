# CAPADEX 3.0 · Phase 1.6 — KPI Inventory

> Deliverable 04 · Generated 2026-06-30T14:10:24.976Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:93309b17121a, written 2026-06-30T14:10:24.975Z).
> Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption (never composited); null ≠ 0; never fabricated.

The 10 canonical KPI families. KPIs are COMPUTED by the EXISTING enterprise-analytics + benchmark + mei/employability engines — this phase builds NO new KPI engine. `status` is Coverage (does the KPI substrate + a computing engine exist); population is ADOPTION-driven (deliverable 08).

| KPI family | Status | Example KPIs | Services | Tables | Absent (honest) |
|---|---|---|---|---|---|
| Individual KPIs (`individual`) | SUPPORTED | Assessment completion; Readiness band; Improvement delta vs baseline | 2/2 | 1/2 | scoring_runs |
| Persona KPIs (`persona`) | PARTIAL | Per-persona completion rate; Per-persona realized-outcome rate | 1/1 | 2/2 | — |
| Lifecycle KPIs (`lifecycle`) | SUPPORTED | Stage distribution; Promotion rate; Time-in-stage | 1/1 | 2/2 | — |
| Assessment KPIs (`assessment`) | SUPPORTED | Completion rate; Assessment coverage; Reassessment rate | 1/1 | 1/1 | — |
| Journey KPIs (`journey`) | PARTIAL | Funnel conversion; Journey drop-off; Outcome-tail completion | 1/1 | 1/1 | — |
| AI KPIs (`ai`) | PARTIAL | Diagnosis coverage; Recommendation acceptance (honest-null); AI effectiveness (abstained) | 1/1 | 1/1 | — |
| Learning KPIs (`learning`) | SUPPORTED | Learning progress; Intervention uptake; Practice engagement | 2/2 | 2/2 | — |
| Business KPIs (`business`) | PARTIAL | Placement rate; Hiring conversion; Revenue (separate ledger, honest-null here) | 1/1 | 2/2 | — |
| Organizational KPIs (`organizational`) | SUPPORTED | Cohort movement; Institute coverage; Batch progression (aggregate) | 2/2 | 2/2 | — |
| Platform KPIs (`platform`) | PARTIAL | Active users; Retention; Engagement (daily KPI roll-up) | 1/2 | 3/3 | — |

## Definitions & honesty notes
- **Individual KPIs** (`individual`, SUPPORTED) — Per-subject growth measures (readiness score, improvement delta, completion).
- **Persona KPIs** (`persona`, PARTIAL) — Per-persona success metrics rolled up across subjects of a persona.  _Persona roll-up via READ-TIME join (capadex_user_profiles.persona ⟂ validation_loop_outcomes); k-anon suppressed; no persona dimension added to the ledger — Coverage present, volume adoption-gated._
- **Lifecycle KPIs** (`lifecycle`, SUPPORTED) — Stage distribution + promotion / progression rates across the coded ladder.
- **Assessment KPIs** (`assessment`, SUPPORTED) — Assessment throughput, coverage and reassessment rate.
- **Journey KPIs** (`journey`, PARTIAL) — Funnel conversion / drop-off / outcome-tail completion across the journey.  _Journey substrate present (validation_loop_outcomes + journey-tail); conversion KPIs are adoption-gated (real volume) — Coverage⟂Adoption._
- **AI KPIs** (`ai`, PARTIAL) — Diagnosis coverage + recommendation acceptance / effectiveness.  _Diagnosis/recommendation substrate present; acceptance/effectiveness is ABSTAINED — no decision-time prediction recorded (Confidence axis, honest-null), never fabricated._
- **Learning KPIs** (`learning`, SUPPORTED) — Learning progress + intervention uptake measures.
- **Business KPIs** (`business`, PARTIAL) — Placement / hiring conversion + commercial outcomes (revenue reported separately).  _Placement/hiring realized via validation_loop_outcomes; revenue lives in the SEPARATE commerce ledger (capadex_payments) and is NOT composited into outcome KPIs — Coverage present, accuracy/volume adoption-gated._
- **Organizational KPIs** (`organizational`, SUPPORTED) — Cohort movement + institute / batch coverage (k-anon aggregate).  _Real k-anon aggregation (MX-302H); scores masked below k_min, roster always shown._
- **Platform KPIs** (`platform`, PARTIAL) — Active users / retention / engagement rolled up by the analytics engine.  _Analytics KPI substrate present (anl_kpi_daily/anl_cohort_analysis); population is adoption-driven (real volume) — Coverage⟂Adoption, null≠0._
