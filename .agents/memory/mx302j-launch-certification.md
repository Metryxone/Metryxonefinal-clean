---
name: MX-302J Career Launchpad Launch Certification
description: Read-only flag-gated capstone composer certifying the A→I Launchpad phases; four-axis honesty, live-HTTP activation, report-suite composer traps.
---

# MX-302J — Career Launchpad Launch Certification (capstone)

Flag `launchCertification` (`FF_LAUNCH_CERTIFICATION`, default OFF). Read-only composer + a
small report-generator gap fill. Deliverables regenerate to `backend/audit/mx-302j/`
(`00-LAUNCH-CERTIFICATION-VERDICT.md` is the founder verdict; `certification.json` is the machine record).

## Four axes — NEVER composited
Structural (filesystem: flag-defined + backend route file present) ⟂ Activation (live HTTP
`/enabled` probe against the **running Backend API workflow**) ⟂ Adoption ⟂ Outcome-Confidence
(abstains < k_min=30 realized offers). Verdict is **STRUCTURAL-only / PARTIAL** — production-ready
is withheld BY DESIGN until A→I are all merged+activated and outcome confidence is measurable.
null≠0; demo `@example.com` excluded; PII masked.

**Why:** a high structural count must never read as "ready". The honest current state was
8/9 phases merged, 3/9 activated live, outcome ABSTAIN.

**Dev-first activation:** the A→I activation set is 5 dev env flags (`FF_CAREER_LAUNCHPAD`,
`FF_STUDENT_CAREER_BUILDER`, `FF_EMPLOYABILITY_STUDIO`, `FF_INSTITUTIONAL_INTELLIGENCE`,
`FF_ECOSYSTEM_COMMUNITY`) on top of the 3 already in `.replit [userenv.development]`
(`FF_CAREER_DISCOVERY`/`FF_CAMPUS_PLACEMENT`/`FF_LEARNING_PASSPORT_LOOP`). With all 8 ON,
Activation hits its **ceiling of 8/9** — Phase C has no backend flag/route so it can never
report `enabled:true`. Verdict still STRUCTURAL-PARTIAL / not production-ready: outcome still
ABSTAINS (realized offers 0 < k_min=30) and adoption stayed 0 after the flip — live proof that
flags do NOT seed data. Set dev-scope only (prod stays OFF; reverse with `deleteEnvVars` +
Backend API restart).

## Activation must be probed live, not from the cert process env
The composer's own `process.env` FF_* only labels the informational "flag env (this proc)"
column. The TRUE activation axis is the live HTTP `/enabled` response from the Backend API
workflow, whose flags come from `.replit [userenv.development]`. Flags don't seed data, so
dormant pipelines correctly read 0 in adoption/outcome — that's honest, not a bug.

## Phase C (Launchpad Dashboard) — now backend-merged (9/9 structural)
Phase C WAS a frontend-composition gap (no flag, no route → `merged=false`, 8/9). It is now a
real backend surface: flag `launchpadDashboard` (`FF_LAUNCHPAD_DASHBOARD`, default OFF) +
`routes/launchpad-dashboard.ts` (`registerLaunchpadDashboardRoutes`) exposing the ungated
`/api/launchpad-dashboard/enabled` probe + gated `/summary` (read-only widget-availability +
placement-readiness checklist composed from `career_seeker_profiles.data`, mirroring the
dashboard's own `readinessChecks`) + `/telemetry`. The cert's PHASE map for C now points at this
file → structural is 9/9. **Why it's honest, not faked:** the route does real read-only
composition (no DDL, never-throws, null≠0), flag-OFF is byte-identical (503 before auth/DB).
Activation stays a SEPARATE axis — the flag is OFF in the live workflow so `live_enabled=false`
(3/9 activated); structural 9/9 must NOT be read as activated/production-ready.

## vite build is environment-blocked here — validate the real change surface instead
Full `vite build` on these monolith files is pathologically slow / OOM-prone (dies without
finishing, even with `--max-old-space-size=4096`). NEVER pkill (kills own shell), NEVER fabricate
a build pass. For a **backend-only** change set, the build gate is satisfied by: esbuild parse of
each changed `.ts` + intact existing `dist/` (from untouched frontend source) + in-process suite
compose (0 violations) + live HTTP route checks. Confirm zero frontend-source edits before relying on this.

## Mask UUID subjects, not just emails
The launchpad suite subject is a `career_seeker_profiles.user_id` UUID — a raw UUID still
cross-references a live row, so `maskPII` must hash UUID-like ids (and long hex ids) to
`user_<sha256:12>`, not only strings containing `@`.

## tsx / dynamic-import gotchas (cert + temp scripts)
- `tsx -e '...'` fails on top-level `await`, and `/tmp` scripts can't resolve the repo's
  `node_modules` → write temp/cert scripts INSIDE `backend/` and run with `npx tsx`.
- Dynamically importing `report-pack.ts` under tsx returns `{ default: { ... } }` (CJS interop)
  → resolve with `const m = await import(...); const api = m.default ?? m;`.

## Report suite (T002)
`composeLaunchpadSuite` / `validateLaunchpadSuite` / `buildLaunchpadSnapshot` / `LAUNCHPAD_SUITE_NAMES`
in `report-pack.ts` compose 8 named reports (executive_summary, career_recommendations,
employability_index, placement_readiness, resume_intelligence, interview_report, learning_roadmap,
career_passport). The legacy 16-pack `BUILDERS` stays byte-identical. Empty report sections are
HONEST (absent substrate), never fabricated. Route `GET /api/rf/launchpad-suite/:subject`
(report-factory.ts) is auth-before-flag (401 unauth, 503 flag-OFF) with `?export=pdf|csv|json`.

## Outcome-confidence axis substrate (T-247)
The cert's `outcome_confidence` must count **realized prediction-bearing pairs**, NOT a raw
`COUNT(*) FROM offers` (campus offers carry no decision-time prediction → always wrong substrate).
Correct substrate = `validation_loop_outcomes` (hiring/binary/outcome∈{0,1}/pred∈[0,1], demo-excluded)
∪ employer terminal feeder (`terminalCandidatesToPairs`), reported `by_source`. ABSTAIN < k_min(30),
MEASURABLE ≥ 30, `null` when both substrates unreadable (never coerce to 0). `realized_offers` is kept
as coverage-only context. In dev the honest answer is 0 pairs (all 34 employer terminal candidates are
@example.com demo) → ABSTAIN is correct, not a defect; backfills don't reach prod.

## Durable hiring-outcome recording (`services/validation-loop-intake.ts`)
`recordHiringOutcome(pool,{subjectEmail,outcomeValue,predictedProb,refId})` durably writes the realized
{prediction,outcome} pair so the cert can move past ABSTAIN. Flag-gated `validationLoop` (default code-ON
→ fires in the live workflow even without `FF_VALIDATION_LOOP` in the command), never-throws, demo-aware
(`is_demo` from @example.com), idempotent on `ref_id`, keeps prediction only if finite in [0,1] (else NULL
= coverage but not a pair). Wired into employer terminal decisions via `snapshotDecisionProb` in
`employer-portal.ts` (single-PUT + bulk-move share the one helper). `ensureValidationLoopSchema(pool)` is
the single shared schema fn imported by both the intake service and `routes/validation-loop.ts`.
