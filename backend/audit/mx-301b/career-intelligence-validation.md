# Career Intelligence Validation

_MX-301B — Career Intelligence Activation · generated 2026-06-25T15:09:47.525Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input (the data each engine must receive):** `onto_competency_score_runs`=1 (precise ledger), `onto_competency_profiles`=1 (domain-proxy ledger), profile completeness=85%. A real assessment exists — so every downstream engine HAS data to receive.

Validates the Phase-4 Career Intelligence chain — Career Readiness, Promotion Readiness (roadmap progression + career signal), Learning Roadmap, and Skill Gap — each composing the candidate's competency assessment into a developmental (never hiring) view.

**Summary:** 6/6 engines RECEIVED measured assessment data.

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Readiness | EI / competency ledger | `GET /api/career-readiness/user_4286d980cc6cc038` | `FF_CAREER_READINESS` | 401 | 200 | ✅ RECEIVED | surfaces measured data (unweighted mean of 2 measurable present-readiness block(s): current, role) _(overall=88.1 (Advanced))_ |
| Promotion Readiness (roadmap) | readiness + role gap | `GET /api/career-roadmap/user_4286d980cc6cc038/progression` | `FF_CAREER_ROADMAP` | 401 | 200 | ✅ RECEIVED | surfaces measured data _(readiness_score=95)_ |
| Promotion Readiness (signal) | EI / competency ledger | `GET /api/career-signal/user_4286d980cc6cc038` | `FF_CAREER_SIGNAL` | 401 | 200 | ✅ RECEIVED | surfaces measured data _(signals[7])_ |
| Learning Roadmap | skill-gap → roadmap | `GET /api/learning-path/user_4286d980cc6cc038` | `FF_LEARNING_PATH` | 401 | 200 | ✅ RECEIVED | surfaces measured data (roadmap measurability + recommendation-join density) _(steps[1])_ |
| Skill Gap | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038` | `FF_CAREER_GAP` | 401 | 200 | ✅ RECEIVED | candidate's derived per-competency actual levels flow into the role-gap comparison _(total_gaps=1 classified_pct=100; most_material=Agile Collaboration actual=3/req=4)_ |
| Skill Gap (prioritization) | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038/prioritization` | `FF_CAREER_GAP` | 401 | 200 | ✅ RECEIVED | deterministic prioritization over the candidate's measured gaps _(items[1] now=1 next=0 later=0; top=Agile Collaboration priority=3)_ |

---
_Honesty contract: RECEIVED requires the engine's own `measurable` signal AND the candidate's measured values flowing through; a default/fabricated composite or a null-actuals comparison is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._
