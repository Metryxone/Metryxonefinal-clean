# MX-700 · PHASE 3 — Global Research & Benchmarking

> **Read-only deliverable. No code modified.** External research grounded via live web search (Oct 2025–
> 2026 sources cited inline). Per the Founder directive: **do not copy products — extract principles.**
> Every principle below ends with a **→ CAPADEX implication** tying it back to the Phase 1/2 findings, so
> Phase 4 (target architecture) can act on it. Honesty rule applies: claims are sourced; where the field
> itself is unsettled (e.g. LLM-agent reliability) it is stated as unsettled, not as settled fact.

---

## 0. Executive summary

Benchmarking CAPADEX against the global leaders across nine categories yields one dominant conclusion:
**the world-class players have converged on a shared architecture, and CAPADEX already has most of its
pieces — but assembled in the wrong order and switched off.** The convergent pattern is:

> **A canonical skills/competency *ontology* (graph, not list) → *inference* of latent ability from sparse
> evidence → *adaptive measurement* (IRT/CAT-style) → an *explainable* recommendation/decision layer →
> *continuous* re-guidance over a *lifecycle*, with AI used as an *inference + narration* layer on top of
> a *deterministic, auditable* spine.**

CAPADEX has: a real ontology (the moat), an evidence spine, adaptive logic, a decision orchestrator, and
a lifecycle/stage model. What it lacks versus the leaders is: (a) **graph-based skills inference** (the
Eightfold/Lightcast "ontology not taxonomy" move), (b) **psychometrically rigorous adaptivity** (IRT/CAT
vs the current flat-difficulty bank), (c) a **live, explainable decision layer** (built but OFF), and
(d) **continuous guidance** (the leaders re-guide constantly; CAPADEX ends at a report).

The five principles that matter most for MX-700: **(1) ontology-as-graph**, **(2) infer don't just
measure**, **(3) deterministic spine + AI as a thin inference/narration layer**, **(4) explainability is
a product feature not a compliance checkbox**, **(5) guidance is continuous, not a one-shot report.**

---

## 1. Category-by-category benchmark

| # | Category | Exemplars studied | What the leaders actually do | CAPADEX gap |
|---|---|---|---|---|
| 1 | **AI career guidance** | Eightfold, Gloat, Fuel50 | AI-native, deep-learning models trained on global career-trajectory data infer *adjacent skills* + *learnability/potential*, then path to roles | CAPADEX routes concern→report; no adjacency/potential inference, no role pathing live |
| 2 | **Career development** | Fuel50, 365Talents, Cornerstone | Skills-based growth plans tied to internal opportunities (mentoring, gigs, learning) | Growth-plan exists (M5) but bridge is flag-OFF |
| 3 | **Competency intelligence** | SFIA 9, ESCO, O*NET | Standardized, versioned competency frameworks with levels/descriptors used as the shared vocabulary | CAPADEX has `onto_*` genome but isn't crosswalked to a public standard as authority |
| 4 | **Learning personalization** | Duolingo (Birdbrain), Khanmigo, ALEKS | ML predicts P(correct) per item → dynamic difficulty/sequencing/spacing; LLM tutor *on top* | Adaptive logic exists but served bank is flat-difficulty → adaptivity invisible |
| 5 | **Skills intelligence** | Lightcast, SkyHive, TechWolf, Draup | **Ontology (knowledge graph) not taxonomy** — relationships *between* skills/roles/tasks, continuously refreshed from labor-market signal | CAPADEX ontology is hierarchical (4-tier tree) + disjoint join keys; not a true graph |
| 6 | **Adaptive assessment** | IRT/CAT (GMAT, Duolingo English Test, ALEKS) | Latent-trait estimation; each item selected to maximize information at the current ability estimate; precision-based stopping | CAPADEX uses heuristic streak/confidence rules, not IRT; no item-information selection |
| 7 | **Career mobility** | Gloat, Fuel50 talent marketplaces | Match people↔opportunities by skills + potential; surface adjacent moves | Not live; talent-matching flag-OFF |
| 8 | **Talent intelligence** | Eightfold, Beamery, SeekOut | Unified candidate/employee graph; explainable match with reasons | Employer side exists (TIG) but candidate-side decisioning OFF |
| 9 | **Workforce intelligence** | Visier, Workday Skills Cloud | Aggregate people data → workforce context → *trustworthy* recommendations + planning | Enterprise analytics flag-OFF; k-anon discipline already present (a strength) |

---

## 2. Best practices (extracted principles)

**P1 — Ontology as a living graph, not a static taxonomy.**
Lightcast/SkyHive/TechWolf draw the line explicitly: a *taxonomy* is a parent-child tree; an *ontology*
maps relationships *between* skills, roles, and tasks as a dynamic knowledge graph, refreshed from
real-world signal. The graph is what enables adjacency, transferability, and pathing.
**→ CAPADEX:** the 4-tier tree + `pil_kg_*` should converge into ONE behavioural↔competency↔outcome graph;
fix the disjoint `concern_id`/`master_bridge_tag` join (Phase 2 §5) — a broken edge breaks inference.

**P2 — Infer latent ability, don't only measure observed answers.**
Eightfold's whole thesis is inferring *adjacent skills* and *learnability* from sparse data; IRT estimates
a latent trait rather than counting correct answers; Duolingo's Birbrain predicts P(correct) per item.
**→ CAPADEX:** scoring is currently additive-over-answers. Add a latent-ability/inference layer so CAPADEX
can say "you likely have X (adjacent), and could reach Y (learnable)" — not just "you answered Z."

**P3 — Deterministic, auditable spine with AI as a thin layer.**
Across the field, the durable systems keep a deterministic core (rules/psychometrics/graph) and use ML/LLM
for *inference* and *narration* on top — because the core must be explainable and reproducible.
**→ CAPADEX:** this matches the existing "AI degrades to regex/static, null≠0" posture (a strength).
Formalize it: AI is an *enrichment* layer; the decision spine is deterministic and replayable.

**P4 — Explainability is a product feature, not a compliance checkbox.**
65%+ of organizations cite lack of explainability as the #1 barrier to AI adoption (ahead of cost). The
mature pattern: **reasons-for-recommendation** (why this), **counterfactuals** (what would change it),
**model/decision cards** (provenance + confidence + limits). Spotify-style "because you…" demonstrably
lifts trust.
**→ CAPADEX:** the patterns engine already produces explanations; promote them to first-class
"why this guidance / what would change it" surfaces. This also kills the Phase 2 finding that the 11
recommendation modules share no evidence trail.

**P5 — Psychometric rigor in adaptivity.**
CAT selects each item to maximize *information* at the current ability estimate and stops on *precision*,
not a fixed count. Time-sensitive IRT models are an active 2025 research front.
**→ CAPADEX:** replace heuristic streak/confidence rules with item-information selection — but this REQUIRES
authoring a real difficulty range in the clarity bank first (the flat-difficulty gap is the blocker, Phase 2 §6).

**P6 — Standards crosswalk for authority and portability.**
SFIA 9 (Oct 2024), ESCO, O*NET are the lingua franca; serious platforms crosswalk to them for credibility
and interoperability.
**→ CAPADEX:** crosswalk `onto_*` to O*NET/ESCO/SFIA (some O*NET derivation already exists) so the genome
carries external authority, not just internal definitions.

**P7 — Coverage ⟂ Confidence, always separated; suppress below k.**
Visier sells "recommendations you can trust"; workforce tools lead with trust + k-anonymity.
**→ CAPADEX:** already a documented strength (k_min=30, Coverage vs Confidence as separate axes). Keep it;
it is genuinely best-in-class discipline.

---

## 3. Common mistakes (anti-patterns to avoid)

| Anti-pattern | Evidence from the field | CAPADEX risk |
|---|---|---|
| **Biased/overfit training data** | 61% of AI recruitment tools trained on biased data replicated discriminatory patterns (2022) | If CAPADEX adds ML inference, it must not learn historical bias; keep developmental-signal language, never hiring prediction |
| **Black-box recommendations** | #1 adoption barrier; regulatory pressure (EU AI Act, US) | The 11-module recommendation sprawl is already a black box internally — unify with a trace |
| **Opaque "AI score" with no provenance** | erodes trust, invites legal exposure | Keep null≠0, source tags, confidence — don't paper over gaps |
| **One-shot assessment, no follow-through** | learners/users churn without continuous guidance | CAPADEX ends at a report (Phase 2 UX debt) — the core thing to fix |
| **Taxonomy mistaken for ontology** | flat lists can't infer adjacency | CAPADEX's tree + disjoint joins limit inference |
| **Difficulty/personalization claimed but not delivered** | undermines the headline promise | flat-difficulty bank makes "adaptive" invisible |
| **Over-trusting LLM agents** | 2025 reliability still unsettled; hallucination in high-stakes guidance | keep LLM as enrichment, never the sole decision authority |

---

## 4. AI usage models (a taxonomy for CAPADEX to choose from)

The field uses AI at three distinct layers — and the durable systems are explicit about which is which:

1. **Deterministic / psychometric core** (IRT, rules, graph traversal): reproducible, explainable, the
   system of record for *decisions*. *(CAPADEX: scoring, concern resolver, decision orchestrator.)*
2. **ML inference layer** (deep models à la Eightfold/Birdbrain): predicts latent ability, adjacency,
   learnability, P(correct). Probabilistic, must be monitored for bias, outputs carry confidence.
   *(CAPADEX: currently absent — the biggest capability gap.)*
3. **LLM narration / agent layer** (Khanmigo, AI career-coach agents — a $5.5B→$6.7B market growing ~22%
   CAGR): explains, converses, coaches. Powerful but unreliable for high-stakes decisions → must sit on
   top of layers 1–2, never replace them. *(CAPADEX: concern analysis + Pragati + report narrative; keep
   it enrichment-only with the existing graceful-degradation contract.)*

**Principle:** decisions come from layers 1–2 (auditable); layer 3 makes them human. Never invert this.

---

## 5. Explainability approaches (concrete patterns to adopt)

- **Reasons-for-recommendation** ("you're seeing this because…") — the highest-ROI, lowest-cost pattern.
- **Counterfactual explanations** ("if X were different, this would change") — actionable, builds agency.
- **Model/decision cards** — provenance, training/derivation source, confidence, known limits, what it is
  NOT for (e.g. "developmental signal, not a hiring prediction" — already CAPADEX language policy).
- **Confidence + coverage surfaced separately** — never a single composite number.
**→ CAPADEX:** the explainer + patterns engine + language-policy envelopes already provide raw material;
make them user-visible and attach them to *every* recommendation from the unified NBA ranker.

---

## 6. Continuous guidance models

The leaders do **not** ship a one-shot assessment. They run a loop:
**assess → guide → act → re-observe → re-guide.** Talent marketplaces (Gloat/Fuel50) continuously re-match
as skills/opportunities change; Duolingo re-estimates ability every session; Visier continuously refreshes
workforce context. AI career-coach agents are explicitly "continuous."
**→ CAPADEX:** this is the single biggest product shift implied by MX-700. The pieces exist
(longitudinal/trend/memory layers) but are flag-OFF and offline. The target is a *standing* guidance loop
keyed to the user, not a terminal report. Pragati's FSM is the best in-house template for the loop's
conversational surface.

---

## 7. Lifecycle models

Two distinct lifecycle axes appear in the field, and conflating them is a known mistake (it's also a
Phase-1 CAPADEX honesty trap):

- **Career/role lifecycle** (Discover → Explore → Develop → Mobilize → Lead) — Eightfold/Gloat/Fuel50
  organize guidance along this. *External, role-oriented.*
- **Mastery/learning lifecycle** (Awareness → Curiosity → Clarity → Growth → Mastery, or IRT ability
  bands) — Duolingo/ALEKS organize *measurement* along this. *Internal, ability-oriented.*

**Principle:** keep the two axes orthogonal and explicit. A user has a *career stage* AND a *behavioural
mastery level*; guidance is the intersection.
**→ CAPADEX:** reconcile the 3 internal stage taxonomies into ONE behavioural-mastery axis (Phase 2 §2),
and keep the career-stage axis (experience-routing) separate — never composite them (this is already a
documented trap; the field confirms it's the right call).

---

## 8. Synthesis — the principles that should shape CAPADEX's target architecture

| Principle | Source pattern | What CAPADEX already has | What Phase 4 must add |
|---|---|---|---|
| Ontology-as-graph | Lightcast/SkyHive | 4-tier ontology + PIL KG | unify to one graph; fix joins |
| Infer, don't only measure | Eightfold/IRT/Birdbrain | additive scoring | a latent-ability/adjacency inference layer |
| Deterministic spine + thin AI | whole field | exactly this posture | formalize the contract |
| Explainability as feature | XAI 2025 | explainer + patterns + language policy | reasons + counterfactuals on every rec |
| Psychometric adaptivity | CAT/IRT | heuristic adaptive engine | item-info selection + authored difficulty |
| Standards crosswalk | SFIA/ESCO/O*NET | partial O*NET derivation | full crosswalk for authority |
| Coverage ⟂ Confidence, k-anon | Visier | already best-practice | keep; extend to all surfaces |
| Continuous guidance loop | Gloat/Duolingo/coach-agents | longitudinal/memory (OFF) | activate the standing loop |
| Orthogonal lifecycle axes | Eightfold + ALEKS | both axes exist | keep separate; reconcile the mastery axis |

---

## 9. "Do not copy" discipline
This document extracts *principles and patterns* (IRT, ontology-graph, XAI patterns, continuous-loop,
orthogonal lifecycles) — not product features, copy, UI, or proprietary algorithms. No competitor IP is
reproduced. Public frameworks (SFIA/ESCO/O*NET, IRT/CAT) are open standards and are cited as such.

## 10. What I did NOT do
- No code changed, no flags flipped, no deploy. Research + principle extraction only.

**→ Phase 3 complete. Awaiting Founder review before Phase 4 (Target Architecture & Re-Design).**
Builds on `phase-1-current-state-discovery.md` + `phase-2-business-model-audit.md`.

---

### Sources (representative; accessed 2025–2026)
- Eightfold AI talent intelligence (eightfold.ai; Gartner Peer Insights; S&P Global partnership 2025-10-23)
- SFIA 9 framework (sfia-online.org, published Oct 2024); ESCO; O*NET
- IRT/CAT best practices (arXiv 2508.08643 "Analytics of Adaptive Online Testing"; MDPI time-sensitive IRT 2025)
- Duolingo Birdbrain (IEEE Spectrum); Khanmigo; Knewton pitfalls
- Lightcast Open Skills taxonomy/ontology (lightcast.io/open-skills); SkyHive; TechWolf; Draup
- Explainable AI 2025 (Nitor Infotech; NCBI PMC12546238 explainable person–job recommendations)
- Visier Workforce Intelligence (visier.com; Brandon Hall Group 2025); Beamery; SeekOut; Workday Skills Cloud
- AI recruitment bias (ABA 2024; SHRM); AI career-coach market sizing (2025–2026 CAGR ~22%)
