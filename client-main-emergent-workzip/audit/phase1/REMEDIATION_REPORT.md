# CAPADEX Question Intelligence Layer — Phase 1 Audit & Remediation Report

> **Auto-generated** by `backend/scripts/audit/question-intelligence-audit.mjs` on 2026-05-31T16:08:10.996Z.
> Every number below is interpolated from the live audit run — edit the script, not this file.

**Phase:** 1 — Discovery & Diagnostics **only**. No production behaviour was changed.
**Method:** A single read-only script loaded the live tables, scored every question/option
set, detected 12 issue classes, and emitted the CSV reports in this directory. The script
makes **zero writes** to the database.

> **Reproduce:** `cd backend && node scripts/audit/question-intelligence-audit.mjs`

---

## 1. Scope of what was audited

| Table | Rows | Role |
|---|---|---|
| `capadex_clarity_questions` | 14,294 | Curated question bank (the asset under audit) |
| `capadex_concerns_master` | 2,489 | Concern taxonomy (328 distinct bridge tags) |
| `capadex_signals` | 20 | Tier-3 signal ontology |
| `capadex_atomic_signals` | 15,972 | Tier-4 atomic signals |
| `adaptive_question_bank` | 24 | Dynamic fallback pool |

**Structural facts discovered (these shape every finding below):**

1. Questions carry **no persona / age / industry columns**. Those attributes are inherited
   from the concern the question bridges to (via `master_bridge_tag` → the bridge bucket's
   modal `primary_persona`, `age_min/max`). `clarity.concern_id` is a **question-set id**
   (e.g. `RECALL_001`), NOT a join key into `concerns_master` — so persona/age/concept are
   derived from the **bridge bucket profile** (modal values across the bucket), never from an
   arbitrary single concern row. `industry` is **empty for every row** — industry is not
   modelled anywhere in the schema.
2. `response_type` is a **scale-label** (`frequency`, `confidence`, `intensity`,
   `agreement`…), **not a structural input type**. Every curated question is effectively a
   5-point graded scale.
3. Curated questions reach concerns through **56 distinct bridge tags**, but the concern
   taxonomy defines **328**. The 272 uncovered tags are the single largest finding.

---

## 2. Headline findings

> **The bank's *craft* is high; its *coverage* is the crisis.** Individual questions and their
> option sets are, on average, well written. The problem is that only **56 of 328**
> concern bridge tags (~17%) carry their OWN curated questions. The other
> 272 tags do **not** hit hardcoded static fallback at runtime — production's
> `resolveCoveredBridgeTag` **remaps** them to a covered bucket (a specific sibling bucket, or
> `GENERAL_CONCERN` as the catch-all). So the real defect is **loss of concern-specific
> curation** (524 concerns inherit *another* bucket's questions), not
> literal static fallback (only **0** concerns truly fall through).

| Metric | Value | Read |
|---|---|---|
| Mean question composite (0–100) | **83** | Craft is strong |
| Mean option-set composite (0–100) | **98** | Option design is strong |
| Concern bridge tags **with** curated questions | **56 / 328 (17%)** | — |
| Concern bridge tags **uncovered** | **272 / 328** | ⚠ coverage crisis |
| Concerns lacking own curated questions (remapped at runtime) | **524** | ⚠ coverage gap |
| ↳ remapped to a specific sibling bucket | **488** | inherit related questions |
| ↳ remapped to `GENERAL_CONCERN` catch-all | **36** | ⚠ generic questions |
| ↳ true static fallback (no covered target) | **0** | — |
| Concerns with **no signal-ontology mapping** | **2270** | ⚠ signal gaps |
| Adaptive bank rows (the buffer before remap) | **24** | ⚠ effectively empty |

### Issue tally (all 12 requested classes)

| # | Issue class | Count | Report file |
|---|---|---|---|
| 1 | Irrelevant questions (relevance < 40) | 72 | `top_1000_weak_questions.csv` |
| 2 | Weak option sets (composite < 50) | 2 | `top_500_weak_option_sets.csv` |
| 3 | Exact duplicate question pairs | 234 | `top_500_duplicate_questions.csv` |
| 4 | Semantic duplicate pairs (Jaccard ≥ 0.82) | 30 | `top_500_duplicate_questions.csv` |
| 5 | Proxy-language issues | 793 | `top_100_proxy_language_issues.csv` |
| 6 | Persona mismatches (cross-context) | 10 | `top_100_persona_mismatches.csv` |
| 7 | Industry mismatches (+ unmodelled dimension) | 102 | `top_100_industry_mismatches.csv` |
| 8 | Root-cause coverage gaps | 524 | `root_cause_coverage_gaps.csv` |
| 9 | Signal-mapping gaps | 2270 | `signal_coverage_gaps.csv` |
| 10 | Bridge-tag issues (leakage/ambiguity) | 529 | `top_100_bridge_tag_issues.csv` |
| 11 | Coverage-gap concerns (remapped at runtime; 0 true static) | 524 | `fallback_overuse.csv` |
| 12 | Response-type mismatches | 30 | `response_type_mismatches.csv` |

---

## 3. Audit dataset

`audit_dataset.csv` — one row per question with the requested fields:
`concern_id, concern_name, concern_family, bridge_tag, question_id, question_text,
response_type, options, persona, age_group, industry, weight`.

- `persona` / `age_group` / `concern_family` are **derived from the bridge bucket profile**
  (modal values across the bucket the question bridges to), because questions have no such columns
  and `concern_id` is a question-set id, not a taxonomy join key.
- `industry` is **always empty** — the dimension does not exist in the schema (finding #7).
- `options` joins the non-empty `option_a..e` with ` | `.

---

## 4. Scoring methodology (deterministic heuristics)

Scoring is **automated heuristic**, not human/LLM judgement, so the full 14,294-row
bank can be scored reproducibly and at no cost. **These are proxies** — see the roadmap (§6,
Phase R4) for the recommended LLM-assisted re-scoring pass.

### Question quality (0–100 each, composite = mean of the six)

| Dimension | Heuristic |
|---|---|
| **Relevance** | Token overlap between the question and its **bridge bucket** concept vocabulary (modal labels/cluster/domain across the bucket) + the question's own authored concern label. 0→35, 1→60, 2→78, 3+→92; +6 if 2nd-person. <40 ⇒ flagged irrelevant. |
| **Grammar** | Start 100; penalise no terminal `?`, double spaces, stray whitespace, repeated words, broken 3rd-person conjugation, un-capitalised start, >45 words. |
| **Sophistication** | Word-count in 8–28 band + unique-word ratio + context clause + content-token richness; penalise vague words. |
| **Personalization** | +2nd-person, +context framing, +situational nouns; penalise reused stems (templating) and impersonal phrasing. |
| **Information Gain** | Distinct option-score levels + score range + option count. |
| **Root-Cause Utility** | Bridge bucket has `root_cause_group` (+30) / `intervention_lens` (+18) / resolvable signal mapping (+22); question_type probes mechanism; diagnostic stems. |

### Option-set quality (0–100 each, composite = mean of the five)

| Dimension | Heuristic |
|---|---|
| **Distinctiveness** | Distinct normalised option texts / option count. |
| **Diagnostic Power** | Distinct score levels / (option count − 1). |
| **Signal Value** | Both low/high anchors present + full score range + monotonic ordering. |
| **Human Readability** | ≥2 options, average 1–6 words, none over-long. |
| **Behavioral Realism** | Graded behavioural/frequency vocabulary, ≥3 options, monotonic; penalise bare Yes/No. |

> Why option scores are near-ceiling (98): the curated bank is overwhelmingly
> well-formed 5-point scales with clean anchors. The 2 flagged weak sets and
> the 30 response-type mismatches are the real option-layer defects.

---

## 5. Findings by issue class

### 5.1 Coverage is the dominant problem (issues #8, #9, #10, #11)
- **272 / 328 concern bridge tags have zero curated questions.** At runtime
  `pickQuestionsFromMaster` does NOT drop these to static — it calls `resolveCoveredBridgeTag`,
  which **remaps** the orphan tag to a covered bucket (override → keyword → `GENERAL_CONCERN`).
  `fallback_overuse.csv` lists the **524 concerns** lacking their own
  curated questions, with a `route`/`resolves_to` per concern: **488** remap to
  a specific sibling bucket (inherit related but not concern-specific questions), **36**
  fall to the `GENERAL_CONCERN` generic catch-all, and only **0**
  have no covered target at all. The defect is *loss of concern-specificity*, not literal static fallback.
- **2270 concerns have no signal-ontology mapping** (`signal_coverage_gaps.csv`) —
  their `relational_bridge_tag` is absent from the signal ontology, so the spine cannot light up.
- **524 concerns are missing curated questions and/or a `root_cause_group`**
  (`root_cause_coverage_gaps.csv`).

### 5.2 Duplication (issues #3, #4)
- **234 exact-duplicate pairs** — frequently the *same* question registered
  under two bridge tags, or `_v2` clones. **30 semantic near-duplicates**
  (Jaccard ≥ 0.82) within a bridge bucket. Duplicates waste assessment length and bias aggregation.

### 5.3 Proxy-language (issue #5) — **793 questions**
- Two dominant defects: **first-person fragments** embedded in the stem which the reframer cannot
  rewrite cleanly, and **stems with no 2nd-person anchor** for the proxy regex to convert. Also
  dangling reflexives (`yourself`) after 3rd-person rewrite.

### 5.4 Persona & industry (issues #6, #7)
- **10 cross-context persona mismatches**: a question's edu-vs-work macro
  context is absent from the bridge bucket's persona macro set (buckets spanning both are never
  flagged, to avoid false positives).
- **Industry is structurally unmodelled.** 102 questions hard-code
  industry/context jargon but there is no industry dimension to validate against — a *schema gap*,
  reported honestly rather than fabricated.

### 5.5 Quality outliers (issues #1, #2, #12)
- Only **72 irrelevant** and **2 weak option sets** —
  the long tail is healthy. But there are **1 genuinely malformed rows**, e.g. `Q_RECALL_001_020` (degenerate <2-word text).
- **30 response-type mismatches**: most are `frequency`-typed questions
  that actually ask about *duration* or *speed* — the scale label contradicts the stem.

---

## 6. Remediation roadmap (proposed — Phase 2+)

Ordered by impact-to-effort. **All of this is future work; nothing here was executed in Phase 1.**

### Phase R1 — Coverage (highest impact)
- Generate/curate questions for the **272 uncovered bridge tags**, prioritising the
  **36 concerns that remap to the `GENERAL_CONCERN` catch-all** (the
  most generic, least concern-specific runtime path) and then the **488** that
  inherit a sibling bucket's questions — both ranked by `capadex_priority` / `severity` in
  `fallback_overuse.csv`. Target: every concern reaches its OWN curated questions (no remap).
- Map the **2270 signal-gap concerns** to the existing signal ontology (or extend it).

### Phase R2 — De-duplication & integrity
- Resolve the **234 exact + 30 semantic** duplicate
  pairs: keep one canonical question per intent, re-point bridge tags rather than cloning. Fix
  malformed rows.
- Add a **DB/CI integrity check** (min length, terminal `?`, ≥2 distinct option scores, bridge tag
  resolves) to prevent regressions — runnable via the validation skill.

### Phase R3 — Linguistic correctness
- Rewrite the **793 proxy-language** questions to remove embedded first-person
  fragments and guarantee a 2nd-person anchor; add proxy-reframe unit fixtures.
- Reconcile the **30 response-type mismatches**.

### Phase R4 — Semantic re-scoring (raise confidence in §4)
- Re-score the bank (or just the flagged tails) with an **LLM rubric** for Relevance / Sophistication
  / Behavioural Realism. Use this audit's rankings as the candidate set so the pass is cheap and targeted.

### Phase R5 — Schema evolution
- Decide whether **industry** becomes a first-class dimension or is explicitly declared out-of-scope.
- Consider promoting persona/age onto questions (vs inheriting via bridge) to make per-question
  persona validation authoritative rather than inferred.

---

## 7. File index

| File | Contents |
|---|---|
| `audit_dataset.csv` | Full per-question export (12 requested fields), 14,294 rows |
| `question_quality_scores.csv` | 6-dimension + composite scores, every question |
| `option_quality_scores.csv` | 5-dimension + composite scores, every option set |
| `top_1000_weak_questions.csv` | Lowest composite questions |
| `top_500_weak_option_sets.csv` | Lowest composite option sets |
| `top_500_duplicate_questions.csv` | Exact + semantic duplicate pairs |
| `top_100_bridge_tag_issues.csv` | Uncovered / ambiguous / empty bridge tags |
| `top_100_proxy_language_issues.csv` | First-person / un-reframable / reflexive stems |
| `top_100_persona_mismatches.csv` | Cross-context persona conflicts |
| `top_100_industry_mismatches.csv` | Industry-jargon questions (dimension unmodelled) |
| `signal_coverage_gaps.csv` | Concerns absent from the signal ontology |
| `fallback_overuse.csv` | Concerns lacking own curated questions (+ runtime remap target/route) |
| `response_type_mismatches.csv` | Scale label vs option/stem contradictions |
| `root_cause_coverage_gaps.csv` | Concerns missing curated questions and/or root-cause group |
| `audit_summary.json` | Machine-readable aggregate of every metric above |
