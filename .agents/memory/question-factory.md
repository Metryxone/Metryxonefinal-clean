---
name: Question Factory (MX-101X)
description: Flag-gated DRAFT-only competency question generation + approval workflow + honest coverage dashboard; the status-column constraint trap that shapes its whole lifecycle design.
---

# Question Factory (MX-101X)

Flag-gated (`questionFactory`, default OFF) pipeline that generates DRAFT-only competency
questions grounded in the live `onto_competencies` genome, tracks provenance/confidence/
quality-review state, routes through human approval, and reports honest live coverage
separately from a draft pipeline. Service `services/question-factory.ts`, routes
`routes/question-factory.ts`, panel `superadmin/QuestionFactoryPanel.tsx`.

## The status-column constraint trap (the load-bearing lesson)
`competency_question_templates` has **two pre-existing, mutually-overlapping CHECK
constraints** on `status`:
- `competency_question_templates_status_check` → {draft, approved, **deprecated**}
- `cqt_status_chk` → {draft, approved, **rejected, archived**}

A row must satisfy BOTH, so the intersection locks `status` to **{draft, approved}** only.
Any other value (rejected/archived/deprecated) violates one constraint and 500s.

**Why it matters:** the existing `competency-questions.ts` PATCH advertises
rejected/archived as allowed statuses — it is **latently broken** and only works because
those paths were never exercised. Don't copy that pattern.

**How to apply:** carry the full lifecycle in the NEW `quality_review_status` column
(pending_review → in_review → needs_revision → approved / rejected / retired) + the genome
map's `active` flag. Keep `status` ∈ {draft, approved}. The live selector
(`/api/competency/questions/select`) filters `status='approved'` and does NOT join
`map.active`, so reject AND retire must drop `status` back to 'draft' (not 'archived') to
remove a question from the live bank. Retire = `quality_review_status='retired'` +
`active=false`, row preserved (never deleted).

## Coverage honesty
Live coverage counts ONLY `active AND status='approved'`. Drafts are a SEPARATE pipeline
axis (`status='draft' AND quality_review_status IN (pending_review,in_review,needs_revision)`
— rejected/retired also sit at status='draft' so they MUST be excluded by the review-status
filter or they pollute the pipeline/queue counts). Generation can never change coverage;
only a human approve flips a question live (status=approved + map active=true).

## Other notes
- Byte-identical OFF: flag gate returns 503 before any auth/DB/DDL; `ensureQuestionFactorySchema`
  reached only on POST paths; the admin tab is conditional-spread on the `/feature-flag` probe.
- Global `app.use('/api/admin', requireAuth→requireSuperAdmin)` fires before these routes, so
  unauth always 401 (even the `/enabled` "no-auth" probe) — the authenticated super-admin probe
  still distinguishes 503 OFF vs 200 ON.
- AI path (`generateAIPack`) is inert without `OPENAI_API_KEY` (returns ok:false, never throws).
- Smoke `scripts/smoke-question-factory.ts` writes to the shared live bank — it MUST clean up
  every row it creates (template_key prefix `qf-`); a failed mid-run leaves orphans that inflate
  the next baseline (purge `template_key LIKE 'qf-%'` + their map rows to restore).
- GET-never-writes: the four read endpoints (`/coverage`, `/drafts`, `/competencies`, `/batches`)
  must NOT call `ensureQuestionFactorySchema` (that CREATEs = a write). They probe with
  `isFactorySchemaReady` (`to_regclass` + `information_schema.columns`, NO DDL) and degrade to
  honest-empty before the first POST has created the additive columns/ledger. Live coverage is
  computable pre-schema (it reads only the pre-existing `status='approved'` + `map.active`), so
  `/coverage` still returns real live numbers with `schema_initialized:false` + empty pipeline.
- `listDrafts` default MUST exclude non-actionable rows: reject/retire keep `status='draft'` (the
  CHECK-constraint workaround), so an unfiltered draft query pollutes the review queue with
  rejected/retired questions. Default to `quality_review_status IN (pending_review,in_review,
  needs_revision)`; only an explicit `review_status` filter surfaces rejected/retired.

## MX-101A — Coverage Population Program (built ON TOP of MX-101X)
Additive program that drives the existing factory across the FULL 419-competency genome and
reports honest 3-axis coverage. Service `services/question-factory-population.ts` (8 exports),
routes `/api/admin/question-factory/population/*` (7 GET + POST `/population/run`), scripts
`scripts/mx101a-population-run.ts` + `mx101a-reports.ts`, reports `backend/audit/mx-101a/*.md`,
panel = new Founder/Population/Quality tabs in `QuestionFactoryPanel.tsx`. Same `questionFactory`
flag; OFF byte-identical.
- **THREE separate axes — never composite**: Draft Coverage (≥1 actionable draft), Approved
  Coverage (≥1 approved+active), Assessment-Ready (≥4 approved+active spanning ≥2 types AND ≥2
  difficulties — rigorous gate). A full draft run moves ONLY the draft axis; approved/ready stay
  exactly where they were (the honesty proof: post-run Approved=7/1.7%, Ready=0 UNCHANGED).
- **DEFAULT_PACK=6** (likert/mcq/sjt × difficulty); 419×6 ≈ 2,514 drafts. `generateBulkPopulation`
  is idempotent/resumable: SKIP any comp already holding ≥6 actionable drafts (re-run is a no-op,
  never duplicates). Reversible: provenance `template_generated`, `template_key LIKE 'qf-%'`.
- **Role-DNA denominator = 21** (DISTINCT comps in `onto_role_weights`, not the 44 rows). This is
  the consumer-coverage axis (Employer + Career read the same set). future_skills tier is honestly
  0 (`onto_competency_type_map` has 0 future_skills rows).
- **Quality checks are STRUCTURAL only** (duplication, prompt length, option count, best_option
  bounds, confidence/spread) — content relevance needs human review. The template generator
  legitimately repeats the SAME prompt across difficulty bands of one competency → ~420 duplicate
  prompt-groups is an HONEST pre-existing finding (status 'review', NOT a bug to fix here).
- Population GET handlers to_regclass-probe + degrade; POST `/run` is the only ensure-schema path.
  Targets (TARGETS const): approved coverage 80%, assessment_ready 350 comps, role_dna 95%.

## MX-101B — Assessment Readiness Acceleration (flag `assessmentReadiness` / FF_ASSESSMENT_READINESS)
- **The machinery, not the coverage**: builds the human/SME path to turn MX-101A drafts into
  assessment-ready coverage. Agent NEVER auto-approves and NEVER inflates — the live count rises
  ONLY when a human bulk-approves through the workbench. `bulkReview` over an EXPLICIT id set is the
  sole coverage-changing op; empty/no-valid-id sets are REFUSED (no blanket approval).
- **certification ≠ approval ≠ readiness** — three distinct stages: `question_certifications`
  (append-only per-question 5-dim cert ledger: Duplication/Difficulty/CompetencyAlignment structural
  high-confidence + Relevance/Clarity heuristic proxies labelled lower-confidence; AI hooks inert,
  never fabricate) PRE-QUALIFIES but never flips coverage. Approval (existing reviewQuestion) moves
  coverage. Readiness composes both. A `certifiedOnly` bulk fast-track skips uncertified drafts.
- **Readiness invariant (proven by smoke): `quality_assured ≤ base_ready ≤ approved ≤ draft`** — these
  are the Coverage⟂Confidence axes kept SEPARATE (quality_assured is the cert-floor-met subset of
  base_ready; never composite them). Criteria: min_approved=4, min_types=2, min_difficulty_bands=2,
  quality_structural_floor=70.
- **never-throws over uuid casts**: any handler/service whose SQL casts ids to `uuid`/`uuid[]` must
  validate FIRST — routes reject a malformed `:id` with a 400 (not 500); `bulkReview` partitions
  non-uuid ids into `errors[]` and only queries the valid ones (a bad id never aborts the valid set,
  and `ANY($1::uuid[])` can't throw). UUID_RE lives in both the route file and the service.
- **Tables**: `question_certifications` + `qf_coverage_snapshots` (append-only trend series, empty
  <2 snaps). Lazy ensure-schema POST-only; GET handlers to_regclass-probe + degrade. Flag-OFF is
  byte-identical incl. SCHEMA (no DDL fires OFF). Routes base `/api/admin/assessment-readiness`
  (sits under the global `/api/admin` auth gate → unauth is 401 before the flag gate, like
  question-factory; `/enabled` is the no-auth probe the UI uses to hide sections).
- Smoke `scripts/mx101b-smoke.ts` writes the SHARED live bank → purges its own `qf-%` rows + certs
  (by certified_by marker) + snapshots + batches and rolls coverage back to baseline (zero residue).
