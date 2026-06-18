# WC-3 Phase A — Implementation Deltas

Phase A of the user-approved WC-3 design. Implements three intelligence layers —
**L1 Stage Intelligence**, **L4 Personalization Wiring**, **L6 Longitudinal
Foundation** (storage + history capture ONLY). Strictly additive, flag-gated
(default OFF), fully reversible, with **byte-identical behaviour when flags are
OFF**. No ontology / signal / concern data is modified. **Phase B/C NOT started.**

---

## 1. Architecture delta

| Layer | New module | Integration point | Behaviour |
|-------|-----------|-------------------|-----------|
| L1 Stage Intelligence | `backend/services/wc3/stage-intelligence.ts` | `postCompletionHooks` (hook #14, `capadex-enterprise.ts`) writes; `GET /api/capadex/session/:id/stage` reads | Compose-only: maps session `stage_code` → canonical 5-stage progression, reads CSI best-effort. Never recomputes scores. |
| L4 Personalization Wiring | `backend/services/wc3/personalization-wiring.ts` | `analyzeConcern` (`capadex-concern-intelligence.ts`) attaches envelope before return | Provenance/observability only — attaches a `personalization` envelope + `personalized:true` and fire-and-forget logs the decision. **Selection order is unchanged.** |
| L6 Longitudinal Foundation | `backend/services/wc3/longitudinal-foundation.ts` | `postCompletionHooks` (hook #14) writes; `GET /api/capadex/session/:id/longitudinal` reads (session-scoped, PII-safe) | Append-only snapshot capture. **No trend/analytics computation.** |
| Schema (all 3) | `backend/services/wc3/wc3-schema.ts` | lazy `ensureWc3*Schema()` (cached per-process) | Idempotent DDL; mirrors the canonical migration. |

All cross-module calls use dynamic `import()` inside flag-gated branches, so when a
flag is OFF the WC-3 code is never loaded or executed on that path.

## 2. Schema delta (canonical migration `backend/migrations/20261205_wc3_phase_a.sql`)

New tables (all `wc3_*`, additive, no FK coupling to existing tables, nullable
columns → trivially reversible via `DROP TABLE`):

- **L1**: `wc3_stage_definitions` (seeded reference), `wc3_stage_entity_map`
  (seeded: CAP_CUR→Curiosity, **CAP_INS→Clarity** alias, CAP_GRW→Growth,
  CAP_MAS→Mastery), `wc3_stage_state` (upsert by `session_id`),
  `wc3_stage_progression` (append-only `bigserial`).
- **L4**: `wc3_personalization_profile` (upsert by `user_email`),
  `wc3_personalization_decisions` (append-only).
- **L6**: `wc3_longitudinal_snapshots` (append-only history),
  `wc3_longitudinal_trends` (**created but intentionally UNPOPULATED in Phase A** —
  storage only; never written).

Canonical 5-stage weights: Awareness 0.25 · Curiosity 0.50 · Clarity 0.75 ·
Growth 1.00 · Mastery 1.25. **No existing table is mutated.**

## 3. Runtime delta

- **Feature flags** (`backend/config/feature-flags.ts`, all default `false`):
  `wc3Stage` (`FF_WC3_STAGE`), `wc3Personalization` (`FF_WC3_PERSONALIZATION`),
  `wc3Longitudinal` (`FF_WC3_LONGITUDINAL`) + helpers `isWc3StageEnabled()`,
  `isWc3PersonalizationEnabled()`, `isWc3LongitudinalEnabled()`.
- **Completion path** (`postCompletionHooks` hook #14): when L1/L6 flag(s) ON,
  resolves stage + appends snapshot inside a dedicated `try/catch` that can never
  break completion. Flag OFF → block skipped entirely.
- **Analyze path** (`analyzeConcern`): when L4 ON, spreads a `personalization`
  envelope into the response and fire-and-forgets the decision log. Flag OFF →
  no envelope, no marker, no log; response byte-identical to legacy.
- **New read routes** follow the established session/user read-route convention
  (same as `/guidance`, `/pipeline`, `/grounding`): flag OFF → `{ok:true,
  enabled:false}` at HTTP 200 (NOT 503). Bad UUID → 400 (after the flag gate).
  > Deviation note vs plan T004 wording ("503 when flag off"): the codebase's
  > established pattern for **session/user-scoped read routes** is `{enabled:false}`
  > at 200 (503 is used for admin-suite routes). These two routes are read
  > surfaces exactly like `/guidance` and `/pipeline`, so they follow that local
  > convention for consistency.

## 4. Validation delta

- **Flags-OFF smoke** (live, post-restart):
  - `GET /api/capadex/session/:id/stage` → `{"ok":true,"enabled":false}` (200)
  - `GET /api/capadex/session/:id/longitudinal` → `{"ok":true,"enabled":false}` (200)
  - bad-uuid `/stage` → `{"ok":true,"enabled":false}` (gated before UUID guard)
- **Flags-ON end-to-end** (one-off script against live DB, rows cleaned up):
  - L1 `resolveSessionStage(CAP_INS)` → canonical `Clarity`, order 2, weight 0.75,
    confidence 0.6, persisted; `getSessionStage` → persisted + progression length 1.
  - L6 `captureLongitudinalSnapshot` → row written; `wc3_longitudinal_trends`
    count = **0** (storage-only invariant holds).
  - L4 `buildPersonalizationEnvelope` → all 6 dims active, `personalized:true`;
    `logPersonalizationDecision` → decision + profile rows written.
- **Never-throws**: every writer/reader is wrapped (`try/catch` → returns
  null/false/swallow), and every call site is additionally wrapped + non-blocking.
- **Byte-identical-OFF**: WC-3 modules are only `import()`ed inside flag-ON
  branches; OFF path never loads or runs WC-3 code.
- **Reversibility**: `DROP TABLE` the 8 `wc3_*` tables + delete the 3 flag entries
  / migration / `services/wc3/` dir → full removal, no residue in existing tables.
- **Backend restart** clean (no startup errors in logs). No frontend changes
  (frontend vite build — the only launch gate — is untouched).

## 5. Updated readiness

| Layer | Phase A status | Deferred (NOT in this phase) |
|-------|---------------|------------------------------|
| L1 Stage Intelligence | ✅ Resolver + state + append-only progression + read route | Stage-transition analytics, UI surfacing |
| L4 Personalization | ✅ Wiring/observability: envelope + provenance + decision log | **Active re-ranking** of question selection (Phase B) |
| L6 Longitudinal | ✅ Storage + history capture + raw read route | **Trend/trajectory/delta analytics** (later phase) |

**STOP for approval. Phase B/C not started.**
