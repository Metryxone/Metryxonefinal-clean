# 07 · Remaining Gaps

Honest record of everything Phase 1.1 did NOT do — what was intentionally left untouched (and why), and the
forward work that remains. Nothing here is fabricated; gaps are reported as gaps.

---

## 1. Intentionally untouched (in scope of "lifecycle reference", deliberately not changed)

### 1.1 Stored DB strings `'Clarity'` / `'Awareness'`
- **What:** the database persists human-readable stage strings; `'Clarity'` and `'Awareness'` appear as stored
  values read directly by `subscription-engine` (stage-floor index) and WC3 / WC5 / WC7B trend reads.
- **Why untouched:** these are **load-bearing**. Rewriting them is a data migration with runtime risk, not a
  taxonomy-terminology fix. The canon *documents* `Clarity = alias of CAP_INS` and `Awareness = uncoded pre-stage`;
  it does not migrate stored data. Changing values would be a breaking change — out of scope for Phase 1.1.
- **Forward work:** if stored values should ever normalize to canonical codes, that is its own approved phase
  with a migration + a backward-compatible read path.

### 1.2 `frontend/server/src/routes/short-assessments.ts` (≈L7)
- **What:** a stage reference inside a **dormant second Express + JWT app** under `frontend/server`.
- **Why untouched:** that app is not run by any configured workflow (no live entrypoint, empty `node_modules` in
  the runtime). Editing dead code adds risk with zero runtime benefit and cannot be verified by a boot/build.
- **Forward work:** fold into the canon if/when that app is revived (it would need its own build to verify).

### 1.3 `update_capadex_tags.mjs` (≈L27)
- **What:** a one-off **reverse** label→code map inside a maintenance script.
- **Why untouched:** it is a one-shot tooling script, not runtime; its reverse direction isn't what the canon
  exports. Rewiring it is cosmetic and unverifiable via the app's boot/build gates.

### 1.4 `CapadexPackageSelectionPhase.tsx` (≈L205 / L216)
- **What:** arrays that *mention* stage names.
- **Why untouched:** these are **package-content** arrays (what a package includes), not stage-label
  *definitions*. Routing them through the label canon would change their meaning, not align it.

### 1.5 `wc3-schema.ts` seed comments
- **What:** comments referencing stage names in WC3 schema/seed.
- **Why untouched:** comments, not code; no runtime effect.

---

## 2. Progression forward work (from Blueprint 06 — NOT this phase)

These are the canonical gaps Blueprint 06 itself names as forward work for Programs 1–6. Phase 1.1 aligned
*taxonomy only* and did not touch progression behaviour:

- **GAP-P2 — Growth→Mastery not evidence-gated.** Progression is today derived / monetization-gated, not
  criteria-gated. (Blueprint 06 §Stage 3, frozen target.)
- **GAP-P1 — Progress not systematically re-administered.** Re-measure vs baseline is partial.
- **GAP-O1 — realized Mastery outcome not captured.** The close-the-loop tail (D13) — the keystone gap.
- **GAP-A4 — Exit / Continuous assessments absent** at Mastery.
- Entry criteria at Curiosity remain implicit.

## 3. Known-unrelated environment item

- **mockup-sandbox preview server FAILS** (`ERR_MODULE_NOT_FOUND: fast-glob`). Pre-existing, unrelated to this
  phase; documented as a known environment issue, not introduced here.

## 4. Scope discipline statement

Phase 1.1 is a **taxonomy alignment** phase: one canon per runtime, all coded references routed to it, alias and
pre-stage correctly modeled, zero behaviour change, zero data migration, zero flag change. Everything that would
have required a behaviour change, a data migration, or editing dead/tooling code was deliberately left for an
appropriate future phase and is recorded above. **STOP for human approval — no deploy.**
