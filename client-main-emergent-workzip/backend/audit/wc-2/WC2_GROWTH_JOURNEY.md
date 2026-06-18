# WC-2 · Output 5 — Growth Journey Architecture

> Design + honest measurement. Positions CAPADEX as the gateway into the MetryxOne ecosystem. Design
> only; no routing changes executed.

## Scorecard

| Field | Value |
|---|---|
| **Current Score** | **50 / 100** |
| **Stated WC-2 Target** | > 90 |
| **Realistic Target Band** | **80–88** |
| **Gap (to realistic band)** | ~30–38 points |
| **Evidence** | Routing pathways partially exist: context shipped (+39–87 pp routing precision in pilot); behaviour graph + handoff APIs to Career Builder / Employability / Competency are live. But there is **no formal Awareness→Mastery journey per pathway**, and **Competitive-Exam routing is 0** (corpus gap). |
| **Root Cause** | CAPADEX has **handoff plumbing** but no **journey model** — no explicit progression framework binding stages to downstream pathways. |
| **Estimated Effort** | Medium (design + reuse of QRS, behaviour graph, stage framework). |
| **Expected Impact** | Turns CAPADEX from a terminal report into the **front door** of the ecosystem — the strategic objective of WC-2. |

### Ceiling note
**> 90** repo-wide is gated by the Exam pathway (corpus 0). Realistic band **80–88**; the
Learning/Career/Employability pathways can individually reach 90.

## Phase 1 — Routing pathways (design)

| Pathway | Trigger (existing signal) | Destination | State |
|---|---|---|---|
| **Learning Excellence** | learning-effectiveness outcome + LEARNING_ADAPTABILITY signals | **LBI** | Plumbing pending LBI integration |
| **Career Development** | career-clarity outcome + behaviour graph | **Career Builder** | **Live** (career-behavior-adapter) |
| **Employability** | employability-readiness outcome | **Employability Index** | Live (passport) |
| **Competitive Exam Success** | exam-readiness outcome | **Exam Intelligence** | **Blocked** (context corpus 0) |

## Phase 2 — Models (design)

### `routing_readiness_model`
`readiness(pathway) = f(outcome_score, signal_coverage, context_match, stage)` — composes the QRS
(0.30 age + 0.25 persona + 0.25 context + 0.20 stage) with the relevant outcome model. Output: a
ranked pathway set per user.

### `routing_confidence_model`
`confidence(pathway) = mean(contributing *_confidence) × coverage_factor × k-anonymity_gate`. Below
the gate → pathway suppressed (no low-confidence routing).

### `growth_journey_model`
Binds the **stage_framework** to each pathway: a user occupies a stage *within* a pathway, and the
journey model tracks movement across stages and (eventually) across pathways.

## Phase 3 — `journey_progression_framework` (design)

For **every** pathway, the progression is:

```
Awareness → Curiosity → Clarity → Growth → Mastery
```

- **Awareness/Curiosity** happen inside CAPADEX (concern resolution + assessment).
- **Clarity** is the CAPADEX report (patterns understood).
- **Growth/Mastery** happen in the destination system (LBI / Career Builder / Employability / Exam),
  fed by the CAPADEX behaviour graph.

CAPADEX thus owns Awareness→Clarity and **hands off at the Clarity→Growth boundary** — the contract in
`CAPADEX_HANDOFF_TO_MTERYXONE.md`.

## Smallest set of changes toward world-class

1. **Specify the three models** (`routing_readiness` / `routing_confidence` / `growth_journey`) as
   compose-only layers over QRS + outcome models + stage framework.
2. **Formalise the Clarity→Growth handoff** per pathway (already plumbed for Career/Employability).
3. **Sequence LBI integration first** (next platform project) to light up the Learning pathway.
4. **Defer the Exam pathway** to Wave 4 (corpus) — flagged, not faked.

Lift estimate: steps 1–3 move Growth Journey **50 → ~78**; the 80–88 band follows LBI integration +
Wave 3 signal coverage.
