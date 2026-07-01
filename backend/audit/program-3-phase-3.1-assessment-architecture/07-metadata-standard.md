# CAPADEX 3.0 · Program 3 · Phase 3.1 — Metadata Standard & Source Coverage (Axis 4)

> Deliverable 07 · Generated 2026-07-01T06:40:17.982Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:5aa01cf06010, written 2026-07-01T06:40:17.982Z).
> Honesty: the FIVE certification axes (architecture · lifecycle · governance · metadata · repository-alignment) are reported SEPARATELY and NEVER composited. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The canonical **18-field** assessment-metadata standard (13 required) + a per-source coverage crosswalk. A field only counts as "covered" when at least one source is VERIFIED present (null/absent sources do not inflate coverage).

**Union coverage:** 16/18 fields have ≥1 verified source. Uncovered (honest): family, norm_reference.

## The 18-field standard
| Field | Required | Description |
|---|---|---|
| `id` | required | Stable unique identifier. |
| `key` | required | Canonical machine key. |
| `label` | required | Human-readable name. |
| `type` | required | Canonical assessment type (10-type taxonomy). |
| `category` | required | Assessment category (Academic/Behavioural/Competency/…). |
| `family` | required | Assessment family (behavioural-signal | CAF competency). |
| `purpose` | required | Why the assessment exists. |
| `personas` | required | Target persona codes (P1–P9 / aggregate). |
| `lifecycle_state` | required | Current state in the 10-state lifecycle. |
| `lifecycle_stage` | optional | Subject journey stage (CAP_CUR→CAP_MAS). |
| `version` | required | Version / methodology version. |
| `scoring_method` | required | How it is scored (or non-scored placement). |
| `norm_reference` | optional | Norm basis (age band / none). |
| `benchmark_reference` | optional | Relative benchmark cohort (k≥k_min). |
| `governance_owner` | optional | Governing role/owner (honest-NULL if unassigned). |
| `status` | required | Coverage status (SUPPORTED/PARTIAL/…). |
| `evidence` | required | Reused services/routes/tables/frontend. |
| `published_at` | optional | Publish timestamp (null until Published). |

## Per-source coverage crosswalk
| Source | Present | Populates | Note |
|---|---|---|---|
| `config/assessment-framework.ts` | true | key, label, type, purpose, personas, lifecycle_stage, scoring_method, benchmark_reference, status, evidence | Frozen registry — richest metadata source; version/lifecycle_state derived at composition time. |
| `assessment_templates` | true | id, label, category, version | Template rows carry category + template version. |
| `exams` | true | id, label, lifecycle_state, published_at | status Draft/Published → lifecycle_state; published_at when Published. |
| `caf_assessments` | true | id, label, lifecycle_state, published_at, scoring_method | CAF authored assessments; status + published_at. |
| `methodology_versions` | false | version | Competency-graph runtime version source. |
| `services/governance/admin-lifecycle.ts` | true | governance_owner, lifecycle_state | Governance transitions; owner honest-NULL when unassigned. |
