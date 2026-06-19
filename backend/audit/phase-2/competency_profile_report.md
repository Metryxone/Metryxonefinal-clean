# Competency Profile Report — Phase 2

**Generated:** 2026-06-19 · **Flag:** `FF_COMPETENCY_RUNTIME=1` · **Source:** live runtime endpoints + DB
**Verdict:** ✅ Competency profiles **operational**

---

## 1. What this covers
The competency profile is the durable, append-only snapshot of a subject's scored competencies:
overall score/level plus per-competency detail. Stored in `onto_competency_profiles`
(one immutable row per scoring run; history is never mutated in place).

## 2. Live evidence
| subject | overall score | overall level | history rows |
|---------|---------------|---------------|--------------|
| `demo_subj_swe` (Backend Engineer) | 75 | 4 | 1 |
| `demo_subj_pm` (Product Manager) | 75 | 4 | 1 |

Both profiles were retrieved live from `GET /api/competency-runtime/profiles/:subject` and
each is backed by exactly one append-only snapshot — consistent with the scoring ledger.

## 3. Design properties (verified)
- **Append-only:** each scoring run inserts a new `onto_competency_profiles` row; prior snapshots
  are preserved (longitudinal history is possible without rewriting the past).
- **Self-consistent with scoring:** profile count == runtime scoring-run count per subject,
  which is exactly why the runtime profile ledger is a faithful proxy for "scoring runs".
- **Honest level banding:** overall level 4 derives from the domain-proxy scores; competencies
  with no question path are excluded from the profile rather than scored as zero.

## 4. Honest gaps
- **Single snapshot per subject** in dev — longitudinal trend (multiple snapshots over time) is
  structurally supported but not yet exercised with repeat runs.
- Profile fidelity inherits the **domain-proxy** limitation: per-competency precision upgrades
  automatically once `onto_competency_question_map` is populated.

## 5. Conclusion
Profiles are generated, persisted append-only, and retrievable for real subjects. **Operational.**
