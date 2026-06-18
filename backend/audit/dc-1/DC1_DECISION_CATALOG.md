# DC-1 — Decision Catalog (#1) + Decision Taxonomy (#2)

Surface-status legend: **R** real · **P** partial · **S** stub · **✗** absent.
Every recommendation cell is tagged with its real surface status (grounded — see
`DC1_README.md`). A decision is never fabricated: low confidence → defer/hedge.

---

## Output #2 — Decision Taxonomy (defined first, since the Catalog uses it)

A **Decision** = `{ class, trigger, segment, activation, confidence_required }`. Seven
classes span everything CAPADEX must decide:

| Class | Decides… | Activates (surface) | Min confidence | Delivery today |
|-------|----------|--------------------|----------------|----------------|
| **D1 Diagnostic** | what/whether to assess next | assessment, re-assess interval | Low | **R** |
| **D2 Report** | which report to surface/generate | CAPADEX/OMEGA/PIL reports | Low–Med | **R** (some gated) |
| **D3 Routing/Product** | which product to activate | LBI/CB/Empl/Exam/Mentor | Med | **P** (stubs) |
| **D4 Developmental** | growth-plan action | M5 growth plan | Med | **P** (bridge gap) |
| **D5 Human-support** | mentor/counselor/escalation | mentor match, escalation | Med (High for escalation) | **R/P** |
| **D6 Commercial** | which subscription to recommend | packages | **High** | **✗** (no mapping) |
| **D7 Safety/Governance** | crisis-escalate or defer | crisis path; "defer/low-confidence" | overrides (safety-first) | **P** |

**Confidence model (grounded in L2 + hypothesis engine):** every decision carries a
`confidence_required` band. L2 outcome confidence + the hypothesis-governance classifier
supply the observed confidence; if observed < required, the decision **degrades** (D6→show
options not auto-recommend; D5 escalation→never suppress on low confidence — safety wins).
**Confidence requirement rises with irreversibility and cost:** D1/D2 low, D3/D4/D5 medium,
**D6 high**, D7 safety-overrides.

**Trigger grammar:** `trigger = f(Concern, Stage, Context, Outcome, Journey, Segment)`. Any
trigger that includes a **Context** is presently **design-only** (a context sidecar
`wc3_question_context` exists but is not wired into the decision chain — see README).

---

## Output #1 — Decision Catalog

The Catalog audits decisions per dimension. For each anchor: **Possible Decisions** (by
class) + recommended **Reports / Products / Growth Plans / Mentors / Subscriptions** (tagged
with real status).

### 1A — By CONCERN (12)
*Recommended report defaults to CAPADEX base **R** + Counselor/Parent PIL **R(gated)**;
mentor match is **R**; subscription is **✗ (design)** everywhere until mapping exists.*

| Concern | Possible Decisions (class) | Reports | Products | Growth Plan | Mentor | Subscription |
|---------|---------------------------|---------|----------|-------------|--------|--------------|
| exam_stress | D1 deep-dive · D2 Counselor report · D3 exam route · D7 if acute | CAPADEX **R**, ExamReadiness **P** | Exam **S** | exam plan **P** | performance/stress mentor **R** | ExamReadiness pkg **✗(design)** |
| burnout (work stress) | D1 · D2 Counselor · D4 recovery plan · D7 | CAPADEX **R**, OMEGA **R** | CB **P**, Mentor **R** | recovery plan **P** | wellbeing mentor **R** | Premium **✗(design)** |
| attention | D1 · D3 LBI · D4 focus plan | CAPADEX **R** | LBI **R** | focus plan **P** | focus coach **R** | Micro/Annual **✗(design)** |
| social_anxiety | D1 · D2 Parent/Counselor · D5 mentor · D7 | CAPADEX **R**, PIL **R** | LBI **R**, Mentor **R** | confidence plan **P** | confidence mentor **R** | Annual **✗(design)** |
| career_stagnation | D3 CB/Empl · D4 growth plan · D6 upsell | CAPADEX **R**, OMEGA **R** | CB **P**, Empl **S** | career plan **R** | career mentor **R** | READINESS/EDGE **✗(design)** |
| anger (impulse) | D1 · D2 Counselor · D5 · D7 | CAPADEX **R**, PIL **R** | LBI **R**, Mentor **R** | regulation plan **P** | behaviour coach **R** | Annual **✗(design)** |
| motivation | D1 · D4 plan · D3 LBI | CAPADEX **R** | LBI **R** | motivation plan **P** | mentor **R** | Micro/Annual **✗(design)** |
| relationship/family | D2 Parent · D3 family_support→mentor · D5 | CAPADEX **R**, PIL Parent **R** | Mentor **R** (family path) | family plan **P** | family mentor **R** | Family pkg **✗(design)** |
| self_esteem | D1 · D2 · D4 · D5 | CAPADEX **R**, PIL **R** | LBI **R**, Mentor **R** | confidence plan **P** | confidence mentor **R** | Annual **✗(design)** |
| procrastination | D1 · D4 habit plan · D3 LBI | CAPADEX **R** | LBI **R** | habit plan **P** | productivity coach **R** | Micro **✗(design)** |
| sleep | D1 · D2 · D4 routine plan | CAPADEX **R** | LBI **R** | routine plan **P** | wellbeing mentor **R** | Micro **✗(design)** |
| screen_addiction (digital) | D1 · D2 Parent · D4 digital plan · D7 | CAPADEX **R**, PIL Parent **R** | LBI **R** | digital-balance plan **P** | digital-behaviour coach **R** | Annual **✗(design)** |

### 1B — By STAGE (5)
*Stage governs decision aggressiveness: early stages → diagnostic/report; later → product/plan/commercial.*

| Stage | Possible Decisions | Reports | Products | Growth Plan | Mentor | Subscription |
|-------|-------------------|---------|----------|-------------|--------|--------------|
| Awareness | D1 assess · D2 base report only | CAPADEX **R** | (none yet) | — | soft suggest **R** | Micro entry **✗(design)** |
| Curiosity | D1 deeper · D3 LBI · D2 Parent | CAPADEX **R**, PIL **R** | LBI **R** | seed plan **P** | suggest **R** | Micro/Annual **✗(design)** |
| Clarity | D3 product route · D4 plan · D2 Counselor | CAPADEX **R**, OMEGA **R** | LBI **R**, CB **P** | plan **P/R** | match **R** | Annual **✗(design)** |
| Growth | D4 escalate plan · D6 upsell · D5 mentor | OMEGA **R**, PIL **R** | CB **P**, Mentor **R** | active plan **R** | match **R** | Premium/EDGE **✗(design)** |
| Mastery | D4 stretch plan · D6 retain/renew · D5 peer-mentor | OMEGA **R** | CB **P**, Mentor **R** | stretch plan **R** | peer/expert **R** | renew/Premium **✗(design)** |

### 1C — By CONTEXT (10) — ⚠️ context axis ABSENT; all rows are DESIGN targets
*Until the context axis is built/inferred, these decisions cannot fire. Listed so the
catalog is complete and the dependency is explicit.*

| Context | Possible Decisions (design) | Reports | Products | Growth Plan | Mentor | Subscription |
|---------|----------------------------|---------|----------|-------------|--------|--------------|
| AI Job Disruption | D3 Empl · D4 reskfor plan · D6 | OMEGA **R** | Empl **S**, CB **P** | resk_plan **P** | industry mentor **R** | EDGE **✗** |
| Employability | D3 Empl · D4 plan · D6 | PIL **R** | Empl **S** | employ plan **P** | career mentor **R** | READINESS **✗** |
| Entrepreneurship | D3 CB · D4 venture plan · D5 | OMEGA **R** | CB **P** | venture plan **P** | founder mentor **R** | Premium **✗** |
| Career Transition | D3 CB/Empl · D4 transition plan · D6 | OMEGA **R** | CB **P** | transition plan **R** | transition mentor **R** | READINESS **✗** |
| Competitive Exams | D3 Exam · D2 ExamReadiness · D6 | ExamReadiness **P** | Exam **S** | exam plan **P** | exam mentor **R** | ExamReadiness/EDGE **✗** |
| Family Pressure | D2 Parent · D3 family_support · D5 · D7 | PIL Parent **R** | Mentor **R** | family plan **P** | family mentor **R** | Family **✗** |
| Placement Anxiety | D2 Counselor · D3 Empl · D5 · D7 | PIL Counselor **R** | Empl **S**, Mentor **R** | placement plan **P** | placement mentor **R** | READINESS **✗** |
| Leadership | D3 LBI · D4 leadership plan · D6 | LBI report **R(BE)/S(UI)** | LBI **R** | leadership plan **P** | leadership mentor **R** | Premium **✗** |
| Digital Behaviour | D1 · D2 Parent · D4 digital plan | PIL Parent **R** | LBI **R** | digital plan **P** | digital coach **R** | Annual **✗** |
| Career Clarity | D3 CB · D4 clarity plan · D2 | CAPADEX **R**, OMEGA **R** | CB **P** | clarity plan **R** | career mentor **R** | READINESS **✗** |

### 1D — By OUTCOME (7)
*Outcome model = the natural decision anchor (closest to a "decision" today). exam_readiness gated.*

| Outcome | Possible Decisions | Reports | Products | Growth Plan | Mentor | Subscription |
|---------|-------------------|---------|----------|-------------|--------|--------------|
| career_clarity | D3 CB · D4 clarity plan · D6 | OMEGA **R**, CAPADEX **R** | CB **P** | clarity plan **R** | career mentor **R** | READINESS **✗** |
| learning_effectiveness | D1 · D3 LBI · D4 learning plan | CAPADEX **R** | LBI **R** | learning plan **P** | learning coach **R** | Annual **✗** |
| employability_readiness | D3 Empl · D4 employ plan · D6 | PIL **R** | Empl **S** | employ plan **P** | career mentor **R** | READINESS/EDGE **✗** |
| exam_readiness (**gated**) | D3 Exam · D2 ExamReadiness · D6 | ExamReadiness **P** | Exam **S** | exam plan **P** | exam mentor **R** | ExamReadiness **✗** |
| confidence_stability | D4 confidence plan · D5 · D7 | PIL **R** | LBI **R**, Mentor **R** | confidence plan **P** | confidence mentor **R** | Annual **✗** |
| decision_quality | D1 · D4 plan · D3 CB | OMEGA **R** | CB **P** | decision plan **P** | mentor **R** | Premium **✗** |
| family_wellbeing | D2 Parent · D3 family_support · D5 · D7 | PIL Parent **R** | Mentor **R** | family plan **P** | family mentor **R** | Family **✗** |

### 1E — By JOURNEY (6)
*Journey already routes; the Decision adds confidence + report + plan + commercial around the route.*

| Journey route | Possible Decisions | Reports | Products | Growth Plan | Mentor | Subscription |
|---------------|-------------------|---------|----------|-------------|--------|--------------|
| lbi (`/lbi`) | D3 activate LBI · D2 · D4 | CAPADEX **R**, LBI **R(BE)** | LBI **R** | plan **P** | coach **R** | Annual **✗** |
| career_builder (`/career-builder`) | D3 · D4 career plan · D6 | OMEGA **R** | CB **P** | plan **R** | career mentor **R** | READINESS **✗** |
| employability_index (`/employability-index`) | D3 · D4 · D6 | PIL **R** | Empl **S** (⚠️ route ready, product stub) | employ plan **P** | career mentor **R** | READINESS/EDGE **✗** |
| competitive_exam (`/exam-intelligence`) | D2 ExamReadiness · D6 (defer product) | ExamReadiness **P** | Exam **S**+corpus_pending | exam plan **P** | exam mentor **R** | ExamReadiness/EDGE **✗** |
| mentoring (`/mentors`, fallback) | D5 mentor match · D2 | CAPADEX **R** | Mentor **R** | — | match **R** | per segment **✗** |
| family_support (`/mentors`) | D5 · D2 Parent · D7 | PIL Parent **R** | Mentor **R** | family plan **P** | family mentor **R** | Family **✗** |

---

## Catalog-wide findings
- **The report dimension is the strongest** — almost every decision can attach a real
  report (CAPADEX base/OMEGA/PIL). Two caveats: PIL/OMEGA are flag-gated, and the LBI/SDI/
  Competency reports are backend-real but UI-stubbed in the unified console.
- **The subscription column is empty everywhere (`✗ design`)** — no decision→package mapping
  exists. This is the single most consistent gap and the biggest commercial opportunity.
- **Context-triggered decisions (1C) are entirely design-stage** — the context axis must be
  built/inferred first; do not promise context-aware decisions until then.
- **Outcome (1D) is the best decision anchor today** — it is the most decision-shaped layer
  that already exists; the Decision layer should hang primarily off Outcome × Segment, with
  Concern/Stage as modifiers and Context as a future enrichment.
