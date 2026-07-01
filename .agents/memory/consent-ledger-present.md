---
name: Consent-records ledger is PRESENT (DPDP-ready)
description: CAPADEX already has a first-class consent ledger — never certify consent traceability as "absent".
---

# Consent traceability is implemented — do not claim it absent

CAPADEX has a dedicated consent ledger with DPDP/GDPR fields. A privacy/compliance audit that claims "no consent ledger / consent inferred from relationships" is **factually wrong** and will fail review.

**Substrate:** `consent_records` + `consent_types` tables (`backend/shared/schema.ts` ~2380 / ~2778) — `consent_type`, `consent_version`, `status` (pending/granted/revoked/expired), `granted_at`/`revoked_at`, `processing_purposes[]`, `lawful_basis`, `retention_period`. Storage ops `createConsentRecord`/`getConsentRecords`/`upgradeConsentVersion`. Admin CRUD `/api/admin/consents` (+ `/upgrade-version`). User-facing: `/api/hr/consent/my` (`getUserConsentLogs`), `/api/email-consents` GET+PUT, `initializeDefaultConsents`.

**The real residuals (verify, don't assume):**
- Consent *capture wiring* may not hit every data-collection touchpoint (coverage/adoption axis — Low, not "absent").
- Retention is **declared** (`retention_period`/`retention_period_days`, `auto_delete_inactive_accounts` setting defaults `false`) but **not enforced** (no scheduler/purge cron) — Medium.
- End-user DSAR: consent access/management exists; personal-data **export (portability)** and **self-service erasure** are admin-only — Medium.

**Why:** Program-2 Phase 2.4 certification first mis-reported "consent ledger absent" as a Medium gap; architect review caught it against live code. Lesson: grep-verify every "absent/missing" claim in a certification before writing it — Coverage(exists) ⟂ Adoption(wired/used) are separate axes; null ≠ 0.
