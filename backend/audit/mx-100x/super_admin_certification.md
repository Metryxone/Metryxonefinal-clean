# Section 12 — Super Admin & Governance Certification

**Verdict: PASS (structure + security) / DORMANT (operational governance activity).**

The platform's administrability and governance scaffolding is genuinely strong — RBAC, AI governance,
methodology versioning, review schedules, and an audited admin surface all exist and are wired. What is
empty is **operational governance activity**: no approval requests, governance events, or review
instances have been generated, because the platform has no real operational load yet.

## 12.1 Governance structure — PASS
| Table | Count | Table | Count |
|---|---:|---|---:|
| rbac_permission_groups | 8 | rbac_role_hierarchies | 9 |
| aig_models | 4 | aig_workflow_runs | 71 |
| gov_methodology_versions | 7 | gov_review_schedules | 7 |
- AI governance has real activity (`aig_workflow_runs` = 71) — the AI-governance harness has actually
  executed. Methodology versioning and review *schedules* are seeded.

## 12.2 Operational governance — DORMANT
| Table | Count |
|---|---:|
| rbac_approval_requests | 0 |
| governance_events | 0 |
| gov_review_instances | 0 |
- No approvals raised, no governance events logged, no review instances opened. The machinery is
  armed but unexercised — consistent with zero real operational usage.

## 12.3 Admin security — PASS (with documented care)
- One authoritative `app.use('/api/admin', requireAuth → requireSuperAdmin)` gate. The known gap —
  this gate **misses** `/api/<framework>/admin/*` (lbi/sdi/competency/commercial/concerns/invoice) —
  is documented and each such route carries its own inline `requireAuth + requireSuperAdmin`.
- Super-admin login is **2FA-gated** (MFA code emailed via Zoho; in dev both Zoho secrets are absent,
  so the code is read from the `mfa_codes` table). MFA verify sanitizes the password hash. Sessions
  live in `express_sessions`. Mutating admin verbs are audit-logged (status < 400).
- **Caution (carried from prior security work):** Razorpay payment-verify IDOR linkage, webhook fail-
  closed, and full MFA e2e were flagged in WC-C8A as needing live exercise before commercial launch —
  they are coded correctly but not proven under real traffic (0 usage).

## 12.4 Manageability & auditability — PASS
- The super-admin dashboard is code-split (~160 panels lazy behind one Suspense), with reference data
  (frameworks, concern ontologies, subscription packages, question banks) all manageable via CRUD.
- Auditability is real: employer audit logs, m5 audit logs, mobility audit logs, bench audit logs, and
  the admin mutation audit middleware all exist.

## 12.5 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| RBAC / governance structure | PASS | groups 8, hierarchies 9, methodology 7, schedules 7 |
| AI governance activity | PASS | aig_workflow_runs 71, models 4 |
| Operational governance activity | DORMANT | approvals/events/review-instances all 0 |
| Admin security & 2FA | PASS (unproven under load) | unified gate + inline framework guards, MFA |
| Manageability / auditability | PASS | code-split admin, multi-domain audit logs |

**Net: PASS (structural) / DORMANT (operational).** The platform is highly administrable and
governable by design; governance telemetry will populate only once real admins and real load arrive.
Commercial-path security items (Razorpay/MFA e2e) remain unproven under real traffic.
