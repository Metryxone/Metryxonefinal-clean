# Competency Scoring Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live dev DB + runtime endpoints
**Verdict:** ✅ Competency scoring **operational**

---

## 1. What this covers
Scoring converts a subject's answered assessment instance into competency scores, a profile
snapshot, and (for the normalized scorer) a run-ledger record.

## 2. Two scoring ledgers (important — both count as a real scoring run)
| Engine | Path | Writes |
|--------|------|--------|
| Normalized scorer (Phase 2.4) | `competency-scoring.ts` | `onto_competency_score_runs` (rich run row) |
| Runtime generate→score (Phase 2.3) | `competency-runtime.ts` `scoreInstance` | `onto_competency_scores` + append-only `onto_competency_profiles` (1 row/run) |

The runtime path — the one the SuperAdmin UI driver and these demos actually use — does **not**
write to `onto_competency_score_runs`. Any "scoring run" count must therefore **union both
ledgers**, or a genuinely-scored subject reads as unscored.

> **Fix applied this phase:** the SuperAdmin validation harness "Scoring" stage now unions both
> ledgers (`onto_competency_score_runs` + `onto_competency_profiles`) for total and per-subject
> attribution. Previously a runtime-scored subject reported "none for this subject" — a reporting
> blind spot, not a data error. No scoring data path was changed.

## 3. Live evidence
| Ledger | Rows |
|--------|------|
| `onto_competency_score_runs` (normalized) | 1 (`smoke_subject_1` / `bp_pm_v1`) |
| `onto_competency_profiles` (runtime, 1/run) | `demo_subj_swe` ×1, `demo_subj_pm` ×1 |
| `onto_competency_scores` | `demo_subj_swe` 1 run, `demo_subj_pm` 1 run |

Validation harness Scoring stage (post-fix), `demo_subj_swe`:
> **PASS** — "3 scoring run(s) recorded platform-wide (1 normalized-ledger + 2 runtime
> domain-proxy), 1 for this subject. Recorded responses: 15."

## 4. Scoring method (honest)
Scores are produced in **domain-proxy** mode (see `question_blueprint_report.md`): question
scores crosswalk to onto-domains, competencies inherit their domain's measure. Competencies
whose domain has no question path (`dom_strategic`) are returned **unmeasurable**, never scored.

## 5. Conclusion
Competency scoring runs end-to-end for real subjects via the runtime path, persists scores and
append-only profile snapshots, and is now correctly attributed in validation. **Operational.**
