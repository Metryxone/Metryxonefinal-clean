# DC-2 — Revenue (#6) · Future Readiness (#7) · Segment Impact (#8) Matrices

Scores 1–5. Readiness columns are **grounded** in DC-1 real-vs-stub; impact/relevance columns
are **design estimates**. Lift figures are **directional planning hypotheses**, not forecasts.

---

## Output #6 — Revenue Opportunity Matrix

Ordered by revenue leverage. "Blocker" names the one thing standing between the decision and
revenue. Subscription-lift = directional estimate, **contingent on Wave-2 mapping existing**.

| ID | Revenue decision | Current State | Target State | Gap / Blocker | RI | Read | TD | Est. sub-lift* | Tier |
|----|------------------|---------------|--------------|---------------|----|------|----|----------------|------|
| 28 | Institutional plan | No B2B data layer | B2B contracts via decision | `institution_id`/`max_students` + mapping | 5 | 1.3 | High | **highest ceiling** (B2B seats) | T3 |
| 45 | Employability decision→pkg | Product stub + no map | Employability product + pkg rec | product + mapping | 5 | 1.7 | High | High | T3 |
| 24 | Recommend EDGE (premium) | Pkg real, no map | Premium upsell decision | **mapping only** | 5 | 2.0 | Med | High | T2 |
| 23 | Recommend READINESS | Pkg real, no map | Career-readiness upsell | **mapping only** | 5 | 2.0 | Med | High | T2 |
| 25 | ExamReadiness pkg | Pkg real, product stub | Seasonal exam upsell | product + mapping | 5 | 1.7 | High | High (seasonal) | T3 |
| 29 | Upsell at Growth stage | No upsell decision | Stage-triggered expansion | mapping + stage rule | 5 | 2.0 | Med | Med–High | T2 |
| 30 | Renewal / retention nudge | Validity tracked | Renewal decision | mapping + timing | 5 | 2.3 | Med | Med (retention) | T2 |
| 21 | Entry Micro Check | Pkg real, no map | Low-risk entry rec | **mapping only** | 5 | 2.3 | Med | Med (volume) | T2 |
| 22 | Annual Core | Pkg real, no map | Continuity rec | **mapping only** | 5 | 2.3 | Med | Med | T2 |
| 26 | Family plan | Pkg via subs | Family upsell | mapping | 5 | 2.0 | Med | Med (LTV) | T2 |
| 27 | Transition Check | No job-seeker pkg | New pkg + product | new pkg + product | 5 | 1.7 | High | Med (new segment) | T3 |
| 31 | Enforce entitlement | Partial/non-blocking | Decision-gated access | server-side gate | 5 | 1.5 | High | **stops leakage** (protects all) | T2 |
| 43 | Exam readiness path | Product stub | Real exam product | product + corpus | 5 | 2.0 | High | Med (seasonal) | T3 |

`*` Directional only. **No subscription-lift can be realized until the decision→subscription
mapping (Wave 2) exists** — today every cell above is `✗ design`. The mapping is one build that
simultaneously raises readiness for the entire `21–31` block.

**Revenue findings:**
1. **One orchestration build (decision→subscription mapping) is the master revenue key** — it
   converts 8 Tier-2 commercial decisions from design-only to live with no new product.
2. **The highest-ceiling decision (institutional, #28) is Tier 3** and gated on a B2B data
   layer that does not exist — the biggest revenue bet is also the biggest build.
3. **Entitlement enforcement (#31) is revenue *protection*, not generation** — without it,
   gated reports/products leak; pair it with the mapping build.

---

## Output #7 — Future Readiness Matrix

Columns: **AI-Era Relevance (AI)** · **Future Workforce Relevance (FW)** · **Employability
Impact (EI)** · **Entrepreneurship Impact (En)** · **Long-Term Strategic Value (LT)**. Listed
for the future-facing decisions (others are operationally important but FR-neutral).

| ID | Decision | AI | FW | EI | En | LT | Notes |
|----|----------|----|----|----|----|----|-------|
| 45 | Employability decision | 5 | 5 | 5 | 3 | 5 | the single most future-defining decision (currently stub) |
| 37 | AI-disruption reskilling | 5 | 5 | 5 | 3 | 5 | the literal AI-era decision; blocked by context axis |
| 27 | Transition Check | 4 | 5 | 5 | 3 | 5 | career mobility = future-workforce core |
| 14 | Employability Index route | 4 | 5 | 5 | 3 | 4 | product stub blocks a high-FR path |
| 12 | Reskilling / transition plan | 4 | 5 | 4 | 3 | 5 | highest-FR decision that is *buildable now* (T2) |
| 38 | Entrepreneurship venture-readiness | 3 | 4 | 3 | 5 | 4 | only strong-entrepreneurship decision; context-blocked |
| 41 | Career-clarity decision | 4 | 4 | 4 | 3 | 5 | durable core value; buildable now (T2) |
| 43 | Competitive-exam path | 3 | 3 | 4 | 2 | 4 | high revenue, moderate future-relevance |
| 40 | Leadership-development | 3 | 4 | 3 | 4 | 4 | LBI-backed; context-blocked |
| 5 | Route to LBI | 3 | 4 | 4 | 3 | 4 | behaviour skills = durable; **buildable now (T1)** |
| 9 | OMEGA report | 3 | 3 | 3 | 2 | 4 | depth/intelligence moat |
| 28 | Institutional plan | 3 | 4 | 4 | 2 | 5 | B2B = long-term strategic, build-heavy |

**Future-readiness findings:**
1. **The future-relevant decisions (FR/AI/FW=5) are concentrated in Tier 3** — employability,
   AI-disruption, transition. The platform's *future* is gated by the context axis + product
   completion. This is the strategic case for funding Wave 3 despite low near-term readiness.
2. **Two future-relevant decisions are buildable now** — Reskilling/transition plan (#12, T2)
   and Career-clarity (#41, T2) — these are the "future-proof + buildable" sweet spot; fund early.
3. **LBI (#5) is the only high-durability decision that is also Tier 1** — a rare
   future-relevant quick win.

---

## Output #8 — Segment Impact Matrix

Per segment: count of decisions where the segment is a primary target, the **best-ready**
decision available today, the **highest-impact blocked** decision, and an overall **activation
readiness** verdict (grounded in which surfaces serve that segment).

| Segment | Primary decisions | Best-ready today (Tier 1/2) | Highest-impact blocked | Readiness |
|---------|-------------------|-----------------------------|------------------------|-----------|
| School Student | many (B2C core) | LBI route, base report, mentor, strength | Annual Core upsell (mapping) | **Good** |
| College Student | many (B2C core) | base report, OMEGA, career-clarity, mentor | Employability decision (T3) | **Good** |
| Job Seeker | transition-heavy | reskilling/transition plan (T2) | Employability + Transition pkg (T3) | **Moderate** |
| Competitive Exam Aspirant | exam-centric | mentor; base report | Exam product + pkg (T3, inversion) | **Moderate** |
| Parent | proxy + family | Parent report, family mentor | Family plan upsell (mapping) | **Good** |
| Teacher | referral/view | refer student (T2) | class-level report (T3, no surface) | **Low** |
| Counselor | triage/risk | Counselor risk report (T1), caseload (T2) | (mostly served) | **Moderate** |
| Institution | cohort/B2B | cohort risk report (T1) | institutional plan + mentor alloc (T3) | **Low** |

**Segment findings:**
1. **B2C core (School/College/Parent) is activation-ready** — real surfaces serve them; their
   gap is purely **commercial mapping**, not capability.
2. **Job Seeker & Exam Aspirant are revenue-rich but product-blocked** — Employability/Exam
   stubs cap them; Exam shows the DC-1 inversion (package real, product stub).
3. **Teacher & Institution are the weakest** — they lack first-class surfaces; Institution is
   simultaneously the **highest-revenue** segment (B2B) and the **least ready** (no data layer).
   This is the clearest strategic build-vs-reward decision for leadership.
