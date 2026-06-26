---
name: Input-validation pure-gate (finding #6)
description: How to add Zod request validation to backend/routes/* without breaking valid clients; the multi-session coverage effort.
---

# Input-validation hardening (security finding #6)

`backend/lib/validate.ts` exports `validate({body,params,query})` + reusable
`nonEmptyId` / `idParam` / `paginationQuery`. ~3,233 handlers across 292 route
files; this is a multi-session push to 100%. Progress tracker (the single source
of truth, NOT a follow-up task): `backend/audit/input-validation/coverage.md`.

## The rule that keeps it non-breaking

**Mirror-only required fields.** Mark a field REQUIRED in the schema ONLY when the
handler itself already requires it (its own `if (!x) return 400` / `asStr(x)===null`
check). Leave everything else out of the schema entirely.

**Why:** the existing handlers coerce permissively (`asInt`/`asStr` accept `"499"`,
numbers, garbage→default). Typing a coerced field strictly (e.g. `price_paise:
z.number()`) would newly-reject `"499"` strings the handler accepts → breaking.
A request the handler would have accepted MUST still pass the schema.

**How to apply:**
- Pure gate: `safeParse` → 400; NEVER mutate `req` (Express 5 `req.query/params`
  are read-only getters). never-throws: validator fault → `next()` (degrade, not 500).
- No `.strict()` → extra/unknown keys allowed.
- Required string fields → `z.string().trim().min(1)` (mirrors `asStr`). Required
  email fields → `.email()` — this is a DELIBERATE, documented hardening (malformed
  emails the old handler silently accepted now 400); valid requests unaffected.
- Conditional "A or B" requirements and `amount > 0` value checks: LEAVE in the
  handler (or use `.refine()` later); a flat required schema would be wrong.
- Signature-protected webhooks (Razorpay): do NOT body-gate (payload shape owned
  by the gateway; signature verify already fails closed).
- A shared route registrar (e.g. commercial-spine `transition()`) → add
  `validate({params:idParam})` ONCE to cover all its routes.

## Smoke-test proof of non-breaking
A fully-valid body must PASS the gate and reach the handler — observe the handler's
OWN downstream behaviour (e.g. capadex create-order then 500s on `invalid input
syntax for type uuid` because it casts `session_id::uuid`). That DB error coming
from the handler (not the validator) is the proof the gate passed it through.

## Coverage math caveat
`validate({` call-site count UNDER-counts covered handlers (one registrar edit
covers 6 routes). Keep the tracker conservative; report call-sites, note the fan-out.
