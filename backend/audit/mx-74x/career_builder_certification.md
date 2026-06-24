# MX-74X · Section 13 — Career Builder Certification

**Task:** MX-74X-CAREER-BUILDER-INTELLIGENCE-TRANSFORMATION
**Date:** 2026-06-24 · **Verdict:** ✅ CERTIFIED for the activate+connect scope · STOP before deploy.

---

## 1. Scope certified

ACTIVATE + CONNECT existing Career Builder intelligence (no rebuild), plus the two genuine missing
links (Career Path, Learning Path), behind a durable master suite flag. Additive · reversible ·
flag-gated · backward-compatible · evidence-backed.

## 2. Evidence-backed checklist

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Durable activation (survives clean boot) | ✅ | minimal `.replit` cmd → 7 career routes `401` (gated), proc `FF_CAREER` count = 0 |
| 2 | Master kill-switch byte-identical OFF | ✅ | `FF_CAREER_BUILDER_SUITE=0` → all 13+2 flags `false` → routes `503` |
| 3 | Granular override wins | ✅ | suite ON + `FF_CAREER_PATH=0` → careerPath `false`, learningPath `true` |
| 4 | No recursion in suite resolution | ✅ | suite excluded from `CAREER_SUITE_FLAGS` |
| 5 | Career Path engine — graph-backed, honest | ✅ | `adaptive_smoke_1` 4-role path cov=75/high; no-anchor → `measurable:false` |
| 6 | Learning Path engine — sequence + honest rec join | ✅ | steps w/ horizon+action; `rec_backed:false` disclosed; unmapped recs surfaced |
| 7 | GET never writes | ✅ | flag-gate before DB; engines `to_regclass`-probe, no `ensure*Schema` on GET |
| 8 | Compose never recompute | ✅ | engines call match/readiness/gap/roadmap/recs; no score recomputed |
| 9 | Coverage ⟂ Confidence everywhere | ✅ | both envelopes ship separate `axes.coverage` / `axes.confidence` |
| 10 | null = missing, never fake 0 | ✅ | unmeasured → `null`; `measurable:false` + note, never fabricated path |
| 11 | IDOR-safe | ✅ | `requireAuth + requireSuperAdmin` on every `:subject` route |
| 12 | Route order (literal before param) | ✅ | `_meta/status` registered before `/:subject` |
| 13 | Frontend launch gate passes | ✅ | `vite build` produced fresh `frontend/dist` with the new panel sections |
| 14 | Frontend connection | ✅ | `CareerIntelligencePanel.tsx` surfaces both engines read-only |
| 15 | No accuracy fabrication | ✅ | predictive posture: 4 axes separate; no realized outcomes → no accuracy claim |

## 3. Honest gaps (disclosed, not hidden)

- **Learning Path rec-backing is low** by construction — the live recommendation engine emits
  role/industry/function recs that legitimately do not map to a competency gap. Coverage reflects
  this honestly (cov=0 for the demo subjects); not a defect.
- **Passport auto-sync NOT done** — deferred as a follow-up (candidate-scoped, contact-sensitive;
  needs its own self-scoped endpoint + approval).
- **No predictive accuracy** — no realized-outcome population yet; calibration is a follow-up.
- **Persona UIs (Section 9–11):** Super-Admin surface is delivered (the extended panel). Candidate
  and Employer persona surfaces are NOT delivered in this phase (the new engines are super-admin
  gated by design); recorded as scope, not silently claimed.

## 4. Reversibility statement

`FF_CAREER_BUILDER_SUITE=0` returns the entire Career Builder to byte-identical legacy behaviour:
all career routes `503`, the panel sections render nothing (queries error → guarded), and no schema
or data is touched. Fully reversible.

## 5. Deploy posture

**STOP for approval before merge/deploy** (user preference). This certification covers the build
only; no deployment performed.
