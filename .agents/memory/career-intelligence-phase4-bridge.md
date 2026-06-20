---
name: Career Intelligence Phase 4 additive bridge
description: How the flag-gated Career Intelligence enrichment is wired into existing career surfaces, and the IDOR trap that rejected two prior completions.
---

# Career Intelligence Phase 4 — additive bridge wiring

`buildCareerIntelligence(pool, subjectId)` composes the six career surfaces (readiness/
pathways/planning/growth/development/builder) read-only. `attachCareerIntelligence(pool,
req, requestedId, base, pick?)` is the single primitive that surfaces it into the EXISTING
user-facing career routes by enriching their `res.json` payload.

## The additive contract (why each piece exists)
- Flag OFF (`isCareerIntelligenceEnabled()` / `FF_CAREER_INTELLIGENCE`, default OFF) =>
  return `base` immediately, NO DB touch, NO bridge build => byte-identical legacy.
- Flag ON => resolve subject via `resolveEffectiveUserId` then attach an additive
  `career_intelligence` key (or a caller-chosen slice via `pick`).
- Never throws: any failure degrades to `base` so the legacy surface can't break.
- Honest axes: the envelope reports Coverage and Confidence as SEPARATE objects; a subject
  with no EI data returns `measurable:false` (never fabricated).

## The IDOR trap (rejected TWO completions)
Gating only the ENRICHMENT with `resolveEffectiveUserId` is NOT enough. The underlying
route handlers (e.g. `GET /api/career/pi/pathway-intelligence/:userId`, `GET/POST/PATCH
/api/career/pi/growth-plan/:userId...`) queried `req.params.userId` directly under only
`requireAuth` — so a non-super-admin could still read/write another user's CORE data even
when enrichment was withheld.

**Why:** an additive layer can't retro-fix a pre-existing broken-access-control hole; the
core query trusts the path param independently of the enrichment.

**How to apply:** when wiring enrichment into a `:userId` route, ALSO resolve the subject at
the handler START and use the resolved id for the core DB queries:
```ts
const resolved = resolveEffectiveUserId(req, req.params.userId);
if (resolved.forbidden) return res.status(403)...;
if (!resolved.userId) return res.status(401)...;
const userId = resolved.userId;
```
`resolveEffectiveUserId` (in `routes/behavioural-memory.ts`): super_admin may target any
requested id; everyone else is pinned to their own; explicit cross-user => `forbidden`.

Apply the guard to the WHOLE resource (the GET and its mutators), not just the read, or the
write path stays open. Sibling `:userId` routes on the same file (forecast/history/
interventions/outcomes) share the pattern and need the same guard when touched.
