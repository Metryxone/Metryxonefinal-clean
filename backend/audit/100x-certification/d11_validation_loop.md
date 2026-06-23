# D11 — Validation Loop · 100X Re-certification

**Verdict: PARTIAL.** **Score: 48/100** (was 35 — Phase 7 front-half intake now wired; still 0 realized).

## Live evidence
- `validation_loop_outcomes` table: **EXISTS** (`to_regclass` resolves).
- Rows: **0** total · **0** demo · **0** realized.

## What Phase 1–9 added
- **Phase 7 — Validation Loop** front-half realized-outcome intake (`validation_loop_outcomes`) that **composes** the existing `buildCalibrationModel`. Flag `validationLoop` OFF byte-identical incl. schema (ensureSchema POST-only; GET `to_regclass`-probes). `toCalibrationPairs` **drops** (not clamps) out-of-[0,1]; `is_demo` excluded. The status endpoint IS the surface (no frontend).
- This closes the 99X finding "front-half hooks absent": the intake path now exists.

## Honest gaps
- **0 realized outcomes** → the loop abstains **by accrual**, not by code: `evidence_backed` stays false until ≥30 realized non-demo outcomes; certification correctly STAYS PARTIAL.
- The engine **refuses to claim accuracy** with no realized data — the honest behaviour.

## Why PARTIAL not PASS
Structure is now complete on both halves, but a validation loop cannot be "complete" until production data accrues. We will not fabricate outcomes to force a PASS.
