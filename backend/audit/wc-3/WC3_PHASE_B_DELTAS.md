# WC-3 Phase B — Implementation Deltas

Phase B of the user-approved WC-3 design. Implements **L2 Outcome Intelligence
ONLY**, composed on top of **L1 Stage Intelligence** (the PRIMARY dependency).
Strictly additive, flag-gated (default OFF), fully reversible, with **byte-identical
behaviour when the flag is OFF**. No ontology / signal / concern data is modified.
**L3 Journey, L6 trend analytics, and L7 Outcome Validation NOT started.**

---

## 1. Architecture delta

| Layer | New module | Integration point | Behaviour |
|-------|-----------|-------------------|-----------|
| L2 Outcome Intelligence | `backend/services/wc3/outcome-intelligence.ts` | `postCompletionHooks` (hook #14, `capadex-enterprise.ts`) writes **after** the L1 stage resolve; `GET /api/capadex/session/:id/outcome` reads | Compose-only: matches a session's ACTIVE behavioural constructs against 6 outcome models, derives current/desired/gap from L1 stage, attaches **library-backed** actions only. Never recomputes scores. |
| Schema | `backend/services/wc3/wc3-schema.ts` → `ensureWc3OutcomeSchema()` | lazy ensure (cached per-process), mirrors the canonical migration | Idempotent DDL; seeds the 6-model catalog. |

All cross-module calls use dynamic `import()` inside flag-gated branches, so when the
flag is OFF the L2 code is never loaded or executed on that path.

**Primary dependency on L1:** `current_stage`/`current_order` are taken verbatim from
the L1 `StageState` (passed through the completion hook, or read via `getSessionStage`
in the route). `desired` = next canonical stage up (`min(order+1, last)`), `gap` =
ladder distance, `gap_normalized` = gap / (ladder length − 1). L2 never derives a stage
itself — when L1 yields no stage, L2 degrades to UNCLASSIFIED.

## 2. Schema delta (canonical migration `backend/migrations/20261206_wc3_phase_b_outcome.sql`)

New tables (all `wc3_outcome_*`, additive, nullable columns → reversible via `DROP`):

- **`wc3_outcome_models`** — outcome-model catalog, PK `model_key`. Seeds **6 models**:
  `career_clarity`, `learning_effectiveness`, `employability_readiness`,
  `exam_readiness` (`gated=true`), `confidence_stability`, `decision_quality`. Each
  carries `construct_keys text[]` + `composition_spec jsonb`. **Construct mappings are
  grounded in REAL `intervention_library.construct_key` values** (verified against the
  live 38 distinct construct keys) so every model can resolve library-backed actions.
- **`wc3_outcome_state`** — per session × model (current/desired stage + order, gap,
  gap_normalized, confidence, matched_constructs, action_count, explainable).
  `UNIQUE(session_id, model_key)` → upsert.
- **`wc3_outcome_actions`** — `FK→wc3_outcome_state ON DELETE CASCADE` **and**
  `FK→intervention_library(id)`: actions are **library-backed ONLY** (no generic
  fabrication). One row per matched construct (max 5/model), `rank` ordered.

**No existing table is mutated.** The only coupling to an existing table is the
read-only FK into `intervention_library(id)` (enforces library-backed actions).

## 3. Runtime delta

- **Feature flag** (`backend/config/feature-flags.ts`, default `false`):
  `wc3Outcome` (`FF_WC3_OUTCOME`) + helper `isWc3OutcomeEnabled()`. Flag count
  11 (was 10) confirmed in startup logs.
- **Completion path** (`postCompletionHooks` hook #14): when `isWc3OutcomeEnabled()`,
  calls `resolveSessionOutcomes` **after** the L1 stage block and passes the resolved
  `stageState` through, inside a dedicated `try/catch` that can never break completion.
  Flag OFF → block skipped entirely (no write).
- **New read route** `GET /api/capadex/session/:id/outcome` follows the established
  session-scoped read-route convention (same as `/stage`, `/guidance`, `/pipeline`):
  flag OFF → `{ok:true, enabled:false}` at HTTP 200; bad UUID → 400 (after the flag
  gate); transient/unknown session → `{degraded:true, reason}`; **never 500s**.
- **Honest UNCLASSIFIED:** when the behavioural spine is empty (no active constructs)
  or no model matches or no L1 stage exists, the resolver **writes nothing** and the
  reader returns `{unclassified:true, reason}` — never fabricated outcomes.

## 4. Validation delta

- **Flag-OFF smoke** (live, post-restart):
  - `GET /api/capadex/session/:id/outcome` → `{"ok":true,"enabled":false}` (200)
  - bad-uuid `/outcome` → `{"ok":true,"enabled":false}` (gated before UUID guard,
    matching the local `/stage` convention)
- **Flag-ON end-to-end** (one-off script against live DB, synthetic session, all rows
  cleaned up afterward — 0 residue verified):
  - Seeded L1 stage `Curiosity` (order 1) + active constructs `CAREER_CLARITY`,
    `GOAL_ORIENTATION` → `resolveSessionOutcomes` activated **2 models**
    (`career_clarity`, `decision_quality`), `current Curiosity(1) → desired Clarity(2)`,
    `gap=1 / 0.25`, `confidence=0.76`, `explainability=100`, `actionability=100`.
  - Persisted `wc3_outcome_state` (2 rows) + `wc3_outcome_actions` (3 rows, all
    library-backed via FK); `getSessionOutcomes` read back persisted models with
    real `intervention_library` text.
  - Empty-spine session → `unclassified:true, reason='no_constructs'` (wrote nothing).
  - Library-action query proven: `DISTINCT ON (construct_key)` returns real rows for
    the seeded construct keys.
- **Schema invariants:** migration idempotent (re-applied cleanly); 6 models seeded
  with correct key counts; `exam_readiness.gated=true`; no existing table mutated.
- **Never-throws:** resolver/reader wrapped (`try/catch` → returns null / unclassified);
  the completion call site is additionally wrapped + non-blocking.
- **Byte-identical-OFF:** the L2 module is only `import()`ed inside flag-ON branches;
  the OFF path never loads or runs L2 code.
- **Reversibility:** `DROP TABLE` the 3 `wc3_outcome_*` tables + delete the flag entry
  / migration / remove `ensureWc3OutcomeSchema` + the hook block + read route → full
  removal, no residue in existing tables.
- **Backend restart** clean (no startup errors in logs). No frontend changes (frontend
  vite build — the only launch gate — is untouched).

## 5. Updated readiness

| Layer | Phase B status | Deferred (NOT in this phase) |
|-------|---------------|------------------------------|
| L2 Outcome Intelligence | ✅ 6-model catalog + per-session outcome state + library-backed actions + read route, composed on L1 stage | Outcome trend/trajectory over time, UI surfacing, gating-rule enforcement for `gated` models |
| L3 Journey | ⛔ not started | Entire layer |
| L6 trend analytics | ⛔ not started (Phase A is storage-only) | Trend/trajectory/delta computation |
| L7 Outcome Validation | ⛔ not started | Entire layer |

**STOP for approval. L3 / L6-analytics / L7 not started. No deploy.**
