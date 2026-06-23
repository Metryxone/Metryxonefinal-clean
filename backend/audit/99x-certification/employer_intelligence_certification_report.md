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

## MX-100X Phase 5 — Employer Competency Intelligence (additive, flag `employerCompetencyHiring`, OFF byte-identical)
Composes the EXISTING engines into ONE read-only flow — Role → Role DNA → Requirements → Competency
Profile → Match → Gap → Readiness → **Interview Recommendation → Hiring Recommendation + Role DNA Benchmark** —
without rebuilding any of them. The legacy heuristic path (`routes/employer-hiring-intelligence.ts`,
STRONG_HIRE/NO_HIRE) is UNTOUCHED.

| Surface | Verdict | Evidence |
|---|---|---|
| Composition engine `services/employer-competency-intelligence.ts` | ✅ | composes `computeCompetencyDrivenMatch` (never recomputes) |
| Interview recommendation | ✅ | focus areas from MEASURED gaps + probe list from UNASSESSED requirements; structure keyed to coverage/fit |
| Hiring recommendation | ✅ | decision-SUPPORT action (advance/targeted/gather_more/development_focus/insufficient) — **NO hire-no-hire verdict** + non-verdict disclaimer |
| Role DNA benchmark surfacing | ✅ | additive `roleDna.benchmark` on the match (single DNA call) + **k-anonymity gate** (k≥30; unknown cohort fails closed) |
| Route `GET /api/v2/employer/competency-match/:candidateId/:jobId/intelligence` | ✅ | same gating chain (foundation→flag→auth→org-IDOR 404); OFF → 503 (byte-identical) |
| Live competency-driven recommendation on real data | 🟡 | **0 employer rows** → match abstains (heuristic fallback), fit WITHHELD, calibration uncalibrated, benchmark abstains — honest |

**Evidence:** `backend/scripts/employer-competency-intelligence-evidence.ts` →
`employer_competency_intelligence_evidence.md` (live trace + crafted-match derivation proof + language-policy
assertion, all PASS). **Smoke:** `backend/scripts/smoke-employer-competency-intelligence.ts` (flag-OFF HTTP 503 +
developmental-language + no-verdict + k-anonymity guards, all PASS).

**Language policy:** outputs are DEVELOPMENTAL competency signals only — never a hiring / suitability / pass-fail
verdict. Coverage and Confidence reported on SEPARATE axes; `null`/abstain where unmeasured (never coerced to 0).

## Honest finding
The hiring-intelligence engine is **built and competency-driven** but **dormant**: the employer flow is
default-OFF and no employer/job/candidate rows exist. Calibration cannot occur until **≥30 realized hiring
decisions** accrue — a borrowed prior never upgrades to TRUST. This is a **data-maturity** gap.

**Cannot reach PASS by code** — requires real employer adoption + realized hiring outcomes.
