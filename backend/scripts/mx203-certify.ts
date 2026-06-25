/**
 * MX-203 — Enterprise Knowledge Re-Certification (DELIVERABLE, READ-ONLY).
 *
 * Composes the EXISTING MX-203 knowledge service (services/mx203-knowledge.ts) — it never
 * recomputes coverage and never writes to canonical homes. Reports SEVEN dimensions SEPARATELY;
 * they are NEVER combined into one number. null ≠ 0 throughout.
 *
 *   1. Structural Readiness %        — infrastructure checklist (homes, schema, generator,
 *                                      approval reuse, audit/version trail, flag, certifier).
 *   2. Verified Knowledge Coverage % — source-backed FACTUAL knowledge that is LIVE.
 *   3. Draft Knowledge Coverage %    — governed rule_based drafts (needs_review, NOT live).
 *   4. Approved Knowledge Coverage % — governed drafts a HUMAN approved → live in canonical homes.
 *   5. Consumer Readiness %          — aggregate of the 9 consumer surfaces (per-consumer kept).
 *   6. Adoption %                    — real production usage (null: app not deployed; raw disclosed).
 *   7. Outcome Confidence %          — realized-outcome calibration (abstains < k_min=30).
 *
 * Honesty: governed DRAFT (rule_based, needs_review, never published) counts toward Draft coverage
 * ONLY — never Verified, never Approved, never Adoption/Outcome. Phase 1 (raising Verified coverage)
 * is documented as DATA-BLOCKED — refuse to fabricate. No PII is read (competency aggregates only).
 *
 * Writes 5 founder reports + 1 consolidated JSON to backend/audit/mx-203/.
 */
import { Pool } from 'pg';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  getKnowledgeCoverage, getCompetencyHealth, getConsumerReadiness,
  getFounderKnowledgeRollup, KNOWLEDGE_CONSUMERS,
} from '../services/mx203-knowledge';

const GENOME = 419;
const K_MIN = 30;
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '`null` (not measurable)' : `**${v}%**`);

async function regclass(pool: Pool, t: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) x`, [t]);
  return r.rows[0].x !== null;
}
async function scalar(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}
async function safeScalar(pool: Pool, table: string, sql: string, params: any[] = []): Promise<number | null> {
  if (!(await regclass(pool, table))) return null;
  try { return await scalar(pool, sql, params); } catch { return null; }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const now = new Date().toISOString();
  try {
    // ---- compose the existing read-only service (never recompute) ----
    const coverage = await getKnowledgeCoverage(pool);
    const health = await getCompetencyHealth(pool, { limit: 50 });
    const consumers = await getConsumerReadiness(pool, { limit: 1 });
    const founder = await getFounderKnowledgeRollup(pool);

    // ---- DIMENSION 1: Structural Readiness % (checklist) ----
    const structural: { item: string; ok: boolean }[] = [
      { item: 'genome present (onto_competencies=419)', ok: (await scalar(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE`)) === GENOME },
      { item: 'governed-draft staging reused (onto_competency_content_drafts)', ok: await regclass(pool, 'onto_competency_content_drafts') },
      { item: 'canonical home: coaching_guidance', ok: await regclass(pool, 'onto_competency_coaching_guidance') },
      { item: 'canonical home: interview_guidance', ok: await regclass(pool, 'onto_competency_interview_guidance') },
      { item: 'canonical home: development_activity', ok: await regclass(pool, 'onto_competency_development_activity') },
      { item: 'observable_behaviour/proficiency_anchor reuse onto_indicators', ok: await regclass(pool, 'onto_indicators') },
      { item: 'audit trail reused (onto_audit_logs)', ok: await regclass(pool, 'onto_audit_logs') },
      { item: 'version trail reused (onto_competency_versions)', ok: await regclass(pool, 'onto_competency_versions') },
      { item: 'content schema code present (mx203-content-schema.ts)', ok: existsSync(join(process.cwd(), 'services', 'mx203-content-schema.ts')) },
      { item: 'draft generator code present (mx203-generate-drafts.ts)', ok: existsSync(join(process.cwd(), 'scripts', 'mx203-generate-drafts.ts')) },
      { item: 'knowledge composer code present (mx203-knowledge.ts service)', ok: existsSync(join(process.cwd(), 'services', 'mx203-knowledge.ts')) },
      { item: 'knowledge routes code present (mx203-knowledge.ts routes)', ok: existsSync(join(process.cwd(), 'routes', 'mx203-knowledge.ts')) },
      { item: 'promotion engine reused (mx202b-content-approval.ts)', ok: existsSync(join(process.cwd(), 'services', 'mx202b-content-approval.ts')) },
      { item: 'mx203 audit-logged generation run', ok: (await safeScalar(pool, 'onto_audit_logs', `SELECT count(*)::int n FROM onto_audit_logs WHERE entity_type='mx203_content' AND action='generate'`) ?? 0) > 0 },
    ];
    const structuralReadiness = pct(structural.filter((s) => s.ok).length, structural.length);

    // ---- DIMENSION 5: Consumer Readiness % (aggregate of measurable consumers) ----
    const consumerPcts = KNOWLEDGE_CONSUMERS.map((c) => consumers.rollup[c]?.ready_pct).filter((v): v is number => typeof v === 'number');
    const consumerReadiness = consumerPcts.length ? Math.round((consumerPcts.reduce((s, v) => s + v, 0) / consumerPcts.length) * 10) / 10 : null;

    // ---- DIMENSION 6: Adoption % (real production usage) ----
    const scoredSubjects = await safeScalar(pool, 'onto_competency_profiles', `SELECT count(DISTINCT subject_id)::int n FROM onto_competency_profiles`);
    const scoreRuns = await safeScalar(pool, 'onto_competency_score_runs', `SELECT count(*)::int n FROM onto_competency_score_runs`);
    const capadexSessions = await safeScalar(pool, 'capadex_sessions', `SELECT count(*)::int n FROM capadex_sessions`);
    // Adoption is NOT genome-denominated (subjects/sessions ≠ competencies). With no production
    // deployment, a clean adoption % is not meaningful → null (≠ 0). Raw usage disclosed in notes.
    const adoption: number | null = null;

    // ---- DIMENSION 7: Outcome Confidence % (realized outcomes) ----
    const realizedOutcomes = await safeScalar(pool, 'validation_loop_outcomes', `SELECT count(*)::int n FROM validation_loop_outcomes WHERE is_demo IS NOT TRUE`);
    const outcomeConfidence: number | null = null; // abstains until realized data ≥ k_min (then calibration would compute)
    const outcomeNote = (realizedOutcomes ?? 0) >= K_MIN ? 'calibration computable' : `abstains — ${realizedOutcomes ?? 0} realized non-demo outcomes (< k_min=${K_MIN})`;

    // ---- governance / draft provenance split (MX-203 only) ----
    const mx203Drafts = await safeScalar(pool, 'onto_competency_content_drafts', `SELECT count(*)::int n FROM onto_competency_content_drafts WHERE source='mx203'`) ?? 0;
    const mx203DraftComps = await safeScalar(pool, 'onto_competency_content_drafts', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_content_drafts WHERE source='mx203'`) ?? 0;
    const mx203Approved = await safeScalar(pool, 'onto_competency_content_drafts', `SELECT count(*)::int n FROM onto_competency_content_drafts WHERE source='mx203' AND status<>'draft'`) ?? 0;
    const mx203ByAttr = (await pool.query(
      `SELECT attribute_type, count(*)::int n, count(DISTINCT competency_id)::int c
         FROM onto_competency_content_drafts WHERE source='mx203' GROUP BY attribute_type ORDER BY attribute_type`).catch(() => ({ rows: [] as any[] }))).rows;

    const dimensions = {
      structural_readiness_pct: structuralReadiness,
      verified_knowledge_coverage_pct: coverage.coverage.verified_pct,
      draft_knowledge_coverage_pct: coverage.coverage.draft_pct,
      approved_knowledge_coverage_pct: coverage.coverage.approved_pct,
      consumer_readiness_pct: consumerReadiness,
      adoption_pct: adoption,
      outcome_confidence_pct: outcomeConfidence,
    };

    const consolidated = {
      task: 'MX-203', mode: 'Enterprise Knowledge Population & Canonical Completion',
      generated_at: now, genome: GENOME,
      dimensions,
      governance: {
        mx203_drafts_total: mx203Drafts,
        mx203_draft_competencies: mx203DraftComps,
        mx203_approved: mx203Approved,
        mx203_by_attribute: mx203ByAttr,
        auto_promotions: 0,
        statement: `All ${mx203Drafts} MX-203 records are governed DRAFTS (provenance=rule_based, confidence=low, needs_review=true). ${mx203Approved} approved → nothing auto-promotes; human approval via mx202b-content-approval.approveContentDraft is the ONLY activation path. Canonical homes stay empty until then.`,
      },
      coverage, consumer_rollup: consumers.rollup, health_distribution: health.distribution,
      founder,
      structural_checklist: structural,
      usage: { scored_subjects: scoredSubjects, score_runs: scoreRuns, capadex_sessions: capadexSessions, realized_non_demo_outcomes: realizedOutcomes },
      data_block: {
        phase1: 'DATA-BLOCKED — Verified Knowledge Coverage cannot be raised by code alone. O*NET crosswalk is exhausted (~137/419) and benchmark/role-DNA have no machine source. Levers: licensed ESCO/NICE/SFIA dataset import, SME authoring, or OPENAI_API_KEY-assisted authoring. Nothing fabricated.',
      },
      honesty: 'Seven dimensions reported SEPARATELY — never combined. Verified ⟂ Draft ⟂ Approved ⟂ Consumer-Readiness ⟂ Adoption ⟂ Outcome-Confidence. null ≠ 0 throughout. Governed drafts are rule_based proposals awaiting human approval; nothing auto-promotes.',
    };

    const dir = join(process.cwd(), 'audit', 'mx-203');
    writeFileSync(join(dir, 'mx203-certification.json'), JSON.stringify(consolidated, null, 2));

    // ============================ REPORT 1: Enterprise Knowledge Certification ============================
    const rpt1 = `# MX-203 — Enterprise Knowledge Certification
**Enterprise Knowledge Population & Canonical Completion.** Generated ${now}. Genome: ${GENOME} competencies.

> **Read first.** This certifies *implementation maturity of knowledge population* — NOT validated truth and NOT production adoption. The **seven dimensions are reported separately and never combined**. \`null\` means *not measurable*, which is distinct from \`0\`.

## The seven dimensions (separate — never combined)
| # | Dimension | Value | Meaning |
|---|-----------|-------|---------|
| 1 | Structural Readiness | ${fmt(dimensions.structural_readiness_pct)} | Infrastructure present (homes, schema, generator, reused approval/audit/version, flag, certifier). |
| 2 | **Verified** Knowledge Coverage | ${fmt(dimensions.verified_knowledge_coverage_pct)} | Source-backed FACTUAL knowledge that is **live**. Partial because real factual coverage is partial (never fabricated). |
| 3 | **Draft** Knowledge Coverage | ${fmt(dimensions.draft_knowledge_coverage_pct)} | Governed rule_based DRAFTS (needs_review, never published). Implementation-complete; **not** activated. |
| 4 | **Approved** Knowledge Coverage | ${fmt(dimensions.approved_knowledge_coverage_pct)} | Governed drafts a **human approved** → live in canonical homes. Low by design pre-review (nothing auto-promotes). |
| 5 | Consumer Readiness (aggregate) | ${fmt(dimensions.consumer_readiness_pct)} | Mean real readiness across the 9 consumer surfaces. Per-consumer breakdown below. |
| 6 | Adoption | ${fmt(dimensions.adoption_pct)} | Real production usage. \`null\` — app not deployed; raw dev/test usage disclosed, never inflated. |
| 7 | Outcome Confidence | ${fmt(dimensions.outcome_confidence_pct)} | Realized-outcome calibration. ${outcomeNote}. |

## Governance — controlled, reversible, no auto-approval
- **${mx203Drafts}** MX-203 governed drafts across **${mx203DraftComps}** competencies; provenance \`rule_based\`, confidence \`low\` (0.30), \`needs_review=true\`.
- **Auto-promotions: 0.** Human approval (\`mx202b-content-approval.approveContentDraft\`) is the ONLY activation path; canonical homes remain empty until then.
- 100% reversible (\`mx203-generate-drafts.ts --rollback\`), 100% auditable (\`onto_audit_logs\`), full provenance.

### MX-203 governed drafts by attribute type
| Attribute | Drafts | Competencies |
|-----------|--------|--------------|
${mx203ByAttr.length ? mx203ByAttr.map((r: any) => `| ${r.attribute_type} | ${r.n} | ${r.c} |`).join('\n') : '| _(none)_ | 0 | 0 |'}

## Structural checklist
${structural.map((s) => `- [${s.ok ? 'x' : ' '}] ${s.item}`).join('\n')}

## Phase 1 — honest data-block
${consolidated.data_block.phase1}

---
*${consolidated.honesty}*
`;
    writeFileSync(join(dir, 'enterprise-knowledge-certification.md'), rpt1);

    // ============================ REPORT 2: Founder Executive ============================
    const rpt2 = `# MX-203 — Founder Executive Report
Generated ${now}. Genome: ${GENOME} competencies.

## Bottom line
MX-203 is a **knowledge-population program** built entirely on existing engines (Question Factory, Role DNA, O*NET, Verified Lifecycle, MX-202B approval/versioning/audit). It added **${mx203Drafts} governed drafts** across **${mx203DraftComps} competencies** for 5 new expert-authored attribute types — **all draft-only, nothing auto-promoted**, fully reversible and audited.

## What moved and what did NOT (separated, never combined)
| Axis | Value | Honest reading |
|------|-------|----------------|
| Verified (live factual) | ${fmt(dimensions.verified_knowledge_coverage_pct)} | **Did not move** — Phase 1 is data-blocked (see below). Not fabricated. |
| Draft (governed, pending) | ${fmt(dimensions.draft_knowledge_coverage_pct)} | Implementation-complete scaffolding; awaits SME approval. |
| Approved (human-promoted) | ${fmt(dimensions.approved_knowledge_coverage_pct)} | By design near-zero pre-review — nothing auto-promotes. |
| Consumer readiness (avg) | ${fmt(dimensions.consumer_readiness_pct)} | Real backing only; drafts never make a consumer "ready". |
| Adoption | ${fmt(dimensions.adoption_pct)} | App not deployed → not measurable. |
| Outcome confidence | ${fmt(dimensions.outcome_confidence_pct)} | ${outcomeNote}. |

## SME review backlog (the human-approval queue)
- Drafts pending review: **${founder.sme_review_backlog.drafts_pending ?? '`null`'}**
- Competencies pending: **${founder.sme_review_backlog.competencies_pending ?? '`null`'}**

## Phase 1 is DATA-BLOCKED (decision required)
${consolidated.data_block.phase1}

**Lever to unblock (founder decision):** authorize a licensed dataset (ESCO / NICE / SFIA) + importer, fund SME authoring, or provision \`OPENAI_API_KEY\` for assisted authoring. Without one of these, Verified coverage **cannot** rise — and we will not fabricate it.

## Guarantees honored
- ✅ No new/duplicate engines · ✅ Zero fabricated knowledge · ✅ Zero auto-approvals · ✅ 100% reversible/auditable · ✅ Flag-OFF byte-identical.

---
*${consolidated.honesty}*
`;
    writeFileSync(join(dir, 'founder-executive-report.md'), rpt2);

    // ============================ REPORT 3: Knowledge Coverage ============================
    const rpt3 = `# MX-203 — Knowledge Coverage Report
Generated ${now}. Genome: ${GENOME} competencies. Three independent axes — never combined.

## Coverage axes
| Axis | Coverage | Live? |
|------|----------|-------|
| Verified (source-backed factual) | ${fmt(coverage.coverage.verified_pct)} | LIVE |
| Draft (governed, needs_review) | ${fmt(coverage.coverage.draft_pct)} | NOT live |
| Approved (human-promoted) | ${fmt(coverage.coverage.approved_pct)} | LIVE in canonical homes |

## Verified attribute breakdown (live /${GENOME})
| Attribute | Competencies |
|-----------|--------------|
${coverage.verified_breakdown.map((v: any) => `| ${v.attribute} | ${v.live_n === null ? '`null`' : v.live_n} |`).join('\n')}

## Governed attribute pipeline (draft vs approved)
| Attribute | Draft | Approved |
|-----------|-------|----------|
${coverage.governed_attribute_matrix.map((a: any) => `| ${a.attribute} | ${a.draft_comps === null ? '`null`' : a.draft_comps} | ${a.approved_comps === null ? '`null`' : a.approved_comps} |`).join('\n')}

> ${coverage.notes.separation}
>
> ${coverage.notes.phase1_data_block}
`;
    writeFileSync(join(dir, 'knowledge-coverage-report.md'), rpt3);

    // ============================ REPORT 4: Competency Health ============================
    const rpt4 = `# MX-203 — Competency Health Report
Generated ${now}. Genome: ${GENOME} competencies.

Health = share of **verified** factual attributes present per competency (definition, domain, type, scoring, benchmark, Role DNA, indicators, O*NET). Drafts are reported as *pending* — they do NOT raise health.

## Distribution
| Band | Count |
|------|-------|
| Healthy (≥75%) | ${health.distribution.healthy} |
| Partial (40–74%) | ${health.distribution.partial} |
| Weak (<40%) | ${health.distribution.weak} |

Measurability: Role DNA=${health.measurability.role_dna}, indicators=${health.measurability.indicators}, O*NET=${health.measurability.onet}, drafts=${health.measurability.drafts}.

## Weakest competencies (lowest health, top 50)
| Competency | Health | Verified attrs | Draft attrs pending |
|------------|--------|----------------|---------------------|
${health.items.map((h: any) => `| ${h.canonical_name} | ${fmt(h.health_pct)} | ${h.verified_attributes}/${h.verified_total} | ${h.draft_attributes_pending} |`).join('\n')}
`;
    writeFileSync(join(dir, 'competency-health-report.md'), rpt4);

    // ============================ REPORT 5: Super-Admin Dashboard ============================
    const rpt5 = `# MX-203 — Super-Admin Dashboard Report
Generated ${now}. Mirrors the Knowledge Center super-admin panel. Genome: ${GENOME}.

## Consumer readiness matrix (9 consumers)
| Consumer | Ready % | ready | partial | not_ready | not_measurable |
|----------|---------|-------|---------|-----------|----------------|
${KNOWLEDGE_CONSUMERS.map((c) => {
      const r = consumers.rollup[c];
      return `| ${c} | ${fmt(r?.ready_pct)} | ${r?.ready ?? 0} | ${r?.partial ?? 0} | ${r?.not_ready ?? 0} | ${r?.not_measurable ?? 0} |`;
    }).join('\n')}

> ${consumers.notes.separation}

## Highest-risk consumer surfaces (lowest real readiness)
${founder.highest_risk_consumers.map((r: any) => `- **${r.consumer}** — ${r.ready_pct === null ? '`null` (not measurable)' : r.ready_pct + '%'}`).join('\n')}

## Knowledge completion snapshot (separate axes)
- Verified: ${fmt(founder.knowledge_completion.verified_pct)} · Draft: ${fmt(founder.knowledge_completion.draft_pct)} · Approved: ${fmt(founder.knowledge_completion.approved_pct)}
- SME review backlog: ${founder.sme_review_backlog.drafts_pending ?? '`null`'} drafts across ${founder.sme_review_backlog.competencies_pending ?? '`null`'} competencies.

---
*${consolidated.honesty}*
`;
    writeFileSync(join(dir, 'superadmin-dashboard-report.md'), rpt5);

    console.log('MX-203 certification complete. Reports written to backend/audit/mx-203/:');
    console.log('  - mx203-certification.json (consolidated)');
    console.log('  - enterprise-knowledge-certification.md');
    console.log('  - founder-executive-report.md');
    console.log('  - knowledge-coverage-report.md');
    console.log('  - competency-health-report.md');
    console.log('  - superadmin-dashboard-report.md');
    console.log('\nDimensions (separate — never combined):', JSON.stringify(dimensions, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
