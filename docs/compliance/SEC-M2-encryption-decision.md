# SEC-M2 — Application-Layer PII Encryption: Decision Record

> **STATUS: DECISION RECORDED — provider-level at-rest encryption ACCEPTED.**
> Owner-approved. Revisit if a customer/regulatory requirement mandates
> application-layer field encryption.

## Gap
SEC-M2 (Medium) asked whether personal data should be encrypted at the
application layer (field-level) in addition to the storage layer.

## Decision
**Rely on provider-level (at-rest) encryption; do NOT implement application-layer
field encryption at this time.**

## Rationale
- **Sufficiency:** Production data resides on Google Cloud SQL / Firebase, which
  provides at-rest encryption by default. The Phase 2.4 compliance register notes
  provider-level encryption is **typically acceptable for DPDP / GDPR Art. 32**
  when combined with the access controls already in place (RBAC, super-admin MFA,
  CSRF, TLS in transit, audit-log redaction at write).
- **Cost/risk of the alternative:** Retrofitting field-level encryption onto
  **already-populated** PII columns is a destructive migration that also introduces
  a key-management burden (rotation, escrow, HSM/KMS integration) and breaks any
  search/join/sort on those columns. Doing this blindly would risk data loss and
  query breakage for marginal additional assurance over provider encryption.

## Conditions that would re-open this decision
- A customer contract or sector regulation explicitly requiring application-layer
  or customer-managed encryption keys (CMEK/BYOK).
- Storing a new category of especially-sensitive data (e.g. government IDs,
  health/clinical data — currently excluded).

## If re-opened, scope first (do not encrypt blindly)
1. Enumerate PII columns and classify by whether they are used in
   search/join/sort (those cannot be transparently encrypted).
2. Introduce KMS-backed key management before touching data.
3. Migrate on a per-column, reversible, tested path — never a bulk in-place rewrite.
