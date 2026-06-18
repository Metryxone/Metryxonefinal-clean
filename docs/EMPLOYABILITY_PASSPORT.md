# Employability Passport (T-P7)

A single, shareable candidate artifact. The owner opens it **in-page** from a card on the
Career Command Center (Dashboard) tab; a public/recruiter view is reachable via a signed
`/passport/:token` link. It is **additive and reuse-only** — no new engine, store, service,
ranking model, or database table.

---

## 1. Reuse (what already existed)

| Need | Reused asset |
| --- | --- |
| Per-user IDOR guard | `resolveEffectiveUserId` (now `export`ed from `backend/routes/behavioural-memory.ts`) — same super-admin-aware, cross-user-rejecting helper the rest of Career OS uses. |
| Storage | `career_seeker_profiles.data` JSONB (read/write via the existing `pool` from `backend/storage`). Passport lives at `data.passport`. **No new table, no migration.** |
| Competencies | The EI competency breakdown (`eiBreakdown.components`) already computed and on the Dashboard — no fetch. |
| Career Readiness | `eiScore` + the platform's canonical EI band cut-offs (Elite ≥75 / Strong ≥55 / Developing ≥35 / Foundation). |
| Skills / Projects / Certifications | The existing CV profile (`profile.skills/projects/certifications`). |
| Assessment summary | `GET /api/career/behavior-graph/:userId` (Unified Behavior Graph — P2). |
| Career Growth Report | `GET /api/career/behavioural-memory/:userId` growth deltas (P5/P6 source). |
| Verified Credentials | `GET /api/verification/trust` (existing 8-adapter trust engine). |
| UI canon | `SectionCard` + `COLOR` from `@/components/career` / `@/design-system`; navy `#344E86`, border `#E8EBF4`. |
| PDF export | `html2canvas` + `jsPDF` dynamic-import pattern (same as `CapadexReportPhase`). |
| Public no-auth route | App.tsx path-prefix precedent (`/parent-consent/:token`, `/upload/...`). |
| Feature gating | `FEATURE_FLAGS` registry + `isFlagEnabled` (`employabilityPassport`, default ON). |

## 2. Dependencies

- **Runtime:** none new. `html2canvas` + `jspdf` were already installed and are code-split
  (`dist/assets/html2canvas.esm-*.js`, `dist/assets/jspdf.es.min-*.js`).
- **Schema:** none — snapshot stored inside the existing `career_seeker_profiles.data` JSONB.
- **Cross-file:** the public route reads only rows that carry `data.passport.shareToken`.

## 3. Integration points

- `backend/config/feature-flags.ts` — added `employabilityPassport: true`.
- `backend/routes.ts` — `import` + `registerEmployabilityPassportRoutes(app, requireAuth)`
  (next to `registerBehaviouralMemoryRoutes`).
- `backend/routes/behavioural-memory.ts` — `resolveEffectiveUserId` exported (one-word change).
- `frontend/src/pages/CareerBuilderPage.tsx` — Dashboard tab: "Employability Passport" card +
  `Open Passport` CTA → `PassportOwnerModal` (in-page overlay; no new tab).
- `frontend/src/App.tsx` — `passport-public` Screen + `/passport/:token` path-prefix routing
  (getInitialScreen + popstate + lazy `PassportRecruiterView`).

## 4. Implementation

**Design: snapshot-on-share.** The owner assembles the passport client-side
(`assemblePassportSnapshot`) from data already on the page plus best-effort authed reads,
then POSTs that snapshot. The backend stores `{ shareToken, visibility, snapshot, sharedAt }`
at `career_seeker_profiles.data.passport` and mints a fresh `crypto.randomBytes(18)` base64url
token on every share (a refreshed link supersedes the old one). The public endpoint returns
the stored snapshot — no server-side recompute, no DB-pool-topology hazard, and stronger
privacy (nothing is published unless the candidate explicitly shared it).

**Routes** (`backend/routes/employability-passport.ts`):

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/career/passport/:userId/share` | requireAuth + IDOR | Store snapshot + visibility, mint/refresh token. |
| DELETE | `/api/career/passport/:userId/share` | requireAuth + IDOR | Revoke (clear `data.passport`). |
| GET | `/api/career/passport/:userId/share-status` | requireAuth + IDOR | Current link metadata (no snapshot body). |
| GET | `/api/public/passport/:token` | **none** | Sanitized, visibility-filtered snapshot. |

**Sections (8) & visibility.** `competencies`, `assessment`, `skills`, `projects`,
`certifications`, `careerReadiness`, `verifiedCredentials`, `growthReport`. All default
**visible**; the owner toggles each via the eye control. **Contact is never published** —
the snapshot omits it entirely and the public endpoint strips any contact-like field from
the header defensively.

**Feature flag.** All four routes (incl. the public one) 503 when `employabilityPassport`
is off; the owner modal surfaces a friendly "sharing disabled" message and the public view
renders an "unavailable" state.

**Files added:** `backend/routes/employability-passport.ts`,
`frontend/src/lib/passport/passportClient.ts`,
`frontend/src/components/passport/EmployabilityPassport.tsx`
(presentational `EmployabilityPassport` + `PassportOwnerModal` + `PassportRecruiterView`).

## 5. Validation

- **Build:** `vite build` passes clean (html2canvas/jspdf code-split as separate chunks).
- **Auth/gate (runtime, no session):** `POST`/`DELETE`/`GET share-status` → `401`;
  `GET /api/public/passport/<unknown>` → `404 {"error":"passport_not_found"}` (feature ON).
- **Privacy:** public sanitizer drops the contact section + header email/phone/linkedin/github,
  filters sections by the owner's visibility flags, AND recursively scrubs contact-shaped
  substrings (email / phone / linkedin·github URLs) from every remaining free-text field —
  contact cannot leak even if embedded in a headline or project description.
- **Data integrity:** share/revoke use atomic single-key JSONB writes (`jsonb_set` / `#- '{passport}'`)
  — never a read-modify-write of the whole `data` blob, so concurrent updates to other profile
  keys are never clobbered.
- **IDOR:** cross-user write/read rejected by `resolveEffectiveUserId` (403), not silently
  redirected.
- **Degradation:** every assembler fetch is best-effort — a missing behaviour graph / memory
  / trust simply omits that section; the passport still renders from profile + EI.
