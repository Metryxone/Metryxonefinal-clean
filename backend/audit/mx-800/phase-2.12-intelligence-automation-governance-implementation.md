# MX-800 Phase 2.12 — Intelligence Automation & Governance Orchestration Platform

**Status:** Implemented · flag-gated OFF · byte-identical incl. schema · STOP for approval · NO deploy
**Flag:** `intelligenceAutomationGovernance` / `FF_INTELLIGENCE_AUTOMATION_GOVERNANCE` (default **false**)
**Type:** ENHANCEMENT-ONLY (service + migration + 2 owned tables). NO rebuild, NO V2, NO parallel automation platform, NO duplicate workflow engine, NO business-logic change, NO dormant activation.

---

## 1. What this phase is

A read-only **composition** tier that gives the already-shipped automation/governance/intelligence
engines ONE canonical registry + orchestration **view**. It **COMPOSES**:

- **MX-700 Phase 1.41** `platform-lifecycle-automation` getters (governance / policies / quality-gates /
  compliance / orchestration / continuous-validation / automation / metrics).
- **MX-800 Phases 2.1–2.11** intelligence tiers (registry + the reasoning/decision/analytics/enterprise
  intelligence engines) via their existing read-only getters/summaries.

It composes by **file-existence + persisted-output reads only**. It **NEVER** invokes, schedules,
executes, or activates any engine; it never runs business logic; it never executes workflows or
approvals. Repository = SSoT.

## 2. Honesty contract (baked in)

`Automation≠Autonomy` · `Orchestration≠Decision` · `Approval≠Execution` · `Workflow≠Business-Logic` ·
`Recommendation≠Approval` · `Evidence≠Confidence` · `Built≠Activated` · `null≠0` (rendered "—").

- `summary.automation_safety` reports `decides=false`, `executes=false`, `autonomous=false`.
- **Metrics = 6 SEPARATE measured scores, NO composite/overall**: automation_health, governance_maturity,
  automation_coverage, explainability, plus `automation_effectiveness` and `governance_optimization`
  reported **honest-null** (no runtime/outcome evidence exists to measure them — null, never 0, never estimated).
- Human approval mandatory; automation executes only APPROVED workflows; this tier executes nothing.

## 3. Surface

**Service** `backend/services/intelligence-automation-governance.ts` — 10 parts:
catalog (`getAutomationGovernanceCatalog`, 18-capability file-verified catalog),
governance-orchestration, workflow-orchestration, policy-orchestration, validation-automation,
event-orchestration, approval-workflows, observability, validation (STRUCTURAL verdict), metrics
(6 separate scores). Plus `getAutomationGovernanceSummary` (composes all), `explainAutomationGovernance`,
registry getters, and write paths.

**Composition counts (measured):** catalog = **18** capabilities · substrate `of` = **10** ·
governed tiers `of` = **9** (incl. MX-800 2.11 honestly counted as a non-getter tier, encoded null —
not a failure).

**Route** `backend/routes/intelligence-automation-governance.ts` — BASE `/api/admin/intelligence-automation-governance`:
- Reads (gate→auth→superadmin): `/summary`, `/catalog`, `/governance-orchestration`,
  `/workflow-orchestration`, `/policy-orchestration`, `/validation-automation`, `/event-orchestration`,
  `/approval-workflows`, `/observability`, `/validation`, `/metrics`, `/registry`, `/registry/:uid`,
  `/explain/:uid`, `/audit/drift`, `/audit/snapshots`.
- Writes (gate→auth→superadmin): `POST /discover`, `POST /register`, `POST /audit/capture`.
- Probes: `/enabled` (ungated 200 `{enabled:bool}`), `/feature-flag` (gate→auth→superadmin).

**Migration** `backend/migrations/20261230_intelligence_automation_governance.sql` — 2 owned tables:
`automation_governance_registry` + `automation_governance_audit_snapshots`. Lazy
`ensureAutomationGovernanceSchema` mirrors it (canonical mirror, no migration runner).

## 4. Safety properties (how OFF stays byte-identical incl. schema)

- **Flag-gate at the route**: every data/probe route except `/enabled` runs `gate` (503) before auth/DDL.
  The global `/api/admin` auth middleware can return 401/403 *before* the route gate, so the OFF smoke
  envelope is `{401, 403, 503}` — all three prove "not reachable", none create schema.
- **Write paths assert THEN ensure-schema**: `discoverAutomationGovernance` / `registerAutomationGovernanceCapability`
  / `captureAutomationGovernanceSnapshot` call `assertEnabled()` before `ensureAutomationGovernanceSchema`.
- **Defense-in-depth**: `ensureAutomationGovernanceSchema` *also* calls `assertEnabled()` internally, so a
  direct/tooling caller can never create schema while OFF.
- **Reads never write DDL**: read getters use `to_regclass` probe + exact `COUNT(*)`; a missing table →
  `ready:false` / honest empty, never an `ensure-schema` side-effect.
- **Identifier-injection guard**: `isSafeTableIdentifier` strictly validates any user-supplied
  `physical_table` before it is interpolated into a dynamic `FROM "${table}"` in register.
- **OFF = 0 tables.** Verified: flag-OFF HTTP smoke creates zero tables.

## 5. Validation

`backend/scripts/mx800-2.12-automation-validate.ts` — **PHASED** (argv = comma list of
`light,gov,metrics,summary,write,drift`). Phased because each heavy getter independently re-scans the
repo (~30–55s, no shared substrate memo); an all-in-one process exceeds the tool timeout. The two
captures `drift` needs are split: `write` leaves the tables in place (no end-drop), `drift` reuses
them then cleans up.

**Results (flag-ON, all green):**
- `light,gov` → **19/19** (flag-on, static import surface = engines-never-invoked, injection rejection,
  reads-never-write substrate getter creates 0 tables, composition correctness: substrate of=10 / tiers
  of=9 / catalog=18 / 6 metrics no composite / effectiveness+optimization null).
- `metrics` → **5/5**.
- `summary` → **2/2** (automation_safety decides/executes/autonomous all false).
- `write` → **6/6** (discover upserts 18, registry total=18, capture, snapshot readable, EXACTLY 2
  owned tables created vs baseline).
- `drift` → **3/3** (second capture, drift comparable after 2 snapshots, ≥2 snapshots readable, cleanup
  leaves no residue).

**Flag-OFF HTTP smoke:** all reads → 401 (global admin gate), POST → 403, ∈ `{401,403,503}`; 0 tables.

## 6. Code review

Architect (`evaluate_task`, includeGitDiff) → **PASS, no concrete functional or security blocker**.
Confirmed: read-only composition without invoking/activating dormant engines, correct read/write
boundary, flag-OFF byte-identical, schema constrained to exactly 2 tables, injection guard sound, route
wiring correct, validator evidence consistent. Optional suggestion (guard `ensure-schema` internally)
was applied.

## 7. Scope discipline

No frontend (STOP clause). Phase 2.13 is FUTURE — not built. STOP for approval. NO deploy.
