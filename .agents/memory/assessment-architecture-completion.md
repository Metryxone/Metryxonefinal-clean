---
name: Assessment Architecture Completion (CAPADEX 3.0 Program 3 · Phase 3.1)
description: Flag assessmentArchitectureCompletion — how the 9 AP-* architecture gaps were engineering-closed additively without fabricating norm/benchmark data.
---

# Assessment Architecture Completion (Phase 3.1)

Flag `assessmentArchitectureCompletion` / `FF_ASSESSMENT_ARCHITECTURE_COMPLETION`, default OFF, byte-identical OFF **including schema**. Closes 9 architecture gaps AP-1..AP-9 over the frozen assessment architecture. "100% closure" here = **built + computes from REAL substrate + abstains via k_min when data is insufficient** — NEVER fabricated norms/benchmarks.

## The honesty rule that shaped every norm/benchmark path
Group norms (`computeGroupNorms`) compute REAL population norms ONLY when the source dimension column exists AND k≥30; otherwise they **abstain with an explicit reason** (`dimension_source_absent`) — they never invent a distribution. Gender norms are additionally **ethics-gated** behind `ASSESSMENT_GENDER_NORMS_ENABLED` (owner/legal decision) → default abstains `ethics_gated_off`. Country benchmarks widen the `bench_cohorts` `cohort_type` CHECK to add `'country'` **only on the flag-gated write path**; registered rows are scaffolds, norms still gated by the same k_min. Bloom classification of the behavioural clarity bank is honest `total:0` when the bank is empty (dev) — that is the ADOPTION axis, not a gap.

## Byte-identical-OFF forced these shapes
- Own additive tables only (`assessment_group_norms`, `capadex_clarity_bloom`); the `bench_cohorts` CHECK widening runs ONLY when a flag-gated write endpoint is hit.
- Routes gate flag→auth→superadmin: 503 when OFF, 401 at the global `/api/admin` gate.
- **public-config is a dual import-site trap** (same as prior CAPADEX phases): the getter must be imported into `routes/capadex.ts` `/public-config` or the endpoint 500s (no tsc here). Key `assessment_architecture_completion`.

## Frontend foundations (AP-2 offline, AP-3 accessibility) — keep OFF truly byte-identical
- Do NOT add manifest/theme-color to static `index.html` — inject them inside the flag-gated `initOfflineDelivery()` so OFF `index.html` is unchanged. The ONLY accepted OFF-path delta is a single startup `/api/capadex/public-config` fetch (the standard flag-detection pattern already used across the app).
- `lib/accessibility.ts` (skip-link, ARIA live-region + `announce()`, focus-visible, focus-trap) and `lib/offline.ts` (SW register + localStorage idempotent response queue) are INERT until `initAccessibility()`/`initOfflineDelivery()` are called, which happens only when the flag is ON.
- WIRE the foundations, don't just ship scaffolds: `FreeAssessmentModal` announces each `phase` change (flag-gated) and enqueues the `/api/capadex/concern/analyze` payload in the catch path when `navigator.onLine===false` (idempotent `client_key`, replays on reconnect). When hoisting a body used in the catch (e.g. `analyzeBody`), declare it `let` BEFORE the `try` or it's out of scope.
- **Adoption ≠ engineering**: real offline sessions + screen-reader/axe verification need a real browser (not available here) — report on their own axes, never as a gap.

## Verification without a build
Backend paths verified by a one-off tsx smoke script calling the engine directly (flag not needed for direct calls; routes enforce it). Frontend verified by esbuild single-file parse (Vite build is pathologically slow) + HMR health in the running workflow. Coverage⟂Confidence⟂Adoption never composited; null≠0.
