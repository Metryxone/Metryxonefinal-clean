---
name: Audit orphan/duplicate-service detection
description: How to reliably decide a backend module is dead/duplicate before deletion — and why naming/heuristic lists over-report.
---

# Orphan / duplicate detection for repo-cleanup audits

**Rule:** never delete a backend module on the strength of an explore/heuristic "0 importers" or "`-v2` duplicate" claim. Re-verify yourself, `.js`-aware, before any deletion.

**Why:** repeatedly, exploration passes flag "orphans"/"duplicates" that do NOT survive verification. In Phase 2.1, all 17 flagged "orphan" services were actually imported (1–10 importers each); the only true dead artifact was a zero-byte stray file (`DcokerFile`, a misspelled `Dockerfile`).

**How to apply:**
- The codebase imports ESM-style with explicit `.js` extension: `from '../services/foo-engine.js'`. A grep that requires a closing quote right after the basename (`['"/]foo-engine['"]`) returns FALSE all-zeros because the next char is `.`. Match the basename WITHOUT a trailing-quote anchor (e.g. `rg "foo-engine" backend` or `rg "services/foo-engine"`), excluding the file itself + `audit/` artifacts.
- `-v2` ≠ dead. In this repo several `-v2` flags default ON (`advancedCompetencyRuntimeV2`, `adaptiveAssessmentRuntimeV2`, `contextualScoringV2`, `workforceOSV2`) → the `-v2` module is the ACTIVE runtime, and both `-v2` and bare route modules are registered (at different base paths). Confirm the path split before touching either.
- "Logical duplicate" service pairs (e.g. `adaptive-assessment.ts` vs `adaptive-assessment-engine.ts`) usually have DISTINCT importers = specialization, not redundancy.
- Duplicate route registrations in `routes.ts` are real (same method+path twice; first wins, second is dead) but removing them is behavior/security-sensitive when the twins diverge (e.g. public `GET /api/hr/jobs/:id` shadows the auth-gated twin) → approval-gated, not silent.
- Honest outcome > productivity theatre: reporting a near-empty safe-cleanup surface is correct when that's what the evidence shows.
