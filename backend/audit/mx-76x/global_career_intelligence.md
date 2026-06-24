# MX-76X · Section 10 — Global Career Intelligence

**Constraint:** compose existing Career Builder / Career Intelligence (Phase 4.x) + Future Readiness +
mobility engines. Add geography as an inherited dimension; do not rebuild.

## Capabilities
| Capability | Built on | State |
|---|---|---|
| Country Career Paths | `m4_regional_competency_expectations` + role/competency tiers per country | shallow (5 countries) |
| Regional Career Paths | `global_region_content` role/competency overlay + `wos_market_signals(geo)` | partial-native (4 regions) |
| Global Career Mobility | existing mobility engine (`mobility-engine.ts`) + benchmark tiers | global today |

## Country career path (read-time)
A career path for `(role, country)` = existing readiness/gap/roadmap composition **+** country
expectation overlay:
- competency bar from `m4_regional_competency_expectations` (inherit region→global if absent, labelled).
- demand signal from `wos_market_signals` filtered to the region (no country granularity → region
  proxy, labelled `region_proxy`).
- leadership/culture framing from `m4_regional_leadership_models` / `m4_cultural_behavioral_norms`.

## Global mobility
Mobility (role→role transferability) is **geography-agnostic** today (competency-distance based) and
that is honest — competency transferability does not inherently change by country. Where a country has
a distinct competency expectation, the *gap to target* shifts; the *transferability* does not. Surface
mobility globally; annotate the country-specific gap delta where country data exists.

## Honesty rules
- Country career paths inherit upward where country data is absent (5 countries native, rest inherit)
  → every node labelled `native|inherited|region_proxy`.
- Demand at country level is a **region proxy** (no country market signals) — never presented as
  country-native.
- Mobility percentages are developmental signals, not relocation/visa advice (language policy
  constraint preserved).

## Verdict
Global career intelligence = **composable now**: mobility is genuinely global; country/regional paths
exist as inherited+partial-native overlays for the 5 countries / 4 regions, honestly labelled.
