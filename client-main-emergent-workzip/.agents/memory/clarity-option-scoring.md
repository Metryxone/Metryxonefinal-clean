---
name: CAPADEX clarity-question option scoring & text rewrites
description: How option_*_score encodes concern, why half the rows are score-descending, and the rule for safely rewriting option text
---

# Rewriting capadex_clarity_questions option text

`option_a..option_e` are the answer labels; `option_a_score..option_e_score` (0..4)
encode **concern/distress severity** for that answer — higher score = more concern.

**Why ~half the rows are score-descending (option_a_score > option_e_score):** items
are a mix of negatively-worded (distress) and positively-worded stems. For a positive
stem ("how often do you feel confident?") the *low* answer ("Never") carries the
*high* concern score, so the score series descends even though the text reads
low→high. ~53% ascending / ~47% descending across the table — this is correct, not a bug.

**The rule for any bulk text rewrite:** preserve the *meaning at each option position*.
Anchor replacements on `option_a`'s actual pole (e.g. only apply an ascending
"Never→Very often" scale when option_a literally starts with the low pole word).
Then the per-position score stays valid regardless of score direction. NEVER assume
the series is ascending.

**The one place score direction IS usable:** `impact` and `difficulty` families are
pole-asymmetric — "Severe impact" / "Extremely difficult" are *always* the
higher-concern pole. So for those two families only, the severe/difficult-pole text
must sit on the higher-score position; you can orient/validate them by score. A
catch-all substring match (`includes('impact')`/`includes('difficult')`) that assumes
ascending WILL flip descending-text rows — detect with `option_e LIKE 'Severe…' AND
option_a_score > option_e_score` and fix by swapping a<->e, b<->d (text only).

**How to apply:** generator = `backend/scripts/generate-clarity-options.mjs`
(`classifyScale`, signature-anchored, em-dash guard for idempotency) +
`generate-confidence-options.mjs` (confidence type). Frontend renders option_a..e
verbatim; no backend restart needed (DB read per request).
