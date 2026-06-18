/**
 * EI Snapshots — Phase 4
 *
 * Captures nightly per-user EI snapshots for longitudinal trajectory tracking
 * and score evolution analytics. Every snapshot is pinned to the full version
 * quad (ruleset/taxonomy/institution_dataset/confidence_model) so historical
 * scores remain reproducible even after rulesets evolve.
 *
 * Two entrypoints:
 *   - takeSnapshot(): on-demand, used by admin recompute and tests
 *   - runDailySnapshotJob(): batch job; one row per active user per day
 *
 * Idempotent via UNIQUE(user_id, snapshot_date).
 */

import { createHash } from 'crypto';
import type { Pool } from 'pg';
import { resolveProfile, type ResolverInput, type ResolverOutput } from './ei-resolver';
import { computeOfficialEI, type EIEngineInput } from './ei-engine';
import { getActiveRuleset, getRulesetByVersion } from './ei-rules-loader';
import { resolveConfidenceModel, computeConfidence } from './ei-confidence';

export interface SnapshotInput {
  user_id:        string;
  resolver_input: ResolverInput;
  raw:            EIEngineInput['raw'];
  source?:        'nightly' | 'on_demand' | 'admin_recompute';
  ruleset_version?: string;       // pin to a specific version (default: active)
}

function hashProfile(input: ResolverInput): string {
  const canon = JSON.stringify({
    inst: input.institution || '',
    qual: input.qualification || '',
    skills: [...(input.skills || [])].sort(),
    certs:  [...(input.certifications || [])].sort(),
    occ:    input.occupation || '',
  });
  return createHash('sha256').update(canon).digest('hex').slice(0, 32);
}

export async function takeSnapshot(pool: Pool, input: SnapshotInput) {
  const t0 = Date.now();
  const ruleset = input.ruleset_version
    ? (await getRulesetByVersion(pool, input.ruleset_version)) ?? (await getActiveRuleset(pool))
    : await getActiveRuleset(pool);

  const resolution: ResolverOutput = await resolveProfile(pool, input.resolver_input);
  const ei = computeOfficialEI({ resolved: resolution, raw: input.raw, ruleset });

  // Trust counts for confidence
  const vc = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status='verified') AS verified,
       COUNT(*) FILTER (WHERE status='pending')  AS pending,
       COUNT(*) FILTER (WHERE status='revoked')  AS revoked
       FROM credential_verifications WHERE user_id=$1`,
    [input.user_id],
  ).catch(() => ({ rows: [{ verified: 0, pending: 0, revoked: 0 }] }));
  const verified_count = Number(vc.rows[0].verified) || 0;
  const pending_count  = Number(vc.rows[0].pending)  || 0;
  const revoked_count  = Number(vc.rows[0].revoked)  || 0;

  // Confidence — pin to the model version named by the ruleset (or the
  // globally active model if the ruleset didn't pin one). The model.version
  // we actually executed is the value we persist below.
  const model = await resolveConfidenceModel(pool, ruleset.confidence_model_version);
  const last = await pool.query(
    `SELECT snapshot_date, profile_confidence_score FROM ei_snapshot_versions
      WHERE user_id=$1 ORDER BY snapshot_date DESC LIMIT 8`, [input.user_id],
  ).catch(() => ({ rows: [] as any[] }));
  let last_snapshot_age_days: number | null = null;
  let last_7d_confidence_delta: number | null = null;
  if (last.rows.length) {
    const d0 = new Date(last.rows[0].snapshot_date);
    last_snapshot_age_days = Math.floor((Date.now() - d0.getTime()) / (1000 * 60 * 60 * 24));
    const recent = last.rows.filter((r: any) =>
      (Date.now() - new Date(r.snapshot_date).getTime()) / (1000 * 60 * 60 * 24) <= 7
    );
    if (recent.length >= 2) {
      const a = recent.map((r: any) => Number(r.profile_confidence_score) || 0);
      last_7d_confidence_delta = Math.max(...a) - Math.min(...a);
    }
  }
  const confidence = computeConfidence(model, {
    resolution, verified_count, pending_count, revoked_count,
    last_snapshot_age_days, last_7d_confidence_delta,
  });

  // Trust score from cache (if any)
  let trusted_score: number | null = null;
  let trust_score:    number | null = null;
  let trust_mult:     number | null = null;
  try {
    const tc = await pool.query(
      `SELECT trust_score, trust_multiplier FROM trust_score_components WHERE user_id=$1`, [input.user_id],
    );
    if (tc.rowCount) {
      trust_score = Number(tc.rows[0].trust_score);
      trust_mult  = Number(tc.rows[0].trust_multiplier);
      trusted_score = Math.min(99, Math.round(ei.score * (trust_mult || 1.0)));
    }
  } catch {/* trust optional */}

  const computation_ms = Date.now() - t0;

  const ins = await pool.query(
    `INSERT INTO ei_snapshot_versions
      (user_id, snapshot_date,
       capability_score, trusted_score, trust_score, trust_multiplier, band,
       breakdown, profile_hash, resolved_profile,
       ei_version, ruleset_version, taxonomy_version, institution_dataset_version, confidence_model_version,
       profile_confidence_score, evidence_quality_score, uncertainty_flags,
       source, computation_ms)
     VALUES ($1, CURRENT_DATE,
             $2,$3,$4,$5,$6,
             $7,$8,$9,
             '4.0',$10,$11,$12,$13,
             $14,$15,$16,
             $17,$18)
     ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
       capability_score = EXCLUDED.capability_score,
       trusted_score    = EXCLUDED.trusted_score,
       trust_score      = EXCLUDED.trust_score,
       trust_multiplier = EXCLUDED.trust_multiplier,
       band             = EXCLUDED.band,
       breakdown        = EXCLUDED.breakdown,
       profile_hash     = EXCLUDED.profile_hash,
       resolved_profile = EXCLUDED.resolved_profile,
       -- Phase 4 fix: keep the FULL version quad coherent on conflict.
       -- A same-day recompute under a different ruleset / model must rewrite
       -- ALL version fields atomically — never leave stale pins.
       ei_version                  = EXCLUDED.ei_version,
       ruleset_version             = EXCLUDED.ruleset_version,
       taxonomy_version            = EXCLUDED.taxonomy_version,
       institution_dataset_version = EXCLUDED.institution_dataset_version,
       confidence_model_version    = EXCLUDED.confidence_model_version,
       profile_confidence_score    = EXCLUDED.profile_confidence_score,
       evidence_quality_score      = EXCLUDED.evidence_quality_score,
       uncertainty_flags           = EXCLUDED.uncertainty_flags,
       source                      = EXCLUDED.source,
       computation_ms              = EXCLUDED.computation_ms
     RETURNING id, snapshot_date`,
    [
      input.user_id,
      ei.score, trusted_score, trust_score, trust_mult, ei.band,
      JSON.stringify(ei.breakdown), hashProfile(input.resolver_input), JSON.stringify(resolution),
      // Persist the ACTUAL versions that ran — model.version (not the ruleset's
      // hint) so the snapshot is exactly reproducible.
      ruleset.version, ruleset.taxonomy_version, ruleset.institution_dataset_version, model.version,
      confidence.profile_confidence_score, confidence.evidence_quality_score, JSON.stringify(confidence.uncertainty_flags),
      input.source || 'on_demand', computation_ms,
    ],
  );
  return { id: ins.rows[0].id, snapshot_date: ins.rows[0].snapshot_date, score: ei.score, ruleset_version: ruleset.version, confidence_model_version: model.version, confidence };
}

/**
 * Trajectory for a user — last N snapshots. Includes per-day capability + trusted
 * scores, ruleset versions in effect, and breakdown evolution.
 */
export async function getTrajectory(pool: Pool, userId: string, days = 90) {
  const r = await pool.query(
    `SELECT snapshot_date, capability_score, trusted_score, trust_score, trust_multiplier, band,
            breakdown, ruleset_version, profile_confidence_score, evidence_quality_score, uncertainty_flags
       FROM ei_snapshot_versions
      WHERE user_id=$1 AND snapshot_date >= CURRENT_DATE - $2::int
      ORDER BY snapshot_date ASC`,
    [userId, days],
  );
  return r.rows;
}

/**
 * Score evolution analytics — Σ delta, volatility, dominant dimension drivers.
 */
export async function getEvolutionAnalytics(pool: Pool, userId: string, days = 90) {
  const traj = await getTrajectory(pool, userId, days);
  if (traj.length < 2) return { delta: 0, volatility: 0, dominant_movers: [], points: traj.length };
  const first = Number(traj[0].capability_score);
  const last  = Number(traj[traj.length - 1].capability_score);
  const scores = traj.map(t => Number(t.capability_score));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const volatility = Math.sqrt(variance);

  // Dominant movers — which breakdown key changed most
  const b0 = traj[0].breakdown as Record<string, number>;
  const bN = traj[traj.length - 1].breakdown as Record<string, number>;
  const movers = Object.keys(bN).map(k => ({ dimension: k, delta: round1((bN[k] || 0) - (b0[k] || 0)) }))
                       .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    delta: last - first, volatility: round1(volatility),
    dominant_movers: movers.slice(0, 4), points: traj.length,
    first_score: first, last_score: last,
    ruleset_changes: [...new Set(traj.map(t => t.ruleset_version))],
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
