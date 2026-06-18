/**
 * Phase 5 — Governance Engine.
 *
 * Approval workflows for: ontology changes, methodology updates, role DNA, weighting policies.
 * Methodology version registry. Audit framework writes.
 *
 * Mutations write to gov_audit_framework. RBAC is enforced at the route layer.
 */
import type { Pool } from 'pg';

export const GOVERNANCE_VERSION = '5.0.0';

export interface Workflow {
  id: string; name: string; entity_type: string;
  steps: { step: string; required_role: string }[];
  version: string; is_current: boolean;
}

export async function listWorkflows(pool: Pool): Promise<Workflow[]> {
  const { rows } = await pool.query<Workflow>(
    `SELECT id, name, entity_type, steps, version, is_current
       FROM gov_workflows WHERE is_current ORDER BY entity_type`);
  return rows;
}

export interface OntologyReview {
  id: string; workflow_id: string; entity_type: string; entity_id: string;
  proposer: string; reviewer: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  change_diff: Record<string, unknown>;
  rationale: string | null;
  proposed_at: string; decided_at: string | null;
  workflow_name?: string;
  next_step?: string | null;
}

export async function listReviews(pool: Pool, status?: string): Promise<OntologyReview[]> {
  const { rows } = await pool.query<OntologyReview & { steps: Workflow['steps'] }>(
    `SELECT r.*, w.name AS workflow_name, w.steps
       FROM gov_ontology_reviews r
       JOIN gov_workflows w ON w.id = r.workflow_id
      WHERE ($1::text IS NULL OR r.status = $1)
      ORDER BY r.proposed_at DESC LIMIT 200`,
    [status ?? null]);
  return rows.map(r => ({
    ...r,
    next_step: r.status === 'pending'
      ? (r.steps?.find(s => s.step !== 'propose')?.step ?? 'review')
      : null,
  }));
}

export async function proposeReview(pool: Pool, params: {
  workflow_id: string; entity_type: string; entity_id: string;
  proposer: string; change_diff: Record<string, unknown>; rationale: string;
}): Promise<OntologyReview> {
  const id = `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const { rows } = await pool.query<OntologyReview>(
    `INSERT INTO gov_ontology_reviews
     (id, workflow_id, entity_type, entity_id, proposer, change_diff, rationale, status)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'pending')
     RETURNING *`,
    [id, params.workflow_id, params.entity_type, params.entity_id,
     params.proposer, JSON.stringify(params.change_diff), params.rationale]);
  await auditFramework(pool, { action: 'governance.review.propose', actor: params.proposer,
    entity_type: params.entity_type, entity_id: params.entity_id, domain: 'governance',
    payload: { review_id: id, workflow_id: params.workflow_id } });
  return rows[0];
}

export async function decideReview(pool: Pool, params: {
  review_id: string; reviewer: string; decision: 'approved' | 'rejected' | 'escalated';
  rationale?: string;
}): Promise<OntologyReview | null> {
  const { rows } = await pool.query<OntologyReview>(
    `UPDATE gov_ontology_reviews
        SET status = $2, reviewer = $3, decided_at = now(),
            rationale = COALESCE(NULLIF($4, ''), rationale)
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [params.review_id, params.decision, params.reviewer, params.rationale ?? '']);
  if (!rows[0]) return null;
  await auditFramework(pool, { action: `governance.review.${params.decision}`,
    actor: params.reviewer, entity_type: rows[0].entity_type, entity_id: rows[0].entity_id,
    domain: 'governance', payload: { review_id: params.review_id } });
  return rows[0];
}

// ---- methodology versions --------------------------------------------------

export interface MethodologyVersion {
  id: string; methodology_name: string; version: string;
  valid_from: string; valid_to: string | null; is_current: boolean;
  change_summary: string | null; approved_by: string | null;
  approved_at: string | null; references_doc: string | null;
}

export async function listMethodologies(pool: Pool, currentOnly = false): Promise<MethodologyVersion[]> {
  const { rows } = await pool.query<MethodologyVersion>(
    `SELECT * FROM gov_methodology_versions
      WHERE ($1::boolean IS FALSE OR is_current)
      ORDER BY methodology_name, valid_from DESC`, [currentOnly]);
  return rows;
}

// ---- audit framework -------------------------------------------------------

export async function auditFramework(pool: Pool, params: {
  action: string; actor?: string;
  entity_type: string; entity_id?: string;
  domain?: string;
  payload?: Record<string, unknown>;
  ip_address?: string; user_agent?: string; request_id?: string;
  outcome?: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO gov_audit_framework
       (actor, action, entity_type, entity_id, domain, payload, ip_address, user_agent, request_id, outcome)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
      [params.actor ?? null, params.action, params.entity_type, params.entity_id ?? null,
       params.domain ?? 'general', JSON.stringify(params.payload ?? {}),
       params.ip_address ?? null, params.user_agent ?? null,
       params.request_id ?? null, params.outcome ?? 'success']);
  } catch { /* audit must never break the request */ }
}
