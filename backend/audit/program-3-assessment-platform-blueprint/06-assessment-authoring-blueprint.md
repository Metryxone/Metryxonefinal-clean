# 06 · Assessment Authoring Blueprint (Layer 3)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED.**

## Canonical Definition
Assessment Authoring is the super-admin capability to build assessments: sections, domains, competencies, behaviours, scoring/validation/randomization/adaptive rules, templates, and the publishing workflow. Primary surface: the **CAF Assessment Builder** (`routes/caf-assessment-builder.ts` + `frontend/src/components/superadmin/caf/CAFAssessmentBuilderPanel.tsx`).

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Assessment Builder | SUPPORTED | `CAFAssessmentBuilderPanel.tsx` (create/edit); `routes/caf-assessment-builder.ts` CRUD over `caf_assessments`. |
| Section Builder | SUPPORTED | `caf_assessment_sections` + section CRUD; builder UI section management. |
| Domain Builder | SUPPORTED | `psychometric_domains`; `CompetencyCorePanel.tsx`. |
| Competency Builder | SUPPORTED | `competency_library`; `CompetencyMasterPanel.tsx`. |
| Behaviour Builder | SUPPORTED | `caf/scoring-engine.ts` `BARS_RUBRIC` (Behaviorally Anchored Rating Scales); `behavioral/AssessmentStart.tsx`. |
| Scoring Rules | SUPPORTED | `caf_score_rules` (weights, normalization, band thresholds); `caf/scoring-engine.ts` (IRT / CTT / SJT / BARS). |
| Validation Rules | SUPPORTED | `adaptive/question-governance-reject.ts`; `adaptive/contradiction-pairs.ts` (trait contradiction detection). |
| Randomization Rules | SUPPORTED | `caf_randomization_rules`; `caf/randomization-engine.ts`. |
| Adaptive Rules | SUPPORTED | `adaptive/adaptive-question-pipeline.ts` (dynamic pathing, information gain, adaptive length); `adaptive/information-gain.ts`. |
| Templates | SUPPORTED | `assessment_templates`; `test_blueprints`. |
| Publishing Workflow | SUPPORTED | `caf_assessments.status` (draft/published) + `published_at`; builder publish UI. |

## Scoring-Science Coverage in Authoring
The CAF builder authors assessments across four scoring methods — **IRT** (item response theory), **CTT** (classical test theory), **SJT** (situational judgment), **BARS** (behaviorally anchored rubrics) — selectable per assessment via `caf_score_rules`. This is the psychometric authoring backbone.

## Adaptive Authoring
Adaptive behaviour is authored as rules and executed by the adaptive pipeline (information gain, adaptive length, dynamic path selection). The runtime rebuild uses the same analyze envelope as the batch path, falling back to the batch on any failure — authoring never produces an un-runnable adaptive assessment.

## Gaps
None at Layer 3. (Bloom coding at authoring time is tracked under Layer 2 / GAP-AP-1.)

## Freeze Position
**FREEZE.** The CAF builder + rule tables (`caf_score_rules`, `caf_randomization_rules`, sections) and the adaptive-rule model are the canonical authoring surface. New question types or scoring methods extend `caf/scoring-engine.ts`, never a parallel builder.
