# MX-301B — Career Intelligence Activation · Combined Summary

_generated 2026-06-25T14:20:22.512Z_

**Demonstration candidate:** `user_4286d980cc6cc038` (PII-masked).
**Assessment input:** score_runs=1, profiles=1, profile completeness=85%.

## Success criterion: every downstream engine receives assessment data correctly

- ✅ RECEIVED (surfaces measured assessment data): **3/12**
- ➖ wired + secured, no measured data (honest dependency): **7**
- 🔒 flag-gated (not activated): **2**
- 🚫 forbidden (self-scope): **0**
- ❌ broken: **0**

| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |
|---|---|---|---|---|---|---|---|
| Career Readiness | EI / competency ledger | `GET /api/career-readiness/user_4286d980cc6cc038` | `FF_CAREER_READINESS` | 401 | 200 | ✅ RECEIVED | surfaces measured data (unweighted mean of 1 measurable present-readiness block(s): current) _(overall=81.2 (Advanced))_ |
| Promotion Readiness (roadmap) | readiness + role gap | `GET /api/career-roadmap/user_4286d980cc6cc038/progression` | `FF_CAREER_ROADMAP` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false (no measured data for candidate) |
| Promotion Readiness (signal) | EI / competency ledger | `GET /api/career-signal/user_4286d980cc6cc038` | `FF_CAREER_SIGNAL` | 401 | 200 | ✅ RECEIVED | surfaces measured data _(signals[7])_ |
| Learning Roadmap | skill-gap → roadmap | `GET /api/learning-path/user_4286d980cc6cc038` | `FF_LEARNING_PATH` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false — no measurable roadmap |
| Skill Gap | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038` | `FF_CAREER_GAP` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false — role gap not measurable |
| Skill Gap (prioritization) | role requirements vs competencies | `GET /api/career-gap/user_4286d980cc6cc038/prioritization` | `FF_CAREER_GAP` | 401 | 200 | ➖ WIRED · no measured data | engine reports measurable:false — Not measurable — no role gap to prioritise. |
| Employability Index | EI / competency ledger | `GET /api/career-intelligence/user_4286d980cc6cc038` | `FF_CAREER_INTELLIGENCE` | 401 | 200 | ✅ RECEIVED | surfaces measured data (domain_proxy) _(overall_ei=81.2; overall_ei=81.2)_ |
| Employer Match (talent matching) | precise comp_* levels vs role | `GET /api/talent-matching-engine/candidate/user_4286d980cc6cc038/role/role_pm` | `FF_TALENT_MATCHING` | 401 | 200 | ➖ WIRED · no measured data | route consumes the candidate reference and resolves the role requirements, but the candidate's actuals are all null (evidence_mix.measured=0) — the assessment carries domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs _(evidence_mix measured=0 inferred=0 none=6; match_pct=0 confidence_pct=0)_ |
| Interview Readiness | operator interview scores | `GET /api/interview-intelligence/job/mx301b-probe-job/candidate/user_4286d980cc6cc038/evaluation` | `FF_INTERVIEW_INTELLIGENCE` | 401 | 200 | ➖ WIRED · no measured data | wired + secured, but Interview Readiness is OPERATOR-INPUT driven (arithmetic over panelist-entered scores) — it does NOT consume the competency assessment ledger, and no interview scores have been recorded for this candidate _(interviews_scored=0 total_scores=0)_ |
| Career Builder (activate) | materializes activation rows | `POST /api/v2/career-builder/activate/user_4286d980cc6cc038` | `FF_CAREER_BUILDER_ACTIVATION` | 503 | n/a | 🔒 FLAG OFF (not activated) | feature flag OFF (503) — activation route gated before any write (read-only safe) |
| Career Builder (intelligence) | composed activation scores | `GET /api/v2/career-builder/intelligence/user_4286d980cc6cc038` | `FF_CAREER_BUILDER_ACTIVATION` | 503 | 503 | 🔒 FLAG OFF (not activated) | feature flag OFF (503) — engine not activated |
| Career Passport (overview) | synced platform snapshot | `GET /api/passport/overview` | `FF_CAREER_PASSPORT` | 401 | 200 | ➖ WIRED · no measured data | passport row exists but is UNSYNCED — every section_count is 0; it requires an explicit POST /api/passport/sync to pull the competency/assessment snapshot in _(section_total=0 completeness=0)_ |

## Root-cause of the non-RECEIVED engines (honest, not failures)

- **Precise-competency consumers** (Skill Gap, Employer Match, and therefore Learning Roadmap, which is downstream of the gap/roadmap) receive the candidate reference and resolve the role requirements, but the assessment ledger carries **domain-proxy / EI** data — not the precise per-competency (`comp_*`) levels these engines compare against — so they honestly report no gaps / 100% gap / 0 match rather than fabricate. This is the documented precise⟂domain-proxy ledger split, not a wiring break.
- **Career Passport** is wired but UNSYNCED — it requires an explicit `POST /api/passport/sync` to pull the assessment snapshot into its sections.
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
_Verdict: no engine is broken — every wired, activated engine is reachable and consumes the candidate reference. The EI/domain-proxy chain RECEIVES measured data; the precise-competency chain, passport sync, interview input, and the flag-gated Career Builder are honest, named dependencies — never fabricated. Read-only, additive, PII-masked. NO DEPLOY._
