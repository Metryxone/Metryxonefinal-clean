/**
 * MX-101X — Question Factory (Competency Assessment Coverage Expansion)
 *
 * An ADDITIVE, REVERSIBLE, flag-gated tool that expands competency-assessment
 * coverage HONESTLY. It generates DRAFT-only question packs for the real
 * `onto_competencies` genome (grounded in each competency's canonical name +
 * definition), stamps provenance / a confidence score / a quality-review status,
 * and routes everything through an approval workflow.
 *
 * Non-negotiable guarantees (founder guardrails):
 *   - Every generated question lands `status='draft'` + `quality_review_status='pending_review'`.
 *   - Generation NEVER auto-approves and NEVER inflates live coverage: a draft's
 *     genome map link is created INACTIVE (`active=false`); only an explicit human
 *     approval flips `status='approved'` + `active=true`.
 *   - Nothing is ever deleted — retirement archives (`status='archived'`).
 *   - The AI path is wired-but-inert without OPENAI_API_KEY (never throws).
 *   - The framework (genome / domains / types) is never modified.
 *
 * Provenance:      human_authored | ai_generated | template_generated | imported
 * Quality review:  pending_review | in_review | needs_revision | approved | rejected
 */
import type { Pool } from 'pg';

export const QUESTION_FACTORY_VERSION = 'mx101x-1.0.0';

export const PROVENANCE = {
  HUMAN: 'human_authored',
  AI: 'ai_generated',
  TEMPLATE: 'template_generated',
  IMPORTED: 'imported',
} as const;
export const PROVENANCE_VALUES = Object.values(PROVENANCE);

export const REVIEW = {
  PENDING: 'pending_review',
  IN_REVIEW: 'in_review',
  NEEDS_REVISION: 'needs_revision',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export const REVIEW_VALUES = Object.values(REVIEW);

// Genome domain → 7-code assessment-bank bucket. `competency_question_templates.competency_code`
// is NOT NULL and the live selector groups by these 7 codes; the AUTHORITATIVE per-competency
// link is the genome map row (onto_competency_question_map.competency_id), so this is only a
// coarse bank bucket for the legacy selector. Unmapped domains fall back to 'COG'.
const DOMAIN_TO_CODE: Record<string, string> = {
  dom_cognitive: 'COG',
  dom_interpersonal: 'EIQ',
  dom_behavioral: 'ADP',
  dom_strategic: 'LEA',
  dom_functional: 'EXE',
  dom_onet: 'TEC',
};

// Question "architecture" types the factory can scaffold, mapped to the bank's stored
// question_type canonical key. Each draft is a STRUCTURALLY-valid scaffold whose best
// option / distractors a human reviewer must confirm — hence a deliberately modest
// confidence score and pending_review status.
type ArchType = 'knowledge' | 'applied' | 'scenario' | 'situational' | 'behavioral' | 'advanced' | 'leadership';
const ARCH_TO_QTYPE: Record<ArchType, string> = {
  knowledge: 'multiple_choice',
  applied: 'multiple_choice',
  scenario: 'situational_judgment',
  situational: 'situational_judgment',
  behavioral: 'likert',
  advanced: 'situational_judgment',
  leadership: 'situational_judgment',
};
// Template-generated confidence by architecture type. Self-report Likert items are the most
// defensible auto-scaffolds; MCQ knowledge items (auto distractors) are the least.
const ARCH_CONFIDENCE: Record<ArchType, number> = {
  behavioral: 0.55,
  scenario: 0.45,
  situational: 0.45,
  leadership: 0.45,
  applied: 0.4,
  advanced: 0.4,
  knowledge: 0.35,
};

const VALID_DIFFICULTY = ['foundational', 'easy', 'intermediate', 'medium', 'advanced', 'hard', 'expert'];

// A sensible default pack: spans Likert/SJT/MCQ and four difficulty bands so a competency at
// zero coverage reaches the assessment-ready threshold (>=4) once a human approves the drafts.
const DEFAULT_PACK: Array<{ arch: ArchType; difficulty: string }> = [
  { arch: 'behavioral', difficulty: 'foundational' },
  { arch: 'knowledge', difficulty: 'foundational' },
  { arch: 'applied', difficulty: 'intermediate' },
  { arch: 'scenario', difficulty: 'intermediate' },
  { arch: 'situational', difficulty: 'advanced' },
  { arch: 'advanced', difficulty: 'expert' },
];

export type GenomeCompetency = {
  id: string;
  canonical_name: string;
  domain_id: string | null;
  scientific_type: string | null;
  complexity_level: number | null;
  definition: string | null;
};

/* --------------------------------- schema ---------------------------------- */
/**
 * Lazy ensure-schema mirroring migrations/20260720_question_factory.sql. Reached ONLY on the
 * flag-ON write path (never on a GET, never when the flag is OFF) so OFF stays byte-identical.
 */
export async function ensureQuestionFactorySchema(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE competency_question_templates
      ADD COLUMN IF NOT EXISTS provenance            text,
      ADD COLUMN IF NOT EXISTS confidence_score      numeric,
      ADD COLUMN IF NOT EXISTS quality_review_status text;
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqt_quality_review ON competency_question_templates (quality_review_status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cqt_provenance ON competency_question_templates (provenance);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_factory_batches (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      competency_id varchar(80),
      mode          text    NOT NULL,
      provenance    text    NOT NULL,
      requested     integer NOT NULL DEFAULT 0,
      generated     integer NOT NULL DEFAULT 0,
      question_ids  jsonb   NOT NULL DEFAULT '[]'::jsonb,
      note          text,
      created_by    text,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qfb_competency ON question_factory_batches (competency_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qfb_created_at ON question_factory_batches (created_at DESC);`);
  // Conservative provenance + review backfill for pre-existing rows (additive metadata only).
  await pool.query(`
    UPDATE competency_question_templates SET provenance =
      CASE source WHEN 'manual' THEN 'human_authored' WHEN 'seed' THEN 'imported'
                  WHEN 'generated' THEN 'template_generated' ELSE 'human_authored' END
    WHERE provenance IS NULL;
  `);
  await pool.query(`
    UPDATE competency_question_templates SET quality_review_status =
      CASE status WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected'
                  WHEN 'archived' THEN 'rejected' ELSE 'pending_review' END
    WHERE quality_review_status IS NULL;
  `);
}

/**
 * Read-only probe (NO DDL) used by every GET path so reads NEVER write schema (GET-never-writes).
 * Returns false until the first flag-ON POST has run ensureQuestionFactorySchema(); read handlers
 * then degrade to honest-empty rather than creating the columns/table.
 */
export async function isFactorySchemaReady(pool: Pool): Promise<boolean> {
  const r = await pool.query<{ ready: boolean }>(`
    SELECT (
      to_regclass('question_factory_batches') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='competency_question_templates' AND column_name='quality_review_status'
      )
    ) AS ready`);
  return Boolean(r.rows[0]?.ready);
}

/* ------------------------------ generation --------------------------------- */
function codeForDomain(domainId: string | null): string {
  return (domainId && DOMAIN_TO_CODE[domainId]) || 'COG';
}
function poolKey(code: string, qtype: string, difficulty: string): string {
  return `${code.toLowerCase()}_${qtype}_${difficulty}`;
}
function cleanDefinition(name: string, def: string | null): string {
  if (!def) return '';
  // Strip the boilerplate "Name — canonical competency in the X family." scaffolding so the
  // stem reads naturally; if nothing meaningful remains, the stem falls back to the name.
  const stripped = def.replace(/—\s*canonical competency in the .*$/i, '').replace(new RegExp(`^${name}\\s*[—-]\\s*`, 'i'), '').trim();
  return stripped.length > 8 ? stripped : '';
}

/** Build ONE structurally-valid draft scaffold for a competency + architecture + difficulty. */
function buildScaffold(comp: GenomeCompetency, arch: ArchType, difficulty: string) {
  const name = comp.canonical_name;
  const qtype = ARCH_TO_QTYPE[arch];
  const meaning = cleanDefinition(name, comp.definition);
  let prompt = '';
  let options: string[] = [];
  let best_option = 0;
  let reverse_scored = false;

  if (qtype === 'likert') {
    // Self-report behavioural item — the most defensible auto scaffold.
    prompt = meaning
      ? `I consistently demonstrate ${name.toLowerCase()} — ${meaning.toLowerCase()} — in my day-to-day work.`
      : `I consistently demonstrate strong ${name.toLowerCase()} in my day-to-day work.`;
    options = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
    best_option = 4;
  } else if (qtype === 'situational_judgment') {
    const lens = arch === 'leadership'
      ? `As a leader, you encounter a situation that calls for ${name.toLowerCase()}.`
      : arch === 'advanced'
        ? `You face a novel, ambiguous situation where ${name.toLowerCase()} is critical.`
        : `At work, you encounter a situation that calls for ${name.toLowerCase()}.`;
    prompt = `${lens} Which response best reflects strong ${name.toLowerCase()}?`;
    options = [
      `Take a deliberate, ${name.toLowerCase()}-driven approach that addresses the situation directly.`,
      `Take a partial step that helps somewhat but does not fully resolve the situation.`,
      `Wait for someone else to act before deciding what to do.`,
      `Avoid the situation or default to an unrelated routine.`,
    ];
    best_option = 0;
  } else {
    // multiple_choice (knowledge / applied)
    prompt = arch === 'applied'
      ? `In practice, which option best demonstrates effective ${name.toLowerCase()}?`
      : `Which statement best reflects ${name.toLowerCase()}?`;
    options = meaning
      ? [
          `${meaning.charAt(0).toUpperCase()}${meaning.slice(1)}.`,
          `Following a fixed routine regardless of ${name.toLowerCase()}.`,
          `Relying on others to compensate for ${name.toLowerCase()}.`,
          `Treating ${name.toLowerCase()} as unimportant to the outcome.`,
        ]
      : [
          `Applying ${name.toLowerCase()} deliberately to improve the outcome.`,
          `Following a fixed routine regardless of ${name.toLowerCase()}.`,
          `Relying on others to compensate for ${name.toLowerCase()}.`,
          `Treating ${name.toLowerCase()} as unimportant to the outcome.`,
        ];
    best_option = 0;
  }

  const code = codeForDomain(comp.domain_id);
  const template_body = {
    prompt,
    options,
    best_option,
    reverse_scored,
    depth: 'standard',
    pool_key: poolKey(code, qtype, difficulty),
    role_tags: [] as string[],
    industry_tags: [] as string[],
    stage_tags: [] as string[],
    function_tags: [] as string[],
    // Genome traceability — the AUTHORITATIVE competency link (the bank code above is coarse).
    onto_competency_id: comp.id,
    architecture_type: arch,
    needs_review_note: 'Auto-scaffold: a reviewer must verify the best option / distractors before approval.',
    generator: { kind: 'template', version: QUESTION_FACTORY_VERSION },
  };
  return { code, qtype, template_body, confidence: ARCH_CONFIDENCE[arch] };
}

async function loadCompetency(pool: Pool, competencyId: string): Promise<GenomeCompetency | null> {
  const r = await pool.query<GenomeCompetency>(
    `SELECT id, canonical_name, domain_id, scientific_type, complexity_level, definition
     FROM onto_competencies WHERE id = $1 LIMIT 1`,
    [competencyId],
  );
  return r.rows[0] || null;
}

async function insertDraft(
  pool: Pool,
  comp: GenomeCompetency,
  scaffold: ReturnType<typeof buildScaffold>,
  difficulty: string,
  provenance: string,
  confidence: number,
): Promise<string | null> {
  const key = `qf-${comp.id}-${scaffold.template_body.architecture_type}-${difficulty}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const ins = await pool.query<{ id: string }>(
    `INSERT INTO competency_question_templates
       (template_key, competency_code, question_type, template_body, difficulty_band,
        status, source, provenance, confidence_score, quality_review_status, notes)
     VALUES ($1,$2,$3,$4::jsonb,$5,'draft',$6,$7,$8,'pending_review',$9)
     ON CONFLICT (template_key) DO NOTHING
     RETURNING id`,
    [
      key, scaffold.code, scaffold.qtype, JSON.stringify(scaffold.template_body), difficulty,
      provenance === PROVENANCE.IMPORTED ? 'manual' : 'generated',
      provenance, confidence,
      `Question Factory ${provenance} draft for ${comp.canonical_name} (${comp.id}).`,
    ],
  );
  const id = ins.rows[0]?.id;
  if (!id) return null;
  // Create the genome map link INACTIVE — draft questions must never count toward live coverage.
  await pool.query(
    `INSERT INTO onto_competency_question_map (competency_id, question_id, source, active)
     VALUES ($1, $2, 'question_factory', false)
     ON CONFLICT DO NOTHING`,
    [comp.id, id],
  );
  return id;
}

export type GenerateOptions = {
  competencyId: string;
  cells?: Array<{ arch: ArchType; difficulty: string }>;
  createdBy?: string | null;
};

/** Generate a DRAFT template-generated pack for one genome competency. */
export async function generateDraftPack(pool: Pool, opts: GenerateOptions) {
  const comp = await loadCompetency(pool, opts.competencyId);
  if (!comp) return { ok: false as const, error: 'competency_not_found', competency_id: opts.competencyId };

  const cells = (opts.cells && opts.cells.length ? opts.cells : DEFAULT_PACK)
    .filter((c) => ARCH_TO_QTYPE[c.arch] && VALID_DIFFICULTY.includes(c.difficulty));
  if (!cells.length) return { ok: false as const, error: 'no_valid_cells' };

  const ids: string[] = [];
  for (const cell of cells) {
    const scaffold = buildScaffold(comp, cell.arch, cell.difficulty);
    const id = await insertDraft(pool, comp, scaffold, cell.difficulty, PROVENANCE.TEMPLATE, scaffold.confidence);
    if (id) ids.push(id);
  }

  await pool.query(
    `INSERT INTO question_factory_batches (competency_id, mode, provenance, requested, generated, question_ids, created_by)
     VALUES ($1,'template',$2,$3,$4,$5::jsonb,$6)`,
    [comp.id, PROVENANCE.TEMPLATE, cells.length, ids.length, JSON.stringify(ids), opts.createdBy || null],
  );
  return { ok: true as const, competency_id: comp.id, competency: comp.canonical_name, requested: cells.length, generated: ids.length, ids, status: 'draft', quality_review_status: REVIEW.PENDING };
}

/**
 * AI generation path — wired-but-inert. Without OPENAI_API_KEY (or the openai SDK) it returns a
 * clear honest reason and writes NOTHING. When configured later, a single drop-in call here would
 * produce the same DRAFT/pending_review scaffolds with provenance='ai_generated'.
 */
export async function generateAIPack(pool: Pool, opts: GenerateOptions) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false as const, error: 'ai_generation_not_configured', reason: 'OPENAI_API_KEY is not set — the AI path is wired-but-inert. Use template generation or import.', provenance: PROVENANCE.AI };
  }
  // Key present: the factory is intentionally conservative — AI authoring is not yet wired to a
  // live model in this build. It still NEVER auto-approves; integrate the model call here and reuse
  // insertDraft(...) with PROVENANCE.AI. Returns inert (no write) until that integration lands.
  return { ok: false as const, error: 'ai_generation_pending_integration', reason: 'OPENAI_API_KEY detected but the AI authoring model is not wired in this build; no questions were generated.', provenance: PROVENANCE.AI };
}

export type ImportItem = {
  competency_id: string;
  question_type?: string;
  prompt: string;
  options?: string[];
  best_option?: number;
  difficulty?: string;
};

/** Bulk-import externally authored questions as DRAFTs (provenance='imported', pending_review). */
export async function importQuestions(pool: Pool, items: ImportItem[], createdBy?: string | null) {
  const results: Array<{ ok: boolean; id?: string; error?: string; prompt?: string }> = [];
  const idsByComp: Record<string, string[]> = {};
  for (const raw of items || []) {
    const comp = raw.competency_id ? await loadCompetency(pool, raw.competency_id) : null;
    if (!comp) { results.push({ ok: false, error: 'competency_not_found', prompt: raw.prompt }); continue; }
    if (!raw.prompt || String(raw.prompt).trim().length < 4) { results.push({ ok: false, error: 'prompt_required', prompt: raw.prompt }); continue; }
    const qtype = raw.question_type && ['multiple_choice', 'situational_judgment', 'likert'].includes(raw.question_type) ? raw.question_type : 'likert';
    const difficulty = raw.difficulty && VALID_DIFFICULTY.includes(raw.difficulty) ? raw.difficulty : 'intermediate';
    const code = codeForDomain(comp.domain_id);
    const opts = Array.isArray(raw.options) ? raw.options.filter((o) => typeof o === 'string' && o.trim()) : [];
    const options = qtype === 'likert' || opts.length < 2 ? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] : opts;
    const best_option = qtype === 'likert' ? 4 : (typeof raw.best_option === 'number' && raw.best_option >= 0 && raw.best_option < options.length ? raw.best_option : 0);
    const template_body = {
      prompt: String(raw.prompt), options, best_option, reverse_scored: false, depth: 'standard',
      pool_key: poolKey(code, qtype, difficulty), role_tags: [], industry_tags: [], stage_tags: [], function_tags: [],
      onto_competency_id: comp.id, architecture_type: 'imported',
      generator: { kind: 'import', version: QUESTION_FACTORY_VERSION },
    };
    const id = await insertDraft(pool, comp, { code, qtype, template_body, confidence: 0.5 } as any, difficulty, PROVENANCE.IMPORTED, 0.5);
    if (id) { results.push({ ok: true, id, prompt: raw.prompt }); (idsByComp[comp.id] ||= []).push(id); }
    else results.push({ ok: false, error: 'insert_conflict', prompt: raw.prompt });
  }
  for (const [cid, ids] of Object.entries(idsByComp)) {
    await pool.query(
      `INSERT INTO question_factory_batches (competency_id, mode, provenance, requested, generated, question_ids, created_by)
       VALUES ($1,'import',$2,$3,$4,$5::jsonb,$6)`,
      [cid, PROVENANCE.IMPORTED, ids.length, ids.length, JSON.stringify(ids), createdBy || null],
    );
  }
  const generated = results.filter((r) => r.ok).length;
  return { ok: true as const, requested: (items || []).length, generated, results };
}

/* ------------------------------- workflow ---------------------------------- */
export type ReviewAction = 'start_review' | 'request_changes' | 'reject' | 'approve';

/**
 * Drive the quality-review state machine. APPROVE is the ONLY path that touches live coverage.
 *
 * IMPORTANT (framework constraint): competency_question_templates carries two pre-existing,
 * mutually-overlapping CHECK constraints whose intersection locks `status` to {draft, approved}.
 * To stay strictly additive (no framework/constraint change) the rich lifecycle lives in the new
 * `quality_review_status` column + the genome map's `active` flag; `status` only ever holds
 * 'draft' or 'approved'. The live selector (`/api/competency/questions/select`) serves
 * status='approved' rows, so reject/retire must drop `status` back to 'draft' to leave the bank.
 */
export async function reviewQuestion(pool: Pool, id: string, action: ReviewAction, reviewerId?: string | null) {
  const cur = await pool.query<{ id: string; status: string; quality_review_status: string | null }>(
    `SELECT id, status, quality_review_status FROM competency_question_templates WHERE id = $1`, [id],
  );
  if (!cur.rows[0]) return { ok: false as const, error: 'not_found' };

  if (action === 'start_review') {
    const r = await pool.query(`UPDATE competency_question_templates SET quality_review_status='in_review', updated_at=NOW() WHERE id=$1 RETURNING id, status, quality_review_status`, [id]);
    return { ok: true as const, row: r.rows[0] };
  }
  if (action === 'request_changes') {
    const r = await pool.query(`UPDATE competency_question_templates SET quality_review_status='needs_revision', updated_at=NOW() WHERE id=$1 RETURNING id, status, quality_review_status`, [id]);
    return { ok: true as const, row: r.rows[0] };
  }
  if (action === 'reject') {
    await pool.query(`UPDATE onto_competency_question_map SET active=false, updated_at=NOW() WHERE question_id=$1`, [id]);
    const r = await pool.query(
      `UPDATE competency_question_templates SET status='draft', quality_review_status='rejected',
         reviewed_by=COALESCE($2, reviewed_by), reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$1 RETURNING id, status, quality_review_status`,
      [id, reviewerId ? String(reviewerId) : null],
    );
    return { ok: true as const, row: r.rows[0] };
  }
  // approve — flips the question live AND activates its genome map link (the ONLY coverage-changing op).
  const r = await pool.query(
    `UPDATE competency_question_templates SET status='approved', quality_review_status='approved',
       reviewed_by=COALESCE($2, reviewed_by), reviewed_at=NOW(), updated_at=NOW()
     WHERE id=$1 RETURNING id, status, quality_review_status`,
    [id, reviewerId ? String(reviewerId) : null],
  );
  await pool.query(`UPDATE onto_competency_question_map SET active=true, updated_at=NOW() WHERE question_id=$1`, [id]);
  return { ok: true as const, row: r.rows[0] };
}

/** Retire a question — archives, never deletes; deactivates its genome map link. */
export async function retireQuestion(pool: Pool, id: string, reviewerId?: string | null) {
  const cur = await pool.query(`SELECT id FROM competency_question_templates WHERE id=$1`, [id]);
  if (!cur.rows[0]) return { ok: false as const, error: 'not_found' };
  await pool.query(`UPDATE onto_competency_question_map SET active=false, updated_at=NOW() WHERE question_id=$1`, [id]);
  // Archive = mark retired + drop status to 'draft' (constraint-safe, leaves the live bank). NEVER deleted.
  const r = await pool.query(
    `UPDATE competency_question_templates SET status='draft', quality_review_status='retired',
       reviewed_by=COALESCE($2, reviewed_by), reviewed_at=NOW(), updated_at=NOW()
     WHERE id=$1 RETURNING id, status, quality_review_status`,
    [id, reviewerId ? String(reviewerId) : null],
  );
  return { ok: true as const, row: r.rows[0] };
}

/* ------------------------------- coverage ---------------------------------- */
/**
 * Honest coverage view. Live coverage counts ONLY approved + active-mapped questions; the draft
 * PIPELINE is reported as a SEPARATE axis so generation can never be mistaken for coverage.
 */
export async function getFactoryCoverage(pool: Pool) {
  const num = (v: any) => Number(v ?? 0) || 0;

  const totalComp = num((await pool.query(`SELECT COUNT(*)::int c FROM onto_competencies WHERE deprecated IS NOT TRUE`)).rows[0]?.c);

  // LIVE (honest): competencies with >=1 and >=4 approved + active mapped questions.
  const live = await pool.query<{ assessable: number; ready: number }>(`
    WITH per AS (
      SELECT m.competency_id, COUNT(*)::int n
      FROM onto_competency_question_map m
      JOIN competency_question_templates t ON t.id = m.question_id
      WHERE m.active AND t.status='approved'
      GROUP BY m.competency_id
    )
    SELECT COUNT(*) FILTER (WHERE n>=1)::int AS assessable,
           COUNT(*) FILTER (WHERE n>=4)::int AS ready
    FROM per`);
  const assessable = num(live.rows[0]?.assessable);
  const ready = num(live.rows[0]?.ready);

  // Pipeline + provenance/review breakdowns depend on the additive columns/ledger. Probe (no DDL):
  // until the first flag-ON POST has created them, degrade these to honest-empty rather than write.
  const ready_schema = await isFactorySchemaReady(pool);

  // PIPELINE: competencies with >=1 ACTIONABLE draft (pending/in_review/needs_revision) mapped question.
  // rejected/retired rows also sit at status='draft' but are excluded by the review-status filter.
  const ACTIONABLE = `('pending_review','in_review','needs_revision')`;
  const statusBreakdown = (await pool.query(`
    SELECT status, COUNT(*)::int n FROM competency_question_templates GROUP BY 1 ORDER BY 2 DESC`)).rows;

  let pipelineComp = 0;
  let provBreakdown: any[] = [];
  let reviewBreakdown: any[] = [];
  let draftByType: any[] = [];
  if (ready_schema) {
    pipelineComp = num((await pool.query(`
      SELECT COUNT(DISTINCT m.competency_id)::int c
      FROM onto_competency_question_map m
      JOIN competency_question_templates t ON t.id = m.question_id
      WHERE t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}`)).rows[0]?.c);
    provBreakdown = (await pool.query(`
      SELECT COALESCE(provenance,'(unset)') provenance, COUNT(*)::int n
      FROM competency_question_templates GROUP BY 1 ORDER BY 2 DESC`)).rows;
    reviewBreakdown = (await pool.query(`
      SELECT COALESCE(quality_review_status,'(unset)') quality_review_status, COUNT(*)::int n
      FROM competency_question_templates GROUP BY 1 ORDER BY 2 DESC`)).rows;
    draftByType = (await pool.query(`
      SELECT question_type, difficulty_band, COUNT(*)::int n
      FROM competency_question_templates
      WHERE status='draft' AND quality_review_status IN ${ACTIONABLE} GROUP BY 1,2 ORDER BY 1,2`)).rows;
  }

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    ok: true,
    version: QUESTION_FACTORY_VERSION,
    schema_initialized: ready_schema,
    genome_competencies: totalComp,
    live_coverage: {
      assessable_competencies: assessable,
      assessment_ready_competencies: ready,
      assessable_pct: pct(assessable, totalComp),
      assessment_ready_pct: pct(ready, totalComp),
      definition: 'Live coverage counts ONLY approved + active-mapped questions. Assessment-ready = >=4.',
    },
    pipeline: {
      competencies_with_drafts: pipelineComp,
      competencies_with_drafts_pct: pct(pipelineComp, totalComp),
      by_type_and_difficulty: draftByType,
      note: 'Drafts do NOT count toward live coverage until a human approves them.',
    },
    provenance_breakdown: provBreakdown,
    review_status_breakdown: reviewBreakdown,
    status_breakdown: statusBreakdown,
  };
}

/**
 * List questions in the ACTIONABLE review queue, newest first. Default = drafts awaiting a human
 * (pending_review/in_review/needs_revision); rejected/retired rows also sit at status='draft' but are
 * EXCLUDED by default so the queue is never polluted by non-actionable rows (a caller may still pass
 * an explicit reviewStatus to inspect rejected/retired). Read-only; degrades to empty pre-schema.
 */
export async function listDrafts(pool: Pool, filters: { competencyId?: string; provenance?: string; reviewStatus?: string; limit?: number }) {
  if (!(await isFactorySchemaReady(pool))) return { ok: true, count: 0, rows: [], schema_initialized: false };
  const where: string[] = [`t.status IN ('draft')`];
  const args: any[] = [];
  if (filters.provenance) { args.push(filters.provenance); where.push(`t.provenance = $${args.length}`); }
  if (filters.reviewStatus) { args.push(filters.reviewStatus); where.push(`t.quality_review_status = $${args.length}`); }
  else where.push(`t.quality_review_status IN ('pending_review','in_review','needs_revision')`);
  if (filters.competencyId) { args.push(filters.competencyId); where.push(`(t.template_body->>'onto_competency_id') = $${args.length}`); }
  const limit = Math.min(500, Math.max(1, filters.limit || 100));
  const rs = await pool.query(`
    SELECT t.id, t.competency_code, t.question_type, t.difficulty_band, t.status,
           t.provenance, t.confidence_score, t.quality_review_status, t.created_at,
           t.template_body->>'prompt' AS prompt,
           t.template_body->>'onto_competency_id' AS onto_competency_id,
           t.template_body->>'architecture_type' AS architecture_type,
           c.canonical_name AS competency_name
    FROM competency_question_templates t
    LEFT JOIN onto_competencies c ON c.id = (t.template_body->>'onto_competency_id')
    WHERE ${where.join(' AND ')}
    ORDER BY t.created_at DESC LIMIT ${limit}`, args);
  return { ok: true, count: rs.rows.length, rows: rs.rows };
}

/**
 * List genome competencies with their LIVE approved-question count and ACTIONABLE draft count,
 * so the admin panel can pick a generation target and see honest per-competency status.
 * Read-only. `q` filters by name (ILIKE); `gap_only` returns only competencies below `min` live.
 */
export async function listGenomeCompetencies(pool: Pool, opts: { q?: string; gapOnly?: boolean; min?: number; limit?: number }) {
  const min = Math.max(1, opts.min || 4);
  const args: any[] = [];
  const filters: string[] = [`c.deprecated IS NOT TRUE`];
  if (opts.q) { args.push(`%${opts.q}%`); filters.push(`c.canonical_name ILIKE $${args.length}`); }
  const limit = Math.min(1000, Math.max(1, opts.limit || 500));
  // draft_pipeline needs the additive quality_review_status column; degrade it to 0 pre-schema (no DDL).
  const draftPipelineExpr = (await isFactorySchemaReady(pool))
    ? `COALESCE((SELECT COUNT(*)::int FROM onto_competency_question_map m
        JOIN competency_question_templates t ON t.id=m.question_id
        WHERE m.competency_id=c.id AND t.status='draft'
          AND t.quality_review_status IN ('pending_review','in_review','needs_revision')), 0)`
    : `0`;
  const rs = await pool.query(`
    SELECT c.id, c.canonical_name, c.domain_id,
      COALESCE((SELECT COUNT(*)::int FROM onto_competency_question_map m
        JOIN competency_question_templates t ON t.id=m.question_id
        WHERE m.competency_id=c.id AND m.active AND t.status='approved'), 0) AS live_approved,
      ${draftPipelineExpr} AS draft_pipeline
    FROM onto_competencies c
    WHERE ${filters.join(' AND ')}
    ORDER BY c.canonical_name ASC LIMIT ${limit}`, args);
  let rows = rs.rows;
  if (opts.gapOnly) rows = rows.filter((r: any) => Number(r.live_approved) < min);
  return { ok: true, count: rows.length, ready_threshold: min, rows };
}

export async function listBatches(pool: Pool, limit = 50) {
  if (!(await isFactorySchemaReady(pool))) return { ok: true, count: 0, rows: [], schema_initialized: false };
  const rs = await pool.query(`
    SELECT b.*, c.canonical_name AS competency_name
    FROM question_factory_batches b
    LEFT JOIN onto_competencies c ON c.id = b.competency_id
    ORDER BY b.created_at DESC LIMIT $1`, [Math.min(200, Math.max(1, limit))]);
  return { ok: true, count: rs.rows.length, rows: rs.rows };
}
