# MX-600 — Phase 1 Deliverable: Optimization Report

**Date:** 2026-06-27 · **Status:** Recommendations only — none applied except the single approved dead-link fix (see phase-1-architecture-ia.md §Implementation).

> These are **product-enhancement recommendations**, prioritised by *value ÷ risk*. Each is a candidate future task that must be approved + flag-safe before any code changes. Nothing here blocks launch.

---

## A. Better product organization
**Finding:** The platform offers ~7 named products (LBI™, Exam Ready™, Competency Intelligence™, Career Builder, Workforce Intelligence, MetryxAI, Mentor Marketplace) but the marketing megamenu groups them by *internal theme* (Intelligence / Products / Solutions / Competency Intelligence), causing the same product to appear in 3–4 menus.
**Recommend:** Reorganise the top nav by **audience/outcome**, not internal naming:
- *For Individuals* (Career Builder, Exam Ready, MetryxAI)
- *For Educators* (K-12, Coaching, EdTech, Mentor Marketplace)
- *For Employers* (Talent Assessment, Campus Recruit, Workforce Analytics)
- *For Enterprise* (Competency Intelligence, Workforce OS, L&D Integration)
- *Resources* · *Company*
**Risk:** Low (config-only in `Navbar.tsx`). **Value:** High (directly fixes the "5-minute" failure).

## B. Simpler navigation
**Finding:** `competency-intelligence` is cross-listed under 4 categories; several outcomes share near-identical labels.
**Recommend:** One canonical entry per product; demote duplicates to sub-links. Collapse 7 categories → 5 (audience model above).
**Risk:** Low. **Value:** High.

## C. Better menu hierarchy
**Recommend:** Within each audience group, lead with the flagship product + one-line outcome; move engine-named items (e.g. "Benchmarking Engine") to descriptive outcome labels ("See who's ready to be promoted").
**Risk:** Low (copy/config). **Value:** Medium-High (discoverability).

## D. Module consolidation (engineering debt — defer, file as tasks)
| Item | Evidence | Recommendation | Risk |
|---|---|---|---|
| Report generators (5–6) | `report-factory`, `omega-report-builder`, `dynamic-report`, `vx-report-intelligence`, `lbi-report-generator`, `capadex-report-synthesis` | Converge assembly logic on one `ReportAssembler` over existing `pdf-renderer`/`viz-data-resolver`; keep format adapters | Medium |
| Scoring engines (6) | `competency-scoring`, `talent-scoring`, `spe-scoring-engine`, `mei-scoring-engine`, `ei-calculation-engine`, `omega-x-scoring` | Extract a shared `deriveRawScore` kernel; keep domain wrappers | Medium |
| Route proliferation (303 files) | `career-*`, `competency-*`, `talent-*`, `workforce-*` thin wrappers | Group into modular routers; shrink 14k-line `routes.ts` | Medium-High |
| `competency-memory-engine` | overlaps longitudinal | Merge into longitudinal memory | Low-Medium |
| Naming: `career-simulation` vs `career-simulations`; `*-v52` suffix | distinct live bases / thin additive layers | Rename for clarity (changes API base — coordinate callers) | Medium |

## E. Experience simplification
**Finding:** Persona routing is already clean (one scoped home per role) — **keep as-is**. No change recommended.

## F. Removal of unnecessary complexity
**Recommend:** No deletion of functionality (honesty: most "overlap" is intentional layering). Complexity reduction = *grouping & naming*, not removal. Remove only the confirmed dead menu item once its fate is decided (item in §H).

## G. Improved discoverability
**Recommend:** (1) Surface the existing `SiteMap` screen prominently in the footer/header as a "Explore all products" entry. (2) Add a short "Which product is right for me?" chooser on the landing page. **Risk:** Low. **Value:** High for first-time visitors.

## H. Better onboarding
**Finding:** Per-persona onboarding exists post-login; the gap is the **pre-login "what is MetryxOne"** moment.
**Recommend:** A single landing hero that states the one-sentence value prop + the audience chooser (§G). **Risk:** Low.

---

## Priority summary
- **Do now (approved):** dead-link fix `competency-roletransition` ✅ applied.
- **Founder decision pending:** `leadership-readiness` destination (repoint / build / remove).
- **Quick wins (low risk, high value, config-only):** A, B, C, G, H — recommend filing as one "Nav & IA simplification" task.
- **Engineering debt (defer, separate flag-safe tasks):** D.
