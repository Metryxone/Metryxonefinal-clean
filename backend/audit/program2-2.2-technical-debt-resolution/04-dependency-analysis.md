# Program 2 · Phase 2.2 — 04 · Dependency Analysis

## 1. Internal module graph (measured shape)
- **Engine/route separation holds:** business logic in `services/*-engine.ts`; `routes/*` compose them. This is the dominant, consistent pattern (332 route modules over 442 services).
- **Composition direction is mostly acyclic by construction:** routes → services → lib/config/shared. `lib/*` (12 files) and `config/*` are leaf utilities (logger, validate, audit, lifecycle, admin-path-gate, env-preflight) with no upward imports into routes/services.
- **`import type` is used widely** for cross-service type sharing (e.g. `CompetencyTarget` from `functional-competency-seeding-engine`), which carries **no runtime dependency** (erased at transpile) — important when reasoning about cycles and dead code.

## 2. Circular dependencies
- No evidence of a runtime-breaking import cycle was found. The platform runs on `tsx` with no build step; a hard ESM cycle that broke evaluation would crash boot, and the backend boots cleanly.
- Some **type-only** mutual references exist between sibling engines; these are erased at runtime and are not a runtime cycle.
- **Honest limit:** a full transitive cycle proof requires AST/graph tooling (e.g. `madge`) not present in this environment. Per the existing `engineering-intelligence` honesty contract, graph-completeness beyond static import scanning is **DEFERRED**, not asserted. No cycle remediation is claimed.

## 3. Coupling hubs (measured)
| Hub | Why it is a hub | Severity |
|---|---|---|
| `routes.ts` (14,362 lines) | Registers/handles ~all legacy domains; the single largest coupling point | Medium — **policy-bound** (split forbidden this phase) |
| `storage.ts` (5,057 lines) | Central data-access surface | Low–Medium — on-touch |
| `shared/schema.ts` (3,569 lines) | Drizzle schema referenced widely; coexists with lazy `ensureSchema` raw SQL (dual-truth, 2.1 A3/D5) | Medium — policy-bound reconciliation |
| `config/feature-flags.ts` (2,928 lines) | Imported by nearly every flag-gated phase (by design) | Low — intended fan-in |

## 3a. External dependencies (npm)
- No new runtime packages were added in this phase. The resolution reuses the in-repo `lib/logger.ts` (dependency-free console wrapper) — **zero new dependencies**, consistent with Reuse-Before-Build.

## 4. Disposition
The dependency structure is **coherent and layered**. The only structural coupling debt is the `routes.ts` monolith + schema dual-truth, both rewrite-shaped and therefore **registered (report 07), not refactored** under this phase's constraints. No circular-dependency remediation is fabricated.
