# WC-6 — Activation & Readiness Matrices (Outputs #2–#5)

Legend — **R** real · **P** partial · **S** stub · **✗** absent.
Ready = destination exists & works. Orchestrated = driven from the unified decision.
All grounded in real code (see `WC6_README.md` evidence list). Never fabricated.

---

## Output #2 — Product Activation Matrix
*Which product a segment's decision should activate, and whether it can be activated today.*

| Segment | Primary product (by journey) | Destination reality | Activation today | Target activation | Gap |
|---------|------------------------------|--------------------|------------------|-------------------|-----|
| School Student | LBI (+ Mentor) | **R** | Manual nav; no deep-link from decision | Decision deep-links into LBI/mentor | Activation glue only |
| College Student | Career Builder / Employability | **P** / **S** | Partial; no persisted plan | Real employability surface + deep-link | Build employability; activation |
| Job Seeker | Employability Index / Career Builder | **S** / **P** | None real | Real employability score + deep-link | Build/merge product |
| Parent | Child LBI + Parent hub | **R** (proxy) | Hub exists; no decision deep-link | Proxy deep-link from child decision | Proxy activation |
| Exam Aspirant | Competitive-Exam portal | **S** + corpus_pending | None real | Real exam product | Corpus + portal APIs |
| Institution | Institutional dashboard | **✗** | None | Cohort decision surface | Build B2B surface |

**Finding:** the *floor* is higher than WC-5 said (LBI + Mentor both real), but **no
product is "activated" from a decision** — every entry needs the orchestrator's deep-link.

---

## Output #3 — Growth Plan Matrix
*M5 `growthPlan()` is REAL & persists; anchored to M-series role/competency scores, not yet
to the CAPADEX concern-journey. The recurring gap is the **journey→M5 bridge**.*

| Segment | M5 plan fit today | Inputs available | Target | Gap |
|---------|-------------------|------------------|--------|-----|
| School Student | Works but role-oriented (weak school fit) | `realUserScores()` via AssessmentWriter | Age-appropriate developmental plan from LBI/journey | Bridge + school plan template |
| College Student | Good (target-role uplift) | role + competency scores | Journey-seeded plan | Bridge |
| Job Seeker | **Best fit** (role-targeted uplift, market demand input) | scores + marketDemand + velocity | Plan from employability outcome | Bridge |
| Parent | Proxy (learner-oriented) | child scores | Parent-facing child plan | Proxy view |
| Exam Aspirant | No exam-specific roadmap | generic scores | Exam-prep plan | Exam corpus + template |
| Institution | Per-student (orgId-aware) ✔ | per-student scores | Cohort rollups | Aggregation layer |

**Finding:** the plan **engine** is real and even segment/persona-aware; the missing
piece is **feeding it the CAPADEX journey decision** (today it reads M-series scores). One
bridge unlocks all six segments.

---

## Output #4 — Mentor Recommendation Matrix
*Mentoring is REAL: `/api/mentor-marketplace` + `/suggestions` (LBI domain-weakness →
`mentor_type`) + booking/messaging/notes, DB-backed (`mentor_profiles`). Lives in
`frontend/server`. The gap is driving the match from the **unified decision**, not raw LBI
only, plus the cross-server call.*

| Segment | Match today | Match basis | Target match basis | Gap |
|---------|-------------|-------------|--------------------|-----|
| School Student | **R** | child LBI domain-weakness → mentor_type | Unified decision (stage+outcome+concern) | Decision-driven basis; cross-server |
| College Student | **R** (generic) | LBI scores | Career journey + target role | Decision basis |
| Job Seeker | **R** | LBI scores | Industry/role from employability outcome | Decision basis |
| Parent | **R** (proxy booking) | child scores | Child decision | Proxy polish |
| Exam Aspirant | **R** (pool exists) | generic | Exam taxonomy → exam mentor | Exam taxonomy in match |
| Institution | **P** | per-student | Cohort/bulk allocation | Cohort orchestration |

**Finding:** mentor recommendation is the **closest to orchestrated** of all five — it
already matches off assessment data. Upgrading the match input from "LBI scores" to "the
unified decision" + resolving the cross-server seam finishes it.

---

## Output #5 — Subscription Readiness Matrix
*Billing CRUD + seeded segment-labelled packages are REAL (`student_segment`,
`is_recommended`, `domains_covered[]`, `price`, `validity_days`). **Missing:**
decision→package mapping and a general entitlement gate (enforcement today is
partial/non-blocking — frontend `PLAN_ORDER` + one path that logs an outcome but allows the
flow), plus B2B columns (`institution_id`/`max_students` not in live schema). Link table:
`student_subscriptions`.*

| Segment | Package exists | Recommend-from-decision | Entitlement enforced | Readiness | Gap |
|---------|----------------|------------------------|----------------------|-----------|-----|
| School Student | **R** (FOUNDATION/PERFORMANCE/Micro) | ✗ | ✗ (frontend PLAN_ORDER only) | Medium | Mapping + enforcement |
| College Student | **P** (READINESS) | ✗ | ✗ | Medium | Mapping + enforcement |
| Job Seeker | **✗** (no clear package) | ✗ | ✗ | Low | New package + mapping |
| Parent | **R** (family via child link) | ✗ | ✗ | Medium | Mapping + enforcement |
| Exam Aspirant | **R** (ExamReadiness Index, EDGE) | ✗ | ✗ | Medium-High (packaged) | Mapping; product stub limits delivery |
| Institution | **✗** (no `institution_id`/`max_students`) | ✗ | ✗ (non-functional) | **Low** | Schema + enforcement + admin surface |

**Finding:** subscription is the **weakest reachability**. Packages exist and are
segment-labelled, but nothing **recommends** one from a decision and **nothing enforces**
access. The **Institution** row is non-functional at the data layer despite being the
highest-revenue segment — the single most commercially important gap.

---

## Cross-matrix synthesis
- **Best-orchestrated path today:** Mentor (matches off assessment) → then Growth Plan
  (engine real, needs bridge) → then Product (LBI/Mentor real, needs deep-link).
- **Worst path:** Subscription (no mapping, no enforcement) and Institution (data layer
  missing). These define the roadmap's top priorities.
- **One bridge, many wins:** the **journey→M5 bridge** improves the Growth Plan row for all
  six segments; the **Decision Orchestrator** is what makes Action/Product/Mentor fire from
  one decision instead of being manually navigated.
