# Founder Recommendation — Competency Framework

> Plain-language summary for a decision-maker. The detail behind every claim is in the five companion files in this folder. Nothing has been changed — this is a recommendation.

## The one-sentence finding
**Your competency engine works — but it's buried under three or four parallel copies of itself and dozens of empty "future" modules, so it *looks* far more complicated and broken than it actually is.**

## What's actually true
- There is **one real, working competency framework**: the curated genome of **419 competencies**, scored through a live pipeline (role → blueprint → questions → execution → scoring → employability index). It runs today.
- Sitting next to it are **two more things also called "competencies"**: the **O*NET reference library** (an imported external dictionary used to *estimate* role requirements — useful, but not what people are scored on) and a set of **empty legacy tables** that duplicate the real one.
- Around all of that are **~60–70 empty tables** (whole role taxonomies, market-intelligence layers, "graph/fusion/validity" analytics) that were built ahead of time and never switched on. They show up as blank admin screens that look like bugs.

## Why it feels confusing (the real problem)
1. **Three systems share the word "competency"** and nothing on screen explains how they relate — so the numbers never add up (419 vs 136 vs 0).
2. **Six different "role" systems** exist; three are completely empty.
3. **"Question Bank" appears in three different screens.**
4. **Empty future-modules look identical to broken screens.**

None of this is a data-integrity problem. It's a **clarity and surface-area problem.**

## What I recommend (in priority order)

**1. Name the three systems honestly, on screen.** Label the curated genome "Competency Master", the O*NET data "O*NET Reference Library", and stop showing the empty legacy copies. *Lowest effort, highest clarity gain.* (Reversible, UI-only.)

**2. Hide the empty modules.** The ~60–70 unpopulated tables (GRO roles, M3 market roles, the `assessment_*` v2 namespace, the `competency_graph/fusion/…` analytics) should disappear from the admin UI until they're actually activated. Keep the code — just stop rendering blank screens. *Reversible, no data loss.*

**3. Collapse the role sprawl.** Keep three role concepts on purpose (curated roles, O*NET reference roles, career-graph roles); permanently remove the empty GRO and legacy role shells. *Biggest reduction in moving parts.*

**4. Finish the two loose joints in the assessment flow.** (a) Make the runtime actually use the precise question blueprint instead of the legacy shortcut; (b) make a role's required *level* drive question *difficulty*. *These are finishing tasks on a working spine — not a rebuild.*

**5. Verify the analytics data is real.** The P4 analytics tables are populated (8,970–26,910 rows) but may be seeded demo data. Confirm before trusting them in production.

## What I recommend you DON'T do
- **Don't rebuild.** The core works; rebuilding would throw away a working scoring pipeline to solve a labelling problem.
- **Don't make O*NET the source of truth.** It's a reference layer; its taxonomy only overlaps yours ~13% and joins by name. Keep it as estimation, not scoring.
- **Don't merge the separate products** (LBI student index, CAPADEX behavioural) into competencies — they're independent by design.

## Bottom line for scalability
Today the framework is **pilot-scale** (45 assessment instances, 5 curated roles, empty norms). It will scale fine *technically* — the spine is sound. The thing that won't scale is the **confusion**: every new module added on top of an unlabelled three-system base makes it harder to reason about. **Fix the clarity first (steps 1–3, all reversible), then grow content (more roles, real norms) on the clean base.**

---
### Suggested next action
If you want, I can execute **Steps 1–2 only** (rename the three systems + hide empty panels) as a single **reversible, UI-only, flag-gated** change — no data deleted, fully revertible. Step 3 (collapsing the role sprawl) includes **permanent table removal, which is NOT reversible** — that would be a separate, approved task with `pg_dump` table backups first. Per your standing preference, I'll **stop for your approval** before any of it.
