---
name: Bridge-tag orphan remap can leak wrong-age/topic clarity questions
description: Why a child's concern can serve adult/career clarity questions, and how the orphan sibling-remap (greedy keyword rules) is the usual culprit.
---

# Orphan bridge-tag remap → wrong-domain clarity questions

When a CAPADEX concern serves clarity questions that are off-topic or wrong-age
(e.g. a 10-year-old's "classroom focus" getting adult **career-adaptability**
questions), trace it through the **picker tiers + the orphan remap**, not the
concern resolution. In the known case concern resolution was CORRECT.

## The trap
- A concern's `relational_bridge_tag` may have **zero** clarity rows (a true
  orphan — clarity is authored against only ~56 coarse `master_bridge_tag`
  buckets, concerns carry ~328 finer tags).
- `pickQuestionsFromMaster` then calls `resolveCoveredBridgeTag(ownTag)`
  (`services/bridge-tag-resolver.ts`) and runs the sibling tag with **persona
  OFF**.
- Resolution order is covered_self → explicit override → **keyword rules** →
  GENERAL_CONCERN. The keyword rules are **greedy substring** matches; e.g.
  `/LEARNING|LEARNER/ → LEARNING_ADAPTABILITY`. So any orphan tag containing
  "LEARNING" (e.g. `LEARNING_INTERVENTION` = a student "poor concentration in
  class" concern) routes to LEARNING_ADAPTABILITY — whose curated questions are
  adult career/industry-adaptability.

## Why the age gate does NOT save you
The picker's age filter is **family-level**, not per-question: it only checks
"does ANY master row in this bridge-tag family overlap the user's age?". Clarity
rows carry **no age column** and their own `concern_id` (e.g. `ADAPT_001`) does
**not** join to `capadex_concerns_master.concern_id` (different taxonomy/CSV), so
individual adult questions can't be filtered out. If the remapped bucket's master
rows happen to be student-aged, the EXISTS check passes and the adult-worded
questions sail through.

## The fix that works
Add a **hand-verified override** in `ORPHAN_BRIDGE_TAG_FALLBACK` pointing the
orphan tag at the topically-correct covered sibling (must be a member of
`COVERED_BRIDGE_TAGS`). For in-class attention/focus, `DISCIPLINE_HABITS` is the
right bucket (it holds "Students Unable to Sustain Attention in Class",
"Difficulty Maintaining Focus During Long Study Hours"); its master family
overlaps young learners. Override beats the greedy keyword rule (route becomes
`override`), and because the resolver is the single source of truth, the coverage
tooling reclassifies automatically.

**Why:** the keyword rules are deliberately greedy for breadth; a student concept
sharing the "learning" stem with an adult-career bucket needs an explicit
override, not a rule change (changing the rule would ripple across many tags).

**How to apply:** to verify a remap, replay `POST /api/capadex/concern/analyze`
with the concern_id + age/persona and read `clarity_source` + the questions.
Confirm the chosen sibling's master family overlaps the target age AND its
clarity content is the right persona/topic (sample it in SQL first).
