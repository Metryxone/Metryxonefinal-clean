# 04 · Compliance Assessment Report (DPDP / GDPR readiness)

## Readiness matrix
| Requirement | DPDP / GDPR ref | Status | Evidence / gap |
|---|---|---|---|
| Lawful basis / consent capture | DPDP §6 · GDPR Art. 6/7 | **PRESENT** | `consent_records` ledger with `lawful_basis`, `processing_purposes[]`, `consent_version`, grant/revoke timestamps (`backend/shared/schema.ts` ~2380); admin CRUD `/api/admin/consents`. |
| Consent traceability | DPDP §6(3) · GDPR Art. 7(1) | **PRESENT** | Per-grant auditable ledger (status pending/granted/revoked/expired + version upgrade `upgradeConsentVersion`); user view via `/api/hr/consent/my`, `/api/email-consents`. Wiring-at-all-touchpoints unverified → CMP-L3. |
| Right to access | DPDP §11 · GDPR Art. 15 | **PARTIAL** | User consent access exists; no full user-facing personal-data access/export → CMP-M3. |
| Right to data portability | GDPR Art. 20 | **PARTIAL** | Admin CSV/JSON exports; no user-initiated portable export → CMP-M3. |
| Right to erasure | DPDP §12 · GDPR Art. 17 | **PARTIAL** | `deletion_method` primitives present; no user-initiated erasure flow → CMP-M3. |
| Data minimization / retention limits | DPDP §8(7) · GDPR Art. 5(1)(e) | **PARTIAL** | No automated retention/TTL enforcement → CMP-M2. |
| Anonymization / pseudonymization | GDPR Art. 25/32 | **PRESENT** | k-anonymity k=30; audit redaction; audit-artifact pseudonymization. |
| Audit logging & traceability | DPDP §8 · GDPR Art. 30 | **PRESENT** | 4 audit streams unified (`backend/services/governance/unified-audit-trail.ts`); redaction at write. See report 08. |
| Data governance & policy enforcement | GDPR Art. 24 | **PRESENT** | RBAC engine + `/api/admin/security/permission-matrix`; super-admin gate on `/api/admin/*`. |
| Data residency / cross-border | DPDP §16 · GDPR Ch. V | **PARTIAL** | Canonical prod region `asia-south1` (`replit.md`); no explicit transfer-control artifact → CMP-F1. |
| Environment / data segregation | GDPR Art. 32 | **VERIFY** | Canonical GCP prod uses dedicated `DATABASE_URL` (Secret Manager) per `replit.md`; MFA-hardening note cites dev/prod DB sharing — requires attestation → SEC-H1 (cross-referenced). |
| Records of processing (RoPA) / DPIA | GDPR Art. 30/35 | **ABSENT** | No formal RoPA/DPIA artifacts → CMP-F1. |

## Assessment
The **technical enforcement substrate** for DPDP/GDPR is largely present (consent-records ledger with lawful basis/purpose/version, audit, k-anonymity, deletion methods, RBAC governance, redaction). The gaps are **enforcement + user-rights formalization**: automated retention enforcement, end-user data export/erasure DSAR, and documentary artifacts (RoPA/DPIA, transfer controls). None is a code vulnerability; all are recorded in report 11 and require owner/product/DPO decisions. **Structural compliance readiness: CONDITIONAL** — suitable for controlled deployment, with the Medium items resolved before broad/regulated rollout.
