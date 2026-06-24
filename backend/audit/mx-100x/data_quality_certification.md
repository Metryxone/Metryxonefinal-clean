# Section 15 — Data Quality & Integrity Certification

**Verdict: PARTIAL (integrity PASS; completeness FAIL by sparseness, not corruption).**

Data quality splits cleanly: what data exists is **clean, typed, and non-duplicated** (integrity
PASS), but the platform is **sparsely populated** — many tables are empty and several ontologies are
unfed in this shared DB (completeness FAIL). Crucially, the sparseness is *honest emptiness*, not
corruption or partial writes.

## 15.1 Integrity — PASS
- **No fabricated data found.** Empty tables read genuine 0; populated tables are internally
  consistent (e.g. O*NET crosswalk 52,362 edges resolve to 1,021 roles × 159 competencies).
- **Type completeness** where it counts: `onto_competency_type_map` = 419/419 (100%).
- **No duplication** in the canonical genome (419 distinct competencies). Disjoint id spaces
  (`onto_*` TEXT vs `ont_*` INT) are bridged, never merged — no cross-space duplication.
- **Demo data is isolated and identifiable** (40 employer candidates all @example.com; m5/TIG single
  demo org) — purgeable and excluded from real metrics.

## 15.2 Completeness — FAIL (sparseness)
- **Question→competency mapping:** 7/419 competencies (1.7%) — the single biggest completeness gap.
- **User-facing tables empty:** all `cg_user_*`, all `career_seeker_*` activity, `capadex_sessions`,
  `validation_loop_outcomes`, EIOS, m5 forecasting — 0 rows.
- **Unfed ontologies (this shared DB):** CAPADEX concerns_master/clarity/domains/families/signals = 0;
  LBI banks = 0. These are seeded in isolated task-agent environments and never merged as rows (the
  documented merged-backfill limitation), so a code merge carries DDL, not data.

## 15.3 Orphans & reachability ceilings — disclosed, not defects
- `ont_concerns` = 0 (mirror-sync target empty here); regional competency expectations (7) far thinner
  than the genome (419) → most region-conditioned lookups fall back to global default.
- Documented disjointness (CAPADEX `concern_id` vs `concerns_master`; O*NET having no industry→
  competency dimension) produces *reachability ceilings* that are surfaced as Estimated/abstain — these
  are honest gaps, not orphaned/broken joins.

## 15.4 Honesty-engineering observed (strong)
- null = missing (never fabricated 0); pg COUNT string-coercion guarded; out-of-range calibration
  values dropped not clamped; demo rows excluded from every certified metric; PII masked to
  `user_<sha256>` in committed audit artifacts. These conventions are applied consistently.

## 15.5 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Integrity (no fabrication/corruption) | PASS | honest 0s, consistent populated tables |
| Type completeness | PASS | 419/419 type-map |
| Duplication | PASS | distinct genome, bridged-not-merged id spaces |
| Completeness (population) | FAIL | 1.7% question map; user/forecast/ontology tables empty |
| Orphans / reachability | PARTIAL (disclosed) | empty mirror targets, thin regional, documented ceilings |
| Honesty conventions | PASS | null≠0, demo-excluded, PII-masked, drop-not-clamp |

**Net: PARTIAL.** The data the platform holds is trustworthy; the platform simply does not hold enough
of it yet. The fix is population (questions, real usage, ontology feeds), not repair.
