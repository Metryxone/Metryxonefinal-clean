---
name: Audit-log PII redaction + unified trail
description: write-time redaction of audit state blobs + read-only unified trail over the 4 audit substrates
---

# Audit-log PII redaction + unified trail

## Durable rules
- **Redact at WRITE time, never on read.** Read-time redaction leaves PII at rest and
  any other reader still leaks it. The only closure is redacting before the DB insert.
  **Why:** the finding was that DB audit writers persisted state blobs unredacted while
  the stdout logger redacted them.
- **EVERY audit write must route through the shared redactor — no bypasses.** A "100%"
  security-finding closure means zero write paths outside the central control, even if the
  current key policy happens to mask none of a given payload's fields. Reasoning "this
  payload has no maskable keys, skip it" is NOT acceptable for a security closure (it
  silently re-opens as a bypass the moment the payload or policy changes). The shared
  redactor is `backend/lib/redact.ts` (`redactDeep` arrays cap 20 / depth cap 4;
  `redactJson(v,maxLen?)` → string|null, never-throws). **How to apply:** any new
  `INSERT INTO *_audit_*` writing `payload/before/after/previous/new/metadata` must wrap
  it in `redactJson(...) ?? '{}'`.
- **`redactDeep` caps MUTATE shape** (truncate arrays >20 / depth >4). That is acceptable
  for an audit COPY (e.g. CAPADEX `score_computed.score_trace`) because the canonical
  record is persisted elsewhere on the session — bounded audit rows are fine. Do not use
  it where the audit blob is the sole authoritative copy of deep data.
- **A unified read trail must surface METADATA ONLY** (actor/action/category/target/ip/ts),
  never the raw state/payload blobs — otherwise legacy rows written before write-time
  redaction leak through the new reader. Probe each table with `to_regclass` (no DDL),
  guard each source independently, degrade-not-throw.

## Substrate map
Four audit tables, no native single trail: `admin_audit_logs`, `platform_audit_log`,
`capadex_audit_events`, `rbac_failed_logins`. The pre-existing `audit-trail-view.ts`
covered only the first + last (the 2-of-4 gap). The unified composer lives in
`services/governance/unified-audit-trail.ts`; reuse the pure `deriveCategory` from
`audit-engine.ts` for category rollups. `capadex_audit_events` cols:
`id,event_type,user_id,session_id,actor DEFAULT 'system',payload,created_at` (one raw
insert also uses an `event_data` column).
