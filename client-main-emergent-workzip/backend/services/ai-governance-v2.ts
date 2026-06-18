/**
 * AI Governance V2 — model registry, audit trails, policy validation,
 * and human-override workflows. Lightweight DB-backed helpers.
 */
import type { Pool } from 'pg';
export const AI_GOVERNANCE_VERSION = '7.0.0';

/**
 * Disallowed concept patterns. Each entry is a label + regex matching
 * structural / lexical variations (separators: space / underscore / hyphen,
 * common suffixes, and adjacent-token verdicts).
 */
const DISALLOWED_PATTERNS: Array<{ label: string; rx: RegExp }> = [
  { label: 'hiring recommendation', rx: /\bhir(e|ing|ed)[\s_-]*(recommendation|verdict|decision|ranking|score|fit|eligibility)\b/i },
  { label: 'promotion verdict',     rx: /\bpromot(e|ion|able)[\s_-]*(recommendation|verdict|decision|ranking|eligibility|fit)\b/i },
  { label: 'suitability prediction',rx: /\b(individual|candidate|person|user)[\s_-]*suitabilit(y|ies)\b|\bsuitabilit(y|ies)[\s_-]*(prediction|score|verdict)\b/i },
  { label: 'pass/fail verdict',     rx: /\bpass[\s_/-]*fail\b|\b(passed|failed)[\s_-]*(verdict|determination|assessment)\b/i },
  { label: 'should hire',           rx: /\bshould[\s_-]*(hire|promote|reject|fire)\b/i },
  { label: 'hire/fire instruction', rx: /\b(hire|do[\s_-]?not[\s_-]?hire|reject|fire)[\s_-]*(this|the)?[\s_-]*(candidate|user|person|employee)\b/i },
];

/** Structural keys that are themselves verdict-shaped — flag if present as object keys. */
const DISALLOWED_KEY_PATTERNS: RegExp[] = [
  /^hire(_recommendation|_decision|_verdict|_score|_eligibility)?$/i,
  /^promotion(_recommendation|_decision|_verdict|_ranking|_eligibility)?$/i,
  /^should_(hire|promote|reject|fire)$/i,
  /^(individual_)?suitability(_prediction|_score)?$/i,
  /^pass_fail(_verdict)?$/i,
];

export type PolicyCheck = { ok: boolean; violations: string[]; checked_at: string };

function collectKeys(o: unknown, out: string[] = []): string[] {
  if (!o || typeof o !== 'object') return out;
  if (Array.isArray(o)) { for (const v of o) collectKeys(v, out); return out; }
  for (const [k, v] of Object.entries(o)) { out.push(k); collectKeys(v, out); }
  return out;
}

/** Structural + regex policy validator (replaces simple substring includes). */
export function validatePolicy(output: unknown): PolicyCheck {
  const serialised = JSON.stringify(output ?? {});
  const violations: string[] = [];
  for (const { label, rx } of DISALLOWED_PATTERNS) {
    if (rx.test(serialised)) violations.push(label);
  }
  for (const k of collectKeys(output)) {
    for (const rx of DISALLOWED_KEY_PATTERNS) {
      if (rx.test(k)) { violations.push(`structural_key:${k}`); break; }
    }
  }
  return { ok: violations.length === 0, violations: Array.from(new Set(violations)), checked_at: new Date().toISOString() };
}

export async function registerModel(pool: Pool, args: { modelKey: string; version: string; owner?: string; status?: string; metadata?: Record<string, unknown> }) {
  try {
    await pool.query(
      `INSERT INTO model_governance_registry (model_key, version, owner, status, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (model_key) DO UPDATE SET version=EXCLUDED.version, owner=EXCLUDED.owner, status=EXCLUDED.status, metadata=EXCLUDED.metadata`,
      [args.modelKey, args.version, args.owner ?? null, args.status ?? 'active', JSON.stringify(args.metadata ?? {})],
    );
  } catch (e) { console.warn('[gov] register failed:', (e as Error).message); }
}

export async function recordDecisionAudit(pool: Pool, args: {
  decisionKey: string; userId?: string;
  inputs: unknown; outputs: unknown; reasoning?: unknown;
}) {
  const policy = validatePolicy(args.outputs);
  try {
    await pool.query(
      `INSERT INTO ai_decision_audits (decision_key, user_id, inputs, outputs, reasoning, policy_check, flagged)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7)`,
      [args.decisionKey, args.userId ?? null, JSON.stringify(args.inputs ?? {}), JSON.stringify(args.outputs ?? {}), JSON.stringify(args.reasoning ?? {}), JSON.stringify(policy), !policy.ok],
    );
  } catch (e) { console.warn('[gov] audit failed:', (e as Error).message); }
  return policy;
}

export async function applyHumanOverride(pool: Pool, args: {
  decisionKey: string; userId: string; requestedBy: string;
  originalValue: unknown; overrideValue: unknown; justification: string;
}) {
  try {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO human_override_workflows (decision_key, user_id, requested_by, original_value, override_value, justification)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING id`,
      [args.decisionKey, args.userId, args.requestedBy, JSON.stringify(args.originalValue ?? null), JSON.stringify(args.overrideValue ?? {}), args.justification],
    );
    return { id: r.rows[0].id, status: 'applied' as const };
  } catch (e) {
    console.warn('[gov] override failed:', (e as Error).message);
    return { id: null, status: 'failed' as const, error: (e as Error).message };
  }
}

export async function listModels(pool: Pool) {
  try {
    const r = await pool.query(`SELECT model_key, version, owner, status, metadata, registered_at FROM model_governance_registry ORDER BY registered_at DESC`);
    return r.rows;
  } catch { return []; }
}

export async function listRecentAudits(pool: Pool, limit = 50) {
  try {
    const r = await pool.query(`SELECT decision_key, user_id, flagged, policy_check, created_at FROM ai_decision_audits ORDER BY created_at DESC LIMIT $1`, [limit]);
    return r.rows;
  } catch { return []; }
}
