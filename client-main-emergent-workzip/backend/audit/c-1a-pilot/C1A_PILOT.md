# C-1A PILOT VALIDATION — Question Differentiation Architecture

**Scope:** Sandbox-only pilot on 10 bridge tags (~7,060 questions). No repository changes, no
mass-enrichment, C-2 NOT executed by this pilot. All pilot output lives in the sandbox table
`pilot_c1a_enrichment` (revert = `DROP TABLE pilot_c1a_enrichment;`).

**Status:** COMPLETE — **STOP for approval** before any repository-wide C-2.

**Method honesty note:** all differentiation figures are reported in **two frames**:
- *raw-where-present* — realized differentiation computed only over questions the dimension could classify; and
- *coverage-weighted* — realized × (classified coverage), the honest "effective" contribution.
We lead with **coverage-weighted**; raw-where-present is shown to expose where a dimension differentiates
well but fires on too few questions.

---

## OUTPUT 1 — Pilot Selection Report

Pilot = the **10 largest signal-blind pools** (0% signal coverage, capability uniformity 1.000,
high routing value). Matches the C-1A Report-8 top-priority list.

| # | Bridge tag | Questions | Signal cov (before) | Capability uniformity (before) | Grounding rows available |
|---|------------|-----------|---------------------|-------------------------------|--------------------------|
| 1 | EMOTIONAL_REGULATION | 1,100 | 0% | 1.000 | 0 (ungrounded) |
| 2 | CAREER_READINESS | 1,000 | 0% | 1.000 | 0 (ungrounded) |
| 3 | DISCIPLINE_HABITS | 925 | 0% | 1.000 | 0 (ungrounded) |
| 4 | SOCIAL_EMOTIONAL | 825 | 0% | 1.000 | 0 (ungrounded) |
| 5 | CONFIDENCE_SELF | 650 | 0% | 1.000 | 0 (ungrounded) |
| 6 | MOTIVATION_VALUES | 620 | 0% | 1.000 | 0 (ungrounded) |
| 7 | ADJUSTMENT_COPING | 565 | 0% | 1.000 | 0 (ungrounded) |
| 8 | THINKING_QUALITY | 525 | 0% | 1.000 | 0 (ungrounded) |
| 9 | LIFESTYLE_PRESSURE | 450 | 0% | 1.000 | 0 (ungrounded) |
| 10 | LEARNING_ADAPTABILITY | 400 | 0% | 1.000 | 120 (3 families, `moderate`/YELLOW) |
| | **Total** | **7,060** | **0%** | **1.000** | **1 of 10 tags grounded** |

**Selection criteria:** high volume × zero signal coverage × maximal within-tag uniformity × high
readiness-routing relevance. These are the worst-differentiated, highest-traffic pools — the maximal-
impact stress test for the architecture.

**Critical selection finding (grounding availability):** of the 10 pilot tags, **only
LEARNING_ADAPTABILITY** has any rows in `capadex_bridge_tag_signal_grounding` (120 rows, 3 families,
all `evidence_strength='moderate'`, similarity 0.13–0.21, provenance `wc1a_yellow`). The other **9 are
fully ungrounded**. Repository-wide, 119 of 144 signal-blind tags *do* have (weak) grounding — but the
flagship generic pools C-1A ranked #1 for signal backfill are precisely the ones that do **not**. This
is decisive for OUTPUT 7.

---

## OUTPUT 2 — Pilot Delta Report (before → after, pilot tags only)

Per-dimension realized differentiation (`1 − tag-size-weighted within-tag HHI`), same-basis frame
(new dimensions = 0 before).

| Dimension | Before | After (raw-where-present) | Classified coverage (after) | After (coverage-weighted) |
|-----------|--------|---------------------------|-----------------------------|---------------------------|
| dev_stage (structural) | 0.738 | 0.738 | ~100% | 0.738 |
| persona (structural) | 0.046 | 0.046 | 96.9% | 0.046 |
| age_band (structural) | 0.000 | 0.000 | — | 0.000 |
| **capability** | 0.000 | 0.716 | **48.6%** | **0.348** |
| **behavior** | 0.000 | 0.740 | **10.4%** | **0.077** |
| **signal** | 0.000 | 0.374 | **1.2%** | **0.004** |
| **context** | 0.000 | 0.000 (within-tag) | 100% | 0.000 |
| **archetype** | 0.000 | 0.707 | **99.6%** | **0.704** |

**Repository differentiability (8-dim, same basis):**
- raw-where-present: **0.098 → 0.428 (+336%)**
- **coverage-weighted (honest headline): 0.098 → 0.240 (+145%)**

**QDS (enrichable-5: capability/behavior/signal/context/archetype), raw-where-present:** 0.000 → 0.507.

**Reading:** the architecture genuinely lifts differentiation, but the gap between +336% and +145% is
the story — capability/behavior/signal **differentiate well where they fire but fire on a minority of
questions**. Context shows **0 within-tag** differentiation by nature (it is constant inside a tag; its
value is cross-tag routing — see OUTPUT 4). Archetype is the only deferred dimension that is both
high-differentiation *and* high-coverage.

---

## OUTPUT 3 — Differentiation Contribution

Contribution of each dimension to the **coverage-weighted differentiation gain**. Because every
enrichable dimension starts at 0 before, each dimension's effective-after value *is* its gain; the
contribution basis (denominator) is the sum of the five effective values = **1.133**.

| Dimension | Effective gain | Share of gain |
|-----------|----------------|---------------|
| **Archetype** | 0.704 | **62.1%** |
| **Capability** | 0.348 | **30.7%** |
| Behavior | 0.077 | 6.8% |
| Signal | 0.004 | 0.4% |
| Context (within-tag) | 0.000 | 0.0% |

**Archetype + Capability carry ~92% of the realized within-tag gain.** Behavior and Signal contribute
little — not because they lack theoretical headroom but because evidence is thin (behavior is hard to
read from clarity-question text; signal is grounding-blocked). Context contributes 0 *within-tag* and is
evaluated separately in routing (OUTPUT 4).

**Facet distributions are real, not degenerate** — capability spreads across 10 facets
(Goal-Direction 1,198 · Emotional-Regulation 586 · Self-Management 448 · Decision-Making 295 · …);
behavior across 11 (Avoidance 286 · Planning-Preparation 124 · Adaptation 83 · …). Where the classifiers
fire, they produce genuine spread.

---

## OUTPUT 4 — Routing Simulation (QRS router, 5 readiness contexts)

Domain-routing precision: fraction of selected questions whose `context_primary` matches the readiness
domain. **Before** = domain-blind router (no context dimension → blind selection = base rate).
**After** = context-routed selection.

| Readiness context | Target Qs in pilot | Before precision (blind) | After precision | Lift |
|-------------------|--------------------|--------------------------|-----------------|------|
| Learning Readiness | 925 | 13.1% | 100% | **+86.9 pp** |
| Career Readiness | 1,000 | 14.2% | 100% | **+85.8 pp** |
| Employability Readiness | 1,000 | 14.2% | 100% | **+85.8 pp** |
| Competency Readiness | 4,310 | 61.0% | 100% | **+39.0 pp** |
| Competitive Exam Readiness | 0 | 0.0% | 0% | +0.0 pp |

**Form diversity (archetype) available to the router within each domain:** ~1.9 bits of entropy
(Career: Reflective/Situational/Behavioral/Future-Oriented mix), so the router can balance question
*form* in addition to *domain*.

**Honest limitation:** the pilot set carries only 4 context domains (Personal Development 61%, Career
14.2%, Learning 13.1%, Social 11.7%). **Competitive Exam Readiness returns 0** — no Academic/Competitive
context exists in these 10 generic tags. This is a true coverage gap of the pilot set, not a router
failure: context routing is only as good as the contexts present in the corpus.

---

## OUTPUT 5 — Lessons Learned

1. **Archetype is the highest-yield dimension** (61.5% of gain, 99.6% coverage) — derivable from
   structured `narrative_style`. Already shipped repo-wide in the prior C-2. Strongly validated.
2. **Capability facet is promising but evidence-limited** — 30.4% of gain, but only 48.6% of questions
   carry extractable capability evidence in their text (range 28%–88% per tag). Good where present.
3. **Behavior facet is evidence-blocked in practice** — 10.4% coverage. Clarity questions rarely encode
   observable *actions* in extractable form. C-1A's "behavior = large headroom" is true in principle but
   not realizable from question text alone.
4. **Signal backfill contradicts C-1A's "cheapest, highest-priority" ranking for these tags.** 9 of 10
   pilot tags are ungrounded; only LEARNING_ADAPTABILITY has weak `moderate`/YELLOW evidence. After
   enforcing per-question evidence (tag-level grounding alone is not evidence for an individual
   question), only **1.2% coverage** survives — **85 of 7,060 questions** had both grounding *and*
   per-question text evidence (315 more were grounded but lacked text evidence → correctly UNCLASSIFIED).
   The largest, most generic signal-blind pools are the *hardest* to ground, not the easiest.
   (Repository-wide, 119/144 signal-blind tags do have weak grounding, so backfill is feasible for
   smaller tags — just not the flagship pools.)
5. **Context delivers routing value, not within-tag differentiation** — 0 within-tag, but +39–87pp
   routing precision. Confirms the C-2 finding: measure context by routing, never by within-tag spread.
6. **Measurement honesty matters** — raw-where-present (+336%) vs coverage-weighted (+145%) differ by
   ~2×. Coverage is the gate; low coverage must not be allowed to read as high differentiation.
7. **C-2 ordering, honestly reported:** the prior task executed Context + Archetype repo-wide first and
   deferred capability/behavior/signal. The pilot confirms that ordering was **correct** — the two
   highest-coverage, highest-yield dimensions shipped first; the deferred three are exactly the ones the
   pilot now shows are evidence-limited and should be gated rather than mass-applied.

---

## OUTPUT 6 — Recommended Architecture Adjustments

- **A1 — Re-sequence the remaining C-2.** C-1A ordered signal → context → archetype → capability/
  behavior. Evidence-based order: **Archetype (done) → Capability (gated) → Signal (grounding-gated, for
  grounded tags only) → Behavior (deferred / curated).** Demote signal from "first/cheapest."
- **A2 — Add a per-(tag,dimension) coverage gate.** Only enrich where classified coverage ≥ threshold
  (suggest 60%); below it, leave `UNCLASSIFIED` and flag for curated authoring. Prevents low-coverage
  dimensions from masquerading as differentiation.
- **A3 — Broaden capability evidence beyond question text** — incorporate option text + anchors, or
  curated per-tag facet sets, to lift coverage above the ~49% text-only ceiling.
- **A4 — Make signal backfill grounding-conditional** — require grounding rows to exist before
  assigning a signal family; expand grounding (WC-class work) for the 25 ungrounded signal-blind tags and
  strengthen the 119 weak ones before signal is relied upon in routing.
- **A5 — Report and gate on coverage-weighted differentiation**, not raw-where-present. Apply the
  Diversity Standards to the coverage-weighted metric.
- **A6 — Enrich context for cross-domain routing, not within-tag spread** — and explicitly track context
  gaps (e.g., absent Academic/Competitive contexts) as a corpus-authoring need.

---

## OUTPUT 7 — Go / No-Go Recommendation

**Overall: GO to proceed with a RE-SEQUENCED, COVERAGE-GATED C-2 — NOT the original
"signal-first, enrich-everything" plan.**

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| Context | **GO** (already C-2-shipped) | Routing value proven (+39–87pp); full coverage. |
| Archetype | **GO** (already C-2-shipped) | Highest yield (61.5%), 99.6% coverage. |
| Capability | **CONDITIONAL GO** | High value where present; gate on coverage, add evidence sources (A2/A3). |
| Behavior | **NO-GO as text-only auto-enrichment** | 10.4% coverage; revisit via curated authoring / richer evidence. |
| Signal | **NO-GO for flagship generic tags**; **CONDITIONAL GO** for the 119 grounded signal-blind tags at low confidence | 9/10 pilot tags ungrounded; backfill without grounding = fabrication. |

**Bottom line:** the architecture works and the prior C-2 sequencing (Context + Archetype first) is
vindicated. The remaining dimensions must be coverage-gated and grounding-gated, not mass-applied. Do
**not** execute repo-wide capability/behavior/signal enrichment until A1–A6 are adopted.

---

## Reproducibility & revert

- Classifier: `backend/scripts/audit/c1a-pilot-classifier.mjs` (capability/behavior facets + grounded signal router; reuses `c2-enrichment-classifier.mjs` for context/archetype).
- Sandbox schema: `backend/scripts/audit/c1a-pilot-schema.sql`.
- Enrichment runner: `backend/scripts/audit/c1a-pilot-enrich.mjs` (idempotent; writes only `pilot_c1a_enrichment`).
- **Revert:** `DROP TABLE pilot_c1a_enrichment;` — fully removes the pilot; no production table touched.
- Machine-readable results: `backend/audit/c-1a-pilot/c1a_pilot.json`.
