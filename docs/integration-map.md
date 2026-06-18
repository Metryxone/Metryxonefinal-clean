# Career OS — Cross-Module Event-Driven Integration Map

Status: **active** · Scope: the 4 in-process modules (Assessment, Projects, Applications, Goals).
Learning + Mentor live in the separate `frontend/server/src` process and are deferred (see §6).

This document is the single source of truth for *how a write in one module
propagates to the intelligence layers that depend on it*. It is **additive** —
no new bus, store, table, engine, or API was created; existing infrastructure
was connected.

---

## 1. Reuse Analysis (search-first — what already existed)

| Capability | Existing asset reused | Verdict |
|---|---|---|
| Event bus | `backend/services/adaptive-event-bus.ts` (singleton `EventEmitter` + persistence) | **Connected** — added 3 event constants only |
| Cross-module fan-out + staleness | `competency-intelligence-orchestrator.ts` (`propagateAdaptiveUpdates`, `touchRefreshState`, `EVENT_TO_REFRESH_TARGET`) | **Connected** — added `propagateModuleUpdate` reusing the same `emit` + `touchRefreshState` |
| Event log / staleness tables | `adaptive_intelligence_events`, `intelligence_refresh_state` (migration `20260715_adaptive_orchestration_v2.sql`) | **Reused** — no schema change |
| DB pool | `pool` in `backend/storage.ts` | **Reused** — exported additively |
| Scoring engines (EI / Fitment / Visibility / Velocity) | `frontend/src/lib/engines/*` recompute at read-time | **Reused** — never duplicated |
| Readiness / Competencies / Employability | `readiness-intelligence-engine.ts`, `unified-competency-profile-engine.ts`, `omega-x-scoring.ts` | **Reused** — never duplicated |
| Frontend recompute trigger | `useCareerBrain(userId, {profile, jobs, goals, eiScore})` | **Reused** — recomputes from page state automatically |

**Nothing was rebuilt.** Assessment already propagated and was left untouched.

## 2. Existing Dependencies

- `ADAPTIVE_EVENTS` registry + `emit()` / `on()` (adaptive-event-bus).
- `touchRefreshState()` and the `intelligence_refresh_state` upsert (orchestrator).
- `pool` (pg) from `storage.ts`; `db` (drizzle) already in `career-seeker.ts`.
- Frontend `useCareerBrain` read-time engine recompute (no change needed).

## 3. Integration Plan

1. Add 3 additive event constants to the existing `ADAPTIVE_EVENTS`:
   `PROJECT_UPDATED`, `APPLICATION_UPDATED`, `GOAL_UPDATED`.
2. Add `MODULE_PROPAGATION` (the matrix) + `propagateModuleUpdate()` to the
   existing orchestrator — emits the source event and stamps each dependent
   target in `intelligence_refresh_state`. Best-effort, never throws.
3. Fire `propagateModuleUpdate()` (fire-and-forget, after the primary DB write)
   from the previously-isolated `career-seeker.ts` handlers.
4. Frontend requires no change: the brain recomputes the dependent engines from
   page state on every mutation.

## 4. Implementation — the propagation matrix

| Source action | Route handler (`backend/routes/career-seeker.ts`) | Event emitted | Propagates to (intelligence targets) |
|---|---|---|---|
| **Assessment** complete | `adaptive-assessment-v2.ts` → `orchestrateAssessmentCompletion` | *(already)* score/dna/benchmark cascade | EI · Fitment · Visibility · Readiness |
| **Project** add/edit | `PUT/PATCH /api/cv/profile/:userId` (gated on `projects[]` change) | `career.project.updated` | Fitment · Visibility · Employability |
| **Application** create/update | `POST /api/cv/jobs`, `PUT/PATCH /api/cv/jobs/:id` | `career.application.updated` | Visibility · Readiness · Velocity |
| **Goal** create/update | `POST /api/cv/goals`, `PUT/PATCH /api/cv/goals/:id` | `career.goal.updated` | Actions · Progress |

Flow for every row above:
```
module write (DB) ──► propagateModuleUpdate()
                        ├─ emit(event) ──► adaptive_intelligence_events   (system-level record + any on() listener)
                        └─ touchRefreshState(target) ──► intelligence_refresh_state  (staleness per dependent target)
frontend mutation ──► page state updates ──► useCareerBrain recomputes ──► EI/Fitment/Visibility/Velocity refresh (read-time)
```

Isolation removed: these four writes were previously dead-ends (own table only);
each now fans out through the shared bus with no behavioural change to the
response path (propagation is fire-and-forget and error-isolated).

## 5. Identity-space note (important)

The two persistence sinks have **different id types**:

- `intelligence_refresh_state.scope_id` is **TEXT** → holds career-seeker
  `users.id` (varchar UUID) natively. This is the meaningful staleness signal
  ("user X's fitment is stale").
- `adaptive_intelligence_events.user_id` is **BIGINT** → cannot hold a UUID.
  `propagateModuleUpdate` therefore persists `user_id = NULL` for non-numeric
  ids and carries the raw id in `payload.user_ref` for traceability (numeric ids
  — e.g. the assessment/CAPADEX space — still populate `user_id`).

Consequently the call sites pass the **raw** `users.id` string (no `Number(...)`
coercion — that would yield `NaN` and silently drop propagation).

## 6. Validation Report

- **Typecheck**: no new errors in the four changed files
  (`adaptive-event-bus.ts`, `competency-intelligence-orchestrator.ts`,
  `storage.ts`, `career-seeker.ts`). Remaining tsc output is pre-existing
  (`node_modules/drizzle-orm`, `exam-ready.v1.routes.ts`, `index.ts`, and the
  `sessionUser` `User` type mismatch in `career-seeker.ts` — untouched).
- **Boot**: `Backend API` restarts clean → `Server listening on 8080`, no
  import/circular errors.
- **Runtime end-to-end** (throwaway script, real DB, self-cleaned, run with a
  **UUID string** user id): each of the 3 module events `event_persisted: true`,
  `user_id = null`, `user_ref = <uuid>`, and stamped the **exact** matrix targets
  in `intelligence_refresh_state`:
  - `career.application.updated` → visibility, readiness, velocity ✓
  - `career.project.updated` → fitment, visibility, employability ✓
  - `career.goal.updated` → actions, progress ✓
- **Non-breaking**: propagation is fire-and-forget (`void …catch(() => {})`)
  after the primary write; a propagation failure can never fail the user request.

## 7. Deferred (separate process — `frontend/server/src`)

| Module | Handler | Why deferred |
|---|---|---|
| Learning / course progress | `frontend/server/src/routes/student.ts` (`PUT study-tasks/:id/complete`) | Separate Express process (cannot reach the in-process bus directly) + guardrailed dir. Needs a backend ingest endpoint to bridge. |
| Mentor session | `frontend/server/src/routes/mentor.ts` (`POST bookings/:id/notes`) | Same as above. |

Intended events when authorized: `learning.progress.updated` → Competencies · EI ·
Velocity; `mentor.session.logged` → Goals · Competencies · Progress — bridged via
a single additive `POST /api/career/module-event` backend ingest that calls the
same `propagateModuleUpdate()`.
