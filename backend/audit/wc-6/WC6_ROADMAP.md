# WC-6 — CAPADEX Decision Orchestration Roadmap (Output #6)

Sequenced, additive, flag-gated phases to close the orchestration gap. Each is
**compose-only** (re-shape already-derived outputs), **default OFF**, **byte-identical when
OFF**, and **never fabricates** a not-ready destination. No item below is implemented in
WC-6 — this is the proposed build sequence for a future approved phase.

Difficulty: **S**mall / **M**edium / **L**arge. Priority: **P0** (foundation) → **P3**.

---

## Phase O0 — Prerequisites (decide before building) · P0
| Item | Why | Difficulty |
|------|-----|-----------|
| **Cross-server seam decision** | Mentoring + rich subscription schema live in `frontend/server`; chain + M5 in `backend/`. Pick the canonical home (or define an internal call contract) or the orchestrator can't call them cleanly. | M |
| **Subscription schema reconciliation** | Live `subscription_packages` lacks `tier/features/modules/max_students`; `institution_id`/`max_students` absent → B2B non-functional. Decide migrate-vs-keep-simple. | M |
| **Confirm grounding deltas vs WC-5** | Mentoring REAL, M5 REAL, sub schema simpler — bake these corrected facts into the build plan. | S |

**Gate:** no orchestration code until O0 decisions are approved.

---

## Phase O1 — Decision Orchestrator (read-only envelope) · P0
| Item | Current | Target | Difficulty | Business Impact |
|------|---------|--------|-----------|-----------------|
| `DecisionOrchestrator` composing Stage+Context+Outcome+Journey+Action into one `ActivationEnvelope` | endpoints isolated | one decision → {product, action, growthPlan, mentor, subscription} w/ `ready/reason` | M | High — the conductor; unlocks every other phase |
| Ambiguity/confidence arbitration (reuse L2/L3) | per-layer only | unified `decision.confidence/ambiguity/why[]` | S | High — trust + honesty |

**Acceptance:** flag OFF → byte-identical; ON → envelope returns honest `ready:false` for
stubs, never a faked activation.

---

## Phase O2 — Journey → M5 Growth-Plan Bridge · P0
| Item | Current | Target | Difficulty | Business Impact |
|------|---------|--------|-----------|-----------------|
| Map journey/outcome → `coachInput()` so M5 runs from the CAPADEX decision | M5 reads M-series scores via AssessmentWriter | M5 also seeded by concern-journey decision | M | High — one bridge improves the Growth Plan row for ALL 6 segments |
| Segment plan templates (school/exam variants) | role-oriented only | age/segment-appropriate plans | M | Medium-High |

---

## Phase O3 — Mentor Match from the Decision · P1
| Item | Current | Target | Difficulty | Business Impact |
|------|---------|--------|-----------|-----------------|
| Upgrade `/suggestions` match basis from raw LBI scores → unified decision | LBI-weakness → mentor_type (already real) | decision (stage+outcome+concern) → mentor_type | S–M | High — mentor is the closest-to-orchestrated surface |
| Exam taxonomy + cohort/bulk allocation (Institution) | generic pool | exam-mentor match; cohort assignment | M | High (B2B) |

---

## Phase O4 — Decision → Subscription Recommendation · P1
| Item | Current | Target | Difficulty | Business Impact |
|------|---------|--------|-----------|-----------------|
| Map segment+outcome → recommended package (over existing `student_segment`/`is_recommended`) | manual "Recommended" badge | decision-driven recommendation (recommend, don't hardcode) | M | High — direct revenue lift; closes the weakest link |
| Job-seeker / employability package (missing) | ✗ | a real job-seeker package | S | High (untapped segment) |

---

## Phase O5 — Backend Entitlement Enforcement · P1
| Item | Current | Target | Difficulty | Business Impact |
|------|---------|--------|-----------|-----------------|
| `requireSubscription` / module-gate middleware | partial/non-blocking (frontend PLAN_ORDER + a path that logs an outcome but allows the flow); no general gate | server-side gate keyed on `student_subscriptions` | M | High — protects revenue; enforcement today is partial |
| Close mentor `/book` auth hole | `POST /api/mentor-marketplace/:id/book` lacks `requireAuth` (books with null parent) | authed booking | S | Medium — concrete access-control fix |

---

## Phase O6 — Institutional B2B Readiness · P2 (highest revenue, biggest gap)
| Item | Current | Target | Difficulty | Business Impact |
|------|---------|--------|-----------|-----------------|
| `institution_id` / `max_students` on packages + seat enforcement | absent → non-functional | seat-based institutional plans, enforced | L | **Highest** — unlocks B2B revenue |
| Institutional-admin persona | missing (only `placement_career_cell` partial) | admin persona + cohort decision surface | L | Highest |
| Cohort decision/action/mentor/plan rollups | per-student only | cohort orchestration | L | High |

---

## Phase O7 — Product completion (parallel track) · P2/P3
| Item | Current | Target | Difficulty | Notes |
|------|---------|--------|-----------|-------|
| Employability Index → real | stub | real score/surface (job-seeker/college) | L | Unblocks 2 segments' product row |
| Competitive-Exam product + corpus | stub + corpus_pending | real exam product | L | Note inversion: packages already real |
| Career Builder persistence | partial | persisted plan | M | Strengthens college/job-seeker |

---

## Sequenced summary (do in this order)
1. **O0** prerequisites (seam + schema decisions) — *gate everything else.*
2. **O1** Decision Orchestrator — the conductor.
3. **O2** Journey→M5 bridge — one move, six segments.
4. **O3** mentor-from-decision · **O4** decision→subscription · **O5** entitlement — the commercial loop.
5. **O6** institutional B2B — highest revenue, largest build.
6. **O7** product completion — parallel, unblocks stub segments.

**Lowest-effort/highest-leverage first three:** O1 (conductor) → O2 (one bridge, all
segments) → O3 (mentor match upgrade, already near-orchestrated). These deliver visible
orchestration before the heavier commercial (O4–O6) and product (O7) builds.

**Discipline reminder:** every phase additive · flag-gated default OFF · byte-identical when
OFF · honest `ready:false` over fabricated activation. No tuning destinations to fake
readiness.
