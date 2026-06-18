# CAPADEX C-1 — Question Semantic Intelligence Layer (QSIL)
## AUDIT & REPORT ONLY · No questions modified · No C-2 executed

**Scope:** all 30,638 clarity questions × their AQ-2 metadata, measured against the live database.
**Method:** within-tag concentration measured with a **Herfindahl index (HHI)** per dimension — `Σ pᵢ²` over the value shares in a bridge tag. `HHI = 1.0` → every question in the tag carries the *identical* value (zero differentiation); lower HHI → more spread. Uniformity = mean HHI over the 6 populated dimensions; Differentiability = `1 − uniformity`. Coverage = % non-null. All numbers are measured; every projection is explicitly labelled.

> ⚠️ **Two of the ten requested dimensions do not exist at the question level.** `capadex_question_metadata` has age, persona, stage, behavior, capability, signal — but **no Context column and no Archetype column**, and no secondary age/persona/signal fields. Context and Archetype are therefore reported as **0% populated (absent)**, not estimated. This is itself a primary finding.

---

# EXECUTIVE SUMMARY

CAPADEX question intelligence is **structurally concern-level, not question-level — confirmed at repository scale.** Across all 325 bridge tags, **100% exceed 80% metadata uniformity**; the repository-weighted differentiability is **0.096** (i.e. ~90% of question metadata is identical within its pool). Of six populated dimensions, **only `dev_stage` differentiates questions within a tag** (153/325 tags vary by stage). `primary_capability` is single-valued in **all 325 tags**, `age_band` in 324, `primary_behavior` in 324; `signal_family` is **entirely missing in 144 tags (13,538 questions)**.

This is the whole-repository generalization of the **AQ-2R runtime measurement**, which already proved that re-ranking on this metadata moves Signal and Construct deltas by ~0 *by construction* — because the dimensions are uniform within the candidate pool. C-1 explains exactly **why**, and **where** the enrichment in a future C-2 would actually pay off: the high-cardinality dimensions (`primary_behavior` 119, `primary_capability` 286, `signal_family` 87 + its 44% coverage hole). The low-cardinality dimensions (`age_band` 4, `persona_primary` 5, `dev_stage` 5) have little headroom and should not be over-invested in.

**Bottom line:** the metadata layer is *complete* but *flat*. It tells the engine what a *tag* is about, not what a *question* is about. Differentiability is the real bottleneck, and it is fixable — but only on three of the eight requested semantic dimensions, plus standing up the two that don't exist yet (Context, Archetype).

---

# KEY FINDINGS

1. **Total uniformity saturation.** 325/325 tags ≥ 0.80 uniformity; **0 tags below 0.80**. 172 tags are *near-identical* (≥0.95) = 7,264 Qs (23.7%); 153 are *high* (0.80–0.95) = 23,374 Qs (76.3%).
2. **One working differentiator.** `dev_stage` (HHI 0.438) is the only dimension that varies within tags — present in 153 tags / 23,374 questions. Everything else is inherited wholesale.
3. **Capability is the most inherited dimension.** `primary_capability` is single-valued in **every** tag (286 distinct values globally, but one per tag).
4. **Signal dilution is severe.** 144 tags (13,538 Qs / 44.2%) have **no signal at all**; 1,933 of 5,357 clarity concerns are zero-signal, 2,133 are under-half.
5. **Two requested dimensions are absent.** Context (13 allowed values) and Archetype (8 allowed values) have **no column** — 0% populated.
6. **Allowed-value gaps.** Persona `Entrepreneur` = 0 questions (only 5 of 6 personas used); signal_strength `weak` = 0 (only moderate/strong); dev_stage `Curiosity` nearly empty (1.9%).
7. **Question Intelligence Score is mediocre and bottom-heavy.** Mean 51.1 (sd 16.9); **31.6% of questions score < 40** ("low"), only 18.9% ≥ 70.
8. **Data-quality inconsistency.** Behavior/capability values mix `snake_case` and `Title Case With Spaces` (e.g. `placement_anxiety` vs `Emotional Resilience`) — a normalization debt that will distort any future per-question matching.
9. **Scope reality check.** The brief asks for "Top 500 bridge tags" but **only 325 exist**; per-tag is the correct unit for enrichment because metadata is tag-inherited.

---

# METRICS TABLE

| Metric | Value |
|---|---|
| Questions audited | **30,638** (100% metadata join) |
| Bridge tags | **325** · Clarity concerns | **5,357** · Master concerns | **2,489** |
| Repository uniformity (mean HHI) | **0.9039** |
| Repository **differentiability** | **0.0961** |
| Tags ≥ 0.80 uniformity | **325 / 325 (100%)** |
| Near-identical tags (≥0.95) | 172 (7,264 Qs, 23.7%) |
| Fully-generic tags (single-valued on every dim) | 171 (7,204 Qs) |
| Dimension coverage | age 99.6 · persona 96.9 · stage 100 · behavior 99.9 · capability 100 · **signal 55.8** · **context 0** · **archetype 0** (%) |
| Global cardinality | age **4** · persona **5** · stage **5** · behavior **119** · capability **286** · signal **87** |
| QIS | mean **51.1**, sd 16.9, range 21.95–87.27; **31.6% below 40** |

---

# VALIDATION REPORTS (1–16)

## 1. Question Intelligence Report
30,638 questions, 100% carry AQ-2 metadata (provenance `aq2_reconstruction`). QIS mean 51.1 / sd 16.9. Bands: **A (≥70) 18.9%**, B (55–70) 22.0%, C (40–55) 27.6%, **D (<40) 31.6%**. Intelligence is broadly present but shallow and bottom-weighted; nearly a third of the bank is low-intelligence.

## 2. Question Uniformity Report
Mean within-tag HHI **0.9039**. Distribution: 172 tags ≥0.95 (near-identical), 153 tags 0.80–0.95, **0 tags <0.80**. **Every** question lives in a high-uniformity pool. The picker cannot tell two questions in the same tag apart on age, persona, behavior, capability, or signal — only on stage.

## 3. Question Diversity Report
Global value diversity is asymmetric: behavior (119) and capability (286) are rich; age (4), persona (5), stage (5) are intrinsically narrow; signal (87) is rich but only 55.8% populated. Diversity exists in the *vocabulary* but is not *applied per question* — it collapses to one value per tag.

## 4. Question Differentiability Report
Repository differentiability **0.0961**. Per-dimension within-tag uniformity (weighted HHI):

| Dimension | HHI | Single-valued tags | Missing tags | Verdict |
|---|---|---|---|---|
| age_band | **1.000** | 324 | 1 | No differentiation |
| persona_primary | **0.985** | 292 | 20 | Almost none |
| **dev_stage** | **0.438** | 172 | 0 | **Only real differentiator (153 tags vary)** |
| primary_behavior | **1.000** | 324 | 1 | No differentiation |
| primary_capability | **1.000** | 325 | 0 | None — one value per tag, always |
| signal_family | **1.000** (where present) | 181 | **144** | None + 44% missing |

## 5. Age Mapping Report
14–17 **58.7%** · 18–24 23.5% · 25–45 16.9% · 46+ 0.5% · null 0.4%. Only **4 bands**; 324/325 tags single-band. Age is effectively a tag attribute, not a question attribute. Heavy school-age skew.

## 6. Persona Mapping Report
Student **40.8%** · Counselor 23.6% · Professional 22.6% · Teacher 7.8% · Parent 2.1% · null 3.1%. **`Entrepreneur` = 0** (allowed but unused). 292/325 tags single-persona.

## 7. Stage Mapping Report
Clarity **35.2%** · Growth 27.1% · Awareness 20.9% · Mastery 14.9% · **Curiosity 1.9%**. All 5 allowed values present (the healthiest dimension), but `Curiosity` is nearly empty. This is the dimension to lean on and the one most worth deepening.

## 8. Behavior Mapping Report
119 distinct values; top: placement_anxiety (2,046), career_confusion (1,825), execution discipline (1,721), practical_skill_gap (1,690), emotional_overload (1,665). Rich vocabulary, but single-valued in 324/325 tags. **Formatting inconsistency** (snake_case vs spaced Title Case) flagged.

## 9. Capability Mapping Report
286 distinct values; top: Emotional Resilience (1,450), Future-Proof Capability (1,150), Psychological Flexibility (1,100), Applied Competency (1,014). Richest vocabulary of all dimensions yet **single-valued in 100% of tags** — the single largest untapped differentiation opportunity.

## 10. Signal Mapping Report
**44.2% of questions carry no signal_family.** Where present: professional_confidence_signals (1,675), academic_confidence_signals (1,628), industry_alignment_signals (1,150). signal_strength: null 44.2% / moderate 43.3% / strong 12.5% — **`weak` unused**. 144 tags wholly signal-less. This is the largest *coverage* gap.

## 11. Context Mapping Report
**ABSENT.** No `context` column exists in `capadex_question_metadata`. None of the 13 allowed contexts (Academic, Learning, Family, Social, Career, Employment, Financial, Entrepreneurship, Competitive Exams, Personal Development, Skill Development, Leadership, Digital Literacy) are stored. Coverage **0%**.

## 12. Archetype Mapping Report
**ABSENT.** No question-level `archetype` column exists. None of the 8 allowed archetypes (Reflective, Behavioral, Situational, Evidence-Based, Preference-Based, Decision-Based, Future-Oriented, Historical) are stored. (Archetypes exist only at *concern* level via `archetype_concern_map` — 22 archetypes — not per question.) Coverage **0%**.

## 13. Relevance Risk Report (ranked by severity)
| Sev | Risk | Evidence | Affected |
|---|---|---|---|
| **Critical** | Generic assessment (no within-pool differentiation) | uniformity ≥0.80 in 100% of tags | 30,638 Qs |
| **Critical** | Signal-blind routing | 144 tags / 1,933 concerns zero-signal | 13,538 Qs |
| **High** | Capability cannot route | single-valued in all 325 tags | 30,638 Qs |
| **High** | Context mismatch impossible to detect | context dimension absent | all |
| **High** | Archetype balancing impossible | archetype dimension absent | all |
| **Medium** | Age mismatch within tag undetectable | 4 bands, 324 single-band tags | most |
| **Medium** | Persona `Entrepreneur` unserved | 0 questions | segment gap |
| **Low** | Low-intelligence question tail | 31.6% QIS < 40 | 9,673 Qs |
| **Low** | Vocabulary normalization | mixed casing in behavior/capability | 119+286 values |
**Top generic-risk tags** (uniformity × pool size): EMPLOYABILITY (1,150), EMOTIONAL_REGULATION (1,100), CAREER_READINESS (1,000), COMPETENCY_DEVELOPMENT (1,014), DISCIPLINE_HABITS (925), EMOTIONAL_RECOVERY (800), SOCIAL_EMOTIONAL (825), WORKPLACE_ADAPTATION (682), CAREER_GROWTH (675), EXAMINATION_STRESS (650). The largest pools are the most generic.

## 14. Assessment Intelligence Delta *(measured baseline + projection)*
- **Measured baseline (AQ-2R):** within-pool re-rank on this metadata produced Relevance +0.7, **Signal 0, Construct 0**, Selection-AIS +0.2, Trust +3.8 — the 0s are *by construction* because the dimensions are uniform within pools (this audit proves the mechanism).
- **Projection (C-2, NOT executed):** differentiability **0.096 → ~0.35–0.55** is *achievable*, but **capped** by low-cardinality dims; the realisable assessment-intelligence gain comes almost entirely from enriching behavior/capability/signal per question and standing up context/archetype. No post-enrichment number is claimed here.

## 15. Trust Score Projection *(directional, not measured)*
AQ-2R measured selection-trust +3.8 from tag-level metadata. Question-level enrichment is expected to extend trust because routing becomes explainable per question rather than per tag. Magnitude is **unproven until C-2 is measured**; deliberately not quantified.

## 16. Routing Accuracy Projection *(bounded, not measured)*
Upper bound on improvement = the **76.3% of questions** currently in high-uniformity (0.80–0.95) pools that cannot be differentiated today, plus the 23.7% near-identical. Actual gain depends on enrichment quality and is **not quantifiable pre-enrichment**. The honest claim: there is large *room*, concentrated in capability/behavior/signal, but it is not free and not yet realised.

---

# HIGH-RISK AREAS (priority order)

1. **All 325 tags are non-differentiable** (uniformity ≥0.80) — systemic, not localized.
2. **Capability inheritance** — one capability value per tag, 100% of tags; biggest single lever (286-value vocabulary unused per-question).
3. **Signal coverage hole** — 44.2% of questions signal-less; 1,933 zero-signal concerns.
4. **Two missing dimensions** — Context and Archetype cannot be audited because they don't exist.
5. **9,673 low-intelligence questions** (QIS < 40).

# TOP ENRICHMENT OPPORTUNITIES

1. **Per-question capability** (286-value space, currently 1/tag) — highest differentiation ROI.
2. **Per-question behavior** (119-value space, currently 1/tag).
3. **Signal coverage + strength** — fill the 44% gap; introduce the unused `weak` band.
4. **Stand up Context** (13 values) — net-new dimension; high routing value (Academic vs Career vs Family).
5. **Stand up Archetype** (8 values) — enables question-form balancing (Reflective vs Situational vs Evidence-Based).
6. **Normalize vocabulary** (casing/format) before any per-question matching.
7. **Deepen stage on Curiosity** and **add Entrepreneur persona coverage** to close allowed-value gaps.

> Enrichment unit should be **per question within tag**, prioritized by `pool_size × current_uniformity` — i.e. the top generic-risk tags above. "Top 1000 questions" is best operationalized as "all questions in the top ~30 generic-risk tags," since metadata is currently tag-inherited.

---

# EXPECTED CAPADEX INTELLIGENCE GAIN (honest framing)

- **What C-1 proves:** the metadata layer is fully populated but **flat** (differentiability 0.096). The runtime ceiling measured in AQ-2R is a *data* ceiling, not a *wiring* ceiling.
- **What would move the needle (C-2):** per-question enrichment of **capability, behavior, signal** + **new Context/Archetype** dimensions. Age/persona/stage have little headroom (cardinality 4/5/5) — do **not** over-invest there.
- **What stays bounded:** low-cardinality dims mathematically cannot differentiate much; honest target differentiability is moderate (~0.35–0.55), not near-1. Any claim of large signal/construct gains must be *measured* after enrichment, exactly as AQ-2R measured the baseline — never assumed.

---

# RECOMMENDED C-2 SCOPE (for approval — not executed)

1. **Capability + Behavior per-question enrichment** for the top ~30 generic-risk tags (~20k questions), evidence-derived (no blind inheritance), normalized vocabulary.
2. **Signal coverage backfill** for the 144 signal-less tags / 1,933 zero-signal concerns, with `strength` including the unused `weak` band.
3. **Introduce Context dimension** (13 values) + **Archetype dimension** (8 values) as new question-level columns, evidence-derived.
4. **Re-measure** differentiability + AQ-2R-style Selection-AIS / Trust / Routing **before vs after**, using the same shared scorer and deterministic harness — accept honest results, never tune to a target.
5. **Guardrails:** additive, flag-gated, reversible; do not overwrite AQ-2 provenance; keep `pil_kg_*`/`kg_*` namespace discipline; no question text changes.

---

**STOP — WAIT FOR APPROVAL.** Audit and report only. No questions modified, no questions rewritten, C-2 not executed.

*Machine-readable: `backend/audit/c-1/c1_qsil_audit.json`.*
