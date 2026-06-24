# MX-105X — Enterprise Certification & Platform Activation · Recertification Report

_Generated 2026-06-24T16:07:56.118Z · composer v105.0.0 · read-only (no DDL, no writes)_

**Process flag state at run:** FF_ENTERPRISE_CERTIFICATION=on, FF_OUTCOME_INTELLIGENCE_ACTIVATION=on, FF_LIVE_EMPLOYER_ECOSYSTEM=on, FF_RUNTIME_INTELLIGENCE_ACTIVATION=on, FF_COMMERCIAL_ACTIVATION=on, FF_CAREER_INTELLIGENCE_ACTIVATION=on, FF_REPORT_FACTORY=on

> This composer **recomputes nothing** — it folds the headline of each existing engine.
> The four axes are reported **separately and never composited**:
> **Structural** (required tables present) ⟂ **Activation** (gating flag on) ⟂
> **Adoption** (live rows) ⟂ **Outcome-Confidence** (calibrated/provisional/abstained).
> The headline verdict is **structural only**. `null` = not measurable, never 0.

## Enterprise verdict

- **Verdict (structural axis):** PASS — Structural readiness ≥ 90% for enterprise certification (PASS).
- **Enterprise structural readiness:** 100% (24/24 required tables present)
- **Subsystems:** 15 PASS · 0 PARTIAL · 0 FAIL (of 15)
- **Activated (flag on):** 8/15 · **Adopted (live rows):** 8/15

_Structural (PASS/PARTIAL/FAIL & the headline %) ⟂ Activation (flag on) ⟂ Adoption (live rows) ⟂ Outcome-Confidence. NEVER composited._

## Subsystems — four separate axes

| Subsystem | Status | Structural | Activation | Adoption | Outcome-Confidence |
|-----------|:------:|:----------:|:----------:|:--------:|:------------------:|
| Competency Framework | PASS | 2/2 | on (always) | 419 | — |
| Role DNA | PASS | 1/1 | off | 13 | — |
| O*NET Crosswalk | PASS | 2/2 | off | 52362 | — |
| Assessment Engine | PASS | 1/1 | off | 57 | — |
| Question Factory | PASS | 1/1 | off | 2524 | — |
| Adaptive Assessment | PASS | 1/1 | off | 0 | — |
| Employer Intelligence | PASS | 2/2 | on | 0 | — |
| Candidate Intelligence | PASS | 2/2 | off | 1 | — |
| Career Builder | PASS | 2/2 | on | 0 | — |
| Career Passport | PASS | 1/1 | off | 4 | — |
| Outcome Intelligence | PASS | 1/1 | on | 0 | abstained |
| Validation Loop | PASS | 1/1 | on | 0 | abstained |
| Super Admin Command Center | PASS | 3/3 | on (always) | 1 | — |
| Founder Dashboard | PASS | 2/2 | on (always) | 0 | — |
| Report Factory | PASS | 2/2 | on (always) | 0 | — |


## Unified journey (candidate + employer)

```json
{
  "view": "unified_journey",
  "candidate": {
    "available": true,
    "steps": [
      {
        "step": "1. Is candidate onboarding complete?",
        "structural": true,
        "activation": false
      },
      {
        "step": "2. Is assessment integration complete?",
        "structural": true,
        "activation": true
      },
      {
        "step": "3. Is employability integration complete?",
        "structural": true,
        "activation": false
      },
      {
        "step": "4. Is career builder operational?",
        "structural": true,
        "activation": false
      },
      {
        "step": "5. Is passport operational?",
        "structural": true,
        "activation": true
      }
    ],
    "completion": {
      "structural_complete": 5,
      "structural_total": 5,
      "structural_pct": 100,
      "activation_live": 2
    }
  },
  "employer": {
    "available": true,
    "stages": [
      {
        "stage": "Employer Onboarding",
        "status": "gated",
        "coverage": "gated",
        "confidence": "none",
        "flag_enabled": false,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 0
      },
      {
        "stage": "Create Job",
        "status": "demo_only",
        "coverage": "reachable",
        "confidence": "demo_only",
        "flag_enabled": true,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 1
      },
      {
        "stage": "Role DNA",
        "status": "operational",
        "coverage": "reachable",
        "confidence": "real",
        "flag_enabled": true,
        "substrate_present": true,
        "real_rows": 15,
        "demo_rows": 0
      },
      {
        "stage": "Competencies",
        "status": "gated",
        "coverage": "gated",
        "confidence": "real",
        "flag_enabled": false,
        "substrate_present": true,
        "real_rows": 419,
        "demo_rows": 0
      },
      {
        "stage": "Assessment",
        "status": "gated",
        "coverage": "gated",
        "confidence": "demo_only",
        "flag_enabled": false,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 40
      },
      {
        "stage": "Candidate Match",
        "status": "gated",
        "coverage": "gated",
        "confidence": "demo_only",
        "flag_enabled": false,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 40
      },
      {
        "stage": "Interview Intelligence",
        "status": "gated",
        "coverage": "gated",
        "confidence": "demo_only",
        "flag_enabled": false,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 0
      },
      {
        "stage": "Hiring Decision",
        "status": "gated",
        "coverage": "gated",
        "confidence": "demo_only",
        "flag_enabled": false,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 34
      },
      {
        "stage": "Outcome Tracking",
        "status": "empty",
        "coverage": "reachable",
        "confidence": "none",
        "flag_enabled": true,
        "substrate_present": true,
        "real_rows": 0,
        "demo_rows": 0
      }
    ],
    "verdict": "PARTIAL",
    "completion": {
      "coverage_reachable": 3,
      "coverage_total": 9,
      "coverage_pct": 33.3,
      "real_data_stages": 2
    }
  },
  "broken_links": [],
  "dependency_gaps": [
    {
      "surface": "employer",
      "step": "Employer Onboarding",
      "reason": "gating flag OFF (configuration dependency)"
    },
    {
      "surface": "employer",
      "step": "Competencies",
      "reason": "gating flag OFF (configuration dependency)"
    },
    {
      "surface": "employer",
      "step": "Assessment",
      "reason": "gating flag OFF (configuration dependency)"
    },
    {
      "surface": "employer",
      "step": "Candidate Match",
      "reason": "gating flag OFF (configuration dependency)"
    },
    {
      "surface": "employer",
      "step": "Interview Intelligence",
      "reason": "gating flag OFF (configuration dependency)"
    },
    {
      "surface": "employer",
      "step": "Hiring Decision",
      "reason": "gating flag OFF (configuration dependency)"
    }
  ],
  "notes": [
    "Candidate steps from MX-104X certification; employer stages from MX-103X audit (composed, not recomputed).",
    "Broken links = structural machinery absent. Dependency gaps = a gating flag is OFF. Reported SEPARATELY.",
    "Completion (structural) and activation/adoption are independent axes; never composited."
  ]
}
```

## Outcome readiness (folds MX-102X)

```json
{
  "view": "outcome_readiness",
  "available": true,
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
  "quality": {
    "types": [
      {
        "type": "hiring",
        "realized": 0,
        "evidence_backed": false,
        "calibration_status": null
      },
      {
        "type": "performance",
        "realized": 0,
        "evidence_backed": false,
        "calibration_status": null
      },
      {
        "type": "promotion",
        "realized": 0,
        "evidence_backed": false,
        "calibration_status": null
      },
      {
        "type": "retention",
        "realized": 0,
        "evidence_backed": false,
        "calibration_status": null
      },
      {
        "type": "career",
        "realized": 0,
        "evidence_backed": false,
        "calibration_status": null
      },
      {
        "type": "learning",
        "realized": 0,
        "evidence_backed": false,
        "calibration_status": null
      }
    ]
  },
  "verdict": "PARTIAL — the six-type surface is structurally unified and reads live substrates; empirical accuracy stays ABSTAINED until a single type reaches k_min (pairs are never summed across types). No outcome or accuracy is fabricated.",
  "note": "Composed from MX-102X. Coverage ⟂ Confidence ⟂ accuracy; accuracy abstained until a single type reaches k_min."
}
```

## Command center — health categories

```json
{
  "view": "command_center",
  "categories": [
    {
      "key": "platform_core",
      "label": "Platform Core (users · sessions)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    },
    {
      "key": "competency_framework",
      "label": "Competency Framework (genome)",
      "structural": true,
      "adoption": 419,
      "status": "healthy"
    },
    {
      "key": "question_bank",
      "label": "Question Bank (approved templates)",
      "structural": true,
      "adoption": 57,
      "status": "healthy"
    },
    {
      "key": "assessment_engine",
      "label": "Assessment Engine (scored subjects)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    },
    {
      "key": "role_dna",
      "label": "Role DNA (profiled roles)",
      "structural": true,
      "adoption": 13,
      "status": "healthy"
    },
    {
      "key": "onet_crosswalk",
      "label": "O*NET Crosswalk (role↔competency links)",
      "structural": true,
      "adoption": 52362,
      "status": "healthy"
    },
    {
      "key": "candidate_journey",
      "label": "Candidate Journey (registered)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    },
    {
      "key": "employer_ecosystem",
      "label": "Employer Ecosystem (real candidates)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    },
    {
      "key": "career_builder",
      "label": "Career Builder (activations)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    },
    {
      "key": "career_passport",
      "label": "Career Passport (snapshots)",
      "structural": true,
      "adoption": 4,
      "status": "healthy"
    },
    {
      "key": "assessments_completed",
      "label": "Assessments Completed (CAPADEX)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    },
    {
      "key": "validation_loop",
      "label": "Validation Loop (realized outcomes)",
      "structural": true,
      "adoption": 0,
      "status": "dormant"
    }
  ],
  "summary": {
    "category_count": 12,
    "structural_ok": 12,
    "structural_pct": 100,
    "healthy_adoption": 5
  },
  "note": "Structural (machinery) and Adoption (live data) reported as separate axes; null adoption = not measurable, never 0."
}
```

## Founder command center — metrics

```json
{
  "view": "founder_command_center",
  "metrics": [
    {
      "key": "registered_candidates",
      "label": "Registered Candidates",
      "value": 0,
      "unit": "count",
      "axis": "adoption"
    },
    {
      "key": "assessments_completed",
      "label": "Assessments Completed",
      "value": 0,
      "unit": "count",
      "axis": "adoption"
    },
    {
      "key": "employer_organizations",
      "label": "Employer Organizations",
      "value": 0,
      "unit": "count",
      "axis": "adoption"
    },
    {
      "key": "paid_transactions",
      "label": "Paid Transactions",
      "value": 0,
      "unit": "count",
      "axis": "adoption"
    },
    {
      "key": "genome_competencies",
      "label": "Competencies in Genome",
      "value": 419,
      "unit": "count",
      "axis": "structural"
    },
    {
      "key": "assessment_ready_competencies",
      "label": "Assessment-Ready Competencies",
      "value": 419,
      "unit": "count",
      "axis": "structural"
    },
    {
      "key": "role_dna_roles",
      "label": "Role DNA Roles",
      "value": 13,
      "unit": "count",
      "axis": "structural"
    },
    {
      "key": "onet_links",
      "label": "O*NET Role↔Competency Links",
      "value": 52362,
      "unit": "count",
      "axis": "structural"
    },
    {
      "key": "career_builder_activations",
      "label": "Career Builder Activations",
      "value": 0,
      "unit": "count",
      "axis": "adoption"
    },
    {
      "key": "passport_snapshots",
      "label": "Passport Snapshots",
      "value": 4,
      "unit": "count",
      "axis": "adoption"
    },
    {
      "key": "realized_outcomes",
      "label": "Realized Outcomes (non-demo)",
      "value": 0,
      "unit": "count",
      "axis": "outcome"
    },
    {
      "key": "enterprise_cert_score",
      "label": "Enterprise Certification Score",
      "value": 100,
      "unit": "pct",
      "axis": "structural"
    }
  ],
  "enterprise_certification": {
    "structural_pct": 100,
    "verdict": "PASS",
    "subsystems_pass": 15,
    "subsystems_total": 15
  },
  "note": "Exec metrics tag their axis (structural / adoption / outcome). null = not measurable, never a fabricated 0."
}
```

## Overview (folded headline)

```json
{
  "ok": true,
  "view": "overview",
  "version": "105.0.0",
  "disclaimer": "Enterprise Certification is a READ-ONLY composition of already-built activation / certification / health / outcome engines. Structural (machinery exists), Activation (subsystem switched on), Adoption (live non-demo data), and Outcome-Confidence (calibrated ≥ k_min) are reported as SEPARATE axes and NEVER composited. Coverage ⟂ Confidence kept separate. A rate with a zero denominator is null, never a fabricated 0% / 100%. Absent tables degrade to null (not 0). Developmental / operational signals only — NOT hiring/promotion/suitability predictions.",
  "enterprise_certification": {
    "structural_pct": 100,
    "verdict": "PASS",
    "subsystems_pass": 15,
    "subsystems_total": 15,
    "activated": 8,
    "adopted": 8
  },
  "journey": {
    "candidate_structural_pct": 100,
    "employer_coverage_pct": 33.3,
    "broken_links": 0,
    "dependency_gaps": 6
  },
  "outcomes": {
    "realized_coverage": 0,
    "evidence_backed": false,
    "verdict": "PARTIAL — the six-type surface is structurally unified and reads live substrates; empirical accuracy stays ABSTAINED until a single type reaches k_min (pairs are never summed across types). No outcome or accuracy is fabricated."
  },
  "command_center": {
    "structural_ok": 12,
    "structural_pct": 100,
    "healthy_adoption": 5,
    "category_count": 12
  },
  "founder": {
    "metric_count": 12
  },
  "read_only": true
}
```
