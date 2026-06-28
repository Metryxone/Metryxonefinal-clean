# CAPADEX 2.0 — Phase 1.3: Product Constitution (Product Bible)

> **Execution mode:** ENHANCEMENT-ONLY · evolve the existing product. **No code modified, no UI changes, no workflow redesign, no dormant activation, no business-logic change.** This `.md` is the only artefact.
> **Honesty contract:** *measured* = MEASURED (from Phase 0/0.1 inventory); *judgement* = DERIVED. Dormant ≠ missing; flag-ON ≠ activated; null ≠ 0. Strengths/gaps are reported honestly, never inflated.
> **Status:** This is the permanent Product Bible. Every future enhancement must comply. It governs philosophy only — it changes nothing in the running product.

Generated 2026-06-28 · Initiative MX-700 · Phase 1.3.

---

## PART 1 — Current Product Audit (as-implemented)

| Dimension | As-built (MEASURED) | Strength / Gap |
|---|---|---|
| **Product vision (implicit)** | Behaviour-intelligence assessment + career/employability + employer hiring + institutional analytics | Strong multi-sided platform; vision under-stated as "assessment" |
| **Modules** | CAPADEX assessment · Pragati conversation · Competency · Career Builder/OS · Employability Passport · Employer Portal/TIG · Institutional dashboards · Report Factory · FRP · EIOS · Commercial/Invoice · Decision/WC-3 | Broad, coherent |
| **Capabilities** | ~3,241 endpoints · 569 services · 89 pages · 541 components | Deep |
| **Personas** | Student · Professional · Executive/Founder · Employer/Recruiter · Faculty/Institution-admin · Parent · Super-admin | Rich; some duplication/ambiguity (Part 5) |
| **Concerns** | Concern Master ~2,489 · Clarity ~30,638 · 4-tier signal ontology (15,972 atomic) | World-class IP |
| **Assessments** | CAPADEX flow · Competency (onto_*) · LBI · adaptive questioning · Question Factory | Strong; partly score-terminal (Part 7 gap) |
| **Journeys** | Career journeys, growth plans (M5), journey→growth bridge | Partial; not auto-created from every assessment (Part 8 gap) |
| **Reports** | Report Factory (8/16-pack), pdfkit, benchmark/viz, stakeholder reports | Strong; mostly static-PDF output (Part 10 gap) |
| **AI** | OpenAI/Whisper/HeyGen, Pragati reasoning, insight-explainer | Functional; no prompt registry/eval (debt) |
| **Enterprise** | RBAC v2, k-anon analytics, governance, compliance, tenant scope | Strong |
| **Commercial** | packages CRUD, entitlement (fail-closed), Razorpay, invoice/GST | Partial (e2e unverified, package→entitlement gap) |
| **Dashboards** | SuperAdmin (230 panels), Mission Control, Platform Intelligence | Strong |
| **Learning / Career / Behaviour** | learning intelligence, career graph, behaviour spine | Career strong; behaviour spine under-populated |
| **SuperAdmin** | single admin system, 2FA, per-framework gate | Strong, single source |

**Strengths:** unmatched behavioural/concern ontology; single admin; honest engineering discipline; multi-persona reach.
**Weaknesses:** flagship UI monoliths; bundle size; AI lacks observability.
**Gaps:** assessments end at scores; journeys not universal; reports largely static.
**Duplications:** dead `frontend/server` JWT app + archived mirror (RETIRE candidates).
**Dormant capabilities:** Decision/WC-3 + Orchestrator (flag-ON, no default-path data) · CGI · FRP back-half — the highest **missing user value** (intelligence is built but not delivered to users).

---

## PART 2 — Product Vision (permanent)

**CAPADEX is a continuous Behaviour Intelligence Platform.** Not an assessment platform. Not a reporting platform.

> Purpose: **Understand · Measure · Predict · Guide · Improve human behaviour throughout life.**

Every enhancement must move a user further along *understand → measure → predict → guide → improve* — and must keep that loop **continuous** (the relationship does not end at a report). Any feature that terminates the loop (a dead-end score, a static PDF) violates the vision.

---

## PART 3 — Product Principles (every feature must satisfy)

Behaviour-First · Decision-First · Journey-First · Learning-First · Career-First · Life-First · Conversation-First · Evidence-First · Explainability-First · Continuous-Growth · AI-Assisted · **Human-Controlled** · Enterprise-Ready · Privacy-First · Accessibility-First · Composable · Scalable · Maintainable.

**Operational test (a feature passes only if):** it originates from behaviour, advances a journey, is evidence-backed and explainable, is AI-assisted but human-controlled, respects privacy/k-anonymity, and reuses existing capability (no duplicate path to the same outcome).

---

## PART 4 — Behaviour Constitution

Behaviour is the foundation; everything originates from it.
- Assessments **measure** behaviour → Journeys **improve** it → Reports **explain** it → Recommendations **influence** it → Learning **develops** it → Career decisions **reflect** it → AI **understands** it.
- **Never bypass the Behaviour Engine.** Any new signal/insight routes through the existing signal → composite → pattern → behaviour-graph → insight spine.
- **Strengths canon (binding):** strengths come ONLY from CSI positive factors / positive longitudinal growth — NEVER from raw concern-signal magnitude (signals are concern-diagnostic).
- Coverage (data exists) ⟂ Confidence (trustworthy) reported separately; abstain below k_min=30; null≠0.

---

## PART 5 — Persona Constitution

**Audit (existing, enhance — never replace):** Student · Professional · Executive · Founder · Employer/Recruiter · Faculty · Institution-admin · Parent · Super-admin.

| Concern | Finding (DERIVED) | Action |
|---|---|---|
| Missing personas | Government, Healthcare, NGO, Corporate-manager, Future/lifelong-learner under-modelled | EXTEND persona model (additive) |
| Duplicate personas | Executive vs Founder overlap; Institution-admin vs Faculty scope overlap | CONSOLIDATE definitions, keep distinct scopes |
| Unused personas | Parent (consent-gated, thin usage) | ENHANCE activation, don't remove |

**Persona maturity model (5 levels):** Anonymous → Identified → Assessed → Journeying → Continuous (longitudinal).
**Persona hierarchy:** Individual (student/professional/executive/founder) · Organisational (employer/faculty/institution-admin/manager) · Oversight (parent/super-admin).
**Persona relationships:** institution-admin → faculty → student (batch-confined); employer ↔ candidate (consent); parent ↔ student (consent). Persona is SOFT in routing (provider-only families), age is HARD (adultness ≥24) — never mis-route adults to student banks.

---

## PART 6 — Concern Constitution

**Audit Concern Master (~2,489) — never replace; improve.**
- Domains present: Mental Health · Learning · Career · Leadership · Organisation · Life · Wellbeing · Finance · Relationships · Health · Technology.
- **Join-key integrity is sacred:** `relational_bridge_tag` / `master_bridge_tag` are the only working bridges; `concern_id` is DISJOINT from clarity rows — never "fix" by forcing concern_id joins.
- Improve **categories/subcategories/relationships/dependencies** additively; map **market trends & future-workforce concerns** as new tagged rows, never bulk-regenerate.
- **Concern taxonomy maturity (5 levels):** Raw label → Bridge-tagged → Hierarchy-placed → Signal-linked → Trend-aware. Orphan/unmapped concerns are flagged honestly, never fabricated.

---

## PART 7 — Assessment Philosophy

**Assessments are conversations, not questionnaires/forms/psychometric sheets.**
- Must Adapt · Learn · Predict · Guide · Explain · Recommend · **Continue**.
- **Every assessment begins a journey; never ends with a score.** (Current gap: some flows are score-terminal → the canonical fix is wiring the existing journey/growth-plan bridge, not new screens.)
- Adaptive selection reuses the existing analyze-envelope + question banks; proxy-language keeps stems first-person; clarity picker carries `clarity_source` provenance.

---

## PART 8 — Journey Constitution

**Every assessment creates** Behaviour · Learning · Career · Life · Leadership · Organisation · Decision · Subscription · AI journeys (those applicable to the persona).
- **Every journey continues after the report.** The journey→M5 growth-plan bridge and decision orchestrator already exist — the Constitution mandates *wiring them onto the default path*, not building parallel journey systems.
- Journey is **downstream of outcome projection** (coverage ceiling applies); mentoring catch-all must not dilute specificity.

---

## PART 9 — AI Product Constitution

AI exists to **Explain · Coach · Guide · Educate · Predict · Recommend.**
- **Never diagnose. Never fabricate. Never replace evidence. Never replace behaviour science.**
- **Every AI output requires: Evidence · Confidence · Explanation · Alternatives.** AI-inert (no key) = null + source tag, never a fabricated value.
- One AI lineage: reuse **Pragati** + existing AI services + (proposed) shared **prompt registry** — never a parallel AI implementation.
- Language policy binding: developmental signals only, NEVER hiring/promotion/suitability predictions; allowed/disallowed term lists on every envelope.

---

## PART 10 — Report Constitution

Reports are **Interactive · Living · Continuous · Actionable · Explainable · Adaptive — never static PDFs.**
- Audit: Report Factory packs are strong but PDF-centric → ENHANCE toward living/interactive surfaces (additive), keep `BUILDERS` byte-identical.
- Improve Visualisation · Storytelling · Recommendations · Progress-tracking · Benchmarks (k=30 suppression) · Comparisons · **Journey integration** (every report links into its journey).

---

## PART 11 — Subscription Constitution

**Subscriptions are never generic — personalised from** Persona · Concern · Behaviour · Career · Learning · Journey · Enterprise · Goals · Budget · Usage · Recommendations.
- **Subscriptions evolve continuously** with the user's journey.
- Reuse the existing packages + entitlement spine (fail-closed, ledger=paid-only); close the package→entitlement gap additively; never fabricate refund/credit without a real refunded payment.

---

## PART 12 — Product Experience Principles

Every screen must answer: **Who am I? · Why am I here? · What should I do next? · What value do I receive? · How am I progressing?** Every interaction must **reduce friction**. Every data view must show loading/empty/error states (a view with neither loading nor error is a defect).

---

## PART 13 — Enterprise Product Constitution

Audit enterprise; improve **Configuration · Administration · Reporting · Governance · Analytics · Compliance · Security** across **Departments · Managers · Teams · Institutions · Universities · Government · Corporate · NGO.**
- Binding: role-aware scope (admin / institute-staff / faculty batch-confined / parent-by-consent; 403 role_not_authorised), k-anonymity (k_min=30), consent gates, tenant isolation on EVERY detail read (not just lists). Compose real substrate — never a readiness-proxy.

---

## PART 14 — SuperAdmin Product Principles

SuperAdmin exists to **Configure · Monitor · Approve · Measure · Analyse · Govern** the product.
- **Never duplicate administration** — one admin system only. Human approval is the only coverage-changing op. New capability = new flag-gated panel + conditional nav (hidden when OFF), never a second admin.

---

## PART 15 — Product Quality Standards

Every enhancement must improve **Usability · Accessibility · Performance · Maintainability · Discoverability · Explainability · Consistency · Trust.** An enhancement that improves none of these (pure addition with no quality lift) fails the bar.

---

## PART 16 — Product Success Metrics

Measure: Activation · Completion · **Journey Continuation** · Behaviour Improvement · Learning Progress · Career Progress · Subscription Conversion · Enterprise Adoption · Retention · Recommendation Accuracy · AI Confidence · Decision Quality.
- **Honesty rule:** every metric reports Coverage ⟂ Confidence separately; unmeasurable = null + explicit note, never 0. Activation (live + used) is never composited with Structural (built).

---

## PART 17 — Product Governance Model

Every new feature must answer:
1. Why does it exist? · 2. What existing capability does it enhance? · 3. Which existing modules does it reuse? · 4. Does it duplicate functionality? · 5. Can an existing feature achieve the same outcome? · 6. How does it improve behaviour intelligence?
A feature that cannot cite an enhanced existing capability, or for which an existing feature already achieves the outcome, is **rejected** (no duplicate paths to one outcome).

---

## PART 18 — Product Review Board (per-enhancement sign-off)

Explicit APPROVE/REJECT from each, before merge:
```
Founder[ ] Product[ ] BehaviourScience[ ] Psychology[ ] UX[ ]
Engineering[ ] AI[ ] Enterprise[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```
(Complements the Engineering Review Board in Phase 1.2 Part 23 — Product board owns *what/why*, Engineering board owns *how*.)

---

## PART 19 — Product Definition of Done

A product enhancement is complete only when:
- [ ] Existing capability reused.
- [ ] Behaviour engine integrated (originates from behaviour).
- [ ] Concern engine integrated.
- [ ] Persona integrated.
- [ ] Journey created/continued.
- [ ] Subscription considered.
- [ ] SuperAdmin considered.
- [ ] Enterprise considered (scope, k-anon, consent).
- [ ] Reports updated.
- [ ] AI updated (evidence/confidence/explanation/alternatives).
- [ ] Analytics updated (honest, null≠0).
- [ ] Documentation updated (`docs/*` SSOT + memory + replit.md).
- [ ] No duplicate functionality introduced.
- [ ] Founder GO recorded.

(Stacks ON TOP of the Engineering DoD in Phase 1.2 Part 24 — both must pass.)

---

## PART 20 — Deliverables Index

| # | Deliverable | Section |
|---|---|---|
| 1 | Product Constitution | this document |
| 2 | Product Vision | Part 2 |
| 3 | Product Principles | Part 3 |
| 4 | Behaviour Constitution | Part 4 |
| 5 | Persona Constitution | Part 5 |
| 6 | Concern Constitution | Part 6 |
| 7 | Assessment Philosophy | Part 7 |
| 8 | Journey Constitution | Part 8 |
| 9 | AI Product Constitution | Part 9 |
| 10 | Report Constitution | Part 10 |
| 11 | Subscription Constitution | Part 11 |
| 12 | Enterprise Product Constitution | Part 13 |
| 13 | Product Governance Model | Part 17 |
| 14 | Product Success Metrics | Part 16 |
| 15 | Product Definition of Done | Part 19 |

---

**STOP — Phase 1.3 complete. No product workflows redesigned, no UI changed, no dormant capability activated, no business logic changed.** Product Constitution established only.
Honesty caveats: persona/concern maturity models and the "missing personas" list are DERIVED engineering judgement (module/persona inventory MEASURED); the recurring honest finding stands — the platform's biggest *product* opportunity is to make existing intelligence (Decision/journey/living-reports) actually reach users, which is an **activation/enhancement** problem, not a build problem (deferred to its own approved phase).
