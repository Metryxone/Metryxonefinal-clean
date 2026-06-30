---
name: Progression Engine Completion (progressionEngineCompletion)
description: CAPADEX 3.0 Phase 1.5 — the canonical continuous-growth loop; reuse-before-build composer mirroring 1.3/1.4, four-axis honesty, zero-DDL flag gate.
---

# Progression Engine / Continuous Growth (CAPADEX 3.0 Phase 1.5)

Flag `progressionEngineCompletion` / `FF_PROGRESSION_ENGINE_COMPLETION`, public-config
`progression_engine_completion`. Default OFF, byte-identical incl. schema — **ZERO DDL** (this phase
has no migration; it COMPOSES existing substrate, so OFF creates no tables by construction).

## Shape (mirrors 1.3 Assessment Framework + 1.4 Customer Journey EXACTLY)
- `config/progression-model.ts` — FROZEN pure-data registry (15-step spine, 4 loop-closure invariants,
  4 lifecycle promotion rules, 9 per-persona PROGRESSION_MODEL paths, 8 axes, PROGRESSION_DECISIONS,
  PROGRESSION_GAPS + RESOLVED_PROGRESSION_GAPS). Every entry `reuses`/`evidence` REFERENCES an EXISTING
  file/table by name — verified by the scan, never invented.
- `services/progression-engine.ts` — read-only composer: `composeCoverage` (verify evidence vs live
  FS+DB), `composeSummary`, `composeLoopClosure`, `composeProgressionAdoption`,
  `composePersonaProgressionLinkage`. GET-only, never-throws.
- `routes/progression.ts` — `/api/progression/enabled` probe + super-admin `/model /coverage /matrices
  /loop-closure /gaps /summary /adoption /personas`; flag-gate 503 → requireAuth → requireSuperAdmin.
- `scripts/capadex-1.5-progression-scan.ts` → `audit/capadex-3.0-progression/scan.json`;
  `capadex-1.5-generate-deliverables.ts` reads ONLY scan.json → 12 reports + completion-cert. **Run
  scan THEN generator** so docs never drift.

## Traps hit (durable)
- **public-config getter import is a SEPARATE wiring site.** Adding the flag + getter in
  `feature-flags.ts` and registering routes is NOT enough — `routes/capadex.ts` `/public-config`
  references `isProgressionEngineCompletionEnabled()` and must IMPORT it, or the endpoint 500s
  (`... is not defined`) at runtime (no tsc here to catch it). The OFF smoke MUST assert public-config
  returns `false`, not just that the key exists — a 500 silently hides the missing import.
- **Generator field names must match the registry interfaces, not the 1.4 template's.** Promotion
  rules here are `{code,label,status,promotionRule}` (not `{stage,rule}`); rendering `r.rule||r.label`
  silently prints the wrong field. Verify the registry interface before reusing a template's `.map`.
- **`scoring_runs` does NOT exist** — use `employability_scoring_runs` / `ei_profile_snapshots`.
  Composer reads `validation_loop_outcomes`, `wc3_longitudinal_snapshots`, `longitudinal_patterns`,
  `capadex_user_profiles`. `readScalar` returns null on error / 0 on no rows (null≠0 preserved).
- **Spine is the MEASURED loop (15 steps), never padded.** Same lesson as 1.4 ("23-step" plan →
  measured 8-step spine). Don't round-number a taxonomy.

## Honesty contract (same as 1.3/1.4)
Coverage ⟂ Confidence ⟂ Outcome ⟂ Adoption — four axes NEVER composited; null≠0; per-persona linkage
read-time join k_min=30 (abstain below threshold). **Engineering closure ⟂ Adoption:** loop is
CODE-complete (4/4 invariants closed = Coverage) but real re-administration volume is honest 0 — a
usage axis reported SEPARATELY, NEVER a gap. Verdict STRUCTURAL-only:
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` (4 SUPPORTED · 5 PARTIAL · 0 DEAD_END · 0 MISSING; gaps 0
Launch-Critical · 1 Medium · 1 Low · 1 Future).
