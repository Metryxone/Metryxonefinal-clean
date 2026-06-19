---
name: Competency Runtime T1–T4 — dynamic blueprints, reverse-scoring, question→competency mapping & precise scoring
description: Reverse-keyed Likert polarity design, the curation-migration drift that 500s all question authoring in dev, and the bulk-mapping + precise-scoring upgrade path
---

# T3/T4 — question→competency mapping & precise scoring upgrade
- The runtime scorer has TWO modes: domain-`PROXY` (7 bank codes crosswalk DOWN to 5 onto-domains — the legacy default) and `precise` (per-competency, driven by `onto_competency_question_map`). `scoreAssessment` emits `measurement: 'domain_proxy' | 'precise' | 'hybrid'` + a `competency_scores[]` array; empty map → `domain_proxy` + `competency_scores: []` = byte-identical legacy.
- **Auto-upgrade is data-driven, not a flag**: mapping a question (writing an active `onto_competency_question_map` row) is the ONLY action needed; the next score of any instance whose questions include mapped ones upgrades that competency to `precise`. Only the mapped questions PRESENT IN THE INSTANCE contribute — so a blueprint can show 2 precise competencies even if 7 are mapped (honest, not a bug).
- **Reuse the existing writer**: `bulkMapCompetencyQuestions(pool,{pairs,source})` in `services/assessment-foundation-mapping.ts` does normalise+dedupe, validates BOTH comp (onto_competencies.id) and question (uuid) existence, returns a `skipped[]` ledger with reasons (`competency_not_found`/`question_not_found`) — surface it, never silently drop. Routes: GET `/mapping-grid`, GET `/competency-map`, POST `/competency-map/bulk` (LITERAL before any `/:param`).
- **T4 seed already existed** — don't write a new one: `runAssessmentFoundationSeed(pool)` (`scripts/seed-assessment-foundation-mapping.ts`) calls `deriveCompetencyQuestionMap`, which resolves each template's OWN `competency_code` → competency by id-then-`canonical_name`, inserts `source='derived'`, and honestly skips unresolvable codes. In dev that yields 23 derived rows / 7 competencies; the 21 legacy SHORT codes (COM/EXE/LEA/TEC/EIQ/COG/ADP) are NOT onto ids and stay unresolved — mapping them would be fabrication.
- **API envelope double-wrap trap**: `/assessment-instances` (generate) returns the handler object `{ok,instance_id,...}` AND `wrap()` adds an outer `{ok,version,data}` → fields live at `data.instance_id`, `data.total_questions`, `data.questions`. The grid endpoint nests at `data.questions/competencies/total_*`.
- `onto_competencies` name column is `canonical_name` (NOT `name`); `onto_competency_question_map` has UNIQUE(competency_id, question_id) and the bulk upsert uses `(xmax=0)` to split inserted vs reactivated.

# T1/T2 below
---

# Reverse-scored (negative-polarity) questions
- Polarity lives in `template_body.reverse_scored` (JSONB, additive — NO column/migration needed).
- Inversion happens in `deriveOptions` (backend/services/competency-runtime.ts): Likert scores invert across the 0..100 scale (`100 - score`) so "Strongly Agree" on a negative item scores LOW. **Only Likert** — best-answer types (mcq/sjt/scenario/case/simulation/behavioral/communication) have a single correct answer, polarity is meaningless there, flag ignored → legacy byte-identical.
- The inverted scores are baked into the generated instance `questions` JSON at generate-time, so the score path (`scoreAssessment`) stays unchanged. RuntimeQuestion carries `reverse_scored?:true` for traceability (set only when Likert AND flagged).
- **Why:** keeps scoring path byte-identical; a question with no flag derives identical options to before.

# competency_question_templates curation-migration drift (dev)
- The live dev DB shipped without migration `20260524_competency_question_curation.sql`, so `source/reviewed_by/reviewed_at/updated_at/notes` columns were MISSING → every POST/PATCH on `/api/admin/competency-questions` 500'd with `column "reviewed_by" does not exist`. This silently breaks the ENTIRE question-authoring panel in dev.
- The competency-questions route has NO lazy ensure-schema for these cols (relies on the migration only). Fix = apply that idempotent `ADD COLUMN IF NOT EXISTS` migration to the DB.
- **How to apply:** if question CRUD 500s on a missing reviewer/source/notes column, run `psql "$DATABASE_URL" -f backend/migrations/20260524_competency_question_curation.sql` (additive, safe to re-run). Prod may need the same.
