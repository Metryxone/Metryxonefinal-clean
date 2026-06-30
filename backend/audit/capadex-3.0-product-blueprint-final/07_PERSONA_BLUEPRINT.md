# 07 · Persona Blueprint

ONE persona architecture. Each first-class persona defined in full (Goals · Pain Points · Journey · Lifecycle
Stages · Assessments · AI · Dashboards · Reports · Outcomes · Success Metrics · Future Extensions). Two axes:
**segment coverage** (does a dedicated experience exist?) ⟂ **journey completeness** (is the full journey, incl.
completion + continuous-improvement, present?). Rule: **Persona (market) ≠ Role (auth); Mentor ≡ Coach
substrate.** Promotes Phase 0.1 (06) to full blueprint depth.

---

## First-class personas (full blueprints)

### P1 · School student (K-12)
- **Goals:** self-understanding, subject/stream clarity, confidence.
- **Pain points:** anxiety, unclear direction, parental pressure.
- **Journey:** Entry → Diagnose → Recommend → (Grow). **Stages:** CUR→INS→(GRW).
- **Assessments:** Entry, Diagnostic (concern), Behaviour, LBI.
- **AI:** observation + diagnosis + grounded recommendation; **no verdicts.**
- **Dashboards/Reports:** student dashboard; diagnostic + guidance report; parent-linked (consent).
- **Outcomes (target):** clarity uplift, confidence; realized-measure = forward work.
- **Success metrics:** entry completion, diagnosis confidence.
- **Future:** systematic Progress re-run; Exit gate at stream choice.

### P2 · Competitive-exam aspirant
- **Goals:** readiness for a target exam/path; gap clarity.
- **Pain points:** plateau, weak self-diagnosis, motivation.
- **Journey:** Entry→Diagnose→Recommend→Grow. **Stages:** CUR→INS→GRW.
- **Assessments:** Baseline, Diagnostic, Competency, Learning (curated MCQ).
- **AI:** diagnosis, roadmap recommendation, personalization.
- **Dashboards/Reports:** learning-path dashboard; progress report.
- **Outcomes (target):** score/readiness gain (forward-work measure).
- **Success metrics:** progress delta; intervention uptake.
- **Future:** Continuous re-assessment; outcome capture (exam result).

### P3 · College student → career
- **Goals:** career direction, employability, placement readiness.
- **Pain points:** skill gaps, no clear next step, weak portfolio.
- **Journey:** Entry→Diagnose→Recommend→Grow (career). **Stages:** CUR→INS→GRW.
- **Assessments:** Baseline, Diagnostic, Competency, Performance (partial).
- **AI:** competency inference, career recommendation, explainability.
- **Dashboards/Reports:** Career Builder; readiness/roadmap report; Employability Passport.
- **Outcomes (target):** placement/internship (forward-work measure).
- **Success metrics:** readiness score, roadmap progress.
- **Future:** systematic re-measure; outcome (placed) capture.

### P4 · Fresher / job aspirant
- **Goals:** get placed; apply effectively.
- **Pain points:** no experience signal, application friction.
- **Journey:** Entry→Diagnose→Recommend→(apply). **Stages:** CUR→INS→GRW. **Status: SUPPORTED** (launchpad +
  campus placement live).
- **Assessments:** Baseline, Competency, Performance (role-DNA/talent-match).
- **AI:** match (abstain-never-fabricate), recommendation, personalization.
- **Dashboards/Reports:** Career Launchpad / Fresher Hub; match report.
- **Outcomes (target):** placement (forward-work measure).
- **Success metrics:** application rate, match coverage.
- **Future:** realized-placement outcome capture.

### P5 · Professional / career-transition
- **Goals:** progression, role change, upskilling.
- **Pain points:** plateau, unclear transferability.
- **Journey:** Entry→Diagnose→Recommend→Grow. **Stages:** INS→GRW→MAS. **Status: PARTIAL** (progression
  derived, not criteria-gated).
- **Assessments:** Competency, EI, Performance, Future Readiness.
- **AI:** competency inference, mobility/transferability recommendation, explainability.
- **Dashboards/Reports:** career intelligence; readiness/FRI report.
- **Outcomes (target):** promotion/transition (forward-work measure).
- **Success metrics:** readiness/FRI, progression delta.
- **Future:** evidence-gated Growth→Mastery; outcome capture.

### P6 · Employee (enterprise)
- **Goals:** competency + EI growth within org.
- **Pain points:** unclear development path.
- **Journey:** Entry→Baseline→Diagnose→Recommend. **Stages:** INS→GRW. **Status: SUPPORTED.**
- **Assessments:** Baseline, Competency, EI, Progress.
- **AI:** inference, recommendation, personalization (org context modifiers).
- **Dashboards/Reports:** competency/EI dashboards; growth report.
- **Outcomes (target):** capability gain (forward-work measure).
- **Success metrics:** EI/competency delta.
- **Future:** Continuous assessment; org outcome KPIs.

### P7 · HR / recruiter
- **Goals:** hire the right candidate efficiently.
- **Pain points:** screening volume, bias risk, weak signal.
- **Journey:** post→assess→interview→match→decide (9-stage funnel). **Status: SUPPORTED.**
- **Assessments:** Performance (role-DNA, talent match, interview intel).
- **AI:** match/shortlist (abstain), explainability, **prediction DORMANT by governance design.**
- **Dashboards/Reports:** Employer Portal; candidate drawer (Coverage ⟂ Confidence separated); hiring reports.
- **Outcomes (target):** hire / quality-of-hire (forward-work measure; k_min=30).
- **Success metrics:** funnel conversion, match coverage, calibration (Brier/ECE).
- **Future:** realized hire-outcome capture; calibration learning loop.

### P8 · Employer (org)
- **Goals:** build/maintain talent pipeline.
- **Pain points:** fragmented talent view.
- **Journey:** onboard→post→match. **Status: SUPPORTED** (job-store split posting/`employer_jobs` bridged).
- **Assessments:** Performance (org-level talent intelligence graph).
- **AI:** talent intelligence, match, explainability.
- **Dashboards/Reports:** employer dashboards; talent reports.
- **Outcomes (target):** pipeline fill / retention (forward-work measure).
- **Success metrics:** pipeline coverage; time-to-fill (operational).
- **Future:** outcome KPIs (retention/performance) post-adoption.

### P9 · Institute / University admin
- **Goals:** cohort intelligence, placement outcomes, accreditation evidence.
- **Pain points:** no truthful cohort view; privacy risk.
- **Journey:** aggregate→k-anon→act. **Status: SUPPORTED** (MX-302H real aggregation).
- **Assessments:** aggregate over student assessments (k-anon, score masked < 30; roster always shown).
- **AI:** cohort intelligence; honest aggregation (never readiness-proxy).
- **Dashboards/Reports:** Unified Institute/University dashboards; placement/cohort reports.
- **Outcomes (target):** cohort placement rate (forward-work measure).
- **Success metrics:** coverage, k-anon compliance.
- **Future:** outcome KPIs per cohort; faculty first-class surfaces.

---

## Partial personas (substrate exists, journey/packaging incomplete)
| Persona | Coverage | Journey gap (forward work) |
|---|---|---|
| Faculty | nested in institute dashboards | not first-class (GAP-J3) |
| Teacher / Counsellor | survey-only surface | **dead-end** — no downstream journey (GAP-J1) |
| Manager / Leadership | views exist | packaging unclear (one enterprise-views cluster) |
| L&D | admin tooling only | no L&D product surface (GAP-J3) |
| Parent | IMPLEMENTED segment, consent flow | journey tail thin — no support-action loop (GAP-J2) |
| Mentor ≡ Coach | IMPLEMENTED segment (one substrate) | engagement tail thin (GAP-J2) |
| NGO | sector tag (MX-302H) | no dedicated vertical |

## Missing (dedicated) — DO NOT CLAIM until built
Government · Healthcare · Psychologist/Clinical (no clinical lens — out of current scope; GAP-S1).

## Consolidations (FROZEN)
1. **Mentor + Coach → ONE substrate, two market labels** (code-confirmed). Not two products.
2. **Teacher + Counsellor → one survey-only surface** (jointly partial).
3. **Manager + Leadership → one enterprise-views cluster** (jointly partial).

## Coverage summary (honest)
- **First-class: ~9** (P1–P9). **Partial: 7** (faculty, teacher/counsellor, manager/leadership, L&D,
  parent-journey, mentor/coach-journey, NGO). **Missing dedicated: 3** (government, healthcare, clinical).
- **Recommendation:** mature partials that already have substrate **before** building new verticals.

## Verdict
**ONE persona architecture, first-class personas fully blueprinted, two-axis honesty preserved. FROZEN.**
