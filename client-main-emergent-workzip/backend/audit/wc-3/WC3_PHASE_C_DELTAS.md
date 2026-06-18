# WC-3 Phase C — Implementation Deltas

Phase C of the user-approved WC-3 design. Implements **L3 Journey Intelligence
ONLY**, composed on top of **L1 Stage Intelligence** + **L2 Outcome Intelligence**
(the two dependencies). Strictly additive, flag-gated (default OFF), fully
reversible, with **byte-identical behaviour when the flag is OFF**. No ontology /
signal / concern data is modified. **L6 trend analytics and L7 Outcome Validation
NOT started.**

---

## 1. Architecture delta

| Layer | New module | Integration point | Behaviour |
|-------|-----------|-------------------|-----------|
| L3 Journey Intelligence | `backend/services/wc3/journey-intelligence.ts` | `postCompletionHooks` (hook #14, `capadex-enterprise.ts`) writes **after** the L2 outcome resolve; `GET /api/capadex/session/:id/journey` reads | Compose-only: scores 5 supported product routes from the session's ACTIVATED L2 outcome models, picks Primary + Secondary, derives Expected Stage Advancement from L1, attaches Product Mapping. Never recomputes scores. |
| Schema | `backend/services/wc3/wc3-schema.ts` → `ensureWc3JourneySchema()` | lazy ensure (cached per-process), mirrors the canonical migration | Idempotent DDL; seeds the 5-route catalog. |

All cross-module calls use dynamic `import()` inside flag-gated branches, so when the
flag is OFF the L3 code is never loaded or executed on that path.

**Dependencies on L1 + L2:** L3 reads L1 stage via `getSessionStage` (for the
Expected Stage Advancement: `current → next stage up`) and L2 outcome via
`getSessionOutcomes` (read-only; works even when the L2 flag is OFF). Route fit is
derived ONLY from real, ACTIVATED L2 outcome models — never fabricated. In the
completion hook the freshly-resolved L1 `stageState` and L2 `outcomeSummary` are
passed through to avoid redundant reads.

## 2. Schema delta (canonical migration `backend/migrations/20261207_wc3_phase_c_journey.sql`)

New tables (all `wc3_journey_*`, additive → reversible via `DROP`):

- **`wc3_journey_routes`** — supported-route catalog, PK `route_key`. Seeds **5 routes**:
  `lbi`, `career_builder`, `employability_index`, `competitive_exam`
  (`corpus_status='corpus_pending'`), `mentoring` (`is_fallback=true`,
  `fallback_priority=0`). Each carries `model_affinities jsonb` (outcome-model-key →
  weight) grounded in the **real L2 `wc3_outcome_models.model_key` vocabulary**, plus
  `product_key/product_label/product_path` (the Product Mapping).
- **`wc3_journey_state`** — per session (`UNIQUE(session_id)` → upsert). Holds
  `primary_route` **NOT NULL** (`FK→wc3_journey_routes` — DB-level enforcement of the
  "never terminate without a route" invariant), `secondary_route` (nullable FK),
  `route_confidence`, `confidence_band`, `route_reason`, `expected_outcome_key/_outcome`,
  `expected_stage_current/_desired/_advancement`, `product_key/_label/_path`,
  `contributing_models text[]`, `degraded`, `status='routed'`.
- **`wc3_journey_candidates`** — ranked route fits, `FK→wc3_journey_state ON DELETE
  CASCADE` **and** `FK→wc3_journey_routes`. Provenance for Primary/Secondary
  (`fit_score`, `rank`, `corpus_status`, `contributing_models`).

No existing table is touched.

## 3. Routing algorithm (pure `buildJourney`)

1. Load the 5 routes; read L1 stage + L2 outcome (passed-through or read-only).
2. `activeModels` = L2 models when the summary is **not** UNCLASSIFIED, else `[]`.
3. Per route: `fit = Σ (route.model_affinity[model] × model.confidence)` over the
   models the route has affinity for; record the contributing models.
4. Rank: `fit desc → fallback_priority asc → route_key asc`. `realCandidates` = fit > 0.
5. **Primary/Secondary:**
   - ≥1 real candidate → Primary = top; `route_confidence = min(fit, 1)`. Secondary =
     2nd real candidate, else the Mentoring fallback (if different), else `null`.
   - 0 real candidates → **invariant (a)**: deterministic Mentoring fallback,
     `degraded:true`, honest floor `route_confidence = 0.2`, band `LOW_CONFIDENCE`.
6. **Confidence band:** `corpus_pending → CORPUS_PENDING`; else `≥0.7 HIGH`,
   `≥0.4 MODERATE`, else `LOW`. **Invariant (b)**: the Competitive Exam route, when it
   wins/ties, is routed to under `CORPUS_PENDING` — supported, never dropped.
7. Expected Outcome = highest-confidence contributing model (display label + key).
   Expected Stage Advancement = `current → next canonical stage up` from L1
   (`unavailable` when no stage). Product Mapping = primary route's product fields.

`route_reason` is grounded in the real contributing model labels (or the honest
fallback explanation when degraded). Nothing is fabricated: routes come from the
seeded catalog, contributing models are real activated L2 models.

## 4. Runtime wiring delta (`backend/routes/capadex-enterprise.ts`, hook #14)

The existing WC-3 block now also reads `isWc3JourneyEnabled()`; the outer guard
becomes `stageOn || longitudinalOn || outcomeOn || journeyOn`. The L2 resolve return
value is captured (`outcomeSummary`); when `journeyOn`, `resolveSessionJourney` runs
**after** L2, passing `stageState` + `outcomeSummary`. Flag OFF → block skipped → no
journey write. Non-blocking (wrapped in the hook's try/catch; resolver never throws).

## 5. Route delta (`backend/routes/capadex.ts`)

`GET /api/capadex/session/:id/journey`, registered immediately after `/outcome`,
mirrors its contract exactly:
- flag OFF → `{ ok:true, enabled:false }` **before** the UUID check (byte-identical
  to `/stage` and `/outcome`).
- flag ON + invalid id → `400 {error:'invalid_session_id'}`.
- flag ON + unknown session / read failure → `{ ok:true, enabled:true, degraded:true,
  reason:'no_journey' }`. Never 500s.
- flag ON + known session → `{ ok:true, enabled:true, session_id, journey }`.

## 6. Feature flag delta (`backend/config/feature-flags.ts`)

Added `wc3Journey: false` (env `FF_WC3_JOURNEY`) + `isWc3JourneyEnabled()`. Default
OFF. Registry flag count: 12 WC-3-era / overall registry extended by one entry.

## 7. Validation (engine-level smoke + HTTP OFF parity)

Ran a throwaway `tsx` harness against the dev DB (synthetic UUIDs; all rows cleaned
up; script deleted). Results:

| Scenario | Setup | Primary | Band | degraded | Notes |
|----------|-------|---------|------|----------|-------|
| Fallback | no stage, no constructs | `mentoring` | `LOW_CONFIDENCE` | `true` (`no_constructs`) | invariant (a) — never routeless |
| Real route | Curiosity stage + `CAREER_CLARITY`,`GOAL_ORIENTATION` | `career_builder` | `HIGH_CONFIDENCE` | `false` | Secondary `lbi`; Expected Outcome `Career Clarity`; stage `Curiosity → Clarity`; persisted + read-back identical (4 candidates) |
| Exam | Curiosity stage + `EXAM_READINESS` | `competitive_exam` | `CORPUS_PENDING` | `false` | invariant (b) — exam supported under corpus-pending band; Secondary `mentoring` |

Seed verified: 5 routes, `competitive_exam` corpus_pending, `mentoring` fallback. All
assertions passed.

HTTP (flag OFF, default): `GET …/journey` → `{"ok":true,"enabled":false}`; invalid
id (flag OFF) → `{"ok":true,"enabled":false}` (enabled:false returned before the UUID
check) — byte-identical to `/outcome`.

## 8. Reversibility

- Flag OFF (default) → no code path loads L3; routes return `enabled:false`;
  completion hook skips the journey resolve. **Byte-identical legacy behaviour.**
- Full removal: `DROP TABLE wc3_journey_candidates, wc3_journey_state,
  wc3_journey_routes;` (no residue in existing tables). Migration + ensure-schema are
  the single source; the migration header documents the reverse.

## 9. NOT done (per scope — STOP for approval)

- Not deployed. No frontend changes. No ontology/signal/concern changes.
- L6 trend analytics, L7 Outcome Validation: not started.
- `proposeFollowUpTasks` NOT called (already consumed for an earlier task).
