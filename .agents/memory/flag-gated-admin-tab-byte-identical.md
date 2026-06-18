---
name: Flag-gated admin tab byte-identical-OFF
description: How to make a new SuperAdmin nav tab disappear when its file-registry flag is OFF
---

A flag-gated additive SuperAdmin panel is NOT byte-identical-OFF if the nav tab
still renders and only the panel shows a 503/"disabled" message. The tab itself
must disappear when the flag is OFF.

**Why:** The honesty/additive contract requires flag-OFF UI to be byte-identical
to legacy. A leftover tab (even one that only shows a disabled message) violates
that.

**How to apply:**
- The file-registry flags in `backend/config/feature-flags.ts` are NOT exposed by
  `/api/admin/feature-flags` — that endpoint manages the DISTINCT DB `feature_flags`
  table. So the frontend cannot read file-registry flag state from there.
- Instead, probe the feature's own gate-first endpoint and gate the tab on it.
  Mirror the existing `simHarnessEnabled` useQuery pattern in `SuperAdminDashboard.tsx`:
  fetch the gated GET endpoint, return `res.ok` (only 200 enables; 503/401/500 hide),
  `enabled: isAuthenticated`. Then inject the tab with a conditional spread
  `...(enabled ? [{...tab}] : [])` inside the FrameworkPanel `extraTabs` array.
- Keep the panel's own 503-handling as defense-in-depth.

**Sibling-panel caveat:** Some existing flag-gated panels (career-evidence,
passport-stats, governance-security) only do panel-level 503 and leave the tab —
do not treat that as the standard; the contract wants the tab gone.
