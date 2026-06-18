# WC-P1 — D5: Employability Scoring Readiness

**Coverage**: 65% | **Confidence**: 40%

---

## Engine Activity

| Metric | Value |
|---|---|
| `ei_calculation_logs` | 199 rows (engine is being called) |
| Active ruleset version | 1.0.0 (MetryxOne Default EI (Phase 2/3 parity)) |
| Ruleset total weight | 102 pts (should be 100; is 102 — OVERCOUNTED) |
| `ei_snapshot_versions` | 0 rows |
| `ei_weight_versions` | 2 rows |

---

## DB Ruleset Dimensions (live data)

| Dimension | Weight | Formula |
|---|---|---|
| `completeness` | 45.000 | `percent` |
| `technical` | 20.000 | `weighted_sum_skills` |
| `experience` | 15.000 | `count_linear` |
| `soft` | 10.000 | `count_linear` |
| `certifications` | 6.000 | `weighted_sum_certs` |
| `projects` | 6.000 | `count_linear` |
| `institution_bonus` | 0.000 | `evidence_only` |
| `qualification_bonus` | 0.000 | `evidence_only` |

---

## Formula Integrity Audit

### Three Divergent Schemas

| Schema | Source | Dimensions | Max |
|---|---|---|---|
| **Documentation** | `docs/EMPLOYABILITY_INDEX.md` | 8: Competency(25)+Exp(20)+Edu(15)+Tech(15)+Certs(10)+Soft(8)+Projects(4)+Completeness(3) | 100 |
| **Gauge Engine** | `employabilityEngine.ts` + DB ruleset | 6: Completeness(45)+Tech(20)+Exp(15)+Soft(10)+Certs(6)+Projects(6) | 102→99 |
| **Breakdown Modal** | `CareerBuilderPage.tsx ~line 967` | 8: matching documentation formula | 100 |

### Key Discrepancies

| Discrepancy | Impact |
|---|---|
| Competency Assessment (25pts) absent from gauge | User completing assessment sees +25pts in modal, 0pts in gauge headline score |
| Education dimension (15pts) absent from gauge | All education data ignored by gauge engine |
| Profile Completeness: 3pts (doc) → 45pts (gauge) | 15× inflation; completeness dominates the gauge unfairly |
| Band definitions: 3 schemas coexist | See Band Mismatch section below |
| Ruleset total: 102 not 100 | Overcounting by 2 pts (certs+projects each 1pt over) |

### Band Mismatch

| Schema | Bands |
|---|---|
| `docs/EMPLOYABILITY_INDEX.md` | Getting Started(0) / Building(25) / Career-Ready(50) / Hire-Ready(75) |
| `design-system/tokens.ts` (used by UI) | Starter(0) / Developing(35) / Good(50) / Excellent(80) |
| DB ruleset config | Starter(0) / Developing(35) / Good(50) / Strong(65) / Excellent(80) |

The UI renders band labels from `tokens.ts` (4 bands). The DB has 5 bands. The docs describe 4 different bands with different thresholds. These are three incompatible schemas.

---

## Reference Data Thinness

| Entity | Loaded | Planned | Resolver Effectiveness |
|---|---|---|---|
| Institutions | 67 | NIRF Top 200 + WHED 19,400+ | ~30–40% for Indian institutions; <5% for global |
| Qualifications | 26 | NSQF + EQF levels | Low coverage |
| Certifications | 42 | PMI/CFA/AWS/Azure etc. | Sparse (42 vs thousands) |
| Skills | 90 | ESCO 13,890 + O*NET | ~0.6% of target |
| Unresolved (queued) | 69 | — | 69 entities awaiting review |

---

## Actions to Reach 95%

1. **Unify the formula**: Align `employabilityEngine.ts`, CareerBuilderPage `eiBreakdown`, and DB ruleset to one 8-dim schema with Assessment(25), Experience(20), Education(15), Technical(15), Certs(10), Soft(8), Projects(4), Completeness(3).
2. **Unify band labels**: Choose one set of 4 bands (recommend doc labels) and propagate to `tokens.ts`, DB ruleset, and all copy.
3. **Seed reference data**: Load NIRF Top 200 institutions, top-50 certifications (AWS/Azure/PMP/CFA), ESCO skills core subset.
4. **Fix ruleset total**: Adjust certs+projects weights to sum to 100.
