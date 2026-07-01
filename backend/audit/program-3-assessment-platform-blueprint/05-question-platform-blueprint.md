# 05 · Question Platform Blueprint (Layer 2)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED (one PARTIAL: Bloom breadth).**

## Canonical Definition
The Question Platform owns the full question lifecycle: authoring/generation, typing, metadata, mapping to competencies/behaviours/skills, difficulty & cognitive level, language & media, tagging, versioning, review/approval/retirement, analytics, and duplicate detection. Primary stores: `psychometric_question_bank` and `capadex_question_registry` (20k+ items tracked by `question-registry-service.ts`).

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Question Bank | SUPPORTED | `psychometric_question_bank`; `capadex_question_registry`; `services/question-registry-service.ts` (20k+ items). |
| Question Builder | SUPPORTED | `routes/question-factory.ts` (`POST /generate`, `POST /import`); `services/question-factory.ts`. |
| Question Types | SUPPORTED | Likert / MCQ / Scenario / Situational-Judgment; `ARCH_TO_QTYPE` in `question-factory.ts`. |
| Question Metadata | SUPPORTED | `services/question-metadata-ranking.ts` — `age_band`, `persona`, `dev_stage`, `signal_family`. |
| Competency Mapping | SUPPORTED | `onto_competency_question_map`; `services/assessment-foundation-mapping.ts`. |
| Behaviour Mapping | SUPPORTED | `services/wc3/question-stage-intelligence.ts` (narrative style + polarity → WC-3 stage). |
| Skills Mapping | SUPPORTED | `services/ai-competency-inference-engine.ts`; `routes/career-genome.ts`. |
| Bloom's Taxonomy | **PARTIAL** | Present for the CAF/academic family — `BLOOM_MULTIPLIERS` keyed on `question.cognitive_level` in `caf/scoring-engine.ts`; `bloomsLevel` (remember/understand/apply/analyze) in `aiTestGenerator.ts`. **Not applied** to the behavioural `psychometric_question_bank`. → GAP-AP-1 (Low). |
| Difficulty | SUPPORTED | `psychometric_question_bank` difficulty (Foundational→Expert); `question-metadata-ranking.ts`. |
| Language | SUPPORTED | `psychometric_question_bank.language` (default `EN`); locale packs (see Delivery). |
| Media | SUPPORTED | Image/audio integrations; media references in the question/report pipeline. |
| Tags | SUPPORTED | `question-factory.ts` — `role_tags`, `industry_tags`, `stage_tags`, `function_tags`. |
| Question Versioning | SUPPORTED | `capadex_question_registry.version`. |
| Question Review | SUPPORTED | `question-factory.ts` — `quality_review_status` (`pending_review` / `in_review` / `needs_revision`). |
| Question Approval | SUPPORTED | `question-factory.ts` — `reviewQuestion` (approve action). |
| Question Retirement | SUPPORTED | `question-factory.ts` — `retireQuestion` (archive: `active=false`, status→draft). |
| Question Analytics | SUPPORTED | `question-registry-service.ts` — `usage_count`, `signal_value`, `report_impact`. |
| Duplicate Detection | SUPPORTED | `question-registry-service.ts` — `computeDuplicates` (Jaccard token-set similarity). |

## Governance Notes
- Question status transitions are **human-only** (review→approve→retire); the runtime serves only `approved` items, so flag-gated persona bank seeds (e.g. campus/jobseeker/teacher DRAFTs) are byte-identical until human promotion.
- "Low-signal/unused" governance buckets must gate on **system-wide** usage existing (cold start floods the whole bank) — this is respected by the registry service.

## Store Reconciliation (multiple question stores)
Three stores coexist: `psychometric_question_bank` (behavioural), `capadex_question_registry` (governance/registry over served items), and `competency_question_templates` / `onto_competency_question_map` (competency family). These are **role-distinct**, not duplicates, but the freeze notes a **recommend-only** consolidation candidate for a unified question-registry view (see gap register, non-critical).

## Gaps
- **GAP-AP-1 (Low):** Bloom/cognitive-level coding not applied to the behavioural bank (present for CAF/academic only).

## Freeze Position
**FREEZE.** The question-factory lifecycle (generate/import/review/approve/retire), metadata schema, mapping surfaces, analytics, and duplicate detection are canonical. Bloom breadth is an additive enhancement, not a redesign.
