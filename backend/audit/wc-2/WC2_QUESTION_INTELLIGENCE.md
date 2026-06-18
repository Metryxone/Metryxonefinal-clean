# WC-2 · Output 1 — Question Intelligence Report

> **Design + honest measurement. No enrichment, no audits of completed layers, no ontology/signal
> changes.** Numbers are the canonical audit-chain measurements (AQ / C-1 / C-1A / Pilot); this report
> consolidates and scores them against world-class targets, it does not re-audit.

## Scorecard

| Field | Value |
|---|---|
| **Current Score** | **51 / 100** (mean persisted `question_intelligence_score` ≈ 51.1) |
| **Stated WC-2 Target** | > 90 |
| **Realistic Target Band** | **76–82** (repo-wide) — see "Ceiling note" |
| **Gap (to realistic band)** | ~25–31 points |
| **Evidence** | Repository differentiability **0.096**; `dev_stage` carries ~97% of realized within-tag differentiation; capability (286 values) & behaviour (119) fully covered but **uniform per tag** → 0 contribution; **44.2%** of questions signal-blind (144 tags / 13,538 Qs) |
| **Root Cause** | Metadata was derived at **tag** granularity and inherited by every question (flat). The deficit is *architectural distinctness*, not coverage. |
| **Estimated Effort** | Large (C-2 Waves 2–4 — capability gated, signal grounding-conditional, behaviour curated). Smallest high-impact slice: **Capability Wave 2** on ≥60%-coverage tags. |
| **Expected Impact** | Pilot proved coverage-weighted differentiability **0.098 → 0.240 (+145%)** on the 10 worst tags; repo-wide that lifts QIS V2 mean an estimated **+10–18** toward the realistic band. |

### Ceiling note (per approval — flag unreachable targets)
The stated **> 90** is **not reachable repository-wide** in the near term. QIS V2's distinctness
component is bounded by the differentiability ceiling (~0.55, because age/persona/stage are
low-cardinality and immovable). A realistic, honest repo-wide band is **76–82**; individual enriched
high-value tags can exceed 90, but the *mean* cannot without fabricating metadata.

## Phase 1 — `question_quality_matrix` (design)

Per-question quality measured on five WC-2 axes (0–100), composed from **existing** signals:

| Axis | Source signal (existing) | Current repo state |
|---|---|---|
| Relevance | bridge-tag join validity + concern-token overlap | High where `master_curated`; degrades on `static_fallback` |
| Specificity | within-tag distinctness (1 − Jaccard vs bucket peers) | **Low** (flat metadata; 0.096 differentiability) |
| Context fit | context dimension (shipped prior C-2) | Present; routing value high, within-tag 0 |
| Persona fit | `persona_primary` + `persona_confidence` | Coverage 96.9%, low ceiling |
| Stage fit | `dev_stage` + `dev_stage_confidence` | Coverage 100% but taxonomy collapsed to "Clarity" |

Matrix shape (design): `question_id · bridge_tag · relevance · specificity · context_fit ·
persona_fit · stage_fit · composite_quality`. **No values are written in this phase** — this defines
the measurement contract.

## Phase 2 — `question_intelligence_map` (design)

For every question, derive (composition contract; not executed here):

- **Primary Context** ∈ {School, College, Job Seeking, Professional Growth, Competitive Exams,
  Parenting} — from the shipped context dimension. ⚠️ **Competitive Exams / Academic context routes 0
  in the generic pools** (corpus gap) — honest gap, not a defect.
- **Primary Audience** ∈ {Student, Parent, Graduate, Job Seeker, Professional} — from
  `persona_primary`.
- **Question Intelligence Score (0–100)** — the persisted `question_intelligence_score` (QIS), to be
  upgraded to QIS V2 once Waves 2–4 supply the 8-dimension inputs (gate on the **coverage-weighted**
  metric).

## Phase 3 — `question_enhancement_backlog` (design priorities, evidence-derived)

> Identifies the work; does **not** perform it (enrichment forbidden this phase).

- **Top ~1,000 questions requiring enhancement** = questions in the 10 largest signal-blind /
  capability-uniform pools (EMOTIONAL_REGULATION, CAREER_READINESS, DISCIPLINE_HABITS,
  SOCIAL_EMOTIONAL, CONFIDENCE_SELF, MOTIVATION_VALUES, ADJUSTMENT_COPING, THINKING_QUALITY,
  LIFESTYLE_PRESSURE, LEARNING_ADAPTABILITY) — the C-1A Pilot set (~7,060 Qs), prioritised by
  (volume × uniformity × routing value).
- **Top ~500 weak question clusters** = bridge-tag buckets with within-tag Jaccard distinctness below
  the Diversity-Standards floor (differentiability < 0.30), led by the 144 signal-blind tags.
- **Sequencing (from C-1AR, unchanged):** Capability (gated) → Signal (grounding-conditional) →
  Behaviour (curated). **Not** signal-first (overturned by the pilot).

## Smallest set of changes toward world-class

1. **Promote QIS → QIS V2** in the registry (compose-only; gate on coverage-weighted differentiability).
2. **Capability Wave 2** on ≥60%-coverage tags (highest realized yield after the already-shipped
   archetype).
3. **Wire the `question_quality_matrix` as a read-only registry view** so distinctness is monitored
   continuously (Diversity-Standards CI gate ≥ 0.30).

These three move Question Intelligence from **51 → ~68–74** without enrichment beyond Wave 2; the
full realistic band (76–82) needs Waves 3–4.
