# MX-74X · Section 6 — Learning Intelligence Framework

**File:** `backend/services/learning-path-engine.ts` · **Route:** `backend/routes/learning-path.ts`
**Flag:** `learningPath` (inherits `careerBuilderSuite`) · **Version:** `74x.1.0`
**Status:** NEW (the second missing link). Compose-only · read-only · never-throws · flag-gated.

---

## 1. Why this engine exists

Career Roadmap (priority-ordered development plan + milestones) and Career Recommendations both
exist, but nothing sequences them into a learner-facing **gap → recommended action → milestone
horizon** path. This engine is that bridge. It never invents a course or a fake action — each step
carries the roadmap's own `development_action` and milestone `horizon`.

## 2. What it composes (never recomputes)

| Source | Used for |
|---|---|
| `buildCareerRoadmap(pool, subjectId)` | the priority-ordered `development_plan[]`, milestone `horizon`s, timeline |
| `buildCareerRecommendations` | recommendation items, fuzzy-joined to gaps by normalized competency name |

## 3. Algorithm

1. Build the roadmap. **No measurable roadmap (no target role / no gaps) → `measurable:false`**,
   empty sequence, honest note.
2. Build a `competency_id → milestone.horizon` map from the roadmap milestones
   (`MILESTONE_HORIZONS`: `now`→"address first", `next`→"after immediate gaps close", `later`→
   "sustained, lower-urgency growth").
3. For each `development_plan` competency, emit a `LearningStep`:
   - `competency_id/name`, `gap`, `blocking`, `priority_band` (`now/next/later`),
   - `horizon` = milestone horizon for that competency, else falls back to `priority_band`,
   - `development_action` = the roadmap's own deterministic action string (never a fabricated course),
   - `rec_backed` = does any recommendation fuzzy-match this competency name; matched recs attached.
4. Recommendations that match **no** gap are surfaced separately as
   `unmapped_recommendations[]` (honest — role/industry/function recs legitimately do not map to a
   competency gap).
5. `coverage_pct` = `rec_backed_steps / total_steps`; `confidence.band` derived from that ratio.
   `timeline` is carried verbatim from the roadmap (`total_estimated_weeks/months`, disclaimer).

## 4. Honesty contract

- A step with no matching recommendation says so (`rec_backed:false`) — never a fabricated resource.
- `unmapped_recommendations` makes the rec/gap mismatch **visible**, not hidden.
- `coverage` (how much of the sequence is rec-backed) and `confidence` are separate axes.
- `null` timeline when the roadmap timeline is unmeasured — never a fake "0 months".

## 5. Verified behaviour (live data, 2026-06-24)

| Subject | measurable | steps | rec-backed | cov | conf | months |
|---|---|---|---|---|---|---|
| `adaptive_smoke_1` | true | 1 (Stakeholder Management, blocking) | 0 | 0 | low | ~0.9 |
| `demo_subj_pm` | true | 1 (Accountability, blocking) | 0 | 0 | low | ~0.9 |
| `aarav.chopra.0@example.com` | false | 0 | 0 | null | none | null |

`rec_backed=0` here is **honest, not a bug**: the live recommendation engine emits
role/industry/function-level recs, which legitimately do not map onto a competency gap. The
sequence's primary value (ordered, time-horizoned gap closure with deterministic actions) is
intact; the rec join is a disclosed bonus.

## 6. Route surface

- `GET /api/learning-path/_meta/status` — flag probe, no DB touch (literal path, registered first).
- `GET /api/learning-path/:subject` — composed ordered sequence, read-only.
- Both `requireAuth + requireSuperAdmin`; flag-OFF → `503 feature_disabled` before any DB touch.
