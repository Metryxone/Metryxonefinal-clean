# Section 18 — Roadmap to 98%+

**Thesis:** the path to 98%+ is **population, usage, and realized outcomes**, not a rebuild. The
engines exist and are honest; they need to be fed and exercised. Initiatives are ordered by leverage.

## 18.1 Quick Wins (days–weeks; high leverage, low build)
1. **Surfacing discipline** — flag-hide dormant surfaces (Adaptive, EIOS, m5 forecasting, Validation
   status) in the user build so the product shows only what is fed. Converts "vast but dormant" into
   "credible and focused." (Section 16.) *Lifts: Experience, Architecture.*
2. **Map the existing question banks to the genome** — wire `competency_question_templates` (88) and
   `assessment_template_questions` (150) into `onto_competency_question_map`. This moves question
   coverage off 1.7% immediately for the competencies the banks already cover. *Lifts: Competencies,
   Assessment, Adaptive (gives selection something to choose).*
3. **Consolidate audit history** under `audit/_archive/` with this folder as source of truth.

## 18.2 Medium Initiatives (weeks–1–2 months)
4. **Build a graded, multi-difficulty question bank** (easy/medium/hard) for the top role-relevant
   competencies. This is the prerequisite that makes Adaptive *actually adapt* (today's bank is ~100%
   medium). *Lifts: Adaptive, Assessment, Candidate Experience.*
5. **Curated Role DNA expansion** — grow `onto_dna_profiles` from 5 to a meaningful curated set for the
   target roles; everywhere else keep O*NET-Estimated with the honest badge. *Lifts: Role DNA, Career
   Match, Employer.*
6. **Default-on the unified competency taxonomy search** once stable; retire parallel discovery paths.
   *Lifts: O*NET, Architecture, Experience.*
7. **First real employer pilot (single org → multi-org)** traversing onboarding → posting → match →
   interview → offer. *Lifts: Employer, Employer Experience, Workforce.*

## 18.3 Long-Term Initiatives (1 quarter+)
8. **Real candidate acquisition at volume** — drive seeker onboarding so `career_seeker_*` and
   `cg_user_*` populate from real activity (today 1 profile, 0 runs). *Lifts: Career Builder,
   Employability, Candidate Experience.*
9. **Region/country expansion** — country workforce profiles and region-conditioned competency
   expectations from ≈5 toward genome scale. *Lifts: Global.*
10. **Operational governance under load** — exercise approvals/reviews/audit at real volume; complete
    commercial-path security proofs (Razorpay IDOR/webhook, MFA e2e) under real traffic. *Lifts:
    Governance.*

## 18.4 Data-Dependent Initiatives (cannot be accelerated by engineering)
11. **Realized outcomes → Validation Loop** — accrue ≥30 real, non-demo outcomes per cohort
    (hires/rejections, role transitions, assessment-to-result). **This is the only thing that unlocks
    any calibration/accuracy claim** across employer, workforce, and predictive surfaces. *Lifts:
    Validation, Employer (calibration), Workforce (forecast accuracy), Analytics.*
12. **CAPADEX ontology + LBI banks into the live/prod DB** — these are UNFED in the shared DB (merged-
    backfill limitation); re-run the seeds against the live/prod database so the behavioral and student
    surfaces are real where they run. *Lifts: Candidate Experience, Analytics.*

## 18.5 Sequencing logic
- **#2 → #4 → #11** is the spine: map questions → grade the bank → accrue outcomes. Everything else
  compounds off real usage. Until #11 produces outcomes, **every predictive surface must stay
  directional, never validated** — and the roadmap must not claim otherwise.

## 18.6 What 98%+ requires (summary)
Broad question coverage + graded bank + curated Role DNA + multi-org employer activation + real
candidate volume + **≥30 realized outcomes per cohort feeding the Validation Loop.** When those exist,
the existing engines will earn the scores their architecture already supports.
