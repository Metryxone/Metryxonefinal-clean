---
name: WC-1A signal grounding audit
description: Can existing atomic signals be reused to ground signal-less bridge tags? Method + the rich-but-mislabelled finding.
---

# WC-1A — Signal Grounding (reuse existing signals to ground signal-less bridge tags)

Read-only follow-up to WC-1. Script `backend/scripts/audit/wc1a-signal-grounding.ts` → `audit/wc1a/`. NEVER create signals/tags/concerns.

## The core finding (durable, structural)
- **The 7.6% signal coverage from WC-1 is a LABELLING problem, not a missing-content problem.** The atomic-signal pool is semantically rich (15,972 signals · **370 families** · 20 domains) but bridge-tag-labelled into only **28 mostly catch-all buckets** — STRENGTH_SIGNAL alone = 8,970 signals across 282 families, ADJUSTMENT_COPING = 3,286 across 312 families. The vocabulary a signal-less tag needs almost always already exists, just filed under a catch-all.
- Result: **0 RED** (no tag needs new signals), 182 GREEN, 121 YELLOW, 25 already-grounded. The single biggest remediation lever is **re-pointing existing atomic signals out of the catch-all tags onto the construct tags they semantically belong to** — not authoring new signals.
- 9/10 marketed priority constructs are GREEN; only Entrepreneurship is YELLOW (entrepreneurial-risk vocabulary genuinely thin in the pool).

## Method rules (so a re-run stays honest)
- Match the TAG (tag name + its concerns' display_label/concern_cluster) against signal **FAMILIES** (370), not the 16k individual signals — families are the coherent reusable unit and give a clean path `tag → domain → family → N atomic signals`. IDF-weighted cosine over shared tokens.
- **Calibrate thresholds against ground truth, never hand-pick:** run the 25 already-grounded tags through the SAME matcher; their best-family-sim p25 (≈0.214) = GREEN floor. Candidate count must use families **≥ the YELLOW floor only** (the reuse-map CSV also shows top-3 incl. a below-floor family for analyst context — don't let those count toward classification).
- **RED=0 is "no RED under the calibrated thresholded lexical matcher," NOT absolute semantic proof.** Defend it with a sensitivity table (floor at calibrated 0.096 → grounded-min 0.128 → grounded-p10 0.173) showing how few tags flip; spot-check that weakest matches are still topically plausible. Architect will (correctly) flag any absolute "covers the whole space" wording.
- Forecasts: tag coverage 7.6%→63.1%(GREEN)→100%(+YELLOW); health 60.8→67.8→72.4 (swap ONLY the signal layer in WC-1's 8-layer mean, hold the other 7). Resolver/question-quality gains are **directional estimates** (concerns moved to grounded; questions under groundable tags) — label as not-measured, never as accuracy deltas.
