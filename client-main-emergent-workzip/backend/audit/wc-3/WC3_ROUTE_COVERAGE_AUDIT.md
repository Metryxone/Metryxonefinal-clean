# WC-3 Route Coverage Audit

> **⚠️ SUPERSEDED HEADLINE METRICS (2026-06-08):** the approved remediation has since
> been implemented. This document is retained as the **pre-remediation baseline**. For
> current numbers see `WC3_ROUTE_COVERAGE_UPDATED.md`, plus `WC3_FAMILY_REMEDIATION.md`,
> `WC3_PHANTOM_KEY_RECONCILIATION.md`, and `WC3_ORPHAN_CONSTRUCT_CLASSIFICATION.md`.
> Post-remediation: 7 models · 6 routes · 36 constructs · 0 phantom keys · 7 orphans ·
> Journey Coverage Score 88.8%.

**Type:** Read-only audit. NO implementation, schema, ontology, signal, concern, or
catalog changes were made. This document is the deliverable.
**Status:** Complete — **awaiting approval** before any remediation.
**Date:** 2026-06-05
**Scope:** WC-3 L3 Journey Intelligence route coverage across the canonical construct
registry, outcome models, journey routes, and the concern→construct map.

---

## 0. Sources of truth (as audited)

| Layer | Source | Count |
|---|---|---|
| Constructs (canonical) | `backend/data/behavioural-constructs.ts` → `CONSTRUCTS` | **33** |
| Concern→construct map | `backend/data/behavioural-constructs.ts` → `CONCERN_TO_CONSTRUCT` | **177 entries** (~160 canonical areas + text variants) |
| Outcome models | DB `wc3_outcome_models` | **6** (1 gated: `exam_readiness`) |
| Journey routes | DB `wc3_journey_routes` | **5** (1 fallback: `mentoring`; 1 `corpus_pending`: `competitive_exam`) |
| Runtime constructs | DB `behavioural_hypotheses` | **0 rows** (DEV has no runtime sessions — see §Empty-spine) |

> **Registry note:** the file header comment states "32 named constructs" but the
> `CONSTRUCTS` array contains **33** (`CAREER_GROWTH` appears added after the comment
> was written). Documentation discrepancy only — flagged, not fixed.

---

## 1. Route Coverage Report

**Chain audited:** `construct → outcome model (construct_keys) → route (model_affinities) → product`.

A construct is **route-covered** when it belongs to ≥1 outcome model whose affinity
reaches ≥1 **non-fallback** route.

| Metric | Value | Basis |
|---|---|---|
| **Route Coverage %** | **75.8%** | 25 / 33 constructs reach a real product route |
| **Fallback Usage %** | **24.2%** | 8 / 33 constructs reach only the Mentoring fallback |
| **Product Mapping Coverage %** | **100%** | 5 / 5 routes have `product_key` + `product_path`; 6 / 6 models reach ≥1 route |
| Concern Route Coverage % | **66.1%** | 117 / 177 concern→construct entries land on a covered construct |
| Concern Orphan % | **33.9%** | 60 / 177 entries land on an orphan construct |

### 1a. Construct → model membership (the 25 covered)

| Construct | In model(s) |
|---|---|
| CAREER_CLARITY | career_clarity |
| SKILL_AWARENESS | career_clarity, employability_readiness |
| GOAL_ORIENTATION | career_clarity, decision_quality |
| SELF_ESTEEM | confidence_stability |
| SOCIAL_CONFIDENCE | confidence_stability, employability_readiness |
| RESILIENCE | confidence_stability |
| EMOTIONAL_REGULATION | confidence_stability |
| ANXIETY | confidence_stability |
| MENTAL_HEALTH | confidence_stability |
| STRESS_MANAGEMENT | confidence_stability, exam_readiness |
| CRITICAL_THINKING | decision_quality, learning_effectiveness |
| IMPULSE_CONTROL | decision_quality |
| INTRINSIC_MOTIVATION | decision_quality |
| EXECUTIVE_FUNCTION | decision_quality, learning_effectiveness |
| HABIT_FORMATION | decision_quality |
| COMMUNICATION | employability_readiness |
| CREATIVITY | employability_readiness |
| EXAM_READINESS | exam_readiness ⚠️ |
| EXAM_PERFORMANCE | exam_readiness ⚠️ |
| ACADEMIC_RECOVERY | exam_readiness, learning_effectiveness |
| LEARNING_APPROACH | learning_effectiveness |
| LEARNING_DRIVE | learning_effectiveness |
| WORKING_MEMORY | learning_effectiveness |
| PROCESSING_SPEED | learning_effectiveness |
| ATTENTION_REGULATION | learning_effectiveness |

⚠️ **Corpus-pending-only risk:** `EXAM_READINESS` and `EXAM_PERFORMANCE` belong only to
`exam_readiness`, whose only non-fallback route is `competitive_exam` —
**`corpus_status = corpus_pending`**. These two constructs are technically "covered" but
their sole real product route is not yet serviceable; absent the exam route they degrade
to the Mentoring fallback. Per business constraint (b) this is *allowed* (exam pathways
supported under CORPUS_PENDING), but it is a single point of fragility worth noting.

---

## 2. Orphan Construct Report

### 2a. Orphan constructs — in the registry but in NO outcome model (8)

| Construct | Cluster | Concern entries mapped to it | Net effect |
|---|---|---|---|
| **FAMILY_DYNAMICS** | Family & Environment | 15 | No model, no route → fallback (see §5) |
| **CAREER_GROWTH** | Career | 15 | No model → fallback |
| **PHYSICAL_WELLBEING** | Mental Wellbeing | 7 | No model → fallback |
| **DIGITAL_DEPENDENCY** | Digital | 6 | No model → fallback |
| **PEER_RELATIONS** | Social | 5 | No model → fallback |
| **DIGITAL_DISCIPLINE** | Digital | 5 | No model → fallback |
| **PROCRASTINATION** | Self-Regulation | 4 | No model → fallback |
| **SAFETY_THREATS** | Social | 3 | No model → fallback |

**8 / 33 constructs (24.2%) are orphans.** They account for **60 / 177 (33.9%)** of all
concern→construct mappings — i.e. roughly a third of authored concern coverage cannot
activate any outcome model and is routed to Mentoring (degraded).

### 2b. Phantom model keys — referenced by models but NOT in the canonical registry (3)

| Key | Referenced by model | Issue |
|---|---|---|
| **CAREER_READINESS** | career_clarity, employability_readiness | Not a registered construct; closest registry entry is `CAREER_CLARITY`/`SKILL_AWARENESS` |
| **COLLEGE_ADAPT** | career_clarity | Not a registered construct |
| **EXAM_STRESS** | exam_readiness | Not a registered construct; closest are `EXAM_READINESS`/`STRESS_MANAGEMENT` |

These keys can never match a canonicalized runtime construct (`canonicalizeConstructKey`
returns `null` for non-registry keys), so they contribute **dead affinity** inside the
models. Honest finding — not fabricated, not patched.

### 2c. Orphan Outcome Models — **0**

Every one of the 6 models is referenced by ≥1 route **and** by ≥1 non-fallback route:

| Model | Real routes (non-fallback) | Fallback |
|---|---|---|
| career_clarity | career_builder (.90), lbi (.30), employability_index (.50) | mentoring (.40) |
| confidence_stability | lbi (.85), employability_index (.30), competitive_exam (.30) | mentoring (.60) |
| decision_quality | career_builder (.50), lbi (.75) | mentoring (.40) |
| employability_readiness | career_builder (.70), employability_index (.90) | mentoring (.40) |
| exam_readiness | competitive_exam (.90, **corpus_pending**) | mentoring (.40) |
| learning_effectiveness | career_builder (.40), lbi (.30), competitive_exam (.70) | mentoring (.40) |

→ **Orphan Outcome Models = 0. Model→route coverage = 100%.**

---

## 3. Product Mapping Matrix

### 3a. Model × Route affinity matrix (weights from `wc3_journey_routes.model_affinities`)

| Model \ Route | mentoring (fallback) | career_builder | lbi | employability_index | competitive_exam (pending) |
|---|---|---|---|---|---|
| career_clarity | 0.40 | **0.90** | 0.30 | 0.50 | — |
| confidence_stability | 0.60 | — | **0.85** | 0.30 | 0.30 |
| decision_quality | 0.40 | 0.50 | **0.75** | — | — |
| employability_readiness | 0.40 | 0.70 | — | **0.90** | — |
| exam_readiness | 0.40 | — | — | — | **0.90** |
| learning_effectiveness | 0.40 | 0.40 | 0.30 | — | **0.70** |

(Bold = each model's strongest real route.)

### 3b. Route → product mapping (all 5 mapped → 100%)

| route_key | product_key | product_label | product_path | corpus_status | fallback | priority |
|---|---|---|---|---|---|---|
| mentoring | mentoring | Mentoring | /mentors | ready | **yes** | 0 |
| career_builder | career_builder | Career Builder | /career-builder | ready | no | 20 |
| lbi | lbi | LBI Behavioural Intelligence | /lbi | ready | no | 30 |
| employability_index | employability_index | Employability Index | /employability-index | ready | no | 40 |
| competitive_exam | competitive_exam | Competitive Exam Intelligence | /exam-intelligence | **corpus_pending** | no | 50 |

### 3c. Coverage gaps visible in the matrix

- **No route serves the Family/Parenting domain** → `FAMILY_DYNAMICS` is unreachable (§5).
- **No route serves Wellbeing/Digital/Habits domains** → `PHYSICAL_WELLBEING`,
  `DIGITAL_DEPENDENCY`, `DIGITAL_DISCIPLINE`, `PROCRASTINATION`, `PEER_RELATIONS`,
  `SAFETY_THREATS`, `CAREER_GROWTH` have no model and thus no column above.
- **`exam_readiness` has exactly one real column** and it is `corpus_pending`.

---

## 4. Journey Coverage Score

Composite of the four chain stages (defined heuristic — simple mean of the components):

| Component | Score | Meaning |
|---|---|---|
| Construct → model coverage | 75.8% | 25 / 33 constructs in a model |
| Model → route coverage | 100% | 6 / 6 models reach a real route |
| Route → product mapping | 100% | 5 / 5 routes mapped |
| Concern → covered-construct | 66.1% | 117 / 177 concern entries reach a model |
| **Journey Coverage Score** | **85.5%** | mean of the above |

**Interpretation:** the *plumbing* downstream of an activated model is complete
(models and routes are 100% mapped and every concern terminates with a route per
constraint (a)). The coverage loss is entirely **upstream**: ~1 in 4 constructs and ~1 in
3 authored concern mappings never reach an outcome model, so they always degrade to the
Mentoring fallback. The score is gated by construct/concern coverage, not by routing.

---

## 5. FAMILY_DYNAMICS coverage gap (confirmed)

- `FAMILY_DYNAMICS` **is** a canonical construct (cluster *Family & Environment*) and is
  the target of **15** concern→construct entries (family communication breakdown,
  parent-child conflict, over-expectation, sibling comparison, lack of monitoring,
  emotional disconnect, over-dependence on tuition, confusion about child's ability, …).
- It is in **no outcome model** and there is **no Family/Parenting journey route**.
- **Result:** any session whose dominant concern is family-domain produces no model
  activation on that axis and is routed to **Mentoring (degraded)**. Combined with the
  Parent-persona misroute already fixed in `WC3_ACTIVATION_REPORT.md`, the family domain
  is the single largest unaddressed product gap.

## 6. Empty-spine coverage gap (confirmed — by design, plus a DEV-data observation)

- **By design:** when a session yields zero constructs (or only orphan constructs), no
  model activates → L3 returns the **Mentoring fallback with `degraded:true`**, satisfying
  constraint (a) "no concern may terminate without a route." This is correct, honest
  behaviour — not a defect.
- **DEV-data observation:** `behavioural_hypotheses` currently holds **0 rows**, so in the
  current DEV environment *every* session would hit the empty-spine path. This is an
  environment-data state (no runtime sessions seeded), **not** a catalog defect, and does
  not affect the catalog-level coverage figures above. Flagged so the empty-spine path is
  exercised against real spine data before any production read of these metrics.

---

## 7. Findings summary

| # | Finding | Severity | Count / Metric |
|---|---|---|---|
| 1 | Orphan constructs (no outcome model) | High | 8 / 33 (24.2%) |
| 2 | Orphan concern mappings (→ orphan construct) | High | 60 / 177 (33.9%) |
| 3 | Orphan outcome models | None | 0 |
| 4 | Fallback-only constructs | High | 8 (= the orphans) |
| 5 | FAMILY_DYNAMICS gap (no model, no route) | High | 15 concern entries stranded |
| 6 | Empty-spine fallback | Info / by-design | DEV: 0 spine rows → 100% empty-spine |
| 7 | Phantom model keys (not in registry) | Medium | 3 (CAREER_READINESS, COLLEGE_ADAPT, EXAM_STRESS) |
| 8 | Corpus-pending-only constructs | Medium | 2 (EXAM_READINESS, EXAM_PERFORMANCE) |
| 9 | Registry header count stale ("32" vs 33) | Low | doc-only |

### Headline metrics
- **Route Coverage:** 75.8% (constructs) · 66.1% (concern mappings)
- **Fallback Usage:** 24.2% of constructs are fallback-only
- **Product Mapping Coverage:** 100% (routes & models→routes)
- **Journey Coverage Score:** 85.5%

---

## 8. Candidate remediations (NOT implemented — for approval only)

These are options for discussion. None were applied; this audit changes no code, schema,
ontology, or catalog.

1. **Close the orphan-construct gap** by either (a) adding the 8 orphan constructs to
   appropriate existing models, and/or (b) introducing new outcome models + routes for
   the uncovered domains (Family/Parenting, Wellbeing/Habits, Digital, Peer/Social-safety,
   Career-growth/progression).
2. **Add a Family/Parenting journey route** (or fold `FAMILY_DYNAMICS` into an existing
   model with a parenting-oriented product) to close the largest single gap.
3. **Reconcile the 3 phantom model keys** with the registry (rename to canonical keys or
   register the missing constructs) so model affinities carry no dead keys.
4. **Promote `competitive_exam` corpus** (or add a second real route touching
   `exam_readiness`) so EXAM_* constructs are not single-route + corpus-pending.
5. **Fix the registry header comment** (32 → 33).
6. **Re-run these metrics against real spine data** once `behavioural_hypotheses` is
   populated, to validate the empty-spine path end-to-end.

**STOP — awaiting approval.**
