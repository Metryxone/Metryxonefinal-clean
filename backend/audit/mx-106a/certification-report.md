# MX-106A — End-to-End Competency Assessment Validation & Certification

**Verdict: PASS**  ·  generated 2026-06-25T00:48:55.716Z

Read-only certification of the complete competency-assessment journey for ONE
purgeable demo subject (`user_masked`, `@example.com`). The run actually TAKES the
assessment to prove the path; all writes are confined to the demo subject and are
purgeable. Honesty canon: Coverage (machinery exercisable) ⟂ Confidence (real
non-demo data) reported separately; persistence proven by before/after row DELTA;
null ≠ 0; unmeasurable is reported, never fabricated.

> **Confidence axis:** every number below is from a synthetic `@example.com` demo
> subject, so real-data **Confidence is 0 by construction**. This certifies the
> machinery is exercisable end-to-end (Coverage / Structural), NOT real-world adoption.

## Flag state at run
- `FF_REPORT_FACTORY` = 1
- `FF_COMPETENCY_RUNTIME` = 1
- `FF_CAREER_INTELLIGENCE` = 1
- `FF_EMPLOYER_COMPETENCY_HIRING` = 1

## Phase-10 certification questions

| # | Question | Verdict | Evidence |
|---|----------|---------|----------|
| 1 | Can a candidate take a competency assessment and have it scored + persisted? | **PASS** | questions=20, answered=20, overall=100, measurement=domain_proxy, domains=2, profile_rows 7→8 |
| 2 | Does a competency profile generate with domain scores? | **PASS** | overall=100, domains=2, measurement=domain_proxy, history=8 |
| 3 | Does the employability index compute from the competency scores? | **PASS** | ei_score=100, ei_band=Excellent, coverage_pct=100, dims=5/5, confidence=60/Moderate |
| 4 | Does role readiness compute for the subject? | **PASS** | role=role_pm, score=100 (over ASSESSED weight), band=ready, coverage=80% (assessed/total weight — SEPARATE axis), fit=strong, blocking_gaps=0, notes=0 |
| 5 | Are career recommendations generated (match / gap / roadmap / development)? | **PASS** | match:true gap:true roadmap:true dev:true |
| 6 | Does the career passport generate + persist? | **PASS** | sections=5/6, history 7→8 |
| 7 | Can downloadable reports be produced through the Report Factory? | **PASS** | 9/9 outputs rendered a non-empty file |
| 8 | Can the Candidate persona read their results? | **PASS** | profile_measured=true, ei_overall=100, readiness=100 |
| 9 | Can the Employer persona read competency-match + hiring recommendation? | **PASS** | competencyMatch=100, coverage=9.1%, reqs=10/27 (0 direct, 10 domain-proxy), source=onto_competency_profile, hiringAction=gather_more_evidence, interview_coverage_ok=false |
| 10 | Can the Super Admin + Founder personas read oversight metrics? | **PASS** | superadmin:true founder:true |

## Journey stages (generated ⟂ measurable ⟂ persisted)

| # | Stage | Gen | Meas | Persist | Detail |
|---|-------|-----|------|---------|--------|
| 1 | Assessment taken+scored | ✓ | ✓ | ✓ | questions=20, answered=20, overall=100, measurement=domain_proxy, domains=2, profile_rows 7→8 |
| 2 | Competency profile | ✓ | ✓ | n/a | overall=100, domains=2, measurement=domain_proxy, history=8 |
| 3 | EI profile | ✓ | ✓ | n/a | overall_ei=100, band=Excellent, coverage=100 |
| 4 | Role readiness | ✓ | ✓ | n/a | role=role_pm, score=100 (over ASSESSED weight), band=ready, coverage=80% (assessed/total weight — SEPARATE axis), fit=strong, blocking_gaps=0, notes=0 |
| 5 | Career matches | ✓ | ✓ | ✓ | matches=8, history 7→8 |
| 6 | Career gaps | ✓ | ✓ | ✓ | gaps=0, history 7→8 |
| 7 | Career roadmap | ✓ | ✓ | ✓ | phases=0, history 7→8 |
| 8 | Development plan | ✓ | ✓ | ✓ | streams=0, history 7→8 |
| 9 | Career passport | ✓ | ✓ | ✓ | sections=5/6, history 7→8 |
| 10 | Career signals | ✓ | ✓ | n/a | signals=7 (config-as-data) |
| 11 | Progress tracking | ✓ | ✓ | ✓ | growth_tracking 7→8 |
| 12 | Employability index | ✓ | ✓ | ✓ | ei_score=100, ei_band=Excellent, coverage_pct=100, dims=5/5, confidence=60/Moderate |

## Report Factory outputs (9 = 5 PDF + 2 JSON + 2 CSV)

| Output | Type | Format | Template | Rendered | Bytes |
|--------|------|--------|----------|----------|-------|
| Assessment (CAPADEX) PDF | capadex | pdf | default | ✓ | 2991 |
| Competency PDF | competency | pdf | default | ✓ | 2965 |
| Career PDF | career | pdf | default | ✓ | 3145 |
| Passport PDF | passport | pdf | default | ✓ | 3203 |
| Employability PDF | employability | pdf | ad-hoc (no default template) | ✓ | 2951 |
| Competency JSON | competency | json | default | ✓ | 6352 |
| Employability JSON | employability | json | default | ✓ | 8239 |
| Career CSV | career | csv | default | ✓ | 660 |
| Passport CSV | passport | csv | default | ✓ | 1412 |

## Persona consumption (read-only)

| Persona | Surface | Can read | Measurable | Detail |
|---------|---------|----------|------------|--------|
| Candidate | profile + EI + readiness | ✓ | ✓ | profile_measured=true, ei_overall=100, readiness=100 |
| Employer | competency-match + interview/hiring rec | ✓ | ✓ | competencyMatch=100, coverage=9.1%, reqs=10/27 (0 direct, 10 domain-proxy), source=onto_competency_profile, hiringAction=gather_more_evidence, interview_coverage_ok=false |
| Super Admin | platform intelligence | ✓ | n/a | headline_groups=11 |
| Founder | founder dashboard | ✓ | n/a | metric_groups=4 |

## Findings
- Report Factory ships default templates for only 4 of the journey report types (capadex, career, competency, passport). No default template exists for `employability` — exercised via an ad-hoc payload here; add a seeded employability template in a follow-up so it has a first-class report.
- Employer competency-match is now non-null for a MEASURABLE candidate: competencyMatch=100/100 over 10/27 requirements (coverage 9.1%), via a comp_* → onto-domain crosswalk — 0 direct competency match(es) and 10 domain-proxy. Domain-proxy attainments are clearly labelled (matchVia=domain_proxy / matchedLedger "(domain_proxy)") and never represented as per-competency measurements. Residual unassessed requirements (O*NET-inherited keys + competencies in unmeasured domains) stay an honest coverage gap, never fabricated.

## Scope & honesty notes
- This is a validation + certification deliverable: it exercises and reports, it does
  NOT rebuild any engine, flip any flag, or deploy.
- The demo subject is `@example.com` (RFC-2606 reserved) and purgeable; remove with
  `DELETE ... WHERE subject_id / user_id = '<demo email>'` across the journey tables.
- All emails / UUIDs / IPv4 in this document are masked; only aggregate counts are written.
