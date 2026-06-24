# MX-76X · Section 13 — Candidate Global UI

**Surface:** Career Builder → new "Global" affordance (flag-gated). **Data:**
`GET /api/global-intel/regions`, `/countries`, `/country/:iso2`, `/localization`, `/role-dna/:roleId`
(auth-gated). **Visibility:** rendered only when `GET /api/global-intel/enabled` → `res.ok`
(flag-OFF → hidden → byte-identical).

## Status: **DESIGN-COMPLETE (wiring staged)**
Endpoints are live and verified. The candidate component is specified below; wiring into the Career
Builder monolith is staged as a follow-up to avoid unapproved churn in `CareerBuilderPage.tsx`. Until
then the candidate experience is **byte-identical**.

## Capabilities surfaced
1. **Region/Country context picker** — candidate selects a target region/country to localize their
   career view. Non-localized countries fall back to region/global (labelled), never silently.
2. **Localized career path** — competency bar from country expectation (inherit region→global if
   absent, labelled `inherited`); demand from region market signals (labelled `region_proxy`);
   leadership/culture framing from the country profile.
3. **Global mobility** — role→role transferability shown globally (geography-agnostic, honest);
   country-specific *gap delta* shown only where country data exists.
4. **Localization** — display language + currency resolved per country (currency is display-only, no
   FX); `report_only` languages flagged where a report pack exists but no UI bundle.
5. **Role DNA** (`/role-dna/:roleId`) — shows base (universal) DNA; **`variant: null`** is rendered as
   *"No region-specific role data available — showing universal role DNA"* (honest, never fabricated).

## Honesty rules
- Inheritance always labelled (`native` / `inherited` / `region_proxy`).
- `variant:null` is a first-class, explained state — not an error, not faked.
- Mobility/career outputs are developmental signals, NOT relocation/visa advice.
- Absent → "Insufficient Evidence", never a fabricated value or a `0`.
