---
name: MX-202B governed-draft implementation maturity
description: Pattern + traps for completing the competency framework to "implementation maturity" via governed drafts, separate from production validation.
---

# Implementation maturity via governed drafts (competency framework)

"Implementation maturity" (system built + every competency reachable by every attribute pipeline) is a SEPARATE axis from production validation (real adoption/outcomes). Report them as distinct dimensions; never blend.

## The pattern (additive, reversible, no fabrication)
- ONE governed-draft staging table (`onto_competency_content_drafts`, `attribute_type` discriminator, status/provenance/confidence/needs_review/source lifecycle) feeds N canonical home tables. Drafts are rule-based proposals (`provenance='rule_based'`, low confidence, `needs_review=true`, `status='draft'`) — legitimate completeness, NOT fabricated validity.
- **Approval is the ONLY activation path.** Nothing auto-promotes. Live homes stay 0 until a human approves → byte-identical-OFF.
- Reuse the existing audit (`onto_audit_logs`) + version (`onto_competency_versions`) tables; do NOT build a parallel audit/version engine.
- All rows carry `source='mx202b'` so generate/approve are fully reversible.

## REAL-ONLY attributes must NEVER be drafted
benchmark_metadata, role_dna (role weights), and O*NET crosswalk are real-evidence-only. Drafting them = inventing evidence = fabrication. Leave them as honest coverage gaps; do not let a generator inflate them.

## Reversibility trap: promoting into a table with no source/draft_id column
`onto_indicators` has no `source`/`draft_id` columns. Approval promotes a draft there and stores the new row id back in the **draft's** `content._promoted_id` — that JSON pointer is the ONLY link. So `--rollback` MUST consume `_promoted_id` and delete those live indicator rows BEFORE deleting the draft rows, or it orphans unrecoverable live rows. New canonical home tables avoid this by carrying `source`+`draft_id` directly.

## Certifier honesty rules (the report IS the deliverable)
- **Never hard-code coverage.** A first cut set onet_crosswalk `combined_n = GENOME` (419) when only 137 are mapped — that silently inflated Implementation Completion. Coverage must be mechanically derived from real rows + real draft rows only.
- **Never hard-code a structural `ok:true`.** Make each checklist item evidence-based (table `to_regclass` probe, or `fs.existsSync` on the engine file for code-presence).
- Report SIX dimensions separately: Implementation Completion, Structural Readiness, Content Completion (draft vs approved as two numbers), Activation, Adoption, Outcome Confidence. **null ≠ 0** (adoption has no genome-denominated meaning with no deploy → null + raw counts disclosed; outcome confidence abstains < k_min=30 → null).
- Activation that counts pre-existing native identity fields is technically true but must be disambiguated: state the MX-202B-generated-content activation (≈ approved %) separately so it isn't read as "the new drafts are live."
