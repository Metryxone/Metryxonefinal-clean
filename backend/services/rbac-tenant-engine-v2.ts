/**
 * RBAC + ABAC V2 — attribute-based policy layer over existing wos_roles.
 * Reads wos_v2_abac_policies; deny-overrides-allow with priority ordering.
 */
import type { Pool } from 'pg';

export const RBAC_TENANT_V2_VERSION = '2.0.0';

export type ABACAttributes = Record<string, unknown>;

export type ABACPolicy = {
  id: string;
  policy_key: string;
  resource: string;
  action: string;
  condition_expr: { any?: Array<{ attr: string; op: 'eq' | 'in' | 'gt' | 'lt'; values: unknown[] }> };
  effect: 'allow' | 'deny';
  priority: number;
};

export type ABACDecision = {
  effect: 'allow' | 'deny';
  matched_policy: string | null;
  evaluated: Array<{ policy_key: string; matched: boolean; effect: 'allow' | 'deny' }>;
  rationale: string;
};

export async function loadPolicies(pool: Pool, tenantId: number | null, resource: string, action: string): Promise<ABACPolicy[]> {
  try {
    const r = await pool.query<ABACPolicy>(
      `SELECT id, policy_key, resource, action, condition_expr, effect, priority
       FROM wos_v2_abac_policies
       WHERE active = TRUE AND resource = $1 AND action = $2
         AND (tenant_id = $3 OR tenant_id IS NULL)
       ORDER BY priority ASC, effect DESC`,
      [resource, action, tenantId],
    );
    return r.rows;
  } catch {
    return [];
  }
}

function evalCond(cond: ABACPolicy['condition_expr'], attrs: ABACAttributes): boolean {
  const clauses = cond?.any ?? [];
  if (!clauses.length) return true;
  return clauses.some((c) => {
    const v = attrs[c.attr];
    switch (c.op) {
      case 'eq': return c.values.includes(v as never);
      case 'in': return c.values.includes(v as never);
      case 'gt': return typeof v === 'number' && c.values.some((x) => typeof x === 'number' && v > x);
      case 'lt': return typeof v === 'number' && c.values.some((x) => typeof x === 'number' && v < x);
      default:   return false;
    }
  });
}

export function decide(policies: ABACPolicy[], attrs: ABACAttributes): ABACDecision {
  const trace: ABACDecision['evaluated'] = [];
  let matched: ABACPolicy | null = null;
  // priority asc = stronger; deny short-circuits at any priority
  for (const p of policies) {
    const m = evalCond(p.condition_expr, attrs);
    trace.push({ policy_key: p.policy_key, matched: m, effect: p.effect });
    if (m) {
      if (p.effect === 'deny') {
        return {
          effect: 'deny', matched_policy: p.policy_key, evaluated: trace,
          rationale: `Deny by policy "${p.policy_key}" (priority ${p.priority}).`,
        };
      }
      if (!matched) matched = p;
    }
  }
  if (matched) {
    return {
      effect: 'allow', matched_policy: matched.policy_key, evaluated: trace,
      rationale: `Allow by policy "${matched.policy_key}" (priority ${matched.priority}).`,
    };
  }
  return {
    effect: 'deny', matched_policy: null, evaluated: trace,
    rationale: `No matching policy → default deny.`,
  };
}
