# Assessment Factory Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live dev DB + runtime endpoints
**Verdict:** ✅ Assessment blueprints + assessment generation **operational**

---

## 1. What this covers
The Assessment Factory is the front of the competency-runtime chain: a **blueprint**
(role → competency weights) is turned into a concrete, per-subject **assessment instance**
of selected questions, ready to be answered and scored.

Two engines participate:
- **Blueprint Engine (Phase 2.1)** — `onto_assessment_blueprints` (+ optional dimension mix).
- **Assembly Engine (Phase 2.3)** — assembles questions into `onto_assembled_assessments`
  and materializes a runtime `onto_assessment_instance` per subject.

## 2. Live evidence

### Blueprints (`onto_assessment_blueprints`) — 3 active
| id | key | role | source | active |
|----|-----|------|--------|--------|
| `bp_be_v1` | backend-engineer-v1 | `role_be_eng` | authored | ✅ |
| `bp_pm_v1` | product-manager-v1 | `role_pm` | authored | ✅ |
| `bp_srbe_v1` | sr-backend-engineer-v1 | `role_sr_be_eng` | authored | ✅ |

### Assembly & instances
| Metric | Value |
|--------|-------|
| Assembled assessments (`onto_assembled_assessments`) | 2 |
| Assessment instances — `generated` | 1 |
| Assessment instances — `scored` | 2 |
| Recorded responses (`onto_assessment_responses`) | 15 |

Per-subject instances actually produced by the live generate→score path:

| subject | blueprint | status | questions |
|---------|-----------|--------|-----------|
| `demo_subj_swe` | `bp_be_v1` | scored | 3 |
| `demo_subj_pm` | `bp_pm_v1` | scored | 12 |
| `demo_subj_pm` | `bp_pm_v1` | generated | 0 |

## 3. Honest gaps (mechanism operational, data partial)
- **`onto_blueprint_dimension_mix` = 0 rows.** The 5-dimension type mix (Phase 2.1) is not
  yet populated. Blueprints remain fully operational via per-competency weights; the dimension
  mix is an *optional enrichment*, not a dependency of generation.
- **Question volume is intentionally small** in dev — the factory was exercised with hand-driven
  runs (3q and 12q), not bulk traffic. Generation, assembly, and instance materialization all
  succeed end-to-end.

## 4. Conclusion
Assessment blueprints are defined and active for three real roles; the assembly engine produces
real, per-subject scored instances. **Assessment generation is operational.** The only open item
is data population (dimension mix + larger question pools), not a mechanism defect.
