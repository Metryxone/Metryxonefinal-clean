# Program 2 · Phase 2.1 — 06 · Remaining Technical Debt (Approval-Gated Backlog)

Risk-ranked. Each item is **evidence-backed** and **NOT yet changed**. Recommend approving them as small, individually-verifiable change sets (each with its own restart + smoke test) rather than one sweeping refactor.

## P0 — Correctness / Security (recommend approve first)
| ID | Item | Evidence | Proposed fix | Behavior change? |
|---|---|---|---|---|
| D1 | `POST /api/assessment-templates/seed` has **no auth gate** | `routes.ts:1818` | add `requireAuth` + admin check | Yes (blocks anon) — needs sign-off |
| D2 | `GET /api/hr/jobs/:id` is **effectively public** because a public registration (4581) shadows the auth one (9781) | report 03 §6 | decide public vs auth; remove the dead twin | Yes (security) — needs decision |

## P1 — Duplicate route registrations (dead second copy)
| ID | Item | Evidence | Proposed fix |
|---|---|---|---|
| D3 | 8 same-auth duplicate registrations (`/api/hr/jobs` GET+POST, `/api/hr/applications`, `/api/hr/mentors`, `/api/institute/students` GET+POST, `/api/lbi/sessions` GET+POST) | report 03 §6 | per-pair: confirm handlers are equivalent, delete the later (dead) registration | No (dead code) once equivalence confirmed |

## P2 — Data integrity
| ID | Item | Evidence | Proposed fix |
|---|---|---|---|
| D4 | `routes/mei-v2.ts` writes `mei_scores` then `mei_score_history` **without a transaction** → partial write on failure | DB explore (lines ~125–149) | wrap in `BEGIN/COMMIT` (pg txn) | No (hardening) |
| D5 | **Schema dual-truth**: many runtime tables exist only via lazy `ensureSchema` raw SQL, absent from Drizzle `schema.ts` | DB explore (`mei_scores`, `prediction_registry`, `jt_*`, …) | document the intended SoT; optionally backfill Drizzle definitions (read-only) | No (additive) |

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
