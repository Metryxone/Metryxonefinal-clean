---
name: CAPADEX evidence + signal activation runtime
description: Idempotency/concurrency invariants for the Phase 2 evidence→signal runtime, Phase 3 composite/pattern higher-order tiers, and Phase 4 intervention + explainability layers, fired from /respond
---

# CAPADEX behavioural spine: Answers → Evidence → Signals → Composites → Patterns

The `/api/capadex/session/:id/respond` handler is **upsert-based** (capadex_responses
ON CONFLICT) and can be retried/replayed with identical payloads. Any side-effect
fired from it must be replay-safe.

## Invariants (do not regress)
- **Layering**: Answers → Evidence → Signals. Signals must never activate directly
  from an answer; the only input to the activation runtime is evidence objects.
- **Evidence is idempotent per logical event**: `capadex_evidence` is upserted on
  the key `(session_id, source_id, source_type, evidence_key)`, NOT append-only.
  Replays refresh-in-place so evidence volume = distinct user activity.
- **Signals are recomputed from the COMPLETE evidence set** every invocation and
  persisted as **absolute** values (no per-batch increments). This is what makes
  activation_count/evidence_count/strength stable under replay.
- **Per-session writes are serialised**: the runtime opens one txn, takes
  `pg_advisory_xact_lock(hashtext(session_id))`, then does upsert → reload →
  recompute → persist → COMMIT. Without this, two overlapping /respond calls let a
  stale absolute write clobber a fresher one (last-writer-wins).
- **Set-reconciliation**: `persistSignals` DELETEs activation rows
  (`lifecycle_state IS NOT NULL`) whose `signal_key <> ALL(keep[])` before upsert,
  so signals that drop below threshold don't linger. Classifier-written rows
  (`lifecycle_state IS NULL`, from signal-capture.ts) must stay untouched — the
  unique index on capadex_session_signals is **partial** (`WHERE lifecycle_state
  IS NOT NULL`) for exactly this reason.

**Why:** code review caught replay amplification then a same-session interleave
race; both are silent data-integrity bugs (inflated counts / lost updates) that
only surface under retries or concurrency, not in a single happy-path run.

**How to apply:** when touching the evidence engine, the activation runtime, or
the respond handler wiring, preserve all five invariants. There is no migration
runner — schema is bootstrapped idempotently in `ensureEvidenceRuntimeSchema()`
and mirrored canonically in `backend/migrations/20261025_evidence_signal_runtime.sql`;
keep the two in lockstep.

## Phase 3 — higher-order tiers (composites + patterns)
- The same five invariants extend up the spine. `runEvidenceRuntime` runs the
  higher-order stage (`runHigherOrderRuntime`) **inside the same advisory-locked
  txn** after `persistSignals`, so the whole spine is atomic and idempotent.
- **Composites** (`composite-signal-engine.ts`): definitions are built
  **dynamically** from the `capadex_signals` ontology — each distinct
  `hidden_pattern_contribution` cluster becomes a composite, its members = the
  contributing signals expanded by their `related_signals`. Never hardcode a
  composite list. `minimum_count = max(2, ceil(required*0.5))`, strength via
  `severity_weighted_mean`, confidence via `coverage_x_mean_confidence`.
- **Patterns** (`pattern-engine.ts`): synthesised from active signals + composites
  + contradictions (Phase-2 `suppressed` signals → `CONTRADICTION_PENALTY` 0.85) +
  telemetry (`capadex_session_telemetry` hesitation>8000ms or backtracks>=3 →
  +0.1 boost, cognitive/emotional only). Two kinds: composite-derived and
  `<domain>_concentration` (≥2 co-active signals sharing an ontology domain).
- **Vocabulary bridge**: signal keys, classifier keys and ontology `signal_name`s
  diverge. Match via `coreToken()` normalisation (strips `_pattern/_behavior/`
  `_indicators/_loop/_tendency/_cluster` suffixes) — NOT a hardcoded crosswalk.
  Composites only fire when active-signal core-tokens match ontology tokens; with
  real concern-bucket vocabulary they may rarely fire — that's correct, not a bug.
- Canonical DDL: `backend/migrations/20261101_composite_pattern_runtime.sql`
  (tables `capadex_session_composites`, `capadex_session_patterns`) mirroring
  `ensureCompositeSchema()` / `ensurePatternSchema()`.

## Phase 4 — interventions (write) + explainability (read)
- **Interventions** (`capadex-intervention-engine.ts`) are the final spine node:
  Evidence→Signal→Composite→Pattern→**Intervention**. Generated inside the SAME
  advisory-locked txn (after `persistPatterns`), so all five invariants extend to
  them: absolute upsert + set-reconcile on `(session_id, intervention_key)`,
  idempotent under replay/concurrency. Canonical DDL
  `backend/migrations/20261102_intervention_runtime.sql` mirrors lazy
  `ensureInterventionSchema()`. Table `capadex_session_interventions` is
  **session-scoped** — distinct from the user-scoped enterprise
  `capadex_interventions` (20260506).
- Interventions are NEVER generic: they require BOTH an ontology signal→construct
  mapping (`SIGNAL_CONSTRUCT_MAP`, 20 core-tokens → library construct_keys) AND a
  live `intervention_library` row (keyed by construct + confidence_band +
  emotional_load_band + persona). No catch-all text path exists — if no library
  row matches, no intervention is emitted. Ranked by expected_impact / severity /
  confidence; band selection is inverse-capacity (lower capacity → gentler band).
- **Explainability** (`capadex-explainability-engine.ts`) is **read-only** — NO
  compute, NO writes. It stitches the persisted spine into per-pattern lineage for
  three public GET routes (`/api/capadex/session/:id/{signals,patterns,explain}`).
  NB: a separate Phase-5 `explainability-engine.ts` (composite-score `wrap()`
  decomposition, imported by ~10 route files) already exists — do NOT clobber it;
  the CAPADEX behavioural-spine reader is the `capadex-`-prefixed file.
- Route guard: session ids are `gen_random_uuid()` — validate with a strict UUID
  regex and return 400 BEFORE the query, else a malformed id hits a uuid-typed
  query and bubbles up as a 500.
