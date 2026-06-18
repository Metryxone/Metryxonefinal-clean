# MetryxOne — Founder Priority Brief

**Task:** MX-LAUNCH-98X-CRITICAL-BLOCKERS · 18 June 2026
**Nature:** Synthesis of *existing* audit findings — no new audit, scoring, or measurement. Honesty contract: Structural / Activation / Validity kept separate; null/absent ≠ 0; seeded ≠ computed ≠ validated.
**Companions:** `launch_blockers_top20.md` (detail + root cause), `launch_execution_backlog.md` (implementation), `launch_quick_wins.md`.

---

## The one-paragraph truth

The platform is **structurally rich and activation-poor**. The code for Competency, Employability Index, Career Builder, Career Passport, Jobs and Employer surfaces largely exists — but in the live shared DB the headline metric is unwritten (`mei_scores=0`), the competency bank and ontology are empty (`competency_question_templates=0`, `ont_*=0`), the employer ATS has **no backend** (6 endpoints 404), workforce routes are **unauthenticated with an IDOR**, there are **zero realized outcomes** anywhere (so nothing is validated), some dashboards show **fabricated `Math.random()` numbers**, and **production runs with the advanced flags OFF** so the shipped app silently differs from the demo. None of these are opinions — each is a cited finding from prior audits. The path to 95–98% is not "build more features"; it is **activate, secure, monetize, and start the validity loop** on what already exists.

---

## Top 20 blockers (ranked)

1. **B01** Prod runs with advanced flags OFF (dev ≠ prod)
2. **B02** Employability Index computes/persists zero scores
3. **B09** Employer ATS backend missing (6 endpoints 404)
4. **B10** Employer/workforce routes unauthenticated + IDOR
5. **B13** No commercial substrate / monetization unit
6. **B11** No employer accounts / orgs / auth / commercial tier
7. **B12** Job Ecosystem has no real jobs (static fallback)
8. **B03** EI integrity defect — gauge ≠ breakdown
9. **B14** Fabricated runtime metrics (`Math.random()`)
10. **B20** Operational/safety hardening (crisis notify, rate-limit, email SPOF)
11. **B18** Real users ≈ 0; demo data in shared prod DB (purge pre-launch)
12. **B04** Zero realized outcomes (no validity possible)
13. **B05** Live competency question bank empty
14. **B08** Recommendations don't reach users (≈8 vs 101)
15. **B17** No snapshot scheduler → no longitudinal history
16. **B16** Career Passport off in prod + `cp_*` lazy
17. **B19** Behavioural spine empty → outcome/journey zero-state
18. **B15** Resume Studio localStorage-only
19. **B06** Competency ontology not imported (O*NET/ESCO)
20. **B07** Benchmarks provisional everywhere (k<30)

---

## Top 10 must-fix BEFORE launch (non-negotiable)

> Launch-blocking because each, on its own, makes the shipped product broken, unsafe, dishonest, or unsellable.

1. **B01** — align prod flags (else the shipped app isn't the product).
2. **B10** — close the employer IDOR + add auth (security review fails otherwise).
3. **B02** — compute & persist EI (the headline metric must exist).
4. **B03** — one EI number, not two (visible trust defect).
5. **B14** — no unlabelled fabricated numbers reach customers (honesty contract).
6. **B09 + B11 + B12** — a minimally real employer + jobs path (or **descope** the employer/jobs config for v1 and say so explicitly).
7. **B13** — at least one real sellable SKU with live payments (or launch free and say so).
8. **B18** — purge demo data from the shared prod DB.
9. **B20 (subset)** — crisis human-notify + OTP/login rate-limit + MFA recovery.
10. **B16** — Career Passport visible in prod (flag + schema) if it's in the v1 story.

**Founder decision required:** items 6 and 7 are large (XL). The honest choice is **scope vs schedule** — either (a) commit ~4–6 weeks to ship the employer+jobs+commerce chain, or (b) **launch the seeker side (Competency → EI → Career Builder → Passport) first** and ship Employer/Jobs as a fast-follow. The audits support a credible seeker-first launch far sooner than a full-chain launch.

---

## Top 10 by REVENUE impact

1. **B13** No monetization unit → no revenue at all.
2. **B11** No employer accounts/tier → entire B2B line absent.
3. **B09** Employer ATS missing → employer product can't function (can't sell what 404s).
4. **B12** No real jobs → no marketplace monetization.
5. **B02** No EI scores → the core value prop is unsellable.
6. **B16** Passport off → blocks passport-led B2B2C.
7. **B08** Recs not surfaced → weakens the conversion hook.
8. **B05** Empty question bank → competency not a defensible paid product.
9. **B04** No outcomes → caps willingness-to-pay for serious buyers.
10. **B07** No benchmarks → comparative/premium tier has nothing to sell.

## Top 10 by EMPLOYER impact

1. **B09** ATS 404 — employers can't post or manage.
2. **B10** IDOR/unauth — fails any security review.
3. **B11** No accounts/orgs/billing — can't onboard or isolate employers.
4. **B12** No live jobs — nothing to recruit against.
5. **B14** Fabricated workforce metrics — employers shown synthetic intelligence.
6. **B16** Passport not consumable — can't verify candidates.
7. **B07** No norms — no population to screen against.
8. **B02** No EI — nothing to screen on.
9. **B18** Demo data — employers would see fake candidates.
10. **B06** No ontology — no interoperable taxonomy.

## Top 10 by CUSTOMER (seeker) impact

1. **B01** Features vanish in prod.
2. **B02** No employability score to act on.
3. **B03** Two conflicting scores erode trust.
4. **B08** Profile but no guidance.
5. **B17** No progress-over-time.
6. **B15** Resume work silently lost.
7. **B12** "Jobs" are samples; applications go nowhere.
8. **B16** Passport unavailable.
9. **B05** Thin, repetitive assessment.
10. **B19** Degraded behavioural insights.

## Top 10 QUICK WINS (detail in `launch_quick_wins.md`)

1. **B03** one EI formula · 2. **B10** auth + org scoping · 3. **B14** label/gate random metrics · 4. **B01** enable safe prod flags · 5. **B02** EI backfill for 101 profiles · 6. **B08** persist/surface recs · 7. **B17** snapshot scheduler · 8. **B15** server-side resume · 9. **B12** bootstrap `employer_jobs` + POST route · 10. **B20** crisis notify + rate-limit.

---

## Final 30-day ranked implementation actions

> Ranked by impact × unblocking power. Effort: XS/S/M/L/XL. Assumes seeker-first launch with employer/commerce as the parallel track — adjust per the founder decision above.

**Days 1–3 — trust, security, honesty (no dependencies)**
1. B03 — reconcile EI gauge to `employabilityEngine.ts` (S)
2. B10 — auth + server-side org scoping on `/api/m5` & `/api/career/workforce` (S)
3. B14 — flag + "illustrative, not live" label on every `Math.random()` surface (S–M)
4. B18 — write & dry-run the prod demo-purge script (S; execute at launch gate)

**Week 1–2 — make the core metric real & visible**
5. B02 — batch-compute + persist EI for all 101 profiles (M)
6. B17 — nightly append-only snapshot scheduler (M)
7. B08 — persist & surface recommendations for all profiled users (M)
8. B01 (wave 1) — enable the safe display/intelligence flags in prod (S)
9. B15 — server-side Resume Studio store (M)
10. B20 (subset) — crisis human-notify + OTP/login rate-limit + MFA recovery (S–M)

**Week 2–4 — employer + jobs chain (parallel track / fast-follow)**
11. B11 — employer accounts, orgs, seats, employer SKU (XL)
12. B09 — build `/api/employer/*` ATS backend (XL)
13. B12 — `employer_jobs` write path + candidate import/stage + live job reads (L)
14. B10 (final) — org-ownership checks across the new employer surface (S)
15. B16 — Career Passport on in prod + `cp_*` schema + employer consumption (M)

**Week 3–4 — monetization**
16. B13 — sellable packages + Razorpay live + entitlement enforcement (L)
17. B01 (wave 2) — enable commercial/enforcement flags once substrate exists (S)

**Ongoing / post-launch — validity & depth (population-bound; cannot be rushed)**
18. B04 — stand up realized-outcome capture (begin now; validity accrues later) (L)
19. B19 — populate behavioural spine / enable crosswalk; stop journey over-claim (M)
20. B05 — seed & govern the live competency bank (L, content-bound)
21. B06 — import O*NET/ESCO ontology, curated subset first (L)
22. B07 — benchmarks auto-compute as cohorts cross k=30 (population-bound)

**Launch gate (must all be true before deploy):** every Category-A blocker cleared or explicitly descoped; B18 purge executed; B14 shows no unlabelled fabricated metric; B20 safety subset live; prod flag parity verified. **STOP for approval — no deploy.**

---

## Honesty caveats (so this brief isn't misread)
- These are **synthesized from prior audits**, not re-measured today. Where an audit may be stale (e.g. some `/api/m5` auth may have been added since EP-X1A), the backlog flags "re-verify before sizing."
- **B04/B07** cannot reach "validated/world-class" within 30 days — they need real outcomes and real volume. Anyone promising validated predictive accuracy at launch would be violating the honesty contract.
- "Quick win" never means "finishes the product" — e.g. bootstrapping `employer_jobs` (B12 quick win) opens the chain but the employer product still needs the XL B09/B11 work.
