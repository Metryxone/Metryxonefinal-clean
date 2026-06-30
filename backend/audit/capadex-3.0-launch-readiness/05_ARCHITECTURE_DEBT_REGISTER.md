# 5 · Architecture Debt Register

Structural/system-level debt (distinct from code-level technical debt). Measured from the live repo + DB.

## AD-1 · Schema fragmentation — HIGH
- **Measured:** **1,441 live Postgres tables** vs **134** canonical `pgTable` definitions in
  `shared/schema.ts`. **178 files** create tables via lazy `CREATE TABLE`/`ensure*Schema()` in addition to
  **234** migration files.
- **Implication:** the Drizzle schema is NOT the source of truth for the database; ~90% of tables live
  outside it, created lazily at first write. This is intentional per platform conventions (lazy ensure-schema,
  no migration runner) but it means: no single schema map, drift risk, harder onboarding, and table-name
  collision risk (memory already records the `pil_kg_*` vs `kg_*` near-miss that could WIPE the live graph).
- **Severity:** HIGH (maintainability/operability). Recommend a generated schema catalog + a name-collision
  lint, **not** a forced migration to Drizzle (out of scope / risky).

## AD-2 · Parallel v1 + v2 route families — MEDIUM/HIGH
- **Measured:** 20 `-v2` files (9 routes + 11 services). All checked v2 routes are imported/mounted **and**
  several have their **v1 sibling route still mounted simultaneously**: adaptive-assessment,
  competency-runtime, governance, predictive-intelligence, workforce-os. The corresponding V2 flags
  (`advancedCompetencyRuntimeV2`, `adaptiveAssessmentRuntimeV2`, `contextualScoringV2`, `workforceOSV2`,
  `adaptiveOrchestrationV2`, `aiInferenceV2`, `predictiveIntelligenceV2`, `governanceScienceV2`,
  `enterpriseWorkforceOSV2`) are **all default-ON**.
- **Implication:** two route families for the same domain run in parallel; v2 is the live path but v1 is still
  reachable. Ambiguous ownership, double maintenance, possible behavioral divergence.
- **Severity:** MEDIUM–HIGH. Recommend an explicit deprecation/retirement decision per pair (the MX-700
  lifecycle engine is literally built to track this) — confirm v1 is dead, then retire (archive, don't delete).

## AD-3 · `routes.ts` central monolith — HIGH
- 14,504 lines containing 473 inline endpoints + 300 `registerXRoutes()` mounts + the global auth gates.
- **Risk:** Express route-order traps (literal-vs-param ordering) are already documented in memory as a
  recurring footgun; a single file this large concentrates merge-conflict and regression risk.
- **Severity:** HIGH (maintainability). Incremental extraction of inline endpoints into `routes/*` modules.

## AD-4 · Dual persistence layer — MEDIUM
- Journeys use both the raw `pool`/Drizzle path **and** a custom `storage.ts` (5,057 ln) layer. Two ways to
  reach data → inconsistent patterns, duplicated query logic.
- **Severity:** MEDIUM. Converge over time; not launch-blocking.

## AD-5 · Massive dormant meta-intelligence surface — MEDIUM (governance, not defect)
- **Measured:** 158/190 flags OFF, dominated by MX-700 (lifecycle 1.37–1.43) + MX-800 (enterprise intel
  2.1–2.14) + the engineering/runtime/knowledge/decision/predictive/recommendation/continuous-learning
  intelligence engines. ~4,000 endpoints total, much of it this meta-layer.
- **Implication:** a very large built-but-dormant surface increases cognitive load, audit scope, and the
  temptation to "turn things on." It is **architecturally clean** (flag-OFF = byte-identical, read-only
  composers, no business-logic change) so it is **not debt** — but it IS a governance burden.
- **Severity:** MEDIUM (governance). Keep dormant until there is runtime evidence to justify activation;
  never force-activate to inflate metrics (honesty contract).

## AD-6 · Frontend bundle size — MEDIUM (see Performance Report)
- Built chunks: `index` 1.62 MB, `CareerBuilderPage` 1.23 MB, `EmployerPortalPage` 1.16 MB (pre-gzip);
  Vite warns >1.5 MB. No route-level code-splitting for the largest pages.
- **Severity:** MEDIUM. Lazy-load the heavy pages; not launch-blocking but hurts first-load UX at scale.

## Architecture debt rollup
| Severity | Items |
|---|---|
| HIGH | AD-1 (schema fragmentation) · AD-3 (routes.ts monolith) |
| MEDIUM–HIGH | AD-2 (parallel v1/v2 route families) |
| MEDIUM | AD-4 (dual persistence) · AD-5 (dormant meta-surface, governance) · AD-6 (bundle size) |

**None of these are functional launch blockers** — the system builds and runs. They are the
maintainability/operability debts an enterprise buyer's technical due-diligence will probe.
