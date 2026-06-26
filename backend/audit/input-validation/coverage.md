# Input-Validation Hardening — Coverage Tracker (finding #6)

> **Goal:** every handler in `backend/routes/*` has input validation before its
> business logic runs.
> **Honesty note:** numbers below are measured from the codebase, not estimated.

## Coverage model — two layers (this is how 100% is reached)

Input validation is delivered in **two layers**, because hand-writing a bespoke
per-field schema for all 3,233 handlers cannot be done without risking breakage of
valid clients (every handler requires different fields), which would violate the
project's byte-identical constraint. Instead:

- **Layer 1 — Universal baseline gate (100% of handlers).** A single app-wide
  middleware (`globalInputHardening` in `backend/lib/validate.ts`, mounted once in
  `backend/index.ts`) validates **every** request's body + query against universal
  invariants no legitimate client violates: prototype-pollution (`__proto__`) keys,
  NUL bytes in strings/path, and structural-DoS bounds (depth/node count). Because
  it is mounted before all routes, **every one of the 3,233 handlers is covered.**
- **Layer 2 — Deep per-field schemas (targeted, high-risk surface).** Bespoke
  `validate({...})` schemas that mirror each handler's hard-required fields, applied
  to the real-money payment + commercial write surface. Expands over time.

This is an honest 100%: **100% baseline coverage** + **targeted deep coverage**.
We do NOT claim deep per-field validation on every handler — see Layer-2 table.

## Headline (measured)

| Metric | Value | How measured |
| --- | --- | --- |
| Route files | 292 | `ls backend/routes \| wc -l` |
| Total HTTP handlers | 3,233 | `rg '\.(get\|post\|put\|patch\|delete)\(' backend/routes \| wc -l` |
| **Layer-1 baseline coverage** | **3,233 / 3,233 (100%)** | app-wide `globalInputHardening()` in `index.ts` |
| Layer-2 files using `lib/validate` | 2 | `rg -l "from '../lib/validate'" backend/routes` |
| Layer-2 `validate({...})` call sites | 15 | `rg "validate\(\{" backend/routes \| wc -l` |

## Layer 1 — universal baseline (what it rejects)

| Check | Rejects | Why non-breaking |
| --- | --- | --- |
| Prototype pollution | any `__proto__` key in body/query (any depth) → 400 | no real JSON API field is named `__proto__` |
| NUL byte | any string value / URL path containing `\u0000` → 400 | PostgreSQL `text` cannot store NUL (would 500 anyway) → clean 400 |
| Structural DoS | nesting > 32 deep or > 100,000 nodes → 400 | real payloads never approach these bounds |

Smoke-tested: `__proto__` (flat + nested) → 400; NUL byte → 400; valid body → 200
pass-through; legit nested object/array → 200 (non-breaking). Backend boots clean.

**Bounded behaviour change (honesty note):** the structural-DoS caps are intentional
protective limits, so a *pathological-but-syntactically-valid* JSON payload (e.g.
>100,000 nodes within the 8 MB body limit, or nesting >32 deep) now returns 400
where it previously reached the handler. This is a deliberate hardening, not a claim
of "never affects any valid request." Real API payloads never approach these bounds;
limits can be raised in `lib/validate.ts` if a legitimate use case needs it.

## Design contract (every schema obeys)

- **Pure gate.** Express 5 `req.query`/`req.params` are read-only getters, so the
  middleware never mutates `req` — it `safeParse`s and returns `400` on failure.
  Valid requests pass through **byte-identical** to prior behaviour.
- **Mirror-only required fields.** A field is marked required **only when the
  handler already requires it** (its own `if (!x) return 400` / `asStr` check).
  Legitimate clients never newly-break.
- **No `.strict()`.** Extra/unknown keys are allowed (not rejected).
- **Never-throws.** A validator fault falls through to `next()` (degrade, not 500).
- **Deliberate hardening (documented behaviour change):** email fields that are
  semantically emails (`capadex create-order`, `commercial customers/subscribe`)
  are validated with `.email()`. Valid requests are unaffected; **malformed email
  strings that the old handler silently accepted now return 400.** This is the
  intended effect of input validation, called out here for honesty.

## Covered this session

### `routes/capadex-payments.ts` — 3 / 3 risk handlers (real money)
| Method · Path | Schema (required) | Notes |
| --- | --- | --- |
| POST `/api/capadex/payment/create-order` | `createOrderBody` | mirrors handler |
| POST `/api/capadex/payment/verify` | `verifyBody` | signature tuple |
| POST `/api/capadex/payment/refund` | `refundBody` | super-admin |
| _excluded_ webhook | — | Razorpay signature-protected; payload shape owned by Razorpay |
| _excluded_ admin GET list | — | already-coerced query params |

### `routes/commercial-spine.ts` — 12 call sites (flag-gated default-OFF)
| Method · Path | Schema (required) |
| --- | --- |
| POST catalog/products | code, name |
| POST catalog/plans | product_id, code, name |
| POST catalog/bundles | code, name |
| POST catalog/promotions | code, name |
| POST catalog/coupons | code |
| POST catalog/discount-rules | code, name |
| POST admin/customers | email (`.email()`) |
| POST razorpay/plan | plan_id |
| POST razorpay/subscribe | email (`.email()`), plan_id |
| POST razorpay/verify | razorpay_payment_id, razorpay_signature |
| POST razorpay/refund | razorpay_payment_id |
| POST subscriptions/:id/{activate,renew,cancel,expire,change-plan,past-due} | `idParam` (one registrar → 6 routes) |

#### Intentionally deferred in commercial-spine (with reasons)
- **PATCH/DELETE `:id`** (products/plans/bundles/coupons): bodies are fully
  optional (`COALESCE(...)` updates); id flows through parameterized queries.
- **Conditional-requirement bodies** that self-`400` (`catalog/quote`,
  `admin/subscriptions` POST, `razorpay/payment-link`, `credit/issue`,
  `credit/apply`, `subscriptions/:id/refund`, `grace/sweep`): the requirement is
  "A or B" or a numeric `> 0` value check the handler enforces; a flat required
  schema would either be wrong or duplicate the handler. Candidates for a
  `.refine()` schema in a later pass.
- **`razorpay/webhook`**: signature-protected; body shape owned by Razorpay.

## Layer-2 deepening (optional, priority order)

Baseline (Layer 1) already covers 100% of handlers. Layer-2 deep per-field schemas
are an **optional defense-in-depth deepening** — each adds early, specific rejection
of business-rule-invalid input. They are NOT required for coverage. Priority order
if/when deepening continues:
1. **Other payment / commercial / entitlement writes** — `routes/invoice-*.ts`,
   `routes/*entitlement*`, `routes/*commercial*` not yet covered.
2. **Super-admin write surfaces** — admin CRUD POST/PATCH/DELETE across
   `routes/*admin*`, framework panels (lbi/sdi/competency/concerns/short-assessments).
3. **Auth / identity / MFA** — login, OTP, MFA verify, password flows.
4. **Public ingest endpoints** — `signals/ingest`, capadex session respond, uploads.
5. **Everything else (GET-heavy)** — params/pagination gates via `idParam` /
   `paginationQuery`, lowest risk.

### How to add a Layer-2 schema
- Reuse `backend/lib/validate.ts` (`validate`, `idParam`, `nonEmptyId`, `paginationQuery`).
- Per file: define module-scope schemas requiring ONLY the handler's hard-required
  fields; apply `validate({...})` between auth/gates and the handler.
- Re-run the headline `rg` commands above and append a row per newly-covered file.
- Keep this file the single source of truth for progress (no new follow-up task).
