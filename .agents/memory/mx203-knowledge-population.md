---
name: MX-203 Enterprise Knowledge Population & Canonical Completion
description: Knowledge-population program (not new engineering) — governed draft generation + read-only validation/certification over the existing competency genome; reuse, never duplicate, engines.
---

# MX-203 — Enterprise Knowledge Population & Canonical Completion

Follows merged MX-202B. A KNOWLEDGE-POPULATION program, not new engineering. Flag `mx203KnowledgePopulation` (OFF byte-identical incl. schema). STOP for founder approval, NO DEPLOY.

## Rule: reuse the ONE promotion/approval/audit spine — never duplicate
- Staging: `onto_competency_content_drafts`. Promotion = `mx202b-content-approval.approveContentDraft` (the ONLY activation path). Add new attribute homes to `HOME_BY_ATTR` in that file — do NOT write a parallel approver.
- Verified lifecycle (`mx202b-verified-lifecycle`): expert_authored attrs can NEVER auto-verify (correct by design).
- Audit `onto_audit_logs`, versions `onto_competency_versions`. The generator logs `entity_type='mx203_content'`, `action IN ('generate','rollback')`.
- **Why:** the founder success criterion is explicitly "no new/duplicate engines." A second approver/auditor would split the lifecycle and break reversibility guarantees.

## Phase 1 is DATA-BLOCKED — refuse to fabricate
- Raising Verified Coverage past the live ~78.9% has NO machine source: no ESCO/NICE/SFIA importers exist, O*NET crosswalk exhausted (~137/419), benchmark/role-DNA have no machine source. Report as an honest data-blocked finding with the exact lever (licensed dataset / SME / `OPENAI_API_KEY`). Never auto-author content to close the gap.

## Phase 2 — governed DRAFT generation (`mx203-generate-drafts.ts`, `--rollback`)
- 3 new canonical homes (`onto_competency_coaching_guidance` / `_interview_guidance` / `_development_activity`) start EMPTY; observable_behaviour & proficiency_anchor reuse `onto_indicators`.
- Drafts: `source='mx203'`, `provenance='rule_based'`, confidence `0.30/'low'`, `needs_review=true`, `status='draft'`. Grounded ONLY in genome (name/definition/domain/type + 5 global proficiency descriptors).
- Implementation completeness ≠ validated truth. Rollback deletes all `source='mx203'` drafts + unpromotes any approved rows; canonical homes stay 0 until human approval.

## Phase 3/4/5 — read-only validation composer + Knowledge Center
- `services/mx203-knowledge.ts` is SELECT-only: `to_regclass`-probe + degrade, null≠0. Per-competency consumer-readiness across 9 consumers, deterministic criteria citing REAL backing (absent backing → not_ready, never fabricate). Reuses MX-101B readiness + `getThreeAxisCoverage`.
- Routes flag-gated + `requireAuth+requireSuperAdmin`; `/enabled` probe returns `{enabled:true}`. Frontend panel lazy, nav+render gated (byte-identical-OFF).

## Phase 6 — certifier (`mx203-certify.ts`, deliverable to `backend/audit/mx-203/`)
- 7 SEPARATE dimensions, NEVER combined, null≠0: structural_readiness / verified / draft / approved / consumer_readiness / adoption(null, no deploy) / outcome_confidence(null, abstain <30).
- **Certifier honesty trap (caught in review):** a structural checklist predicate `(safeScalar(...) ?? 0) >= 0` is ALWAYS true and falsely reports full readiness even with no evidence. Require real evidence (`> 0`) and query the columns that actually exist (generator writes `after_state`, not `details`). Missing table → null/not-measurable, never an implicit pass.
