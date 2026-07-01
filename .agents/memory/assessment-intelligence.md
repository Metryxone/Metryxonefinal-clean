---
name: Assessment Intelligence / Interpretation & Reporting (CAPADEX 3.0 3.7)
description: Durable lessons for the assessmentIntelligence phase — interpretation & reporting certification layer composing existing interpretation engines; scope/field/deliverable traps vs prior phases.
---

# Assessment Intelligence / Interpretation & Reporting (CAPADEX 3.0 · Program 3 · Phase 3.7)

Flag `assessmentIntelligence` / `FF_ASSESSMENT_INTELLIGENCE` (default OFF, byte-identical incl. schema). READ-ONLY certification + reuse-before-build mechanisms mirroring 3.1–3.6. Detail in `docs/ASSESSMENT_INTELLIGENCE.md`.

## Scope is INTERPRETATION of a scored result, NOT scoring or validation
The defining boundary (AINT-D2): this layer turns a SCORED + VALIDATED result (3.5 Scoring + 3.6 Science) into MEANING — norm-referencing · standardization · benchmarking · AI-interpretation · report intelligence · candidate performance. It NEVER re-scores and NEVER re-validates the instrument. 3.6 is the mirror-image boundary (instrument quality, never interprets a candidate); 3.7 is the downstream consumer. Realized outcomes & KPI roll-up are the further-downstream Outcome/KPI scope — don't fold them in here.

**Why:** the phase composes engines that CAN score/validate; keeping the seam interpretation-only is what lets 3.5/3.6/3.7 stack without a rewrite.

## Eight dimensions, NO ux (unlike 3.6)
3.7 axes = `norms · standardization · benchmarking · ai_interpretation · report_intelligence · candidate_performance · frontend · apis`. 3.6 had a separate `ux` dimension; 3.7 does NOT — the workbench's ABSTAIN/empty/loading/error behaviour is folded into `frontend`. Deliverables 02–09 map one-per-dimension (6 capability + frontend + apis), then 10 repo / 11 gaps / 12 adoption / 13 cert = 13 total.

## Summary field name differs from 3.6
3.6's summary has `ready_for_phase_3_7`. **3.7 has NO `ready_for_phase_3_7`** (3.7 IS the interpretation phase) — it exposes `ready_for_certification{ready,verdict,note}` + `enterprise_ready{verdict,note}`. There is also NO `loop_closure` field. The generator reads `ready_for_certification` / `enterprise_ready` — copying 3.6's generator verbatim would reference a missing field.

**How to apply:** when cloning a prior-phase generator, diff the ROW SHAPE and the summary field names against the new engine's `composeSummary` return before running — a renamed/removed field silently corrupts the deliverable.

## k_min ABSTAIN is the honesty spine
`AINT_K_MIN=30`. Norm-referenced statistics + benchmarks ABSTAIN below k_min real members in the reference group; AI narrative/interpretation confidence stays honest-null while cold-start/uncalibrated. null (unknown) ≠ 0 (absent) — enforced in the `readScalar`/`readRows` helpers (null on error). Never fabricate a percentile/benchmark/confidence on thin data.

## Reuse-before-build: 6 gaps engineering-closed, adoption reported separately
`AINT_GAPS=[]` (0 OPEN) + `RESOLVED_AINT_GAPS`=6 (GAP-AINT-1..6, 3 High · 3 Medium). Each closed by a pure compute mechanism reusing an EXISTING engine + an additive `aint_*` overlay table — NO duplicate interpretation/benchmark/narrative/report engine, NO V2. Engineering closure ⟂ Adoption: the mechanism EXISTS but real interpreted/benchmarked/reported VOLUME is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap. PARTIAL catalog entries (age/national/custom norms, NCE/scaled scores, institution/national benchmarks, interpretation confidence, next-steps plans, consistency/timing) are data-availability / first-class-objective boundaries, NOT gaps.

## DDL only on flag-gated write paths (byte-identical OFF incl. schema)
The 7 `aint_*` overlay tables are created ONLY by the mechanism/overlay POST write paths (ensure-schema behind `assertEnabled()`). Cert GETs are read-only (`to_regclass`/fs probes); pure computes are side-effect-free unless `persist=true`. OFF → 0 `aint_*` tables. Verified OFF contract: `/enabled` **503** (flag-gate before auth), `/api/admin/assessment-intelligence/*` **401** (global `/api/admin` gate), public-config `assessment_intelligence:false`, 0 tables. OFF smoke ∈ {401, 403, 503}.

## public-config is a dual import-site 500-trap
`routes/capadex.ts` `/public-config` must BOTH import `isAssessmentIntelligenceEnabled` AND add the `assessment_intelligence` key. Missing the import → the endpoint 500s (no tsc here to catch it). After wiring routes + public-config, **restart the Backend API workflow** or `/enabled` 404s and public-config lacks the key (running process is stale).

## SSoT scan → generator (drift-proof)
`scripts/capadex-3.7-assessment-intelligence-scan.ts` → `audit/capadex-3.7-assessment-intelligence/scan.json` (SCAN_HASH sha256; embeds full registry + all catalog status_counts). Generator reads ONLY scan.json → 13 deliverables, asserts EXACTLY 13 by name. Docs can never drift from the measurement. Run scan first (with `FF_ASSESSMENT_INTELLIGENCE=1` inline for the process), then the generator, from inside `backend/`.

## Frontend verify caveat
esbuild parse of `AssessmentIntelligencePanel.tsx` + `InterpretationWorkbench.tsx` passes, but esbuild/tsc do NOT catch undefined module-level identifiers — those crash only at browser render (see superadmin-tab-render-verification). If enabling for a live browser check, revert the flag OFF afterward (STOP-for-approval: dev verify only, no merge/enable/deploy).
