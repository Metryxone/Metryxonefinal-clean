# Section 7 — Employer Intelligence Certification

**Verdict: PARTIAL (engine + portal PASS; activation = demo single-org; outcomes FAIL).**

The employer side (Employer Portal + Talent Intelligence Graph + MX-100X P5 Employer Competency
Hiring) is one of the more complete subsystems by architecture, and its honesty discipline is strong.
Activation is **demo-only, single-org**, and there are **no realized hiring outcomes** — so its
predictive/calibration claims correctly abstain.

## 7.1 Portal & data model — PASS (structure)
- 19 `employer_*` tables span organizations, jobs, candidates, members, interviews, offers,
  approvals, audit logs, SSO. The model is enterprise-shaped (orgs → business units → members → jobs
  → candidates → interviews → offers).
- M5 auth gap (employer routes) was closed via a router-level `requireAuth`; the `values`→`values_list`
  reserved-keyword trap is handled.

## 7.2 Activation — PARTIAL (demo, single-org)
| Table | Count | Note |
|---|---:|---|
| employer_candidates | 40 | **all 40 @example.com (demo)** |
| employer_jobs | 1 | |
| employer_organizations / _members / _interviews / _offers | 0 | |
| tig_nodes | 72 | **1 org** |
| tig_edges | 1,680 | |
| tig_intelligence | 40 | |
| tig_calibration | 5 | <30 outcomes → **uncalibrated** |
- The Talent Intelligence Graph is genuinely populated (72 nodes / 1,680 edges / 40 intelligence
  rows) but for a **single demo org**. This proves the pipeline end-to-end; it does not constitute
  enterprise activation.

## 7.3 Competency-driven hiring (P5) — PASS (honesty), FAIL (data)
- The engine **composes** `computeCompetencyDrivenMatch` (never recomputes) and emits decision-
  *support* only: interview focus = MEASURED gaps, probes = UNASSESSED requirements, hiring rec ∈
  {advance, targeted, gather_more, development_focus, insufficient} — **never a hire/no-hire verdict**,
  always with a disclaimer. Language policy (developmental, never suitability) is respected.
- Role-DNA benchmark gates on **k≥30**; unknown cohort **fails closed**. With 0 real outcomes, fit is
  WITHHELD, match falls back to heuristic, calibration reads **uncalibrated** — all correct, honest
  dormant behavior.

## 7.4 Calibration honesty — PASS (abstains)
- Brier/ECE are RAW; a borrowed prior never upgrades to TRUST; LEARNED calibration requires ≥30
  Hired/Rejected decisions with `predicted_prob_at_decision`. tig_calibration = 5 → **uncalibrated**,
  correctly. **No accuracy is claimed.**

## 7.5 Confidence vs Coverage
- **Coverage:** candidate pipeline + graph reachable (demo). **Confidence:** uncalibrated (no
  outcomes). The candidate drawer surfaces Coverage (domains) vs Confidence (calibration) separately,
  with a monotonic-token guard so async hiring data never misattributes to the wrong candidate.

## 7.6 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Data model & portal | PASS | 19 employer_* tables, auth-gated, enterprise shape |
| TIG pipeline | PASS (demo) | 72 nodes / 1,680 edges, single org |
| Competency hiring engine (P5) | PASS | compose-only, decision-support, k≥30 fail-closed |
| Calibration / accuracy | ABSTAINS | 5 calibration rows, 0 outcomes → uncalibrated |
| Real hiring outcomes (Usage) | FAIL | 0 |

**Net: PARTIAL.** Strong, honest engine and a complete portal proven on demo data. Enterprise
certification requires multi-org activation and ≥30 realized hiring outcomes per cohort to unlock
calibrated confidence.
