# MX-302A — Career Launchpad & Experience Routing · Founder Report

_Validation harness: `backend/audit/mx-302a/validate-mx302a.ts` · machine results: `validation-results.json`_

## Verdict: **PASS (structural)** — STOP for founder approval before merge/deploy

The structural contract is complete and proven: career seekers are captured with a
**Career Stage** at registration and routed to the experience that fits them, with an
in-app **experience switcher** to move between them. The whole feature is **additive and
flag-gated** (`careerLaunchpad`, default **OFF**); with the flag OFF the product is
**byte-identical to today, including the database schema**. Existing users get a
**derived** stage so nobody is left without an experience.

> **Structural ⟂ Adoption** (kept separate, never composited). This report certifies the
> routing _contract_ (deterministic, tested). It does **not** claim live adoption — how
> many real users pick a stage can only be measured against the live DB after the flag is
> turned ON. That is honest, not a gap.

## What shipped

| Area | Change |
|------|--------|
| Rename | User-facing **"Fresher Hub" → "Career Launchpad"** in nav, dashboard banner, and the tab header. Internal tab id stays `fresher-hub` (no route/deep-link breakage). |
| Registration | Career seekers pick a **Career Stage** (required when flag ON) plus a short, optional education/career profile (field of study, years of experience, current/target role). |
| Routing | The chosen stage routes the new user to the right experience and lands them on its tab via the existing `dashboardTarget` mechanism. |
| Switcher | A flag-gated **experience switcher** in the Career Builder sidebar lets a user move between the experiences available to their stage; the choice persists as a **navigation preference** and re-routes. It **never changes the user's canonical stage** — switching down can't demote them and no request can escalate them into a stage they don't hold. |
| Authorization | The switch is **enforced on the server**: the requested experience must be within the set allowed for the user's stage, and only career seekers may switch. The client dropdown is only a hint. |
| Existing users | A backward-compat **deriver** infers a stage from existing profile signals (role, seniority text, years of experience, presence of work history); when nothing is derivable it defaults to the Command Center — no regression. |
| One record | Stage is a new **nullable column on the existing `career_seeker_profiles`** table (one user = one record). The structured profile lives in that row's `data` JSONB. **No new user table.** |
| Audit trail | Both the registration routing decision and every experience switch are written to the redacted platform audit trail (`platform_audit_log`). |

## The four experiences

| Experience | Lands on | Stages routed here | Status |
|------------|----------|--------------------|:------:|
| **Career Launchpad** | `fresher-hub` | student · graduate · postgraduate · internship-seeker · early-career | **Live** |
| **Career Command Center** | `dashboard` | mid-career | **Live** |
| **Leadership Studio** | `leadership-studio` | senior-leadership | **Live** |
| **Executive Studio** | `executive-studio` | executive | **Live** |

> **Update (MX-302A follow-up):** Leadership Studio and Executive Studio now each render a
> **dedicated surface** tailored to senior and executive users — they no longer borrow the
> Command Center. Leadership Studio ships a leadership-readiness gauge, a team roster, a
> stakeholder map, and a leadership playbook; Executive Studio ships an executive-readiness
> gauge, a strategic-priorities tracker, a board/stakeholder map, and an executive playbook.
> Both flipped to `available: true`, the "(soon)" label is gone, and the switcher routes each
> stage to its own tab. The dedicated nav entries appear only for stages that unlock them
> (server-authoritative `allowedExperiences`).

## Success-criteria certification

| # | Criterion | Status | Evidence |
|---|-----------|:------:|----------|
| C1 | 8 canonical career stages | **PASS** | All 8 stages present in the single-source engine. |
| C2 | Every stage routes to a defined experience | **PASS** | All 8 stages resolve to a mapped, defined experience. |
| C3 | 4 experiences, each with a dedicated live surface | **PASS** | All four (Launchpad, Command Center, Leadership Studio, Executive Studio) are `available: true` and route to their own tab. |
| C4 | Experience ↔ representative-stage round-trip | **PASS** | The switcher's experience→stage choice re-resolves to the same experience. |
| C5 | Allowed experiences widen with seniority | **PASS** | 2 (junior/mid) → 3 (senior) → 4 (executive); never below 2. |
| C6 | Existing users get a derived stage | **PASS** | Deriver covers role/seniority/years/history; returns null only when nothing is derivable (defaults to Command Center). |
| C7 | Input guards reject junk | **PASS** | Unknown / empty / null / wrong-type stage & experience values rejected. |
| C8 | Flag exists & defaults OFF (byte-identical-OFF incl. schema) | **PASS** | `careerLaunchpad` default OFF; not in any always-on suite; ensure-schema DDL runs only on the flag-ON code path; routes 503 when OFF. |
| C9 | One user = one record; no new user table | **PASS** | Migration is ALTER-only on `career_seeker_profiles`; persist UPSERTs the existing PK row. |
| C10 | Experience switching is authorization-bounded (no escalation) | **PASS** | A forbidden/stale preference is ignored and falls back to the stage default; an allowed one is honoured; every stage's default is always within its own allowed set. |

_All 10 checks PASS — see `validation-results.json` for the full machine output._

## Security / authorization

The experience switcher is a **navigation preference, not a privilege**. Two server-side
gates make this safe regardless of what the client sends:

1. **Transition gate** — the requested experience must be within
   `allowedExperiences(currentStage)`; anything else is rejected (403). The client
   dropdown only ever shows allowed options, but the server is the authority.
2. **Role gate** — only career seekers (`career_seeker` / `job_seeker`) may switch;
   unrelated roles are rejected (403).

Crucially, switching **never mutates the canonical career stage**. An earlier design that
persisted a "representative stage" for the chosen experience would have let a request
escalate a junior user to an executive stage (and silently demote a senior user when they
visited a lower experience). The stage stays the user's identity (set at registration /
derived); the preference only changes which allowed surface they land on.

## Honesty notes (what this is NOT)

- **No adoption claim.** This is a structural certification of the routing contract, not a
  measure of how many users chose a stage. Adoption is a separate axis, measurable only on
  the live DB once the flag is ON.
- **No fabricated tiers.** Leadership/Executive Studio now each render a real dedicated
  surface (readiness gauge + working trackers + playbook); we did not ship empty shells.
  Their readiness gauges are developmental self-snapshots, never performance verdicts.
- **No schema drift when OFF.** The column is added by a lazy ensure-schema that fires
  **only on the flag-ON path**; with the flag OFF, registration and the schema are unchanged.

## Verification performed

- `backend/audit/mx-302a/validate-mx302a.ts` — 10/10 PASS (pure engine + flag + authorization contract).
- Frontend `vite build` — succeeds (the real launch gate).
- Backend API restart — clean; `GET /api/career/experience/enabled` returns **503** (flag OFF),
  confirming byte-identical-OFF.

## Rollout

1. Founder approval (this report). **Do not merge/deploy before approval.**
2. Set `FF_CAREER_LAUNCHPAD=1` (or flip `careerLaunchpad`) in the target environment to enable.
3. After enabling, measure live adoption against `career_seeker_profiles.career_stage` and the
   `platform_audit_log` routing entries — that is the adoption axis, reported separately from this
   structural verdict.
