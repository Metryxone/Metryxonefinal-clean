# Competency Gap Analysis Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live runtime endpoints
**Verdict:** ✅ Gap analysis **operational**

---

## 1. What this covers
Gap analysis compares measured competency levels to role-required levels and classifies each as
met / gap / blocking / **unmeasurable**, with coverage. Endpoint:
`GET /api/competency-runtime/gap-analysis/:subject`.

## 2. Live evidence — `demo_subj_swe` (Backend Engineer, `bp_be_v1`)
| Field | Value |
|-------|-------|
| total competencies | 4 |
| measurable | 3 |
| unmeasurable | 1 |
| coverage | 75% |
| blocking gaps | 0 |

| competency | domain | required | measured | gap | severity | measurement |
|------------|--------|----------|----------|-----|----------|-------------|
| Accountability | dom_behavioral | 4 | 4 | 0 | met | domain_proxy |
| Adaptability | dom_behavioral | 3 | 4 | −1 | met | domain_proxy |
| Personal Resilience | dom_behavioral | 3 | 4 | −1 | met | domain_proxy |
| Agile Collaboration | dom_strategic | 4 | — | — | **unmeasurable** | unmeasurable |

## 3. Honesty notes
- **`unmeasurable` is a first-class severity.** A competency with no question path
  (`dom_strategic`) is reported as unmeasurable — never scored, never counted as a met or
  blocking gap. This prevents fabricated coverage.
- **Negative gaps (−1) mean exceeds-requirement** and are classified `met`, not inflated into
  "strengths" beyond what the data supports.
- **Coverage (75%) is reported independently of gap status**, mirroring the readiness axis split.

## 4. Honest gaps
- Strategic-domain competencies are uniformly unmeasurable until question coverage exists.
- Gap precision is domain-proxy; it sharpens automatically when the canonical question map is seeded.

## 5. Conclusion
Gap analysis classifies real measured-vs-required deltas, isolates unmeasurable competencies
honestly, and reports coverage as a separate axis. **Operational.**
