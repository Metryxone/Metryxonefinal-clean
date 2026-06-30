# Task #304 — Evidence-gated stage progression (CAPADEX 3.0, Program 2)

**Status:** implemented, flag-gated OFF by default. **No deploy.**
**Closes:** blueprint-06 GAP-P2 (evidence-gated advancement) + GAP-P1 (systematic re-measurement).
**Flag:** `evidenceGatedProgression` / `FF_EVIDENCE_GATED_PROGRESSION` (default OFF).

## What was built (strictly additive, read-only, NO DDL)

A read-time composition layer on top of the existing completion-only stage
progression. **No new tables, no migration, no writes** — so byte-identical OFF
including schema is satisfied trivially.

- **`backend/services/capadex/evidence-gate.ts`** (NEW, pure, never-throws):
  - `evaluateStageEvidence(entry, freshnessDays?, now?)` → per-stage `gate`
    envelope with SEPARATE axes:
    - **Coverage** (`has_session`, `has_score`, `score`) — does measured data exist?
    - **Confidence** (`level`, `age_days`, `fresh`) — is it trustworthy / fresh?
  - `enrichProgressWithEvidence(legacy, entriesByStage, freshnessDays?, now?)` →
    new progress array where each stage carries `gate`, and an absent next stage
    is `blocked` unless the prior stage is evidence-`verified` (GAP-P2). Falls
    back to the legacy object on any fault.
  - `EVIDENCE_FRESHNESS_DAYS = 180` — read-only display heuristic for
    `due_for_remeasurement` (GAP-P1). No scheduler, no job.
- **`backend/config/feature-flags.ts`**: registered `evidenceGatedProgression`
  (default OFF) + `isEvidenceGatedProgressionEnabled()`.
- **`backend/routes/capadex.ts` `buildProgress`**: added `updated_at` to the
  existing SELECT (NOT added to the returned shape) for the freshness signal;
  when the flag is ON the legacy array is passed through
  `enrichProgressWithEvidence`, else the **exact legacy array** is returned.
- **Frontend** (`StageJourneyPanel.tsx` + `CapadexResultPhase.tsx` +
  `behavioural-insights.ts`): optional `evidenceGate?: CapadexProgress[]` prop;
  honest per-stage badges (Evidence verified / Re-measure to verify / Due for
  re-check · Nd) render ONLY when a `gate` is present (i.e. flag ON). Prop rides
  on the already-available `r.progress` — **no new fetch**.

## Verdict vocabulary

`verified` · `insufficient_evidence` · `in_progress` · `not_started` · `blocked`.
Legacy `status` vocabulary (`available`/`locked`/`completed`/`in_progress`) is
preserved so existing consumers keep working; the nuance lives in `gate.verdict`.

## Deliberate deviation from the plan (honest, recorded)

The plan listed a `below_bar` BLOCKING verdict (score vs a stage threshold). It
is **intentionally NOT implemented as a gate.** The CAPADEX score is
concern-**diagnostic** (a behavioural/wellbeing signal), not a competency-mastery
score — blocking access to a supportive next stage because a concern score is
"low" would be harmful and violates the platform strengths-canon (signals are
concern-diagnostic, never a merit gate). It is surfaced ONLY as a non-gating
`gate.informational.below_reference_band` annotation. The gate's real levers are
evidence **integrity** (Coverage) and **freshness** (Confidence / re-measurement),
never concern magnitude.

## Honest note on real-world impact (Coverage ⟂ Confidence)

Every real completed CAPADEX session carries a computed score (the `/complete`
route computes + persists it), so in practice `has_score` is essentially always
true for completed stages. The lock/unlock delta vs legacy is therefore ~0 for
real users. The gate's value is **integrity enforcement** (no advancing on an
evidence-less "completed" row — a degenerate/legacy case) plus the **GAP-P1
re-measurement signal**, NOT gatekeeping learners out. This is stated honestly
rather than inflating the gate's effect.

## Verification

- **Pure logic** (`backend/scripts/task304-evidence-gate-verify.ts`): **25/25
  passed** — every verdict (verified / stale→due_for_remeasurement /
  insufficient_evidence / in_progress / not_started / blocked), below-band is
  non-gating, GAP-P2 advancement gate (verified→unlock, no-score→blocked,
  empty→blocked), and legacy-shape preservation.
- **HTTP OFF** (`GET /api/capadex/progress`): byte-identical legacy array,
  **0 `gate` fields** (confirmed before, and re-confirmed after the ON test).
- **HTTP ON** (dev-only `FF_EVIDENCE_GATED_PROGRESSION=1`, reverted after): each
  stage carries `gate`; CAP_CUR `not_started`/available, CAP_INS
  `blocked`/locked with an honest reason when no prior evidence exists.
- **Build sanity**: esbuild parse-check of the new service + edited route — clean.
- **HTTP ON verified path** could NOT be smoked with live data: the shared dev DB
  has **no completed session with a non-null score + non-null guest_email**. This
  is an honest data limitation, not a defect — the verified/stale/insufficient
  paths are fully covered by the deterministic unit test.

## Files

- `backend/services/capadex/evidence-gate.ts` (new)
- `backend/scripts/task304-evidence-gate-verify.ts` (new — verification)
- `backend/config/feature-flags.ts` (flag + helper)
- `backend/routes/capadex.ts` (`buildProgress` enrichment, flag-gated)
- `frontend/src/lib/behavioural-insights.ts` (`CapadexEvidenceGate` + optional `gate`)
- `frontend/src/components/assessment/phases/StageJourneyPanel.tsx` (optional prop + badges)
- `frontend/src/components/assessment/phases/CapadexResultPhase.tsx` (pass `r.progress`)
