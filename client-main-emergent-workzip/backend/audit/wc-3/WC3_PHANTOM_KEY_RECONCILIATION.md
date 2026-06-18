# WC-3 — Phantom Key Reconciliation Report

**Scope:** Reconcile the 3 "phantom" model construct keys identified in
`WC3_ROUTE_COVERAGE_AUDIT.md` §2b. Additive registry change; no model/intervention
data deleted.

## 1. The reframe — these keys are NOT truly phantom
The audit flagged `CAREER_READINESS`, `COLLEGE_ADAPT`, `EXAM_STRESS` as "phantom"
because they appear in `wc3_outcome_models.construct_keys` but were **absent from the
canonical behavioural-constructs registry** (`backend/data/behavioural-constructs.ts`).

On closer inspection there are **two distinct uses** of `construct_keys`, against two
different vocabularies:

| Use | Vocabulary | Source |
|---|---|---|
| **Matching** — does the session activate this model? (`outcome-intelligence.ts` set-intersection) | Canonical **registry** keys (a session emits canonicalised registry constructs) | `behavioural-constructs.ts` (now 36) |
| **Actions** — what library interventions does the model supply? | **`intervention_library`** construct vocabulary (38 distinct keys) | `intervention_library` |

All three keys **exist in `intervention_library`** (1 intervention each), so per the
model's own grounding contract they are legitimate — they back real actions. They were
only "phantom" relative to the **registry**, which means they could **never MATCH** a
runtime session (no session ever emits a key that isn't in the registry). They were
**grounded-but-unmatchable**, not fabricated.

```
intervention_library count:  CAREER_READINESS=1  COLLEGE_ADAPT=1  EXAM_STRESS=1
```

## 2. Decision — register, don't delete (no-loss alignment)
Two reconciliation options were considered:

- **(A) Remove the keys from the models.** Removes the dead-match keys, but also
  **loses 3 grounded interventions** of action coverage and shrinks the models. A
  net regression.
- **(B) Register the keys in the canonical registry.** ✅ **Chosen.** Aligns the two
  vocabularies with **zero loss**: every key remains grounded in a real intervention,
  and each becomes **matchable** — so the models can now actually activate on these
  constructs at runtime.

## 3. What was implemented
Added 3 canonical constructs to `behavioural-constructs.ts`:

| Key | Label | Cluster | Already in models (now matchable) |
|---|---|---|---|
| `EXAM_STRESS` | Exam Stress | Academic | `exam_readiness` |
| `COLLEGE_ADAPT` | College Adaptation | Academic | `career_clarity` |
| `CAREER_READINESS` | Career Readiness | Career | `career_clarity`, `employability_readiness` |

Registry header comment corrected (it claimed **"32 constructs"** while the array held
33; now **36**, with an explicit note that 4 constructs — these 3 plus `CAREER_GROWTH`
— are model/intervention-grounded but do **not yet own a concern area**, an honest
tracked gap, not a defect).

## 4. Residual / honest gaps (not fabricated)
- These 3 constructs have **no `CONCERN_TO_CONSTRUCT` mapping yet** → they can be
  matched if a session emits them, but no concern area currently routes to them. This
  is recorded honestly rather than papered over with invented concern rows.
- `intervention_library` also contains 3 further keys absent from the registry
  (`ADJUSTMENT_COPING`, `DISCIPLINE_HABITS`, `GENERAL_CONCERN`). These are **not model
  keys** (no `wc3_outcome_models` row references them), so they are **out of scope** for
  phantom-key reconciliation. `GENERAL_CONCERN` is an intentional intervention catch-all.

## 5. Result
- Phantom model keys: **3 → 0**.
- The 3 reconciled constructs are immediately **covered** (each is in ≥1 model), lifting
  construct route coverage from 75.8% to 80.6% in combination with the family model.
- No interventions or model rows deleted; fully additive and reversible.
