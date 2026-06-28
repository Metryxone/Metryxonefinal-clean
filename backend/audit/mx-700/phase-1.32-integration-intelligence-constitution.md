# CAPADEX 2.0 — Phase 1.32: Integration Intelligence Constitution (API Platform + Event Bus + Webhooks + Connectors + Orchestration + Synchronization + Interoperability)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Integration Intelligence Constitution. **Do not rebuild, do not create a second integration platform, do not replace the API architecture, do not create API V2, do not duplicate APIs / connectors, do not bypass the API gateway, do not modify business logic, do not activate dormant integration capabilities, never bypass Security / Data / Enterprise / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** + connector-key presence-checks (live `DATABASE_URL` + env + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec; secret VALUES never printed, names only); *judgement* = DERIVED. **API ≠ Integration · Integration ≠ Synchronization ≠ Replication · Webhook ≠ Event ≠ Message ≠ Transaction · Connector ≠ Adapter · REST ≠ RPC · GraphQL ≠ REST · Request ≠ Workflow ≠ Orchestration · Retry ≠ Success · Delivery ≠ Processing · Queue ≠ Persistence · Acknowledgement ≠ Completion · Availability ≠ Reliability · Coverage ≠ Confidence · Evidence ≠ Confidence.** built ≠ activated; flag-ON ≠ runtime-active. Human remains accountable. Never fabricate; never estimate.
> **Basis:** connector-key audit + integration-substrate exact counts + repo discovery (Replit integrations, adaptive-event-bus, Razorpay/FastAPI/Zoho seams) + memory (`commercial-spine-razorpay-security`, `runtime-activation-traps`, `cross-module-event-sync`, `report-factory-engines`, `employer-job-store-projection`, `csrf-protection`, `env-preflight-and-deploy-contract`, `secrets-handling-hygiene`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.32. **Integration Intelligence connects every internal engine and every external platform — securely, reliably, governed, observably.**

---

## PART 1 — Current Integration Intelligence Audit (MEASURED; n_live_tup NOT used)

### Connector key presence (env, names only — values NEVER printed)
| Connector | Secret | State |
|---|---|---|
| OpenAI (LLM/Whisper) | `OPENAI_API_KEY` | **absent** |
| Emergent LLM | `EMERGENT_LLM_KEY` | **absent** |
| Razorpay (payments) | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | **absent** |
| Zoho (email/MFA) | `ZOHO_EMAIL` / `ZOHO_APP_PASSWORD` | **absent** |
| FastAPI upload proxy | `FASTAPI_URL` / `UPLOAD_SERVICE_TOKEN` | **absent** |

→ **Every external connector secret is absent in this environment** → all outbound connectors are **DORMANT (externally gated, honestly inert)**.

### Repository implementation (code) — the integration surfaces exist
| Surface | Source | Class |
|---|---|---|
| **API platform / gateway** | `routes.ts` (~13.2k lines) + modular `routes/*` under one Express app; `/api/*` proxied | **LIVE** |
| **In-process event bus** | `services/adaptive-event-bus.ts` | **LIVE (runtime-active)** |
| Replit integrations (image/chat/audio/batch) | `replit_integrations/*` | **LIVE (code), key-gated** |
| Payment connector (Razorpay seam) | payment routes + `capadex_payments` (`commercial-spine-razorpay-security`) | **PARTIAL (key-gated)** |
| FastAPI upload proxy | Node→FastAPI (`FASTAPI_URL`) | **PARTIAL (key-gated)** |
| Email connector (Zoho SMTP) | `email.ts` | **PARTIAL (key-gated)** |
| LLM clients | `services/aiClient.ts`, `ai-governance-llm.ts`, `aiTestGenerator.ts` | **DORMANT (no key)** |
| Voice/avatar (Whisper/HeyGen seams) | `services/voice-screening-*.ts` | **PARTIAL (honest-503 seam)** |
| Background/export jobs | `rf_export_jobs` (setImmediate fire-and-forget) | **LIVE** |

### Database population (exact COUNT\*)
| Domain | Table | **Live count** | Class |
|---|---|---:|---|
| **Event bus (runtime)** | `adaptive_intelligence_events` | **24** | **LIVE** |
| Report export jobs | `rf_export_jobs` | **10** | **LIVE** |
| Payment ledger | `capadex_payments` | **2** | **LIVE (demo/small)** |
| Employer job store | `employer_jobs` | **2** | **LIVE (small)** |
| Payment reconciliation | `payment_reconciliations` | **0** | EMPTY |
| Commercial events/links | `comm_payment_links` / `comm_subscription_events` / `comm_usage_events` | **0** | DORMANT |
| Bulk upload jobs | `bulk_upload_jobs` | **0** | DORMANT |
| Job posting/distribution | `job_postings` **0** · `job_applications` **0** · `job_distributions` **0** | **0** | DORMANT |
| Event lake / governance / verification | `anl_event_lake` / `governance_events` / `verification_events` / `m4_ai_audit_events` | **0** | DORMANT |

### Runtime activation · duplicates · broken integrations / sync / retries / contracts (explicit, per spec PART 1)
- **Runtime activation:** **internal integration is live; external integration is uniformly key-gated and inert.** The genuine runtime integration spine is the **in-process adaptive event bus** (`adaptive_intelligence_events`=24 — cross-module sync per `cross-module-event-sync`) plus fire-and-forget background jobs (`rf_export_jobs`=10). All *external* connectors (LLM, Razorpay, Zoho, FastAPI, Whisper/HeyGen) are dormant because **every connector secret is absent** — this is honest external gating, not breakage.
- **Broken integrations / retries / contracts:** **none observed as broken.** The payment path enforces local↔gateway linkage + IDOR guard, webhooks **fail CLOSED**, and idempotency null-replay returns 409 not 500 (`commercial-spine-razorpay-security`). Voice/avatar connectors degrade to an honest 503 seam rather than fabricating output. No broken FK/contract surfaced in the integration tables.
- **Synchronization vs replication:** **Integration ≠ Synchronization ≠ Replication** — the event bus is in-process pub/sub (one DB), not cross-system replication; the identity-space trap (event-log `user_id` BIGINT vs scope_id TEXT vs UUID career-seeker ids) must never be `Number()`-coerced (`cross-module-event-sync`).
- **Duplicate APIs / connectors:** none harmful — ONE Express app is the canonical API surface; the job store is intentionally SPLIT (posting→`job_postings`, assessment/interview→`employer_jobs`, bridged by projection — `employer-job-store-projection`), which is a deliberate two-table design, not a duplicate connector.
- **Webhook / queue / DLQ:** no dedicated message-queue, dead-letter-queue, or outbound-webhook-delivery table is populated; background work is `setImmediate`/fire-and-forget, not a durable queue — **Queue ≠ Persistence** holds (no persistent queue layer).

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **CAPADEX's integration architecture is real and well-shaped at the code layer — one canonical Express API surface, a live in-process event bus, security-correct payment/webhook seams (fail-closed, IDOR-guarded, idempotent), and honest-503 degradation for AI/voice connectors — but in THIS environment it is almost entirely externally inert: every connector secret is absent, so LLM, payments, email, upload-proxy, and avatar connectors are DORMANT.** The only genuinely runtime-active integration is the *internal* adaptive event bus (24 events) and fire-and-forget export jobs (10). **No fabrication:** absent connector keys are reported absent (presence-checked, values never printed); key-gated connectors are DORMANT not "working"; `capadex_payments`=2 is reported as demo/small live rows, not transactional revenue; **Built ≠ Activated, Flag-ON ≠ Runtime-Active, Delivery ≠ Processing, Retry ≠ Success** all preserved. There is **no materialized integration observability/analytics layer** (queue depth, retry rate, connector health are unmeasured — DERIVED gap, consistent with 1.31's 0-matview finding).

**Strengths (DERIVED):** single canonical API surface; live internal event bus for cross-module sync; security-correct payment + webhook design (fail-closed, IDOR, idempotency 409); honest-503 connector degradation (never fabricates AI/voice output); Replit-managed integrations for media; FastAPI upload proxy topology documented. **Technical debt / GAPS (DERIVED):** all external connectors key-gated/inert here; no durable queue / DLQ / outbound-webhook-delivery persistence; no integration observability/analytics (latency/retry/connector-health unmeasured); reconciliation + commercial event streams empty. **Dormant:** external connectors, job posting/distribution, event lake, governance/verification event streams. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Integration Philosophy

Integration Intelligence exists to Connect · Exchange · Synchronize · Coordinate · Route · Publish · Consume · Observe. **It never creates business logic, duplicates data ownership, bypasses governance, or breaks security.**

## PART 3 — Integration Domain Architecture

API Platform · Gateway · REST · GraphQL · Events · Webhooks · Connectors · Queues · Schedulers · Background Workers · Synchronization · Observability · Governance.

## PART 4 — API Platform Constitution

API Platform remains **the only canonical integration surface.** Protect REST APIs · Contracts · Endpoints · Routing · Versioning · Documentation. **Never duplicate APIs.** Binding: ONE Express app; register literal sub-paths BEFORE `/:id` param handlers (`express-literal-vs-param-route-order`); CSRF mounted first (`csrf-protection`).

## PART 5 — API Contract Constitution

Protect Schemas · DTOs · Versioning · Compatibility · Validation · Error models · Backward compatibility. Binding: input-validation pure-gate (Zod, never-throws); additive flag-gated phases byte-identical OFF.

## PART 6 — Event Constitution

Protect Publishers · Consumers · Topics · Routing · Ordering · Correlation IDs · Idempotency. Binding: reuse `adaptive-event-bus.ts` (connect, don't rebuild); never `Number()`-coerce identity across BIGINT/TEXT/UUID spaces (`cross-module-event-sync`).

## PART 7 — Webhook Constitution

Protect Inbound · Outbound webhooks · Validation · Signing · Retries · Replay protection. Binding: payment webhook **fails CLOSED**; idempotency null-replay → 409 not 500 (`commercial-spine-razorpay-security`); no outbound-webhook-delivery persistence yet (gap).

## PART 8 — Connector Constitution

Protect OpenAI · Razorpay · Firebase · Google · Whisper · HeyGen · Email · SMS · Future connectors. **Never duplicate connectors.** Binding: all key-gated → absent secret = honest DORMANT/503, never fabricated output; Replit integrations for media; activate via real endpoints not SQL (`runtime-activation-traps`).

## PART 9 — Orchestration Constitution

Protect Workflow coordination · Service composition · Execution order · Dependencies · Recovery · Timeouts. Binding: **Request ≠ Workflow ≠ Orchestration**; orchestrators COMPOSE never recompute (`career-os-orchestration-engines`); one sole idempotent snapshot builder (avoid fire-and-forget races).

## PART 10 — Synchronization Constitution

Protect Data sync · Identity sync · Status sync · Retry · Conflict resolution. Binding: **Sync ≠ Replication**; merged task-agent backfills carry DDL not rows (`merged-task-data-not-in-live-db`).

## PART 11 — Integration Evidence Constitution

Evidence from Requests · Responses · Events · Logs · Retries · Failures · Acknowledgements; contains Source · Coverage · Confidence · Quality.

## PART 12 — Integration Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Availability · Reliability · Trust. Binding: **Availability ≠ Reliability**; absent connectors = 0 evidence, never inferred-reliable.

## PART 13 — Integration Explainability Constitution

Every integration explains Source · Destination · Purpose · Authentication · Response · Failure · Retry.

## PART 14 — Integration Security Constitution

Protect API keys · OAuth · JWT · Webhook signatures · Encryption · Tenant isolation · Rate limits. Binding: secrets in env/Secret Manager only (`secrets-handling-hygiene`); CSRF/rate-limit global; payment verify requires local↔gateway linkage + IDOR.

## PART 15 — Integration Observability Constitution

Monitor API latency · Availability · Retries · Failures · Timeouts · Queue depth · Webhook health · Connector health. Binding: **no materialized observability layer yet (DERIVED gap)** — latency/retry/connector-health unmeasured.

## PART 16 — Integration Analytics Constitution

Measure API usage · Latency · Availability · Retry rates · Error rates · Success rates · Connector usage. Binding: unmeasured (no analytics rollup); honest gap.

## PART 17 — Integration AI Constitution

**AI may explain · route · recommend · summarize. Never executes external integrations autonomously. Human approval mandatory where required.** Cross-ref 1.28 (AI runtime dormant, no key).

## PART 18 — Enterprise Integration Constitution

Support SSO · LDAP · SCIM · ERP · HRMS · LMS · CRM · Institution systems · Corporate systems. Binding: identity/OAuth seam present (`firebase-auth.ts`); enterprise connectors scaffolded, not activated.

## PART 19 — SuperAdmin Integration Constitution

Support Connector configuration · API policies · Webhook configuration · Monitoring · Retry policies. Binding: admin-gated; configure connectors via secrets + admin panels, never hardcode.

## PART 20 — Integration Testing Constitution

Standardize API · Webhook · Contract · Retry · Performance · Integration tests. Binding: degradation suites exist (`voice-screening-degradation`, `live-avatar-degradation`); smoke `{401,403,429,503}`.

## PART 21 — Integration Documentation

Maintain API catalog · Connector catalog · Webhook catalog · Integration guide · Architecture guide. SSOT: `docs/integration-map.md` + `replit.md` deployment section.

## PART 22 — Integration Governance

Every enhancement answers: Why is Integration changing? · What existing capability is reused? · Does this duplicate an API? · Does this preserve interoperability?

## PART 23 — Integration Quality Gates

Verify Existing APIs reused · Contracts preserved · Security preserved · Observability preserved · Documentation updated · No duplicate integrations.

## PART 24 — Integration Review Board

```
Founder[ ] ChiefIntegrationArchitect[ ] PlatformArchitect[ ] APIArchitect[ ] SecurityArchitect[ ] EnterpriseArchitect[ ]
Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 25 — Integration Definition of Done

- [ ] Existing APIs reused · [ ] Contracts preserved · [ ] Security preserved · [ ] Observability preserved · [ ] Documentation updated · [ ] No regressions.

## PART 26 — Integration Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| API Platform | **L4 Intelligent** (one canonical surface, CSRF-first) | L5 Autonomous |
| Gateway | L3 Managed (Express + proxy; no separate gateway tier) | L4 Intelligent |
| Events | L3 Managed (live in-process bus, 24 events) | L4 Intelligent |
| Webhooks | L3 Managed (fail-closed, idempotent; no delivery persistence) | L4 Intelligent |
| Connectors | L2 Guided (coded + honest-503; all key-gated/inert here) | L4 Intelligent |
| Synchronization | L2 Guided (in-process; no cross-system replication) | L4 Intelligent |
| Observability | L1 Operational (no latency/retry/health metrics) | L4 Intelligent |
| Enterprise Integration | L1 Operational (OAuth seam only; SSO/SCIM/ERP scaffolded) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Managed · 4 Intelligent · 5 Autonomous Integration Platform — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** provision connector secrets to lift external connectors from DORMANT→LIVE (no fabrication until real keys flow) → add durable queue + dead-letter + outbound-webhook-delivery persistence → add integration observability/analytics (latency/retry/connector-health) → formalize enterprise connectors (SSO/SCIM/ERP/HRMS/LMS/CRM) → keep ONE integration platform, never duplicate APIs/connectors, security + tenant isolation preserved, human approval mandatory.

## PART 27 — Integration Scientific Validation

Document Distributed systems · API design · REST · Event-driven architecture · Message reliability · Integration patterns · Service mesh · Systems engineering.

## PART 28 — Integration Evolution Strategy

Future evolution supports New APIs · connectors · events · queues · webhooks · enterprise integrations — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI · Enterprise · Security · Data Intelligence. (Additive + flag-gated; byte-identical flag-OFF; API platform + security + interoperability never bypassed.)

---

## PART 29 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Integration Intelligence Constitution | all | 13 | Integration Security Constitution | P14 |
| 02 | Repository Integration Audit | P1 | 14 | Integration Observability Constitution | P15 |
| 03 | API Platform Constitution | P4 | 15 | Integration Analytics Constitution | P16 |
| 04 | API Contract Constitution | P5 | 16 | Enterprise Integration Constitution | P18 |
| 05 | Event Constitution | P6 | 17 | SuperAdmin Integration Constitution | P19 |
| 06 | Webhook Constitution | P7 | 18 | Integration Governance Constitution | P22 |
| 07 | Connector Constitution | P8 | 19 | Integration Quality Gates | P23 |
| 08 | Orchestration Constitution | P9 | 20 | Integration Review Board | P24 |
| 09 | Synchronization Constitution | P10 | 21 | Integration Definition of Done | P25 |
| 10 | Integration Evidence Constitution | P11 | 22 | Integration Scientific Validation | P27 |
| 11 | Integration Confidence Constitution | P12 | 23 | Integration Evolution Strategy | P28 |
| 12 | Integration Explainability Constitution | P13 | 24 | Integration Maturity Assessment | P26 |

---

**STOP — Phase 1.32 complete; Integration Intelligence Constitution ready to FREEZE on approval. Integration architecture not modified, API platform not replaced, no second integration platform created, no dormant integration capabilities activated, business logic not changed, Data / Security / Enterprise / no intelligence engine bypassed.**
Honesty caveats: counts MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres + connector-key presence-checks (secret values NEVER printed); `n_live_tup` NOT used (per spec). **Every external connector secret is absent in this environment → LLM/payments/email/upload/avatar connectors are DORMANT (honest external gating, not breakage); the only runtime-active integration is the internal adaptive event bus (24 events) + export jobs (10).** API ≠ Integration; Built ≠ Activated; Flag-ON ≠ Runtime-Active; Delivery ≠ Processing; Retry ≠ Success; Availability ≠ Reliability; Queue ≠ Persistence; human remains accountable.
