# Employer Competency Intelligence — Evidence (MX-100X Phase 5)
Engine v98x-phase5-1.0.0 · generated 2026-06-23T19:14:08.102Z

Read-only · additive · flag `employerCompetencyHiring` (OFF byte-identical). Engine run directly (flag gates the route only).

## Part A — Live trace (role "Software Engineer", synthetic candidate)
- Role DNA resolved: true (title=Software Engineer, source=inherited_only, confidence=0.85)
- Requirements: 10 · assessed: 0 · coverage: null%
- Competency match: null (withheld) · source: heuristic_fallback
- Fit band: WITHHELD (null) · validated: false · calibration: uncalibrated
- Interview structure: baseline_competency_assessment · focus areas: 0 · probe areas: 0
- Hiring action: insufficient_competency_evidence
- Benchmark: available=false suppressed=false reason=no_matching_benchmark_row (k_min=30)
- Provenance: 98x_phase5_employer_competency_intelligence

  Honest read: live employer candidate/competency data is dormant — a synthetic candidate has no
  measured competency profile, so the match abstains (heuristic fallback) rather than fabricate a score.
  Role DNA + requirements + benchmark abstention demonstrate the upstream flow is wired and honest.

## Part B — Derivation proof (crafted measured match)
- Strong/calibrated: hiring action=advance_to_interview (expect advance_to_interview) · validated=true · structure=targeted_competency_deep_dive
  focus areas (measured gaps): COG, LEA · probe (unassessed): TEC, ADP
- Coverage-thin: hiring action=gather_more_evidence (expect gather_more_evidence) · fitBand=WITHHELD (expect WITHHELD)
- Low match: hiring action=development_focus (expect development_focus)
- Benchmark k>=30: n=42 released=true (expect true)
- Benchmark n=12: suppressed=true reason=cohort_too_small(n=12,min=30) (expect cohort_too_small)
- Benchmark n=unknown: suppressed=true reason=cohort_size_unknown (expect cohort_size_unknown — fail closed)
- Benchmark absent: available=false suppressed=false (expect false/false — honest abstain)

## Part C — Language policy (developmental signals only)
- interview recommendation: PASS — no verdict/suitability language
- hiring recommendation: PASS — no verdict/suitability language
- Disclaimer present on hiring rec: PASS

## Verdict: PASS

### Honest ceiling
- Live employer candidate/job/competency data = dormant (0 rows). Real match/fit/benchmark cannot be
  exercised on production data and remain honestly withheld/abstained — a DATA-MATURITY gap, not a code gap.
- Calibration stays `uncalibrated` until >=30 realized hiring outcomes (Phase 7, data-gated).
- Recommendations are developmental competency signals — never a hiring/suitability verdict.