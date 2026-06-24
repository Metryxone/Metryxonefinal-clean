# MX-101X — Competency Assessment Coverage Expansion (Question Factory)

**Status: PARTIAL — infrastructure complete, content not yet generated/approved. Flag default OFF.**
**Founder guardrails honoured: Additive · Reversible · Flag-Gated · byte-identical OFF · never auto-approve · never inflate coverage · never delete (archive only) · AI path wired-but-inert.**

Generated for MX-101X. All numbers below are measured against the live shared DB at build time.

---

## 1. What was built

A **Question Factory**: a flag-gated pipeline that generates **DRAFT-ONLY** competency
assessment questions grounded in the real `onto_competencies` genome, tracks
provenance / confidence / quality-review state on every question, routes each through a
human approval workflow, and surfaces a coverage dashboard that keeps **honest live
coverage** strictly separate from the **draft pipeline**.

Generation is incapable of changing live coverage. A question only becomes live when a
super-admin **approves** it — that single action flips `status='approved'` and activates
its genome map link. Nothing else touches the assessment bank.

### Components
- **Schema** (`migrations/20260720_question_factory.sql`, mirrored by a lazy
  `ensureQuestionFactorySchema()` reached only on POST paths): additive columns
  `provenance`, `confidence_score`, `quality_review_status` on
  `competency_question_templates` (+ indexes), and a `question_factory_batches` ledger.
  Existing rows backfilled conservatively from `source`
  (manual→human_authored, seed→imported, generated→template_generated).
- **Flag** `questionFactory` (default **OFF**, env `FF_QUESTION_FACTORY`).
- **Service** `services/question-factory.ts` — generate (template), generate-AI (inert),
  import, review state-machine, retire (archive), coverage, draft queue, batch ledger,
  genome competency picker.
- **Routes** `routes/question-factory.ts` (`registerQuestionFactoryRoutes`), all under
  `/api/admin/question-factory`, flag-gated.
- **Admin UI** `superadmin/QuestionFactoryPanel.tsx`, mounted in `SuperAdminDashboard`
  only when the `/feature-flag` probe returns ok (tab absent when OFF).

---

## 2. Honest baseline (measured live)

| Metric | Value |
|---|---|
| Genome competencies (`onto_competencies`, active) | **419** |
| Competencies with ≥1 approved+mapped question (live assessable) | **7** (1.7%) |
| Competencies assessment-ready (≥4 approved+mapped) | **2** (0.5%) |
| Question templates total | **88** (57 approved / 31 draft) |
| Genome map rows | 25 across 7 competencies |
| Factory batches generated | 0 |

Provenance after backfill: human_authored 44 · imported 34 · template_generated 10.
Review status: approved 57 · pending_review 31.

**This is the honest gap MX-101X exists to close.** The factory builds the *machinery*
to expand coverage safely; it does not (and must not) manufacture coverage on its own.
Closing the 419 → 7 gap is human-reviewed content work that happens *after* this merge.

---

## 3. Guardrail verification

| Guardrail | How it holds | Evidence |
|---|---|---|
| **Additive** | Only ADD COLUMN + new table + new flag/service/routes/panel. No existing table/route/UI changed. | migration + diff |
| **Byte-identical OFF** | Flag gate returns 503 before any auth/DB/DDL touch; ensure-schema only on POST; GET reads NEVER write (they `to_regclass`/`information_schema` probe via `isFactorySchemaReady` and degrade to honest-empty pre-schema); nav tab + render gated on the probe. | OFF curl → 401 (global admin gate) / 503 when authed |
| **Never auto-approve** | Generation writes `status='draft'`, `quality_review_status='pending_review'`, map link `active=false`. Approval is a separate, super-admin-only POST. | smoke: generate leaves coverage unchanged |
| **Never inflate coverage** | Live coverage counts ONLY `active AND status='approved'`. Drafts reported on a separate PIPELINE axis. | smoke: 3→3 on generate, 3→9 only after approving 6 |
| **Never delete** | Retire sets `quality_review_status='retired'` + deactivates the map link; row persists. | smoke: retire drops coverage by 1, row remains |
| **Reversible** | Drop the flag → OFF; drop the 3 columns + ledger table → original schema. | migration is plain ADD COLUMN / CREATE TABLE |
| **AI inert without key** | `generateAIPack` returns `{ok:false, error:'openai_not_configured'}` (HTTP 422); never throws, never fabricates. | openai package not installed |

### Smoke test (`scripts/smoke-question-factory.ts`) — ALL PASS
Exercises the real service against the live DB and cleans up every row it creates:
generate → all DRAFT/pending_review/template_generated with INACTIVE map links and no
coverage change → approve pack → coverage rises by exactly the pack size → retire one →
coverage drops by 1, row retained → cleanup restores baseline.

---

## 4. Framework constraint discovered (important)

`competency_question_templates` carries **two pre-existing, mutually-overlapping CHECK
constraints** on `status` whose intersection locks the column to **{draft, approved}**
(`..._status_check` allows draft/approved/deprecated; `cqt_status_chk` allows
draft/approved/rejected/archived). Any value outside the intersection violates one of
them — so the existing `competency-questions.ts` PATCH that advertises
`rejected`/`archived` is **latently broken** (out of MX-101X scope; not touched).

To stay strictly additive (no constraint/framework change), the Question Factory carries
the full lifecycle in the **new `quality_review_status` column** (pending_review →
in_review → needs_revision → approved / rejected / retired) plus the genome map's
`active` flag. `status` only ever holds `draft` or `approved`. Because the live selector
(`/api/competency/questions/select`) filters `status='approved'`, reject and retire drop
`status` back to `draft` so the question leaves the live bank while the row is preserved.

---

## 5. What remains (not done by this task)

- Human-reviewed generation/approval of real question content to actually raise the
  419 → 7 coverage gap (the factory enables this; it does not perform it).
- AI generation requires `OPENAI_API_KEY` (path is wired and inert until then).
- The latent two-constraint conflict on `competency_question_templates.status` is a
  pre-existing data-integrity issue worth a separate cleanup task.

**STOP for founder approval before merge/deploy.**
