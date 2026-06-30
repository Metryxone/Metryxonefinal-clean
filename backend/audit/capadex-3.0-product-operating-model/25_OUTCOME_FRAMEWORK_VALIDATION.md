# 25 · Outcome Framework Validation

Validates whether CAPADEX measures realized business/customer **outcomes** (not just produces reports).

## Outcome surfaces (repo-evidenced)
| Surface | Engine | Status |
|---|---|---|
| Outcome projection | WC-3 L5C outcome projection (Question→BridgeTag→Construct→OutcomeModel) | **IMPLEMENTED (projection)** |
| Outcome models | seed rows by `model_key` (outcomes/journeys) | **PARTIAL (seed-thin)** |
| Outcome Intelligence Activation (MX-102X) | composer over 6 realized-outcome types | **IMPLEMENTED (flag-gated, abstains <k_min)** |
| Realized outcomes (hired/placed/etc.) | requires runtime adoption | **MISSING (no live data)** |
| Outcome attribution | attribution drift (per-metric) | **PARTIAL** |
| Recommendation effectiveness | acceptance_rate / effectiveness | **MISSING (honest-null)** |

## Findings (honest)
- **The outcome *machinery* exists** (projection, models, activation composer, attribution) — but it is
  **front-loaded**: it can *project* and *abstain*, but cannot yet *measure realized outcomes* because there is
  **no live adoption data** pre-launch. Abstention <k_min=30 is correct, not a defect.
- **This is the single most consequential gap for "enterprise-ready" claims:** an enterprise buyer asks "does
  it change outcomes?" and the honest answer today is **"we measure inputs and project outcomes; realized-
  outcome evidence is not yet captured."** (GAP-O1)
- **Production-confidence is therefore WITHHELD (null)** across this entire audit — by design, not by failure.
  Outcomes ≠ reports; the platform correctly refuses to claim outcomes it hasn't observed.

## Verdict
**Outcome framework: BUILT but UN-REALIZED.** Coverage of *outcome machinery* is good; coverage of *realized
outcomes* is zero-but-honest. The Tier-1 enhancement is **instrument realized-outcome capture + recommendation
effectiveness feedback** (GAP-O1) — this is what converts Managed→Intelligent maturity post-launch. No
fabrication; null≠0 honored.
