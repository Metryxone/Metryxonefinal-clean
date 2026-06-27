# MX-302A — Career Launchpad · Rendered-UI E2E results

Run date: 2026-06-27 · flag `FF_CAREER_LAUNCHPAD=1` (dev env var, Backend API workflow) · Playwright browser test.

## Verdict: PASS (after two defect fixes — see below)

Both returning no-profile users auto-land on the **Career Launchpad** tab
(`fresher-hub`), NOT the Dashboard/Command Center tab, in the rendered UI.

| Scenario | Fixture (no `career_seeker_profiles` row) | Landing tab observed | Result |
|----------|-------------------------------------------|----------------------|--------|
| A — career_seeker | `mx302a-ui-career@example.com`  | Sidebar "Career Launchpad" ACTIVE, main heading "Career Launchpad", fresher sub-tabs present, Dashboard NOT active | PASS |
| B — student role  | `mx302a-ui-student@example.com` | Sidebar "Career Launchpad" ACTIVE, main heading "Career Launchpad", Dashboard NOT active | PASS |

Notes from the run:
- Scenario A: a profile-setup modal briefly appeared and was dismissed; it did not
  affect the underlying active tab / heading. Active-tab styling was visually
  consistent with the navy highlight (not programmatically colour-sampled).
- Scenario B: the student user transiently passed through `/student-dashboard`
  before `/career-builder`; final routing + Launchpad auto-selection were correct.

## Defects found AND fixed during this verification
The first run FAILED — it surfaced two real rendering bugs that prevented a
no-profile user from ever reaching Launchpad. Both are now fixed:

1. **No-profile crash white-screened the whole page (routing never completed).**
   `CareerBuilderPage` renders the initial `dashboard` tab inline before the
   load-time experience-routing effect switches the tab. A render crash inside a
   tab subtree (an unguarded access for a no-profile user) propagated all the way
   up through `CareerBuilderPage`, so the page never committed and its routing
   effect never ran → blank screen, user stranded.
   Fix: a `TabContentErrorBoundary` (keyed by `tab`) now wraps the main tab
   switch in `CareerBuilderPage.tsx`. A tab crash renders a graceful fallback
   instead of taking down the page; the parent commits, the routing effect runs,
   and the tab-keyed boundary remounts cleanly on the tab switch. No-op (byte
   identical) unless a tab actually throws.

2. **`FresherHubTab` crashed with `Circle is not defined`.** The Launchpad tab
   used the `Circle` lucide-react icon without importing it, so the Launchpad tab
   itself threw on render. Fix: added `Circle` to the `lucide-react` import in
   `frontend/src/pages/career/FresherHubTab.tsx`.

## How to re-run
1. Ensure flag ON for Backend API: dev env var `FF_CAREER_LAUNCHPAD=1`, restart
   `Backend API` (workspace setup uses a dev env var because `.replit` cannot take
   another workflow flag — see `.agents/memory/workflow-limit-flag-via-env-var.md`).
2. `cd backend && npx tsx audit/mx-302a/ui-e2e-seed.ts seed`
3. Run the Playwright plan in `ui-e2e-plan.md` (testing skill).
4. Teardown: `cd backend && npx tsx audit/mx-302a/ui-e2e-seed.ts clean`; revert the
   dev flag so the default flag-OFF (byte-identical legacy) is restored.

## State restoration
After this run the fixtures were removed (`... ui-e2e-seed.ts clean`) and the
`FF_CAREER_LAUNCHPAD` dev env var was deleted, returning the workspace to the
default flag-OFF state. The two code fixes above are intentionally retained — they
are defensive/byte-identical-OFF and fix real crashes.
