# CAPADEX 2.0 — Phase 1.6: Backend Architecture Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Backend Architecture Constitution. **No rebuild, no rewrite, no parallel services, no business-logic change, no dormant activation, no new services, no repository replacement.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (counts from this repo on 2026-06-28); *judgement* = DERIVED. Dormant ≠ missing; flag-ON ≠ activated; null ≠ 0; "service catalog" reflects files, not a controller/repository layering that doesn't exist yet.
> **Basis:** live `backend/` audit + Phase 1.2 (Engineering) + 1.3 (Product) + 1.4 (UX) + 1.5 (Frontend) constitutions + memory (`build-and-deploy-tooling`, `env-preflight-and-deploy-contract`, `csrf-protection`, `auth-rate-limiting`, `audit-log-redaction-unified-trail`, `capadex-decision-chain-gaps`, `express-literal-vs-param-route-order`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.6.

---

## PART 1 — Current Backend Architecture Audit (MEASURED)

| Dimension | As-built | Note |
|---|---|---|
| **Framework / Runtime** | Node.js + Express, run via **tsx** (no compile/typecheck gate) | + FastAPI (`backend-main/`) for bulk upload |
| **Routes** | **303** route files in `routes/` + `routes.ts` **14,464 lines** (monolith entry) | literal-before-param order enforced |
| **Services** | **432** files in `services/` | the real business layer |
| **Migrations** | **218** in `backend/migrations` (+ root 2; many tables also lazy `ensure*Schema`) | dual-path documented in 1.2 |
| **Feature flags** | `config/feature-flags.ts` **2,423 lines** (file registry, default OFF) + DB `feature_flags` table | two distinct systems |
| **Largest services** | `competency-runtime.ts` 2,827 · `report-pack.ts` 1,686 · `ontology-seed.ts` 1,499 · `hypothesis-engine.ts` 1,493 · `career-recommendation-aggregator.ts` 1,100 | large-service refactor candidates |
| **Auth** | session + OTP + super-admin 2FA (MFA emailed via Zoho); `passport`/session | `frontend/server` JWT app DORMANT |
| **AuthZ** | RBAC v2, per-framework admin gate, tenant isolation, role/parent/faculty scope | strong, structural fix in place |
| **DB** | PostgreSQL (Drizzle ORM) + MongoDB; ~1,304 tables | shared dev/prod DB |
| **Caching** | in-process 60s admin cache (`?refresh=1`) | no Redis layer |
| **Workers/queues/cron** | **none** (no BullMQ/node-cron); async = `setImmediate`/fire-and-forget | GAP for true background processing |
| **Events** | in-process `adaptive-event-bus` | not a durable broker |
| **Observability** | console logs + audit-log redaction + health checks | no tracing/metrics/correlation-IDs |

**Engines present:** Decision/WC-3 + Orchestrator (flag-ON, **DORMANT** — no default-path data) · Behaviour spine (signal→composite→pattern→graph→insight) · Assessment (CAPADEX/competency/LBI/adaptive) · Question Factory · Concern engine (Master ~2,489) · Journey/M5 + journey→growth bridge · Learning · Career OS/CGI · Subscription/entitlement/invoice · Report Factory · Pragati · AI services (OpenAI/Whisper/HeyGen).

**Strengths:** deep service layer, strong authZ/security spine, world-class ontology, honest flag discipline. **Technical debt:** `routes.ts` 14k monolith + large services; **no controller/repository separation** (routes call services and DB directly); tsx = no typecheck gate; no queue/worker/tracing infra. **Duplicate services:** dormant `frontend/server` + archived mirror. **Circular deps / unused modules:** scaffolded-but-unactivated competency `*_graph_*/propagation/fusion/ucip_*/sci_*` phases (empty, parkable). **Dormant capabilities:** Decision/WC-3, CGI, FRP back-half — documented, **NOT activated here**.

---

## PART 2 — Backend Philosophy

Backend exists to **Process · Validate · Secure · Orchestrate · Decide · Calculate · Persist · Explain · Observe.** Never duplicate business logic; never place business logic in controllers or the frontend. **Backend remains the authoritative business layer.**

## PART 3 — Domain Architecture

Current domains: Assessment · Behaviour · Decision · Journey · Learning · Career · Life · Conversation · Reports · Enterprise · Administration · Subscriptions · Payments · Analytics · Configuration. **Every enhancement belongs to an existing domain; a new domain requires Founder approval.**

## PART 4 — Service Architecture

Every service: Single-Responsibility · Composable · Reusable · Testable · Observable · Feature-flag-aware · Configurable. Document Purpose · Consumers · Dependencies · Performance · Side-effects · Reusability · Lifecycle · Ownership. **Never duplicate services** — extend the 432 existing. Large services (above) are decomposition candidates, not fork targets.

## PART 5 — Controller Architecture

Controllers ONLY: Receive · Validate · Authorize · Delegate · Return. Controllers NEVER Calculate · Score · Recommend · Persist business decisions · Call the DB directly. **Honest finding:** today route handlers in `routes.ts`/`routes/*` often do all of these inline → the constitution defines the **target separation**; extraction is a future approved refactor, not done here.

## PART 6 — Repository Architecture

Repositories ONLY manage persistence — no business logic. Document Ownership · Tables · Consumers · Dependencies · Transactions · Caching. **Honest finding:** no formal repository layer exists yet (services/routes query directly); this is the target, introduced additively over time.

## PART 7 — Business Logic Constitution

Business logic lives EXCLUSIVELY in services. Protect: Decision · Behaviour · Assessment · Subscription · Report · Enterprise · AI · Journey rules. **Never duplicate rules** (binding canons: strengths-only-from-positive-factors; Coverage⟂Confidence; k_min=30 abstain; ledger=paid-only; one shared resolver).

## PART 8 — Decision Engine Architecture (DOCUMENTATION ONLY — NO ACTIVATION)

Audit: Decision Engine · WC-3 chain (stage/outcome/journey/longitudinal/personalization) · Outcome Projection · Evidence · Confidence · Alternatives · Decision Graph · dependencies · consumers.
- **Current:** flags ON (`FF_WC3_*`, `FF_DECISION_ORCHESTRATOR`) but **DORMANT** — no default-path data flowing (flag-ON ≠ activated).
- **Dormant components:** orchestrator, journey→growth bridge wiring, decision→subscription mapping/entitlement.
- **Activation readiness:** stage taxonomy is SPLIT (BE 5-stage vs FE `CAP_*` 4-code) → reconcile first; outcome chain needs `FF_WC3_OUTCOME_CROSSWALK` + a populated behavioural spine.
- **Future evolution:** the #1 activation candidate platform-wide. **No activation in this phase.**

## PART 9 — Behaviour Engine Architecture

Audit Signal Processing · Behaviour Ontology (4-tier, 15,972 atomic) · Competencies (`onto_*`) · Evidence · Confidence · Recommendations · Mappings · Consumers · Reports · Journey integration. **Never bypass the Behaviour Engine** — all signals/insights route through the existing spine.

## PART 10 — Assessment Engine Architecture

Document Assessment flow · Adaptive questions · Scoring · Branching · Evidence collection · Progress · Completion · Recommendations · **Journey trigger** (every assessment begins a journey, never score-terminal).

## PART 11 — AI Service Architecture

Audit Pragati · OpenAI · Memory · Reasoning · Prompt Registry · Context · Conversation · Summarization · Safety · Fallback · Evaluation · Confidence · Observability. **Never create another AI layer.** Binding: AI-inert (no key) → null + source tag; every AI output carries evidence/confidence/explanation/alternatives. **Honest gap:** no prompt registry / eval harness yet (debt to add additively).

## PART 12 — Report Factory Architecture

Audit Templates · Builders (`report-pack.ts`, byte-identical `BUILDERS`) · Charts · Narratives · Recommendations · Benchmarks (k=30 suppression) · Exports (pdfkit, `/tmp/rf_exports`, fire-and-forget) · Interactive reports · Consumers. Evolve toward living reports (1.4 P10) additively.

## PART 13 — Authentication Constitution

Document Sessions · JWT · OAuth · OTP · Refresh · Device trust · MFA · Enterprise login. Binding: super-admin always 2FA-gated (no bypass); auth secrets fail-fast in prod; identity from verified session/token only; the dormant JWT app is a parity liability → RETIRE.

## PART 14 — Authorization Constitution

Document Roles · Permissions · RBAC · Tenant isolation · Feature flags · Organization/Parent/Faculty/Enterprise scope. Binding: `/api/admin` + per-framework `/api/<fw>/admin/*` gated (classifier lowercases); tenant-scope EVERY detail read (not just lists); faculty batch-confined; parent by consent; 403 role_not_authorised.

## PART 15 — Configuration Constitution

Audit Environment variables · Runtime config · Feature flags · AI/Assessment/Subscription/Security config. Binding: `docs/ENVIRONMENT.md` is SSOT; boot preflight aborts in prod on missing REQUIRED (`SESSION_SECRET`,`DATABASE_URL`), warns on degrading ones; secrets via the secrets manager, never interpolated to stdout.

## PART 16 — Event Architecture

Document Domain · Assessment · Journey · Behaviour · AI · Subscription · Enterprise · Audit · Notification events. **Current:** in-process `adaptive-event-bus` (connect, don't rebuild); identity-space trap (event user_id BIGINT vs scope_id TEXT vs UUID — never Number()-coerce). A durable broker is a future target.

## PART 17 — Queue & Worker Architecture

Audit Background jobs · Queues · Workers · Retries · DLQ · Cron · Schedulers · Failure recovery. **Honest finding:** NONE exist — async work is `setImmediate`/fire-and-forget (poll the row for completion). A real queue/worker tier is a future approved addition; until then, fire-and-forget must be idempotent + row-polled.

## PART 18 — Error Handling Constitution

Standardize Validation · Authentication · Authorization · Business · AI · Database · Integration errors + Retry · Recovery · **Correlation IDs**. Binding: never-throws read pattern (degrade, don't 500); never expose technical messages / DSN; honest counts from `rowCount` not input cardinality. Correlation IDs are a GAP to add.

## PART 19 — Logging & Observability Constitution

Document Application · Audit · Security · AI · Decision · Behaviour · Performance logs + Tracing · Metrics · Health checks · Dashboards. Binding: audit-log redaction at WRITE time through shared `redactJson`; unified read = metadata only. **Honest gap:** no tracing/metrics backend yet (console + health only).

## PART 20 — Performance Constitution

Audit Service latency · DB calls · Memory · CPU · Concurrency · Caching · Async · Streaming · Response time · Scalability. Binding: backend tsx ≈ prod; single JS thread ≈ 1 core ceiling → scale horizontally; COUNT(*) not stale stats; 60s admin cache.

## PART 21 — Security Constitution

Protect Authentication · Authorization · Secrets · Encryption · PII · API keys · Sessions · CSRF · XSS · Injection · Rate limiting · Replay protection. Binding (all IN PLACE per memory): CSRF signed double-submit (global, mounted first, kill-switch); auth rate limiting (sliding window); HTML/email XSS escaping at interpolation; input-validation pure zod gate; audit redaction; security headers/CSP with kill-switch; payment verify IDOR-linked + webhook fail-closed.

## PART 22 — Integration Architecture

Document OpenAI · Firebase · Email (Zoho) · SMS · WhatsApp · Payment gateway (Razorpay) · Analytics · Cloud storage · Third-party APIs · HR/University/Enterprise systems · **Failure handling**. Binding: integrations honest-degrade (503/null + source tag), never fabricate; check Replit integrations before asking for keys.

## PART 23 — Feature Flag Constitution

Every enhancement supports Environment flags · Tenant flags · Role flags · **Kill switch** · Progressive rollout · Backward compatibility. Binding: file-registry default OFF; flag-OFF byte-identical incl. schema (gate the DDL); security controls use env kill-switch not a feature flag; `configureWorkflow` counts .replit-defined workflows (limit trap → env-var enable in dev).

## PART 24 — Backend Testing Constitution

Standardize Unit · Integration · API · Service · Repository · AI · Security · Performance · Regression tests. **Current:** isolation/privacy/degradation test workflows exist; no unified backend test runner (tsx, no tsc gate). Add additively.

## PART 25 — Backend Documentation

Maintain Architecture · Service Catalog · Domain Catalog · Repository Catalog · API References · Configuration · Deployment · Feature Flags · Operational Guides. SSOT in `docs/*` + `.agents/memory/*` + replit.md.

## PART 26 — Backend Quality Gates

Verify: Existing services/repositories/controllers reused · No duplicate business logic · No duplicate services · Performance maintained · Security maintained · Observability maintained · Feature flags respected · Documentation updated.

## PART 27 — Backend Review Board

```
Founder[ ] BackendArchitect[ ] SolutionArchitect[ ] Product[ ] AIArchitect[ ]
BehaviourScientist[ ] Security[ ] EnterpriseArchitect[ ] DevOps[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 28 — Backend Definition of Done

- [ ] Existing services enhanced · [ ] Existing repositories/controllers/middleware reused · [ ] Existing AI/Decision/Behaviour engine reused · [ ] Feature flags respected · [ ] Observability + Logging updated · [ ] Performance maintained · [ ] Security verified · [ ] Tests passing · [ ] Documentation updated · [ ] No regressions. (Stacks on Engineering 1.2 / Product 1.3 / UX 1.4 / Frontend 1.5 DoDs.)

## PART 29 — Backend Maturity Model

| Domain | Current (DERIVED) | Target |
|---|---|---|
| Assessment | L4 Observable | L5 Predictive |
| Behaviour | L3 Composable | L4 Observable |
| Decision | L2 Reusable (DORMANT) | L5 Predictive (post-activation) |
| Journey | L2 Reusable | L4 Observable |
| Learning | L2 Reusable | L3 Composable |
| Career | L3 Composable | L4 Observable |
| Reports | L3 Composable | L4 Observable |
| Enterprise | L3 Composable | L4 Observable |
| Subscriptions/Payments | L2 Reusable | L4 Observable |
| AI | L2 Reusable | L4 Observable (registry+eval) |
| Configuration/Security | L4 Observable | L4 Observable (maintain) |

Levels: L1 Operational · L2 Reusable · L3 Composable · L4 Observable · L5 Predictive. **Roadmap:** add observability (tracing/metrics/correlation-IDs) → introduce controller/repository separation additively → stand up a queue/worker tier → activate the Decision engine (separate approved phase) → reach L5 Predictive on Assessment/Decision.

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Backend Architecture Constitution | all | 14 | Authorization Constitution | P14 |
| 02 | Backend Architecture Report | P1 | 15 | Event Architecture | P16 |
| 03 | Domain Architecture | P3 | 16 | Queue & Worker Architecture | P17 |
| 04 | Service Architecture | P4 | 17 | Configuration Constitution | P15 |
| 05 | Controller Constitution | P5 | 18 | Security Constitution | P21 |
| 06 | Repository Constitution | P6 | 19 | Observability Constitution | P19 |
| 07 | Business Logic Constitution | P7 | 20 | Performance Constitution | P20 |
| 08 | Decision Engine Architecture | P8 | 21 | Backend Testing Constitution | P24 |
| 09 | Behaviour Engine Architecture | P9 | 22 | Backend Quality Gates | P26 |
| 10 | Assessment Engine Architecture | P10 | 23 | Backend Review Board | P27 |
| 11 | AI Service Architecture | P11 | 24 | Backend Definition of Done | P28 |
| 12 | Report Factory Architecture | P12 | 25 | Backend Maturity Assessment | P29 |
| 13 | Authentication Constitution | P13 | | | |

---

**STOP — Phase 1.6 complete; Backend Architecture Constitution ready to FREEZE on approval. No backend changes, no services refactored, no dormant engines activated, no workflows redesigned, no business logic modified, no new services, no repositories replaced.**
Honesty caveats: counts are MEASURED today (432 services / 303 route files / 218 migrations / routes.ts 14,464 / feature-flags.ts 2,423). The controller/repository separation (P5/P6), queue/worker tier (P17), tracing/metrics/correlation-IDs (P18/P19), prompt registry/eval (P11), and unified test runner (P24) **do not exist yet** — they are TARGETS the constitution mandates going forward, not current state. The Decision engine is flag-ON but DORMANT — documented for activation readiness, explicitly NOT activated here.
