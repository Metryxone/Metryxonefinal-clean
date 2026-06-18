# WC-3 — Updated Route Coverage Report (post-remediation)

This supersedes the headline metrics of `WC3_ROUTE_COVERAGE_AUDIT.md` after the
approved remediation (Family domain + phantom-key reconciliation + metadata fixes).
The original audit is retained as the pre-remediation baseline. All changes are
additive, flag-gated (`FF_WC3_OUTCOME` / `FF_WC3_JOURNEY`), and byte-identical when OFF.

Companion reports: `WC3_FAMILY_REMEDIATION.md` · `WC3_PHANTOM_KEY_RECONCILIATION.md` ·
`WC3_ORPHAN_CONSTRUCT_CLASSIFICATION.md`.

## 1. What changed
| Change | Before | After |
|---|---|---|
| Outcome models | 6 | **7** (+`family_wellbeing`) |
| Journey routes | 5 | **6** (+`family_support` → Mentoring `/mentors`) |
| Registry constructs | 33 (header wrongly said 32) | **36** (+`CAREER_READINESS`, `COLLEGE_ADAPT`, `EXAM_STRESS`) |
| Phantom model keys | 3 | **0** (reconciled by registration) |
| Orphan constructs | 8 | **7** (`FAMILY_DYNAMICS` covered) |

## 2. Updated coverage metrics
| Metric | Before | After |
|---|---|---|
| Construct route coverage | 75.8% (25/33) | **80.6% (29/36)** |
| Concern route coverage | 66.1% (117/177) | **74.6% (132/177)** |
| Fallback-only constructs | 24.2% (8/33) | **19.4% (7/36)** |
| Orphan outcome models | 0 | **0** |
| Product mapping coverage | 100% | **100% (6/6)** |

> Note: the construct denominator rose from 33→36 because the 3 reconciled keys are now
> registry constructs. All 3 are immediately *covered* (each sits in ≥1 model), so
> coverage rises despite the larger denominator.

## 3. Journey Coverage Score (same formula as audit §4 — simple mean)
| Component | Before | After |
|---|---|---|
| Construct → model coverage | 75.8% | **80.6%** (29/36) |
| Model → route coverage | 100% | **100%** (7/7 models reach a real route) |
| Route → product mapping | 100% | **100%** (6/6 routes mapped) |
| Concern → covered-construct | 66.1% | **74.6%** (132/177) |
| **Journey Coverage Score** | **85.5%** | **88.8%** |

## 4. Remaining orphan constructs (7)
Full dispositions in `WC3_ORPHAN_CONSTRUCT_CLASSIFICATION.md`. Concern mappings still
stranded: **45 / 177 (25.4%)**, distributed as:

| Construct | Concern mappings | Interventions | Disposition |
|---|---|---|---|
| `CAREER_GROWTH` | 15 | **0 (ungrounded)** | future model — blocked on intervention authoring |
| `PHYSICAL_WELLBEING` | 7 | 2 | future model (Mentoring product exists) |
| `DIGITAL_DEPENDENCY` | 6 | 4 | future model + future product (deferred) |
| `PEER_RELATIONS` | 5 | 4 | reconcile → `confidence_stability` |
| `DIGITAL_DISCIPLINE` | 5 | 2 | future model + future product (deferred) |
| `PROCRASTINATION` | 4 | 6 | reconcile → `decision_quality` |
| `SAFETY_THREATS` | 3 | 4 | future model (safeguarding; Mentoring product exists) |

## 5. Findings status vs audit §7
| # | Audit finding | Status |
|---|---|---|
| 1 | Orphan constructs 8/33 | **Reduced to 7/36** (family closed; 2 reconcilable, 1 blocked, 4 future) |
| 2 | Orphan concern mappings 60/177 | **Reduced to 45/177** (family's 15 covered) |
| 3 | Orphan outcome models 0 | Unchanged (0) |
| 5 | FAMILY_DYNAMICS gap | **Closed** (`family_wellbeing` + `family_support`) |
| 7 | Phantom model keys (3) | **Closed** (registered → 0) |
| 9 | Registry header "32" stale | **Fixed** (→ 36, with grounding note) |
| 6 | Empty-spine (DEV: 0 spine rows) | Unchanged — environment-data state; re-run vs real spine data |
| 8 | Corpus-pending-only EXAM_* | Unchanged — **out of approved scope** (no new exam route created) |

## 6. Scope honesty
Per the approved narrowed scope, **no new routes/products were created** for Wellbeing,
Digital, Career-Growth or other orphan domains (no destination exists). `CAREER_GROWTH`
remains the highest-value future target (largest block) but is **blocked** until real
interventions exist — actions are never fabricated.

**STOP — awaiting approval.**
