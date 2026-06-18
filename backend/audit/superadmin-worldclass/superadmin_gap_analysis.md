# MetryxOne — SuperAdmin Gap Analysis
**Audit ID:** MX-SA-WORLDCLASS-AUDIT-01 · **Date:** 2026-06-17
Companion to `superadmin_worldclass_audit.md`. Every gap is classified **Critical / High / Medium / Low** with evidence and operational impact. A gap is *Critical* when it blocks autonomous end-to-end operation, revenue, or accountability.

---

## CRITICAL (5) — block end-to-end operation; verdict NO GO until cleared

### C1 — Commercial spine non-operational (Pillar 4)
- **Evidence:** `subscription_packages`=0, `capadex_payments`=0. Invoice button → toast *"Coming Soon"*. GST absent. Refund implemented (`POST /api/capadex/payment/refund`) **API-only, no UI**. Entitlement viewer has **no manual grant/revoke**. `revenueIntelligence` flag = FALSE. `mission-control.ts` states *"commercial activation is 0 by data."*
- **Impact:** SuperAdmin cannot sell, invoice, tax, refund (via UI), or adjust entitlements. No revenue can be operated. Directly aligns with the "Commercial Monetization Spine" initiative.

### C2 — Institution Operations has no data substrate (Pillar 7)
- **Evidence:** `institutes`, `children`, `iil_institutions`, `iil_core` **do not exist** (verified via `information_schema`). `POST /api/admin/iil/institutions` and `GET /api/admin/students/class-roster` target non-existent tables. Higher-order intelligence (DNA/culture/forecasts) uses `rnd()`.
- **Impact:** Institution OS is code without a working data path — institution CRUD and student roster are broken; intelligence is fabricated (stub). Cannot onboard or run an institution end-to-end.

### C3 — Audit trail empty despite wired middleware (Pillars 9 & 13)
- **Evidence:** `admin_audit_logs`=0 rows (verified). Middleware (`createAdminAuditMiddleware`) exists but no rows captured. `platform_audit_log` table claimed by code **does not exist** (verified). *Hypothesised cause (not proven by this audit):* dev-DB schema drift causes mutations to 500 before the middleware commits — per prior memory `superadmin-perf-and-security-visibility`; root-cause to be confirmed in Phase 0.
- **Impact:** No forensic accountability for any admin action (suspends, overrides, refunds, flag flips). Compliance and security are unprovable.

### C4 — RBAC advisory-only with empty tables (Pillar 9)
- **Evidence:** `role_definitions`/`role_permissions`/`permission_definitions` **all 0**. `permission-matrix` endpoint self-documents *"advisory definitions… single super_admin gate… read-only, changes no access."*
- **Impact:** No role delegation, no segregation of duties, no least-privilege. Every admin is all-powerful or nothing. Unsafe for a multi-operator team.

### C5 — No support/ticketing system (Pillar 8)
- **Evidence:** No ticketing routes/tables. Only RIE crisis-escalation (`rie_escalations`=0, unexercised). No outbound support comms.
- **Impact:** SuperAdmin cannot receive, triage, respond to, or resolve user support requests. Support cannot be run.

---

## HIGH (7) — block major workflows; degrade autonomy

### H1 — No user impersonation / "login-as" (Pillar 3)
- **Evidence:** No impersonation route or UI found.
- **Impact:** Support/debug of a specific user's experience requires engineering DB access.

### H2 — Automation console absent (Pillar 12)
- **Evidence:** SMS/WhatsApp absent; no campaign builder, trigger authoring, or workflow editor; `eios_workflow_runs` table absent; only Zoho transactional email.
- **Impact:** All outreach/lifecycle automation needs engineering. No growth or retention automation operable.

### H3 — Executive analytics warehouse empty (Pillar 10)
- **Evidence:** `anl_*` fact tables all 0; no dedicated CEO/Growth/Customer/Risk dashboards with real data; revenue=0.
- **Impact:** No executive decision-support beyond honest-but-thin cockpit; leadership cannot self-serve metrics.

### H4 — Backups & recovery absent from SuperAdmin surface (Pillar 14)
- **Evidence:** No backup/restore/DR controls in admin routes or panels.
- **Impact:** Disaster recovery is entirely engineering/platform-dependent; SuperAdmin cannot run DR.

### H5 — Compliance consoles absent (Pillar 13)
- **Evidence:** `capadex_consent_records`=0, no privacy console; no terms management; no retention policies; GST/invoices absent.
- **Impact:** GDPR/DPDP-style obligations (consent, erasure, retention) cannot be operated; legal exposure.

### H6 — Employer & institution billing absent (Pillars 6 & 7)
- **Evidence:** No B2B billing routes; `employer_*` and institution tables carry no subscription/payment linkage; `student_subscriptions` table absent.
- **Impact:** Cannot monetize the B2B/institutional segments — the largest revenue surface — without engineering.

### H7 — Assessment authoring unexercised + no campaign/invite engine (Pillar 5)
- **Evidence:** CAF builder is full CRUD but `caf_assessments`=0, `caf_question_bank`=0; `eios_campaign_invites`=0; no general invitation engine.
- **Impact:** Although the builder works, there is no authored content and no way to invite cohorts at scale from the console.

---

## MEDIUM (6) — friction; require partial engineering

- **M1 — Product Ops are VIEW-heavy; no per-product error tracking (Pillar 2).** `ProductCommandCenter` is "read-only aggregate"; only EI/LBI expose rebuild actions. No error/exception surface per product.
- **M2 — No session revocation (Pillars 9/14).** `GET /api/admin/sessions` is VIEW-only over `express_sessions`; cannot kill a compromised session.
- **M3 — Mission Control is observe-only (Pillar 1).** No remediation actions (restart, cache-clear, re-run) from the monitoring surface.
- **M4 — Notifications/comms VIEW-only & empty (Pillars 8/12).** `notifications`=0 (live-derived only); no outbound or acknowledge.
- **M5 — DB `feature_flags` all disabled (Pillars 2/9).** All 10 rows `enabled=false` incl. `signal_intelligence`; engine activation gated; SuperAdmin can toggle but defaults are off.
- **M6 — IIL intelligence is probabilistic stub (Pillar 7).** DNA/culture/forecast scores use `rnd()` — violates the platform's honesty mandate (fabricated numbers).

---

## LOW (4) — polish; trust & ergonomics

- **L1 — Demo-seed contamination (cross-cutting).** `users`=103, `capadex_sessions`=58, `candidate_master`=117 largely demo-seeded; not labeled as such in admin views → inflates perceived activation.
- **L2 — Entitlement viewer read-only (Pillar 4).** No manual grant/revoke for support/comp cases.
- **L3 — Refund is API-only (Pillar 4).** Backend complete; surface it in `FinancialsPanel`.
- **L4 — Health/readiness snapshots are manual only (Pillars 1/14).** No scheduled/cron snapshotting surfaced.

---

## Gap rollup

| Severity | Count | Pillars touched |
|---|---|---|
| Critical | 5 | 4, 7, 8, 9, 13 |
| High | 7 | 3, 5, 6, 10, 12, 13, 14 |
| Medium | 6 | 1, 2, 7, 8, 9 |
| Low | 4 | 1, 4, 14, cross-cutting |

**Cleared-for-GO condition:** all 5 Critical + (H1, H5, H6, H7) closed, with `admin_audit_logs` actively writing and at least one real (non-demo) commercial transaction end-to-end.
