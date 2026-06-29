---
name: Intelligence Automation & Governance (MX-800 2.12)
description: Flag-gated read-only composition tier over MX-700 1.41 + MX-800 2.1–2.11; how OFF stays byte-identical and why the validator is phased.
---

# Intelligence Automation & Governance Orchestration (MX-800 Phase 2.12)

Flag `intelligenceAutomationGovernance` / `FF_INTELLIGENCE_AUTOMATION_GOVERNANCE` (default OFF).
Service `services/intelligence-automation-governance.ts`, route
`routes/intelligence-automation-governance.ts` (BASE `/api/admin/intelligence-automation-governance`),
migration `20261230_intelligence_automation_governance.sql` (2 owned tables
`automation_governance_registry` + `automation_governance_audit_snapshots`).

## Durable lessons

- **Compose, never invoke.** This tier reads the MX-700 1.41 automation getters + MX-800 2.1–2.11
  intelligence getters and composes by file-existence + persisted-output reads ONLY. It must never
  schedule/execute/activate an engine, run business logic, or run a workflow/approval. Honesty ladder:
  `Automation≠Autonomy · Orchestration≠Decision · Approval≠Execution · Workflow≠Business-Logic ·
  Built≠Activated`. `summary.automation_safety` must report decides/executes/autonomous = false.

- **Metrics: 6 SEPARATE measured scores, NO composite.** `automation_effectiveness` and
  `governance_optimization` are honest-**null** (no runtime/outcome evidence to measure them) — null,
  never 0, never estimated. A 2.x tier with no getter (e.g. 2.11 counted as a non-getter tier, `of`=9)
  is encoded as null in the substrate, which is honest, not a failure.

- **Flag-gate ordering & OFF byte-identical incl. schema.** Route gate (503) sits before auth/DDL, but
  the global `/api/admin` auth middleware can 401/403 first → OFF smoke envelope is `{401,403,503}`.
  Writes (discover/register/audit-capture) `assertEnabled()` THEN ensure-schema. **Defense-in-depth:**
  `ensureAutomationGovernanceSchema` *also* asserts the flag internally, so a direct/tooling caller
  can't create schema OFF. Reads use `to_regclass` probe + exact `COUNT(*)`, never DDL. OFF = 0 tables.
  **Why:** the contract is OFF byte-identical *including schema*; a single unguarded ensure-schema call
  silently breaks it.

- **Injection guard before interpolation.** `isSafeTableIdentifier` (exported for unit test) strictly
  validates any user-supplied `physical_table` before it goes into a dynamic `FROM "${table}"` in
  register. Any user-controlled identifier that reaches SQL string interpolation needs this gate.

- **The validator MUST be phased — and the two captures split across runs.** Each heavy getter
  independently re-scans the repo (~30–55s, NO shared substrate memo): governance ~42s, metrics ~47s,
  summary ~55s, workflow ~28s; catalog/approval/event are ~0–150ms. An all-in-one process blows the
  tool timeout. `captureAutomationGovernanceSnapshot` recomputes the summary fresh (~55s) and does NOT
  reuse the memoized summary getter — so two captures = ~110s and cannot run in one budget. Solution:
  `write` phase runs capture #1 and **leaves the tables in place** (no end-drop); `drift` phase runs
  capture #2 against those tables then cleans up. Phase flags: `light,gov,metrics,summary,write,drift`.
  **How to apply:** run `cd backend && env FF_INTELLIGENCE_AUTOMATION_GOVERNANCE=1 npx tsx
  scripts/mx800-2.12-automation-validate.ts <phase>` one (or two cheap) phases at a time under
  `timeout -s KILL 115`; never bundle `summary`+`write`+`drift`.
