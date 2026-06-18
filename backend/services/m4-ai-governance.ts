/**
 * Phase 4 — AI Governance Engine (v4.0.0)
 *
 * Manages policies, model registry/versions, decision + explainability logs,
 * risk classifications, hallucination flags, and audit events.
 *
 * Safe-language policy is the canonical gate: any AI output passing through
 * `checkLanguage()` is scrubbed for forbidden phrases before being persisted.
 */
import type { Pool } from 'pg';

export const AI_GOVERNANCE_VERSION = '4.0.0';

const FORBIDDEN_DEFAULTS = [
  'will fail', 'not suitable', 'poor candidate', 'cannot succeed',
  'guaranteed promotion', 'hiring prediction', 'will be hired',
  'psychological diagnosis', 'mentally ill',
];

const ALLOWED_DEFAULTS = [
  'capability alignment', 'developmental readiness', 'leadership proximity',
  'role readiness', 'capability evolution', 'trajectory indicator',
];

export type LanguageCheck = {
  passed: boolean;
  forbidden_hits: string[];
  allowed_present: string[];
};

export function checkLanguage(text: string, opts?: { forbidden?: string[]; allowed?: string[] }): LanguageCheck {
  const forbidden = (opts?.forbidden ?? FORBIDDEN_DEFAULTS).map(s => s.toLowerCase());
  const allowed = (opts?.allowed ?? ALLOWED_DEFAULTS).map(s => s.toLowerCase());
  const t = String(text ?? '').toLowerCase();
  const forbidden_hits = forbidden.filter(p => t.includes(p));
  const allowed_present = allowed.filter(p => t.includes(p));
  return { passed: forbidden_hits.length === 0, forbidden_hits, allowed_present };
}

const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function createAIGovernance(pool: Pool) {
  async function policies(category?: string) {
    const { rows } = await pool.query(
      category
        ? `SELECT * FROM m4_ai_governance_policies WHERE active = TRUE AND category = $1 ORDER BY policy_code`
        : `SELECT * FROM m4_ai_governance_policies WHERE active = TRUE ORDER BY category, policy_code`,
      category ? [category] : []);
    return rows;
  }

  async function models() {
    const { rows } = await pool.query(
      `SELECT r.*, COALESCE(json_agg(json_build_object('version', v.version, 'status', v.status, 'released_at', v.released_at)
                                     ORDER BY v.released_at DESC) FILTER (WHERE v.id IS NOT NULL), '[]') AS versions
       FROM m4_ai_model_registry r
       LEFT JOIN m4_ai_model_versions v ON v.model_id = r.id
       GROUP BY r.id ORDER BY r.family, r.model_code`);
    return rows;
  }

  async function registerVersion(modelId: string, version: string, changelog?: string, rollbackTo?: string) {
    const id = newId('m4mv');
    await pool.query(
      `INSERT INTO m4_ai_model_versions(id, model_id, version, changelog, rollback_to, status)
       VALUES ($1,$2,$3,$4,$5,'active')`,
      [id, modelId, version, changelog ?? null, rollbackTo ?? null]);
    await pool.query(`UPDATE m4_ai_model_registry SET current_version = $1 WHERE id = $2`, [version, modelId]);
    return { id, modelId, version };
  }

  async function rollback(modelId: string, toVersion: string) {
    await pool.query(`UPDATE m4_ai_model_versions SET status = 'rolled_back' WHERE model_id = $1 AND status = 'active' AND version <> $2`, [modelId, toVersion]);
    await pool.query(`UPDATE m4_ai_model_versions SET status = 'active' WHERE model_id = $1 AND version = $2`, [modelId, toVersion]);
    await pool.query(`UPDATE m4_ai_model_registry SET current_version = $1 WHERE id = $2`, [toVersion, modelId]);
    return { modelId, rolled_back_to: toVersion };
  }

  /**
   * Log an AI decision with explainability + language gating + optional hallucination flag.
   * Returns decision id + language check.
   */
  async function logDecision(args: {
    model_id?: string; decision_type: string; subject_id?: string;
    input_hash?: string; output_summary?: any; rationale: string;
    confidence?: number; envelope?: any;
  }) {
    const langCheck = checkLanguage(args.rationale);
    const fairness_status = 'unknown'; // resolved later by fairness engine when applicable
    const id = newId('m4dec');
    await pool.query(
      `INSERT INTO m4_ai_decision_logs(id, model_id, decision_type, subject_id, input_hash, output_summary, confidence, fairness_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, args.model_id ?? null, args.decision_type, args.subject_id ?? null,
       args.input_hash ?? null, JSON.stringify(args.output_summary ?? {}),
       args.confidence ?? null, fairness_status]);
    // Safe-language gate: redact forbidden phrases before persisting per LANG_SAFE policy.
    let persisted_rationale = args.rationale;
    if (!langCheck.passed) {
      for (const phrase of langCheck.forbidden_hits) {
        const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        persisted_rationale = persisted_rationale.replace(re, '[REDACTED]');
      }
    }
    if (args.envelope || args.rationale) {
      await pool.query(
        `INSERT INTO m4_ai_explainability_logs(id, decision_id, envelope, rationale, language_check)
         VALUES ($1,$2,$3,$4,$5)`,
        [newId('m4exp'), id, JSON.stringify(args.envelope ?? {}), persisted_rationale, JSON.stringify(langCheck)]);
    }
    if (!langCheck.passed) {
      await pool.query(
        `INSERT INTO m4_ai_hallucination_flags(id, decision_id, flag_type, severity, detail)
         VALUES ($1,$2,'policy_violation','high',$3)`,
        [newId('m4hf'), id, `Forbidden phrases redacted: ${langCheck.forbidden_hits.join(', ')}`]);
    }
    return { decision_id: id, language_check: langCheck, persisted_rationale };
  }

  async function decisions(opts: { subjectId?: string; modelId?: string; limit?: number } = {}) {
    const lim = Math.min(opts.limit ?? 50, 200);
    const parts: string[] = []; const params: any[] = [];
    if (opts.subjectId) { params.push(opts.subjectId); parts.push(`subject_id = $${params.length}`); }
    if (opts.modelId)   { params.push(opts.modelId);   parts.push(`model_id   = $${params.length}`); }
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM m4_ai_decision_logs ${where} ORDER BY created_at DESC LIMIT ${lim}`, params);
    return rows;
  }

  async function explainabilityFor(decisionId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM m4_ai_explainability_logs WHERE decision_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [decisionId]);
    return rows[0] ?? null;
  }

  async function hallucinations(limit = 50) {
    const { rows } = await pool.query(
      `SELECT * FROM m4_ai_hallucination_flags ORDER BY flagged_at DESC LIMIT $1`, [Math.min(limit, 200)]);
    return rows;
  }

  async function riskClassifications() {
    return (await pool.query(`SELECT * FROM m4_ai_risk_classifications ORDER BY classified_at DESC`)).rows;
  }

  async function auditEvents(opts: { domain?: string; limit?: number } = {}) {
    const lim = Math.min(opts.limit ?? 100, 500);
    const { rows } = await pool.query(
      opts.domain
        ? `SELECT * FROM m4_ai_audit_events WHERE domain = $1 ORDER BY created_at DESC LIMIT ${lim}`
        : `SELECT * FROM m4_ai_audit_events ORDER BY created_at DESC LIMIT ${lim}`,
      opts.domain ? [opts.domain] : []);
    return rows;
  }

  async function emitAudit(domain: string, action: string, payload: any, ctx?: { actor?: string; subject_id?: string; request_id?: string; ip?: string }) {
    await pool.query(
      `INSERT INTO m4_ai_audit_events(id, domain, action, actor, subject_id, payload, request_id, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId('m4ae'), domain, action, ctx?.actor ?? null, ctx?.subject_id ?? null,
       JSON.stringify(payload ?? {}), ctx?.request_id ?? null, ctx?.ip ?? null]);
  }

  return {
    policies, models, registerVersion, rollback,
    logDecision, decisions, explainabilityFor, hallucinations,
    riskClassifications, auditEvents, emitAudit, checkLanguage,
  };
}
