---
name: Phase 2.4 security/compliance/AI-trust remediation
description: Conventions + hard constraints when closing security/compliance/AI-trust gaps in this repo.
---

# Phase 2.4 remediation — durable constraints

**Two-track discipline (do NOT mix):**
- SECURITY controls → default-**ON** + env kill-switch (mirror CSRF: `AI_INPUT_GUARD_DISABLED`, `CSRF_PROTECTION_DISABLED`). NOT a feature flag.
- NEW FEATURES → default-**OFF** feature flag, byte-identical OFF **including schema** (flag-gate returns 503 before any auth/DDL/work; ensure-schema only on flag-ON write paths → 0 tables while OFF).

**Retention enforcement cannot honestly auto-delete accounts.**
**Why:** the canonical `users` table has **no last-activity / last-login column**, so an inactivity-based account purge would be guessing. Retention scheduler (`retentionEnforcement` flag) therefore does SAFE categories only: expire stale consents (reversible), purge expired/used `mfa_codes` >24h (transient), stamp `data_retention_policies.last_executed`, DRY-RUN count `user_data`. Account deletion is deferred to the admin-reviewed erasure flow (`dataSubjectRights`), never automated.
**How to apply:** if asked to "enable inactivity deletion," first add/confirm a real activity signal; don't fabricate one.

**Which gaps are NOT code (bring as owner/legal decision, never do blindly):**
- SEC-H1 prod-DB isolation → owner **attestation** only (`PROD_DB_ISOLATION_ATTESTED` env flips an env-preflight WARN; checklist at `docs/compliance/PROD_DB_ISOLATION_CHECKLIST.md`). Cannot be code-proven.
- SEC-M2 app-layer PII encryption → destructive on populated columns + key-mgmt; register itself notes provider-level encryption is typically acceptable for DPDP/GDPR. Present as decision.
- CMP-F1 RoPA/DPIA/transfer → engineering-authored DRAFTS in `docs/compliance/`, marked DPO-review; CMP-F2 (DPA execution) is legal action.

**Fairness cadence (AI-M2)** just snapshots the EXISTING read-only `fairnessSummary` (pure SELECT over `wos_fairness_results`) on a daily interval into `fairness_report_snapshots` — **no scoring change**. Empty snapshot = honest no-cohort-volume (adoption axis), never fabricated.
