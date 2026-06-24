# MX-74X · Section 5 — Skill-Gap Intelligence (existing asset — activated + connected)

**Status:** EXISTING. **Engine:** `services/career-gap-engine.ts` (`buildCareerGap`).
**Flag:** `careerGap` (inherits suite).

---

## 1. What it produces

Per-competency gaps against the anchor/target role: `required_level`, `actual_level`, `gap`,
`criticality`, `blocking`, and a `priority_band` ∈ `now | next | later`
(`blocking || critical → now · gap ≥ 2 → next · else later`). `summary.most_material` surfaces
the single most material gap.

## 2. How MX-74X connects it

- **Career Path** uses gaps to contextualise the first advancement step (what gates the move up).
- **Learning Path** consumes the *roadmap's* development plan (which is itself derived from these
  gaps) and sequences each gap into a step with a deterministic `development_action` + horizon.

## 3. Honesty rules preserved

- `actual_level` is `null` (not 0) when the competency is unmeasured; a gap is only computed when
  both sides are measured.
- `priority_band` is a deterministic function of gap + criticality, never tuned to force a verdict.
- All gap output is **developmental**; never a hiring/suitability statement.
