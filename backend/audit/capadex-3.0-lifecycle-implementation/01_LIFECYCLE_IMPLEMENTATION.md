# 01 · Lifecycle Implementation

**Program 1 / Phase 1.1 — Lifecycle Model Implementation**
Scope: align the entire repository to the FROZEN canonical lifecycle (Blueprint 06).
Mode: enhancement-only · reuse-before-build · no new architecture · no V2 · no duplicate logic ·
no breaking changes · feature flags byte-identical.

---

## 1. The canonical lifecycle (frozen — Blueprint 06)

ONE lifecycle, **FOUR coded stages**, in progression order:

| Order | Code | Canonical label | Display alias | Description |
|---|---|---|---|---|
| 0 | `CAP_CUR` | Curiosity | — | Surface awareness & first signals |
| 1 | `CAP_INS` | Insight | **"Clarity"** | Patterns & self-understanding |
| 2 | `CAP_GRW` | Growth | — | Strategy & habit formation |
| 3 | `CAP_MAS` | Mastery | — | Control & peak performance |

- **"Clarity"** is the user-facing DISPLAY ALIAS of **Insight (`CAP_INS`)** — the SAME stage, never a 5th.
- **"Awareness"** is the UNCODED pre-Curiosity narrative pre-stage. No `CAP_AWA` code exists; never persisted as a `stage_code`.

Source of the freeze: `backend/audit/capadex-3.0-product-blueprint-final/06_CANONICAL_LIFECYCLE.md`.

---

## 2. What was implemented

### 2.1 ONE canonical source of truth per runtime

The repository already had ~18 places that declared the 4-stage code→label mapping inline. Rather than
introduce a new architecture, Phase 1.1 establishes **one canonical module per runtime** and routes every
divergent reference to it:

- **Backend canon — `backend/lib/lifecycle.ts` (NEW, pure constants + helpers, no DB/IO/side effects):**
  - `LIFECYCLE_STAGES` — the four stages with `code`, `label`, `order`, `displayAlias` (`CAP_INS → "Clarity"`), `description`.
  - `LIFECYCLE_STAGE_CODES` — ordered `['CAP_CUR','CAP_INS','CAP_GRW','CAP_MAS']`.
  - `STAGE_CODE_TO_LABEL` — code → canonical label.
  - `INSIGHT_DISPLAY_ALIAS = 'Clarity'` and `UNCODED_PRE_STAGE = 'Awareness'` — the alias and pre-stage encoded as named, documented constants (not magic strings).
  - Helpers: `stageLabel()`, `stageOrder()`, `isLifecycleStageCode()`.

- **Frontend canon — `frontend/src/lib/behavioural-insights.ts` (EXISTING `CAPADEX_STAGES`, extended):**
  The Vite app cannot import backend modules, so the pre-existing `CAPADEX_STAGES` array is confirmed as the
  single frontend source of truth and extended with a documented `STAGE_CODE_TO_LABEL` map and a `stageLabel()`
  helper, plus a canon doc-comment that mirrors the backend (Clarity = alias of Insight; Awareness = uncoded).

### 2.2 Divergence routed to the canon

The only true taxonomy divergence was isolated to the **WC3 service layer** (`stage-intelligence.ts`), which
carried locally named constants (`CANONICAL_STAGE_ORDER` / `CANONICAL_STAGE_WEIGHT`) that read as a *competing*
canon. These were reframed as a WC3 *progression projection* (`WC3_PROGRESSION_ORDER` / `WC3_PROGRESSION_WEIGHT`)
that **sources its labels from the canon** (`CAP_INS → INSIGHT_DISPLAY_ALIAS`). Numeric values are byte-identical;
only the naming/sourcing changed so it no longer presents itself as a second source of truth.

All inline `{ CAP_CUR:'Curiosity', … }` label maps and `['CAP_CUR', …]` validation arrays across backend and
frontend were replaced with references to the canon (`STAGE_CODE_TO_LABEL` / `LIFECYCLE_STAGE_CODES` /
`stageLabel()`). See report 05 for the file-by-file change list.

---

## 3. Non-breaking guarantees

- **No DB values changed.** Stored strings `'Clarity'` / `'Awareness'` remain load-bearing for
  `subscription-engine` stage-floor logic and WC3/WC5/WC7B trend reads — they are read, not rewritten. The canon
  *describes* the alias; it does not migrate data.
- **No feature flag changed.** No flag was added, removed, defaulted, or gated differently.
- **No new tables / migrations.** `lifecycle.ts` is pure constants.
- **Numeric/runtime behaviour identical.** Label maps and stage-order weights resolve to the same values they did
  before; only their *declaration site* moved to the canon.

---

## 4. Verification (summary — full evidence in report 05 + below)

- **Backend boots clean:** `Backend API` workflow restarted, `Server listening on 8080`, 11 flags loaded, all
  route groups registered, zero errors.
- **Frontend production build passes:** `build` workflow `✓ built in 44.68s`, 4845 modules transformed.
- **No regressions in live suites:** cross-org isolation, privacy E2E (4 harnesses), voice-screening &
  live-avatar degradation — all PASS post-change.

**Status: implemented. STOP for human approval — no deploy.**
