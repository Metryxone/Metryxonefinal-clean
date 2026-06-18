# MetryxOne — SuperAdmin World-Class Roadmap
**Audit ID:** MX-SA-WORLDCLASS-AUDIT-01 · **Date:** 2026-06-17
Sequenced remediation to move Overall SuperAdmin Readiness from **42 → ≥80** and clear all Critical gaps. All work follows platform conventions: **additive, flag-gated, honest (never fabricate), STOP-for-approval before deploy.**

---

## Targets

| Axis | Current | Target |
|---|---|---|
| Structural | 78 | 90 |
| Operational | 52 | 85 |
| Activation | 28 | 60 |
| Commercial | 18 | 70 |
| Executive | 38 | 75 |
| **Overall** | **42** | **≥80** |

**Verdict transition:** NO GO → CONDITIONAL GO (end of Phase 1) → GO (end of Phase 2).

---

## PHASE 0 — Accountability foundation (clears C3, C4; ~1 sprint)
*Nothing else is trustworthy until admin actions are logged and scoped. Do this first.*

1. **Make the audit trail actually write (C3).** Root-cause why `admin_audit_logs`=0 (leading hypothesis: dev-DB schema drift causing mutations to 500 before the middleware commits — per memory `superadmin-perf-and-security-visibility`; confirm before fixing). Fix so mutating verbs persist a row; add a smoke test that asserts a row is written on `POST /api/admin/roles`. *Exit:* `admin_audit_logs` grows on every admin mutation.
2. **Seed & enforce RBAC (C4).** Populate `role_definitions`/`role_permissions`/`permission_definitions`; move from advisory matrix to enforced checks behind a flag (`rbacEnforcement`, default OFF → byte-identical). *Exit:* at least 2 roles with distinct permission sets enforced on ≥3 routes.
3. **Session revocation (M2)** and **scheduled snapshots (L4)** as fast-follows.

## PHASE 1 — Commercial spine + critical operability (clears C1, C5, H1; CONDITIONAL GO)
*This is the headline initiative ("Commercial Monetization Spine").*

4. **Sellable packages + entitlement bridge (C1, H6).** Seed real `subscription_packages` with prices/validity; build the identity bridge (email → entitlement) that's currently absent (`student_subscriptions` table missing — see memory `subscription-package-entitlement-gap`). Flag-gate. *Exit:* one real (non-demo) purchase resolves to an entitlement.
5. **Invoices + GST (C1, H5-partial).** Replace the "Coming Soon" toast with real invoice generation (PDF + numbering) and GST calculation/fields. *Exit:* a paid transaction produces a downloadable GST invoice.
6. **Refund + entitlement UI (C1, L2, L3).** Surface the existing `POST /api/capadex/payment/refund` in `FinancialsPanel`; add manual entitlement grant/revoke with audit. *Exit:* refund + manual grant executable from UI, both audit-logged.
7. **Support/ticketing system (C5).** Introduce a minimal ticket entity (create/assign/respond/resolve) + inbound capture; wire to notifications. *Exit:* a user issue can be received, assigned, answered, and closed from the console.
8. **User impersonation (H1).** Add audited, time-boxed "view-as" with a visible banner and full audit-log entry. *Exit:* SuperAdmin can enter/exit impersonation; every session is logged.

## PHASE 2 — Institution substrate + automation + executive (clears C2, H2, H3, H7; GO)

9. **Institution data substrate (C2, M6).** Create the missing tables (`institutes`/`children` or rename to a real namespace) via canonical migration + lazy ensure-schema; wire institution CRUD + student roster to real data; **replace `rnd()` intelligence with honest derived/abstained values** (per honesty mandate). *Exit:* an institution + cohort can be created and a roster viewed from real data.
10. **Automation console (H2).** Campaign builder + trigger/workflow authoring; add SMS/WhatsApp channels (via integration). Flag-gate. *Exit:* SuperAdmin can author and fire a campaign without engineering.
11. **Assessment campaigns/invitations (H7).** Author CAF content; build a cohort invitation engine on top of `eios_campaign_invites`. *Exit:* a CAF assessment can be authored and invited to a cohort.
12. **Executive analytics warehouse (H3).** Populate `anl_*` facts (ETL from live events); build CEO/Revenue/Growth/Customer/Risk dashboards on real data with honest N/A where absent. *Exit:* each CxO dashboard renders ≥1 real metric series.

## PHASE 3 — Resilience & polish (clears H4, M1, M3, M4, M5, L1)

13. **Backup/recovery surface (H4).** Expose backup status + restore runbook (even if the engine is platform-managed) so DR is operable/visible.
14. **Per-product error tracking (M1)** + **Mission Control remediation actions (M3)** (restart/cache-clear/re-run) + **outbound notifications & acknowledge (M4)**.
15. **Flag hygiene (M5)** — review the 10 disabled DB flags; enable what's production-ready. **Demo-seed labeling (L1)** — tag seeded rows so activation metrics never inflate.

---

## Sequencing rationale
- **Phase 0 before everything:** logging + RBAC make all later actions accountable and safe for a multi-operator team.
- **Phase 1 is revenue:** the commercial spine is the single highest-value gap and the platform's stated current initiative; ticketing + impersonation make the platform supportable the moment money changes hands.
- **Phase 2 unlocks the B2B/institution segment and growth automation** — the largest remaining revenue + scale levers — and gives leadership real executive intelligence.
- **Phase 3 hardens** resilience and trims trust/ergonomics debt.

## Definition of "World-Class" (exit certification)
- Zero open Critical gaps; ≤2 High.
- Overall Readiness ≥80 with Commercial ≥70 and Activation ≥60.
- `admin_audit_logs` writing on every mutation; RBAC enforced; ≥1 real end-to-end commercial transaction (purchase → entitlement → GST invoice → refund), all audited.
- Every score re-measured against live (non-demo) data.
