# WC-C3 · Executive Summary — Entitlement Enforcement
_Generated 2026-06-10T06:54:23.489Z. AUDIT ONLY · STOP FOR APPROVAL. Two axes (Structural / Activation), never composited._

## Current enforcement readiness
**Entitlement Enforcement Readiness — Structural 48% (12/25) · Activation 0% (0/5).** The resolver is real and fail-closed; the gap is that **nothing enforces it** and **nothing has been paid**.

## Answers to the success criteria
1. **Which endpoints are currently unprotected**
   - *Entitlement axis:* **13** paid-tier CAPADEX endpoints served on session-UUID possession with **no entitlement check** (and no RBAC) — session UUIDs are bearer tokens.
   - *RBAC/security axis (separate):* **212 of 623** `/api/admin/*` routes have **no route-level guard** (static detection; in-handler checks not inspected except a confirmed sample) — including payment-PII and a state-changing migration endpoint. This is a security finding, quarantined from the entitlement score.
2. **Which products can be monetized immediately** — **only the CAPADEX stage ladder** (real SKU + checkout + feature map; needs guard + flag + keys, zero product build). Package = entitlement-disjoint (separate track); Mentor = stub; LBI/Employability/Career Builder/Longitudinal = not consumer SKUs.
3. **Shortest path to >90% monetization readiness** — denominator-dependent, stated plainly:
   - On **Product Monetization Readiness** (WC-C1 6×5): the keystone reaches **20%** only. **>90% there is productization, not enforcement** — the objective's "20%→>90% through enforcement" premise does not hold on this metric.
   - On the **proposed Live-SKU re-baseline** (CAPADEX ladder only): the keystone reaches **100% structural** — i.e. ≥90%. Requires your explicit approval to adopt.
4. **Enforcement effort estimate** — countable units U1–U6 (snapshot). The entitlement keystone (U1–U3) is a small build; the RBAC sweep (U5) is a separate security track scaling with the 212 unguarded admin endpoints; activation (real paid volume) is **earned, not estimable**. Day-band sizing (judgment, not measurement) lives only in the roadmap (deliverable 5), deliberately not in the snapshot.

## The keystone (one build, two cells)
A single `requireEntitlement` middleware consuming `deriveEntitlement(email)`, applied to the 13 paid-tier endpoints, flips `access_enforcement` **and** `access-provisioning`. Un-gate `commercialEntitlement`, add real keys, and one real transaction proves the chain.

## Honest activation ceiling
Activation is **0%** on every metric and **cannot be raised by configuration or engineering** — it is a function of real keys + real paid volume earned over time.

## Decision requested
Choose the denominator: **(a)** keep "Product Monetization Readiness" (then >90% needs a productization programme), or **(b)** re-baseline to "Live-SKU Entitlement Wiring Readiness" (then the entitlement keystone reaches ≥90%). Separately, schedule the **RBAC/security sweep** for the 212 unguarded admin endpoints. **No implementation has been performed. STOP FOR APPROVAL.**
