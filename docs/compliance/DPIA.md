# Data Protection Impact Assessment (DPIA) — GDPR Art. 35

> **STATUS: DRAFT — DPO / LEGAL REVIEW REQUIRED.** Engineering-authored starting
> draft. Not legal advice. Must be reviewed and formally adopted by the DPO / legal
> counsel. Closes the DPIA portion of gap **CMP-F1**.

## 1. Why a DPIA
The platform performs **profiling and automated evaluation** of individuals
(behavioural/competency assessment, career/employability scoring, hiring
assessment), which is a trigger for a DPIA under Art. 35(3)(a). It may process
children's data (students), a further trigger.

## 2. Description of processing
- **Nature:** collection of self-reported and assessment-derived data; AI-assisted
  interpretation, recommendation, and report generation.
- **Scope:** students, job-seekers, employees, employers, faculty, parents, mentors.
- **Context:** education, career development, hiring.
- **Purposes:** guidance, development planning, matching, hiring support.

## 3. Necessity & proportionality
- Data minimisation: assessments collect only fields used in scoring/guidance *(verify per form)*.
- Lawful basis mapped in RoPA (confirm).
- Consent ledger present (`consent_records`) with versioned purposes and lawful basis.

## 4. Risks to data subjects & mitigations

| Risk | Likelihood / severity | Mitigation (in place) | Residual action |
|---|---|---|---|
| Unfair / biased AI evaluation | Med / High | Fairness monitoring engine + **cadence** (AI-M2), human-in-the-loop, recommendations never auto-executed | Publish fairness metrics on real cohort volume (adoption) |
| Prompt injection via free-text | Med / Med | Input-side injection guard (AI-M1) + output sanitizer | Periodic red-team (AI-F1) |
| Hallucinated / ungrounded narratives | Med / Med | Rule/pattern safety layer; confidence honesty (abstains until k_min) | Optional model-graded groundedness (AI-L1) |
| Unauthorised access to PII | Low / High | RBAC, super-admin MFA, CSRF, audit redaction | Prod DB isolation attestation (SEC-H1) |
| Excessive retention | Med / Med | Declared retention + enforcement scheduler (CMP-M2) | Confirm periods; enable account-level purge decision |
| Data-subject rights not exercisable | Med / Med | Self-service export + erasure request (CMP-M3) | Verify anonymize pipeline (CMP-L1) |
| Children's data | Med / High | Relationship + parental redirect + consent | Verifiable age-gate / parental consent artifact (CMP-L2) |

## 5. Automated decision-making (Art. 22)
Recommendations and scores are **decision-support**, explainable and evidence-linked;
outputs are **not** auto-executed and are subject to human review. Confirm no
solely-automated decision with legal/significant effect exists; if any does, add an
explicit human-review and objection path.

## 6. Outcome
DPIA to be **completed and signed by the DPO**. This draft identifies triggers,
risks, and existing mitigations for that review.
