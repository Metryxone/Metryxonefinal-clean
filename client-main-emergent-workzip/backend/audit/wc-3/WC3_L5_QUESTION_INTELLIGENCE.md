# CAPADEX L5 — Question Intelligence 2.0 (Design & Audit)

**Type:** Design + audit deliverable. **NO implementation** — no code, schema, ontology,
signal, concern, or catalog changes were made. This document is the deliverable.
**Status:** Complete — **STOP, awaiting approval** before any implementation.
**Date:** 2026-06-08
**Scope:** Design a Question Intelligence layer (L5) that enriches every question with
the intelligence dimensions produced by the completed WC-3 stack
(L1 Stage · L2 Outcome · L3 Journey · L4 Personalization · L6 Longitudinal).
**Grounding rule:** every figure below is measured from the live DEV database or read
from real code. Where a dimension cannot be measured today, that is stated as an honest
gap — nothing is fabricated.

---

## 0. Inputs available (the completed WC-3 stack — what L5 composes against)

| Layer | Service | Produces (real fields) | Flag |
|---|---|---|---|
| **L1 Stage** | `services/wc3/stage-intelligence.ts` | `StageState`: `canonical_stage` ∈ `CANONICAL_STAGE_ORDER` (Awareness, Curiosity, Clarity, Growth, Mastery), `stage_order_index`, `confidence` | `FF_WC3_STAGE` |
| **L2 Outcome** | `outcome-intelligence.ts` | `OutcomeSummary`: `models[]` (`model_key`, `matched_constructs[]`, `confidence`, `actions[]`), `explainability`, `actionability` | `FF_WC3_OUTCOME` |
| **L3 Journey** | `journey-intelligence.ts` | `JourneyResult`: `primary_route`, `secondary_route`, `route_confidence`, `confidence_band`, `product_mapping` | `FF_WC3_JOURNEY` |
| **L4 Personalization** | `personalization-wiring.ts` | `PersonalizationEnvelope`: `dims_used{age, age_band, canonical_persona, is_proxy, severity, construct_key}` | `FF_WC3_PERSONALIZATION` |
| **L6 Longitudinal** | `longitudinal-foundation.ts` | `LongitudinalHistory`: append-only `snapshots[]` of stage/score over time | `FF_WC3_LONGITUDINAL` |

**Composition spine:** L1 → L2 → L3 (each reads the prior); L4 + L6 run alongside.
L5 is a **session-independent, question-catalogue** layer: it stamps each *question* with
the same dimensional vocabulary so that selection can be intelligence-driven, the mirror
image of the per-*session* WC-3 chain.

---

## 1. Question Intelligence Architecture (Output 1)

### 1.1 Principle
L5 is **compose-only and additive**, exactly like every WC-3 phase: it re-shapes
already-computed metadata and the WC-3 catalogue into a per-question intelligence stamp.
It **never authors question text**, never fabricates a dimension, and is **byte-identical
when flag OFF**. Unresolved dimensions are emitted as `null` with a `reason`, never guessed.

### 1.2 The per-question intelligence record (the 9 derived dimensions)
For every question L5 derives the following. The "Source" column is the **real** field(s)
the derivation reads — there is a working source for each; none is invented.

| Dimension | Derivation source (real) | Confidence basis |
|---|---|---|
| **Primary Stage** | `question_type` + `response_type` + `polarity` → mapped to `CANONICAL_STAGE_ORDER` (the `stage` column is unusable — see §2.3) | rule-table weight |
| **Secondary Stage** | adjacent canonical stage from the same mapping | rule-table weight |
| **Primary Outcome** | `master_bridge_tag` → concern → `CONCERN_TO_CONSTRUCT` → `wc3_outcome_models.construct_keys` | chain depth |
| **Primary Journey** | resolved Outcome model → `wc3_journey_routes.model_affinities` (reuse L3 `buildJourney` ranking) | route confidence band |
| **Persona** | bridge-tag persona affinity (soft) + competency `role_tags`/`industry_tags`; flagged AMBIGUOUS where multi-persona | affinity strength |
| **Context** | registry `coverage_dimension` (10 behavioural contexts) + `question_type` | present/derived |
| **Capability** | `capadex_concern_signal_map` signal → construct/competency linkage | match_method |
| **Signal** | `capadex_concern_signal_map` (`signal_tier`, `signal_ref`, `signal_name`) | map confidence_band |
| **Question Intelligence Score (QIS)** | weighted composite of the 8 above + downstream utility (`question-utility-index`: reaches_intervention) + differentiation | 0–100 |

### 1.3 Proposed storage (design only — not created)
A single additive sidecar table, mirroring the WC-3 `*_state` pattern:

```
wc3_question_intelligence (
  question_id            TEXT PRIMARY KEY,   -- joins clarity/competency/registry
  source                 TEXT,               -- 'clarity' | 'competency'
  primary_stage          TEXT,  secondary_stage TEXT,  stage_confidence NUMERIC,
  primary_outcome_key    TEXT,  outcome_confidence NUMERIC,
  primary_journey_route  TEXT,  journey_band TEXT,
  persona                TEXT,  persona_is_ambiguous BOOL,
  context_dimension      TEXT,
  capability_key         TEXT,
  signal_ref             TEXT,  signal_tier TEXT,
  qis                    NUMERIC,            -- 0..100
  resolved_dims          JSONB,              -- which dims resolved vs null+reason
  computed_at            TIMESTAMPTZ
)
```
No existing question table is mutated; this is a derived index keyed by `question_id`,
rebuilt by an idempotent job, gated by a new `FF_WC3_QUESTION_INTEL` flag.

### 1.4 QIS formula (proposed)
`QIS = 100 × Σ(wᵢ · resolvedᵢ · confᵢ)` over the 8 dimensions, then × a utility multiplier.
Proposed weights (sum = 1.0): Outcome 0.18, Journey 0.15, Signal 0.15, Capability 0.12,
Stage(primary) 0.12, Context 0.10, Persona 0.10, Secondary-Stage 0.08. Utility multiplier
∈ {1.0 reaches_intervention, 0.85 unknown, 0.6 dead_end}. A question scores high only when
it resolves to a real outcome/journey/signal **and** its chain reaches an intervention.

---

## 2. Coverage Audit (Output 2) — the 7 required dimensions

Measured from DEV (`capadex_clarity_questions` = 30,638 rows; `competency_question_templates`
= 63; `capadex_question_registry` = 14,294).

### 2.1 Current question metadata (what exists today)
- **Clarity (30,638):** rich psychometric + routing metadata — `master_bridge_tag`
  (**0 UNMAPPED**, 325 distinct tags), `question_type` (15+ values), `response_type`
  (10+ values), `polarity`, `question_weight`, score anchors, `option_a..e(_score)`.
- **Competency (63):** `competency_code`, `template_body{role_tags, industry_tags,
  stage_tags, function_tags}`, `difficulty_band`, all `status='approved'`.
- **Registry (14,294):** lifecycle `status` (**all 'active'**), `coverage_dimension`
  (present on 13,931 = 97.5%), `usage_count`/`signal_value` (**signal_value NULL on 100%**),
  `duplicate_of`/`duplicate_score`.

### 2.2 Current question differentiation
Strong on **`response_type`** (single_select 7,264 · frequency 7,163 · confidence 3,865 ·
intensity 2,427 · situational_fit 2,125 · agreement 1,977 · readiness 1,781 · …) and
**`question_type`** (clarity 11,355 · coping 4,613 · readiness 4,552 · severity 4,408 ·
behavior 4,388 · …). **`polarity`**: negative 20,150 / positive 10,479 / mixed 5 / neutral 4.
→ Questions are well-differentiated *behaviourally* but **not along the WC-3 intelligence
axes** (stage/outcome/journey/persona).

### 2.3 Stage coverage — **the headline gap**
The clarity `stage` column has only **one real value** ("Clarity", 14,294 rows) and is
**blank on 16,344 rows**. There is **zero alignment** to the 5-value `CANONICAL_STAGE_ORDER`.
→ **Canonical-stage coverage of the question pool is effectively 0%.** L5 must *derive*
stage from `question_type`/`response_type`/`polarity`; it cannot read it. (Consistent with
the AQ-1 finding that the clarity dev-stage taxonomy collapsed to "Clarity".)

### 2.4 Outcome coverage
No question→outcome column exists. The only working bridge is
`master_bridge_tag → concern → construct → wc3_outcome_models`. Ceiling is the
post-remediation **concern→covered-construct coverage = 74.6% (132/177)**; the remaining
25.4% map to the 7 orphan constructs (see `WC3_ROUTE_COVERAGE_UPDATED.md`). → an estimated
**~75% of clarity questions can resolve a Primary Outcome**, the rest honestly `null`.

### 2.5 Journey coverage
Entirely derived (no question→journey link). Follows Outcome: where an outcome resolves,
journey routing is **100% mapped** (6/6 routes have products). → Journey-resolvable ≈ the
same ~75% ceiling as Outcome; below that, deterministic Mentoring fallback (degraded).

### 2.6 Persona coverage
- **Clarity: absent as stored metadata** — persona is decided at *runtime* by text match;
  bridge-tag persona affinity is **soft** (~63% of families are provider-only) and
  **ambiguous** (multi-persona / wide age span — AQ-1). → explicit persona coverage ≈ **0%**;
  L5 can derive a *soft, ambiguity-flagged* persona only.
- **Competency: strong** — `role_tags`/`industry_tags` give real persona affinity.

### 2.7 Context coverage
No dedicated context field, but the registry `coverage_dimension` is a real behavioural-
context proxy on **13,931 rows** across 10 contexts (coping_strategy 2,833 ·
behavioral_response 2,820 · change_readiness 2,799 · impact 2,663 · emotional_state 1,651 ·
strength_asset 418 · trigger 366 · thought_pattern 335 · root_cause 33 · avoidance 13).
**Caveat:** the registry covers only the 14,294 "Clarity"-stage questions = **46.7% of the
full 30,638 clarity pool**, so context coverage of the *whole* pool is ~47%.

### Coverage summary table
| Dimension | Source today | Resolvable coverage (honest) |
|---|---|---|
| Metadata richness | present | High (behavioural axes) |
| Differentiation | type/response_type/polarity | High behaviourally; none on WC-3 axes |
| **Stage (canonical)** | none usable | **~0% (must derive)** |
| Outcome | bridge→construct→model | ~75% (concern ceiling) |
| Journey | derived from outcome | ~75% (then 100% product-mapped) |
| Persona | clarity none / competency tags | clarity ~0% explicit; competency strong |
| Context | registry coverage_dimension | ~47% of full pool (97.5% of registry subset) |
| Signal | concern_signal_map | **100% tag-level** (all 325 clarity tags reach the map) |

---

## 3. Gap Analysis (Output 3)

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G1 | **No canonical-stage signal on questions** | High | `stage` single-valued "Clarity" (14,294) / blank (16,344); 0% canonical alignment |
| G2 | **No explicit persona on clarity** | High | persona is runtime text-match; bridge-tag persona soft + ambiguous (AQ-1) |
| G3 | **Outcome/Journey resolvable for only ~75%** | Medium | bounded by concern→construct coverage 132/177; 7 orphan constructs strand 25.4% |
| G4 | **Context coverage only ~47% of full pool** | Medium | registry (coverage_dimension) covers 14,294 of 30,638 clarity rows |
| G5 | **No usage/effectiveness signal** | Medium | registry `signal_value` NULL on 100%; can't yet weight QIS by real effectiveness |
| G6 | **No capability link materialised** | Medium | capability is inferable via concern_signal_map but not stored per-question |
| G7 | **Registry status undifferentiated** | Low | all 14,294 = 'active' (cold-start; governance not yet exercised) |
| G8 | **Two disjoint metadata vocabularies** | Low | clarity (behavioural) vs competency (role/industry) never unified under one schema |

Honest non-gaps: signal reachability is effectively complete (100% tag-level), bridge-tag
mapping is complete (0 UNMAPPED), and behavioural differentiation is already strong.

---

## 4. Expected Intelligence Score Improvement (Output 4)

QIS is computed per the §1.4 formula. Current vs projected, by dimension (resolvable ×
typical confidence). These are **projections from measured coverage**, clearly labelled.

| Dimension (weight) | Current resolvable | Projected after L5 |
|---|---|---|
| Primary Stage (0.12) | ~0% | ~95% @ MODERATE (derived) |
| Secondary Stage (0.08) | ~0% | ~90% @ LOW–MODERATE |
| Outcome (0.18) | ~0% stored | ~75% @ chain-depth conf |
| Journey (0.15) | ~0% stored | ~75% (100% product-mapped) |
| Persona (0.10) | clarity ~0% | ~50% soft + ambiguity flag |
| Context (0.10) | ~47% (registry) | ~47% (no fabrication) → ~75% if extended to full pool |
| Capability (0.12) | not stored | ~75% via signal map |
| Signal (0.15) | not stored | ~100% tag-level |

**Indicative pool-average QIS: ~32 → ~74 / 100.** Drivers: stage/outcome/journey/capability/
signal move from *stored-zero* to *derived-real*; the ~26-point residual is **honest** —
orphan-construct concerns (G3), persona ambiguity (G2), and the registry/context subset (G4)
genuinely cap the score and must not be inflated.

> The score rises by *materialising derivations that are currently latent*, not by adding
> data. Where the chain is genuinely incomplete, QIS stays capped — the same discipline as
> the L3 route-coverage audit (degraded ≠ failed, partial reach is honest).

---

## 5. Implementation Plan (Output 5) — for approval; NOT executed

Strictly additive · flag-gated (`FF_WC3_QUESTION_INTEL`, default OFF) · byte-identical when
OFF · reversible · stop-for-approval per phase. No question text, ontology, signal, or
concern changes.

| Phase | Deliverable | Notes |
|---|---|---|
| **L5-0** | Feature flag `wc3QuestionIntel` + `isWc3QuestionIntelEnabled()` | mirror existing WC-3 flag pattern |
| **L5-1** | Schema + migration + lazy `ensureWc3QuestionIntelSchema()` for `wc3_question_intelligence` | sidecar index keyed by `question_id`; no source table mutated |
| **L5-2** | Stage-derivation rule table (`question_type`×`response_type`×`polarity` → primary/secondary canonical stage) | closes G1; pure, deterministic, auditable |
| **L5-3** | Outcome+Journey resolver per question (reuse `CONCERN_TO_CONSTRUCT` + `buildJourney`) | closes part of G3; emits `null`+reason for orphan constructs |
| **L5-4** | Capability+Signal stamp from `capadex_concern_signal_map` | closes G6; 100% tag-level signal |
| **L5-5** | Persona (soft + ambiguity flag) + Context (registry `coverage_dimension`) stamp | honest partial per G2/G4 |
| **L5-6** | QIS scorer (§1.4) + idempotent batch builder + `?refresh` | utility multiplier from `question-utility-index` |
| **L5-7** | Read route `GET /api/capadex/question-intel/:questionId` (+ catalogue stats); flag-OFF → `{enabled:false}` | mirror `/journey` contract; never 500 |
| **L5-8** | Optional: feed QIS into selection ranking (`question-metadata-ranking.ts`) behind the same flag | only after audit sign-off |
| **L5-9** | Validation: OFF byte-identical; ON catalogue stats; deltas report; architect review | no deploy |

### Risks / honest constraints
- **Persona ambiguity (G2)** and **orphan-construct concerns (G3)** cap Outcome/Journey/
  Persona coverage; L5 must *report* these, never fabricate.
- **No effectiveness signal yet (G5):** QIS v1 uses structural resolution + utility;
  usage-weighted QIS v2 waits until `signal_value`/`usage_count` accrue real runtime data.
- **DEV `behavioural_hypotheses` is empty** → per-session activation can't be smoke-tested
  end-to-end here; L5 is catalogue-level so it is testable independently, but live outcome
  resolution should be re-validated once spine data exists.

---

**STOP — awaiting approval. No implementation performed; no deploy.**
