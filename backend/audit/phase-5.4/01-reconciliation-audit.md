# Phase 5.4 — Talent Discovery Engine · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Contract:** additive · flag-gated (default OFF) · compose-never-recompute · GET-never-writes ·
IDOR-guarded (super-admin) · never-throws · honesty-first (never fabricate / duplicate) · STOP for approval.

## 1. Deliverable-name reconciliation (collision check)

Queried `information_schema.tables` for `candidate|talent|pool|shortlist|saved_search|segment|search`.

| Deliverable name | Pre-exists as table? | Pre-exists as file? | Decision |
|---|---|---|---|
| `candidate_search_engine` | NO | NO | engine name — implement as a service surface (read-only over `employer_candidates`) |
| `talent_discovery_engine` | NO | NO | engine name — implement as a service surface (segmentation + curation) |
| `talent_pools` | NO | NO | genuine net-new persistence — build additive table |

No name collisions. (`employer_pool_outreach`, `m5_succession_candidates`, `search_intents`, etc. are
unrelated existing namespaces and are **not** touched.)

## 2. Candidate substrate (the thing we search/filter/segment)

`employer_candidates` is the canonical, richly-typed candidate table and the correct substrate:

> id, employer_id, job_id, job_title, name, email, phone, location, candidate_role, experience,
> skills (jsonb), education, ei_score (int), match_score (int), source, stage, notes, rating (int),
> tags (jsonb), pooled (bool), behavioral_profile (jsonb), competency_profile (jsonb), …

- `career_seeker_profiles` (PK `user_id`, JSONB `data`) — 0 rows; a seeker-side store, **not** the
  employer discovery substrate. Not used here.
- `candidate_master` / `tig_entities` — do **NOT** exist in this DB. Not used.
- All candidate reads are **read-only** over `employer_candidates`. No schema change to it.

## 3. Curation surfaces — no existing substrate ⇒ additive tables (the legitimate build)

Talent Pools, Shortlists, and Saved Searches have **no** backing tables anywhere. Unlike Phase 5.3
(which reused an existing-but-unconsumed lifecycle spine), these are net-new capabilities the user
explicitly requested, so creating their tables is real, non-fabricated work:

| Table | Purpose |
|---|---|
| `talent_pools` + `talent_pool_members` | named candidate pools + membership |
| `talent_shortlists` + `talent_shortlist_members` | shortlists + per-member status (e.g. interview) |
| `talent_saved_searches` | named, re-runnable filter sets |

- Migration (canonical record for deploy): `migrations/20260621_phase54_talent_discovery.sql`.
- DDL is created **lazily on the WRITE path only** (`ensureTalentDiscoverySchema`); GET never runs DDL
  (to_regclass probe → degrade to empty). Flag-OFF ⇒ no schema, no read, no write (byte-identical).
- Members carry FK `… REFERENCES employer_candidates(id) ON DELETE CASCADE`, so a removed candidate
  cannot leave phantom members. Membership writes also pre-validate ids against `employer_candidates`
  (unknown id ⇒ `invalid_input`, never a phantom row).

## 4. Operations → mapping

| Requested operation | Surface |
|---|---|
| Search Candidates | `GET /api/talent-discovery-engine/candidates?q=…` |
| Filter Candidates | same endpoint: role/location/stage/source/skills(contains-all)/tags/minEi/maxEi/minMatch/minRating/pooled + sort/dir/limit/offset |
| Talent Pools | `POST/GET/DELETE /pools`, `POST /pools/:id/members`, `DELETE /pools/:id/members/:candidateId` |
| Talent Segmentation | `GET /segments?dimension=stage\|role\|location\|source\|rating\|ei_band\|match_band` (read-only aggregation) |
| Shortlists | `POST/GET/DELETE /shortlists` + members (incl. `PUT …/members/:candidateId` to set status) |
| Saved Searches | `POST/GET/DELETE /saved-searches`, `POST /saved-searches/:id/run` |

## 5. Flag & wiring

- Flag `talentDiscovery` (`FF_TALENT_DISCOVERY`), default **OFF**; helper `isTalentDiscoveryEnabled`.
- Routes gate→requireAuth→requireSuperAdmin; `created_by`/`added_by` stamped from the authenticated
  principal (IDOR-safe). Literal/more-specific paths registered before `/:id` (Express order).
- Registered in `routes.ts` with `concernsPool` (the main DATABASE_URL pool).

## 6. Verification

- In-process smoke (`scripts/smoke-talent-discovery-engine.ts`): **34/34 PASS**; seeds @example.com
  demo candidates and removes every demo row (saved-searches/shortlists/pools/candidates) on exit.
- HTTP flag-OFF: `/candidates` and `/_meta/status` return **503** on the running server (flag OFF).
- FK cascade verified: deleting a candidate removes it from its pool.
- Frontend `vite build`: PASS (the real launch gate).

**STOP for approval** — not merged, not deployed (standing rule).
