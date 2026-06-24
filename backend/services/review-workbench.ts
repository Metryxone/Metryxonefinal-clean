/**
 * MX-101B — Review Workbench (Phase 2) + review backlog / reviewer productivity (Phase 4).
 *
 * ADDITIVE, flag-gated (`assessmentReadiness`). It COMPOSES the EXISTING human approval state
 * machine (`reviewQuestion` in question-factory.ts) over an EXPLICIT, reviewer-selected set of
 * question ids — it does NOT introduce a new approval path and NEVER auto-approves.
 *
 * GOVERNANCE GUARDRAILS:
 *   - Bulk operations require an EXPLICIT array of ids chosen by a human in the workbench. There is
 *     NO "approve everything" selector and NO scheduled/automatic approval — a human is always in
 *     the loop. Reaching assessment-ready coverage is therefore a human action; this layer only
 *     makes that action efficient by pre-filtering to certification-passed drafts.
 *   - Every action is appended to an immutable audit ledger (`qf_review_audit`) with the reviewer
 *     id and the before/after state, so reviewer productivity is measured from REAL recorded work.
 *   - Approve remains the ONLY coverage-changing op (delegated to reviewQuestion); certification is
 *     never treated as approval.
 *   - GET-never-writes: read views probe with to_regclass and degrade to honest-empty pre-schema.
 */
import type { Pool } from 'pg';
import { reviewQuestion, type ReviewAction } from './question-factory';

export const WORKBENCH_VERSION = 'mx101b-workbench-1.0.0';

const ACTIONABLE = `('pending_review','in_review','needs_revision')`;
const MAX_BULK = 1000; // a single call processes at most this many ids (the human can submit more calls)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: any) => Number(v ?? 0) || 0;

/* --------------------------------- schema ---------------------------------- */
export async function ensureWorkbenchSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qf_review_audit (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id           uuid,
      question_id        uuid NOT NULL,
      competency_id      varchar(80),
      action             text NOT NULL,
      prev_status        text,
      prev_review_status text,
      new_status         text,
      new_review_status  text,
      cert_status        text,
      reviewer_id        text,
      created_at         timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qfra_reviewer ON qf_review_audit (reviewer_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qfra_batch ON qf_review_audit (batch_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_qfra_question ON qf_review_audit (question_id, created_at DESC);`);
}

export async function isWorkbenchSchemaReady(pool: Pool): Promise<boolean> {
  const r = await pool.query<{ ready: boolean }>(`SELECT to_regclass('qf_review_audit') IS NOT NULL AS ready`);
  return Boolean(r.rows[0]?.ready);
}

async function certReady(pool: Pool): Promise<boolean> {
  const r = await pool.query<{ ready: boolean }>(`SELECT to_regclass('question_certifications') IS NOT NULL AS ready`);
  return Boolean(r.rows[0]?.ready);
}

/* ------------------------------ bulk review -------------------------------- */
export type BulkReviewInput = {
  ids: string[];
  action: ReviewAction;
  reviewerId?: string | null;
  /** For action='approve': only approve ids whose LATEST certification is 'certified'; skip the rest. */
  certifiedOnly?: boolean;
};

/**
 * Apply a review ACTION to an EXPLICIT set of ids by delegating to reviewQuestion one-by-one.
 * Returns a precise breakdown (applied / skipped / errors) and writes an audit row per applied id.
 * Never throws on a per-row failure — it isolates and reports it.
 */
export async function bulkReview(pool: Pool, input: BulkReviewInput) {
  const rawIds = Array.from(new Set((input.ids || []).map((x) => String(x || '').trim()).filter(Boolean)));
  if (!rawIds.length) return { ok: false as const, error: 'no_ids', note: 'Bulk review requires an explicit, non-empty array of question ids selected by a reviewer.' };
  if (!['start_review', 'request_changes', 'reject', 'approve'].includes(input.action)) return { ok: false as const, error: 'invalid_action' };
  if (rawIds.length > MAX_BULK) return { ok: false as const, error: 'too_many_ids', max: MAX_BULK, received: rawIds.length };

  // never-throws: partition malformed uuids into errors so the `ANY($1::uuid[])` cast can't 500 and
  // per-row isolation is preserved (a bad id never aborts the valid ones).
  const ids = rawIds.filter((x) => UUID_RE.test(x));
  const badIds = rawIds.filter((x) => !UUID_RE.test(x));
  if (!ids.length) return { ok: false as const, error: 'no_valid_ids', note: 'No requested id is a valid uuid.', errors: badIds.map((id) => ({ id, error: 'invalid_id' })) };

  await ensureWorkbenchSchema(pool);
  const haveCert = await certReady(pool);
  const reviewerId = input.reviewerId ? String(input.reviewerId) : null;
  const batchId = (await pool.query<{ id: string }>(`SELECT gen_random_uuid() AS id`)).rows[0].id;

  // Pull current state + latest cert + competency for every requested id (single query).
  const certJoin = haveCert
    ? `LEFT JOIN LATERAL (SELECT cert_status FROM question_certifications qc WHERE qc.question_id=t.id ORDER BY created_at DESC LIMIT 1) c ON true`
    : '';
  const state = await pool.query(`
    SELECT t.id, t.status, t.quality_review_status,
           (SELECT m.competency_id FROM onto_competency_question_map m WHERE m.question_id=t.id LIMIT 1) AS competency_id,
           ${haveCert ? 'c.cert_status' : 'NULL'} AS cert_status
    FROM competency_question_templates t
    ${certJoin}
    WHERE t.id = ANY($1::uuid[])`, [ids]);
  const byId = new Map<string, any>(state.rows.map((r: any) => [String(r.id), r]));

  const applied: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const cur = byId.get(id);
    if (!cur) { errors.push({ id, error: 'not_found' }); continue; }
    // Fast-track guardrail: when approving with certifiedOnly, only certified drafts pass.
    if (input.action === 'approve' && input.certifiedOnly && cur.cert_status !== 'certified') {
      skipped.push({ id, reason: cur.cert_status ? `cert_status=${cur.cert_status}` : 'not_certified' });
      continue;
    }
    try {
      const res = await reviewQuestion(pool, id, input.action, reviewerId);
      if (!res.ok) { errors.push({ id, error: (res as any).error || 'review_failed' }); continue; }
      const row: any = (res as any).row || {};
      await pool.query(
        `INSERT INTO qf_review_audit
           (batch_id, question_id, competency_id, action, prev_status, prev_review_status, new_status, new_review_status, cert_status, reviewer_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [batchId, id, cur.competency_id || null, input.action, cur.status, cur.quality_review_status, row.status ?? null, row.quality_review_status ?? null, cur.cert_status || null, reviewerId],
      );
      applied.push(id);
    } catch (e: any) {
      errors.push({ id, error: e?.message ? String(e.message).slice(0, 200) : 'exception' });
    }
  }

  for (const id of badIds) errors.push({ id, error: 'invalid_id' });

  return {
    ok: true as const, version: WORKBENCH_VERSION, batch_id: batchId, action: input.action,
    requested: rawIds.length, applied: applied.length, skipped, errors,
    coverage_note: input.action === 'approve'
      ? 'Approve is the only coverage-changing op and was applied only to the explicit ids you selected. Live assessment-ready coverage reflects exactly these human approvals — nothing was auto-approved.'
      : 'No coverage change — this action only moves the review state.',
  };
}

/* ------------------------------ SME queue ---------------------------------- */
export type QueueFilters = { competencyId?: string; reviewStatus?: string; certStatus?: string; limit?: number };

/**
 * SME review queue: actionable DRAFTs joined with their latest certification + downstream demand
 * (Role-DNA reference count) so a reviewer can triage certified-first / high-demand-first. Read-only.
 */
export async function getSmeQueue(pool: Pool, f: QueueFilters = {}) {
  const ready = await isWorkbenchSchemaReady(pool);
  const haveCert = await certReady(pool);
  const args: any[] = [];
  const where: string[] = [`t.status='draft'`];
  if (f.reviewStatus) { args.push(f.reviewStatus); where.push(`t.quality_review_status = $${args.length}`); }
  else where.push(`t.quality_review_status IN ${ACTIONABLE}`);
  if (f.competencyId) { args.push(f.competencyId); where.push(`m.competency_id = $${args.length}`); }
  const limit = Math.min(Math.max(num(f.limit) || 100, 1), 500);

  const certSel = haveCert ? `c.cert_status, c.cert_score, c.structural_score, c.heuristic_score` : `NULL AS cert_status, NULL AS cert_score, NULL AS structural_score, NULL AS heuristic_score`;
  const certJoin = haveCert
    ? `LEFT JOIN LATERAL (SELECT cert_status, cert_score, structural_score, heuristic_score FROM question_certifications qc WHERE qc.question_id=t.id ORDER BY created_at DESC LIMIT 1) c ON true`
    : '';
  if (f.certStatus && haveCert) { args.push(f.certStatus); where.push(`c.cert_status = $${args.length}`); }

  const rs = await pool.query(`
    SELECT t.id, m.competency_id, comp.canonical_name, t.question_type, t.difficulty_band,
           t.template_body->>'prompt' AS prompt, t.quality_review_status, t.confidence_score,
           t.created_at,
           COALESCE((SELECT COUNT(*)::int FROM onto_role_weights w WHERE w.competency_id=m.competency_id),0) AS dna_demand,
           ${certSel}
    FROM competency_question_templates t
    LEFT JOIN onto_competency_question_map m ON m.question_id=t.id
    LEFT JOIN onto_competencies comp ON comp.id=m.competency_id AND comp.deprecated IS NOT TRUE
    ${certJoin}
    WHERE ${where.join(' AND ')}
    ORDER BY ${haveCert ? `(c.cert_status='certified') DESC NULLS LAST,` : ''} dna_demand DESC, t.created_at ASC
    LIMIT ${limit}`, args);

  return {
    ok: true, version: WORKBENCH_VERSION, schema_initialized: ready, certification_available: haveCert,
    count: rs.rows.length, items: rs.rows.map((r: any) => ({
      id: String(r.id), competency_id: r.competency_id ? String(r.competency_id) : null, competency: r.canonical_name ?? null,
      question_type: r.question_type, difficulty_band: r.difficulty_band, prompt: r.prompt,
      review_status: r.quality_review_status, confidence_score: r.confidence_score == null ? null : Number(r.confidence_score),
      dna_demand: num(r.dna_demand),
      cert_status: r.cert_status ?? null,
      cert_score: r.cert_score == null ? null : Number(r.cert_score),
      structural_score: r.structural_score == null ? null : Number(r.structural_score),
      heuristic_score: r.heuristic_score == null ? null : Number(r.heuristic_score),
    })),
    note: haveCert ? 'Certified drafts are listed first for fast-track review; certification is a hint, not approval.' : 'Run certification to enable certified-first triage.',
  };
}

/* ----------------------- backlog + reviewer productivity ------------------- */

/** Review backlog: actionable drafts pending, by review status, age, and certification status. */
export async function getReviewBacklog(pool: Pool) {
  const haveCert = await certReady(pool);
  const byStatus = (await pool.query(`
    SELECT quality_review_status, COUNT(*)::int n
    FROM competency_question_templates
    WHERE status='draft' AND quality_review_status IN ${ACTIONABLE}
    GROUP BY 1 ORDER BY 2 DESC`)).rows.map((r: any) => ({ review_status: r.quality_review_status, n: num(r.n) }));

  const byAge = (await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int last_7d,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days' AND created_at >= NOW() - INTERVAL '30 days')::int d7_30,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days')::int older_30d,
      COUNT(*)::int total
    FROM competency_question_templates
    WHERE status='draft' AND quality_review_status IN ${ACTIONABLE}`)).rows[0] || {};

  let byCert: any = null;
  if (haveCert) {
    byCert = (await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (qc.question_id) qc.question_id, qc.cert_status
        FROM question_certifications qc
        JOIN competency_question_templates t ON t.id=qc.question_id
        WHERE t.status='draft' AND t.quality_review_status IN ${ACTIONABLE}
        ORDER BY qc.question_id, qc.created_at DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE cert_status='certified')::int certified,
        COUNT(*) FILTER (WHERE cert_status='needs_review')::int needs_review,
        COUNT(*) FILTER (WHERE cert_status='failed')::int failed
      FROM latest`)).rows[0] || {};
    byCert = { certified: num(byCert.certified), needs_review: num(byCert.needs_review), failed: num(byCert.failed) };
  }

  return {
    ok: true, version: WORKBENCH_VERSION,
    total_pending: num(byAge.total),
    by_review_status: byStatus,
    by_age: { last_7d: num(byAge.last_7d), days_7_to_30: num(byAge.d7_30), older_than_30d: num(byAge.older_30d) },
    by_certification: byCert,
    certification_available: haveCert,
    note: 'Backlog = generated drafts awaiting human review. It is a pipeline measure, NOT coverage.',
  };
}

/**
 * Reviewer productivity. The canonical record of who reviewed what is the templates table's
 * reviewed_by/reviewed_at (set by the approval state machine); the audit ledger adds an action
 * timeline. Honest limitation: reviewed_by holds only the MOST RECENT reviewer per question.
 */
export async function getReviewerProductivity(pool: Pool) {
  const auditReady = await isWorkbenchSchemaReady(pool);
  // Current per-reviewer outcome counts from the canonical reviewed_by column.
  const reviewers = (await pool.query(`
    SELECT reviewed_by AS reviewer_id,
      COUNT(*) FILTER (WHERE quality_review_status='approved')::int approved,
      COUNT(*) FILTER (WHERE quality_review_status='rejected')::int rejected,
      COUNT(*) FILTER (WHERE quality_review_status='retired')::int retired,
      MAX(reviewed_at) AS last_review_at
    FROM competency_question_templates
    WHERE reviewed_by IS NOT NULL
    GROUP BY reviewed_by
    ORDER BY approved DESC, rejected DESC`)).rows.map((r: any) => ({
      reviewer_id: r.reviewer_id, approved: num(r.approved), rejected: num(r.rejected), retired: num(r.retired),
      last_review_at: r.last_review_at,
    }));

  let recent_actions: any[] = [];
  let actions_30d = 0;
  if (auditReady) {
    recent_actions = (await pool.query(`
      SELECT reviewer_id, action, COUNT(*)::int n
      FROM qf_review_audit WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1,2 ORDER BY 3 DESC LIMIT 50`)).rows.map((r: any) => ({ reviewer_id: r.reviewer_id, action: r.action, n: num(r.n) }));
    actions_30d = num((await pool.query(`SELECT COUNT(*)::int c FROM qf_review_audit WHERE created_at >= NOW() - INTERVAL '30 days'`)).rows[0]?.c);
  }

  return {
    ok: true, version: WORKBENCH_VERSION, audit_initialized: auditReady,
    reviewers, recent_actions, actions_last_30d: actions_30d,
    note: 'Outcome counts come from the canonical reviewed_by column (most-recent reviewer per question). The audit timeline (actions_last_30d) covers bulk-workbench actions.',
  };
}
