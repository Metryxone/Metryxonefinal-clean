# WC-3 Implementation Health

Read-only health audit of the WC-3 behavioural-runtime stack (L1 Stage, L2 Outcome,
L3 Journey, L4 Personalization, L6 Longitudinal). **No code changes, no flag changes,
no data generated** — this is a snapshot of the live dev database + wiring as-is.

Audit date: 2026-06-04 · Scope: dev environment (`DATABASE_URL`).

---

## TL;DR — Built & wired, but DORMANT

Every WC-3 layer is **correctly implemented, schema-provisioned, and wired into the
runtime**, but **none is producing data** because **all `FF_WC3_*` flags are OFF**
(default) and none is set in the running workflow env. The catalogs (route + outcome
models) are seeded; all per-session output tables are empty.

| Check | Result |
|-------|--------|
| L1 actively producing stages | ❌ **No** — `wc3_stage_state` = 0 rows (flag `FF_WC3_STAGE` OFF) |
| L2 producing outcomes | ❌ **No** — `wc3_outcome_state` = 0 rows (flag `FF_WC3_OUTCOME` OFF) |
| L3 producing routes | ❌ **No** — `wc3_journey_state` = 0 rows (flag `FF_WC3_JOURNEY` OFF) |
| L4 capturing personalization decisions | ❌ **No** — `wc3_personalization_decisions` = 0 rows (flag `FF_WC3_PERSONALIZATION` OFF) |
| L6 snapshots being written | ❌ **No** — `wc3_longitudinal_snapshots` = 0 rows (flag `FF_WC3_LONGITUDINAL` OFF) |
| Wiring integrity (would fire when ON) | ✅ **Yes** — all 5 layers hooked + flag-gated (see §3) |
| Schema + catalogs provisioned | ✅ **Yes** — 5 routes + 6 outcome models seeded (see §2) |

**This is expected, not a regression.** WC-3 was delivered additive + flag-gated
default-OFF by design (byte-identical legacy when OFF). The layers have simply never
been activated in this environment, so there is nothing to measure yet.

---

## 1. Flag state (root cause of zero production)

| Flag (config key) | Env var | Default | Set in workflow env? | Effective |
|-------------------|---------|---------|----------------------|-----------|
| `wc3Stage` | `FF_WC3_STAGE` | `false` | no | **OFF** |
| `wc3Outcome` | `FF_WC3_OUTCOME` | `false` | no | **OFF** |
| `wc3Journey` | `FF_WC3_JOURNEY` | `false` | no | **OFF** |
| `wc3Personalization` | `FF_WC3_PERSONALIZATION` | `false` | no | **OFF** |
| `wc3Longitudinal` | `FF_WC3_LONGITUDINAL` | `false` | no | **OFF** |

The `Backend API` workflow sets only `FF_RUNTIME_INTELLIGENCE_ACTIVATION=1` and
`FF_RUNTIME_INTELLIGENCE_PIPELINE=1` — **no `FF_WC3_*`**. Flags resolve from env;
unset → default `false`. Hence every WC-3 runtime branch is skipped at session
completion / analyze time.

---

## 2. Schema & catalog inventory (row counts)

| Table | Role | Rows |
|-------|------|-----:|
| `wc3_journey_routes` | L3 route catalog (seed) | **5** ✅ |
| `wc3_outcome_models` | L2 outcome-model catalog (seed) | **6** ✅ |
| `wc3_stage_state` | L1 per-session stage | 0 |
| `wc3_outcome_state` | L2 per-session × model | 0 |
| `wc3_outcome_actions` | L2 library-backed actions | 0 |
| `wc3_journey_state` | L3 per-session route | 0 |
| `wc3_journey_candidates` | L3 ranked route fits | 0 |
| `wc3_personalization_profile` | L4 per-user profile | 0 |
| `wc3_personalization_decisions` | L4 decision log | 0 |
| `wc3_longitudinal_snapshots` | L6 immutable history | 0 |
| `wc3_longitudinal_trends` | L6 trends (intentionally unpopulated — no trend compute yet) | 0 |

All tables exist (ensure-schema + canonical migrations applied). Catalogs seeded
correctly: `competitive_exam` = `corpus_pending`, `mentoring` = fallback.

---

## 3. Wiring integrity (verified — would produce data when flags ON)

All five layers are present and flag-gated in the runtime path (dynamic `import()`
inside the flag branch, so OFF = not loaded):

- **L1 Stage** — `postCompletionHooks` (`routes/capadex-enterprise.ts` hook #14):
  `isWc3StageEnabled()` → `resolveSessionStage()` → `wc3_stage_state`.
- **L2 Outcome** — same hook, after L1: `isWc3OutcomeEnabled()` →
  `resolveSessionOutcomes()` → `wc3_outcome_state` / `wc3_outcome_actions`.
- **L3 Journey** — same hook, after L2: `isWc3JourneyEnabled()` →
  `resolveSessionJourney()` (passed L1 `stageState` + L2 `outcomeSummary`) →
  `wc3_journey_state` / `wc3_journey_candidates`.
- **L4 Personalization** — `routes/capadex-concern-intelligence.ts` (`/analyze`,
  ~line 1765): `isWc3PersonalizationEnabled()` → `buildPersonalizationEnvelope()` +
  `logPersonalizationDecision()` → `wc3_personalization_decisions` / `_profile`.
- **L6 Longitudinal** — same completion hook: `isWc3LongitudinalEnabled()` →
  `captureLongitudinalSnapshot()` → `wc3_longitudinal_snapshots` (trends never
  written here, by design).

Conclusion: **no broken wiring** — the only reason for zero rows is the flags.

---

## 4. Measurements

### 4.1 Runtime activation rate

Denominator = completed CAPADEX sessions (the population eligible for the completion
hook). Window: all-time (all 27 sessions fall within the last 30 days).

| Metric | Value |
|--------|------:|
| Total CAPADEX sessions | 27 |
| Completed sessions (hook-eligible) | 9 |
| Sessions with an L1 stage | 0 |
| Sessions with an L2 outcome | 0 |
| Sessions with an L3 journey | 0 |
| Sessions with an L4 personalization decision | 0 |
| Sessions with an L6 snapshot | 0 |
| **WC-3 runtime activation rate** | **0 % (0 / 9)** |

### 4.2 Route distribution (L3)
**Empty** — `wc3_journey_state` has 0 rows. (Catalog supports: `lbi`,
`career_builder`, `employability_index`, `competitive_exam` [corpus_pending],
`mentoring` [fallback].)

### 4.3 Stage distribution (L1)
**Empty** — `wc3_stage_state` has 0 rows.

### 4.4 Outcome distribution (L2)
**Empty** — `wc3_outcome_state` has 0 rows. (Catalog supports 6 models:
`career_clarity`, `learning_effectiveness`, `employability_readiness`,
`exam_readiness` [gated], `confidence_stability`, `decision_quality`.)

### 4.5 Journey (confidence-band) distribution (L3)
**Empty** — no `confidence_band` values to aggregate
(`HIGH_CONFIDENCE` / `MODERATE_CONFIDENCE` / `LOW_CONFIDENCE` / `CORPUS_PENDING`).

---

## 5. Interpretation & honest findings

1. **WC-3 is shelf-ready but not switched on.** Implementation, schema, catalogs and
   wiring are all healthy; the stack has simply never run because flags are OFF in this
   environment. There is no data-quality problem to report — there is no data.
2. **The 9 completed sessions predate / ran without activation.** They completed while
   the flags were OFF, so the completion hook skipped all WC-3 branches. Turning flags
   on does **not** backfill historical sessions; only sessions completed *after*
   activation will produce L1/L2/L3/L6 rows, and L4 only fires on new `/analyze` calls.
3. **`wc3_longitudinal_trends` being empty is by design**, not a gap — L6 captures
   immutable snapshots only; trend computation is a later phase.
4. **No verification of live distributions is possible yet.** Any distribution numbers
   would be fabricated; they are honestly reported as empty.

---

## 6. To make these layers produce data (operator action — NOT done here)

To activate end-to-end (then re-run this audit after new sessions complete), set the
flags in the `Backend API` workflow env and restart it:

```
FF_WC3_STAGE=1 FF_WC3_OUTCOME=1 FF_WC3_JOURNEY=1 FF_WC3_PERSONALIZATION=1 FF_WC3_LONGITUDINAL=1
```

Then run new CAPADEX assessments to completion (L1/L2/L3/L6) and trigger `/analyze`
(L4). Activation rate and the four distributions will populate for sessions processed
while the flags are ON. **This audit made no such change** (read-only, per request).
