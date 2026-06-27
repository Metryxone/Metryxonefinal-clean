# MX-302G — Learning Intelligence ↔ Career Passport: Founder Report

_Generated 2026-06-27T06:17:24.546Z · read-mostly (only the feature's own auto-sync writes, to a purged demo passport) · loop flag `learningPassportLoop` (env `FF_LEARNING_PASSPORT_LOOP`)_

## What shipped

- **Unified Learning Hub** — composes existing surfaces (development plan, learning activity, certifications, future-readiness skills, competency development, Learning Behaviour Index) into ONE read-only view. Never throws; `available:false`/`null` is kept distinct from `0`.
- **Learning → Passport auto-sync loop** (the one genuinely-new feature) — completing a learning/development activity emits `LEARNING_ACTIVITY_COMPLETED`; a bus listener auto-runs the existing passport sync bridge + records the activity, replacing the manual **Sync** click.
- **Employer Matches** — the talent-matching engine ranks active roles for the passport owner from their OWN evidence. Match / Fit / Confidence are SEPARATE axes; skill-only evidence stays honestly low-confidence; explicitly NOT a hiring decision.
- **Freshness indicator** — the passport surfaces whether newer learning activity exists than the last sync reflects, with a one-tap refresh.
- **Honest "verified" labelling** — only `is_verified=true AND verification_status='third_party_verified'` is shown as Verified; everything else is Self-declared.

## Byte-identical when OFF

Default OFF. With the flag OFF: `emitLearningActivityCompleted` and `handleLearningActivity` no-op (no event, no sync, no dedup), the gated routes 503 BEFORE auth, and the frontend hides the Learning Hub / Employer Matches tabs and the freshness banner. No shared `cp_*` schema change — idempotency is enforced only on the loop-ON path, so `FF_CAREER_PASSPORT` behaviour is untouched.

## End-to-end certification

| # | Criterion | Status | Detail |
|---|-----------|:------:|--------|
| C1 | Flag OFF → loop is a no-op (byte-identical legacy) | **PASS** | handleLearningActivity returned null with flag OFF. |
| C2 | Flag ON → completion auto-syncs passport (the new loop) | **PASS** | activity_recorded=true · bridge re-sync ran=true (scores=0, competencies=0, learning=0). |
| C3 | Replay is idempotent (no duplicate platform rows) | **PASS** | replay recorded_new=false · history rows for ref=1 (expect 1) · deduped=0. |
| C4 | Auto-sync replaces the manual Sync click | **PASS** | Completion hooks (career-seeker goal complete + growth-plan PATCH completed) emit LEARNING_ACTIVITY_COMPLETED; the registered bus listener runs handleLearningActivity — no user action required. Manual /api/passport/sync remains available. |

## Platform coverage of the loop (REAL users — demo @example.com excluded)

- Non-demo passports: **0**
- Non-demo passports with platform-sourced learning history: **0**

_No platform-sourced learning history on real passports yet — honest empty. The loop is armed; rows appear as real users complete activities with the flag ON in the live workflow (merged code carries the loop, not backfilled rows)._

---

**Honesty contract**: demo rows (`@example.com`) are excluded from every population figure; user identities are pseudonymised; `null`/absent is kept distinct from `0`; the loop never fabricates passport data — it only re-runs the existing sync bridge and records the specific completed activity. PARTIAL/empty states are reported as the honest truth, never inflated.