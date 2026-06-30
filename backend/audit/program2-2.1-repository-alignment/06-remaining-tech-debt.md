# Program 2 · Phase 2.1 — 06 · Remaining Technical Debt (Approval-Gated Backlog)

Risk-ranked. Each item is **evidence-backed** and **NOT yet changed**. Recommend approving them as small, individually-verifiable change sets (each with its own restart + smoke test) rather than one sweeping refactor.

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

## ⚠️ P1 — D11 — THREE MORE dead duplicate registrations (newly discovered, NOT in scope — deferred)
**Honest correction:** the original report 03 §6 finding listed **9** duplicate pairs. During D3 verification (architect review) **3 additional shadowed duplicate registrations** were found that the original audit missed. They are **left in place** — they were never approved as part of D3, and STRICT mode forbids expanding a change set without sign-off.
| ID | Path | Served (first) | Dead (shadowed second) | Equivalent? |
|---|---|---|---|---|
| D11a | `GET /api/hr/applications/:id` | 4814 | 9962 | not yet adjudicated |
| D11b | `GET /api/hr/mentors/:id` | 4952 | 10031 | not yet adjudicated |
| D11c | `POST /api/lbi/sessions/:sessionId/complete` | 2952 | 11630 | not yet adjudicated |

> All three later copies are dead (Express serves the first registration), so there is **no live exposure** — but the audit text that called these "non-duplicated / LIVE handlers untouched" was **inaccurate and is corrected here**. Recommended: a future approval-gated micro-pass adjudicates each pair (served-vs-dead) and removes the dead copy, exactly as D3.

## ✅ P2 — Data integrity — D4 RESOLVED; D5 deferred
| ID | Item | Evidence | Status |
|---|---|---|---|
| D4 | `routes/mei-v2.ts` wrote `mei_scores` then `mei_score_history` **without a transaction** | `routes/mei-v2.ts:~125–149` | **APPLIED** — wrapped in `BEGIN/COMMIT` on a dedicated client (`ROLLBACK` on error, `release()` in `finally`); same inserts, now atomic |
| D5 | **Schema dual-truth**: many runtime tables exist only via lazy `ensureSchema` raw SQL, absent from Drizzle `schema.ts` | DB explore (`mei_scores`, `prediction_registry`, `jt_*`, …) | **DEFERRED** — document the intended SoT; optionally backfill Drizzle definitions (read-only). Large, no-regression-risk only if read-only |

## P3 — Maintainability / consistency (incremental, non-breaking)
| ID | Item | Evidence | Proposed fix |
|---|---|---|---|
| D6 | Inconsistent request validation (shared `lib/validate.ts` vs ad-hoc) | report 03 §1 | migrate routes onto `lib/validate.ts` incrementally (non-breaking) |
| D7 | Mixed response shapes (`{ok:true}` vs raw) | report 03 §2 | standardize **additively** (don't break existing clients) |
| D8 | Unguarded handlers (`/api/user`, `/api/user/theme`, `/api/logout`) | report 03 §3 | add try/catch + next(error) |
| D9 | Console logging, no structured logger | report 03 §5 | introduce a logger util; adopt gradually |
| D10 | `routes.ts` monolith (14.5k lines) + `-v2`/bare both registered | report 01 | extract domains into modular routers over time; confirm `-v2`/bare path split is intentional |

## Items explicitly NOT debt
- Two flag systems (file-registry vs DB `feature_flags`) — **by design** (strategic vs operational/tenant rollout). Do not consolidate.
- Background jobs (`ai-governance-scheduler`, `ws-broadcast` heartbeat, AbortController timeouts) — use `unref()` + try/catch; acceptable. (Enhancement opportunity: retry/alerting beyond `console.warn`, but not a defect.)

## Open uncertainty (honest)
- The DB explore reported "no `pg_advisory_lock` usage," but prior engineering memory records advisory-lock use in usage-metering. This is an **unconfirmed discrepancy** — verify before acting on D4/transaction work. Not asserted as fact.
