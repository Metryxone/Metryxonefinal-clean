---
name: Byte-identical-OFF gating for non-super-admin persona surfaces
description: How to flag-gate employer/candidate UI tabs so a flag-OFF state is byte-identical, when the only existing flag-probe endpoint is super-admin-gated.
---

# Byte-identical-OFF gating across personas needs a persona-agnostic flag probe

When an additive feature ships persona surfaces in MULTIPLE apps (super-admin console, employer
portal, candidate Career Builder), each new tab must disappear when the feature flag is OFF, or the
flag-OFF UI is NOT byte-identical.

**Why a single probe endpoint is not enough:** a super-admin surface can gate its tab by probing the
feature's own status endpoint and checking `res.ok` — but that endpoint is typically
`flagGate → requireAuth → requireSuperAdmin`. Employer/candidate sessions pass auth but FAIL
`requireSuperAdmin` → they always get **403**, so `res.ok` is always false → their tab would be
permanently hidden even when the flag is ON. Conversely, if you don't gate them at all, the tab is
always visible even when the flag is OFF (the bug).

**The fix:** add ONE persona-agnostic flag-probe route with `flagGate` ONLY (no auth — a flag's
on/off STATE is not sensitive), e.g. `GET /api/<feature>/enabled` returning `{ ok:true, enabled:true }`.
Because `flagGate` runs first and returns 503 when the flag is OFF, every persona can probe it and
gate its tab on `res.ok`:
- nav item: `items.filter(t => t.id !== '<tab>' || enabled)`
- render switch: `{tab === '<tab>' && enabled && <Panel/>}`

**How to apply:** any time a flag-gated feature adds tabs to non-super-admin apps, don't reuse the
super-admin status endpoint as the gate — stand up a flagGate-only `/enabled` probe and gate all
personas (including super-admin if convenient) on it. Keep `flagGate` BEFORE auth so OFF → 503 before
any handler/DDL runs.
