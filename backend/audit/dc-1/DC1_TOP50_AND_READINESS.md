# DC-1 — Top 50 Decisions (#7) · Coverage Gaps (#8) · Readiness Report (#9)

---

## Output #7 — Top 50 Decisions CAPADEX Must Support

Each decision: **Class** (D1–D7, see Taxonomy) · **Trigger** · **Segment** · **Business
Value (B)** · **User Value (U)** · **Revenue Impact (Rev)** · **Confidence Required (Conf)**.
Deliverability tag: **R** deliverable now · **P** partial · **✗** design-only (blocked).
Conf bands: Low / Med / High / Safety-override.

### Tier 1 — Foundational decisions (deliverable now or near-now)

| # | Decision | Class | Trigger | Segment | B | U | Rev | Conf | Now |
|---|----------|-------|---------|---------|---|---|-----|------|-----|
| 1 | Run baseline assessment | D1 | New session, no prior data | All | Funnel entry | Self-insight | Top-of-funnel | Low | R |
| 2 | Surface CAPADEX base report | D2 | Session complete | All | Activation | Clarity | Conversion driver | Low | R |
| 3 | Recommend a mentor | D5 | Concern + weakness map | School/College/Job/Parent | Engagement | Human help | Mentor GMV | Med | R |
| 4 | Trigger deep-dive assessment | D1 | Low-confidence outcome | All | Data quality | Accuracy | Retention | Low | R |
| 5 | Route to LBI | D3 | Behaviour concern (attention/motivation/anger) | School/College | Product use | Skill growth | Annual pkg pull | Med | R |
| 6 | Generate Counselor risk report | D2 | Elevated concern severity | Counselor/Parent | Trust/safety | Early help | B2B/B2C | Med | R |
| 7 | Generate Parent guidance report | D2 | Minor's session | Parent | Activation | Reassurance | Family pkg pull | Med | R |
| 8 | Re-assess after interval | D1 | Time since last + active plan | All | Longitudinal lock-in | Progress | Renewal | Low | R |
| 9 | Surface OMEGA intelligence report | D2 | Growth/Mastery stage | College/Job/Inst | Premium signal | Depth | Premium pull | Med | R |
| 10 | Crisis escalation | D7 | Acute distress markers | All | Safety/liability | Protection | Trust | Safety-override | P |

### Tier 2 — Growth-plan & product decisions (bridge/stub-blocked)

| # | Decision | Class | Trigger | Segment | B | U | Rev | Conf | Now |
|---|----------|-------|---------|---------|---|---|-----|------|-----|
| 11 | Initiate growth plan | D4 | Clarity+ stage, outcome known | College/Job | Lock-in | Roadmap | Renewal | Med | P |
| 12 | Reskilling/transition plan | D4 | Career-transition outcome | Job Seeker | Differentiator | Direction | Premium pull | Med | P |
| 13 | Route to Career Builder | D3 | career_clarity/decision_quality | College/Job | Product use | Planning | READINESS pull | Med | P |
| 14 | Route to Employability Index | D3 | employability_readiness | College/Job | Product use | Job-readiness | EDGE pull | Med | ✗(stub) |
| 15 | Escalate plan horizon | D4 | Growth stage, plan active | College/Job/Inst | Engagement | Stretch | Renewal | Med | P |
| 16 | Confidence-building plan | D4 | confidence_stability low | School/College | Wellbeing | Confidence | Annual | Med | P |
| 17 | Habit/focus plan | D4 | procrastination/attention | School/College | Engagement | Habits | Micro/Annual | Med | P |
| 18 | Family-wellbeing plan | D4 | family_wellbeing concern | Parent | Retention | Harmony | Family pkg | Med | P |
| 19 | Digital-balance plan | D4 | screen_addiction | School/Parent | Engagement | Balance | Annual | Med | P |
| 20 | Cohort growth-plan rollup | D4 | Institution dashboard | Institution | B2B value | Oversight | B2B seats | Med | P |

### Tier 3 — Commercial decisions (mapping-blocked, highest revenue)

| # | Decision | Class | Trigger | Segment | B | U | Rev | Conf | Now |
|---|----------|-------|---------|---------|---|---|-----|------|-----|
| 21 | Recommend entry Micro Check | D6 | Awareness stage, no pkg | School/Parent | Conversion | Low-risk start | Entry rev | High | ✗ |
| 22 | Recommend Annual Core (FOUNDATION/PERFORMANCE) | D6 | Engaged School student | School/Parent | ARPU | Continuity | Annual rev | High | ✗ |
| 23 | Recommend READINESS | D6 | College career outcome | College | ARPU | Job-readiness | Annual rev | High | ✗ |
| 24 | Recommend EDGE (premium) | D6 | High-intent + employability/exam | College/Job/Aspirant | Margin | Edge | Premium rev | High | ✗ |
| 25 | Recommend ExamReadiness pkg | D6 | Exam outcome/context | Exam Aspirant | Seasonal rev | Exam prep | Seasonal spike | High | ✗ |
| 26 | Recommend Family plan | D6 | Parent w/ minor | Parent | LTV | Whole-family | Family rev | High | ✗ |
| 27 | Recommend Transition Check | D6 | Post-exam/job transition | Job Seeker | New segment | Next step | Untapped rev | High | ✗ |
| 28 | Recommend institutional plan | D6 | Institution onboarding | Institution | B2B contract | Cohort value | **Highest rev** | High | ✗(data layer) |
| 29 | Upsell at Growth stage | D6 | Stage=Growth + free tier | All B2C | Expansion | More depth | Expansion rev | High | ✗ |
| 30 | Renewal/retention nudge | D6 | Validity nearing end | All paid | Retention | Continuity | Renewal rev | Med | ✗ |
| 31 | Enforce entitlement (gate) | D6/D7 | Access without package | All paid | Revenue protection | Fairness | Leakage stop | High | ✗ |

### Tier 4 — Segment-completion & context decisions (axis/role-blocked)

| # | Decision | Class | Trigger | Segment | B | U | Rev | Conf | Now |
|---|----------|-------|---------|---------|---|---|-----|------|-----|
| 32 | Teacher: refer student to support | D5 | Teacher views flagged student | Teacher | B2B stickiness | Early help | B2B | Med | P |
| 33 | Teacher: class-level insight report | D2 | Teacher dashboard | Teacher | B2B value | Oversight | B2B | Med | ✗(no surface) |
| 34 | Counselor: prioritize caseload | D2 | Multiple sessions, risk rank | Counselor | B2B value | Triage | B2B | Med | P |
| 35 | Institution: cohort risk report | D2 | Cohort threshold | Institution | B2B value | Oversight | B2B seats | Med | R(PIL inst) |
| 36 | Institution: cohort mentor allocation | D5 | Cohort needs mapped | Institution | B2B value | Scale help | B2B | Med | ✗ |
| 37 | AI-disruption reskilling decision | D3/D4 | Context=AI Job Disruption | College/Job | Differentiator | Future-proof | Premium | Med | ✗(context axis) |
| 38 | Entrepreneurship venture-readiness | D3/D4 | Context=Entrepreneurship | College/Job | Niche | Direction | Premium | Med | ✗(context axis) |
| 39 | Placement-anxiety intervention | D5/D4 | Context=Placement Anxiety | College/Job | Outcomes | Relief | READINESS | Med | ✗(context axis) |
| 40 | Leadership-development route | D3/D4 | Context=Leadership | College/Inst | Premium | Growth | Premium | Med | ✗(context axis) |
| 41 | Career-clarity decision | D3/D4 | Context/outcome=Career Clarity | College/Job | Core value | Direction | READINESS | Med | P |
| 42 | Family-pressure mediation | D5/D7 | Context=Family Pressure | Parent/School | Retention | Harmony | Family | Med | ✗(context axis) |
| 43 | Competitive-exam readiness path | D3 | Context=Competitive Exams | Exam Aspirant | Seasonal | Prep | Seasonal | Med | ✗(product stub) |
| 44 | Digital-behaviour decision | D3/D4 | Context=Digital Behaviour | School/Parent | Engagement | Balance | Annual | Med | P |
| 45 | Employability decision | D3/D6 | Context=Employability | College/Job | Conversion | Job-ready | READINESS/EDGE | Med | ✗(product stub) |

### Tier 5 — Intelligence & governance decisions

| # | Decision | Class | Trigger | Segment | B | U | Rev | Conf | Now |
|---|----------|-------|---------|---------|---|---|-----|------|-----|
| 46 | Defer decision (low confidence) | D7 | Observed conf < required | All | Trust/honesty | No false steers | Trust | Safety-override | P |
| 47 | Resolve ambiguous journey | D3 | Multiple journeys tie | All | Accuracy | Right path | Conversion | Med | P |
| 48 | Strength-affirmation decision | D2/D4 | Positive CSI factors | School/College | Engagement | Confidence | Retention | Low | R |
| 49 | Longitudinal-progress decision | D2/D4 | Re-assessment delta | All paid | Lock-in | Visible progress | Renewal | Med | R(OMEGA) |
| 50 | Stakeholder-report fan-out | D2 | Session complete, multi-stakeholder | School/Parent/Counselor/Inst | Multi-sided value | Right view per role | B2B+B2C | Med | R(PIL gated) |

**Top-50 distribution (honest):** deliverable-now **R ≈ 12** · partial **P ≈ 15** ·
design-only **✗ ≈ 23**. The ✗ bucket is dominated by **commercial (Tier 3)** and
**context-axis (Tier 4)** decisions — exactly the two structural gaps.

---

## Output #8 — Decision Coverage Gaps

| Gap | What's missing | Decisions blocked | Severity |
|-----|----------------|-------------------|----------|
| **No Decision object** | No explicit, confidence-gated, segment-aware decision is ever formed | All 50 (formation) | **Critical** |
| **No decision→subscription mapping** | Nothing maps outcome/segment → package | #21–31 (commercial) | **Critical (revenue)** |
| **Context not a decision axis** | Sidecar `wc3_question_context` exists but is not wired into the decision chain; ~80% questions context-free | #37–45 (context) | High |
| **journey→M5 bridge missing** | M5 reads M-series scores, not the decision | #11–20 (growth plans) | High |
| **Product stubs** | Employability Index / Competitive-Exam stub | #14, 43, 45 | High |
| **Entitlement partial** | No general server-side gate | #31 + revenue leakage | High |
| **Institution data layer** | No `institution_id`/`max_students` | #28, 36 | High (B2B) |
| **Teacher/Counselor surfaces** | Mostly referral/view; no first-class product | #32–34 | Medium |
| **Stage taxonomy split** | BE 5-stage vs FE CAP_* | stage-keyed decisions (#5,9,21,29) | Medium |
| **Crisis path not unified** | Escalation lives in Pragati, not the decision gate | #10, 42, 46 | Medium (safety) |
| **Confidence not centralized** | L2 conf + hypothesis governance not fused into a decision gate | #46 + all gating | Medium |
| **Cross-server seam** | Mentor + rich sub schema in `frontend/server` | #3, 36 + commercial | Medium |

---

## Output #9 — Decision Intelligence Readiness Report

### 9.1 Readiness by decision class
| Class | Formation | Delivery | Verdict |
|-------|-----------|----------|---------|
| D1 Diagnostic | ✓ | ✓ | **Ready** |
| D2 Report | ✓ | ✓ (some gated/UI-stub) | **Ready** |
| D3 Routing/Product | partial (routes exist) | partial (stubs) | **Partial** |
| D4 Developmental | partial | partial (bridge gap) | **Partial** |
| D5 Human-support | ✓ | ✓ (cross-server, decision-driven match pending) | **Mostly ready** |
| D6 Commercial | ✗ | ✗ | **Not ready** |
| D7 Safety/Governance | partial (Pragati) | partial | **Partial** |

### 9.2 Readiness by segment
| Segment | Decision readiness | Note |
|---------|-------------------|------|
| School Student | **Good** | LBI+mentor+reports real; needs commercial mapping |
| College Student | **Good** | + growth plan fit; employability stub limits one path |
| Job Seeker | **Moderate** | M5 plan strong; employability/exam stubs + no job-seeker pkg |
| Parent | **Good** | proxy reports + family mentor real; family commercial design-only |
| Teacher | **Low** | referral/view only; no first-class surface |
| Counselor | **Moderate** | PIL Counselor report real; caseload triage partial |
| Institution | **Low** | PIL cohort report real, but product + B2B data layer missing |
| Exam Aspirant | **Moderate** | mentor real + package real, but product stub (inversion) |

### 9.3 Overall verdict
**Decision Intelligence Readiness ≈ 5–6 / 10.** CAPADEX can already *form and deliver*
diagnostic, report, mentor, and strength/longitudinal decisions for its core B2C segments —
a real, defensible base. It **cannot** yet form an **explicit confidence-gated decision
object**, make any **commercial decision**, or fire **context-aware** decisions. The three
unlocks, in order:
1. **Decision object + confidence gate** (WC-6's orchestrator) — turns 50 latent decisions
   into real ones; prerequisite for everything.
2. **Commercial: decision→subscription mapping + entitlement** — converts the largest ✗
   bucket (Tier 3) into revenue.
3. **Context axis + journey→M5 bridge + product completion** — unlocks Tier 4 + growth plans.

### 9.4 Build discipline (for the future approved phase)
Additive · compose-only · flag-gated default OFF · byte-identical when OFF ·
**confidence-gated** · **never fabricate** (low confidence → defer #46, never invent a
decision) · **safety overrides confidence** (D7 escalation never suppressed). No tuning a
destination to fake readiness; a stub stays an honest `ready:false`.
