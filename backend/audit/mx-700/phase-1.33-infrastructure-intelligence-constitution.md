# CAPADEX 2.0 — Phase 1.33: Infrastructure Intelligence Constitution (Platform Infrastructure + Compute + Storage + Network + Deployment + Scalability + Resiliency + Observability)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Infrastructure Intelligence Constitution. **Do not rebuild, do not create a second infrastructure platform, do not replace the deployment architecture, do not create Infrastructure V2, do not duplicate deployment pipelines, do not modify business logic, do not activate dormant infrastructure capabilities, never bypass Security / Data / Integration / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via exact inspection of live repo + environment + deployment config (`.replit`, `scripts/deploy-gcp.sh`, `firebase.json`, `backend/index.ts`, pool config) on 2026-06-28 — **NEVER `n_live_tup`**, per spec; secret VALUES never printed; *judgement* = DERIVED. **Server ≠ Service ≠ Process ≠ Container ≠ Environment ≠ Deployment ≠ Release · Availability ≠ Reliability ≠ Resilience · Scaling ≠ Performance ≠ Capacity ≠ Utilization · Backup ≠ Disaster Recovery · Monitoring ≠ Observability · Logging ≠ Monitoring · Alert ≠ Incident ≠ Outage · Null ≠ Zero.** built ≠ activated; flag-ON ≠ runtime-active. Human remains accountable. Never fabricate; never estimate.
> **Basis:** deployment-config inspection + runtime audit + memory (`build-and-deploy-tooling`, `env-preflight-and-deploy-contract`, `performance-benchmarking`, `replit-deployment-pane-secrets`, `runtime-activation-traps`, `merged-task-data-not-in-live-db`, `vite-hmr-mockup-port-hijack`, `security-headers-csp`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.33. **Infrastructure Intelligence is the runtime foundation that lets every engine execute reliably, securely, efficiently, scalably, continuously. It enables business execution; it does not own business logic.**

---

## PART 1 — Current Infrastructure Intelligence Audit (MEASURED; n_live_tup NOT used)

### Runtime platform & compute
| Component | **Measured** | Class |
|---|---|---|
| Node API runtime | `tsx` on Node — **prod runs `NODE_ENV=production npx tsx index.ts` (never compiled/typechecked)** (`build-and-deploy-tooling`) | **LIVE** |
| Node API port | **8080** (`waitForPort=8080`, dev workflow) | LIVE |
| Frontend (Vite) | dev `npm run dev` port **5000**; prod = static build | LIVE |
| FastAPI upload | `backend-main/` uvicorn **:8000** (uv) | LIVE (dev) / **PARTIAL prod** |
| Worker / background | `setImmediate` fire-and-forget (e.g. `rf_export_jobs`); **no separate worker process / process manager** | PARTIAL |
| Containers / Docker | **none in repo** — Cloud Run `--source` (buildpacks); Firebase Hosting static | DERIVED (managed) |
| Compute ceiling | single JS thread ≈ 1 core; scale horizontally (`performance-benchmarking`) | DERIVED |

### Storage
| Layer | **Measured** | Class |
|---|---|---|
| Primary DB | **PostgreSQL** via `pg.Pool` (`DATABASE_URL`); pool **max 10 / idle 30s** (`PG_POOL_MAX`/`PG_POOL_IDLE_MS`); multiple pools (main + `concernsPool` = same DATABASE_URL) | **LIVE** |
| Secondary DB | **MongoDB** (`MONGODB_URI`) | LIVE (key-gated) |
| Temp storage | `/tmp` ephemeral (`/tmp/rf_exports`, `/tmp/logs`) — **non-persistent** | LIVE (ephemeral) |
| Object storage | Firebase/GCS in prod topology | PARTIAL (prod-only) |
| Cache | **in-memory only (admin APIs 60s cache); NO Redis / external cache** | PARTIAL |

### Network & deployment
| Component | **Measured** | Class |
|---|---|---|
| **Canonical prod** | **GCP Cloud Run** `metryxone-api` (Node :8080) + `metryxone-bulk-upload` (FastAPI :8080), region **`asia-south1`**, via `scripts/deploy-gcp.sh` (one-shot) | **LIVE (canonical)** |
| Frontend hosting | **Firebase Hosting** (`metryx.one`), `/api/**` rewrite → `metryxone-api` | LIVE |
| TLS / reverse proxy | Cloud Run + Firebase managed TLS; dev Vite proxy `/api`→:8080 | LIVE (managed) |
| **`.replit` autoscale** | **DEV / WORKSPACE PREVIEW ONLY** — `npx tsx index.ts` Node **only (no FastAPI)** → uploads do NOT work under it | **PARTIAL (not prod)** |
| Health checks | **`/api/health` + `/api/health/ready` LIVE** | **LIVE** |
| Graceful shutdown | **SIGTERM/SIGINT → `server.close` LIVE** | **LIVE** |
| Load balancer / autoscale | Cloud Run managed horizontal autoscale | LIVE (managed) |

### Environment, secrets & resilience
| Component | **Measured** | Class |
|---|---|---|
| Secrets management | GCP **Secret Manager** (prod) + Replit secrets (dev); **deployment-pane secrets invisible to repo grep** (`replit-deployment-pane-secrets`) | LIVE |
| Boot preflight | `lib/env-preflight.ts` — **FATAL in prod on missing `SESSION_SECRET`/`DATABASE_URL`**, warns on `ZOHO_*`/`FASTAPI_URL`/`UPLOAD_SERVICE_TOKEN`/`OPENAI_API_KEY`; **no-op in dev** | **LIVE** |
| Rate limiting | sliding-window `rateLimit()` on login/register/mfa (DB-backed `concernsPool`) | LIVE |
| Retry / timeout / circuit breaker | **no app-level circuit breaker / DLQ**; honest-503 connector degradation; idempotency 409 (payment) | PARTIAL |
| Environments | dev (workspace) · prod (GCP+Firebase); **no dedicated staging tier** | PARTIAL |

### Observability, monitoring & recovery
| Component | **Measured** | Class |
|---|---|---|
| Logging | `console` → workflow logs (dev) / Cloud Run + deployment logs (prod) | LIVE |
| Metrics / APM / tracing | **none — no APM, metrics rollup, distributed tracing, or alerting** | **MISSING** |
| Infra dashboards / alerts | platform-native only; **no app-defined alerts/incidents** | MISSING |
| Backup / recovery | platform checkpoints (code+DB+chat, dev); GCP-managed DB backups (prod); **no app-attested restore/DR validation** | PARTIAL |

### Deployment readiness · runtime activation · duplication · broken deploy/monitoring/scaling/recovery (explicit, per spec PART 1)
- **Runtime activation:** the runtime platform is **fully LIVE** — Node API on tsx, FastAPI upload, Postgres+Mongo, health checks, graceful shutdown, env preflight, managed TLS/autoscale all operational; the **canonical prod path is GCP Cloud Run + Firebase**, scripted and documented.
- **Infrastructure duplication:** **two deployment topologies coexist by design and must not be conflated** — GCP Cloud Run + Firebase is canonical PROD; `.replit` autoscale is DEV/preview ONLY (Node-only, no FastAPI → file uploads break under it). This is a documented dual-target, not a duplicate pipeline; treating Replit autoscale as prod is the known footgun.
- **Broken deployment / scaling / recovery:** **none observed broken.** Known correctness constraints: prod runs uncompiled tsx (no backend tsc gate — the only real launch gate is the frontend Vite build, `build-and-deploy-tooling`); merged task-agent backfills carry CODE+DDL only, NOT rows (`merged-task-data-not-in-live-db`); deploy `validate_inputs`/`--check` guards env (`env-preflight-and-deploy-contract`).
- **Broken monitoring:** **observability is the principal gap** — logging exists but there is no metrics/APM/tracing/alerting layer and no materialized infra-observability (consistent with 1.31's 0-matview and 1.32's no-integration-observability findings). **Monitoring ≠ Observability** holds: the platform logs but does not observe.
- **Compute/scaling reality:** Cloud Run gives managed horizontal autoscale, but each instance is a single Node JS thread (~1 core ceiling) — **Scaling ≠ Performance ≠ Capacity**; scale is horizontal, not per-instance throughput.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **CAPADEX's infrastructure is production-grade at the runtime/deployment layer but thin at the observability/resilience layer.** The runtime foundation is real and LIVE — a scripted one-shot GCP Cloud Run + Firebase prod topology with managed TLS/autoscale, health checks, graceful shutdown, a fail-fast env preflight, connection pooling, and rate limiting. **But it runs uncompiled (tsx in prod), has no app-level observability (no metrics/APM/tracing/alerting), no external cache (in-memory only), no durable queue/DLQ/circuit-breaker, no dedicated staging, and no app-attested backup-restore/DR validation.** **No fabrication:** managed backups are reported as platform-managed and **not restore-validated here** (Backup ≠ Disaster Recovery); the `.replit` autoscale target is reported as DEV-only, never as prod; missing metrics are reported MISSING, not assumed-present; **Built ≠ Activated, Availability ≠ Reliability ≠ Resilience, Null ≠ Zero** preserved. The single most material gap is **observability**, echoing the same gap surfaced in Data (1.31) and Integration (1.32).

**Strengths (DERIVED):** scripted reproducible canonical prod (GCP+Firebase, one-shot); managed TLS/autoscale; LIVE health checks + graceful shutdown; fail-fast prod env preflight; connection pooling + DB-backed rate limiting; secrets in Secret Manager. **Technical debt / GAPS (DERIVED):** no metrics/APM/tracing/alerting; no external cache; no durable queue/DLQ/circuit-breaker; no dedicated staging; no app-attested restore/DR; prod runs uncompiled tsx; dual-target footgun (autoscale ≠ prod). **Dormant/Missing:** observability stack, DR validation, staging tier. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Infrastructure Philosophy

Infrastructure Intelligence exists to Run · Host · Protect · Scale · Recover · Observe · Optimize · Automate. **It never implements business logic, duplicates platform services, bypasses governance, or weakens security.**

## PART 3 — Infrastructure Domain Architecture

Runtime Platform · Compute · Storage · Networking · Deployment · Scaling · Resilience · Monitoring · Observability · Recovery · Governance.

## PART 4 — Runtime Platform Constitution

Runtime Platform remains **the canonical execution environment.** Protect Application runtime · Worker runtime · Background runtime · Service lifecycle · Runtime health. Binding: Node-on-tsx API :8080, FastAPI :8000, frontend :5000; new backend route → restart `Backend API`; graceful shutdown on SIGTERM/SIGINT.

## PART 5 — Compute Constitution

Protect CPU · Memory · Workers · Processes · Scheduling · Concurrency · Resource allocation. Binding: single JS thread ≈1 core ceiling → scale horizontally (`performance-benchmarking`); background work is fire-and-forget, not a worker pool.

## PART 6 — Storage Constitution

Protect Database · File storage · Object storage · Temporary storage · Persistent storage · Storage lifecycle. Binding: Postgres (`pg.Pool` max 10/idle 30s) canonical; MongoDB secondary; `/tmp` ephemeral (never durable); shared dev/prod DB → demo data must be `@example.com`-purgeable (`runtime-activation-traps`).

## PART 7 — Network Constitution

Protect Routing · DNS · TLS · HTTPS · Reverse proxy · Ports · Ingress · Egress. Binding: Cloud Run + Firebase managed TLS; `/api/**`→`metryxone-api`; dev Vite proxy; CSP/headers (`security-headers-csp`); HMR clientPort trap (`vite-hmr-mockup-port-hijack`).

## PART 8 — Deployment Constitution

Protect Deployment pipeline · Environment promotion · Rollback · Versioning · Release integrity · Deployment verification. Binding: **canonical = `scripts/deploy-gcp.sh` (GCP Cloud Run + Firebase, `asia-south1`)**; `.replit` autoscale = DEV ONLY; prod runs uncompiled tsx (real gate = frontend Vite build); **Deployment ≠ Release.**

## PART 9 — Scalability Constitution

Protect Horizontal scaling · Vertical scaling · Auto scaling · Connection pools · Worker scaling · Background scaling. Binding: Cloud Run horizontal autoscale; pool sizing via `PG_POOL_MAX`; **Scaling ≠ Performance ≠ Capacity.**

## PART 10 — Resilience Constitution

Protect Retry · Timeout · Circuit breakers · Graceful shutdown · Recovery · Fault isolation. Binding: graceful shutdown LIVE; honest-503 degradation + payment idempotency 409; **no circuit breaker / DLQ yet (gap); Reliability ≠ Resilience.**

## PART 11 — Observability Constitution

Protect Logs · Metrics · Tracing · Health checks · Diagnostics · Telemetry. Binding: **logs + health checks LIVE; metrics/tracing/telemetry MISSING (principal gap); Monitoring ≠ Observability; Logging ≠ Monitoring.**

## PART 12 — Infrastructure Evidence Constitution

Evidence from Runtime · Deployments · Logs · Metrics · Health checks · Monitoring · Infra events; contains Source · Coverage · Confidence · Quality.

## PART 13 — Infrastructure Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Availability · Reliability · Capacity. Binding: managed-availability ≠ measured-reliability (no SLO/metrics evidence).

## PART 14 — Infrastructure Explainability Constitution

Every infra event explains What · Where · Why · Impact · Evidence · Recovery.

## PART 15 — Monitoring Constitution

Protect Runtime · Infrastructure · Application · Health · Performance monitoring. Binding: health endpoints LIVE; app/perf monitoring absent.

## PART 16 — Performance Constitution

Measure Latency · Throughput · CPU · Memory · Disk · Network · Database · Queue. Binding: no load tools — write a Node http harness; measure backend on tsx, frontend from dist, COUNT(\*) not stale stats (`performance-benchmarking`).

## PART 17 — Backup & Recovery Constitution

Protect Snapshots · Backups · Recovery · Restore · Disaster recovery · Business continuity. Binding: **Backup ≠ Disaster Recovery** — platform checkpoints (dev) + GCP-managed DB backups (prod); **app-attested restore/DR validation MISSING.**

## PART 18 — Environment Constitution

Protect Development · Testing · Staging · Production · Secrets · Environment variables. Binding: dev + prod present; **no dedicated staging**; `docs/ENVIRONMENT.md` is SSOT; prod preflight FATAL on required vars.

## PART 19 — Security Infrastructure Constitution

Protect Host security · Runtime security · Secrets · Certificates · Encryption · Network isolation. Binding: Secret Manager; managed TLS; auth secrets fail-fast in prod (`secrets-handling-hygiene`); deployment-pane secrets invisible to grep (`replit-deployment-pane-secrets`).

## PART 20 — SuperAdmin Infrastructure Constitution

Support Infrastructure monitoring · Deployment status · Health · Runtime · Configuration. Binding: admin surfaces read-only; health/readiness probes exposed.

## PART 21 — Infrastructure Testing Constitution

Standardize Deployment · Load · Stress · Recovery · Chaos · Performance tests. Binding: degradation suites exist; no load/chaos harness (gap).

## PART 22 — Infrastructure Documentation

Maintain Infrastructure catalog · Deployment guide · Environment guide · Recovery guide · Operations guide. SSOT: `replit.md` deployment section + `docs/ENVIRONMENT.md` + `scripts/deploy-gcp.sh`.

## PART 23 — Infrastructure Governance

Every enhancement answers: Why is Infrastructure changing? · What existing capability is reused? · Does this duplicate infrastructure? · Does this improve resilience?

## PART 24 — Infrastructure Quality Gates

Verify Runtime preserved · Deployment preserved · Monitoring preserved · Recovery preserved · Documentation updated · No regressions.

## PART 25 — Infrastructure Review Board

```
Founder[ ] ChiefInfraArchitect[ ] PlatformArchitect[ ] CloudArchitect[ ] DevOpsArchitect[ ] SecurityArchitect[ ] OperationsLead[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 26 — Infrastructure Definition of Done

- [ ] Runtime preserved · [ ] Deployment preserved · [ ] Recovery preserved · [ ] Monitoring preserved · [ ] Documentation updated · [ ] No regressions.

## PART 27 — Infrastructure Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Runtime Platform | **L4 Intelligent** (LIVE, health + graceful shutdown + preflight) | L5 Autonomous |
| Deployment | **L4 Intelligent** (scripted one-shot GCP+Firebase) | L5 Autonomous |
| Compute | L3 Managed (pooled; single-thread ceiling) | L4 Intelligent |
| Storage | L3 Managed (Postgres+Mongo; no external cache) | L4 Intelligent |
| Networking | **L4 Intelligent** (managed TLS/proxy/autoscale) | L5 Autonomous |
| Monitoring | L1 Operational (logs + health only) | L4 Intelligent |
| Recovery | L2 Guided (managed backups; no attested DR) | L4 Intelligent |
| Scalability | L3 Managed (horizontal autoscale) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Managed · 4 Intelligent · 5 Autonomous Infrastructure — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** add observability (metrics/APM/tracing/alerting) → add external cache + durable queue/DLQ + circuit breakers → add a dedicated staging tier → add app-attested backup-restore/DR drills → optionally add a backend build/typecheck gate → keep ONE infrastructure platform, never duplicate pipelines, security + data never bypassed, human approval mandatory.

## PART 28 — Infrastructure Scientific Validation

Document Distributed systems · Cloud architecture · Site reliability engineering · Capacity planning · Infrastructure engineering · Performance engineering · Resilience engineering · Disaster recovery.

## PART 29 — Infrastructure Evolution Strategy

Future evolution supports New runtime platforms · deployment models · compute services · storage platforms · monitoring systems · scaling strategies — **without breaking** Data · Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI · Enterprise · Security · Integration Intelligence. (Additive; canonical deployment path + security + data never bypassed; human approval mandatory.)

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Infrastructure Intelligence Constitution | all | 14 | Monitoring Constitution | P15 |
| 02 | Repository Infrastructure Audit | P1 | 15 | Performance Constitution | P16 |
| 03 | Runtime Constitution | P4 | 16 | Backup & Recovery Constitution | P17 |
| 04 | Compute Constitution | P5 | 17 | Environment Constitution | P18 |
| 05 | Storage Constitution | P6 | 18 | Security Infrastructure Constitution | P19 |
| 06 | Network Constitution | P7 | 19 | SuperAdmin Infrastructure Constitution | P20 |
| 07 | Deployment Constitution | P8 | 20 | Infrastructure Governance Constitution | P23 |
| 08 | Scalability Constitution | P9 | 21 | Infrastructure Quality Gates | P24 |
| 09 | Resilience Constitution | P10 | 22 | Infrastructure Review Board | P25 |
| 10 | Observability Constitution | P11 | 23 | Infrastructure Definition of Done | P26 |
| 11 | Infrastructure Evidence Constitution | P12 | 24 | Infrastructure Scientific Validation | P28 |
| 12 | Infrastructure Confidence Constitution | P13 | 25 | Infrastructure Evolution Strategy | P29 |
| 13 | Infrastructure Explainability Constitution | P14 | 26 | Infrastructure Maturity Assessment | P27 |

---

**STOP — Phase 1.33 complete; Infrastructure Intelligence Constitution ready to FREEZE on approval. Infrastructure architecture not modified, runtime platform not replaced, no second infrastructure platform created, no dormant infrastructure capabilities activated, business logic not changed, Data / Security / Integration / no intelligence engine bypassed.**
Honesty caveats: all findings MEASURED via exact inspection of live deployment/runtime config today; `n_live_tup` NOT used; secret values never printed. **Canonical prod = GCP Cloud Run + Firebase (`asia-south1`); `.replit` autoscale is DEV-only (no FastAPI → uploads break); prod runs uncompiled tsx; health checks + graceful shutdown + env preflight LIVE; observability (metrics/APM/tracing/alerting), external cache, durable queue/DLQ/circuit-breaker, dedicated staging, and app-attested DR are MISSING.** Server ≠ Service ≠ Process ≠ Deployment ≠ Release; Availability ≠ Reliability ≠ Resilience; Backup ≠ Disaster Recovery; Monitoring ≠ Observability; Built ≠ Activated; Null ≠ Zero; human remains accountable.
