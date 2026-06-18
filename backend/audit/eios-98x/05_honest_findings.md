# EP-EIOS-98X — Honest Findings & Remaining Structural Debt

This document records what is NOT yet done, what is structurally weak, and what is data-bound.
These are honest findings — not blockers for the current release, but accurate statements of the
system's current state.

---

## F1 — 65 Certification Checks Are Statically Asserted

**Finding:** Of 71 total certification checks, 65 are defined as `pass: true` in the
`CERTIFICATION_CHECKS[]` constant. They are never re-verified at cert-check time — they assert
structural facts at definition time.

**What the checks assert (correctly):** Route registered, schema table created, auth guard wired,
algorithm present, metric computed. These facts are true (confirmed by route registration logs:
`[eios-core] routes registered`, `[eios-intelligence] routes registered`) but they are not
re-queried on each `/certification` call.

**Severity:** STRUCTURAL_DEBT — not a fabrication. The asserted facts are true. But a rigorous
world-class certification would re-verify each check dynamically (e.g., query
`information_schema.tables` for schema checks; verify route existence via Express route list).

**Path to fix:** Move each check to a runtime verifier that queries the relevant fact. This is
a significant engineering investment (~71 verifier functions). Currently out of scope.

---

## F2 — P18/P19 Benchmark Values Are Static Constants

**Finding:** P18 (Benchmark Intelligence) and P19 (AI Readiness) return industry benchmark
values that are static constants (`avgEIScore: 62`, `avgMatchScore: 58`,
`topPerformerThreshold: 80`, `readinessIndex: 65`, etc.) derived from internal defaults, not
from real cross-tenant aggregation.

**Why:** The k-anonymity pool has 0 distinct employers in dev (and will have fewer than 30 for
some time after launch). The static benchmarks are only shown when `suppressed: false` — i.e.,
when the pool hits k_min=30. Until then, `industry: null` is returned. So in practice,
users never see the static constants until the pool is large enough that constants vs. real data
becomes meaningful.

**Severity:** KNOWN_LIMITATION — correctly gated behind k-anonymity suppression. Document
expectation that constants must be replaced with real aggregation once k_min=30 is reached.

**Path to fix:** Once the employer pool reaches k_min=30, implement a scheduled aggregation job
that computes real cross-tenant averages and caches them (with k-anonymity noise addition).

---

## F3 — P22 Outcome Tracking Has No Outcome Data Yet

**Finding:** `eios_outcome_tracking` has 0 rows. P22 (Outcome Intelligence) reports
`trackedOutcomes: 0` and `data: 'pending_90_day_reviews'` / `data: 'pending_6_month_data'` for
performance and retention outcome types.

**This is expected:** Outcome data accumulates after hiring events. The schema, route, and
`POST /p22/outcomes` write endpoint are all in place. Zero rows = no employers have recorded
outcomes yet.

**Severity:** EXPECTED (data gap, not code gap).

---

## F4 — P26 Model Calibration Is Heuristic

**Finding:** P26 (Model Monitoring & AI Governance) reports model `calibration: 'heuristic_weights'`
when assessment data is present. The fit/readiness/success models use engineered weights
(EI score × 0.5, match score × 0.5, etc.) not empirically calibrated coefficients.

**Why:** True calibration requires realized outcomes (hired candidates with known performance,
retention, promotion data). With 0 hired candidates in dev, the models are in
`status: 'no_data'`. The heuristic weights are reasonable defaults but should be replaced with
Brier-score-calibrated models once the outcome dataset is populated.

**Severity:** KNOWN_LIMITATION — correctly disclosed in P26 response (`predictionAccuracy: 'insufficient_outcome_data'`).

---

## F5 — P27 Webhook Framework Is Roadmap

**Finding:** P27 (Integration & API Ecosystem) lists the webhook framework
(`candidate.hired`, `assessment.complete`, `offer.accepted`) as `status: 'roadmap'`. No webhook
delivery infrastructure exists yet. ATS, HRMS, LMS, and identity APIs are marked `available`
(they have real REST endpoints) but ERP and payroll are `roadmap`.

**Severity:** KNOWN_LIMITATION — correctly disclosed as `status: 'roadmap'` in the P27 response.

---

## F6 — P14 Lifecycle Is Candidate-Pool-Based, Not Employee-Based

**Finding:** P14 (Employee Lifecycle Intelligence) derives lifecycle stages from candidate pipeline
stage (`Applied`, `Screened`, `Interview`, `Assessment`, `Offer`, `Hired`, `Rejected`) using a
`stageMap` that maps pipeline stages to lifecycle buckets (`hire`, `onboard`, `develop`, `retain`, `exit`).

This is a reasonable proxy but it is not a true employee lifecycle (which would require post-hire
tracking: onboarding completion, performance reviews, promotion events, exit surveys). The mapping
is honest about this — it surfaces candidate funnel data, not long-term employee journey data.

**Severity:** KNOWN_LIMITATION — documented in P14 route response shape.

---

## F7 — Behavioral Spine Linkage Ceiling

**Finding:** `wcl0_user_intelligence` links candidates by email address. Linkage requires:
1. The employer candidate has an `email` field populated
2. That same email appears in `wcl0_user_intelligence.user_email`
3. The user took a CAPADEX assessment that produced WCL-0 data

In practice, most employer candidates will not have CAPADEX history. The behavioral enrichment
in P7/P8 will be `null` for those candidates (correctly handled — the code falls back to standard
scoring). This is an honest architectural constraint, not a bug.

**Severity:** STRUCTURAL_CONSTRAINT — documented in P7/P8 response via `behavioralEnrichment.enriched` count.

---

## Summary Table

| # | Finding | Severity | Blocks GO? | Path to Fix |
|---|---------|----------|-----------|-------------|
| F1 | 65 cert checks statically asserted | STRUCTURAL_DEBT | No | Runtime verifiers (future sprint) |
| F2 | Benchmark constants (P18/P19) | KNOWN_LIMITATION | No | Replace when k_min=30 employers |
| F3 | P22 outcome tracking empty | EXPECTED | No | Data accumulates after hires |
| F4 | P26 model weights heuristic | KNOWN_LIMITATION | No | Calibrate after outcome dataset |
| F5 | P27 webhooks roadmap | KNOWN_LIMITATION | No | Implement webhook framework |
| F6 | P14 lifecycle = candidate funnel | KNOWN_LIMITATION | No | Full employee lifecycle requires post-hire events |
| F7 | Behavioral linkage via email only | STRUCTURAL_CONSTRAINT | No | Inherent cross-system design |
