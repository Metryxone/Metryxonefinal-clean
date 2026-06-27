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

## Phase C (Launchpad Dashboard) is a real structural gap — don't fake it
Phase C is a **frontend-composition** phase: NO flag in `feature-flags.ts`, NO backend route
file. The composer reports it `merged=false` (8/9). Do NOT invent a flag/route to make it 9/9 —
the honest finding is that this phase is not yet backend-merged.

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
