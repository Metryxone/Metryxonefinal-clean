# CAPADEX DC-1 — Decision Catalog Audit

**Phase type:** DESIGN + AUDIT only. No implementation, no schema changes, no code.
**STOP for approval.**

DC-1 defines the **complete Decision Catalog** for CAPADEX / MetryxOne — i.e. it designs
the **missing `Journey → Decision` layer** identified in WC-5/WC-6 and maps every decision
onto the **real** delivery surfaces (Reports, Products, Growth Plans, Mentors,
Subscriptions). It audits decisions for every **Concern · Stage · Context · Outcome ·
Journey**, across **8 segments** and **10 key contexts**.

This builds directly on the WC-5 (Decision Intelligence) and WC-6 (Decision Orchestration)
audits. The chain that exists today —

```
Concern → Stage → Context → Outcome → Journey
```

— stops before the **Decision**. DC-1 specifies what that Decision layer must contain.

---

## How this was grounded (no assumptions)

Every recommendation cell is tagged with the **real implementation status** of its target
surface, grounded in code via WC-5/WC-6 plus two fresh DC-1 exploration passes (chain
enumerations; report inventory). Legend used throughout: **R** real · **P** partial · **S**
stub · **✗** absent.

### Grounded enumerations (exact, from code)
- **Concerns (12):** `exam_stress, burnout, attention, social_anxiety, career_stagnation,
  anger, motivation, relationship, self_esteem, procrastination, sleep, screen_addiction`
  (`backend/routes/pragati.ts`, `backend/routes/capadex.ts` `resolveCapadexConcern()`).
- **Stages (5, backend canon):** Awareness → Curiosity → Clarity → Growth → Mastery
  (`wc3-schema.ts`/`stage-intelligence.ts`). FE uses `CAP_*` 4-code (CUR/INS→Clarity/GRW/MAS);
  **taxonomy split persists** — reconcile before stage-keyed UX.
- **Outcomes (7 = 6 + 1):** `career_clarity, learning_effectiveness, employability_readiness,
  confidence_stability, decision_quality, family_wellbeing` + `exam_readiness`
  (**gated:true**) (`wc3-schema.ts`/`outcome-intelligence.ts`).
- **Journeys (6 routes):** `lbi→/lbi` (ready) · `career_builder→/career-builder` (ready) ·
  `employability_index→/employability-index` (route ready) · `competitive_exam→/exam-intelligence`
  (**corpus_pending**) · `mentoring→/mentors` (ready, universal fallback) ·
  `family_support→/mentors` (ready) (`wc3-schema.ts`/`journey-intelligence.ts`).
- **Contexts (10, this audit's "Key Contexts"):** AI Job Disruption · Employability ·
  Entrepreneurship · Career Transition · Competitive Exams · Family Pressure · Placement
  Anxiety · Leadership · Digital Behaviour · Career Clarity. **⚠️ Context is not yet an
  active decision-trigger axis.** A read-only context *sidecar* exists
  (`backend/services/wc3/question-context-intelligence.ts` → table `wc3_question_context`,
  keyed by clarity_id) but it is **not operationalized in the decision chain**, and ~80% of
  questions are legitimately context-free (WC-3 L5B audit). So context-triggered decisions
  are **design targets that require the context axis to be wired into the decision layer first.**

### Grounded Report inventory (real-vs-stub)
| Report | Status | Route | Gated |
|--------|--------|-------|-------|
| CAPADEX **core** base report | **R** (ungated core) | `GET /api/capadex/report/:session_id` | **no** (exposes `dynamic_reporting` metadata only) |
| PIL stakeholder — Student/Parent/Counselor | **R** | `GET /api/capadex/session/:id/report` (single, `?stakeholder=`) + `/reports` (all 3) | **yes — `runtimeIntelligenceActivation`** |
| PIL Institution cohort | **R** | `GET /api/capadex/institution/report` | **yes — `runtimeIntelligenceActivation`** |
| OMEGA-X intelligence report | **R** | `GET /api/capadex/report/:session_id/omega` | **no flag gate in route wrapper** |
| ExamReadiness Index | **P/mixed** (unifying into SDI/LBI) | `exam-ready/.../ReportViewPage` | — |
| LBI / SDI / Competency reports | **R backend / S UI** (UnifiedReportsPanel shows EmptySource for these) | `/api/lbi/*`,`/api/sdi/*`,`/api/sci/*` | varies |
| `report_type` values on packages | seeded | — | `learning-analysis, behavioral-insights, exam-readiness, lbi-comprehensive, Snapshot Lite` |

> ⚠️ **Route correction (vs first draft):** `GET /api/capadex/session/:id/report` is the
> **gated Phase-6C stakeholder** report (`isRuntimeIntelligenceActivationEnabled()`), **not**
> the core base report. The ungated core base report is `GET /api/capadex/report/:session_id`.
> OMEGA's `/omega` route has **no** feature-flag wrapper. The stakeholder/institution gate is
> `runtimeIntelligenceActivation`, not `pil_phase6c`/`dynamic_reporting`.

### Grounded delivery-surface reality (from WC-6, reused)
- **Products:** LBI **R** · Mentoring **R** · Career Builder **P** · Employability Index
  **S** (⚠️ route marked `ready` but product surface is stub — route-vs-product gap) ·
  Competitive-Exam **S**+corpus_pending.
- **Growth Plan:** M5 **R** (persists, segment/persona-aware) — anchored to M-series scores,
  **not** the concern-journey decision (bridge still required).
- **Mentor:** **R** (DB-backed, assessment-driven `/suggestions`). Lives in `frontend/server`.
- **Subscription:** packages **R** with `student_segment` + `is_recommended`; **no
  decision→package mapping**; entitlement partial/non-blocking.

---

## Deliverables (this folder) → the 9 requested outputs

| # | Requested output | File |
|---|------------------|------|
| — | Executive Summary | this file (below) |
| 1 | Decision Catalog | `DC1_DECISION_CATALOG.md` |
| 2 | Decision Taxonomy | `DC1_DECISION_CATALOG.md` |
| 3 | Decision-to-Product Matrix | `DC1_MATRICES.md` |
| 4 | Decision-to-Growth-Plan Matrix | `DC1_MATRICES.md` |
| 5 | Decision-to-Mentor Matrix | `DC1_MATRICES.md` |
| 6 | Decision-to-Subscription Matrix | `DC1_MATRICES.md` |
| 7 | Top 50 Decisions CAPADEX Must Support | `DC1_TOP50_AND_READINESS.md` |
| 8 | Decision Coverage Gaps | `DC1_TOP50_AND_READINESS.md` |
| 9 | Decision Intelligence Readiness Report | `DC1_TOP50_AND_READINESS.md` |

Each decision specifies **Trigger Conditions · User Segment · Business Value · User Value ·
Revenue Impact · Confidence Requirements** (fully tabulated for the Top 50; defined
structurally in the Taxonomy).

---

## Executive Summary

**The Decision layer does not exist yet — DC-1 specifies it.** Today the chain computes
Concern→Stage→Context→Outcome→Journey and then *routes* to a product. It never forms an
explicit **Decision** ("given everything we know, what should happen, for whom, how
confident are we, and what does it activate"). DC-1 catalogs those decisions.

**Three structural truths shape the catalog (all grounded):**
1. **Decisions are cheap to compose; destinations are mostly real.** Reports (CAPADEX base,
   OMEGA, PIL ×4), Mentor, and M5 Growth Plan are real. So most decisions can be *delivered*
   — the missing piece is the explicit decision + its activation glue (WC-6's orchestrator).
2. **Two axes gate the catalog's realism:** (a) **Context is an absent axis** — any
   context-triggered decision needs the context axis built/inferred first; (b)
   **Confidence** — decisions must be gated by L2 confidence bands + the hypothesis-engine
   governance classifier, or they become unsafe guesses. A decision without a confidence
   requirement is a fabrication risk.
3. **Commercial decisions are the weakest** — no decision→subscription mapping exists, so
   every "Recommended Subscription" cell is a *design target*, not a live capability.

**Decision Intelligence Readiness (headline, detail in `DC1_TOP50_AND_READINESS.md`):**

| Decision class | Can be delivered today? | Blocker |
|----------------|------------------------|---------|
| Diagnostic (assess/re-assess) | **Yes** | none (assessment real) |
| Report (which report to surface) | **Mostly** | PIL/OMEGA flag-gated; LBI/SDI/Competency UI stubbed |
| Routing/Product (activate product) | **Partly** | Employability/Exam stubs; activation glue missing |
| Developmental (growth plan) | **Partly** | journey→M5 bridge missing |
| Human-support (mentor/escalation) | **Mostly** | mentor real; decision-driven match + cross-server seam |
| Commercial (subscription) | **No** | no decision→package mapping; entitlement partial |
| Safety/governance (crisis/defer) | **Partly** | crisis-escalation exists in Pragati; not unified into a decision gate |

**Bottom line:** CAPADEX can *form and deliver* roughly **4 of 7 decision classes today**
(diagnostic, report, mentor, plus partial product/plan), but cannot yet form an **explicit,
confidence-gated, segment-aware decision object** or any **commercial decision**. The
catalog below is the specification for closing that — to be built (in a future approved
phase) with WC-3 discipline: additive · compose-only · flag-gated default OFF ·
byte-identical when OFF · **confidence-gated** · **never fabricate** (low confidence →
defer/hedge, never invent a decision).

**Scope reminder:** audit/design only. No code, schema, or migrations changed.
