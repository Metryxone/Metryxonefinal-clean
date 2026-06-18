# WC-6 — Decision Orchestration Architecture (Output #1) + Reachability Audits

---

## Part 1 — Decision Orchestration Architecture (proposed, compose-only)

### 1.1 The problem
Today each endpoint exists in isolation: L3 routes to a product, M5 builds a growth plan,
the mentor service matches mentors, and the admin manages packages. **Nothing composes
them from a single decision.** The orchestration layer is the missing *conductor*.

### 1.2 Principle (carry WC-3 discipline)
**Additive · compose-only (re-shape already-derived outputs, never re-derive) ·
flag-gated default OFF · byte-identical when OFF · never fabricate** (a not-ready
destination is an honest `ready:false` marker, never a faked activation).

### 1.3 Proposed shape — a read-only `DecisionOrchestrator`
Input: a completed session's already-derived layers (Stage, Context, Outcome, Journey,
Action) + the segment/persona + age. Output: one **Activation Envelope**:

```
ActivationEnvelope {
  decision:      { primary_journey, confidence, ambiguity, why[] }   // from L3 + L2
  product:       { route_key, target_path, ready: bool, reason }     // L3 → real surface
  action:        { interventions[], recommendations[] }              // existing Action layer
  growthPlan:    { source: 'M5', coachInput{...}, ready, reason }    // bridge journey→M5
  mentor:        { suggestions[], matchBasis, ready, reason }        // existing /suggestions
  subscription:  { recommended_package_id, segment, why, ready }     // map over student_segment
  entitlement:   { required_package?, hasAccess: bool }              // NEW enforcement read
}
```

Every field carries an honest `ready/reason`. The envelope **does not act** — it composes
what each existing engine already returns (or marks it not-ready) so the UI / a thin
activation route can use it. This mirrors how WC-3's read-only resolvers compose the
guidance engine.

### 1.4 What already exists vs what the orchestrator must add

| Capability | Already exists (real) | Orchestrator must add |
|------------|----------------------|----------------------|
| Decision (journey + outcome + confidence) | L2/L3 produce these | Fuse into one envelope + ambiguity arbitration |
| Product routing | L3 `wc3_journey_routes` | Activation/deep-link + `ready` per real surface |
| Action | intervention + recommendation engines | Thread into the envelope (no new logic) |
| Growth plan | M5 `growthPlan()` (REAL, persists) | **Bridge**: map journey/outcome → `coachInput()` |
| Mentor | `/suggestions` (REAL, LBI-weakness matching) | Drive match basis from the **decision**, not raw LBI only |
| Subscription | packages + `student_segment` + `is_recommended` | **Decision→package mapping** + **entitlement enforcement** |
| Cross-server | mentoring + rich sub schema in `frontend/server`; chain + M5 in `backend/` | Resolve the seam (canonical home / internal call) |

### 1.5 The cross-server seam (real architectural finding)
The intelligence chain (`backend/services/wc3/*`) and M5 live in **`backend/`** (port
8080). The **mentor product** and the **richer (unmigrated) subscription schema** live in
**`frontend/server/`**. An orchestrator in `backend/` cannot cleanly call the mentor
service without crossing this seam. **Decide the canonical home before building** — this
is a prerequisite, not a detail.

---

## Part 2 — Reachability Audits (per segment: Current / Target / Gap / Business Impact)

Legend — destination reality: **R** real · **P** partial · **S** stub. Orchestration:
**O** orchestrated · **n** reachable-but-not-orchestrated · **✗** absent.

### 2.1 Action Reachability
*Engine is REAL & library-backed for all segments (intervention + recommendation); the
universal gap is orchestration into product deep-links, not the action itself.*

| Segment | Current | Target | Gap | Business Impact |
|---------|---------|--------|-----|-----------------|
| School Student | R/n — actions generated post-session | Actions deep-link into LBI/mentor | Activation glue | High — drives the core B2C loop |
| College Student | R/n | Actions → Career Builder/Employability | Glue + a real employability product | High |
| Job Seeker | R/n | Actions → growth plan + jobs | Journey→M5 bridge | High |
| Parent | R/n (proxy, child actions) | Actions → mentor booking + family plan | Proxy activation | High |
| Exam Aspirant | R/n | Actions → exam study path | Exam product stub | Medium (product-blocked) |
| Institution | R/n (per-student) | Cohort-level action rollups | No cohort orchestration | High (B2B) |

### 2.2 Product Reachability
*LBI **R**, Mentoring **R**, Career Builder **P**, Employability Index **S**,
Competitive-Exam **S**+corpus_pending.*

| Segment | Current | Target | Gap | Business Impact |
|---------|---------|--------|-----|-----------------|
| School Student | R (LBI + mentor) | Decision deep-links to LBI/mentor | Activation only | High — strongest segment |
| College Student | P (Career Builder) | Real employability + persisted career plan | Employability product; persistence | High |
| Job Seeker | S→P (Employability Index stub; Career Builder partial) | Real employability index/score | Build/merge employability product | High (job-seeker intent) |
| Parent | R (consumes child LBI + mentor) | Parent hub deep-links | Proxy activation | High |
| Exam Aspirant | S (portal stub + corpus_pending) | Real exam product | Exam corpus + portal APIs | High (large market, blocked) |
| Institution | S (no institutional product) | Cohort dashboard/decisions | Institutional surface | Highest (B2B) |

### 2.3 Growth Plan Reachability
*M5 `growthPlan()` is **R** (persists, segment/persona-aware) but anchored to M-series
role/competency scores — not the CAPADEX concern-journey decision.*

| Segment | Current | Target | Gap | Business Impact |
|---------|---------|--------|-----|-----------------|
| School Student | R-ish (plan engine works but role-targeted, weak school fit) | Age-appropriate developmental plan from LBI/journey | Journey→M5 bridge + school-fit plan template | Medium-High |
| College Student | R (role/target-role fits well) | Plan seeded by CAPADEX journey + competency | Journey→M5 bridge | High |
| Job Seeker | R (best fit — role-targeted uplift) | Plan from employability outcome | Journey→M5 bridge | High — flagship value |
| Parent | P (proxy; plan is learner-oriented) | Parent-facing child growth plan | Proxy plan view | Medium-High |
| Exam Aspirant | P (no exam-specific roadmap) | Exam-prep growth plan | Exam corpus + plan template | Medium |
| Institution | R per-student (orgId-aware) | Cohort growth-plan rollups | Cohort aggregation | High (B2B) |

### 2.4 Subscription Reachability
*Billing CRUD + seeded segment-labelled packages are **R**; decision→package mapping is
**✗**; entitlement enforcement is partial/non-blocking (no general server-side gate; one
path logs an outcome but still allows the flow); live schema lacks B2B columns.*

| Segment | Current | Target | Gap | Business Impact |
|---------|---------|--------|-----|-----------------|
| School Student | R packages (FOUNDATION/PERFORMANCE/Micro) + `is_recommended` | Auto-recommend package from outcome | Decision→package mapping; entitlement | High — primary B2C revenue |
| College Student | P (READINESS package; segment label) | Recommend READINESS/EDGE from journey | Mapping + enforcement | High |
| Job Seeker | ✗ (no clear job-seeker package) | A job-seeker/employability package | New package + mapping | High (untapped) |
| Parent | R (parent/family purchase via `student_subscriptions` child link) | Outcome-driven family upsell | Mapping + enforcement | High |
| Exam Aspirant | R (ExamReadiness Index, EDGE — real packages) | Recommend from exam outcome | Mapping (product stub limits delivery) | High (packaged, ready to sell) |
| Institution | ✗ (live table lacks `institution_id`/`max_students`; enforcement non-functional) | Seat-based institutional plans + enforcement | Schema + enforcement + admin surface | **Highest** (B2B, currently non-functional) |

### 2.5 Mentor Reachability
*Mentoring is **R**: DB-backed, assessment-driven `/suggestions` (LBI domain-weakness →
`mentor_type`), full booking/messaging/notes lifecycle — but lives in `frontend/server`.*

| Segment | Current | Target | Gap | Business Impact |
|---------|---------|--------|-----|-----------------|
| School Student | R (matching off child LBI scores) | Match basis from unified decision | Decision-driven match; cross-server call | High — works today |
| College Student | R (generic match) | Career-mentor match from journey | Decision-driven match | High |
| Job Seeker | R | Industry/role mentor from outcome | Decision-driven match | High |
| Parent | R (books on child's behalf) | Proxy booking from child decision | Proxy flow polish | High |
| Exam Aspirant | R (mentor pool exists) | Exam-mentor match | Exam taxonomy in match | Medium-High |
| Institution | P (no cohort mentor allocation) | Bulk/cohort mentor assignment | Cohort orchestration | High (B2B) |

---

## Part 3 — Cross-cutting findings
- **Destinations are mostly real; the conductor is missing.** Action, Mentor, and Growth
  Plan are real; Product is half-real (LBI+Mentor real). The single biggest unlock is the
  **orchestrator + the journey→M5 bridge**, not building products from scratch.
- **Subscription is the true weak link** — no decision→package mapping, no enforcement,
  schema disconnect, and the **Institution** segment (highest revenue) is non-functional
  at the data layer.
- **Exam Aspirant inversion** — uniquely, the *packages* are ready but the *product* is a
  stub; don't sell into a corpus_pending experience.
- **Cross-server seam** is a real prerequisite: mentoring + rich subscription schema live
  in `frontend/server`; the chain + M5 in `backend/`.
