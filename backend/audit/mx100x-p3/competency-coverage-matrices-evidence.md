# MX-100X Phase 3 — Competency Coverage Matrices Evidence

- Engine version: `mx100x-p3-1.0.0`
- Generated: 2026-06-23T18:13:20.880Z
- Honesty: read-only. Coverage (data exists) and readiness/k-anonymity are SEPARATE axes. Sparse/empty cells and authoring gaps are honest, never fabricated. Genome ids are `onto_*` TEXT (no coercion). The assessment BANK (`competency_question_templates.competency_code`) is a DISJOINT namespace — reported separately, never force-joined to the 5-type axis.

## 1. Competency coverage

Total competencies: **419** · classified: **419** · coverage: **100%**

### By type

| Type | Count | % of genome |
| --- | --- | --- |
| Behavioral | 199 | 47.5% |
| Cognitive | 99 | 23.6% |
| Functional | 103 | 24.6% |
| Technical | 18 | 4.3% |
| Future Skills | 0 | 0% |

### By domain

| Domain | Count | % of genome |
| --- | --- | --- |
| Cognitive Capabilities | 46 | 11% |
| Behavioral Capabilities | 77 | 18.4% |
| Interpersonal & Leadership Capabilities | 85 | 20.3% |
| Functional & Execution Capabilities | 44 | 10.5% |
| Strategic & Organizational Capabilities | 47 | 11.2% |
| O*NET Content Model | 120 | 28.6% |

## 2. Assessment coverage (genome bridge)

Genome total: **419** · with ≥1 approved question: **7** (1.7%) · assessment-ready (≥4 approved): **2** (0.5%)

### Approved-question distribution

| At least N approved | Competencies |
| --- | --- |
| ≥1 | 7 |
| ≥2 | 7 |
| ≥3 | 7 |
| ≥4 | 2 |

### By type (with ≥1 approved Q / total)

| Type | With approved Q | Total | Coverage | Assessment-ready |
| --- | --- | --- | --- | --- |
| Behavioral | 6 | 199 | 3% | 1 |
| Cognitive | 1 | 99 | 1% | 1 |
| Functional | 0 | 103 | 0% | 0 |
| Technical | 0 | 18 | 0% | 0 |
| Future Skills | 0 | — | — | 0 |

### Assessment-ready / linked competencies

| Competency | Type | Domain | Approved Q |
| --- | --- | --- | --- |
| Stakeholder Management | behavioral | dom_interpersonal | 4 |
| Agile Collaboration | cognitive | dom_strategic | 4 |
| Adaptability | behavioral | dom_behavioral | 3 |
| Active Listening | behavioral | dom_interpersonal | 3 |
| Ambiguity Tolerance | behavioral | dom_behavioral | 3 |
| Accountability | behavioral | dom_behavioral | 3 |
| Personal Resilience | behavioral | dom_behavioral | 3 |

### Bank context (DISJOINT namespace — not joined to genome)

- Distinct bank codes: **14** · total templates: **74**
  - approved: 43
  - draft: 31
- competency_question_templates.competency_code is the assessment BANK domain code (COG/COM/LEA/EXE/ADP/TEC/EIQ…) — a DISJOINT namespace from the 419-competency genome. Shown as context only; NEVER force-joined to the 5-type axis. Genome assessment coverage above is via onto_competency_question_map only.

## 3. Benchmark coverage (k_min=30)

Genome total: **419** · with a k-cleared benchmark: **13** (3.1%) · benchmark rows: 195 across 15 cohorts · suppressed below k: 0 · orphan ids: 0

### By type (k-cleared / total)

| Type | Benchmarked | Total | Coverage |
| --- | --- | --- | --- |
| Behavioral | 10 | 199 | 5% |
| Cognitive | 3 | 99 | 3% |
| Functional | 0 | 103 | 0% |
| Technical | 0 | 18 | 0% |
| Future Skills | 0 | — | — |

### By domain (k-cleared / total)

| Domain | Benchmarked | Total | Coverage |
| --- | --- | --- | --- |
| Behavioral Capabilities | 3 | 77 | 3.9% |
| Cognitive Capabilities | 2 | 46 | 4.3% |
| Functional & Execution Capabilities | 0 | 44 | 0% |
| Interpersonal & Leadership Capabilities | 6 | 85 | 7.1% |
| O*NET Content Model | 0 | 120 | 0% |
| Strategic & Organizational Capabilities | 2 | 47 | 4.3% |

## Findings

- **[info] competency** — Type "Technical" is sparse (18/419).
- **[gap] competency** — Type "Future Skills" has 0 classified competencies — honest content gap, not fabricated.
- **[gap] assessment** — 7/419 genome competencies have approved questions (1.7%); 2 are assessment-ready at ≥4 questions. The remainder is an authoring gap (out of scope this phase).
- **[gap] benchmark** — 13/419 genome competencies have a k-cleared benchmark (3.1%, k_min=30).
