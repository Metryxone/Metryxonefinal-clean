# 15 · Product Traceability Matrix

The brief's mandated chain applied end-to-end:
**Module → Business Domain → Market Segment → Persona → Lifecycle Stage → Journey → Assessment → Evidence → AI
→ Workflow → Reports → Outcomes → KPI → Governance.** A break anywhere = a measured product gap. Promotes Phase
0.1 (09) + Operating-Model (`17`) to the full frozen matrix.

## Master traceability matrix
| Capability (module) | Domain | Segment | Persona | Stage | Journey | Assessment | Evidence | AI | Workflow | Reports | Outcome | KPI | Governance | Break? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAPADEX behavioural (`wc3/*`) | D2 | Edu/Career | student/fresher | CUR→INS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome/KPI ◐** |
| Competency (`onto_*`) | D3 | Career/Ent | professional | INS→MAS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome/KPI ◐** |
| Career Builder (`career-*`) | D4 | Career | job_seeker | all | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome ◐** |
| Employer hiring (`employer_*`) | D9 | Enterprise | HR/employer | n/a (org) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome ◐ (k_min)** |
| LBI (`lbi_*`) | D3 | Education | student | CUR→GRW | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ | ✗ | ✅ | **KPI ✗** |
| Future Readiness (`frp_*`) | D4 (composes D5) | Career/Ent | professional | GRW→MAS | ◐ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ✅ | **Journey/Workflow ◐** |
| Institutional intel (k-anon) | D10 | Education | institute admin | n/a | ✅ | ✅ (agg) | ✅ | ◐ | ✅ | ✅ | ◐ | ◐ | ✅ | **Outcome ◐** |
| Parent dashboard | D10 | Education | parent | linked-child | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | ✗ | ✗ | ✅ (consent) | **Outcome/KPI ✗** |

✅ intact · ◐ partial · ✗ broken

## Traceability findings (honest)
- **The chain is INTACT through Reports for every core capability** — module→…→reports without a break. Strong
  and rare.
- **The chain consistently BREAKS at OUTCOME → KPI.** Outcomes are *projected/abstained* (k_min=30) but rarely
  *realized-and-measured*; KPIs are computed but not bound back to each capability as a per-capability success
  metric. This is the traceability expression of **GAP-O1 + GAP-P1**.
- **Governance node is present for all** (audit logs, RBAC, k-anon) — a genuine strength.
- **Parent and LBI** have the earliest breaks (no realized outcome / no KPI binding).

## Unmapped / orphan check
- **No capability is orphaned** — every flagship module maps to a domain/segment/persona/stage/journey.
- The only *systematic* unmapped node is the **Outcome → KPI tail** — the single most repeated gap across the
  entire audit.

## Canonical decision (FROZEN)
Wire the **existing** outcome + KPI engines per capability (enhancement-only) to close the universal tail. One
shared close-the-loop mechanism repairs every ◐/✗ in the Outcome and KPI columns simultaneously.

## Verdict
**Traceability: COMPLETE module→reports; INCOMPLETE reports→outcome→KPI. FROZEN.** No capability orphaned; the
universal break is the outcome/KPI tail — forward work for Programs 1–6.
