# WC-C7 · Deliverable 6 — Readiness Report

**Date:** 2026-06-10T09:23:04.546Z
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Measure stage-to-product and outcome-to-product mapping fidelity, and aggregate all 6 readiness metrics.

---

## Stage-to-Product Mapping

### B2C ladder (subscription-engine)
The `subscription-engine.ts` maps CAPADEX canonical stage → next B2C ladder rung:

| Canonical stage | Maps to | SKU code | Price |
|---|---|---|---|
| Awareness / Curiosity (default) | Insight | CAP_INS | ₹499 |
| Clarity / Growth | Growth | CAP_GRW | ₹999 |
| Mastery | Mastery | CAP_MAS | ₹1,999 |

**Fidelity: 3/3 stage→rung mappings real and correct.** The engine reads `stageFloorIndex()` to pin the floor rung, then finds the next unpurchased rung.

### Packages (absent)
No field in `subscription_packages` maps to a CAPADEX stage. Stage→package mapping **does not exist**.

---

## Outcome-to-Product Mapping (journey routes catalog)

The `wc3_journey_routes` table is the platform's outcome→product mapping layer. Each route resolves to a product path that the session is directed to.

| Route key | Product label | Product path | Status |
|---|---|---|---|
| career_builder | Career Builder | /career-builder | real |
| competitive_exam | Competitive Exam Intelligence | /exam-intelligence | ⚠ STUB |
| employability_index | Employability Index | /employability-index | ⚠ STUB |
| family_support | Mentoring | /mentors | real |
| lbi | LBI Behavioural Intelligence | /lbi | real |
| mentoring | Mentoring | /mentors | real |

### Fidelity analysis
| Metric | Value |
|---|---|
| Total routes defined | 6 |
| Routes to real products | 4 |
| Routes to stub products | 2 |
| Route coverage (real targets) | 66.7% |
| Sessions routed to real product | 8 / 9 |
| Sessions routed to stub product | 1 / 9 |

**2/6 journey routes point to stub products** (competitive_exam → /exam-intelligence, employability_index → /employability-index). These are correctly guarded by the offer-engine's stub guard — no commercial recommendation fires for these routes.

---

## 6 Metrics Summary

### 1. Upsell Readiness
| Axis | Score |
|---|---|
| Structural (capabilities) | 5/7 = 71.4% |
| Structural (trigger taxonomy) | 1/3 triggers built = 33% (2 deliberately not built) |
| Activation | **not_measurable** (0 paid identities; requires prior purchase) |

### 2. Expansion Readiness
| Path | Structural | Activation |
|---|---|---|
| B2C ladder upsell (CAP_INS → GRW → MAS) | ✓ real | ✗ (no_paid_identities) |
| Package subscription renewal | ✓ real | ✗ (no_subscriptions) |
| B2C ladder ↔ package cross-sell | ✗ absent | ✗ (identity_bridge_absent) |
| Package → package upgrade | ✗ absent | ✗ (upgrade_path_not_defined) |
| **Total** | **2/4** = **50%** structural | **0/4** = **0%** activation |

### 3. Upgrade Coverage
| Layer | Coverage |
|---|---|
| Completed sessions / all sessions | 9/27 = 33.3% |
| Routed sessions / completed | 9/9 = 100% |
| Routed to non-stub product | 8/9 = 88.9% |

### 4. Upgrade Confidence *(two separate labels — never blended)*
| Layer | High-confidence (≥0.7) | Total | Rate |
|---|---|---|---|
| Journey route confidence | 2 | 9 | **22.2%** |
| Outcome confidence | 6 | 14 | **42.9%** |

⚠ Fallback disclosure: 6/9 sessions at confidence 0.2 (mentoring deterministic fallback). This is correct engine behaviour, not a failure.

### 5. Cross-SKU Readiness
| Axis | Score |
|---|---|
| Structural | 0/1 = **ABSENT** |
| Activation | **not_applicable** |

Identity bridge between B2C ladder (email-keyed) and packages (child-keyed) does not exist.

### 6. Revenue Expansion Readiness
| Sub-fact | Score |
|---|---|
| Paid conversion rate | 0/6 = **0%** (measurable) |
| Forecastable revenue series | 0/4 = **0%** (measurable) |
| Renewal eligibility | 0/0 = **not_measurable** (0 subscriptions) |
