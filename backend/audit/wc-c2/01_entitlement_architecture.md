# WC-C2 · Deliverable 1 — Entitlement Architecture Report
_Generated 2026-06-10T05:36:05.041Z. Read-only recompute over the live entitlement engine._

## The engine (REAL)
- **`deriveEntitlement(pool, email)`** — per-identity resolver. Reads ONLY `capadex_payments` (status='paid'), maps owned stages → features via `STAGE_FEATURES`, returns the UNION. **FAIL-CLOSED**: a ledger read error returns `billing_ledger_unavailable` (entitles nothing), never fabricates ownership.
- **`buildEntitlementOverview(pool)`** — system-wide coverage. Live recompute this run: paying_identities=**0**, entitled_identities=**0**, coverage_pct=**n/a (no payers)**, active_package_grants=**0**, degraded=**false**.

## Stage → feature map (lockstep verified by source-introspection)
| Constant | Source | Keys |
|---|---|---|
| STAGE_PRICES | routes/capadex-payments.ts | CAP_INS · CAP_GRW · CAP_MAS |
| STAGE_FEATURES | services/wc7c/entitlement-engine.ts | CAP_INS · CAP_GRW · CAP_MAS |
| STAGE_PRICES | services/wc7c/subscription-engine.ts | CAP_INS · CAP_GRW · CAP_MAS |
| LADDER | entitlement / subscription | CAP_INS → CAP_GRW → CAP_MAS / CAP_INS → CAP_GRW → CAP_MAS |

Stage-keys consistent: **YES ✅** · Ladder consistent: **YES ✅**. Feature strings: `insight_report`, `growth_report`, `growth_plan`, `mastery_report`, `mentor_access`. The map is **complete for the real SKU set**; non-ladder products correctly carry no features.

## ⚠️ Finding — header overstates package coverage (doc/code drift)
The engine header claims it reads `student_subscriptions → subscription_packages`. **The code does not**: per-identity `deriveEntitlement` queries only `capadex_payments`; package grants appear ONLY as an aggregate `active_package_grants` COUNT in the overview. Combined with (a) `subscription_packages` having **no feature-string column** (category/segment/domains_covered/report_type/price only) and (b) grants being **child/student-keyed** (email-disjoint), the package SKU is **entitlement-disjoint** — an email-keyed access guard cannot grant package features. This is a real correction to any assumption that the keystone guard "also covers packages".

## Entitlement Subsystem Readiness (dual-axis — distinct from monetization coverage)
**Structural 64% (16/25) · Activation 0% (0/5)**

| Dimension | Structural tier | Note |
|---|---|---|
| architecture | real (5/5) | deriveEntitlement(email) + buildEntitlementOverview: read-only, FAIL-CLOSED on ledger error, union over owned paid stages. DOC/CODE DRIFT (header comment only — code is correct, not scored down): the engine header claims it reads student_subscriptions→subscription_packages, but per-identity entitlement queries ONLY capadex_payments — package grants never enter entitled_features. |
| stage_feature_mapping_lockstep | real (5/5) | STAGE_FEATURES vs STAGE_PRICES(×2) vs LADDER source-introspected: stage-keys CONSISTENT, ladder CONSISTENT. Keys=CAP_INS/CAP_GRW/CAP_MAS. Complete for the real SKU set; non-ladder products correctly have no features. |
| access_enforcement | absent (1/5) | NO middleware/guard consumes deriveEntitlement at access time. Paid-tier reports are served on session-UUID possession. THIS IS THE KEYSTONE GAP. |
| package_grant_path | stub (2/5) | Grant plumbing exists (assign-package, expiry model, active-grant COUNT in overview) BUT produces NO per-identity entitlement: deriveEntitlement excludes packages, subscription_packages has no feature map, grants are child/student-keyed (email-disjoint). As an ENTITLEMENT path it is non-functional. |
| fulfillment_provisioning | partial (3/5) | SPLIT — notification fulfillment is REAL (confirmation emails + WhatsApp + capadex_audit_events payment_completed, verified) | access-provisioning is MISSING (paid status flip unlocks nothing; no entitlement record, no report unlock). |

Activation enablers (deploy posture):
- [ ] commercialEntitlement flag ON (config default) — default=false
- [ ] access-time entitlement consumer wired — no requireEntitlement/guard consumes deriveEntitlement anywhere
- [ ] live paid payment rows (entitlement data) — 0 paid / 6 total
- [ ] real Razorpay keys (non-demo) — configured=false
- [ ] active package grants feeding entitlement — 0 active grants, but path is entitlement-disjoint

_Scope: behavioural substrate (wcl0/wcl4/wcl5) is intelligence, not commercial signal — excluded from every figure here._
