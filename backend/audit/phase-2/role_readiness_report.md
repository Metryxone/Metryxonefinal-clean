# Role Readiness Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live runtime endpoints
**Verdict:** ✅ Role readiness **operational**

---

## 1. What this covers
Role readiness compares a subject's measured competencies against the **required levels** for a
role (weighted), producing a readiness score, band, coverage, and a list of blocking gaps.
Endpoint: `GET /api/competency-runtime/role-readiness/:subject`.

## 2. Live evidence

### `demo_subj_swe` → Backend Engineer (`role_be_eng`)
| Field | Value |
|-------|-------|
| readiness_score | 100 |
| readiness_band | **ready** |
| coverage_pct | 75% |
| weight assessed / total | 75 / 100 |
| blocking_gaps | 0 |

Per-competency: Accountability (req 4 / actual 4, attainment 100), Adaptability (req 3 / actual 4),
Personal Resilience (met), **Agile Collaboration (req 4 / actual `null`)** — unmeasured (strategic
domain), weight 25, **not** marked blocking because it cannot be measured rather than failed.

### `demo_subj_pm` → Product Manager (`role_pm`)
| Field | Value |
|-------|-------|
| readiness_score | 100 |
| readiness_band | **ready** |
| coverage_pct | 80% |
| weight assessed / total | 80 / 100 |
| blocking_gaps | 0 |

## 3. Honesty notes (read carefully)
- **Readiness 100 is computed over the *assessed* weight, not the full role.** Coverage is
  reported **separately** (75% / 80%) so a high readiness score can never hide unmeasured
  competencies. Coverage and readiness are two distinct axes by design.
- **Unmeasurable critical competencies are surfaced, not silently passed.** `comp_agile_collaboration`
  (strategic) shows `actual_level: null` and is excluded from the score — never counted as met
  or as a blocking failure.

## 4. Conclusion
Role readiness computes weighted attainment against real role requirements for two real roles,
with coverage reported as an independent honesty axis. **Operational.**
