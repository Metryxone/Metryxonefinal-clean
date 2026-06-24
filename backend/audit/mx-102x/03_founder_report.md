# MX-102X — Outcome Intelligence Activation · Founder Report

_Generated 2026-06-24T10:01:45.303Z · engine v102.0.0 · k_min=30_

## Verdict: **PARTIAL**

PARTIAL — six-type outcome intelligence is structurally unified and honest; empirical accuracy ABSTAINS until realized outcomes reach k_min. Honest PARTIAL over inflation.

## Platform rollup

| Metric | Value |
|--------|------:|
| Outcome types unified | 6 |
| Types with realized coverage | 0 |
| Realized coverage (data axis) | 0 |
| Evidence pairs (confidence axis) | 0 |
| Types evidence-backed (≥ k_min) | 0 |
| Accuracy abstained | yes |

> **Coverage ⟂ Confidence**: these two columns are deliberately never combined. Realized
> coverage is how much real-world outcome data exists; evidence pairs are how much of it can
> empirically calibrate a prediction. With outcomes still accruing, accuracy ABSTAINS.

## Success-criteria certification

| # | Criterion | Status | Detail |
|---|-----------|:------:|--------|
| C1 | Unified six-type outcome taxonomy (hiring·performance·promotion·retention·career·learning) | **PASS** | All 6 types composed from their canonical substrates without mutating any existing surface. |
| C2 | Coverage ⟂ Confidence kept as separate axes (never composited) | **PASS** | Coverage (realized outcomes captured) and Confidence (empirical accuracy) are reported independently; a realized outcome without a decision-time prediction counts only toward Coverage. |
| C3 | Abstain below k_min — empirical accuracy gated PER TYPE (pairs never summed across types) | **PARTIAL** | No single type has reached k_min 30 (strongest single-type pairs 0/30; aggregate 0 across types is informational ONLY and never clears the per-type threshold); accuracy correctly ABSTAINED. |
| C4 | No fabrication — null/abstain never coerced to 0; out-of-range predictions dropped | **PASS** | Unreadable substrates degrade to null (not 0); only finite [0,1] predictions paired with binary outcomes feed calibration. |
| C5 | Prediction ≠ Outcome — empirical accuracy requires realized outcomes | **PASS** | Upstream predictions are surfaced; empirical accuracy is claimed ONLY once realized outcomes accrue. |
| C6 | Flag-gated, additive, byte-identical OFF (read-only, no DDL) | **PASS** | Behind outcomeIntelligenceActivation (default OFF); composer reads via to_regclass probes only and never writes. |
| C7 | Empirical accuracy evidence-backed (≥ k_min realized predictions in a single type) | **PARTIAL** | Realized coverage 0; 0 type(s) evidence-backed (strongest single-type pairs 0/30; aggregate 0 informational only). PARTIAL until a single type reaches k_min — honest, not a defect. |

## Per-type snapshot

| Type | Coverage (realized) | Evidence pairs | Abstained |
|------|--------------------:|--------------:|:---------:|
| Hiring | 0 | 0 | yes |
| Performance | 0 | 0 | yes |
| Promotion | 0 | 0 | yes |
| Retention | 0 | 0 | yes |
| Career | 0 | 0 | yes |
| Learning | 0 | 0 | yes |

## Unified ledger (most recent, pseudonymised) — 25 row(s)

| Type | Substrate | Kind | Value | Pred@decision | Demo | Subject |
|------|-----------|------|------:|--------------:|:----:|---------|
| hiring | employer_candidates | binary | 1 | 0.61 | yes | user_856fa80441ed |
| hiring | employer_candidates | binary | 0 | 0.44 | yes | user_16e0e5988fef |
| hiring | employer_candidates | binary | 0 | 0.19 | yes | user_c30ca0952746 |
| hiring | employer_candidates | binary | 1 | 0.68 | yes | user_e77953c75f56 |
| hiring | employer_candidates | binary | 1 | 0.58 | yes | user_c77ab6ed51d6 |
| hiring | employer_candidates | binary | 0 | 0.71 | yes | user_2f382a83051f |
| hiring | employer_candidates | binary | 0 | 0.42 | yes | user_b27ac7a91e9a |
| hiring | employer_candidates | binary | 0 | 0.38 | yes | user_aa968ab61ae5 |
| hiring | employer_candidates | binary | 0 | 0.17 | yes | user_9cab97bd5bda |
| hiring | employer_candidates | binary | 1 | 0.62 | yes | user_98843a822b03 |
| hiring | employer_candidates | binary | 1 | 0.76 | yes | user_be171a0a2f96 |
| hiring | employer_candidates | binary | 1 | 0.88 | yes | user_80acb3c685a5 |
| hiring | employer_candidates | binary | 1 | 0.68 | yes | user_01c62b1fa8dd |
| hiring | employer_candidates | binary | 0 | 0.39 | yes | user_9f2773fb00f5 |
| hiring | employer_candidates | binary | 1 | 0.62 | yes | user_bf95d91217df |
| hiring | employer_candidates | binary | 1 | 0.56 | yes | user_45e9b7c8bb75 |
| hiring | employer_candidates | binary | 0 | 0.6 | yes | user_85e65e8c960e |
| hiring | employer_candidates | binary | 1 | 0.81 | yes | user_76cfe6f79169 |
| hiring | employer_candidates | binary | 1 | 0.63 | yes | user_20dd26a64ab2 |
| hiring | employer_candidates | binary | 0 | 0.72 | yes | user_a8bb20f8af97 |
| hiring | employer_candidates | binary | 1 | 0.53 | yes | user_c73d5ccf535e |
| hiring | employer_candidates | binary | 0 | 0.5 | yes | user_4b323bf94aed |
| hiring | employer_candidates | binary | 0 | 0.55 | yes | user_41296d816c03 |
| hiring | employer_candidates | binary | 0 | 0.28 | yes | user_860289ed6abb |
| hiring | employer_candidates | binary | 0 | 0.16 | yes | user_aa2abd6f67a4 |

---

**Honesty contract**: Coverage and Confidence are separate axes; demo rows are excluded from
every realized/evidence figure; unreadable substrates degrade to null (never 0); out-of-range
predictions are dropped (never clamped); empirical accuracy is ABSTAINED until realized outcomes
reach k_min. PARTIAL here is the honest state, not a defect — and never inflated to look complete.