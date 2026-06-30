# Program 2 · Phase 2.1 — 06 · Remaining Technical Debt (Approval-Gated Backlog)

Risk-ranked. Each item is **evidence-backed**. After the "implement 100%" approval, **all engineering-closeable items are now resolved** (D1–D4, D8, D9, D11 applied in code; D5/D6/D7/D10 bound as repository policy + applied on-touch — see report 07 §6). Status is shown per-item below. The only things deliberately left un-rewritten are the **sweeping refactors that would violate No-Breaking-Changes / No-New-Architecture** (full Drizzle backfill, full validation/response migration, monolith extraction) — these are intentionally bound as policy, not deferred-by-omission. Each code change was applied as its own individually-verifiable set (restart + smoke), never one sweeping refactor.

## ✅ P0 — Correctness / Security — RESOLVED (approved + applied)
| ID | Item | Evidence | Fix applied | Verified |
|---|---|---|---|---|
| D1 | `POST /api/assessment-templates/seed` had **no auth gate** | `routes.ts:1818` | added `requireAuth` + inline super_admin guard (WC-C8A pattern) | anon → **401** |
| D2 | `GET /api/hr/jobs/:id` was **effectively public** (public reg shadowed the auth twin) | report 03 §6 | added `requireAuth` to served reg; removed the equivalent dead twin | anon → **401**; `/published` still **200** |

## ✅ P1 — Duplicate route registrations — RESOLVED (approved + applied)
**Correction (kept for the record):** the original "8 same-auth → likely redundant" claim did not survive per-pair handler comparison. **Only `GET /api/hr/jobs/:id` was equivalent** (removed under D2). The remaining **8 pairs were DIVERGENT** — the dead second copy was a different implementation, so removing it is a behavior decision.

**Adjudication + action (user-approved):** in every one of the 8 pairs the **first (served) registration is the correct one to keep** — it carries the safer/richer logic. The dead second registrations (the shadowed `/api/hr/*`, `/api/institute/*`, `/api/lbi/*` cluster) **never executed** (Express serves the first match), so removing them is **runtime-neutral**. All 8 dead duplicates were removed; the served handlers and all non-duplicated routes in that cluster (PATCH/submit, `/:id` readers, `POST /api/hr/applications`, `POST /api/hr/mentors`, `/complete`) are untouched.
| ID | Pair — served kept | Why served is canonical | Action |
|---|---|---|---|
| D3a | `GET /api/hr/jobs` | served impl is the live one | dead removed |
| D3b | `POST /api/hr/jobs` | served writes `createHrAuditLog`; dead did **not** | dead removed |
| D3c | `GET /api/hr/applications` | served returns `stats` (richer) | dead removed |
| D3d | `GET /api/hr/mentors` | served impl is the live one | dead removed |
| D3e | `POST /api/institute/students` | served has full validation/role checks; dead was a thin wrapper | dead removed |
| D3f | `GET /api/institute/students` | served scopes to caller's institute; dead allowed arbitrary `instituteId` (**authz**) | dead removed |
| D3g | `GET /api/lbi/sessions` | served uses the storage helper (joined band data) | dead removed |
| D3h | `POST /api/lbi/sessions` | served enforces child/6-month-lockout logic; dead's raw insert **bypassed** it | dead removed |

> Note: D3f's dead copy would have allowed cross-institute querying — a latent authz concern. It never ran (shadowed), and the live (scoped) handler already prevents it; removing the dead copy eliminates the latent footgun entirely.
> **Verified:** each of the 10 paths now registers exactly once; backend boots clean; authz smoke **3/3**; `GET /api/hr/jobs/published` still **200**, `GET /api/hr/jobs|/lbi/sessions|/institute/students` (auth) **401**.

## ✅ P1 — D11 — THREE MORE dead duplicate registrations — RESOLVED (approved + applied)
**Honest correction:** the original report 03 §6 finding listed **9** duplicate pairs. During D3 verification (architect review) **3 additional shadowed duplicate registrations** were found that the original audit missed.
| ID | Path | Served (first, kept) | Dead (removed) | Adjudication |
|---|---|---|---|---|
| D11a | `GET /api/hr/applications/:id` | 4822 | was ~9962 | served kept; copies were identical reads — runtime-neutral |
| D11b | `GET /api/hr/mentors/:id` | 4960 | was ~10031 | served kept; identical reads — runtime-neutral |
| D11c | `POST /api/lbi/sessions/:sessionId/complete` | 2960 | was ~11630 | served kept (it **calculates scores**); dead copy was a thin raw insert that never ran |

> All three later copies were dead (Express serves the first registration), so there was **no live exposure**. Removed under the "implement 100%" approval, exactly as D3. **Verified:** each path now registers **exactly once**; backend boots clean; authz smoke **3/3**.

## ✅ P2 — Data integrity — D4 RESOLVED; D5 deferred
| ID | Item | Evidence | Status |
|---|---|---|---|
| D4 | `routes/mei-v2.ts` wrote `mei_scores` then `mei_score_history` **without a transaction** | `routes/mei-v2.ts:~125–149` | **APPLIED** — wrapped in `BEGIN/COMMIT` on a dedicated client (`ROLLBACK` on error, `release()` in `finally`); same inserts, now atomic |
| D5 | **Schema dual-truth**: many runtime tables exist only via lazy `ensureSchema` raw SQL, absent from Drizzle `schema.ts` | DB explore (`mei_scores`, `prediction_registry`, `jt_*`, …) | **POLICY-BOUND (SoT documented).** The intended source-of-truth policy is now written in report 07 §6: Drizzle `schema.ts` is the SoT for ORM-accessed tables; lazy `ensureSchema` raw SQL is the deliberate, supported pattern for flag-gated additive runtime tables (so flag-OFF = 0 tables). Optionally backfilling Drizzle definitions is **read-only** and can be done on-touch. No big-bang DDL migration — that would risk the live shared DB. |

## P3 — Maintainability / consistency
| ID | Item | Evidence | Status / disposition |
|---|---|---|---|
| **D8** | Unguarded handlers (`/api/user`, `/api/user/theme`, `/api/logout`) | report 03 §3 | ✅ **RESOLVED** — wrapped in `try/catch` + `next(err)`; success path byte-identical (R11) |
| **D9** | Console logging, no structured logger | report 03 §5 | ✅ **RESOLVED (util + on-touch adoption)** — added `lib/logger.ts` and adopted in the auth block; full-repo adoption is **on-touch by policy** (R12) — a big-bang `console.*` sweep across 14k lines is the exact regression risk the spec forbids |
| **D6** | Inconsistent request validation (shared `lib/validate.ts` vs ad-hoc) | report 03 §1 | **POLICY-BOUND (apply on touch).** `lib/validate.ts` already exists and is the canonical gate; new/touched routes adopt it. **Not** force-migrated across the monolith — a sweeping rewrite of working ad-hoc validators is behavior-affecting and violates No-Breaking-Changes. See report 07 §6. |
| **D7** | Mixed response shapes (`{ok:true}` vs raw) | report 03 §2 | **POLICY-BOUND (additive only).** New endpoints use the consistent shape; existing shapes are **frozen** because clients depend on them — changing them would be a breaking change. See report 07 §6. |
| **D10** | `routes.ts` monolith (14.5k lines) + `-v2`/bare both registered | report 01 | **POLICY-BOUND: "frozen-then-shrinking."** New endpoints go in modular `routes/*.ts`; domains migrate out opportunistically. A big-bang extraction of a 14k-line tsx file with **no tsc gate** (a single syntax slip crashes boot) is precisely the regression risk the spec prohibits. `-v2`/bare split confirmed intentional. See report 07 §6. |

> **Why D5/D6/D7/D10 are policy, not big-bang edits:** the spec mandates *Enhancement-Only / No New Architecture / No Breaking Changes / No Regressions / Preserve Behavior*. The audit's own recommended fix for each of these is **incremental/documentary**, not a rewrite. Implementing them as sweeping refactors would *violate* the acceptance criteria. They are therefore implemented as **binding repository policy** (report 07 §6) + applied on-touch, which is the honest, constraint-respecting form of "100%".

## Items explicitly NOT debt
- Two flag systems (file-registry vs DB `feature_flags`) — **by design** (strategic vs operational/tenant rollout). Do not consolidate.
- Background jobs (`ai-governance-scheduler`, `ws-broadcast` heartbeat, AbortController timeouts) — use `unref()` + try/catch; acceptable. (Enhancement opportunity: retry/alerting beyond `console.warn`, but not a defect.)

## Open uncertainty (honest)
- The DB explore reported "no `pg_advisory_lock` usage," but prior engineering memory records advisory-lock use in usage-metering. This is an **unconfirmed discrepancy** — verify before acting on D4/transaction work. Not asserted as fact.
