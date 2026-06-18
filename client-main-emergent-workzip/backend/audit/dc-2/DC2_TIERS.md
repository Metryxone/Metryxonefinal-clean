# DC-2 — Tier Inventories (#2 Tier 1 · #3 Tier 2 · #4 Tier 3)

Tier = **asset requirement** (not score). Each row: **Current State · Target State · Gap ·
User Impact (UI) · Business Impact (BI) · Revenue Impact (RI) · Technical Difficulty (TD) ·
Priority**. UI/BI/RI are 1–5 estimates; TD: Low/Med/High (grounded in DC-1 gap size);
Priority = Priority-Index band (High ≥15 · Med 10–14 · Low <10).

---

## Output #2 — Tier 1 Decision Inventory (activate immediately, existing assets)

All required surfaces are R/gated-R; only the **decision wrapper** (form the explicit,
confidence-gated decision object) is missing. **TD = Low across Tier 1 — with one explicit
exception: #10 Crisis escalation (`✷`)**, which is a **safety-override inclusion** (DC-1 status
P, TD = Med). It does not meet the strict "all surfaces R" Tier-1 criterion and is listed here
by safety policy only, not because it is an existing-asset quick win.

| ID | Decision | Current State | Target State | Gap | UI | BI | RI | TD | Priority |
|----|----------|---------------|--------------|-----|----|----|----|----|----------|
| 1 | Run baseline assessment | Assessment runs; no decision recorded | Decision: "assess now" emitted + logged | decision object | 5 | 4 | 3 | Low | High |
| 2 | CAPADEX base report | Core report served (`/report/:session_id`, ungated) | Decision: "surface base report" + provenance | wrapper only | 5 | 4 | 4 | Low | High |
| 3 | Recommend a mentor | `/suggestions` matches off assessment | Decision-driven match (concern→mentor type) | match basis + cross-server seam | 5 | 4 | 4 | Low | High |
| 4 | Trigger deep-dive | Re-prompt logic exists | Decision: "deepen on low confidence" | confidence gate | 4 | 3 | 3 | Low | High |
| 5 | Route to LBI | LBI product real | Decision: "activate LBI" on behaviour concern | wrapper only | 4 | 4 | 4 | Low | High |
| 6 | Counselor risk report | PIL Counselor report real (gated) | Decision: emit on severity threshold | flag-on + wrapper | 5 | 5 | 4 | Low | High |
| 7 | Parent guidance report | PIL Parent report real (gated) | Decision: emit for minors | flag-on + wrapper | 5 | 4 | 4 | Low | High |
| 8 | Re-assess after interval | No scheduler decision | Decision: "re-assess" on interval+active plan | timing rule | 4 | 4 | 4 | Low | High |
| 9 | Surface OMEGA report | OMEGA real (ungated route) | Decision: "surface OMEGA" at Growth/Mastery | wrapper only | 4 | 4 | 4 | Low | High |
| 10 | Crisis escalation ⚠️ | Crisis path in Pragati | Unify into decision gate (safety-override) | unify, not build | 5 | 5 | 2 | Med | **Safety-first** |
| 35 | Institution cohort risk report | PIL Institution report real (gated) | Decision: emit on cohort threshold | flag-on + wrapper | 4 | 5 | 4 | Low | High |
| 48 | Strength-affirmation | CSI positive_factors exist | Decision: affirm strength (canon-safe) | wrapper only | 4 | 3 | 3 | Low | Med |
| 49 | Longitudinal-progress | OMEGA longitudinal memory real | Decision: surface delta on re-assessment | wrapper only | 4 | 4 | 4 | Low | High |
| 50 | Stakeholder-report fan-out | PIL ×4 reports real (gated) | Decision: route right report per role | flag-on + wrapper | 5 | 5 | 4 | Low | High |

**Tier 1 takeaway:** 14 decisions, all Low difficulty. Shipping these = the **decision object
+ confidence gate** infrastructure, lit up over already-real surfaces. This wave produces the
**first decision-conversion telemetry**, without which every Tier 2/3 revenue number is a guess.

---

## Output #3 — Tier 2 Decision Inventory (orchestration, no new products)

Surfaces exist but need **glue**: journey→M5 bridge, decision→subscription mapping +
entitlement, confidence centralization, teacher/counselor orchestration. **No new product.**

| ID | Decision | Current State | Target State | Gap | UI | BI | RI | TD | Priority |
|----|----------|---------------|--------------|-----|----|----|----|----|----------|
| 11 | Initiate growth plan | M5 real, anchored to M-series | Seed M5 from the CAPADEX decision | journey→M5 bridge | 5 | 4 | 4 | Med | Med |
| 12 | Reskilling / transition plan | M5 role-target real | Decision: transition plan from outcome | bridge + role mapping | 5 | 4 | 4 | Med | Med |
| 13 | Route to Career Builder | CB partial | Decision: "activate CB" on clarity | wrapper + CB hardening | 4 | 4 | 4 | Med | Med |
| 15 | Escalate plan horizon | M5 horizon exists | Decision: escalate on Growth stage | bridge + rule | 4 | 4 | 4 | Med | Med |
| 16 | Confidence-building plan | M5 templates partial | Decision: confidence plan | bridge + template | 4 | 3 | 3 | Med | Med |
| 17 | Habit/focus plan | M5 templates partial | Decision: habit plan | bridge + template | 4 | 3 | 3 | Med | Med |
| 18 | Family-wellbeing plan | M5 templates partial | Decision: family plan | bridge + template | 4 | 3 | 3 | Med | Low |
| 19 | Digital-balance plan | LBI real; M5 partial | Decision: digital plan | bridge + template | 4 | 3 | 3 | Med | Med |
| 20 | Cohort growth-plan rollup | M5 per-user | Decision: cohort rollup | bridge + aggregation | 3 | 4 | 4 | Med | Med |
| 21 | Recommend entry Micro Check | Packages real, no mapping | Decision→Micro pkg | **decision→subscription mapping** | 3 | 5 | 5 | Med | Low* |
| 22 | Recommend Annual Core | Packages real, no mapping | Decision→Annual pkg | mapping | 3 | 5 | 5 | Med | Low* |
| 23 | Recommend READINESS | Packages real, no mapping | Decision→READINESS | mapping | 3 | 5 | 5 | Med | Low* |
| 24 | Recommend EDGE | Packages real, no mapping | Decision→EDGE | mapping | 3 | 5 | 5 | Med | Low* |
| 26 | Recommend Family plan | Family pkg via subs | Decision→Family pkg | mapping | 3 | 5 | 5 | Med | Low* |
| 29 | Upsell at Growth stage | No upsell decision | Decision: stage-triggered upsell | mapping + stage rule | 3 | 5 | 5 | Med | Low* |
| 30 | Renewal / retention nudge | Validity tracked | Decision: renewal nudge | mapping + timing | 3 | 5 | 5 | Med | Low* |
| 31 | Enforce entitlement | Partial/non-blocking | Decision-gated entitlement | server-side gate | 2 | 5 | 5 | High | Low* |
| 32 | Teacher: refer student | View-only role | Decision: refer flagged student | teacher orchestration | 4 | 4 | 3 | Med | Med |
| 34 | Counselor: prioritize caseload | PIL report real | Decision: rank caseload | risk-rank orchestration | 4 | 4 | 3 | Med | Med |
| 41 | Career-clarity decision | OMEGA/CB partial | Decision: clarity path | wrapper + CB | 5 | 4 | 4 | Med | Med |
| 44 | Digital-behaviour decision | LBI real | Decision: digital route+plan | wrapper + bridge | 4 | 3 | 3 | Med | Med |
| 46 | Defer (low confidence) | No central conf gate | Decision: defer/hedge | **confidence centralization** | 4 | 4 | 2 | Med | Med |
| 47 | Resolve ambiguous journey | Deterministic fallback | Decision: tie-break w/ confidence | confidence + tie-break | 4 | 3 | 3 | Med | Low |

`*` Commercial rows are **Low Priority-Index today only because SR=1 (no mapping)** — yet they
are the **highest-revenue cluster**. Build the single decision→subscription mapping and the
whole `21–31` block jumps in readiness simultaneously (see Roadmap Wave 2 / Revenue Matrix).

**Tier 2 takeaway:** 23 decisions unlocked by **three pieces of orchestration** — (a) journey→M5
bridge (plans), (b) decision→subscription mapping + entitlement (commercial), (c) confidence
centralization (defer/tie-break). This is the **revenue wave**: no new product, highest ROI.

---

## Output #4 — Tier 3 Decision Inventory (new products / significant expansion)

Blocked by structural platform gaps: **absent context axis**, **stub products** (Employability
Index, Competitive-Exam), **institution B2B data layer**, or **net-new surfaces**.

| ID | Decision | Current State | Target State | Gap | UI | BI | RI | TD | Priority |
|----|----------|---------------|--------------|-----|----|----|----|----|----------|
| 14 | Route to Employability Index | Route ready, **product stub** | Real employability product + decision | build product | 4 | 4 | 4 | High | Low |
| 25 | Recommend ExamReadiness pkg | Pkg real, **product stub** | Exam product + decision→pkg | product + mapping | 3 | 5 | 5 | High | Low |
| 27 | Recommend Transition Check | No job-seeker pkg/product | New pkg + transition product | new pkg + product | 3 | 5 | 5 | High | Low |
| 28 | Recommend institutional plan | **No B2B data layer** (`institution_id`/`max_students`) | B2B data layer + decision | data layer + pkg | 3 | 5 | 5 | High | Low |
| 33 | Teacher: class-level report | **No teacher surface** | New class-insight report | new surface | 4 | 4 | 3 | High | Low |
| 36 | Institution cohort mentor alloc. | No bulk allocation | Cohort allocation engine | new engine + data layer | 4 | 5 | 4 | High | Low |
| 37 | AI-disruption reskilling | **Context axis absent** | Context-triggered reskilling decision | **context axis** + product | 4 | 4 | 4 | High | Low |
| 38 | Entrepreneurship venture-readiness | Context axis absent | Context-triggered venture decision | context axis | 3 | 3 | 3 | High | Low |
| 39 | Placement-anxiety intervention | Context axis absent | Context-triggered intervention | context axis | 4 | 4 | 4 | High | Low |
| 40 | Leadership-development route | Context axis absent; LBI real | Context-triggered leadership route | context axis | 3 | 4 | 4 | High | Low |
| 42 | Family-pressure mediation | Context axis absent | Context-triggered mediation | context axis | 4 | 4 | 3 | High | Low |
| 43 | Competitive-exam readiness path | Product stub + corpus_pending | Real exam product + corpus | product + corpus | 4 | 4 | 5 | High | Low |
| 45 | Employability decision | Product stub + no mapping | Employability product + decision + pkg | product + mapping | 4 | 5 | 5 | High | Low |

**Tier 3 takeaway:** 13 decisions, all High difficulty. They carry the **highest Future
Relevance** (AI-disruption, employability, transition — FR=5) and the **single highest-revenue
decision** (institutional plan), but require platform expansion. Two unblockers dominate: the
**context axis** (unlocks 37–42) and **product completion** (Employability/Exam → unlocks
14,25,43,45). Institution B2B (28,36) is the biggest revenue bet and the biggest build.

---

## Tier summary
| Tier | Count | Difficulty | Unlocks | Wave |
|------|-------|-----------|---------|------|
| Tier 1 | 14 | Low (✷ #10 crisis = Med, safety exception) | decision object + confidence gate over real assets | Wave 1 |
| Tier 2 | 23 | Med (one High) | M5 bridge · subscription mapping · confidence | Wave 2 (revenue) |
| Tier 3 | 13 | High | context axis · product completion · B2B data layer | Wave 3 (future) |
