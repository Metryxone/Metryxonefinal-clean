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

## Match tabs were TWO real bugs, not an evidence ceiling (now 18/19)

Earlier this was misdiagnosed as a "domain-proxy-only / can't fabricate comp_*" ceiling
stuck at 17/19. WRONG — precise `comp_*` levels ARE genuinely producible via the real
scorer once two real bugs are fixed (both fixed; demo lit up honestly):

- **`deriveOptions` only honored `best_option`, but the curated competency MCQ bank
  authors the correct answer as `correct_index`** → `best=-1` → every option scored a
  flat 20 → precise per-competency scores were IMPOSSIBLE (measurement looked "precise"
  but all comps tied). Latent platform-wide scorer bug. Fix: honor `correct_index` as a
  fallback for `best_option`. Then answering the authored-correct option scores 100 via
  the REAL scorer — genuine strong-persona data, not fabrication. Any flat-scored runs
  created BEFORE this fix are meaningless and should be rescored.
- **The harness probes `MX301D_JOB_ID` default `mx301d-probe-job`, NOT `mx301_demo_job`.**
  The org-scoped competency-match route (`/api/v2/employer/competency-match/:c/:j`,
  flags `adaptiveIntelligenceFoundation`+`employerCompetencyHiring`) resolves candidate
  AND job by `employer_id = req.user.id` (super-admin session — no `req.orgId` middleware
  on `/api/v2/employer`). So the probe job must EXIST and be scoped to the elevated org,
  and `computeCompetencyDrivenMatch` derives requirements from the job **title** (via
  `generateRoleDNA`), NOT `matched_role_id` → title must be a recognised role
  (e.g. "Senior Product Manager" → role_pm). Candidate Match (talent-matching) reads
  `employer_candidates.competency_profile` (project the unified comp_* scores into it).

## Honest residual ceiling — the Interview tab (do NOT fabricate to force 19/19)

The genuine 19th-tab gap is **Employer Interview** (`/api/interview-intelligence/job/:j/
candidate/:c/evaluation`), which aggregates PANELIST-entered interview scores/feedback —
operator human-interview data with no genuine source for a demo candidate who was never
interviewed. Forcing it would fabricate interview evidence. Keep it honest
`wired_no_data`; verdict 18/19, not 19/19.

## behavioural-memory snapshot schema drift (unblocks candidate hub)

`/api/career/behavioural-memory/snapshot` failed on two real drifts: a backfill
referencing a phantom `captured_at` (add `created_at` + `COALESCE(created_at,NOW())`)
and a legacy `snapshot_id NOT NULL` with no default (DROP NOT NULL). Both fixes are
idempotent/additive. Separately, `career-intelligence-hub` `getEmail` must fall back
to `req.user.username` — the career-seeker's email is stored there, not on a dedicated
field — or self-session hub summary/trajectory/report return `auth_required`.
