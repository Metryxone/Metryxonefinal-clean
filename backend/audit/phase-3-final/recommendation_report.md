# Recommendation Report — Phase 3

**Subsystem:** EI Recommendations (Phase 3.9, `ei-recommendation-engine`)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm`
**Engine versions:** engine `phase-3.9` · library `phase-3.9`

> **Honesty contract.** A recommendation is **emitted** only when its trigger is
> measured and satisfied. Recommendations whose gate is met (no gap) are **not_applicable**;
> recommendations whose trigger is unmeasured are **withheld**. The three states are
> reported separately so an empty area is never disguised as a finding.

---

## 1. Recommendation accounting (measured)

| Status | Count | Meaning |
|---|---|---|
| Rules in library | **10** | total recommendation rules |
| **Emitted** | **1** | trigger measured **and** satisfied |
| **Not applicable** | **4** | trigger measured, gate already met (no gap → no rec) |
| **Withheld** | **5** | trigger **unmeasured** — cannot honestly emit |
| Coverage | **50%** | share of rules whose trigger could be evaluated |

`1 + 4 + 5 = 10` — the accounting closes exactly, with no rule silently dropped.

---

## 2. Emitted recommendation (measured)

| Field | Value |
|---|---|
| Recommendation | **Seek a team-lead or mentoring experience** (`rec_exp_leadership`) |
| Category / priority | experience / medium |
| Confidence band | **measured** |
| Trigger | Signal `Leadership Potential` is **fired** (measured ✓, satisfied ✓) |
| Rationale | *"Leadership potential fired — a team-lead/mentoring experience would realise it."* |

This recommendation is **earned**: it chains off the one signal that actually fired
(Leadership Potential), whose three conditions were all measured and Strong.

---

## 3. Why 4 not-applicable and 5 withheld matter

- **Not applicable (4)** — e.g. *"Develop interpersonal & leadership capability"* is suppressed
  because the relevant domain measured at 75 (Strong) — *"at or above threshold, recommendation
  not needed (no gap, so no recommendation)."* The engine refuses to recommend fixing something
  that isn't broken.
- **Withheld (5)** — triggers whose competencies are **unmeasured** in this environment. The
  engine declines to emit on absent evidence rather than guess. This is the honest counterpart
  to coverage 50%: half the library couldn't be evaluated, and that is stated plainly.

A system gaming "number of recommendations" would emit on weak or absent evidence. This one
emits exactly one, and accounts transparently for the other nine.

---

## 4. Success criterion

✅ **Recommendations operational** — a 10-rule library evaluates measured signals/domains,
emits only on satisfied triggers, distinguishes not-applicable from withheld, and reports
honest coverage.

## 5. Honest limitations

- Coverage 50% — five rules have unmeasured triggers and are withheld, not emitted.
- The single emission rests on the proxy-based Leadership Potential signal (disclosed in the
  Signal Report).
