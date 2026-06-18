# CAPADEX C-2 — Question Semantic Enrichment (EXECUTED)
## Additive · Reversible · Evidence-based · Measured

**Approved on:** the C-1A QDA architecture.
**What ran:** populated the two dimensions C-1 found at **0% coverage** — **Context** and **Archetype** — at the individual-question level, for all **30,638** questions, into a **new** table `capadex_question_enrichment`.

> **Reversibility:** original AQ-2 metadata (`capadex_question_metadata`) and question text are **untouched**. Revert = `DROP TABLE capadex_question_enrichment`. Nothing at runtime consumes this table yet (runtime activation is a future C-2R, mirroring AQ-2R).

> **Deviation from blueprint order (documented):** C-1A sequenced signal→context→archetype→capability. I executed **Context + Archetype first** because they are purely additive, the highest-confidence (derivable from *existing* structured fields, not guessed), and the two genuinely *new* differentiators. Signal backfill (C-2.1) and per-question capability/behavior (C-2.4) are scoped as follow-on sub-phases — they carry real fabrication risk and need the ontology semantic-mapping infrastructure.

---

## How values were derived (evidence, not fabrication)
Single source of truth: **`backend/scripts/audit/c2-enrichment-classifier.mjs`** (pure, deterministic; imported by the populate run).

- **Archetype** ← `narrative_style` (primary structured signal) → refined by explicit phrasing in the question text (e.g. "describe a time" → Evidence-Based; "would you rather" → Decision-Based; "if/suppose/what is your response" → Situational) → fallback `response_type` hint. **90.4% from `narrative_style`**, 9.0% from text, the rest from response_type.
- **Context** ← `master_bridge_tag` semantics (reliable; e.g. EXAMINATION_STRESS→Academic, CAREER_READINESS→Career, WORKPLACE_ADAPTATION→Employment) + an ordered specific→general text lexicon for primary/secondary.
- **Quality gate:** when no evidence resolves, the value is **`UNCLASSIFIED`** (confidence 0). Never fabricated.

---

## Quality (measured)
| Dimension | Coverage | UNCLASSIFIED | Avg confidence |
|---|---|---|---|
| Archetype | 99.69% | 0.31% (95 rows) | 0.806 |
| Context (primary) | 84.02% | 15.98% (4,895 rows) | 0.619 |

- **Archetype distribution:** Situational 42.7% · Reflective 31.2% · Behavioral 15.1% · Future-Oriented 10.0% · Historical 0.4% · Preference-Based 0.1% · Decision-Based 0.1% · Evidence-Based 0.003% · UNCLASSIFIED 0.3%.
- **Context distribution:** Personal Development 26.1% · UNCLASSIFIED 16.0% · Academic 13.0% · Career 11.9% · Learning 10.3% · Employment 7.2% · Leadership 5.5% · Skill Development 4.5% · Social 4.4% · Competitive Exams 0.4% (134) · (Entrepreneurship/Digital/Financial/Family <0.3% each).
- **Secondary context** populated on 7,361 questions.

*The thin tails (Evidence-Based, Competitive Exams, Family) are honest — the corpus genuinely contains few such questions. They are not padded.*

---

## Differentiation impact — BEFORE vs AFTER (measured)
Method (identical to C-1/C-1A): realized = 1 − tag-size-weighted within-tag HHI; repository differentiability = mean realized across dimensions; contribution% = realized ÷ Σrealized.

| Dimension | Realized (before, 6-dim) | Realized (after, 8-dim) | Contribution after |
|---|---|---|---|
| dev_stage | 0.562 | 0.562 | **46.7%** |
| **archetype** | — (absent) | **0.5487** | **45.6%** |
| **context_primary** | — (absent) | 0.0786 | 6.5% |
| persona_primary | 0.015 | 0.015 | 1.2% |
| age_band | 0.000 | 0.000 | 0.0% |
| primary_behavior | 0.000 | 0.000 | 0.0% |
| primary_capability | 0.000 | 0.000 | 0.0% |
| signal_family | 0.000 | 0.000 | 0.0% |
| **Repository (6-dim → 8-dim)** | **0.0962** | **0.1505** | framework-shifted |

**Same-basis comparator (primary).** Comparing 6-dim to 8-dim mixes a ÷6 and ÷8 denominator. On a **single 8-dimension frame** (Context + Archetype simply = 0 before they existed), repository differentiability rises **0.0721 → 0.1505 (+108.7%)**; the **summed realized differentiation** across dimensions rises **0.577 → 1.204 (+108.7%)**. (The framework-shifted 0.096 → 0.151 is quoted only for continuity with C-1A's headline figure.)

**Headline:** two additive, evidence-derived dimensions **doubled** the corpus's realized differentiation, and the corpus is **no longer single-dimensional**. Before, `dev_stage` carried **97.4%** of all realized differentiation (one 5-value dimension). After, the top dimension carries **46.7%**, with **Archetype co-dominant at 45.6%** — i.e. the count of effective differentiating dimensions went **1 → 2**. This is exactly the structural shift C-1A predicted the new dimensions would produce.

---

## Honest limitations
1. **Context within-tag spread is low (0.079) by nature** — a bridge tag mostly maps to a single life-domain, so context barely differentiates *inside* a tag. Its real payoff is **cross-tag routing / relevance** (QRS in C-1A), which is a separate measurement from this within-tag index — not claimed here.
2. **Context UNCLASSIFIED 16%** are honest no-evidence rows.
3. **Capability / Behavior remain 0% (uniformity) and Signal remains coverage-limited (55.8%)** — the deeper C-2.4 / C-2.1 sub-phases were **not** attempted; they need the ontology semantic-mapping path and carry fabrication risk.
4. The C-1A **projection of ~0.40–0.55** post-*full*-C-2 remains a projection. This phase delivers a **measured +56%** from two dimensions only.

---

## Go / No-Go (next)
**GO to C-2.1 (signal coverage backfill) + C-2.4 (per-question capability/behavior)** — as a dedicated follow-on, with the same additive / reversible / measured discipline and a quality gate that rejects generic fallbacks. Those two carry the remaining (and largest, per C-1A headroom) differentiation gains, but must be derived from the ontology, not blind-inherited.

**Runtime activation (C-2R):** wiring Context/Archetype into the live picker (analogous to AQ-2R) is a separate, flag-gated step — intentionally not done here.

---

**Reversible:** `DROP TABLE capadex_question_enrichment`. **No questions, no original metadata, no runtime behavior changed.**
*Machine-readable: `backend/audit/c-2/c2_enrichment.json`. Classifier: `backend/scripts/audit/c2-enrichment-classifier.mjs`.*
