# Section 13 — Employer Experience Certification

**Verdict: PARTIAL (flows complete on demo; no real employer has traversed them end-to-end).**

The employer-facing experience is structurally complete and demonstrable on demo data, but it has not
been traversed by a real employer at volume. This section certifies the *experience surface*, not its
outcomes.

## 13.1 Experience surfaces present — PASS (structure)
- Org onboarding → business units → team members/SSO → job postings → candidate pool → competency-
  driven match → interview planning → offers → ref-checks. All backed by `employer_*` tables and the
  Employer Portal (EP-98) + MX-77X employer workforce surfaces.
- Candidate drawer surfaces **Coverage (domains) vs Confidence (calibration) separately**, with a
  monotonic-token guard preventing async hiring data from misattributing to the wrong candidate.

## 13.2 Experience flow — demo-traversable
| Stage | State | Evidence |
|---|---|---|
| Candidate pool | demo | employer_candidates 40 (@example.com) |
| Job postings | demo | employer_jobs 1 |
| Talent graph / intelligence | demo (1 org) | tig_nodes 72, edges 1,680, intelligence 40 |
| Org / members / interviews / offers | empty | 0 |
- A reviewer can walk the pool → match → drawer flow on demo data. The org/interview/offer stages have
  no data, so the *back half* of the hiring journey is unexercised.

## 13.3 Honesty in the experience — PASS
- The experience never shows a hire/no-hire verdict — only decision support with disclaimers.
- Fit is WITHHELD and calibration shows uncalibrated where evidence is insufficient (k<30), so the
  employer UI cannot present a false-precision score. This is a strong product-honesty property.

## 13.4 Confidence vs Coverage
- **Coverage:** full employer journey surface exists. **Confidence:** demonstrated only on a single
  demo org; no real employer outcomes.

## 13.5 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Onboarding → posting → pool → match | PARTIAL (demo) | 40 demo candidates, 1 job, 1 org graph |
| Interview / offer / ref-check back-half | DORMANT | 0 rows |
| Decision-support honesty | PASS | no verdicts, WITHHELD fit, uncalibrated shown |

**Net: PARTIAL.** A complete, honest employer experience proven on demo data. Certification requires a
real employer to traverse onboarding → offer with ≥30 outcomes feeding calibration.
