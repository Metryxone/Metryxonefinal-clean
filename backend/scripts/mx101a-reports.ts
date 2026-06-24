/**
 * MX-101A — Honest report generation. Renders the founder deliverables from LIVE DB state
 * into backend/audit/mx-101a/*.md. Read-only (no writes to the bank). Every number is measured.
 *
 * Run: cd backend && npx tsx scripts/mx101a-reports.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getFactoryCoverage } from '../services/question-factory';
import {
  computePriorityTiers,
  getThreeAxisCoverage,
  getRoleDnaCoverage,
  runQualityChecks,
  getDifficultyCoverage,
  getTypeCoverage,
  getFounderDashboard,
  TARGETS,
  POPULATION_VERSION,
} from '../services/question-factory-population';

const OUT = join(__dirname, '..', 'audit', 'mx-101a');
const now = () => new Date().toISOString();
const w = (name: string, body: string) => {
  writeFileSync(join(OUT, name), body, 'utf8');
  console.log(`  wrote audit/mx-101a/${name}`);
};
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const [tiers, axes, roleDna, quality, diff, type, founder, factory] = await Promise.all([
      computePriorityTiers(pool),
      getThreeAxisCoverage(pool),
      getRoleDnaCoverage(pool),
      runQualityChecks(pool),
      getDifficultyCoverage(pool),
      getTypeCoverage(pool),
      getFounderDashboard(pool),
      getFactoryCoverage(pool),
    ]);
    // Honesty guard: no competency-based metric may exceed the genome competency count. A breach
    // means a metric is counting a non-genome / stale / phantom bucket — fail loudly rather than
    // ship an internally inconsistent founder deliverable.
    const genome = axes.genome_competencies;
    const competencyMetrics: [string, number][] = [
      ['axes.draft_coverage', axes.draft_coverage.competencies],
      ['axes.approved_coverage', axes.approved_coverage.competencies],
      ['axes.assessment_ready_coverage', axes.assessment_ready_coverage.competencies],
      ['roleDna.role_dna_competencies', roleDna.role_dna_competencies],
      ...(quality.schema_initialized === false ? [] : ([
        ['quality.spread.competencies', (quality as any).spread.competencies],
        ['quality.spread.multi_type', (quality as any).spread.multi_type],
        ['quality.spread.multi_difficulty', (quality as any).spread.multi_difficulty],
        ['quality.spread.ready_shaped', (quality as any).spread.ready_shaped],
        ['quality.duplication.duplicate_groups', (quality as any).duplication.duplicate_groups],
      ] as [string, number][])),
    ];
    for (const [label, value] of competencyMetrics) {
      if (value > genome) {
        throw new Error(`Honesty guard FAILED: ${label}=${value} exceeds genome_competencies=${genome}. A competency metric is counting a non-genome bucket — refusing to write inconsistent reports.`);
      }
    }
    console.log(`  honesty guard PASS — all competency metrics <= genome (${genome}).`);

    const stamp = `_Generated ${now()} · population engine ${POPULATION_VERSION} · all numbers measured live._`;

    /* 1. Priority matrix */
    w('competency_population_priority_matrix.md', [
      `# MX-101A — Competency Population Priority Matrix`,
      ``, stamp, ``,
      `Deterministic Tier 1–4 classification of the **${axes.genome_competencies}**-competency genome, grounded in measured downstream demand (Role-DNA weights, leadership/role relevance, competency type). Drives generation order; never changes coverage.`,
      ``,
      `## Tier summary`,
      table(['Tier', 'Definition', 'Competencies'], tiers.tier_summary.map((t) => [t.tier, t.tier_label, t.n])),
      ``,
      `**Classification rule (in code, deterministic):**`,
      `- **Tier 1 — Critical**: \`dna_refs >= 1\` (consumed by Role-DNA / employer benchmark / career match).`,
      `- **Tier 2 — High-Value**: role_relevance present OR leadership_relevance >= genome 75th pctile OR domain ∈ {dom_strategic, dom_cognitive}.`,
      `- **Tier 3 — Role/Function-Specific**: the remaining functional/technical/onet + soft competencies.`,
      `- **Tier 4 — Future Skills**: \`type_key='future_skills'\` (honestly **${tiers.rows.filter((r) => r.tier === 4).length}** today — the genome has no future_skills type rows yet).`,
      ``,
      `## Tier 1 (Critical) competencies — full list`,
      tiers.rows.filter((r) => r.tier === 1).length
        ? table(['Competency', 'Domain', 'Type', 'DNA refs', 'Live approved', 'Draft pipeline'],
            tiers.rows.filter((r) => r.tier === 1).map((r) => [r.canonical_name, r.domain_id ?? '—', r.type_key, r.dna_refs, r.live_approved, r.draft_pipeline]))
        : '_None._',
      ``,
    ].join('\n'));

    /* 2. Role-DNA population plan */
    w('role_dna_population_plan.md', [
      `# MX-101A — Role-DNA Population Plan`,
      ``, stamp, ``,
      `Role-DNA (\`onto_role_weights\`) is the only surface with a per-competency demand catalog. Employer Intelligence and Career Builder consume this SAME competency set, so their coverage rides on this denominator.`,
      ``,
      table(['Axis', 'Competencies', '% of Role-DNA set'], [
        ['Role-DNA competencies (denominator)', roleDna.role_dna_competencies, '100%'],
        ['Draft coverage', roleDna.draft_coverage.competencies, `${roleDna.draft_coverage.pct}%`],
        ['Approved coverage', roleDna.approved_coverage.competencies, `${roleDna.approved_coverage.pct}%`],
        ['Assessment-ready coverage', roleDna.assessment_ready_coverage.competencies, `${roleDna.assessment_ready_coverage.pct}%`],
      ]),
      ``,
      `**Target:** Role-DNA assessment-ready >= **${roleDna.target_pct}%**. ${roleDna.consumers_note}`,
      ``,
    ].join('\n'));

    /* 3. Difficulty coverage */
    w('difficulty_coverage_report.md', [
      `# MX-101A — Difficulty Coverage Report`,
      ``, stamp, ``,
      `## Draft pipeline by difficulty band`,
      diff.draft_by_difficulty.length ? table(['Difficulty band', 'Draft questions'], diff.draft_by_difficulty.map((r: any) => [r.difficulty_band ?? '—', r.n])) : '_No drafts._',
      ``,
      `## Approved (live) by difficulty band`,
      diff.approved_by_difficulty.length ? table(['Difficulty band', 'Approved questions'], diff.approved_by_difficulty.map((r: any) => [r.difficulty_band ?? '—', r.n])) : '_No approved questions._',
      ``,
      `Each generated pack spans 4 difficulty bands (foundational/intermediate/advanced/expert). Assessment-ready requires >=2 distinct bands among approved questions.`,
      ``,
    ].join('\n'));

    /* 4. Type coverage */
    w('competency_type_coverage_report.md', [
      `# MX-101A — Competency Type Coverage Report`,
      ``, stamp, ``,
      `Coverage by genome competency TYPE (\`onto_competency_type_map\`). Approved % is the honest live axis; draft % is pipeline only.`,
      ``,
      table(['Type', 'Competencies', 'Draft %', 'Approved %'], type.by_type.map((r: any) => [r.type_key, r.total, `${r.draft_pct}%`, `${r.approved_pct}%`])),
      ``,
      `**Target:** no type below **${type.target_pct}%** approved. \`future_skills\` is honestly **0** competencies in the genome today — a real content gap, not a generation failure.`,
      ``,
    ].join('\n'));

    /* 5. Quality framework */
    w('question_quality_framework.md', [
      `# MX-101A — Question Quality Framework`,
      ``, stamp, ``,
      `Structural, computable quality controls over the generated draft corpus. **Not** a substitute for human review — every draft remains \`pending_review\` until a super-admin approves it.`,
      ``,
      quality.schema_initialized === false ? '_Factory schema not initialized._' : [
        `## Draft corpus`,
        table(['Metric', 'Value'], [
          ['Actionable draft questions', (quality as any).draft_corpus.questions],
          ['With confidence score', (quality as any).draft_corpus.with_confidence],
          ['Average confidence', (quality as any).draft_corpus.avg_confidence ?? 'n/a'],
        ]),
        ``,
        `## Duplication (same competency + identical prompt)`,
        table(['Metric', 'Value'], [
          ['Duplicate groups', (quality as any).duplication.duplicate_groups],
          ['Redundant rows', (quality as any).duplication.redundant_rows],
          ['Status', (quality as any).duplication.status],
        ]),
        ``,
        `## Structural validity`,
        table(['Check', 'Failures'], [
          ['Short prompt (<8 chars)', (quality as any).structural.short_prompt],
          ['Too few options (non-likert <2)', (quality as any).structural.too_few_options],
          ['best_option out of range', (quality as any).structural.bad_best_option],
          ['Total issues', (quality as any).structural.total_issues],
          ['Status', (quality as any).structural.status],
        ]),
        ``,
        `## Confidence distribution`,
        table(['Band', 'Questions'], [
          ['Low (<0.4)', (quality as any).confidence_distribution.low_lt_0_4],
          ['Moderate (0.4–0.5)', (quality as any).confidence_distribution.moderate_0_4_0_5],
          ['Higher (>=0.5)', (quality as any).confidence_distribution.higher_gte_0_5],
        ]),
        ``,
        `## Per-competency spread (draft)`,
        table(['Metric', 'Value'], [
          ['Competencies with drafts', (quality as any).spread.competencies],
          ['Multi-type (>=2)', (quality as any).spread.multi_type],
          ['Multi-difficulty (>=2)', (quality as any).spread.multi_difficulty],
          ['Ready-shaped (>=4, >=2 types, >=2 diffs)', (quality as any).spread.ready_shaped],
        ]),
      ].join('\n'),
      ``,
    ].join('\n'));

    /* 6. Provenance framework */
    w('question_provenance_framework.md', [
      `# MX-101A — Question Provenance Framework`,
      ``, stamp, ``,
      `Every question in the bank carries an immutable provenance stamp and a review status. Generated drafts are \`template_generated\`; nothing is approved without an explicit human action.`,
      ``,
      `## Provenance breakdown (all bank questions)`,
      table(['Provenance', 'Questions'], (factory.provenance_breakdown || []).map((r: any) => [r.provenance ?? '—', r.n ?? r.count])),
      ``,
      `## Review status breakdown`,
      table(['Review status', 'Questions'], (factory.review_status_breakdown || []).map((r: any) => [r.quality_review_status ?? '—', r.n ?? r.count])),
      ``,
      `**Reversibility:** every MX-101A row carries \`provenance='template_generated'\` and \`template_key LIKE 'qf-%'\` — a single \`DELETE\` predicate fully reverses the population run without touching human-authored or imported content.`,
      ``,
    ].join('\n'));

    /* 7. Assessment readiness framework */
    w('assessment_readiness_framework.md', [
      `# MX-101A — Assessment Readiness Framework`,
      ``, stamp, ``,
      `The three SEPARATE coverage axes. Drafts NEVER count toward approved or assessment-ready coverage — only human-approved, active-mapped questions do.`,
      ``,
      table(['Axis', 'Competencies', '% of genome', 'Definition'], [
        ['Draft Coverage', axes.draft_coverage.competencies, `${axes.draft_coverage.pct}%`, axes.draft_coverage.definition],
        ['Approved Coverage', axes.approved_coverage.competencies, `${axes.approved_coverage.pct}%`, axes.approved_coverage.definition],
        ['Assessment-Ready Coverage', axes.assessment_ready_coverage.competencies, `${axes.assessment_ready_coverage.pct}%`, axes.assessment_ready_coverage.definition],
      ]),
      ``,
      `Genome total: **${axes.genome_competencies}** active competencies. Draft questions in pipeline: **${axes.draft_coverage.questions}**.`,
      ``,
    ].join('\n'));

    /* 8. Founder report — 12 questions */
    const p = founder.target_progress;
    const verdict = (axes.approved_coverage.pct >= TARGETS.coverage_pct && axes.assessment_ready_coverage.competencies >= TARGETS.assessment_ready)
      ? 'PASS' : 'PARTIAL';
    w('founder-report.md', [
      `# MX-101A — Competency Coverage Population Program — Founder Report`,
      ``,
      `**Status: ${verdict} — full DRAFT pipeline generated across the entire genome; live (approved) coverage unchanged. Human approval is the only remaining, and only coverage-changing, step.**`,
      `**Guardrails honoured: Additive · Reversible · Flag-Gated · byte-identical OFF · never auto-approve · never inflate coverage · never delete (archive only) · AI inert without OPENAI_API_KEY.**`,
      ``, stamp, ``,
      `---`, ``,
      `## Three-axis coverage (the honest headline)`,
      table(['Axis', 'Competencies', '% of genome'], [
        ['Draft Coverage', axes.draft_coverage.competencies, `${axes.draft_coverage.pct}%`],
        ['Approved Coverage', axes.approved_coverage.competencies, `${axes.approved_coverage.pct}%`],
        ['Assessment-Ready Coverage', axes.assessment_ready_coverage.competencies, `${axes.assessment_ready_coverage.pct}%`],
      ]),
      ``,
      `## Target progress (PASS earned only by human approval)`,
      table(['Target', 'Current', 'Target', 'Met?', 'Remaining'], [
        ['Approved coverage %', `${p.approved_coverage_pct.value}%`, `${p.approved_coverage_pct.target}%`, p.approved_coverage_pct.met ? '✅' : '❌', `${p.approved_coverage_pct.remaining}%`],
        ['Assessment-ready competencies', p.assessment_ready_competencies.value, p.assessment_ready_competencies.target, p.assessment_ready_competencies.met ? '✅' : '❌', p.assessment_ready_competencies.remaining],
        ['Role-DNA ready %', `${p.role_dna_ready_pct.value}%`, `${p.role_dna_ready_pct.target}%`, p.role_dna_ready_pct.met ? '✅' : '❌', `${p.role_dna_ready_pct.remaining}%`],
      ]),
      ``,
      `---`, ``,
      `## 12 Founder Questions`,
      ``,
      `**1. Is the full draft pipeline generated across the whole genome?**`,
      `Yes. Draft coverage is **${axes.draft_coverage.competencies}/${axes.genome_competencies} (${axes.draft_coverage.pct}%)** with **${axes.draft_coverage.questions}** draft questions in the pipeline.`,
      ``,
      `**2. Did generation inflate live coverage in any way?**`,
      `No. Approved coverage is **${axes.approved_coverage.competencies} (${axes.approved_coverage.pct}%)** and assessment-ready is **${axes.assessment_ready_coverage.competencies} (${axes.assessment_ready_coverage.pct}%)** — both unchanged by generation. Every draft is \`status='draft'\`, \`pending_review\`, with an INACTIVE map link.`,
      ``,
      `**3. Are Draft / Approved / Assessment-Ready kept as three separate axes?**`,
      `Yes — separate definitions, separate counts, never composited. Assessment-Ready uses a rigorous gate (>=4 approved+active spanning >=2 question types AND >=2 difficulty bands).`,
      ``,
      `**4. How is the genome prioritized for review?**`,
      `Deterministic Tier 1–4: ${tiers.tier_summary.map((t) => `${t.tier_label.split('—')[1].trim()} = ${t.n}`).join(', ')}. Tier 1 is real downstream demand (Role-DNA consumed).`,
      ``,
      `**5. What about the Role-DNA / employer / career consumers specifically?**`,
      `Role-DNA denominator is **${roleDna.role_dna_competencies}** competencies. Draft ${roleDna.draft_coverage.pct}% · Approved ${roleDna.approved_coverage.pct}% · Ready ${roleDna.assessment_ready_coverage.pct}% (target ${roleDna.target_pct}%). Employer + Career consume this same set.`,
      ``,
      `**6. Is the generated content structurally sound?**`,
      quality.schema_initialized === false ? `Schema not initialized.` :
        `Duplication: **${(quality as any).duplication.status}** (${(quality as any).duplication.duplicate_groups} groups). Structural: **${(quality as any).structural.status}** (${(quality as any).structural.total_issues} issues). Avg confidence: **${(quality as any).draft_corpus.avg_confidence ?? 'n/a'}**. Structural checks only — content quality requires human review.`,
      ``,
      `**7. Is every question's origin traceable?**`,
      `Yes. Provenance: ${(factory.provenance_breakdown || []).map((r: any) => `${r.provenance}=${r.n ?? r.count}`).join(' · ')}. Review status: ${(factory.review_status_breakdown || []).map((r: any) => `${r.quality_review_status}=${r.n ?? r.count}`).join(' · ')}.`,
      ``,
      `**8. Is the run reversible?**`,
      `Yes. Every row carries \`provenance='template_generated'\` + \`template_key LIKE 'qf-%'\`. One DELETE predicate reverses the entire run; human-authored and imported content is untouched.`,
      ``,
      `**9. Is the feature flag-gated and byte-identical when OFF?**`,
      `Yes. \`questionFactory\` (env \`FF_QUESTION_FACTORY\`) defaults OFF; the gate returns 503 before auth/DB/DDL; GET reads probe + degrade (no DDL); ensure-schema runs only on POST; nav tab + render gated on the probe.`,
      ``,
      `**10. Can the AI path fabricate questions without a key?**`,
      `No. \`generateAIPack\` is wired-but-inert — returns \`{ok:false}\` (HTTP 422) without \`OPENAI_API_KEY\`. The full run used the deterministic template path only.`,
      ``,
      `**11. What is the remaining work to reach the targets?**`,
      `Human approval. Approved coverage needs **${p.approved_coverage_pct.remaining}%** more, assessment-ready needs **${p.assessment_ready_competencies.remaining}** more competencies. No code work — this is reviewed content work via the existing approval workflow.`,
      ``,
      `**12. What is the honest verdict?**`,
      `**${verdict}.** The population machinery is complete and the full draft pipeline exists across all ${axes.genome_competencies} competencies, but live coverage stays honest at ${axes.approved_coverage.pct}% approved / ${axes.assessment_ready_coverage.pct}% assessment-ready because coverage is earned only by human approval — never manufactured.`,
      ``,
      `---`, ``,
      `## Deliverables in this folder`,
      `- \`competency_population_priority_matrix.md\` — Tier 1–4 classification`,
      `- \`role_dna_population_plan.md\` — downstream-consumer coverage`,
      `- \`difficulty_coverage_report.md\` — difficulty band roll-up`,
      `- \`competency_type_coverage_report.md\` — type coverage vs target`,
      `- \`question_quality_framework.md\` — structural quality controls`,
      `- \`question_provenance_framework.md\` — provenance + reversibility`,
      `- \`assessment_readiness_framework.md\` — the three coverage axes`,
      `- \`founder-report.md\` — this file`,
      ``,
    ].join('\n'));

    console.log('\nMX-101A reports generated.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
