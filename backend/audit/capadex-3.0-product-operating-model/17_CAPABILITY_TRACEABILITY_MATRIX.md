# 17 · Capability Traceability Matrix

The brief's mandated chain, applied to representative capabilities:
**Module → Business Domain → Market Segment → Persona → Lifecycle Stage → Journey → Assessment → Evidence → AI
→ Workflow → Reports → Outcomes → KPI → Governance.** A break anywhere = a measurable product gap.

| Capability (module) | Domain | Segment | Persona | Stage | Journey | Assessment | Evidence | AI | Workflow | Reports | Outcome | KPI | Governance | Break? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAPADEX behavioural (`wc3/*`) | Behaviour | Edu/Career | student/fresher | Curiosity→Clarity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome/KPI ◐** |
| Competency (`onto_*`) | Competency | Career/Enterprise | professional | Clarity→Mastery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome/KPI ◐** |
| Career Builder (`career-*`) | Career | Career | job_seeker | all | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome ◐** |
| Employer hiring (`employer_*`) | Hiring | Enterprise | HR/employer | n/a (org) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome ◐ (k_min)** |
| LBI (`lbi_*`) | Learning | Education | student | Curiosity→Growth | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ | ✗ | ✅ | **KPI ✗** |
| Future Readiness (`frp_*`) | Readiness | Career/Ent | professional | Growth→Mastery | ◐ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ✅ | **Journey/Workflow ◐** |
| Institutional intel (k-anon) | Institutional | Education | institute admin | n/a | ✅ | ✅ (aggregate) | ✅ | ◐ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome ◐** |
| Parent dashboard | Influencer | Education | parent | linked-child | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | ✗ | ✗ | ✅ (consent) | **Outcome/KPI ✗** |

## Traceability findings (honest)
- **The chain is INTACT through Reports for the core capabilities** — every flagship module traces
  module→…→reports without a break. This is strong and rare.
- **The chain consistently BREAKS at OUTCOME → KPI.** Outcomes are *projected/abstained* (k_min=30) but rarely
  *realized-and-measured*; KPIs are computed (mission-control, analytics) but not tied back to each capability
  as a per-capability success metric. This is the **traceability expression of GAP-P1 + GAP-O1**.
- **Governance node is present** for all (audit logs, RBAC, k-anon) — a genuine strength.
- **Parent and LBI** have the earliest breaks (no realized outcome / no KPI binding).

## Verdict
**Traceability: COMPLETE module→reports; INCOMPLETE reports→outcome→KPI.** No capability is *orphaned*
(everything maps to a domain/segment/persona). The universal break is the **outcome/KPI tail** — the single
most repeated gap across this entire audit. Enhancement-only (wire existing outcome + KPI engines per
capability).
