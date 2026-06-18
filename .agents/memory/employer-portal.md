---
name: Employer Intelligence Operating System (EP-98)
description: Architecture of the employer portal backend — 7 tables, 20+ routes, 8-domain intelligence bridge, auth patterns, reserved-keyword traps.
---

# Employer Portal (EP-98)

## Tables
7 tables with prefix `employer_`: `employer_jobs`, `employer_candidates`, `employer_interviews`, `employer_offers`, `employer_activity_logs`, `employer_ref_checks`, `employer_company_profiles`.

## Reserved-keyword traps
- `values` is a **reserved keyword in PostgreSQL** — the `employer_company_profiles` table uses `values_list` (not `values`).
- `current_role` is used by Postgres internally — `employer_candidates` uses `candidate_role`.

## Routes file
`backend/routes/employer-portal.ts` (~1106 lines). Registered in `backend/routes.ts` at line 13436 via `registerEmployerPortalRoutes(app, concernsPool, requireAuth)`.

## Auth pattern
- All routes gated by `requireAuth` (session-based Passport).
- `employer_id` is always `req.user.id` (UUID, session-scoped).
- Responses map DB `id` → `_id` for frontend compatibility.

## Schema init
- `ensureSchema` is lazy (single `schemaReady` flag).
- Boot-time `setImmediate` fires on route registration so schema is ready before first auth'd request.

## M5 auth guard
All `/api/m5/*` routes gated by `app.use('/api/m5', requireAuth)` inserted at line 13241 of `routes.ts` (before `registerM5Routes`). Previously the internal `guard()` wrapper had no auth.

## Intelligence tabs (backend-wired vs still-synthetic)
- **`OrgIntelligenceTab`** — REAL. Fetches `GET /api/employer/eios/workforce-analytics` (flag-gated by `isEiosWorldClassVerifiedEnabled()` / `FF_EIOS_WORLD_CLASS_VERIFIED_V2`; **503 when off** → honest "disabled" panel) + `GET /api/employer/eios/competency-architecture` (non-gated, 6 seeded roles). Real roster import via SheetJS → `POST /api/employer/eios/employees/import` (template download, lower(trim) email dedupe, bounded fields, COALESCE upsert `ON CONFLICT (employer_id,email)`, honest result counts). Renders Coverage banner + KPI tiles + retention-risk dist + by-dept table + employer-reported demographics (conditional) + top-by-composite + role architecture + searchable roster.
- **`TalentMatchTab`** — REAL. `POST /api/employer/hiring/analyze/:jobId` then `GET /api/employer/hiring/assessments/:jobId`; ranked candidates with real engine outputs (fit/readiness/success/ramp-up/retention/performance/leadership/verdict). Calibration (CONFIDENCE axis) from `GET /api/employer/tig/readiness` → `.calibration.status` in a SEPARATE badge.
- **`CompetencyMapTab`** — REAL. Same two endpoints as OrgIntel (`workforce-analytics` flag-gated 503-when-off + `competency-architecture` best-effort), fetched ONCE on mount. Compares per-dept team averages of the real `behavioralIndex`/`cognitiveIndex`/`futureIndex` (0–100, null when not captured) against the role's `proficiency_targets`. The synthetic `generateEmployees()` / `DEPT_PROFILES` / `inferCompetencyLevels` / fake-name PII generators / `generateExternalCandidates()` + `ExternalCandidate` were all DELETED; `dHash` is kept (other widgets).

### CompetencyMapTab is the EXCEPTION to the job-bound async guard
Unlike OrgIntel/TalentMatch, the competency map does a **single mount fetch** and dept/role switches are **pure client-side `.filter()`** over already-loaded `data.employees` (NO refetch per switch). So there is **no async misattribution race here** — only an `aliveRef` cleanup guard (skip setState after unmount) is needed, not the per-job monotonic-token machinery. **Rule:** prefer fetch-once-then-client-filter when the dataset is small enough to load whole; it sidesteps the entire stale-write class.

### CompetencyMap honesty rules (do NOT regress)
- The employer roster captures **behavioural / cognitive / future-readiness** indices only — there is **NO functional-proficiency measurement**. A role's `proficiency_targets.functional` therefore renders as **"not captured" with NO computed gap** (never a fake 0). Future-readiness is the inverse: measured but **no role target** → shown measured-no-target.
- Null/missing indices are **"not captured"**, never coerced to 0 (`avgOf` returns `{value:null,n:0}`; `gapOf` only fires when BOTH avg and target exist).
- `proficiency_targets` may arrive as a **string or object** → parse defensively (try/catch JSON, `Number()` each dim, NaN→null).
- Coverage (assessed/count + per-dimension N) is a **separate banner** from the index VALUES; low-coverage wording is **"directional"**, NOT calibration language (calibration = CONFIDENCE axis, lives only in TalentMatch/drawer).
- Severity on the 0–100 scale: gap ≥20 critical / ≥10 moderate / >0 minor / ≤0 none — applied identically in bar + gap-table; recommendation wording must reflect the **max** present severity (don't collapse minor into "moderate").
- `MARKET_CATALOG` is kept ONLY as a clearly-labelled **external/industry reference** panel ("not your team's measurements"), never mixed into the real-vs-target comparison.

### TalentMatchTab job-bound async guard (critical, do NOT regress)
Same misattribution class as the P2 drawer guard, but per-JOB. Rankings are REAL engine output, so a slow `/assessments/:jobId` (or post-`/analyze` refetch) for a previously-selected job must NEVER render or persist under another job.
**Rule:** bind results to the job they belong to (`assessmentsJobId`) and only display when `assessmentsJobId === selectedJobId` (`resultsReady`); read the live selection through a **ref** (`selectedJobIdRef`, not the closure `selectedJobId`) after every `await`; clear results **synchronously** the instant the user switches jobs (`selectJob()` resets `assessments`/`assessmentsJobId`). Keep a monotonic token too for same-job latest-wins refetches.
**Why:** a closure-captured `selectedJobId` is always equal to itself after an await (the original `if (selectedJobId === jobId)` check was a no-op), and an unbound result list flashes job A's rankings under job B between switch and refetch.

## Intelligence bridge (8 domains)
`GET /api/employer/candidates/:id/intelligence` — compose-only over shared engines:
1. Hiring: CAPADEX `capadex_sessions` by `guest_email`
2. Talent: LBI scores from `lbi_scores` by `user_email`
3. Workforce: pipeline aggregate from `employer_candidates`
4. Leadership: CRA `cra_scores` LEA* domain
5. Learning: LBI scores
6. Career: `career_seeker_profiles` by `user_id`
7. Future Readiness: `frp_assessments` by `user_id`
8. Outcome: `employer_offers` / `employer_candidates` hire history

**Why:** compose-only means zero duplicate computation — reuses existing engine outputs, never re-derives scores.

## Workforce Intelligence
`GET /api/employer/workforce-intelligence` — aggregate analytics across all employer's jobs and candidates: EI distribution, experience breakdown, department breakdown.

## Candidate bulk-import dedup
`POST /api/employer/candidates/bulk-import` dedupes by email scoped to `employer_id`.
- **Normalize on BOTH sides**: incoming rows AND the existing-DB lookup must `lower(trim(email))` — legacy/manual `employer_candidates` rows can carry surrounding whitespace, so trimming only the import side silently lets near-duplicates through.
- **Not race-proof**: there is NO unique constraint on `(employer_id, email)`; two concurrent imports of the same email can both pass the pre-insert check. Production hardening = a functional unique index `(employer_id, lower(trim(email)))` + conflict-safe insert.
- **Honest row status**: post-import, mark a parsed row `imported` only if its email is in the server's returned `candidates[]`; rows attempted-but-absent were server-skipped duplicates, and `invalid[]` (indexed back into the submitted order) are rejections. Never blanket-label every attempted row as imported.

## "Portal not functional" / empty lists — two-bug class (account_type gate + bare-shape)
The employer gate (`app.use` in `employer-portal.ts`) 403s `employer_account_required` unless `req.user.account_type === 'employer'`. Two independent root causes can make EVERY employer GET 403 (only `register` passes, since it's allowlisted + mutates `req.user` for its own request only):
- **`account_type` invisible to drizzle.** The column was added by a raw `ALTER TABLE` in `employer-portal.ts`, NOT in the drizzle `users` schema — so `storage.getUser()` (`db.select().from(users)`) never selected it, AND `deserializeUser` rebuilt `req.user` without it. `req.user.account_type` is therefore `undefined` on every request → permanent 403 after register. Fix = map the column in the drizzle `users` schema (`accountType: text("account_type").default('job_seeker')`) **and** surface it in `deserializeUser`'s `done()` as `account_type`.
- **⚠️ Mapping the column auto-arms a privilege-escalation hole.** `insertUserSchema = createInsertSchema(users)` includes EVERY column, and `/api/register` spreads `...result.data` into `createUser` (sanitizing only `role`). The moment `accountType` is in the schema, a public registrant can self-assign `accountType:'employer'`/`'super_admin'`. **MUST** `.omit({ accountType: true })` from `insertUserSchema` (account_type is provisioned server-side only, via the employer-register raw `UPDATE`). Rule: any column added to the drizzle `users` schema that is privilege-bearing must be omitted from `insertUserSchema`.
- **Frontend bare-shape contract.** Employer GET routes return **bare** shapes (`/jobs,/candidates,/interviews,/offers` = arrays; `/analytics,/company` = objects) — NOT a `{success,...}` envelope (mutations DO return `{success}`). A `load()` that expects an envelope silently discards all data. Read defensively: `res.ok` gate + `Array.isArray()` + `obj?.field ?? obj`.

## Candidate detail drawer — surfacing hiring intelligence (P2)
The Intelligence tab of the candidate detail drawer (`EmployerPortalPage.tsx`) surfaces TWO independent axes, kept in **separate visual sections** (matches the platform's Coverage-vs-Confidence honesty rule):
- **Coverage** = platform intelligence "X of 7 domains active" from `GET /candidates/:id/intelligence` (`domainCoverage`).
- **Confidence** = calibration badge (cold_start / provisional N/30 / calibrated) from `GET /tig/readiness` → `.calibration.status`. Never label "calibrated" below 30 realized hire outcomes (backend k_min).
- Per-candidate fit = `GET /hiring/assessment/:jobId/:candidateId` (6 match dims + 7 predictions; **pg NUMERIC cols come back as STRINGS → `Number()` before any math**); verdict = `hiring_recommendation.verdict` (jsonb). One-click "Rank for this job" = `POST /hiring/analyze/:jobId` (analyzes the WHOLE job's pool), then re-fetch the assessment.

## CandidatesTab bulk actions — "selection" means the VISIBLE selection
Every bulk action (move/send/pool/delete) AND `exportToCsv('selected')` must scope to the currently-visible filtered selection (`filtered.filter(c => selectedIds.has(c._id))`), never the raw `selectedIds` set; the bulk-bar gate + all displayed selection counts use `visibleSelectedCount` (= that list's length).
**Why:** `selectedIds` persists across filter changes, so a user who selects rows then filters has a *hidden* selection. Acting on the global set silently pools/exports/**deletes candidates that aren't on screen** — a destructive surprise and an honesty failure (the confirm count would include rows the user can't see).
**Also (honesty-over-optimism):** bulk pool/delete/move must check each request's `res.ok`, mutate local state only for confirmed-OK ids, and `alert("X of Y ... N failed")` on partial failure — never optimistically flip UI state before the server confirms. CSV export sanitizes formula-injection prefixes (`= + - @` tab/CR → leading `'`) on candidate-controlled string fields.

## Send Assessment loop (Invited → Completed)
The "Send Assessment" button is a real end-to-end loop with NO new join tables — it reuses the existing email-attribution model.
- **Invite link** (`backend/email.ts`): `${baseUrl}/?assess=1&email=<encoded>` — a real SPA deep-link. The old `/assessment` path was DEAD (no such screen in `App.tsx`). The query-string carries the candidate email (PII-in-URL is an accepted tradeoff of the link-based approach; signed tokens would be the hardening path).
- **Deep-link flow**: `App.tsx` reads `?assess=1&email=` (mirrors the existing `?concern=` pattern), strips params via `replaceState`, dispatches `mx-open-assessment` with `{concern,email}` → `LandingPage.tsx` passes `initialEmail` to `FreeAssessmentModal` → modal's open-prefill effect sets **BOTH** `capadexRegEmail` (primary visible/binding field, used first for `guest_email` at session start AND the OTP/report flow) **and** the legacy `regEmail`. Setting only one risks a blank OTP field or a guest_email/report-email mismatch.
- **Binding**: the completed CAPADEX session's `guest_email` = candidate email is the join — same email-join the 8-domain intelligence bridge already uses. Candidate still OTP-verifies (can change the email), so prefill is a convenience not a hard binding.
- **Honest send** (`employer-portal.ts`): single-send marks `assessment_sent=true` + `assessment_sent_at=now()` ONLY when the email actually sent (`if (sent)`); bulk-send returns `sentIds[]` of truly-sent rows. The frontend flips ONLY truly-sent rows (via `sentIds`/`emailSent`), reports sent/failed/skipped honestly, and caveats `@example.com` demo addresses (they bounce). Failed/demo sends are NOT marked invited.
- **Honest completion** (`GET /candidates`, best-effort `try/catch` never-throws): derives `assessmentCompleted` by joining `capadex_sessions` (`lower(trim(guest_email))=ANY emails AND status='completed'`, `max(updated_at)` per email), then **invite-gates**: only marks completed when `assessmentSent && assessmentSentAt` AND `done_at >= assessment_sent_at`. This blocks the major false-positive (old/personal/other-employer sessions for the same email showing "✓ Completed").
  - **Known residual (architect-acknowledged, design-consistent):** completion is matched by EMAIL, not an invite token, so a candidate who completes ANY CAPADEX assessment after the invite (their own / another employer's) attributes to this invite. This is CONSISTENT with the platform's existing email-only intelligence bridge (the Intelligence tab attributes by email regardless), so token-gating ONLY the pill would make it stricter than the intelligence shown beside it. A true strict fix = invite token / persisted `capadex_session_id`, which would touch the public consumer CAPADEX session-start flow (out of approved scope). Conservative false-negatives (legacy `assessment_sent` rows with null `assessment_sent_at`; email-change candidates) are accepted under honesty-over-optimism.
- **Status UI** (`EmployerPortalPage.tsx`): pills/columns/rows distinguish "Invited" (orange, Clock) vs "✓ Completed" (green, BadgeCheck); the Send button is hidden once `assessmentCompleted`.

## Candidate detail drawer — profile summary + résumé/CV (P3)
The drawer gained a Profile Summary card, a Résumé/CV attach·download·remove row, a key-facts grid (Applied for / Applied date / Rating / LinkedIn / Tags), and a Notes block — all between the skills row and the Tabs, all additive.
- **Profile Summary is deterministic prose composed from the candidate's OWN saved fields** (role, experience, education, skills, source, status…) via a pure `buildCandidateSummary(c)` — labelled "Auto-composed … not an AI prediction." NEVER an LLM/inference call (honesty rule).
- **Résumé blob lives in a SEPARATE table `employer_candidate_resumes`** (`candidate_id` PK, `employer_id`, filename, mime, size, base64 `data`, `uploaded_at`), NOT a column on `employer_candidates` — so the candidate LIST query (`SELECT * FROM employer_candidates`) never drags the blob. Same lazy `ensureSchema` block.
- **4 routes** (`requireAuth` + `withSchema`), all multi-segment so the single-segment `/:id` handlers can't swallow them: `GET …/:id/resume/meta` (JSON meta|null), `GET …/:id/resume` (binary, `Buffer.from(base64)`, `Content-Disposition: attachment`, filename sanitised `[^\w.\-]→_`, 404 if none), `POST …/:id/resume`, `DELETE …/:id/resume`. EVERY query JOINs/scopes to `ec.employer_id = eid(req)` (IDOR guard) — candidate id is a PK so cross-employer read/overwrite via guessed id is unreachable.
- **POST validation order**: ext ∈ pdf/doc/docx/txt/rtf/odt → 415; cheap **pre-decode** size guard (`(b64.len*3/4) > 5MB+1KB` → 413) BEFORE allocating the buffer; verify candidate owned → 404; decode → 400 on bad base64; empty → 400; decoded > 5MB → 413; normalise via `buf.toString('base64')` (strips whitespace); `ON CONFLICT (candidate_id) DO UPDATE` also sets `employer_id = EXCLUDED.employer_id` (defensive). Global `express.json({limit:'8mb'})` bounds the request.
- **Downloads MUST use fetch+blob, NOT `<a href>`** — employer auth is a **bearer token** via `authHdr()`, and a plain anchor sends no Authorization header (would 401). `downloadResume` fetches with `authHdr()`, builds an object URL, clicks a transient `<a download>`, revokes the URL.
- **Upload/remove reuse the P2 monotonic-token guard**: capture `detailReqRef.current` before the async write, drop the `setState` if the drawer moved on. The server write stays bound to the captured `cid`, so a mid-upload drawer switch can't misattribute the file. `openDetail` fetches `/resume/meta` inside the existing `Promise.all` (5th entry) and applies only if not stale.
- Key-facts grid only renders REAL `Candidate` fields not already shown elsewhere in the drawer; whole grid hidden when all are empty (honest empty state).

## Custom role profiles (CompetencyMap "Option 2")
Employers build their OWN role profiles in the Competency Map by attaching REAL competencies from the imported ontology library AND/OR adding custom competencies; these become the role REQUIREMENTS that drive the gap analysis.
- **Table `employer_competency_roles`** (lazy schema in `eios-workforce.ts`) — employer-scoped, `UNIQUE(employer_id, role_code)`, `competencies` + `proficiency_targets` JSONB. **DELIBERATELY DISTINCT from the GLOBAL `eios_competency_roles`** (whose PK is bare `role_code` — a multi-tenant collision trap; one employer's edit would clobber all). `role_code` for custom rows = `CUSTOM_<uuid>`.
- **Flag-gated by `FF_EIOS_WORLD_CLASS_VERIFIED_V2`** (`isEiosWorldClassVerifiedEnabled()`) like the rest of the Competency Map. The `competency-architecture` GET **appends** custom roles ONLY when the flag is on and adds the `customCount` field ONLY when on → **flag-OFF is byte-identical** (seeded roles only, no extra field). CRUD routes 503 when off.
- **CRUD** `GET/POST /api/employer/eios/custom-roles` + `PUT/DELETE /custom-roles/:id` — `requireAuth`+`wrapE` (never-throws), every query scoped by `eid(req)` (IDOR), **literal collection route registered before the `/:id` param route**. `sanitizeCustomRole` bounds all strings + clamps targets 0–100 + whitelists dimension∈{behavioral,functional,cognitive} & source∈{ontology,custom}; `mapCustomRoleRow` also derives the seeded-shape `*_competencies` arrays so custom + seeded roles render through the SAME UI path (`reqGroups` reads `competencies[]` for custom, `*_competencies` for seeded).
- **Frontend** (`EmployerPortalPage.tsx`): `CompetencyMapTab` controls card gains an optgroup-split role `<select>` (Standard vs "Your custom role profiles") + Custom-role/Edit/Delete buttons; a "Role requirements" card; and a module-level `CustomRoleBuilderModal` (ontology browser: domain→family→**300ms debounced** search with a `searchTokenRef` stale-guard reading `/api/ontology/{domains,families,competencies}` → `{ok,data:[...]}`; attach-as-dimension picker; add-custom-competency; grouped removable attached list; 0–100 target inputs).
- **Honesty (do NOT regress):** attached competencies are role REQUIREMENTS only — the platform measures the aggregate **behavioural + cognitive** dimensions per roster, NEVER per-competency proficiency, and **functional is explicitly labelled "not captured"** (badge + footnote). Reuses the existing CompetencyMap rule that functional target → no computed gap.
- **Async safety:** modal has its OWN `aliveRef` (unmount guard); the tab reuses the existing `archTokenRef` monotonic guard via `refetchArch()` after every save/delete; a `roles`-disappear effect re-points `selectedRoleCode` to a live role so a deleted role can't leave a ghost selection.

## Hiring Team CRUD + Talent Pool outreach (P3 — real, replaced MOCK_TEAM + fabricated re-engage)
Two new lazy tables in `employer-portal.ts` `ensureSchema`: `employer_team_members` (`UNIQUE(employer_id,email)`) + append-only `employer_pool_outreach` (idx on `(employer_id,candidate_id)`). Two Zoho senders in `email.ts`: `sendTeamInviteEmail` + `sendTalentOutreachEmail`.
- **Team is a managed roster + invite, NOT RBAC.** `access_level` documents the intended role; sending an invite does NOT provision login/permissions. The frontend Permissions Matrix is a *role framework* doc, not an enforcement surface. Say this in the invite-modal copy so it isn't mistaken for access control.
- **Outreach uses an OUTBOX pattern (do NOT regress to send-then-log).** Insert a `status='pending'` row BEFORE calling SMTP, then `UPDATE` to `'sent'` (set `sent_at=now()`) or `'failed'`. The GET history aggregates **only `status='sent'`**. **Why:** if you send first and the log insert fails, a delivered email looks unsent → the recruiter re-sends → duplicate. Persisting intent first means a post-send failure leaves an honest `pending`/`failed` row, never a phantom-unsent delivered email.
- **Demo `@example.com` honesty (two different behaviours):** team invite → roster row IS created but `emailSent:false, demo:true` (no email). Outreach → NOT sent and **NOT logged** at all (`success:true, demo:true, sentAt:null`) — never write a delivery row for an address known to bounce.
- **Recruiter free-text body is HTML-escaped** (`escapeHtml` in `email.ts`, `\n`→`<br/>`) before insertion into the email HTML — the outreach message is user-authored, so unescaped insertion is an HTML-injection vector.
- **UNIQUE(employer_id,email) race:** the pre-insert SELECT-dup check is not race-proof; the INSERT is wrapped to map pg error `23505` → 409 (not 500) for concurrent duplicate invites.
- **Frontend (`EmployerPortalPage.tsx`):** `TeamTab` (no props) does real fetch/invite/edit/delete with loading/error/empty states; `PoolTab` loads `/pool/outreach` on mount into an `outreachMap` and shows a real "Contacted &lt;date&gt;" indicator + a compose modal (editable prefilled subject/body referencing the candidate's real skills/role). Removed `MOCK_TEAM`, `REENGAGEMENT_MSGS`, the fake "AI Re-engage signal" block, and the `mailto:` re-engage link. Both tabs use an `aliveRef` mount guard (single shared surface, no per-row async race here — each action captures its target before the await and disables while in flight, so the heavier monotonic-token machinery isn't needed).

## Résumé MIME is server-derived, NEVER client-trusted (stored-XSS class)
A résumé/CV is uploaded by an UNTRUSTED party (public apply + public self-completion) and later rendered in the recruiter's drawer viewer — so the stored MIME is an attack surface.
- **Rule:** the stored/served `mime` is DERIVED from the validated file extension (`RESUME_EXT_MIME` map in `employer-portal.ts`); the client-supplied `mime` is **ignored entirely**. No allowed extension maps to an executable type; `.txt`→`text/plain`. **Why:** otherwise an applicant uploads a `.txt`/`.pdf` whose body is HTML with `mime:text/html`, and the inline blob-iframe viewer executes it under the app origin (stored XSS). This bit us once — caught in review, not prod.
- **Defense in depth at THREE layers** (one alone is insufficient): (1) `validateResumePayload` derives `cleanMime` from ext at store time; (2) the download endpoint **re-derives** Content-Type from the STORED filename's ext (neutralises legacy/poisoned rows) + sets `X-Content-Type-Options: nosniff`; (3) the frontend viewer renders text via `blob.text()` into an **escaped `<pre>` React text node — NEVER an iframe**; only PDF/image use a blob URL, everything else is download-only.
- **Blob URL lifecycle:** revoke on `closeResumeView` AND via a `useEffect` cleanup keyed on `resumeView?.url` (covers unmount + replacement; double-revoke is an idempotent no-op).

## Applicant self-completion loop (recruiter → APPLICANT fills own gaps)
Recruiter triggers a token-scoped public page so the applicant completes missing fields themselves (vs the recruiter attaching).
- **4 cols on `employer_candidates`** (lazy ALTER … IF NOT EXISTS): `complete_token_hash`, `complete_token_expires`, `completion_requested_at`, `completion_completed_at`. Token = 32-byte base64url, **only the sha256 hash is persisted**, 14-day expiry, rotated on every request (invalidates prior links).
- **`POST …/:id/request-completion`** (`requireAuth`+`withSchema`+`eid` IDOR): computes `missing[]` deterministically (no inference), rotates token, emails an **ABSOLUTE** link only (`hasAbsoluteBase` regex over `APP_BASE_URL`/`REPLIT_DEV_DOMAIN`) — a relative link in an email is unclickable, so if no absolute base OR `@example.com` demo OR no email, it **skips sending and returns `link` for manual sharing** (`link: !sent ? link : undefined`). Frontend "not sent" copy must cover ALL three skip reasons, not just demo.
- **Public GET/POST `/api/employer/public/complete/:token`** (UNAUTH, token-gated): `completionThrottle` IP limit, `Referrer-Policy: no-referrer` + **`Cache-Control: no-store`** (PII lives in the token URL), generic 404 on bad/expired (no oracle). GET exposes MINIMAL data (first name, company, job title, read-only email, current editable values, `missing[]`) — **never scores, never other candidates**. POST writes editable fields only via **CASE-WHEN-nonempty** (an empty form field NEVER wipes existing data), email stays identity, résumé validated BEFORE any mutation, sets `completion_completed_at`.

### Async-write misattribution guard (critical, do NOT regress in P3/P4)
**Rule:** any async fetch that writes per-candidate hiring data into the shared drawer state MUST be guarded by a **monotonic request token** (`const token = ++detailReqRef.current` on open; `isStale()` = `detailReqRef.current !== token`), re-checked **after every `await` — including after `await res.json()`, parsed into a local var first** — before each `setState`.
**Why:** the drawer is a single shared surface; without the guard, opening candidate B while A's fetch is in flight (or re-opening the same candidate) writes A's fit score / verdict into B's drawer — a hiring-decision misattribution, the worst possible honesty failure here. A candidate-id ref alone is insufficient (misses same-candidate re-opens) — use a monotonic counter.
**How to apply:** also parse each section with an ok-gated `safeJson` (try/catch → null) so one failed response degrades only its own section (honest empty, never fabricated), and reset transient flags (`analyzingFit`) on every open.
