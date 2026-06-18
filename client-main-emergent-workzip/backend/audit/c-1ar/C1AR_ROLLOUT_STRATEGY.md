# CAPADEX C-1AR — Pilot Architecture Review & Rollout Strategy

**Mandate:** Review the completed C-1A Pilot findings and convert them into the final
repository-wide rollout strategy. **Review and planning only.** No repository enrichment, no
production writes, no new metadata, no question modifications, **C-2 NOT executed**. STOP for approval.

**Inputs (pilot findings treated as highest-priority evidence):** AQ-1, AQ-2, AQ-2R, C-1 QSIL Audit
(`audit/c-1/`), C-1A QDA Architecture (`audit/c-1a/`), **C-1A Pilot Validation** (`audit/c-1a-pilot/`).

**Honest sequencing note:** the prior C-2 task already shipped **Context + Archetype repository-wide**
before this pilot ran. The pilot (sandbox-only, 10 tags) measured the C-2-deferred dimensions
(capability/behavior/signal) on top of that. This review treats Context/Archetype as **shipped &
validated (Wave 1 done)** and plans Waves 2–4 for the still-deferred dimensions. All figures below are
the pilot's **coverage-weighted (honest)** frame unless explicitly labelled *raw-where-present*.

---

## OUTPUT 1 — Pilot Validation Report *(PHASE 1)*

### Measured gains (pilot = 10 largest signal-blind pools, 7,060 Qs — the worst-differentiated, highest-traffic case)

| Metric | Before | After | Change | Frame |
|---|---|---|---|---|
| Repository differentiability | 0.098 | **0.240** | **+145%** | coverage-weighted (headline) |
| Repository differentiability | 0.098 | 0.428 | +336% | raw-where-present (secondary) |
| QDS (enrichable-5) | 0.000 | 0.507 | — | raw-where-present |
| Routing precision (4 of 5 contexts) | 13–61% | 100% | **+39 to +87 pp** | per-context |

### Per-dimension classification & coverage (after)

| Dimension | Realized (raw-where-present) | Classified coverage | Coverage-weighted | Verdict |
|---|---|---|---|---|
| **Archetype** | 0.707 | **99.6%** | **0.704** | High yield + high coverage |
| **Capability** | 0.716 | 48.6% | 0.348 | High yield, partial coverage |
| **Behavior** | 0.740 | **10.4%** | 0.077 | High yield, evidence-blocked |
| **Signal** | 0.374 | **1.2%** (85/7,060) | 0.004 | Grounding-blocked |
| **Context** | 0.000 within-tag | 100% | 0.000 within-tag | Routing value only (see below) |

### Contribution to the coverage-weighted gain (denominator = Σ 5 effective values = 1.133)

Archetype **62.1%** · Capability **30.7%** · Behavior 6.8% · Signal 0.4% · Context 0% (within-tag).
→ **Archetype + Capability carry ~93% of realized within-tag differentiation.**

### Statistical reliability

- **Honest two-frame reporting** is intact: the ~2× gap between +336% (raw) and +145% (coverage-weighted)
  is the load-bearing finding — three deferred dimensions differentiate *well where they fire but fire on
  a minority of questions*. Coverage is the gate.
- **Facet spreads are real, not degenerate** — capability spreads across 10 facets, behavior across 11;
  where classifiers fire they produce genuine distribution (not a single dominant bucket).
- **Non-fabrication held** — signal requires *per-question* text evidence; tag-level grounding alone →
  `UNCLASSIFIED` (315 grounded-but-no-text rows correctly excluded, leaving 85 honest classifications).

### Scalability read

- **Archetype & Context scale cleanly** — derived from structured fields (`narrative_style`,
  tag→context), so repo-wide coverage ≈ pilot coverage (~99%/100%). Already shipped; low risk to extend.
- **Capability scales partially** — text-only ceiling ≈49%; scaling requires broadening evidence
  (options + anchors + curated per-tag facet sets) to lift coverage.
- **Behavior & Signal do NOT scale as text-only auto-enrichment** — 10.4% and 1.2% coverage on the
  flagship pools. Scaling needs richer evidence (behavior) and grounding expansion (signal).

**PHASE 1 verdict:** the architecture's gains are **real and reproducible**, the measurement is
**honest**, and scalability is **dimension-specific** — strong for Archetype/Context, conditional for
Capability, blocked for Behavior/Signal under text-only enrichment. Pilot **VALIDATED** as a decision basis.

---

## OUTPUT 2 — Architecture Reassessment Report *(PHASE 2)*

Original C-1A assumption vs measured pilot result, per dimension.

| Dimension | Original C-1A assumption | Pilot result | Classification |
|---|---|---|---|
| **Age** | Low ceiling (4 values) — freeze effort | Confirmed: 0 within-tag, intrinsically tag-level | **Validated** |
| **Persona** | Low ceiling (5) — freeze | Confirmed: 0.046, near-flat | **Validated** |
| **Stage** | Only real differentiator, capped at 5 | Confirmed: 0.738, the sole structural differentiator | **Validated** |
| **Capability** | "Largest unused headroom; per-question enrichment pays off **massively**" | High yield (0.716) **but only 48.6% text coverage** → coverage-weighted 0.348 | **Partially Validated** |
| **Behavior** | "Large headroom; high-value dimension" | High yield where present (0.740) but **10.4% coverage** — actions rarely in question text | **Not Validated** (as text-only) |
| **Signal** | "Coverage problem; backfill **FIRST**, cheapest & highest-priority" | **9/10 flagship tags ungrounded**; per-question evidence yields **1.2%**. Backfill is the *hardest*, not cheapest, for generic pools | **Not Validated** (ordering overturned) |
| **Context** | New architecture; highest-leverage routing; 0 within-tag expected | Confirmed: 0 within-tag, **+39–87pp routing** | **Validated** |
| **Archetype** | New architecture; assessment-form + routing value | Confirmed & exceeded: **highest yield (62.1%), 99.6% coverage** | **Validated** |

**Two assumptions are overturned by evidence:**
1. **Signal is NOT the cheapest first move** for the flagship generic pools — it is grounding-blocked.
   (C-1A Blueprint step C-2.1 "Signal backfill first" is retired for these tags.)
2. **Behavior headroom is not realizable from question text alone** — true in principle, not in practice.

**One assumption is upgraded:** Archetype moves from "form value" to the **single highest-yield dimension**.

**PHASE 2 verdict:** the C-1A *diagnosis* (flat, tag-level metadata; low-cardinality dims are a trap;
context/archetype are new architecture) is **fully validated**. The C-1A *sequencing* (signal-first) is
**invalidated** and replaced below.

---

## OUTPUT 3 — Rollout Priority Report *(PHASE 3)*

Implementation order redesigned on pilot evidence (not on theoretical headroom).

| Dimension | Priority | Expected impact | Implementation complexity | Expected ROI | Status |
|---|---|---|---|---|---|
| **Archetype** | **P1** | Highest (62.1% of gain) | Low (structured `narrative_style`) | **Highest** | **Shipped** (prior C-2) |
| **Context** | **P1** | High routing (+39–87pp) | Low (tag→domain) | High | **Shipped** (prior C-2) |
| **Capability** | **P2** | High where present (30.7%) | Medium (needs evidence broadening) | High, coverage-gated | Plan (Wave 2) |
| **Signal** | **P3** | Low for flagship; moderate for grounded tags | High (grounding must exist first) | Low near-term | Plan (Wave 3, conditional) |
| **Behavior** | **P4** | Low as text-only (6.8%) | High (curated authoring / richer evidence) | Low near-term | Defer (Wave 4) |

**Redesigned order:** **Archetype → Context (both shipped) → Capability (gated) → Signal (grounding-conditional) → Behavior (curated).**
This demotes Signal from C-1A's #1 to #4-of-the-remaining, and demotes Behavior to a curated track.

**ROI logic:** ROI ∝ (yield × coverage) ÷ complexity. Archetype/Context maximize it (high yield/coverage,
low complexity). Capability is next-best once coverage is lifted. Signal/Behavior have low near-term ROI
because their blockers (grounding, evidence form) sit *upstream* of enrichment.

---

## OUTPUT 4 — Signal Strategy Report *(PHASE 4)*

### Grounded signal coverage (repository, read-only from `capadex_bridge_tag_signal_grounding`)

| Evidence strength | Distinct tags with ≥1 row | Rows |
|---|---|---|
| moderate | 121 | 14,281 |
| good | 171 | 12,242 |
| strong | 42 | 2,160 |
| **Total (distinct tags)** | **303** | **28,683** |

*Source: read-only `SELECT evidence_strength, COUNT(DISTINCT bridge_tag), COUNT(*) FROM capadex_bridge_tag_signal_grounding GROUP BY evidence_strength` (June 2026). Tag counts overlap across strengths (a tag may carry rows at multiple strengths).*

Of the **144 signal-blind tags** (C-1: 13,538 Qs / 44.2% of the repo with no `signal_family`):
**~119 have weak grounding available, ~25 are fully ungrounded**, and — critically — the **flagship
generic pools** (EMOTIONAL_REGULATION, CAREER_READINESS, DISCIPLINE_HABITS, SOCIAL_EMOTIONAL,
CONFIDENCE_SELF, MOTIVATION_VALUES, ADJUSTMENT_COPING, THINKING_QUALITY, LIFESTYLE_PRESSURE) are in the
ungrounded set. Only **LEARNING_ADAPTABILITY** of the 10 pilot tags is grounded.

### Evidence strength & coverage gaps

- **Tag grounding ≠ question evidence.** The pilot's decisive result: even where a tag is grounded, a
  *question* is only classifiable if its **own text** carries signal evidence. On grounded pilot rows this
  collapsed to **1.2% (85/7,060)**.
- **The biggest, most generic pools are the hardest to ground** — exactly the ones C-1A prioritized.
- Repository `signal_strength` historically: null 44.2% / moderate 43.3% / strong 12.5% / **weak unused**.

### Backfill feasibility

| Tag class | Feasibility | Confidence |
|---|---|---|
| 42 strong-grounded + 171 good-grounded tags | Feasible | Moderate–High |
| 119 weak-grounded signal-blind tags | Feasible at **low confidence**, per-question evidence required | Low |
| 25 ungrounded signal-blind tags (incl. 9 flagship pools) | **Not feasible** until grounding is built (WC-class work) | — |

### Evidence requirements · classification rules · quality gates (the signal contract for C-2)

1. **Two-key requirement:** assign a signal family only when **(a)** the tag has ≥1 grounding row **AND
   (b)** the question text carries matching signal evidence. Missing either → `UNCLASSIFIED` (never fabricate).
2. **Confidence band from grounding strength:** strong→high, good→moderate, weak/moderate→low. Surface the
   band; never let low-confidence signal drive routing as if certain.
3. **Coverage gate ≥60%** per (tag, signal): below it, leave the tag signal-`UNCLASSIFIED` and flag for
   grounding expansion rather than partial-fill that masquerades as coverage.
4. **Grounding-first dependency:** the 25 ungrounded tags (incl. flagship pools) require a **WC-class
   grounding expansion** *before* any signal enrichment — sequenced ahead of signal in the blueprint.

**PHASE 4 verdict:** signal backfill is a **conditional, grounding-gated** activity, not a repo-wide
sweep. Mass signal backfill on the flagship pools is **rejected**.

---

## OUTPUT 5 — Repository Rollout Blueprint *(PHASE 5)*

Four waves. Each is flag-gated, reversible, and gated on a **before/after measurement** (AQ-2R shared
scorer) — accept honest results, never tune to a target.

### Wave 1 — Context + Archetype *(ALREADY SHIPPED in prior C-2 — verify & lock)*
- **Target:** all 325 bridge tags, repository-wide.
- **Target questions:** full repo (~30,638 clarity questions).
- **Expected gain:** routing precision +39–87pp (per pilot); archetype carries ~62% of within-tag gain.
- **Action now:** *no new enrichment* — run the AQ-2R measurement gate to confirm the shipped values,
  lock the Context (8 Primary + 5 Situational) and Archetype (8-form) taxonomies, register the coverage.
- **Risk:** **Low** (high coverage already realized).

### Wave 2 — Capability (coverage-gated)
- **Target tags:** high-coverage tags first — those where capability text-evidence ≥60% (pilot range
  28–88%/tag; start with the 88%-class tags, defer the 28%-class).
- **Target concerns:** the 758 concerns with ≥10 Qs, prioritized by pool size × coverage.
- **Target question counts:** phased; only the ≥60%-coverage subset per tag is enriched, remainder
  `UNCLASSIFIED` pending evidence broadening.
- **Expected gain:** +0.30–0.35 coverage-weighted capability differentiation where coverage is high.
- **Risk:** **Medium** — requires broadening evidence to option text + anchors + curated per-tag facet
  sets to clear the gate; mechanical text-only enrichment is prohibited.

### Wave 3 — Signal (grounding-conditional)
- **Phase 3a:** enrich the **119 weak-grounded** signal-blind tags at **low confidence**, two-key rule,
  ≥60% gate. **Phase 3b:** WC-class **grounding expansion** for the **25 ungrounded** tags (incl. the 9
  flagship pools) — grounding is built first, signal enrichment only after.
- **Target question counts:** small per-tag (per-question evidence is scarce); honest partial coverage.
- **Expected gain:** modest, localized; **NOT** the headline driver. Value is unblocking routing on
  smaller grounded tags, not the flagship pools.
- **Risk:** **High** if rushed (fabrication risk) → mitigated by the two-key rule and grounding-first order.

### Wave 4 — Behavior (curated) + corpus gap closure
- **Behavior:** abandon text-only auto-enrichment; pursue **curated per-tag behavior sets** + richer
  evidence (options/anchors). Treat as authoring, not extraction.
- **Context corpus gaps:** author/seed the missing **Academic / Competitive-Exam** context questions the
  pilot exposed (Competitive Exam Readiness routed 0 — a corpus gap, not a router failure).
- **Risk:** **Medium** — curation cost; bounded scope; no fabrication.

| Wave | Dimension(s) | Target tags | Approx. Qs | Expected gain | Risk |
|---|---|---|---|---|---|
| 1 (done) | Context + Archetype | 325 (all) | ~30,638 | Routing +39–87pp; ~62% within-tag gain | Low |
| 2 | Capability | ≥60%-coverage tags first | Phased subset | +0.30–0.35 cov-wt where present | Medium |
| 3 | Signal | 119 weak-grounded → then 25 ungrounded | Small per-tag | Modest, localized | High |
| 4 | Behavior + context corpus | curated set | Curated | Incremental | Medium |

---

## OUTPUT 6 — Success Metrics Report *(PHASE 6)*

Repository-wide criteria, gated on the **coverage-weighted** metric and measured before/after with the
AQ-2R shared scorer. Baselines from C-1 / AQ-2R; the pilot hit **0.240** on the *worst* tags, so
repo-wide targets are set conservatively below the immovable ~0.55 ceiling.

| Metric | Baseline | Minimum success | Target success | Stretch success |
|---|---|---|---|---|
| Differentiability (coverage-weighted) | 0.096 | **0.18** | **0.30** | **0.45** |
| QIS V2 (mean, 8-dim) | 51.1 | +5 | +10 | +15 |
| Signal coverage (grounded, honest) | 55.8% | 62% | 70% | 80% |
| Archetype coverage | ~99.6% (shipped) | maintain ≥95% | ≥98% | ≥99% |
| Capability coverage (per-question differentiated) | 0% differentiated | 40% | 55% | 70% |
| Routing precision (vs domain-blind) | 0 (blind) | +30pp | +50pp | +70pp |
| Assessment Intelligence Score (Selection-AIS) | AQ-2R baseline | measurable + | clear + | strong + |
| Trust Score (mean selected-QIS) | ~51.1 | +3 | +6 | +10 |

**Gating rules:** (1) all gains reported coverage-weighted, never raw-where-present; (2) every wave passes
a before/after AQ-2R measurement; (3) any dimension below its per-(tag) coverage gate stays `UNCLASSIFIED`
and is excluded from the gain claim; (4) no number is asserted without measurement.

---

## OUTPUT 7 — Final Governance Report *(PHASE 7)*

| Dimension | Governance decision | Conditions |
|---|---|---|
| **Archetype** | **Approved for rollout** | Shipped; lock taxonomy; verify via AQ-2R gate |
| **Context** | **Approved for rollout** | Shipped; lock taxonomy; close Academic/Competitive corpus gap |
| **Capability** | **Approved with Modifications** | ≥60% coverage gate + broaden evidence (options/anchors/curated facets); phased |
| **Signal** | **Approved with Modifications** (119 grounded tags) · **Not Approved** for flagship generic mass-backfill | Two-key rule; grounding-first for 25 ungrounded tags |
| **Behavior** | **Not Approved** as text-only auto-enrichment | Revisit via curated authoring (Wave 4) |
| **QIS V2** | **Approved with Modifications** | Adopt as the health metric **gated on coverage-weighted** differentiation |

---

## OUTPUT 8 — Updated CAPADEX Roadmap

1. **Now (this phase):** approve C-1AR strategy. No writes.
2. **Wave 1 verify:** run AQ-2R measurement on the already-shipped Context + Archetype; lock taxonomies;
   register coverage. *(No enrichment.)*
3. **Wave 2 (Capability):** evidence-broadening tooling → coverage-gated enrichment on high-coverage tags
   → AQ-2R gate.
4. **Wave 3a (Signal, grounded):** two-key low-confidence backfill on the 119 weak-grounded tags → gate.
5. **WC-class grounding expansion:** build grounding for the 25 ungrounded tags (incl. flagship pools).
6. **Wave 3b (Signal, newly grounded):** backfill only after grounding exists → gate.
7. **Wave 4 (Behavior curated + context corpus):** curated behavior sets; author Academic/Competitive
   context questions → gate.
8. **Continuous:** Diversity-Standards CI gate (differentiability ≥0.30 min) on every tag touched;
   reversible, flag-gated throughout.

---

## OUTPUT 9 — C-2 Execution Recommendation

**Proceed with a RE-SEQUENCED, COVERAGE-GATED, GROUNDING-GATED C-2 — NOT the original C-1A
"signal-first, enrich-everything" plan.**

- **Wave 1 (Context + Archetype) is already executed** — validate and lock; do not re-run.
- **Execute Waves 2→4 strictly in order**, each flag-gated, reversible, and behind the non-negotiable
  AQ-2R before/after measurement gate.
- **Do NOT mass-backfill signal** on the flagship generic pools; build grounding first.
- **Do NOT auto-enrich behavior** from question text; treat as curated authoring.
- **Enforce per-(tag, dimension) coverage gates (≥60%)** and report only coverage-weighted gains.
- Every enrichment writes to a **separate, reversible** structure with a clean revert, exactly as the
  pilot did (`DROP TABLE pilot_c1a_enrichment;`).

---

## OUTPUT 10 — GO / NO-GO Decision

### ✅ GO — with modifications.

**GO** to a phased, measured, coverage- and grounding-gated repository rollout, on the re-sequenced order
**Archetype → Context (shipped) → Capability (gated) → Signal (grounding-conditional) → Behavior (curated).**

**NO-GO** on: (1) repo-wide **signal backfill on ungrounded flagship pools**; (2) **text-only behavior
auto-enrichment**; (3) any **unmeasured gain claim**; (4) investment in **age/persona/stage**; (5)
reporting **raw-where-present** as the headline metric.

**Bottom line:** the C-1A architecture and the prior C-2 sequencing (Context + Archetype first) are
**vindicated by evidence**. The remaining dimensions are approved only under coverage gates, grounding
gates, and mandatory measurement. The single biggest correction this review makes to C-1A is **demoting
signal from "cheapest, first" to "grounding-conditional, third"**, on direct pilot evidence.

---

**STOP — WAIT FOR APPROVAL.** Review & planning only. No repository questions modified, no production
data changed, no new metadata created, no rollout executed, C-2 NOT started.

*Machine-readable: `backend/audit/c-1ar/c1ar.json`.*
