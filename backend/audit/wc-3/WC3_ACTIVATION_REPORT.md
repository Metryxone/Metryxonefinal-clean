# WC-3 Activation Validation Report

Controlled activation of the WC-3 behavioural-runtime stack (L1 Stage · L2 Outcome ·
L3 Journey · L4 Personalization · L6 Longitudinal) in **DEV only**, with all five
`FF_WC3_*` flags enabled, driving the **real resolvers** across 5 persona scenarios.

- Activation date: 2026-06-04 · Scope: dev environment (`DATABASE_URL`).
- **No schema changes, no new implementation, no deploy.** Validation only.
- Synthetic scenario rows were inserted, measured, then **fully removed** (DB returned
  to pre-run state). Flags are left **ON** in the `Backend API` workflow env per the
  approved "activate in DEV" objective.

---

## 0. How this was validated

The five `FF_WC3_*` flags were enabled in the `Backend API` workflow env
(`FF_WC3_STAGE/OUTCOME/JOURNEY/PERSONALIZATION/LONGITUDINAL=1`) and the backend
restarted clean on :8080. A throwaway harness then drove the **exact runtime
functions** the post-completion hook calls — `resolveSessionStage` →
`captureLongitudinalSnapshot` → `resolveSessionOutcomes` → `resolveSessionJourney`
(plus `logPersonalizationDecision`), in the same order as
`capadex-enterprise.ts` lines 408–458 — over 5 controlled completed sessions.

Each scenario seeded a `capadex_sessions` row (persona / age / stage_code / score) and
persona-representative **active `behavioural_hypotheses` constructs** — the same
upstream input L2 consumes in production (where it is produced by the signal pipeline).
Only the construct vector was synthesised; **all WC-3 routing logic ran for real.** The
live HTTP surface (`GET /api/capadex/session/:id/{stage,outcome,journey}`) was also
confirmed to return `enabled:true` with real payloads once flags were ON.

> Caveat: confidence/route results below are produced by the real engine over
> *representative* construct sets, not full UI click-throughs. They validate the
> **routing logic + catalog calibration**, which is the point of this exercise.

---

## 1. Per-persona results

| Persona | Stage | Outcome models (conf) | **Primary route** | Secondary | Conf · Band | Analyst verdict |
|---|---|---|---|---|---|---|
| School Student (15) | Awareness | decision_quality 0.40 · learning_effectiveness 0.40 | **lbi** | career_builder | 0.42 · MODERATE | ⚠️ low-conf; no learning home |
| Parent (42, proxy) | Curiosity | confidence_stability 0.76 · exam_readiness 0.76 | **competitive_exam** | mentoring | 0.91 · CORPUS_PENDING | ❌ **WRONG ROUTE** |
| College Student (20) | Clarity | career_clarity · decision_quality · employability_readiness (0.76) | **career_builder** | employability_index | 1.00 · HIGH | ✅ correct |
| Job Seeker (26) | Growth | career_clarity · confidence_stability · employability_readiness (0.76) | **employability_index** | career_builder | 1.00 · HIGH | ✅ correct |
| Exam Aspirant (19) | Curiosity | exam_readiness 0.76 · learning_effectiveness 0.76 | **competitive_exam** | mentoring | 1.00 · CORPUS_PENDING | ✅ correct (gated) |

---

## 2. Measured distributions (n=5 controlled)

**Stage** (deterministic from `stage_code`): Awareness 1 · Curiosity 2 · Clarity 1 · Growth 1 — even spread, no imbalance in the controlled set.

**Outcome model activations** (all 6 models fired):

| Model | Activations | Avg conf |
|---|---|---|
| career_clarity | 2 | 0.76 |
| employability_readiness | 2 | 0.76 |
| confidence_stability | 2 | 0.76 |
| exam_readiness | 2 | 0.76 |
| learning_effectiveness | 2 | 0.58 |
| decision_quality | 2 | 0.58 |

**Primary route**: competitive_exam **2** · career_builder 1 · employability_index 1 · lbi 1 · mentoring **0**.

**Confidence band**: HIGH 2 · CORPUS_PENDING 2 · MODERATE 1 · LOW 0.

**Degraded (Mentoring fallback)**: 0 / 5.

**Personalization decisions**: 5 / 5 captured · canonical_persona → self 2, parent 1, job_seeker 1, exam_aspirant 1 · `dims_used` populated.

**Longitudinal snapshot capture rate**: **5 / 5 (100%)**.

**Library-backed outcome actions**: 21 across 5 sessions (good actionability).

---

## 3. Findings

### F1 — ❌ WRONG ROUTE: Parent → Competitive Exam (severity: HIGH)
A Parent persona (constructs `FAMILY_DYNAMICS`, `EMOTIONAL_REGULATION`,
`STRESS_MANAGEMENT`) was routed to **competitive_exam** at 0.91.

**Root cause (3-part):**
1. `STRESS_MANAGEMENT` is a **shared construct** in *both* `confidence_stability` and
   `exam_readiness` model vocabularies. A single shared construct activates
   `exam_readiness`.
2. Outcome model confidence is **quantized at 0.76** — 1-construct overlap scores the
   same as 3-construct overlap (see F3), so `exam_readiness` (1 hit) ties
   `confidence_stability` (2 hits).
3. `competitive_exam` has a **0.90 affinity** to `exam_readiness`, the highest single
   affinity in the catalog, so it dominates the route fit (0.91) over `lbi` (0.65).

Net: a parent worried about a child's motivation is steered into exam-prep. Also note
`FAMILY_DYNAMICS` is an **orphan** (in no outcome model) — correctly ignored, but it
means genuine parent/family intent has **no outcome-model coverage** (contributes to F2).

### F2 — ⚠️ MISSING ROUTE: no Learning / Study-skills home (severity: MEDIUM)
The general School Student landed on **lbi at 0.42 (MODERATE)** — the weakest primary in
the set. `learning_effectiveness` (the natural model for a young learner) has its
**highest route affinity on `competitive_exam` (0.70)**; there is no general
"Learning / Study Skills" product. Likewise no route owns `FAMILY_DYNAMICS`. Young
learners and parents therefore have no high-confidence, intent-aligned destination.

### F3 — ⚠️ Outcome confidence has no overlap-depth term (severity: MEDIUM, enabler of F1)
L2 model confidence is `stage.confidence·0.6 + action_presence·0.4` — there is **no term
for how many constructs matched the model**. So a model activated by **1** construct
scores the same as one activated by **3** (here all four landed on 0.76 because they
shared the same stage confidence + had a library action). The ranker therefore cannot
separate a strongly-evidenced model from a single-construct coincidence — directly
enabling the F1 misroute. Recommend adding an overlap-depth factor (e.g. matched/total
constructs) to model confidence.

### F4 — ✅ Mentoring fallback NOT overused / always-route holds
Mentoring was **never primary** (0/5) and appeared as secondary 3/5 (expected — it has
broad 0.40–0.60 affinities by design). Invariant (a) "no concern terminates without a
route" held; `degraded` was false for all 5. **Gap:** none of the 5 scenarios had an
empty behavioural spine, so the deterministic empty-spine fallback path was **not
exercised here** (it was covered in the Phase C deltas smoke). A no-construct scenario is
recommended in any future activation pass.

### F5 — ✅ Competitive Exam supported under CORPUS_PENDING
Both competitive_exam routes correctly surfaced the **CORPUS_PENDING** band rather than
being suppressed — invariant (b) holds. The over-representation (2/5 primary) is inflated
by the F1 false positive; the legitimate count is 1/5 (the exam aspirant).

### F6 — ✅ Good routes validated
College Student → **career_builder** (HIGH 1.0) and Job Seeker → **employability_index**
(HIGH 1.0) are correct, well-separated, high-confidence routes. Stage advancement,
expected-outcome labels, snapshots (100%), and personalization capture all behaved.

### F7 — ℹ️ Personalization persona granularity is coarse
`canonicalPersona()` collapses both `student` and `college_student` to **`self`**.
Distinct school vs college intent is lost at the personalization layer (informational —
not a routing defect).

---

## 4. Recommendations (NOT implemented — for approval)

| # | Finding | Suggested fix | Touches |
|---|---|---|---|
| R1 | F1/F3 | Add an overlap-depth factor (e.g. matched/total constructs) to the L2 model-confidence formula (`stage·0.6 + action·0.4`), so a 1-construct hit can't tie a 3-construct hit | L2 outcome resolver |
| R2 | F1 | Reduce `exam_readiness` weight contribution from shared constructs (`STRESS_MANAGEMENT`) or require an exam-specific construct (`EXAM_*`) to activate `competitive_exam` as primary | catalog `model_affinities` / outcome model keys |
| R3 | F2 | Add a Learning/Study-skills route, or raise `learning_effectiveness` affinity to a non-exam route; consider a Family/Parenting route for `FAMILY_DYNAMICS` | `wc3_journey_routes` catalog |
| R4 | F4 | Add an empty-spine scenario to the standard activation suite to exercise the Mentoring fallback | validation harness |

All are **catalog/calibration** changes (data + resolver weighting), not structural — no
ontology/signal/concern changes implied.

---

## 5. Activation state & cleanup

- Flags **left ON** in `Backend API` workflow env (per approved "activate in DEV").
- HTTP surface confirmed live: `/stage`, `/outcome`, `/journey` all return `enabled:true`.
- All synthetic scenario rows removed; `wc3_*` per-session tables and `capadex_sessions`
  returned to 0 rows for the test session ids (verified post-cleanup). Catalogs
  (`wc3_journey_routes` ×5, `wc3_outcome_models` ×6) untouched.
- **No deploy.** Awaiting approval on the F1–F3 calibration findings before any change.

---

## Appendix A — Reproducibility (scenario inputs + raw resolver outputs)

Each row is a synthetic completed `capadex_sessions` + active `behavioural_hypotheses`
construct vector; resolvers ran in hook order. Raw journey candidate fits below are the
engine's actual output for this run.

| Persona | persona | age | stage_code | score | Seeded active constructs |
|---|---|---|---|---|---|
| School Student | student | 15 | CAP_AWR→Awareness | 45 | LEARNING_APPROACH, LEARNING_DRIVE, ATTENTION_REGULATION, INTRINSIC_MOTIVATION |
| Parent | parent | 42 | CAP_CUR→Curiosity | 38 | FAMILY_DYNAMICS, EMOTIONAL_REGULATION, STRESS_MANAGEMENT |
| College Student | college_student | 20 | CAP_INS→Clarity | 62 | CAREER_CLARITY, SKILL_AWARENESS, GOAL_ORIENTATION |
| Job Seeker | job_seeker | 26 | CAP_GRW→Growth | 70 | SKILL_AWARENESS, COMMUNICATION, CAREER_READINESS, SOCIAL_CONFIDENCE |
| Exam Aspirant | exam_aspirant | 19 | CAP_CUR→Curiosity | 55 | EXAM_READINESS, EXAM_PERFORMANCE, EXAM_STRESS, ACADEMIC_RECOVERY |

**Raw journey candidate fits (route:fit, descending):**

- **School Student** → lbi:0.42 · career_builder:0.36 · mentoring:0.32 · competitive_exam:0.28
- **Parent** → competitive_exam:0.91 · mentoring:0.76 · lbi:0.65 · employability_index:0.23
- **College Student** → career_builder:1.60 · employability_index:1.06 · mentoring:0.91 · lbi:0.80
- **Job Seeker** → employability_index:1.29 · career_builder:1.22 · mentoring:1.06 · lbi:0.87 · competitive_exam:0.23
- **Exam Aspirant** → competitive_exam:1.22 · mentoring:0.61 · career_builder:0.30 · lbi:0.23

Catalog facts used (unchanged): `competitive_exam.model_affinities.exam_readiness = 0.90`;
`STRESS_MANAGEMENT ∈ {confidence_stability, exam_readiness}.construct_keys`;
`learning_effectiveness` highest route affinity = `competitive_exam` (0.70);
`FAMILY_DYNAMICS ∉` any outcome model. All synthetic rows deleted post-measurement.

---

## Appendix B — Calibration Fixes Applied (R1 + R2)

User-approved fixes for the HIGH-severity **F1** misroute (Parent → Competitive Exam).
Strictly additive / compose-only / never-throws; NO schema/ontology/signal/concern
changes. Both refinements run only when the WC-3 flags are ON (flag-off path stays
byte-identical to legacy).

### R1 — overlap-depth term in L2 model confidence (`services/wc3/outcome-intelligence.ts`)
- **Before:** `confidence = stage.confidence·0.6 + (actions ? 0.4 : 0)` — a model matching
  1 construct and a model matching 3 scored identically.
- **After:** `confidence = stage.confidence·0.5 + (actions ? 0.3 : 0) + min(1, overlap/3)·0.2`
  — overlap depth now contributes, so a single shared-construct coincidence can no
  longer tie a strongly-evidenced multi-construct activation. Bounded [0,1].

### R2 — exam-evidence guard in L3 journey ranking (`services/wc3/journey-intelligence.ts`)
- The corpus-pending **Competitive Exam** route may be **PRIMARY** only when the
  `exam_readiness` model matched ≥1 **dedicated** `EXAM_*`-prefixed construct.
- Without dedicated evidence, if Competitive Exam holds the top raw fit it is demoted
  to **secondary** (kept fully supported — invariant (b) preserved) and the next real
  route becomes primary. Candidate ranking stays honest (exam keeps its true raw-fit
  rank); `route_reason` + `reason='exam_guard_demoted'` explain the demotion.
- Chosen over deleting `STRESS_MANAGEMENT` from the exam model's vocabulary because
  exam-stress is a *legitimate* exam-readiness signal — the guard removes the spurious
  PRIMARY routing without discarding real corroborating signal.

### Post-fix validation (same 5 personas, real resolvers in hook order)

| Persona | Primary (before) | Primary (after) | Secondary (after) | Band | Guard |
|---|---|---|---|---|---|
| School Student | lbi | **lbi** | career_builder | MODERATE | n/a (no exam model) |
| **Parent** | **competitive_exam** ❌ | **mentoring** ✅ | competitive_exam | HIGH | **fired** (exam_guard_demoted) |
| College Student | career_builder | **career_builder** | employability_index | HIGH | n/a |
| Job Seeker | employability_index | **employability_index** | career_builder | HIGH | n/a |
| Exam Aspirant | competitive_exam | **competitive_exam** | mentoring | CORPUS_PENDING | not fired (dedicated EXAM_* evidence) |

- **F1 RESOLVED:** Parent no longer routed to exam prep; exam retained as a visible
  secondary. The 4 previously-correct personas are unchanged (no regressions).
- Exam Aspirant still routes to Competitive Exam (CORPUS_PENDING) because the guard
  sees real `EXAM_READINESS/EXAM_PERFORMANCE/EXAM_STRESS` evidence.
- All synthetic validation rows seeded + deleted; DB restored (verified 0 remaining).

### Held (not implemented — larger product decisions)
- **R3** (new Learning/Study-skills + Family/Parenting routes for `FAMILY_DYNAMICS`
  orphan) — catalog/product expansion, awaiting product approval.
- **R4** (empty-spine fallback scenario) — noted for a future suite addition.
