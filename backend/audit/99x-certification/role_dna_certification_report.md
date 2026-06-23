# §2 — Role DNA Certification Report

**Date:** 2026-06-23 · Read-only · Evidence: `backend/scripts/audit-99x-certification.ts`

## Verdict: 🟡 PARTIAL

The Industry→Function→Department→Role-Family→Role→Role-DNA spine is referential-integrity clean for the
lower four levels, and competency/proficiency/weight **inheritance is perfect (0 NULLs) wherever links
exist**. The honest gaps: benchmark coverage is **0%**, DNA-snapshot coverage is **57.7%** (600/1040),
and **19 roles** carry no competency links.

---

## Chain integrity (orphan checks)

| Level | Verdict | Evidence |
|---|---|---|
| No orphan industries | ✅ | 206 industries |
| No orphan functions | 🟡 | `ont_functions` has **no `industry_id` FK** — functions are industry-agnostic by design (Industry→Function edge not modeled) |
| No orphan departments | ✅ | **0** departments with invalid `function_id` (of 43) |
| No orphan role families | ✅ | **0** families with invalid `department_id` (of 31) |
| No orphan roles | ✅ | **0** roles with invalid `role_family_id` (of 1040) |

## Per-role coverage metrics (aggregate across 1040 roles)

| Coverage axis | Value | Basis |
|---|---|---|
| **Role DNA coverage** | **57.7%** (600/1040) by expansion snapshot · **98.2%** (1021/1040) by competency links | `role_dna_expansion_snapshots` distinct roles vs `map_role_competency` distinct roles |
| **Competency coverage** | min 9 · **avg 51.3** · max 92 competencies per linked role | `map_role_competency` per-role distribution |
| **Proficiency coverage** | **100%** of linked rows | 0 NULL `min_proficiency` / `target_proficiency` (52,362 rows) |
| **Weight inheritance** | **100%** of linked rows | 0 NULL `weight` (52,362 rows); **0 duplicate** (role,competency) pairs |
| **Crosswalk confidence** | **avg 1.000**, 600/600 `high` band | `role_dna_expansion_snapshots.confidence` |
| **Benchmark coverage** | **0%** | `dna.benchmark.available='false'` for all 600; `ti_role_benchmarks`=60 (family-level, unattached) |
| **Assessment coverage** | **~3.3%** of genome | only 14 competencies have question templates (see §4) |
| **Readiness coverage** | **100%** of linked rows | per-competency `target_proficiency` present on every inherited row |

## Honest findings
1. **Inheritance is exact where present** — zero NULL weights/proficiencies and zero duplicate mappings
   across 52,362 active rows is a genuine integrity PASS.
2. **Snapshot vs link coverage diverge** — 1021 roles inherit competencies but only 600 have full DNA
   expansion snapshots. Both numbers are reported; neither is rounded up.
3. **Benchmarks are the largest gap** — no role carries an attached benchmark; the 60 family-level
   benchmarks are not wired to the 1040 roles.
4. **Competency types in DNA are O\*NET-native** (`core/functional/behavioral/domain`), distinct from the
   normalized 5-type genome taxonomy — see §6.

**Closable additively:** derive per-role benchmarks, expand snapshots to 1040, link the 19 roles.
