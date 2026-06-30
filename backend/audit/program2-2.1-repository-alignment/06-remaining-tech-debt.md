# Program 2 · Phase 2.1 — 06 · Remaining Technical Debt (Approval-Gated Backlog)

Risk-ranked. Each item is **evidence-backed** and **NOT yet changed**. Recommend approving them as small, individually-verifiable change sets (each with its own restart + smoke test) rather than one sweeping refactor.

## ✅ P0 — Correctness / Security — RESOLVED (approved + applied)
| ID | Item | Evidence | Fix applied | Verified |
|---|---|---|---|---|
| D1 | `POST /api/assessment-templates/seed` had **no auth gate** | `routes.ts:1818` | added `requireAuth` + inline super_admin guard (WC-C8A pattern) | anon → **401** |
| D2 | `GET /api/hr/jobs/:id` was **effectively public** (public reg shadowed the auth twin) | report 03 §6 | added `requireAuth` to served reg; removed the equivalent dead twin | anon → **401**; `/published` still **200** |

## ⚠️ P1 — Duplicate route registrations — CORRECTED, NOT changed (needs human decision)
**Correction:** the original "8 same-auth → likely redundant" claim did not survive per-pair handler comparison. **Only `GET /api/hr/jobs/:id` was equivalent** (removed under D2). The remaining **8 pairs are DIVERGENT** — the dead second copy is a different implementation, so removing it is a behavior decision, not cleanup.
| ID | Pair (served / dead) | Divergence | Decision required |
|---|---|---|---|
| D3a | `GET /api/hr/jobs` (4565 / 9776) | served `getAllJobPostings` vs dead `getJobPostings` | which is canonical? |
| D3b | `POST /api/hr/jobs` (4601 / 9799) | served writes `createHrAuditLog`; dead does **not** | served is safer (keep); confirm + delete dead |
| D3c | `GET /api/hr/applications` (4791 / 9987) | served returns `stats`; dead adds `status` filter | merge or pick |
| D3d | `GET /api/hr/mentors` (4924 / 10069) | `getAllMentors` vs `getMentors` | which is canonical? |
| D3e | `POST /api/institute/students` (2059 / 10486) | served has full validation/role checks; dead is a thin wrapper | served preferred; confirm + delete dead |
| D3f | `GET /api/institute/students` (2129 / 10496) | served scopes to caller's institute; dead allows arbitrary `instituteId` (**authz implication**) | served preferred (scoped); delete dead |
| D3g | `GET /api/lbi/sessions` (2600 / 11783) | storage helper vs raw `db.execute` | which is canonical? |
| D3h | `POST /api/lbi/sessions` (2648 / 11705) | served has child/lockout logic; dead uses Zod + raw inserts | served preferred; confirm + delete dead |

> Note D3f's dead copy would have allowed cross-institute querying — a latent authz concern that the live (scoped) handler already prevents. No live exposure, but flagged.

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
