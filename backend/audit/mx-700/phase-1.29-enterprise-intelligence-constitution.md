# CAPADEX 2.0 — Phase 1.29: Enterprise Intelligence Constitution (Multi-Tenant + RBAC + Governance + Organizational Intelligence + Enterprise Orchestration)

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Enterprise Intelligence Constitution. **Do not rebuild, do not create a second enterprise engine, do not replace the Enterprise Platform, do not create Enterprise V2, do not duplicate enterprise governance, do not modify business logic, do not activate dormant enterprise capabilities, never bypass RBAC / Tenant Isolation / SuperAdmin / any intelligence engine.** This `.md` is the only artefact. Repository remains the single source of truth.
> **Honesty contract:** *measured* = MEASURED via **exact `SELECT COUNT(*)`** (live `DATABASE_URL` + repo on 2026-06-28 — **NEVER `n_live_tup`**, per spec honesty contract); *judgement* = DERIVED. **Enterprise Intelligence does not replace business logic; it governs business execution.** **Enterprise ≠ Organization ≠ Tenant · Department ≠ Team · Role ≠ Permission · Permission ≠ Authorization · Authentication ≠ Authorization · User ≠ Identity · Identity ≠ Session · Configuration ≠ Runtime · Approval ≠ Execution · Analytics ≠ Governance · Dashboard ≠ Administration · Policy ≠ Enforcement · Compliance ≠ Security · Evidence ≠ Confidence · Coverage ≠ Confidence.** built ≠ activated; flag-ON ≠ runtime-active; null ≠ 0. Human remains accountable. Never fabricate; never estimate.
> **Basis:** exact-count audit of the enterprise substrate + Phase 1.23–1.28 + memory (`enterprise-governance-console`, `per-framework-admin-gate-gap`, `enterprise-command-center`, `employer-portal`, `employer-tig-architecture`, `institutional-intelligence-mx302h`, `enterprise-certification-mx105x`, `n-live-tup-stale-population-audit`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.29.

---

## PART 1 — Current Enterprise Intelligence Audit (MEASURED, exact COUNT\*; n_live_tup NOT used)

### Repository implementation (code) — the broadest subsystem in the platform
| Component | Files (representative) | Class |
|---|---|---|
| RBAC + tenant engine | `services/rbac-tenant-engine(-v2).ts` · `services/governance/{rbac-engine,rbac-schema,rbac-seed}.ts` · `routes/multi-tenant-architecture.ts` | **LIVE (code)** |
| Tenant isolation / management | `services/tenant/{tenant-isolation-engine,tenant-isolation-enforcement,tenant-management-engine,tenant-configuration-engine}.ts` · `routes/{tenants,vx-tenant-configuration}.ts` | **LIVE (code)** |
| Enterprise governance | `services/governance/{enterprise-governance-engine,approval-engine,audit-engine,unified-audit-trail,admin-lifecycle}.ts` · `routes/{governance,governance-v2,governance-workflow,enterprise-governance}.ts` | **LIVE (code)** |
| Employer org / portal | `routes/{employer-portal,employer-admin,employer-dashboards,employer-governance,employer-security}.ts` (7 `employer_*` tables) | **LIVE (code)** |
| Institution engine | `routes/institutional-intelligence.ts` · `iil-governance.ts` (`institutes`/`institutions`) | **LIVE (code), data EMPTY** |
| M5 enterprise workforce | `routes/{m5-enterprise-workforce,enterprise-workforce-console,enterprise-workforce-os}.ts` · `services/m5-enterprise-observability.ts` (~70 `m5_*` tables) | **LIVE (code)** |
| Domain governance overlays | ~25 `*-governance` routes (ai/ei/ethics/iil/nhda/onet/ontology/paie/roie/role-dna/spe/sci) | **LIVE (code)** (fragmented) |

### Database population (exact COUNT\*)
| Component | Table | **Live count** | Class |
|---|---|---|---|
| **RBAC permissions** | `role_permissions` **144** · `permission_definitions` **44** | populated | **LIVE** |
| **RBAC groups / hierarchies** | `rbac_permission_groups` **8** · `rbac_role_hierarchies` **9** | populated | **LIVE** |
| **Security telemetry (runtime)** | `rbac_failed_logins` **53** · `admin_audit_logs` **24** · `platform_audit_log` **5** | populated | **LIVE (runtime-active)** |
| Tenants | `tenants` | **4** | **SEEDED** |
| Tenant relationships / flag overrides | `tenant_relationships` **0** · `feature_flag_tenant_overrides` **0** | **0** | **EMPTY** |
| Employer organizations | `employer_organizations` **2** · `employer_members` **2** · `employer_jobs` **2** | demo | **SEEDED (demo)** |
| Employer company profiles | `employer_company_profiles` | **0** | **EMPTY** |
| **Institution / university engine** | `institutes` **0** · `institutions` **0** · `institute_staff` **0** · `staff_roles` **0** | **0** | **EMPTY** |
| Institutional intelligence | `bios_institutional_intelligence` | **0** | **EMPTY** |
| RBAC approvals / admin status | `rbac_approval_requests` **0** · `rbac_admin_status` **0** | **0** | **DORMANT** |
| Generic audit / governance events | `audit_logs` **0** · `governance_events` **0** · `compliance_violations` **0** · `m5_audit_logs` **0** | **0** | **DORMANT** |
| M5 enterprise workforce intelligence | `m5_organizational_capabilities` **5** · `m5_executive_recommendations` **3** · `p5_enterprise_analytics` **1** | thin | **SEEDED (thin)** |
| M5 workforce readiness | `m5_workforce_readiness_scores` | **0** | **EMPTY** |

### Runtime activation · duplicates · broken authorization / tenant isolation / administration (explicit, per spec PART 1)
- **Runtime activation:** **SPLIT with a STRONG security floor.** RBAC is the **most genuinely live and runtime-active primitive in the entire MX-700 series** — `role_permissions`=144 + `permission_definitions`=44 + `rbac_permission_groups`=8 + `rbac_role_hierarchies`=9 are real authorization data, and `rbac_failed_logins`=53 + `admin_audit_logs`=24 + `platform_audit_log`=5 prove the auth/admin runtime is actively exercised. Above this floor, organizational *intelligence* is seeded-thin or dormant.
- **Broken authorization / tenant isolation / administration:** **none observed as broken** — RBAC + tenant isolation + SuperAdmin are coded and the RBAC data is populated; the per-framework admin-gate structural gap was already closed (`per-framework-admin-gate-gap`, shared `lib/admin-path-gate.ts`). The honest weakness is **unexercised governance approval/event streams** (`rbac_approval_requests`/`governance_events`/`compliance_violations`/`audit_logs`/`m5_audit_logs`=0), not broken enforcement.
- **Duplicate enterprise modules:** **heavy namespace fragmentation** — role definitions span dozens of namespaces (`gro_*`, `ont_*`/`onto_*`, `m3_*`, `m5_*`, `role_*`, `cg_*`, `wos_*`, `ti_*`, `mobility_*`) and governance spans ~25 `*-governance` routes. Per spec PART 5 the canonical authorization model is **RBAC** and (per competency canon) the canonical role substrate is **`onto_role_competency_profiles`** / `job_postings`; the rest are domain overlays — consolidate, never fork RBAC or the enterprise engine.
- **Institution gap:** the institution/university engine is fully coded but **EMPTY** (institutes/institutions/institute_staff/staff_roles/bios_institutional_intelligence=0) — institutional intelligence has zero live tenants.

**CRITICAL HONEST FINDING (MEASURED + DERIVED):** **Enterprise Intelligence is the broadest subsystem on the platform (~200 enterprise / role / governance / tenant tables) and carries the series' strongest genuinely-live security foundation — RBAC is real, populated, and runtime-active (role_permissions=144, permission_definitions=44, groups 8, hierarchies 9, failed-logins 53, admin audits 24), the opposite of the runtime-dormant AI layer (1.28).** Multi-tenancy is seeded (tenants=4) and the employer-org engine is lightly live (2/2/2 demo). **However, the higher-order organizational intelligence above the security floor is seeded-thin to empty:** the institution/university engine has zero rows, M5 enterprise-workforce intelligence is a thin seed (capabilities 5, exec-recs 3, analytics 1, readiness 0), and the governance approval/event/compliance audit streams are dormant (0). This is a healthier built-vs-activated split than most prior layers — **the controls that must be live (authorization, tenant isolation, admin audit) ARE live**, while the *intelligence* overlays (institution analytics, workforce intelligence, governance event capture) await real tenants and runtime. **No fabrication:** empty institution/governance/workforce stores are reported EMPTY/DORMANT, never inferred-active from the populated RBAC counts; "policy present" (`permission_definitions`=44) is reported separately from "enforcement exercised" (Policy ≠ Enforcement), and seeded tenant config (4) is not conflated with tenant runtime.

**Strengths (DERIVED):** production-grade RBAC with live data + security telemetry; tenant isolation engine + enforcement coded; SuperAdmin is the single canonical admin layer; unified audit trail + redaction-at-write (`audit-log-redaction-unified-trail`); structural per-framework admin gate closed. **Technical debt / GAPS (DERIVED):** massive role/governance namespace fragmentation; institution engine empty; M5 workforce intelligence thin; governance approval/event/compliance streams dormant; tenant relationships/flag-overrides empty. **Dormant:** institution intelligence, governance events, compliance violations, RBAC approvals, M5 workforce readiness, generic audit_logs. **Class legend (per spec):** LIVE · PARTIAL · SEEDED · DORMANT · BROKEN · EMPTY · TECH DEBT · MISSING.

---

## PART 2 — Enterprise Philosophy

Enterprise Intelligence exists to Govern · Configure · Authorize · Secure · Organize · Delegate · Measure · Scale. **It never replaces business logic, never creates duplicate governance, never bypasses authorization or approval.**

## PART 3 — Enterprise Domain Architecture

Domains: Enterprise Core · Organizations · Institutions · Departments · Teams · RBAC · Identity · Permissions · Authentication · Authorization · Configuration · Policies · Enterprise Analytics · Reports · Monitoring · Governance.

## PART 4 — Multi-Tenant Constitution

**Tenant isolation remains mandatory. Never share tenant data. Never bypass tenant boundaries.** Protect Organizations · Institutions · Departments · Business units · Tenant context · Tenant policies · Tenant configuration. Binding: `tenants`=4 seeded; tenant-isolation-engine + enforcement coded; tenant relationships/overrides=0 (config-only, runtime dormant).

## PART 5 — RBAC Constitution

RBAC remains **the only authorization model. Never replace it · never create Permission V2.** Protect Roles · Permissions · Policies · Scopes · Delegation · Inheritance · Audit trail. Binding: `role_permissions`=144 + `permission_definitions`=44 + groups 8 + hierarchies 9 — **LIVE**; classifier must lowercase paths (Express case-insensitive routing → mixed-case bypass risk, `per-framework-admin-gate-gap`).

## PART 6 — Identity Constitution

Protect Identity · Authentication · Authorization · Sessions · Tokens · User context · Identity federation. Binding: `rbac_failed_logins`=53 (live auth telemetry); employer SSO seam (`employer_sso_configs`); identity ONLY from verified token/session (`frontend-server-latent-jwt-auth`).

## PART 7 — Organization Constitution

Protect Organizations · Institutions · Universities · Corporates · NGOs · Departments · Teams · Reporting hierarchies. Binding: employer orgs live-small (2); **institution/university engine EMPTY (0)** — honest gap.

## PART 8 — Configuration Constitution

Protect Enterprise configuration · Feature flags · Tenant configuration · Organization policies · Workflow configuration · Notification configuration. Binding: two flag systems (file registry + DB `feature_flags`); `feature_flag_tenant_overrides`=0.

## PART 9 — Policy Constitution

Protect Enterprise · Compliance · Approval · Security · Retention · Audit policies. Binding: Policy ≠ Enforcement; approval/compliance streams dormant (`rbac_approval_requests`/`compliance_violations`=0).

## PART 10 — Authorization Constitution

Authorization uses RBAC · Tenant · Organization · Department · Context · Session. **Never authorize by UI alone. Server remains authoritative.** Binding: global `app.use('/api/admin')` gate + 2nd `app.use('/api')` framework-admin gate (`per-framework-admin-gate-gap`).

## PART 11 — Enterprise Evidence Constitution

Evidence originates from Organizations · Departments · Users · Policies · Workflows · Audit logs · Reports · Analytics; contains Source · Coverage · Confidence · Quality. **Never fabricate.**

## PART 12 — Enterprise Confidence Constitution

**Separate** Coverage · Evidence · Confidence · Compliance · Trust. Binding: Compliance ≠ Security; Coverage ≠ Confidence.

## PART 13 — Enterprise Explainability Constitution

Every enterprise decision explains Policy · Evidence · Authority · Permission · Scope · Reason · Limitations.

## PART 14 — Enterprise AI Constitution

**AI assists · summarizes · explains · recommends. AI never approves, never authorizes, never changes policy. Human approval remains mandatory.** Binding: cross-ref 1.28 (AI runtime dormant; governance policies seeded).

## PART 15 — Enterprise Analytics Constitution

Protect Organization · Department analytics · Adoption · Usage · Compliance · Operational KPIs. Binding: `p5_enterprise_analytics`=1 (thin); cross-ref 1.27.

## PART 16 — Enterprise Report Constitution

Protect Executive · Compliance · Audit · Department · Organization reports. Binding: cross-ref 1.26 (Report Factory canonical); k-anonymity ≥30.

## PART 17 — SuperAdmin Constitution

SuperAdmin remains **the only canonical administration layer. Never create another admin panel.** Protect Configuration · Policies · Users · Roles · Permissions · Monitoring. Binding: super-admin login always 2FA-gated (MX-301I §G4); `admin_audit_logs`=24 live.

## PART 18 — Enterprise Security Constitution

Protect Identity · Permissions · Sessions · PII · Tenant isolation · Encryption · Secrets · Consent. Binding: CSRF (signed double-submit, default-ON), auth rate limiting, security headers/CSP — all live (`csrf-protection`, `auth-rate-limiting`, `security-headers-csp`).

## PART 19 — Enterprise Observability

Monitor Organizations · Tenants · Authentication · Authorization · Permission failures · Policy violations · Latency · Errors · Availability. Binding: `rbac_failed_logins`=53 live; `governance_events`/`compliance_violations`=0 — event capture dormant; a silent-zero must read "unmeasured", not "clean".

## PART 20 — Enterprise Testing Constitution

Standardize RBAC · Tenant · Authorization · Policy · Regression · Performance tests. Binding: isolation test suite exists (`npm run test:isolation`).

## PART 21 — Enterprise Documentation

Maintain Organization · Role · Permission · Policy catalogs + Enterprise API guide + Administration guide. SSOT: `docs/SUPERADMIN.md` + `docs/phase-history.md` + `.agents/memory/*`.

## PART 22 — Enterprise Governance

Every enhancement answers: Why is Enterprise changing? · What existing capability is reused? · Does this duplicate Enterprise Intelligence? · Does this preserve tenant isolation? · Does this preserve RBAC?

## PART 23 — Enterprise Quality Gates

Verify Enterprise Engine reused · RBAC reused · Permissions reused · Tenant isolation preserved · Policies preserved · Evidence exposed · Confidence exposed · Documentation updated.

## PART 24 — Enterprise Review Board

```
Founder[ ] EnterpriseArchitect[ ] SecurityArchitect[ ] PlatformArchitect[ ] RBACArchitect[ ] ComplianceLead[ ]
Research[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 25 — Enterprise Definition of Done

- [ ] Existing Enterprise Engine reused · [ ] RBAC preserved · [ ] Tenant isolation preserved · [ ] Policies preserved · [ ] Evidence exposed · [ ] Confidence exposed · [ ] Documentation updated · [ ] No regressions.

## PART 26 — Enterprise Maturity Model

| Component | Current (DERIVED, exact-count) | Target |
|---|---|---|
| Organizations | L2 Guided (employer 2; institutions 0) | L4 Intelligent |
| RBAC | **L4 Intelligent** (144 perms, 44 defs, live telemetry) | L5 (human-approval-bound) |
| Identity | **L3 Adaptive** (sessions + failed-logins live) | L4 Intelligent |
| Policies | L2 Guided (44 defs; approvals/events 0) | L4 Intelligent |
| Configuration | L2 Guided (tenants 4; overrides 0) | L4 Intelligent |
| Analytics | L1 Operational (`p5`=1) | L3 Adaptive |
| Security | **L4 Intelligent** (CSRF/rate-limit/CSP/audit live) | L5 (human-approval-bound) |
| Administration | **L3 Adaptive** (SuperAdmin + 2FA + admin audit live) | L4 Intelligent |

Levels: 1 Operational · 2 Guided · 3 Adaptive · 4 Intelligent · 5 Autonomous Enterprise Governance — **human approval ALWAYS mandatory.** **Roadmap (separate approved phases):** onboard real institution/university tenants (lift the empty institution engine) → activate governance event + compliance + approval streams (make policy enforcement observable, not just defined) → grow M5 workforce intelligence past thin seed → consolidate the fragmented role/governance namespaces under RBAC + `onto_role_competency_profiles` → keep ONE Enterprise Engine + ONE RBAC + ONE SuperAdmin, tenant isolation mandatory, server-authoritative authorization, human approval mandatory.

## PART 27 — Enterprise Scientific Validation

Document Enterprise architecture · Distributed systems · Access control · Identity management · Zero trust · Governance · Compliance · Risk management · Security engineering.

## PART 28 — Enterprise Evolution Strategy

Future evolution supports New organizations · institution types · enterprise modules · RBAC models · policy engines · compliance standards — **without breaking** Assessment · Behaviour · Concern · Competency · Decision · Learning · Career · Intervention · Report · Analytics · AI Intelligence. (Additive + flag-gated; byte-identical flag-OFF; tenant isolation + RBAC never bypassed.)

---

## PART 29 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Enterprise Intelligence Constitution | all | 14 | Enterprise Analytics Constitution | P15 |
| 02 | Repository Enterprise Audit | P1 | 15 | Enterprise Report Constitution | P16 |
| 03 | Multi-Tenant Constitution | P4 | 16 | SuperAdmin Constitution | P17 |
| 04 | RBAC Constitution | P5 | 17 | Enterprise Security Constitution | P18 |
| 05 | Identity Constitution | P6 | 18 | Enterprise Observability Constitution | P19 |
| 06 | Organization Constitution | P7 | 19 | Enterprise Governance Constitution | P22 |
| 07 | Configuration Constitution | P8 | 20 | Enterprise Quality Gates | P23 |
| 08 | Policy Constitution | P9 | 21 | Enterprise Review Board | P24 |
| 09 | Authorization Constitution | P10 | 22 | Enterprise Definition of Done | P25 |
| 10 | Enterprise Evidence Constitution | P11 | 23 | Enterprise Scientific Validation | P27 |
| 11 | Enterprise Confidence Constitution | P12 | 24 | Enterprise Evolution Strategy | P28 |
| 12 | Enterprise Explainability Constitution | P13 | 25 | Enterprise Maturity Assessment | P26 |
| 13 | Enterprise AI Constitution | P14 | | | |

---

**STOP — Phase 1.29 complete; Enterprise Intelligence Constitution ready to FREEZE on approval. Enterprise Engine not modified, RBAC not replaced, no second enterprise engine created, no dormant enterprise capabilities activated, business logic not changed, Tenant Isolation / RBAC / SuperAdmin / no intelligence engine bypassed.**
Honesty caveats: counts are MEASURED via exact `SELECT COUNT(*)` from the live shared Postgres today (`n_live_tup` NOT used, per spec). **Enterprise is the broadest subsystem (~200 tables) with the series' strongest live security floor** — RBAC is real and runtime-active (`role_permissions`=144, `permission_definitions`=44, groups 8, hierarchies 9, `rbac_failed_logins`=53, `admin_audit_logs`=24); multi-tenancy seeded (`tenants`=4); employer orgs live-small (2/2/2 demo). Above the floor the organizational *intelligence* is seeded-thin to empty: institution/university engine EMPTY (0), M5 workforce intelligence thin (5/3/1, readiness 0), governance/compliance/approval event streams DORMANT (0). Policy-present (44 defs) is reported separately from enforcement-exercised (Policy ≠ Enforcement); seeded config ≠ runtime; populated RBAC never inflates empty institution/governance stores. Enterprise governs execution, never replaces business logic; authorization is server-authoritative; human approval remains mandatory.
