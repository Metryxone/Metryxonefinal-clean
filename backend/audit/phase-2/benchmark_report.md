# Benchmark Foundation Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live dev DB + runtime endpoints
**Verdict:** ✅ Benchmark foundation **operational**

---

## 1. What this covers
The benchmark foundation positions a subject's competency scores against cohort distributions
(percentile + band), across multiple dimensions (role / function / industry / layer / global),
enforcing **k-anonymity** (`k_min = 30`). Endpoints:
`GET /api/competency-runtime/benchmark-dashboard/:subject` and `/benchmark-comparison/:subject`.

## 2. Cohort foundation (`bench_cohorts`) — 15 active cohorts, all `k_min = 30`
| type | count | examples |
|------|-------|----------|
| role | 5 | Backend Engineer, Senior Backend Engineer, Product Manager, Engineering Manager, Credit Risk Analyst |
| layer | 4 | Strategic, Managerial, Senior Leadership, Executive |
| function | 3 | Engineering, Product Management, Risk Management |
| industry | 2 | Technology, Financial Services |
| global | 1 | Global Benchmark |

Supporting tables: `bench_cohort_statistics` = 15 rows · `bench_competency_benchmarks` = 195 rows.

## 3. Live comparison — `demo_subj_swe` vs `role_be_eng`
| Field | Value |
|-------|-------|
| measured | true |
| primary cohort | `coh_role_be_eng` — "Backend Engineer — Role" (k_min 30) |
| aggregate percentile | 66 |
| competencies compared | 2 (cohort_n ≈ 170) |

Per-competency: Accountability — 64.12th pct (mid band, *at*); Adaptability — 68.82nd pct (mid, *at*).

Dimension availability (honest):
| dimension | status |
|-----------|--------|
| role | **available** |
| department | dimension_unsupported |
| function | context_unavailable |
| industry | context_unavailable |
| institution | dimension_unsupported |

## 4. Honesty notes
- **k-anonymity enforced** — every cohort sets `k_min = 30`; comparisons below threshold are
  suppressed, never shown.
- **Unavailable dimensions are labelled, not faked.** `context_unavailable` (no industry/function
  context on the subject) and `dimension_unsupported` are reported explicitly instead of inventing
  a comparison. Only the role dimension has both a cohort and the required context here.
- This is a **foundation** — cohort statistics are seeded reference distributions; live population
  growth will widen available dimensions over time.

## 5. Conclusion
A k-anonymous, multi-dimension cohort foundation (15 cohorts, 195 benchmarks) is in place and a
real subject was positioned to the 66th aggregate percentile against the role cohort.
**Benchmark foundation operational.**
