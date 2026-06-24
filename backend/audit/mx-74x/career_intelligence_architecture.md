# MX-74X · Section 2 — Career Intelligence Architecture

**Task:** MX-74X-CAREER-BUILDER-INTELLIGENCE-TRANSFORMATION
**Scope:** Section 2 — the activate/connect architecture, grounded in real assets.
**Date:** 2026-06-24
**Principle:** ACTIVATE + CONNECT existing engines. No rebuild, no replacement. Additive ·
reversible · flag-gated · backward-compatible. Flag-OFF is byte-identical to legacy.

---

## 0. One-paragraph thesis

Career Builder already contains a complete, read-only, compose-only intelligence stack
(Phases 4.2–4.7, 4.10, the Phase-4 bridge, Phase-6 activation). The MX-74X transformation
does **not** add intelligence; it makes activation **durable** (a master suite flag) and
fills the **two missing links** between adjacent working stages — Career Intelligence →
**Career Path** and Career Intelligence → **Learning Path**. Everything else is connect +
document.

---

## 1. The target flow (and what already backs each stage)

```
Assessment results ─┐
Competency profile ─┤   (onto_competency_profiles / onto_competency_score_runs)
Role DNA targets   ─┤   (onto_role_competency_profiles, computeRoleReadinessV2)
Employability Index─┘
        │
        ▼
  Career Readiness ........... services/career-readiness-aggregator.ts   [careerReadiness]
        │
        ▼
  Role / Industry / Function . services/{role-readiness-v2,industry-readiness,
  readiness                     function-readiness}.ts                    [careerReadiness]
        │
        ▼
  Career Match (anchor role) . services/career-match-engine.ts           [careerMatch]
        │
        ├──▶ Skill-Gap Intelligence . services/career-gap-engine.ts      [careerGap]
        │
        ├──▶ ★ Career Path .......... services/career-path-engine.ts     [careerPath]   ◀ NEW LINK
        │        (composes match + readiness + gap; traverses cg_role_edges / cg_tracks)
        │
        ▼
  Career Roadmap ............. services/career-roadmap-engine.ts         [careerRoadmap]
        │
        ├──▶ Recommendations ...... services/career-recommendation-aggregator.ts [careerRecommendation]
        │
        └──▶ ★ Learning Path ....... services/learning-path-engine.ts    [learningPath] ◀ NEW LINK
                 (composes roadmap dev-plan + recommendations; gap→action→horizon sequence)
        │
        ▼
  Career Intelligence bridge . services/career-intelligence-bridge.ts    [careerIntelligence]
        │
        ▼
  Candidate activation ....... routes/career-competency-activation.ts    [careerIntelligenceActivation]
  Passport snapshot .......... routes/employability-passport.ts          [employabilityPassport]
```

The two `★ NEW LINK` engines are the only net-new compute. Both are **compose-only** (they
call the existing engines, never recompute a score) and **never-throws** (any unresolved hop
degrades to `measurable:false` + an honest note).

---

## 2. The durable-activation layer (the real fix)

The audit (Section 1 §0) proved the activation was *real but fragile*: every career flag
defaults OFF and was only enabled by `FF_*` env vars in a runtime-only workflow command that
is lost on a plain restart/redeploy.

**Fix — master suite flag.** `backend/config/feature-flags.ts`:

- New flag `careerBuilderSuite` (default `true`).
- `CAREER_SUITE_FLAGS` Set enumerates the 13 career flags + the two new ones
  (`careerPath`, `learningPath`).
- `isFlagEnabled(key)` resolution order (unchanged for non-career flags):
  1. **env override wins** — `FF_<SNAKE>` (`'1'`→on, `'0'`→off). This preserves every existing
     per-phase override and lets ops force any single flag on/off.
  2. **explicit code default** — the flag's own default.
  3. **suite inheritance** — if the flag ∈ `CAREER_SUITE_FLAGS` and has no env override and no
     truthy own default, it inherits `careerBuilderSuite`.
- The suite flag itself is **excluded** from `CAREER_SUITE_FLAGS` → no recursion.

**Proven properties** (Section 1 + T003 verification):

| Condition | Result |
|---|---|
| `.replit` minimal command, no `FF_CAREER_*` | all 7 career routes `401` (gated, not `503`) — suite survives redeploy |
| `FF_CAREER_BUILDER_SUITE=0`, no per-phase env | every career flag `false` → routes `503` → **byte-identical legacy** |
| suite ON, `FF_CAREER_PATH=0` | `careerPath` false, `learningPath` true — **granular override wins** |

This makes activation **reproducible on a clean boot** while keeping a single master kill-switch
and full backward compatibility.

---

## 3. Invariants enforced platform-wide (unchanged by MX-74X)

- **GET never writes** — both new route files gate on the flag *before* any DB touch; engines use
  `to_regclass` probes, never `ensure*Schema()` DDL.
- **Compose never recompute** — the path/learning engines call `buildCareerMatch`,
  `computeRoleReadinessV2`, `buildCareerGap`, `buildCareerRoadmap`, `buildCareerRecommendations`
  and re-shape their output; no score is recomputed.
- **Coverage ⟂ Confidence** — every envelope reports `axes.coverage` (how much measured) and
  `axes.confidence` (how trustworthy) as separate axes.
- **null = missing, never fake 0** — unmeasured fields stay `null`; `measurable:false` carries an
  honest note instead of a fabricated path.
- **Super-admin gated** — `subject` is operator-supplied (any assessed person), so every
  `/api/career-*/:subject` route is `requireAuth + requireSuperAdmin` (IDOR-safe), mirroring the
  sibling career engines.

---

## 4. Cross-references

- Section 1 audit: `career_builder_current_state.md`
- Career Path engine: `career_path_engine.md`
- Learning intelligence: `learning_intelligence_framework.md`
- Role readiness: `role_readiness_framework.md`
- Skill gap: `skill_gap_intelligence.md`
- Passport: `career_passport_integration.md`
- Employability alignment: `employability_career_alignment.md`
- Predictive posture: `predictive_career_intelligence.md`
- Certification: `career_builder_certification.md`
