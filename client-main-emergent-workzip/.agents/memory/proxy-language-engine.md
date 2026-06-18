---
name: Proxy-language reframe engine
description: How clarity questions are reframed self→proxy; the subject-first anchoring rule and audit-cleanup discipline.
---

# Proxy / perspective rewrite engine

The proxy reframe lives in a **pure module** `backend/services/proxy-language-engine.ts`
(`rephraseForProxy`, `proxySubjectNoun`, `normalizeSelfReport`), imported by the analyze route.
Fixtures: `backend/tests/proxy-language-engine.test.ts` (`npx tsx`). Keep the route free of inline
copy — the module is the single source of truth.

## Subject-first anchoring (the durable rule)
The named subject ("Abhi", "your child") may only land on a **subject-position** `you`.
A `you` that is the **object of a preposition** (`inside you`, `for you`, `to you`) is NEVER the
anchor — it degrades to `them`, *even when it is the first `you` in the string*.

**Why:** the "inside Abhi" bug — naive "name the first `you`" produced "What happens inside Abhi
when they lose focus?" (antecedent-less `they`, name on a prep object). Anchoring on the first
**subject** `you` yields "…inside them when Abhi loses focus?".

**How to apply:** when editing the reframer, anchor by string index but only over subject-position
matches; treat prep-object `you` as a later-reference degrade. When the anchored subject is a bare
pronoun (no following aux), conjugate the following **lexical present verb** to 3rd-person singular
via `PRESENT_VERBS` (lose→loses, perform→performs…) or the named clause reads ungrammatically.

## normalizeSelfReport
Runs before the proxy passes AND on self/learner copy: expands contractions (I'm/I'll/I've/I'd),
maps first→second person (I→you, my→your, myself→yourself), repairs be-verb agreement
(you am→you are, you was→you were). This is the runtime reframe — it does the work with no DB write.

## Audit-cleanup discipline (793-stem cleanup → 0 applied, all deferred)
`backend/scripts/audit/proxy-language-cleanup.mjs` **reuses the audit detector + normalizeSelfReport**
so its dry-run re-detects EXACTLY the audited count (parity = the detector is honest). `--apply`
updates both `capadex_clarity_questions` AND the source `audited_clarity_questions.csv`; must be
idempotent. Preserve the phase1 audit snapshot as the pre-cleanup baseline; write post-cleanup audit
to phase3 (don't clobber the baseline).

**The headline finding (do not "fix" by re-applying rewrites):** there are NO plain mis-authored
first-person stems to flip. Every first-person clarity stem in this dataset is **deliberately-quoted
inner-speech**, which is CORRECT as authored for self mode. So the safe cleanup applies **0 destructive
rewrites** — net audit stays 793→793 (deferrals aren't rewrites, by design). 506 reflexive no-ops
(engine handles at runtime) + 287 deferred to human authoring (27 quoted/attributed + 260
missing-anchor). The real user-facing proxy fix lives in the runtime ENGINE, not in DB edits.

## Do NOT blindly flip every first-person token (the quoted-self-talk trap)
A first-person `I/my` in a clarity stem is almost always **quoted inner self-talk** (or sits under an
explicit third-person subject). Flipping it to second person breaks the sentence:
- quoted self-talk: `feel "I am not good enough"` → flip gives quoted second-person, odd in self mode
  and BROKEN in proxy (`feel "Abhi are not good enough"`). The original first-person is correct for self.
- attributed thought / hypothetical: `thoughts like I'll do it later`, `thoughts about what if I fail`.
- third-person subject present: `How often does the child feel I cannot focus` → flip gives
  `the child feel you cannot focus` (subject/pronoun clash; engine only rewrites `you` → permanently broken).

**Why:** an initial pass auto-flipped 25 such rows; ALL reverted byte-for-byte in DB+CSV vs git HEAD.
**How to apply:** the `isAttributedOrThirdPersonSelfTalk` guard routes these to
`quoted_or_attributed_self_talk_needs_authoring` (manual-review), never an auto-rewrite. Reframing
quoted inner-speech for proxy/learner is a human-authoring problem, never a mechanical flip.

## ENCODING TRAP — Windows-1252 smart quotes as C1 control points
This dataset wraps inner-speech in **Windows-1252 smart quotes stored as the C1 control code points
`U+0093`/`U+0094`** (apostrophe `U+0092`), NOT ASCII `"` or Unicode `\u201C/\u201D`. So:
- The quote-detection regex MUST include `\u0091-\u0094` or it silently misses ~all quoted self-talk
  (this is exactly the bug that let the 25 wrong flips through twice).
- DB stores them UTF-8-encoded (`c293`/`c294`); the CSV on disk holds the same UTF-8 bytes. Reading the
  CSV as cp1252 double-mojibakes them (`Â“`); read/compare as UTF-8.
- Already-applied rewrites vanish from re-detection (the flipped text no longer matches the
  first-person detector) → dry-run looks falsely clean. **Always diff against git HEAD, not just the
  dry-run**, to find rows you already changed. Verify reverts with `encode(convert_to(question,'UTF8'),'hex')`.

## Known follow-up (documented, out of scope)
Clarity **options** still read first-person in proxy mode ("My mind drifts off") — by the documented
"ids/options untouched" contract. Don't silently expand scope to rewrite options.
