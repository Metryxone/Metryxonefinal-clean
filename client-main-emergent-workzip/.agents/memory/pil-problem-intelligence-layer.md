---
name: CAPADEX Problem Intelligence Layer (PIL)
description: How the additive PIL is phased and how Phase 1 concern classification decides categories.
---

# CAPADEX Problem Intelligence Layer (PIL)

PIL is a strictly **ADDITIVE extension layer** on top of CAPADEX. It must never
modify existing CAPADEX tables/data (concerns, bridge tags, clarity questions,
signals, scoring, reports). Each phase **STOPS and waits for explicit human
approval** before the next is built — do not auto-queue or pre-build later phases
(the spec literally says "DO NOT PROCEED"). Quality over quantity, human-first,
deterministic rule-based (no external AI).

**Why:** it is a psychometric platform; reproducibility + human realism beat
record volume, and human sign-off gates each phase.

## Phase 1 — concern classification (done, awaiting approval)
- New table `concern_classification` (id, concern_id, concern_name,
  classification, confidence_score, reasoning, created_at); UNIQUE(concern_id);
  CHECK on the 6 classes and on confidence ∈ [0,1].
- Pure engine `backend/services/pil/concern-classification-engine.ts`
  (`classifyConcern`, `summarize`); runner `backend/scripts/pil/run-concern-classification.ts`
  (`--mode=replace|upsert`, `--dry-run`); test `backend/tests/concern-classification-engine.test.ts`.
- **Dominant signal = the LAST word (head noun) of `concern_category`** mapped via
  a curated vocab dict → one of {Capability, Problem, Behavior, Trait, Outcome,
  Risk}. Other category tokens (weight 3) and display_label/cluster cues (weight 1)
  only break ties / rescue unknown suffixes.
- **Ties resolve to Problem first, Capability last** (`TIE_ORDER`) — the master is
  overwhelmingly problem-framed, so an ambiguous tie must NOT default to Capability.
- Honest shape (2489 rows): ~78% Problem, then Outcome/Behavior/Trait/Capability/Risk
  in single digits. Capability is deliberately rare — that's the true data shape,
  not a bug to "balance".
- Review artifact: `exports/pil_phase1_concern_classification.csv` (full per-row).

**How to apply:** when extending PIL, keep writes confined to NEW tables, reuse the
pure engine from both scripts and any route, and pause for approval at each phase
boundary rather than chaining phases.

## Phase 1 validation audit (the core unresolved decision)
Audit tool: `backend/scripts/pil/audit-phase1-classification.ts` (read-only;
artifacts → `audit/pil_phase1/`). It validates each row semantically from the
**display_label** (polarity + capability cue), independent of the concern_category
the classifier used.
- **Headline finding (robust):** ~27% of all concerns (674) have a positively
  capability-framed display_label but are NOT classified Capability; **608 = ~31%
  of all Problem labels** are such (e.g. label "Self-Directed Learning Skills" →
  classified Problem because its category is "Self-Learning Deficit"). The
  classifier mirrors the **deficit-framed category naming**, not the experience.
- **The real issue is a TAXONOMY DESIGN choice, not just a bug:** a concern can be
  framed as a deficit-state (Problem) OR the underlying construct (Capability) —
  e.g. "Presentation Anxiety" on capability "Presentation Skills". Reclassifying is
  arbitrary until the human picks the semantic contract (deficit-state vs
  capability-construct vs dual-axis). **Do not auto-reclassify before that decision.**
- **Audit method caveats to always disclose:** the strict/lenient % is a LEXICAL
  proxy (model-vs-model), not human gold labels; `judge()` for neutral Problem rows
  re-uses concern_category suffix (partial non-independence, inflates Problem
  "Correct"); "100% Problem" domain counts are inflated by many 1-row domains.
**Why:** Phase 1 is the foundation for the whole PIL, so a 27% framing mismatch must
be resolved by an approved semantic contract before archetypes (Phase 2) are built.

## Phase 1.5 — concern ontology normalization (done, awaiting approval)
Resolves the Phase-1 framing mismatch by reclassifying off the **display_label NAME's
semantics**, not the deficit-framed `concern_category` suffix. 4 NEW additive tables:
`normalized_concern_ontology`, `capability_problem_map`, `construct_similarity_map`,
`concern_families`. Pure engine `services/pil/concern-ontology-engine.ts`, runner
`scripts/pil/run-ontology-normalization.ts` (`--dry-run`, replace mode, CSV →
`audit/pil_phase1_5/`), migration `20261116_…`, test (18 groups).
- **THE data-shape key insight:** each master row holds **3 framings of ONE
  construct** — `display_label` (capability/goal), `concern_cluster` (deficit-action
  "Difficulty Managing…"), `concern_category` (deficit-state). There are NO separate
  capability-vs-problem rows. So 1.5B `capability_problem_map` is **WITHIN-ROW**
  (`capability_concern_id == problem_concern_id`); the mapping reason explains the
  duality. Do not look for cross-row cap↔problem joins — they don't exist.
- **classifyTypeSemantic cascade (on the NAME):** Risk-anywhere → **distress-LEADING
  subject** (anxiety/fear/uncertainty/… as `toks[0]` → Problem, guarded BEFORE outcome
  so "Anxiety About Future Success" can't flip to Outcome/Capability) → Outcome cue
  anywhere → head-noun VOCAB → Behavior/Trait/Problem cue → Capability cue / leading
  action verb → polarity. Spec vocab tweaks: resilience/adaptability/curiosity→Trait;
  readiness/success/achievement→Outcome.
- **Construct keys for similarity/families are built from `display_label` ONLY**
  (fallback cluster). Including `concern_cluster` injects scaffolding tokens
  ("difficulty", "weak", "ability") that falsely bridge unrelated concerns into one
  blob — strip them via `KEY_DROP` + a `FAMILY_NAME_STOPWORDS` guard on family naming.
- **similarPairs requires `minShared ≥ 2` overlapping topical tokens** (not just
  Jaccard ≥ threshold). A 1-token key like `{emotional}` is a HUB that links to every
  `{emotional, X}` at Jaccard 0.5 → one giant component. minShared=2 shatters hub-stars
  while keeping genuine multi-token matches. Dups Jaccard ≥ 0.7, families ≥ 0.45.
- The ~185-member "Emotional Family" that remains is a **genuine dense emotional-
  regulation supercluster**, not a scaffolding artifact — broad thematic curation is a
  human follow-up, don't force-split it by tuning thresholds.
- **Write path is one transaction** (client BEGIN/TRUNCATE+4 inserts/COMMIT, ROLLBACK
  on error) so a mid-run failure never half-refreshes the extension tables.
- Honest shape (2489): Capability ~42% / Problem ~44% / Outcome ~7% / Trait ~4% /
  Behavior ~2% / Risk ~0.3%; 905 cap↔problem pairs, 215 dup pairs, 295 families,
  ~901 Problem→Capability flips vs Phase 1 (the headline normalization impact).

## Phase 1.6 — Behavioral Intelligence Layer (observable-behavior evidence)
- Inserts the missing layer Capability ↔ **Observable Behavior** ↔ Problem. 6 additive
  tables: behavior_library, behavior_categories, capability_problem_behavior_map,
  behavior_quality_scores, behavior_duplicate_review, family_behavior_coverage.
- **Honesty model is the whole point**: behaviors come from a CURATED token-keyed
  pattern library (problem-side observable frames). A concern that matches <3 curated
  frames is padded with generic-category fallbacks that the quality gate DELIBERATELY
  rejects (4 sub-scores 1-5, reject total <15). Never fabricate fake-specific behaviors
  to hit a coverage number — let the family audit surface weak coverage instead.
  **Why:** quality > coverage is the project canon; a low readiness score is a real
  finding to present for approval, not something to tune away.
- Severity = observable FREQUENCY adverb (Occasionally/Frequently/Consistently), NOT
  vague intensity — keeps it measurable. Age personalization via a SLOT lexicon
  ({task}/{setting}/{peers}/{evaluation}/{authority}) resolved per band; frames carry
  slots so one construct yields a genuinely different real-world line per life stage.
- **FK id resolution**: behavior_library uses SERIAL behavior_id; chunked inserts don't
  RETURNING. Resolve ids AFTER insert via `SELECT behavior_id, concern_id,
  behavior_statement` keyed on the UNIQUE(concern_id, behavior_statement) — then insert
  quality_scores + the cap-problem-behavior map. All inside the one txn.
- The cap_problem_behavior_map = the 905 within-row cap↔problem pairs × ACCEPTED
  behaviors × 3 severities × 5 age bands. capability_concern_id == problem_concern_id
  (same master row), so UNIQUE(behavior_id, severity, age_band) holds.
- Outcome (frame library ~66): 7935 behaviors / 2489 concerns (4496 accepted), 29730
  map rows, 33% concerns ≥3 accepted, 87.5% caps/problems mapped, readiness ~67/100.
  An arbitrary "exactly N frames" target is NOT a real spec requirement — improve weak
  families by adding genuinely-observable frames for frequent uncovered tokens, guard
  with a `BEHAVIOR_FRAMES.length >= N` floor, never chase a magic number.

## Phase 2 — Archetype Intelligence (done, awaiting approval)
Discovers ~22 human-development archetypes (curated token + primary-behavior-category
signatures) that explain the ecosystem; each concern deterministically assigned via a
relationship-grounded match text (concern_name + capability/problem framing) + a
behavior-category alignment bonus. Anchorless concerns are FLAGGED unmatched, never
force-fit. Pure engine `backend/services/pil/archetype-intelligence-engine.ts`, runner
`backend/scripts/pil/run-archetype-intelligence.ts`, migration
`20261118_pil_archetype_intelligence.sql` (6 new tables), test (18, npx tsx).
- **Pure bottom-up clustering is RULED OUT** — Phase 1.5 produced a giant "Emotional"
  blob; curated top-down archetype anchors + similarity-capture cross-check instead.
- **Grounding provenance is mandatory & honest** (`GroundingSource`: `direct_cpb` |
  `propagated` | `name_only`, persisted on `archetype_concern_map.grounding_source`).
  An architect Fail on "name-only matching" is NOT fixed by tuning — fix it by (a)
  emitting per-row provenance, (b) propagating behavior evidence through the
  relationship graph, (c) folding relationship-grounding into the headline so name-only
  HONESTLY DEPRESSES the score. Readiness fell 81.5→71 and that is the correct outcome.
- **Propagation** (runner, not engine): a concern with no direct framing/behaviors
  (`isDirect = framing.has(id) || behByConcern.has(id)`) inherits behavior categories
  from grounded `construct_similarity_map` neighbours + `concern_families` co-members,
  the family path GATED by `family_behavior_coverage>0` (this is what finally uses the
  6th input). `effectiveBehavior()` prefers direct → propagated → none.
- **The 6-input grounding ceiling is real**: ~59% of assignments stay `name_only`
  because those concerns have NO capability/problem/behavior relationship in ANY of the
  6 inputs — they cannot be relationship-grounded without fabricating data. Report it,
  don't force it. Higher grounding needs a NEW upstream input phase, not a heuristic.
- Empirical: 1964 assigned / 525 unmatched of 2489; grounding 701 direct_cpb + 103
  propagated + 1160 name_only (40.9% relationship-grounded); coherence 0.677, balance
  0.968, similarity capture 89.3%, readiness 71/100. NO interventions/coaching/search.
- **Pre-existing dev tables predate new columns**: `CREATE TABLE IF NOT EXISTS` won't
  add a column — lazy ensureSchema needs an idempotent `ALTER TABLE ... ADD COLUMN IF
  NOT EXISTS` + a `pg_constraint`-guarded ADD CONSTRAINT, or the second persist 42703s.

## Phase 2.1 — archetype validation & gap resolution (done, awaiting approval)
- **The behavior-alignment bonus is an AMPLIFIER, never a standalone**: granting
  `BEHAVIOR_WEIGHT` with 0 token matches let a behavior-only candidate (score 0.3)
  outrank a legitimately token-anchored one (1 token = 0.28) and steal the "best" slot
  → the concern was then wrongly flagged unmatched. Fix is one clause: bonus requires
  `matches > 0`. **Why:** behavior category alone is not evidence the concern belongs to
  THAT archetype; only a construct token anchors topicality. **How to apply:** any
  alignment/recency/prior bonus added to a token-overlap scorer must be gated on the
  primary signal being non-zero, or it becomes a backdoor force-fit.
- **The fix is provably safe (no churn)**: every already-ASSIGNED concern had ≥1 token,
  so its score is unchanged; the bonus gate only changes which candidate wins the "best"
  slot for the recoverable group → zero reassignment of prior matches, only recoveries.
- Vocabulary gaps were resolved by adding ONLY genuine construct tokens to EXISTING
  archetypes (e.g. problem-solving/solving/self-reflection/self-evaluation →
  critical_reflective_thinking; note-making/self-learning/self-study/vocabulary →
  learning_comprehension). NO new archetypes, NO force-fit.
- **Anchorless residual is the honest ceiling, report it**: 525→338 unmatched (187
  recovered = 159 override-bug + ~28 vocabulary), 0 recoverable left. The remaining 338
  have NO construct token at all — mostly templated scaffolding tokens (display/label/
  whose/category/deficit-state) + "Visibility into X" admin Outcomes that are genuinely
  not archetypable. Adding tokens for those WOULD be force-fitting.
- **Recovering name-only concerns HONESTLY DROPS mean coherence** (0.677→0.571) and
  leaves readiness ~flat (71.0→71.7) even though coverage 78.9→86.4% and grounding
  40.9→45.6%. That flatness is the correct finding: the gap was a correctness bug +
  vocabulary, NOT a readiness lever — do NOT tune coherence to manufacture a rise.
- **Shared loader prevents drift**: input load + context build (incl. propagation)
  extracted to `backend/services/pil/archetype-data-loader.ts`; BOTH the runner and the
  read-only `backend/scripts/pil/diagnose-archetype-gaps.ts` import it so prod and the
  diagnostic can never compute different pools.
- Empirical after fix: 2151 assigned / 338 unmatched of 2489; grounding 845 direct_cpb
  + 136 propagated + 1170 name_only (45.6% relationship-grounded); coherence 0.571,
  balance 0.970, similarity capture 87.6%, readiness 71.7/100. Tests 18→20 (added
  override-bug regression + vocabulary anchor). NO interventions/coaching/search.

## Phase 2.2 — Archetype Finalization (governance override layer + SuperAdmin UI)
- **Runner TRUNCATEs all archetype tables every run; human decisions must NOT live there.**
  Durable `archetype_governance_decisions` (concern_id UNIQUE, decision_type CHECK
  reassign|reject|resolve_unmatched|approve, target nullable, active bool) is NEVER
  truncated and is re-applied as an OVERRIDE LAYER on top of the deterministic pass each
  run. **Why:** keeps the algorithm byte-identical AND human-first AND surviving re-runs.
  **How to apply:** any human curation over a rebuilt-from-scratch table belongs in a
  separate durable table replayed as a post-pass, never inline in the rebuilt table.
- **Zero decisions ⇒ byte-identical baseline** (2151/338, readiness 71.7, 13/3/6). The
  override pass (`applyGovernance`, pure) is the ONLY thing that can move a concern;
  override sets grounding/method = `human_override`. Verified: resolve→2152/337 survives
  rebuild, retract→2151/338.
- **Public envelope is snake_case everywhere.** The governance service returns camelCase
  (`concernId`/`decisionType`/…); the `/decisions` route must MAP to snake_case before
  responding or the panel renders blank rows and retract calls `/governance/undefined`.
  Architect caught this — every other route already used snake_case; keep the contract uniform.
- **Lazy-bootstrap read paths too.** No migration runner here (canonical SQL mirrors lazy
  ensureSchema). Read endpoints that SELECT the governance table (`/stats`, `/decisions`)
  must `ensureGovernanceSchema(pool)` first, or a fresh deploy 500s on panel load before
  any write/rebuild path creates the table.
- Pipeline extracted to `archetype-pipeline.ts` (compute/persist/rebuild/ensureSchema);
  runner is now a thin wrapper → single source of truth, no prod-vs-script drift.
- Scope held: NO problem libraries / search intents / interventions / coaching. UI is
  read + govern only. 6 weak archetypes surfaced for human review, NOT auto-fixed —
  honest ceiling. Tests: archetype-governance.test.ts 35/35 (override survives recompute,
  reject→unmatched, zero-decisions unchanged). STOP for human approval after this phase.

## Phase 2.3 — Behavioral Grounding & Archetype Stabilization (done, awaiting approval)
Strengthens archetype QUALITY before any Problem Intelligence. Strictly additive/deterministic,
no AI, no fabricated behavior. Two honest levers + read-only stabilization enrichment.
- **Grounding is at the DATA CEILING (~48%), proven before building.** Behavior evidence covers
  only 31.8% of the ontology (792/2489) and barely overlaps the 1170 name_only concerns: a
  Cap→Problem edge grounds 0, multi-hop similarity grounds 1, and the ONLY real lever is relaxing
  the redundant `coverage_pct<=0` family-skip gate (grounds ~49). **Why:** the `grounded.length>0`
  guard already requires a real direct-behavior sibling, so the coverage_pct metadata gate just
  blocked legitimate propagation. **Do not chase a higher grounding %% — it needs a NEW upstream
  evidence input, not a heuristic.** Result 45.6→47.9%.
- **Coherence must use `effectiveBehavior` (direct OR propagated), not direct-only** — assignment
  already trusts propagated evidence, so the validation denominator was inconsistent. Switch the
  coherence denominator to members with an effective dominant (`effGrounded`); KEEP
  `behavior_grounded_count` = direct-only (column meaning preserved). name_only members contribute
  to NEITHER numerator nor denominator → never inflate, still depress the ceiling. Mean coherence
  0.5711→0.6384 (real, not tuned).
- **Weak ≠ one thing — split it into an action axis.** Pure helpers `classifyWeakReason`
  (`underpopulated` >priority> `low_distinctiveness` >else> `missing_behavioral_evidence`) +
  `recommendStabilization` → `merge:<target>` | `author_behavioral_evidence` | `review_*` | `none`.
  Merge target = the archetype this one's external similarity pairs MOST leak into (derived, never
  hardcoded). **Recommendations are for the EXISTING Phase 2.2 human governance layer — NEVER
  auto-applied/auto-merged.** Persisted on `archetype_validation` (3 new cols, ensureSchema ALTER +
  migration `20261120_…` parity). `grounding_ceiling` = share with ANY behavior path = max grounding
  without fabrication.
- **Leak-target argmax MUST be deterministic** (architect-caught): `construct_similarity_map` is
  loaded without ORDER BY, so a first-seen max over the leak Map yields run-dependent `merge:<target>`
  on count ties. Fix = pure `pickLeakTarget` with lexicographic-smallest-key tie-break + `ORDER BY
  concern_a, concern_b` on the SQL. **How to apply:** any argmax feeding a persisted/surfaced
  recommendation needs a total-order tie-break, not iteration order.
- Empirical after: 2151/338 unchanged, grounding 47.9%, mean coherence 0.6384, strong/moderate/weak
  14/3/5, readiness 73.6. Honest recs: negotiation_advocacy→`review_low_distinctiveness` (no external
  pairs at all → no merge target, correct), curiosity_innovation→`merge:learning_comprehension`,
  focus/expectations/adaptability→`author_behavioral_evidence`. Tests 20→25. STILL no problem
  libraries / search intents / interventions / coaching. STOP for human approval.

## Phase 3 — Human Intelligence Layer (additive; 22 archetypes → plain-language)
- **Curated authored packs are legitimate curation, NOT fabrication** (same canon as behavior FRAMES):
  per-archetype `HUMAN_PACKS` (problems in student/professional/general voice, 5 stakeholder narratives
  student/parent/teacher/counselor/professional, 5 emotion categories
  frustration/fear/motivation/growth_signal/success_indicator). Engine is pure (no DB/AI/randomness);
  runner reads `archetype_library` only and writes only the 3 new tables. An archetype with no curated
  pack gets ZERO rows — never auto-filled.
- **Three honest validators, allowed to FAIL — never tune to force a pass.** `checkRealism` (psychometric
  jargon ban set + 4–45 word natural length), `isAligned` (touches that archetype's lay `ALIGNMENT_LEXICON`),
  `detectDuplicates` (Jaccard ≥0.6). Empirical: realism 100%, dup 0%, alignment 89.7% (n=418 = 88 problems
  +220 emotions+110 narratives), all PASS vs 85/85/<10 targets.
- **Alignment lexicon must exclude generic META tokens** (architect-caught inflation risk): a single-hit
  lexicon check is gameable if the lexicon contains words that match MANY archetypes. Removed `work`,
  `professional`, `problem`, `want`, `people` (and `professional` from networking) → alignment 90.4%→89.7%
  (the honest drop = ~3 lines that had ONLY a generic match). **How to apply:** every lexicon term must be
  distinctive of its archetype; meta words (`want`/`people`/`work`/`professional`/`problem`) belong in none.
- **Duplicate rate must be GLOBAL by construction, not per-list.** Original runner flagged dups only within
  each archetype's own list and shunted cross-archetype near-dups to a review CSV (excluded from the headline
  metric). Fix = compute `duplicateMembers` over the WHOLE corpus and overwrite per-line `is_duplicate` from
  it (subsumes within-archetype). Here it changed nothing (0 cross-archetype dups) but makes the metric honest
  for future regenerations.
- **Detail route must SELECT `archetype_name`** or the per-archetype drawer falls back to the raw snake_case
  key. Stored validation booleans (`realism_pass`/`aligned`/`is_duplicate`) are computed once at write time by
  the same validators and read verbatim by the panel — the unit test recomputes-from-text as the real guard.
- Files: `services/pil/human-intelligence-engine.ts` (engine+validators), `scripts/pil/run-human-intelligence.ts`
  (runner, --dry-run; CSVs→`backend/audit/pil_phase3/`), migration `20261121_pil_human_intelligence.sql`
  (canonical mirror of lazy ensureSchema), routes `routes/pil-human-intelligence.ts` (read-only, literal-CSV-
  before-`/:key`, 60s cache, formula-safe CSV), panel `superadmin/HumanIntelligencePanel.tsx`, tests
  `tests/human-intelligence-engine.test.ts` (12, `npx tsx`). STILL no search intents / interventions /
  coaching downstream. STOP for human approval.

## Phase 4 — Search Intent Intelligence Layer (additive; archetype → real search phrases)
- Curated authored TEMPLATES per (intent_type × stakeholder), filled from per-archetype `SEARCH_ANCHORS`
  (topic/youStruggle/childStruggle/goal/feeling/future) — same curation-not-fabrication canon as Phase 3.
  22 archetypes × 5 stakeholders × 5 intent types = 550 intents. Engine `services/pil/search-intent-engine.ts`
  is pure; runner reads `archetype_library` + `human_problem_library` and writes ONLY 4 new tables.
- **Diagnostic "does"-auxiliary templates need BASE-form anchors, not 3rd-person-singular.** The
  parent/teacher/counselor diagnostic templates render `why does {subject} ${childStruggle}?`, so a
  3rd-person-singular anchor ("freezes up", "studies hard") produces ungrammatical "why does my child
  freezes…". Fix = author `childStruggle` (and any anchor following an auxiliary) in BASE/infinitive form;
  the contract comment + a regex regression test (`tests/search-intent-engine.test.ts`) guard it. **Why:**
  the whole layer's value is realistic human search language — an auxiliary+inflected-verb mismatch silently
  tanks realism. **How to apply:** any template that puts an authored verb phrase after do/does/did must use
  base form; verify each anchor field against its EXACT surrounding template, not in isolation.
- **Duplicate metric scope is a deliberate, architect-blessed measurement choice (NOT gaming):** headline
  dup = redundant storage only = an identical phrase anywhere OR Jaccard≥0.6 within the SAME stakeholder.
  Cross-stakeholder reframings of one problem (parent vs student) are intended audience VARIANTS — recorded
  in `search_intent_duplicate_review` (kind='stakeholder', redundant=false) but EXCLUDED from the headline.
  Stakeholder-specific generation is an explicit requirement, so counting variants as dups would be wrong.
- **Voice→problem_id resolver avoids orphans by preference + skip, not fabrication:** `VOICE_PREF`
  student→student, professional→professional, parent/teacher/counselor→general, then general→any; an intent
  with no resolvable problem_id is SKIPPED, never linked to a placeholder. Verified 550 rows / 0 orphans.
- Three honest validators (allowed to FAIL): realism>85%, alignment>85%, dup<10%, plus intent_clarity and a
  Discovery Readiness Score (weighted realism/alignment/clarity/non-dup/coverage/link). Empirical: realism
  100%, alignment 99.5%, dup 2.2%, 0 orphans, DRS 99.6 — all PASS. Files: migration
  `20261122_pil_search_intent.sql` (canonical mirror of lazy ensureSchema), runner
  `scripts/pil/run-search-intent.ts` (`--dry-run`; single-txn TRUNCATE+chunked insert; CSVs→
  `backend/audit/pil_phase4/`; 7 analytics + DRS + STOP), routes `routes/pil-search-intent.ts` (read-only,
  literal-CSV-before-`/:key`), panel `superadmin/SearchIntentPanel.tsx`, tests (14, `npx tsx`). STILL no
  interventions / coaching downstream. STOP for human approval.

## Phase 5 — Intervention Intelligence Layer (additive; archetype → stakeholder-specific actions)
- Same curation-not-fabrication canon: curated per-(intervention_type × stakeholder) TEMPLATES filled from
  per-archetype `INTERVENTION_ANCHORS` (immediate/week/month/quarter/habit/skill + outcome/success/progress).
  **Anchors are pronoun-NEUTRAL — the stakeholder template owns the subject** (parent="help your child…",
  student="this week, you…"), so one anchor set serves all 5 audiences without grammar breakage. 22 archetypes
  × 5 stakeholders × 6 intervention types = 660 interventions. Engine `services/pil/intervention-intelligence-engine.ts`
  pure; runner reads `archetype_library`+`human_problem_library`, writes ONLY 5 new tables.
- **The 5th-table trap (root cause of the /duplicates=0 bug):** the spec listed `intervention_library` but that
  name ALREADY EXISTS as a CAPADEX runtime table, so the whole Phase-5 set is `pil_`-namespaced. The runner only
  ever writes 5 tables and emits the duplicate review as a CSV (audit-only); an early route version queried a
  non-existent 6th table `pil_intervention_duplicate_review` and silently returned empty (every `.catch(()=>[])`).
  **Fix = derive the duplicate review READ-ONLY at request time** from persisted `pil_intervention_library` via the
  engine's exported `auditDuplicates()` (`loadDuplicateReview(pool, force)`, 60s cache, deterministic ordering).
  **Why:** honoring "ONLY 5 tables" means review data is a projection, not storage. **How to apply:** never add a
  table just to back a read endpoint when the source rows already persist + a pure auditor exists; thread the
  stats `?refresh=1` flag all the way into the derived-review cache or `/stats` serves a stale dup breakdown.
- **HORIZON_DAYS=0 is legitimate for habit + skill_building** (ongoing, not a deadline) — a test asserting every
  type has a positive horizon is WRONG; only one-shot types carry a day count. Caught a false-red test that way.
- Five honest validators (allowed to FAIL): practicality>85%, actionability>85%, alignment>85%, dup<10%,
  coverage>95%, plus a Transformation Readiness Score. Empirical: practicality 100%, actionability 87.4%,
  alignment 91.1%, dup 0.15%, coverage 100%, 0 orphans, TRS 96.1, 110 complete pathways + 110 plans — all PASS.
  Dup breakdown = 1 redundant (headline) + 886 cross-audience stakeholder VARIANTS (excluded, by design, same as
  Phase 4). Files: migration `20261123_pil_intervention_intelligence.sql` (canonical mirror of lazy ensureSchema),
  runner `scripts/pil/run-intervention-intelligence.ts` (`--dry-run`; single-txn TRUNCATE RESTART IDENTITY CASCADE
  + chunked insert; CSVs→`backend/audit/pil_phase5/`; 7 analytics + TRS + STOP), routes
  `routes/pil-intervention-intelligence.ts` (read-only, literal-CSV-before-`/:key`, derived dup review), panel
  `superadmin/InterventionIntelligencePanel.tsx`, tests (22, `npx tsx`). STOP for human approval.
