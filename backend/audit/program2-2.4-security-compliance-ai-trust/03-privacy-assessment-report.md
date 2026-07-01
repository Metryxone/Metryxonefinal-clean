# 03 · Privacy Assessment Report

## Findings (file-cited)
| Area | Status | Evidence |
|---|---|---|
| Consent — parent/child flow | **PRESENT** | `ParentConsentApprovePage` → unified parent dashboard redirect; `student_subscriptions.child_id` (`backend/shared/schema.ts`); Customer-Journey J5 resolved. |
| Consent — dedicated traceability ledger | **PRESENT** | `consent_records` + `consent_types` tables (`backend/shared/schema.ts` ~2380/2778) with `consent_type`, `consent_version`, `status` (pending/granted/revoked/expired), `granted_at`/`revoked_at`, `processing_purposes[]`, `lawful_basis`, `retention_period`; storage `createConsentRecord`/`getConsentRecords`/`upgradeConsentVersion`; admin CRUD `/api/admin/consents` (`backend/routes.ts` ~7991). |
| Consent — user self-service management | **PARTIAL** | User can view/manage consent: `/api/hr/consent/my` (`getUserConsentLogs`), `/api/email-consents` GET+PUT, `initializeDefaultConsents`. Not proven wired at **every** data-collection touchpoint → CMP-L3. |
| PII inventory | **PRESENT** | `users` (email/name/role), `career_seeker_profiles`, `candidate_master`/`employer_candidates`. |
| PII masking / pseudonymization | **PRESENT** | Audit `redactJson` (`backend/services/governance/audit-engine.ts`); recruiter "anonymized card first, unlock on accept" (`CareerBuilderPage.tsx`); audit-artifact emails masked to `user_<sha256>` pseudonyms. |
| Data anonymization (k-anonymity) | **PRESENT** | `applyKAnonymity` in `cohort-gating.ts`, `institutional-intelligence-engine.ts`, `capadex/evidence-gate.ts`; `k_min = 30`; sub-threshold counts masked/suppressed. |
| Data deletion primitives | **PRESENT** | `users.deletion_method` ∈ {soft_delete, hard_delete, secure_delete, anonymize} (`backend/shared/schema.ts`); demo `@example.com` purge scripts (FK-ordered). |
| Data deletion — user self-service (erasure) | **PARTIAL** | Deletion primitives exist but no surfaced **user-initiated** "delete my account / erase my data" flow. → CMP-M3. |
| Data retention enforcement | **ABSENT (automated)** | `deletion_method` implies intent but no scheduler/TTL purge job found. → CMP-M2. |
| Data export | **PARTIAL** | Admin/employer CSV/JSON/PDF exports (`backend/routes/import-export.ts`, `eios-intelligence.ts`); **no end-user "Download My Data" (DSAR)**. → CMP-M3. |
| Child privacy | **PRESENT (relationship-based)** | Explicit `child_id` across schema; consent via parent redirect flow. No explicit verifiable-age artifact. → CMP-L2. |

## Assessment
Privacy **primitives are strong** — masking, k-anonymity (k=30), redaction-at-write, deletion methods, a working parent/child consent flow, **and a dedicated consent-records ledger with lawful-basis/purpose/version/grant-revoke traceability plus user-facing consent management**. The residual privacy work is **enforcement + end-user data-rights surfacing**, not missing foundations: (1) automated retention *enforcement* (periods are declared but not scheduled), (2) end-user DSAR data **export (portability) + self-service erasure** (consent access already exists). These are product/policy decisions carried into the Compliance Gap Register (report 11) pending approval. Coverage of controls is high; end-user data-export/erasure adoption is the separate axis that is currently partial.
