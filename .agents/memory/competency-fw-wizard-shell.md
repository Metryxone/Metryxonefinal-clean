---
name: Competency Framework wizard shell
description: How the competency-fw admin area is organized (wizard vs classic) and the gotcha when adding new panels.
---

# Competency Framework admin shell — wizard | classic

The SuperAdminDashboard `competency-fw` area no longer renders `FrameworkPanel`
directly. It renders `CompetencyFrameworkShell`, which offers two views of the
SAME panel set:

- **Wizard** (default) — `CompetencyWizard`, a guided import→report pipeline
  (`COMPETENCY_WIZARD_STEPS`: Import & Reference → Build Framework → Map Roles →
  Author Questions → Scoring & Benchmarks → Validate & Report).
- **All tabs (classic)** — the original `FrameworkPanel` with the same props
  (config/extraTabs/tabGroups/initialTab/hiddenTabs), unchanged.

**Why:** the ~40 tabs in 4 dropdown groups were confusing and felt duplicative
(e.g. curated `cmp-role-families` vs O*NET `ont-role-families` are different
namespaces but look like dupes). The wizard reframes them as one ordered flow;
the classic toggle keeps everything reachable (nothing removed).

## Gotchas / how to apply
- The **real** competency panels are all passed as `extraTabs` nodes (created in
  SuperAdminDashboard where the lazy panels are imported). Both views reuse those
  exact nodes — never re-implement a panel for the wizard.
- `FrameworkPanel`'s built-in tabs for competency (domains/sub/content/clusters/
  norms/weights/scoring/reports) are the **empty legacy** group — intentionally
  NOT in any wizard step. They still appear in the classic view.
- When you add a NEW `competency-fw` extraTab, also add its id to a step in
  `COMPETENCY_WIZARD_STEPS` (in `CompetencyFrameworkShell.tsx`), or it will be
  hidden in the wizard. A `import.meta.env.DEV` console.warn in `CompetencyWizard`
  flags any uncovered extraTab id.
- Each tab id must appear in exactly ONE step (dedup). Flag-gated ids absent from
  `extraTabs` are filtered out and empty steps are dropped automatically.
