# Passport Validation

_MX-301B — Career Intelligence Activation · generated 2026-06-25T15:09:47.526Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input (the data each engine must receive):** `onto_competency_score_runs`=1 (precise ledger), `onto_competency_profiles`=1 (domain-proxy ledger), profile completeness=85%. A real assessment exists — so every downstream engine HAS data to receive.

Validates the Career Passport overview — the candidate-owned, self-scoped snapshot that syncs competency/assessment data from the platform (contact NEVER published).

**Summary:** 1/1 engines RECEIVED measured assessment data.

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Passport (overview) | synced platform snapshot | `GET /api/passport/overview` | `FF_CAREER_PASSPORT` | 401 | 200 | ✅ RECEIVED | passport sections carry synced platform data _(section_total=5 completeness=15)_ |

---
_Honesty contract: RECEIVED requires the engine's own `measurable` signal AND the candidate's measured values flowing through; a default/fabricated composite or a null-actuals comparison is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._
