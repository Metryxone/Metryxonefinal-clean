# MX-101A — Competency Coverage Population Program — Founder Report

**Status: PARTIAL — full DRAFT pipeline generated across the entire genome; live (approved) coverage unchanged. Human approval is the only remaining, and only coverage-changing, step.**
**Guardrails honoured: Additive · Reversible · Flag-Gated · byte-identical OFF · never auto-approve · never inflate coverage · never delete (archive only) · AI inert without OPENAI_API_KEY.**

_Generated 2026-06-24T09:18:39.826Z · population engine mx101a-1.0.0 · all numbers measured live._

---

## Three-axis coverage (the honest headline)
| Axis | Competencies | % of genome |
|---|---|---|
| Draft Coverage | 419 | 100% |
| Approved Coverage | 7 | 1.7% |
| Assessment-Ready Coverage | 0 | 0% |

## Target progress (PASS earned only by human approval)
| Target | Current | Target | Met? | Remaining |
|---|---|---|---|---|
| Approved coverage % | 1.7% | 80% | ❌ | 78.3% |
| Assessment-ready competencies | 0 | 350 | ❌ | 350 |
| Role-DNA ready % | 0% | 95% | ❌ | 95% |

---

## 12 Founder Questions

**1. Is the full draft pipeline generated across the whole genome?**
Yes. Draft coverage is **419/419 (100%)** with **2545** draft questions in the pipeline.

**2. Did generation inflate live coverage in any way?**
No. Approved coverage is **7 (1.7%)** and assessment-ready is **0 (0%)** — both unchanged by generation. Every draft is `status='draft'`, `pending_review`, with an INACTIVE map link.

**3. Are Draft / Approved / Assessment-Ready kept as three separate axes?**
Yes — separate definitions, separate counts, never composited. Assessment-Ready uses a rigorous gate (>=4 approved+active spanning >=2 question types AND >=2 difficulty bands).

**4. How is the genome prioritized for review?**
Deterministic Tier 1–4: Critical (Role-DNA / benchmark consumed) = 21, High-Value (leadership / strategic / cross-role) = 398, Role / Function-Specific = 0, Future Skills = 0. Tier 1 is real downstream demand (Role-DNA consumed).

**5. What about the Role-DNA / employer / career consumers specifically?**
Role-DNA denominator is **21** competencies. Draft 100% · Approved 19% · Ready 0% (target 95%). Employer + Career consume this same set.

**6. Is the generated content structurally sound?**
Duplication: **review** (419 groups). Structural: **pass** (0 issues). Avg confidence: **0.433**. Structural checks only — content quality requires human review.

**7. Is every question's origin traceable?**
Yes. Provenance: template_generated=2524 · human_authored=44 · imported=34. Review status: pending_review=2545 · approved=57.

**8. Is the run reversible?**
Yes. Every row carries `provenance='template_generated'` + `template_key LIKE 'qf-%'`. One DELETE predicate reverses the entire run; human-authored and imported content is untouched.

**9. Is the feature flag-gated and byte-identical when OFF?**
Yes. `questionFactory` (env `FF_QUESTION_FACTORY`) defaults OFF; the gate returns 503 before auth/DB/DDL; GET reads probe + degrade (no DDL); ensure-schema runs only on POST; nav tab + render gated on the probe.

**10. Can the AI path fabricate questions without a key?**
No. `generateAIPack` is wired-but-inert — returns `{ok:false}` (HTTP 422) without `OPENAI_API_KEY`. The full run used the deterministic template path only.

**11. What is the remaining work to reach the targets?**
Human approval. Approved coverage needs **78.3%** more, assessment-ready needs **350** more competencies. No code work — this is reviewed content work via the existing approval workflow.

**12. What is the honest verdict?**
**PARTIAL.** The population machinery is complete and the full draft pipeline exists across all 419 competencies, but live coverage stays honest at 1.7% approved / 0% assessment-ready because coverage is earned only by human approval — never manufactured.

---

## Deliverables in this folder
- `competency_population_priority_matrix.md` — Tier 1–4 classification
- `role_dna_population_plan.md` — downstream-consumer coverage
- `difficulty_coverage_report.md` — difficulty band roll-up
- `competency_type_coverage_report.md` — type coverage vs target
- `question_quality_framework.md` — structural quality controls
- `question_provenance_framework.md` — provenance + reversibility
- `assessment_readiness_framework.md` — the three coverage axes
- `founder-report.md` — this file
