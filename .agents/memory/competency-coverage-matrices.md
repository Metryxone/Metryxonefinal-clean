---
name: Competency Coverage Matrices (MX-100X Phase 3)
description: Read-only coverage matrices over the competency genome — type/domain/assessment/benchmark axes and their honesty traps.
---

# Competency Coverage Matrices

Purely read-only, flag-gated (`competencyCoverageMatrices`, default OFF) phase that surfaces three coverage matrices over the curated `onto_*` genome — Competency (structure), Assessment (linked questions), Benchmark (cohort data). No new schema, no POST, no DDL: every source table already exists, so GET-never-writes is trivially satisfied. Base route `/api/v2/competency-coverage-matrices/*`; gate order foundation → flag → auth (flag-OFF → 503 before auth/DB).

## Axes & their tables (all `onto_*` TEXT ids — no `ont_*` INTEGER coercion risk)
- **TYPE** axis = `onto_competency_type_map` (5 canonical types from `competency-type-classification.ts`). `future_skills` is legitimately 0 — surface it as an explicit gap row, never omit.
- **DOMAIN** axis = `onto_competencies.domain_id`, labels from `onto_domains.name`.
- **ASSESSMENT** = genome bridge `onto_competency_question_map` (competency_id TEXT → question uuid). The legacy `competency_question_templates` bank (`competency_code` = BANK domain codes COG/COM/LEA/…) is a **DISJOINT namespace** from the 419-competency genome — report it as separate "bank context", NEVER force-join it to the 5-type axis.
- **BENCHMARK** = `bench_competency_benchmarks` (competency_id TEXT, matches genome). k-suppression at `BENCHMARK_K_MIN=30`.

## Honesty traps that bit (and the fixes)
- **`onto_competencies` join column is `canonical_name`, NOT `name`.** Engine `linkedMeta` joined on `c.name` → silently degraded assessment `by_type`/`ready_list` to empty (no error, just wrong-empty). Any new join into the genome must use `canonical_name`.
- **Backend returns `domain_id` for ALL by_domain rows (competency/assessment/benchmark), not `id`.** Frontend row types must be `domain_id` or `key={...}` is undefined and React de-dupes rows.
- **`?? 0` in UI subtitles fabricates a measured 0 from a degraded null.** Use a null-preserving helper (`n()` → renders `—`) for counts; for array lengths guard `arr == null ? '—' : arr.length`.
- **`(arr ?? []).map` masks a degraded (null) source as a legitimately-empty table.** Distinguish: `null` source → render an explicit "not measurable (source unavailable)" row; `[]` → the real empty state (e.g. "no linked competencies", "no ready competencies"). They mean different things.

**Why:** the platform contract is Coverage (data exists) vs Confidence/readiness as SEPARATE axes, null=missing never fake 0. A silent degrade that reads as "0" or "empty" is indistinguishable from a real zero and quietly lies.
