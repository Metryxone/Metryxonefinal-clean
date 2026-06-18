# CAPADEX → MetryxOne — Handoff Guide

> Consolidation of the integration contract between CAPADEX and the downstream MetryxOne platform.
> No integration code was written; this records the existing contract and recommended sequence.

## What CAPADEX Produces

CAPADEX is the **upstream source of behavioural truth**. Per assessed user/session it produces:

- **Behaviour graph** — one provenance-stamped graph per session aggregating all per-session outputs
  (`capadex_behavior_graph`); a user-level read stitches sessions together.
- **Signals & patterns** — concern-diagnostic signals → composites → patterns (with confidence bands).
- **Career Behaviour Profile** — readiness scores + constraints + drivers
  (`deriveCareerBehaviorProfile`), adopted downstream **only when a real linked session exists**.
- **CSI** — longitudinal career-stage/stability index + trajectory + positive/negative factors.
- **Interventions & recommendations** — library-backed best-next-actions (never generic).
- **Explainability lineage** — per-pattern lineage for every insight (read-only).
- **Reports** — stakeholder reports composed from stored intelligence (safety/quality gated).

## What Downstream Systems Consume

| Downstream | Consumes | Notes |
|---|---|---|
| **LBI** | signals, patterns, longitudinal memory | First downstream consumer; behavioural substrate |
| **Career Builder** | behaviour graph → behaviour profile | Per-row modifier; absent session ⇒ identical legacy behaviour |
| **Employability Index** | readiness/behaviour signals | Feeds the employability passport (contact never published) |
| **Competency Intelligence** | construct/stage signals | Contextualizes competency scoring + question selection |
| **Competitive Exam Intelligence** | exam-readiness context + behaviour | Blocked by context-corpus gap until Wave 4 |

## Required Interfaces / APIs

CAPADEX (read, stable):
- `GET /api/capadex/session/:id/report` · `/signals` · `/patterns` · `/explain` · `/recommendations`
- `GET /api/career/behavior-profile/:userId` · `GET /api/career/behavior-graph/:userId`
- `GET /api/career/next-actions/:userId` · `GET /api/career/behavioural-memory/:userId`

Downstream entry points (existing):
- LBI: `/api/lbi/*`, `/api/bios/signals/*`, `/api/predictions/*`
- Competency: `GET /api/competency/score/:userId`, `GET /api/competency/questions/select`
- Employability: `/api/career/passport/*`, `/api/public/passport/:token`

## Required Outputs (contract guarantees)

1. **Never fabricates** — orphans/gaps surface as UNCLASSIFIED / honest findings.
2. **Additive & reversible** — consumers reading CAPADEX outputs see byte-identical legacy behaviour
   when a session/profile is absent or a flag is off.
3. **Strengths are CSI-sourced** — never raw signal magnitude (signals are concern-diagnostic).
4. **Identity-space discipline** — ids differ across modules (BIGINT vs TEXT vs UUID); never
   `Number()`-coerce; intervention ids are UUID (`String()` them).
5. **IDOR-guarded** — non-super-admin targeting another user id → 403.

## Recommended Sequence

```
CAPADEX
   ↓   (behaviour graph + signals)
LBI
   ↓
Career Builder
   ↓
Employability Index
   ↓
Competency Intelligence
   ↓
Competitive Exam Intelligence
```

**Why this order:** each layer consumes the stabilized outputs of the one above. CAPADEX is the
substrate; LBI is the first consumer of raw behavioural signals; Career Builder reshapes them into
career decisions; Employability and Competency build on the career layer; Competitive Exam
Intelligence is last because it additionally needs the deferred context corpus (Wave 4).

## Handoff Readiness

- **Ready now (v0.9):** CAPADEX → LBI → Career Builder → Employability → Competency. The output
  contract is stable; downstream adoption is gated on real linked sessions, not on the deferred
  per-question enrichment.
- **Gated (v1.0):** Competitive Exam Intelligence — needs the Academic/Competitive context corpus
  (Wave 4) before its routing is non-zero.

## Immediate Next Project

- **Next CAPADEX increment:** C-2 Wave 1 verification (measurement-only) → Wave 2 Capability (gated).
- **Next platform project:** **LBI** — begin integration against the stable CAPADEX behaviour
  graph + signals while the gated C-2 waves proceed in parallel.
