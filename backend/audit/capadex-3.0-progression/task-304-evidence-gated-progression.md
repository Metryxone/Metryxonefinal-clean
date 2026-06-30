# Task #304 — Evidence-gated stage progression (CAPADEX 3.0, Program 2)

**Status:** implemented, flag-gated OFF by default. **No deploy.**
**Closes:** blueprint-06 GAP-P2 (evidence-gated advancement) + GAP-P1 (systematic re-measurement).
**Flag:** `evidenceGatedProgression` / `FF_EVIDENCE_GATED_PROGRESSION` (default OFF).

## What was built (strictly additive, read-only, NO DDL)

A read-time composition layer on top of the existing completion-only stage
progression. **No new tables, no migration, no writes** — so byte-identical OFF
including schema is satisfied trivially.

### Reuse-before-build — the gate COMPOSES two existing engines

1. **Readiness** is derived via **`scoreToLevelBand()`** (`competency-scoring.ts`)
   — the canonical proficiency-band ladder (`>=80/60/40/20 → bands 5..1`). This
   is the "score vs stage threshold" axis. The CAPADEX stage score is a POSITIVE
   proficiency measure (it mirrors `getScoreLevel`: Advanced / Proficient /
   Developing / Emerging — higher is better), **not** raw concern-signal
   magnitude, so a readiness threshold gate is honest and is exactly what GAP-P2
   ("evidence-gated advancement") asks for.
2. **Data sufficiency** (a non-gating sub-dimension of Confidence) is derived via
   **`applyKAnonymity()`** (`cohort-gating.ts`) — the canonical k-anonymity gate
   (masked / provisional / verified). The user's cohort is resolved from the
   session's `persona` + `age_band` and counted with `countCohort()`. It NEVER
   gates advancement — holding a learner back because too few peers share their
   cohort would be wrong.

### Components

- **`backend/services/capadex/evidence-gate.ts`** (NEW, pure, never-throws):
  - `evaluateStageEvidence(entry, opts?)` → per-stage `gate` envelope with THREE
    SEPARATE axes (never composited):
    - **Coverage** (`has_session`, `has_score`, `score`) — does measured data exist?
    - **Readiness** (`band`, `label`, `min_band`, `meets_threshold`) — composed via
      `scoreToLevelBand`; does the measured result meet the bar?
    - **Confidence** (`level`, `age_days`, `fresh`, `data_sufficiency`) — is it
      trustworthy / fresh, and is there enough peer data (composed via
      `applyKAnonymity`) to trust a benchmark-referenced read?
  - `enrichProgressWithEvidence(legacy, entriesByStage, opts?)` → new progress
    array where each stage carries `gate`, and an absent next stage is `blocked`
    unless the prior stage is evidence-`verified` (GAP-P2). Falls back to the
    legacy object on any fault.
  - `EVIDENCE_FRESHNESS_DAYS = 180` — read-only display heuristic for
    `due_for_remeasurement` (GAP-P1). No scheduler, no job.
  - `STAGE_READINESS_MIN_BAND = 3` (score >= 40, "Developing") — the readiness
    bar a stage must clear to advance.
- **`backend/config/feature-flags.ts`**: registered `evidenceGatedProgression`
  (default OFF) + `isEvidenceGatedProgressionEnabled()`.
- **`backend/routes/capadex.ts` `buildProgress`**: added `updated_at` / `persona`
  / `age_band` to the existing SELECT (NOT added to the returned shape) for the
  freshness + cohort signals; when the flag is ON the legacy array is passed
  through `enrichProgressWithEvidence` (with the resolved `cohortN`), else the
  **exact legacy array** is returned.
- **Frontend** (`StageJourneyPanel.tsx` + `CapadexResultPhase.tsx` +
  `behavioural-insights.ts`): optional `evidenceGate?: CapadexProgress[]` prop;
  honest per-stage states render ONLY when a `gate` is present (i.e. flag ON):
  - completed → **Evidence verified** / **Re-measure to verify** (insufficient) /
    **Building readiness · {label}** (below_bar) / **Due for re-check · Nd** (stale);
  - locked → the honest **blocked reason** from the gate.
  Prop rides on the already-available `r.progress` — **no new fetch**.

## Verdict vocabulary

`verified` · `below_bar` · `insufficient_evidence` · `in_progress` ·
`not_started` · `blocked`. Legacy `status` vocabulary
(`available`/`locked`/`completed`/`in_progress`) is preserved so existing
consumers keep working; the nuance lives in `gate.verdict`.

- **verified** = completed + measured score + readiness band >= `STAGE_READINESS_MIN_BAND`.
- **below_bar** = completed + measured score but readiness below the bar → holds
  the next stage `locked` with a supportive, honest reason (GAP-P2).
- **insufficient_evidence** = "completed" flag set but NO usable measured result
  (degenerate / legacy row) → next stage locked; re-measure to advance.

## What gates vs what is informational (Coverage ⟂ Readiness ⟂ Confidence)

Advancement (next-stage unlock) depends on the prior stage being `verified`
(Coverage AND Readiness). **Data sufficiency** (cohort k-anonymity) is reported
alongside as a Confidence sub-dimension but **NEVER gates** — the three axes are
kept strictly separate and are never blended into one number.

## Honest note on real-world impact

Every real completed CAPADEX session carries a computed score (the `/complete`
route computes + persists it), so in practice `has_score` is essentially always
true for completed stages. The gate's value is (a) **integrity enforcement** (no
advancing on an evidence-less "completed" row), (b) the **readiness bar** (GAP-P2),
and (c) the **GAP-P1 re-measurement signal** — stated honestly rather than
inflating its effect. The whole layer is flag-gated OFF by default, so production
behaviour is unchanged until the flag is enabled.

## Verification

- **Pure logic** (`backend/scripts/task304-evidence-gate-verify.ts`): **39/39
  passed** — every verdict; readiness composed via `scoreToLevelBand`
  (band/label/meets_threshold, no-score → band `null` never floored); data
  sufficiency composed via `applyKAnonymity` (masked/provisional/verified) proven
  NON-gating; GAP-P2 advancement gate (verified→unlock, below_bar→blocked,
  no-score→blocked, empty→blocked); GAP-P1 stale→due_for_remeasurement; and
  legacy-shape preservation.
- **HTTP OFF** (`GET /api/capadex/progress`): byte-identical legacy array,
  **0 `gate` fields** (confirmed before and after the ON test).
- **HTTP ON** (dev-only `FF_EVIDENCE_GATED_PROGRESSION=1`, reverted after): each
  stage carries the full `gate` envelope (coverage / readiness with `min_band:3` /
  confidence with composed `data_sufficiency` {status:masked, n:0, k_min:30} /
  due_for_remeasurement); CAP_CUR `not_started`/available, the rest
  `blocked`/locked with honest reasons when no prior verified evidence exists.
- **Build sanity**: esbuild parse-check of the new service, edited route, and both
  edited frontend files — clean.
- **HTTP ON verified path** could NOT be smoked with live data: the shared dev DB
  has **no completed session with a non-null score + non-null guest_email**. This
  is an honest data limitation, not a defect — the verified / below_bar / stale /
  insufficient paths are fully covered by the deterministic unit test.

## Files

- `backend/services/capadex/evidence-gate.ts` (new — composes scoring + cohort-gating)
- `backend/scripts/task304-evidence-gate-verify.ts` (new — verification, 39/39)
- `backend/config/feature-flags.ts` (flag + helper)
- `backend/routes/capadex.ts` (`buildProgress` enrichment + cohort wiring, flag-gated)
- `frontend/src/lib/behavioural-insights.ts` (`CapadexEvidenceGate` + optional `gate`)
- `frontend/src/components/assessment/phases/StageJourneyPanel.tsx` (optional prop + states)
- `frontend/src/components/assessment/phases/CapadexResultPhase.tsx` (pass `r.progress`)
