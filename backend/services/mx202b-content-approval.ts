/**
 * MX-202B — Governed approval mechanism for competency content drafts.
 *
 * This is the ONLY path that turns a DRAFT into live canonical content. Nothing else promotes.
 * It mirrors the Question Factory's human-approval pattern (reviewQuestion) for non-question
 * attributes. Reuses onto_audit_logs (audit) + onto_competency_versions (version snapshot) —
 * NO new audit/version engine.
 *
 * Reversible: approveContentDraft writes the promoted canonical row with source='mx202b' +
 * draft_id back-reference; unapproveContentDraft deletes that row and returns the draft to
 * 'draft'. Indicator promotions (onto_indicators has no draft_id/source) are tracked via the
 * draft row's content._promoted_id so they can be reversed too.
 */
import type { Pool } from 'pg';

export type ApprovalResult = { ok: boolean; reason?: string; draft_id: number; attribute_type?: string; promoted_id?: number | null };

export const HOME_BY_ATTR: Record<string, { table: string; cols: string[]; build: (d: any) => any[] }> = {
  evidence_requirement: {
    table: 'onto_competency_evidence',
    cols: ['competency_id', 'proficiency_level', 'evidence', 'evidence_type', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.proficiency_level, d.content_text, d.content?.evidence_type ?? null, d.provenance, 'mx202b', d.id],
  },
  learning_outcome: {
    table: 'onto_competency_learning_outcomes',
    cols: ['competency_id', 'proficiency_level', 'outcome', 'bloom_level', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.proficiency_level, d.content_text, d.content?.bloom_level ?? null, d.provenance, 'mx202b', d.id],
  },
  function_map: {
    table: 'onto_competency_function_map',
    cols: ['competency_id', 'function_name', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.content?.function_name ?? d.content_text, d.provenance, 'mx202b', d.id],
  },
  industry_map: {
    table: 'onto_competency_industry_map',
    cols: ['competency_id', 'industry_name', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.content?.industry_name ?? d.content_text, d.provenance, 'mx202b', d.id],
  },
  department_map: {
    table: 'onto_competency_department_map',
    cols: ['competency_id', 'department_name', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.content?.department_name ?? d.content_text, d.provenance, 'mx202b', d.id],
  },
  // ── MX-203 new expert-authored canonical homes (reuse this ONE promotion engine; never duplicate) ──
  coaching_guidance: {
    table: 'onto_competency_coaching_guidance',
    cols: ['competency_id', 'proficiency_level', 'guidance', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.proficiency_level, d.content_text, d.provenance, d.source ?? 'mx203', d.id],
  },
  interview_guidance: {
    table: 'onto_competency_interview_guidance',
    cols: ['competency_id', 'proficiency_level', 'guidance', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.proficiency_level, d.content_text, d.provenance, d.source ?? 'mx203', d.id],
  },
  development_activity: {
    table: 'onto_competency_development_activity',
    cols: ['competency_id', 'proficiency_level', 'activity', 'provenance', 'source', 'draft_id'],
    build: (d) => [d.competency_id, d.proficiency_level, d.content_text, d.provenance, d.source ?? 'mx203', d.id],
  },
};

async function loadDraft(pool: Pool, draftId: number): Promise<any | null> {
  const r = await pool.query(`SELECT * FROM onto_competency_content_drafts WHERE id=$1`, [draftId]);
  return r.rows[0] ?? null;
}

export async function approveContentDraft(pool: Pool, draftId: number, reviewer: string, notes?: string): Promise<ApprovalResult> {
  const d = await loadDraft(pool, draftId);
  if (!d) return { ok: false, reason: 'draft_not_found', draft_id: draftId };
  if (d.status === 'approved') return { ok: false, reason: 'already_approved', draft_id: draftId };
  // Verified and human-Approved are INDEPENDENT lifecycles (Controlled Enterprise Activation).
  // A verified draft already has a canonical home row (lifecycle='verified'); approving it again
  // would insert a duplicate and collapse the two tracks. Reject (unverify first to re-route).
  if (d.status === 'verified') return { ok: false, reason: 'already_verified', draft_id: draftId };
  if (d.status === 'rejected' || d.status === 'archived') return { ok: false, reason: `not_approvable:${d.status}`, draft_id: draftId };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let promotedId: number | null = null;

    if (d.attribute_type === 'behavioural_indicator' || d.attribute_type === 'observable_behaviour' || d.attribute_type === 'proficiency_anchor') {
      const ins = await client.query(
        `INSERT INTO onto_indicators (competency_id, indicator, proficiency_level, display_order)
         VALUES ($1,$2,$3, COALESCE((SELECT MAX(display_order)+1 FROM onto_indicators WHERE competency_id=$1),1))
         RETURNING id`,
        [d.competency_id, d.content_text, d.proficiency_level]);
      promotedId = Number(ins.rows[0].id);
      await client.query(
        `UPDATE onto_competency_content_drafts SET content = jsonb_set(content, '{_promoted_id}', to_jsonb($2::bigint)) WHERE id=$1`,
        [draftId, promotedId]);
    } else {
      const home = HOME_BY_ATTR[d.attribute_type];
      if (!home) { await client.query('ROLLBACK'); return { ok: false, reason: `no_home_for_attribute:${d.attribute_type}`, draft_id: draftId }; }
      const placeholders = home.cols.map((_, i) => `$${i + 1}`).join(',');
      const ins = await client.query(
        `INSERT INTO ${home.table} (${home.cols.join(',')}) VALUES (${placeholders}) RETURNING id`,
        home.build(d));
      promotedId = Number(ins.rows[0].id);
    }

    await client.query(
      `UPDATE onto_competency_content_drafts SET status='approved', needs_review=FALSE, reviewed_by=$2, reviewed_at=now(), review_notes=$3, updated_at=now() WHERE id=$1`,
      [draftId, reviewer, notes ?? null]);

    // version snapshot + audit (reuse existing tables)
    await client.query(
      `INSERT INTO onto_competency_versions (competency_id, version, snapshot, changed_by, change_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [d.competency_id, `mx202b-approve-${draftId}`, JSON.stringify({ draft_id: draftId, attribute_type: d.attribute_type, content: d.content, promoted_id: promotedId }), reviewer, 'MX-202B content draft approved → promoted to canonical home']);
    await client.query(
      `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, before_state, after_state)
       VALUES ('mx202b_content_draft', $1, 'approve', $2, $3, $4, $5)`,
      [String(draftId), reviewer, notes ?? 'approved', JSON.stringify({ status: d.status }), JSON.stringify({ status: 'approved', attribute_type: d.attribute_type, promoted_id: promotedId })]);

    await client.query('COMMIT');
    return { ok: true, draft_id: draftId, attribute_type: d.attribute_type, promoted_id: promotedId };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, reason: (err as Error).message, draft_id: draftId };
  } finally {
    client.release();
  }
}

export async function unapproveContentDraft(pool: Pool, draftId: number, reviewer: string): Promise<ApprovalResult> {
  const d = await loadDraft(pool, draftId);
  if (!d) return { ok: false, reason: 'draft_not_found', draft_id: draftId };
  if (d.status !== 'approved') return { ok: false, reason: 'not_approved', draft_id: draftId };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (d.attribute_type === 'behavioural_indicator' || d.attribute_type === 'observable_behaviour' || d.attribute_type === 'proficiency_anchor') {
      const pid = d.content?._promoted_id;
      if (pid) await client.query(`DELETE FROM onto_indicators WHERE id=$1`, [pid]);
      await client.query(`UPDATE onto_competency_content_drafts SET content = content - '_promoted_id' WHERE id=$1`, [draftId]);
    } else {
      const home = HOME_BY_ATTR[d.attribute_type];
      if (home) await client.query(`DELETE FROM ${home.table} WHERE draft_id=$1`, [draftId]);
    }
    await client.query(
      `UPDATE onto_competency_content_drafts SET status='draft', needs_review=TRUE, reviewed_by=NULL, reviewed_at=NULL, updated_at=now() WHERE id=$1`,
      [draftId]);
    await client.query(
      `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, after_state)
       VALUES ('mx202b_content_draft', $1, 'unapprove', $2, 'reverted to draft', $3)`,
      [String(draftId), reviewer, JSON.stringify({ status: 'draft' })]);
    await client.query('COMMIT');
    return { ok: true, draft_id: draftId, attribute_type: d.attribute_type };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, reason: (err as Error).message, draft_id: draftId };
  } finally {
    client.release();
  }
}
