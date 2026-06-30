# 1 · Enhancement Inventory (master list — canonical ID ledger)

This is the **single source of truth** for enhancement IDs and their canonical priority. Matrices 02–11
elaborate evidence; `12_PRIORITIZED_ENHANCEMENT_BACKLOG.md` sequences these exact IDs. Where a matrix lists a
cross-reference ID (e.g. `UXE-8`, `PE-6`) it is an **alias** of a canonical row here, not a separate item
(see footnotes). **All are enhancement-only** (no redesign, no new architecture, no business-logic change).

| ID | Enhancement | Source matrix | Priority |
|---|---|---|---|
| **Assessment** ||||
| AC-1 | Explicit Exit / pre-vs-post **growth assessment view** (composes existing sequential runs) | 04 | High |
| AC-2 | Strengthen coding/MCQ surfacing (no live sandbox — honest) | 04 | Medium |
| AC-3 | Employability Studio retest loop on existing substrate | 04 | Medium |
| OV-1 | Document canonical CAPADEX⟂SDI separation (do not merge) | 04 | Low |
| OV-2 | Deprecate older adaptive variants (keep V2) | 04 | Medium |
| **Persona** ||||
| PC-1 | Promote **Faculty** to first-class dashboard *(cross-listed as UXE-8 in 07)* | 03 / 07 | Medium |
| PC-2 | Optional explicit Psychologist/Counsellor clinical lens | 03 | Low |
| PC-3 | Honest "no cohort yet" states for data-dependent persona surfaces | 03 | Medium |
| PC-4 | Clarify Executive/Manager self-serve vs enterprise packaging | 03 | Low |
| **Journey** ||||
| CJ-1 | Close the **assess → intervene → re-test → growth → completion** loop | 05 | High |
| CJ-2 | Honest empty states across data-dependent stages | 05 | High |
| CJ-3 | Persona-routed journey continuity (no dead-ends) | 05 | Medium |
| CJ-4 | Progress nudges/notifications (existing background infra) | 05 | Medium |
| **AI** ||||
| AIE-1 | Consistent degradation for `aiTestGenerator.ts` (fallback/503) | 06 | High |
| AIE-2 | Normalize audio-client hardcoded "missing" key → 503 | 06 | Low |
| AIE-3 | **AI quality-measurement harness** (uses existing governance tables) | 06 | High |
| AIE-4 | Uniform confidence+evidence across ALL AI surfaces | 06 | Medium |
| AIE-5 | Prompt/model provenance in every AI output | 06 | Medium |
| AIE-6 | AI timeouts + budget caps *(cross-listed as PE-6 in 08)* | 06 / 08 | Medium |
| AIE-7 | Personalization-depth audit (real per-entity keys) | 06 | Medium |
| **UX** ||||
| UXE-1 | Decompose Employer/Career monoliths + route code-split | 07 | High |
| UXE-2 | **WCAG 2.1 accessibility pass** | 07 | High |
| UXE-3 | Mobile QA pass on heavy portals | 07 | Medium |
| UXE-4 | Bundle reduction (>1 MB chunks; follow-on to PE-1) | 07 / 08 | Medium |
| UXE-5 | Reports → customer-ready polish (16 builders, white-label) | 07 | Medium |
| UXE-6 | Navigation consistency audit | 07 | Medium |
| UXE-7 | Empty/loading/error-state consistency | 07 | Medium |
| **Performance** ||||
| PE-1 | Code-split >1 MB route bundles | 08 | High |
| PE-2 | **Standardized load-test gate** (perf is null until measured) | 08 | High |
| PE-3 | DB index / N+1 review on hot paths | 08 | Medium |
| PE-4 | Extend response caching consistently | 08 | Medium |
| PE-5 | Horizontal-scale readiness check | 08 | Medium |
| PE-7 | Build-time chunk-size budget alert | 08 | Low |
| **Security** ||||
| SE-1 | **Production demo-mode / placeholder-credential lockout** | 09 | **Launch Critical** |
| SE-2 | Run security scan suite + triage criticals/highs | 09 | **Launch Critical** |
| SE-3 | Remove residual hardcoded secrets in latent/mirror code | 09 | High |
| SE-4 | Secret-rotation evidence | 09 | Medium |
| SE-5 | Pentest / threat-model refresh | 09 | Medium |
| SE-6 | Multi-tenant isolation tests as a CI gate | 09 / 10 | Medium |
| SE-7 | **DPDP / minor-consent completeness audit** | 09 | **Launch Critical** |
| **Technical debt** ||||
| TD-1 | Decompose monoliths (routes.ts 14.5k + portals) | 10 | High |
| TD-2 | **CI + coverage gate** | 10 | High |
| TD-3 | Resolve parallel `-v2` versions | 10 | Medium |
| TD-4 | Canonicalize schema (1,441 vs 134) | 10 | Medium |
| TD-5 | Trim `replit.md` | 10 | Low |
| TD-6 | Dependency hygiene | 10 | Low |
| TD-7 | Dead-code / orphan sweep | 10 | Low |

**Total: 47 canonical enhancements** across 8 domains.
**Priority distribution: 3 Launch-Critical · 12 High · 24 Medium · 8 Low.**

### Footnotes — aliases & non-backlog labels (to prevent orphan-ID confusion)
- **`UXE-8` (in 07)** = **PC-1** (Faculty first-class). One enhancement, cross-listed under both Persona and UX; counted once as PC-1.
- **`PE-6` (in 08)** = **AIE-6** (AI timeouts + budget caps). One enhancement, cross-listed; counted once as AIE-6.
- **`AC-4` (in 04)** is an **observation** ("lifecycle is exit-light"), not a separate item — its action is **AC-1**. Excluded from the ledger.
- **`OV-3` (in 04)** is an **observation** (hiring engine composes scores = good design) — not an enhancement. Excluded.
- **`CE-1…CE-4` (in 02)** are **cross-capability themes**, not backlog IDs — they group canonical items, they are not counted as enhancements.

Full ranking, tiers, and the program's core-question answer in `12_PRIORITIZED_ENHANCEMENT_BACKLOG.md`.
