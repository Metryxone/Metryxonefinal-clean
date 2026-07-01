# Production DB Isolation Attestation Checklist (SEC-H1)

> **Status: OWNER / OPS ACTION REQUIRED.** This gap cannot be closed by code alone —
> it requires the project owner to verify the production configuration and attest.
> The boot-time env preflight (`backend/lib/env-preflight.ts`) emits a `[WARN]` for
> `PROD_DB_ISOLATION_ATTESTED (SEC-H1)` until this checklist is completed and the
> env var is set.

## Why this exists
`replit.md` documents a dedicated production database, but the Super-Admin MFA
hardening rationale references dev/prod DB sharing in the workspace. Under GDPR
Art. 32 (security of processing) and general data-isolation hygiene, production
personal data must not be readable/writable from the dev/workspace environment.

## Checklist (complete before setting the attestation)
- [ ] Production `DATABASE_URL` is stored in **Google Secret Manager**, not in `.replit`, source, or any dev-visible location.
- [ ] Production `DATABASE_URL` host/instance is **distinct** from the workspace/dev `DATABASE_URL` (different Cloud SQL instance or database, not just a different schema on the same instance).
- [ ] No dev/workspace credential can connect to the production database (network/IAM restricted; Cloud SQL proxy/authorized networks reviewed).
- [ ] No dev tooling, seed script, or migration is pointed at the production `DATABASE_URL` during normal development.
- [ ] Backups of prod are isolated from dev and access-controlled.
- [ ] `MONGODB_URI` (if used in prod) follows the same isolation rule.

## How to attest
After every box above is verified, set the deployment secret:

```
PROD_DB_ISOLATION_ATTESTED = "<attester name / date>, verified prod DB isolated"
```

Any non-placeholder value flips the preflight check to `[ OK ]`. Placeholder
values (`no`, `false`, `0`, `todo`, `pending`, `changeme`, empty) are treated as
NOT attested.

> This is an **attestation of a human verification**, not automated proof. Keep the
> completed checklist and evidence (instance IDs, IAM policy screenshots) with your
> compliance records.
