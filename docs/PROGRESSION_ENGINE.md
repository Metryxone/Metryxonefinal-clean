# Progression Engine / Continuous Growth — CAPADEX 3.0 Phase 1.5

> **Question answered:** *Is CAPADEX capable of measurable, continuous customer growth?*
> **Verdict:** `STRUCTURAL_COMPLETE_ADOPTION_PENDING` — the continuous-growth loop is CODE-complete
> (every step realised by an EXISTING engine + table, loop closes 4/4) and the remaining axis is
> ADOPTION (real non-demo re-administration volume), reported SEPARATELY and NEVER composited.

## What this phase is
The ONE canonical **Progression Engine** — enhancement-only, **reuse-before-build**, no new
architecture / no V2 / no duplicate logic. It mirrors Phase 1.3 (Assessment Framework) and Phase 1.4
(Customer Journey) EXACTLY:

- **Pure-data registry** `backend/config/progression-model.ts` — FROZEN canonical model.
- **Read-only composer/verifier** `backend/services/progression-engine.ts` — verifies the registry's
  evidence against the LIVE filesystem + database; never writes; never throws.
- **Scan SSoT** `backend/scripts/capadex-1.5-progression-scan.ts` →
  `backend/audit/capadex-3.0-progression/scan.json`.
- **Deliverables generator** `backend/scripts/capadex-1.5-generate-deliverables.ts` — reads ONLY
  `scan.json` → 12 reports + completion-certification (docs never drift from measurement).

## Flag (default OFF, byte-identical incl. schema — ZERO DDL)
- Config flag `progressionEngineCompletion` / env `FF_PROGRESSION_ENGINE_COMPLETION` in
  `backend/config/feature-flags.ts` (getter `isProgressionEngineCompletionEnabled()`).
- Public-config key `progression_engine_completion` in `backend/routes/capadex.ts`
  (`/api/capadex/public-config`).
- OFF → `/api/progression/enabled` 503, all `/api/admin/progression/*` 401/403/503, public-config
  `false`, **zero tables created** (this phase has no migration — it composes existing substrate).

## Canonical growth spine (FROZEN, 15 steps)
`assessment → evidence_collection → ai_interpretation → recommendation → learning_plan →
practice_activity → behaviour_reinforcement → competency_development → personalized_intervention →
progress_measurement → reassessment → improvement_validation → outcome_achievement → promotion →
continuous_development` (re-enters the loop).

Each step `reuses` a verified EXISTING implementation (e.g. `evidence_collection` →
`services/wc3/longitudinal-foundation.ts` + `wc3_longitudinal_snapshots`; `reassessment` →
`services/capadex/progression-outcome-capture.ts` `getReassessmentSignal`; `outcome_achievement` →
`services/outcome-intelligence-engine.ts` → `validation_loop_outcomes`; `promotion` → `lib/lifecycle.ts`
+ `services/capadex/evidence-gate.ts`). The spine is the MEASURED loop — **never padded to a round
number**.

## Loop-closure invariants (4, FROZEN)
"Continuous growth" is real only if the loop CLOSES. Each invariant is a measurable link between two
spine steps, each backed by an EXISTING engine + table. `mechanism` is a **Coverage** statement (the
link exists in code); **Adoption** (exercised by real volume) is reported SEPARATELY and never
composited. Scan result: **4/4 closed** (Coverage).

## Routes (`backend/routes/progression.ts`)
- `/api/progression/enabled` — flag probe (503 OFF).
- super-admin (flag-gate 503 → `requireAuth` → `requireSuperAdmin`, never-throws):
  `/model`, `/coverage`, `/matrices`, `/loop-closure`, `/gaps`, `/summary`, `/adoption`, `/personas`.

## Honesty contract
- **Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption** — four independent axes, NEVER composited.
- **null ≠ 0** — a NULL (unreadable / unmeasurable) is never reported as 0 (empty). `readScalar`
  returns `null` on error, `0` on no rows.
- **Engineering closure ⟂ Adoption** — the loop being CODE-complete does NOT claim it is exercised;
  real re-administration volume is currently honest **0** (a usage axis, NEVER a gap).
- Per-persona linkage is a read-time join with `k_min=30`; below threshold abstains (never fabricated).
- Demo / non-demo separation preserved; orphans & gaps are honest findings.

## Per-persona growth paths (9) — scan snapshot
4 `SUPPORTED` · 5 `PARTIAL` · 0 `DEAD_END` · 0 `MISSING`. Spine reachability and evidence
(services/routes/frontend/tables) are measured per persona; all cited evidence is present in the live
repo + DB.

## Gap register
- `GAP-P1` (Medium) — uniformly enforced per-persona promotion gate (additive/optional).
- `GAP-P2` (Low).
- `GAP-P3` (Future).
- **0 Launch-Critical.** Resolved gaps tracked in `RESOLVED_PROGRESSION_GAPS`.

## Regenerate
From `backend/`:
```
npx tsx scripts/capadex-1.5-progression-scan.ts        # → audit/capadex-3.0-progression/scan.json
npx tsx scripts/capadex-1.5-generate-deliverables.ts   # → 12 reports + completion-certification.md
```

## See also
- `backend/audit/capadex-3.0-progression/` — scan.json + 12 deliverables + completion-certification.
- `.agents/memory/progression-engine-completion.md` — durable engineering lessons.
- `docs/CUSTOMER_JOURNEY.md` (1.4) · `docs/ASSESSMENT_FRAMEWORK.md` (1.3) — the mirrored scaffold.
