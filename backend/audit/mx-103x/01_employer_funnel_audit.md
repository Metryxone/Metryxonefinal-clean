# MX-103X — Live Employer Ecosystem · Funnel Audit (Coverage ⟂ Confidence)

_Generated 2026-06-24T11:02:57.990Z · engine vmx-103x-1.0.0 · k_min=30 · read-only_

**Coverage** = the stage is exercisable end-to-end (gating flag ON + substrate present).
**Confidence** = the data behind it is trustworthy (real non-demo rows; calibration ≥ k_min).
The two axes are never composited. Demo rows (@example.com / `validation_loop_outcomes.is_demo`)
are counted separately and EXCLUDED from the confidence axis.

| # | Stage | Status | Coverage | Confidence | Flag(s) | Real | Demo |
|---|-------|:------:|:--------:|:----------:|---------|-----:|-----:|
| 1 | **Employer Onboarding** | empty | reachable | none | employerDashboards=on | 0 | 0 |
| 2 | **Create Job** | demo_only | reachable | demo_only | _none_ | 0 | 1 |
| 3 | **Role DNA** | operational | reachable | real | roleDNARuntimeEnabled=on | 5 | 0 |
| 4 | **Competencies** | operational | reachable | real | adaptiveIntelligenceFoundation=on, employerCompetencyHiring=on | 419 | 0 |
| 5 | **Assessment** | demo_only | reachable | demo_only | hiringAssessment=on | 0 | 40 |
| 6 | **Candidate Match** | demo_only | reachable | demo_only | talentMatching=on | 0 | 40 |
| 7 | **Interview Intelligence** | empty | reachable | demo_only | interviewIntelligence=on | 0 | 0 |
| 8 | **Hiring Decision** | demo_only | reachable | demo_only | hiringIntelligence=on | 0 | 34 |
| 9 | **Outcome Tracking** | empty | reachable | none | validationLoop=on, outcomeIntelligenceActivation=on | 0 | 0 |

### 1. Employer Onboarding
- **Criterion**: An employer org can be created/verified and members attached.
- **Status**: empty · Coverage=reachable · Confidence=none
- **Flags**: employerDashboards=on
- **Substrate**: employer_organizations=present, employer_members=present
- **Counts**: total=0, real=0, demo=0
- **Note**: No employer organizations yet — the single-tenant hiring path keys jobs on employer_id directly; the org spine is unseeded.

### 2. Create Job
- **Criterion**: A job/requisition can be created with role, skills and requirements.
- **Status**: demo_only · Coverage=reachable · Confidence=demo_only
- **Flags**: none (not flag-gated)
- **Substrate**: employer_jobs=present, job_postings=present
- **Counts**: total=1, real=0, demo=1
- **Note**: employer_jobs=1 (demo=1); additive job-posting-engine flag=on.

### 3. Role DNA
- **Criterion**: A role resolves to a competency requirement profile (Role DNA).
- **Status**: operational · Coverage=reachable · Confidence=real
- **Flags**: roleDNARuntimeEnabled=on
- **Substrate**: onto_roles=present, map_role_competency=present
- **Counts**: total=5, real=5, demo=0
- **Note**: roles=5, role→competency links=52362 across 1021 roles (reference data, not demo-scoped).

### 4. Competencies
- **Criterion**: The competency genome is queryable and joins to roles + candidates.
- **Status**: operational · Coverage=reachable · Confidence=real
- **Flags**: adaptiveIntelligenceFoundation=on, employerCompetencyHiring=on
- **Substrate**: onto_competencies=present
- **Counts**: total=419, real=419, demo=0
- **Note**: competency genome=419 (reference data); employer competency-match engine gated by employerCompetencyHiring.

### 5. Assessment
- **Criterion**: A candidate can be invited to and complete a hiring assessment that scores them.
- **Status**: demo_only · Coverage=reachable · Confidence=demo_only
- **Flags**: hiringAssessment=on
- **Substrate**: ep98_hiring_assessments=present, assessment_invites=present
- **Counts**: total=40, real=0, demo=40
- **Note**: invites=0; stored hiring assessments=40 (demo=40); invite/scoring engine gated by hiringAssessment.

### 6. Candidate Match
- **Criterion**: Candidates are ranked against a job via competency + behaviour match.
- **Status**: demo_only · Coverage=reachable · Confidence=demo_only
- **Flags**: talentMatching=on
- **Substrate**: employer_candidates=present, tig_intelligence=present
- **Counts**: total=40, real=0, demo=40
- **Note**: candidates=40 (demo=40); talent-intelligence-graph rows=40; talent-matching engine gated by talentMatching. employerCompetencyHiring match is separately available.

### 7. Interview Intelligence
- **Criterion**: An interview blueprint/scorecard is generated and interviews can be recorded.
- **Status**: empty · Coverage=reachable · Confidence=demo_only
- **Flags**: interviewIntelligence=on
- **Substrate**: employer_interviews=present, ep98_hiring_assessments=present
- **Counts**: total=0, real=0, demo=0
- **Note**: recorded interviews=0 (demo=0); stored interview blueprints=40; interview engine gated by interviewIntelligence.

### 8. Hiring Decision
- **Criterion**: A decision-support hiring recommendation is produced and a Hired/Rejected outcome can be recorded.
- **Status**: demo_only · Coverage=reachable · Confidence=demo_only
- **Flags**: hiringIntelligence=on
- **Substrate**: employer_candidates=present, ep98_hiring_assessments=present, employer_offers=present
- **Counts**: total=34, real=0, demo=34
- **Note**: terminal-stage candidates=34 (demo=34); stored hiring recommendations=40; offers=0; decision-support is advisory only (never a hire/no-hire verdict).

### 9. Outcome Tracking
- **Criterion**: Realized hire/perf outcomes are captured and feed calibration (≥30 → calibrated confidence).
- **Status**: empty · Coverage=reachable · Confidence=none
- **Flags**: validationLoop=on, outcomeIntelligenceActivation=on
- **Substrate**: validation_loop_outcomes=present, tig_calibration=present
- **Counts**: total=0, real=0, demo=0
- **Note**: No realized non-demo outcomes recorded — calibration stays cold_start/provisional. Confidence abstains until ≥30 real outcomes accrue.
