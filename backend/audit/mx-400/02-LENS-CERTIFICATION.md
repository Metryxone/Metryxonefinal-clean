# MX-400 — Lens Certification (QA · Product · Architecture · Security · UX · Operations)

Each lens is judged on independently gathered evidence with thresholds defined in code.

## Architecture / Platform Implementation (structural) — 🟢 READY

**Assessment:** STRUCTURAL axis only: the machinery is extensive and the data layer is reachable. This is independent of — and must NOT be read as — launch readiness; the overall verdict and the functional/data axes are reported separately.

**Evidence:**
- public tables = 1397
- DB connects = true
- prior structural cert (mx-301j) present = true

## QA / Functional Readiness — 🟡 CONDITIONAL

**Assessment:** App builds and serves (mechanically functional), but end-to-end intelligence flows are UNPROVEN with real data: there is no completed assessment activity to exercise the runtime.

**Evidence:**
- frontend build artifact present = true (built 2026-06-26T03:32:26.935Z)
- real assessment activity (sessions+responses) = 0
- capadex_sessions = 0, capadex_responses = 0

**Blockers:**
- Zero real assessment runs — functional E2E behaviour is asserted by code, not demonstrated by usage.

## Product / Adoption & Commercial Activation — 🔴 NOT READY

**Assessment:** No real adoption and no commercial substrate. A SaaS product cannot be certified launch-ready for public use with no buyable packages and no transactions.

**Evidence:**
- real (non-demo) users = 1 of 4 total
- non-demo employer candidates = 0 of 41 total (rest are demo seeds)
- subscription packages = 0
- paid transactions = 0

**Blockers:**
- subscription_packages is empty — nothing is purchasable.
- Zero paid transactions — commercial path is unexercised end-to-end.
- Real (non-demo) user count is below the adoption floor — adoption is unproven.

## Security — 🟡 CONDITIONAL

**Assessment:** Auth/MFA hardening mechanism is certified (super-admin login always 2FA-gated, dev bypass removed). Production secret/email-delivery channel is NOT configured, so the MFA delivery path cannot complete in production.

**Evidence:**
- prior hardening cert present (wc-c10/wc-c8b) = true
- ZOHO email channel configured = false
- secrets absent = OPENAI_API_KEY, ZOHO_EMAIL, ZOHO_APP_PASSWORD, MONGODB_URI

**Blockers:**
- ZOHO_EMAIL / ZOHO_APP_PASSWORD absent — MFA codes cannot be emailed in production (login would be unrecoverable for real users).

## UX / UI Quality — 🟡 CONDITIONAL

**Assessment:** A static UI certification scan exists (design tokens / a11y / state screens). It is a structural scan, not a live human usability or full accessibility audit, and predates a real-traffic UX validation.

**Evidence:**
- UI scan deliverable present (mx-301e) = true

**Blockers:**
- No live usability/accessibility validation under real traffic (static scan only).

## Operations / Deployment — 🔴 NOT READY

**Assessment:** The platform is not deployed to a production environment and required production secrets are missing. Without a deployment and configured secrets there is nothing to launch and no production observability.

**Evidence:**
- production deployment exists = false
- required prod secrets present = false
- missing secrets = OPENAI_API_KEY, ZOHO_EMAIL, ZOHO_APP_PASSWORD, MONGODB_URI
- feature flags enabled in live workflow = 60
- FF_WC3_OUTCOME_CROSSWALK enabled = false

**Blockers:**
- No production deployment.
- Missing production secrets: OPENAI_API_KEY, ZOHO_EMAIL, ZOHO_APP_PASSWORD, MONGODB_URI.

## Knowledge Completion (content depth) — 🔴 NOT READY

**Assessment:** Competency genome breadth exists, but behavioural-indicator content depth is thin. Requires an authoring source (OPENAI_API_KEY or SME) — no machine source means it cannot be honestly fabricated.

**Evidence:**
- competencies with ≥1 indicator = 13 of 422 (3.1%)
- total indicators authored = 66
- OPENAI_API_KEY present = false

**Blockers:**
- Content depth far below launch threshold; authoring source absent.

## Assessment Quality (approval coverage) — 🔴 NOT READY

**Assessment:** Human approval is the only coverage-changing operation; approved coverage is far below the competency genome. No bulk auto-approval (would be fabrication).

**Evidence:**
- approved templates = 120 of 2665 total; competencies = 422

**Blockers:**
- Approved question coverage far below competency count.

## Outcome Confidence (empirical calibration) — ⚪ ABSTAIN (not measurable)

**Assessment:** No realized prediction→outcome pairs exist, so empirical accuracy is NOT MEASURABLE (abstains below k_min=30). This is an honest absence, not a 0% score.

**Evidence:**
- realized non-demo outcome records = 0 (k_min = 30)
- wc3_outcome_state rows = 0
- FF_WC3_OUTCOME_CROSSWALK enabled = false

**Blockers:**
- No realized outcomes — outcome chain is empty (crosswalk flag off AND behavioural spine unpopulated).
