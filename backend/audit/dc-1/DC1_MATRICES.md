# DC-1 — Decision-to-X Matrices (#3–#6)

Status legend: **R** real · **P** partial · **S** stub · **✗** absent/design-only.
Columns reuse the 7-class Decision Taxonomy (D1–D7) from `DC1_DECISION_CATALOG.md`.
All surface statuses are grounded (see `DC1_README.md`). Subscription cells are
**design-only** everywhere because no decision→package mapping exists yet.

---

## Output #3 — Decision-to-Product Matrix
*Which product each decision class activates, per segment, and whether it's deliverable.*

| Decision class | Primary product | School | College | Job Seeker | Parent | Teacher | Counselor | Institution | Exam Aspirant |
|----------------|-----------------|--------|---------|-----------|--------|---------|-----------|-------------|---------------|
| D1 Diagnostic | (assessment) | R | R | R | R(proxy) | R(view) | R(view) | R(cohort) | R |
| D3 Routing — Behaviour | LBI **R** | R | R | R | R(proxy) | R | R | P(cohort) | R |
| D3 Routing — Career | Career Builder **P** | — | P | P | — | — | P | P | — |
| D3 Routing — Employability | Employability Index **S** | — | S | S | — | — | S | S | — |
| D3 Routing — Exam | Competitive-Exam **S** | S | — | — | — | — | — | S | S |
| D5 Human-support | Mentor **R** | R | R | R | R(proxy) | R | R | P(cohort) | R |

**Finding:** D1/D3-LBI/D5 are deliverable for nearly all segments (real surfaces). The
Career/Employability/Exam product routes are partial/stub, so their decisions can be
*formed* but not fully *delivered*. **Teacher/Counselor** consume mostly view/proxy
surfaces (no first-class product); **Institution** lacks cohort product surfaces.

---

## Output #4 — Decision-to-Growth-Plan Matrix
*M5 growth plan is **R** & persists but anchored to M-series scores; the journey→M5 bridge
is the universal blocker. "P" = plan engine works but not seeded by the CAPADEX decision.*

| Decision (developmental, D4) | Plan type | School | College | Job Seeker | Parent | Teacher | Counselor | Institution | Exam Aspirant |
|------------------------------|-----------|--------|---------|-----------|--------|---------|-----------|-------------|---------------|
| Initiate growth plan | M5 baseline | P | R | R | P(proxy) | — | (assigns) | R(per-student) | P |
| Escalate plan horizon | M5 horizon↑ | P | R | R | P | — | (assigns) | R | P |
| Reskilling / transition plan | M5 role-target | — | R | R | — | — | — | R | — |
| Exam-prep plan | exam template | — | — | — | — | — | — | — | P(needs corpus) |
| Family / confidence plan | dev template | P | P | P | P | — | — | P | — |

**Finding:** **Job Seeker & College** are the best-fit (M5 is role/target-role shaped).
**School/Exam/Family** plans need new templates. **All** rows need the journey→M5 bridge to
be seeded by the CAPADEX decision rather than M-series scores. Teacher has no plan role.

---

## Output #5 — Decision-to-Mentor Matrix
*Mentor is **R** (DB-backed, assessment-driven `/suggestions`). Gap: drive match from the
decision (not raw LBI scores) + cross-server seam (`frontend/server`). Exam/cohort taxonomies missing.*

| Decision (human-support, D5) | Match basis today | School | College | Job Seeker | Parent | Teacher | Counselor | Institution | Exam Aspirant |
|------------------------------|-------------------|--------|---------|-----------|--------|---------|-----------|-------------|---------------|
| Recommend mentor | LBI weakness→type **R** | R | R | R | R(proxy) | R(refer) | R(refer) | P(cohort) | R |
| Crisis escalation (D7) | safety path (Pragati) | P | P | P | P | P | P | P | P |
| Cohort/bulk mentor allocation | — | — | — | — | — | — | — | ✗ | — |
| Exam-specialist match | generic pool | — | — | — | — | — | — | — | P(no exam taxonomy) |

**Finding:** mentor recommendation is the **most orchestration-ready** decision — it already
matches off assessment data. Upgrades: decision-driven match basis, exam taxonomy, cohort
allocation, and unify crisis-escalation (D7) into the decision gate (today it lives in
Pragati, not the decision layer).

---

## Output #6 — Decision-to-Subscription Matrix
*Packages are **R** with `student_segment` + `is_recommended`, but **no decision→package
mapping** and entitlement is partial/non-blocking. Every cell is therefore **design-only**.*

| Decision (commercial, D6) | Target package (seeded, real) | Segment fit | Deliverable today |
|---------------------------|-------------------------------|-------------|-------------------|
| Recommend entry check | Micro Check (Snapshot Lite etc.) | School/Parent | ✗ (design) |
| Recommend annual core | FOUNDATION/PERFORMANCE/READINESS | School/College | ✗ (design) |
| Recommend exam package | ExamReadiness Index (Class 10/12/Competitive) | Exam Aspirant | ✗ (design; product stub) |
| Recommend premium | EDGE | College/Job Seeker/Aspirant | ✗ (design) |
| Recommend family plan | Family/parent (via `student_subscriptions`) | Parent | ✗ (design) |
| Recommend transition | Transition Check | Job Seeker | ✗ (design; no job-seeker pkg) |
| Recommend institutional plan | — (no `institution_id`/`max_students`) | Institution | ✗ (non-functional at data layer) |
| Enforce entitlement | (gate) | all | ✗ (partial/non-blocking only) |

**Finding:** the commercial decision is **the weakest, most uniformly missing capability** —
packages exist and are segment-labelled, but nothing recommends one from a decision and the
Institution (highest-revenue) row is non-functional at the data layer. **Exam Aspirant
inversion** persists: package real, product stub.

---

## Cross-matrix synthesis
- **Strongest decision paths today:** D1 (diagnostic) → D2 (report) → D5 (mentor) → D3-LBI.
  These are real across most segments.
- **Bridge-blocked:** D4 (growth plan) — one journey→M5 bridge unlocks all segments.
- **Mapping-blocked:** D6 (subscription) — needs decision→package mapping + entitlement.
- **Axis-blocked:** all context-triggered decisions — need the context axis.
- **Segment coverage skew:** School/College/Job Seeker/Parent/Exam well-served by real
  surfaces; **Teacher/Counselor** are mostly referral/view roles (no first-class product);
  **Institution** is the biggest build (cohort surfaces + B2B subscription data layer).
