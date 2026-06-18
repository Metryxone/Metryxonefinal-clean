# WC-P1 — D7: Recommendation Readiness

**Coverage**: 40% | **Confidence**: 25%

---

## Evidence

| Component | State |
|---|---|
| Frontend roadmap engine (`buildRoadmap()`) | ✅ Real — short/medium/long term actions |
| Frontend tips engine (`buildTips()`) | ✅ Real — profile-score-conditional |
| Frontend improvement hints (per dimension) | ✅ Real — in `explainableFactors` |
| Backend role-fit recommendations | ✅ Real — `add_skill/add_certification/gain_experience` types |
| Backend IDP builder (`buildIDP()`) | ✅ Real — closes largest competency gaps |
| `ref_review_queue` (unresolved entities) | 69 rows |
| Institution resolution rate | Low (~30-40% India; <5% global) — 67 of planned 19,400+ loaded |
| Skill resolution rate | ~1% — 90 of planned 13,890+ ESCO skills loaded |
| Certification resolution rate | ~1-5% — 42 loaded |

---

## ref_review_queue Breakdown (unresolved entity accumulation)

| Entity Type | Count |
|---|---|
| skills | 62 |
| qualifications | 4 |
| institutions | 2 |
| certifications | 1 |

---

## What Works

- Generic roadmap: short/medium/long term actions based on score thresholds.
- Per-dimension improvement hints: "Add X more technical skills", "Each cert adds 2 EI pts".
- Role-fit specific recommendations: when a user selects a target occupation, missing-skill recommendations are generated.
- Behavioral nudges: low Execution Readiness biases toward low-effort steps.

---

## What Doesn't Work

- Institution-specific recommendations: resolver can't resolve most inputs → falls back to generic hints.
- Certification-specific recommendations: only 42 certifications in DB vs thousands of real-world inputs.
- Skill gap recommendations for role-fit: sparse occupation_skills (1.7/occupation) means gap lists are incomplete.
- 69 real-world inputs currently queued as unresolved — those users get generic hints instead of specific ones.

---

## Actions to Reach 95%

1. Seed canonical reference data (institutions, certifications, skills) — prerequisite for specific recommendations.
2. Process the 69 items in `ref_review_queue` (manual review or bulk alias creation).
3. Add occupation-specific learning resource links to recommendations.
