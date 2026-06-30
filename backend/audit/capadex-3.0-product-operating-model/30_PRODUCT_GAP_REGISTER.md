# 30 · Product Gap Register

Every measurable gap from deliverables 02–29. Each: classification, impact, evidence, source deliverable.
NO gap is a redesign; all are enhancement-only (strengthen what exists).

**Classification legend.** Gaps use the brief's six classes (IMPLEMENTED/PARTIAL/DORMANT/MISSING/PLANNED/
RECOMMENDED). Two findings concern **non-capability axes** and carry augmenting tags, reported alongside the
six classes and never blended into them: **UNMEASURED** = evidence does not exist (a sub-case of missing
*evidence*, not missing capability; null≠0), and **DEBT** = code-maintainability (the capability is
functionally complete, so this is not a completeness class).

| ID | Gap | Class | Impact | Evidence / source |
|---|---|---|---|---|
| **GAP-P1** | No closed growth loop (assess→intervene→**re-test**); no measured growth | **MISSING** | Product can't prove it improves users; caps Outcome/KPI/Intelligent maturity | 09,10,11,15,18,19,25 |
| **GAP-P2** | No hard, code-enforced stage entry/exit criteria; progression derived + monetization-gated | **PARTIAL** | "Mastery" ≠ demonstrated mastery; progression not evidence-gated | 09,11,12 |
| **GAP-O1** | Realized-outcome + recommendation-effectiveness capture absent (machinery exists, data null) | **MISSING (honest-null)** | Blocks all outcome/business KPIs; Production-confidence WITHHELD | 17,21,22,25,26 |
| **GAP-K1** | No per-capability success-KPI binding; outcome KPIs undefined (input KPIs derivable, outcome KPIs blocked by GAP-O1) | **PARTIAL** | Can't measure product/business success per capability | 17,26 |
| **GAP-AI1** | No AI accuracy/hallucination/quality harness for LLM layer (safety=policy regex only) | **MISSING** | Can't claim "intelligent"; LLM safe-but-unvalidated | 13,14,20,23 |
| **GAP-A2** | Psychometric reliability/validity stats (α, test-retest, factor structure) unpublished | **MISSING** | Credibility gap for enterprise/clinical buyers | 14 |
| **GAP-A3** | Served adaptive item bank ~100% medium → effective difficulty ceiling | **PARTIAL** | Adaptive depth capped by content, not algorithm | 13,14 |
| **GAP-A4** | Exit + continuous assessment types missing across all stages | **MISSING** | Mechanism behind GAP-P1; no measured progress | 15 |
| **GAP-M1** | Faculty/teacher/counsellor/coach personas partial (survey-only / nested) | **PARTIAL** | Education GTM depth limited | 06,07,08,19 |
| **GAP-M2** | Government / healthcare / NGO segments = sector-tag only | **MISSING** | Not addressable markets yet (don't claim) | 06 |
| **GAP-X1** | No WCAG accessibility audit | **MISSING (unmeasured)** | Compliance/launch risk for regulated buyers | 24 |
| **GAP-X2** | Multilingual framework present, content depth unverified | **PARTIAL** | Intl claim unproven | 24 |
| **GAP-X3** | Notification/continuous-engagement system thin | **PARTIAL** | Weak back-half journey, retention risk | 19,24 |
| **GAP-C1** | Subscription package → entitlement mapping permanently absent (no users.email col) | **PARTIAL** | Commercial activation gap | 03,12,27 |
| **GAP-G1** | RBAC v2 + governance/lifecycle intelligence DORMANT (default-OFF) | **DORMANT** | Enterprise-governance product not activated | 08,16,27,28 |
| **GAP-S1** | No load/scalability test; single-thread ceiling | **UNMEASURED (null≠0)** | Scale unproven; don't claim enterprise scale | 16,27 |
| **GAP-D1** | Maintainability debt: routes.ts 14.5k + 3 monoliths + schema sprawl (1,441 vs 134) | **DEBT** | Velocity/consistency risk, not functional defect | 16,24 |
| **GAP-E1** | Production demo-mode lockout not enforced (shared dev/prod DB) | **PARTIAL (Launch-Critical)** | Demo data leakage into prod | 27 |
| **GAP-E2** | Security-scan triage not closed | **PARTIAL (Launch-Critical)** | Unknown residual vulns | 27 |
| **GAP-E3** | DPDP / minor-consent completeness unproven | **PARTIAL (Launch-Critical)** | Legal/compliance risk (minors) | 27 |

## Honest summary
- **20 gaps. 0 require redesign.** All are enhancement/activation/measurement.
- **The gaps cluster into ONE root theme:** the platform measures and recommends superbly (front half) but does
  not yet **close the loop and measure realized outcomes** (back half). GAP-P1/P2/O1/A4/K1 are one story.
- **3 Launch-Critical operational gates (E1–E3)** are independent of product maturity and must clear before any
  public launch.
- **Nothing is fabricated; UNMEASURED (S1) and honest-null (O1) are reported as such, never as zero.**
