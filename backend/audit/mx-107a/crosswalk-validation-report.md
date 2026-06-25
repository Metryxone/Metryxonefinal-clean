# MX-107A — Competency Match Intelligence: Crosswalk Validation

- **Generated:** 2026-06-25T01:06:09.629Z
- **Composer version:** 107a.1.0.0
- **Flag (FF_COMPETENCY_MATCH_INTELLIGENCE):** ON 
- **Mode:** READ-ONLY composition (no recompute, no DDL, no writes).

## Overall verdict: **PARTIAL**

PASS 4 · PARTIAL 2 · FAIL 0 (of 6)

> The HONEST verdict is **PARTIAL**: the chain runs off ONE canonical framework and is
> operationally matchable today (domain-proxy), but canonical comp-level **precision**
> and live **activation** volume are data efforts — never fabricated by composition.

## Headline axes (Precise ⟂ Operational — never composited)

| Axis | Value |
| --- | --- |
| PRECISE competency coverage (mapped/genome) | 1.7% |
| OPERATIONAL competency coverage (domain-proxy) | 100% |
| PRECISE requirement reachability | 26.3% |
| OPERATIONAL requirement reachability | 100% |

## Phase 1 — Crosswalk coverage (hop by hop)

### 1 · Assessment questions → competency  _(axis: precise)_
- present: true · coverage: _null (not measurable)_
- counts: bank_questions=2602 · precise_mapped_questions=25
- 25 questions carry a PRECISE competency map; the wider authored bank (2602) scores via domain proxy until mapped.

### 2 · Competencies measured  _(axis: precise)_
- present: true · coverage: 1.7%
- counts: genome_competencies=419 · precise_mapped_competencies=7 · domain_proxy_eligible=419
- PRECISE comp-level coverage is 1.7% (7/419); domain-proxy is OPERATIONAL at 100%. Reaching 100% precise is the data-mapping effort, not composition.

### 3 · Competency scores  _(axis: structural)_
- present: true · coverage: _null (not measurable)_
- counts: scored_subjects=37 · score_runs=23
- 37 subjects scored across 23 runs (dual ledger: profiles + score_runs). Activation accrues as real assessments complete.

### 4 · Role DNA requirements  _(axis: structural)_
- present: true · coverage: 100%
- counts: dna_roles=13 · dna_requirements=76 · requirements_with_level=76
- 13 roles carry curated Role DNA (76 requirements); 100% specify a required level.

### 5 · Match reachability (req → competency score)  _(axis: operational)_
- present: true · coverage: 100%
- counts: requirements_total=76 · precise_reachable=20 · proxy_reachable=76
- 26.3% of role requirements are PRECISE-reachable (20/76); 100% are OPERATIONAL via domain proxy. The two axes are reported separately — never composited.

## Phase 5 — Super Admin coverage console

- **Question → Competency crosswalk** (crosswalk) — available: true
  - Precise coverage = competencies with an authored question map; operational = domain-proxy eligible. Separate axes.
- **Role DNA coverage** (roleDna) — available: true
  - Share of active roles that carry a curated competency requirement profile.
- **Assessment coverage** (assessment) — available: true
  - Scored subjects are the live activation axis; map coverage is the precise-scoring axis.
- **Competency → match reachability** (competencyMatch) — available: true
  - How much of curated Role DNA the match engine can actually score (precise vs domain-proxy).
- **Employer match activation** (employerMatch) — available: true
  - Live employer-side substrate. Match outcomes accrue as employers post jobs and run candidate matches.

## Phase 6 — Founder dashboard

- Avg PRECISE reachability: 28.5% · Avg OPERATIONAL reachability: 100% (roles measured: 13)
- Live employer match: **abstained** — Live employer match outcomes are not yet accrued; the operational match path is proven (domain-proxy) but real candidate→role matches abstain until employers run them.

| Role | Precise reach % | Operational reach % | Reqs |
| --- | --- | --- | --- |
| Backend Engineer | 100% | 100% | 4 |
| Product Manager | 100% | 100% | 6 |
| Senior Backend Engineer | 100% | 100% | 4 |
| Business Analyst | 20% | 100% | 6 |
| Full Stack Engineer | 15% | 100% | 6 |

## Phase 8 — Certification questions

### PASS — Does candidate assessment, employer Role DNA, readiness and recommendations run off ONE canonical competency framework?
- All surfaces resolve against the onto_* genome (419 competencies) + onto_role_competency_profiles (76 requirements across 13 roles). No parallel framework exists.

### PARTIAL — Is the canonical comp_*-level mapping 100% complete (every competency precisely question-mapped)?
- PRECISE coverage is 1.7% (7/419). Reaching 100% is the question→competency data-mapping effort (NOT achievable by composition) — honestly PARTIAL.

### PASS — Can the match engine operationally score curated Role DNA today (via the domain-proxy bridge)?
- 100% of role requirements (76/76) are domain-proxy reachable; precise-reachable is 26.3% (20/76). Reported on separate axes — never composited.

### PASS — Do roles carry curated competency Role DNA with required levels?
- 13 roles carry curated Role DNA (76 requirements). Required levels back the readiness/gap computation.

### PARTIAL — Is the chain ACTIVATED with real (non-demo) assessment volume end-to-end?
- 37 subjects carry competency scores, but these cannot be verified as non-demo at this layer. The structural machinery is in place; real (non-demo) activation volume is NOT proven, so this stays PARTIAL — never upgraded to PASS on demo/seed counts.

### PASS — Are Coverage ⟂ Confidence and Precise ⟂ Operational kept SEPARATE (no inflated single number)?
- Every surface reports precise and operational axes separately; rates with a zero denominator are null (never a fabricated 0%); absent tables degrade to null, not 0.

## Honesty ceiling (explicit)

- PRECISE comp_*-level scoring is reachable only where questions carry an authored
  competency map. Today that is a small fraction of the 419-competency genome — this is a
  DATA-mapping effort (approve more tagged questions), NOT something composition can close.
- The OPERATIONAL (domain-proxy) match path scores curated Role DNA today and is reported
  on a SEPARATE axis so canonical precision is never inflated.
- Live activation (real scored subjects) is below k_min=30 in dev — reported PARTIAL, not 100%.

---
_Read-only composition. Developmental signals only — NOT hiring/promotion predictions._