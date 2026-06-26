# MX-400 — Blockers & Path to GO

## Critical (block a full public launch)
- **[Product / Adoption & Commercial Activation]** subscription_packages is empty — nothing is purchasable.
- **[Product / Adoption & Commercial Activation]** Zero paid transactions — commercial path is unexercised end-to-end.
- **[Product / Adoption & Commercial Activation]** Real (non-demo) user count is below the adoption floor — adoption is unproven.
- **[Operations / Deployment]** No production deployment.
- **[Operations / Deployment]** Missing production secrets: OPENAI_API_KEY, ZOHO_EMAIL, ZOHO_APP_PASSWORD, MONGODB_URI.
- **[Knowledge Completion (content depth)]** Content depth far below launch threshold; authoring source absent.
- **[Assessment Quality (approval coverage)]** Approved question coverage far below competency count.

## Conditions (must clear, but can be staged)
- **[QA / Functional Readiness]** Zero real assessment runs — functional E2E behaviour is asserted by code, not demonstrated by usage.
- **[Security]** ZOHO_EMAIL / ZOHO_APP_PASSWORD absent — MFA codes cannot be emailed in production (login would be unrecoverable for real users).
- **[UX / UI Quality]** No live usability/accessibility validation under real traffic (static scan only).
- **[Outcome Confidence (empirical calibration)]** No realized outcomes — outcome chain is empty (crosswalk flag off AND behavioural spine unpopulated).

## Concrete path to a full GO
1. Deploy to a production environment and configure all required secrets (OPENAI_API_KEY, ZOHO_EMAIL, ZOHO_APP_PASSWORD, MONGODB_URI).
2. Seed and actually sell the commercial substrate: subscription_packages populated, at least one real paid transaction exercised end-to-end.
3. Author behavioural-indicator content depth across the competency genome (OPENAI_API_KEY or SME) — lift Knowledge Completion from ~3% toward launch threshold.
4. Drive real assessment usage so the intelligence runtime is exercised on live data (sessions + responses > 0).
5. Accumulate ≥30 realized prediction→outcome pairs per outcome type to lift Outcome Confidence out of ABSTAIN (enable FF_WC3_OUTCOME_CROSSWALK and populate the behavioural spine).
6. Run a live usability + accessibility validation under real traffic (beyond the static UI scan).

## Honest note on the structural-vs-functional split
Prior certifications are each internally honest within their own frame: a *structural* cert can
read "complete" (the machinery exists) while a *launch* cert reads NO-GO (the machinery has no
real data and is not deployed). MX-400 does not contradict them — it certifies the dimension that
matters for a public-launch decision: **can a real customer sign up, pay, complete a flow, and
receive a trustworthy result in production today?** The answer, on the evidence, is no.
