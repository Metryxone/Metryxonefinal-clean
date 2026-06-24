# Section 14 — Candidate / Seeker Experience Certification

**Verdict: PARTIAL (rich surfaces built; near-zero real candidate traversal).**

The candidate/seeker side spans the deepest set of surfaces on the platform — CAPADEX behavioral
assessment, competency assessment, Career Builder, Employability Index, Career Passport, Future
Readiness. Architecturally it is the richest experience. In the live DB it is **essentially
untraversed by real users.**

## 14.1 Experience surfaces present — PASS (structure)
- **Assessment:** CAPADEX behavioral flow (intro → analyze → clarify → questions → report) +
  competency assessment (adaptive question bank). **Career:** Career Builder (jobs/mentors/readiness/
  gap/roadmap), Employability Index, Career Passport, Future Readiness.
- Honesty fixtures are strong: developmental-signals-only language (never hiring/suitability
  predictions), Coverage vs Confidence separation, Provisional badges when sample < 30.

## 14.2 Real traversal — FAIL (near-zero)
| Signal | Count |
|---|---:|
| users | 2 |
| career_seeker_profiles | 1 |
| capadex_sessions (completed) | 0 |
| cg_user activation (readiness/gaps/recs/path) | 0 |
| ei_profile_snapshots | 2 |
| career_passport_snapshots | 4 |
| frp_user_readiness | 0 |
- A handful of EI snapshots (2) and passport snapshots (4) exist; the **core assessment-to-outcome
  journey has effectively not been completed by a real candidate** (0 completed CAPADEX sessions, 0
  career activation runs).

## 14.3 The content dependency
- The candidate experience's *quality* is gated by the same upstream gaps as Sections 3 & 6: with
  question coverage at 1.7% and a single-difficulty bank, the assessment a real candidate would take is
  shallow relative to the 419-competency genome behind it. The experience shell is excellent; the
  assessable content it can deliver today is thin.

## 14.4 CAPADEX experience caveat
- The CAPADEX behavioral runtime is one of the most sophisticated surfaces (39 tables, proxy-language
  engine, clarity picker, report tone canon), but its **concern/clarity ontology is UNFED in this
  shared DB** (concerns_master 0, clarity 0). The experience is built and documented; the content that
  powers it lives in isolated environments and is not present here to traverse.

## 14.5 Confidence vs Coverage
- **Coverage:** the broadest experience surface on the platform. **Confidence:** unproven — 2 users,
  0 completed assessments, thin assessable content.

## 14.6 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Experience surfaces & honesty fixtures | PASS | language policy, Coverage/Confidence, Provisional |
| Assessment content depth | PARTIAL | 1.7% question coverage, single-difficulty bank |
| CAPADEX ontology (this DB) | DORMANT (UNFED-here) | concerns/clarity = 0 |
| Real candidate traversal (Usage) | FAIL | 0 completed sessions, 1 seeker profile |

**Net: PARTIAL.** The most ambitious experience on the platform, built to a high honesty standard, but
pre-launch in practice and gated by upstream content (questions + CAPADEX ontology feed).
