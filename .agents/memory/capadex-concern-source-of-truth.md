---
name: CAPADEX is source of truth for Competency Framework concerns
description: How ont_concerns is fed from CAPADEX (mirror-sync), why authoring is retired, and the FK-preservation rule.
---

The Competency Framework admin's "Concern" entity (`ont_concerns`, surfaced in
SuperAdminDashboard `competency-fw` → Concerns + the Concern↔Indicator/Micro
mapping view) is NOT competency-authored. CAPADEX `capadex_concerns_master`
(~2,489 audited concerns in prod, 0 in dev) is the single source of truth.

**The rule:** mirror CAPADEX → ont_concerns via an idempotent upsert keyed on
`ont_concerns.code = capadex_concerns_master.concern_id` (endpoint
`POST /api/ontology/ont-concerns/sync-from-capadex`). The upsert MUST be
`ON CONFLICT (code) DO UPDATE` (never delete+reinsert), because
`map_micro_concern` and `map_concern_indicator` FK to `ont_concerns(id)` with
`ON DELETE CASCADE` — preserving the SERIAL `id` keeps those links intact.

**Why:** the framework used to seed its own parallel concern list (ontology-seed
§11) which diverged from the audited CAPADEX catalogue. Manual create/edit/delete
of concerns is retired (those routes return 405) and the demo seed is neutralized
so nothing reintroduces a parallel list.

**How to apply / gotchas:**
- `concern_id` is TEXT; `ont_concerns.code` was VARCHAR(40) → widened to
  VARCHAR(120) in ensure-schema (idempotent ALTER). If a future CAPADEX id ever
  exceeds 120, `LEFT(concern_id,120)` could collide-merge distinct concerns — add
  a pre-sync length/collision guard before that becomes real.
- Sync does NOT tombstone ont_concerns rows removed upstream in CAPADEX
  (deliberate FK-safety tradeoff). SoT is not strict for deletions; if strict
  semantics are needed, mark-absent as `is_active=false,status='archived'` behind
  a safety flag — never DELETE.
- Both tables are empty in dev, so the sync is an honest no-op locally (INSERT 0 0);
  it populates in prod. Report `synced`/`capadex_total` honestly, never fabricate.
- The mapping management endpoints are separate and untouched; retiring concern
  PATCH only removes manual status/field edits (status now always 'published' from
  sync), it does not affect mapping CRUD.
