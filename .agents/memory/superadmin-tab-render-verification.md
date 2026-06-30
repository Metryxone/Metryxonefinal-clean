---
name: SuperAdmin newly-exposed tab render verification
description: How flag-gated SuperAdmin tabs surface in the UI and why render crashes can only be caught at browser runtime here
---

# Verifying flag-gated SuperAdmin tabs actually render

**Where the tabs live:** Most flag-gated SuperAdmin composer panels are NOT top-level
sidebar items. They are `extraTabs` inside `CompetencyFrameworkShell` (rendered when
`activeTab === 'competency-fw'`, the "Competency Framework" sidebar section). The shell
has 40+ horizontal sub-tabs; the flag-gated ones (Competency Coverage Matrices, Competency
Match Intelligence, Global Intelligence, Enterprise Workforce Console, Enterprise
Certification, Go-Live Center, Founder Go-Live Center, Platform Completion, Platform
Lifecycle Operations, Platform Intelligence Operations, Enterprise Intelligence
Integration, O*NET Crosswalk Governance) sit near the END of that sub-tab list — a
browser tester must open the section, then scroll the sub-tab bar / open its overflow.
A few (Founder Control Center, Enterprise Governance, Tenants/Multi-Tenant) ARE top-level
`activeTab` blocks. `activeTab` is React state in `AdminDashboardContext` — NOT synced to
URL or localStorage, so you CANNOT deep-link a tab; you must click through the nav.

**Why a build/typecheck won't save you here:** there is NO TypeScript installed in this
repo (no `node_modules/.bin/tsc`, no `check` script; `npx tsc` grabs an unrelated package).
Vite/esbuild/Rollup compile via esbuild WITHOUT type-checking, and none of them error on
an **undefined module-level identifier** (they treat unknown names as globals). So a panel
referencing an undeclared const or an unimported icon builds 100% clean and only throws a
**ReferenceError at render time** in the browser, caught by the dashboard error boundary
("This section failed to render. Switch tabs or reload to retry.").

**How to verify (the only reliable way):** browser-render each tab (testing skill `runTest`,
super-admin login is 2FA-gated → read code from `mfa_codes`). Assert the content area does
NOT contain "This section failed to render" and the console has no `ReferenceError`/"is not
defined". Run logins SEQUENTIALLY (concurrent logins collide on the latest MFA code).

**Honesty note on "0" vs "—":** a literal `0` is correct when a count is genuinely zero
(table readable, 0 rows, e.g. Enterprise Intelligence Integration "Integration records: 0").
`—` is only for null/unmeasurable. An empty-but-readable count showing 0 is NOT a defect.

**Tooling gotcha:** bash/`rg` output for some of these `.tsx` files is being TRANSFORMED
in this environment (identifiers collapsed to `n`/`ln`, e.g. const names, `tenant_type`).
Trust the `read` tool for exact file content, not bash grep, when inspecting them.
