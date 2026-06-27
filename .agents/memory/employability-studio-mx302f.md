---
name: Employability Studio (MX-302F)
description: Flag-gated student Resume/Portfolio/Interview studio — honesty-first AI degradation, byte-identical OFF, reuse-not-rebuild.
---

# Employability Studio (MX-302F)

Net-new consolidated student tab in Career Builder with three studios (Resume / Portfolio / Interview). Flag `employabilityStudio` (env `FF_EMPLOYABILITY_STUDIO`), default OFF.

## Durable decisions / traps
- **Reuse, don't fork.** The Resume studio EMBEDS the existing `ResumeStudio` default export (`components/career/ResumeStudio.tsx`, props `{profile,userId}`, localStorage key `mx-resume-${userId||'anon'}`). The net-new gaps are: durable resume *versions* (was localStorage-only), AI resume analyzer, AI bullet suggestions, LinkedIn review, research/publication portfolio entries, curated Coding Assessment (MCQ + self-review), Group Discussion, interview answer feedback. Existing Resume / Fresher Hub / interview-sim tabs stay untouched (per replit.md "Preserve existing UI").
- **Interview readiness = deep-link, NOT recompute.** The Interview studio's readiness card links into the EXISTING readiness/sim tabs (`simulations`, `hiring-readiness`, `future-readiness`) by calling an `onNavigate?(tabId)` prop wired to CareerBuilderPage's `setTab`. Do NOT rebuild a readiness score here — reuse the canonical surfaces. Tab switching in CareerBuilderPage is `const [tab,setTab]=useState<TabId>(...)` (passed elsewhere as `onTabChange`).
- **Static-fallback panels need their OWN labelled library.** `/resume/suggest-bullets` returns AI bullets (`source:'ai'`) OR, with no LLM key, `source:'static-library'` + empty `bullets[]` + a note. The frontend supplies the static template list itself and badges it "Static template" — the backend never fabricates bullets to fill the gap. Treat `source==='static-library' || aiAvailable===false` as the fallback branch.
- **Coding Assessment is curated MCQ + self-review ONLY — NO execution sandbox** (founder-scoped). Self-review answers are STORED, never auto-graded.
- **AI degrades honestly.** Every AI route tries `aiClient.chatJSON` first; on `AIServiceUnavailableError` returns the rule-based result tagged `source:'rule-based'|'static-library'` + `aiAvailable:false`. UI shows amber banner + per-result provenance badge. Static content is NEVER labelled AI. With no LLM key (current state) ALL AI paths are inert fallbacks.
- **null ≠ 0.** Interview feedback returns `score:null` for <15-word answers ("too short to score"), never fake 0. Portfolio `published_on` stays NULL when unknown.
- **Byte-identical OFF incl. schema.** Flag-OFF → data routes 503 BEFORE auth/DB/DDL (ensure-schema never reached → no tables created). `/enabled` is the ONLY ungated route (returns `{enabled:false}`). Mirrors the campus-placement flag pattern.

## vite-build validation reality (IMPORTANT)
- Full `frontend` `vite build` is pathologically slow in this workspace (>8 min, stuck at "transforming…", frequently exceeds tool timeouts even on a clean first run). Do NOT burn cycles re-running it.
- **`pkill -f "vite build"` / `pkill -f esbuild` will kill YOUR OWN shell (exit 143)** because pkill matches the command string, and killing esbuild also disrupts the backend tsx worker. Avoid broad pkill.
- Reliable validation without a full build: (1) `esbuild` parse-check each changed file (`bundle:false,write:false`, loader tsx/ts) — the exact transformer vite uses; (2) confirm a post-change build wrote `frontend/dist/index.html` (vite writes dist ONLY on success); (3) `grep` the emitted `frontend/dist/assets/` for a unique string from the new component to PROVE it compiled into the production bundle.
- `/tmp/*.log` from backgrounded builds does NOT reliably survive across separate bash tool calls; log to a workspace path (e.g. `.local/fb.log`) and detach with `setsid nohup … </dev/null & disown`.

## Files
- `backend/config/feature-flags.ts` (flag + `isEmployabilityStudioEnabled()`), `backend/migrations/20261215_employability_studio.sql` (3 tables), `backend/services/employability-studio-{schema,engine}.ts`, `backend/routes/employability-studio.ts` (`registerEmployabilityStudioRoutes(app,pool,requireAuth)` on concernsPool).
- `frontend/src/pages/career/EmployabilityStudioTab.tsx`; wired in `CareerBuilderPage.tsx` (TabId `employability-studio`, zone `execution`, `/enabled` probe-gated nav).
- Founder report: `backend/audit/mx-302f/founder-report.md` (+ `build-status.txt`). STOP for founder approval before merge/deploy.
