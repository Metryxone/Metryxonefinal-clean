# CAPADEX 2.0 — Phase 1.2: Engineering Standards & Code Architecture

> **Execution mode:** ENHANCEMENT-ONLY · standardize the foundation. **No code modified, no restructuring, no dormant activation, no business-logic change.** This `.md` is the only artefact.
> **Mandate:** define HOW engineering is performed; recommend improvements **without restructuring code**; technical debt is **documented, not fixed**.
> **Honesty contract:** *measured* = MEASURED; *judgement* = DERIVED. Existing inconsistencies are reported as-found, never papered over. Repository = source of truth.
> **Basis:** Phase 0 / 0.1 / Constitution capability report + fresh MEASURED tooling/structure scan (2026-06-28).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.2.

---

## PART 1 — Engineering Architecture Audit (as-built)

| Layer | As-built architecture | Verdict |
|---|---|---|
| **Frontend** | React 19 + Vite, SPA via `App.tsx` Screen-enum router (1,050 lines), Zustand + @tanstack/react-query, 60 shadcn/ui primitives, design tokens | Coherent; weakened by monolith pages |
| **Backend** | Node/Express on **tsx** (no compile step in dev/prod), 303 route modules + 432 service files, direct route→service calls (no controller/repository layer) | Coherent layering; `routes.ts` hub is a coupling risk |
| **Database** | Postgres (Drizzle ORM) primary + Mongo secondary; migration files **+** lazy `ensure*Schema()` mirrors (no migration runner) | Works; dual-source = drift risk (documented) |
| **API** | REST, session+CSRF, `requireAuth`/`requireSuperAdmin`, additive-flag 503-before-auth | Strong, consistent |
| **AuthN/Z** | Session (PG-backed) + always-2FA super-admin; per-framework admin gate (lowercased classifier) | Strong |
| **AI** | OpenAI/Whisper/HeyGen, key-gated, degrade-to-null; **prompts inline, no registry** | Functional; no observability/versioning |
| **Assessment / Behaviour / Decision** | Ontology-driven spine; decision layer flag-ON but DORMANT (no default-path data) | Core strong; decision unactivated (out of scope here) |
| **Reporting** | report-pack + pdfkit + benchmark/viz resolvers, k=30 suppression | Strong |
| **Subscription** | packages CRUD + entitlement (fail-closed); Razorpay (e2e unverified) | Partial |
| **SuperAdmin** | One dashboard, 230 panels, 60s cache, `?refresh=1` | Strong, single system |
| **Analytics / Event / Integration / Config / Flags** | Aggregators (null≠0), adaptive event bus, in-process jobs, env+two flag systems | Consistent; see Parts 10/12/15 |

**Architectural inconsistencies identified (MEASURED):**
1. **Backend run vs build mismatch** — `dev:server` = `npx tsx index.ts` (no typecheck); a `build:server` (`tsc -p server/tsconfig.build.json`) exists but prod runs on tsx (memory `build-and-deploy-tooling.md`). → typing is *uncompiled* at runtime.
2. **Two flag systems** (file registry + DB) — intentional but ambiguous to newcomers.
3. **Split stage taxonomy** (BE 5-stage vs FE `CAP_*` 4-code) and **two `question_type` vocabularies** — bridged, not unified.
4. **Migration & seed location split** (see Part 2).

---

## PART 2 — Codebase Organization (audit; recommend, don't restructure)

**MEASURED top-level structure:**
- **root:** `backend/ backend-main/ frontend/ docs/ scripts/ shared/ migrations/ audit/ exports/ memory/ reports/ attached_assets/`
- **backend/:** `routes/ services/ lib/ models/ db/ drizzle/ migrations/ config/ data/ seed/ seeds/ scripts/ shared/ tests/ audit/ replit_integrations/`
- **frontend/src/:** `components/ pages/ hooks/ contexts/ lib/ design-system/ shared/ modules/ data/ locales/ styles/ assets/`

| Finding | Evidence (MEASURED) | Recommendation (no code move now) |
|---|---|---|
| **Strengths** | Clear layer separation; `design-system/` + `components/ui/`; `lib/` pure engines; `shared/` symlinked schema | Keep; codify as the canonical layout |
| **Duplication: `seed/` vs `seeds/`** | `backend/seed` (1 file) **and** `backend/seeds` (2 files) | Standardize on **one** (`seeds/`); document, migrate in a later cleanup phase |
| **Split migrations** | `backend/migrations` (218) **and** root `migrations/` (2) | Declare `backend/migrations` canonical; document the 2 root files |
| **`shared/` in 3 places** | root `shared/`, `backend/shared` (symlink target), `frontend/src/shared` | Document the symlink contract (already in replit.md); don't touch |
| **Monoliths** | `routes.ts` 14,464 · `EmployerPortalPage` 10,160 · `CareerBuilderPage` 8,754 | Mark as refactor-candidates (Part 18); additive split only |
| **Circular dependencies** | NOT formally measured (no madge/dep-graph run) | Add a dep-graph check as a future quality gate — recorded as **unknown**, not "none" |
| **Unused folders/modules** | `frontend/server` (latent JWT app), `client-main-emergent-workzip` mirror | RETIRE candidates (Constitution report); not removed here |

---

## PART 3 — Coding Standards (canonical naming)

| Artefact | Standard (codifies the dominant existing pattern) | Drift found (MEASURED) |
|---|---|---|
| Backend files / routes / services | **kebab-case** `.ts` (e.g. `capadex-concern-intelligence.ts`) | ⚠ `services/aiClient.ts`, `services/aiTestGenerator.ts` are **camelCase** → non-conforming |
| React components | **PascalCase** `.tsx` (`FreeAssessmentModal.tsx`) | conforms |
| Hooks | **camelCase `use*`** (`useCareerBrain.ts`) | conforms |
| Contexts | **PascalCase `*Context`** | conforms |
| Stores (Zustand) | **camelCase `*Store`** in `lib/stores/` | conforms |
| API paths | **kebab-case, plural nouns, `/api/<domain>/...`** | conforms |
| DB tables/columns | **snake_case**, prefix-namespaced (`onto_`, `capadex_`, `pil_kg_`) | conforms; legacy `competency_*` shells documented |
| Migrations | **`YYYYMMDD_<domain>.sql`** | conforms |
| Env vars | **SCREAMING_SNAKE** (`DATABASE_URL`, `ZOHO_EMAIL`) | conforms |
| Feature flags | **`FF_SCREAMING_SNAKE`** (code) + camelCase registry key | dual-vocabulary documented |
| AI prompts | **none today** → propose `domain.purpose.vN` keys | MISSING (Part 8) |
| Reports | **`compose<Name>Suite` / `<name>-report`** | conforms |

**Rule:** new files adopt the canonical pattern; the two camelCase service files are flagged as **low-priority debt** (rename only in a dedicated cleanup phase — renaming now would touch imports = restructuring, forbidden here).

---

## PART 4 — Frontend Engineering Standards

- **Pages:** one screen per page; register in `App.tsx` Screen enum; flag-gate additive screens (conditional nav spread to hide OFF).
- **Composition:** base (`components/ui/`, 60 primitives) → shared business (`components/career/`, `assessment/phases/`, `superadmin/*`) → feature → page. Never inline-duplicate a primitive.
- **State:** local → `useState`; cross-component → **Zustand** (`lib/stores/`); server cache → **@tanstack/react-query**. No Redux (none present — don't add).
- **Forms/validation:** `components/ui/form.tsx` + field primitives; validate client-side, never trust client for authz.
- **Tables/charts/dialogs/modals:** use `ui/table`, `ui/chart`, `ui/dialog`, `ui/drawer` — do not hand-roll.
- **Loading/empty/error states:** mandatory for every data view (`LazyImage`/`LazySection`/`empty.tsx` exist); a view with **no loading AND no error** path = defect (memory `mx301e-ui-certification-honesty.md`).
- **Accessibility/responsive:** Radix baseline only today → see Part 15 (formal WCAG is a GAP).
- **Hard rule:** never edit the protected monolith cores (`CompetencyDashboard`, `GapAnalysisPage`, `CareerBuilderPage` core, `TrajectoryDashboardPage`) — additive new surfaces only (replit.md constraint).

---

## PART 5 — Backend Engineering Standards

- **Routes:** kebab-case module per domain; **register literal sub-paths BEFORE `/:id`** (memory `express-literal-vs-param-route-order.md`); new route → restart `Backend API` before smoke.
- **Services/engines:** pure where possible (`lib/engines/`, `lib/intelligence/`); **never-throws** read engines (return null, not exception); compose, never recompute.
- **No controller/repository layer** — document this as the **accepted** pattern (route→service). Do not introduce one (YAGNI).
- **Middleware order (canonical):** CSRF (first) → session → rate-limit → auth → flag-gate (503-before-auth) → handler.
- **Validation:** Zod via `lib/validate` (pure gate, never mutates `req`, never-throws) — mark required ONLY fields the handler already requires.
- **Caching:** 60s admin cache + `to_regclass` table probes; no Redis (in-process) — don't add without scale evidence.
- **Logging/exceptions:** see Parts 11–12.
- **Background work:** in-process `setImmediate` (fire-and-forget) / `setInterval` only — **no cron/queue** (Part 15); fire-and-forget writes must be **polled**, never awaited inline.

---

## PART 6 — Database Engineering Standards

- **Extend only** — never DROP/DELETE/break relationships (Constitution + platform canon).
- **Naming:** snake_case, prefix-namespaced; **never** bare `kg_*` (collides with live graph → `pil_kg_*`).
- **Master vs transactional vs history vs audit:** history tables are **append-only** (`p4_competency_history`, `m3_*/m5_*` never mutated in place); audit rows redacted **at write**.
- **Migrations:** canonical dir `backend/migrations/` (`YYYYMMDD_<domain>.sql`); every newer table has a migration **and** a lazy `ensure*Schema()` mirror — **the two must stay in lockstep** (drift = the #1 DB debt; propose a parity-assertion gate).
- **Indexes/constraints:** add via migration; beware CREATE TABLE+index on a missing column silently breaking the schema promise (memory `occupation-seed-self-contained.md`).
- **Soft delete:** reversible = mark `inactive`, **never** physical DELETE (memory `employer-job-store-projection.md`).
- **Audit columns:** prefer `created_at`/`updated_at` on new tables.
- **Type traps to standardize against:** `users.id` is varchar; some keys are email-based; pg `COUNT()` returns **strings** (Number() before compare); never coerce NULL→0.

---

## PART 7 — API Engineering Standards

- **REST**, kebab plural nouns, domain-scoped base.
- **Versioning:** extend response models additively; version (`/v1`) **only when a contract break is unavoidable** (a `/api/v1` rewrite already exists — CSRF canonicalizes it).
- **Response/error models:** consistent JSON; engines return null + explicit note for unmeasurable values (Coverage⟂Confidence kept separate, never composited).
- **Validation:** Zod gate (Part 5).
- **Pagination/filter/sort:** large reads paginated (question registry pattern); filters server-side.
- **AuthZ:** `requireAuth` (+`requireSuperAdmin` for admin); IDOR guard via server principal / `resolveEffectiveUserId` (never trust `x-user-id`).
- **Rate limiting:** sliding-window on auth routes (always-on); CSRF 403s before the limiter (test with a token).
- **Flag-gating:** additive endpoints **503-before-auth** when OFF, byte-identical.
- **Docs:** every new endpoint documented in the relevant `docs/*` SSOT (Part 17).

---

## PART 8 — AI Engineering Standards

| Concern | Current | Standard going forward |
|---|---|---|
| Prompt management | **inline, no registry** (112 files mention prompt, 12 system prompts) | Propose a **prompt registry** (`domain.purpose.vN`, additive, flag-gated) — EXTEND, not a parallel AI system |
| Memory | dual store (DB `behaviour_memory` + in-memory `career-memory`) | Keep dual; document lifetimes |
| Context/evidence/confidence | deterministic confidence; Coverage⟂Confidence | Always separate; abstain < k_min=30 |
| Reasoning/explainability | insight-explainer, Pragati FSM | Improve in place (Pragati), never fork |
| Fallback | degrade-to-null without keys; deterministic Pragati fallback | Mandatory: AI-inert = null, never fabricated |
| Versioning/observability/eval | **MISSING** | Propose prompt versioning + eval harness (future phase) |
| Language policy | dev-signals only, allowed/disallowed term lists | Mandatory on every AI envelope |

---

## PART 9 — SuperAdmin Engineering

- **One admin system** (`SuperAdminDashboard.tsx`, 230 panels) — never a second.
- **CRUD/permissions:** `requireAuth + requireSuperAdmin`, 60s cache, `?refresh=1`; per-framework admin gate covers `/api/<fw>/admin/*`.
- **Approval workflows:** human approval is the **only** coverage-changing op (Question Factory); status transitions human-only.
- **Audit trails:** write-time redaction via shared `redactJson`; unified read = metadata only.
- **Feature flags:** file-registry flags absent from `/api/admin/feature-flags` → probe gated endpoint `res.ok`; conditional-spread nav tab to hide OFF.
- **Dashboards/monitoring:** Mission Control / Platform Intelligence compose existing engines; never re-issue ad-hoc SQL that recomputes (drift).

---

## PART 10 — Configuration Management

- **SSOT:** `docs/ENVIRONMENT.md` (required vs recommended vs optional, per service).
- **Secrets:** Secret Manager (prod) + env preflight FATAL on missing required (`SESSION_SECRET`, `DATABASE_URL`); deployment-pane secrets invisible to repo grep — never "confirm absent" from `.replit` alone.
- **Runtime config:** thresholds/weights centralized (k_min=30, readiness bands, FRI weights, scale 0–100).
- **Flags:** two systems (file `config/feature-flags.ts` + DB `feature_flags`) — pick by scope; toggling beyond the `.replit` workflow-count limit uses dev-only env vars (`envOverride`).
- **AI/subscription config:** keys gated; entitlement reads fail-closed.

---

## PART 11 — Error Handling Standards

| Class | Standard |
|---|---|
| Client (4xx) | explicit status + JSON message; 401 unauth, 403 wrong-role, 503 flag-OFF (before auth) |
| Server (5xx) | never leak internals (no `e.message` in health probes → DSN leak risk) |
| Validation | Zod gate returns structured 400; valid clients never break |
| AI errors | degrade to null + source tag; never fabricate |
| Database | never-throws read engines return null; writes fail-closed (commerce) |
| Network/integration | honest-503 when integration unconfigured (Twilio/Whisper/HeyGen) |
| Recovery | fire-and-forget retried/polled, not awaited; idempotent writes (ON CONFLICT) |

---

## PART 12 — Logging Standards

| Log type | Current | Standard |
|---|---|---|
| Application | workflow console | structured prefix per subsystem |
| Security | login/lockout/MFA events | always logged; `[DEV MFA]` non-prod only, never in HTTP response |
| Audit | `admin_audit_logs`, redacted at write | every audit insert routes through `redactJson` |
| AI | minimal | add prompt-id + model + latency (with registry) |
| Performance | none structured | add timing on slow paths (Part 13) |
| Database | none structured | log migration/ensure-schema drift |

---

## PART 13 — Performance Standards

**MEASURED debt:** entry bundle 1,618 KB · CareerBuilderPage 1,231 KB · EmployerPortalPage 1,157 KB · vendor-pdf 748 KB. Backend = single JS thread (~1 core).

| Area | Standard / target |
|---|---|
| Bundle | initial < 500 KB; code-split flagship pages (lazy import) |
| Rendering | virtualize long lists; memoize heavy trees |
| API latency | p95 budget per endpoint; cache admin reads (60s) |
| DB queries | `COUNT(*)` not stale stats; index hot paths; avoid N+1 |
| Memory | bounded in-process caches; clean blob URLs on unmount |
| Network | batch; relative URLs; avoid waterfall fetches |
| Benchmarking | no load tool present → write a Node http harness; measure from `dist`, not Vite |

---

## PART 14 — Security Standards

AuthN session+always-2FA · AuthZ requireAuth/requireSuperAdmin + per-framework gate (lowercased classifier) · Encryption: TLS in prod, scrypt password hashing (`crypto.hash()` does NOT exist) · Secrets in Secret Manager + fail-fast in prod · Roles/permissions RBAC v2 · Session mx.sid · **CSRF** signed double-submit (default ON, mount-first, fail-closed) · **XSS** escape every user/AI interpolation in `email.ts`/HTML; prefer `{value}` over `dangerouslySetInnerHTML` · **Injection** parameterized SQL, cast each `$N` (pg "inconsistent types" trap) · rate-limit auth routes · CSP allowlist (Razorpay/Fonts/YouTube/blob) + kill-switch. **Open:** Razorpay + MFA e2e unverified; `frontend/server` JWT hardcoded secret (dormant) — RETIRE candidate.

---

## PART 15 — Accessibility Standards

**Current:** Radix-based primitives give baseline keyboard/focus/ARIA; **no formal WCAG audit, no automated a11y tests** (MEASURED gap). **Standard going forward:** WCAG 2.1 AA target — keyboard nav on all interactive elements, visible focus states, ≥4.5:1 contrast (already a report-tone rule), screen-reader labels, responsive at standard breakpoints. Recorded as a **GAP to close in a dedicated phase**, not asserted compliant.

---

## PART 16 — Testing Standards

**MEASURED:** backend **62 `*.test.ts`** (mostly `tests/` + bespoke runner scripts; runner = `tsx`, not a unit framework — `test:isolation` etc.); frontend **12 `*.test.tsx`** on **Vitest** + **Playwright** (`@testing-library/*` present); 0 `*.spec.ts`.

| Layer | Current | Standard |
|---|---|---|
| Unit (FE) | Vitest present | new components ship a test where logic is non-trivial |
| Unit/integration (BE) | tsx scripts + 62 tests | keep script-style harnesses; new engines get a deterministic test (memory: prove ordering, not a tautology) |
| API | HTTP harness pattern (session+CSRF) | reuse the employer-e2e harness pattern |
| E2E | Playwright + testing skill | run for large/complex changes |
| AI | none | add eval harness with prompt registry |
| Regression/a11y | ad-hoc | add a11y tests with Part 15 work |
| **Gate reality** | backend has **no typecheck/coverage gate** (tsx) | the only real launch gate is **frontend vite build** — don't add a backend tsc gate (memory `build-and-deploy-tooling.md`) |

---

## PART 17 — Documentation Standards

Every enhancement updates the relevant **single source of truth** (never duplicate docs):
- Architecture/namespaces/migrations/deep-links → `docs/phase-history.md` (Phase Index Tables).
- Subsystem docs → `docs/CAPADEX.md`, `docs/CAREER_BUILDER.md`, `docs/COMPETENCY_ASSESSMENT.md`, etc.
- Env → `docs/ENVIRONMENT.md`. Durable engineering lessons → `.agents/memory/*` (read before touching a subsystem).
- Audit deliverables → `backend/audit/<phase>/`.
- Served docs single-sourced via symlink in `frontend/public`, never parallel copies.
- `replit.md` = project README + user preferences (keep condensed, detail lives in `docs/`).

---

## PART 18 — Technical Debt (document only — do NOT fix)

| Priority | Debt | Impact |
|---|---|---|
| **High** | FE monoliths (routes.ts 14,464; EmployerPortalPage 10,160; CareerBuilderPage 8,754) | maintainability/test |
| **High** | Bundles >1 MB | first-load perf |
| **High** | Razorpay + MFA e2e unverified | revenue/security risk |
| **Medium** | Migration ↔ ensure-schema drift risk | data correctness |
| **Medium** | `seed/` vs `seeds/` + split migration dirs | ambiguity |
| **Medium** | No shared ESLint/Prettier config (none found) | style drift |
| **Medium** | Backend uncompiled (tsx) — no typecheck gate | latent type errors |
| **Medium** | camelCase service files (`aiClient.ts`, `aiTestGenerator.ts`) | naming drift |
| **Low** | 536 flag tokens — cognitive load | onboarding |
| **Low** | `frontend/server` JWT app + archived mirror | dead/duplicate code |
| **Unknown** | Circular deps (not measured) | add dep-graph gate to find out |

---

## PART 19 — Quality Gates (verify before EVERY future phase)

- [ ] No duplicate code / services / APIs / components / **tables** (no `*V2`/`New*`).
- [ ] No breaking change; backward compatibility maintained.
- [ ] New capability is **flag-gated**, flag-OFF byte-identical (incl. schema).
- [ ] Migration **and** ensure-schema mirror updated in lockstep (if DB touched).
- [ ] Literal routes registered before `/:id`; `Backend API` restarted before smoke.
- [ ] Engines never-throw; null≠0; Coverage⟂Confidence not composited.
- [ ] User/AI text escaped; SQL parameterized; authz server-side (IDOR guard).
- [ ] `docs/*` SSOT + `.agents/memory/*` updated; `replit.md` condensed.
- [ ] Frontend vite build passes (the real launch gate).
- [ ] 10-point pre-coding plan produced and Founder-approved.

---

## PART 20 — Deliverables Index

| # | Deliverable | Section |
|---|---|---|
| 1 | Engineering Standards Manual | this document (Parts 3–17) |
| 2 | Code Architecture Report | Parts 1–2 |
| 3 | Technical Debt Report | Part 18 |
| 4 | Naming Convention Guide | Part 3 |
| 5 | Repository Organization Guide | Part 2 |
| 6 | Frontend Standards | Part 4 |
| 7 | Backend Standards | Part 5 |
| 8 | Database Standards | Part 6 |
| 9 | API Standards | Part 7 |
| 10 | AI Standards | Part 8 |
| 11 | Security Standards | Parts 14–15 |
| 12 | Testing Standards | Part 16 |
| 13 | Documentation Standards | Part 17 |
| 14 | Quality Gate Checklist | Part 19 |

---

**STOP — Phase 1.2 complete. No business logic modified, no workflows redesigned, no dormant capability activated, no repository restructured.** Standards established only.
Honesty caveats: circular-dependency and asset-dedup scans were NOT run (recorded as *unknown*, not "clean"); backend strict-typing not independently verified (extends root `tsconfig.json`); naming/structure drift items (`seed`/`seeds`, camelCase services, split migrations) are documented for a future dedicated cleanup phase, deliberately **not** fixed here.
