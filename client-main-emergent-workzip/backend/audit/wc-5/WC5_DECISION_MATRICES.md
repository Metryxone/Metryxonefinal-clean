# WC-5 Tracks C & D — Decision Matrices (Outputs #3 and #4)

Grounded in real layers; readiness is audited, not assumed. Legend:
**✅ Real** · **🟡 Partial** (works but degraded/stub destination/dormant) · **❌ Not reachable**.

---

## Track C — Stage Decision Matrix (Output #3)

**Stage source of truth (honest discrepancy):** backend canon is a **5-stage ladder**
(`wc3_stage_definitions`): Awareness→Curiosity→Clarity→Growth→Mastery. The frontend
`CAPADEX_STAGES` uses a **4-code set** (`CAP_CUR` Curiosity, `CAP_INS` Insight,
`CAP_GRW` Growth, `CAP_MAS` Mastery). The audit uses the backend canon (the one that
drives L1→L2→L3); the spec's example stages are mapped onto it below. **These two
taxonomies must be reconciled before stage-keyed decisions surface to users.**

| Stage | Can recommend Insight | Report | Action | Product | Subscription | Audited readiness |
|-------|:---:|:---:|:---:|:---:|:---:|-------------------|
| **Awareness** | ✅ stage+outcome derive a snapshot | 🟡 snapshot report exists in report engine; not stage-templated | ✅ library action | 🟡 routes (mostly to LBI/mentoring) | ❌ no stage→tier rule | **Partial** — can produce a snapshot; no stage-specific report template or commercial step |
| **Curiosity** | ✅ | 🟡 "curiosity report" not a distinct artifact | ✅ | 🟡 | ❌ | **Partial** |
| **Clarity** | ✅ strongest (clarity is the system's core) | 🟡 deep insight report engine exists (PIL 6C) but not stage-gated | ✅ | 🟡 Career Builder (PARTIAL) | ❌ | **Partial→Good** |
| **Growth** | ✅ | 🟡 | ✅ recommendation-builder = action plan | 🟡 Career Builder PARTIAL; no persistent plan | ❌ | **Partial** — action plan composes but doesn't persist as a Growth Plan |
| **Mastery** | ✅ | 🟡 | ✅ | ❌ coaching/mentoring is a **STUB** | ❌ | **Weak** — mastery routes to the weakest surface (mentoring stub) |

**Stage-matrix findings:**
- **Insight + Action are reachable at every stage** (L1+L2 and the Action layer are real).
- **Reports are not stage-templated** — a real report engine exists (PIL 6C, four
  stakeholder reports) but isn't keyed to the Awareness→Mastery ladder the way the spec
  envisions (Snapshot / Curiosity / Deep Insight / Action Plan / Coaching).
- **Product strengthens then collapses at Mastery** — the further along the ladder, the
  more the user needs coaching/mentoring, which is exactly the **stub** surface.
- **No stage drives a subscription** — the stage→tier commercial step is entirely absent.

---

## Track D — Context Decision Matrix (Output #4)

Context source = L5B taxonomy (`question-context-intelligence.ts`): 10 Tier-1 + 6
Tier-2. **Critical caveat:** L5B is an **offline sidecar not consumed at runtime**, so
every "context → decision" path below is **architecturally derivable but not live**
(🟡 at best until the context axis is wired into the loop).

| Context (Tier-1) | Report | Product | Growth Plan | Mentor | Subscription | Audited capability |
|------------------|:---:|:---:|:---:|:---:|:---:|-------------------|
| AI Job Disruption (`AI_FUTURE_OF_WORK`) | 🟡 | 🟡 employability/career (stub/partial) | ❌ | 🟡 stub | ❌ | **Partial** — strong narrative need, weak product/plan |
| Career Transition | 🟡 | 🟡 Career Builder PARTIAL | ❌ | 🟡 | ❌ | **Partial** |
| Placement Anxiety | 🟡 | 🟡 employability (stub) | ❌ | 🟡 | ❌ | **Partial** |
| Entrepreneurship | ❌ no dedicated context-to-product | ❌ no entrepreneurship surface | ❌ | 🟡 | ❌ | **Weak** — context exists, no product |
| Competitive Exams (`COMPETITIVE_EXAM_PRESSURE`) | 🟡 | ❌ Exam Portal STUB + corpus_pending | ❌ | 🟡 | ❌ | **Weak** |
| Family Pressure | 🟡 | ❌ Family Support STUB (→mentoring) | ❌ | 🟡 | ❌ | **Weak** |
| Leadership | 🟡 (relevance_risk HIGH lexicon) | ❌ | ❌ | 🟡 | ❌ | **Weak** + noisy lexicon |
| Digital Behaviour | 🟡 (relevance_risk MEDIUM) | 🟡 LBI adjacent | ❌ | 🟡 | ❌ | **Partial** |
| Employability | 🟡 | 🟡 Employability Index STUB | ❌ | 🟡 | ❌ | **Partial** |
| Career Clarity | ✅ (core competency) | 🟡 Career Builder PARTIAL | ❌ | 🟡 | ❌ | **Partial→Good** |

Tier-2 contexts (`FINANCIAL_PRESSURE`, `PEER_SOCIAL_COMPARISON`,
`RELOCATION_MIGRATION`, `IDENTITY_BELONGING`, `HIGHER_EDUCATION_CHOICE`,
`WORKPLACE_ADJUSTMENT`) are **detectable but have no dedicated product/plan/subscription
path** — they currently fold into the nearest Tier-1 route.

> **Growth Plan note:** ❌ in these matrices means "not reachable **from the CAPADEX
> decision chain**." A growth-plan service *does* exist in the M5 enterprise-workforce
> module (`m5_career_growth_plans` + AI-coach), but it is decoupled from the
> Concern→…→Journey flow; the recommendation is to wire M5's plan into the chain, not
> build new.

**Context-matrix findings:**
- **Common failure column = Growth Plan and Subscription** (❌ across the board) — these
  two links are missing **from the CAPADEX chain** system-wide, independent of context
  (M5's decoupled growth-plan notwithstanding).
- **Context is the most under-leveraged real asset** — a working 16-context taxonomy
  exists but is dormant; wiring it into routing/reporting would sharpen nearly every
  cell above without any new intelligence.
- **Entrepreneurship is the clearest whitespace** — recognized as a context (and in
  Track E as a future-readiness theme) but with **no product, plan, or route** behind it.
- **Lexicon honesty** — `LEADERSHIP` (HIGH) and `DIGITAL_BEHAVIOUR` (MEDIUM) carry
  `relevance_risk`; any context-driven decision on these must surface lower confidence.
