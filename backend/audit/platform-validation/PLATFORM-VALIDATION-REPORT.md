# Platform Validation Report — MetryxOne

**Date:** 2026-06-25
**Scope:** 12 technical layers — Database · API · Authentication · Authorization · Performance · Caching · Logging · Audit · Versioning · Security · Concurrency · Transactions
**Method:** Live runtime probes against the running backend (`localhost:8080`) + the development PostgreSQL database, combined with codebase evidence (file:line). No deploy. Read-only.
**Honesty principle:** *Coverage* (does the mechanism exist?) and *Confidence* (is it verified working & trustworthy?) are reported as **separate axes**. Gaps are stated as honest findings, never inflated. Anything not directly observed is labelled as such.

---

## 1. Executive Scorecard

| # | Layer | Coverage | Confidence | Status |
|---|-------|----------|-----------|--------|
| 1 | Database | High | High | ✅ PASS |
| 2 | API | High | Medium-High | ✅ PASS *(maintainability caveat)* |
| 3 | Authentication | High | High | ✅ PASS |
| 4 | Authorization | High | Medium | 🟡 PARTIAL |
| 5 | Performance | Medium | Low-Medium | 🟡 PARTIAL *(not load-tested)* |
| 6 | Caching | Medium | Medium | ✅ PASS *(modest)* |
| 7 | Logging | Medium | Medium | 🟡 PARTIAL |
| 8 | Audit | High | Medium-High | ✅ PASS |
| 9 | Versioning | Low-Medium | Medium | 🟡 PARTIAL |
| 10 | Security | High | Medium-High | ✅ PASS *(noted gaps)* |
| 11 | Concurrency | Medium | Medium-High | ✅ PASS *(scoped)* |
| 12 | Transactions | Medium | Medium | ✅ PASS *(scoped)* |

**Overall:** The platform's **data, authentication, and security core is well-engineered and its access controls were verified live** (auth rejects, admin gates 401, security headers present). It is **not yet fully production-validated** — several high-impact controls (RBAC enforcement, throughput) are present in code but only partially exercised and were **not load-tested**, so we stop short of calling it "production-grade." Four layers are honestly **PARTIAL** — Authorization (formal RBAC is largely advisory; live enforcement leans on a single super-admin check), Performance (sound primitives but never load-tested), Versioning (no API contract versioning), and Logging (console-only + a privacy risk). None of the PARTIAL findings are silent failures — each is a known, fixable gap.

**Axis distinction matters here:** several layers have **High Coverage but lower Confidence** — the mechanism is built and present in code, but has not been exercised under realistic load or with the full enforcement path active. We do not upgrade Confidence on the basis of Coverage.

---

## 2. Environment validated

Captured live during this audit (see Appendix A for raw output):

- **PostgreSQL:** 16.10
- **Public tables:** 1,397 · **Indexes:** 3,122 · **Foreign keys:** 815
- **Session store table:** `express_sessions` present
- **`admin_audit_logs`:** present, 14 rows · **`users`:** 3 rows (dev)
- **Connection pool max:** 10
- **Backend:** responding on `localhost:8080` (Express serving; returns structured 404/401, not connection-refused)
- **Missing dev secrets (expected):** `MONGODB_URI`, `OPENAI_API_KEY`, `ZOHO_EMAIL`, `ZOHO_APP_PASSWORD`

---

## 3. Layer-by-Layer Validation

### 1. Database — ✅ PASS · Coverage High · Confidence High
**Evidence**
- PostgreSQL 16.10 confirmed live; 1,397 tables, 3,122 indexes, 815 FKs queried directly.
- ORM: Drizzle (`backend/db/schema.ts`, `backend/storage.ts`) over a `pg.Pool` initialized from `DATABASE_URL` (`backend/storage.ts:329-336`).
- Canonical schema `backend/shared/schema.ts` (~30+ core tables) + pervasive **lazy `ensure*Schema()`** bootstrap pattern (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) e.g. `services/commercial/catalog-schema.ts:263`, `services/governance/rbac-schema.ts:19`.
- 213 SQL migration files in `backend/migrations/`.

**Risks / gaps (honest)**
- **Connection pool max = 10** is low relative to the very large surface area (~1,500+ endpoints). Acceptable for dev; a likely bottleneck under production concurrency. *Recommend load testing + tuning.*
- **Lazy ensure-schema vs. migrations can drift** — the live DB shape is authoritative, not the migration files. A migration that drifts from handler columns still 42703s at runtime (documented pattern).
- **Dual store:** an optional MongoDB integration exists (`backend/mongo.ts`, `MONGO_REQUIRED=false`) — fragmentation risk if it becomes load-bearing.

---

### 2. API — ✅ PASS *(maintainability caveat)* · Coverage High · Confidence Medium-High
**Evidence**
- Modular registration via `registerXxxRoutes(...)` aggregated in `backend/routes.ts` and called at startup (`backend/index.ts:133`). Estimated **~1,500–2,000 endpoints**.
- Global error handler returns `{ message }` with `err.status || 500` (`backend/index.ts:206-215`).
- Input validation via Zod → 400 with `errors` array (e.g. `routes.ts:944`).
- Feature-flag gating resolves Tenant Override → Global Toggle → Rollout % (`services/feature-flags.ts:95-126`); flag-off protected routes return 503; `/enabled` probe returned **200** live for `outcome-intelligence`.

**Risks / gaps (honest)**
- **No `/api/health` endpoint** — `GET /api/health` returned 404 live. No standard liveness/readiness probe for orchestration/monitoring. *Recommend adding one.*
- **`backend/routes.ts` is ~14,000 lines** — a "mega-file" maintainability and startup-cost risk.
- **Response envelopes are inconsistent** (raw arrays vs `{message}` vs `{ok:true}`) — no single API contract shape.

---

### 3. Authentication — ✅ PASS · Coverage High · Confidence High
**Evidence**
- **Password hashing: scrypt** with a 16-byte salt and **`timingSafeEqual`** comparison (`routes.ts:256, 312-329`). Strong, constant-time. Verified live: bad credentials → **401**.
- **Sessions:** `express-session` + Postgres-backed `connect-pg-simple` (`express_sessions` table confirmed live); in-memory fallback only when `DATABASE_URL` absent (`routes.ts:340-351`).
- **MFA/2FA:** 6-digit email MFA enforced for super-admins via `mfa_codes` + `attemptToken`, 5-min expiry (`routes.ts:530-556`).
- `requireAuth` middleware checks `req.isAuthenticated()` (`routes.ts:431-436`).

**Risks / gaps (honest)**
- **MFA dev bypass:** skipped when `NODE_ENV !== 'production' && !ZOHO_EMAIL` (`routes.ts:531-532`). Acceptable & documented for dev; **must confirm `ZOHO_EMAIL` is set in production** so MFA actually fires.
- **Session-secret default (mitigated in prod):** a public fallback string `SESSION_SECRET || "edupsych-secret-key-change-in-production"` exists (`routes.ts:362`), **but production is protected by a startup fail-fast** that exits if `SESSION_SECRET` is unset in production (`index.ts:17-21`). So this is **not** an active production forgery path — it is a dev-hygiene / defense-in-depth item: the default still applies in non-production, and the fallback string should be removed so no environment can silently sign with a public secret.
- `/api/forgot-password` is a console stub (`routes.ts:692-705`); a real OTP flow exists separately at `/api/auth/forgot-password` (`routes.ts:732`) — consolidate to avoid confusion.

---

### 4. Authorization — 🟡 PARTIAL · Coverage High · Confidence Medium
**Evidence**
- `requireSuperAdmin`-style gates verified **live**: `/api/admin/feature-flags`, `/api/admin/mission-control`, `/api/admin/subscription-packages` all returned **401** unauthenticated.
- **IDOR guard** `resolveEffectiveUserId` pins requests to `authUser.id` unless super-admin (`routes/behavioural-memory.ts:141-150`).
- A formal RBAC v2 subsystem exists (roles/permissions/audit) under `backend/services/governance/`.

**Risks / gaps (honest)**
- **Formal RBAC is largely *advisory*** — live enforcement still leans on a single hardcoded `super_admin` role check in places (`routes/security-center.ts:181-187`). Coverage is High (tables + engine exist), but **Confidence is Medium because the rich RBAC is not the live enforcement path everywhere.**
- **Per-framework admin gates are inline, not covered by the global gate:** the global `app.use('/api/admin', …)` gate does **not** cover `/api/<framework>/admin/*` paths. Those are individually protected by inline `requireAuth, requireSuperAdmin` passed per-route — verified in `routes/sdi.ts:11-13` (and the same `(app, pool, requireAuth, requireSuperAdmin)` registrar signature recurs across framework modules). This works, but coverage depends on every such route remembering **both** guards, so it must be audited per-module rather than guaranteed centrally.
- IDOR guarding is applied per-route, not centrally — coverage depends on each route remembering to call it.

---

### 5. Performance — 🟡 PARTIAL *(not load-tested)* · Coverage Medium · Confidence Low-Medium
**Evidence**
- 3,122 indexes live — strong indexing discipline; indexes created both in schema and lazily in routes.
- Reporting paths use `Promise.all` to parallelize queries (`services/lbi-report-generator.ts:131-137`).

**Risks / gaps (honest)**
- **No load/performance testing was performed or found** — Confidence is Low for this reason, regardless of healthy primitives. We do not claim performance we have not measured.
- **N+1 / multi-query reports:** several report generators issue 5+ separate `pool.query` calls per report.
- **Pool max 10** + **~14k-line route file** are plausible throughput/startup constraints.
- *Recommend:* baseline load test of the hottest endpoints, then tune pool size and add query-level timing.

---

### 6. Caching — ✅ PASS *(modest)* · Coverage Medium · Confidence Medium
**Evidence**
- **Feature-flag cache (verified in code):** in-memory singleton with 60s background refresh + forced `refreshFlagCache()` on update (`services/feature-flags.ts:88`).
- **Domain compute cache:** dedicated app-level cache engine for expensive Role-DNA computations (`services/role-dna-cache-engine.ts`).
- **HTTP caching (verified live):** `ETag` header observed on an admin route response.
- **Session cache:** Postgres-backed store (`express_sessions`).
- *Note:* a `?refresh=1`-style cache-bust convention is documented for admin reads, but a single canonical TTL-cache helper was **not** pinned to one file in this pass — the verified caches are the flag cache, the Role-DNA cache, and HTTP ETag.

**Risks / gaps (honest)**
- **All app-level caches are in-memory** → reset on restart and **not shared across horizontally-scaled instances** (cache stampede / inconsistency risk at scale). No Redis/shared cache layer.

---

### 7. Logging — 🟡 PARTIAL · Coverage Medium · Confidence Medium
**Evidence**
- Structured console wrapper with timestamp + source tag (`backend/index.ts:68-77`).
- Request-logging middleware captures method, path, status, duration (`backend/index.ts:80-103`).
- Global error handler logs stack traces via `console.error` (`backend/index.ts:209`).

**Risks / gaps (honest)**
- **No industrial logging library** (Winston/Pino), **no log levels**, no rotation — logs go to stdout/stderr and depend entirely on the host for retention.
- **Privacy risk:** the request logger stringifies the **entire JSON response body** (`backend/index.ts:96`) → may log PII or tokens. **Recommend redaction / disabling body capture for sensitive routes.**

---

### 8. Audit — ✅ PASS · Coverage High · Confidence Medium-High
**Evidence**
- **`admin_audit_logs`** (live, 14 rows) captures `admin_user_id, action_type, target_type, target_id, previous_state, new_state, ip_address, notes, created_at` (`shared/schema.ts:2298-2309`).
- **`platform_audit_log`** with a never-throws best-effort `logAudit` covering create/update/archive/delete/import/export/approve/reject (`services/platform-audit.ts`).
- **Append-only history:** `p4_competency_history` (`services/longitudinal-engine.ts:286`), `m3_role_normalization_history` (`services/m3-role-normalization.ts:93-100`), `consent_logs` for DPDP (`shared/schema.ts:357-365`).
- Query endpoints: `/api/admin/audit/events`, `/api/admin/platform-audit` (`routes/audit.ts`).

**Risks / gaps (honest)**
- **Audit capture is manual** (services must call `logAudit`) — no DB trigger or decorator guarantees *every* mutation is recorded; the never-throws design means a failed audit write is silently dropped. Coverage of *what's wired* is High; **completeness of capture cannot be guaranteed** → Confidence Medium-High, not High.

---

### 9. Versioning — 🟡 PARTIAL · Coverage Low-Medium · Confidence Medium
**Evidence**
- **Schema/data versioning is strong:** 213 migration files + Drizzle; feature flags carry a `phase` field with deterministic rollout bucketing (`services/feature-flags.ts`).
- Additive V2 phases are flag-gated (flag-off → byte-identical legacy) — an effective *behavioural* versioning discipline.

**Risks / gaps (honest)**
- **API contract versioning is essentially absent** — routes are unversioned under `/api/` (exceptions: `/api/v1/upload` proxy to the FastAPI service, a few `*-v2.ts` files). No `/v1`/`/v2` namespace strategy → **breaking API changes have no versioned migration path for clients.** *Recommend a versioning policy before external API consumers exist.*

---

### 10. Security — ✅ PASS *(noted gaps)* · Coverage High · Confidence Medium-High
**Evidence (much verified live)**
- **Security headers via helmet** (`index.ts:4,61`). Live probe returned **HSTS** (`max-age=31536000; includeSubDomains`), **X-Content-Type-Options: nosniff**, **X-Frame-Options: SAMEORIGIN**, and a restrictive **CSP `default-src 'none'`** on API responses.
- **SQL injection:** parameterized queries (`pg`) + Drizzle throughout (e.g. `routes/capadex-payments.ts:115,175`).
- **Payment security:** Razorpay webhook HMAC-SHA256 verification, **fail-closed** when secret configured (`routes/capadex-payments.ts:306-312`); client-callback signature verification (`:173`).
- **Rate limiting:** sliding-window per IP+route (`services/security-middleware.ts:24-57`); **anti-enumeration** jitter on 404s (`:101-124`).
- **Cookies:** `httpOnly:true`, `secure` in prod, `sameSite:'lax'` (`routes.ts:368-370`).

**Risks / gaps (honest)**
- **`SESSION_SECRET` hygiene** (repeated from Auth) — production is fail-fast-protected (`index.ts:17-21`); residual item is removing the public fallback string (`routes.ts:362`) so non-prod can't sign with a public secret. Not an active prod exploit.
- **Rate limiter is in-memory** → resets on restart, ineffective across multiple instances.
- **No dedicated CSRF middleware** (e.g. `csurf`) — relies on `sameSite:'lax'`, which is reasonable for a same-origin SPA but not defense-in-depth.
- **Response-body logging** (from Logging) is also a security/privacy exposure.
- **CSP reconciliation note:** helmet is configured with `contentSecurityPolicy:false` (`index.ts:61`), yet a restrictive CSP header was observed on API responses — source not pinned in this pass; flagged for a quick reconciliation (the *observed* behaviour is safe; the config/observation mismatch should be understood).

---

### 11. Concurrency — ✅ PASS *(scoped)* · Coverage Medium · Confidence Medium-High
**Evidence**
- **PostgreSQL advisory locks** serialize quota checks in usage metering: `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))` (`services/commercial/metering-engine.ts:182`), with a dedicated regression test firing parallel requests (`scripts/smoke-usage-metering-concurrency-65.ts`).
- **Idempotency:** `comm_idempotency_keys` table + unique index `uq_comm_credit_ledger_idem (customer_id, idempotency_key)` (`services/commercial/catalog-schema.ts:176,243`) — at-most-once credit grants.

**Risks / gaps (honest)**
- Concurrency guards are **scoped to the commercial/metering paths**, not platform-wide.
- **Single-DB locking only** — no distributed lock manager; consistency relies entirely on one Postgres instance. Adequate today; a constraint for multi-DB scale-out.

---

### 12. Transactions — ✅ PASS *(scoped)* · Coverage Medium · Confidence Medium
**Evidence**
- Explicit `BEGIN/COMMIT` on a dedicated client for the quota-check + event-insert critical path (`services/commercial/metering-engine.ts:181-212`).
- **`ON CONFLICT` upserts** pervasive for idempotent seeding/ensure paths (`catalog-schema.ts:243`, `governance/rbac-engine.ts:191`, `index.ts:164`).
- `db.transaction` (Drizzle) available platform-wide.

**Risks / gaps (honest)**
- **No global transaction discipline** — many multi-write paths rely on `ON CONFLICT` idempotency rather than wrapping related writes in a single transaction. Atomicity is guaranteed where it was explicitly engineered (financial/quota), not by convention everywhere. *Recommend auditing multi-write business operations for transactional boundaries.*

---

## 4. Prioritized Recommendations

**P0 — fix before/at production**
1. **Confirm `ZOHO_EMAIL` is set in production** so super-admin MFA actually fires (no silent dev-bypass in prod). *(Auth)*
2. **Redact or disable full response-body logging** for sensitive routes. *(Logging/Security)*
3. **Remove the public `SESSION_SECRET` fallback string** (`routes.ts:362`). Production is already fail-fast-protected (`index.ts:17-21`), so this is hardening/defense-in-depth, not an active prod exploit. *(Auth/Security)*

**P1 — hardening / operability**
4. Add a real **`/api/health`** liveness/readiness endpoint. *(API)*
5. **Load-test** hot endpoints; tune **pool size** (currently 10). *(Performance/Database)*
6. Move **rate-limiting & app caches to a shared store** (e.g. Redis) before horizontal scaling. *(Security/Caching)*
7. Make **RBAC the live enforcement path** (reduce reliance on the single super-admin check) and audit the **per-framework `/api/<framework>/admin/*`** gates. *(Authorization)*

**P2 — strategic**
8. Define an **API versioning policy** before external consumers. *(Versioning)*
9. Consider an **automated audit-capture guarantee** (trigger/decorator) for mutations. *(Audit)*
10. Plan decomposition of the **~14k-line `routes.ts`**. *(API/Maintainability)*

---

## 5. Limitations — what was NOT validated (honesty)
- **No load/stress/performance testing** was conducted — Performance Confidence is intentionally Low.
- **No penetration test / SAST/DAST** run in this pass (a separate `security_scan` skill exists for that).
- Validated against the **development** environment and shared dev DB (3 users, 14 audit rows). **Production behaviour may differ** (env vars, data volume, scaling). **No deploy was performed.**
- Endpoint count (~1,500–2,000) is an **estimate** from registration patterns, not an exhaustive enumeration.
- The CSP source mismatch (helmet config vs observed header) is **noted, not resolved**.

---

## Appendix A — Raw runtime evidence

**Database (direct queries):**
```
PG: PostgreSQL 16.10
public tables: 1397 · indexes: 3122 · foreign keys: 815
express_sessions table: express_sessions
admin_audit_logs rows: 14 · users rows: 3
pool max: 10
```

**API / Auth / Authz / Caching / Security (live HTTP probes against localhost:8080):**
```
GET  /api/health                       -> 404   (no health endpoint)
POST /api/login (bad creds)            -> 401   (auth rejects)
GET  /api/admin/feature-flags          -> 401   (authz gate)
GET  /api/admin/mission-control        -> 401   (authz gate)
GET  /api/admin/subscription-packages  -> 401   (authz gate)
GET  /api/outcome-intelligence/enabled -> 200   (flag probe)
ETag: W/"…"                                     (HTTP caching present)
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: default-src 'none'
```

**Migrations / versioning:** 213 SQL files in `backend/migrations/`; API largely unversioned under `/api/`.

---
*Generated read-only. No code, schema, or data was modified. No deployment performed.*
