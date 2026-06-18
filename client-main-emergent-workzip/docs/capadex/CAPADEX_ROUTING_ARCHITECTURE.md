# CAPADEX — Routing Architecture Guide

> Consolidation of the existing runtime/routing flow. No routing changes were made.

## Overview

CAPADEX routing turns free text into the right questions, scores the answers, runs the additive
intelligence pipeline, and emits an explainable report — then hands stable outputs downstream.

```
INPUT  →  ASSESSMENT  →  SCORING  →  ROUTING (intelligence pipeline)  →  OUTPUT  →  HANDOFF
```

## 1. Input Flow

The user enters name, persona, age band, and a free-text concern in `FreeAssessmentModal` (intro phase).

- `GET /api/capadex/concerns` — concern suggestions.
- `GET /api/capadex/auth/check-email` — returning-user check.
- **Concern resolution** (`routes/capadex-concern-intelligence.ts`):
  - `resolveCapadexConcern` — regex keyword fallback → 7 legacy categories + `construct_key`
    (never 404s).
  - `resolveMasterConcernIdFromText` — token-overlap confidence vs `capadex_concerns_master`, with
    age/persona tie-breakers; optional signal-grounding confidence boost when grounding runtime is on.

## 2. Assessment Flow

`FreeAssessmentModal` phases: **intro → analyze → clarify → preview → questions → result → register →
OTP → report.**

- **analyze:** `POST /api/capadex/concern/analyze` builds the analysis envelope (patterns, tags,
  mirror) and selects clarity questions via the **3-tier picker**:
  1. `pickQuestionsFromMaster` — bridge-tag join (`master_bridge_tag = relational_bridge_tag`) with
     age/persona refinement → `clarity_source = master_curated`.
  2. `pickQuestionsFromDB` — adaptive bank by legacy rulesKey → `clarity_source = adaptive_bank`.
  3. `pickQuestions` — static fallback → `clarity_source = static_fallback`.
- **clarify (adaptive):** `POST /api/capadex/concern/adaptive-next` rebuilds the **same** pool via the
  analyze envelope (never 500s; falls back to batch).
- **questions:** `POST /api/capadex/session/start`, then `POST /api/capadex/session/:id/respond` per
  item.
- **result:** `POST /api/capadex/session/:id/complete` (triggers post-completion hooks).
- **register / OTP:** `POST /api/capadex/auth/register`, `POST /api/capadex/auth/verify-otp`.
- **report:** `GET /api/capadex/session/:id/report`, `GET /api/capadex/session/:id/recommendations`.

## 3. Scoring Flow

On completion the stage score → CSI; QIS governs question quality; AIS/Trust govern confidence;
differentiability is the pool-health metric. See `CAPADEX_SCORING_MODEL.md`.

## 4. Routing Flow (intelligence pipeline — post-completion hooks)

Triggered after `complete` (additive, flag-gated, read-only over prior outputs), in order:

1. **Signal capture** — telemetry (`capadex_session_telemetry`): hesitation ms, backtracks.
2. **Composite/Pattern (OMEGA-X)** — `buildOmegaXSkeleton` + Bayesian update of trait priors
   (overthinking, indecisiveness) → `capadex_session_composites/patterns`.
3. **CSI** — `recalculateCSI(pool, email, sessionId)` updates the longitudinal stability score.
4. **RIE (Recommendation Intelligence)** — `runRIEPipeline` produces governed action items
   (library-backed, never generic).
5. **Behaviour graph** — `buildBehaviorGraph(pool, sessionId)` stitches all signals into one graph,
   then `generateInterventionIntelligence`.
6. **LDE (Longitudinal Development Engine)** — `runLDEPipeline` + `activateGraphNodes` update
   knowledge-graph nodes and longitudinal memory.

All hooks are **non-blocking** — a failure in any engine never breaks the user-facing flow.

## 5. Output Flow

The report composes stored intelligence only (no recompute, no AI fabrication): scores + levels,
patterns, strengths (CSI-sourced), library-backed interventions, and per-pattern explainability
lineage via `GET /api/capadex/session/:id/{signals,patterns,explain}`. Report quality passes the
OMEGA-X quality validator (safety gate: safety < 60 → FAIL).

## 6. Future Handoffs

Stable CAPADEX outputs (behaviour graph, signals, patterns, CSI, readiness/behaviour profile) are the
contract for downstream systems:

| Downstream | Consumes | Interface |
|---|---|---|
| **LBI** | signals/patterns, longitudinal memory | `/api/lbi/*`, `/api/bios/signals/*` |
| **Career Builder** | behaviour graph → `deriveCareerBehaviorProfile` | `GET /api/career/behavior-profile/:userId`, `/api/career/behavior-graph/:userId` |
| **Employability Index** | readiness/behaviour signals → passport | `/api/career/passport/*` |
| **Competency Intelligence** | construct/stage signals | `GET /api/competency/score/:userId`, `/api/competency/questions/select` |
| **Competitive Exam Intelligence** | exam-readiness context + behaviour | *blocked by context-corpus gap (no Academic/Competitive context in generic pools)* |

## Routing Diagram (textual)

```
[free text + persona + age]
        │
        ▼
 concern resolution ──(keyword fallback | master-token resolver)──► bridge tag
        │
        ▼
 3-tier clarity picker ──(master_curated → adaptive_bank → static_fallback)──► question set
        │
        ▼
 session start ──► respond×N ──► complete
        │
        ▼
 post-completion hooks:
   signal capture → composite/pattern (OMEGA-X Bayesian) → CSI → RIE → behaviour graph → LDE
        │
        ▼
 report (composed from stored intelligence; quality + safety gated)
        │
        ▼
 downstream handoff: LBI → Career Builder → Employability → Competency → Competitive Exam
```
