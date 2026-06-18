# WC-3 · Output 1 — Architecture

> **Design only. No implementation, no schema/runtime changes executed, no enrichment.** This is the
> architecture for *how* the 7 WC-3 layers would be built to raise the five WC-2 tracks toward 90+.
> Current scores are the WC-2 honest baseline. STOP for approval.

## Design principles (inherited, non-negotiable)

Every WC-3 layer obeys the established CAPADEX conventions:

- **Additive · compose-only · never-throws** — layers re-shape already-computed data; flag-off path is
  byte-identical to legacy.
- **Flag-gated** — each layer behind `FF_WC3_<LAYER>` (default OFF); flag-off → protected routes 503 +
  UI hides.
- **Canonical migration + lazy ensure-schema** — every new table has a migration file AND a lazy
  `ensure*Schema()` mirror.
- **Append-only history** — progression/longitudinal/validation history is never mutated in place.
- **Namespace canon** — WC-3 tables are `wc3_*`; reuse existing graphs (`pil_kg_*`, `capadex_behavior_graph`),
  never re-namespace or wipe them.
- **Honesty** — no fabricated gains; UNCLASSIFIED/degraded states are honest; strengths only from CSI
  positive factors; developmental signals only (never hiring/suitability predictions).

## Honest ceiling carry-over (from WC-2, per prior approval)

The WC-3 objective is "raise to 90+". That is **design-reachable for some layers and bounded for
others**:

| Layer / track | 90+ reachable repo-wide? | Binding ceiling |
|---|---|---|
| Stage Intelligence | **Yes (88–92)** | none material — design-heavy |
| Outcome Intelligence | **Yes (85–90)** | composes existing; Exam outcome gated by corpus |
| Journey Intelligence | **Partial (80–88)** | Competitive-Exam pathway corpus = 0 |
| Dynamic Personalization | **Partial (78–85)** | within-tag differentiability ceiling ~0.55 |
| Question Intelligence 2.0 | **Partial (76–82)** | differentiability ceiling; needs C-2 Waves enrichment |
| Longitudinal Intelligence | **Yes (85–92)** | needs longitudinal data accrual over time |
| Outcome Validation | **Yes (85–92)** | needs outcome-observation accrual over time |

> 90+ across **all** layers simultaneously is not honest repo-wide near-term: Question
> Intelligence 2.0 and Dynamic Personalization remain capped by the documented differentiability
> ceiling until the C-2 enrichment waves run, and Journey is capped by the Exam corpus. WC-3's design
> closes the **design-reachable** gap and sets up the enrichment-dependent gains behind their gates.

## System architecture — the 7 layers

```
                    ┌─────────────────────────────────────────────┐
                    │            WC-3 Intelligence Stack            │
                    ├─────────────────────────────────────────────┤
  Q2.0  ─────────►  │ L5 Question Intelligence 2.0  (input quality) │
                    ├─────────────────────────────────────────────┤
  Picker ────────►  │ L4 Dynamic Personalization    (journey shape) │
                    ├─────────────────────────────────────────────┤
  Runtime pipeline► │ L1 Stage  →  L2 Outcome  →  L3 Journey         │  (compose-only over
                    │   (where am I) (where to)  (which pathway)     │   CSI + behavior graph
                    ├─────────────────────────────────────────────┤   + intervention library)
  Over time ──────► │ L6 Longitudinal Intelligence (trajectory)     │
                    ├─────────────────────────────────────────────┤
  Closes loop ────► │ L7 Outcome Validation        (did it work?)   │
                    └─────────────────────────────────────────────┘
```

Data flow: **L5** raises input distinctness → **L4** uses it to differentiate journeys → **L1→L2→L3**
compose stage/outcome/pathway from the runtime pipeline → **L6** accrues trajectory across sessions →
**L7** validates predicted outcomes against observed progression and feeds correction back.

---

## L1 — Stage Intelligence Layer

| Field | Detail |
|---|---|
| **Current Score** | 45 (WC-2 baseline) |
| **Target Score** | 90 (realistic band 88–92 — design-reachable) |
| **Architecture** | Compose-only stage resolver over CSI weights + intervention engagement + longitudinal trend. Adopts the 5-stage MetryxOne framework (Awareness 0.25 / Curiosity 0.5 / Clarity 0.75 / Growth 1.0 / Mastery 1.25), reconciling CSI's 4 stages (alias Insight→Clarity, add Awareness). |
| **Schema Changes** | `wc3_stage_definitions` (taxonomy + weights), `wc3_stage_entity_map` (entity→stage), `wc3_stage_state` (per user/session current stage + confidence), `wc3_stage_progression` (**append-only** transition history). |
| **Runtime Changes** | New `stage-resolver.ts` invoked as a read-only step in the signal-activation runtime; populates `wc3_stage_state` post-completion; never blocks. Flag `FF_WC3_STAGE`. |
| **Reports** | `stage_framework`, `stage_mapping_matrix`, per-user stage timeline. |
| **Validation Framework** | Stage-assignment precision vs CSI ground truth; monotonicity check (regression only on real drift); k-anonymity ≥ 30 for cohort-relative stages. |
| **Success Metrics** | ≥ 95% sessions assigned a stage with confidence ≥ band; transition audit complete; 0 in-place history mutations. |

## L2 — Outcome Intelligence Layer

| Field | Detail |
|---|---|
| **Current Score** | 42 |
| **Target Score** | 90 (realistic 85–90; Exam outcome gated) |
| **Architecture** | Compose-only outcome models (Career Clarity, Learning Effectiveness, Employability Readiness, Exam Readiness, Confidence Stability, Decision Quality), each resolving Current→Desired→Gap→Actions→Expected-Progression from stored intelligence. "Desired" binds to the L1 stage target. |
| **Schema Changes** | `wc3_outcome_models` (model catalog + composition spec), `wc3_outcome_state` (per user: current/desired/gap/confidence), `wc3_outcome_actions` (library-backed only). |
| **Runtime Changes** | `outcome-resolver.ts` reads CSI + behavior graph + intervention library; emits nothing when spine empty (honest UNCLASSIFIED). Flag `FF_WC3_OUTCOME`. |
| **Reports** | `outcome_intelligence_framework`, `outcome_quality_report` (explainability / confidence / actionability). |
| **Validation Framework** | Outcome explainability = % outcomes with full lineage; actionability = % with ≥1 library-backed action; no generic actions permitted. |
| **Success Metrics** | Explainability ≥ 85, actionability ≥ 85, 0 fabricated outcomes, Exam outcome flagged gated (not faked). |

## L3 — Journey Intelligence Layer

| Field | Detail |
|---|---|
| **Current Score** | 50 |
| **Target Score** | 90 (realistic 80–88; Exam pathway gated) |
| **Architecture** | Routing/journey resolver binding stages (L1) and outcomes (L2) to ecosystem pathways (LBI / Career Builder / Employability / Exam Intelligence). Implements `routing_readiness_model`, `routing_confidence_model`, `growth_journey_model`. |
| **Schema Changes** | `wc3_journey_pathways` (pathway catalog + triggers + destination), `wc3_journey_state` (per user: pathway + stage-within-pathway), `wc3_routing_decisions` (**append-only** audit). |
| **Runtime Changes** | `journey-resolver.ts` composes QRS + outcome state; suppresses low-confidence pathways (gate). Hands off at Clarity→Growth boundary. Flag `FF_WC3_JOURNEY`. |
| **Reports** | `routing_readiness_model`, `routing_confidence_model`, `growth_journey_model`, `journey_progression_framework`. |
| **Validation Framework** | Routing precision vs WC-2 pilot baseline (+39–87 pp targets); confidence-gate suppression rate; pathway-coverage honesty (Exam = blocked). |
| **Success Metrics** | ≥ 4 of 5 pathways routing with lift; Exam flagged gated; 0 low-confidence forced routes. |

## L4 — Dynamic Personalization Layer

| Field | Detail |
|---|---|
| **Current Score** | 55 |
| **Target Score** | 90 (realistic 78–85 repo-wide; ceiling-bound) |
| **Architecture** | Runtime picker scoring upgrade: wire shipped **context + archetype** + promote **Concern Severity** to a first-class routing input, producing genuinely divergent journeys. The single highest-ROI **no-enrichment** change (WC-2 pilot: +39–87 pp). |
| **Schema Changes** | `wc3_personalization_profile` (per user: resolved dims + confidences), `wc3_personalization_decisions` (**append-only** audit of journey divergence). No question-metadata rewrite (enrichment is a separate gated dependency). |
| **Runtime Changes** | Extend the 3-tier clarity picker with a weighted score (age/persona/context/archetype/severity); flag `FF_WC3_DYN_PERSONALIZATION`; flag-off = current picker. |
| **Reports** | `personalization_readiness_report` (coverage / precision / confidence), per-user journey-divergence trace. |
| **Validation Framework** | Within-tag journey divergence between distinct users (Diversity-Standards floor 0.30); precision measured pre/post via AQ-2R. |
| **Success Metrics** | Precision 0.10 → ≥ 0.30; coverage ≥ 90%; no regression on flag-off. **Repo-wide 90+ requires C-2 capability Wave 2 (gated dependency).** |

## L5 — Question Intelligence 2.0

| Field | Detail |
|---|---|
| **Current Score** | 51 |
| **Target Score** | 90 (realistic 76–82 repo-wide; enrichment-dependent) |
| **Architecture** | Promote QIS → QIS V2 (8-dimension input) in the registry; materialise the `question_quality_matrix` (relevance/specificity/context-fit/persona-fit/stage-fit) as a read-only monitored view; gate on the **coverage-weighted** differentiability metric. |
| **Schema Changes** | Extend `capadex_question_metadata` with `qis_v2` + `qis_v2_components` jsonb (additive columns); `wc3_question_quality_matrix` (**materialized view**); registry status promotion in `capadex_question_registry`. |
| **Runtime Changes** | QIS V2 scorer (compose-only over existing dims); Diversity-Standards CI gate ≥ 0.30. Flag `FF_WC3_QIS_V2`. |
| **Reports** | `question_quality_matrix`, `question_intelligence_map`, `question_enhancement_backlog` (top ~1,000 Qs / ~500 weak clusters). |
| **Validation Framework** | Coverage-weighted differentiability before/after; QIS V2 mean delta; signal-blind tag count trend. |
| **Success Metrics** | QIS V2 mean 51 → band (76–82 repo-wide; >90 only on enriched high-value tags); differentiability ≥ 0.30 on enriched pools. **Bulk lift requires C-2 Waves 2–4.** |

## L6 — Longitudinal Intelligence Layer

| Field | Detail |
|---|---|
| **Current Score** | ~40 (exists in pieces: longitudinal-memory, `career_memory_snapshots`, `capadex_behavioural_memory`, append-only `p4_competency_history`/`m3_*`) |
| **Target Score** | 90 (realistic 85–92; accrues with data over time) |
| **Architecture** | Unifying read-only trajectory layer over existing longitudinal stores; computes per-user trend, drift, resilience, and stage-velocity across sessions. Feeds L1 (stage regression) and L7 (validation). |
| **Schema Changes** | `wc3_longitudinal_snapshots` (**append-only** per-session vector), `wc3_longitudinal_trends` (derived slope/drift/resilience). Reuses existing snapshots; adds no duplicate source of truth. |
| **Runtime Changes** | `longitudinal-resolver.ts` post-completion; never recomputes prior sessions (append-only). Flag `FF_WC3_LONGITUDINAL`. |
| **Reports** | Per-user trajectory timeline; cohort drift report (k-anonymity ≥ 30). |
| **Validation Framework** | Trend monotonicity vs raw scores; drift detection precision; append-only integrity check. |
| **Success Metrics** | ≥ 2-session users get a trend with confidence band; 0 in-place mutations; drift flags reconcile with CSI trajectory. |

## L7 — Outcome Validation Layer

| Field | Detail |
|---|---|
| **Current Score** | ~30 (simulation harness exists; no outcome-vs-actual validation loop) |
| **Target Score** | 90 (realistic 85–92; accrues with observation data) |
| **Architecture** | Closes the loop: records each predicted outcome (L2), observes actual progression (L6), and validates prediction accuracy — feeding correction back into outcome/journey confidence. Reuses the simulation harness pattern (black-box, allowed to fail, never tuned to pass). |
| **Schema Changes** | `wc3_outcome_predictions` (prediction snapshot at session), `wc3_outcome_observations` (later observed state), `wc3_outcome_validation_runs` (accuracy metrics per cohort). |
| **Runtime Changes** | `outcome-validation-engine.ts` batch job (not request-path); compares prediction vs observation; emits calibration deltas. Flag `FF_WC3_OUTCOME_VALIDATION`. |
| **Reports** | Outcome accuracy / calibration report; per-model reliability. |
| **Validation Framework** | Prediction-vs-observation accuracy; calibration (Brier-style) on real pairs only; harness **allowed to fail** — never tune metrics to force a pass. |
| **Success Metrics** | Calibration computed on real pairs; accuracy reported honestly (low is acceptable early); 0 fabricated observations. |

---

## Composite trajectory (honest)

| State | World-Class Readiness Score | Note |
|---|---|---|
| WC-2 baseline (today) | **51** | Developing (Operational) |
| WC-3 design-reachable layers only (L1/L2/L3-partial/L6/L7, no enrichment) | **~70–76** | Maturing |
| + L4/L5 enrichment dependency (C-2 Waves 2–4) + LBI + credential adoption | **~82–86** | Advanced (repo-wide honest ceiling) |
| Stated "90+ across all layers" | **Not reachable repo-wide** | bounded by differentiability ~0.55, Exam corpus, credential adoption |

WC-3 design **fully closes the design-reachable gap** (Stage/Outcome/Longitudinal/Validation to 85–92)
and **wires the no-enrichment Personalization/Routing lift**; the remaining gap to a repo-wide 90 is
gated behind the C-2 enrichment waves and the Exam corpus, which WC-3 sequences but does not execute.

See: [Data Model](./WC3_DATA_MODEL.md) · [Runtime Design](./WC3_RUNTIME_DESIGN.md) ·
[Migration Plan](./WC3_MIGRATION_PLAN.md) · [Validation Plan](./WC3_VALIDATION_PLAN.md) ·
[Roadmap](./WC3_ROADMAP.md).
