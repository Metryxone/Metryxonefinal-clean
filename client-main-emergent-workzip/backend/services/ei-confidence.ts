/**
 * EI Confidence Engine — Phase 4
 *
 * Composite confidence scoring across:
 *   - profile_confidence: how well the inputs resolved to canonical entities
 *   - evidence_quality:   how many independent evidence units back the claims
 *   - uncertainty_flags:  rule-driven UX hints ("low_skill_coverage", etc.)
 *
 * 100% rules-based, deterministic, explainable. Never ML.
 */

import type { Pool } from 'pg';
import type { ResolverOutput } from './ei-resolver';

export interface UncertaintyFlag {
  flag:     string;
  severity: 'low' | 'medium' | 'high';
  basis:    string;
}

export interface ConfidenceOutput {
  profile_confidence_score: number;    // 0..100
  evidence_quality_score:   number;    // 0..100
  composite_confidence:     number;    // 0..100 (avg, displayed as the headline)
  uncertainty_flags:        UncertaintyFlag[];
  model_version:            string;
}

export interface ConfidenceInputs {
  resolution:           ResolverOutput;
  verified_count?:      number;
  pending_count?:       number;
  revoked_count?:       number;
  last_snapshot_age_days?: number | null;
  last_7d_confidence_delta?: number | null;
}

export interface ConfidenceModelConfig {
  evidence_quality: {
    institution_matched_pts:     number;
    qualification_matched_pts:   number;
    per_matched_skill_pts:       number;
    per_matched_cert_pts:        number;
    per_verified_credential_pts: number;
    per_provenance_ref_pts:      number;
    cap:                         number;
  };
}

export interface LoadedConfidenceModel {
  version: string;
  config:  ConfidenceModelConfig;
  uncertainty_rules: Array<{ flag: string; severity: 'low'|'medium'|'high'; basis: string }>;
}

export const BAKED_CONFIDENCE_MODEL: LoadedConfidenceModel = {
  version: '1.0',
  config: {
    evidence_quality: {
      institution_matched_pts: 20,
      qualification_matched_pts: 15,
      per_matched_skill_pts: 2,
      per_matched_cert_pts: 3,
      per_verified_credential_pts: 10,
      per_provenance_ref_pts: 1,
      cap: 100,
    },
  },
  uncertainty_rules: [
    { flag: 'institution_unresolved',  severity: 'medium', basis: 'No canonical institution match — relying on free-text claim' },
    { flag: 'low_skill_coverage',      severity: 'low',    basis: 'Fewer than 3 resolved technical skills' },
    { flag: 'all_self_declared',       severity: 'high',   basis: 'No verified credentials present' },
    { flag: 'stale_snapshot',          severity: 'low',    basis: 'Last snapshot older than 30 days' },
    { flag: 'confidence_volatility',   severity: 'medium', basis: 'Profile confidence varied >20 pts in last 7 days' },
  ],
};

export async function getActiveConfidenceModel(pool: Pool): Promise<LoadedConfidenceModel> {
  try {
    const r = await pool.query(
      `SELECT version, config, uncertainty_rules FROM ei_confidence_models
        WHERE status='active' ORDER BY activated_at DESC NULLS LAST, created_at DESC LIMIT 1`,
    );
    if (r.rowCount) {
      return {
        version: r.rows[0].version,
        config: r.rows[0].config,
        uncertainty_rules: r.rows[0].uncertainty_rules || BAKED_CONFIDENCE_MODEL.uncertainty_rules,
      };
    }
  } catch (e) {
    console.warn('[ei-confidence] DB load failed, using baked default:', (e as Error).message);
  }
  return BAKED_CONFIDENCE_MODEL;
}

/**
 * Fetch a specific confidence model version. Used by ei-resolution.ts and
 * ei-snapshots.ts to pin confidence computation to the version named in the
 * active ruleset's `confidence_model_version` field — so the stored
 * `confidence_model_version` always matches the model that actually ran.
 */
export async function getConfidenceModelByVersion(pool: Pool, version: string | null | undefined): Promise<LoadedConfidenceModel | null> {
  if (!version) return null;
  try {
    const r = await pool.query(
      `SELECT version, config, uncertainty_rules FROM ei_confidence_models WHERE version=$1 LIMIT 1`,
      [version],
    );
    if (!r.rowCount) {
      // Baked model is a valid pin target (version '1.0' matches the seed)
      if (version === BAKED_CONFIDENCE_MODEL.version) return BAKED_CONFIDENCE_MODEL;
      return null;
    }
    return {
      version: r.rows[0].version,
      config: r.rows[0].config,
      uncertainty_rules: r.rows[0].uncertainty_rules || BAKED_CONFIDENCE_MODEL.uncertainty_rules,
    };
  } catch {
    if (version === BAKED_CONFIDENCE_MODEL.version) return BAKED_CONFIDENCE_MODEL;
    return null;
  }
}

/**
 * Resolve the confidence model to use for a calculation. Prefers the version
 * pinned by the ruleset; falls back to the globally active model only when
 * the pinned version doesn't exist. Always returns the model that ACTUALLY
 * ran — callers should persist `result.version` (not the ruleset's hint).
 */
export async function resolveConfidenceModel(pool: Pool, pinnedVersion: string | null | undefined): Promise<LoadedConfidenceModel> {
  if (pinnedVersion) {
    const pinned = await getConfidenceModelByVersion(pool, pinnedVersion);
    if (pinned) return pinned;
  }
  return getActiveConfidenceModel(pool);
}

export function computeConfidence(model: LoadedConfidenceModel, inputs: ConfidenceInputs): ConfidenceOutput {
  const eq = model.config.evidence_quality;
  const r = inputs.resolution;

  // ── Evidence quality (rules-based, fully explainable) ──
  let quality = 0;
  if (r.institution?.matched)   quality += eq.institution_matched_pts;
  if (r.qualification?.matched) quality += eq.qualification_matched_pts;
  const matchedSkills = (r.skills || []).filter(s => s.matched).length;
  const matchedCerts  = (r.certifications || []).filter(c => c.matched).length;
  quality += matchedSkills * eq.per_matched_skill_pts;
  quality += matchedCerts  * eq.per_matched_cert_pts;
  quality += (inputs.verified_count || 0) * eq.per_verified_credential_pts;

  // Provenance refs across entities — small kicker per source citation
  let provRefs = 0;
  for (const e of [r.institution, r.qualification, r.occupation, ...(r.skills || []), ...(r.certifications || [])]) {
    if (e?.provenance?.length) provRefs += e.provenance.length;
  }
  quality += provRefs * eq.per_provenance_ref_pts;

  const evidence_quality_score = Math.max(0, Math.min(eq.cap, Math.round(quality)));

  // ── Uncertainty flags (rule eval) ──
  const flags: UncertaintyFlag[] = [];
  const ruleByFlag = new Map(model.uncertainty_rules.map(u => [u.flag, u]));
  const push = (key: string) => { const u = ruleByFlag.get(key); if (u) flags.push(u); };

  if (r.institution && !r.institution.matched) push('institution_unresolved');
  if (matchedSkills < 3) push('low_skill_coverage');
  if (!(inputs.verified_count && inputs.verified_count > 0)) push('all_self_declared');
  if ((inputs.last_snapshot_age_days ?? 0) > 30) push('stale_snapshot');
  if (Math.abs(inputs.last_7d_confidence_delta ?? 0) > 20) push('confidence_volatility');

  const profile_confidence_score = r.profile_confidence_score ?? 0;
  const composite_confidence = Math.round((profile_confidence_score + evidence_quality_score) / 2);

  return {
    profile_confidence_score,
    evidence_quality_score,
    composite_confidence,
    uncertainty_flags: flags,
    model_version: model.version,
  };
}
