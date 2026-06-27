# MX-700 · PHASE 2 — Business Model Audit

> **Read-only deliverable. No code modified, no flags flipped.** This phase questions *every* capability
> against business value and identifies duplication, dead weight, legacy, and debt. Verdicts
> (KEEP / SIMPLIFY / MERGE / MOVE / KILL) are **recommendations for Founder approval**, not actions —
> per the standing rule that audits STOP for approval before any change. All counts/claims are verified
> against the live tree (`backend/services` listing, `feature-flags.ts`, `.replit`, file line counts);
> honest "I could not confirm" is stated where it applies.

---

## 0. Executive summary

The honest business-model verdict: **CAPADEX's *substrate* is a genuine asset; its *implementation
sprawl* is a liability.** The platform has accreted, additively and behind flags, **dozens of
near-duplicate engines** (≈11 recommendation modules, ≈7 orchestrators, ≈6 resolvers, ≈4 memory stores,
≈5 adaptive modules, ≈5 simulation engines), **170 feature flags**, two parallel flag systems, two
concern resolvers, three stage taxonomies, and two web-server codebases. Most of the "intelligence"
this implies is **shipped OFF or offline**, so the *cost* (maintenance, cognitive load, audit surface)
is being paid without the *revenue* being earned.

**Three structural facts drive every recommendation below:**
1. **Value is concentrated, cost is diffuse.** ~90% of live user/business value flows through one thin
   path: concern → clarity questions → score → report. The other ~150 flags / dozens of engines carry
   most of the maintenance cost and almost none of the live value.
2. **"Built but OFF" is the dominant failure mode.** The decision/outcome/journey/commercial layers
   exist but are dormant — so they are simultaneously *technical debt* (must be maintained/reasoned about)
   and *unrealized business opportunity* (the funnel hand-off that would monetize CAPADEX is switched off).
3. **Duplication is the #1 simplification lever.** Collapsing the recommendation/orchestrator/resolver/
   memory families into one of each would remove more debt than any other single move, and is a
   prerequisite for the MX-700 "single decision engine" vision.

---

## 1. Capability-by-capability audit

Legend — **Verdict:** KEEP (core, leave) · SIMPLIFY (keep, reduce) · MERGE (fold into a sibling) ·
MOVE (wrong home) · KILL (retire/park).

### 1.1 Assessment runtime (the live core)
| Capability | Why it exists / business problem | Still required? | Duplicated elsewhere? | Verdict |
|---|---|---|---|---|
| Concern intake + resolution | Turn free-text worry into a routable concern — the funnel entry | **Yes — this IS the product** | **YES**: `concern-resolver-engine.ts` AND `resolveCapadexConcern()` in `routes/capadex.ts` are two resolvers | **MERGE** to one shared resolver (runtime + tooling import it) |
| Clarity question selection (3-tier picker) | Ask the right diagnostic items | Yes | Question selection logic also in competency `select` route + adaptive engine | **KEEP**, dedupe picker provenance |
| Scoring (0–100, level band, heatmap, patterns) | The deliverable | Yes | — | **KEEP** |
| Adaptive questioning | Personalize difficulty/depth | Yes (live) | **YES**: `adaptive-assessment-engine.ts` + `adaptive-assessment.ts` + `adaptive-branching-engine.ts` + `unified-adaptive-runtime-orchestrator.ts` | **MERGE/SIMPLIFY** to one adaptive path |

### 1.2 Behavioural ontology
| Capability | Why | Required? | Duplicated? | Verdict |
|---|---|---|---|---|
| Concerns master (~2.5k), clarity (~30k), 4-tier signal ontology (~16k atomic) | The proprietary IP / moat | **Yes — the real asset** | Join-key fragmentation (clarity `concern_id` DISJOINT from master; only `master_bridge_tag` works) | **KEEP**, fix join integrity |
| Ontology Hub admin | Curate the IP | Yes | — | **KEEP** |

### 1.3 Runtime intelligence spine (signal→evidence→composite→pattern)
| Capability | Why | Required? | Status | Verdict |
|---|---|---|---|---|
| Signal capture → composites → patterns → explainer | Convert answers into explainable behavioural evidence | Yes (this is the evidence base a decision engine needs) | Flag-gated, mostly OFF | **KEEP + ACTIVATE** (it is the foundation for MX-700) |

### 1.4 WC-3 intelligence layers (L1–L5, longitudinal)
| Capability | Why | Required? | Status | Verdict |
|---|---|---|---|---|
| L1 Stage / L2 Outcome / L3 Journey | Turn evidence into stage + outcome + product route | Yes (core to the vision) | **All flag-OFF** | **KEEP + ACTIVATE + RECONCILE** (stage taxonomy split) |
| L5A–D question/context/outcome/journey projections | Offline enrichment of the question bank | Partially | **Offline-only, never wired to a request path** | **SIMPLIFY**: keep the useful crosswalks, retire the rest as analysis artifacts |
| Longitudinal / trend / personalization | Cross-session intelligence | Future value | Flag-OFF | **PARK** until the live loop produces enough history to be honest |

### 1.5 Decision orchestration (WC-6 / WC-7B / WC-7C)
| Capability | Why | Required? | Status | Verdict |
|---|---|---|---|---|
| Decision orchestrator (activation envelope) | The "conductor" that fans one decision to destinations | **Yes — the heart of MX-700** | Flag-OFF, passive composer | **KEEP + PROMOTE** to active engine (Phase 3 of the re-arch) |
| Growth-plan / mentor / offer bridges | Monetization hand-off | Yes | Flag-OFF; growth-plan lives in M5 (decoupled) | **KEEP**, wire (don't rebuild — M5 plan exists) |

### 1.6 Pragati conversational runtime
| Capability | Why | Required? | Verdict |
|---|---|---|---|
| 13-state conversational FSM + safety/crisis layer | Empathetic intake + duty-of-care escalation | Yes (safety is non-negotiable) | **KEEP**; it is also the best template for the MX-700 Journey State Machine |

### 1.7 PIL (Problem Intelligence Layer) + knowledge graph
| Capability | Why | Required? | Verdict |
|---|---|---|---|
| Curated capability↔problem↔behaviour frames + `pil_kg_*` | Richer problem framing + recommendation intelligence | Uncertain business pull | **PARK/SIMPLIFY** — high complexity, flag-gated, unproven live demand. Keep the curated frames, defer the KG. ⚠️ namespace `pil_kg_*` only. |

### 1.8 Reporting / commercial
| Capability | Why | Required? | Status | Verdict |
|---|---|---|---|---|
| Assessment report + OMEGA-X (paid) | The monetized deliverable | Yes | Live | **KEEP** |
| Dynamic Report Intelligence 6C / Report Factory | Stakeholder + white-label reports | B2B future | Flag-OFF, zero rows in dev | **PARK** until a B2B buyer is real |
| Commercial family (entitlement/metering/recurring/upsell/renewal/invoice…) | Monetization spine | Yes eventually | **Entire family flag-OFF**; no decision→package mapping; entitlement non-blocking | **CONSOLIDATE + SEQUENCE** — too many sub-flags for an unactivated spine |

---

## 2. Duplicate logic (verified)

This is the largest and most actionable category.

| Duplication | Evidence (verified in `backend/services/`) | Business cost | Recommendation |
|---|---|---|---|
| **≈11 recommendation modules** | `recommendation-engine`, `recommendation-library`, `recommendation-rules`, `career-recommendation-engine`, `career-recommendation-aggregator`, `causal-recommendation-engine`, `ei-recommendation-engine`, `frp-recommendation-engine`, `lbi-recommendation-engine`, `mei-recommendation-engine`, `rie-recommendation-engine` | Every "next action" is computed a different way → no single explainable trail (the exact thing MX-700 demands) | **MERGE** into ONE Next-Best-Action ranker with pluggable domain scorers |
| **≈7 orchestrators** | `assessment-runtime-orchestrator`, `career-discovery-orchestrator`, `competency-intelligence-orchestrator`, `rie-intervention-orchestrator`, `stage-guidance-orchestrator`, `unified-adaptive-runtime-orchestrator`, `ucip-orchestration-adapter` | Overlapping "compose the pipeline" responsibilities; unclear which is authoritative | **MERGE** to one decision orchestrator (the WC-7B one) + thin domain adapters |
| **≈6 resolvers** | `concern-resolver-engine`, `atomic-bridge-resolver`, `bridge-tag-resolver`, `ei-resolver`, `job-store-resolver`, `viz-data-resolver` (+ `resolveCapadexConcern` inline) | Two concern resolvers can diverge; bridge resolution split across 3 files | **MERGE** concern resolution to one shared module; keep domain-specific resolvers but on a common contract |
| **≈4–5 adaptive modules** | `adaptive-assessment-engine`, `adaptive-assessment`, `adaptive-branching-engine`, `adaptive-blueprint-generation-engine`, `adaptive-difficulty-activation` | Adaptive decision logic forks; the live served bank can't even express the difficulty the engines compute | **SIMPLIFY** to one adaptive runtime |
| **≈4 memory stores** | `behavioural-memory` (DB), `longitudinal-memory`, `competency-memory-engine`, + in-memory `career-memory` | Same "remember the user" need solved 4 ways (one in-memory = lost on restart) | **MERGE** to one persistence-backed memory contract |
| **3 stage taxonomies** | 5-stage (backend), 4-code `CAP_*` (frontend), 3-stage (old report pages) | User-facing inconsistency; blocks any stage-keyed decision | **RECONCILE to one** (the MX-700 spine) — top priority |
| **2 flag systems** | file registry (`config/feature-flags.ts`, 170 flags) + DB table `feature_flags` | "Is X on?" has two answers; audits mis-measure | **DOCUMENT the boundary**, long-term unify |
| **2 web-server codebases** | `backend/` (8080) + `frontend/server/` (latent Express+JWT app) | Mentoring + richer subscription SQL live in the *other* server; decision engine can't reach them without a seam | **DECIDE canonical home** before wiring decisions to those destinations |

---

## 3. Dead / dormant features (verified)

| Feature | State | Business value today | Recommendation |
|---|---|---|---|
| Legacy `competency_*` tables | **Empty shells** (admin reads fall back to `onto_*`) | None | **KILL** (after confirming no reader) |
| Scaffolded competency phases (`competency_graph_*`/`propagation`/`fusion`/`ucip_*`/`sci_*`) | Migrations exist, tables empty, flags parkable | None live | **PARK** (flag-OFF) or **KILL** if no roadmap |
| WC-3 L5C/L5D projections, longitudinal | Offline scripts, never read by a request path | Analysis only | **DEMOTE** to audit artifacts; don't carry as "product" |
| Competitive-Exam product | `corpus_pending` stub; packages real but product empty | Negative (don't sell into an empty experience) | **KILL or finish** — do not leave half-sold |
| `frontend/server/` latent JWT app | Present, `node_modules` empty here (tests unrunnable) | Unclear if deployed | **INVESTIGATE & DECIDE** — dormant auth code is a security surface |
| ≈5 simulation engines (`career-simulation`, `m4`, `m5`, `workforce-v2`, `simulation/*`) + capadex-simulation (allowed-to-fail) | Mostly test/validation harnesses | Internal QA value, not user value | **CONSOLIDATE** the harnesses; keep one |

> **Correction to prior notes:** the previously-tracked archived duplicate `client-main-emergent-workzip/`
> **no longer exists** in the tree — it has been removed. No action needed there.

---

## 4. Legacy workflows

| Item | Evidence | Problem | Recommendation |
|---|---|---|---|
| **60 `FF_*` flags in the Backend API start command** | `.replit` workflow command | The live flag posture is encoded in a giant env string ≠ file defaults; impossible to reason about | **MOVE** flag posture to a single declarative source; shrink the command |
| **No central migration runner** | lazy `ensure*Schema()` mirrors each migration | Schema truth is scattered across services; drift risk | **SIMPLIFY** toward one runner (long-term) |
| **Backend runs on `tsx`, no typecheck/compile gate** | workflow + deploy notes | Type errors only surface at runtime; only real launch gate is the frontend vite build | **ACCEPT but document**; add CI typecheck as a non-blocking signal |
| **Cross-server seam** | `backend/` vs `frontend/server/` | Decision destinations split across servers | **RESOLVE** before activating bridges |

---

## 5. Technical debt

| Debt | Verified metric | Impact | Recommendation |
|---|---|---|---|
| **`routes.ts` monolith** | **14,464 lines** | Unreviewable; route-order traps; merge-conflict magnet | **SPLIT** by domain router (incremental, additive) |
| **`CareerBuilderPage.tsx` monolith** | **8,754 lines** | Same, on the frontend | **SPLIT** into feature components |
| **`FreeAssessmentModal.tsx`** | **3,169 lines** | The core funnel UI is one file | **SPLIT** by phase |
| **170 feature flags** | `feature-flags.ts` | Cognitive load; most default OFF | **PRUNE/GROUP** — retire flags whose phase is parked/dead |
| **Disjoint join keys** | clarity `concern_id` ⟂ master | Silent data gaps | **REPAIR** to a single canonical bridge |
| **Engine sprawl** (§2) | dozens of near-duplicate services | Maintenance × N | **CONSOLIDATE** (the single biggest debt-reduction move) |

---

## 6. UX debt

| Debt | Why it hurts the business | Recommendation |
|---|---|---|
| **3-way stage taxonomy surfaced to users** | Inconsistent language erodes trust in a *behavioural* product | Reconcile to one spine (gated) |
| **Adaptive feels static** — served clarity bank is ~100% "medium" | The headline "adaptive" promise isn't visible to users | **Author difficulty range** in the bank, then adaptivity becomes real |
| **Funnel hand-off is dormant** (growth-plan/mentor/offer OFF) | CAPADEX ends at a report; the user is not guided onward → lost conversion | **Activate the bridges** (MX-700 core) |
| **Report tone/visual canon** | Help-seeking users need hopeful, not clinical | Already partially addressed; keep the lightened canon |

---

## 7. AI debt

| Debt | Evidence | Impact | Recommendation |
|---|---|---|---|
| **AI is optional everywhere** | concern analysis/narrative fall back to regex/static; inert without `OPENAI_API_KEY` | Quality varies silently between AI-on and AI-off | **Declare the AI contract**: which features REQUIRE AI vs degrade, surface source tags (null ≠ 0) |
| **No AI evaluation/quality harness** beyond OMEGA-X scoring | — | Can't measure if AI narrative is *good*, only present | **ADD** an eval loop before leaning on AI for decisions |
| **Dormant AI layers** | PIL prediction, report narratives, personalization — flag-OFF | Paying for complexity without serving it | **PARK** until activated with an eval gate |
| **Provenance gap** | recommendation modules don't share an evidence trail | MX-700 demands "every recommendation explainable" — current sprawl can't deliver it | **Unify** behind the one NBA ranker with an evidence/rule trace |

---

## 8. Consolidation map (the recommended end-state — for Phase 3+, on approval)

```
KEEP (core asset, leave intact):
  ontology (concerns/clarity/4-tier signals), assessment scoring, Pragati + safety, paid report + OMEGA-X

ACTIVATE + RECONCILE (built-but-OFF → the MX-700 engine):
  runtime spine (signal→pattern) · WC-3 L1/L2/L3 · decision orchestrator + bridges
  → reconcile the 3 stage taxonomies to ONE spine first

MERGE (collapse the sprawl to one of each):
  11 recommendation modules → 1 Next-Best-Action ranker (pluggable scorers)
  7 orchestrators           → 1 decision orchestrator + thin adapters
  6 resolvers / 2 concern    → 1 shared concern resolver + common resolver contract
  5 adaptive modules         → 1 adaptive runtime
  4 memory stores            → 1 persistence-backed memory

PARK (flag-OFF, no roadmap pull yet):
  L5C/L5D projections, longitudinal/trend, PIL knowledge graph, 6C/Report Factory,
  most of the commercial sub-flag family (sequence behind one entitlement spine)

KILL (after confirming no reader):
  legacy empty competency_* shells, dead scaffolded competency_graph/propagation/fusion/ucip/sci phases,
  corpus_pending Competitive-Exam (or finish it), redundant simulation harnesses

INVESTIGATE/DECIDE:
  frontend/server latent JWT app (security surface) · cross-server canonical home · two flag systems
```

---

## 9. Open questions for the Founder (Phase 2 decisions)
- **Q1 — Kill vs park.** Do you want dead scaffolds (empty competency_* + parked phases) *removed* now, or
  left parked (flag-OFF) to preserve optionality? (Removal reduces debt; parking preserves future bets.)
- **Q2 — Competitive-Exam.** Finish the corpus, or retire the product and its packages?
- **Q3 — Consolidation appetite.** Is collapsing the recommendation/orchestrator/resolver/memory families
  in-scope for MX-700 (recommended), or out-of-scope (engine-by-engine activation only)?
- **Q4 — Commercial activation.** Is monetizing the funnel hand-off (growth-plan/mentor/offer + entitlement)
  a Phase-3 goal, or deferred?
- **Q5 — Second server.** Decide the canonical home (`backend/` vs `frontend/server/`) — this blocks
  wiring decisions to mentor + subscription destinations.

---

## 10. What I did NOT do
- No code changed, no flags flipped, no tables touched, no deploy. Audit + recommendations only.

**→ Phase 2 complete. Awaiting Founder review + answers to Q1–Q5 before Phase 3 (target architecture).**
Builds on `phase-1-current-state-discovery.md`; supersedes the earlier `capadex-phase-3/blueprint.md`.
