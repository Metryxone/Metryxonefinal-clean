# CAPADEX C-1A — Question Differentiation Architecture (QDA)
## DESIGN PHASE ONLY · No question changes · No metadata writes · No DB writes · No C-2

**Inputs:** AQ-1, AQ-2, AQ-2R, C-1 QSIL audit (`backend/audit/c-1/`).
**Mandate:** analyze, design, report. Nothing in production is touched.

> **Core thesis (the architectural finding C-1 surfaced):**
> **Question Intelligence Problem ≠ Missing Metadata.**
> **Question Intelligence Problem = Missing Differentiation *Architecture*.**
>
> The metadata is *present* (coverage ≥99% on five of six dims) but *flat* — derived at **tag granularity** (one value per tag) and inherited by every question. C-1A designs the architecture that makes per-question differentiation possible, measurable, and enforceable — so that C-2 enrichment has a target to hit, not just "add more metadata."

---

# EXECUTIVE SUMMARY

Repository differentiability is **0.096**. Phase-1 contribution analysis shows **why**: of six dimensions, **`dev_stage` carries 97.4% of all realized differentiation, persona 2.6%, and the other four contribute 0%.** The dimensions that *could* differentiate — capability (286 possible values), behavior (119), signal (87) — contribute **nothing**, because each is applied as a single value per tag. The dimension that *does* differentiate (stage) is mathematically capped at **5 values**.

So there are **three distinct failure modes**, and they need **three different fixes** — which is exactly why "just run C-2 and enrich" is the wrong next move:
1. **Uniformity failure** (capability, behavior — high headroom, 0 used) → per-question enrichment pays off massively.
2. **Coverage failure** (signal — 44% absent) → backfill before anything else; you can't rank on a column that's null.
3. **Ceiling failure** (age=4, persona=5, stage=5) → little headroom; do **not** over-invest here.

C-1A delivers: a **Context** framework (13→recommended taxonomy), an **Archetype** framework (8 question forms), enforceable **Diversity Standards** scaled to the real pool sizes (median 40 Qs/tag), a **QIS V2** scoring model that adds Context + Archetype and reweights toward headroom dimensions, and a **sequenced C-2 blueprint** (coverage → new dimensions → uniformity → measure).

**Go/No-Go: GO to build C-2 on this architecture** — conditional on approving the taxonomies and standards below, phased and measured. Do not enrich blindly.

---

# KEY FINDINGS

1. **Differentiation is single-dimensional.** Stage = 97.4% of all realized differentiation. Remove stage and the repository is essentially undifferentiated.
2. **The high-value dimensions are dormant, not missing.** Capability (286 values) and behavior (119) have full coverage but **one value per tag** → 0 contribution. This is the single biggest opportunity.
3. **Signal is a coverage problem first.** 44.2% of questions have no signal; 144 tags and 326 large concerns are signal-blind. Enrichment can't rank on it until it exists.
4. **Two dimensions don't exist at all.** Context and Archetype have no columns — they are *new architecture*, not enrichment of existing fields.
5. **Low-cardinality dims are a trap.** Age/persona/stage are intrinsically tag-level; investing enrichment effort there yields almost nothing (ceilings 0.75/0.80/0.80).
6. **Pools are small.** Median 40 Qs/tag (max 1,150) — so standards must be realistic: a 40-Q pool can hold 5–8 coherent capabilities, not 286.

---

# ARCHITECTURE RECOMMENDATIONS (summary)

| # | Recommendation | Why |
|---|---|---|
| R1 | Treat metadata as **per-question**, derived from question evidence — never inherited from the tag | Root cause of 0.096 differentiability |
| R2 | **Sequence C-2 as coverage → new dims → uniformity → measure** | Each failure mode needs a different fix; order minimizes wasted effort |
| R3 | Stand up **Context** + **Archetype** as first-class question dimensions | They don't exist; they carry routing + assessment-form value with real cardinality |
| R4 | Prioritize **capability/behavior/signal/context** enrichment; **freeze** age/persona/stage effort | Headroom analysis — invest where the ceiling is high |
| R5 | Enforce **Diversity Standards** per tag with a CI-style gate | Without an enforceable floor, enrichment regresses to the mean |
| R6 | Adopt **QIS V2** (8 dims) + separate **Relevance** and **Differentiability** scores | One scalar can't serve both routing and distinguishability |
| R7 | Gate every C-2 phase on **before/after measurement** with the AQ-2R shared scorer; accept honest results | No fabricated gains; reversible |

---

# VALIDATION REPORTS (1–11)

## 1. Differentiation Failure Report  *(Phase 1 — measured)*
**Differentiation Contribution Score** (realized = 1 − within-tag weighted HHI; share of total realized differentiation):

| Dimension | wHHI | Realized | **Contribution** | Coverage | Cardinality | Ceiling | Failure mode |
|---|---|---|---|---|---|---|---|
| **dev_stage** | 0.438 | 0.562 | **97.4%** | 100% | 5 | 0.80 | Ceiling (only differentiator, capped at 5) |
| persona_primary | 0.985 | 0.015 | 2.6% | 96.9% | 5 | 0.80 | Uniformity + ceiling |
| age_band | 1.000 | 0 | 0.0% | 99.6% | 4 | 0.75 | Uniformity + ceiling (intrinsically tag-level) |
| primary_behavior | 1.000 | 0 | 0.0% | 99.9% | 119 | 0.99 | **Uniformity only — huge unused headroom** |
| primary_capability | 1.000 | 0 | 0.0% | 100% | 286 | 1.00 | **Uniformity only — largest unused headroom** |
| signal_family | 1.000 | 0 | 0.0% | 55.8% | 87 | 0.99 | **Coverage (44% null) + uniformity** |

**Root cause:** AQ-2 reconstruction derived metadata at **tag** granularity. Coverage is high but every question in a tag inherits the same capability/behavior/signal/age. Differentiation therefore survives only where the source data happened to vary — `dev_stage`. **Conclusion: the defect is architectural (granularity), not a data-volume gap.**

## 2. Context Architecture Report  *(Phase 2 — design)*
A question's **Context** is the life-domain the question interrogates — orthogonal to *what* it measures (capability) and *how* it asks (archetype). Recommended taxonomy: **keep all 13 candidates but tier them** (8 Primary, 5 Situational) and allow Primary + Secondary per question. Overlaps flagged: *Academic↔Learning*, *Career↔Employment*, *Competitive Exams ⊂ Academic* → keep distinct but document disambiguation rules (Academic = institutional performance; Learning = the act of acquiring; Career = direction/identity; Employment = job/workplace mechanics).

| Context | Tier | Definition | Routing value | Example question type | Est. distribution* |
|---|---|---|---|---|---|
| Academic | Primary | Institutional study performance & pressure | High (age 14–17 core) | "When exams approach, I…" | ~22% |
| Learning | Primary | Acquiring/retaining new knowledge or skill | High | "When I hit something I don't understand…" | ~12% |
| Career | Primary | Direction, identity, long-term path | High | "When I think about my future path…" | ~14% |
| Employment | Primary | Job search, workplace, performance | High (Professional persona) | "At work, when given an unclear task…" | ~12% |
| Competitive Exams | Primary | High-stakes ranked examinations | High (India context) | "During exam prep, I…" | ~7% |
| Skill Development | Primary | Deliberate capability building | Medium | "When learning a new skill I…" | ~8% |
| Personal Development | Primary | Self-growth, habits, mindset | Medium | "When I set a personal goal…" | ~9% |
| Social | Primary | Peer/relationship dynamics | Medium | "In group settings I…" | ~6% |
| Family | Situational | Family expectations & support | Medium | "When family expectations conflict…" | ~4% |
| Financial | Situational | Money pressure & decisions | Medium | "When money is tight, I…" | ~2% |
| Entrepreneurship | Situational | Venture creation & risk | Low (segment) | "When starting something of my own…" | ~1.5% |
| Leadership | Situational | Influence & ownership | Medium | "When I'm responsible for others…" | ~1.5% |
| Digital Literacy | Situational | Tech fluency & online conduct | Low | "When using new digital tools…" | ~1% |

*\*Expected distributions are **design estimates** anchored on the measured persona/age skew (58.7% age 14–17, 40.8% Student), not measured values.*

## 3. Archetype Architecture Report  *(Phase 3 — design)*
**Archetype** = the *cognitive form* of the question (how it elicits), independent of context/capability. It governs assessment validity (mix of forms reduces response bias) and routing (match form to journey stage). Recommend **all 8**, with a target form-mix per tag (Phase 4).

| Archetype | Definition | Assessment value | Routing value | Example | Est. dist.* |
|---|---|---|---|---|---|
| Reflective | Introspective self-appraisal | Self-awareness depth | Clarity/Growth stages | "How do you usually feel when…" | ~22% |
| Behavioral | Reports actual past/typical action | Reduces aspiration bias | All stages | "What do you usually do when…" | ~20% |
| Situational | Hypothetical scenario response | Reveals reasoning under context | Awareness/Curiosity | "If you were faced with X, you would…" | ~16% |
| Decision-Based | Choice between trade-offs | Values & prioritization | Clarity | "Which matters more to you: A or B?" | ~10% |
| Evidence-Based | Anchored to concrete proof/example | Highest reliability | Growth/Mastery | "Describe a time you actually…" | ~10% |
| Preference-Based | Stated like/dislike/inclination | Fit & motivation | Curiosity | "How much do you enjoy…" | ~9% |
| Future-Oriented | Intention/aspiration | Goal orientation | Awareness/Curiosity | "Where do you see yourself…" | ~8% |
| Historical | Retrospective pattern over time | Trajectory/consistency | Mastery | "Over the past year, how often…" | ~5% |

*\*Design estimates (target mix), not measured.*

## 4. Question Diversity Standards  *(Phase 4 — design)*
Scaled to the real pool distribution (min 25, median 40, p75 50, max 1,150). Absolute floors, relaxed for the smallest pools so spread stays semantically coherent.

| Per bridge tag | Minimum | Target | Excellent |
|---|---|---|---|
| Distinct capabilities | 3 | 5 | 8 |
| Distinct behaviors | 3 | 5 | 8 |
| Signal coverage | 80% | 90% | 100% |
| Distinct signal families | 2 | 3 | 4 |
| Distinct contexts | 2 | 3 | 4 |
| Distinct archetypes | 3 | 4 | 5 |
| Distinct stages | 2 | 3 | 4 |
| **Differentiability index (1−HHI mean)** | **≥0.30** | **≥0.45** | **≥0.60** |

**Today every tag fails Minimum** (repo differentiability 0.096). The realistic repository-wide *Excellent* ceiling is ~0.55 because age/persona/stage cannot move — so the index targets weight the enrichable dims.

## 5. Question Intelligence Score V2 Design  *(Phase 5)*
8-dimensional (adds Context + Archetype). Composed of three parts so routing and distinguishability aren't conflated:

```
QIS_V2 = 0.40·CoverageConfidence + 0.30·QDS + 0.30·QRS_potential
```
- **CoverageConfidence** = Σ wd · present(d)·confidence(d), with weights reflecting headroom × routing value:
  capability .18 · behavior .16 · signal .16 · context .16 · archetype .12 · stage .10 · persona .07 · age .05.
- **Weighting rationale:** weight ∝ (differentiation headroom × routing value). High-cardinality enrichable dims weighted up; low-cardinality inherited dims (age/persona/stage) weighted down — directly mirroring the Phase-1 contribution finding that low-cardinality dims cannot carry differentiation.

## 6. Question Relevance Model  *(Phase 5)*
Match of a question's metadata to the **runtime context**, over **routing** dimensions only:
```
QRS = 0.30·match(age) + 0.25·match(persona) + 0.25·match(context) + 0.20·match(stage)
```
Context enters here as a new first-class routing signal (today routing has no domain awareness). `match()` ∈ [0,1].

## 7. Question Differentiability Model  *(Phase 5)*
How distinguishable a question is from its **tag-pool siblings**, over **enrichable** dimensions:
```
QDS = mean over {capability, behavior, signal, context, archetype} of (1 − pool_share(value))
pool_share(value) = fraction of the tag's questions carrying that same value
```
QDS=0 → identical to siblings (today's state); QDS→1 → unique. This is the metric the Diversity Standards (Report 4) enforce.

## 8. C-2 Enrichment Blueprint  *(Phase 6 — design + ranked from data)*
**Scope reality:** only **325** bridge tags exist (brief said 500); **758** concerns have ≥10 Qs (**326 signal-blind**); "Top 1000 questions" = all questions inside the top signal-zero large-pool tags (EMOTIONAL_REGULATION alone is 1,100).

**Top priority tags** (largest pools × signal gap; all have capability=1/tag today):
EMOTIONAL_REGULATION (1,100, 0% signal) · CAREER_READINESS (1,000, 0%) · DISCIPLINE_HABITS (925, 0%) · SOCIAL_EMOTIONAL (825, 0%) · CONFIDENCE_SELF (650, 0%) · MOTIVATION_VALUES (620, 0%) · ADJUSTMENT_COPING (565, 0%) · THINKING_QUALITY (525, 0%) · LIFESTYLE_PRESSURE (450, 0%) · LEARNING_ADAPTABILITY (400, 0%).

**Recommended C-2 sequence:**
1. **C-2.1 Signal backfill** — 144 signal-blind tags / 326 zero-signal concerns. *Cheapest, highest deficit; ranking can't use a null column.*
2. **C-2.2 Stand up Context** — new column + evidence-derived per-question values.
3. **C-2.3 Stand up Archetype** — question-form classifier, evidence-derived.
4. **C-2.4 Per-question Capability + Behavior** enrichment on the top-priority tags (uniformity failure on high-headroom dims).
5. **C-2.5 Re-measure** differentiability + Selection-AIS/Trust/Routing before vs after (AQ-2R shared scorer). Accept honest results.

## 9. Expected Assessment Intelligence Gain  *(projection — NOT measured)*
- Baseline (AQ-2R, measured): within-pool re-rank moved Signal/Construct ~0 *by construction*.
- Projection: enriching capability/behavior/signal + standing up context/archetype could lift repository differentiability **0.096 → ~0.40–0.55** (bounded by immovable age/persona/stage). Selection-AIS/Trust expected to rise; **magnitude unproven until C-2 measured.** No number is claimed as fact.

## 10. Expected Routing Accuracy Gain  *(bounded projection)*
Upper bound = the **76.3%** of questions in high-uniformity pools that cannot be differentiated today, plus 23.7% near-identical. Adding **Context** to routing (today domain-blind) is the highest-leverage single change. Actual gain depends on enrichment quality; **not quantifiable pre-enrichment.**

## 11. CAPADEX Readiness Assessment
| Layer | State |
|---|---|
| Ontology / Bridge-tag / Signal-family / Metadata coverage | **Operational** |
| Question-level differentiation | **Not ready** (0.096) |
| Context intelligence | **Absent** (architecture defined here) |
| Archetype intelligence | **Absent** (architecture defined here) |
| Routing readiness | **Partial** — domain-blind; needs Context |
| **Verdict** | Architecture-ready for C-2; **not** data-ready. C-1A removes the architecture blocker. |

---

# FRAMEWORK DEFINITIONS
- **Context** = life-domain a question interrogates (Report 2; 8 Primary + 5 Situational; Primary+Secondary per question).
- **Archetype** = cognitive form of elicitation (Report 3; 8 forms; target mix per tag).
- **Differentiability index** = mean(1 − within-pool HHI) over enrichable dims; the enforceable health metric.

# STANDARDS TABLE
See Report 4 (Minimum / Target / Excellent per dimension + differentiability index ≥0.30/0.45/0.60).

# SCORING MODELS
See Reports 5–7 (QIS V2 = 0.40 CoverageConfidence + 0.30 QDS + 0.30 QRS; with full weights + rationale).

# C-2 BLUEPRINT
See Report 8 (ranked tags + 5-phase sequence: coverage → context → archetype → capability/behavior → measure).

# RISK ASSESSMENT
| Risk | Severity | Mitigation |
|---|---|---|
| Mechanical enrichment → semantically incoherent metadata | **High** | Evidence-derive from question text; quality gate REJECTS generic fallbacks (PIL precedent) |
| Over-investing in low-ceiling dims (age/persona/stage) | Medium | Freeze those; weight them low in QIS V2 |
| Ranking on still-null signal | Medium | Sequence signal backfill first (C-2.1) |
| Context/Archetype taxonomy churn after data exists | Medium | Approve taxonomies **now** (this doc) before C-2 writes |
| Unverifiable "gains" | Medium | Mandatory before/after measurement gate; honest results only |
| Pool too small to meet standards | Low | Pool-scaled floors (Report 4) |

# GO / NO-GO RECOMMENDATION
**GO — build C-2 on this architecture**, conditional on:
1. Approval of the **Context** and **Archetype** taxonomies (Reports 2–3).
2. Approval of the **Diversity Standards** + **QIS V2** model (Reports 4–7).
3. C-2 executed **phased, flag-gated, reversible**, with the **measurement gate** (C-2.5) non-negotiable.
**NO-GO** on: blind tag-inheritance enrichment, age/persona/stage investment, or any unmeasured gain claim.

---

**STOP — WAIT FOR APPROVAL.** Design phase only. No questions modified, no metadata updated, no DB writes, no C-2 executed.

*Machine-readable: `backend/audit/c-1a/c1a_qda.json`.*
