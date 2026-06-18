# CAPADEX L5A — Stage Intelligence Report (Question Intelligence 2.0, Phase 1)

**Type:** Implementation + validation (Phase 1 of L5, the Stage slice only).
**Status:** Complete — **STOP, awaiting approval** before Phase 2 (Context Intelligence audit, design-only).
**Date:** 2026-06-08
**Scope built:** derive a canonical developmental **Stage** (Primary + Secondary +
Stage Confidence) for **every** clarity question, from existing metadata only.
**Constraints honoured:** additive · flag-gated (`FF_WC3_QUESTION_INTEL`, default OFF) ·
byte-identical when OFF · reversible (`DROP TABLE wc3_question_intelligence`) · **no**
ontology / signal / concern / question-text changes · nothing fabricated.

---

## 1. What was implemented (Phase 1 only — NOT full L5)

| Artifact | File | Purpose |
|---|---|---|
| Feature flag | `config/feature-flags.ts` → `wc3QuestionIntel` (`FF_WC3_QUESTION_INTEL`) + `isWc3QuestionIntelEnabled()` | gate for future runtime consumption; default OFF |
| Pure derivation | `services/wc3/question-stage-intelligence.ts` → `deriveQuestionStage()` | deterministic weighted-vote stage model |
| Batch builder | same file → `buildQuestionStageIntelligence()` | derive + upsert all clarity Qs; returns metrics |
| Sidecar table | `wc3_question_intelligence` (lazy `ensureWc3QuestionIntelSchema()` + migration `20261209_wc3_l5a_question_stage.sql`) | derived index keyed by clarity SERIAL `id` |
| Runner | `scripts/wc3/build-question-stage.ts` | `npx tsx scripts/wc3/build-question-stage.ts` |

**Derivation model.** Each of the four input fields maps its value to a partial
distribution over the 5 canonical stages; the four distributions are combined by field
weight (`question_type` 0.40 · `response_type` 0.30 · `narrative_style` 0.15 ·
`polarity` 0.15), normalised over the **recognised** votes, and the top two stages become
**Primary** / **Secondary**. `single_select` (a UI format, not a semantic) casts **no
vote** by design; any unrecognised value also casts no vote, lowering coverage and
therefore confidence — honest, never guessed.

`stage_confidence = primaryProb × (0.5 + 0.5 × coverage)`, where `coverage` is the share
of field weight that cast a recognised vote. Bands: **HIGH** ≥ 0.60 · **MODERATE** ≥ 0.45
· **LOW** < 0.45.

Canonical stages are imported from the existing `CANONICAL_STAGE_ORDER`
(`Awareness → Curiosity → Clarity → Growth → Mastery`) — never re-declared.

> The clarity `stage` column was **not** read: it is single-valued ("Clarity" on 14,294,
> blank on 16,344) and carries no canonical signal. L5A therefore *derives* stage rather
> than reading it (consistent with the AQ-1 collapsed-dev-stage finding).

---

## 2. Validation outputs (the 4 required metrics)

Computed over the full pool: **30,638 clarity questions** (all four input fields present
on 100% of rows). Persisted table cross-checked against the builder's in-memory tally —
they agree exactly.

### 2.1 — Output 1: Stage Coverage %
**100.0%** (30,638 / 30,638 resolved to a Primary + Secondary stage).
Coverage is total because `polarity` (always present, always recognised) guarantees at
least one vote; **mean field coverage = 0.928** (most rows recognise all 4 fields; the
~24% `single_select` rows recognise 3 and are honestly discounted in confidence).

### 2.2 — Output 2: Stage Distribution
| Primary Stage | Count | % | Secondary Stage | Count |
|---|---:|---:|---|---:|
| Clarity | 17,049 | 55.6% | Curiosity | 12,883 |
| Growth | 9,314 | 30.4% | Clarity | 7,113 |
| Awareness | 3,391 | 11.1% | Growth | 5,412 |
| Curiosity | 757 | 2.5% | Mastery | 3,113 |
| Mastery | 127 | 0.4% | Awareness | 2,117 |

**Honest reading.** The pool is **diagnostic-heavy**: `question_type='clarity'` (11,355)
plus 65.8% negative polarity pull the centre of mass to **Clarity** and **Growth**.
**Mastery is genuinely rare (0.4%)** because only ~120 questions are
growth-measurement / reflection types — this is a *real catalogue gap*, not a derivation
error, and is left as an honest finding (no fabrication to "balance" the ladder).

### 2.3 — Output 3: Stage Confidence Distribution
| Band | Count | % |
|---|---:|---:|
| HIGH (≥0.60) | 2,821 | 9.2% |
| MODERATE (≥0.45) | 21,474 | 70.1% |
| LOW (<0.45) | 6,343 | 20.7% |

Confidence stats: **mean 0.508**, min 0.240, max 0.768. The MODERATE-dominant shape is
expected and correct: a 5-way distribution rarely concentrates >0.60 on one stage when two
adjacent stages legitimately share the signal (e.g. a `behavior` + `frequency` item splits
Clarity/Growth). HIGH band is reserved for questions whose four fields strongly agree
(e.g. `severity` + `intensity` + `emotional` + `negative` → Awareness).

Histogram: `0.0–0.3`: 69 · `0.3–0.45`: 6,274 · `0.45–0.6`: 21,474 · `0.6–0.75`: 2,820 ·
`0.75–1.0`: 1.

### 2.4 — Output 4: Question Intelligence Score Delta
The Stage dimension occupies **0.20 of the QIS** (Primary 0.12 + Secondary 0.08, per the
L5 design `WC3_L5_QUESTION_INTELLIGENCE.md` §1.4). Before L5A the canonical stage was
unknown → its QIS contribution was **0**.

`ΔQIS = 0.20 × resolved_fraction × mean_confidence × 100 = 0.20 × 1.00 × 0.508 × 100`

**→ ΔQIS = +10.2 points** (pool average). This is the *honest* gain: coverage is full but
confidence is MODERATE, so the score rises by a measured ~10 points rather than the
theoretical maximum of +20 (which would require every question at confidence 1.0). The
residual headroom is real and is the argument for the later L5 dimensions (outcome,
journey, signal, capability) rather than over-tuning stage confidence.

---

## 3. Reversibility & flag behaviour (verified)
- **Flag default OFF** (`wc3QuestionIntel: false`); env override `FF_WC3_QUESTION_INTEL`.
- **Byte-identical when OFF *and* ON:** nothing in the request path reads
  `wc3_question_intelligence` yet — the table is offline-derived analysis. Building or
  dropping it changes no API response. (Runtime consumption is a later, separately-approved
  L5 phase, behind this same flag.)
- **Additive only:** one new table, one new flag, one new pure module, one migration, one
  script. No existing table, route, ontology, signal, concern, or question text touched.
- **Reversible:** `DROP TABLE wc3_question_intelligence;` removes the layer entirely.
- **Idempotent:** the builder upserts `ON CONFLICT (clarity_id)`; safe to re-run.

---

## 4. Honest limitations (carried forward, not hidden)
1. **Distribution skew is a catalogue property, not a bug** — Mastery (0.4%) / Curiosity
   (2.5%) are under-represented because the source pool has few mastery/exploration-typed
   questions. Surfacing this is a deliberate finding for question-authoring, not something
   to fabricate around.
2. **MODERATE-dominant confidence** reflects genuine adjacent-stage ambiguity in
   single-axis behavioural items; it should not be force-inflated.
3. **`single_select` (~24% of rows)** intentionally contributes no stage vote (it is a
   format, not a semantic), so those rows lean on the other three fields — honest, lower
   coverage.
4. **Competency questions (63) are out of scope** for L5A (clarity pool only); they carry
   richer stage/role tags and will fold in when L5 extends beyond clarity.

---

## 5. Phase 2 — NOT STARTED (awaiting approval)
Phase 2 (Context Intelligence audit — Context Coverage, Context Drift, Context-Specific
Question Availability, Context Intelligence Design) is **design-only** and has **not been
started**. It will begin only on explicit approval of this L5A report.

---

**STOP — awaiting approval. No deploy performed.**
