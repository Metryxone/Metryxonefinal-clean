# MX-74X · Section 7 — Career Passport Integration (existing asset — documented)

**Status:** EXISTING. **Route:** `backend/routes/employability-passport.ts`.
**Flag:** `employabilityPassport`. **Snapshot:** `career_seeker_profiles.data.passport` (JSONB).

---

## 1. Current behaviour

The Employability Passport is a publishable snapshot of the candidate's career intelligence.
Contact information is **never** published. The snapshot is currently **client-assembled** in
`frontend/src/lib/passport/passportClient.ts` and shared via
`POST /api/career/passport/:userId/share`; it is not auto-updated when upstream signals change.

## 2. MX-74X position (honest scope statement)

MX-74X is "activate + connect + document". The two new engines (Career Path, Learning Path) are
read-only and super-admin gated, so they are **not** wired into the candidate-published passport
in this phase (the passport is candidate-scoped and contact-sensitive). Surfacing path/learning
data into the passport would require a self-scoped, contact-safe endpoint and is recorded as a
**follow-up**, not silently implemented.

What IS connected now: the passport continues to read the same competency/readiness substrate the
new engines compose from, so the underlying data is consistent. The passport snapshot path is
unchanged → flag-OFF and current behaviour are byte-identical.

## 3. Follow-up (not done in MX-74X)

- A self-scoped `GET /api/career/path|learning/:userId` (candidate identity, IDOR-guarded via
  `resolveEffectiveUserId`) feeding an auto-synced passport section. Deferred — would change
  candidate-facing surface and needs its own approval.
