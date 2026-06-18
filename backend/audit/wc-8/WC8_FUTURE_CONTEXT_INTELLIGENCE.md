# WC-8 Track F — Future Context Intelligence Report

**This is CAPADEX's strongest future-readiness dimension.** The L5B context layer
(`wc3_question_context`) already classifies all 30,638 clarity questions into life-contexts, and
several are explicitly future-facing.

## F.1 Measured context distribution (of 30,638 questions)
| Primary context | Count | % | Future-facing? |
|-----------------|------:|----:|:--:|
| GENERAL | 22,581 | 73.7% | — |
| LEADERSHIP | 2,497 | 8.2% | partial |
| CAREER_CLARITY | 1,304 | 4.3% | partial |
| PLACEMENT_ANXIETY | 672 | 2.2% | ✅ |
| DIGITAL_BEHAVIOUR | 590 | 1.9% | partial |
| COMPETITIVE_EXAM_PRESSURE | 564 | 1.8% | — |
| PEER_SOCIAL_COMPARISON | 475 | 1.6% | — |
| **AI_FUTURE_OF_WORK** | **440** | 1.4% | ✅ |
| **CAREER_TRANSITION** | **403** | 1.3% | ✅ |
| **EMPLOYABILITY** | **341** | 1.1% | ✅ |
| FAMILY_PRESSURE | 260 | 0.8% | — |
| HIGHER_EDUCATION_CHOICE | 134 | 0.4% | partial |
| UNRESOLVED | 107 | 0.3% | — |
| **ENTREPRENEURSHIP** | **89** | 0.3% | ✅ |
| WORKPLACE_ADJUSTMENT | 87 | 0.3% | ✅ |
| RELOCATION_MIGRATION | 54 | 0.2% | partial |
| FINANCIAL_PRESSURE | 22 | 0.07% | — |
| IDENTITY_BELONGING | 18 | 0.06% | — |

**Future-facing context total ≈ 2,086 questions (6.8%)** across AI / transition / employability /
entrepreneurship / placement / workplace / relocation.

## F.2 The four required measures
- **Context coverage:** The *taxonomy* is excellent — dedicated `AI_FUTURE_OF_WORK`,
  `CAREER_TRANSITION`, `EMPLOYABILITY`, `ENTREPRENEURSHIP`, `WORKPLACE_ADJUSTMENT` contexts already
  exist. The *volume* is concentrated: 73.7% `GENERAL` means most questions are context-neutral.
- **Context drift:** `GENERAL` dominance is the drift risk — a future-readiness question can fall
  into `GENERAL` and lose its future-facing tag. (Consistent with the known L5B finding that ~½ of
  questions are legitimately context-free.)
- **Context reachability:** Future contexts are detected but **do not route to future-specific
  outcomes/products** (same back-half gap) — `AI_FUTURE_OF_WORK` and `ENTREPRENEURSHIP` have no
  matching outcome model.
- **Context relevance:** L5B already carries `relevance_risk` + `context_confidence` per row, so
  relevance is self-scored and honest.

## F.3 Missing future contexts
Present: AI future-of-work, career transition, placement, employability, workplace, relocation,
entrepreneurship. **Absent / implicit only:** explicit *Layoff Risk*, *Skill Obsolescence* (exists
as concerns but not as a context label), *Automation Risk* (folded into AI), *Industry Change*,
*Career Reinvention* (folded into transition).

## F.4 Recommendation
| Field | Value |
|-------|-------|
| Current State | Rich future-facing context taxonomy (2,086 Qs tagged); contexts don't reach future outcomes; 3 contexts implicit |
| Target State | Add Layoff-Risk / Skill-Obsolescence / Industry-Change context labels; wire future contexts → future outcomes |
| Gap | A few context labels + context→outcome wiring (the recurring back-half) |
| User Impact | **Medium-High** — sharper detection of the exact future fear |
| Business Impact | **Medium** — improves targeting/personalization |
| Revenue Impact | **Medium** — feeds the AI/Future-Skills SKUs |
| Technical Difficulty | **Low-Medium** — L5B classifier is extensible (lexicon-driven) |
| Priority | **P2** |

**Future Context coverage ≈ 65/100 (directional)** — best taxonomy, under-routed.
