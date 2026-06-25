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
