---
name: WC-3 state-capture audit (outcome/journey empty)
description: Auditing why a flag-gated, fire-and-forget post-completion hook produced 0 rows — and the honesty rules that fall out of it.
---

# Auditing empty WC-3 state tables (outcome/journey/stage)

When a `wc3_*_state` table reads 0 rows, do NOT conclude "feature off / not wired" from the row count
alone. The real pattern observed:

- The persistence functions DO exist and ARE wired into `postCompletionHooks` (capadex-enterprise.ts),
  gated by env flags that are actually **ON** in the Backend API workflow command (the registry default
  is OFF, but the running env overrides it — always check the workflow command, not just the registry).
- The hooks only fire on a NEW completion. The state tables that DO have rows (snapshots, decision,
  trends) were populated by dedicated **backfill scripts**, never demonstrably by the live hook. The
  three layers that read 0 (stage/outcome/journey) are exactly the ones with **no backfill script**.

**Honesty rule — never-throws ⇒ two indistinguishable branches.**
`postCompletionHooks` is fire-and-forget and swallows errors. So from data alone you CANNOT prove "the
hook never ran" vs "it ran but wrote nothing / failed silently." An audit must present BOTH branches and
require a single live-completion smoke test to disambiguate. Asserting "never fired" is an overstatement.
A probe that replicates ONLY the gated block (calling the resolvers directly under live flags) proves the
block is **write-capable** — it RULES OUT a defective writer — but it still cannot tell "never fired" from
"hook fired but aborted upstream before the block on a swallowed exception." To split those two you need an
**endpoint-level** completion with entry / pre-block / block telemetry, not a block-only replica.

**Honesty rule — completion timing uses `updated_at`, not `created_at`.**
Completion sets `status='completed'` and bumps `updated_at`; `created_at` is session start. Use
`updated_at` (or an explicit completion event) for "days since last completion" windows.

**Outcome has a real data ceiling on top of the wiring gap.** `resolveSessionOutcomes` writes nothing
(honest UNCLASSIFIED, never fabricated) unless `loadSessionConstructs` finds active constructs:
tier-1 `behavioural_hypotheses` (was empty system-wide), tier-2 `capadex_session_patterns.construct_key`
(column may not exist → tier unavailable), tier-3 crosswalk (flag `FF_WC3_OUTCOME_CROSSWALK`, often OFF)
which UNIONs `primary_construct_key` **and** the concern-bridge-tag construct — so the crosswalk tier is
NOT solely `master_concern_pk`-bound. Report the ceiling under CURRENT flags AND a crosswalk-on upper
bound, contingent on the bridge tag resolving (don't assert resolution you didn't verify).

**Journey has NO data ceiling** — `resolveSessionJourney` always persists a route (deterministic
Mentoring fallback). So 0 journey rows isolates the wiring/backfill gap cleanly. But a journey backfill
yields all-DEGRADED routes (conf ≈ 0.2) while outcome is empty, because journey scores from active
outcome models — lifts coverage, not quality. Don't report that coverage gain as "readiness."

**Audit script discipline:** SELECT-only (+ information_schema), no ensure-schema/DDL, import no
services (raw SQL), derive every narrative number from live queries / the authoritative
`wc3_longitudinal_trends` rows — never hard-code "0.6→0.6"-style figures into the prose.
