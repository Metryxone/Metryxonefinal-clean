# CAPADEX 3.0 · Phase 1.3 — Reports & Dashboards ↔ Assessment Matrix

> Deliverable 08 · Generated 2026-06-30T11:23:41.795Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9f33dfe717b5, written 2026-06-30T11:23:41.791Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

| Canonical Type | Status | Reports | Dashboards | Benchmarking |
|---|---|---|---|---|
| Entry Assessment (`entry`) | IMPLEMENTED | No standalone report (feeds Behaviour/Diagnostic report). | Counts roll into Student/Founder dashboards. | n/a (placement, not a score). |
| Baseline Assessment (`baseline`) | IMPLEMENTED | First CAPADEX report (ReportPhase). | Student/career dashboards baseline values. | Cohort percentile where k≥k_min; else suppressed. |
| Diagnostic Assessment (`diagnostic`) | IMPLEMENTED | Behavioural/diagnostic narrative report. | Behavioural growth tab; concern roll-ups. | Concern-band stats (diagnostic, not a strength score). |
| Behaviour Assessment (`behaviour`) | IMPLEMENTED | Behavioural section of CAPADEX report. | BehavioralGrowthTab; LBI dashboard (student product). | Cohort signal bands (k-gated). |
| Competency Assessment (`competency`) | IMPLEMENTED | Competency report; report-factory blueprints. | MEI/Hiring-readiness/Skill bars; competency admin panels. | Role-DNA expected level; cohort percentile (k-gated). |
| Learning Assessment (`learning`) | PARTIAL | Exam-ready report view (domain-wise). | Exam-ready report screens. | Per-domain breakdown; no platform-wide norm yet. |
| Performance Assessment (`performance`) | PARTIAL | Hiring/readiness reports; employer candidate drawer. | Hiring-readiness/Future-readiness tabs; employer dashboards. | Role-DNA expected level; readiness bands. |
| Progress Assessment (`progress`) | PARTIAL | Progression / longitudinal report. | CareerMemoryTab; progression views. | Self vs baseline; cohort movement (k-gated). |
| Exit Assessment (`exit`) | MISSING | Exit summary (reuse progression report). | Stage-exit indicators. | Exit vs entry delta. |
| Continuous Assessment (`continuous`) | MISSING | Trend report (reuse longitudinal). | Trend dashboards. | Rolling trend. |
