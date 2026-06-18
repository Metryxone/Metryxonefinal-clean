---
name: WC-L2 Forecast Intelligence
description: How forecasts are built (extrapolate existing trends), the honesty rules, and the data ceiling that bounds them.
---

# WC-L2 Forecast Intelligence Foundation

A forecast is NOT a new model. It is a one-step linear EXTRAPOLATION of an EXISTING trend:
`projected = clamp(last + slope_per_session, 0..100)` — the exact `forecast_next` formula that already
ships in `longitudinal-consumption.ts` — at the trend's OWN confidence (no new uncertainty number).

**Forecast → source-trend map (do not re-wire):** risk ← behaviour `risk` dim
(`computeUserBehaviourTrends`); growth ← `stage` lever, outcome ← `outcome` lever, journey ← `journey`
lever (all `computeUserTrends`). Both compute* funcs are PURE READ (no ensure-schema, no writes) — only
their `persist*`/`get*` siblings touch schema. Compose the compute* funcs, never the persist* ones, to
stay read-only.

**Why:** canon is reuse-existing-intelligence-only — no new constructs/ontology/scoring models. Anything
beyond `last+slope` over an existing trend would be a new model and is disallowed.

**How to apply:** a forecast requires an underlying trend, which requires ≥2 comparable sessions for that
specific lever/dim. No trend → `{forecastable:false, reason:'insufficient_sessions'|'no_trend'}`. NEVER
fabricate a value or confidence. Flag-gate at `computeUserForecasts` (off → `{enabled:false}`) so flag-off
is byte-identical; this is a FOUNDATION — no route/UI/persistence yet (note them as roadmap).

## The honest data ceiling (the real story, not the code)
Forecast coverage is DATA-BOUND, not code-bound. A forecast needs longitudinal depth that barely exists:
- Only owners with ≥2 completed sessions are forecastable. Anonymous sessions (null guest_email) can NEVER
  form a cross-session series → structurally excluded, not a defect.
- Trend confidence floors at ~0.33 for a 2-point line (scale: 2→0.33, 3→0.67, 4→1.0). Most/all real
  forecasts sit at this floor and MUST be surfaced as low-confidence — a 2-point line can't tell a real
  trajectory from noise. Don't dress the floor up as "moderate".

**Why:** "honesty over targets" — report TRUE ceilings, never inflate. The deliverable's value is the
honest finding that the engine is correct but coverage scales only with repeat-session depth.

## Audit-report honesty traps (caught by architect, fix forward)
- **Denominator integrity:** count per-kind coverage STRICTLY over the eligible (≥2-session) population so
  `forecastable + no_trend == eligible` exactly. Ineligible (<2 session) owners are unforecastable for
  EVERY kind by definition — report them ONCE as a separate population line, never fold their
  `insufficient_sessions` into a table labelled "N trend-eligible owners" (that overstates the gap math).
- **Confidence-band ↔ prose consistency:** the band thresholds and the narrative wording must agree. If
  prose says floor=low, the band function must map 0.33→low (thresholds high≥0.84 / moderate≥0.5 / low).
- **PII mask at capture:** sha256 `user_<hex[:10]>` deterministic mask when rows are read into the audit
  struct — zero raw emails reach any artifact (verify `grep -rn '@' audit/<phase>/`). (WC-L0E lesson.)
  Also keep literal `@` OUT of report PROSE (e.g. "at conf floor", not "@ conf floor") or the PII scan
  trips on your own copy.

## WC-L2A Coverage-Expansion audit (the expansion-modelling lessons)
- **Forecastability is TWO independent gates, never one:** (1) session-depth (≥2 completed) AND (2) that
  layer's state having ≥2 readable points. Decompose every non-forecastable (owner×layer) cell into exactly
  one driver so the loss table reconciles (`forecastable + Σdrivers == owners×layers`). Session-depth loss
  and per-layer state-capture loss are different axes — don't merge them.
- **Per-session state-capture rate ≠ per-owner trendability.** A behaviour ROW present on 5/5 sessions does
  NOT mean a behaviour DIM is trendable: WC-L2's behaviour forecast keys on `risk`, the SPARSEST dim
  (non-null 2/5), while `confidence`/`engagement` (4/5) are already trend-eligible. So "Behaviour 0%" is a
  dim-SELECTION finding, not data depth — the cheapest layer win is pointing the SAME projection at a denser
  dim, no new data. Always check dim-level nulls, not just row presence.
- **Expansion scenarios must split deterministic from assumed.** The depth gate (who crosses ≥2 after +k
  sessions) is deterministic; whether a NEW session carries readable state is an ASSUMPTION — tie it to the
  OBSERVED per-session capture rate and label the whole scenario a MODEL. Scenarios that POSIT full capture
  (C/D/E) are deterministic under their own stated premise. Never present any of it as measured.
- **Coverage curve: empty depths = "no data", never interpolated.** Only depths 1 and 2 exist here; the
  L1/L2 confidence formula PREDICTS the band by depth (0.33→0.67→1.0) but coverage at depths 3/4/5+ must be
  measured, not assumed. Report the formula as prediction, the curve as measurement.
- **Small-n makes % targets coarse — say so.** With 3 owners, coverage moves in ~33% steps; 50/75/90%
  collapse (50% already met; 75% & 90% both just need the lone 1-session owner +1). Report counts alongside
  %, and flag that anonymous sessions, if real users, lower true coverage and need identity attribution.
- **Decision layer wording (architect catch):** `computeUserForecasts`/`ForecastKind` expose only
  risk|growth(stage)|outcome|journey — Decision is NOT in the WC-L2 runtime API. You may audit it from its
  WC-11 trend via the same projection logic, but say "same projection logic, NOT exposed in WC-L2 runtime
  API" — never imply `projectForecast` already serves it.
- **Cross-check buys traceability cheaply:** also call `computeUserForecasts` and assert its forecastable +
  forecast_confidence agree with the raw-trend measurement for the 4 shared layers (expect 0 mismatches) —
  this is how you PROVE "confidence traceable to WC-L2 outputs" instead of asserting it.

## WC-L2B Outcome-Forecast Activation (the "activate it" phase that found nothing to activate)
- **An "activation/backfill" phase can be a provable NO-OP, and that IS the deliverable.** Before writing
  any backfill, probe whether the engine's INPUT exists. Outcome state writes only when the
  Question→Construct→Outcome chain resolves a construct, whose inputs are: `master_concern_pk` (→ bridge
  tag → crosswalk, flag `FF_WC3_OUTCOME_CROSSWALK`), OR `primary_construct_key`, OR an active behavioural
  spine (`behavioural_hypotheses` lifecycle_state='active', construct_key not null; session_id is TEXT no-FK
  → cast `s.id::text`). The engine's tier-2 pattern path is INERT here (`capadex_session_patterns` has NO
  `construct_key` column) — note it explicitly so a reader doesn't think you forgot it.
- **The honest ceiling was one layer UPSTREAM of the stated blocker.** WC-L2A blamed "outcome state not
  persisted"; the real gap is concern-linkage CAPTURE at assessment time. Every session that COULD resolve
  an outcome already had one; the rest carried zero linkage, so backfill wrote 0. Fixing it needs a
  capture-pipeline change (new phase), NOT outcome/trend/forecast engine reuse. Don't fabricate constructs
  to force coverage; report before==after and name the upstream blocker.
- **Anon outcome rows are a coverage trap.** Outcome state can sit on anon sessions, inflating a naive
  "sessions with outcome state" count — but anon rows never enter a per-user trend. Split owned vs anon in
  EVERY outcome-coverage table; an outcome trend needs ≥2 OWNED outcome-bearing sessions for ONE owner.
- **Never-overwrite is an operational guarantee via PRE-FILTER, not an engine property.** `resolveSessionOutcomes`
  uses `ON CONFLICT DO UPDATE`, so additivity comes from pre-filtering to sessions with zero existing state
  before calling it; word it "never-overwrite-in-this-run", not as if the engine refuses overwrites.
- **`persistUserTrends` (a WRITE) is acceptable for T004 recompute** — it's the existing WC-L1 infra,
  idempotent UPSERT, no new scoring. With no new outcome state it simply re-writes the same stage/journey/
  decision trends and produces no outcome trend (correct).

## WC-L3 refinement — "stale linkage" is NOT "capture failure" (re-resolvable)
- **WC-L2A/B said the blocker was upstream concern-linkage CAPTURE needing a new phase. WC-L3 disproves the
  hard part:** a NULL `master_concern_pk` / `primary_construct_key` where `concern_name` is present is
  STALE PERSISTENCE, not capture loss. Re-run the EXISTING resolvers read-only over the stored text to
  separate three loss modes: capture (input absent) vs mapping (re-resolve==null) vs stale (re-resolve!=stored).
  Measured: master stored 1/9 → re-resolves 9/9 (`resolveSeedConcernPk`, 60% token overlap); construct
  stored 2/9 → re-resolves 5/9 (`detectCategory`); residual = a small `CONCERN_TO_CONSTRUCT` mapping gap
  (e.g. "Career Anxiety", "Work Stress"), NOT new ontology.
- **Outcome reachability can be MEASURED read-only by MIRRORING `resolveConstructsFromClarityBank`**
  (`primary_construct_key` ∪ L5C `resolveConstructForBridgeTag(master.relational_bridge_tag)` HIGH/REVIEW),
  matched against `wc3_outcome_models.construct_keys`. Because the spine is empty system-wide the engine
  falls to exactly this path, so the mirror is faithful — re-resolve lifts outcome reachable 3/9→9/9 and
  forecast 0/2→2/2 eligible owners, with NO new capture. So the shortest path to >90% is a re-resolve
  backfill of existing data + the existing WC-L2B outcome backfill — re-check this before declaring "needs a new phase".
- **Journey is NEVER null (Mentoring fallback) → "journey routed" is trivially 100%.** Only the CONFIDENT
  (non-fallback) journey requires an activated outcome model and thus mirrors outcome. NEVER report
  journey==outcome as "measured"; label it DERIVED from the journey-engine contract (or execute `buildJourney`).
- **"Outcome reachable" = STRUCTURAL routing, not evidence quality.** A 0-response session routes to a model
  via concern linkage alone with no behavioural evidence; count it as reachable but EXCLUDE from forecast
  (forecast needs ≥2 OWNED outcome-bearing sessions, all with responses). 0-response sessions are an
  un-backfillable spine ceiling — honest, never fabricate.

### WC-L3 backfill EXECUTED — the re-resolve thesis held
- Ran the re-resolve backfill (`wcl3-concern-linkage-backfill.ts`, additive never-overwrite, `--apply`):
  concern linked **1→9/9 (100%)**, construct 2→5/9, outcome-state sessions 3→6, eligible owners with
  outcome trend AND forecast **0→2/2 (100%)** — confirming WC-L3's thesis that the NULLs were stale
  persistence recoverable with the EXISTING resolvers + EXISTING WC-L2B outcome engine, NO new capture.
- **Honesty refinement worth keeping: gate the outcome backfill on ≥1 RESPONSE.** Fill LINKAGE for all
  sessions (the concern they typed is real even at 0 responses) but WITHHOLD the outcome write for
  zero-response sessions — else the engine persists an EVIDENCE-FREE outcome_state row (structural routing,
  no behaviour). This never changes the forecast (eligible owners' sessions all have responses) and avoids
  inflating outcome coverage. Report withheld sessions explicitly.
- **Coverage 100% ≠ confidence.** Both forecasts land at the WC-L2 `low`/0.33 floor (2-point series); that
  is the honest ceiling — moderate/high needs 3–4 outcome-bearing sessions per owner (data accumulation,
  not a linkage defect). Always state "100% readiness" WITH the low-confidence qualifier.
