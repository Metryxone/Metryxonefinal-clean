# MX-76X — Founder Report: Is MetryxOne globally deployable?

Plain-language answers, honesty-first. Where something doesn't exist, this report says so — it does
not round a gap up to a win.

---

### 1. Can we sell MetryxOne to a customer outside India today?
**Partly.** For the US, Germany, UAE and Japan we can present a *localized country context* (how that
country's workforce, leadership style, culture and currency differ) layered on top of our global
competency engine. India is unchanged. But the *measurement underneath* (competency models, benchmarks,
role profiles) is still global/inherited — it is not yet authored natively per country. So: deployable
as an India-grade product with a credible global wrapper, **not** as a fully country-native product.

### 2. What actually works globally right now vs what is India-only?
**Works globally:** 7 canonical regions with a reconciled map, region demand/overlay content for
ME/EU/US/APAC, country localization for 5 countries, multi-language reports (9 languages), currency
display. **India-only / India-default:** the core competency genome and role library are the India
baseline that other regions *inherit*; the UI language bundles are India-centric.

### 3. Is the non-India data real, or did we fabricate it to look global?
**Real or explicitly empty — never fabricated.** AFRICA and LATAM show as **empty** because they have
no content. Country benchmarking shows **"Not Measurable"** because there is no large-enough country
cohort. Role DNA per country shows **"no region-specific data — showing universal."** We chose honesty
over a good-looking but fake dashboard.

### 4. What does a US or EU customer literally get?
A career/competency assessment driven by the global engine, **framed** by their country's workforce
profile, leadership model, cultural norms and currency, with region-level demand signals. For
employers, country context is shown as **advisory decision-support** — never a changed hire/no-hire
score, and never a country-calibrated probability we can't back.

### 5. What's missing to be *truly* global?
Region-native competency/role content (today it's inherited), country-level benchmarks (need cohort
volume), per-country Role DNA (needs licensed labour-market data), AFRICA/LATAM content, real tenant
provisioning, broader UI languages, and FX conversion. None require a rebuild — they are content +
data-acquisition + a few wiring steps.

### 6. Did these changes put anything existing at risk?
**No.** Everything is behind a flag that is **OFF by default**. With the flag off, the app is
byte-identical to today — same screens, same APIs, same database schema (we added zero tables). We
verified the new endpoints return "disabled" before touching the database. Fully reversible.

### 7. How much of "global" is real capability vs marketing?
Honest split: the **mechanism** (the plumbing to be global) is broadly **present and live**; the
**content depth** is **shallow** (5 of 7 regions, 5 countries, 0 tenants, no native role data). We are
certifying **PARTIAL** for exactly this reason.

### 8. What's the official certification status?
**PARTIAL** — Mechanism PRESENT, Content SHALLOW. One dimension (SuperAdmin console + reversibility)
is **PASS**; two (Role DNA per country, multi-tenant) are honestly **NOT ACTIVATED**; the rest are
**PARTIAL**. Full scorecard in `global_certification.md`.

### 9. What did we deliberately NOT do, and why?
We did **not** create empty tables to inflate the numbers, did **not** wire region benchmarks into the
live resolver (would risk existing benchmark consumers — staged as a follow-up), did **not** fabricate
country Role DNA or FX rates, and did **not** modify the employer/candidate app shells (their panels
are design-complete and staged). Each omission is documented, not hidden.

### 10. What's the shortest path to "fully global"?
1) Author region-native competency/role overlays (we inherit today). 2) Add AFRICA + LATAM content.
3) Flip on region benchmarking (cohorts already exist). 4) Acquire per-country labour data → country
Role DNA. 5) Provision real tenants. 6) Expand UI languages + add FX. Every step is additive on top
of what shipped here — no re-architecture.

---

**Bottom line:** MetryxOne is now *globally deployable in mechanism* and *India-grade in depth*, with a
fully reversible, flag-gated activation layer and an honest SuperAdmin view of exactly where the
content is and isn't. The remaining work is content and data acquisition, not engineering rework.
