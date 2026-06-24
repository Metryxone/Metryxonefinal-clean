/**
 * MX-101B — Question Quality Certification (Phase 1).
 *
 * An ADDITIVE, REVERSIBLE, flag-gated (`assessmentReadiness`) layer ON TOP of the MX-101X
 * Question Factory. It scores each generated/imported DRAFT question across five quality
 * dimensions and writes the result to an append-only ledger (`question_certifications`).
 *
 * HONESTY CONTRACT (founder guardrails — identical spirit to MX-101X/A):
 *   - Certification is NOT approval. It NEVER touches `status`, `quality_review_status`, or the
 *     genome map's `active` flag, so it can NEVER inflate live coverage. It only PRE-QUALIFIES a
 *     draft so a human reviewer can fast-track the obviously-sound ones via the bulk workbench.
 *   - Two confidence classes, reported SEPARATELY and never composited into a single trustworthy
 *     number:
 *       * STRUCTURAL dimensions (duplication / difficulty / competency-alignment) are
 *         deterministically computable from the row + genome — HIGH confidence.
 *       * HEURISTIC dimensions (relevance / clarity) are lexical PROXIES — explicitly labeled
 *         LOWER confidence. They are hints for a reviewer, never a substitute for human judgement.
 *   - The AI relevance/clarity path is wired-but-inert: without OPENAI_API_KEY it returns the
 *     heuristic proxy and never fabricates a model judgement.
 *   - Append-only: each run inserts a new ledger row; the "current" certification is the latest
 *     row per question. Re-running is safe and reversible (rows are never mutated/deleted).
 *   - GET-never-writes: read composers probe with to_regclass (NO DDL) and degrade to honest-empty
 *     before the first flag-ON POST has created the ledger.
 */
import type { Pool } from 'pg';

export const CERTIFICATION_VERSION = 'mx101b-cert-1.0.0';

// Canonical difficulty bands (mirrors VALID_DIFFICULTY in question-factory.ts).
const VALID_DIFFICULTY = new Set(['foundational', 'easy', 'intermediate', 'medium', 'advanced', 'hard', 'expert']);

// A draft is eligible for fast-track bulk approval ONLY when its latest certification is 'certified'.
export const CERT_STATUS = { CERTIFIED: 'certified', NEEDS_REVIEW: 'needs_review', FAILED: 'failed' } as const;
export type CertStatus = (typeof CERT_STATUS)[keyof typeof CERT_STATUS];

// Heuristic floor: a structurally-sound question still needs decent lexical proxies to auto-qualify.
const HEURISTIC_FLOOR = 60;
// Overall blend weights — STRUCTURAL dominates because it is the trustworthy axis.
const W_STRUCTURAL = 0.65;
const W_HEURISTIC = 0.35;

const num = (v: any) => Number(v ?? 0) || 0;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'you', 'your', 'are', 'was', 'were', 'has', 'have',
  'had', 'not', 'but', 'all', 'any', 'can', 'who', 'how', 'why', 'what', 'when', 'which', 'best',
  'reflects', 'statement', 'option', 'response', 'situation', 'work', 'day', 'consistently',
  'demonstrate', 'strong', 'effective', 'practice', 'approach', 'take', 'reflect', 'critical',
]);

function tokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

export type CertDimension = {
  score: number; // 0..100
  status: 'pass' | 'review' | 'fail';
  confidence: 'structural' | 'heuristic';
  notes: string;
};

export type CertResult = {
  cert_score: number; // 0..100 blended
  cert_status: CertStatus;
  structural_score: number;
  heuristic_score: number;
  dimensions: {
    duplication: CertDimension;
    difficulty: CertDimension;
    competency_alignment: CertDimension;
    relevance: CertDimension;
    clarity: CertDimension;
  };
  ai_assist: { available: boolean; used: boolean; note: string };
};

type CertInput = {
  question_id: string;
  competency_id: string | null;
  competency_present: boolean; // mapped to a NON-deprecated genome competency
  canonical_name: string | null;
  definition: string | null;
  question_type: string;
  difficulty_band: string | null;
  template_body: any;
  onto_competency_id: string | null;
  duplicate_siblings: number; // # of OTHER actionable/approved questions in same comp w/ identical prompt
};

/* ----------------------------- the five dimensions ----------------------------- */

// 1. DUPLICATION (structural). Identical prompt to another actionable/approved question of the SAME
//    competency. NOTE (honest): the template generator legitimately reuses a prompt across difficulty
//    bands, so duplicates are a REVIEW signal (a reviewer should keep one), never a hard fail.
function dimDuplication(inp: CertInput): CertDimension {
  if (inp.duplicate_siblings <= 0) {
    return { score: 100, status: 'pass', confidence: 'structural', notes: 'Prompt is unique within the competency.' };
  }
  const score = clamp(100 - inp.duplicate_siblings * 25);
  return {
    score,
    status: 'review',
    confidence: 'structural',
    notes: `Prompt is shared with ${inp.duplicate_siblings} other question(s) in this competency — a reviewer should keep one and retire the rest.`,
  };
}

// 2. DIFFICULTY (structural). Is the difficulty band a recognized canonical band?
function dimDifficulty(inp: CertInput): CertDimension {
  const band = inp.difficulty_band ? String(inp.difficulty_band).toLowerCase() : '';
  if (band && VALID_DIFFICULTY.has(band)) {
    return { score: 100, status: 'pass', confidence: 'structural', notes: `Recognized difficulty band: ${band}.` };
  }
  return {
    score: band ? 40 : 0,
    status: band ? 'review' : 'fail',
    confidence: 'structural',
    notes: band ? `Unrecognized difficulty band "${band}".` : 'No difficulty band set.',
  };
}

// 3. COMPETENCY ALIGNMENT (structural). Mapped to a real genome competency + body link agrees +
//    prompt textually references the competency name. Missing/deprecated map = hard FAIL.
function dimAlignment(inp: CertInput): CertDimension {
  if (!inp.competency_present || !inp.competency_id) {
    return { score: 0, status: 'fail', confidence: 'structural', notes: 'Not mapped to a live (non-deprecated) genome competency.' };
  }
  let score = 70; // mapped to a real competency
  const notes: string[] = [];
  // Body traceability link agrees with the map.
  if (inp.onto_competency_id && inp.onto_competency_id === inp.competency_id) score += 15;
  else if (inp.onto_competency_id && inp.onto_competency_id !== inp.competency_id) {
    score -= 25;
    notes.push('template_body.onto_competency_id disagrees with the genome map link.');
  } else notes.push('template_body has no onto_competency_id traceability link.');
  // Prompt references the competency name.
  const nameTok = tokens(inp.canonical_name);
  const promptTok = tokens(inp.template_body?.prompt);
  const overlap = nameTok.size ? [...nameTok].filter((t) => promptTok.has(t)).length / nameTok.size : 0;
  if (overlap >= 0.5) score += 15;
  else if (overlap > 0) score += 7;
  else notes.push('Prompt does not textually reference the competency name.');
  score = clamp(score);
  return {
    score,
    status: score >= 75 ? 'pass' : 'review',
    confidence: 'structural',
    notes: notes.length ? notes.join(' ') : 'Mapped to a live competency with an agreeing traceability link.',
  };
}

// 4. RELEVANCE (heuristic, lower confidence). Lexical overlap of the prompt + options with the
//    competency name + definition. A PROXY for a reviewer, never a content judgement.
function dimRelevance(inp: CertInput): CertDimension {
  const compTok = new Set<string>([...tokens(inp.canonical_name), ...tokens(inp.definition)]);
  const body = inp.template_body || {};
  const optText = Array.isArray(body.options) ? body.options.join(' ') : '';
  const qTok = new Set<string>([...tokens(body.prompt), ...tokens(optText)]);
  if (!compTok.size) {
    return { score: 50, status: 'review', confidence: 'heuristic', notes: 'No competency definition text to compare against — relevance indeterminate (heuristic).' };
  }
  const hits = [...compTok].filter((t) => qTok.has(t)).length;
  const coverage = hits / compTok.size; // recall of competency terms in the question
  const score = clamp(40 + coverage * 80);
  return {
    score,
    status: score >= HEURISTIC_FLOOR ? 'pass' : 'review',
    confidence: 'heuristic',
    notes: `Lexical proxy: ${hits}/${compTok.size} competency term(s) present in the question (heuristic — confirm relevance in review).`,
  };
}

// 5. CLARITY (heuristic, lower confidence). Structural readability of the stem + options.
function dimClarity(inp: CertInput): CertDimension {
  const body = inp.template_body || {};
  const prompt = String(body.prompt || '');
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  const isLikert = inp.question_type === 'likert';
  const opts: string[] = Array.isArray(body.options) ? body.options.map((o: any) => String(o || '').trim()).filter(Boolean) : [];
  let score = 100;
  const notes: string[] = [];
  if (prompt.length < 8) { score -= 50; notes.push('Prompt is too short.'); }
  if (prompt.length > 400) { score -= 15; notes.push('Prompt is very long.'); }
  if (words < 4) { score -= 20; notes.push('Prompt has very few words.'); }
  if (/\{[a-z_]+\}|todo|lorem ipsum|xxxx/i.test(prompt)) { score -= 40; notes.push('Prompt contains an unresolved placeholder.'); }
  if (!isLikert) {
    if (opts.length < 2) { score -= 40; notes.push('Fewer than two answer options.'); }
    const distinct = new Set(opts.map((o) => o.toLowerCase())).size;
    if (opts.length >= 2 && distinct < opts.length) { score -= 20; notes.push('Answer options are not all distinct.'); }
    const best = num(body.best_option);
    if (opts.length >= 2 && (best < 0 || best >= opts.length)) { score -= 25; notes.push('best_option index is out of range.'); }
  }
  score = clamp(score);
  return {
    score,
    status: score >= HEURISTIC_FLOOR ? 'pass' : 'review',
    confidence: 'heuristic',
    notes: notes.length ? `Structural readability proxy: ${notes.join(' ')} (heuristic — confirm clarity in review).` : 'Structural readability proxy: no clarity issues detected (heuristic).',
  };
}

/** Pure certifier — deterministic, no I/O. */
export function certifyOne(inp: CertInput): CertResult {
  const duplication = dimDuplication(inp);
  const difficulty = dimDifficulty(inp);
  const competency_alignment = dimAlignment(inp);
  const relevance = dimRelevance(inp);
  const clarity = dimClarity(inp);

  const structural_score = clamp((duplication.score + difficulty.score + competency_alignment.score) / 3);
  const heuristic_score = clamp((relevance.score + clarity.score) / 2);
  const cert_score = clamp(structural_score * W_STRUCTURAL + heuristic_score * W_HEURISTIC);

  // Any hard structural fail → failed (not eligible for fast-track). Otherwise certified requires all
  // structural dims to pass AND the heuristic proxies to clear the floor with no duplication flag.
  const structuralFail = [duplication, difficulty, competency_alignment].some((d) => d.status === 'fail');
  const clarityFail = clarity.status === 'fail' || clarity.score < 40;
  let cert_status: CertStatus;
  if (structuralFail || clarityFail) cert_status = CERT_STATUS.FAILED;
  else if (
    duplication.status === 'pass' &&
    difficulty.status === 'pass' &&
    competency_alignment.status === 'pass' &&
    heuristic_score >= HEURISTIC_FLOOR
  ) cert_status = CERT_STATUS.CERTIFIED;
  else cert_status = CERT_STATUS.NEEDS_REVIEW;

  return {
    cert_score,
    cert_status,
    structural_score,
    heuristic_score,
    dimensions: { duplication, difficulty, competency_alignment, relevance, clarity },
    ai_assist: {
      available: Boolean(process.env.OPENAI_API_KEY),
      used: false,
      note: process.env.OPENAI_API_KEY
        ? 'OPENAI_API_KEY present but the AI relevance/clarity judge is not wired in this build — heuristic proxies used (no fabrication).'
        : 'OPENAI_API_KEY absent — AI relevance/clarity judge is inert; heuristic proxies used (no fabrication).',
    },
  };
}

/* --------------------------------- schema ---------------------------------- */
/** Lazy ensure-schema mirroring migrations. Reached ONLY on flag-ON POST paths. */
export async function ensureCertificationSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_certifications (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id      uuid NOT NULL,
      competency_id    varchar(80),
      cert_version     text NOT NULL,
      cert_score       numeric NOT NULL,
      cert_status      text NOT NULL,
      structural_score numeric NOT NULL,
      heuristic_score  numeric NOT NULL,
      dimensions       jsonb NOT NULL DEFAULT '{}'::jsonb,
      certified_by     text,
      created_at       timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qcert_question ON question_certifications (question_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qcert_status ON question_certifications (cert_status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qcert_competency ON question_certifications (competency_id);`);
}

export async function isCertificationSchemaReady(pool: Pool): Promise<boolean> {
  const r = await pool.query<{ ready: boolean }>(`SELECT to_regclass('question_certifications') IS NOT NULL AS ready`);
  return Boolean(r.rows[0]?.ready);
}

/* ------------------------------- DB loaders -------------------------------- */
const ACTIONABLE = `('pending_review','in_review','needs_revision')`;

/**
 * Load certification inputs for a set of questions. JOINs through the genome map to a NON-deprecated
 * competency (the honest genome definition) and computes per-competency duplicate-prompt counts.
 */
async function loadCertInputs(pool: Pool, where: string, args: any[]): Promise<CertInput[]> {
  const rs = await pool.query(`
    WITH dups AS (
      SELECT m.competency_id AS cid, t.template_body->>'prompt' AS prompt, COUNT(DISTINCT t.id)::int n
      FROM competency_question_templates t
      JOIN onto_competency_question_map m ON m.question_id = t.id
      WHERE (t.status='approved' OR t.quality_review_status IN ${ACTIONABLE})
      GROUP BY 1,2
    )
    SELECT t.id AS question_id, m.competency_id, c.canonical_name, c.definition,
           t.question_type, t.difficulty_band, t.template_body,
           t.template_body->>'onto_competency_id' AS onto_competency_id,
           (c.id IS NOT NULL) AS competency_present,
           COALESCE(dp.n, 1) AS prompt_group_size
    FROM competency_question_templates t
    LEFT JOIN onto_competency_question_map m ON m.question_id = t.id
    LEFT JOIN onto_competencies c ON c.id = m.competency_id AND c.deprecated IS NOT TRUE
    LEFT JOIN dups dp ON dp.cid = m.competency_id AND dp.prompt = t.template_body->>'prompt'
    WHERE ${where}`, args);
  return rs.rows.map((r: any) => ({
    question_id: String(r.question_id),
    competency_id: r.competency_id ? String(r.competency_id) : null,
    competency_present: Boolean(r.competency_present),
    canonical_name: r.canonical_name ?? null,
    definition: r.definition ?? null,
    question_type: String(r.question_type || ''),
    difficulty_band: r.difficulty_band ?? null,
    template_body: r.template_body || {},
    onto_competency_id: r.onto_competency_id ?? null,
    duplicate_siblings: Math.max(0, num(r.prompt_group_size) - 1),
  }));
}

async function persistCert(pool: Pool, inp: CertInput, result: CertResult, certifiedBy: string | null) {
  await pool.query(
    `INSERT INTO question_certifications
       (question_id, competency_id, cert_version, cert_score, cert_status, structural_score, heuristic_score, dimensions, certified_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      inp.question_id, inp.competency_id, CERTIFICATION_VERSION,
      result.cert_score, result.cert_status, result.structural_score, result.heuristic_score,
      JSON.stringify({ ...result.dimensions, ai_assist: result.ai_assist }), certifiedBy ? String(certifiedBy) : null,
    ],
  );
}

/* ------------------------------ public ops --------------------------------- */

/** Certify ONE question by id (writes a ledger row). */
export async function certifyQuestion(pool: Pool, questionId: string, certifiedBy?: string | null) {
  await ensureCertificationSchema(pool);
  const inputs = await loadCertInputs(pool, `t.id = $1`, [questionId]);
  if (!inputs.length) return { ok: false as const, error: 'not_found' };
  const result = certifyOne(inputs[0]);
  await persistCert(pool, inputs[0], result, certifiedBy ?? null);
  return { ok: true as const, question_id: questionId, ...result };
}

export type BulkCertifyOptions = {
  competencyId?: string;
  reCertify?: boolean; // re-certify even rows that already have a latest certification
  limit?: number;
  certifiedBy?: string | null;
};

/**
 * Bulk-certify actionable DRAFT questions. Idempotent-friendly: by default SKIPS rows that already
 * carry a certification (re-run is a no-op) unless reCertify=true. NEVER touches approval/coverage.
 */
export async function certifyDrafts(pool: Pool, opts: BulkCertifyOptions = {}) {
  await ensureCertificationSchema(pool);
  const args: any[] = [];
  const where: string[] = [`t.status='draft'`, `t.quality_review_status IN ${ACTIONABLE}`];
  if (opts.competencyId) { args.push(opts.competencyId); where.push(`m.competency_id = $${args.length}`); }
  if (!opts.reCertify) {
    where.push(`NOT EXISTS (SELECT 1 FROM question_certifications qc WHERE qc.question_id = t.id)`);
  }
  let inputs = await loadCertInputs(pool, where.join(' AND '), args);
  if (opts.limit && opts.limit > 0) inputs = inputs.slice(0, opts.limit);

  let certified = 0, needs_review = 0, failed = 0;
  for (const inp of inputs) {
    const result = certifyOne(inp);
    await persistCert(pool, inp, result, opts.certifiedBy ?? null);
    if (result.cert_status === CERT_STATUS.CERTIFIED) certified += 1;
    else if (result.cert_status === CERT_STATUS.NEEDS_REVIEW) needs_review += 1;
    else failed += 1;
  }
  return { ok: true as const, version: CERTIFICATION_VERSION, evaluated: inputs.length, certified, needs_review, failed };
}

/* ------------------------------ read views --------------------------------- */

/** Latest certification per question (the "current" cert). Read-only; degrades pre-schema. */
export async function getCertificationSummary(pool: Pool) {
  if (!(await isCertificationSchemaReady(pool))) {
    return { ok: true, version: CERTIFICATION_VERSION, schema_initialized: false, certified: 0, needs_review: 0, failed: 0, total: 0, uncertified_actionable_drafts: null as number | null, avg_structural: null, avg_heuristic: null, note: 'Certification ledger not initialized — run certification first.' };
  }
  const r = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (question_id) question_id, cert_status, structural_score, heuristic_score
      FROM question_certifications ORDER BY question_id, created_at DESC
    )
    SELECT
      COUNT(*) FILTER (WHERE cert_status='certified')::int certified,
      COUNT(*) FILTER (WHERE cert_status='needs_review')::int needs_review,
      COUNT(*) FILTER (WHERE cert_status='failed')::int failed,
      COUNT(*)::int total,
      ROUND(AVG(structural_score)::numeric,1) avg_structural,
      ROUND(AVG(heuristic_score)::numeric,1) avg_heuristic
    FROM latest`);
  const row = r.rows[0] || {};
  // How many actionable drafts still have NO certification (honest backlog of the cert pipeline).
  const uncertified = num((await pool.query(`
    SELECT COUNT(*)::int c
    FROM competency_question_templates t
    WHERE t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}
      AND NOT EXISTS (SELECT 1 FROM question_certifications qc WHERE qc.question_id = t.id)`)).rows[0]?.c);
  return {
    ok: true, version: CERTIFICATION_VERSION, schema_initialized: true,
    certified: num(row.certified), needs_review: num(row.needs_review), failed: num(row.failed), total: num(row.total),
    uncertified_actionable_drafts: uncertified,
    avg_structural: row.avg_structural == null ? null : Number(row.avg_structural),
    avg_heuristic: row.avg_heuristic == null ? null : Number(row.avg_heuristic),
    confidence_note: 'Structural and heuristic scores are reported SEPARATELY. Structural (duplication/difficulty/alignment) is high-confidence; heuristic (relevance/clarity) is a lexical proxy. Certification is NOT approval.',
  };
}

/** Full certification record for one question (latest + history). Read-only. */
export async function getCertificationForQuestion(pool: Pool, questionId: string) {
  if (!(await isCertificationSchemaReady(pool))) return { ok: true, schema_initialized: false, latest: null, history: [] };
  const hist = (await pool.query(
    `SELECT id, cert_version, cert_score, cert_status, structural_score, heuristic_score, dimensions, certified_by, created_at
     FROM question_certifications WHERE question_id=$1 ORDER BY created_at DESC LIMIT 20`, [questionId])).rows;
  return { ok: true, schema_initialized: true, latest: hist[0] || null, history: hist };
}
