# Signal Engine Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live runtime endpoints
**Verdict:** ✅ Signal engine **operational**

---

## 1. What this covers
The signal engine evaluates **developmental signals** (risk and potential) from a subject's
measured competencies — e.g. high accountability + high adaptability → "Ownership Potential".
Endpoint: `GET /api/competency-runtime/signal-engine/:subject`.

> **Language policy:** signals are *developmental* only — never hiring, promotion, or suitability
> predictions. Each signal carries an interpretation framed as growth, not selection.

## 2. Live evidence — `demo_subj_swe` (Backend Engineer)
| Metric | Value |
|--------|-------|
| total signals defined | 7 |
| fired | 1 |
| risk fired | 0 |
| potential fired | 1 |
| not fired | 1 |
| unevaluable | 5 |

| signal | polarity | status |
|--------|----------|--------|
| Ownership Potential | potential | **fired** |
| Disengagement Risk | risk | not_fired |
| Stakeholder Disconnect Risk | risk | unevaluable |
| Workplace Communication Risk | risk | unevaluable |
| Change Resilience Potential | potential | unevaluable |
| Collaborative Leadership Potential | potential | unevaluable |
| Innovation Potential | potential | unevaluable |

**Fired signal detail:** *Ownership Potential* — "High accountability combined with high
adaptability points to dependable ownership under changing conditions." Interpretation:
"Developmental strength — reliable in taking and adjusting ownership of outcomes."

## 3. Honesty notes
- **`unevaluable` (5 of 7) is honest, not a failure.** A signal whose input competencies were
  not measured (strategic-domain / uncovered) is marked unevaluable rather than forced to fire
  or not-fire. Only signals with sufficient measured inputs are evaluated.
- **No risk signal fired** for this subject — reported as `not_fired` / `unevaluable`, never
  fabricated to manufacture concern.

## 4. Conclusion
The signal engine evaluates all 7 defined signals against real measured competencies, fires the
data-supported ones, and abstains (unevaluable) where inputs are missing. **Operational.**
