# WC-C6A · Deliverable 4 — Entitlement Packaging Report
_Generated 2026-06-10T08:50:05.250Z. read-only._

## Capability tier map — L3 entitlement packaging
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
| `stage_feature_map` | Stage→feature entitlement map (what a SKU unlocks) | real (5/5) | — dormant | 0 paying identities → no stage features ever granted live |
| `package_entitlement_map` | Package→entitlement/feature mapping | absent (1/5) | — dormant | capability absent in code |
| `entitlement_enforcement_gate` | Entitlement enforcement gate (access control) | gated_real (4/5) | — dormant | flag commercialEntitlementEnforcement OFF by default → dormant |

## Findings
- **Stage→feature map REAL** (`STAGE_FEATURES`): CAP_INS→insight_report; CAP_GRW→growth_report/growth_plan; CAP_MAS→mastery_report/mentor_access. Entitlement = UNION over owned stages.
- **Package→entitlement mapping ABSENT** (NOT partial): `subscription_packages` has no feature column; grants are child/student-keyed and entitlement-disjoint from STAGE_FEATURES (WC-C2). A package purchase would unlock nothing enforceable.
- **Enforcement gate GATED-REAL**: WC-C4 `requireEntitlement` exists but its flag is OFF by default.
- Entitlement coverage (entitled/paying): **not_measurable** (0/0 — not_measurable: 0 paying identities).

> The ladder has a real purchase→entitlement spine; the package model has none. Packaging a renewable product requires a package→feature map first.
