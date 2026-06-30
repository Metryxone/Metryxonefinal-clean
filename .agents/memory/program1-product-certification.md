---
name: Program-1 Product Certification (CAPADEX 3.0 Phase 1.8)
description: Capstone read-only certification composer over Phases 1.1–1.7 — flag, 4-axis honesty, scan/generator pattern, and the traps that bite a cross-phase composer.
---

# Program-1 Product Certification (Phase 1.8, flag `productTraceabilityCertification`)

The Program-1 capstone: a READ-ONLY flag-gated composer that certifies everything built in Phases
1.1–1.7 against the frozen Product Blueprint. Mirrors MX-800 2.14 / MX-700 1.43. Default OFF,
byte-identical, zero-DDL, owns 0 tables, human approval required (no enable/merge/deploy).

## Verdict shape (carry forward to any future Program-N capstone)
- FOUR axes reported INDEPENDENTLY, NEVER composited: Structural Completeness ⟂ Functional Integration
  ⟂ Product Maturity ⟂ Enterprise Launch Readiness.
- Verdict is STRUCTURAL-only: `STRUCTURAL_CERTIFIED`, `production_ready:false`,
  `enterprise_launch_readiness:null` (WITHHELD by design — needs runtime adoption + realized outcomes
  that cannot exist pre-launch). null ≠ 0.
- Product Maturity ceiling is **Managed (L3)**; Levels 4–5 WITHHELD (no realized-outcome/autonomous
  evidence). Same ceiling discipline as the platform-lifecycle certifications.

## The cross-phase composer pattern (the durable lesson)
- **Gather each phase getter EXACTLY ONCE in parallel** via a `safe()` wrapper (try/catch → null + error
  string). A capstone that re-calls a sibling phase's expensive composer per-deliverable will timeout +
  drift. Same lesson as 1.43 / 2.14 — gather once, then read from the gathered map.
- **Getter names differ per phase** — verify each before wiring: 1.2 is `composePersonaOutcomes`;
  1.3/1.4/1.5/1.6/1.7 each export `composeSummary` (alias on import to avoid collisions). 1.1 has no
  getter (it's the lifecycle/stage substrate, certified by file/normalizer existence only → its
  registered/public-config/getter fields are honest `null`, rendered `—`, NOT `false`).
- **Functional Integration = registered-in-routes.ts + getter-callable**, NOT "activated". Integrated ≠
  Activated. Build a wiring index by reading routes.ts + capadex.ts ONCE (registerFn present, public-config
  key present), don't re-grep per phase.
- **Traceability node status**: INTACT = all providing phases present, PARTIAL = some, BREAK = none.
  An ADOPTION-gated keystone (Outcome→KPI, realized-outcome volume honest-low) is STRUCTURALLY INTACT —
  report the adoption shortfall on its OWN axis, NEVER as a chain BREAK (that would fabricate a defect).

## Scan + generator (same SSoT discipline as 1.3–1.7)
- Scan self-enables the 7 FF_* in-process — purely cosmetic for flag descriptors; composers are
  flag-independent read-only and read the live DB regardless. Flags don't seed data.
- Generator reads ONLY scan.json (sha256 12-char + mtime header, fail-fast on any missing
  certification/summary section) → 15 named deliverables. Docs can't drift from the measurement.
- The 1.8 generator is structurally DIFFERENT from 1.3–1.7's path/coverage generators: it renders
  phases/traceability/axes/gaps, not paths/coverage rollups. `dash()` (null→—) + `yn()` (null→—,
  true→✅, false→❌) keep null≠0 visible.

## public-config getter is a SEPARATE import site (recurring trap across ALL CAPADEX 3.0 phases)
`routes/capadex.ts` `/public-config` must IMPORT `isProductTraceabilityCertificationEnabled` AND add the
key `product_traceability_certification` — two edits, both required, or the endpoint 500s (no tsc here;
only caught at runtime). This has bitten 1.5/1.6/1.7/1.8 identically.

## OFF smoke (verified)
`/api/program1-certification/enabled` → 200 `{enabled:false}` (UNGATED probe, mirrors 1.7's corrected
pattern); `/api/admin/program1-certification/*` → 401 (global `/api/admin` auth gate fires before the
flag-gate, so OFF smoke is 401 not 503); public-config flag `false`.
