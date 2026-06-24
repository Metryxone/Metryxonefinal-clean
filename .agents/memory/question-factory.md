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
