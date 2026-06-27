# PHASE 3 — CAPADEX Re-Architecture: Audit · Review · Blueprint

> **Status: BLUEPRINT FOR REVIEW — no code changed.** This document is the deliverable for the
> "STOP FOR REVIEW" gate. Nothing in the runtime has been touched. Implementation begins only on
> Founder GO, sub-phase by sub-phase, each additive + flag-gated + byte-identical OFF.

---

## 0. Executive summary

**Goal (as stated):** make CAPADEX the *central decision engine* — replace static stage logic with a
Journey State Machine + Adaptive Decision Engine + Next Best Action, fed by six contexts (Career,
Goal, Assessment, Learning, Employer, Recommendation), where **every recommendation is explainable
and every decision is evidence-backed**, and the stage taxonomy moves from
`Curiosity / Growth / Mastery` → `Discover · Assess · Build · Practice · Validate · Apply · Interview ·
Work · Grow · Lead`.

**The honest headline:** most of the *destinations* already exist (stage, outcome, journey, growth-plan,
mentor, subscription, recommendation/intervention libraries). **What is missing is the conductor** — a
single decision engine that ingests the contexts, runs a state machine, and fans ONE evidence-backed
decision out to a Next Best Action. CAPADEX today is a **composition layer (WC-7B decision orchestrator,
flag OFF)** sitting on top of three *overlapping and inconsistent* stage taxonomies. Phase 3 is mostly
**compose + reconcile + make-explainable**, not build-from-scratch.

**The single biggest decision for you (see §6, Decision D1):** the requested 10-stage taxonomy is a
**career-execution lifecycle**, while today's `Curiosity/Growth/Mastery` is a **behavioural
self-awareness progression**. These are different axes measuring different things. "Replace" can mean
(a) genuinely retire the behavioural axis, or (b) keep behavioural as a sub-signal and make the 10-stage
the *primary spine*. I recommend (b). This choice drives the whole build.

---

## 1. AUDIT — what exists today (real vs scaffolded)

### 1.1 Stage taxonomy is SPLIT three ways (the core debt)
| Where | Taxonomy | File / table | Status |
|---|---|---|---|
| Backend canon (WC-3 L1) | **5 stages**: Awareness → Curiosity → Clarity → Growth → Mastery | `backend/services/wc3/stage-intelligence.ts` (`CANONICAL_STAGE_ORDER`), `wc3_stage_definitions` | Real, flag-gated OFF (`FF_WC3_STAGE`) |
| Legacy session codes | **4 codes**: `CAP_CUR`/`CAP_INS`/`CAP_GRW`/`CAP_MAS` | `STAGE_ENTITY_MAP` (same file), `wc3_stage_entity_map`, `capadex_sessions.stage_code` | Real (maps legacy → canonical) |
| Frontend / report surfaces | **4-code** `CAP_*` (Curiosity/Insight/Growth/Mastery) + a **3-stage** Curiosity/Growth/Mastery in older pages | `frontend/src/lib/behavioural-insights.ts` (`CAPADEX_STAGES`), `pages/competency/CareerStagePage.tsx` | Real, inconsistent with backend |

**Trap (from prior audits):** any stage-keyed decision/report/offer surfaced to users is inconsistent
until these are reconciled. **Reconcile BEFORE keying user-facing decisions to stage.** This is now
the foundation sub-phase of Phase 3.

### 1.2 Decision orchestration — the conductor exists but is dormant
- `backend/services/wc7b/decision-orchestrator.ts` — `buildActivationEnvelope()` is **COMPOSE-ONLY /
  READ-ONLY**: stitches Stage (L1) + Outcomes (L2) + Journey/Route (L3) + bridges (growthPlan, mentor,
  subscription/offer). Exposed at `GET /api/capadex/session/:id/activation`.
- Flags: `decisionOrchestrator` (FF_DECISION_ORCHESTRATOR), `decisionPersistence`
  (FF_DECISION_PERSISTENCE), `journeyGrowthPlanBridge`, `decisionMentorBridge` — **all default OFF**.
- **This is the seed of the "central decision engine."** Phase 3 grows it from a *passive composer* into
  an *active state machine + NBA selector*. We extend, not replace.

### 1.3 Journey & Outcome projection (the evidence substrate)
- **Outcome (L5C)** `services/wc3/outcome-projection.ts` / `wcl-projections.ts` — `outcomeScore =
  growthWeight·0.55 + (1−riskWeight)·0.45`; 6–7 outcome models; `exam_readiness` gated.
- **Journey (L5D)** `services/wc3/journey-projection.ts` — `journey fit = Σ(route affinity × outcome-model
  confidence)`. **Journey reach is strictly downstream of outcome reach** (≈80.3% ceiling); mentoring is
  the universal fallback (all 7 models) so confidence is structurally low-banded. These are honest
  catalogue properties, **not** defects to smooth away. Both are **offline/NOT wired into runtime**.

### 1.4 Adaptive engines & state machines (already two of them)
- **Adaptive questioning** `services/adaptive-assessment.ts` + `routes/capadex.ts` (flag
  `adaptiveQuestioning` — note: default **true**). Rebuilds the question pool via the same analyze
  envelope; arms only when no prefill; every failure falls back to the batch (200, never 500).
- **Pragati FSM** `routes/pragati.ts` — a real 13-state conversational state machine
  (`emotional_entry → concern_recognition → … → clarity_generation`) with `STATE_SEQUENCE`. **This is the
  closest existing pattern to the requested Journey State Machine** and is the template to follow.

### 1.5 Next Best Action / recommendation — pieces, no unifier
- `wc3_outcome_actions` → `intervention_library` (action layer, library-backed).
- `services/recommendation-engine.ts`, `services/lbi-recommendation-engine.ts` (domain recs).
- `services/wc7c/offer-engine.ts` (commercial NBA: upsell/offer by decision confidence + product fit).
- **Gap:** no single "Next Best Action" that ranks across *all* action types (assess / learn / practice /
  book-mentor / apply-to-job / upgrade) with one explainable evidence trail.

### 1.6 The six contexts — all have real substrate today
| Context | Substrate (tables / services) | Reality |
|---|---|---|
| **Career** | `career_seeker_profiles`, career-brain aggregator, role resolution (`role-auto-resolution.ts`, `contextual-role-resolution-engine.ts`) | Real |
| **Goal** | `wc3_personalization_decisions` (L4), career goals | Real / seeded |
| **Assessment** | `capadex_sessions`, CSI, competency `onto_*` ledger, `wc3_stage_state` | Real |
| **Learning** | learning paths, `student_subscriptions`, outcome-intelligence | Real |
| **Employer** | `job_postings` / `employer_jobs`, talent-matching, TIG | Real |
| **Recommendation** | `intervention_library`, `wc3_outcome_actions`, offer-engine | Real / seeded |

**Conclusion of audit:** the substrate is rich and real but **fragmented and dormant** (most behind OFF
flags, several offline-only). The work is orchestration + reconciliation + explainability, not greenfield.

---

## 2. REVIEW — gap analysis vs "central decision engine"

| Capability requested | Today | Gap to close in Phase 3 |
|---|---|---|
| One canonical stage spine | 3 inconsistent taxonomies | **Reconcile to ONE** + add the 10-stage spine (D1) |
| Journey State Machine | Pragati FSM (conversational only); WC-3 stages are labels, not a machine with transitions/guards | Build a **career Journey FSM** with explicit transitions, entry/exit guards, evidence gates |
| Adaptive Decision Engine | Passive composer (orchestrator), adaptive *questioning* only | Promote orchestrator to **active decision engine** consuming 6 contexts |
| Next Best Action | Scattered (interventions, recs, offers) | **Unified NBA ranker** across all action types, one evidence trail |
| 6 contexts feeding decisions | Substrate real but not unified into a decision input | **Context assembler** (one read-only "DecisionContext" envelope) |
| Every recommendation explainable | Partial (orchestrator carries some provenance) | **Explainability contract**: every output carries evidence refs + rule trace |
| Every decision evidence-backed | L5C/L5D have evidence; not enforced platform-wide | **Evidence-or-abstain** rule on every decision (null ≠ 0, never fabricate) |

---

## 3. BLUEPRINT — target architecture

### 3.1 Component diagram (additive layer over existing substrate)
```
                 ┌─────────────────── CAPADEX Decision Engine (NEW spine) ───────────────────┐
 6 CONTEXTS ───► │  ContextAssembler  →  JourneyStateMachine  →  AdaptiveDecisionEngine       │
 (career, goal,  │  (read-only envelope)  (10-stage FSM + guards)  (rules + evidence scoring)  │
  assessment,    │                                                  │                          │
  learning,      │                                                  ▼                          │
  employer, rec) │                                         NextBestAction ranker               │
                 │                                                  │                          │
                 │                                    ExplainabilityContract (evidence trace)   │
                 └──────────────────────────────────────────────────┬──────────────────────────┘
 EXISTING (reuse, compose, never recompute): WC-3 L1/L2/L3, L5C/L5D projections,
 wc7b orchestrator + bridges (growth-plan, mentor), wc7c offer-engine, intervention_library,
 recommendation engines, role resolution, Pragati FSM (pattern), career-brain aggregator.
```

### 3.2 The 10-stage Journey State Machine
**Stages:** `Discover → Assess → Build → Practice → Validate → Apply → Interview → Work → Grow → Lead`.

- **Model as a directed graph**, not a strict linear ladder: most transitions are forward-sequential, but
  allow defined back-edges (e.g. `Interview → Build` on a validated skill gap) and skip-edges (e.g.
  experienced hire entering at `Apply`). Mirror the Pragati FSM `STATE_SEQUENCE` pattern.
- **Each stage carries:** `entry_guard` (evidence that must be present to enter), `exit_criteria`
  (evidence that unlocks the next stage), `available_actions[]` (the NBA candidate set for that stage),
  and `primary_context` (which of the 6 contexts dominates — e.g. `Assess`→Assessment, `Apply`→Employer).
- **Transitions are evidence-gated.** No stage advance without the exit evidence; otherwise the engine
  *abstains* and emits an NBA that *produces* the missing evidence. This is the mechanism that makes the
  whole thing "evidence-backed" rather than vibes-based.
- **Persistence:** new `capadex_journey_state` (per principal: current_stage, entered_at, evidence_refs,
  history append-only) — modeled on `wc3_journey_state`. Append-only history (platform convention).

### 3.3 Crosswalk: old taxonomy → new spine (honesty-preserving)
Because the axes differ (D1), we **do not delete** behavioural stages; we map them as a *sub-signal*:
| Behavioural (WC-3 5-stage) | Maps to journey region | Note |
|---|---|---|
| Awareness | Discover | first signals |
| Curiosity | Discover / Assess | exploration |
| Clarity | Assess / Build | self-understanding |
| Growth | Build / Practice / Grow | habit formation (spans) |
| Mastery | Validate / Work / Lead | control / peak (spans) |

The crosswalk is **many-to-many and lossy** — that is exactly why D1 matters. The behavioural axis stays
available as evidence feeding `entry_guard`/`exit_criteria`, but the **10-stage becomes the primary spine**
users and decisions key on.

### 3.4 Adaptive Decision Engine
- Promote `wc7b/decision-orchestrator.ts` from passive composer → **active decision engine**:
  ingest the `DecisionContext` envelope, evaluate the current stage's guards, run a **deterministic rule
  set first** (auditable), use scored/AI evidence only as a tiebreak — never as the sole basis.
- **Output contract:** `{ decision, stage, next_best_action, evidence[], rule_trace[], confidence,
  abstained?: reason }`. Confidence and coverage reported as **separate axes** (platform convention).
- **Fail-closed + never-throws** (platform convention): missing context → abstain with reason, never a
  fabricated default. `null ≠ 0`.

### 3.5 Next Best Action ranker
- One ranker over a typed candidate set: `assess | clarify | learn | practice | validate | book_mentor |
  apply_job | prep_interview | upgrade_plan`. Candidates come from the **current stage's
  `available_actions[]`** ∩ what the contexts make eligible.
- Rank by `(evidence_strength × stage_fit × outcome_lift)`; commercial offers (wc7c) participate but
  **never outrank** a genuine developmental need (language policy: developmental signals, not sales).
- Each NBA carries its **explainability payload** (why this, what evidence, what it unlocks).

### 3.6 Explainability + evidence contract (cross-cutting, mandatory)
- Every decision and every recommendation returns `evidence[]` (concrete refs: session ids, construct
  keys, score runs, journey/outcome model ids) + `rule_trace[]` (which rules fired).
- **Evidence-or-abstain:** if the evidence set is empty, the engine abstains and the NBA becomes "gather
  evidence" (e.g. take assessment X). No silent defaults, no fabricated confidence.
- Reuse existing provenance patterns (L5C/L5D evidence, orchestrator envelope) — don't invent a parallel
  one.

---

## 4. Proposed sub-phase breakdown (each: additive · flag-gated · byte-identical OFF · STOP FOR REVIEW)

| Sub-phase | Scope | New flag | Deliverable |
|---|---|---|---|
| **3.0 Taxonomy reconciliation** | Single source of truth for stage; define 10-stage spine + crosswalk table; align FE/BE labels behind a flag | `journeyStateMachine` (OFF) | crosswalk + reconciled definitions, no UX change OFF |
| **3.1 Journey State Machine** | FSM definition, guards/exit-criteria, `capadex_journey_state` (append-only), read-only `GET …/journey-state` | reuse 3.0 flag | FSM engine + persistence, dormant |
| **3.2 Context Assembler** | One read-only `DecisionContext` envelope composing the 6 contexts (never recompute) | `decisionContext` (OFF) | assembler + tests |
| **3.3 Adaptive Decision Engine** | Promote orchestrator to active engine; rules-first + evidence; abstain path | extend `decisionOrchestrator` | engine + decision contract |
| **3.4 Next Best Action** | Unified ranker + explainability payload | `nextBestAction` (OFF) | NBA ranker + evidence trace |
| **3.5 Explainability hardening** | Evidence-or-abstain enforced platform-wide on decision outputs | — | contract + audit of coverage |
| **3.6 Surface wiring (FE)** | Surface stage/NBA/explanation in EXISTING tabs only (no core-page rewrites) | reuse flags | UI behind flags, byte-identical OFF |

**Rollout discipline:** flag-OFF path byte-identical incl. schema (gate the DDL); every new route
`requireAuth` then flag (401 unauth / 503 OFF); literal routes before param routes; lazy ensure-schema
mirrors migration; demo/@example.com excluded from any metric; mask PII in any committed artifact.

---

## 5. Risks & non-obvious traps (carry-forward from memory)
- **Journey coverage ceiling ≈ outcome coverage (≈80%)** — do not force no-outcome questions onto the
  mentoring fallback; report honest orphans. A 10-stage spine inherits this ceiling for evidence-gated
  transitions; surface it, don't fabricate reach.
- **Mentoring is the universal fallback AND structurally low-confidence** — strengthening it raises the
  whole floor, but never present it as high-confidence routing.
- **Cross-server seam:** WC-3 + M5 live in `backend/` (8080); mentoring + richer subscription SQL live in
  `frontend/server/`. The decision engine must resolve this seam (internal-call contract) before it can
  call mentor + subscription destinations.
- **No decision→package mapping exists** and entitlement is partial/non-blocking — commercial NBA can be
  *suggested* but not *enforced* until the entitlement spine is finished (separate commercial track).
- **`adaptiveQuestioning` defaults true** while most WC-3 flags default false — confirm intended flag
  posture during 3.0 so we don't change live behaviour unintentionally.
- **Stage column in clarity data is dead** (single-valued/blank) — stage must stay DERIVED, never read
  from that column.

---

## 6. DECISIONS REQUIRED before implementation (your call)

- **D1 — Axis strategy (blocking).** The 10-stage is a *career lifecycle*; `Curiosity/Growth/Mastery` is a
  *behavioural progression*. **Recommendation: keep behavioural as a sub-signal, make the 10-stage the
  primary spine** (option b). Confirm, or choose full replacement (option a — loses behavioural nuance).
- **D2 — Scope of "replace static logic."** Replace only the *stage labels/decision keys*, or also rip out
  the older `CareerStagePage`/3-stage report surfaces? Recommendation: reconcile + redirect, deprecate old
  surfaces gradually (additive first).
- **D3 — Entry points.** Should non-fresher personas (experienced hire, employer) enter the FSM
  mid-stream (e.g. `Apply`/`Work`)? Recommendation: yes, via role-resolution-driven entry guards.
- **D4 — Commercial coupling.** May commercial NBAs (offers/upgrades) appear in the NBA list now, or stay
  out until entitlement enforcement lands? Recommendation: show as developmental-framed suggestions only,
  never outranking a real need.
- **D5 — Build order.** Confirm the 3.0→3.6 sequencing and that each sub-phase STOPS for your GO/NO-GO.

---

## 7. What I did NOT do
- No code changed. No flags flipped. No schema migrations. No deploy.
- This is an audit + blueprint only, per "STOP FOR REVIEW".

**→ Awaiting Founder GO/NO-GO and answers to D1–D5 before starting sub-phase 3.0.**
