# Career Builder — Gap Analysis (ranked)

**Date:** 2026-06-18
**Severity tier ≠ evidentiary basis.** The Critical/High/Medium/Low tiers reflect **impact on launch**, not how the gap was evidenced. Evidentiary basis is marked independently: items grounded in cited live-DB counts or observed code/architecture facts carry their citation inline; items inferred purely from the *absence* of evidence are tagged **[absence]** — *at any severity tier* (a high-impact gap can still be absence-inferred). **Low** items additionally carry lower evidentiary weight (directional/polish, not certification-blocking). seeded ≠ computed ≠ validated; null/absent ≠ 0.

Each gap is also tagged with the axis it hurts: **[A]** Activation · **[V]** Validity · **[S]** Structural.

---

## 🔴 CRITICAL (blocks launch / blocks trust)

1. **[A]** Live Employability Index has computed **zero** scores (`mei_scores`=0, `mei_competency_scores`=0) across 101 profiles — the headline product metric is not running at scale.
2. **[A]** Competency question bank is **empty** live (`competency_question_templates`=0, `competency_assessment_items`=0); assessment relies on the static fallback bank.
3. **[V]** **EI integrity defect** — headline `EIGauge` (6-dim) ≠ EI breakdown modal (credits assessment 25pts). The same product shows two different employability numbers.
4. **[A]** **Zero realised career outcomes** (`career_outcomes`=0) → outcome attribution and any validity claim are impossible by construction.
5. **[A]** **Zero stored recommendations** (`career_recommendations`=0, `mei_user_recommendations`=0) — the recommendation engine has persisted nothing for real users.
6. **[V]** No empirical validation of any score (employability/fitment/hire-probability/readiness) against real outcomes.
7. **[A]** **No scheduler/cron** for nightly EI snapshots → longitudinal history (`mei_score_history`=0) never accrues even as profiles grow.
8. **[A]** Benchmarks unpopulated (`benchmark_profiles`=0) and k=30 floor + near-zero computed scores make peer benchmarking mathematically unavailable.

## 🟠 HIGH (materially limits value / blocks specific configs)

9. **[A]** Per-user Career Graph output negligible (`cg_user_recommendations`=8 vs 101 profiles) despite seeded reference (200 roles / 711 skill reqs).
10. **[A]** Per-user Future Readiness negligible (`frp_user_readiness`=8) despite 1,680 role-evolution reference rows.
11. **[A]** Employer surface inert (`recruiter_interactions`=0, `workforce_signals`=0) — Employer/Enterprise configs cannot be exercised.
12. **[V]** Fitment (45/40/15) and hire-probability (logistic blend) never calibrated against actual placements.
13. **[A]** Resume Studio persists edits to **localStorage only** (`mx-resume-userId`) — no server-side resume store, lost across devices, invisible to intelligence.
14. **[S]** `learning` and `market-intel` tabs are **static catalogs** (`COURSE_RECS`, `MARKET_CATALOG`) — not live LMS / labour-market feeds.
15. **[A]** Behavioural memory empty (`career_memory_snapshots`=0) → progress ledger / longitudinal growth degrade to empty timelines.
16. **[V]** No bias / adverse-impact / fairness testing on any scoring path. **[absence]**
17. **[A]** Career Builder as a foundational feed emits empty/degraded inputs to Passport / FRP / Employer / Recommendation consumers.
18. **[S/A]** High reliance on manual super-admin grants (`comm_entitlement_grants`) to bypass incomplete automated commercial flows.
19. **[V]** No reliability evidence (internal consistency / test-retest) for the competency runtime. **[absence]**
20. **[A]** Job listings fall back to `MARKET_CATALOG` sample data when no employer postings exist (real postings sparse).

## 🟡 MEDIUM (depth / completeness — mostly inferred from absence)

21. No published norm/percentile tables beyond `competency_norm_contexts`=1. **[absence]**
22. No documented question difficulty/IRT calibration. **[absence]**
23. No self-serve onboarding proven for consumer/professional configs (concierge-oriented). **[absence]**
24. No mobile-native Career Builder experience evidence. **[absence]**
25. No offline/low-bandwidth mode (India relevance). **[absence]**
26. No A/B or experimentation framework for recommendation effectiveness. **[absence]**
27. No outcome feedback loop (placed/promoted) wired back into scoring. **[absence]**
28. Market-intel salary/demand data not sourced from a live provider. **[absence]**
29. No multi-language support evidence for assessment/report copy. **[absence]**
30. Learning resources not mapped to live course providers / availability. **[absence]**
31. No data-retention / consent lifecycle documented for seeker PII. **[absence]**
32. No accessibility (WCAG) conformance evidence for the monolith. **[absence]**
33. No load/scale testing evidence for the ~25-tab monolith at 1M users. **[absence]**
34. Passport verification ("verified credentials") not backed by an external verifier. **[absence]**
35. No SLA / support runbook for institution cohorts. **[absence]**

## 🟢 LOW (polish, differentiation maturity — lower evidentiary weight; directional)

36. CareerBuilderPage.tsx is a ~7.8k-line monolith — maintainability/perf risk (not user-facing).
37. EI gauge dimensional naming inconsistency between surfaces beyond the count mismatch.
38. Resume templates rich but no recruiter-tested ATS scoring ground truth.
39. Interview/simulation results not persisted for longitudinal coaching.
40. Intelligence-hub composition quality is bounded by upstream emptiness (will improve automatically once data activates).

---

## Pareto

~70% of the distance from **Beta → Launch** is closed by resolving the **Activation** cluster (#1, #2, #4, #5, #7–#11, #13, #15) — i.e. *run and persist the intelligence the engines already produce, for the 101 existing profiles*. The remaining ~30% is **Validity** (#3, #6, #12, #16, #19) — reconcile the EI number, capture outcomes, and validate. Very little of the gap is Structural.
