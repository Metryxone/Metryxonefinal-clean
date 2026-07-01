# 08 · Audit Logging Report

## Audit substrates (all PRESENT)
| Stream | Table | Scope |
|---|---|---|
| Admin mutations | `admin_audit_logs` | Mutating super-admin/admin actions |
| Ontology / platform | `platform_audit_log` | Super-admin ontology & config changes |
| Runtime / score events | `capadex_audit_events` | Assessment / scoring runtime events |
| Auth failures | `rbac_failed_logins` | Failed logins (RBAC v2) |
| Feature-flag changes | `rbac_flag_change_log` | DB-table feature-flag mutations |

## Cross-cutting properties
| Property | Status | Evidence |
|---|---|---|
| Unified read trail | **PRESENT** | `backend/services/governance/unified-audit-trail.ts` normalizes the streams into one chronological view. |
| Redaction at write | **PRESENT** | `redactJson` in `backend/services/governance/audit-engine.ts` masks `previous_state`/`newState` before insert; **every** audit insert routes through the shared redactor (no policy bypass). |
| Metadata-only unified read | **PRESENT** | Unified surface exposes metadata only, so legacy unredacted rows can't leak through it. |
| Response-log redaction | **PRESENT** | `redactDeep` (`backend/lib/redact.ts`) on logged response bodies (`backend/index.ts` ~194) — shared policy with DB writers. |
| PII in audit artifacts | **PRESENT** | Audit/measure scripts pseudonymize user emails to `user_<sha256>` before writing committed `.md`. |

## Gaps
- **GOV-L1 (Low):** File-registry feature flags (`backend/config/feature-flags.ts`, changed via code/env) are **not** captured in `rbac_flag_change_log` (only the DB-table flag system is). Change-history coverage of the config-flag surface is therefore partial (see report 09 / GOV-M1).
- **Retention of audit rows:** no automated audit-log retention/rotation policy found (ties to CMP-M2 retention enforcement).

## Assessment
Audit logging is **mature**: multiple purpose-built streams, a unified read trail, write-time redaction on every insert, response-body redaction, and PII pseudonymization in committed artifacts. Change history for **DB-table** flags and admin/auth actions is complete; the residual is **config-flag change history** and a formal **audit-retention** policy. Audit-trail completeness for the governed surfaces is satisfied.
