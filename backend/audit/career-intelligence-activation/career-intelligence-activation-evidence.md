# Career Intelligence Activation — Evidence (MX-100X Phase 6)

Generated: 2026-06-23T19:40:58.238Z · bridge version `4.0.0`

The four named Career Builder scores are **composed** by the existing `career-intelligence-bridge` from the MEASURED competency profile — no score is recomputed or fabricated. Coverage (`measurable`) and the value are reported as SEPARATE axes; absent data is `null`, never a fabricated 0.

## Part A — Controlled MEASURED fixture (illustrative, synthetic inputs)

Representative measured inputs (role readiness 74 / Developing; EI growth 62 / Moderate; 
EI history 58→64→71 over 3 measured snapshots; 3 measured role gaps, 1 blocking):

`activation_scores.measurable` = **true** (any score measurable)

- **Career Readiness** (`career_readiness`): measurable=true, value=74, band=Developing
  - provenance: role_readiness_v2: measured competency profile scored against role requirement targets (Role DNA)
  - note: Readiness measured against the anchor role requirement targets.
- **Career Growth** (`career_growth`): measurable=true, value=62, band=Moderate
  - provenance: ei_profile_engine.growth_potential: weighted headroom across improvable competency-derived EI dimensions
  - note: Growth potential = headroom across improvable competency-derived EI dimensions.
- **Role Progression** (`role_progression`): measurable=true, value=63, band=Improving, direction=improving
  - provenance: ei_history trajectory: 3 measured snapshots, net EI Δ +13
  - note: Progression = net EI movement across measured snapshots (50 = stable baseline).
- **Skill-Gap Pressure** (`skill_gap`): measurable=true, value=19, band=Low
  - provenance: role_gap severity: 3 measured competencies vs role targets (1 blocking)
  - note: Gap pressure = unmet share of required competency depth (lower is better).

### Derivation cross-checks (compose-only)
- Readiness value (74) == role.readiness.score (74): true
- Growth value (62) == growth_potential.score (62): true
- Progression direction `improving` from net EI Δ +13 (58→71): true
- Skill-gap pressure (19) ≈ 100·Σgap/Σrequired = 100·40/215 ≈ 19: true

### Gap → plan focus areas (feed the frontend plan, blocking/critical first)
- System Design: need 80, have 55, gap 25 (critical, blocking)
- Test Engineering: need 70, have 60, gap 10 (important)
- Stakeholder Comms: need 65, have 60, gap 5 (nice-to-have)

## Part B — Cold-start (no measured inputs) — honest absence

`activation_scores.measurable` = **false**
- every score measurable=false, value=null (NOT 0): true
- **Career Readiness** (`career_readiness`): measurable=false, value=null, band=null
  - provenance: role_readiness_v2: measured competency profile scored against role requirement targets (Role DNA)
  - note: Not measurable — no measured competency profile / role requirements (honest absence).
- **Role Progression** (`role_progression`): measurable=false, value=null, band=null, direction=null
  - provenance: ei_history trajectory requires ≥2 measured snapshots
  - note: Insufficient history — 0 measured snapshot(s); capture assessments over time to measure progression.

## Part C — LIVE bridge (shared DB) — real cold-start

- subject: `evidence-ci-activation-subject` (synthetic; no real profile)
- envelope ok=true, measurable=false
- activation_scores.measurable = **false** (honest cold-start: live `career_seeker_profiles` has no measured profile for this subject)
- career_readiness: measurable=false, value=null
- language_policy.intent = `developmental_signal_only` (developmental signals only; disallowed: hire, do not hire, reject, suitability…)

## Honesty ceiling

- The activation is WIRED and the derivation is proven (Part A). The live data-maturity ceiling is real: with no measured competency profiles in the shared DB, the live scores are honestly `measurable:false`/null (Part C). This is reported, never fabricated.
- Language policy enforced platform-wide: intent=`developmental_signal_only`; outputs are developmental signals only — never hiring/promotion/suitability predictions.
