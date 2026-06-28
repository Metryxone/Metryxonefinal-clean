# CAPADEX 2.0 — Phase 1.35: Platform Operations Intelligence Constitution (Production Operations + Incident Management + Service Management + SRE + SLA/SLO + Capacity + Availability + Operational Governance)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Platform Operations Intelligence Constitution. **Do not rebuild, do not create a second operations platform, do not replace platform operations, do not create Operations V2, do not modify business logic, do not activate dormant operations capabilities, never bypass Infrastructure / Delivery / Security / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via exact inspection of live repo + runtime + deployment + DB schema on 2026-06-28 — **NEVER `n_live_tup`**, per spec; secret VALUES never printed; *judgement* = DERIVED. **Service ≠ System ≠ Platform · Availability ≠ Reliability ≠ Resilience · Monitoring ≠ Observability · Alert ≠ Incident ≠ Problem ≠ Root Cause ≠ Fix · Capacity ≠ Performance ≠ User Experience · Recovery ≠ Availability · Restart ≠ Recovery · Health Check ≠ Healthy Service · SLA ≠ SLO ≠ SLI · Coverage ≠ Confidence · Evidence ≠ Confidence.** built ≠ activated; flag-ON ≠ runtime-active; Null ≠ Zero. Human remains accountable. Never fabricate; never estimate.
> **Basis:** runtime/health inspection + schema audit + scheduler/background-worker audit + memory (`build-and-deploy-tooling`, `performance-benchmarking`, `archived-mirror-security-parity` (health probes never echo `e.message`), `runtime-activation-traps`, `mission-control-aggregator`, `enterprise-command-center`, `report-factory-engines`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.35. **Infrastructure runs the platform; Delivery deploys it; Operations keeps it alive — operated, monitored, maintained, restored, improved, continuously kept healthy in production. Operations never owns business logic.**

---

## PART 1 — Current Platform Operations Audit (MEASURED; n_live_tup NOT used)

### Production runtime & health
| Component | **Measured** | Class |
|---|---|---|
| Production runtime | Node API on tsx (Cloud Run `metryxone-api`) + FastAPI upload + Firebase | **LIVE** |
| **Liveness health** | **`/api/health` → `{status, uptime_s, ts}` LIVE** (also `/api/v1/health`) | **LIVE** |
| **Readiness health** | **`/api/health/ready` → DB `SELECT 1`; 503 on failure; error detail NOT leaked to client** (`archived-mirror-security-parity`) | **LIVE** |
| Graceful shutdown | SIGTERM/SIGINT → `server.close` (from 1.33) | LIVE |

### Background services, schedulers & maintenance
| Component | **Measured** | Class |
|---|---|---|
| In-process scheduler | `services/ai-governance-scheduler.ts` (in-process) | PARTIAL |
| Realtime/broadcast | `services/ws-broadcast.ts` (websocket) | LIVE |
| Background jobs | **`setImmediate` fire-and-forget** (e.g. report-factory exports) — **no durable worker queue / DLQ** | PARTIAL |
| Cron / scheduled maintenance | **no `node-cron` fleet; no maintenance-job scripts** | MISSING |
| Maintenance windows | **none defined** | MISSING |

### Incident, problem, service-level (the principal ops gaps)
| Component | **Measured** | Class |
|---|---|---|
| `institutional_slas` table | **business-domain (institutional) SLA config — NOT platform-ops SLA** | LIVE (wrong domain for ops) |
| `security_incidents` table | **security-domain incidents — NOT platform-ops incidents** | LIVE (wrong domain for ops) |
| `document_access_logs` | security/audit domain | LIVE (wrong domain for ops) |
| **Platform-ops incident tracking** | **NONE (no ops incident record, severity, escalation, post-incident review)** | **MISSING** |
| **Problem management / RCA / known-errors** | **NONE** | **MISSING** |
| **SLA / SLO / SLI / error budgets (platform)** | **NONE (SLA ≠ SLO ≠ SLI all absent for ops)** | **MISSING** |

### Monitoring, analytics, capacity & recovery
| Component | **Measured** | Class |
|---|---|---|
| Operational logging | `console` → workflow / Cloud Run logs | LIVE |
| Operational dashboards / KPIs | admin aggregators exist (Mission Control / Command Center) but **read business metrics, not ops SRE metrics** | PARTIAL |
| Alerting | **none (no alert→incident pipeline)** | MISSING |
| Operational metrics / APM / tracing | **none** (consistent with 1.33) | MISSING |
| Capacity metrics | pool sizing static (`PG_POOL_MAX` 10); **no capacity-trend rollup**; single-thread ~1 core ceiling (`performance-benchmarking`) | PARTIAL |
| Recovery | **restart + Replit checkpoints + Cloud Run revisions** (manual) | PARTIAL |
| Operational reports | none ops-specific | MISSING |

### Production readiness · operational maturity · duplicate monitoring · broken monitoring/alerting/recovery/runbooks (explicit, per spec PART 1)
- **Production readiness:** the platform is **runnable and self-checking** — LIVE liveness + readiness health endpoints, graceful shutdown, an in-process governance scheduler, and console logging into the platform log plane. That is genuine but **minimal SRE surface**.
- **Operational maturity:** **L1–L2.** There is **no incident management, no problem management/RCA, no SLA/SLO/SLI/error budgets, no alerting, no ops dashboard/KPIs, no maintenance windows, no capacity-trend analytics** at the *platform* layer. The `institutional_slas`/`security_incidents` tables are real but belong to the **business/security domains**, not platform operations — counting them as ops would be a category error and is explicitly NOT done here.
- **Duplicate monitoring:** none — admin aggregators (Mission Control / Command Center) are business-metric read surfaces, not a second monitoring platform; they must not be conflated with SRE monitoring.
- **Broken monitoring / alerting / recovery / runbooks:** **none broken; most ABSENT.** Health checks work; recovery works manually (restart/checkpoint/revision). What is missing is automation and SRE structure: alerting, incident/problem records, SLOs, ops analytics. Runbooks exist only as `replit.md` + `docs/ENVIRONMENT.md` prose (partial).
- **Recovery reality:** **Restart ≠ Recovery, Health Check ≠ Healthy Service** — a 200 from `/api/health` proves the process is up, not that any engine is correct; readiness proves DB reachability, not data integrity.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **CAPADEX's platform operations are "alive and self-checking" but pre-SRE.** Real and LIVE: liveness + readiness health endpoints (with correct no-leak error handling), graceful shutdown, an in-process scheduler, websocket broadcast, and platform-plane logging. **But the operational discipline layer is essentially absent at the platform level: no incident management, no problem management / root-cause records, no SLA/SLO/SLI / error budgets, no alerting, no operational (SRE) dashboards or KPIs, no maintenance windows, no capacity-trend analytics, no durable background-worker queue.** **No fabrication / no category errors:** the `institutional_slas` and `security_incidents` tables are reported as business/security-domain and explicitly NOT credited as platform-ops capabilities; admin aggregators are reported as business-metric surfaces, not SRE monitoring; recovery is reported as manual restart/checkpoint, not an automated recovery system; **Restart ≠ Recovery, Health Check ≠ Healthy Service, Monitoring ≠ Observability, SLA ≠ SLO ≠ SLI, Null ≠ Zero** all preserved. This is the same observability/automation gap surfaced in 1.33 (infra) and 1.34 (delivery), now seen from the operations angle.

**Strengths (DERIVED):** LIVE liveness+readiness with no-leak errors; graceful shutdown; in-process scheduler + broadcast; platform-plane logging; manual but real recovery (restart/checkpoint/revision). **Technical debt / GAPS (DERIVED):** no ops incident/problem mgmt; no SLA/SLO/SLI/error budgets; no alerting; no ops dashboards/KPIs/analytics; no maintenance windows; no durable worker queue; no capacity-trend rollup. **Dormant/Missing:** SRE stack (alerting, SLOs, incident lifecycle, RCA, capacity analytics). **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Operations Philosophy

Platform Operations Intelligence exists to Operate · Monitor · Maintain · Respond · Recover · Improve · Measure · Optimize. **It never implements business logic, duplicates Infrastructure or DevOps, or weakens Security.**

## PART 3 — Operations Domain Architecture

Production Operations · Service Management · Incident Management · Problem Management · Capacity Management · Availability Management · Reliability Engineering · Operational Analytics · Operational Governance.

## PART 4 — Production Operations Constitution

Protect Production runtime · Runtime health · Background services · Operational stability · Maintenance windows. Binding: health endpoints LIVE; in-process scheduler; **maintenance windows undefined (gap).**

## PART 5 — Service Management Constitution

Protect Services · Dependencies · Service catalog · Ownership · Lifecycle · Service status. Binding: services = Node API + FastAPI + Postgres + Mongo + Firebase; **no formal service catalog/ownership doc (gap).**

## PART 6 — Incident Management Constitution

Protect Incident detection · Classification · Severity · Escalation · Containment · Recovery · Post-incident review. **Binding: Incident ≠ Problem; Recovery ≠ Root-Cause Resolution.** Current: **no platform-ops incident lifecycle (MISSING)** — `security_incidents` is security-domain, not ops.

## PART 7 — Problem Management Constitution

Protect Root-cause analysis · Known errors · Permanent fixes · Trend analysis · Preventive actions. Binding: **no RCA/known-error register (gap);** durable lessons live in `.agents/memory/*` (engineering, not ops-incident).

## PART 8 — Availability Constitution

Protect Availability · Uptime · Maintenance · Graceful degradation · Dependency health. Binding: readiness probe + honest-503 degradation LIVE; **Availability ≠ Reliability;** no uptime SLO.

## PART 9 — Reliability Constitution

Protect Fault tolerance · Retries · Recovery · Resilience · Stability. Binding: graceful shutdown + idempotency guards; **no circuit breaker / retry policy (gap); Reliability ≠ Resilience.**

## PART 10 — Capacity Management Constitution

Protect CPU · Memory · Storage · Database capacity · Connection pools · Scaling thresholds. Binding: pool `PG_POOL_MAX` 10; Cloud Run horizontal autoscale; single-thread ceiling (`performance-benchmarking`); **no capacity-trend metric (gap); Capacity ≠ Performance.**

## PART 11 — Operational Evidence Constitution

Evidence from Logs · Metrics · Health checks · Alerts · Incidents · Monitoring · Runtime events; contains Source · Coverage · Confidence · Quality.

## PART 12 — Operational Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Availability · Reliability · Operational readiness. Binding: health-200 ≠ healthy-service; managed-availability ≠ measured-reliability.

## PART 13 — Operational Explainability Constitution

Every operational event explains What happened · Where · Why · Impact · Evidence · Recovery.

## PART 14 — Observability Constitution

Protect Logs · Metrics · Tracing · Telemetry · Health · Diagnostics. Binding: **logs + health LIVE; metrics/tracing/telemetry MISSING; Monitoring ≠ Observability.**

## PART 15 — Service Level Constitution

Protect SLA · SLO · SLI · Error budgets · Operational targets. **Binding: SLA ≠ SLO ≠ SLI.** Current: **none at platform level (MISSING)** — `institutional_slas` is business-domain.

## PART 16 — Operational Analytics Constitution

Measure Availability · Reliability · Incident trends · Recovery time · Operational load · Capacity trends. Binding: **unmeasured today (no ops analytics);** must be added behind a flag, read-only, null≠0.

## PART 17 — Continuous Improvement Constitution

Protect Lessons learned · Corrective actions · Preventive actions · Operational reviews · Knowledge base. Binding: `.agents/memory/*` is the engineering KB; ops-review cadence a gap.

## PART 18 — Runbook Constitution

Protect Operational · Recovery · Maintenance · Emergency procedures. Binding: `replit.md` + `docs/ENVIRONMENT.md` partial runbooks; emergency/incident runbooks a gap.

## PART 19 — Operations Security Constitution

Protect Operational access · Administrative access · Operational secrets · Audit trails · Operational compliance. Binding: requireAuth+requireSuperAdmin; redacted unified audit trail (`audit-log-redaction-unified-trail`); secrets in Secret Manager.

## PART 20 — SuperAdmin Operations Constitution

Support Operational dashboard · Service health · Incidents · Maintenance · Operational metrics. Binding: surfaces read-only; health probes exposed; an ops dashboard would COMPOSE existing aggregators, never re-issue ad-hoc SQL (`enterprise-command-center`, `mission-control-aggregator`).

## PART 21 — Operations Testing Constitution

Standardize Operational-readiness · Disaster-recovery · Incident-response · Capacity · Reliability tests. Binding: degradation suites exist; DR/chaos/capacity tests a gap.

## PART 22 — Operations Documentation

Maintain Operations catalog · Runbooks · Incident guide · Recovery guide · Maintenance guide. SSOT: `replit.md` + `docs/ENVIRONMENT.md`.

## PART 23 — Operations Governance

Every enhancement answers: Why are Operations changing? · What existing capability is reused? · Does this duplicate Platform Operations? · Does this improve operational excellence?

## PART 24 — Operations Quality Gates

Verify Operations preserved · Monitoring preserved · Recovery preserved · Runbooks preserved · Documentation updated · No regressions.

## PART 25 — Operations Review Board

```
Founder[ ] ChiefOperationsArchitect[ ] SRE[ ] PlatformArchitect[ ] InfrastructureArchitect[ ] SecurityArchitect[ ] OperationsManager[ ] QALead[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 26 — Operations Definition of Done

- [ ] Operations preserved · [ ] Monitoring preserved · [ ] Recovery preserved · [ ] Runbooks preserved · [ ] Documentation updated · [ ] No regressions.

## PART 27 — Operations Maturity Model

| Component | Current (DERIVED) | Target |
|---|---|---|
| Production Operations | L3 Managed (LIVE health + shutdown + scheduler) | L4 Intelligent |
| Incident Management | **L1 Operational (no ops incident lifecycle)** | L4 Intelligent |
| Problem Management | **L1 Operational (no RCA register)** | L4 Intelligent |
| Availability | L2 Guided (readiness + honest-503; no SLO) | L4 Intelligent |
| Reliability | L2 Guided (shutdown/idempotency; no breaker) | L4 Intelligent |
| Capacity | L2 Guided (static pool; no trend) | L4 Intelligent |
| Service Levels | **L1 Operational (no SLA/SLO/SLI)** | L4 Intelligent |
| Operational Analytics | **L1 Operational (none)** | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Managed · 4 Intelligent · 5 Autonomous Operations — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** add SRE observability (metrics/tracing/telemetry + alerting) → add platform-ops incident + problem/RCA lifecycle → define SLA/SLO/SLI + error budgets → add ops analytics (availability/reliability/recovery-time/capacity trends) → add a durable background-worker queue + maintenance windows → add DR/chaos/capacity testing + emergency runbooks → keep ONE operations platform, never duplicate dashboards, Infra/Delivery/Security never bypassed, human approval mandatory.

## PART 28 — Operations Scientific Validation

Document Site Reliability Engineering · IT Service Management · Incident Response · Operational Excellence · Capacity Engineering · Reliability Engineering · Service Management · Root-Cause Analysis.

## PART 29 — Operations Evolution Strategy

Future evolution supports New monitoring platforms · operational dashboards · incident platforms · analytics · reliability models · capacity models — **without breaking** Infrastructure · DevOps & Delivery · Data · Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI · Enterprise · Security · Integration Intelligence. (Additive; read-only; never recompute business metrics; human approval mandatory.)

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Platform Operations Intelligence Constitution | all | 14 | Service Level Constitution | P15 |
| 02 | Repository Operations Audit | P1 | 15 | Operational Analytics Constitution | P16 |
| 03 | Production Operations Constitution | P4 | 16 | Continuous Improvement Constitution | P17 |
| 04 | Service Management Constitution | P5 | 17 | Runbook Constitution | P18 |
| 05 | Incident Management Constitution | P6 | 18 | Operations Security Constitution | P19 |
| 06 | Problem Management Constitution | P7 | 19 | SuperAdmin Operations Constitution | P20 |
| 07 | Availability Constitution | P8 | 20 | Operations Governance Constitution | P23 |
| 08 | Reliability Constitution | P9 | 21 | Operations Quality Gates | P24 |
| 09 | Capacity Constitution | P10 | 22 | Operations Review Board | P25 |
| 10 | Operational Evidence Constitution | P11 | 23 | Operations Definition of Done | P26 |
| 11 | Operational Confidence Constitution | P12 | 24 | Operations Scientific Validation | P28 |
| 12 | Operational Explainability Constitution | P13 | 25 | Operations Evolution Strategy | P29 |
| 13 | Observability Constitution | P14 | 26 | Operations Maturity Assessment | P27 |

---

**STOP — Phase 1.35 complete; Platform Operations Intelligence Constitution ready to FREEZE on approval. Platform operations not modified, production operations not replaced, no second operations platform created, no dormant operational capabilities activated, business logic not changed, Infrastructure / Delivery / Security / no intelligence engine bypassed.**
Honesty caveats: all findings MEASURED via exact inspection of live runtime/health/schema today; `n_live_tup` NOT used; secret values never printed. **Operations is "alive and self-checking" but pre-SRE: liveness + readiness health checks, graceful shutdown, an in-process scheduler, and platform-plane logging are LIVE; platform-ops incident management, problem/RCA management, SLA/SLO/SLI + error budgets, alerting, ops dashboards/KPIs/analytics, maintenance windows, durable worker queue, and capacity-trend analytics are MISSING.** The `institutional_slas`/`security_incidents` tables are business/security-domain, NOT platform-ops, and are NOT credited as ops capabilities. Restart ≠ Recovery; Health Check ≠ Healthy Service; Monitoring ≠ Observability; SLA ≠ SLO ≠ SLI; Availability ≠ Reliability ≠ Resilience; Null ≠ Zero; human remains accountable.
