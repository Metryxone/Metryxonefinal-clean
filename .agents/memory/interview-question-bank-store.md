---
name: Interview Question Bank store
description: How the interview-bank-admin CRUD, its DB table, and the voice screener share one question source.
---

# Interview Question Bank — DB store

`InterviewQuestionBankPage.tsx` (screen `interview-bank-admin`) was a fully-built CRUD UI whose
`/api/interview-questions` backend was never implemented → it 404'd ("Failed to load questions").
The backend now exists: `backend/routes/interview-questions.ts` (registered in routes.ts) over
`backend/services/interview-question-store.ts` (table `interview_questions`).

## Durable rules
- **Seed from the authored static bank, never fabricate.** The table seed-if-empty copies
  `getQuestionBank()` from `interview-question-bank.ts` and **preserves the `iqb-###` ids** so any
  voice-screening answers that already reference those ids stay consistent. New rows get a uuid.
- **One source of truth for runtime.** The voice screener reads `selectScreeningQuestions(pool, …)`
  from the store (not the static `buildQuestionSet`), so admin edits actually affect screening —
  which is what the page promises. It **falls back to the static `selectQuestions()`** on empty/error
  so screening never hard-breaks. `dimensionForCategory` is exported from the bank so DB rows derive
  the same five voice dimensions.
- **Shared platform-wide mutable catalog ⇒ writes are super-admin-only.** Reads (GET list/stats) are
  `requireAuth` (employers + admins view the page); POST/PUT/DELETE are `requireAuth + requireSuperAdmin`.
  **Why:** the bank is global (read by every employer's screening); without the admin gate any
  authenticated employer could mutate/delete questions platform-wide (broken access control). The page
  is linked from BOTH the employer portal and the super-admin sitemap, which is what hid the gap.

## Contract (frontend expects)
- `GET /api/interview-questions?active=true|all&limit=N` → `{success, questions: IQuestion[]}`
- `GET /api/interview-questions/stats` → `{success, total, active, industries[], roles[], byCategory, byIndustry, byLevel}` (literal `/stats` registered before `/:id`).
- `POST` create · `PUT /:id` partial update (also the isActive toggle) · `DELETE /:id`.
- IQuestion is camelCase; store maps snake_case columns ↔ camelCase in `rowToApi`.
