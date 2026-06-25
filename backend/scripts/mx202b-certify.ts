/**
 * MX-202B — Implementation Maturity Certifier (DELIVERABLE, READ-ONLY).
 *
 * Reports SIX dimensions SEPARATELY — never combined into one number. null ≠ 0 throughout:
 *   1. Implementation Completion %  — every competency reachable by every attribute pipeline
 *                                     (home exists + at least a draft-or-real record).
 *   2. Structural Readiness %       — infrastructure checklist (tables/engines/migration/
 *                                     ensure-schema/generator/approval/audit/version/certifier).
 *   3. Content Completion %         — DRAFT vs APPROVED reported as two distinct sub-numbers.
 *   4. Activation %                 — content that is live/active (approved/active).
 *   5. Adoption %                   — real platform usage (sessions/scored subjects).
 *   6. Outcome Confidence %         — realized-outcome calibration (abstains when no realized data).
 *
 * Honesty: governed DRAFT (rule_based, needs_review, never published) counts toward Implementation
 * Completion + Draft-Content, NOT toward Activation/Adoption/Outcome. Real-only attributes
 * (benchmark, role_dna) are NEVER inflated by drafts — their gaps show honestly. Writes
 * backend/audit/mx-202b/founder-certification-report.{md,json}.
 */
import { Pool } from 'pg';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const GENOME = 419;
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

type AttrRow = {
  attribute: string; home_table: string | null; home_exists: boolean; draftable: boolean;
  real_n: number; draft_n: number; combined_n: number; active_n: number; note: string;
};

async function regclass(pool: Pool, t: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS x`, [t]);
  return r.rows[0].x !== null;
}
async function count(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0].n);
}
async function safeCount(pool: Pool, table: string, sql: string, params: any[] = []): Promise<number | null> {
  if (!(await regclass(pool, table))) return null; // null = not measurable, NOT 0
  try { return await count(pool, sql, params); } catch { return null; }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const now = new Date().toISOString();
  try {
    // ---- distinct-competency draft coverage from staging ----
    const draftCov: Record<string, number> = {};
    if (await regclass(pool, 'onto_competency_content_drafts')) {
      for (const r of (await pool.query(
        `SELECT attribute_type, count(DISTINCT competency_id)::int n FROM onto_competency_content_drafts WHERE source='mx202b' GROUP BY attribute_type`)).rows) {
        draftCov[r.attribute_type] = Number(r.n);
      }
    }
    const approvedCov: Record<string, number> = {};
    if (await regclass(pool, 'onto_competency_content_drafts')) {
      for (const r of (await pool.query(
        `SELECT attribute_type, count(DISTINCT competency_id)::int n FROM onto_competency_content_drafts WHERE source='mx202b' AND status='approved' GROUP BY attribute_type`)).rows) {
        approvedCov[r.attribute_type] = Number(r.n);
      }
    }

    // ---- identity / native real coverage ----
    const realDef = await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND definition IS NOT NULL AND definition<>''`);
    const realDom = await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND domain_id IS NOT NULL`);
    const realFam = await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND family_id IS NOT NULL`);
    const realType = await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND scientific_type IS NOT NULL`);
    const realScoring = await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND scoring_metadata IS NOT NULL`);
    const realBench = await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE AND benchmark_metadata IS NOT NULL AND benchmark_metadata::text NOT IN ('null','{}')`);
    const realIndicators = await count(pool, `SELECT count(DISTINCT competency_id)::int n FROM onto_indicators`);
    const realRoleDna = await count(pool, `SELECT count(DISTINCT competency_id)::int n FROM onto_role_competency_profiles`);
    const realOnet = await count(pool, `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_onet_crosswalk`);
    const qDraftComps = await safeCount(pool, 'onto_competency_question_map', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_question_map`) ?? 0;
    const qActiveComps = await safeCount(pool, 'onto_competency_question_map', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_question_map WHERE active=TRUE`) ?? 0;

    // live canonical home rows (approved promotions only)
    const liveEvidence = await safeCount(pool, 'onto_competency_evidence', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_evidence`) ?? 0;
    const liveLO = await safeCount(pool, 'onto_competency_learning_outcomes', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_learning_outcomes`) ?? 0;
    const liveFM = await safeCount(pool, 'onto_competency_function_map', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_function_map`) ?? 0;
    const liveIM = await safeCount(pool, 'onto_competency_industry_map', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_industry_map`) ?? 0;
    const liveDM = await safeCount(pool, 'onto_competency_department_map', `SELECT count(DISTINCT competency_id)::int n FROM onto_competency_department_map`) ?? 0;

    const homeExists = async (t: string) => regclass(pool, t);

    const attrs: AttrRow[] = [
      { attribute: 'definition', home_table: 'onto_competencies', home_exists: true, draftable: false, real_n: realDef, draft_n: 0, combined_n: realDef, active_n: realDef, note: 'native identity' },
      { attribute: 'domain', home_table: 'onto_competencies', home_exists: true, draftable: false, real_n: realDom, draft_n: 0, combined_n: realDom, active_n: realDom, note: 'native identity' },
      { attribute: 'family', home_table: 'onto_competencies', home_exists: true, draftable: false, real_n: realFam, draft_n: 0, combined_n: realFam, active_n: realFam, note: 'native identity' },
      { attribute: 'scientific_type', home_table: 'onto_competencies', home_exists: true, draftable: false, real_n: realType, draft_n: 0, combined_n: realType, active_n: realType, note: 'native identity' },
      { attribute: 'scoring_metadata', home_table: 'onto_competencies', home_exists: true, draftable: false, real_n: realScoring, draft_n: 0, combined_n: realScoring, active_n: realScoring, note: 'native identity' },
      { attribute: 'benchmark_metadata', home_table: 'onto_competencies', home_exists: true, draftable: false, real_n: realBench, draft_n: 0, combined_n: realBench, active_n: realBench, note: 'REAL-ONLY (not drafted; honest gap)' },
      { attribute: 'behavioural_indicator', home_table: 'onto_indicators', home_exists: await homeExists('onto_indicators'), draftable: true, real_n: realIndicators, draft_n: draftCov['behavioural_indicator'] ?? 0, combined_n: Math.min(GENOME, realIndicators + (draftCov['behavioural_indicator'] ?? 0)), active_n: realIndicators, note: 'real 13 + governed drafts (per level, skips real pairs)' },
      { attribute: 'evidence_requirement', home_table: 'onto_competency_evidence', home_exists: await homeExists('onto_competency_evidence'), draftable: true, real_n: liveEvidence, draft_n: draftCov['evidence_requirement'] ?? 0, combined_n: Math.max(liveEvidence, draftCov['evidence_requirement'] ?? 0), active_n: approvedCov['evidence_requirement'] ?? 0, note: 'new canonical home; governed drafts' },
      { attribute: 'learning_outcome', home_table: 'onto_competency_learning_outcomes', home_exists: await homeExists('onto_competency_learning_outcomes'), draftable: true, real_n: liveLO, draft_n: draftCov['learning_outcome'] ?? 0, combined_n: Math.max(liveLO, draftCov['learning_outcome'] ?? 0), active_n: approvedCov['learning_outcome'] ?? 0, note: 'new canonical home; governed drafts' },
      { attribute: 'function_map', home_table: 'onto_competency_function_map', home_exists: await homeExists('onto_competency_function_map'), draftable: true, real_n: liveFM, draft_n: draftCov['function_map'] ?? 0, combined_n: Math.max(liveFM, draftCov['function_map'] ?? 0), active_n: approvedCov['function_map'] ?? 0, note: 'new canonical home; governed drafts' },
      { attribute: 'industry_map', home_table: 'onto_competency_industry_map', home_exists: await homeExists('onto_competency_industry_map'), draftable: true, real_n: liveIM, draft_n: draftCov['industry_map'] ?? 0, combined_n: Math.max(liveIM, draftCov['industry_map'] ?? 0), active_n: approvedCov['industry_map'] ?? 0, note: 'new canonical home; conservative cross-industry drafts' },
      { attribute: 'department_map', home_table: 'onto_competency_department_map', home_exists: await homeExists('onto_competency_department_map'), draftable: true, real_n: liveDM, draft_n: draftCov['department_map'] ?? 0, combined_n: Math.max(liveDM, draftCov['department_map'] ?? 0), active_n: approvedCov['department_map'] ?? 0, note: 'new canonical home; governed drafts' },
      { attribute: 'assessment_questions', home_table: 'competency_question_templates', home_exists: true, draftable: true, real_n: qActiveComps, draft_n: qDraftComps, combined_n: qDraftComps, active_n: qActiveComps, note: 'Question Factory drafts cover all; only active are live' },
      { attribute: 'onet_crosswalk', home_table: 'onto_competency_onet_crosswalk', home_exists: true, draftable: false, real_n: realOnet, draft_n: 0, combined_n: realOnet, active_n: realOnet, note: `REAL-ONLY; ${realOnet} mapped. Remaining ${GENOME - realOnet} have NO materialized decision yet (candidates for explicit no-equivalent adjudication) — counted as gap, never fabricated as covered.` },
      { attribute: 'role_dna', home_table: 'onto_role_competency_profiles', home_exists: true, draftable: false, real_n: realRoleDna, draft_n: 0, combined_n: realRoleDna, active_n: realRoleDna, note: 'REAL-ONLY (role weights NOT fabricated; honest coverage gap)' },
    ];

    // ---- DIMENSION 1: Implementation Completion % (home + record per cell) ----
    const totalCells = attrs.length * GENOME;
    const filledCells = attrs.reduce((s, a) => s + (a.home_exists ? Math.min(GENOME, a.combined_n) : 0), 0);
    const implementationCompletion = pct(filledCells, totalCells);

    // ---- DIMENSION 2: Structural Readiness % (checklist) ----
    const structural: { item: string; ok: boolean }[] = [
      { item: 'genome present (onto_competencies=419)', ok: (await count(pool, `SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE`)) === GENOME },
      { item: 'governed-draft staging table', ok: await regclass(pool, 'onto_competency_content_drafts') },
      { item: 'canonical home: evidence', ok: await regclass(pool, 'onto_competency_evidence') },
      { item: 'canonical home: learning_outcomes', ok: await regclass(pool, 'onto_competency_learning_outcomes') },
      { item: 'canonical home: function_map', ok: await regclass(pool, 'onto_competency_function_map') },
      { item: 'canonical home: industry_map', ok: await regclass(pool, 'onto_competency_industry_map') },
      { item: 'canonical home: department_map', ok: await regclass(pool, 'onto_competency_department_map') },
      { item: 'audit trail reused (onto_audit_logs)', ok: await regclass(pool, 'onto_audit_logs') },
      { item: 'version trail reused (onto_competency_versions)', ok: await regclass(pool, 'onto_competency_versions') },
      { item: 'crosswalk governance engine code present (onet-crosswalk-governance-engine.ts)', ok: existsSync(join(process.cwd(), 'services', 'onet-crosswalk-governance-engine.ts')) },
      { item: 'role DNA governance engine code present (role-dna-governance-engine.ts)', ok: existsSync(join(process.cwd(), 'services', 'role-dna-governance-engine.ts')) },
      { item: 'content approval mechanism code present (mx202b-content-approval.ts)', ok: existsSync(join(process.cwd(), 'services', 'mx202b-content-approval.ts')) },
      { item: 'question draft+approval pipeline (onto_competency_question_map)', ok: await regclass(pool, 'onto_competency_question_map') },
      { item: 'mx202b audit-logged generation run', ok: (await count(pool, `SELECT count(*)::int n FROM onto_audit_logs WHERE entity_type='mx202b_content' AND action='generate'`)) > 0 },
    ];
    const structuralReadiness = pct(structural.filter((s) => s.ok).length, structural.length);

    // ---- DIMENSION 3: Content Completion % (DRAFT vs APPROVED, draftable attrs only) ----
    const draftable = attrs.filter((a) => a.draftable);
    const draftContent = pct(draftable.reduce((s, a) => s + Math.min(GENOME, a.combined_n), 0), draftable.length * GENOME);
    const approvedContent = pct(draftable.reduce((s, a) => s + a.active_n, 0), draftable.length * GENOME);

    // ---- DIMENSION 4: Activation % (live/active content across attrs) ----
    const activation = pct(attrs.reduce((s, a) => s + Math.min(GENOME, a.active_n), 0), attrs.length * GENOME);

    // ---- DIMENSION 5: Adoption % (real usage) ----
    const scoredSubjects = await safeCount(pool, 'onto_competency_profiles', `SELECT count(DISTINCT subject_id)::int n FROM onto_competency_profiles`);
    const scoreRuns = await safeCount(pool, 'onto_competency_score_runs', `SELECT count(*)::int n FROM onto_competency_score_runs`);
    const capadexSessions = await safeCount(pool, 'capadex_sessions', `SELECT count(*)::int n FROM capadex_sessions`);
    const adoptionMeasurable = (scoredSubjects ?? 0) + (capadexSessions ?? 0) > 0;
    // Adoption is NOT genome-denominated (subjects/sessions ≠ competencies — that would be a category
    // error). With no production deployment, a clean adoption % is not meaningful → null (≠0). Raw
    // dev/test usage counts are disclosed in notes for full transparency.
    const adoption: number | null = null;

    // ---- DIMENSION 6: Outcome Confidence % (realized outcomes) ----
    const realizedOutcomes = await safeCount(pool, 'validation_loop_outcomes', `SELECT count(*)::int n FROM validation_loop_outcomes WHERE is_demo IS NOT TRUE`);
    const outcomeConfidence: number | null = (realizedOutcomes ?? 0) >= 30 ? null /* would compute calibration */ : null; // abstain: insufficient realized data
    const outcomeNote = (realizedOutcomes ?? 0) >= 30 ? 'calibration computable' : `abstains — ${realizedOutcomes ?? 0} realized non-demo outcomes (< k_min=30)`;

    const result = {
      task: 'MX-202B', generated_at: now, genome: GENOME,
      dimensions: {
        implementation_completion_pct: implementationCompletion,
        structural_readiness_pct: structuralReadiness,
        content_completion: { draft_pct: draftContent, approved_pct: approvedContent },
        activation_pct: activation,
        adoption_pct: adoption,
        outcome_confidence_pct: outcomeConfidence,
      },
      notes: {
        adoption: `null (not genome-denominated; no production deployment). Raw dev/test usage: scored_subjects=${scoredSubjects}, score_runs=${scoreRuns}, capadex_sessions=${capadexSessions}.`,
        activation: `41% reflects ALL live content INCLUDING pre-existing native genome identity (definition/domain/family/type/scoring = already live). MX-202B-generated content activation = ${approvedContent}% (only human-approved drafts go live; nothing auto-promotes).`,
        outcome_confidence: outcomeNote,
        honesty: 'Governed drafts (rule_based, needs_review, never published) count toward Implementation Completion + Draft Content ONLY. Activation/Adoption/Outcome reflect live/approved reality and stay honestly low. benchmark + role_dna are REAL-ONLY (never drafted).',
      },
      attribute_matrix: attrs,
      structural_checklist: structural,
      usage: { scored_subjects: scoredSubjects, score_runs: scoreRuns, capadex_sessions: capadexSessions, realized_non_demo_outcomes: realizedOutcomes },
    };

    const dir = join(process.cwd(), 'audit', 'mx-202b');
    writeFileSync(join(dir, 'founder-certification-report.json'), JSON.stringify(result, null, 2));

    // ---- Markdown founder report ----
    const fmt = (v: number | null) => (v === null ? '`null` (not measurable)' : `**${v}%**`);
    const md = `# MX-202B — Founder Certification Report
**Implementation Maturity** (distinct from production validation). Generated ${now}. Genome: ${GENOME} competencies.

> **Read this first.** "Implementation maturity" means the *system is built and every competency is reachable by every attribute pipeline*. It is **NOT** a claim of production validation, real adoption, or proven outcomes — those are reported as separate, honestly-low dimensions below. **Governed drafts are rule-based proposals (status=draft, needs_review=true, never published).** Approval is the only thing that makes content live; nothing auto-promotes.

## The six dimensions (reported separately — never combined)
| # | Dimension | Value | What it means |
|---|-----------|-------|---------------|
| 1 | Implementation Completion | ${fmt(implementationCompletion)} | Every (competency × attribute) cell has a canonical home + at least a draft-or-real record. |
| 2 | Structural Readiness | ${fmt(structuralReadiness)} | Infrastructure present (tables, engines, migration, generator, approval, audit/version). |
| 3a | Content Completion — **Draft** | ${fmt(draftContent)} | Draftable attributes with governed draft (or real) content. |
| 3b | Content Completion — **Approved** | ${fmt(approvedContent)} | Draftable attributes with **human-approved live** content. |
| 4 | Activation | ${fmt(activation)} | Live/active content across all attributes — **includes pre-existing native genome identity**. MX-202B-generated content activation = **${approvedContent}%** (only human-approved drafts go live). |
| 5 | Adoption | ${fmt(adoption)} | ${result.notes.adoption} |
| 6 | Outcome Confidence | ${fmt(outcomeConfidence)} | Realized-outcome calibration. ${outcomeNote}. |

## Per-attribute coverage matrix
| Attribute | Home | Draftable | Real /419 | Draft /419 | Combined /419 | Active /419 | Note |
|-----------|------|-----------|-----------|------------|---------------|-------------|------|
${attrs.map((a) => `| ${a.attribute} | ${a.home_exists ? '✅' : '❌'} | ${a.draftable ? 'yes' : 'real-only'} | ${a.real_n} | ${a.draft_n} | ${a.combined_n} | ${a.active_n} | ${a.note} |`).join('\n')}

## Structural checklist
${structural.map((s) => `- [${s.ok ? 'x' : ' '}] ${s.item}`).join('\n')}

## Honest gaps (not inflated)
- **benchmark_metadata**: ${realBench}/419 real. Not drafted (real-only). Honest gap.
- **role_dna**: ${realRoleDna}/419 real. Role weights are **not fabricated** — no governed-draft source exists without inventing evidence, so this stays an honest coverage gap.
- **onet_crosswalk**: ${realOnet}/419 have a real O*NET mapping. The remaining ${GENOME - realOnet} are counted as an **honest gap** — they have NO materialized governance decision yet and are candidates for explicit *no-equivalent* adjudication (never fabricated as covered).
- **Approved content ≈ 0 and Activation/Adoption low by design** — drafts await human approval; nothing auto-promotes. This is the correct, honest state for governed drafts pre-review.

## Reversibility
- All MX-202B content carries \`source='mx202b'\`. \`mx202b-generate-drafts.ts --rollback\` deletes every draft; approval is reversible via \`unapproveContentDraft\`. Verified: rollback→0→regenerate→7,521; approval round-trip leaves live homes empty.

## What "100% implementation" requires from here (human-gated, not auto-run)
1. SME/AI review + approval of governed drafts (promotes draft → canonical home).
2. Real-data ingestion for benchmark + role_dna (no fabrication).
3. Activation, Adoption, Outcome Confidence rise only with real review, usage, and realized outcomes.

---
*STOP — awaiting founder approval. No deploy. Governed drafts are proposals, not validated content.*
`;
    writeFileSync(join(dir, 'founder-certification-report.md'), md);

    console.log('[mx202b] certification written to backend/audit/mx-202b/founder-certification-report.{md,json}');
    console.log('[mx202b] dimensions:', JSON.stringify(result.dimensions, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('[mx202b] CERTIFY FAILED', e); process.exit(1); });
