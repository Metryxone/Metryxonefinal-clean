# Phase 5.2 — Job Architecture Engine · Reconciliation Audit

**Date:** 2026-06-20
**Contract:** additive · flag-gated · compose-never-recompute · honesty-first · never fabricate/duplicate · STOP for approval before merge/deploy.

## Verdict

**The Job Architecture capability already exists — at large scale, across many tables, in
DISJOINT id namespaces.** The three named deliverables (`job_architecture`, `job_templates`,
`job_role_framework`) did **not** exist physically (the only references were inside the
Phase-5 talent-intelligence aggregator, which probes for them and honestly reports them
absent). Two items are genuine gaps: `job_templates` and a distinct **Job Category**
dimension.

**Resolution applied:** expose `job_architecture` and `job_role_framework` as read-only
compatibility VIEWS over the **most-populated** canonical spine each; build `job_templates`
as a thin additive REAL table (genuine gap). Migration:
`backend/migrations/20260620_phase51_52_canonical_foundation.sql`.

## Competing spines (key architectural finding)

There is **no single canonical role/family graph**. Multiple ontologies coexist and their
ids do not interoperate — joining them would fabricate relationships:

| Spine | Family table | Role table | Competency table | Populated? |
|---|---|---|---|---|
| Career Graph (`cg_*`) | `function_area` col | `cg_roles` (200) | — | ✅ richest role data |
| Curated ontology (`onto_*`) | `onto_role_families` (4) | `onto_roles` (5) | `onto_role_competency_profiles` (14) | ✅ only populated competency profiles |
| O*NET ontology (`ont_*`) | `ont_role_families` (0) | `ont_roles` (0) | `map_role_competency` (0) | ✗ empty in dev |
| Employability KG | `role_families` (10, uuid) | `role_catalog` (0) | `role_competency_weights` (0) | partial |
| Global ontology (`gro_*`) | `gro_role_families` (0) | `gro_canonical_roles` | `gro_role_competency_expectations` | ✗ empty |

## Requested → Existing mapping

| Requested | Canonical source chosen | Rows | Delivered as |
|---|---|---|---|
| **Job Family** | `cg_roles.function_area` (populated spine) | 200 roles | field in VIEW `job_architecture` |
| **Job Category** | *no distinct dimension exists* → aliased to `function_area` | — | **GAP (disclosed)** |
| **Job Role** | `cg_roles` | 200 | VIEW `job_architecture` |
| **Job Levels** | `cg_roles.seniority` (also `gro_role_layers` 5, `gro_role_hierarchy` 6) | 200 | field in VIEW `job_architecture` |
| **Job Competency Profiles** | `onto_role_competency_profiles` | 14 | VIEW `job_role_framework` |
| **Job Templates** | *no source table* | — | **GAP → new table `job_templates`** |
| **Job Posting** (structure tail) | `job_postings` (28 cols) / `employer_jobs` (23 cols) | 0 | exists |

## Structure (Role → Competency Profile → Job Profile → Job Posting)

- **Role** → `job_architecture` (cg_roles, 200) ✅
- **Competency Profile** → `job_role_framework` (onto_role_competency_profiles, 14) ✅
  — ⚠️ role_id here is the `onto_*` namespace, **not** cg_roles. The two are **not**
  joined (disjoint ids); a future task must establish a deliberate crosswalk if a unified
  Role→Competency link is required. This is an honest gap, not fabricated.
- **Job Profile** → `job_templates` (new) + `employer_jobs` ✅ (thin)
- **Job Posting** → `job_postings` / `employer_jobs` (live schema, 0 rows) ✅

## Honesty notes

- **Job Category = Job Family in the populated data.** No independent category taxonomy
  exists; `job_architecture.job_category` is aliased from `function_area` and flagged here
  rather than inventing a category tree.
- **Cross-namespace joins refused.** `job_architecture` (cg_*) and `job_role_framework`
  (onto_*) are surfaced separately because their ids do not match. Forcing a join would
  fabricate a Role↔Competency relationship.
- **Reversibility.** Two views (`DROP VIEW`) + one additive empty table
  (`DROP TABLE job_templates`).

## Genuine gaps (carried forward)

1. **`job_templates`** — built as a thin additive table (employer-scoped, soft `role_key`
   pointer, no cross-namespace FK). Currently 0 rows; no fabricated seed.
2. **Job Category dimension** — no source; would require a real taxonomy decision.
3. **Role ↔ Competency crosswalk** — cg_* roles and onto_* competency profiles are
   disjoint; a unified link needs a deliberate mapping, not a guess.
