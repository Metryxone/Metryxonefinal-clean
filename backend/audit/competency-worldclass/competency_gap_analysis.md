# Competency Assessment — Gap Analysis (incl. Top 100 Reasons Not Yet World-Class)

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Stance:** evidence-only, no optimistic scoring. Gaps are honest findings, not failures.

---

## Part 1 — Structural / Activation / Validity Gap Map

| Domain | Structural gap | Activation gap (live DB) | Validity gap |
|---|---|---|---|
| Framework | AI/Green/Future/Research/Power families thin | `lbi_clusters=0`, SDI hierarchy 0 | no norms |
| Library | legacy LBI/SDI label-heavy; no single canon | `onto_competencies=299` only; indicators sparse | no anchor validation |
| Ontology | micro/sub-competency layers not realised live | `ont_*=0` (O*NET not imported) | no graph validation |
| Role mapping | only 5 roles weighted live | `onto_role_weights=35` | mappings unvalidated |
| Assessment science | construct/criterion validity not wired to real criterion | N≈58 too small to calibrate | **no empirical IRT/α study** |
| Question bank | DB bank empty; AI/Green/Future coverage thin | `competency_question_templates=0` | no item calibration/bias output |
| Benchmark | — (method sound) | population < k=30 everywhere | percentiles not norm-referenced |
| Recommendations | — (engines strong) | `mei_user_recommendations=0`, recs ~8 | no outcome linkage |
| Outcome validation | evidence loop needs N | **realised outcomes ≈ 0** | **no predictive validity** |
| Commercial | flags OFF | **0 real sales** | willingness-to-pay unproven |
| Operational | crisis no human-notify; Zoho SPOF; thin rate-limit | — | — |
| Scale | lazy `ensureSchema`; no replicas/async | tested ~1k | — |

---

## Part 2 — Keystone Gaps (fix these and most others lift)

1. **No empirical validity evidence** (calibration, reliability on real samples, criterion/outcome correlation). *This is the single biggest barrier to world-class status.*
2. **Cold-start population** — banks, ontology (O*NET import), norms, EI scores all empty/near-empty live.
3. **Zero realised outcomes** — no proof competency predicts placement/hiring/promotion.
4. **Zero commercial transactions** — willingness-to-pay and renewal unproven.
5. **EI not activated** (`mei_scores=0`) — the keystone dependent of competency is dark.

---

## Part 3 — Top 100 Reasons MetryxOne Competency Assessment Would NOT Yet Be Classified World-Class

*Adjudicators assumed: SHL, Mercer Mettl, Korn Ferry, LinkedIn Skills Graph, Eightfold, Workday Skills Cloud, Cornerstone. Ranked by decisiveness for world-class certification.*

**Evidence basis (read before the list):**
- 🔴 **Critical** and 🟠 **High** items are each grounded in a **direct live-DB count or a verified code/architecture fact** cited elsewhere in this audit (live counts in `competency_worldclass_audit.md` §1; science gaps in `competency_science_validation.md`).
- 🟡 **Medium** items are **operational/commercial gap-by-absence** findings: the capability/evidence is *absent* in the live system (flags OFF, demo-mode payments, no human-notify path, shared dev/prod DB). Items that are an *inference from absence* rather than a positive observation are marked **[absence]**.
- 🟢 **Low** items are **polish/differentiation/ecosystem** observations of **lower evidentiary weight** — real gaps versus world-class peers, but not, alone, certification-blocking. Treat as directional, not load-bearing.

### 🔴 CRITICAL (validity, evidence, population — block world-class certification)

1. No empirical reliability coefficients (Cronbach α) computed on a real respondent sample — formula exists, output does not.
2. No empirically calibrated IRT item parameters — a/b/c are seeded/assumed, not estimated from data.
3. Zero realised outcomes (`career_outcomes` is demo/seed) — no criterion validity possible.
4. No demonstrated predictive validity (competency → placement/hiring/promotion/performance).
5. No published norms / norm-referenced scoring — percentiles have no population behind them.
6. Benchmark cohorts below k=30 everywhere — every user benchmark is suppressed/provisional.
7. Live curated question bank is empty (`competency_question_templates=0`) — no calibratable, governed item pool in production.
8. Item bank size (~50–100 static items) is 1–2 orders of magnitude below enterprise (SHL banks = thousands of calibrated items).
9. No item-level bias/DIF analysis output (differential item functioning never computed on real data).
10. Adverse-impact (4/5ths) implemented but never run on a real applicant pool.
11. EI not activated (`mei_scores=0`) — the flagship downstream score is dark.
12. O*NET ontology not imported live (`ont_*=0`) — the "1016 roles/49k links" capability is unexercised here.
13. No test-retest reliability evidence (stability over time on real users).
14. No convergent/discriminant validity vs an established instrument.
15. No independent psychometric/third-party validation report.
16. Construct validity uses a Pearson correlation against a criterion that isn't populated.
17. No standard error of measurement reported per score to users/buyers.
18. No evidence of measurement invariance across demographic groups (fairness unproven).
19. Sample size (N≈58 sessions) is far too small for any psychometric claim.
20. No commercial transactions (₹0 captured) — product-market fit and willingness-to-pay unproven.

### 🟠 HIGH (content, coverage, science maturity)

21. Legacy LBI/SDI competencies are label-heavy (descriptions without explicit proficiency anchors).
22. No single deduplicated competency canon — same competency appears across LBI/SDI/Competency.
23. AI competencies declared but not populated to enterprise depth.
24. Green/sustainability skills declared but thinly populated.
25. Future-skills (WEF-aligned) not populated as a maintained, versioned taxonomy.
26. Entrepreneurship and Research skill families under-developed.
27. Behavioural indicators table (`ont_indicators`) sparsely populated live.
28. Micro-competency and sub-competency layers not realised in the live DB.
29. Only 5 roles carry full curated DNA weights live (`onto_roles=5`).
30. Cross-industry competency relationships not populated at scale.
31. No competency-level evidence statements (what proficiency "looks like" per level) at scale.
32. No mapping to ESCO identifiers for EU/global interoperability.
33. No mapping to a LinkedIn-style skills graph for market signal alignment.
34. Question difficulty not calibrated against real response data.
35. Question redundancy/overlap not audited.
36. Signal coverage partial — only a subset of bridge tags carry native signals.
37. No multi-language item versions (global readiness).
38. No accessibility/WCAG conformance evidence for the assessment UI.
39. No proctoring / response-integrity beyond anomaly heuristics (straightlining/fast-response).
40. Coaching-contamination detection exists but is unvalidated against known coached samples.
41. No content-validity panel / SME sign-off record for items.
42. Adaptive engine (`question-generation-engine`) has no live DB pool to draw from (bank=0).
43. No item exposure control / overlap control for high-stakes use.
44. No alternate forms / parallel forms for retesting.
45. Reliability index weights (0.40/0.20/0.20/0.15) are hand-set, not empirically derived.
46. No score-band cut points validated against external standards.
47. Bloom multipliers (1.0–2.0) are assumed, not empirically weighted.
48. OMEGA-X severity/confidence/persistence weights not validated against outcomes.
49. No evidence that 7 core domains are exhaustive/orthogonal (factor analysis absent).
50. No documented scoring audit trail surfaced to enterprise buyers.
51. Recommendation outcomes never measured (no A/B or uplift study).
52. Career-graph transition probabilities are curated, not data-derived from real transitions.
53. Role library transitions are hand-authored (~200 roles) — not a full labour-market graph.
54. Mobility transferability scores unvalidated against real career moves.
55. Development-plan completion not linked to measured competency gain.
56. No certification/learning catalog integration with real providers (Coursera/Degreed/etc.).
57. Employer hiring/promotion verdicts disallowed (correct) — so the highest-value employer use is unavailable.
58. No succession-planning or workforce-planning analytics populated.
59. No talent-pool benchmarking for employers (population too small).
60. Industry packs for BFSI/Healthcare/Manufacturing/Government absent.

### 🟡 MEDIUM (operational, commercial, scale) — *gap-by-absence; **[absence]** = inferred from missing capability/evidence*

61. Pricing tiers defined but never market-tested.
62. No subscription/renewal data (renewal unproven by construction).
63. Assessment-credit metering built but not exercised commercially.
64. Entitlement enforcement flag OFF by default (no live paywall).
65. Razorpay in demo mode — no live payment confirmation.
66. Crisis detection has no human-notify path (safety/operational gap).
67. Email (Zoho) is a single point of failure for MFA/OTP — lockout risk if down.
68. No incident/ticketing system for support at scale.
69. No `/health` endpoint / formal uptime monitoring surfaced.
70. OTP/login rate-limiting is thin (abuse risk).
71. Audit logging is best-effort (not guaranteed-write for all mutations).
72. Lazy `ensureSchema` on routes — not migration-led deploy discipline for scale.
73. Dev and prod share a database (operational risk).
74. CSP disabled (security posture for public launch).
75. No read replicas / connection-pool strategy for 10k+ concurrent.
76. Assessment scoring is synchronous — no async queue for batch institution loads.
77. No SLA/uptime commitments documented.
78. No data-retention / GDPR-DPA / consent records for enterprise procurement.
79. No SOC2/ISO evidence for enterprise buyers.
80. No model/AI governance documentation surfaced to buyers (despite AI-governance flag).
81. No bias-audit report deliverable for institutional/employer compliance.
82. No multi-tenant isolation guarantees documented for enterprise.
83. No bulk import/export tooling validated for large institution cohorts.
84. Faculty dashboards present but program-outcome analytics unpopulated.
85. Placement-readiness scores not validated against actual placements.
86. No comparison to institution's own historical placement data.
87. No professional re-engagement loop proven (return-repeatedly unproven).
88. No mobile-native assessment experience evidence. **[absence]**
89. No offline/low-bandwidth assessment mode (India market relevance). **[absence]**
90. Onboarding/self-signup limited (institution flow is concierge).

### 🟢 LOW (polish, completeness, differentiation maturity) — *lower evidentiary weight; directional, not certification-blocking*

91. No public-facing validity/methodology white paper.
92. No competency framework version history surfaced to users.
93. Provenance badges (curated vs estimated) good — but estimated data dominates where present.
94. No user-facing confidence intervals on competency scores.
95. No localization of report language/tone per region.
96. No competitor-style "skills gap to market demand" live view (data thin).
97. No gamified longitudinal re-assessment cadence proven to drive retention.
98. No certificate/credential issuance (verifiable badge) from competency results.
99. No API/partner ecosystem for third-party consumption of competency scores.
100. No marquee reference customers / case studies / testimonials to anchor world-class claims.

---

## Part 4 — Summary by Severity

| Severity | Count | Theme |
|---|---|---|
| 🔴 Critical | 20 | Validity, evidence, population, revenue — block world-class |
| 🟠 High | 40 | Content depth, coverage, science maturity, dependents |
| 🟡 Medium | 30 | Operational hardening, commercial proof, scale |
| 🟢 Low | 10 | Polish, differentiation, ecosystem |

**The decisive truth:** ~70% of these gaps are not engineering gaps — they are **evidence and population gaps** (validation studies, real respondents, real outcomes, real sales). MetryxOne has largely *built* world-class machinery; it has not yet *proven* it with data.
