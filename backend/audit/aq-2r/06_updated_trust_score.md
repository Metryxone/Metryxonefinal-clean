# AQ-2R · 06 — Updated Trust Score

**Trust Score** = mean `question_intelligence_score` (QIS) over the selected
questions. QIS is the per-question evidence weight (coverage×confidence across the
six AQ-2 dimensions), so a higher selection-Trust means the runtime is choosing
better-evidenced questions.

| Arm | Trust Score |
|---|---|
| BEFORE (legacy) | 37.8 |
| AFTER (AQ-2R) | 41.6 |
| **Delta** | **+3.8** |

Reference: mean QIS across the whole AQ-2 bank = 51.1. AQ-2R's selection-Trust shows
whether runtime selection skews above or below the bank mean.
