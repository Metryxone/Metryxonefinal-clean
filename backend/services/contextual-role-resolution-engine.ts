/**
 * Contextual Role Resolution Engine — Phase 2.
 *
 * Converts a raw role title + user context into a *runtime* role expectation:
 * canonical role_id + resolved seniority band + applicable modifier axes.
 *
 * READ-ONLY: never writes to ontology/canonical-role tables. Wraps existing
 * services (`global-role-engine`, `m3-role-normalization` artefacts) by
 * reading the tables they populate; falls back to a deterministic slug
 * when no canonical match exists.
 */
import type { Pool } from 'pg';

export const CONTEXTUAL_ROLE_RESOLUTION_VERSION = '1.0.0';

export type ResolveRoleInput = {
  roleTitle: string;
  industry?: string;
  orgMaturity?: string;
  orgLayer?: string;
  careerStage?: string;
  experienceYears?: number;
  workArrangement?: string;
  leadershipScope?: string;
};

export type SeniorityBand = 'fresher' | 'early' | 'mid' | 'senior' | 'lead' | 'executive';

export type ResolvedRole = {
  inputTitle: string;
  canonicalRoleId: string;
  canonicalRoleTitle: string;
  matchedVia: 'gro_alias' | 'gro_hierarchy' | 'm3_canonical' | 'slug_fallback';
  seniorityBand: SeniorityBand;
  contextAxes: Record<string, string | number | undefined>;
};

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function inferSeniorityBand(input: ResolveRoleInput): SeniorityBand {
  const years = input.experienceYears ?? -1;
  const stage = (input.careerStage ?? '').toLowerCase();
  const layer = (input.orgLayer ?? '').toLowerCase();
  if (/exec|cxo|c-suite|c_suite/.test(layer) || /executive/.test(stage)) return 'executive';
  if (/lead|principal|head/.test(stage) || /principal|head/.test(layer)) return 'lead';
  if (years >= 8 || /senior|sr/.test(stage)) return 'senior';
  if (years >= 3 || /mid/.test(stage)) return 'mid';
  if (years >= 1 || /early|junior|jr/.test(stage)) return 'early';
  return 'fresher';
}

async function tryQuery<T>(pool: Pool, sql: string, params: unknown[]): Promise<T[] | null> {
  try {
    const r = await pool.query(sql, params);
    return r.rows as T[];
  } catch {
    return null;
  }
}

export async function resolveRole(pool: Pool, input: ResolveRoleInput): Promise<ResolvedRole> {
  const title = (input.roleTitle ?? '').trim();
  const titleKey = title.toLowerCase();
  const band = inferSeniorityBand(input);
  const ctx = {
    industry: input.industry,
    org_maturity: input.orgMaturity,
    org_layer: input.orgLayer,
    career_stage: input.careerStage,
    experience_years: input.experienceYears,
    work_arrangement: input.workArrangement,
    leadership_scope: input.leadershipScope,
  };

  // 1) gro_role_aliases (exact match on alias)
  const aliasHit = await tryQuery<{ role_id: string; canonical_title: string }>(pool,
    `SELECT role_id, COALESCE(canonical_title, role_id) AS canonical_title
       FROM gro_role_aliases WHERE LOWER(alias) = $1 LIMIT 1`, [titleKey]);
  if (aliasHit && aliasHit.length > 0) {
    return { inputTitle: title, canonicalRoleId: aliasHit[0].role_id, canonicalRoleTitle: aliasHit[0].canonical_title,
             matchedVia: 'gro_alias', seniorityBand: band, contextAxes: ctx };
  }

  // 2) gro_role_hierarchy (case-insensitive title match)
  const hierHit = await tryQuery<{ role_id: string; role_title: string }>(pool,
    `SELECT role_id, role_title FROM gro_role_hierarchy
       WHERE LOWER(role_title) = $1 LIMIT 1`, [titleKey]);
  if (hierHit && hierHit.length > 0) {
    return { inputTitle: title, canonicalRoleId: hierHit[0].role_id, canonicalRoleTitle: hierHit[0].role_title,
             matchedVia: 'gro_hierarchy', seniorityBand: band, contextAxes: ctx };
  }

  // 3) m3_canonical_role_mappings (semantic mapping)
  const m3Hit = await tryQuery<{ canonical_role_id: string; canonical_label: string }>(pool,
    `SELECT canonical_role_id, COALESCE(canonical_label, canonical_role_id) AS canonical_label
       FROM m3_canonical_role_mappings WHERE LOWER(source_label) = $1 LIMIT 1`, [titleKey]);
  if (m3Hit && m3Hit.length > 0) {
    return { inputTitle: title, canonicalRoleId: m3Hit[0].canonical_role_id, canonicalRoleTitle: m3Hit[0].canonical_label,
             matchedVia: 'm3_canonical', seniorityBand: band, contextAxes: ctx };
  }

  // 4) deterministic slug fallback — never throws
  const slug = slugify(title) || 'unknown-role';
  return { inputTitle: title, canonicalRoleId: slug, canonicalRoleTitle: title || 'Unknown Role',
           matchedVia: 'slug_fallback', seniorityBand: band, contextAxes: ctx };
}
