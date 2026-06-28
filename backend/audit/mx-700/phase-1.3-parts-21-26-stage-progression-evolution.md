# CAPADEX 2.0 — Phase 1.3 (cont.): Parts 21–26 — Stage, Progression & Evolution Constitutions

> **Execution mode:** ENHANCEMENT-ONLY · completes & freezes the Product Constitution. **No code modified, no UI changes, no workflow redesign, no dormant activation, no business-logic change.** This `.md` is the only artefact.
> **Honesty contract:** *measured* = MEASURED; *judgement* = DERIVED. flag-ON ≠ activated; null ≠ 0; Coverage ⟂ Confidence. Existing stage taxonomy is **SPLIT** (BE 5-stage vs FE `CAP_*` 4-code) and is reconciled, not silently re-decided.
> **Basis:** Phase 1.3 Product Constitution + Phase 0/0.1 + memory (`capadex-decision-chain-gaps`, `l5c-runtime-outcome-projection`, `concern-resolver-repair`, `wc-c1-commercial-readiness`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.3 Parts 21–26 (Product Constitution freeze).

---

## PART 21 — Stage Constitution

> ⚠ **Existing reality (MEASURED):** the platform already has a **split** stage taxonomy — backend ~5-stage vs frontend `CAP_*` 4-code (memory `capadex-decision-chain-gaps.md`). This constitution defines the **canonical product stage model**; any stage-keyed UX MUST reconcile to it via a bridge, never fork a third taxonomy.

Nine product stages. For each: Purpose · Inputs · Outputs · Owner · AI · Behaviour · Reports · SuperAdmin visibility · Completion · Transition.

| Stage | Purpose | Inputs | Outputs | Owner | AI | Behaviour | Reports | SA visibility | Completion | Transition |
|---|---|---|---|---|---|---|---|---|---|---|
| **Behaviour** | establish behavioural baseline | signals, clarity responses | signal→composite→pattern→graph | Behaviour Engine | explain | **origin** | behaviour report | ontology hub | spine populated for user | → Assessment |
| **Assessment** | measure via conversation | persona, concern, question banks | scored profile + provenance | Assessment Engine | adapt/guide | measured | CAPADEX/competency report | reports console | required modules answered | → Journey (never score-terminal) |
| **Journey** | continue improvement | assessment output, growth plan | active journey + milestones | Journey/M5 + Orchestrator | coach | improves | journey-integrated report | journey admin | first milestone set | → Learning/Career/Decision |
| **Learning** | develop behaviour | gaps, learning intelligence | learning path + progress | Learning Engine | educate | develops | progress report | — | path assigned | ↔ Career |
| **Career** | apply behaviour to work | competency, market, role-DNA | readiness/gap/match/roadmap | Career OS/CGI | recommend | reflects | career reports | — | readiness computed | ↔ Decision |
| **Life** | lifelong context | longitudinal memory | life-stage framing | Life layer | guide | reflects | life report | — | longitudinal record exists | continuous |
| **Conversation (Pragati)** | adaptive dialogue | persona, concern, FSM state | conversational guidance | Pragati FSM | reason+safety | understands | session report | flow-config admin | session resolved/safe-exit | feeds any stage |
| **Decision** | convert insight to choice | journey, outcome projection | decision + alternatives | Decision Orchestrator (DORMANT) | recommend+explain | reflects | decision report | — | decision recorded | → Intervention/Subscription |
| **Intervention** | act on the decision | decision, entitlement | intervention + explainability | Intervention Engine | guide | influences | intervention report | — | intervention delivered | → next Journey loop |

**Binding rules:** no stage bypasses the Behaviour Engine; the Decision/Intervention stages exist in code but are **DORMANT** (flag-ON, no default-path data) — this constitution defines them so a future **activation** phase has a target, but defining ≠ activating.

---

## PART 22 — Progression Constitution

Every user must ALWAYS be able to see: **Current Stage · Previous Stage · Next Stage · Completion % · Behaviour Growth · Learning Growth · Career Growth · Life Growth · Subscription Progression.**

This becomes the **product rule for all future UX** — every primary surface answers "where am I in my progression?" Honesty rules:
- Growth values are **measured or null** — never 0-as-placeholder (memory `longitudinal-consumption-null-coercion.md`).
- Completion % is over **declared required steps**, not just present ones (denominator honesty).
- Progression reads compose existing longitudinal/memory layers (WC-L*); they never recompute or fabricate a stage the user has not reached.
- A stage with no data shows **"not yet started"**, never a synthetic in-progress state.

---

## PART 23 — Explainability Constitution

**Mandatory for every recommendation (AI and reports).** Each recommendation must surface:
1. **Why this recommendation?**
2. **Which behaviours influenced it?**
3. **Which concerns contributed?**
4. **Which evidence was used?**
5. **Confidence level.**
6. **Alternative recommendations.**
7. **Why alternatives were not selected.**

Binding: no recommendation ships without all seven. Confidence is **deterministic** (derived from gap/transferability/mobility evidence, not a model guess); when evidence is insufficient the recommendation **abstains** rather than emitting an unexplained suggestion. Reuses the existing insight-explainer / recommendation-intelligence — never a parallel explainer.

---

## PART 24 — Evidence & Confidence Constitution

| Element | Constitution |
|---|---|
| **Evidence sources** | behavioural signals, assessment scores, competency genome (`onto_*`), longitudinal history, market/role-DNA, employer-realized outcomes. Each tagged with a **source provenance**. |
| **Evidence weighting** | measured evidence > borrowed/prior; a **borrowed prior never upgrades TRUST** (memory `employer-tig-architecture.md`); domain-proxy ≠ precise (kept distinct). |
| **Confidence calculation** | deterministic from evidence mix; report **Coverage (data exists) ⟂ Confidence (trustworthy)** as separate axes — never composited into one number. |
| **Low-confidence handling** | surface the limitation explicitly; degrade gracefully; AI-inert → null + source tag. |
| **Abstention rules** | abstain below **k_min=30** (peer/benchmark) and when required evidence is absent; PARTIAL verdict until realized pairs ≥ k_min; abstain ≠ 0. |
| **User-facing presentation** | confidence shown as an honest band with its basis; "provisional" labelling when sampleSize < 30; never present a borrowed/abstained value as measured. |

---

## PART 25 — Subscription Progression Constitution

**Subscriptions do not merely unlock features — they EVOLVE.** Progression is **personalised and continuous**, driven by: Persona · Concern · Behaviour maturity · Journey stage · Career stage · Learning stage · Life stage · Enterprise role · AI usage.

Binding:
- Reuse the existing packages + entitlement spine (fail-closed; ledger = paid `capadex_payments` only); progression is additive metadata over it, never a parallel billing system.
- Recommendations to upgrade/evolve must follow the **Explainability Constitution** (Part 23) — say *why this plan, what it unlocks for the user's current stage, alternatives*.
- Never fabricate refund/credit without a real refunded payment; usage metering keys to the **server principal** (IDOR guard), three honest counting kinds (period/level/credit-balance).
- The package→entitlement gap (`users` has no email col) is a documented existing limitation — close additively, do not paper over.

---

## PART 26 — Future Evolution Constitution

CAPADEX is designed to evolve through **new behaviour models · new concern domains · new personas · new AI capabilities · new stages · new enterprise modules · new analytics · new industries** — **without breaking core architecture or existing user journeys.**

Evolution rules (the freeze contract):
1. **Additive & flag-gated** — every new model/domain/persona/stage ships behind a default-OFF flag; flag-OFF is byte-identical incl. schema.
2. **Extend, never fork** — new behaviour/concern/competency work extends `onto_*` / Concern Master / signal ontology; **no `*V2`/`New*` namespaces** (Engineering Constitution).
3. **DB extend-only** — new domains add tables/columns (migration + ensure-schema lockstep); never DROP/DELETE/break relationships.
4. **Journeys are forward-compatible** — a new stage/model must slot into the Stage Constitution (Part 21) without invalidating an in-flight user journey.
5. **Honest abstention on cold start** — a new domain with no data abstains and reports "not yet populated"; existence ≠ population.
6. **Governance gates apply** — every evolution passes the Product (1.3 P18) + Engineering (1.2 P23) review boards and both Definitions of Done.

---

## Product Constitution — FREEZE

With Parts 1–26 (Phase 1.3 + this addendum), the **Product Constitution is complete and frozen**. It is permanent governance; it changed nothing in the running product.

**Full deliverable set (Phase 1.3, 1–15) + addendum (16–21):**

| # | Deliverable | Section |
|---|---|---|
| 16 | Stage Constitution | Part 21 |
| 17 | Progression Constitution | Part 22 |
| 18 | Explainability Constitution | Part 23 |
| 19 | Evidence & Confidence Constitution | Part 24 |
| 20 | Subscription Progression Constitution | Part 25 |
| 21 | Future Evolution Constitution | Part 26 |

---

**STOP — Phase 1.3 Parts 21–26 complete; Product Constitution frozen. No workflows redesigned, no UI changed, no dormant capability activated, no business logic changed.**
Honesty caveats: the canonical 9-stage model is DERIVED to UNIFY the existing SPLIT taxonomy (BE 5-stage vs FE `CAP_*` 4-code) — adopting it in code is a future reconciliation phase, not done here; the Decision & Intervention stages are defined-but-DORMANT (flag-ON, no default-path data) — defining them is governance, activating them is a separate Founder-approved phase.
