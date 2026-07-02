# Adaptive Assessment Activation — Evidence

Engine version: `1.0.0` · generated 2026-07-02T01:20:52.390Z

> Read-only. Pure engine + `buildDifficultyPlan` over the live bank. No writes, no DDL.

## 1. Per-level target difficulty + proficiency anchor

| Level | Anchor | Target band | Target rank | Source |
|---|---|---|---|---|
| junior | 55 | foundational | 1 | seniority_anchor |
| mid | 65 | intermediate | 2 | seniority_anchor |
| senior | 75 | advanced | 3 | seniority_anchor |
| lead | 80 | advanced | 3 | seniority_anchor |
| director | 85 | advanced | 3 | seniority_anchor |

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

Bank table present: `true` · approved total: `48` · distinct bands: `[advanced, foundational, intermediate]`
Served difficulty can shift by level: **`true`** — bank holds multiple difficulty bands across served domains

| Domain | Approved | Bands (band×count) | Target available | Coverage gap |
|---|---|---|---|---|
| COG | 8 | foundational×2, intermediate×4, advanced×2 | yes | no |
| COM | 7 | foundational×2, intermediate×3, advanced×2 | yes | no |
| LEA | 7 | foundational×2, intermediate×3, advanced×2 | yes | no |
| EXE | 6 | foundational×2, intermediate×2, advanced×2 | yes | no |
| ADP | 7 | foundational×2, intermediate×3, advanced×2 | yes | no |
| TEC | 6 | foundational×2, intermediate×2, advanced×2 | yes | no |
| EIQ | 7 | foundational×2, intermediate×3, advanced×2 | yes | no |

### Honest notes
- Role-DNA anchor not used (no role supplied) — falling back to career-stage anchor.
- Live 7-domain bank holds 3 difficulty ranks [1,2,3] — SERVED difficulty shifts by role level (harder/easier variants are selected via the affinity bonus).

## 4. Difficulty-affinity selection bias (live, on the varied served bank)

Served domains (COG/COM/LEA/EXE/ADP/TEC/EIQ) hold bands `[advanced, foundational, intermediate]` (unified 3-tier ladder). Each domain now carries 2 foundational + 2 advanced variants alongside its intermediate stock, so the selection bonus has a 2-deep-per-band ladder to discriminate and rotate through.

| Served band | Junior bonus (target foundational) | Director bonus (target advanced) |
|---|---|---|
| advanced (rank 3) | 0 | 0.6 |
| foundational (rank 1) | 0.6 | 0 |
| intermediate (rank 2) | 0.3 | 0.3 |

## 5. Role-title crosswalk integrity (guards silent orphan drift)

`ROLE_TITLE_ALIASES` maps 91 free-text titles onto 15 curated `onto_roles` ids.

| Canonical role id | Aliases | Runtime-weight rows | Resolves |
|---|---|---|---|
| `role_be_eng` | 7 | 7 | ✅ yes |
| `role_business_analyst` | 4 | 6 | ✅ yes |
| `role_credit_analyst` | 5 | 7 | ✅ yes |
| `role_data_analyst` | 5 | 6 | ✅ yes |
| `role_data_scientist` | 2 | 6 | ✅ yes |
| `role_devops_eng` | 7 | 7 | ✅ yes |
| `role_eng_manager` | 7 | 7 | ✅ yes |
| `role_fe_eng` | 7 | 6 | ✅ yes |
| `role_fullstack_eng` | 5 | 6 | ✅ yes |
| `role_pm` | 6 | 16 | ✅ yes |
| `role_project_manager` | 7 | 6 | ✅ yes |
| `role_qa_eng` | 8 | 6 | ✅ yes |
| `role_software_eng` | 9 | 6 | ✅ yes |
| `role_sr_be_eng` | 4 | 7 | ✅ yes |
| `role_sr_software_eng` | 8 | 7 | ✅ yes |

## Checks

- ✅ PASS — proficiency anchor monotonic non-decreasing by level [55, 65, 75, 80, 85]
- ✅ PASS — target difficulty rank monotonic non-decreasing by level [1, 2, 3, 3, 3]
- ✅ PASS — expected_level override wins over stage anchor + stamps provenance (junior+90 → anchor 90, source role_dna_expected_level)
- ✅ PASS — senior level-aware bands == legacy fixed ladder (flag-ON senior is byte-identical to flag-OFF)
- ✅ PASS — ready_min monotonic non-decreasing by level [65, 75, 85, 90, 95]
- ✅ PASS — score 80 classifies differently for junior (Ready) vs director (Developing) — level-awareness is real
- ✅ PASS — served 7-domain bank now holds multiple difficulty ranks → served difficulty CAN shift by level (activation realised, not padded)
- ✅ PASS — same served pool re-ranks oppositely by level (junior favours foundational, director favours advanced) — served difficulty genuinely shifts
- ✅ PASS — band matcher discriminates on unified ladder (advanced→0.6 > intermediate→0.3 > foundational→0 for target rank 3)
- ✅ PASS — unknown band → 0 bonus (never penalises an untagged row below a tagged one)
- ✅ PASS — all 15 ROLE_TITLE_ALIASES canonical ids resolve to a curated role with >0 competency_runtime_weights rows (no silent orphan drift)

**11/11 checks passed.**
