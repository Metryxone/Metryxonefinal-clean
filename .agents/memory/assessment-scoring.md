---
name: Assessment Measurement & Scoring Engine (CAPADEX 3.0 3.5)
description: Flag-gated read/write scoring certification phase; mirror-of-3.4 traps and the formula-safety boundary.
---

# Assessment Measurement & Scoring Engine (Phase 3.5)

Flag `assessmentScoring` / `FF_ASSESSMENT_SCORING`, default OFF, byte-identical incl. schema (DDL runs ONLY on flag-gated write paths). ONE canonical scoring layer that COMPOSES the existing scoring services under one registry + an additive `as_*` overlay — NO duplicate/V2 scoring engine.

**Scope boundary (the honesty spine):** MEASUREMENT & SCORING ONLY (turn responses → measurable scores/indicators). Psychometrics — item difficulty/discrimination, reliability, validity, norms, standardization, benchmarking, AI-interpretation, reports — are **Phase 3.6 scope boundaries**, reported in-line on affected rows, **NOT gaps**. Adoption (real scored-assessment volume) is a SEPARATE usage axis, honest 0/low, NEVER a gap, never fabricated. 7 dimensions certified SEPARATELY, never composited.

**Why:** repeating the 3.3/3.4 discipline — a boundary or a usage axis dressed up as a "gap" is a false finding; compositing the 7 dims hides real weakness.

**How to apply (traps carried from 3.3/3.4, verified again here):**
- **Formula safety:** the formula framework uses a STRUCTURED AST — NO `eval` / `new Function`. Any formula-eval work must stay on the AST path.
- **public-config dual import-site trap:** `routes/capadex.ts` `/public-config` must IMPORT the `isAssessmentScoringEnabled` getter or the endpoint 500s (no tsc; tsx runtime only).
- **scan → generator ROW-SHAPE:** generator reads ONLY `scan.json` (sha256, EXPECTED-12 assert, `ready_for_phase_3_6` NOT `3_5`). Diff the registry row shape before reusing a prior generator; a renamed field silently corrupts the inventory. Drift-proof: gap/count prose derives from `scan.gap_total`/`GC[...]`, never hardcoded.
- **Reads must NOT ensureSchema:** DDL is write-path-only; a GET that ensure-schemas would create `as_*` tables while OFF and break byte-identical.
- **OFF smoke:** `/api/assessment-scoring/enabled` = 503 (flag-gate before auth); `/api/admin/assessment-scoring/*` = 401 (global `/api/admin` gate); public-config `assessment_scoring:false`.
- Re-run scan THEN generator AFTER any config/engine/panel change so committed docs never contradict the code.
