---
name: SuperAdmin operational-capability audit
description: Honesty traps when auditing whether the SuperAdmin can run MetryxOne end-to-end (capability vs UI count)
---

# Auditing SuperAdmin operational capability

When auditing "can the SuperAdmin run X without engineering", measure **capability**, not surface area, and verify the **data substrate** — the admin surface is large (≈184 panel imports, 14 admin route files) but much of it is VIEW-only or backed by empty/absent tables.

**Why:** explorers reading route/panel code over-credit pillars; the truth is in row counts + `information_schema`.

**How to apply:**
- **Absent-table trap:** Institution OS routes target `institutes`/`children`/`iil_institutions`/`iil_core` which **do not exist** in this DB; `student_subscriptions` and `platform_audit_log` also don't exist. Always confirm a claimed table exists before crediting the pillar.
- **Empty-table trap (built ≠ exercised):** `admin_audit_logs`=0 (audit middleware wired but captures nothing — dev-DB drift 500s mutations pre-commit), RBAC tables (`role_definitions`/`role_permissions`/`permission_definitions`)=0 (advisory single super_admin gate only), `caf_assessments`/`caf_question_bank`/`mei_scores`/`anl_*`=0, commercial (`subscription_packages`/`capadex_payments`)=0.
- **VIEW vs ACTION:** real ACTIONs that work: feature-flag PATCH (toggle/rollout/tenant), user suspend (`is_active`), employer provision + password reset, import/export upsert + FastAPI bulk-upload, CAF builder CRUD, CAPADEX report override, EI/LBI rebuild, readiness snapshot. ABSENT: impersonation, ticketing, invoice/GST, refund-UI (refund is API-only), campaign/trigger authoring, SMS/WhatsApp, backups/recovery, manual entitlement grant.
- **Honesty math:** report Structural/Operational/Activation/Commercial/Executive separately, never composite into one happy number; Demo-seed (users/sessions/candidates from prior backfills) never counts toward Activation; IIL DNA/forecast uses `rnd()` → fabricated, flag it.
- Strongest pillar = Mission Control (honest real-data aggregator, null≠0) but observe-only. Verdict for end-to-end autonomy = NO GO; commercial spine is the #1 Critical gap.
- Deliverables live in `backend/audit/superadmin-worldclass/`.
