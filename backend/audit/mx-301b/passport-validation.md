# Passport Validation

_MX-301B — Career Intelligence Activation · generated 2026-06-25T14:20:22.511Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input (the data each engine must receive):** `onto_competency_score_runs`=1 (precise ledger), `onto_competency_profiles`=1 (domain-proxy ledger), profile completeness=85%. A real assessment exists — so every downstream engine HAS data to receive.

Validates the Career Passport overview — the candidate-owned, self-scoped snapshot that syncs competency/assessment data from the platform (contact NEVER published).

**Summary:** 0/1 engines RECEIVED measured assessment data · 1 wired but no measured data.

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Passport (overview) | synced platform snapshot | `GET /api/passport/overview` | `FF_CAREER_PASSPORT` | 401 | 200 | ➖ WIRED · no measured data | passport row exists but is UNSYNCED — every section_count is 0; it requires an explicit POST /api/passport/sync to pull the competency/assessment snapshot in _(section_total=0 completeness=0)_ |

## Honest "wired but no measured data" findings

These engines are correctly wired and secured (the candidate reference reaches them) but they surface no measured data for this candidate. Each reason below is the ENGINE'S OWN honest output — never a fabricated value:

- **Career Passport (overview)** — passport row exists but is UNSYNCED — every section_count is 0; it requires an explicit POST /api/passport/sync to pull the competency/assessment snapshot in

---
_Honesty contract: RECEIVED requires the engine's own `measurable` signal AND the candidate's measured values flowing through; a default/fabricated composite or a null-actuals comparison is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._
