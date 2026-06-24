# MX-77X · Section 3 — Organizational Capability Intelligence

**Status:** WORKING on demo_org seed.
**Engines:** `m5-workforce-intelligence` (skillGaps/readiness), `m5-executive-intelligence`.
**Tables (live):** `m5_organizational_capabilities` 5 · `m5_enterprise_capability_indices` 5 ·
`m5_department_capability_scores` 0 · `m5_organizational_capability_maps` 0.

## Flow
```
Organization → Departments → Roles → Competencies → Capability Index
```
- Composer surfaces capability rows via the workforce-planning view's capability projection
  (`m5_organizational_capabilities`, 5 rows for demo_org) and capability indices (5).

## Outputs
- **Capability Score** — per org/department capability index (present, 5 rows).
- **Risk Score** — derived in talent-risk view (`m5_strategic_workforce_risks` 3 + `wos_workforce_risk` 60).
- **Readiness Score** — `m5-workforce-intelligence.readiness(org)`; HONESTY GUARD: returns
  `{readiness_score:0, departments:[]}` when no department rows → composer treats that 0 as a
  **fabricated sentinel** and surfaces `null` (enterprise readiness measurable ONLY when departments>0).
- **Strength / Gap Areas** — from skill-gap view (5 org gaps) + obsolescence (325).

## Coverage ⟂ Confidence
- **Coverage:** capability indices + capabilities populated (5/5); **department-level decomposition is 0**
  → the "Departments" layer of the flow is structurally present but unfed.
- **Confidence:** org-level scores are seed-derived (single org); department roll-ups abstain.

## Reachability ceiling & honest gaps
- Without department/role census rows, the Org→Department→Role decomposition cannot be fully traversed;
  the index exists at the org grain only. Never fabricate department scores from the org aggregate.
