# AQ-1 · Output 1 — Metadata Coverage Report

**Bank audited:** `capadex_clarity_questions` · **30,638 questions** · 5,357 distinct concern_ids · 325 distinct bridge tags
**Date:** 2026-06-04 · **Investigation only — no questions modified or regenerated.**

## How each Phase-1 field is sourced
| Field | Source | Path |
|---|---|---|
| Question | bank column `question` | direct |
| Concern | bank `concern` / `concern_id` | direct |
| Bridge Tag | bank `master_bridge_tag` | direct (`text_bridge_tag` is 100% empty) |
| Development Stage | bank `stage` | direct |
| Capability | `capadex_concerns_master.capability_mapping` | **derived** via `master_bridge_tag → relational_bridge_tag` |
| Persona | `capadex_concerns_master.primary_persona` | **derived** via bridge tag |
| Age Band | `capadex_concerns_master.age_min/age_max` | **derived** via bridge tag |
| Signal | `capadex_concern_signal_map` | **derived** via bridge tag |
| Behavior | `capadex_concern_signal_map` confidence band + signal labels | **derived** via bridge tag |
| Construct | grounded signal family (`capadex_bridge_tag_signal_grounding`) | **derived PROXY** — no authoritative per-question construct exists |

> **Structural finding (critical):** the bank's `concern_id` namespace is **disjoint** from `capadex_concerns_master` — only **3 of 30,638** rows join (**0.0%**). Every derived field therefore depends on a single hinge: `master_bridge_tag`. There is no second, independent linkage to cross-check derivations.

## Completeness classification (Present / Missing / Ambiguous / Conflicting)
"Ambiguous" = the bridge-tag derivation yields **more than one** value (e.g. a tag mapping to several personas/capabilities). "Conflicting" = the derived values are mutually exclusive (used for age that straddles the youth↔adult boundary).

| Field | Present | Missing | Ambiguous | Conflicting | Present % |
|---|---:|---:|---:|---:|---:|
| Question | 30,638 | 0 | 0 | 0 | **100%** |
| Concern | 30,638 | 0 | 0 | 0 | **100%** |
| Bridge Tag | 30,638 | 0 | 0 | 0 | **100%** |
| Behavior | 30,558 | 0 | 80 | 0 | **99.7%** |
| Development Stage | 14,294 | 16,344 | 0 | 0 | **46.7%** |
| Capability | 11,290 | 0 | 19,348 | 0 | **36.8%** |
| Persona | 10,639 | 3,489 | 16,510 | 0 | **34.7%** |
| Construct | 4,437 | 13,538 | 12,663 | 0 | **14.5%** |
| Signal | 80 | 0 | 30,558 | 0 | **0.3%** |
| Age Band | 0 | 125 | 1,395 | 29,118 | **0%** |

> **"Present" = resolves to exactly one value; "Ambiguous" = resolves to >1 value** (consistently applied to every derived field). The `concern_id → concerns_master` join rate is **measured at run time** (0.0%), not assumed.

## Reading the table
- **Solid (100%):** Question, Concern, Bridge Tag are universally present. Behavior resolves for 99.7% (strong band) because `concern_signal_map` covers every bridge tag.
- **Ambiguous-dominated:** Capability, Persona, Signal are *reachable* for nearly all questions but rarely **unambiguous** — one bridge tag fans out to many concerns (avg **1.4 persona buckets / tag**, **98 of 328** master bridge tags multi-capability, avg age span ~14 years; the bank uses 325 of those 328 tags), so the single right value can't be pinned per question. **Signal is the extreme case: only 80 questions (0.3%) resolve to a single signal** — a tag maps to ~43 signals on average, so every other question inherits a multi-signal cluster, not one determinate signal.
- **Construct (14.5%):** the weakest field. It has no authoritative source; the proxy (grounded signal family) is present-and-single for only 14.5%, ambiguous for 41.3%, and entirely **absent for 13,538 (44.2%)** questions whose bridge tag has no atomic grounding.
- **Age Band (0% clean):** **no** question resolves to a single clean band; **29,118 (95%)** inherit a tag spanning the youth↔adult boundary (see Output 2).
- **Development Stage (46.7%):** present only because 14,294 rows carry the value "Clarity"; the other 16,344 are blank and **no** row carries Awareness/Curiosity/Growth/Mastery (see Output 4).

## Governance metadata
`question_id → capadex_question_registry`: **14,294 / 30,638 = 46.7%**. Over half the bank has no quality/usage/coverage governance record.
