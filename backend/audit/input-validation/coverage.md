# Input-Validation Hardening — Coverage Tracker (finding #6)

> **Goal:** every write/admin handler in `backend/routes/*` validates its input
> with a schema before touching business logic. Multi-session effort.
> **Honesty note:** numbers below are measured from the codebase, not estimated.

## Headline (measured)

| Metric | Value | How measured |
| --- | --- | --- |
| Route files | 292 | `ls backend/routes \| wc -l` |
| Total HTTP handlers | 3,233 | `rg '\.(get\|post\|put\|patch\|delete)\(' backend/routes \| wc -l` |
| Files using `lib/validate` | 2 | `rg -l "from '../lib/validate'" backend/routes` |
| `validate({...})` call sites | 15 | `rg "validate\(\{" backend/routes \| wc -l` |

**Coverage is intentionally partial.** This is Phase 1: it builds the reusable
infrastructure and applies it to the **highest-risk surface only** (real-money
payment + commercial writes). The remaining ~3,218 handlers are tracked below and
will be instrumented in later sessions. We do **not** claim broad coverage.

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

## Remaining surface (resume plan, priority order)

Toward 3,233 handlers. Next sessions should target, in order:
1. **Other payment / commercial / entitlement writes** — `routes/invoice-*.ts`,
   `routes/*entitlement*`, `routes/*commercial*` not yet covered.
2. **Super-admin write surfaces** — admin CRUD POST/PATCH/DELETE across
   `routes/*admin*`, framework panels (lbi/sdi/competency/concerns/short-assessments).
3. **Auth / identity / MFA** — login, OTP, MFA verify, password flows.
4. **Public ingest endpoints** — `signals/ingest`, capadex session respond, uploads.
5. **Everything else (GET-heavy)** — params/pagination gates via `idParam` /
   `paginationQuery`, lowest risk, bulk-applied last.

### How to resume
- Reuse `backend/lib/validate.ts` (`validate`, `idParam`, `nonEmptyId`, `paginationQuery`).
- Per file: define module-scope schemas requiring ONLY the handler's hard-required
  fields; apply `validate({...})` between auth/gates and the handler.
- Re-run the headline `rg` commands above and append a row per newly-covered file.
- Keep this file the single source of truth for progress (no new follow-up task).
