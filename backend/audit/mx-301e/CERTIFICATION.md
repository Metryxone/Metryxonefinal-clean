# MX-301E — UI/UX Enterprise Certification

**Platform:** MetryxOne — Behavioral Intelligence SaaS (React + Vite frontend, Node/Express backend)
**Scope:** Entire platform, all 4 personas (candidate · employer · super-admin · founder)
**Method:** Honesty-first. Objective static scan (`scan.json`) + live visual spot-check + build gate.
**Mandate:** Audit + fix CLEAR defects. No sweeping redesign. No deploy. Report honest ceilings.

---

## 0. Honesty ceiling (read first)

This is **not** a pixel-perfect per-screen sign-off of all 621 `.tsx` files. It cannot be, in one
task, and claiming so would be dishonest. What this certification *is*:

- **Objective, reproducible static scan** of all 621 component files (`scan.json`) for
  mechanically-verifiable defect classes (palette divergence, missing alt text, fixed-width
  overflow risk, state-handling presence, dev-placeholder classification).
- **Live visual review** of the public entry surface (marketing/landing), which is the highest-
  traffic first impression.
- A **prioritized defect register** separating *clear defects fixed this task* from *findings that
  require a product/design decision* (and therefore were deliberately NOT changed unilaterally).

**What this certification does NOT cover (honest gaps):**
- Authenticated deep screens for each persona were not individually screenshotted — they require
  per-persona login/seeding flows beyond this task's budget. They are assessed via the static scan
  + shared-primitive usage, not pixel review.
- True device emulation (mobile/tablet/desktop) was assessed via **responsive-utility presence in
  code**, not by rendering at each breakpoint. The preview pane cannot be resized programmatically
  here.
- "Loading/empty/error state present" is a **heuristic** (keyword/branch detection). It flags
  *candidates*, and is known to produce false positives (a screen may receive state from a parent,
  or use a pattern the heuristic doesn't recognize). Counts below are review candidates, not proven
  defects.

---

## 1. Overall verdict

**Grade: B+ (Enterprise-ready core, with consistency debt).**

The platform has a **real, well-formed design system** (`design-system/tokens.ts` + `styles/index.css`
+ shadcn primitives in `components/ui/*` + domain primitives in `components/career/*`, including
shared Loading/Empty/Error states and custom Radar/Heatmap/Timeline/Gauge visualizations). The public
marketing surface is genuinely enterprise-grade (clean brand, strong typography, polished data cards).

The gap to "A" is **consistency debt**, not brokenness:
- Brand color is **redefined inline in 249 files** instead of imported from the single token source,
  and **~48 of those diverge** into 4 secondary palettes.
- A **dual typography canon** existed (TS token said Inter; CSS canon is Plus Jakarta Sans).
- State-handling (loading/empty/error) is **inconsistently applied** across data screens.

None of these break the product; they erode the "single cohesive system" enterprise bar.

---

## 2. Per-dimension findings (against the requested checklist)

| Dimension | Grade | Evidence / Notes |
|---|---|---|
| Navigation | A− | Consistent top-nav + persona dashboards; route inventory via `App.tsx` Screen enum. |
| Layout | B+ | Card/grid system consistent; 16 files use ≥600px fixed widths (mobile-overflow risk — review). |
| Branding | B− | **5 competing primary palettes** (see §3). Canonical `#344E86` dominates; 48 files diverge. |
| Typography | B+ (was B−) | **Fixed:** TS token now matches CSS canon (Plus Jakarta Sans). Inline `Inter` fallbacks remain (harmless). |
| Colors | B | Canonical palette good; chart palette centralized in `CHART`. Divergence tied to branding finding. |
| Cards | A− | `MetricCard`/`InsightCard`/`SectionCard` + shadcn `card` widely used and consistent. |
| Charts | A− | Recharts via `ui/chart.tsx` wrapper; consistent. `vendor-charts` chunk 447kB (perf note, not defect). |
| Radar / Heatmap / Timeline | A | Custom SVG `RadarChart`, `CompetencyHeatmap`, `GrowthTimeline`, `EIGauge`, `TrajectoryMap`, `HeatMap` — purpose-built and on-brand. |
| Empty states | B | `ui/empty.tsx` + `career/EmptyState.tsx` exist; ~106 data-screen candidates lack a detectable empty branch (heuristic). |
| Loading states | B | `ui/skeleton`, `ui/spinner`, `career/LoadingState` exist; ~156 data-screen candidates lack a detectable loading guard (heuristic). |
| Error states | B | `career/ErrorState` + `ui/alert` exist; ~118 data-screen candidates lack a detectable error branch (heuristic). |
| Accessibility | A− | **0 `<img>` missing `alt`** across the whole codebase (clean). Icon-button aria coverage not exhaustively verified. |
| Mobile / Tablet / Desktop | B | 185 files use responsive grid/flex patterns; 138 use overflow-safe scroll containers. 16 files carry large fixed widths (risk). Not breakpoint-rendered (ceiling). |
| Dev placeholders / Lorem / empty cards | A− | **0** lorem ipsum. 17 "coming soon" are **intentional** legacy toast-stubs (KEEP, documented byte-identical). 3 rendered-text placeholders found → **all 3 fixed** (§4); committed `scan.json` re-run post-fix now reports **0**. |

---

## 3. Branding finding — 5 competing primary palettes

`scan.json` → 249 files define an inline `const BRAND`; only 15 import `design-system/tokens.ts`.
Of the inline definitions, primary color clusters into:

| Primary | Files | Interpretation |
|---|---|---|
| `#344E86` (canonical) | ~201 | Correct. |
| `#0b3c5d` (deep navy) | 37 | **Coordinated secondary theme** (student/exam/competency surfaces). Looks deliberate, not accidental. |
| `#6366f1` (indigo) | 5 | Career-passport / report-factory cluster. |
| `#6c63ff` (purple) | 3 | Future-Readiness cluster. |
| `#0f172a` (slate) | 3 | Benchmark / Ontology / CareerMobility. |
| accent `#FB923C` (orange) | (subset of above) | Off-brand accent on the slate cluster. |

**Decision (honest):** The `#0b3c5d` cluster (37 files) is internally consistent and clearly an
intentional sub-product theme. **Unilaterally rebranding 37 student screens is a far-reaching design
decision, not a "clear defect," so it was NOT changed.** Same logic applies to the indigo/purple
feature clusters. This is flagged for a **product/design owner decision**: either (a) formalize these
as named secondary brand tokens, or (b) converge them to canonical. See §5.

---

## 4. Clear defects FIXED this task (safe, reversible)

1. **Typography dual-canon** — `design-system/tokens.ts` `TYPOGRAPHY.fontFamily` said `Inter`, but the
   live CSS canon (`styles/index.css` `@layer base`) is `Plus Jakarta Sans`. Aligned the TS token to
   the CSS canon (`'Plus Jakarta Sans', 'DM Sans', 'Inter', …`) so there is **one source of truth**.
2. **`NotificationCenter.tsx`** — "Email preference management coming soon" was misleading: a working
   "View all preferences" button sits directly below it. Replaced with an accurate prompt pointing to
   the live preferences screen.
3. **`superadmin/ContentManagerPanel.tsx`** — removed the in-UI dev note "(coming soon)" from the
   slides header; now shows a clean slide count.
4. **`competency/IndustryBenchmarksPage.tsx`** — the 8th industry slot read as a greyed-out "Coming
   soon" dev placeholder. Reframed as an intentional **"On the roadmap"** badged teaser (it is a
   genuine roadmap item, not a stub).

**Validation:** `npx vite build` passes clean (the only real launch gate; backend runs on tsx).

**Not touched (correctly):** the 17 intentional flag-gated legacy toast-stubs (e.g. FinancialsPanel,
StudentsLegacyPanel) — documented byte-identical legacy behaviour. "Sample data" labels are honesty
disclosures, not defects.

---

## 5. Recommendations (prioritized — require owner decision / future task)

1. **Brand convergence (P1, design decision):** Decide on the secondary palettes (§3). If they stay,
   promote `#0b3c5d`/`#6366f1`/`#6c63ff` to **named tokens** in `tokens.ts` and have those areas
   import them. If not, converge to canonical. Either way: **stop redefining `BRAND` inline** — export
   a canonical `BRAND` from `tokens.ts` and migrate the 249 files incrementally (mechanical, low-risk,
   but large — a dedicated task).
2. **State-handling sweep (P2):** Triage the ~156/106/118 loading/empty/error candidates from
   `scan.json`; adopt the existing shared `LoadingState`/`EmptyState`/`ErrorState` primitives where a
   data screen truly lacks one. (Heuristic has false positives — needs human triage, not bulk edit.)
3. **Responsive hardening (P3):** Review the 16 files with ≥600px fixed widths for mobile overflow;
   prefer `max-w-*` + responsive utilities.
4. **Bundle perf (P3, not a UI defect):** `index` (1.6MB), `CareerBuilderPage` (1.08MB),
   `EmployerPortalPage` (1.03MB) exceed 1.5MB/1MB — consider further code-splitting.

---

## 6. Reproducibility

- Scanner: `backend/scripts/mx301e-ui-certification-scan.ts` (read-only static analysis).
- Raw findings: `backend/audit/mx-301e/scan.json` (per-file + aggregate). The committed copy was
  **regenerated after** the §4 fixes, so `defectPlaceholderFiles` is `[]` (confirms the fixes).
- Re-run: `cd backend && npx tsx scripts/mx301e-ui-certification-scan.ts`.
