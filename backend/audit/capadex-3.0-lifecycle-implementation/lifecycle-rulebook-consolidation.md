# Lifecycle "One Rulebook Everywhere" — Gap Closure

**Scope:** Close the 4-item drift table left after the lifecycle-stage canon consolidation
(`backend/lib/lifecycle.ts`). Enhancement-only, byte-identical where behaviour is unchanged,
no V2/duplicate, no risky data rewrite. STOP for approval, no deploy.

## Gaps & resolutions

| # | Gap | Resolution | Behaviour delta |
|---|-----|-----------|-----------------|
| 1 (#309) | `entitlement-bridge.ts` kept its **own** `StageCode` union + `STAGE_ORDER` literal, able to drift from canon | `StageCode = LifecycleStageCode`; `STAGE_ORDER = LIFECYCLE_STAGE_CODES`; row filter uses `isLifecycleStageCode`. No local literal remains. | **Byte-identical** — values/order unchanged (`CAP_CUR < CAP_INS < CAP_GRW < CAP_MAS`). |
| 2 (#310) | No guarantee that the persisted `canonical_stage` label is always proper-cased | New pure `canonicalStoredLabel(value)` in canon → proper-cased STORED label (Awareness/Curiosity/Clarity/Growth/Mastery), `null` if unrecognized. Wired into `canonicalStageFor()` (the live writer of `wc3_stage_state` / `wc3_stage_progression`). | **Byte-identical for current inputs** (CAP_* codes hit `STAGE_ENTITY_MAP` first). Strict improvement: a *recognized* odd-cased rep (e.g. `"clarity"`) now resolves to `"Clarity"` instead of mis-degrading to `"Awareness"`. Unrecognized input still degrades to the uncoded pre-stage exactly as before. |
| 3 | `wc3` trend / `wc7b` growth-plan / subscription floor routing | **Already canon-routed by the #306 merge** (`normalizeStoredStage` / `FLOOR_BY_CODE`). Verified, no edit. | none |
| 4 (CAP_ADV) | `lde-evolution.ts` seeded a non-canon 5th code `CAP_ADV` on the "Advanced" depth band | `CAP_ADV → CAP_MAS` + comment. The depth ladder cross-walks to the 4 canon codes; there is no coded stage above Mastery, so the top depth band shares `CAP_MAS`. No consumer reads `cap_code`. | Cosmetic seed value only; no consumer behaviour change. |

## Honesty notes
- `canonicalStoredLabel` returns the **STORED (alias) form** (`Clarity`), not the canonical
  label (`Insight`), preserving the load-bearing persisted representation. It **never
  fabricates** a stage — unrecognized input returns `null` and callers keep their existing
  default.
- `wc3-schema.ts` static seeds are authored literals that already match canon proper-casing;
  left as-is (converting to dynamic construction would add risk for zero behaviour change).
- Coverage ⟂ Confidence preserved; `null ≠ 0`.
- **Historical data not rewritten** — whether any pre-existing rows are stored in odd casing
  is a separate read-only data question (proposed as a follow-up), not addressed here.

## Verification
- `scripts/verify-lifecycle-rulebook-consolidation.ts` — **31/31 PASS** (pure, offline):
  casing normalization, `canonicalStageFor` byte-identical for CAP_* + new guarantee,
  entitlement sources canon (no local literal), lde emits only canonical cap_codes.
- `scripts/verify-lifecycle-stage-normalization.ts` (#306 parity) — **69/69 PASS** (no regression).
- `Backend API` restarted — clean boot, all routes registered, `Server listening on 8080`.
- Repo scan: no `CAP_ADV` and no local entitlement stage-code literal remain in runtime code.

## Files touched
- `backend/lib/lifecycle.ts` — add pure `canonicalStoredLabel()`.
- `backend/services/wc3/stage-intelligence.ts` — `canonicalStageFor()` routed through canon guarantee.
- `backend/services/entitlement-bridge.ts` — `StageCode`/`STAGE_ORDER`/filter sourced from canon.
- `backend/routes/lde-evolution.ts` — `CAP_ADV → CAP_MAS`.
- `backend/scripts/verify-lifecycle-rulebook-consolidation.ts` — new verification (added).
