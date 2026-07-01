# 11 · Compliance Gap Register (Privacy / DPDP / GDPR)

Severity axis independent from Security and AI. No composited scores.

## Launch-Critical — 0
None.

## High — 0
(SEC-H1 environment/data isolation has compliance impact under GDPR Art. 32 — tracked in report 10 to avoid double-counting.)

> **Correction (post-review recertification pass):** a dedicated consent ledger **already exists** — `consent_records` + `consent_types` (`backend/shared/schema.ts` ~2380/2778) with `lawful_basis`, `processing_purposes[]`, `consent_version`, status (pending/granted/revoked/expired), grant/revoke timestamps; storage ops + admin CRUD `/api/admin/consents`; user views `/api/hr/consent/my`, `/api/email-consents`. The former **CMP-M1 ("consent ledger absent") is WITHDRAWN as a Medium gap** (factually incorrect); its true residual is consent-capture *wiring coverage*, reclassified to **CMP-L3 (Low)**.

## Medium — 2
| ID | Gap | Ref | Evidence | Recommended action (needs approval) |
|---|---|---|---|---|
| **CMP-M2** | **Automated retention enforcement** — retention periods are *declared* (`retention_period`/`retention_period_days` fields; `auto_delete_inactive_accounts` setting defaults `false`) but there is no scheduled TTL/purge job. | DPDP §8(7) · GDPR Art. 5(1)(e) | schema retention fields; no scheduler | Additive scheduled purge honoring declared retention + `deletion_method` (enable the existing compliance toggle). |
| **CMP-M3** | **End-user data-rights DSAR** — user consent access/management exists, but personal-data **export (portability)** and **self-service erasure** are admin-facing only. | DPDP §11/§12 · GDPR Art. 15/17/20 | `import-export.ts` (admin), `deletion_method` (no user flow) | Add user-facing data-export + erasure endpoints reusing existing export + deletion primitives (additive). |

## Low — 3
| ID | Gap | Ref | Recommended action |
|---|---|---|---|
| **CMP-L1** | `anonymize` deletion method defined but end-to-end anonymization pipeline not verified. | GDPR Art. 25 | Verify/complete the anonymize path; add test. |
| **CMP-L2** | Child privacy relies on relationship + parent redirect; no explicit verifiable-age / parental-consent artifact. | DPDP §9 | Add age-gate + verifiable parental-consent record (link to `consent_records`). |
| **CMP-L3** | Consent ledger present but **capture not verified wired at every data-collection touchpoint**; user-facing consent UI coverage partial. | GDPR Art. 7(1) | Audit consent write-points; ensure each collection path records to `consent_records`. |

## Future — 2
| ID | Gap | Recommended action |
|---|---|---|
| **CMP-F1** | Formal RoPA (Art. 30) + DPIA (Art. 35) + cross-border transfer controls (asia-south1 residency documented; controls not formalized). |
| **CMP-F2** | Data-processing agreements / sub-processor register for third parties (Zoho, OpenAI/Emergent, Razorpay, Twilio). |

**Adoption axis (not a gap):** real end-user consent/erasure volume is honest-low; reported separately, never as an engineering gap.
