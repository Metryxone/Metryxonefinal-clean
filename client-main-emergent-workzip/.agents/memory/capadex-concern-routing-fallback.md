---
name: CAPADEX concern routing fallback (resolveCapadexConcern)
description: Why the tier-4 keyword resolver must use age, not just persona key, to pick adult vs student report banks
---

# CAPADEX concern -> report bank routing

The `/session/start` resolver in `backend/routes/capadex.ts` is layered: tiers 1-3
match an exact/seeded `sdi_items.concern_name` bank directly; only when those return
**zero** questions does the tier-4 keyword fallback `resolveCapadexConcern()` run. So
any concern that has its own exact-name seeded bank (the 10 persona banks in
`backend/data/capadex-concern-banks.ts`) never touches the keyword fallback at all.

**Rule:** adultness in the fallback must be derived from age, not the persona key
alone. Anonymous / free-text entry sends an empty persona, so a persona-key-only
check (`persona ? ADULT_PERSONAS.has(persona) : false`) silently routes EVERY
concern down the student/child branch — that is the documented "adult Burnout ->
Exam Stress" mis-route. Treat age >= 24 (the AGE_BANDS adult boundary) as an adult
signal when no persona key is present.

**Why:** the mis-route is latent in environments where the exact-name banks exist
(harness already passes ~0.96 relevance there) — it only surfaces on the fallback
path or a DB without the seed. So a green simulation run does NOT prove the routing
logic is correct; verify the fallback directly with persona '' + an age, using a
free-text concern that has no exact bank.

**Don't over-tune the adult keyword map blindly:** naive adult routes can regress
(e.g. an adult "performance anxiety" -> "Work Stress" drops the 'anxiety' concept).
Probe each phrase before/after.

**Separate resolver — free-text → master concern_id (`resolveMasterConcernIdFromText`,
clarity pipeline, NOT the report-bank `resolveCapadexConcern`).** It gates the curated
clarity pipeline: typed concern text must score ≥60 against `capadex_concerns_master`
or the whole master+adaptive pipeline is skipped and EVERY user gets the generic static
fallback. The original literal-substring LIKE was the dominant cause of "irrelevant
clarify questions": "I feel stressed about my exams" matched 0 rows ("exams"≠"exam",
"stressed"≠"stress") → 50% < 60 → NULL. Fix = light stemmer (`stemConcernToken`) +
curated synonym groups (`RESOLVER_SYNONYM_GROUPS`, e.g. exam/stress/anxiety/career) +
per-token OR-group parameterized SQL + widened haystack incl. `domain` + age tie-break.
Keep the ≥60 floor (precision, no fabrication). **Thread `ageBandToRange(...)` into BOTH
resolver call sites** (`/analyze` AND `/adaptive-next`) so tie-breaks stay aligned.
Verify a typed sentence resolves to `master_curated`, not just SQL row counts.
