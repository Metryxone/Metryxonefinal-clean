---
name: O*NET Crosswalk Governance (MX-100X Phase 2)
description: Honesty invariants + activation traps for the onetCrosswalkGovernance subsystem (curated↔O*NET crosswalk review/approve/rollback).
---

# O*NET Crosswalk Governance subsystem

Additive, flag-gated (`onetCrosswalkGovernance`, file-registry flag default OFF), reversible governance layer over the EXISTING crosswalk tables. O*NET is a **reference layer, NEVER a scoring source**. Engine `services/onet-crosswalk-governance-engine.ts`, routes `/api/v2/onet-crosswalk-governance/*`, SuperAdmin panel `superadmin/OnetCrosswalkGovernancePanel.tsx`.

## Honesty invariants (do not regress)
- **Coverage (a mapping exists) and Confidence (it is trustworthy) are SEPARATE axes** — coverage = resolved/total; confidence = band distribution over resolved rows only. Never composite them.
- **Industry abstains**: there is NO role↔industry linkage anywhere, so industry confidence returns `measurable:false`, reason `no_role_industry_linkage`. Never fabricate a role→industry edge to "fill" it.
- **Unlinked-role verdicts via inheritance, never fabrication**: an unlinked `ont_role` is `genuinely_unmappable` when its family has zero linked siblings (can't inherit competency reqs); closing it needs REAL O*NET/ESCO data, never invented links. The big unlinked bucket is family 23 "Military Specific".
- **ont_\* ids are INTEGER, onto_\* ids are TEXT — NEVER coerce.** `entity_ref` on confidence rows is the human-readable onto (TEXT) id; the INT `id` (map_ont_onto_role.id) is the decision `entityId`.

## Write/read discipline
- **GET path is read-only**: probes via `to_regclass`/information_schema/scalar selects, NO DDL. `ensureCrosswalkGovernanceSchema()` runs ONLY inside `recordCrosswalkDecision()` (POST). Flag OFF → byte-identical incl. schema.
- **Decisions are write-once + reversible by provenance**: table `onet_crosswalk_decisions` unique `(entity_type, entity_id)`; `ON CONFLICT DO NOTHING` → `already_decided` (route 409); missing target → `entity_not_found` (route 404). `prior_verified` is stored so rollback restores `map_ont_onto_role.verified` then deletes decisions WHERE provenance=`mx100x_p2_crosswalk`.
- Route gate order: `requireFoundation → requireCrosswalkGovernance(503 OFF) → requireAuth → requireAdmin` (admin only on decisions/rollback). Flag check fires before any auth/DB.

## Frontend wiring
- Route `envelope()` spreads payload at TOP level (`{ok, ...payload, methodology_versions, ...}`) — panel reads `.overview/.confidence/.missing/.unlinked/.duplicates/.decisions/.count/.result` directly, not under `.data`.
- Tab is flag-gated by probing `GET /feature-flag` `res.ok` and conditional-spreading the nav entry (mirror of the `ontHierEnabled` `/sectors` probe) — hides byte-identical when OFF.

**Why:** matches MX-100X honesty-first contract; conflating coverage/confidence or fabricating industry/unlinked edges is the exact failure mode this phase exists to prevent.
