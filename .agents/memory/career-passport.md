---
name: Career Passport system
description: Lifelong portable career record — 12 cp_* tables, CRUD, sharing, verification, bridge from platform data.
---

## Key decisions

**Generic CRUD via SECTION_CONFIG whitelist** — table names and allowed columns are whitelisted in a static map; column names never come from user input; values always parameterized. This prevents SQL injection while keeping the route file compact.

**Why:** The 9 sections have different columns but identical CRUD patterns. The alternative (9 separate route handlers) would be ~600 lines of duplication.

**How to apply:** Add new sections by extending SECTION_CONFIG. Never interpolate req.params/req.body column names directly into SQL.

---

**Lazy passport creation (ensurePassport)** — UPSERT on (user_id) returns the id; called at the start of every user route. The cp_passport row is the FK anchor for all child tables.

**Why:** Avoids a separate "create passport" step; the passport exists the moment the user visits the tab.

---

**Platform bridge is additive-only** — syncPassportFromPlatform uses ON CONFLICT DO NOTHING. It never overwrites manually entered data. platform_verified=true marks auto-synced items; integrity_hash (SHA-256) is set on each.

**Why:** Preserves user edits; bridge is idempotent and safe to run repeatedly.

---

**section_visibility gates public share** — the public /api/passport/shared/:token reader checks both the token's sections array AND the passport's section_visibility setting. If section_visibility[sec] is 'private', it's excluded even if the token allows it. share_scores flag additionally gates readiness_scores.

**Why:** Owner retains control even after creating a share link.

---

**Verification tiers** — self_declared (default) → platform_verified (bridge auto-set) → third_party_verified (email-token flow via cp_verification_requests + PATCH /api/passport/verify/:token). Frontend shows blue badge for platform, green for third-party, gray circle for self-declared.

---

## Tables
cp_passport (anchor), cp_competencies, cp_assessments, cp_projects, cp_achievements,
cp_certifications, cp_experience, cp_learning_history, cp_career_goals,
cp_readiness_scores, cp_share_tokens, cp_verification_requests.

All foreign-key to cp_passport(id) ON DELETE CASCADE.

## Completeness weights (adds to 100)
experience=20, assessments=20, competencies=15 (graduated), scores=10,
certifications=10, projects=10, goals=5, achievements=5, learning=5.

## Flag
FF_CAREER_PASSPORT=1 (enabled in Backend API workflow). Default false in feature-flags.ts.
