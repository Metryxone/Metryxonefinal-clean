# CAPADEX 2.0 — Phase 1.8: API Architecture Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent API Architecture Constitution. **Do not modify APIs, do not create endpoints, do not change contracts, do not activate dormant APIs, do not rebuild integrations, do not change business logic.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED (repo grep on 2026-06-28); *judgement* = DERIVED. Never assume an endpoint is unused; dormant ≠ deletable; flag-ON ≠ activated; null ≠ 0. The API layer is the official contract between Frontend · Backend · AI · Enterprise · SuperAdmin · Third-party · Analytics · Mobile · Future integrations.
> **Basis:** live route audit + Phase 1.2–1.7 constitutions + memory (`csrf-protection`, `auth-rate-limiting`, `input-validation-pure-gate`, `express-literal-vs-param-route-order`, `entitlement-gate-scope`, `per-framework-admin-gate-gap`, `commercial-spine-razorpay-security`, `flag-gated-admin-tab-byte-identical`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.8.

---

## PART 1 — Current API Architecture Audit (MEASURED)

| Dimension | As-built | Note |
|---|---|---|
| **Style** | REST over Express (Node/tsx) + FastAPI (`backend-main/`) for bulk upload | proxied `/api/*` → :8080 |
| **Endpoint declarations** | **3,751** total | across `routes/` (303 files) + `routes.ts` (14,464 lines) |
| **By method** | GET **2,401** · POST **1,083** · PATCH **193** · DELETE **162** · PUT **62** | read-heavy (64% GET) — consistent with read-only intelligence surfaces |
| **Versioning** | `/api/v1`, `/api/v2`, `/api/v8` present (canonicalized; CSRF normalizes `/api/v1`) | NOT a uniform scheme — most routes are unversioned `/api/*` |
| **Admin APIs** | `/api/admin/*` + per-framework `/api/<fw>/admin/*` | `requireAuth`+`requireSuperAdmin`, 60s cache, `?refresh=1` |
| **Webhooks** | ~35 webhook references (Razorpay payment) | fail-closed; idempotency null-replay → 409 |
| **Health** | `/api/admin/health`, `/api/admin/health/:key`, EI health, employer-production-health, etc. | per-subsystem, not one canonical `/healthz` |
| **Feature-flag probes** | `*/enabled` (200 `{enabled:false}` when OFF) + gated data routes 503 OFF | flag-OFF byte-identical |

**Naming (MEASURED):** domain-prefixed (`/api/capadex/*`, `/api/career/*`, `/api/competency/*`, `/api/lbi/*`, `/api/employer/*`, `/api/rf/*`, `/api/outcome-intelligence/*`, `/api/frp/*`, `/api/pragati/*`). **Consistency (DERIVED):** kebab/lower paths, but envelope shape, error format, and versioning vary by era. **Duplicate/parallel APIs:** dormant `frontend/server` JWT app exposes a parallel surface (RETIRE candidate). **Large APIs:** `routes.ts` (14k) concentrates many endpoints — split candidate. **Consumer mapping:** frontend (wouter/react-query), SuperAdmin panels, employer e2e harness, FastAPI proxy.

**Honest gaps (DERIVED):** no platform-wide response envelope (status/data/metadata/correlationId/version); no correlation IDs; no OpenAPI spec; versioning is partial/inconsistent; observability is per-route, not uniform.

---

## PART 2 — API Philosophy

APIs exist to **Expose · Protect · Validate · Coordinate · Explain · Integrate · Observe.** Every API: one purpose · predictable · secure · versionable · documented · observable.

## PART 3 — API Domain Architecture

Every endpoint belongs to ONE domain: Assessment · Behaviour · Concern · Competency · Ontology · Decision · Journey · Learning · Career · Life · Conversation · AI · Reports · Enterprise · Administration · Subscriptions · Payments · Analytics · Configuration · Security. New cross-domain endpoints require Founder approval; domain is asserted by path prefix.

## PART 4 — Endpoint Constitution

Every endpoint documents Purpose · Method · Route · Consumer · Owner · Dependencies · Authentication · Authorization · Feature flags · Validation · Error codes · Rate limits · Caching · Version. Binding: register literal sub-paths (`/export.csv`) BEFORE `/:id` (param handler swallows them); auth-before-flag ordering (401 unauth → 503 flag-OFF).

## PART 5 — Request Constitution

Standardize Headers · Body · Query params · Route params · Validation · Defaults · Optional/Required fields · **Idempotency** · Size limits. Binding: input-validation pure zod gate (`lib/validate`, never mutates req, never-throws); mark required ONLY fields the handler already requires; CSRF token echoed on mutating calls; idempotency = write-once snapshot guard + `ON CONFLICT`.

## PART 6 — Response Constitution

Every response SHOULD contain Status · Data · Metadata · Timestamp · Correlation ID · Warnings · Errors · **Evidence · Confidence** · Version. **Never expose internal implementation** (no stack/DSN). **Honest finding:** Evidence/Confidence are surfaced on intelligence endpoints today, but a uniform envelope + correlationId + version are TARGETS not current state. Binding: Coverage ⟂ Confidence reported separately; null ≠ 0.

## PART 7 — Error Contract Constitution

Standardize Validation · Authentication · Authorization · Business · Database · AI · Enterprise · Feature-flag · Rate-limit errors + Timeouts + Recovery guidance. Binding: never-throws reads degrade (don't 500); flag-OFF → 503; unauth → 401; role-fail → 403 `role_not_authorised`; rate-limit → 429; honest counts from `rowCount`.

## PART 8 — Versioning Constitution

Protect backward compatibility; **never break existing clients.** Support Versioned APIs · Deprecation policy · Compatibility window · Migration guides · Sunset policy. **Honest finding:** `/api/v1|v2|v8` coexist with a large unversioned `/api/*` body → adopt additive versioning going forward (new contracts versioned; existing paths frozen, never silently changed).

## PART 9 — Authentication API Constitution

Audit Sessions · JWT · OAuth · OTP · Refresh tokens · MFA · Device trust · Enterprise login. Binding: session-based (`mx.sid`) + CSRF; super-admin always 2FA-gated (no bypass); register auto-logins; Bearer exempt from CSRF ONLY when no ambient cookie; auth secrets fail-fast in prod. Dormant JWT app = RETIRE.

## PART 10 — Authorization API Constitution

Standardize RBAC · Permissions · Tenant isolation · Organization/Faculty/Parent/Enterprise scope · Role validation. Binding: global `/api/admin` gate + 2nd mount closing `/api/<fw>/admin/*` (classifier MUST lowercase — Express routing is case-insensitive); tenant-scope EVERY detail read; entitlement gate is per-exported-function (sibling fns don't share a closure instance).

## PART 11 — Assessment API Constitution

Protect Assessment creation · Adaptive questions · Responses · Scoring · Evidence · Confidence · Completion · **Journey trigger**. Binding: authenticated `GET /api/competency/questions/select` (401 → static `ADAPTIVE_QUESTION_BANK_V2` fallback); `/adaptive-next` rebuilds the pool via the SAME analyze envelope; every failure falls back to the batch (200, never 500).

## PART 12 — Behaviour API Constitution

Protect Signals · Behaviour graph · Evidence · Confidence · Recommendations · Strengths · Concerns · Competencies. **Never bypass Behaviour APIs.** Binding: strengths ONLY from positive factors (never raw concern magnitude); signal ingest gated by DB `feature_flags` (`signal_intelligence`).

## PART 13 — Decision API Constitution (DOCUMENT DORMANT — NO ACTIVATION)

Document Decision · Evidence · Alternatives · Confidence · Outcome projection · Decision history · Decision status. **Document dormant APIs; do not activate.** WC-3/Orchestrator routes are flag-ON but DORMANT (no default-path data); stage taxonomy SPLIT (BE 5-stage vs FE `CAP_*`) — reconcile first. Activation is a separate approved phase.

## PART 14 — Journey API Constitution

Protect Journey · Milestones · Goals · Learning · Career · Life · Progress · Recommendations · Subscriptions. Growth-plan already EXISTS in M5 (wire, don't rebuild); experience switcher is a navigation PREFERENCE (never mutates canonical stage), gated server-side by allowedExperiences+role.

## PART 15 — Pragati API Constitution

Protect Conversation · Memory · Context · Reasoning · Recommendations · History · Safety · Evaluation. **Never introduce parallel AI endpoints.** APIs: `POST /session/start`, `/session/:id/respond`, `GET /session/:id/resume`, `/flow-config`, `/ontology` + admin — enhance these, never fork.

## PART 16 — Report API Constitution

Protect Reports · Interactive reports · Benchmarks · Visualizations · Recommendations · Evidence · Confidence · Exports · History. Binding: benchmarks suppressed <k_min=30; exports fire-and-forget (`/tmp/rf_exports`); `GET /api/rf/launchpad-suite/:subject` auth-before-flag (401/503/`?export=pdf|csv|json`); email preview `X-Preview-Subject` = `encodeURIComponent(subject)` (ASCII-only headers).

## PART 17 — Enterprise API Constitution

Protect Organizations · Departments · Teams · Institutions · Universities · Managers · Employees · Students · Faculty · Parents · Permissions · Governance. Binding: role-aware scope (admin OR institute_staff→staff_roles, faculty batch-confined); parent via consent; SCORE masked <30, roster always shown; `/enabled` ungated.

## PART 18 — SuperAdmin API Constitution

Protect Configuration · Questions · Concerns · Ontology · Subscriptions · Reports · Feature flags · Analytics · AI · Audit. Binding: `requireAuth`+`requireSuperAdmin`, 60s cache, `?refresh=1`; manual question POST always `status='draft'` (human approval is the ONLY coverage-changing op); file-registry flags absent from `/api/admin/feature-flags` → probe gated endpoint `res.ok`.

## PART 19 — Integration API Constitution

Document OpenAI · Firebase · Email (Zoho) · SMS · WhatsApp · Razorpay · Analytics · Cloud storage · HR/University/Enterprise systems · Webhooks · **Failure handling**. Binding: integrations honest-degrade (503/null + source tag), never fabricate; check Replit integrations before requesting keys; FastAPI upload proxied via Node `FASTAPI_URL` + `UPLOAD_SERVICE_TOKEN`.

## PART 20 — Search, Filter & Pagination Constitution

Standardize Filtering · Sorting · Pagination · Search · Cursor pagination · Full-text search · Semantic search. Admin reads paginate; large catalogs (Clarity ~30,638) read paginated. Cursor/semantic search are TARGETS (offset pagination today).

## PART 21 — Feature Flag Constitution

Every API enhancement supports Environment flags · Tenant flags · Role flags · Progressive rollout · **Kill switch** · Backward compatibility. Binding: file-registry default OFF, flag-OFF byte-identical incl. schema (gate DDL); security controls use env kill-switch (CSRF_PROTECTION_DISABLED, CSP_DISABLED) not a feature flag; `configureWorkflow` limit trap → env-var enable in dev.

## PART 22 — Observability Constitution

Every API exposes Health · Latency · Failures · Success rate · Correlation IDs · Tracing · Metrics · Audit. **Honest gap:** health endpoints exist per-subsystem; correlation IDs / tracing / metrics / success-rate do NOT exist yet — TARGETS. Audit redaction at WRITE time is in place.

## PART 23 — Performance Constitution

Audit Latency · Payload size · Compression · Caching · Streaming · Concurrency · Connection reuse. Binding: 60s admin cache; single JS thread ≈ 1 core ceiling → scale horizontally; `concernsPool` IS the main pool; voice/avatar stream over their own channels.

## PART 24 — Security Constitution

Protect Authentication · Authorization · CSRF · XSS · Injection · Replay protection · Rate limiting · Input validation · Secrets · PII. Binding (all IN PLACE): CSRF signed double-submit (global, mounted first, kill-switch, fail-closed); sliding-window rate limiting on login/register/mfa; HTML/email XSS escaping at interpolation; zod input gate; payment verify IDOR-linked; CSP allowlist with kill-switch; PII masked in audit artifacts.

## PART 25 — Webhook Constitution

Standardize Authentication · Retry · Idempotency · Signing · Ordering · Dead-letter handling · Monitoring. Binding: Razorpay webhook FAILS CLOSED; idempotency null-replay → 409 not 500; signature verified before processing. DLQ/ordering/monitoring are TARGETS.

## PART 26 — API Testing Constitution

Standardize Contract · Integration · Security · Performance · Regression · Load · Feature-flag tests. Current: employer HTTP e2e harness, isolation/privacy/degradation workflows, smoke asserts `{401,403,503}`. No contract/OpenAPI or load suite (GAP); load = hand-written Node http harness.

## PART 27 — API Documentation Constitution

Maintain OpenAPI · Endpoint catalog · Request/Response models · Error catalog · Authentication guide · SDK guidance · Integration guide · Version history. **Honest gap:** no OpenAPI spec today; catalog lives in `docs/phase-history.md` Phase Index Tables + replit.md Feature Map + memory.

## PART 28 — API Quality Gates

Verify: Existing APIs reused · No duplicate endpoints · No breaking contracts · Backward compatibility maintained · Security verified · Performance maintained · Documentation updated · Tests passing · Feature flags respected.

## PART 29 — API Review Board

```
Founder[ ] SolutionArchitect[ ] BackendArchitect[ ] APIArchitect[ ] AIArchitect[ ]
EnterpriseArchitect[ ] Security[ ] DevOps[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 30 — API Definition of Done

- [ ] Existing endpoints enhanced · [ ] Existing contracts preserved · [ ] Existing consumers unaffected · [ ] No duplicate APIs · [ ] Authentication verified · [ ] Authorization verified · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Correlation IDs implemented · [ ] Observability updated · [ ] Security verified · [ ] Performance maintained · [ ] Documentation updated · [ ] Tests passing · [ ] No regressions. (Stacks on Backend 1.6 / Database 1.7 DoDs.)

## PART 31 — API Maturity Model

| API domain | Current (DERIVED) | Target |
|---|---|---|
| Assessment | L4 Observable | L5 Intelligent |
| Behaviour | L3 Consistent | L4 Observable |
| Decision | L2 Reliable (DORMANT) | L5 Intelligent (post-activation) |
| Journey | L2 Reliable | L4 Observable |
| AI (Pragati) | L3 Consistent | L4 Observable |
| Enterprise | L3 Consistent | L4 Observable |
| Report | L3 Consistent | L4 Observable |
| Administration | L4 Observable | L4 Observable (maintain) |
| Analytics | L2 Reliable | L4 Observable |
| Configuration | L4 Observable | L4 Observable (maintain) |

Levels: L1 Operational · L2 Reliable · L3 Consistent · L4 Observable · L5 Intelligent. **Roadmap:** adopt a uniform response envelope + correlation IDs → publish OpenAPI + error catalog → uniform additive versioning → API observability (latency/success-rate/tracing) → (separate approved phase) activate Decision APIs.

---

## PART 32 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | API Architecture Constitution | all | 17 | Enterprise API Constitution | P17 |
| 02 | API Architecture Report | P1 | 18 | SuperAdmin API Constitution | P18 |
| 03 | API Domain Architecture | P3 | 19 | Integration API Constitution | P19 |
| 04 | Endpoint Constitution | P4 | 20 | Search & Pagination Constitution | P20 |
| 05 | Request Constitution | P5 | 21 | Feature Flag Constitution | P21 |
| 06 | Response Constitution | P6 | 22 | Observability Constitution | P22 |
| 07 | Error Contract Constitution | P7 | 23 | Performance Constitution | P23 |
| 08 | Versioning Constitution | P8 | 24 | Security Constitution | P24 |
| 09 | Authentication API Constitution | P9 | 25 | Webhook Constitution | P25 |
| 10 | Authorization API Constitution | P10 | 26 | API Testing Constitution | P26 |
| 11 | Assessment API Constitution | P11 | 27 | API Documentation Constitution | P27 |
| 12 | Behaviour API Constitution | P12 | 28 | API Quality Gates | P28 |
| 13 | Decision API Constitution | P13 | 29 | API Review Board | P29 |
| 14 | Journey API Constitution | P14 | 30 | API Definition of Done | P30 |
| 15 | Pragati API Constitution | P15 | 31 | API Maturity Assessment | P31 |
| 16 | Report API Constitution | P16 | | | |

---

**STOP — Phase 1.8 complete; API Architecture Constitution ready to FREEZE on approval. No APIs modified, no endpoints created, no contracts changed, no dormant APIs activated, no integrations rebuilt, no business logic changed.**
Honesty caveats: counts are MEASURED today (3,751 endpoint declarations: 2,401 GET / 1,083 POST / 193 PATCH / 162 DELETE / 62 PUT). A uniform response envelope, correlation IDs, OpenAPI/contract docs, consistent versioning, API-wide observability (latency/success-rate/tracing), cursor/semantic search, and webhook DLQ/ordering **do not exist yet** — they are TARGETS the constitution mandates, not current state. Decision APIs are dormant and explicitly NOT activated here.
