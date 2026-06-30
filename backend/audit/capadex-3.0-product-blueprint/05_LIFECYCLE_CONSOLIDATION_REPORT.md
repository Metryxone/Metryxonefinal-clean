# 05 · Lifecycle Consolidation Report

Reconciles ALL lifecycle definitions into ONE. **Recommend-only; no redesign.** Evidence is code-grep verified.

## What the repository actually contains (measured)
- **Four coded stages** in the assessment engine: `CAP_CUR`, `CAP_INS`, `CAP_GRW`, `CAP_MAS`
  (grep: `backend/routes/capadex.ts`, `backend/data/capadex-concern-banks.ts` — 90–104 hits each).
- **No `CAP_CLA` and no `CAP_AWA` codes exist.**
- **Label split:** `CAP_INS` is rendered as both **"Insight"** (`routes.ts`, report schema) and **"Clarity"**
  (`concern-clarity-mapping-engine.ts`, `question-stage-intelligence.ts`).
- **Narrative "5-stage" model** (Awareness → Curiosity → Insight/Clarity → Growth → Mastery) appears in prose
  docs, but **Awareness is uncoded**.

## Conflict matrix (the deliverable's core)
| Source | Stage set described | Conflict |
|---|---|---|
| Engine code (SSoT) | CUR · INS · GRW · MAS (4) | — (authoritative) |
| `docs/CAPADEX.md` | Clarity · Curiosity · Insight · Growth · Mastery (5, ordering odd) | adds Clarity AND Insight as separate; ordering ambiguous |
| Engineering constitution | "BE 5-stage vs FE 4-code" seam | flags the split explicitly |
| FE `StageJourneyPanel.tsx` | CUR · INS · GRW · MAS (4) | matches engine |
| Prior cert (09) | 5-stage narrative w/ Awareness | narrative 5, coded 4 |

## CANONICAL LIFECYCLE (consolidated recommendation)
> **Coded, authoritative lifecycle = 4 stages:**
> **1. Curiosity (CAP_CUR) → 2. Insight (CAP_INS) → 3. Growth (CAP_GRW) → 4. Mastery (CAP_MAS).**
> **"Clarity" is a display alias of Insight (CAP_INS), not a 5th stage. "Awareness" is a pre-Curiosity
> narrative concept with no code and should be documented as conceptual, not claimed as an active stage.**

## Stage-quality assessment (honest, recommend-only)
| Stage | Strength | Weakness |
|---|---|---|
| Curiosity | Strong entry; concern banks rich | entry criteria implicit |
| Insight | Strong diagnosis; clarity mapping mature | **label ambiguity (Insight vs Clarity)** is the #1 cleanup |
| Growth | Interventions + growth plan exist (M5) | progression INTO/OUT is derived + monetization-gated, not criteria-gated |
| Mastery | Defined endpoint | "mastery" not evidence-gated (no demonstrated-mastery proof) → see 11 GAP-P2 |
| (Awareness) | — | uncoded; either build it deliberately or stop citing it |

## Recommendations (NOT implemented here)
1. **Pick ONE label for CAP_INS** (recommend "Insight"; keep "Clarity" only as user-facing copy if desired) and
   document it; do not split it into two stages.
2. **Decide Awareness explicitly** — either (a) document it as a pre-stage marketing concept, or (b) scope a
   future coded stage. Until then, **claim 4 coded stages, not 5.**
3. **Add evidence-gated entry/exit criteria** to Growth→Mastery (separate from the monetization gate) — this is
   the lifecycle's true maturity lever (carried as GAP-P2 in 11).
4. **Keep BE and FE on the same 4-code set** (FE already is) — close the "5-vs-4" seam by fixing the *docs*, not
   the code.

## Verdict
**ONE canonical 4-stage lifecycle, code-backed.** The historical "5-stage" claim is a documentation artifact
(uncoded Awareness + Insight/Clarity double-count). No redesign required — the consolidation is a
*labeling + documentation* reconciliation plus a future criteria-gating enhancement.
