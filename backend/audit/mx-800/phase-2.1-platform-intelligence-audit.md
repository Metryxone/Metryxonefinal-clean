# MX-800 Phase 2.1 — Platform Intelligence Audit (MEASURED)

_Measured at 2026-06-29T04:54:55.282Z by `scripts/mx800-2.1-platform-intelligence-audit.ts` — pure read-only repository scan._

> Honesty: every figure here is measured from the live repository. Nothing is fabricated or estimated. Intelligence Exists ≠ Connected ≠ Orchestrated.

## 1. Raw inventory

| Asset | Count |
|---|---|
| Backend services (top-level) | 422 |
| Governance services (subdir) | 13 |
| Automation services (subdir) | 6 |
| Route modules | 310 |
| Migrations | 223 |
| Memory topic docs | 268 |
| Product docs | 26 |
| Feature flags | 177 (32 default-ON / 145 default-OFF) |

## 2. Constitutional intelligence domains (anchor coverage)

Representative existing engines per domain; anchors verified to exist on disk. This is a curated anchor map, **not** an exhaustive partition of all services.

| Domain | Anchors present / declared | Missing |
|---|---|---|
| Repository Intelligence | 4 / 4 | — |
| Platform Intelligence | 4 / 4 | — |
| Engineering Intelligence | 8 / 8 | — |
| Runtime Intelligence | 5 / 5 | — |
| Knowledge Intelligence | 6 / 6 | — |
| Decision Intelligence | 5 / 5 | — |
| AI Intelligence | 6 / 6 | — |
| Analytics Intelligence | 6 / 6 | — |
| Enterprise Intelligence | 7 / 7 | — |

## 3. Governance substrate (cross-cutting)

- Governance-named services: **11** (+ 13 in `services/governance/`)
- Governance-named route modules: **18**

## 4. Duplication candidates (human-review only)

Found **11** `-v2` service variants. Presence of a variant is NOT proof of redundancy — flagged for review.

| Variant | Base candidate | Base present |
|---|---|---|
| ai-governance-v2.ts | ai-governance.ts | no |
| competency-graph-engine-v2.ts | competency-graph-engine.ts | yes |
| dispute-override-engine-v2.ts | dispute-override-engine.ts | yes |
| fairness-monitoring-engine-v2.ts | fairness-monitoring-engine.ts | yes |
| learning-roi-engine-v2.ts | learning-roi-engine.ts | yes |
| m3-confidence-v2.ts | m3-confidence.ts | no |
| market-intelligence-engine-v2.ts | market-intelligence-engine.ts | yes |
| predictive-workforce-engine-v2.ts | predictive-workforce-engine.ts | yes |
| rbac-tenant-engine-v2.ts | rbac-tenant-engine.ts | yes |
| role-readiness-v2.ts | role-readiness.ts | no |
| workforce-simulation-v2.ts | workforce-simulation.ts | no |

## 5. Observed engine families (the OS observes, not replaces)

| Family (name pattern) | Service files | Route files |
|---|---|---|
| career-* | 28 | 34 |
| competency-* | 29 | 14 |
| capadex* | 6 | 15 |
| talent-* | 6 | 18 |
| hiring/employer-* | 10 | 13 |
| learning/lip/lde-* | 20 | 10 |
| ei-* | 11 | 5 |
| workforce-* | 4 | 4 |
| enterprise-* | 5 | 7 |
| platform-* | 8 | 11 |
| ontology/onet/role-dna | 11 | 6 |
| report/omega/rf | 6 | 4 |
| *-governance | 11 | 18 |
| *intelligence* | 41 | 43 |

_Note: families overlap by name pattern (e.g. a service can be both `*intelligence*` and `enterprise-*`); counts are per-pattern, not a disjoint partition._
