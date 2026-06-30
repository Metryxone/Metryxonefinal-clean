# Program 2 · Phase 2.1 — 03 · API Consistency Report

## 1. Request validation
- **Shared validator exists:** `backend/lib/validate.ts` (Zod, non-breaking middleware over `params`/`query`/`body`).
- **Adoption is split:** newer modular routes (`routes/signal-capture.ts`, `routes/entitlement.ts`, `routes/career-evidence.ts`, …) use `validate({ body: schema })`; the legacy `routes.ts` almost always uses ad-hoc `if (!x) return res.status(400)`.
- **Partial adoption** even within modular files (some manual checks alongside a schema).
- Assessment: **inconsistent, not broken.** A non-breaking, incremental migration to `lib/validate.ts` is the right path — approval-gated (report 06).

## 2. Response shape
- Two conventions coexist: standard envelope `{ ok: true, ... }` (modular routes) vs raw JSON arrays/objects (legacy `routes.ts`, e.g. `/api/children` returns a raw array).
- Assessment: **inconsistent, not broken.** Standardizing responses is a **breaking change for clients** → must be additive/versioned → approval-gated, NOT done here.

## 3. Error handling
- Dominant pattern: `try { … } catch (e) { next(e); }` → central Express handler.
- Never-throws used on critical read/seed paths.
- **Unguarded handlers** (no try/catch) found: `GET /api/user` (routes.ts:1139), `GET /api/user/theme` (1144), `POST /api/logout` (984). Low risk (trivial handlers) but inconsistent.

## 4. Authorization (most material findings)
- Middleware `requireAuth` / `requireSuperAdmin` exist and are generally applied first.
- **Missing gate (security):** `POST /api/assessment-templates/seed` (routes.ts:**1818**) has **no auth/admin gate** — any caller can trigger a template re-seed. → report 06 (High).
- **Public/auth divergence via duplicate registration:** `GET /api/hr/jobs/:id` is registered **public at 4581** and **auth-gated at 9781**; Express runs the first → the endpoint is **effectively public**, and the auth version is dead. → report 06 (High).

## 5. Logging
- Console-based (`console.log`/`warn`) with `[module] registered` prefixes; no structured logger (Winston/Pino). A redacting audit logger is referenced but not uniformly applied. Inconsistent, not broken.

## 6. Duplicate endpoints — CONFIRMED (exact line numbers in `routes.ts`)
In Express the **first** matching registration wins and terminates the response; the later one is **dead code**.

| Method + Path | Registration 1 (serves) | Registration 2 (dead) | Note |
|---|---|---|---|
| GET `/api/hr/jobs` | 4559 (requireAuth) | 9768 (requireAuth) | likely redundant |
| POST `/api/hr/jobs` | 4593 (requireAuth) | 9791 (requireAuth) | likely redundant |
| GET `/api/hr/jobs/:id` | 4581 (**no auth**) | 9781 (requireAuth) | **divergent — security implication** |
| GET `/api/hr/applications` | 4783 (requireAuth) | 9979 (requireAuth) | likely redundant |
| GET `/api/hr/mentors` | 4916 (requireAuth) | 10061 (requireAuth) | likely redundant |
| POST `/api/institute/students` | 2053 (requireAuth) | 10478 (requireAuth) | likely redundant |
| GET `/api/institute/students` | 2123 (requireAuth) | 10488 (requireAuth) | likely redundant |
| GET `/api/lbi/sessions` | 2594 (requireAuth) | 11775 (requireAuth) | likely redundant |
| POST `/api/lbi/sessions` | 2642 (requireAuth) | 11697 (requireAuth) | likely redundant |

**CORRECTION + RESOLUTION (post per-pair comparison):** the "likely redundant" label above was **too optimistic**. On comparing handler bodies, **only `GET /api/hr/jobs/:id` was functionally equivalent** — its dead twin was removed under D2. The **other 8 pairs were DIVERGENT** (the dead second copy adds/omits real logic — audit-log writes, pagination/filters, Zod validation, raw SQL, institute scoping), so removing them is a behavior decision, not blind cleanup. **With user approval** these were adjudicated per-pair — the first (served) handler is canonical in every case, the shadowed second copy never executed — and all 8 dead duplicates were removed (runtime-neutral). See the per-pair table + verification in report 06 (D3).

## 7. Verdict
API surface is **functionally sound** but **stylistically inconsistent**, with **two genuine correctness/security items** (the unguarded seed endpoint and the public-shadowing `/api/hr/jobs/:id`). No API behavior was changed in this phase.
