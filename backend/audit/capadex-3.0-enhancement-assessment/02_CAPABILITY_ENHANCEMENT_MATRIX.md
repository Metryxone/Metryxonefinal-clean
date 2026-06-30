# 2 · Capability Enhancement Matrix

Per major capability: current maturity + the enhancement that raises it (no business-logic change). Maturity
scale: L1 Initial · L2 Repeatable · L3 Managed · L4 Optimizing · L5 Self-Optimizing. **Platform ceiling = L3
Managed** (human approval authoritative; no runtime/outcome evidence yet, so L4+ withheld).

| Capability | Maturity | Strength | Top enhancement | Priority |
|---|---|---|---|---|
| CAPADEX behavioral assessment | **L3** | flagship entry; honest scoring; composite pipeline | add explicit exit/re-test growth view (AC-1) | High |
| LBI (student) | L3 | longitudinal trends, age-banded | parent/faculty surfacing polish | Medium |
| Competency assessment & ontology | L3 | 12-layer ontology, runtime scoring, genome | exit/certification composition; coverage dashboards already honest | High |
| Adaptive questioning | L2–L3 | V2 contradiction probes + adaptive length | deprecate older adaptive variants (OV-2) | Medium |
| Career Builder / Launchpad | L2–L3 | rich read/gap/readiness; experience-routed | complete builder write/roadmap paths; decompose monolith | High |
| Employer / hiring | **L3 (strongest)** | full FSM, talent-match, interview intel | decompose 10k monolith; validate multi-tenant load | High |
| Reports / analytics | L3 | factory, white-label, k-anon, honest nulls | polish to customer-ready across all 16 builders | Medium |
| AI services | L3 (safe) / quality **unmeasured** | source tags, confidence, abstain | quality harness (AIE-3); consistency (AIE-1) | High |
| Recommendations / interventions | L2–L3 | confidence-scored recs | close intervention-execution loop (CJ-1) | High |
| Institutional (univ/faculty/parent) | L2–L3 | k-anon aggregation, role scope | faculty first-class; placement/accreditation need data feeds | Medium |
| Commercial / payments / entitlements | L3 | Razorpay + demo fallback, entitlement gates | disable demo-mode in prod; package→entitlement linkage | High (launch) |
| Admin / SuperAdmin | L3 | broad control tower, MFA-gated | none structural; UX consolidation only | Low |
| Platform/Enterprise meta-intelligence (MX-700/800) | L3 (dormant) | clean flag-gated read-only composers | keep OFF until runtime evidence justifies | Future |

## Cross-capability enhancement themes
> `CE-*` are **thematic groupings**, not backlog IDs — they bundle canonical enhancements (AC/CJ/AIE/UXE/TD)
> from `01_ENHANCEMENT_INVENTORY.md`. They are **not** counted as separate enhancements.

1. **CE-1 [High] Lifecycle completion** — most capabilities are strong at entry/analysis but **exit-light**;
   add compositional exit/growth views (no new engine). Touches CAPADEX, competency, career, interventions.
2. **CE-2 [High] AI validation** — every capability that uses AI shares the same "safe but unvalidated"
   status; a single quality-measurement harness (AIE-3) lifts them all.
3. **CE-3 [High] Monolith decomposition** — Employer/Career capabilities carry the same maintainability tax;
   behavior-preserving decomposition raises maturity without touching logic.
4. **CE-4 [Medium] Dormant-capability governance** — 158 OFF flags are clean and deliberate; the enhancement
   is *governance* (lifecycle engine tracks them) not activation. **Never force-on to inflate maturity.**

## Maturity honesty
No capability exceeds **L3 Managed** today, and that is correct: L4 (Optimizing) requires runtime-adoption
evidence and L5 (Self-Optimizing) requires autonomous unreviewed action — both **out of scope** and
**withheld by design**. Enhancements raise *quality within L3* and prepare the evidence needed to *measure*
toward L4 during a pilot; they do not manufacture a higher level.
