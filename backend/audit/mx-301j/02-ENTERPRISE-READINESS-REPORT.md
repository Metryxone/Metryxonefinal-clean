# MX-301J — Enterprise Readiness Report

_Generated 2026-06-26T03:26:43.088Z · MX-301J composer v301.10.0 · read-only · PII-masked_

**Process flag state at run:** FF_ENTERPRISE_CERTIFICATION=on, FF_GO_LIVE_CERTIFICATION=on, FF_OUTCOME_INTELLIGENCE_ACTIVATION=on, FF_LIVE_EMPLOYER_ECOSYSTEM=on, FF_RUNTIME_INTELLIGENCE_ACTIVATION=on, FF_COMMERCIAL_ACTIVATION=on, FF_CAREER_INTELLIGENCE_ACTIVATION=on, FF_AI_GOVERNANCE=on, FF_GOVERNANCE_RBAC_V2=on, FF_ENTERPRISE_ANALYTICS=on, FF_REPORT_FACTORY=on

> **There is deliberately NO single combined score.** These fourteen dimensions are
> orthogonal axes and are reported **separately**. Folding them into one percentage would be
> dishonest — a platform that is 100% built but has 0 live customers is not "50% done".
> **Coverage** (what data exists) and **Confidence** (whether it is trustworthy/sufficient) are
> separate axes wherever both apply. `null` / "not measurable" is **never** coerced to 0.

## 1. Platform Implementation — 🟢 Ready

- **Axis:** Structural
- **Headline:** 100% structural readiness — 24/24 required tables present; 15/15 subsystems PASS.
- **Coverage (what exists):** 15 subsystems, all required tables present (24/24).
- **Confidence (is it trustworthy/sufficient):** Structural verdict is authoritative (table presence is directly observable). Verdict: PASS.
- **Source (one source of truth):** MX-105X recertification.enterprise_structural_pct (composer v105.0.0)
- _Structural = the machinery exists. It does NOT assert live usage (see Adoption) or outcomes (see Outcome Confidence)._

<details><summary>Folded evidence</summary>

```json
{
  "verdict": "PASS",
  "enterprise_structural_pct": 100,
  "summary": {
    "total": 15,
    "pass": 15,
    "partial": 0,
    "fail": 0,
    "activated": 15,
    "adopted": 11
  }
}
```
</details>

## 2. Functional Readiness — 🟢 Ready

- **Axis:** End-to-end journey
- **Headline:** Candidate journey 100% (5/5 steps); employer journey 100% (9/9 stages reachable).
- **Coverage (what exists):** Candidate: 5/5 steps. Employer: 9/9 stages; 2 stage(s) with real data.
- **Confidence (is it trustworthy/sufficient):** 0 employer-side gaps are gating-flag/configuration dependencies, not broken code. Broken links: 0. The MX-301I gap-closure register (audit/mx-301i) records the prior-failing endpoints since re-verified.
- **Source (one source of truth):** MX-105X unifiedJourney + MX-301I gap-closure register
- _Employer journey is reachability-capped by gating flags being OFF by design, not by missing implementation._

<details><summary>Folded evidence</summary>

```json
{
  "candidate": {
    "structural_complete": 5,
    "structural_total": 5,
    "structural_pct": 100,
    "activation_live": 3
  },
  "employer": {
    "coverage_reachable": 9,
    "coverage_total": 9,
    "coverage_pct": 100,
    "real_data_stages": 2
  },
  "dependency_gaps": [],
  "broken_links": []
}
```
</details>

## 3. Assessment Quality — 🟡 Partial

- **Axis:** Coverage ⟂ Confidence
- **Headline:** 419 competencies carry mapped questions (coverage); 120 of 2665 templates are human-approved / assessment-ready (confidence).
- **Coverage (what exists):** Question coverage: 419 competencies mapped. Template pool: 2665 (mostly DRAFT pipeline).
- **Confidence (is it trustworthy/sufficient):** Assessment-ready (human-approved) is the honest confidence axis: 120 approved. Human approval is the ONLY coverage-changing op — drafts are not yet served as approved.
- **Source (one source of truth):** recertification (assessment_engine, question_factory subsystems) + read-only template-lifecycle probe
- _Draft breadth ≫ approved depth by design: nothing is served as "ready" until a human approves it._

<details><summary>Folded evidence</summary>

```json
{
  "templates_total": 2665,
  "templates_approved": 120,
  "comps_with_questions": 419,
  "assessment_engine_adoption": {
    "live_rows": 120
  },
  "question_factory_adoption": {
    "live_rows": 2524
  }
}
```
</details>

## 4. Career Intelligence — 🟢 Ready

- **Axis:** Structural + Adoption
- **Headline:** Career Builder, Candidate Intelligence, Career Passport all structurally PASS; live adoption is early (Career Builder 1, Candidate Intelligence 2, Career Passport 17 rows).
- **Coverage (what exists):** 3 career subsystems present and activated. Career Builder activation: on.
- **Confidence (is it trustworthy/sufficient):** Structural confidence high; adoption is early-stage live data, reported separately and not inflated.
- **Source (one source of truth):** MX-105X recertification (career_builder, candidate_intelligence, career_passport)
- _Structural readiness ≠ adoption: the surfaces exist and are wired; live rows are the honest early-usage signal._

<details><summary>Folded evidence</summary>

```json
{
  "career_builder": {
    "key": "career_builder",
    "label": "Career Builder",
    "structural": {
      "ok": true,
      "present": 2,
      "total": 2,
      "missing": []
    },
    "activation": {
      "switched_on": true,
      "flag": "careerIntelligenceActivation",
      "always_on": false
    },
    "adoption": {
      "live_rows": 1
    },
    "outcome_confidence": {
      "applies": false,
      "state": "n/a"
    },
    "status": "PASS"
  },
  "candidate_intelligence": {
    "key": "candidate_intelligence",
    "label": "Candidate Intelligence",
    "structural": {
      "ok": true,
      "present": 2,
      "total": 2,
      "missing": []
    },
    "activation": {
      "switched_on": true,
      "flag": "ecosystemActivation",
      "always_on": false
    },
    "adoption": {
      "live_rows": 2
    },
    "outcome_confidence": {
      "applies": false,
      "state": "n/a"
    },
    "status": "PASS"
  },
  "career_passport": {
    "key": "career_passport",
    "label": "Career Passport",
    "structural": {
      "ok": true,
      "present": 1,
      "total": 1,
      "missing": []
    },
    "activation": {
      "switched_on": true,
      "flag": "careerPassport",
      "always_on": false
    },
    "adoption": {
      "live_rows": 17
    },
    "outcome_confidence": {
      "applies": false,
      "state": "n/a"
    },
    "status": "PASS"
  }
}
```
</details>

## 5. Employer Intelligence — 🟡 Partial

- **Axis:** Structural + Adoption
- **Headline:** Employer Intelligence structurally PASS (2/2 tables) and activated, but adoption is dormant (0 live non-demo rows).
- **Coverage (what exists):** Structural 2/2; the 9-stage hiring funnel exists and was exercised in the MX-301D employer persona pass.
- **Confidence (is it trustworthy/sufficient):** Adoption 0 = honest dormancy (no live employers yet), NOT a defect. Reported separately from structural.
- **Source (one source of truth):** MX-105X recertification (employer_intelligence) + MX-301D persona experience
- _Adoption 0 is honest: the funnel is built and exercisable but has no real employer usage yet._

<details><summary>Folded evidence</summary>

```json
{
  "employer_intelligence": {
    "key": "employer_intelligence",
    "label": "Employer Intelligence",
    "structural": {
      "ok": true,
      "present": 2,
      "total": 2,
      "missing": []
    },
    "activation": {
      "switched_on": true,
      "flag": "liveEmployerEcosystem",
      "always_on": false
    },
    "adoption": {
      "live_rows": 0
    },
    "outcome_confidence": {
      "applies": false,
      "state": "n/a"
    },
    "status": "PASS"
  },
  "employer_journey": {
    "coverage_reachable": 9,
    "coverage_total": 9,
    "coverage_pct": 100,
    "real_data_stages": 2
  }
}
```
</details>

## 6. Report Quality — 🟢 Ready

- **Axis:** Quality (no-empty guard)
- **Headline:** 16/16 report types compose with ZERO no-empty violations (0 violations).
- **Coverage (what exists):** 16 report types, each with the 9 required sections; measurable reports: 16.
- **Confidence (is it trustworthy/sufficient):** validatePack violations: 0. The no-empty guard rejects any placeholder / TBD / leaked null in prose, charts or insights.
- **Source (one source of truth):** MX-301E report-pack validatePack (v1.0.0)
- _Composed against the canonical demo subject; report STRUCTURE is certified, not real-customer report volume._

<details><summary>Folded evidence</summary>

```json
{
  "count": 16,
  "violations": [],
  "reports": [
    {
      "key": "executive_summary",
      "title": "Executive Summary",
      "measurable": true,
      "coverage": null,
      "confidence": "Provisional"
    },
    {
      "key": "competency_profile",
      "title": "Competency Profile",
      "measurable": true,
      "coverage": null,
      "confidence": "Provisional"
    },
    {
      "key": "competency_radar",
      "title": "Competency Radar",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "competency_heatmap",
      "title": "Competency Heatmap",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "strength",
      "title": "Strengths",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "development_areas",
      "title": "Development Areas",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "role_readiness",
      "title": "Role Readiness",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "promotion_readiness",
      "title": "Promotion Readiness",
      "measurable": true,
      "coverage": null,
      "confidence": "Moderate"
    },
    {
      "key": "employability_index",
      "title": "Employability Index",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "career_recommendations",
      "title": "Career Recommendations",
      "measurable": true,
      "coverage": null,
      "confidence": "Moderate"
    },
    {
      "key": "learning_roadmap",
      "title": "Learning Roadmap",
      "measurable": true,
      "coverage": null,
      "confidence": "Provisional"
    },
    {
      "key": "skill_gap",
      "title": "Skill Gap",
      "measurable": true,
      "coverage": 100,
      "confidence": "Provisional"
    },
    {
      "key": "interview_readiness",
      "title": "Interview Readiness",
      "measurable": true,
      "coverage": null,
      "confidence": "Operator-recorded"
    },
    {
      "key": "employer_competency_match",
      "title": "Employer Competency Match",
      "measurable": true,
      "coverage": 61.8,
      "confidence": "Calibrated"
    },
    {
      "key": "career_passport",
      "title": "Career Passport",
      "measurable": true,
      "coverage": 100,
      "confidence": "Moderate"
    },
    {
      "key": "action_plan",
      "title": "Action Plan",
      "measurable": true,
      "coverage": null,
      "confidence": "Provisional"
    }
  ]
}
```
</details>

## 7. UI Quality — 🟢 Ready

- **Axis:** Static scan (brand / a11y / states)
- **Headline:** 621 files scanned; 263 use design tokens; 0 off-brand; 0 images missing alt text.
- **Coverage (what exists):** 621 frontend files; 339 state screens analysed.
- **Confidence (is it trustworthy/sufficient):** Brand: 0 inline-brand, 0 off-brand. a11y: 0 img-no-alt. Gaps: 11 screens missing a loading state, 87 missing an empty state.
- **Source (one source of truth):** MX-301E mx301e-ui-certification-scan.ts (scan.json, scannedAt 2026-06-25T16:57:35.633Z)
- _Clean on brand + accessibility; residual gaps are missing loading/empty states on a minority of screens._

<details><summary>Folded evidence</summary>

```json
{
  "totalFiles": 621,
  "brand": {
    "inlineBrandFiles": 0,
    "importsTokensFiles": 263,
    "offBrandPrimaryFiles": [],
    "offBrandAccentFiles": []
  },
  "accessibility": {
    "filesWithImgNoAlt": [],
    "totalImgNoAlt": 0
  },
  "states": {
    "stateScreens": 339,
    "missingLoading": 11,
    "missingEmpty": 87
  }
}
```
</details>

## 8. Performance & Scalability — 🟢 Ready

- **Axis:** Structural/config (load = not measurable)
- **Headline:** Structural scalability 100% (3/3 dimensions: multi-tenant + health monitoring). Load capacity = not measurable without a load test.
- **Coverage (what exists):** Multi-tenant substrate + health monitoring present; tenants: 4, health snapshots: 0.
- **Confidence (is it trustworthy/sufficient):** Structural verdict PASS. Real load capacity is honestly reported as not_measurable (no load test in this environment) — never fabricated as a number.
- **Source (one source of truth):** MX-106X scalabilityCertification (v106.0.0)
- _Performance under real concurrency requires a production load test; structural readiness ≠ proven throughput._

<details><summary>Folded evidence</summary>

```json
{
  "verdict": "PASS",
  "structural_readiness_pct": 100,
  "load_capacity": {
    "measurable": false,
    "status": "not_measurable",
    "note": "No live load / stress test evidence exists. Throughput, latency, and concurrency under load CANNOT be fabricated and are reported as not_measurable."
  }
}
```
</details>

## 9. Security & Governance — 🟢 Ready

- **Axis:** Structural/config + live gate
- **Headline:** Security & governance 100% structural; live super_admin gate authoritative; super-admin login is ALWAYS 2FA-gated (MX-301I G4 — dev bypass removed).
- **Coverage (what exists):** RBAC: 10 roles, 44 permissions, 144 grants; 1 live super_admin. AI governance 100%.
- **Confidence (is it trustworthy/sufficient):** Formal RBAC is ADVISORY; the live super_admin gate is authoritative (composer does not change enforcement). Compliance index: 75.
- **Source (one source of truth):** MX-106X securityGovernanceCertification + MX-301I G4 (MFA always-enforced)
- _Compliance score is structural pillar coverage, not an external audit attestation._

<details><summary>Folded evidence</summary>

```json
{
  "verdict": "PASS",
  "structural_readiness_pct": 100,
  "rbac": {
    "measurable": true,
    "structural_ready": true,
    "roles": 10,
    "permissions": 44,
    "grants": 144,
    "live_super_admins": 1,
    "enforcement": "advisory",
    "note": "Live access is governed by the users.role super_admin gate (1); formal RBAC defines 10 role(s). These are separate axes — formal RBAC is advisory, the live gate is authoritative."
  },
  "compliance": 75,
  "ai_governance": {
    "measurable": true,
    "substrate_present": 7,
    "substrate_total": 7,
    "structural_pct": 100,
    "tables": {
      "model_governance_registry": true,
      "ai_decision_audits": true,
      "fairness_evaluations": true,
      "psychometric_models": true,
      "reliability_validation_models": true,
      "competency_validity_models": true,
      "explainability_chains": true
    },
    "note": "AI-governance substrate (explainability / fairness / psychometrics / model registry). Structural presence only — those engines mutate, so MX-106X probes their tables read-only and never invokes them."
  },
  "rbac_enforcement_note": "Formal RBAC is ADVISORY; the live super_admin gate is authoritative. MX-106X composes the existing advisory engines and does NOT change enforcement."
}
```
</details>

## 10. Data Integrity — 🟢 Ready

- **Axis:** Structural + demo isolation
- **Headline:** Audit substrate present and not degraded; demo data is isolated and purgeable (career_seeker_profiles: 1 demo of 2 total, 50%).
- **Coverage (what exists):** Append-only history convention; demo rows keyed @example.com for clean purge; audit logging substrate present.
- **Confidence (is it trustworthy/sufficient):** Demo isolation lets every certification metric exclude demo rows. Full referential-integrity validation is not owned by a single composer (reported honestly).
- **Source (one source of truth):** MX-106X security.audit substrate + read-only demo-isolation probe
- _Shared dev/prod database (MX-301I G5) is an OPEN deployment/infra item — not code-fixable from dev._

<details><summary>Folded evidence</summary>

```json
{
  "audit": {
    "measurable": true,
    "data_governance_events_30d": 0,
    "detail": {
      "generated_at": "2026-06-26T03:26:41.978Z",
      "degraded": false,
      "substrate": {
        "admin_audit_logs": true,
        "rbac_failed_logins": true
      },
      "audit": {
        "total": 17,
        "last_30d": 17,
        "by_category": [
          {
            "category": "create",
            "events": 8
          },
          {
            "category": "update",
            "events": 5
          },
          {
            "category": "login",
            "events": 4
          }
        ],
        "recent_count": 17
      },
      "failed_logins": {
        "total": 31,
        "last_24h": 25,
        "recent_count": 31
      },
      "notes": []
    },
    "note": "Governance audit-trail activity over the trailing 30 days."
  },
  "seeker_total": 2,
  "seeker_demo": 1,
  "demo_pct": 50
}
```
</details>

## 11. Knowledge Completion — 🟡 Partial

- **Axis:** Coverage (breadth) ⟂ Confidence (depth)
- **Headline:** Genome breadth complete: 422 active competencies, all domain-classified. Content depth shallow: indicators authored for 13 competencies (3.1%).
- **Coverage (what exists):** 422 competencies; O*NET-grounded: 159 (37.7%).
- **Confidence (is it trustworthy/sufficient):** Deep content (behavioural indicators / evidence) has no machine source — authoring it requires SME or OPENAI_API_KEY. Refusing to fabricate it is the honest position.
- **Source (one source of truth):** MX-201 genome + read-only onto_competencies / onto_indicators / map_role_competency probes
- _Breadth (every competency exists & is classified) is complete; depth (rich indicators per competency) is the honest open gap._

<details><summary>Folded evidence</summary>

```json
{
  "genome_total": 422,
  "genome_with_domain": 422,
  "comps_with_indicators": 13,
  "onet_grounded": 159,
  "depth_pct": 3.1,
  "onet_pct": 37.7
}
```
</details>

## 12. Activation — 🟢 Ready

- **Axis:** Activation (gating flags on)
- **Headline:** 15/15 subsystems have their gating flag ON (100%).
- **Coverage (what exists):** Activated subsystems: 15 of 15.
- **Confidence (is it trustworthy/sufficient):** 0 subsystems are intentionally flag-OFF (byte-identical-OFF discipline). Activation is a deliberate rollout lever, not a defect.
- **Source (one source of truth):** MX-105X recertification.summary.activated / MX-106X sixAxis.activation
- _Low activation is by design: additive phases ship flag-OFF until deliberately switched on._

<details><summary>Folded evidence</summary>

```json
{
  "activated": 15,
  "total": 15,
  "score": 100,
  "status": "ready"
}
```
</details>

## 13. Adoption — 🟢 Ready

- **Axis:** Adoption (live non-demo rows)
- **Headline:** 11/15 subsystems show live non-demo rows (73.3%). Several remain at 0 — honest pre-launch dormancy, never coerced upward.
- **Coverage (what exists):** Adopted subsystems: 11 of 15.
- **Confidence (is it trustworthy/sufficient):** Adoption rows count REAL non-demo usage. Subsystems at 0 (e.g. employer, outcome) are genuinely awaiting live customers — reported as 0, never null-washed into "ready".
- **Source (one source of truth):** MX-105X recertification.summary.adopted / MX-106X sixAxis.adoption
- _Adoption is the truest "is anyone using it" axis; pre-launch it is honestly low and kept separate from structural readiness._

<details><summary>Folded evidence</summary>

```json
{
  "adopted": 11,
  "total": 15,
  "score": 73.3,
  "per_subsystem": [
    {
      "key": "competency_framework",
      "label": "Competency Framework",
      "live_rows": 422
    },
    {
      "key": "role_dna",
      "label": "Role DNA",
      "live_rows": 13
    },
    {
      "key": "onet_crosswalk",
      "label": "O*NET Crosswalk",
      "live_rows": 52362
    },
    {
      "key": "assessment_engine",
      "label": "Assessment Engine",
      "live_rows": 120
    },
    {
      "key": "question_factory",
      "label": "Question Factory",
      "live_rows": 2524
    },
    {
      "key": "adaptive_assessment",
      "label": "Adaptive Assessment",
      "live_rows": 1
    },
    {
      "key": "employer_intelligence",
      "label": "Employer Intelligence",
      "live_rows": 0
    },
    {
      "key": "candidate_intelligence",
      "label": "Candidate Intelligence",
      "live_rows": 2
    },
    {
      "key": "career_builder",
      "label": "Career Builder",
      "live_rows": 1
    },
    {
      "key": "career_passport",
      "label": "Career Passport",
      "live_rows": 17
    },
    {
      "key": "outcome_intelligence",
      "label": "Outcome Intelligence",
      "live_rows": 0
    },
    {
      "key": "validation_loop",
      "label": "Validation Loop",
      "live_rows": 0
    },
    {
      "key": "super_admin",
      "label": "Super Admin Command Center",
      "live_rows": 1
    },
    {
      "key": "founder_dashboard",
      "label": "Founder Dashboard",
      "live_rows": 0
    },
    {
      "key": "report_factory",
      "label": "Report Factory",
      "live_rows": 51
    }
  ]
}
```
</details>

## 14. Outcome Confidence — ⚫ Abstained

- **Axis:** Outcome (calibrated ≥ k_min)
- **Headline:** ABSTAINED — 0 of 6 outcome types are evidence-backed; strongest single-type evidence 0/30 realized pairs (k_min=30). Empirical accuracy is NOT claimed.
- **Coverage (what exists):** 6 outcome types composed; types with realized coverage: 0; realized coverage: 0.
- **Confidence (is it trustworthy/sufficient):** evidence_backed=false; strongest single-type pairs 0/30. Confidence is deliberately NULL/abstained until ≥30 realized outcomes — never a fabricated 0% accuracy.
- **Source (one source of truth):** MX-102X composeCertification + MX-105X outcomeReadiness (v102.0.0)
- _Abstention is the honest verdict: predictions are surfaced, but accuracy is claimed only once real outcomes accrue._

<details><summary>Folded evidence</summary>

```json
{
  "verdict": "PARTIAL",
  "coverage": {
    "type_count": 6,
    "types_with_coverage": 0,
    "realized_coverage": 0
  },
  "confidence": {
    "types_evidence_backed": 0,
    "evidence_backed": false,
    "abstained": true,
    "max_type_pairs": 0,
    "k_min": 30
  },
  "checks": [
    {
      "id": "C1",
      "criterion": "Unified six-type outcome taxonomy (hiring·performance·promotion·retention·career·learning)",
      "status": "PASS",
      "detail": "All 6 types composed from their canonical substrates without mutating any existing surface."
    },
    {
      "id": "C2",
      "criterion": "Coverage ⟂ Confidence kept as separate axes (never composited)",
      "status": "PASS",
      "detail": "Coverage (realized outcomes captured) and Confidence (empirical accuracy) are reported independently; a realized outcome without a decision-time prediction counts only toward Coverage."
    },
    {
      "id": "C3",
      "criterion": "Abstain below k_min — empirical accuracy gated PER TYPE (pairs never summed across types)",
      "status": "PARTIAL",
      "detail": "No single type has reached k_min 30 (strongest single-type pairs 0/30; aggregate 0 across types is informational ONLY and never clears the per-type threshold); accuracy correctly ABSTAINED."
    },
    {
      "id": "C4",
      "criterion": "No fabrication — null/abstain never coerced to 0; out-of-range predictions dropped",
      "status": "PASS",
      "detail": "Unreadable substrates degrade to null (not 0); only finite [0,1] predictions paired with binary outcomes feed calibration."
    },
    {
      "id": "C5",
      "criterion": "Prediction ≠ Outcome — empirical accuracy requires realized outcomes",
      "status": "PASS",
      "detail": "Upstream predictions are surfaced; empirical accuracy is claimed ONLY once realized outcomes accrue."
    },
    {
      "id": "C6",
      "criterion": "Flag-gated, additive, byte-identical OFF (read-only, no DDL)",
      "status": "PASS",
      "detail": "Behind outcomeIntelligenceActivation (default OFF); composer reads via to_regclass probes only and never writes."
    },
    {
      "id": "C7",
      "criterion": "Empirical accuracy evidence-backed (≥ k_min realized predictions in a single type)",
      "status": "PARTIAL",
      "detail": "Realized coverage 0; 0 type(s) evidence-backed (strongest single-type pairs 0/30; aggregate 0 informational only). PARTIAL until a single type reaches k_min — honest, not a defect."
    }
  ]
}
```
</details>
