# CAPADEX — Scoring Model Guide

> Consolidation of the existing scoring stack. Formulas/thresholds are recorded from the live
> implementation; nothing was changed.

CAPADEX deliberately keeps **five distinct scores** so routing and distinguishability are never
conflated.

## 1. AQ Scoring (metadata coverage baselines)

AQ-1/AQ-2 established **per-dimension coverage** at tag granularity: age 99.6% · persona 96.9% ·
stage 100% · behaviour 99.9% · capability 100% · signal 55.8% · context 0% · archetype 0% (the last
two were new architecture, since shipped). The key AQ finding: coverage is high but **flat** (one
value per tag).

## 2. AQ-2R Logic (runtime wiring + shared scorer)

AQ-2R proved the assessment ceiling is a **data ceiling, not a wiring ceiling**: within-pool re-rank
moved Signal/Construct ~0 *by construction* because every question in a tag carries identical
metadata. AQ-2R provides the **shared scorer + deterministic harness** that every C-2 wave must use
for honest before/after measurement. Reference: mean QIS across the AQ-2 bank ≈ **51.1**.

## 3. QIS — Question Intelligence Score

- **File:** `services/question-registry-service.ts` › `computeQuality(...)`, range **0.0–1.0**.
- **Dimensions:** Structural Completeness **40%** (text, ≥2 options, scores present, `response_type`)
  + Usage Signal **30%** (log-scaled real usage, saturates ~50 responses; measured `signal_value` can
  substitute for raw volume) + Distinctness **30%** (penalized by Jaccard overlap within the same
  `master_bridge_tag` bucket).
- **Thresholds:** `WEAK_QUALITY_THRESHOLD = 0.45`, `LOW_SIGNAL_THRESHOLD = 0.30`.

## 4. QIS V2 (8-dimensional design — C-1A)

Adds Context + Archetype and reweights toward headroom dimensions:

```
QIS_V2 = 0.40·CoverageConfidence + 0.30·QDS + 0.30·QRS_potential
```
- **CoverageConfidence** = Σ wd · present(d)·confidence(d); weights ∝ (differentiation headroom ×
  routing value): capability .18 · behaviour .16 · signal .16 · context .16 · archetype .12 ·
  stage .10 · persona .07 · age .05.
- **Governance:** adopted **with modifications** — gate on the **coverage-weighted** differentiability
  metric, not raw-where-present.

## 5. Assessment Intelligence Score (AIS) / Trust Score

- **Files:** `services/trust-engine.ts`, `services/omega-report-builder.ts`.
- **Baseline 60** (neutral multiplier 1.0). **Verified lift** = `(trust_weight − 1.0) · confidence ·
  8 pts` (e.g. Credly 1.2, ICAI 1.15). **Penalty:** revoked/expired credentials subtract up to 2 pts.
- **Trust multiplier** maps trust_score → `[0.5, 1.3]`; for scores > 60: `1.0 + (trust_score − 60)/40
  · 0.3`.
- **Selection-AIS** via `buildInsightConfidence` (reliability + consistency + subdomain coverage).

## 6. CSI — Career Stage Index

- **File:** `routes/csi.ts`. **Formula:** `CSI = Σ(stage_score × stage_weight) / Σ(stage_weights)`.
- **Stage weights:** Curiosity `CAP_CUR` 0.5 · Insight `CAP_INS` 0.75 · Growth `CAP_GRW` 1.0 ·
  Mastery `CAP_MAS` 1.25.
- **Tables:** `csi_profiles` (current aggregate), `csi_trajectory` (historical), `csi_domain_weights`
  (per-domain, default 1.0, used to derive positive/negative factors).
- Auto-recalculated in post-completion hooks.

## 7. Differentiability Score

`differentiability = 1 − (tag-size-weighted within-tag HHI)` over enrichable dimensions. Baseline
**0.096** repo-wide. Reported **coverage-weighted** (realized × classified coverage). Honest ceiling
≈ 0.55 (age/persona/stage immovable). Diversity Standards: min **0.30** / target **0.45** /
excellent **0.60**.

## 8. Routing Readiness Score (QRS)

`QRS = 0.30·match(age) + 0.25·match(persona) + 0.25·match(context) + 0.20·match(stage)`, `match()` ∈
[0,1]. Context enters routing as a first-class signal (legacy routing was domain-blind). Pilot
measured **+39 to +87 pp** routing precision across 4 of 5 readiness contexts.

## 9. Report Levels & OMEGA-X gates

- **Canonical level contract (normalized score 0–100):** **Advanced ≥ 80 · Proficient ≥ 65 ·
  Developing ≥ 40 · Emerging/Forming < 40.** This is the single source-of-truth band set for the
  handoff package.
  - *Legacy variance (informational, do not treat as canonical):* a few older modules' helpers use a
    Proficient cutoff of 60, and CSI's stage helper uses a Developing cutoff of 50. New work should
    standardize on the canonical contract above; these are noted only so existing code is not
    mistaken for a contradiction.
- **Quality validator** (`services/quality-validator.ts`): 5 dimensions (Narrative, Scientific,
  Safety, Intervention, Readability); **safety < 60 → automatic FAIL**.
- **Longitudinal memory** (`services/longitudinal-memory.ts`): recurring constructs (≥2 sessions,
  score < 50); drift (CSI slope > 2 improving / < −2 declining); burnout (≥3 consecutive < 35);
  resilience (rebound ≥ 15 after a low < 50).

## Calculation Logic, Dependencies, Assumptions

- **Dependencies:** QIS needs the clarity row + usage + bucket peers; QIS V2 needs all 8 dimensions
  present with confidence; CSI needs session history; differentiability needs per-question metadata;
  QRS needs runtime context.
- **Assumptions:** low-cardinality dims (age/persona/stage) cannot carry differentiation (mathematical
  ceiling); strengths come only from CSI positive factors / positive longitudinal growth — never from
  raw signal magnitude (signals are concern-diagnostic); no gain is asserted without AQ-2R
  measurement.
