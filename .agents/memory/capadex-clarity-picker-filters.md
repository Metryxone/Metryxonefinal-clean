---
name: CAPADEX clarity-question picker age/persona filters
description: Why pickQuestionsFromMaster's age/persona filters must anchor on the bridge tag (not concern_cluster) and treat persona as soft
---

# pickQuestionsFromMaster age/persona eligibility

`pickQuestionsFromMaster` (clarify Tier-1, master-curated) filters clarity rows by
age band + persona cohort. Clarity rows have no age/persona columns of their own, so
eligibility is recovered by joining each row back to `capadex_concerns_master`.

**Rule 1 — anchor the recovery join on the BRIDGE TAG, never on the cluster string.**
`capadex_concerns_master.concern_cluster` is NOT a unique key; the same cluster text
is reused verbatim across unrelated concerns spanning different personas/ages (the
master and clarity CSVs were authored independently). Joining
`concern_cluster = q.concern` lands on an arbitrary cross-tag twin master row, so a
question's age/persona gets read from the wrong concern. Correct join is
`master.relational_bridge_tag = q.master_bridge_tag` (the clarity row's own family).

**Rule 2 — persona is a SOFT preference, age is a HARD gate.**
~63% of bridge-tag families (207/328) carry ONLY provider/lens personas in the master
taxonomy ("Career Counsellor", "Behavioral Mentor", "Self Discovery", …) — none of
which appear in any end-user `PERSONA_COHORT`. A hard persona gate therefore drops
EVERY curated question for those families → dead-ends to the generic static fallback
(the user-reported "repeating and irrelevant" clarify questions). Fix: after the
persona-ON attempt under-fills (<2), retry the OWN tag with persona relaxed before the
orphan-tag fallback. Safe because (a) the concern was already persona-vetted at
selection time via PERSONA_AFFINITY in `/api/concerns/search`, and (b) the (still
hard) age filter prevents cross-persona age leakage.

**Why:** symptom was a 17-24 student picking "Transition & Change Adaptability"
(CONCERN_CAR_1406, TRANSITION_READINESS, age 15-30, persona "Career Counsellor")
getting 0 master survivors → static fallback. Bridge-tag anchor → 25 age-eligible
rows; persona-relaxed retry surfaces them. Verify with a real `/analyze` POST
(`clarity_source` must read `master_curated`, not `static_fallback`), not just SQL.

**Granularity is FAMILY-level by design, not per-question (don't re-litigate).** The
recovered age/persona eligibility is intentionally family-level: a clarity row passes
if ANY master row in its bridge tag satisfies the age/persona predicate. A reviewer
will flag this as a leakage risk and suggest ANDing a per-question concern anchor
(`master.concern_cluster = q.concern` scoped within the tag). That is INFEASIBLE here:
only ~19% of clarity rows (2,768/14,294) have a within-tag `concern_cluster = q.concern`
match (master + clarity CSVs were authored independently with non-aligning concern
strings), so the AND-join would force the tag-only fallback for ~80% of rows anyway —
fragile and mostly inert. Clarity questions are authored at the bucket/family level,
and clarity rows carry NO age column and a different `concern_id` ID-space than master,
so no better per-question signal exists. Real leak exposure is also low: 82% of tags
(268/327) are single age-band; only ~23 tags (7%) mix child→adult masters. Verify any
"add per-question filter" suggestion against these two numbers before acting.

**Rule 3 — the static safety net must be persona/age-aware too (not just Tier-1).**
The base `academic`/`general` clarification sets are student-flavoured ("while studying").
A working professional or proxy rater who drops through to the static fallback should
not see study phrasing. `pickQuestions(category, persona, …)` routes via
`personaTrack(persona)` (learner → existing student sets; professional → work-framed
override; proxy → neutral override) through `FALLBACK_BY_TRACK[category][track]`. learner
has no override and falls through unchanged (byte-identical legacy behaviour preserved).

**Rule 4 — out-of-band age reroute is correct but rarely fires on current data.**
Before the final `valid.length<2 return []` in `pickQuestionsFromMaster`, when ageRange
is known, a last-resort SQL looks for a topical sibling (same `concern_cluster` OR
`domain`) whose family age band overlaps the user AND whose bridge tag has clarity
coverage, then `runByTag(sibling,false)`. On the present taxonomy NO such cross-age
topical sibling-with-coverage exists (clusters are persona/age-siloed), so it degrades
to the now-age-aware static fallback (Rule 3). Keep it — it's safe future-proofing that
activates as the taxonomy gains adult-aged topical siblings. Do NOT relax its age guard
to force it to fire: showing teen-flavoured questions to a 45+ user is worse than the
age-appropriate generic fallback.

**Rule 5 — master_curated firing is NOT the same as topically relevant; soft-rank
clarity rows by the SPECIFIC concern, not just the bridge tag.** Bridge tags are coarse
(~56 buckets): ACADEMIC_COGNITIVE alone pools ~618 clarity rows across many distinct
concerns (focus, procrastination, exam strategy, conceptual gaps…), of which only ~55
are actually about focus/concentration. Ordering purely by `question_weight + random()`
made an "Academic Focus" concern draw generic procrastination/motivation rows — user
reports "irrelevant" even though `clarity_source = master_curated`. Fix: derive topical
match-stems from the concern's OWN `display_label`+`concern_cluster` (drop filler via
CONCERN_LABEL_STOPWORDS, reuse `expandResolverToken` synonym groups e.g.
focus↔concentrat↔attention↔distract), score each clarity row by stem hits in its
question text (`POSITION` over a `$N::text[]`), then take topical rows first and BACKFILL
with generic family rows to quota (never hard-filter → never dead-ends). No topical
match → every row is "generic" → collapses to the prior shuffled pool. **This is a
deliberate selection-quality change, NOT a byte-identical-when-off addition** (it also
widened the candidate LIMIT) — don't claim parity.

**Rule 6 — youth adult-work demotion must be gated by the concern's OWN theme.** Because
clarity rows have no per-row age/persona column (Rules 1–4), a topically-matched but
adult/workplace-flavoured row ("executive focus / workplace concentration") can out-rank
student-framed rows for a sub-24 user. Demote (never drop) rows matching an
adult-work-marker regex when `bandMax < 24`. BUT gate it off when the concern itself is
work/career themed (`conceptIsWorkThemed`): for a youth career-guidance concern (e.g.
"Career Direction Clarity", 18-24) the words career/professional ARE the subject, so
demoting them would bury the most relevant rows. The demotion only guards OFF-topic adult
leakage, not on-topic career content.

**Rule 7 — the ROOT-CAUSE fix for cross-subtopic bleed is a persisted concern→clarity
sub-topic MAP, not more runtime ranking.** Rule 5's per-question relevance ranking is a
heuristic that can never catch a sub-topic question whose individual wording lacks the
keyword (e.g. "How ready are you to actively improve?" under "Poor Concentration During
Studies" has no focus token). The structural problem: clarity rows link to master ONLY
by the coarse bridge tag; their finer curated `concern` TEXT label ("Poor Concentration
During Studies", "Lack of Academic Focus") is the real sub-topic, but master has no link
to it (clarity `concern_id` is a DIFFERENT id-space — only 1/2489 overlap). Fix = table
`capadex_concern_clarity_map` (engine `services/concern-clarity-mapping-engine.ts` + seed
`scripts/seed-concern-clarity-map.ts`), computed once: substring-match master concept
stems (display_label+concern_search+cluster, synonym-expanded) against each clarity
`concern` LABEL within the same bridge tag; cap 8; no match → single `orphan` marker row.
Picker loads `mappedConcerns` and RESTRICTS via `AND ($7::text[] IS NULL OR LOWER(TRIM(
q.concern)) = ANY($7))`. Restricting on the LABEL pulls in ALL of a sub-topic's questions
(incl. keyword-less ones) with zero sibling noise — what runtime ranking couldn't do.
**Key gotchas:** (a) match on the LABEL not the question text — the label is curated, the
prose is noisy; (b) use SUBSTRING not stem-set-equality — the light stemmer gives
"concentra" vs "concentrat", so set-equality fails but `"concentration".includes(
"concentrat")` works; (c) make synonym-group membership PREFIX-robust (base.startsWith(m)
|| m.startsWith(base), len≥4) or the stemmer inconsistency silently drops the focus↔
concentrat bridge; (d) the map's clarity texts belong to the OWN tag → pass `null` for
orphan-tag/sibling reroutes (different tag) or they empty the pool; (e) add an own-tag
UNRESTRICTED broaden retry that fires ONLY when a mapping was applied, before leaving the
correct tag; (f) graceful: missing table / no mapping / orphan-only → `mappedConcerns`
null → byte-identical to the pre-map whole-tag picker; wrap the lookup in try/catch so it
never throws into `/analyze`. **Known drift (accepted):** the engine's stem/synonym util
is a self-contained copy of the route's `conceptStemsFromConcern`/`expandResolverToken`
(services must not import routes) AND is prefix-robust where the route's is exact-lookup
+ engine adds `concern_search` to its stem source — so offline restriction can diverge
from runtime relevance ordering over time. Eliminate by extracting one shared stem util
if you touch either side. Verify with a real `/analyze` POST using the CORRECT envelope
field names (`raw_concern_text`/`primary_persona`/`is_proxy`/`target_age_band`/
`assessee_name`/`contextual_anchor`/`concern_id`) — wrong field names silently route to
category `general` + static fallback and look like a picker failure.

**Out of scope / flagged (data-authoring follow-ups, not code):** (1) TRANSITION_READINESS's
clarity content is leadership-flavoured (HLG_001 stems) even for graduating-student
concerns — a seed mismatch, NOT mechanically fixable without fabricating questions
(forbidden). (2) The ~23 child→adult mixed tags would benefit from age-tagging clarity
rows to enable true per-question age filtering. Both need human authoring; the picker
fix gets users topically-curated questions today.
