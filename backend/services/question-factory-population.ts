/**
 * MX-101A — Competency Coverage Population Program.
 *
 * An ADDITIVE, REVERSIBLE layer ON TOP of the MX-101X Question Factory. It does NOT
 * introduce a new approval path, never auto-approves, and never inflates live coverage.
 * It adds:
 *   - a deterministic PRIORITIZATION of the 419-competency genome (Tier 1–4) grounded
 *     in real downstream demand (Role-DNA weights, leadership/role relevance, type),
 *   - a BULK generation orchestrator that drives the existing generateDraftPack across
 *     prioritized gaps (DRAFT-only, idempotent/resumable — never duplicates),
 *   - THREE strictly-separated coverage axes: Draft / Approved / Assessment-Ready,
 *   - Role-DNA / downstream-consumer coverage,
 *   - structural QUALITY controls over the generated drafts,
 *   - difficulty / type / provenance roll-ups and a Founder dashboard composer.
 *
 * Honesty contract (founder guardrails, identical to MX-101X):
 *   - Coverage ≠ Approval. Draft ≠ Assessment-Ready. ONLY approved+active questions count.
 *   - Generation lands draft + pending_review + inactive map link; human approval is the
 *     ONLY coverage-changing op (lives in question-factory.ts reviewQuestion).
 *   - GET composers are read-only: they probe with isFactorySchemaReady (NO DDL) and
 *     degrade to honest-empty before the first flag-ON POST has created the columns/ledger.
 */
import type { Pool } from 'pg';
import { generateDraftPack, isFactorySchemaReady } from './question-factory';

export const POPULATION_VERSION = 'mx101a-1.0.0';

// Founder PASS targets (live, human-earned — reported as progress, never auto-satisfied).
export const TARGETS = {
  coverage_pct: 80, // Approved coverage >= 80% of genome
  assessment_ready: 350, // assessment-ready competencies >= 350
  role_dna_pct: 95, // Role-DNA competencies assessment-ready >= 95%
} as const;

// A full default pack = 6 questions spanning 3 question types and 4 difficulty bands.
const PACK_SIZE = 6;
const ACTIONABLE = `('pending_review','in_review','needs_revision')`;

const num = (v: any) => Number(v ?? 0) || 0;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export type TierRow = {
  id: string;
  canonical_name: string;
  domain_id: string | null;
  type_key: string;
  tier: 1 | 2 | 3 | 4;
  tier_label: string;
  dna_refs: number;
  leadership_relevance: number;
  rr_present: boolean;
  live_approved: number;
  draft_pipeline: number;
};

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — Critical (Role-DNA / benchmark consumed)',
  2: 'Tier 2 — High-Value (leadership / strategic / cross-role)',
  3: 'Tier 3 — Role / Function-Specific',
  4: 'Tier 4 — Future Skills',
};

/**
 * Deterministic Tier 1–4 classification of the live genome, grounded in measured demand.
 * Read-only. draft_pipeline degrades to 0 before the factory schema exists (no DDL).
 */
export async function computePriorityTiers(pool: Pool): Promise<{ ok: true; rows: TierRow[]; tier_summary: Array<{ tier: number; tier_label: string; n: number }> }> {
  const ready = await isFactorySchemaReady(pool);
  const draftExpr = ready
    ? `COALESCE((SELECT COUNT(*)::int FROM onto_competency_question_map m
         JOIN competency_question_templates t ON t.id=m.question_id
         WHERE m.competency_id=c.id AND t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}), 0)`
    : `0`;

  const rs = await pool.query(`
    WITH demand AS (
      SELECT competency_id, COUNT(*)::int dna_refs
      FROM onto_role_weights GROUP BY competency_id
    )
    SELECT c.id, c.canonical_name, c.domain_id,
      COALESCE(tm.type_key, 'unclassified') AS type_key,
      COALESCE(c.leadership_relevance, 0)::float AS leadership_relevance,
      (c.role_relevance IS NOT NULL AND c.role_relevance::text NOT IN ('null','{}','[]')) AS rr_present,
      COALESCE(d.dna_refs, 0)::int AS dna_refs,
      COALESCE((SELECT COUNT(*)::int FROM onto_competency_question_map m
         JOIN competency_question_templates t ON t.id=m.question_id
         WHERE m.competency_id=c.id AND m.active AND t.status='approved'), 0) AS live_approved,
      ${draftExpr} AS draft_pipeline
    FROM onto_competencies c
    LEFT JOIN onto_competency_type_map tm ON tm.competency_id = c.id
    LEFT JOIN demand d ON d.competency_id = c.id
    WHERE c.deprecated IS NOT TRUE
    ORDER BY c.canonical_name ASC`);

  // 75th percentile of leadership_relevance across the genome → deterministic high-value cutoff.
  const lrs = rs.rows.map((r: any) => num(r.leadership_relevance)).sort((a, b) => a - b);
  const lr75 = lrs.length ? lrs[Math.min(lrs.length - 1, Math.floor(lrs.length * 0.75))] : 0;

  const rows: TierRow[] = rs.rows.map((r: any) => {
    const type_key = String(r.type_key);
    const dna_refs = num(r.dna_refs);
    const lr = num(r.leadership_relevance);
    const rr = Boolean(r.rr_present);
    const domain = r.domain_id ? String(r.domain_id) : null;
    let tier: 1 | 2 | 3 | 4;
    if (type_key === 'future_skills') tier = 4; // explicit Future-Skills (honestly ~0 in genome today)
    else if (dna_refs >= 1) tier = 1; // hard downstream-consumption signal
    else if (rr || lr >= lr75 || domain === 'dom_strategic' || domain === 'dom_cognitive') tier = 2;
    else tier = 3; // role/function-specific + remaining soft skills
    return {
      id: String(r.id), canonical_name: String(r.canonical_name), domain_id: domain, type_key,
      tier, tier_label: TIER_LABELS[tier], dna_refs, leadership_relevance: lr, rr_present: rr,
      live_approved: num(r.live_approved), draft_pipeline: num(r.draft_pipeline),
    };
  });

  const tier_summary = [1, 2, 3, 4].map((t) => ({ tier: t, tier_label: TIER_LABELS[t], n: rows.filter((r) => r.tier === t).length }));
  return { ok: true, rows, tier_summary };
}

export type BulkOptions = { tier?: number; gapOnly?: boolean; limit?: number; dryRun?: boolean; createdBy?: string | null };

/**
 * Bulk-drive generateDraftPack across prioritized genome competencies. DRAFT-only; the existing
 * generator stamps provenance/confidence/pending_review and creates INACTIVE map links, so this
 * NEVER changes live coverage. Idempotent/resumable: competencies that already hold a full
 * actionable draft pack (>=PACK_SIZE) are SKIPPED so re-runs never duplicate questions.
 */
export async function generateBulkPopulation(pool: Pool, opts: BulkOptions) {
  const { rows } = await computePriorityTiers(pool);
  let targets = rows;
  if (opts.tier) targets = targets.filter((r) => r.tier === opts.tier);
  if (opts.gapOnly) targets = targets.filter((r) => r.live_approved < 4);
  // Resumable: skip anything already carrying a complete actionable draft pack.
  targets = targets.filter((r) => r.draft_pipeline < PACK_SIZE);
  targets.sort((a, b) => a.tier - b.tier || b.dna_refs - a.dna_refs || a.canonical_name.localeCompare(b.canonical_name));
  if (opts.limit && opts.limit > 0) targets = targets.slice(0, opts.limit);

  if (opts.dryRun) {
    return { ok: true as const, dry_run: true, version: POPULATION_VERSION, targeted_competencies: targets.length, would_generate: targets.length * PACK_SIZE };
  }

  let competencies_generated = 0;
  let questions_generated = 0;
  const errors: Array<{ competency_id: string; error: string }> = [];
  for (const t of targets) {
    const out = await generateDraftPack(pool, { competencyId: t.id, createdBy: opts.createdBy ?? null });
    if (out.ok) { competencies_generated += 1; questions_generated += out.generated; }
    else errors.push({ competency_id: t.id, error: out.error || 'unknown' });
  }
  return {
    ok: true as const, dry_run: false, version: POPULATION_VERSION,
    targeted_competencies: targets.length, competencies_generated, questions_generated, errors,
  };
}

/* --------------------------- three coverage axes --------------------------- */
/**
 * THREE strictly-separated axes (Coverage ≠ Approval ≠ Assessment-Ready):
 *   - Draft Coverage:      >=1 ACTIONABLE draft mapped question.
 *   - Approved Coverage:   >=1 approved + active mapped question.
 *   - Assessment-Ready:    >=4 approved+active spanning >=2 question types AND >=2 difficulty bands
 *                          (multi-type + multi-difficulty + approved — the rigorous readiness gate).
 * Read-only; draft axis degrades to 0 before the factory schema exists.
 */
export async function getThreeAxisCoverage(pool: Pool) {
  const ready = await isFactorySchemaReady(pool);
  const total = num((await pool.query(`SELECT COUNT(*)::int c FROM onto_competencies WHERE deprecated IS NOT TRUE`)).rows[0]?.c);

  const appr = await pool.query<{ approved_comps: number; ready_comps: number }>(`
    WITH per AS (
      SELECT m.competency_id, COUNT(*)::int n,
             COUNT(DISTINCT t.question_type)::int types, COUNT(DISTINCT t.difficulty_band)::int diffs
      FROM onto_competency_question_map m
      JOIN competency_question_templates t ON t.id = m.question_id
      WHERE m.active AND t.status='approved'
      GROUP BY m.competency_id
    )
    SELECT COUNT(*) FILTER (WHERE n>=1)::int AS approved_comps,
           COUNT(*) FILTER (WHERE n>=4 AND types>=2 AND diffs>=2)::int AS ready_comps
    FROM per`);
  const approved_comps = num(appr.rows[0]?.approved_comps);
  const ready_comps = num(appr.rows[0]?.ready_comps);

  let draft_comps = 0;
  let draft_questions = 0;
  let draftByType: any[] = [];
  let draftByDifficulty: any[] = [];
  if (ready) {
    draft_comps = num((await pool.query(`
      SELECT COUNT(DISTINCT m.competency_id)::int c
      FROM onto_competency_question_map m JOIN competency_question_templates t ON t.id=m.question_id
      WHERE t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}`)).rows[0]?.c);
    draft_questions = num((await pool.query(`
      SELECT COUNT(*)::int c FROM competency_question_templates
      WHERE status='draft' AND quality_review_status IN ${ACTIONABLE}`)).rows[0]?.c);
    draftByType = (await pool.query(`
      SELECT question_type, COUNT(*)::int n FROM competency_question_templates
      WHERE status='draft' AND quality_review_status IN ${ACTIONABLE} GROUP BY 1 ORDER BY 2 DESC`)).rows;
    draftByDifficulty = (await pool.query(`
      SELECT difficulty_band, COUNT(*)::int n FROM competency_question_templates
      WHERE status='draft' AND quality_review_status IN ${ACTIONABLE} GROUP BY 1 ORDER BY 2 DESC`)).rows;
  }

  return {
    ok: true, version: POPULATION_VERSION, schema_initialized: ready, genome_competencies: total,
    draft_coverage: {
      competencies: draft_comps, pct: pct(draft_comps, total), questions: draft_questions,
      by_type: draftByType, by_difficulty: draftByDifficulty,
      definition: 'Competencies with >=1 actionable (pending/in_review/needs_revision) DRAFT mapped question. Drafts NEVER count toward approved or assessment-ready coverage.',
    },
    approved_coverage: {
      competencies: approved_comps, pct: pct(approved_comps, total),
      definition: 'Competencies with >=1 approved + active-mapped question.',
    },
    assessment_ready_coverage: {
      competencies: ready_comps, pct: pct(ready_comps, total),
      definition: 'Competencies with >=4 approved+active questions spanning >=2 question types AND >=2 difficulty bands. ONLY approved questions contribute.',
    },
  };
}

/* ----------------------- Role-DNA / consumer coverage ---------------------- */
/**
 * Coverage over competencies that downstream products actually CONSUME. Role-DNA is the only
 * surface with a per-competency demand catalog (onto_role_weights); Employer Intelligence and
 * Career Builder consume that SAME Role-DNA competency set (no distinct competency catalog of
 * their own), so their coverage rides on the Role-DNA denominator — reported honestly as such.
 */
export async function getRoleDnaCoverage(pool: Pool) {
  const ready = await isFactorySchemaReady(pool);
  const r = await pool.query<{ total: number; approved: number; ready: number; draft: number }>(`
    WITH dna AS (SELECT DISTINCT competency_id FROM onto_role_weights),
    appr AS (
      SELECT m.competency_id, COUNT(*)::int n,
             COUNT(DISTINCT t.question_type)::int types, COUNT(DISTINCT t.difficulty_band)::int diffs
      FROM onto_competency_question_map m JOIN competency_question_templates t ON t.id=m.question_id
      WHERE m.active AND t.status='approved' GROUP BY m.competency_id
    ),
    drf AS (
      SELECT DISTINCT m.competency_id
      FROM onto_competency_question_map m JOIN competency_question_templates t ON t.id=m.question_id
      WHERE t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}
    )
    SELECT
      (SELECT COUNT(*)::int FROM dna) AS total,
      (SELECT COUNT(*)::int FROM dna d JOIN appr a ON a.competency_id=d.competency_id WHERE a.n>=1) AS approved,
      (SELECT COUNT(*)::int FROM dna d JOIN appr a ON a.competency_id=d.competency_id WHERE a.n>=4 AND a.types>=2 AND a.diffs>=2) AS ready,
      (SELECT COUNT(*)::int FROM dna d JOIN drf x ON x.competency_id=d.competency_id) AS draft
  `);
  const total = num(r.rows[0]?.total);
  const approved = num(r.rows[0]?.approved);
  const readyN = num(r.rows[0]?.ready);
  const draft = ready ? num(r.rows[0]?.draft) : 0;
  return {
    ok: true, version: POPULATION_VERSION, schema_initialized: ready,
    role_dna_competencies: total,
    draft_coverage: { competencies: draft, pct: pct(draft, total) },
    approved_coverage: { competencies: approved, pct: pct(approved, total) },
    assessment_ready_coverage: { competencies: readyN, pct: pct(readyN, total) },
    target_pct: TARGETS.role_dna_pct,
    consumers_note: 'Employer Intelligence (computeCompetencyDrivenMatch) and Career Builder consume this same Role-DNA competency set; they have no separate per-competency catalog, so their coverage equals Role-DNA coverage.',
  };
}

/* ------------------------------ quality controls --------------------------- */
/**
 * Structural quality controls over the generated draft corpus. These are honest, computable
 * checks (NOT a substitute for human review): exact-duplicate detection, structural validity,
 * confidence distribution, and per-competency type/difficulty spread. Read-only.
 */
export async function runQualityChecks(pool: Pool) {
  if (!(await isFactorySchemaReady(pool))) {
    return { ok: true, version: POPULATION_VERSION, schema_initialized: false, note: 'Factory schema not initialized — no drafts to evaluate.' };
  }
  // Genome-grounded actionable factory drafts only: JOIN through the map to a NON-deprecated
  // genome competency (the SAME genome definition the coverage axes use). This guarantees no
  // competency-based metric can exceed genome_competencies — a stale/deprecated competency_id in
  // a draft's template_body can never leak in as a phantom bucket. COUNT(DISTINCT t.id) keeps
  // every metric dedup-safe even if a question carries more than one map row.
  const GENOME_DRAFTS = `
    FROM competency_question_templates t
    JOIN onto_competency_question_map m ON m.question_id = t.id
    JOIN onto_competencies c ON c.id = m.competency_id AND c.deprecated IS NOT TRUE
    WHERE t.provenance IN ('template_generated','ai_generated','imported')
      AND t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}`;

  const totals = (await pool.query(`
    SELECT COUNT(DISTINCT t.id)::int n,
           COUNT(DISTINCT t.id) FILTER (WHERE t.confidence_score IS NOT NULL)::int with_conf,
           ROUND(AVG(t.confidence_score)::numeric, 3) AS avg_conf
    ${GENOME_DRAFTS}`)).rows[0];

  // Exact duplicates: same genome competency + identical prompt across actionable drafts.
  const dup = (await pool.query(`
    WITH d AS (
      SELECT m.competency_id AS cid, t.template_body->>'prompt' AS prompt, COUNT(DISTINCT t.id)::int n
      ${GENOME_DRAFTS}
      GROUP BY 1,2 HAVING COUNT(DISTINCT t.id) > 1
    )
    SELECT COUNT(*)::int dup_groups, COALESCE(SUM(n - 1),0)::int redundant_rows FROM d`)).rows[0];

  // Structural validity: a valid scaffold needs a non-trivial prompt and (for non-likert) >=2 options
  // with best_option in range.
  const structural = (await pool.query(`
    SELECT
      COUNT(DISTINCT t.id) FILTER (WHERE COALESCE(length(t.template_body->>'prompt'),0) < 8)::int short_prompt,
      COUNT(DISTINCT t.id) FILTER (WHERE t.question_type <> 'likert' AND COALESCE(jsonb_array_length(t.template_body->'options'),0) < 2)::int too_few_options,
      COUNT(DISTINCT t.id) FILTER (WHERE t.question_type <> 'likert' AND (
                        COALESCE((t.template_body->>'best_option')::int, -1) < 0
                        OR COALESCE((t.template_body->>'best_option')::int, 999) >= COALESCE(jsonb_array_length(t.template_body->'options'), 0)))::int bad_best_option
    ${GENOME_DRAFTS}`)).rows[0];

  const confDist = (await pool.query(`
    SELECT
      COUNT(DISTINCT t.id) FILTER (WHERE t.confidence_score < 0.4)::int low,
      COUNT(DISTINCT t.id) FILTER (WHERE t.confidence_score >= 0.4 AND t.confidence_score < 0.5)::int moderate,
      COUNT(DISTINCT t.id) FILTER (WHERE t.confidence_score >= 0.5)::int higher
    ${GENOME_DRAFTS}`)).rows[0];

  // Per-competency spread among genome-grounded actionable drafts.
  const spread = (await pool.query(`
    WITH per AS (
      SELECT m.competency_id cid,
             COUNT(DISTINCT t.question_type)::int types, COUNT(DISTINCT t.difficulty_band)::int diffs, COUNT(DISTINCT t.id)::int n
      ${GENOME_DRAFTS}
      GROUP BY 1
    )
    SELECT COUNT(*)::int comps,
           COUNT(*) FILTER (WHERE types>=2)::int multi_type,
           COUNT(*) FILTER (WHERE diffs>=2)::int multi_difficulty,
           COUNT(*) FILTER (WHERE types>=2 AND diffs>=2 AND n>=4)::int ready_shaped
    FROM per`)).rows[0];

  const dupGroups = num(dup?.dup_groups);
  const shortP = num(structural?.short_prompt);
  const fewOpt = num(structural?.too_few_options);
  const badBest = num(structural?.bad_best_option);
  const structural_issues = shortP + fewOpt + badBest;

  return {
    ok: true, version: POPULATION_VERSION, schema_initialized: true,
    draft_corpus: { questions: num(totals?.n), with_confidence: num(totals?.with_conf), avg_confidence: totals?.avg_conf == null ? null : Number(totals.avg_conf) },
    duplication: { duplicate_groups: dupGroups, redundant_rows: num(dup?.redundant_rows), status: dupGroups === 0 ? 'pass' : 'review' },
    structural: { short_prompt: shortP, too_few_options: fewOpt, bad_best_option: badBest, total_issues: structural_issues, status: structural_issues === 0 ? 'pass' : 'review' },
    confidence_distribution: { low_lt_0_4: num(confDist?.low), moderate_0_4_0_5: num(confDist?.moderate), higher_gte_0_5: num(confDist?.higher) },
    spread: { competencies: num(spread?.comps), multi_type: num(spread?.multi_type), multi_difficulty: num(spread?.multi_difficulty), ready_shaped: num(spread?.ready_shaped) },
    note: 'Structural checks only. Content quality (relevance, distractor validity, clarity of best option) requires human review before approval — every draft remains pending_review.',
  };
}

/* ----------------------- difficulty / type roll-ups ------------------------ */
export async function getDifficultyCoverage(pool: Pool) {
  const ready = await isFactorySchemaReady(pool);
  const draft = ready ? (await pool.query(`
    SELECT difficulty_band, COUNT(*)::int n FROM competency_question_templates
    WHERE status='draft' AND quality_review_status IN ${ACTIONABLE} GROUP BY 1 ORDER BY 2 DESC`)).rows : [];
  const approved = (await pool.query(`
    SELECT t.difficulty_band, COUNT(*)::int n
    FROM competency_question_templates t JOIN onto_competency_question_map m ON m.question_id=t.id
    WHERE m.active AND t.status='approved' GROUP BY 1 ORDER BY 2 DESC`)).rows;
  return { ok: true, version: POPULATION_VERSION, schema_initialized: ready, draft_by_difficulty: draft, approved_by_difficulty: approved };
}

export async function getTypeCoverage(pool: Pool) {
  const ready = await isFactorySchemaReady(pool);
  // Genome competency TYPES (behavioral/functional/cognitive/technical/future_skills) and their
  // draft / approved assessability — the spec's "no type below target" axis.
  const byType = (await pool.query(`
    WITH typ AS (
      SELECT c.id, COALESCE(tm.type_key,'unclassified') type_key
      FROM onto_competencies c LEFT JOIN onto_competency_type_map tm ON tm.competency_id=c.id
      WHERE c.deprecated IS NOT TRUE
    ),
    appr AS (
      SELECT m.competency_id FROM onto_competency_question_map m JOIN competency_question_templates t ON t.id=m.question_id
      WHERE m.active AND t.status='approved' GROUP BY m.competency_id
    ),
    drf AS (
      SELECT DISTINCT m.competency_id FROM onto_competency_question_map m JOIN competency_question_templates t ON t.id=m.question_id
      WHERE t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}
    )
    SELECT typ.type_key,
      COUNT(*)::int total,
      COUNT(*) FILTER (WHERE a.competency_id IS NOT NULL)::int approved_comps,
      COUNT(*) FILTER (WHERE d.competency_id IS NOT NULL)::int draft_comps
    FROM typ
    LEFT JOIN appr a ON a.competency_id=typ.id
    LEFT JOIN drf d ON d.competency_id=typ.id
    GROUP BY typ.type_key ORDER BY total DESC`)).rows.map((r: any) => ({
      type_key: r.type_key, total: num(r.total),
      approved_comps: num(r.approved_comps), approved_pct: pct(num(r.approved_comps), num(r.total)),
      draft_comps: ready ? num(r.draft_comps) : 0, draft_pct: ready ? pct(num(r.draft_comps), num(r.total)) : 0,
    }));
  return { ok: true, version: POPULATION_VERSION, schema_initialized: ready, target_pct: TARGETS.coverage_pct, by_type: byType };
}

/* ------------------------------ founder view ------------------------------- */
/** Compose the founder dashboard: 3 axes + Role-DNA + target progress. Read-only. */
export async function getFounderDashboard(pool: Pool) {
  const [axes, roleDna, tiers] = await Promise.all([getThreeAxisCoverage(pool), getRoleDnaCoverage(pool), computePriorityTiers(pool)]);
  const total = axes.genome_competencies;
  const progress = (val: number, target: number) => ({ value: val, target, met: val >= target, remaining: Math.max(0, target - val) });
  return {
    ok: true, version: POPULATION_VERSION, schema_initialized: axes.schema_initialized,
    genome_competencies: total,
    coverage: { draft: axes.draft_coverage, approved: axes.approved_coverage, assessment_ready: axes.assessment_ready_coverage },
    role_dna: roleDna,
    tiers: tiers.tier_summary,
    target_progress: {
      approved_coverage_pct: progress(axes.approved_coverage.pct, TARGETS.coverage_pct),
      assessment_ready_competencies: progress(axes.assessment_ready_coverage.competencies, TARGETS.assessment_ready),
      role_dna_ready_pct: progress(roleDna.assessment_ready_coverage.pct, TARGETS.role_dna_pct),
    },
    verdict_note: 'PASS is earned by human review/approval of generated content. The factory builds the pipeline; it never auto-approves and never inflates coverage.',
  };
}
