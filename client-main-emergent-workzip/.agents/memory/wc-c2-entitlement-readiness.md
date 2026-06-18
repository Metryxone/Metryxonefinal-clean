---
name: WC-C2 Entitlement Engine Readiness audit
description: Dual-denominator honesty pattern for a monetization/entitlement readiness audit + the entitlement-disjoint package trap and bearer-token endpoint finding.
---

# WC-C2 — Entitlement Engine Readiness (audit-only)

## Denominator discipline when the objective NAMES a metric
When the task objective cites a specific named metric ("the X% Product Monetization Readiness"),
that name stays bound to its ORIGINAL denominator (here: the WC-C1 6-product × 5-cell, 30-cell matrix).
- **Answer the objective on that metric FIRST.** The entitlement keystone only moved it 13.3%→20%
  (4/30→6/30: CAPADEX gains access_enforcement + provisioning; nothing else moves). Reaching >90% on it
  is a PRODUCTIZATION decision (turn 4 non-SKU surfaces into SKUs + build the mentor stub), NOT entitlement work.
- A tighter denominator that flatters the number (here: "Live-SKU Entitlement Wiring Readiness", CAPADEX
  ladder only, 60%→100% after the keystone) must be presented as a **PROPOSED re-baseline requiring an
  explicit user decision** — give it a DIFFERENT name, show both side by side, never composite, **never
  silently swap denominators to hit a target.** The audit asks the user to choose; it does not choose.
**Why:** swapping to a favorable denominator without flagging it is the classic audit inflation move; the
architect will fail it. **How to apply:** any "shortest path to >N%" audit — recompute the original metric,
then offer (not adopt) a re-baseline.

## One guard, two cells (NOT a double-count)
`access_enforcement` (is the request gated?) and `fulfillment`/access-provisioning (does paying actually
unlock something?) are DISTINCT matrix cells. A single `requireEntitlement` middleware consuming the
per-identity resolver satisfies BOTH at once — label it "one build, two cells", which is efficiency, not
double-counting. Proof the rubric isn't inflating: fulfillment scored false TODAY despite real confirmation
emails/WhatsApp/audit-event, because notification ≠ access-provisioning.

## Entitlement-disjoint package trap
A per-identity, email-keyed entitlement resolver CANNOT lift a package/institute SKU when: (a) the resolver
reads ONLY the payments ledger (not the packages tables), (b) the package table has NO feature-string column
(only category/segment/domains_covered/report_type/price), (c) grants are child/student-keyed (email-disjoint)
via an admin/parent-assign path, not self-serve checkout. So packages are scored stub on the grant dimension
and EXCLUDED from the keystone's reach — packages are a separate, larger track.
**Doc/code drift:** the engine header comment claimed it reads packages; the code doesn't. Flag as a finding,
but DON'T score the architecture down (the code is correct for what it does) — penalize the package dimension.
Double-penalizing both is dishonest in the other direction.

## Session UUIDs as bearer tokens (the real security finding)
Paid-tier report endpoints were gated only by session-UUID possession + completed-status + a runtime
activation flag — no auth, no entitlement. RBAC (`requireAuth`/`requireAdmin`/`requireSuperAdmin`) is
role-only and never consults entitlement; no `requireEntitlement`/`requirePlan` guard exists anywhere.
Enumerate every such endpoint with file:line; state plainly "UUIDs act as bearer tokens; no backend paywall."

## Activation is data-bound, report it 0 honestly
The Activation axis for commerce (real Razorpay keys + real paid volume) is NOT reachable by configuration
or engineering — it is earned. With 0 paid rows and no keys it is 0% on EVERY metric; say so, don't inflate
structural wiring into activation.

## Method notes
- Source-introspect the STAGE_PRICES / STAGE_FEATURES / LADDER constants across all 3 files for a real
  lockstep check (don't trust a single copy). file:line constants in the script go stale if routes move —
  re-verify on any re-run (snapshot-audit limitation).
- Mask payer emails to `user_<sha256[:10]>` before any writeFileSync; scan artifacts for raw `@` before done.
