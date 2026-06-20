---
name: Phase 5 Talent Intelligence consolidation
description: How the 7 Phase-5 hiring components relate, and the audit-gap-fill discipline that keeps "missing tables" from becoming fabricated schema.
---

# Phase 5 — Talent Intelligence & Hiring Platform

The seven mission components (Employer / Recruiter / Job-Architecture / Talent-Matching /
Assessment-led-Hiring / Hiring-Intelligence / Workforce-Intelligence) already exist as code +
schema, scattered across EP-98 / TIG / EIOS / M5 / LBI / V2 efforts. There is **no** unifying
`employer-intelligence.ts` service — the logic lives in route files (`routes/employer-*.ts`,
`recruiter-postings.ts`, the `talent-*.ts` family). The live shared DB is empty for the hiring
substrate (employer_*, ep98_*, lbi_scores, tig_calibration = 0 rows).

The consolidation surface is `services/talent-intelligence-aggregator.ts` +
`routes/talent-intelligence.ts` behind flag `talentIntelligence` (env `FF_TALENT_INTELLIGENCE`,
default OFF). It is a **read-only, never-throws, to_regclass-probed** aggregator that folds the 7
components into one status view (Coverage = data exists, Confidence = sufficient/calibrated, kept as
separate axes). The Step-4 funnel engine `services/talent-funnel-intelligence.ts` reuses the same
flag (one Phase-5 product surface, avoid flag sprawl).

**Rule — audit-named "missing tables" are not automatically gaps.**
**Why:** Step-1 named `candidate_master`, `ontology_taxonomy`, `m5_workforce_metrics` as absent, but
`rg -w` across the whole backend found **zero** consumers (FROM/JOIN/INSERT/to_regclass). They were
audit-prose artifacts. Materialising them would add dead schema and invite fabricated rows into a
shared dev/prod DB — a contract violation.
**How to apply:** before building any "gap-fill" table/route an audit flags as missing, grep for a
real consumer first. No consumer ⇒ do NOT build; document the evidence and move on. A gap-fill step
producing zero code can be the correct, honest outcome.
