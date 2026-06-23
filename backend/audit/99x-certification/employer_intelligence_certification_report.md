# §9 — Employer Intelligence Certification Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts`

## Verdict: 🟡 PARTIAL — competency-driven hiring intelligence path exists (✅), default-OFF + **0 employer data**

## Chain: Job → Required Competencies → Candidate Match → Calibration → Prediction

| Hop | Verdict | Evidence |
|---|---|---|
| Job → Required Competencies | ✅ | Talent Intelligence Graph (`tig_*`) + Role-DNA competency requirements |
| Required Competencies → Candidate Match | ✅ | candidate drawer surfaces Coverage(domains) vs Confidence(calibration) **separately** |
| Candidate Match → Calibration | 🟡 | `tig_calibration` write-once snapshot path exists; **0 rows** (needs ≥30 realized decisions) |
| Calibration → Prediction | 🟡 | `predicted_prob_at_decision` captured at decision; LEARNED calibration only after Hired/Rejected events |

## Live data
| Surface | Rows |
|---|---|
| `employer_candidates` | **0** |
| `employer_jobs` | **0** |
| `tig_calibration` | **0** |
| `ti_outcome_predictions` | **0** |

## "Employer intelligence must be competency-driven"
✅ **Architecturally MET** — matching is keyed on competency coverage + calibrated confidence, not keyword
search; the design explicitly separates Coverage (which domains) from Confidence (calibration quality) and
uses a monotonic-token guard so async hiring data can't misattribute to the wrong candidate.

## Honest finding
The hiring-intelligence engine is **built and competency-driven** but **dormant**: the employer flow is
default-OFF and no employer/job/candidate rows exist. Calibration cannot occur until **≥30 realized hiring
decisions** accrue — a borrowed prior never upgrades to TRUST. This is a **data-maturity** gap.

**Cannot reach PASS by code** — requires real employer adoption + realized hiring outcomes.
