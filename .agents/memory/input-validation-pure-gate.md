---
name: Input-validation pure-gate (finding #6)
description: How to add Zod request validation to backend/routes/* without breaking valid clients; the multi-session coverage effort.
---

# Input-validation hardening (security finding #6)

`backend/lib/validate.ts` exports `validate({body,params,query})` + reusable
`nonEmptyId` / `idParam` / `paginationQuery`. ~3,233 handlers across 292 route
files. Progress tracker (the single source of truth, NOT a follow-up task):
`backend/audit/input-validation/coverage.md`.

## Reaching 100% honestly — two layers (don't hand-write 3,233 schemas)

Bespoke per-field schemas for ALL 3,233 handlers is NOT feasible non-breakingly
(every handler requires different fields; getting a few wrong breaks valid clients
→ violates the byte-identical rule). So 100% coverage is delivered in TWO layers:

- **Layer 1 — universal baseline (100%).** `globalInputHardening()` in
  `lib/validate.ts`, mounted ONCE in `index.ts` app-wide AFTER the body parser +
  existing security mw (helmet/requestId/antiEnum). Recursively scans every
  request body+query and rejects ONLY universal invariants no legit client uses:
  `__proto__` key at any depth (prototype pollution), NUL byte `\u0000` in any
  string / the URL path (Postgres `text` can't store it → would 500 anyway), and
  structural-DoS bounds (depth>32 or >100,000 nodes). never-throws → next().
  Because it's app-level, it covers 100% of handlers with ONE mount.
- **Layer 2 — targeted deep schemas.** The bespoke `validate({...})` per-field
  schemas (below) on the high-risk write surface. Optional defense-in-depth.

**Why:** "honesty over optimism" — call it "100% baseline + targeted deep", never
"100% per-field". **Non-breaking calls:** deliberately did NOT block `constructor`
/`prototype` keys (only `__proto__`) because JSONB metadata fields could legit
carry them; the node/depth caps ARE a bounded behaviour change (pathological-but-
valid huge JSON now 400s) — document it, don't claim "never affects valid traffic".

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

## Layer-2 trap: flag-skip / early-200 precedes the required-field check
When adding a middleware `validate({...})` with a REQUIRED field, confirm the
handler doesn't have an EARLIER success path that returns 200 before its own
required-field check. Example: `signals/ingest` returns `{ok,skipped}` 200 when the
flag is OFF, BEFORE checking `session_id`. A middleware required-`session_id` gate
would turn that flag-off 200 into a 400 → breaks byte-identical flag-off. Fix: leave
that field's check in-handler (defer the schema), document the reason in the tracker.

**Why:** middleware runs before the whole handler, so it also runs before an
early-return skip/short-circuit the handler does for flag-off or no-op cases.

**How to apply:** before wiring a required-field schema, grep the handler for an
early `return res...200` (flag check, skip, idempotent no-op) that precedes the
`if (!field) 400`. If one exists, the field is only conditionally required → defer.

## Truthy (not typed) required fields
Some handlers gate on `!x` (truthy), accepting string OR number (e.g. telemetry
`question_id` can be `"q1"` or `5`). Mirror with a `.refine(b => !!b.x && !!b.y)`
over `z.any().optional()` fields — NOT `z.string()`, which would reject the numeric
form the handler accepts. `z.coerce.string()` is also wrong here (it turns `0` into
`"0"`, but `!0` is true → handler 400s on `0`). The refine reproduces `!x` exactly.
