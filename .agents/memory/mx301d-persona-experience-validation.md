---
name: MX-301D persona experience validation
description: How to honestly prove "one assessment visible everywhere" across all four personas — substrate routing traps and the cross-persona-reach proof.
---

# "One assessment everywhere" cross-persona reachability

A persona-experience validator proves a demo candidate's SINGLE assessment is
reachable across candidate / employer / super-admin / founder personas + their tabs.
The honest verdict is almost always PARTIAL with disclosed gaps — do NOT inflate.

## Substrate-routing traps (the bugs that look like missing data)

- **compute-score reads `cra_scores`, NOT the onto ledger.** An assessment that
  lives in `onto_competency_score_runs` / `onto_competency_profiles` (the canonical
  competency spine) does NOT surface via the candidate self `compute-score` endpoint —
  cra is a separate substrate and compute-score does not backfill from onto. So a
  candidate's own `compute-score` returns `overallScore:0 / totalCompetencies:0`.
  This is an honest **substrate split**, classify it `wired_no_data` with that reason,
  NOT `broken` and NOT fabricated as visible.

- **The real per-candidate admin drill-down is super-admin-only.**
  `/api/career-intelligence/:subject` and `/api/career-readiness/:subject` are
  `requireAuth + requireSuperAdmin`. A candidate self-session hitting them gets 403
  (correct IDOR guard) — they are NOT candidate surfaces. Use them as the SUPER ADMIN
  lens into her assessment.

- **Candidate self-readable surfaces are `/api/career/hub/*`** (requireAuth,
  session-scoped, NO `:id` param). That's the candidate persona's real route map
  (summary / trajectory / report), not the param'd analytical routes.

## Cross-persona "same assessment" proof

**Why:** different persona lenses expose DIFFERENT derived metrics over the same
substrate, so a byte-identical numeric fingerprint across self + admin is NOT expected.
Gating "same assessment" on numeric equality fails honest reachability.

**How to apply:** prove it via (a) ONE coherent onto substrate (runs/profiles row exists)
AND (b) reachability through ≥2 INDEPENDENT persona lenses. Treat a matching numeric
fingerprint, when both lenses are measurable, as an optional STRENGTHENER only.

## Env ceiling

`configureWorkflow` can be blocked (workflow-count limit) → feature flags cannot be
enabled → founder consoles + super-admin Platform Health stay 503. That is an honest
`flag_gated` ceiling, NOT a failure. Read-only harness: only writes are the audit
`.md` files; mask candidate email to `user_<sha256>` in every committed artifact.
(When the flags CAN be set dev-only — `FF_PLATFORM_INTELLIGENCE_CONSOLE`,
`FF_COMMAND_CENTER` — those consoles flip from `flag_gated` to live aggregates.)

## Aggregate-reachability extraction honesty

**Why:** founder/platform consoles return totals in TWO shapes the naive aggregator
misses, so genuinely-reachable tabs read as `wired_no_data` (under-reporting, the
mirror of fabrication): (1) pg `COUNT(*)` comes back as a **string** (`"3"`), and
(2) consoles emit `{ key|label:'total_users', value|count:3, measurable:true }`
metric-objects where the AGG token is in `key/label` and the magnitude in
`value/count`. **How to apply:** coerce numeric strings AND recognise the
metric-object shape, but EXCLUDE `measurable:false` slots so an abstained/null
metric is never counted as present. A genuinely all-zero console (e.g. unified
growth with institutions/employers=0) stays honest `wired_no_data` — never forced.

## "Counted" needs a SUBJECT-specific substrate, not a global flag

**Why:** classifying an aggregate tab as `aggregated` on `globalTotals>0 AND
herOntoRowExists` over-asserts for a console whose true substrate differs (e.g.
report-factory rollup) — it reads as endpoint-shopping. **How to apply:** give such
a tab a parameterised (`$1=subjectId`) COUNT asserting HER OWN rows exist in THAT
store (e.g. `rf_generated_reports WHERE user_id=$1`); it overrides the global flag,
degrades honestly to `wired_no_data` when she has no rows. Also: a config/log
console (`vx/reports/overview` = templates/sections/rules + `report_generation_log`)
never reflects generated reports — repoint to the rollup that counts them
(`/api/admin/rf/stats` → `generated_reports`).

## Honest residual ceiling (do NOT fabricate to force 19/19)

Employer Candidate Match / Competency Match need PRECISE per-competency (`comp_*`)
levels; a demo assessment that carries only domain-proxy / EI data (the common case)
has `evidence_mix.measured=0` against role requirements. That is a genuine ceiling —
forcing a pass would fabricate per-competency evidence she never produced. Report it,
keep verdict PARTIAL at 17/19.

## behavioural-memory snapshot schema drift (unblocks candidate hub)

`/api/career/behavioural-memory/snapshot` failed on two real drifts: a backfill
referencing a phantom `captured_at` (add `created_at` + `COALESCE(created_at,NOW())`)
and a legacy `snapshot_id NOT NULL` with no default (DROP NOT NULL). Both fixes are
idempotent/additive. Separately, `career-intelligence-hub` `getEmail` must fall back
to `req.user.username` — the career-seeker's email is stored there, not on a dedicated
field — or self-session hub summary/trajectory/report return `auth_required`.
