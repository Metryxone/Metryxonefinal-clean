# CAPADEX — Architecture Guide

> Consolidation of the existing architecture. No new architecture is introduced here.

## 1. Ontology Architecture

A **4-tier signal taxonomy**, top to bottom:

| Tier | Entity | Table | Approx. count |
|---|---|---|---|
| 1 | Domains | `capadex_domains` | 20 |
| 2 | Families | `capadex_families` | 400 |
| 3 | Signals | `capadex_signals` | 20 |
| 4 | Atomic signals | `capadex_atomic_signals` | 15,972 |

Atomic signals carry a large `GENERAL_CONCERN` catch-all that is **mostly positive strengths** (by
design, not a bug). Runtime keys off `atomic_signal_id`, not the bridge tag.

## 2. Concern Architecture

- **Concerns Master** (`capadex_concerns_master`, ~2,489 rows) — the canonical concern catalogue.
  `display_label` is user-facing; `concern_area / concern_id / domain / concern_cluster` are join
  keys.
- Free-text concern → concern via **two resolvers**: `resolveCapadexConcern` (regex keyword fallback
  to 7 legacy categories — never 404s) and `resolveMasterConcernIdFromText` (token-overlap confidence
  against the master, with age/persona tie-breakers and optional signal-grounding boost).

## 3. Bridge Tag Architecture

**Bridge tags (~325)** are the join hub between concerns and clarity questions:
`clarity.master_bridge_tag = master.relational_bridge_tag` (bucket-level, many-to-many).

- ⚠️ **`clarity.concern_id` is disjoint from `concerns_master` (0% join)** — the only working ontology
  bridge is the bridge tag. Age/persona/dev-stage inherited from the tag are *ambiguous*.
- A single shared resolver (`services/bridge-tag-resolver.ts`) is the source of truth for both the
  runtime picker and offline tooling — never copied.
- Orphan/GENERAL_CONCERN tags are retired by **sibling remap**, never by bulk question generation.

## 4. Metadata Architecture

Each question carries (or should carry, per question) eight dimensions:

| Dimension | Cardinality | Coverage (legacy) | Differentiation role |
|---|---|---|---|
| dev_stage | 5 | 100% | The only legacy within-tag differentiator (capped) |
| persona | 5 | 96.9% | Low ceiling (routing) |
| age_band | 4 | 99.6% | Low ceiling (routing) |
| capability | 286 | 100% (flat) | High headroom — dormant until per-question enrichment |
| behaviour | 119 | 99.9% (flat) | High headroom — dormant |
| signal | 87 | 55.8% | Coverage problem (44.2% null) |
| **context** | 13 (8 Primary + 5 Situational) | **shipped** | Routing (cross-tag), 0 within-tag |
| **archetype** | 8 forms | **shipped** | Highest-yield within-tag differentiator |

**Root cause of low differentiability:** legacy metadata was derived at **tag** granularity and
inherited by every question. The fix is per-question, evidence-derived metadata (C-1A architecture).

## 5. Question Intelligence Architecture

- **Clarity question bank** (`capadex_clarity_questions`, ~30,638) is the question corpus.
- **Question metadata** (`capadex_question_metadata`) holds the per-question dimensions; enrichment
  candidates land in `capadex_question_enrichment` (and the sandbox `pilot_c1a_enrichment` for the
  pilot — revert = `DROP TABLE`).
- **Question registry** (`capadex_question_registry`) lifecycle-tracks every clarity question under
  **human governance** — never auto-deprecated; status transitions are human-only and audited.
- **Diversity Standards** (C-1A) define per-tag floors (distinct capabilities/behaviours/contexts/
  archetypes/signals) and a **differentiability index** (min 0.30 / target 0.45 / excellent 0.60).

## 6. Routing Architecture

- **3-tier clarity picker** (priority order): `pickQuestionsFromMaster` (bridge-tag join, source
  `master_curated`) → `pickQuestionsFromDB` (adaptive bank, source `adaptive_bank`) → static
  `pickQuestions` (source `static_fallback`). The response carries a `clarity_source` provenance pill.
- **Context** is the new first-class routing dimension (today's legacy routing is domain-blind). The
  Question Relevance Score (QRS) weights age/persona/context/stage.
- See `CAPADEX_ROUTING_ARCHITECTURE.md` for the full flow.

## 7. Scoring Architecture

Five distinct scores, deliberately not conflated (see `CAPADEX_SCORING_MODEL.md`):

- **QIS / QIS V2** — question intelligence (quality + differentiability + routing potential).
- **AIS / Trust** — assessment confidence (claim vs verification).
- **CSI** — longitudinal career-stage/stability index.
- **Differentiability** — within-pool distinguishability (`1 − within-tag weighted HHI`).
- **QRS** — routing readiness (metadata ↔ runtime context match).

## 8. Assessment Intelligence Model

Answers → **Evidence** → **Signals** → **Composites → Patterns** (inside an advisory-locked
transaction) → **Interventions** (library-backed, never generic) → **Behaviour graph** (one per
session) → **Recommendations / Knowledge graph** (PIL). Every stage is additive, read-only over prior
outputs, and produces honest partial results when evidence is thin (UNCLASSIFIED, never fabricated).

## 9. Trust Model

Trust separates *what is claimed* (capability) from *how much we trust it* (verification). Baseline
60; verified credentials lift, revoked/expired penalize; a trust multiplier maps to `[0.5, 1.3]`.
Report quality has a **safety gate** — any safety-quality score < 60 fails the report.

## 10. Differentiability Model

`differentiability = 1 − (tag-size-weighted within-tag HHI)` over the enrichable dimensions.
0 = every question in a tag is identical (today's state, 0.096); → 1 = unique. This is the enforceable
health metric, reported **coverage-weighted** (realized × classified coverage) so low coverage cannot
masquerade as high differentiation. Honest repository ceiling ≈ 0.55 (bounded by immovable
age/persona/stage).
