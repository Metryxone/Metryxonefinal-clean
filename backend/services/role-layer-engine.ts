/**
 * Phase 1 Enhancement — Role Layer Engine
 * Universal organisational layer model + heuristic layer auto-detection
 * from free-text seniority / role title / years experience.
 */
import type { Pool } from 'pg';

export const ROLE_LAYER_ENGINE_VERSION = '1.0.0';

export interface RoleLayer {
  id: string; layer_code: string; layer_name: string;
  ordinal: number; description: string | null;
}

const TITLE_LAYER_RULES: Array<[RegExp, string]> = [
  [/\b(ceo|cto|cfo|coo|cpo|chro|cmo|cio|chief|president|founder)\b/i, 'EXEC'],
  [/\b(vp|vice president|svp|evp)\b/i,                                 'EXEC'],
  [/\b(director|head of|partner)\b/i,                                  'STRAT'],
  [/\b(manager|mgr|engineering manager|em)\b/i,                        'MGR'],
  [/\b(lead|principal|staff|architect|tech lead|tl)\b/i,               'LEAD'],
];

/** Token-based seniority → layer map. Keys are matched on word boundary, not substring. */
const SENIORITY_LAYER: Record<string, string> = {
  'entry': 'IC', 'junior': 'IC', 'fresher': 'IC',
  'mid': 'IC', 'mid-level': 'IC',
  'senior': 'IC', 'sr': 'IC',
  'lead': 'LEAD', 'principal': 'LEAD', 'staff': 'LEAD',
  'manager': 'MGR', 'engineering manager': 'MGR',
  'director': 'STRAT', 'senior director': 'STRAT', 'head': 'STRAT',
  'vp': 'EXEC', 'svp': 'EXEC', 'cxo': 'EXEC', 'c-level': 'EXEC', 'executive': 'EXEC',
};

function senLayerWordMatch(sen: string): string | null {
  if (!sen) return null;
  if (SENIORITY_LAYER[sen]) return SENIORITY_LAYER[sen];
  // Word-boundary scan: prefer longer (more specific) keys first so 'senior director' beats 'senior'.
  const keys = Object.keys(SENIORITY_LAYER).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(sen)) return SENIORITY_LAYER[k];
  }
  return null;
}

export function createRoleLayerEngine(pool: Pool) {
  async function listLayers(): Promise<RoleLayer[]> {
    const { rows } = await pool.query(
      `SELECT id, layer_code, layer_name, ordinal, description
       FROM gro_role_layers WHERE deleted_at IS NULL ORDER BY ordinal`);
    return rows;
  }

  async function getByCode(code: string) {
    const { rows } = await pool.query(
      `SELECT * FROM gro_role_layers WHERE layer_code = $1 AND deleted_at IS NULL`, [code]);
    return rows[0] ?? null;
  }

  /**
   * Pure (no DB) layer heuristic from text inputs.
   * Priority: title regex (strong) → seniority word-boundary keyword → years experience → IC default.
   * Title-first prevents seniority substrings like "senior" forcing IC for "Engineering Manager".
   */
  function detectLayerCode(input: {
    roleTitle?: string; seniority?: string; yearsExp?: number;
  }): { code: string; basis: string } {
    const title = input.roleTitle || '';
    for (const [re, layer] of TITLE_LAYER_RULES) {
      if (re.test(title)) return { code: layer, basis: `title_regex:${layer}` };
    }
    const sen = (input.seniority || '').toLowerCase().trim();
    const senCode = senLayerWordMatch(sen);
    if (senCode) return { code: senCode, basis: `seniority_word_match` };
    const y = input.yearsExp ?? 0;
    if (y >= 18) return { code: 'EXEC',  basis: 'years_exp_18plus' };
    if (y >= 12) return { code: 'STRAT', basis: 'years_exp_12plus' };
    return { code: 'IC', basis: 'default' };
  }

  /**
   * Layer auto-detection. Resolves canonical role first (DB), then falls back to pure heuristic.
   */
  async function detectLayer(input: { roleTitle?: string; seniority?: string; yearsExp?: number }) {
    // 1. Try canonical role/alias resolution to pick up explicit layer
    const t = (input.roleTitle || '').trim().toLowerCase();
    if (t) {
      const { rows } = await pool.query(
        `SELECT r.layer_id FROM gro_canonical_roles r
         WHERE r.deleted_at IS NULL AND r.layer_id IS NOT NULL
           AND (LOWER(r.title) = $1 OR EXISTS (
             SELECT 1 FROM gro_role_aliases a
              WHERE a.role_id = r.id AND a.deleted_at IS NULL AND LOWER(a.alias) = $1
           ))
         LIMIT 1`, [t]);
      if (rows[0]?.layer_id) {
        const layer = await pool.query(
          `SELECT * FROM gro_role_layers WHERE id = $1 AND deleted_at IS NULL`, [rows[0].layer_id]);
        if (layer.rows[0]) {
          return { detected_code: layer.rows[0].layer_code, layer: layer.rows[0], basis: 'canonical_role_lookup' };
        }
      }
    }
    // 2. Fallback: heuristic
    const { code, basis } = detectLayerCode(input);
    const layer = await getByCode(code);
    return { detected_code: code, layer, basis };
  }

  return { listLayers, getByCode, detectLayer, detectLayerCode };
}
