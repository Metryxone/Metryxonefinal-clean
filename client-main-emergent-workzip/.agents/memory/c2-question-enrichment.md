---
name: C-2 Question Semantic Enrichment (Context + Archetype)
description: How the two 0%-coverage dimensions were derived, why archetype works and context is weak within-tag, and the reversible/measurement discipline.
---

# C-2 Question Semantic Enrichment — durable lessons

**Archetype is derivable with high confidence from EXISTING structured fields — don't author it.**
`capadex_clarity_questions.narrative_style` (scenario_based / reflective / emotional / action-oriented / behavioral / future-oriented / timeline_based …) maps almost 1:1 to an archetype taxonomy; ~90% of rows resolve from it alone (text phrasing + response_type refine the rest). It varies strongly WITHIN a bridge tag (avg ~5.6 distinct narrative styles/tag), so adding Archetype produces real within-pool differentiation — it became a **near-co-dominant differentiator alongside `dev_stage`** (each ~46% of realized differentiation; repository realized ~0.55).

**Context is largely TAG-determined → low within-tag differentiation, by nature.**
A bridge tag mostly maps to one life-domain (EXAMINATION_STRESS→Academic, CAREER_READINESS→Career, WORKPLACE_ADAPTATION→Employment), so `context_primary` barely varies inside a tag (within-tag realized ~0.08). **Its value is cross-tag ROUTING / relevance, NOT within-pool spread** — measure that separately (QRS), don't judge context by the within-tag HHI index.

**Tag-evidence ordering matters:** check the SPECIFIC class before the general one — `COMPETITIVE|ENTRANCE|JEE|NEET|UPSC` → Competitive Exams must precede generic `EXAM|EXAMINATION` → Academic, or competitive tags get swallowed into Academic and the specific class is starved of its strongest (bridge-tag) evidence.

**Why / how to apply:**
- **Enrich into a SEPARATE table** (`capadex_question_enrichment`, keyed on question_id), never mutate the AQ-2 `capadex_question_metadata` or question text → fully reversible (DROP TABLE), byte-identical legacy until a future flag-gated C-2R consumes it.
- **Quality gate = UNCLASSIFIED (confidence 0) on no evidence; never fabricate.** Honest unclassified rates are findings (archetype 0.3%, context 16%), not failures.
- **Keep one importable classifier as source of truth** (`backend/scripts/audit/c2-enrichment-classifier.mjs`) used by BOTH the populate run and any consumer — no logic drift.
- **Reporting before/after across a CHANGED dimension set:** use a SAME-BASIS frame (new dims = 0 before), not a mean over different denominators (÷6 vs ÷8) — the denominator shift inflates/obscures the real gain. Same-basis here: 0.072 → 0.151 (+109%).
- **Still 0% / deferred:** capability/behavior (uniformity) and signal (coverage) are the deeper C-2.4/C-2.1 sub-phases — they need ontology semantic-mapping and carry fabrication risk; do them as a dedicated follow-on with the same discipline.
