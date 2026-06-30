# CAPADEX 3.0 · Phase 1.3 — AI ↔ Assessment Matrix

> Deliverable 07 · Generated 2026-06-30T11:44:25.490Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:9b3be5dcc291, written 2026-06-30T11:44:25.495Z).
> Honesty: Coverage⟂Confidence⟂Outcome (never composited); null ≠ 0; never fabricated.

| Canonical Type | Status | Scoring method | AI interpretation | Recommendation rules | Intervention rules |
|---|---|---|---|---|---|
| Entry Assessment (`entry`) | IMPLEMENTED | Non-scored placement (selection + concern routing); feeds bank resolution. | Concern → signal routing (analyzeConcern / clarity mapping). | Routes to the correct sub-persona question bank (resolveQuestionBank). | n/a at entry. |
| Baseline Assessment (`baseline`) | IMPLEMENTED | Engine-scored (behavioural / competency / EI) → employability_scoring_runs. | Behavioural report synthesis (capadex-report-synthesis). | Seeds first PIL recommendation set. | Wellbeing/learning intervention triggers if signals warrant. |
| Diagnostic Assessment (`diagnostic`) | IMPLEMENTED | 4-tier signal ontology + clarity mapping (concern-diagnostic). | Signal analysis + contradiction detection + clarity. | Concern-specific guidance (PIL runtime-guidance-engine). | capadex-intervention-engine (learning/wellbeing). |
| Behaviour Assessment (`behaviour`) | IMPLEMENTED | behavioural-signal-engine (timing/linguistic) → namespace-aligned signals. | Signal namespace alignment + contradiction detection. | Feeds PIL active-construct derivation. | Reliability flags when contradictions detected. |
| Competency Assessment (`competency`) | IMPLEMENTED | Adaptive question bank + ai-competency-inference + role-DNA runtime. | ai-competency-inference-engine; competency intelligence. | Gap → development recommendations (career/learning). | Learning-path nudges on competency gaps. |
| Learning Assessment (`learning`) | PARTIAL | MCQ scoring (assessment-runtime-orchestrator / exam-ready). | Limited — score + domain breakdown. | Weak-domain → next practice suggestion. | Practice nudges on weak domains. |
| Performance Assessment (`performance`) | PARTIAL | role-DNA runtime + career-readiness-engine + talent match. | Talent-match + interview intelligence. | Readiness gap → development roadmap. | Targeted prep on readiness gaps. |
| Progress Assessment (`progress`) | IMPLEMENTED | employability_scoring_runs deltas + longitudinal_patterns. | Longitudinal trend + Bayesian construct update. | Trend-aware next-step guidance. | Drop alerts (≥ threshold) trigger nudges. |
| Exit Assessment (`exit`) | IMPLEMENTED | Re-administer baseline/competency at exit (NO new engine). | Reuses existing readiness/progression interpretation. | Pass → advance; fail → remediation loop. | Remediation on failed exit gate. |
| Continuous Assessment (`continuous`) | IMPLEMENTED | Re-administer existing assessments on interval (NO new engine). | Longitudinal/Bayesian substrate EXISTS (reuse). | Trend-aware ongoing guidance. | Continuous drop alerts. |
