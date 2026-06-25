# MX-301B — Career Intelligence Activation · Combined Summary

_generated 2026-06-25T15:09:47.526Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input:** score_runs=1, profiles=1, profile completeness=85%.

## Success criterion: every downstream engine receives assessment data correctly

- ✅ RECEIVED (surfaces measured assessment data): **8/12**
- ➖ wired + secured, no measured data (honest dependency): **2**
- 🔒 flag-gated (not activated): **2**
- 🚫 forbidden (self-scope): **0**
- ❌ broken: **0**

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Readiness | EI / competency ledger | `GET /api/career-readiness/user_4286d980cc6cc038` | `FF_CAREER_READINESS` | 401 | 200 | ✅ RECEIVED | surfaces measured data (unweighted mean of 2 measurable present-readiness block(s): current, role) _(overall=88.1 (Advanced))_ |
| Promotion Readiness (roadmap) | readiness + role gap | `GET /api/career-roadmap/user_4286d980cc6cc038/progression` | `FF_CAREER_ROADMAP` | 401 | 200 | ✅ RECEIVED | surfaces measured data _(readiness_score=95)_ |
| Promotion Readiness (signal) | EI / competency ledger | `GET /api/career-signal/user_4286d980cc6cc038` | `FF_CAREER_SIGNAL` | 401 | 200 | ✅ RECEIVED | surfaces measured data _(signals[7])_ |
| Learning Roadmap | skill-gap → roadmap | `GET /api/learning-path/user_4286d980cc6cc038` | `FF_LEARNING_PATH` | 401 | 200 | ✅ RECEIVED | surfaces measured data (roadmap measurability + recommendation-join density) _(steps[1])_ |
| Skill Gap | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038` | `FF_CAREER_GAP` | 401 | 200 | ✅ RECEIVED | candidate's derived per-competency actual levels flow into the role-gap comparison _(total_gaps=1 classified_pct=100; most_material=Agile Collaboration actual=3/req=4)_ |
| Skill Gap (prioritization) | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038/prioritization` | `FF_CAREER_GAP` | 401 | 200 | ✅ RECEIVED | deterministic prioritization over the candidate's measured gaps _(items[1] now=1 next=0 later=0; top=Agile Collaboration priority=3)_ |
| Employability Index | EI / competency ledger | `GET /api/career-intelligence/user_4286d980cc6cc038` | `FF_CAREER_INTELLIGENCE` | 401 | 200 | ✅ RECEIVED | surfaces measured data (domain_proxy) _(readiness_score=95; focus_areas[1]; overall_ei=81.2)_ |
| Employer Match (talent matching) | precise comp_* levels vs role | `GET /api/talent-matching-engine/candidate/user_4286d980cc6cc038/role/role_pm` | `FF_TALENT_MATCHING` | 401 | 200 | ➖ WIRED · no measured data | route consumes the candidate reference and resolves the role requirements, but the candidate's actuals are all null (evidence_mix.measured=0) — the assessment carries domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs _(evidence_mix measured=0 inferred=0 none=6; match_pct=0 confidence_pct=0)_ |
| Interview Readiness | operator interview scores | `GET /api/interview-intelligence/job/mx301b-probe-job/candidate/user_4286d980cc6cc038/evaluation` | `FF_INTERVIEW_INTELLIGENCE` | 401 | 200 | ➖ WIRED · no measured data | wired + secured, but Interview Readiness is OPERATOR-INPUT driven (arithmetic over panelist-entered scores) — it does NOT consume the competency assessment ledger, and no interview scores have been recorded for this candidate _(interviews_scored=0 total_scores=0)_ |
| Career Builder (activate) | materializes activation rows | `POST /api/v2/career-builder/activate/user_4286d980cc6cc038` | `FF_CAREER_BUILDER_ACTIVATION` | 503 | n/a | 🔒 FLAG OFF (not activated) | feature flag OFF (503) — activation route gated before any write (read-only safe) |
| Career Builder (intelligence) | composed activation scores | `GET /api/v2/career-builder/intelligence/user_4286d980cc6cc038` | `FF_CAREER_BUILDER_ACTIVATION` | 503 | 503 | 🔒 FLAG OFF (not activated) | feature flag OFF (503) — engine not activated |
| Career Passport (overview) | synced platform snapshot | `GET /api/passport/overview` | `FF_CAREER_PASSPORT` | 401 | 200 | ✅ RECEIVED | passport sections carry synced platform data _(section_total=5 completeness=15)_ |

## Root-cause of the non-RECEIVED engines (honest, not failures)

- **Developmental chain RECEIVES the assessment** (Career Readiness, Skill Gap + prioritization, Promotion roadmap/signal, Learning Roadmap, Employability Index): once the role anchor resolves, these engines DERIVE per-competency actual levels from the candidate's domain-proxy / EI ledger and surface real measured gaps (e.g. Agile Collaboration actual=3 vs required=4) — developmental signals only, never hiring predictions.
- **Employer Match (talent matching) — honest precise-competency ceiling**: the hiring-facing matcher compares against precise per-competency (`comp_*`) levels by design, and the candidate's assessment carries domain-proxy / EI data, not those precise levels (`evidence_mix.measured=0`). It therefore reports 0 match / 0 confidence rather than fabricate — the documented precise⟂domain-proxy ledger split, not a wiring break.
- **Interview Readiness** is operator-interview-input driven (arithmetic over panelist-entered scores); it does not consume the competency assessment ledger, and no interview scores exist for this candidate.
- **Career Builder** is flag-gated OFF (503) — honestly NOT activated.

## To activate the gated engine(s) (founder decision — NOT auto-applied)

Enable in DEV (reversible; production stays OFF):

```
FF_CAREER_BUILDER_ACTIVATION=1
```

## Deliverables

- `backend/audit/mx-301b/career-intelligence-validation.md` — Career Intelligence Validation
- `backend/audit/mx-301b/employability-validation.md` — Employability Validation
- `backend/audit/mx-301b/career-builder-validation.md` — Career Builder Validation
- `backend/audit/mx-301b/passport-validation.md` — Passport Validation

---
_Verdict: no engine is broken — every wired, activated engine is reachable and consumes the candidate reference. The EI/domain-proxy chain RECEIVES measured data; the precise-competency match, interview input and the flag-gated Career Builder are honest, named dependencies — never fabricated. Read-only, additive, PII-masked. NO DEPLOY._
