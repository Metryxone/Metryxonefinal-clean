# Adaptive Assessment Activation — Evidence

Engine version: `1.0.0` · generated 2026-06-23T18:56:46.893Z

> Read-only. Pure engine + `buildDifficultyPlan` over the live bank. No writes, no DDL.

## 1. Per-level target difficulty + proficiency anchor

| Level | Anchor | Target band | Target rank | Source |
|---|---|---|---|---|
| junior | 55 | intermediate | 2 | seniority_anchor |
| mid | 65 | medium | 3 | seniority_anchor |
| senior | 75 | advanced | 4 | seniority_anchor |
| lead | 80 | advanced | 4 | seniority_anchor |
| director | 85 | advanced | 4 | seniority_anchor |

## 2. Level-aware readiness bands

| Level | Ready≥ | Near≥ | Developing≥ | Emerging≥ |
|---|---|---|---|---|
| junior | 65 | 52 | 38 | 25 |
| mid | 75 | 62 | 48 | 35 |
| senior | 85 | 72 | 58 | 45 |
| lead | 90 | 77 | 63 | 50 |
| director | 95 | 82 | 68 | 55 |

Legacy fixed ladder (flag-OFF): Ready≥85 / Near≥72 / Developing≥58 / Emerging≥45

Same weighted score (80) classified per level:

- junior: **Ready**
- mid: **Ready**
- senior: **Near-Ready**
- lead: **Near-Ready**
- director: **Developing**

## 3. Live bank coverage (honest ceiling)

Bank table present: `true` · approved total: `20` · distinct bands: `[advanced, foundational, intermediate, medium]`
Served difficulty can shift by level: **`false`** — bank holds a single difficulty band across served domains (medium-only) — honest coverage ceiling

| Domain | Approved | Bands (band×count) | Target available | Coverage gap |
|---|---|---|---|---|
| COG | 4 | medium×4 | no | ⚠️ yes |
| COM | 3 | medium×3 | no | ⚠️ yes |
| LEA | 3 | medium×3 | no | ⚠️ yes |
| EXE | 2 | medium×2 | no | ⚠️ yes |
| ADP | 3 | medium×3 | no | ⚠️ yes |
| TEC | 2 | medium×2 | no | ⚠️ yes |
| EIQ | 3 | medium×3 | no | ⚠️ yes |

### Honest notes
- Role-DNA anchor not used (no role supplied) — falling back to career-stage anchor.
- Live 7-domain bank holds a single difficulty rank — SERVED difficulty cannot shift by role level. Target difficulty + readiness/scoring thresholds DO shift; bank content is the ceiling.

## 4. Difficulty-affinity selection bias (no-op on single-band bank)

Served domains (COG/COM/LEA/EXE/ADP/TEC/EIQ) hold bands `[medium]`. The non-medium bands in the bank-wide set `[advanced, foundational, intermediate, medium]` belong to disjoint genome `comp_*` codes that `/select` never serves.

Every served row has band `medium` (rank 3). The bonus for that band is uniform across all rows within a level, so it cannot re-order an all-`medium` pool.

- junior target bonus on `medium`: 0.3
- director target bonus on `medium`: 0.3

## Checks

- ✅ PASS — proficiency anchor monotonic non-decreasing by level [55, 65, 75, 80, 85]
- ✅ PASS — target difficulty rank monotonic non-decreasing by level [2, 3, 4, 4, 4]
- ✅ PASS — expected_level override wins over stage anchor + stamps provenance (junior+90 → anchor 90, source role_dna_expected_level)
- ✅ PASS — senior level-aware bands == legacy fixed ladder (flag-ON senior is byte-identical to flag-OFF)
- ✅ PASS — ready_min monotonic non-decreasing by level [65, 75, 85, 90, 95]
- ✅ PASS — score 80 classifies differently for junior (Ready) vs director (Developing) — level-awareness is real
- ✅ PASS — live bank is single-difficulty-band → served difficulty CANNOT shift by level (honest ceiling surfaced, not padded)
- ✅ PASS — band matcher discriminates where variety exists (advanced→0.6 > medium→0.3 > easy→0 for target rank 4)
- ✅ PASS — unknown band → 0 bonus (never penalises an untagged row below a tagged one)

**9/9 checks passed.**
