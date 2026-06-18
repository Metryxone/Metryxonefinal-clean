# WC-P1 — D4: Competency Framework Readiness

**Coverage**: 20% | **Confidence**: 15%

---

## Evidence

| Component | State |
|---|---|
| `competency_question_templates` | 63 rows — seeded |
| `competency_scores` table | ❌ DOES NOT EXIST (relation missing) |
| Competency score → EI feed | ❌ No path (table absent) |
| Competency questions → Assessment tab | ✅ Route exists (`GET /api/competency/questions/select`) |
| `profile.assessmentScore` persistence | ⚠️ Stored on JSONB profile field; not in a dedicated table |
| LBI sessions (behavioural competency) | 0 rows (no usage) |

---

## Critical: competency_scores Table is Absent

The planned competency framework requires a `competency_scores` table to store per-user, per-competency proficiency scores. This table does not exist. Without it:

- No per-competency breakdown is available.
- The EI competency dimension can only be an aggregate scalar (0–100 from the assessment).
- No competency history or trajectory is trackable.

---

## What Works

The Assessment tab in Career Builder:
- Fetches 63 questions from `competency_question_templates` ✅
- Displays adaptive question flow ✅
- On completion, stores `assessmentScore` in `profile.assessmentScore` ✅
- Shows score in the EI breakdown modal at (score/100)*25 ✅

What does NOT work:
- Score does not flow into the EI gauge (useHybridEI) ❌
- No per-competency breakdown stored ❌
- No competency history ❌

---

## Actions to Reach 95%

1. Create `competency_scores` table (user_id, competency_key, score, assessed_at).
2. On assessment completion: decompose the aggregate score into per-competency scores and persist.
3. Wire `profile.assessmentScore` into `runEmployabilityEngine()` as a named input.
