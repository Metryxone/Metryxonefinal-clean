# CAPADEX 3.0 — Stored-Stage Projection Consolidation (Phase 1.1 follow-up)

> Closes the one item Phase 1.1 deliberately deferred (report 07 §1.1): make a user's
> lifecycle stage **read the same everywhere** without a risky data rewrite.
> Enhancement-only · reuse-before-build · no V2 · byte-identical runtime · no data
> migration · no feature flag (nothing's behaviour changes). STOP for approval, no deploy.

## 1. Problem (honest scope)

Phase 1.1 consolidated the **four coded stages** (`CAP_CUR`/`CAP_INS`/`CAP_GRW`/`CAP_MAS`)
behind one canon (`backend/lib/lifecycle.ts`). It left a *second, separate* representation
untouched: the **stored-string progression projection** — the 5-element order
`['Awareness','Curiosity','Clarity','Growth','Mastery']` that the DB persists (WC-3
telemetry) and that string-keyed readers rank by. That order was **re-declared
independently** in two runtime modules, so the two copies could silently drift:

| Site | Before |
|---|---|
| `backend/services/wc3/stage-intelligence.ts` | `WC3_PROGRESSION_ORDER` + `WC3_PROGRESSION_WEIGHT` literals |
| `backend/services/question-metadata-ranking.ts` | `STAGE_ORDER` literal (byte-identical copy) |

## 2. Fix — one source of truth (read-layer single-sourcing, NOT a migration)

Added the canonical stored-string projection to the canon and routed both readers at it:

- `backend/lib/lifecycle.ts` — **new** `STORED_STAGE_ORDER`, `StoredStage` type, and
  `STORED_STAGE_WEIGHT`, built from the existing canon constants (`UNCODED_PRE_STAGE`,
  `INSIGHT_DISPLAY_ALIAS`). Documented as a *projection* of the four coded stages, never a
  fifth-stage canon.
- `backend/services/wc3/stage-intelligence.ts` — `WC3_PROGRESSION_ORDER` /
  `WC3_PROGRESSION_WEIGHT` now **re-export** the canon constants (the WC-3 name and the
  derived `CanonicalStage` union type are preserved, so all importers — journey/outcome/
  question-stage intelligence — are unchanged).
- `backend/services/question-metadata-ranking.ts` — `STAGE_ORDER` now imports
  `STORED_STAGE_ORDER` (the `Stage` type and `stageRank()` are unchanged).

**No data rewrite:** stored DB strings (`'Clarity'`, `'Awareness'`) and the
`wc3_stage_definitions` / `wc3_stage_entity_map` seed rows are untouched and remain
load-bearing — the code now sources its order/labels from the same canon those strings
already follow. **No feature flag:** the constants are byte-identical, so runtime behaviour
is unchanged (the same discipline Phase 1.1 used for the coded-stage consolidation).

## 3. Deliberately OUT of scope (different concepts — left untouched, noted honestly)

| Site | Why it is NOT this projection |
|---|---|
| `backend/services/wc7c/subscription-engine.ts` `stageFloorIndex` | A **billing floor** (0/1/2 where Clarity & Growth both → 1), not the 0..4 progression order. Load-bearing commerce logic. |
| `backend/routes/competency-assessment-runtime.ts` `PROFICIENCY_LABELS[1]='Awareness'` | A competency **proficiency band** (Awareness→Expert), unrelated to the lifecycle pre-stage. |
| `backend/routes/lde-evolution.ts` (Forming…Advanced, `cap_code: 'CAP_ADV'`) | A separate LDE developmental-evolution ladder (5 score-band stages, incl. a non-canon `CAP_ADV`). Different subsystem/taxonomy. |
| `backend/services/entitlement-bridge.ts` `STAGE_ORDER` (4 **codes**) | The coded-stage order (values already match `LIFECYCLE_STAGE_CODES`); a local-const decoupling in commerce logic. Optional future cleanup, not the stored-string item. |
| `backend/scripts/aq-2/reconstruct.ts`, audit scripts | One-off scripts, not runtime. |

These are recorded as honest observations; changing them is out of #306's stated scope and
would touch billing/entitlement/visualisation behaviour.

## 4. Evidence

- **Runtime byte-identity** (tsx import of all three modules):
  - `STORED_STAGE_ORDER` = `WC3_PROGRESSION_ORDER` = `STAGE_ORDER` =
    `["Awareness","Curiosity","Clarity","Growth","Mastery"]` → **identical: true**
  - `STORED_STAGE_WEIGHT` = `WC3_PROGRESSION_WEIGHT` =
    `{Awareness:0.25,Curiosity:0.50,Clarity:0.75,Growth:1.00,Mastery:1.25}` → **identical: true**
  - `stageRank('Clarity')===2`, `stageRank(<unknown>)===5` (length) → unchanged semantics.
- **No duplicate literals remain** in runtime code (`rg` for the 5-element literal outside
  the canon → 0 matches).
- **Backend boots clean** after restart (all routes registered; `Server listening on 8080`;
  no errors).

## 5. Status

Stored-stage consistency now has **one source of truth**; no per-module copy can drift.
Byte-identical runtime, no data migration, no flag. **STOP — awaiting human approval, no
deploy.**
