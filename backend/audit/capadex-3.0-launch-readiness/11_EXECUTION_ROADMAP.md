# 11 · Recommended Execution Roadmap

Ordered by **business value · production impact · dependency · customer impact · engineering effort**. This is
a launch-execution sequence derived from the blockers — **measurement-driven, no redesign, no new
architecture, no dormant-flag activation to inflate metrics.** Human approval required before any of it.

> Guiding answer to the final question — *"what remains before production release?"*: not large missing
> features, but **(a) flip operational toggles, (b) prove it under real usage, (c) pay down maintainability
> debt.** The build runs; the unknowns are runtime, not structural.

## Phase 0 — Launch-Critical operational gating (days, blocks pilot)
*Highest value / lowest effort / hard dependency for any paid use.*
1. **LC-2 Secrets:** set & verify all prod secrets (`SESSION_SECRET`, `DATABASE_URL`, `MONGODB_URI`,
   `OPENAI_API_KEY`/`EMERGENT_LLM_KEY`, `ZOHO_EMAIL`/`ZOHO_APP_PASSWORD`, real rotated `UPLOAD_SERVICE_TOKEN`,
   Razorpay live keys). env-preflight already fails fast on the required ones — extend the check to the
   revenue/AI/MFA ones as WARN→confirmed.
2. **LC-1 Payments:** set Razorpay live keys and **disable demo-mode fallback** in production; verify
   order→verify→webhook against a real test transaction.
3. Confirm archived-mirror and dormant `frontend/server` JWT app are **not** in the deploy path; confirm
   `CSP_DISABLED`/`CSRF_PROTECTION_DISABLED` unset in prod.

**Exit:** a controlled enterprise pilot can begin.

## Phase 1 — Prove it under real usage (the production-confidence conversion) (2–6 weeks)
*This is the single most important phase — it converts every `null` axis into measured evidence.*
4. **LC-3 Pilot:** onboard 1–2 design-partner tenants; generate real assessment/career/employer/outcome data.
5. **LC-4 Load test:** promote the existing ad-hoc bench scripts into a standardized Node `http` load harness
   (no repeatable load gate exists today); measure p50/p95/p99 +
   error rate for top journeys (login, assessment complete, report, employer match) on a staging instance with
   seeded representative data.
6. **Multi-instance safety:** verify the 34 background jobs / schedulers single-fire across Cloud Run
   instances; verify Postgres session store + lazy `CREATE TABLE` under concurrency.
7. **H-1 RBAC enforcement E2E:** create real grants/members; run `rbac-enforcement.test.ts` + isolation suite
   green against pilot data.
8. Run privacy + isolation + degradation suites green; capture outcome data to begin upgrading certification
   composers from STRUCTURAL → evidence-backed (do **not** force; let evidence drive it).

**Exit:** production-confidence axis becomes measurable (no longer `null`); maturity can be re-assessed.

## Phase 2 — Enterprise hardening (parallel with Phase 1; pre-broad-GA)
9. **H-2 Test/CI:** add a unified test runner + coverage + a CI gate (today only the frontend build is
   enforced).
10. **H-3 SSO:** confirm/implement SAML/OIDC if target customers require it.
11. **H-4/H-5:** document backup/restore DR runbook; add external observability/APM for SLA monitoring.
12. **SEC hardening:** SEC-1 (UPLOAD_SERVICE_TOKEN rotation), SEC-2 (hash OTPs + TTL), SEC-4 (admin-path
    allowlist guard test), then commission a **third-party penetration test**.

## Phase 3 — Customer-experience completion (medium)
13. **M-1:** complete Career Builder builder/roadmap-mutation paths + Learning intervention *execution* loop.
14. **M-2:** integrate data for institutional placement/accreditation (retire honest-stubs).
15. **M-4:** code-split the >1 MB front-end pages (CareerBuilderPage, EmployerPortalPage, index).
16. **M-5:** AI Test Generator rule-based fallback (AI-1); audio client clean 503 (AI-2/L-2).

## Phase 4 — Maintainability debt (post-launch, continuous; Future Enhancement)
17. **AD-2:** per-pair v1/v2 deprecation/retirement decisions (use the MX-700 lifecycle engine that exists for
    exactly this); retire dead v1 (archive, never delete).
18. **AD-1:** generated schema catalog + table-name collision lint over the 1,441-table surface.
19. **AD-3/AD-4:** incrementally extract `routes.ts` inline endpoints into modules; converge dual persistence.
20. **Governance:** keep the MX-700/MX-800 dormant meta-layer OFF until runtime evidence justifies activation.

## Sequencing rationale
- **Phase 0** unblocks revenue and is hours/days of config — do first.
- **Phase 1** is the crux: nothing can be honestly called "production-ready" until real usage + load evidence
  exists. Everything structural is already built.
- **Phases 2–3** make it *broadly* sellable and complete the PARTIAL journeys.
- **Phase 4** is continuous engineering health, explicitly **not** a launch gate.

## One-line honest answer
> CAPADEX is **structurally built and security-hardened**, builds and boots cleanly, with **8/11 core journeys
> complete**. To launch as an enterprise platform it needs: **(0)** prod secrets + live payments,
> **(1)** a real pilot + load test to convert `null` production-confidence into evidence, **(2)** enterprise
> hardening (CI, SSO, DR, observability, pen-test), and **(3)** completion of 3 PARTIAL journeys — **not** a
> redesign and **not** new features. Production-Ready remains **WITHHELD by design** until runtime evidence
> exists.
