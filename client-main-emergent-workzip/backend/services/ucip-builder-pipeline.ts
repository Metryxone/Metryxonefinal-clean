/**
 * UCIP Builder Pipeline — Phase 1.
 *
 * Ordered pipeline that produces a UnifiedCompetencyProfile. Each step is
 * fault-tolerant: a single step failure degrades the profile (records the
 * issue in lineage) but never aborts the build.
 *
 * Pipeline:
 *   1. fetch-all-sources       — orchestration adapter (read-only fan-out)
 *   2. build-profile           — aggregator
 *   3. validate                — validation engine
 *   4. persist (best-effort)   — to ucip_profiles + ucip_competencies
 *   5. log                     — append to ucip_runtime_logs
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ADAPTIVE_EVENTS, emit } from './adaptive-event-bus';
import { buildUcip, persistUcip, type UnifiedCompetencyProfile } from './unified-competency-profile-engine';
import { validateUcip, type UcipValidationReport } from './ucip-validation-engine';
import { isUcipShadowMode } from '../config/feature-flags';

export const UCIP_PIPELINE_VERSION = '1.0.0';

export type PipelineStep = { step: string; status: 'ok' | 'failed' | 'skipped'; duration_ms: number; detail?: string };
export type PipelineOutcome = {
  correlation_id: string;
  user_id: string;
  shadow_mode: boolean;
  status: 'success' | 'partial' | 'failed';
  steps: PipelineStep[];
  profile?: UnifiedCompetencyProfile;
  validation?: UcipValidationReport;
  duration_ms: number;
};

async function runStep<T>(name: string, fn: () => Promise<T>, steps: PipelineStep[]): Promise<T | null> {
  const start = Date.now();
  try {
    const out = await fn();
    steps.push({ step: name, status: 'ok', duration_ms: Date.now() - start });
    return out;
  } catch (err) {
    steps.push({ step: name, status: 'failed', duration_ms: Date.now() - start, detail: (err as Error).message });
    return null;
  }
}

async function recordLog(
  pool: Pool, corr: string, userId: string, operation: string, status: string,
  shadow: boolean, durationMs: number, sourcesOk: number, sourcesFailed: number,
  validation: any, detail: any,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ucip_runtime_logs
         (user_id, correlation_id, operation, status, shadow_mode, duration_ms,
          sources_ok, sources_failed, validation, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
      [userId, corr, operation, status, shadow, durationMs, sourcesOk, sourcesFailed,
       JSON.stringify(validation ?? {}), JSON.stringify(detail ?? {})],
    );
  } catch (err) {
    console.warn('[ucip-pipeline] log persist failed:', (err as Error).message);
  }
}

/**
 * Run the full UCIP pipeline for a user. Idempotent and side-effect free
 * w.r.t. upstream tables. Persistence to ucip_* is best-effort.
 */
export async function runUcipPipeline(pool: Pool, userId: string, operation: 'rebuild' | 'fetch' = 'rebuild'): Promise<PipelineOutcome> {
  const corr = randomUUID();
  const shadow = isUcipShadowMode();
  const start = Date.now();
  const steps: PipelineStep[] = [];

  emit({ event_type: ADAPTIVE_EVENTS.UCIP_REBUILD_STARTED, user_id: null, correlation_id: corr, payload: { user_id: userId, operation, shadow } });

  const profile = await runStep('build-profile', () => buildUcip(pool, userId, { shadowMode: shadow }), steps);

  let validation: UcipValidationReport | null = null;
  if (profile) {
    validation = await runStep('validate', async () => validateUcip(profile), steps);
  }

  if (profile && operation === 'rebuild') {
    await runStep('persist', async () => {
      const r = await persistUcip(pool, profile);
      if (!r.ok) throw new Error(r.error ?? 'persist failed');
    }, steps);
  }

  const sourcesSummary = profile?.orchestrationMetadata?.sources;
  const sourcesOk = sourcesSummary?.ok ?? 0;
  const sourcesFailed = sourcesSummary?.failed ?? 0;
  const duration = Date.now() - start;
  const failedSteps = steps.filter(s => s.status === 'failed').length;
  const status: PipelineOutcome['status'] = !profile ? 'failed' : failedSteps > 0 ? 'partial' : 'success';

  await recordLog(pool, corr, userId, operation, status, shadow, duration, sourcesOk, sourcesFailed, validation ?? undefined, { steps });

  if (status === 'failed') {
    emit({ event_type: ADAPTIVE_EVENTS.UCIP_REBUILD_FAILED, correlation_id: corr, payload: { user_id: userId, operation } });
  } else {
    emit({ event_type: ADAPTIVE_EVENTS.UCIP_REBUILD_COMPLETED, correlation_id: corr, payload: { user_id: userId, operation, status, duration_ms: duration } });
    emit({ event_type: ADAPTIVE_EVENTS.UCIP_PROFILE_UPDATED, correlation_id: corr, payload: { user_id: userId } });
  }

  return {
    correlation_id: corr,
    user_id: userId,
    shadow_mode: shadow,
    status,
    steps,
    profile: profile ?? undefined,
    validation: validation ?? undefined,
    duration_ms: duration,
  };
}
