# MX-76X · Section 12 — Employer Global UI

**Surface:** Employer portal → new tab "Global Context" (flag-gated). **Data:**
`GET /api/global-intel/regions`, `/countries`, `/country/:iso2`, `/benchmarks` (auth-gated; any
logged-in employer). **Visibility:** tab rendered only when `GET /api/global-intel/enabled` →
`res.ok` (flag-OFF → tab hidden → byte-identical).

## Status: **DESIGN-COMPLETE (wiring staged)**
The endpoints this panel consumes are live and verified. The panel component is specified below; its
wiring into the employer shell is staged as a follow-up so the employer shell is not modified without
approval. Until then the employer experience is **byte-identical** (no new tab).

## Capabilities surfaced
1. **Region/Country selector** — choose a canonical region + (optional) localized country to frame
   candidate evaluation. Countries outside the localized 5 show `not_localized` and fall back to the
   region/global frame (labelled).
2. **Country hiring context** (`/country/:iso2`) — workforce profile, leadership model, cultural
   norms, competency expectations — rendered as **advisory context**, NOT as a changed hiring score.
   Banner: *"Country context is advisory; the calibrated match probability is global/region-calibrated.
   This is decision-support, not a hire/no-hire verdict."*
3. **Regional benchmark** — when a region cohort resolves (`/benchmarks`), show the candidate vs the
   regional cohort, **k-anonymity suppressed** below `k_min` ("Cohort too small — suppressed"). Country
   comparison shows **"Not Measurable."**

## Honesty rules
- No country-native calibration → predictions stay global/region; country layer = `country_context_advisory`.
- Demand at country granularity is a **region proxy** (labelled), never country-native.
- All outputs are developmental/decision-support signals (language policy preserved).
- Empty/absent → "Insufficient Evidence", never a fabricated metric.
