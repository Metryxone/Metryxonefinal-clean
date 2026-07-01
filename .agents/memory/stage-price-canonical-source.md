---
name: Stage price canonical source
description: Where CAPADEX stage prices live and which copies can still drift.
---
## Rule
The per-stage prices of the purchasable CAPADEX ladder are defined ONCE in
`backend/config/stage-pricing.ts` (`STAGE_PRICES` = {CAP_INS:499, CAP_GRW:999,
CAP_MAS:1999}, `PURCHASABLE_LADDER` = ['CAP_INS','CAP_GRW','CAP_MAS']). The three
runtime consumers import it: `routes/capadex-payments.ts` (Razorpay order amount),
`services/wc7c/subscription-engine.ts` (imports PURCHASABLE_LADDER as LADDER),
`services/wc7c/upsell-engine.ts` (same). No more "keep in lockstep" copies among these.

**Why:** the price table used to be hand-copied into all three with lockstep
comments; a change in one that missed the others would charge/quote the wrong amount.

`backend/scripts/wc-c7/wc-c7-audit.ts` now also imports STAGE_PRICES/PURCHASABLE_LADDER
(its `LADDER`/`LADDER_PRICES` are assigned from them) so the audit can't validate against
stale numbers. Note: the audit's prose Markdown report tables still contain literal
₹499/₹999/₹1,999 as human-readable copy — not validation constants.

## Still-drifting copies (NOT yet unified — outside the backend-only unification)
- `frontend/src/lib/behavioural-insights.ts` CAPADEX_STAGES hardcodes ₹499/₹999/₹1,999.
  The Vite frontend CANNOT import backend modules, so FE display vs BE charge can drift.
Curiosity (CAP_CUR) is free / not a purchasable rung → no price, absent from ladder.
