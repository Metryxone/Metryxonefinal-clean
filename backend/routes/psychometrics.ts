/**
 * Psychometrics routes — Phase 3.
 *
 * Surfaces Bayesian inference + evidence reliability + longitudinal stability
 * as auditable HTTP endpoints. Mirrors the Phase 2 envelope contract:
 *
 *   - Every response (success / fallback / 401 / 403) carries `language_policy`
 *     and `methodology_versions` via the central `withEnvelope()` helper.
 *   - Public preview endpoints work on inline body data (nothing persisted,
 *     nothing read from DB).
 *   - User-bound endpoints require auth; `user_id` is derived from the
 *     authenticated session — client-supplied ids are ignored.
 *   - Never throws — `handleError()` returns `{ ok:false, fallback:true }`.
 *
 * Endpoints:
 *   GET  /api/psychometrics/methodology    — versions + language policy
 *   POST /api/psychometrics/infer          — inline diagnose → reliability +
 *                                            per-signal posterior + per-competency
 *                                            posterior (no persistence)
 *   POST /api/psychometrics/infer/profile  — auth; same as /infer but seeds from
 *                                            stored career-seeker profile +
 *                                            best-effort persists posteriors
 *   GET  /api/psychometrics/stability      — auth; analyses the session-user's
 *                                            evolution timeline
 *   POST /api/psychometrics/uncertainty-band — wraps any point score 0..100 in
 *                                            ± uncertainty derived from the
 *                                            posterior (EI / fitment / transition)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

import {
  extractAndScore, buildSourcesFromProfile,
  type EvidenceSource,
} from '../services/evidence-extractor.js';
import { detectContradictions, CONTRADICTION_VERSION } from '../services/contradiction-detector.js';
import { BSIG_VERSION } from '../services/behavioral-signal-engine.js';
import { scoreReliabilityBatch, RELIABILITY_VERSION } from '../services/evidence-reliability-engine.js';
import { inferSignalBatch, inferCompetencies, uncertaintyBand, BAYES_VERSION,
         type SignalPosterior } from '../services/bayesian-inference-engine.js';
import { analyseStability, STABILITY_VERSION } from '../services/stability-analysis-engine.js';
import { getBehaviouralEvolution } from '../services/behavioural-memory.js';

const LANGUAGE_POLICY = Object.freeze({
  allowed: [
    'probability of mastery', 'posterior estimate', 'confidence interval',
    'evidence strength', 'reliability composite', 'stability indicator',
  ],
  disallowed: [
    'hiring prediction', 'guaranteed outcome', 'certainty of success',
    'character defect', 'psychiatric diagnosis',
  ],
});

const METHODOLOGY_VERSIONS = Object.freeze({
  bsig: BSIG_VERSION,
  contradiction: CONTRADICTION_VERSION,
  reliability: RELIABILITY_VERSION,
  bayesian: BAYES_VERSION,
  stability: STABILITY_VERSION,
});

function withEnvelope<T extends Record<string, unknown>>(payload: T) {
  return { ...payload, language_policy: LANGUAGE_POLICY, methodology_versions: METHODOLOGY_VERSIONS };
}

function sessionUserId(req: Request): string | null {
  // @ts-expect-error passport user
  const u = req.user;
  return u && typeof u.id === 'string' ? u.id : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-expect-error passport extends req
  if (req.isAuthenticated && req.isAuthenticated() && sessionUserId(req)) return next();
  return res.status(401).json(withEnvelope({
    ok: false, fallback: true, fallback_reason: 'authentication_required',
  }));
}

export function registerPsychometricsRigorRoutes(
  { app, pool }: { app: Express; pool: Pool },
) {

  // ── methodology disclosure ─────────────────────────────────────────────
  app.get('/api/psychometrics/methodology', (_req, res) => {
    res.json(withEnvelope({
      ok: true,
      prior: { distribution: 'Beta', alpha: 2, beta: 2, name: 'weakly_informative_neutral' },
      reliability_weights: {
        metric_specificity: 0.18, behavioural_density: 0.18, external_validation: 0.18,
        consistency: 0.18, recency: 0.18, anti_contradiction: 0.10,
      },
      ci_method: 'symmetric logit-space normal approximation (delta method)',
      stability_rules: ['temporary_spike', 'inconsistency', 'coaching_contamination', 'behavioural_instability'],
      excluded_evidence_thresholds: {
        composite_reliability_floor: 0.30,
        contradiction_invalidation: 0.50,
        density_floor: 0.15,
      },
    }));
  });

  // ── infer (inline, public preview — no DB) ─────────────────────────────
  app.post('/api/psychometrics/infer', async (req, res) => {
    try {
      const sources = parseInlineSources(req.body);
      res.json(withEnvelope(buildInferenceEnvelope(sources)));
    } catch (e) {
      handleError(res, e, 'infer_inline_failed');
    }
  });

  // ── infer from profile (auth) — best-effort persists posteriors ────────
  app.post('/api/psychometrics/infer/profile', requireAuth, async (req, res) => {
    try {
      const userId = sessionUserId(req)!;
      const { profile, jobs, goals } = await loadProfileBundle(pool, userId);
      const sources = buildSourcesFromProfile({ user_id: userId, profile, jobs, goals,
        transcripts: parseInlineList(req.body, 'transcripts'),
        simulations: parseInlineList(req.body, 'simulations') });

      if (sources.length === 0) {
        return res.json(withEnvelope({
          ok: true, fallback: true, fallback_reason: 'no_text_sources_available',
          signal_posteriors: [], competency_posteriors: [],
          reliability: [], excluded_signals: [],
        }));
      }

      const envelope = buildInferenceEnvelope(sources);

      // Best-effort persistence — non-blocking.
      let persisted = false;
      try {
        await persistInferences(pool, userId, envelope);
        persisted = true;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[psychometrics] persistence skipped:', (e as Error).message);
      }
      auditLog(pool, { user_id: userId, endpoint: 'infer/profile', status: 'ok',
        detail: { source_count: sources.length, persisted } }).catch(() => {});

      res.json(withEnvelope({ ...envelope, persisted }));
    } catch (e) {
      handleError(res, e, 'infer_profile_failed', sessionUserId(req));
    }
  });

  // ── stability analysis (auth; self-only) ───────────────────────────────
  app.get('/api/psychometrics/stability', requireAuth, async (req, res) => {
    try {
      const userId = sessionUserId(req)!;
      const windowDays = clampInt(Number(req.query.window_days ?? 180), 7, 720);
      const evolution = await getBehaviouralEvolution(pool, userId, windowDays);
      const result = analyseStability({ user_id: userId, window_days: windowDays, evolution });

      // Persist flags atomically (all-or-nothing). Persistence is best-effort
      // for the *user-facing* response — failure does not 500 — but the write
      // itself is transactional so we never leave partial rows behind.
      let persisted = false;
      if (result.flags.length > 0) {
        try {
          await persistStabilityFlags(pool, userId, result.stability_index, result.flags);
          persisted = true;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[psychometrics] stability persistence skipped:', (e as Error).message);
        }
      }
      auditLog(pool, { user_id: userId, endpoint: 'stability', status: 'ok',
        detail: { window_days: windowDays, flags: result.flags.length, persisted } }).catch(() => {});

      res.json(withEnvelope({ ok: true, persisted, ...result }));
    } catch (e) {
      handleError(res, e, 'stability_failed', sessionUserId(req));
    }
  });

  // ── uncertainty band on any point score (public) ───────────────────────
  app.post('/api/psychometrics/uncertainty-band', async (req, res) => {
    try {
      const body = (req.body ?? {}) as { point_score?: unknown; sources?: unknown };
      const pt = Number(body.point_score);
      if (!isFinite(pt)) return res.status(400).json(withEnvelope({
        ok: false, fallback: true, fallback_reason: 'point_score_required',
      }));

      // Optional: caller passes sources so we derive a posterior; otherwise
      // we wrap with a conservative ±10pt band.
      let posterior: { uncertainty: number; evidence_strength: number } | undefined;
      const sources = parseInlineSources(req.body);
      if (sources.length > 0) {
        const env = buildInferenceEnvelope(sources);
        const top = env.competency_posteriors[0];
        if (top) posterior = { uncertainty: top.uncertainty, evidence_strength: top.evidence_strength };
      }
      const band = uncertaintyBand({ point_score: pt, posterior });
      res.json(withEnvelope({ ok: true, ...band, posterior_used: !!posterior }));
    } catch (e) {
      handleError(res, e, 'uncertainty_band_failed');
    }
  });
}

// ── shared envelope builder ───────────────────────────────────────────────

function buildInferenceEnvelope(sources: EvidenceSource[]) {
  const { hits, scores } = extractAndScore(sources);
  const contradictions = detectContradictions(sources, scores);
  const reliability = scoreReliabilityBatch({ scores, sources, contradictions });
  const signal_posteriors = inferSignalBatch(scores, reliability);
  const competency_posteriors = inferCompetencies(signal_posteriors);

  const excluded_signals = reliability
    .filter(r => !!r.excluded_evidence_reason)
    .map(r => ({ signal_key: r.signal_key, reason: r.excluded_evidence_reason!, composite: r.composite_reliability }));

  return {
    ok: true,
    source_count: sources.length,
    sources_by_type: countByType(sources),
    hit_count: hits.length,
    reliability,
    signal_posteriors,
    competency_posteriors,
    contradictions,
    excluded_signals,
  };
}

// ── persistence ───────────────────────────────────────────────────────────

async function persistInferences(pool: Pool, userId: string,
  env: ReturnType<typeof buildInferenceEnvelope>): Promise<void> {
  if (env.signal_posteriors.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const relByKey = new Map(env.reliability.map(r => [r.signal_key, r]));
    for (const p of env.signal_posteriors) {
      const r = relByKey.get(p.signal_key);
      await client.query(
        `INSERT INTO psy_signal_inferences
          (user_id, signal_key, competency_id, alpha, beta,
           probability_mastery, uncertainty, evidence_strength,
           ci_lower, ci_upper, reliability_composite,
           prior_alpha, prior_beta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [userId, p.signal_key, p.competency_id, p.alpha, p.beta,
         p.probability_mastery, p.uncertainty, p.evidence_strength,
         p.confidence_interval.lower, p.confidence_interval.upper,
         r?.composite_reliability ?? null,
         p.prior_used.alpha, p.prior_used.beta],
      );
    }
    for (const c of env.competency_posteriors) {
      await client.query(
        `INSERT INTO psy_competency_inferences
          (user_id, competency_id, signal_count, probability_mastery, uncertainty,
           evidence_strength, ci_lower, ci_upper)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, c.competency_id, c.signal_count, c.probability_mastery,
         c.uncertainty, c.evidence_strength, c.confidence_interval.lower, c.confidence_interval.upper],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function persistStabilityFlags(
  pool: Pool, userId: string, stabilityIndex: number,
  flags: Array<{ rule_id: string; signal_key?: string; severity: string;
    evidence: Record<string, number | string>; developmental_action: string }>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of flags) {
      await client.query(
        `INSERT INTO psy_stability_flags
          (user_id, rule_id, signal_key, severity, stability_index, evidence, developmental_action)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, f.rule_id, f.signal_key ?? null, f.severity,
         stabilityIndex, JSON.stringify(f.evidence), f.developmental_action],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function auditLog(pool: Pool, args: {
  user_id?: string | null; endpoint: string; status: 'ok'|'fallback'|'error';
  payload_hash?: string; detail?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO psy_audit_logs (user_id, endpoint, status, payload_hash, detail)
     VALUES ($1,$2,$3,$4,$5)`,
    [args.user_id ?? null, args.endpoint, args.status,
     args.payload_hash ?? null, JSON.stringify(args.detail ?? {})],
  );
}

// ── helpers (mirror Phase 2 patterns) ─────────────────────────────────────

function parseInlineSources(body: unknown): EvidenceSource[] {
  if (!body || typeof body !== 'object') return [];
  const raw = (body as { sources?: unknown }).sources;
  if (!Array.isArray(raw)) return [];
  const out: EvidenceSource[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    if (typeof o.text !== 'string' || !o.text.trim()) continue;
    out.push({
      source_type: (o.source_type as EvidenceSource['source_type']) ?? 'profile_summary',
      source_id:   typeof o.source_id   === 'string' ? o.source_id   : '',
      text:        o.text,
      occurred_at: typeof o.occurred_at === 'string' ? o.occurred_at : undefined,
    });
  }
  return out;
}

function parseInlineList(body: unknown, key: string): Array<{ id?: string; text: string; occurred_at?: string }> {
  if (!body || typeof body !== 'object') return [];
  const raw = (body as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof x.text === 'string')
    .map(x => ({
      id: typeof x.id === 'string' ? x.id : undefined,
      text: x.text as string,
      occurred_at: typeof x.occurred_at === 'string' ? x.occurred_at : undefined,
    }));
}

async function loadProfileBundle(pool: Pool, userId: string): Promise<{
  profile: Record<string, unknown> | null;
  jobs:    Array<Record<string, unknown>>;
  goals:   Array<Record<string, unknown>>;
}> {
  let profile: Record<string, unknown> | null = null;
  try {
    const r = await pool.query<{ data: Record<string, unknown> }>(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
    profile = r.rows[0]?.data ?? null;
  } catch { /* */ }
  let jobs: Array<Record<string, unknown>> = [];
  let goals: Array<Record<string, unknown>> = [];
  try { jobs  = (await pool.query(`SELECT * FROM career_seeker_jobs  WHERE user_id = $1`, [userId])).rows ?? []; } catch {/*ignore*/}
  try { goals = (await pool.query(`SELECT * FROM career_seeker_goals WHERE user_id = $1`, [userId])).rows ?? []; } catch {/*ignore*/}
  return { profile, jobs, goals };
}

function countByType(sources: EvidenceSource[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of sources) m[s.source_type] = (m[s.source_type] ?? 0) + 1;
  return m;
}

function handleError(res: Response, e: unknown, label: string, userId?: string | null) {
  const msg = (e as Error)?.message ?? 'unknown';
  // eslint-disable-next-line no-console
  console.warn(`[psychometrics] ${label}:`, msg);
  void userId;
  res.status(200).json(withEnvelope({
    ok: false, fallback: true, fallback_reason: msg, label,
  }));
}

function clampInt(n: number, min: number, max: number): number {
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// keep SignalPosterior re-exportable for tests
export type _SignalPosterior = SignalPosterior;
