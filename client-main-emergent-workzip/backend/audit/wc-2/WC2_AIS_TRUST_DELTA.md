# WC-2 · Outputs 7 & 8 — AIS Delta & Trust Score Delta Reports

> Design + honest measurement. Scores the Assessment Intelligence Score (AIS) and Trust Score against
> WC-2 targets and reports the honest delta. No scoring code changed.

---

## Output 7 — AIS Delta Report

| Field | Value |
|---|---|
| **Current AIS** | **~60 / 100** (baseline; neutral trust multiplier 1.0) |
| **Stated WC-2 Target** | > 95 |
| **Realistic Target Band** | **78–85** |
| **Delta to realistic band** | ~18–25 points |
| **Evidence** | `trust-engine.ts` / `omega-report-builder.ts`: AIS baseline **60**; verified-credential lift `= (trust_weight − 1.0) × confidence × 8`; trust multiplier clamped to **[0.5, 1.3]**. Selection-AIS via `buildInsightConfidence` (reliability + consistency + subdomain coverage). |
| **Root Cause** | AIS is **verification-bounded**: it can only rise materially when users attach **verified credentials** (Credly/ICAI etc.). Most sessions have none → AIS sits near baseline. The multiplier ceiling (1.3) and 8-pt lift mathematically cap realistic AIS. |
| **Estimated Effort** | Medium — and **outside enrichment** (depends on credential-verification adoption + insight-confidence coverage), so not addressable by metadata work. |
| **Expected Impact** | Higher trust → higher report authority downstream; but bounded by adoption. |

### Ceiling note (flag unreachable target)
**AIS > 95 is mathematically unreachable** for the typical (uncredentialed) session: from baseline 60
the verified lift and the [0.5, 1.3] multiplier cannot reach 95 without near-universal high-weight
credential verification plus maxed insight confidence. **Honest realistic band: 78–85** for
well-credentialed cohorts; the unverified-session mean stays ~60–70. Recommend re-stating the target
as **"AIS ≥ 80 for credentialed cohorts; ≥ 68 mean."**

---

## Output 8 — Trust Score Delta Report

| Field | Value |
|---|---|
| **Current Trust Score** | **~60 / 100** baseline (observed mean ≈ 51–60 depending on cohort) |
| **Stated WC-2 Target** | > 90 |
| **Realistic Target Band** | **76–84** |
| **Delta to realistic band** | ~16–24 points |
| **Evidence** | Baseline 60; verified credentials lift, revoked/expired penalize up to −2; report **safety gate** fails any report with safety-quality < 60. Trust is a function of verification + consistency + safety, not of question metadata. |
| **Root Cause** | Same verification dependency as AIS, plus consistency/coverage. Signal coverage at **55.8%** limits the consistency contribution. |
| **Estimated Effort** | Medium (credential adoption + signal coverage from Wave 3). |
| **Expected Impact** | Trust gates report authority and downstream adoption. |

### Ceiling note
**> 90** repo-wide is unrealistic without near-universal credential verification. Honest band
**76–84**; raise the floor via signal coverage (Wave 3) and consistency, not via metadata enrichment.

---

## Combined view

| Metric | Current | Stated target | Realistic band | Primary lever | Enrichment-addressable? |
|---|---|---|---|---|---|
| AIS | ~60 | > 95 | 78–85 | Credential verification + insight confidence | **No** |
| Trust | ~60 | > 90 | 76–84 | Verification + signal coverage + consistency | Partly (Wave 3) |

**Honest conclusion:** AIS and Trust are the **two targets most detached from this phase's levers** —
they depend on credential-verification adoption and signal coverage, not on the question-intelligence
/ personalization / stage work. They should be tracked on a separate adoption roadmap with re-stated,
reachable target bands.
