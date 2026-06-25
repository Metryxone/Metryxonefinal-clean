/**
 * MX-202B — Controlled Enterprise Activation: Verified lifecycle.
 *
 * Founder directive: govern source-backed FACTUAL knowledge INDEPENDENTLY from
 * expert-authored / interpretive knowledge.
 *
 *   governance_track = 'factual'         → draft → VERIFIED. Deterministic, evidence-backed,
 *                                          provenance-verified content that needs NO human
 *                                          judgement may auto-promote into its canonical home
 *                                          with lifecycle='verified'.
 *   governance_track = 'expert_authored' → draft → APPROVED. Everything rule-generated /
 *                                          AI-generated / behavioural / interpretive / narrative
 *                                          / learning / coaching / interview / evidence stays in
 *                                          Draft with needs_review=true until a HUMAN approves it
 *                                          (mx202b-content-approval.ts is that gate).
 *
 * HONESTY: a draft becomes 'factual' ONLY when its provenance is genuinely source-backed
 * (see SOURCE_BACKED_PROVENANCE) AND its attribute is a factual-class mapping. rule_based and
 * ai provenance can NEVER be auto-verified — relabeling them would fabricate provenance.
 *
 * This module REUSES HOME_BY_ATTR from mx202b-content-approval.ts (no duplicate promotion
 * engine) and onto_audit_logs + onto_competency_versions (no new audit/version engine).
 * Fully reversible: unverifyContent() deletes the promoted home row and returns the draft to
 * 'draft'. Zero rows promoted is a valid, honest outcome.
 */
import type { Pool } from 'pg';
import { HOME_BY_ATTR } from './mx202b-content-approval';

/** Provenances that are genuinely source-backed and may carry the factual track. */
export const SOURCE_BACKED_PROVENANCE = new Set(['onet', 'crosswalk', 'canonical', 'role_dna', 'benchmark', 'verified', 'imported']);

/** Attribute types that CAN be factual when (and only when) source-backed. */
export const FACTUAL_ATTRIBUTES = new Set(['function_map', 'industry_map', 'department_map', 'role_relevance', 'onet_crosswalk']);

/** Attribute types that are ALWAYS expert-authored / interpretive regardless of provenance. */
export const ALWAYS_EXPERT_ATTRIBUTES = new Set(['behavioural_indicator', 'observable_behaviour', 'proficiency_anchor', 'evidence_requirement', 'learning_outcome']);

export type GovernanceTrack = 'factual' | 'expert_authored';

/** Deterministic classifier — never promotes interpretive or rule_based content. */
export function classifyGovernanceTrack(draft: { attribute_type: string; provenance: string }): GovernanceTrack {
  if (ALWAYS_EXPERT_ATTRIBUTES.has(draft.attribute_type)) return 'expert_authored';
  if (FACTUAL_ATTRIBUTES.has(draft.attribute_type) && SOURCE_BACKED_PROVENANCE.has(draft.provenance)) return 'factual';
  return 'expert_authored';
}

export type ClassifyResult = { factual: number; expert_authored: number; total: number };

/** Re-classify every mx202b draft's governance_track. Reversible (column-only update). */
export async function applyGovernanceTracks(pool: Pool): Promise<ClassifyResult> {
  const rows = (await pool.query(
    `SELECT id, attribute_type, provenance FROM onto_competency_content_drafts WHERE source='mx202b'`)).rows;
  let factual = 0, expert = 0;
  for (const r of rows) {
    const track = classifyGovernanceTrack(r);
    if (track === 'factual') factual++; else expert++;
    await pool.query(`UPDATE onto_competency_content_drafts SET governance_track=$2, updated_at=now() WHERE id=$1`, [r.id, track]);
  }
  return { factual, expert_authored: expert, total: rows.length };
}

export type VerifyPromotionResult = {
  promoted: number;
  skipped: number;
  promoted_ids: number[];
  skip_reasons: Record<string, number>;
  candidates_examined: number;
};

/**
 * Auto-promote ONLY factual, source-backed, deterministic drafts into their canonical home,
 * marked lifecycle='verified', status='verified'. Audited + versioned. Reversible.
 * Returns honest counts; promoting 0 is correct when no draft is source-backed.
 */
export async function promoteVerifiedContent(pool: Pool, actor = 'mx202b-controlled-activation'): Promise<VerifyPromotionResult> {
  const candidates = (await pool.query(
    `SELECT * FROM onto_competency_content_drafts
     WHERE source='mx202b' AND status='draft' AND governance_track='factual'`)).rows;
  const out: VerifyPromotionResult = { promoted: 0, skipped: 0, promoted_ids: [], skip_reasons: {}, candidates_examined: candidates.length };
  const skip = (reason: string) => { out.skipped++; out.skip_reasons[reason] = (out.skip_reasons[reason] ?? 0) + 1; };

  for (const d of candidates) {
    // Defensive re-check: never verify interpretive or non-source-backed content.
    if (!SOURCE_BACKED_PROVENANCE.has(d.provenance)) { skip(`provenance_not_source_backed:${d.provenance}`); continue; }
    if (ALWAYS_EXPERT_ATTRIBUTES.has(d.attribute_type)) { skip(`always_expert:${d.attribute_type}`); continue; }
    const home = HOME_BY_ATTR[d.attribute_type];
    if (!home) { skip(`no_home:${d.attribute_type}`); continue; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cols = [...home.cols, 'lifecycle'];
      const vals = [...home.build(d), 'verified'];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
      const ins = await client.query(
        `INSERT INTO ${home.table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING id`, vals);
      const promotedId = Number(ins.rows[0].id);
      await client.query(
        `UPDATE onto_competency_content_drafts
         SET status='verified', needs_review=FALSE, verified_by=$2, verified_at=now(), updated_at=now() WHERE id=$1`,
        [d.id, actor]);
      await client.query(
        `INSERT INTO onto_competency_versions (competency_id, version, snapshot, changed_by, change_reason)
         VALUES ($1,$2,$3,$4,$5)`,
        [d.competency_id, `mx202b-verify-${d.id}`, JSON.stringify({ draft_id: d.id, attribute_type: d.attribute_type, provenance: d.provenance, promoted_id: promotedId, lifecycle: 'verified' }), actor, 'MX-202B factual draft auto-verified → promoted (source-backed, no human judgement)']);
      await client.query(
        `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, before_state, after_state)
         VALUES ('mx202b_content_draft',$1,'verify',$2,$3,$4,$5)`,
        [String(d.id), actor, `auto-verified (provenance=${d.provenance})`, JSON.stringify({ status: 'draft' }), JSON.stringify({ status: 'verified', lifecycle: 'verified', promoted_id: promotedId })]);
      await client.query('COMMIT');
      out.promoted++; out.promoted_ids.push(d.id);
    } catch (err) {
      await client.query('ROLLBACK');
      skip(`error:${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return out;
}

/** Reverse a verified promotion — delete the home row, return draft to 'draft'. */
export async function unverifyContent(pool: Pool, draftId: number, actor = 'mx202b-controlled-activation'): Promise<{ ok: boolean; reason?: string }> {
  const d = (await pool.query(`SELECT * FROM onto_competency_content_drafts WHERE id=$1`, [draftId])).rows[0];
  if (!d) return { ok: false, reason: 'draft_not_found' };
  if (d.status !== 'verified') return { ok: false, reason: 'not_verified' };
  const home = HOME_BY_ATTR[d.attribute_type];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (home) await client.query(`DELETE FROM ${home.table} WHERE draft_id=$1 AND lifecycle='verified'`, [draftId]);
    await client.query(
      `UPDATE onto_competency_content_drafts SET status='draft', needs_review=TRUE, verified_by=NULL, verified_at=NULL, updated_at=now() WHERE id=$1`,
      [draftId]);
    await client.query(
      `INSERT INTO onto_competency_versions (competency_id, version, snapshot, changed_by, change_reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [d.competency_id, `mx202b-unverify-${draftId}`, JSON.stringify({ draft_id: draftId, attribute_type: d.attribute_type, provenance: d.provenance, lifecycle: 'draft' }), actor, 'MX-202B verified promotion reversed → draft (reversible)']);
    await client.query(
      `INSERT INTO onto_audit_logs (entity_type, entity_id, action, actor, reason, before_state, after_state)
       VALUES ('mx202b_content_draft',$1,'unverify',$2,'verified promotion reversed',$3,$4)`,
      [String(draftId), actor, JSON.stringify({ status: 'verified' }), JSON.stringify({ status: 'draft' })]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, reason: (err as Error).message };
  } finally {
    client.release();
  }
}
