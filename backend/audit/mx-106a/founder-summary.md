# MX-106A — Founder Summary

**Can a candidate go from assessment all the way to downloadable reports, and can
every persona see it? → YES, end-to-end.**

_Generated 2026-06-25T00:48:55.716Z. One synthetic demo candidate walked the entire journey._

## What works, in plain terms
- The candidate **took a real competency assessment** and got a scored profile.
- That profile flows into an **employability index, role readiness, career
  recommendations, and a career passport** — each one written to the database this run.
- The platform produced **9 downloadable report files**
  (PDF, JSON and CSV) through the Report Factory.
- **4 of 4 personas** (Candidate, Employer, Super Admin, Founder)
  could read the results back.

## The honest picture
- **12 of 12** measurable journey stages produced real (not imputed) numbers
  for this subject; the rest are wired but had no measurable input and say so honestly.
- These numbers come from a **synthetic demo candidate**, so they certify the machinery
  works end-to-end — not real-world usage. Real-data confidence is a separate axis.

## What to fix next (not blockers)
- Report Factory ships default templates for only 4 of the journey report types (capadex, career, competency, passport). No default template exists for `employability` — exercised via an ad-hoc payload here; add a seeded employability template in a follow-up so it has a first-class report.
- Employer competency-match is now non-null for a MEASURABLE candidate: competencyMatch=100/100 over 10/27 requirements (coverage 9.1%), via a comp_* → onto-domain crosswalk — 0 direct competency match(es) and 10 domain-proxy. Domain-proxy attainments are clearly labelled (matchVia=domain_proxy / matchedLedger "(domain_proxy)") and never represented as per-competency measurements. Residual unassessed requirements (O*NET-inherited keys + competencies in unmeasured domains) stay an honest coverage gap, never fabricated.
