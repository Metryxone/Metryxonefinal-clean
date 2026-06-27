# MX-600 — Phase 2 Deliverable: Product Enhancement / Optimization Report

**Date:** 2026-06-27 · **Status:** Recommendations only — nothing applied (Phase 2 has no "apply" step; awaiting Founder approval).

> Prioritised by *value ÷ risk*. Each maps to the Founder's enhancement list. P1 = approved-pending quick fixes; P2 = high-value low-risk; P3 = larger/structural.

## Registration Flow
- **R2 fix (P1):** align client password rule to server (≥12) and show the live policy (length + complexity) inline as the user types. Removes the silent server-side rejection.
- **R1 decision (P1):** make partner onboarding actually submit — port `/api/onboarding/register` into the live Node backend (mirror the dormant handler) or redirect the form to a working flow.
- **P2:** consolidate the 7 self-register role variants into ONE adaptive form that reveals role-specific fields after a single "I am a…" choice (reduces 7 code paths → 1 dynamic form).

## Onboarding
- **P2:** add a pre-login "Which product is right for me?" chooser (ties to Phase 1 IA) so a new visitor self-selects the right persona before registering.
- **P2:** per-persona first-run checklist on landing (seeker/student/employer/university) — most dashboards already compute readiness; surface it as guided steps.

## Profile Completion
- **P2:** turn `computeCompleteness` into a visible progress ring + "next best action" CTA on the career home, reusing the existing weighted score (no new engine).

## Progressive Profiling
- **P3:** stage the profile asks over sessions (ask 1–2 highest-weight missing fields per visit) instead of one upfront modal. Drives completion without a wall of fields.

## Dynamic Forms
- **P2:** drive registration + profile fields from a config (role → field set) so adding a persona doesn't fork a component. Foundation for the consolidated form above.

## Contextual Recommendations
- **P2:** at registration/first-login, use the derived `career_stage` to pre-seed the relevant experience (e.g. graduate → Launchpad/Fresher Hub, executive → Executive Studio) and recommend the first 3 actions. Logic already exists in `experience-routing.ts`; surface it.

## Experience Switching
- **Keep as-is (validated correct).** Optional P3: make the switcher discoverable (currently preference-only) with a clear "viewing as" label so users understand it's a view, not a stage change.

## Journey Personalization
- **P3:** persist a lightweight journey state (where the user is in their persona's flow) so returning users resume rather than re-land on a generic dashboard. Reuse existing behavioural-memory rather than a new store.

## Career Stage Detection
- **P2:** when `deriveStage` returns null/low-confidence, prompt a single self-select question rather than silently defaulting — keeps the "null ≠ guess" honesty while improving coverage.

## Routing Intelligence
- **P2 / cross-cutting fix:** change the unknown/absent-role default away from `parent` to a neutral role-selection screen, so mis-tagged accounts aren't dropped into the parent dashboard.

---

## Priority summary
- **P1 (approved-pending, quick):** R2 password-rule alignment · R1 onboarding submit decision.
- **P2 (low-risk, high-value):** product chooser, profile progress + next-action, contextual stage pre-seed, dynamic-form config, stage-detection fallback prompt, fix unknown-role default.
- **P3 (larger):** consolidated adaptive register form, progressive profiling, journey personalization, switcher discoverability.
- **Recommendation:** bundle the P1 fixes + the unknown-role default into one small "Identity & registration hardening" task; file P2/P3 as a "Registration & onboarding UX" task.
