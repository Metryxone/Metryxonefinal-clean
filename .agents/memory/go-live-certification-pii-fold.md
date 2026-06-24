---
name: Go-Live certification — folded governance detail PII
description: Why a read-only certification composer that folds a governance/audit engine must scrub row-level payloads before embedding.
---

# Folded governance/audit detail leaks PII via BOTH surfaces

A read-only certification composer (MX-106X go-live, MX-105X enterprise) that folds a
governance/audit engine's output (`buildEnterpriseGovernance`, security-center) must NOT
embed the raw engine blob. Those blobs carry `recent[]` row arrays with `admin_user_id`,
`ip_address`, emails — row-level operational telemetry, not aggregates.

**Why:** the folded detail is exposed on TWO surfaces simultaneously — the live API
response served to the frontend AND the committed audit `.md` deliverable. Email-only
masking (the inherited MX-105X regex) does NOT catch UUIDs or IPs, so the committed
report shipped admin UUIDs + IPs and a code review REJECTED it as a privacy leak.

**How to apply:** scrub at the COMPOSER (one fix covers both surfaces), not just the
script. Recursively drop any `recent` key → replace with `recent_count`, and mask a
PII key set (admin_user_id/user_id/ip_address/ip/email/…). Keep a defense-in-depth pass
in the audit script that also masks email + UUID + IPv4 patterns before `writeFileSync`.
Certification surfaces expose AGGREGATE COUNTS only — never row-level audit payloads.
