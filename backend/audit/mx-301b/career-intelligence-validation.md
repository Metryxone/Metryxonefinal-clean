# Career Intelligence Validation

_MX-301B — Career Intelligence Activation · generated 2026-06-25T14:20:22.508Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input (the data each engine must receive):** `onto_competency_score_runs`=1 (precise ledger), `onto_competency_profiles`=1 (domain-proxy ledger), profile completeness=85%. A real assessment exists — so every downstream engine HAS data to receive.

Validates the Phase-4 Career Intelligence chain — Career Readiness, Promotion Readiness (roadmap progression + career signal), Learning Roadmap, and Skill Gap — each composing the candidate's competency assessment into a developmental (never hiring) view.

**Summary:** 2/6 engines RECEIVED measured assessment data · 4 wired but no measured data.

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Readiness | EI / competency ledger | `GET /api/career-readiness/user_4286d980cc6cc038` | `FF_CAREER_READINESS` | 401 | 200 | ✅ RECEIVED | surfaces measured data (unweighted mean of 1 measurable present-readiness block(s): current) _(overall=81.2 (Advanced))_ |
| Promotion Readiness (roadmap) | readiness + role gap | `GET /api/career-roadmap/user_4286d980cc6cc038/progression` | `FF_CAREER_ROADMAP` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false (no measured data for candidate) |
| Promotion Readiness (signal) | EI / competency ledger | `GET /api/career-signal/user_4286d980cc6cc038` | `FF_CAREER_SIGNAL` | 401 | 200 | ✅ RECEIVED | surfaces measured data _(signals[7])_ |
| Learning Roadmap | skill-gap → roadmap | `GET /api/learning-path/user_4286d980cc6cc038` | `FF_LEARNING_PATH` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false — no measurable roadmap |
| Skill Gap | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038` | `FF_CAREER_GAP` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false — role gap not measurable |
| Skill Gap (prioritization) | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038/prioritization` | `FF_CAREER_GAP` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false — Not measurable — no role gap to prioritise. |

## Honest "wired but no measured data" findings

These engines are correctly wired and secured (the candidate reference reaches them) but they surface no measured data for this candidate. Each reason below is the ENGINE'S OWN honest output — never a fabricated value:

- **Promotion Readiness (roadmap)** — engine reports measurable:false (no measured data for candidate)
- **Learning Roadmap** — engine reports measurable:false — no measurable roadmap
- **Skill Gap** — engine reports measurable:false — role gap not measurable
- **Skill Gap (prioritization)** — engine reports measurable:false — Not measurable — no role gap to prioritise.

---
_Honesty contract: RECEIVED requires the engine's own `measurable` signal AND the candidate's measured values flowing through; a default/fabricated composite or a null-actuals comparison is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._
