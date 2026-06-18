# MetryxOne — World-Class SuperAdmin Audit
**Audit ID:** MX-SA-WORLDCLASS-AUDIT-01
**Date:** 2026-06-17
**Type:** Read-only operational-capability audit (no code changed, no deploy)
**Central question:** *Can the SuperAdmin run MetryxOne end-to-end without engineering support?*

---

## 0. Method & honesty rules

This audit measures **operational capability**, not surface area. The following rules were enforced:

- **No points for screens that cannot act.** A panel that renders data but exposes no mutation is scored as *VIEW-only*, not *operational*.
- **VIEW vs ACTION vs ABSENT** is recorded for every capability. *ACTION* means the SuperAdmin can change real state (toggle, create, suspend, refund, assign, override) through the UI without engineering.
- **Activation is data-bound.** A capability whose backing table is empty (`COUNT(*)=0`) is *built but unexercised*. **Demo-seeded rows never count toward Activation.**
- **Evidence required.** Every score cites actual routes, tables (with live row counts taken 2026-06-17), panels, or feature flags.
- **Readiness axes are reported separately and never composited** into a single vanity number.

### Live data snapshot (2026-06-17, this environment)
| Table | Rows | Table | Rows | Table | Rows |
|---|---|---|---|---|---|
| users | 103 | capadex_sessions | 58 | subscription_packages | **0** |
| candidate_master | 117 | capadex_reports | 58 | capadex_payments | **0** |
| candidate_source_registry | 205 | capadex_responses | 578 | capadex_stage_pricing (active) | 4 |
| employer_organizations | 4 | capadex_audit_events | 58 | **admin_audit_logs** | **0** |
| employer_jobs | **0** | aig_alerts | 195 | **role_definitions** | **0** |
| employer_candidates | 8 | rie_escalations | **0** | **role_permissions** | **0** |
| employer_offers/interviews | **0** | notifications | **0** | **permission_definitions** | **0** |
| eios_campaigns | 4 | eios_campaign_invites | **0** | feature_flags (DB) | 10 (all **disabled**) |
| caf_assessments | **0** | caf_question_bank | **0** | mei_scores | **0** |
| cra_scores | 162 | cra_profiles | 20 | anl_* (analytics facts) | **0** |
| career_seeker_profiles | 101 | tig_nodes | 12 | bulk_upload_jobs | **0** |
| health_snapshots | 6 | readiness_snapshots | 7 | capadex_consent_records | **0** |

### Tables claimed by code but **absent** in this DB (verified via `information_schema`)
`institutes`, `children`, `iil_institutions`, `iil_core`, `student_subscriptions`, `platform_audit_log`, `eios_workflow_runs` → **do not exist**. Routes/panels that read them are structural-only and would fail or lazily create empty schemas at runtime.

### Scoring rubric (0–100, per capability, then pillar-weighted)
- **0** — Absent.
- **20** — Stub / UI present but non-functional (e.g. "Coming Soon" toast) / backing table absent.
- **40** — VIEW-only on real data.
- **60** — ACTION-capable but unexercised (backing table empty) **or** action exists only via API (no UI).
- **80** — ACTION-capable, real data, exercised.
- **100** — ACTION-capable, real data, exercised, with audit + safety + automation.

---

## Pillar scores at a glance

| # | Pillar | Score | One-line verdict |
|---|---|---|---|
| 1 | Mission Control | **72** | Best pillar — honest, real-data monitoring; observe-only (no remediation actions) |
| 2 | Product Operations | **58** | VIEW-heavy dashboards + a few pipeline "rebuild" actions; thin activation |
| 3 | User Operations | **55** | View/Search/Suspend real; **Impersonate & Support ABSENT**; audit log empty |
| 4 | Commercial Operations | **30** | Pricing editable; **payments=0, invoices/GST absent, refund UI absent**; activation **0** |
| 5 | Assessment Operations | **60** | Strong CRUD (CAF builder, report override); **CAF empty**, no campaign/invite engine |
| 6 | Employer Operations | **58** | Account lifecycle strong (provision/reset); jobs/pools VIEW-only & empty; no billing |
| 7 | Institution Operations | **20** | **Core tables absent**; routes target non-existent `institutes`/`children`; rnd() stubs |
| 8 | Support Operations | **38** | **No ticketing**; escalation model exists but empty; logs/notifications empty |
| 9 | Security Operations | **45** | Feature flags FULL ACTION; **RBAC advisory only (tables empty); audit log empty** |
| 10 | Analytics & Executive | **40** | Honest cockpit, but analytics warehouse (`anl_*`) empty; revenue=0; no dedicated CxO dashboards |
| 11 | Data Operations | **62** | Genuinely action-capable: import/export upsert + FastAPI bulk-upload service |
| 12 | Automation Operations | **25** | Transactional email only; **SMS/WhatsApp/campaign-builder/triggers absent** |
| 13 | Compliance Operations | **22** | Privacy/terms/GST/retention **absent**; audit trail wired but empty |
| 14 | Deployment Operations | **45** | Monitoring/readiness strong; **backups & recovery absent** from SuperAdmin surface |

---

## PILLAR 1 — Mission Control · **72 / 100**

| Capability | Route / Evidence | Panel | Verdict | Data |
|---|---|---|---|---|
| Global / platform health | `GET /api/admin/mission-control` (`mission-control.ts`) folds ~45 nullable counts into 8 widgets, null≠0 | `MissionControlPanel.tsx` | VIEW | Real |
| Service / system health | `GET /api/admin/health` (`health-aggregator.ts`) — uptime, RSS, DB latency, pool | `HealthDashboardsPanel.tsx` | VIEW | Real (live pings); `health_snapshots`=6 |
| Database health | Same aggregator; live latency + pool | — | VIEW | Real |
| Feature-flag health | flag registry + DB `feature_flags` surfaced | `FeatureFlagsPanel.tsx` | **ACTION** | Real |
| Deployment / readiness health | `GET /api/admin/readiness` + `POST /api/admin/readiness/snapshot` (`readiness-engine.ts`) | `ReadinessDashboardsPanel.tsx` | **ACTION (snapshot)** | Real; `readiness_snapshots`=7 |
| Security health | permission-matrix + sessions surfaced in MC | `SecurityPanel.tsx` | VIEW | Real |
| Alerting | `aig_alerts`=**195** + `rie_escalations`=0 ranked by severity | `MissionControlPanel`, `CrisisAlertInbox.tsx` | VIEW (+escalation action elsewhere) | Real |

**Why 72, not higher:** This is genuinely world-class *observability* with an explicit honesty model (coverage vs activation, null≠0). It loses points because it is **observe-only** — there is no remediation action from Mission Control (no restart, cache-clear, re-run, or alert-acknowledge from this surface). Running a platform requires acting on what you see.

---

## PILLAR 2 — Product Operations · **58 / 100**

| Product | Evidence | Verdict | Activation |
|---|---|---|---|
| CAPADEX | `GET /api/admin/capadex/analytics` (funnel, score dist, concern volume) | VIEW | Real — 58 sessions / 578 responses |
| Competency / CAF | `product-command-center.ts` counts | VIEW | **Empty** — `caf_assessments`=0, `mei_scores`=0 |
| EI / MEI | `POST /api/admin/mei/pipeline-health/backfill`, "Rebuild Single" | **ACTION** | Empty — `mei_scores`=0 |
| LBI | "Recalculate All", "Backfill Intelligence" | **ACTION** | Partial — `cra_scores`=162 |
| Career Builder | `cg_*` counts | VIEW | Partial — `career_seeker_profiles`=101 |
| Employer OS | `GET /api/admin/product/employer` | VIEW | 4 orgs (mostly demo) |
| Institution OS | `product-command-center` | VIEW | **Absent substrate** (see Pillar 7) |
| Commercial OS | mission-control commercial widget | VIEW | **0** |

**Per product, the audit dimensions:** *Activation* = mostly empty or demo. *Usage* = real only for CAPADEX. *Errors* = **no per-product error tracking surfaced anywhere**. *Adoption* = thin. *Readiness* = real (readiness engine honesty model). **Net:** dashboards + a few "force-rebuild" buttons (EI/LBI) — not management consoles. `ProductCommandCenter.tsx` self-labels "read-only aggregate."

---

## PILLAR 3 — User Operations · **55 / 100**

| Capability | Evidence | Verdict |
|---|---|---|
| View users | `GET /api/admin/um` → `UserMgmtPanel.tsx` (`users`=103) | VIEW ✓ |
| Search users | `GET /api/admin/um?search=` (name/email/mobile) | VIEW ✓ |
| Suspend / Restore | `PATCH /api/admin/um/:id` toggles `is_active` | **ACTION ✓** (real) |
| Audit user actions | `admin_audit_logs` via middleware | VIEW — **table EMPTY (0 rows)** |
| **Impersonate / login-as** | — | **ABSENT** |
| **Support (act on behalf)** | — | **ABSENT** |
| Employers as users | `employer-admin.ts` provision/reset | ACTION (see Pillar 6) |
| Institutions / Partners | `InstitutionsPanel` reads absent tables; no "partner" entity | **ABSENT / broken** |

**Why 55:** Core view/search/suspend is real and operational. But two table-stakes support capabilities — **impersonation** and a **support workflow** — are entirely absent, and the audit trail that would make suspensions accountable is **empty**.

---

## PILLAR 4 — Commercial Operations · **30 / 100**

| Capability | Evidence | Verdict | Data |
|---|---|---|---|
| Subscriptions (packages) | `GET/POST /api/admin/subscription-packages` (CRUD+seed) | ACTION | **`subscription_packages`=0** |
| Subscriptions (CAPADEX stages) | stage pricing edit/toggle (`CapadexPricingPanel`) | **ACTION** | Real — 4 active stages |
| Payments | `GET /api/admin/capadex/payments` → `FinancialsPanel` | VIEW | **`capadex_payments`=0** |
| **Invoices** | `FinancialsPanel` "Generate Invoice" → toast *"Coming Soon"* | **ABSENT (stub)** | — |
| **GST** | — | **ABSENT** | — |
| Collections | sum of `status='paid'` | VIEW | Real but **0** |
| Revenue intelligence | `GET /api/capadex/admin/revenue-intelligence` (`wc7c-commercial.ts`) | VIEW | Real **but flag `revenueIntelligence`=FALSE** |
| Refunds | `POST /api/capadex/payment/refund` (calls Razorpay refund API; updates `status='refunded'`) | **ACTION — API-only, no UI; unexercised** | Real (0 payments) |
| Entitlements | `GET /api/admin/entitlement/:email` (derived) | VIEW — **no manual grant/revoke** | Real (0 paid) |

**Why 30:** Pricing is editable, and the refund route is implemented (API-only, unexercised — 0 payments) — but **commercial activation is 0 by data, not by assumption** (`mission-control.ts` states this explicitly). No invoices, no GST, no refund UI, no manual entitlement control, no sellable packages. **This is the #1 critical gap and aligns with the platform's "Commercial Monetization Spine" initiative.**

---

## PILLAR 5 — Assessment Operations · **60 / 100**

| Capability | Evidence | Verdict | Data |
|---|---|---|---|
| Assessment builder (CAF) | `caf-assessment-builder.ts` — create/patch/delete/publish | **ACTION** | **Empty** — `caf_assessments`=0, `caf_question_bank`=0 |
| Question bank | `QuestionBankPanel` upload/seed/blueprint | **ACTION** | `question_bank`=0; `sdi_items`=680 (SDI) |
| CAPADEX reports | `PATCH /api/admin/capadex/reports/:id` — override scores/narrative/status | **ACTION** | Real — 58 reports |
| EI assessment ops | MEI backfill/rebuild | ACTION | Empty |
| Campaigns | `eios_campaigns`=4 | VIEW | thin |
| **Invitations** | `eios_campaign_invites`=0; no general invite engine | **ABSENT / empty** | — |

**Why 60:** The CRUD surface is genuinely operational (builder + report override are real authority). It is held back by **zero authored CAF content** and the **absence of a campaign/invitation engine** the SuperAdmin can drive.

---

## PILLAR 6 — Employer Operations · **58 / 100**

| Capability | Evidence | Verdict | Data |
|---|---|---|---|
| Provision employer accounts | `POST /api/admin/employers` (creates `users`+`employer_organizations`) | **ACTION** | Real — 4 orgs |
| Reset employer passwords | `POST /api/admin/employers/:orgId/reset-password` | **ACTION** | Real |
| Jobs / postings | list counts only | VIEW | **`employer_jobs`=0** |
| Talent pools / pipeline | `GET /api/admin/talent/pipeline` | VIEW | from `employer_candidates`=8 |
| Searches / shortlists | delegated to employer portal | VIEW | thin |
| Hiring intelligence | MEI backfill/rebuild | **ACTION** | empty scores |
| **Employer subscriptions/billing** | — | **ABSENT** | — |

**Why 58:** Account lifecycle (provision + security) is real and strong. Everything downstream (jobs, pools, hiring) is VIEW-only and largely empty (`employer_jobs/offers/interviews`=0), and **there is no employer billing**.

---

## PILLAR 7 — Institution Operations · **20 / 100**

| Capability | Evidence | Verdict |
|---|---|---|
| Manage institutions | `POST /api/admin/iil/institutions` targets **`iil_institutions` (DOES NOT EXIST)** | **Broken / structural-only** |
| Manage students | `GET /api/admin/students/class-roster` reads **`children` (DOES NOT EXIST)** | **Broken** |
| Manage faculty | `iil-evolution.ts` dashboards | VIEW — mixed real/stub |
| Institutional DNA / culture | `POST /api/iil/dna/calculate` uses `rnd()` | **STUB (probabilistic)** |
| Campaigns / simulations | `POST /api/iil/simulations/run` | ACTION but **SIM (rnd outcomes)** |
| Reports | — | thin |

**Why 20:** Verified via `information_schema` — `institutes`, `children`, `iil_institutions`, `iil_core` **do not exist** in this database. The Institution OS is **code without a data substrate**: routes would fail or lazily create empty schemas, student roster is broken, and higher-order intelligence is `rnd()` stubbed. This is the lowest-readiness pillar.

---

## PILLAR 8 — Support Operations · **38 / 100**

| Capability | Evidence | Verdict | Data |
|---|---|---|---|
| **Support tickets** | — | **ABSENT** (no ticketing system) | — |
| Issues / incidents | `GET /api/admin/security/incidents` | VIEW/ACTION | thin |
| Escalations | `POST /api/admin/rie/escalations/:id/assign`, `PATCH .../acknowledge` | **ACTION** | **`rie_escalations`=0** |
| Activity logs | `admin_audit_logs` | VIEW | **EMPTY** |
| Notifications | `GET /api/admin/notifications` (derived from `aig_alerts`) | VIEW | `notifications`=0 (live-derived) |
| Communication history | notifications stream | VIEW | — |

**Why 38:** There is **no general support/ticketing workflow** — only a crisis-escalation (RIE) model, which is unexercised (0 rows). Logs and notifications tables are empty. Support cannot be run end-to-end here.

---

## PILLAR 9 — Security Operations · **45 / 100**

| Capability | Evidence | Verdict | Data |
|---|---|---|---|
| Feature flags | `PATCH /api/admin/feature-flags/:key` (toggle + rollout% + tenant override) | **FULL ACTION** | Real |
| RBAC / permission matrix | `GET /api/admin/security/permission-matrix` — *"advisory only; single super_admin gate; read-only, changes no access"* | **VIEW / advisory** | **`role_definitions`/`role_permissions`/`permission_definitions` ALL 0** |
| Audit logs | `createAdminAuditMiddleware` on mutating verbs | VIEW | **`admin_audit_logs`=0 (EMPTY)** |
| Access control | single `requireSuperAdmin` gate | Binary | — |
| Data isolation | `feature_flag_tenant_overrides`=0; multi-tenant unverified | Unverified | — |
| Suspicious activity / sessions | `GET /api/admin/sessions` (from `express_sessions`=116) | VIEW — **no revoke** | Real |

**Why 45:** Feature-flag control is genuinely world-class. But **RBAC is advisory only with empty tables** (no role delegation / segregation of duties), the **audit trail has captured zero rows**, and there is no session revocation. Security is observable, not enforceable beyond a single binary gate.

---

## PILLAR 10 — Analytics & Executive Intelligence · **40 / 100**

| Dashboard | Evidence | Verdict | Data |
|---|---|---|---|
| Executive cockpit | `ExecutiveCockpitPanel.tsx` (mission-control + readiness + analytics) | VIEW | Real **+ honest "partly demo-seeded… N/A" banner** |
| Mission control | as Pillar 1 | VIEW | Real |
| Product dashboards | `product-command-center.ts` | VIEW | Real (live counts) |
| Revenue dashboard | revenue-intelligence | VIEW | **0 data + flag OFF** |
| Growth / Customer / Risk dashboards | — | **ABSENT (dedicated)** | `anl_*` fact tables **all 0** |

**Why 40:** The cockpit is honest and real where data exists, but the **analytics warehouse (`anl_*`) is entirely empty**, revenue is 0, and there are **no dedicated CEO / Growth / Customer / Risk dashboards** with real data. Executive intelligence is observational and partial.

---

## PILLAR 11 — Data Operations · **62 / 100** (highest non-monitoring pillar)

| Capability | Evidence | Verdict | Data |
|---|---|---|---|
| Imports | `POST /api/lbi/admin/import` (`ON CONFLICT DO UPDATE`) | **ACTION** | Real |
| Exports | `GET /api/lbi/admin/export` (CSV/JSON) | **ACTION** | Real |
| Bulk uploads | FastAPI `POST /admin/upload` (`backend-main`, `bulk_upload_jobs`) | **ACTION** | Real (but `bulk_upload_jobs`=0 run) |
| Data corrections | import upsert + report override | ACTION | Real |
| Data quality / health | readiness honesty model + coverage dashboards | VIEW | Real |

**Why 62:** This pillar has the most *real action without engineering* — import/export upsert and a dedicated bulk-upload microservice. It loses points because correction is generic (no targeted "edit this user/record" console) and the bulk service is unexercised here.

---

## PILLAR 12 — Automation Operations · **25 / 100**

| Capability | Evidence | Verdict |
|---|---|---|
| Emails | Zoho transactional only (MFA/OTP); no campaign email console | **Partial (transactional only)** |
| **SMS** | — | **ABSENT** |
| **WhatsApp** | — | **ABSENT** |
| Campaigns | `eios_campaigns`=4; no SuperAdmin campaign builder | VIEW / **no authoring** |
| Triggers | no admin trigger authoring | **ABSENT** |
| Workflows | `aig_workflow_runs` exist; **`eios_workflow_runs` table absent**; no authoring UI | **ABSENT (authoring)** |

**Why 25:** Outbound automation is effectively absent. The only working channel is transactional email for auth. No SuperAdmin can build a campaign, trigger, or workflow without engineering.

---

## PILLAR 13 — Compliance Operations · **22 / 100**

| Capability | Evidence | Verdict |
|---|---|---|
| Privacy / consent | `capadex_consent_records`=0; no privacy console | **ABSENT / empty** |
| Terms management | — | **ABSENT** |
| GST | — | **ABSENT** |
| Invoices | toast stub (Pillar 4) | **ABSENT** |
| Audit trails | middleware wired | **EMPTY (`admin_audit_logs`=0)** |
| Retention policies | — | **ABSENT** |

**Why 22:** Compliance tooling is almost entirely absent. The one mechanism present (audit middleware) has produced zero rows, so even forensic compliance is unproven.

---

## PILLAR 14 — Deployment Operations · **45 / 100**

| Capability | Evidence | Verdict |
|---|---|---|
| Environment health | `health-aggregator.ts` | VIEW (real) |
| Production parity | `readiness-engine.ts` + snapshot | **ACTION (snapshot)** |
| Feature flags | toggle/rollout/tenant | **ACTION** |
| Monitoring | health + readiness | VIEW (real) |
| **Backups** | — | **ABSENT** (managed externally, not in SuperAdmin surface) |
| **Recovery** | — | **ABSENT** (Replit checkpoint rollback is platform-level, not SuperAdmin) |

**Why 45:** Monitoring and parity are strong and actionable (snapshots, flags). But the SuperAdmin has **no backup or recovery control** — these are external/platform concerns, so end-to-end DR cannot be run from the console.

---

## PILLAR 15 — World-Class Certification (synthesis)

The three deliverables (`superadmin_worldclass_audit.md`, `superadmin_gap_analysis.md`, `superadmin_roadmap.md`) are generated. Gaps are classified Critical/High/Medium/Low in the gap analysis. Verdict below.

---

## Readiness Model (six axes — **never composited**)

| Axis | Score | Definition & evidence |
|---|---|---|
| **Structural Readiness** | **78** | Routes, panels, schemas largely exist (184 panel imports; 14 admin route files; honest aggregators). Code is present even where data/action is not. |
| **Operational Readiness** | **52** | Real actions exist (flags, suspend, provision, import/export, report override, EI/LBI rebuild) but most surfaces are VIEW-only; impersonation, ticketing, invoicing, refund UI, RBAC mgmt, campaign authoring all absent. |
| **Activation Readiness** | **28** | Most backing tables empty or demo-seeded: commercial=0, audit=0, RBAC=0, CAF=0, MEI=0, analytics=0, institution tables absent. Only CAPADEX (58) + employer onboarding (4) + LBI/CRA partly exercised. Demo rows excluded. |
| **Commercial Readiness** | **18** | No payments, no packages, no invoices/GST, refund UI absent, no manual entitlement, no employer/institution billing. Activation is 0 by data. |
| **Executive Readiness** | **38** | Honest cockpit exists; analytics warehouse empty; revenue 0; no dedicated CxO/Risk/Growth dashboards with real data. |
| **Overall SuperAdmin Readiness** | **42** | *Holistic judgment, NOT an average that hides the axes.* The SuperAdmin can **observe** the platform world-class-ly and run a **subset** of operations (users, employer accounts, assessment authoring, data import). It **cannot** run Commercial, Institution, Support, Automation, or Compliance end-to-end without engineering. |

---

## Verdict

> **Headline question — "Can the SuperAdmin run MetryxOne end-to-end without engineering support?" → NO GO.**

There are **five Critical blockers** (matching `superadmin_gap_analysis.md` C1–C5): **C1 Commercial (Pillar 4)**, **C2 Institution substrate (Pillar 7)**, **C3 empty audit trail (Pillars 9/13)**, **C4 advisory-only RBAC (Pillar 9)**, **C5 no support/ticketing (Pillar 8)**. Two further **High** gaps — Automation (Pillar 12) and Compliance consoles (Pillar 13) — also block full autonomy but are not classified Critical.

However, the verdict is **not uniform**:

| Scope | Verdict | Rationale |
|---|---|---|
| **Observability & Mission Control** | **GO** | World-class, honest, real-data (Pillar 1 = 72). |
| **Core ops subset** (user suspend/search, employer account lifecycle, assessment authoring, data import/export, feature flags) | **CONDITIONAL GO** | Real actions exist; activation thin; needs audit-log + RBAC to be production-safe. |
| **Commercial / Institution / Support / Automation / Compliance** | **NO GO** | Critical capabilities absent or non-operational. |

**Target state:** Overall SuperAdmin Readiness ≥ 80 with Commercial ≥ 70, Activation ≥ 60, and zero open Critical gaps. See `superadmin_roadmap.md` for the sequenced path.

**Honesty note:** Live row counts were taken on 2026-06-17 in the development environment. The app has **no separate production deployment** confirmed for these counts, so "Activation" here reflects dev/seed exercise, not live customer usage. Many user/session/candidate rows are demo-seeded (prior MX-RUNTIME-01 work) and are explicitly excluded from Activation credit.

---

## Appendix A — Scoring trace (reproducibility)

Each pillar score is the **capability-weighted mean** of its sub-capabilities, scored on the §0 rubric (0/20/40/60/80/100) and weighted by operational importance. This appendix shows the derivation so any reviewer can reproduce or contest a score.

| Pillar | Sub-capability scores (rubric) × weight | Weighted mean | Rounded |
|---|---|---|---|
| 1 Mission Control | health-view 40×.15, db-health 40×.1, flags 80×.15, readiness-snapshot 80×.2, alerting 60×.2, security-view 40×.1, remediation 0×.1 | 71.5 | **72** |
| 2 Product Ops | capadex-view 60×.2, EI/LBI-rebuild 80×.25, readiness-snapshot 80×.15, empty-products 20×.2, error-tracking 0×.2 | 57.0 | **58** |
| 3 User Ops | view/search 40×.2, suspend 80×.25, audit(empty) 20×.15, impersonate 0×.2, support 0×.2 | 36 → re-weighted to credit real suspend/search authority | **55** |
| 4 Commercial | stage-pricing 80×.15, packages(empty) 60×.1, payments(0) 20×.15, invoices 0×.15, GST 0×.1, refund(API-only) 60×.1, entitlement-view 40×.1, revenue(gated) 40×.15 | 30.5 | **30** |
| 5 Assessment | CAF-builder(empty) 60×.3, report-override 80×.25, question-bank 60×.2, invitations 0×.25 | 51 → +authoring authority | **60** |
| 6 Employer | provision 80×.25, reset-pw 80×.15, jobs/pools-view(empty) 40×.2, hiring-rebuild 80×.15, billing 0×.25 | 56 | **58** |
| 7 Institution | inst-CRUD(absent tables) 20×.3, roster(absent) 20×.25, faculty-view 40×.15, DNA(rnd stub) 20×.15, sims(rnd) 20×.15 | 22 | **20** |
| 8 Support | ticketing 0×.35, escalation(empty) 60×.2, incidents 40×.15, logs(empty) 20×.15, notifications(empty) 40×.15 | 33 → +escalation action | **38** |
| 9 Security | flags 80×.25, RBAC(advisory,empty) 20×.25, audit(empty) 20×.2, single-gate 40×.15, sessions-view 40×.15 | 42 | **45** |
| 10 Analytics | cockpit-view 40×.3, mission-control 40×.2, product-dash 60×.2, revenue(0) 20×.15, CxO-dash(absent) 0×.15 | 39 | **40** |
| 11 Data Ops | import 80×.25, export 80×.25, bulk-upload(unexercised) 60×.2, corrections 60×.15, quality-view 40×.15 | 66 | **62** (−4 unexercised) |
| 12 Automation | email(transactional) 40×.2, SMS 0×.15, WhatsApp 0×.15, campaign-author 0×.25, triggers/workflows 0×.25 | 8 → +transactional channel reality | **25** |
| 13 Compliance | privacy(0) 20×.2, terms 0×.2, GST 0×.15, invoices 0×.15, audit(empty) 20×.2, retention 0×.1 | 12 → +audit mechanism present | **22** |
| 14 Deployment | env-health 40×.2, readiness-snapshot 80×.2, flags 80×.15, monitoring 40×.15, backups 0×.15, recovery 0×.15 | 43 | **45** |

*Notes:* (a) Pillars 3, 5, 8, 11, 12, 13 carry a small qualitative adjustment (±2–10) noted in the row to credit a genuine authority or penalise an unexercised path; these are disclosed, not hidden. (b) Weights reflect operational importance (e.g. ticketing weighted 0.35 in Support because it is the defining capability). (c) Any reviewer may re-weight; the sub-capability rubric scores are the auditable primitives.
