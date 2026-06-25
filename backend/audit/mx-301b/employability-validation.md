# Employability Validation

_MX-301B — Career Intelligence Activation · generated 2026-06-25T14:20:22.510Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input (the data each engine must receive):** `onto_competency_score_runs`=1 (precise ledger), `onto_competency_profiles`=1 (domain-proxy ledger), profile completeness=85%. A real assessment exists — so every downstream engine HAS data to receive.

Validates the employability + hiring-facing engines — the Employability Index (composed career-intelligence envelope), Employer Match (talent matching against a real role), and Interview Readiness — and exactly which ledger each consumes.

**Summary:** 1/3 engines RECEIVED measured assessment data · 2 wired but no measured data.

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Employability Index | EI / competency ledger | `GET /api/career-intelligence/user_4286d980cc6cc038` | `FF_CAREER_INTELLIGENCE` | 401 | 200 | ✅ RECEIVED | surfaces measured data (domain_proxy) _(overall_ei=81.2; overall_ei=81.2)_ |
| Employer Match (talent matching) | precise comp_* levels vs role | `GET /api/talent-matching-engine/candidate/user_4286d980cc6cc038/role/role_pm` | `FF_TALENT_MATCHING` | 401 | 200 | ➖ WIRED · no measured data | route consumes the candidate reference and resolves the role requirements, but the candidate's actuals are all null (evidence_mix.measured=0) — the assessment carries domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs _(evidence_mix measured=0 inferred=0 none=6; match_pct=0 confidence_pct=0)_ |
| Interview Readiness | operator interview scores | `GET /api/interview-intelligence/job/mx301b-probe-job/candidate/user_4286d980cc6cc038/evaluation` | `FF_INTERVIEW_INTELLIGENCE` | 401 | 200 | ➖ WIRED · no measured data | wired + secured, but Interview Readiness is OPERATOR-INPUT driven (arithmetic over panelist-entered scores) — it does NOT consume the competency assessment ledger, and no interview scores have been recorded for this candidate _(interviews_scored=0 total_scores=0)_ |

## Honest "wired but no measured data" findings

These engines are correctly wired and secured (the candidate reference reaches them) but they surface no measured data for this candidate. Each reason below is the ENGINE'S OWN honest output — never a fabricated value:

- **Employer Match (talent matching)** — route consumes the candidate reference and resolves the role requirements, but the candidate's actuals are all null (evidence_mix.measured=0) — the assessment carries domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs
- **Interview Readiness** — wired + secured, but Interview Readiness is OPERATOR-INPUT driven (arithmetic over panelist-entered scores) — it does NOT consume the competency assessment ledger, and no interview scores have been recorded for this candidate

---
_Honesty contract: RECEIVED requires the engine's own `measurable` signal AND the candidate's measured values flowing through; a default/fabricated composite or a null-actuals comparison is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._
