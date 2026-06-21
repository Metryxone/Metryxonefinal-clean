---
name: Route registrar name collision (TDZ startup crash)
description: Two route modules exporting the same register* name collide in routes.ts and crash startup with a TDZ ReferenceError.
---

# Route registrar name collision → TDZ startup crash

`routes.ts` pulls route registrars via a mix of top-of-file static imports AND
in-body dynamic `const { registerX } = await import(...)`. If two different route
modules each export a registrar with the **same function name**, esbuild/tsx
disambiguates by suffixing one (`registerX2`) and the body reference can resolve to
a binding that is in the temporal dead zone at the call site → backend crashes on
boot with a `ReferenceError: Cannot access 'registerX2' before initialization`.

**Concrete instance:** `employer-hiring-intelligence.ts` already owns the export
name `registerHiringIntelligenceRoutes` (dynamically imported). A second, unrelated
hiring-intelligence engine module reusing that exact export name triggered the TDZ
crash. Fix was to name the new export distinctly
(`registerHiringIntelligenceEngineRoutes`).

**Why:** the registrar names live in one flat module scope in routes.ts; same-name
exports from sibling modules are not isolated.

**How to apply:** before adding a new `registerXEngineRoutes` / `registerXRoutes`
export, `grep` the codebase for that exact name. If taken, pick a distinct one
(the `...EngineRoutes` suffix is the established convention for the newer engine
route modules). A clean restart that boots without a TDZ ReferenceError is the
only proof the name is free.
