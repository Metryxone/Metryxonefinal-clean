---
name: Career OS orchestration engines (P2+)
description: How the additive Career-OS intelligence engines (behaviorGraph, constraintEngine, …) are wired and the gotchas when surfacing them.
---

# Career OS orchestration engines

The Career-OS roadmap (`reports/career-os-architecture-blueprint.md`) adds frontend engines under `frontend/src/lib/intelligence/` that RE-SHAPE already-computed data — they never recompute intelligence, never fetch (except the P2 graph client), and never throw. Each is pure/deterministic/best-effort and degrades to empty when inputs are absent.

## Surfacing gotcha — thread the FULL ctx, not just `brain`
**Rule:** when surfacing an orchestration engine in an existing tab, pass the full available context (e.g. `profile`/`openJobs`/`eiScore`) from the render site, not just `CareerBrain`.

**Why:** these engines branch on `ctx` fields. e.g. `deriveConstraints` only emits the `experience` constraint when `ctx.profile.experience` is present, `execution` stagnation when `ctx.openJobs===0`, and low-EI `confidence` when `ctx.eiScore` is set. If a tab passes only `{ targetRole }`, whole constraint categories silently never fire — no error, just missing output. Architect review caught exactly this.

**How to apply:** `CareerBuilderPage.tsx` already has `profile`/`openJobsCount`/`eiScore` in scope at the tab render site (~line 1225, where `useCareerBrain` is called ~line 1090). Add them as additive optional props on the tab and forward into the engine's `ctx`. Keep props optional so "no data → no behaviour change" still holds.

## Empty-additive-source must reproduce EXACT prior behaviour
**Rule:** when an orchestration engine merges an additive backend source with the pre-existing local one, gate ALL new enrichment on that source being non-empty — when it's empty, emit exactly what the old path emitted (same items, same order).

**Why:** a merge that always appends a second source (e.g. constraint hand-offs alongside weekly actions) silently changes the no-backend-data state — that violates the "no behaviour change when absent" contract even though nothing crashes. Architect review failed P4 for exactly this: with `bestNextActions: []` the unified plan showed weekly+constraints instead of weekly-only.

**How to apply:** branch on the additive source's presence (`backend.length > 0`) before injecting any other enrichment; verify the empty branch's ordering matches the legacy engine (here weekly priority is monotonic in ROI, so it equals the old ROI-sorted list).

## Non-generic outputs are a hard product constraint
Every surfaced item must name the actual signal/skill/value (e.g. constraint `rootCause`), never a generic template. Strengths come from CSI `positive_factors` ONLY — CAPADEX concern signals are diagnostic, never strengths.

## "Activate hidden intelligence" = wire computed-but-unrendered fields, don't recompute
**Rule:** before building anything for an "expose/activate intelligence" request, audit which engine outputs are COMPUTED but never RENDERED — typically the gap is pure UI wiring, not missing logic.

**Why:** the assembled `behaviorGraph` already carried `strengths` + `growthDrivers`, and `UnifiedAction` already carried `impact`/`confidence`/`refs.signals` — none were rendered. The activation was 100% additive UI (cards + an `evidenceText`/`NodeList` helper) plus two pure helpers; zero new engines/APIs/tables. An explore-subagent audit of "computed vs rendered" is the fastest way to find these gaps.

**How to apply:** narrative surfaces (milestones, growth story) belong as pure exported helpers in the EXISTING P5/P6 modules (`deriveMilestones` in progressLedger, `buildGrowthStory` in outcomeAttributionEngine — outcomeAttribution already imports progressLedger, so put any helper needing BOTH there to avoid a circular import). Group milestone/attribution series by `axis::metric`, never by axis alone — a single axis (career) holds multiple metrics and pooling them conflates movements.

## The copilot/Q&A layer (P8) is the LAST re-shape — never a new engine/API
**Rule:** a "career copilot / chat / Q&A over my data" request is satisfied by a deterministic orchestrator that re-shapes the existing P2–P6 outputs into Q&A answers — NOT a new backend, model call, store, or tab. For free-form LLM fallback, inject a grounded brief into the EXISTING chat endpoint (`/api/chat/message`); do not add a route.

**Why:** the user's hard rules are "no duplicate engines/APIs/tables, connect-don't-rebuild, non-generic evidence-backed, no new tab". The copilot owns no data — `CopilotContext` just bundles brain+graph+constraints+actions+ledger+attributions+goals+jobs and each answer carries the 4-part frame (currentState·evidence·recommendedAction·expectedOutcome) + machine `citations`. Mount in the existing "Command Center" (`NextBestActionsTab`) tab.

**How to apply (two architect-caught traps):** (1) **action-matched evidence only** — when projecting "what happens if I do X", filter attributions to ones tied to THAT action (id/title/construct/signal overlap), else fall back to modelled-impact text; a global `filter(positive).slice(0,2)` presents unrelated history as evidence (generic, fails the rule). (2) **clear async-fetched per-user state on `userId` change** — a card that fetches ledger/attributions in `useEffect` must `setX(null)` at the top of the effect, or the previous account's evidence bleeds into the new user's answers until the refetch lands (cross-session leak). (3) ground ALL named sources explicitly — if `jobs`/`goals` are listed grounding sources, the orchestrator must actually consume the arrays (a `jobsLine` naming a real role@company), not just the `openJobs` scalar.
