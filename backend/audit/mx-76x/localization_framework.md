# MX-76X · Section 7 — Localization Framework

## Current state (measured)
| Facet | Asset | State |
|---|---|---|
| Report language | `rf_language_packs`=9 (`ar,bn,de,en,fr,hi,mr,ta,te`) | Good breadth |
| UI language | `frontend/src/lib/i18n.ts` = `en` + 9 Indian langs | **No de/fr/ar/ja** → lags packs |
| Assessment language | `psychometric_question_bank` multi-lingual cols | bank empty here |
| Language policy | `m4_regional_language_policies`=5 | per-country, **not enforced** |
| Currency | hard-coded `INR`/`en-IN` (`ROIERiskPanel`, employer-portal) | **not parameterised** (G5) |
| Region/Country binding | `m4_countries.language` | present |

## Target localization axes
- **Language** — resolve effective language as: tenant override → country (`m4_countries.language` /
  `m4_regional_language_policies`) → region → platform default `en`. Report packs already keyed by
  `language_code`; UI must add the non-Indian locales that already have report packs (de/fr/ar).
- **Currency** — introduce a **country→currency resolver** (additive util, no schema churn): map
  `m4_countries.iso2` → ISO-4217 (`IN→INR, US→USD, DE/.. EU→EUR, AE→AED, JP→JPY`) + `Intl.NumberFormat`
  locale. Replace hard-coded `INR` formatters with the resolver, **defaulting to INR** so existing
  behaviour is byte-identical for India (flag `localizationV2`).
- **Region / Country** — every localized surface declares its resolution source
  (`tenant|country|region|default`) so inheritance is never mistaken for native localization.
- **Assessment localization** — gated by `m4_regional_language_policies`; where a policy or translation
  is absent → fall back to `en` and **label `untranslated`**, never silently serve English as if native.

## Honesty rules
- Currency conversion is **display formatting only** (symbol + locale grouping). The platform does NOT
  perform FX conversion of stored amounts (no FX source) → amounts stay in their stored currency,
  labelled. Faking converted figures is forbidden.
- A language with a report pack but no UI bundle is reported as `report_only`, not "fully localized".

## Verdict
Localization is **partial**: strong report-pack breadth, India-centric UI + hard-coded currency are
the real gaps. Both are fixable additively (UI bundles + currency resolver) without touching the
framework; FX conversion stays out of scope (no honest source).
