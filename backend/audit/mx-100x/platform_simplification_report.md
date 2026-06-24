# Section 16 — Platform Simplification Report

**Premise:** the platform is architecturally excellent but **broad** — 1,360 tables, ~14 domains,
60+ feature flags, multiple overlapping ontologies, and several dormant/demo-only subsystems. The goal
here is **focus, not deletion**: reduce operational and cognitive surface so the team can drive the
few highest-value flows to real usage. **Nothing below recommends destroying real data or shipped
engines** — recommendations are KEEP / MERGE / HIDE / ARCHIVE / REMOVE, and the destructive end of
that scale is reserved for genuinely empty scaffolds.

## 16.1 Duplicate / overlapping surfaces observed
- **Three competency taxonomies** — curated genome (`onto_*`), O*NET library (`ont_*`), assessment
  bank — disjoint, ~13% overlap. Already bridged behind a flag; the *seams* remain a UX/maintenance
  cost.
- **Legacy competency shells** (`competency_*`) are empty and superseded by `onto_*` (admin reads
  already fall back).
- **Two career-memory stores** (in-memory `career-memory.ts` vs DB-backed `behavioural-memory.ts`) —
  intentional, but a documented foot-gun.
- **Prior audit folders** — `mx100x/`, `mx100x-p2/`, `mx100x-p3/`, `100x-certification/`,
  `99x-certification/`, `final-certification/`, `sa-100x/`, `mx-77x/` — overlapping certification
  history.

## 16.2 Recommendations

### KEEP (core spine — do not touch)
- Competency genome (`onto_*`), O*NET intelligence (`ont_*`/`map_role_competency`), CAPADEX runtime,
  Employer Portal + TIG + P5 hiring engine, Career Builder COS, Validation Loop, RBAC/governance, the
  flag-gated additive pattern itself. These are the platform's value and its honesty machinery.

### MERGE
- **Competency taxonomy bridge → make the flag-on unified search the default** once stable, retiring
  the parallel discovery paths so operators see one taxonomy surface (the bridge already exists).
- **Certification history → consolidate** prior audit folders under a single `audit/_archive/` index;
  treat this MX-100X folder as the current source of truth.

### HIDE (behind flags / admin-only until fed)
- **Adaptive Assessment UI**, **EIOS campaign surfaces**, **m5 predictive/forecasting tabs**,
  **Validation Loop status surface** — all dormant (0 rows). Keep flags OFF in the user-facing build
  so the product shows only what is fed; reveal as data arrives. (Flag-off is already byte-identical.)

### ARCHIVE (keep code + schema, mark dormant, stop surfacing)
- **LBI/SDI student banks** where unfed in the live DB, **mobility scoring** (transitions seeded but
  scores empty), **Report Factory** generated-report surface (templates exist, 0 generated). Archive
  the UI entry points; retain the engines for reactivation.

### REMOVE (safe — empty scaffolds only)
- `onto_blueprint_dimension_mix` (0) and other **0-row scaffold tables that have no consumer** may be
  dropped *after* confirming no flag-on path references them. **Do not remove any populated or
  consumer-bearing table.** This is the only destructive recommendation, and it is gated on a
  reference check.

## 16.3 Simplification principle
The simplification lever is **surfacing discipline**, not demolition: show the user the ~3 flows that
can reach real usage now (competency assessment, employer match on demo→real, career builder seeker
onboarding), and keep the rest flag-hidden until fed. This converts "vast but dormant" into "focused
and credible" without losing the platform's depth.

> **All structural changes here STOP for founder approval before any merge/deploy (user preference).**
