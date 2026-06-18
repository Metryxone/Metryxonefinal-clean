---
name: SuperAdminDashboard code-splitting
description: How the SuperAdmin panel monolith is lazy-loaded, and the rules that keep it correct.
---

# SuperAdminDashboard.tsx code-splitting (F6)

The admin shell renders ~160 panels via a single conditional switch
(`{activeTab === '...' && <Panel/>}`) inside `<DialogsErrorBoundary resetKey={activeTab}>`.
Panels are `React.lazy(() => import('./superadmin/X'))` / `'./admin/X'`, and the whole
switch is wrapped in ONE `<Suspense fallback={spinner}>` placed *inside* that boundary.
This cut the `SuperAdminDashboard-*.js` chunk from ~3.14 MB to ~386 kB (gzip 91 kB).

**Rule — only lazy what renders inside the Suspense.** A `React.lazy` component
rendered OUTSIDE a Suspense boundary throws at runtime. The always-on chrome
(header/sidebar) is rendered BEFORE the content switch, so these stay STATIC imports:
- `CrisisAlertInbox`, `NotificationCenter` — header (always rendered).
- `AdminSidebar`, `AdminDialogs` — named imports (sidebar/chrome).
- `FrameworkPanel` — even though only used inside the switch, it's imported via the
  `@/components/admin` alias (not the `./admin/` relative path the transform targets) and
  is small + reused 4×; left static.
- `DialogsErrorBoundary` — a local class declared in the file, not an import.

**Transform target** = default imports matching `^import\s+\w+\s+from\s+'\./(superadmin|admin)/...'`
(flexible whitespace — some lines are column-aligned with multiple spaces). Named imports
(`import { ... }`) and alias/`../pages` imports are NOT touched. Denylist the chrome
components above.

**Static+dynamic duplicate-import is a missed optimization, NOT a defect.**
`ConcernAreasPanel` / `ShortAssessmentsPanel` are lazy-imported here but ALSO statically
imported by `FrameworkPanel.tsx`, so Rollup keeps them in FrameworkPanel's chunk and warns.
Rendering/behaviour are unaffected — they just don't get their own chunk.

**Why:** the panel list is a 900-line monolith; an in-place script transform (import line →
`const X = lazy(...)`) plus one Suspense wrap is far safer than hand-editing 158 lines.
Interspersing `const = lazy()` among remaining `import` lines is valid ESM/TS (imports hoist)
and builds clean.
