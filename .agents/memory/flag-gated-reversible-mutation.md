---
name: Flag-gated reversible mutations gate BOTH directions
description: A sub-flag that gates a reversible state mutation (arm/disarm, enable/disable, enroll/withdraw) must gate the REVERSE endpoint too, not just the forward one.
---

# Flag-gated reversible mutations must gate both directions

When a feature sub-flag gates a reversible state mutation, gate **every** endpoint
that mutates that state — both the forward action (arm / enable / opt-in) AND the
reverse action (disarm / disable / opt-out).

**Why:** Gating only the forward endpoint lets state still be mutated while the
sub-flag is OFF, which breaks the byte-identical-OFF guarantee. A reviewer caught
exactly this in the multi-tenant isolation enforcement console: `arm` was gated by
`tenantIsolationEnforcement` but `disarm` was not, so RLS state could be flipped
with the sub-flag OFF.

**How to apply:** For any pair like arm/disarm, enable/disable, subscribe/cancel
behind a feature sub-flag, copy the identical `if (!isFlagEnabled()) return 503`
guard onto BOTH handlers. The "restore to legacy" / reverse path feels safe and is
easy to forget, but it is still a write. Operators must disarm BEFORE turning the
flag off; the flag-OFF state must not itself be a mutation surface.
