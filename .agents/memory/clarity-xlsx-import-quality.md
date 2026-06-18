---
name: Clarity questions xlsx import quality
description: Recurring data-quality traps when importing external clarity-question spreadsheets into capadex_clarity_questions
---

External clarity-question source files (e.g. an attached `Clarity_import*.xlsx`) are
hand/merge-assembled and carry two recurring traps. Verify both BEFORE writing to
`capadex_clarity_questions` (which has a UNIQUE constraint on `question_id`).

**Trap 1 — non-unique question_id across genuinely different questions.**
A large fraction of `question_id`s are reused (one file: 7,264 rows / 4,598 unique ids →
1,631 ids reused for 4,297 rows). In that file `concern_id == question_id`, so the
collision is in both. The reused rows are DIFFERENT questions (different `question`
text + `concern`), NOT duplicates.
**Why it matters:** a naive `ON CONFLICT (question_id) DO UPDATE` keyed on the file's
id silently keeps only the last of each collision → ~37% of questions vanish with no error.
**How to apply:** to keep every row, de-collide ids (keep first occurrence, suffix the
rest e.g. `LM041`, `LM041__2`) and keep the original `concern_id` (it has no unique
constraint). Routing still works because the clarity→master join is on
`master_bridge_tag` (provided per row), not on `question_id`/`concern_id`.

**Trap 2 — a column-shifted subset.**
A consistent subset (one file: 80 rows, all `CW`/`RC` prefixes /
COGNITIVE_WELLNESS + RECOVERY_CAPABILITY) has its 4 option labels shifted across
columns: `option_a`=A, `option_a_score`col=B label, `polarity`col=C label,
`reverse_score`col=D label; `question_weight`col holds the scores `'1,2,3,4'`;
the REAL polarity sits in `low_score_anchor` (`positive`) and the REAL reverse in
`high_score_anchor` (`False`); the real low/high anchors are lost.
**How to detect:** `polarity` value is neither `positive`/`negative` nor blank.
**How to repair:** remap as above, set scores 1–4, polarity from `low_score_anchor`,
reverse from `high_score_anchor` (True→yes/False→no), blank the anchors.

**General:** option text has leading/trailing spaces (.trim()); `reverse_score` in DB is
TEXT `'yes'`/`'no'` (not boolean); do NOT reuse `seed-capadex-clarity-questions.mjs`
as-is — it TRUNCATEs the whole table. Use an additive upsert.
