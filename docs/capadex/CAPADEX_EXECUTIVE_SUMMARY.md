# CAPADEX — Executive Summary

> **Document type:** Consolidation (source of truth). No audits, enrichment, architecture, or
> production changes were made to produce this package — it captures the *current* state of CAPADEX
> for long-term use across MetryxOne.

---

## 1. Vision

CAPADEX is MetryxOne's **behavioural intelligence engine** — the layer that turns a person's
free-text concern and a short adaptive assessment into a structured, explainable, longitudinal
picture of how they think, decide, and grow. It is designed to be the **upstream source of
behavioural truth** that every downstream MetryxOne product (LBI, Career Builder, Employability
Index, Competency Intelligence, Competitive Exam Intelligence) consumes.

## 2. Purpose

To replace generic, self-report personality scoring with **developmental, concern-diagnostic
behavioural signals** that are: evidence-derived (never fabricated), explainable (every insight
traces to a lineage), reversible/additive (new layers never overwrite prior behaviour), and
governed (human-in-the-loop for question lifecycle and ontology change).

## 3. Problem CAPADEX Solves

People describe problems in their own words ("I freeze before exams", "I can't pick a career
path"). Traditional assessments cannot route that to the right questions, measure the underlying
behaviour, or explain the result. CAPADEX solves three coupled problems:

1. **Routing** — map free text → the correct concern → the correct clarity questions.
2. **Measurement** — convert answers into evidence → signals → composites → patterns, with
   confidence bands.
3. **Explainability & longitudinality** — stitch per-session outputs into one behaviour graph and
   track drift/growth across sessions, all human-explainable.

## 4. Architecture Overview

CAPADEX is a layered, additive system:

- **Ontology** — 4-tier signal taxonomy (20 domains → 400 families → 20 signals → 15,972 atomic
  signals) plus a Concerns Master (~2,489 rows) and a Clarity Question bank (~30,638 rows) joined by
  **bridge tags** (~325).
- **Metadata layer** — per-question dimensions (age, persona, stage, capability, behaviour, signal,
  context, archetype). Coverage is high; *per-question differentiation* is the open work (see §9).
- **Runtime** — `FreeAssessmentModal` (9 phases) over a 3-tier clarity-question picker, with
  deterministic fallbacks that never 404 and never fabricate.
- **Intelligence engines** — additive, read-only re-shapers: signal capture → composite/pattern
  (OMEGA-X Bayesian) → intervention → CSI → unified behaviour graph → recommendation/knowledge-graph
  (PIL). Each is flag-gated; flag-off is byte-identical to legacy.
- **Scoring** — QIS / QIS V2 (question intelligence), AIS / Trust (assessment confidence), CSI
  (longitudinal stability), Differentiability (pool distinguishability), QRS (routing readiness).

## 5. Current Status

**Operational** at runtime: ontology, bridge-tag/signal grounding, metadata coverage, the assessment
flow, scoring, and the additive intelligence engines. **Context + Archetype** question dimensions
have been **shipped repository-wide** (prior C-2) and **validated** by the C-1A pilot. The remaining
per-question dimensions (capability/behaviour/signal) are **architected, piloted, and approved with
modifications** but **not yet rolled out** — they are gated behind coverage/grounding rules and
mandatory measurement (C-1AR Waves 2–4).

**Recommended version: CAPADEX v0.9** (production-capable runtime; not yet data-complete on
per-question differentiation). See `CAPADEX_STATUS.md`.

## 6. Major Findings (from the audit chain)

- **The question-intelligence problem is architectural, not a metadata gap.** Metadata coverage is
  ≥99% on five of six legacy dimensions, but it is **flat** — derived at *tag* granularity and
  inherited by every question. Repository differentiability is **0.096**; `dev_stage` alone carries
  ~97% of all realized differentiation (C-1).
- **High-value dimensions are dormant, not missing.** Capability (286 values) and behaviour (119)
  have full coverage but one value per tag → 0 contribution.
- **Signal is a coverage problem first.** 44.2% of questions have no signal; 144 tags / 13,538
  questions are signal-blind.
- **Context and Archetype were entirely new architecture** (no columns existed) — now shipped.

## 7. Pilot Results (C-1A Pilot, sandbox-only, 10 worst tags / 7,060 questions)

- Coverage-weighted differentiability **0.098 → 0.240 (+145%)** (raw-where-present +336%).
- Contribution to the gain: **Archetype 62.1% · Capability 30.7% · Behaviour 6.8% · Signal 0.4% ·
  Context 0% within-tag**.
- Routing precision **+39 to +87 pp** across 4 of 5 readiness contexts.
- **Headline correction:** signal backfill is **not** the "cheapest, first" move for the flagship
  generic pools — 9 of 10 are ungrounded; per-question signal evidence survives at only **1.2%**.

## 8. Proven Strengths

- A runtime that **never 404s and never fabricates** (deterministic 3-tier fallback; UNCLASSIFIED
  when no evidence).
- **Archetype + Context** deliver real, measured value (form diversity + routing precision).
- A fully **additive, flag-gated** engine stack — every phase is reversible and byte-identical when off.
- **Honest measurement discipline** — coverage-weighted reporting, two-frame honesty, non-fabrication
  enforced end-to-end.

## 9. Known Limitations

- Repository **differentiability is still low (~0.096 baseline)** until Waves 2–4 roll out.
- **Capability** enrichment is capped at ~49% coverage from question text alone.
- **Behaviour** is evidence-blocked from question text (~10% coverage) — needs curated authoring.
- **Signal** backfill is grounding-blocked on the flagship pools (25 ungrounded tags).
- **Context corpus gap** — no Academic/Competitive-Exam context in the generic pools (routes 0).

## 10. Deferred Improvements

Signal grounding expansion (WC-class) for 25 ungrounded tags; capability evidence broadening
(options + anchors + curated facets); curated behaviour sets; context-corpus authoring. Full list and
priorities in `CAPADEX_DEFERRED_BACKLOG.md`.

## 11. Readiness Assessment

| Layer | State |
|---|---|
| Ontology / bridge-tag / signal-grounding / metadata coverage | **Operational** |
| Assessment runtime + scoring + additive engines | **Operational** |
| Context + Archetype question dimensions | **Shipped & validated** |
| Per-question capability/behaviour/signal differentiation | **Architected, piloted, deferred (gated)** |
| Question-level differentiation metric | **Below target** (0.096; pilot proved the lift path) |
| **Verdict** | **Production-capable (v0.9); data-completion (v1.0) pending C-1AR Waves 2–4** |

## 12. Recommended Next Steps

1. **Approve this consolidation package** as the CAPADEX source of truth.
2. **C-2 Wave 1 verification gate** — AQ-2R measurement of the already-shipped Context + Archetype
   (measurement only; no enrichment).
3. **C-2 Wave 2 (Capability, coverage-gated)** with evidence broadening.
4. Then **Waves 3–4** (signal grounding-conditional; behaviour curated; context corpus) — each
   flag-gated, reversible, behind the measurement gate.
5. Begin **LBI integration** against the stable CAPADEX outputs (behaviour graph + signals).

## 13. Relationship to Downstream Systems

- **LBI (Learning/Behavioural Intelligence)** — consumes CAPADEX signals/patterns as the behavioural
  substrate for longitudinal learning intelligence; first downstream consumer.
- **Career Builder** — consumes the CAPADEX behaviour graph via `career-behavior-adapter` to shape
  role recommendation, job ranking, and IDP (only when a real linked session exists).
- **Employability Index** — consumes readiness/behaviour signals into the employability passport and
  index.
- **Competency Intelligence** — uses CAPADEX construct/stage signals to contextualize competency
  scoring and question selection.
- **Competitive Exam Intelligence** — would consume exam-readiness context + behaviour signals; today
  blocked by the context-corpus gap (no Academic/Competitive context in the generic pools).

Recommended platform sequence: **CAPADEX → LBI → Career Builder → Employability Index → Competency
Intelligence → Competitive Exam Intelligence** (see `CAPADEX_HANDOFF_TO_MTERYXONE.md`).
