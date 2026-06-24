# MX-74X · Section 12 — Predictive Career Intelligence (posture & honesty)

**Status:** Posture statement. MX-74X makes **no** fabricated-accuracy prediction claim.

---

## 1. The four axes (kept strictly separate)

| Axis | Meaning | Where it lives |
|---|---|---|
| **Coverage** | how much of the required signal is measured | `axes.coverage.coverage_pct` |
| **Confidence** | how trustworthy the measured signal is | `axes.confidence.band` (`high/moderate/low/none`) |
| **Prediction** | the forward-looking statement itself | path waypoints, transition probabilities, horizons |
| **Evidence** | the real rows backing the prediction | `cg_role_edges`, `cg_tracks`, roadmap dev-plan |

These are **never** composited into a single "accuracy %". There is no realized-outcome population
yet, so **no accuracy claim is made** — doing so would be fabrication.

## 2. What the new engines predict (and how honestly)

- **Career Path** surfaces `transition_probability` and `avg_months_transition` **directly from the
  `cg_role_edges` rows** — these are graph-authored priors, not a model output, and are labelled as
  such. The seniority ordering used to classify advancement vs lateral is a disclosed heuristic.
- **Learning Path** surfaces a `timeline` carried verbatim from the roadmap, with the roadmap's own
  disclaimer. No completion-probability is invented.

## 3. The honest ceiling

Prediction quality is bounded by:
1. **Edge density** in `cg_role_edges` for the subject's anchor (sparse anchor → short path, lower
   confidence — `demo_subj_pm` cov=25 vs `adaptive_smoke_1` cov=75).
2. **No realized outcomes** → no calibration, no Brier/ECE, no accuracy. When a realized-outcome
   population accrues (≥30 non-demo), the existing calibration model (`buildCalibrationModel`) can
   be pointed at it — recorded as a **follow-up**, not claimed now.

## 4. Language policy

Every envelope ships `allowed`/`disallowed` term lists. Outputs are **developmental progression and
learning options only** — never hiring, promotion, or suitability predictions.
