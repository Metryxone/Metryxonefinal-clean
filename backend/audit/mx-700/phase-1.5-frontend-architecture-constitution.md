# CAPADEX 2.0 — Phase 1.5: Frontend Architecture Constitution

> **Execution mode:** ENHANCEMENT-ONLY · establish the permanent Frontend Architecture Constitution. **No rebuild, no rewrite, no new features, no UI changes, no routing changes, no business-logic change.** This `.md` is the only artefact. Repository remains the source of truth.
> **Honesty contract:** *measured* = MEASURED (counts from this repo on 2026-06-28); *judgement* = DERIVED. WCAG/mobile/code-splitting are TARGETS where today's state is a baseline — gaps are flagged, never asserted done. null≠0.
> **Basis:** live `frontend/` audit + Phase 1.2 (Engineering) + 1.3 (Product) + 1.4 (UX) constitutions + memory (`mockup-sandbox-hoisted-deps`, `vite-hmr-mockup-port-hijack`, `build-and-deploy-tooling`, `mx301e-ui-certification-honesty`, `frontend-server-latent-jwt-auth`).

Generated 2026-06-28 · Initiative MX-700 · Phase 1.5.

---

## PART 1 — Current Frontend Architecture Audit (MEASURED)

| Dimension | As-built | Note |
|---|---|---|
| **Framework** | React + Vite + TypeScript | tsx-served backend; frontend on :5000 |
| **Routing** | `App.tsx` **Screen-enum SPA router** as primary nav; `wouter` ^3.9 present | enum-coupled (DERIVED debt); deep-linking limited |
| **Pages** | **68** (`src/pages`) | flagship monoliths (below) |
| **Components** | **541** (`.tsx` under `components`) | incl. 60 ui primitives |
| **UI library** | **60** primitives `components/ui/*` (Radix + Tailwind/shadcn) | single source |
| **Design tokens** | `design-system/tokens.ts` (167 lines) | canonical |
| **Theme** | light/dark via tokens | dark-mode partial |
| **Contexts** | **10** (`createContext`) | auth/theme/etc. |
| **Stores** | **11** (`lib/stores/*`, Zustand ^5) | per-feature |
| **Hooks** | **9** files (`src/hooks`) incl. `useAdminDashboardState.tsx` **3,285 lines** | one giant hook (refactor candidate) |
| **Data fetching** | `@tanstack/react-query` ^5 | cache layer |
| **Forms / validation** | `react-hook-form` ^7 + `zod` ^4 | strong |
| **Charts** | `recharts` ^3 | tokenization varies |
| **Animations** | `framer-motion` ^12 | ad-hoc usage |
| **Tests** | `vitest` ^4 | no Playwright/Storybook in `frontend/package.json` |
| **Code splitting** | only **3** files use `React.lazy`/`lazy(` | major perf gap |

**Monoliths (MEASURED, top files):** `EmployerPortalPage.tsx` 10,160 · `CareerBuilderPage.tsx` 8,754 · `UnifiedParentDashboard.tsx` 5,948 · `UnifiedInstituteDashboard.tsx` 4,742 · `LandingPage.tsx` 3,347 · `useAdminDashboardState.tsx` 3,285 (hook) · `CapadexReportPhase.tsx` 3,230.

**Strengths:** one design system + 60 primitives; modern stack (RHF+zod+react-query+zustand); conversational assessment UI. **Technical debt:** flagship monolith pages/hook; enum routing; near-zero lazy-loading → large initial bundle; chart token drift; inconsistent loading/empty/error coverage. **Duplicate frontend:** dormant `frontend/server` JWT app + archived `client-main-emergent-workzip/` mirror (RETIRE candidates). **Circular deps / monolithic components / large hooks:** present (the monoliths + `useAdminDashboardState`) — refactor *candidates*, not refactored here.

---

## PART 2 — Frontend Philosophy

Frontend exists to **Present · Guide · Educate · Explain · Visualize · Engage.** Every screen communicates **Purpose · Context · Progress · Confidence · Evidence · Recommendations · Next Action.** **Never display information without context.**

## PART 3 — Page Architecture

Audit every page; every page shall contain: Header · Context · Primary Action · Secondary Actions · Progress · Content · Feedback · Footer · Error Recovery · Accessibility · Analytics · Feature Flags · Permissions. New pages compose existing layouts + primitives — never a bespoke page shell.

## PART 4 — Component Architecture

Every component: Reusable · Composable · Small · Independent · Typed · Accessible · Testable · Feature-flag-aware · Analytics-aware · Theme-aware. **Never duplicate — enhance.** Maintain: Component Hierarchy · Dependency Graph · Reusable Library (the 60 primitives) · Business / Presentation / Container split. Monoliths are split by **extraction into existing patterns**, never by forking a parallel component.

## PART 5 — Layout Architecture

Standardize layouts: Public · Authenticated · Assessment · Dashboard · Enterprise · SuperAdmin · Report · Conversation · Learning · Career · Mobile. One layout per context; pages mount into a layout, never redefine chrome.

## PART 6 — Routing Architecture

Document: Navigation · Protected/Public routes · Deep linking · Lazy loading · Breadcrumbs · Navigation guards · History · URL strategy · Feature flags · future evolution. **Honest finding:** primary nav is a Screen-enum (not URL-first) → deep-link/back-button limits; `wouter` is available for a future URL migration. Any routing evolution is additive and Founder-approved — **not done here**.

## PART 7 — State Management Constitution

Audit: React state · Context (10) · Zustand (11 stores) · ~~Redux~~ (none) · react-query cache · Session · LocalStorage · Persistent storage · Feature flags. Document **Ownership · Dependencies · Lifecycle · Synchronization · Performance**. Rule: server state → react-query; cross-component client state → Zustand; ephemeral UI → local state; never duplicate one truth across stores. LocalStorage is a flag-OFF fallback only (memory: tracker keeps localStorage when sync flag OFF).

## PART 8 — Hook Architecture

Audit every custom hook: Purpose · Consumers · Dependencies · Performance · Reusability · Lifecycle · Side effects · duplicate/large hooks · refactor candidates. **Flagged:** `useAdminDashboardState.tsx` (3,285 lines) is a large-hook refactor candidate — decompose into focused hooks, not duplicate it.

## PART 9 — Form Architecture

Standardize: Validation (zod) · Autosave · Progress · Error messages · Accessibility · Keyboard · Mobile · Recovery · Versioning. Reuse RHF+zod everywhere; never hand-roll validation. (Progressive-reveal form: CTA label is an ordered cascade mirroring field reveal — keep that contract.)

## PART 10 — Design System Implementation

Use existing **Design Tokens**; reuse existing primitives. **Never hardcode** Colors · Spacing · Typography · Icons · Shadows · Radius · Transitions. Every UI element inherits from the design system; promote any deliberate secondary palette to a **named token**.

## PART 11 — Table Architecture

Standardize: Sorting · Filtering · Searching · Pagination · Selection · Bulk actions · Export · Responsive · Accessibility. One table primitive family; admin tables paginate reads.

## PART 12 — Chart Architecture

Standardize chart families: Behaviour · Journey · Progress · Career · Learning · Enterprise — all using **color tokens**, accessible (labels/contrast), performant (recharts). Honesty: chart token usage drifts today → unify going forward.

## PART 13 — Dashboard Architecture

Every dashboard composed from **reusable widgets**: Independent · Configurable · Role-aware · Permission-aware · Responsive · Feature-flag-aware. The Unified*Dashboard monoliths are widget-extraction candidates.

## PART 14 — Report Component Architecture

Standardize report widgets: Summary · Behaviour · Evidence · Confidence · Journey · Recommendation · Progress · Benchmark · Subscription · Action cards. **Never duplicate report widgets.** Realizes Living-Report UX (1.4 P10) + Evidence/Confidence (1.3 P24).

## PART 15 — Pragati Frontend Architecture

Standardize: Conversation window · History · Memory · Suggestions · Context · Evidence · Confidence · Actions · Session · Accessibility. One Pragati workspace — enhance the 3-panel shell, never fork.

## PART 16 — Performance Constitution

Audit Bundle size · Chunk size · Rendering · Re-renders · Memoization · Suspense · Lazy loading · Code splitting · Virtualization · Caching · Network requests. **Honest finding:** only 3 lazy-loaded modules → large initial bundle; monolith pages dominate chunks. Code-splitting flagship pages is the highest-leverage perf win (separate approved phase).

## PART 17 — Accessibility Implementation

**Target WCAG 2.2 AA.** Audit ARIA · Focus · Keyboard · Contrast · Announcements · Motion · Forms · Dialogs · Charts. Today: Radix baseline only, no formal audit → **GAP** (not compliant yet).

## PART 18 — Responsive Constitution

Desktop · Tablet · Mobile · Large screens · Touch · Landscape · Portrait · Min/Max width · Adaptive layouts. Responsive baseline exists; first-class mobile NOT verified (GAP).

## PART 19 — Personalization Architecture

Every page supports: Persona · Concern · Journey · Learning · Career · Enterprise · Behaviour · AI context. Personalization keyed on real per-instance data (surface the specific entity), never a coarse bucket.

## PART 20 — Feature Flag Architecture

Every enhancement supports: Feature flags · Progressive rollout · Environment control · Role control · Tenant control · **Kill switch**. Binding: file-registry flags default OFF; flag-OFF path byte-identical incl. schema; flag-gated nav tabs conditional-spread (hidden OFF); security controls use an env kill-switch, not a feature flag.

## PART 21 — Error Architecture

Standardize: Loading · Retry · Timeout · Offline · Recovery · Validation · Empty states · Permission errors · Network errors. A view with **no loading AND no error path is a defect** (mechanically scannable). Never expose technical messages (no stack/DSN leak).

## PART 22 — Animation Constitution

Standardize Transitions · Micro-animations · Loading · Success · Warning · Celebration · **Reduced motion** · Performance — all framer-motion, all honoring `prefers-reduced-motion`.

## PART 23 — Frontend Security

Protect Routes · Sessions · Tokens · Permissions · Sensitive data · Client storage · API calls · XSS · Clickjacking. Binding: identity from verified session/token only (no header-trust bypass); CSRF double-submit (global, mounted first); CSP allowlist maintained; prefer `{value}` over `dangerouslySetInnerHTML`; the dormant `frontend/server` JWT app + archived mirror are security-parity liabilities → RETIRE.

## PART 24 — Frontend Analytics

Support: Page views · Journey progress · Assessment progress · Report usage · Recommendation usage · Pragati usage · Subscription events · Performance · Errors. Honesty: unmeasured = null + note, never 0.

## PART 25 — Frontend Testing

Standardize: Component · Integration · Accessibility · Visual-regression · Performance · Snapshot · Feature-flag tests. Today: vitest present; no Playwright/Storybook in `frontend/` (GAP). Note (memory): vite build is pathologically slow here → validate via esbuild parse + dist-bundle grep, never `pkill`.

## PART 26 — Frontend Documentation

Maintain: Component docs · Architecture · Storybook strategy · API usage · Hook docs · Design tokens · Patterns. SSOT in `docs/*` + memory + replit.md.

## PART 27 — Frontend Quality Gates

Every enhancement verifies: Existing component reused · No duplicate component/page/hook/layout/state · Performance maintained · Accessibility maintained · Responsive verified · Analytics updated · Documentation updated.

## PART 28 — Frontend Review Board

```
Founder[ ] FrontendArchitect[ ] UXArchitect[ ] Product[ ] AI[ ]
BehaviourScience[ ] Accessibility[ ] Security[ ] QA[ ]
Verdict: APPROVE / REJECT — <reason>
```

## PART 29 — Frontend Definition of Done

- [ ] Existing implementation enhanced · [ ] No duplicate frontend · [ ] Existing components/hooks/layouts/stores reused · [ ] Feature flags respected · [ ] Performance maintained · [ ] Accessibility verified · [ ] Analytics updated · [ ] Documentation updated · [ ] No regressions. (Stacks on Engineering DoD 1.2 P24 + Product DoD 1.3 P19 + UX DoD 1.4 P28.)

---

## PART 30 — Deliverables Index

| # | Deliverable | § | # | Deliverable | § |
|---|---|---|---|---|---|
| 01 | Frontend Architecture Constitution | all | 12 | Responsive Constitution | P18 |
| 02 | Frontend Architecture Report | P1 | 13 | Accessibility Constitution | P17 |
| 03 | Component Architecture | P4 | 14 | Feature Flag Architecture | P20 |
| 04 | Layout Architecture | P5 | 15 | Frontend Security Constitution | P23 |
| 05 | Routing Architecture | P6 | 16 | Frontend Analytics Constitution | P24 |
| 06 | State Management Constitution | P7 | 17 | Frontend Testing Constitution | P25 |
| 07 | Hook Constitution | P8 | 18 | Frontend Documentation Standards | P26 |
| 08 | Design System Implementation Guide | P10 | 19 | Frontend Quality Gates | P27 |
| 09 | Dashboard Architecture | P13 | 20 | Frontend Definition of Done | P29 |
| 10 | Report Component Architecture | P14 | 21 | Frontend Review Board | P28 |
| 11 | Pragati Frontend Architecture | P15 | | | |

---

**STOP — Phase 1.5 complete; Frontend Architecture Constitution ready to FREEZE on approval. No frontend changes, no pages redesigned, no components refactored, no architecture rebuilt, no routing modified, no business logic changed.**
Honesty caveats: counts are MEASURED today (68 pages / 541 components / 60 primitives / 11 stores / 10 contexts / 9 hook files / 3 lazy splits) — a prior phase cited "89 pages"; the lower number reflects `src/pages` only (excludes page-like components). WCAG 2.2 AA, first-class mobile, code-splitting, Playwright/Storybook, and monolith decomposition are all **targets/gaps**, enforced going forward via the DoD — none are asserted complete. Routing evolution (enum→URL) and monolith refactors are explicitly out of scope here and require their own approved phases.
