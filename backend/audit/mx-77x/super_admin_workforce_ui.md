# MX-77X · Section 10 — Super Admin Workforce UI

**Status:** BUILT + WIRED this phase (flag-gated, byte-identical OFF).
**Panel:** `frontend/src/components/superadmin/EnterpriseWorkforceConsolePanel.tsx`.
**Wiring:** `SuperAdminDashboard.tsx` — lazy import + `enterpriseWorkforceEnabled` probe
(`GET /api/enterprise-workforce/_meta/status`, res.ok) + conditional-spread nav item
(`enterprise-workforce-console`) + `activeTab` render. Mirrors the proven MX-76X
`GlobalIntelligencePanel` pattern.

## Surface
- **One combined query**: `/overview` (availability + provenance + summary) then the 7 detail views
  (`skill-gap`, `succession`, `mobility`, `workforce-planning`, `talent-risk`, `talent-forecasting`,
  `readiness-forecasting`) for coverage counts.
- **Summary tiles**: views available / total · views abstained · org · engine version.
- **Per-view card**: availability badge · coverage map (every count, `null` shown as `null`) ·
  abstain reason · provenance (engines · tables · honesty notes).

## Honesty behaviours (enforced in the panel)
- **Flag OFF → 503 → tab omitted entirely** (no empty shell; byte-identical admin UI).
- **Abstained view → "Insufficient Evidence"** amber badge + the engine's own `reason`, never a fake 0.
- **`null` coverage rendered literally as `null`** (missing ≠ measured zero).
- **Provenance always shown** (engines + tables) so every number is traceable to its source table.
- **Disclaimer banner** surfaces the engine's developmental-signal disclaimer verbatim.

## What the super admin sees today (demo_org, validated)
- Available: skill-gap, succession, internal-mobility (derived), talent-risk, talent-forecasting,
  readiness-forecasting + workforce-planning (capability projection active).
- Abstained where evidence is absent (e.g. transformation scenarios, department roll-ups) — shown
  honestly with reasons, not hidden.

## Reachability ceiling
- The panel can only surface what the composer measures; org-level enterprise readiness and
  department decomposition abstain until department/HRIS evidence exists (Sections 3 & 8).
