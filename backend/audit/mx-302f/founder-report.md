# MX-302F — Resume, Portfolio & Interview Studio — Founder Validation Report

**Task:** #191 (MX-302F) · **Status:** Built behind flag, awaiting founder approval before merge/deploy.
**Flag:** `employabilityStudio` (env `FF_EMPLOYABILITY_STUDIO`) — **default OFF**.

> Per user preference, this additive phase **STOPS for founder approval** before merge/deploy. It is not auto-deployed.

---

## 1. What was built

A NET-NEW consolidated student-facing surface — **Employability Studio** — surfaced as a single new tab in the Career Builder, organised into three studios. It **reuses** the existing surfaces and adds only the genuinely-missing gaps.

| Studio | Reused (unchanged) | Net-new (this phase) |
|---|---|---|
| **Resume** | `ResumeStudio` editor (ATS scorer, cover letter, templates) embedded as-is | Backend **resume versions** (durable multi-draft, was localStorage-only), **AI Resume Analyzer**, **AI Bullet Suggestions** (with labelled static-template fallback), **LinkedIn Review** |
| **Portfolio** | Fresher Hub projects/hackathons remain where they are | Structured **Research** + **Publications** entries (venue/role/authors/DOI/status/date) |
| **Interview** | Behavioural simulations / Hiring Readiness / Future Readiness stay in their own tabs (deep-linked, not rebuilt) | **HR / Technical / Behavioural Q&A practice** (curated tracked question bank → answer-feedback flow), **Interview-readiness surfacing** (deep-links into AI Simulations + Hiring Readiness + Future Readiness), **Curated Coding Assessment** (MCQ + self-review, NO sandbox), **Group Discussion** module |

### Backend
- Flag `employabilityStudio` (default OFF) + helper `isEmployabilityStudioEnabled()`.
- Migration `migrations/20261215_employability_studio.sql` → 3 user-scoped tables: `career_resume_versions`, `career_portfolio_entries`, `employability_interview_attempts`.
- `services/employability-studio-schema.ts` — lazy `ensureEmployabilityStudioSchema` (flag-gated path only) + `employabilityStudioTablesReady` to_regclass probe.
- `services/employability-studio-engine.ts` — PURE rule-based fallbacks + curated content (resume heuristic, LinkedIn checklist, STAR interview heuristic, 8 coding MCQs, self-review prompts, 4 GD topics, MCQ scorer, **HR/Technical/Behavioural interview question bank**).
- Interview Q&A practice now offers three curated tracks (HR / Technical / Behavioural); the **interview-readiness card reuses** the existing readiness surfaces (AI Simulations, Hiring Readiness, Future Readiness) via deep-link rather than recomputing.
- `routes/employability-studio.ts` — `registerEmployabilityStudioRoutes(app, pool, requireAuth)`; wired in `routes.ts` on `concernsPool`.

### Frontend
- `pages/career/EmployabilityStudioTab.tsx` — 3-studio shell + all panels.
- Wired into `CareerBuilderPage.tsx`: TabId, TABS entry (zone `execution`), `/enabled` probe, nav filter, render gate. Existing Resume / Fresher Hub / interview tabs **untouched**.

---

## 2. Honesty guarantees (verified)

| Guarantee | How it holds |
|---|---|
| **AI degrades honestly** | No LLM key is configured. Every AI endpoint tries `aiClient.chatJSON` first; on `AIServiceUnavailableError` it returns the rule-based result tagged `source:'rule-based'` (or `static-library` for bullets) + `aiAvailable:false`. The UI shows an amber banner and a per-result provenance badge (AI-generated / Rule-based / Static template). **Static content is never labelled as AI.** |
| **null ≠ 0** | Interview feedback returns `score: null` (UI: "Not scored — answer too short") for sub-15-word answers, never a fake 0. Portfolio `published_on` stays NULL when unknown. `tablesReady` GETs return empty arrays, never invented rows. |
| **No fabrication** | The resume analyzer reports only what is observable (action verbs / metrics / weak openers / empty sections). Coding self-review is **stored, never auto-graded** — there is explicitly no execution sandbox (founder-scoped decision #1). |
| **Byte-identical OFF** | Flag OFF → every data route 503s **before** any auth/DB/DDL touch (the ensure-schema is never reached → no new tables). `/enabled` is the only ungated route (returns `{enabled:false}`). The new tab is hidden (probe → false). |
| **IDOR-safe** | Every row is user-scoped (`user_id` = session user); all reads/writes filter by it; cross-user access returns 404. |

---

## 3. Validation evidence (flag OFF — current state)

```
GET  /api/employability-studio/enabled            → 200 {"ok":true,"enabled":false}   (ungated probe)
GET  /api/employability-studio/coding-questions   → 503 (flag OFF, before auth/DB)
GET  /api/employability-studio/resume-versions    → 503 (flag OFF, before auth/DB)
GET  /api/employability-studio/interview/questions→ 503 (flag OFF, before auth/DB)
```

- Backend restart clean; routes registered.
- `esbuild` parse-check PASS: `EmployabilityStudioTab.tsx`, `CareerBuilderPage.tsx`, and all 3 backend modules.
- Frontend `vite build`: see `backend/audit/mx-302f/build-status.txt` (regenerated by the validation run).

---

## 4. Founder decision items

1. **Coding Assessment scope** — shipped as curated **MCQ + structured self-review** (no code-execution sandbox), per the task's scoping note. Confirm this is acceptable, or scope a future sandbox phase.
2. **AI activation** — all AI features are inert until an LLM key (`AI_INTEGRATIONS_OPENAI_*`) is configured. Today they return honest rule-based output. Approve key provisioning to light up the AI paths.
3. **Flag flip** — approve flipping `employabilityStudio` ON (dev via `FF_EMPLOYABILITY_STUDIO`, prod via Secret Manager) after review.

---

## 5. How to turn it on (dev)
Set `FF_EMPLOYABILITY_STUDIO=1` for the **Backend API** workflow and restart; the tab appears in Career Builder (Execution zone). Flag-off remains byte-identical.
