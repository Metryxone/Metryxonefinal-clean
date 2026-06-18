# AQ-1 · Output 4 — Development Stage Coverage

**Investigation only.** Development stage is read directly from the bank column `stage`. Required taxonomy: **Awareness · Curiosity · Clarity · Growth · Mastery**.

## Stage distribution (all 30,638 questions)
| Stage value | Count | % |
|---|---:|---:|
| Clarity | 14,294 | 46.7% |
| (blank) | 16,344 | 53.3% |
| Awareness | 0 | 0% |
| Curiosity | 0 | 0% |
| Growth | 0 | 0% |
| Mastery | 0 | 0% |

## Findings (RED)
1. **The 5-stage taxonomy is collapsed to a single value.** Every non-blank question is `Clarity`; **none** of Awareness / Curiosity / Growth / Mastery appears anywhere in the bank.
2. **53.3% of questions have no stage at all.** The 16,344 blank-stage rows correspond exactly to the newer half of the bank (the 30,638-row bank grew from the original ~14,294 "Clarity" rows; the addition carries no stage).
3. **Stage is therefore non-discriminating.** It cannot route a learner through Awareness → Mastery, cannot gate developmental progression, and provides no signal for adaptive sequencing.

## Verdict — RED for development stage
Development-stage coverage is effectively absent: 0% of the taxonomy beyond "Clarity" is represented and over half the bank is unstaged. A stage-classification pass (assigning each question one of the five stages) is required before any stage-based adaptivity is possible. **This audit does not assign stages — investigation only.**
