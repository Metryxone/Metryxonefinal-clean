/**
 * Behavioural Intelligence routes — Phase 2.
 *
 * Read + diagnostic endpoints under `/api/behavioural/*`. Never throws —
 * all routes catch and return `{ ok:false, fallback:true }` so the frontend
 * can degrade gracefully.
 *
 * Auth model:
 *   - GET  /taxonomy                 — public (static, no PII)
 *   - POST /diagnose                 — public preview (inline text only; nothing
 *                                      persisted; nothing read from DB)
 *   - POST /diagnose/profile         — REQUIRES auth; user_id is bound to the
 *                                      session user (client-supplied id is ignored)
 *   - GET  /evolution/:userId        — REQUIRES auth + self-only
 *   - POST /snapshot                 — REQUIRES auth; user_id bound to session
 *   - POST /recommendations          — public (operates on inline sources only)
 *
 * Every response envelope (success / fallback / error) carries `language_policy`.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { SIGNAL_TAXONOMY, BSIG_VERSION,
         rollupCompetency, type SignalScore } from '../services/behavioral-signal-engine.js';
import { extractAndScore, buildSourcesFromProfile,
         type EvidenceSource } from '../services/evidence-extractor.js';
import { detectContradictions, CONTRADICTION_VERSION,
         type ContradictionResult } from '../services/contradiction-detector.js';
import { persistBehaviouralSnapshot, getBehaviouralEvolution,
         getLatestSnapshot } from '../services/behavioural-memory.js';

const LANGUAGE_POLICY = Object.freeze({
  allowed:    ['developmental indicator', 'behavioural pattern', 'evidence strength', 'narrative gap'],
  disallowed: ['hiring prediction', 'promotion guarantee', 'character flaw', 'personality defect'],
});

function withPolicy<T extends Record<string, unknown>>(payload: T): T & { language_policy: typeof LANGUAGE_POLICY } {
  return { ...payload, language_policy: LANGUAGE_POLICY };
}

function sessionUserId(req: Request): string | null {
  // @ts-expect-error passport user
  const u = req.user;
  return u && typeof u.id === 'string' ? u.id : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-expect-error passport extends req
  if (req.isAuthenticated && req.isAuthenticated() && sessionUserId(req)) return next();
  return res.status(401).json(withPolicy({
    ok: false, fallback: true, fallback_reason: 'authentication_required',
    taxonomy_version: BSIG_VERSION,
  }));
}

export function registerBehaviouralIntelligenceRoutes(
  { app, pool, db }: { app: Express; pool: Pool; db?: { execute: (q: unknown) => Promise<{ rows?: unknown[] }> } },
) {

  // ── taxonomy (public) ────────────────────────────────────────────────────
  app.get('/api/behavioural/taxonomy', (_req, res) => {
    res.json(withPolicy({
      ok: true,
      version: BSIG_VERSION,
      signals: SIGNAL_TAXONOMY.map(s => ({
        key: s.key,
        label: s.label,
        competency_id: s.competency_id,
        description: s.description,
        pattern_count: s.patterns.length,
        expects_quantifier: !!s.expects_quantifier,
      })),
    }));
  });

  // ── diagnose (inline sources, public preview — no DB read/write) ─────────
  app.post('/api/behavioural/diagnose', async (req, res) => {
    try {
      const sources = parseInlineSources(req.body);
      const { hits, scores } = extractAndScore(sources);
      const contradictions = detectContradictions(sources, scores);
      res.json(withPolicy(buildDiagnosisEnvelope({ sources, hits, scores, contradictions })));
    } catch (e) {
      handleError(res, e, 'diagnose_inline_failed');
    }
  });

  // ── diagnose from stored career-seeker profile (auth + self-bound) ───────
  app.post('/api/behavioural/diagnose/profile', requireAuth, async (req, res) => {
    try {
      const userId = sessionUserId(req)!;  // requireAuth guarantees non-null

      const { profile, jobs, goals } = await loadProfileBundle(pool, db, userId);
      const sources = buildSourcesFromProfile({ user_id: userId, profile, jobs, goals,
                                                transcripts: parseInlineList(req.body, 'transcripts'),
                                                simulations: parseInlineList(req.body, 'simulations') });

      if (sources.length === 0) {
        return res.json(withPolicy({
          ok: true, fallback: true, fallback_reason: 'no_text_sources_available',
          taxonomy_version: BSIG_VERSION, contradiction_version: CONTRADICTION_VERSION,
          sources: [], scores: [], contradictions: { contradiction_score: 0, contradiction_flags: [], rules_evaluated: 0 },
          rollups: [],
        }));
      }

      const { hits, scores } = extractAndScore(sources);
      const contradictions = detectContradictions(sources, scores);

      // Best-effort persistence — non-blocking. Bound to the authenticated user.
      let persisted = false;
      try {
        await persistBehaviouralSnapshot(pool, { user_id: userId, scores, sources, contradictions });
        persisted = true;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[behavioural] persistence skipped:', (e as Error).message);
      }

      res.json(withPolicy({
        ...buildDiagnosisEnvelope({ sources, hits, scores, contradictions }),
        persisted,
      }));
    } catch (e) {
      handleError(res, e, 'diagnose_profile_failed');
    }
  });

  // ── evolution timelines (auth + self-only) ───────────────────────────────
  app.get('/api/behavioural/evolution/:userId', requireAuth, async (req, res) => {
    try {
      const sessionId = sessionUserId(req)!;
      const paramId = String(req.params.userId).trim();
      // Self-only: refuse cross-user reads.
      if (paramId !== sessionId) {
        return res.status(403).json(withPolicy({
          ok: false, fallback: true, fallback_reason: 'cross_user_read_forbidden',
          taxonomy_version: BSIG_VERSION,
        }));
      }
      const windowDays = clampInt(Number(req.query.window_days ?? 180), 7, 720);
      const evolution = await getBehaviouralEvolution(pool, sessionId, windowDays);
      const latest = await getLatestSnapshot(pool, sessionId);
      res.json(withPolicy({
        ok: true,
        version: BSIG_VERSION,
        user_id: sessionId,
        window_days: windowDays,
        evolution,
        latest_snapshot_at: latest.snapshot_ts,
        latest_snapshot_signal_count: latest.signal_count,
      }));
    } catch (e) {
      handleError(res, e, 'evolution_failed');
    }
  });

  // ── manual snapshot persistence (auth + self-bound) ──────────────────────
  app.post('/api/behavioural/snapshot', requireAuth, async (req, res) => {
    try {
      const userId = sessionUserId(req)!;
      const sources = parseInlineSources(req.body);
      const { scores } = extractAndScore(sources);
      const contradictions = detectContradictions(sources, scores);
      const result = await persistBehaviouralSnapshot(pool, { user_id: userId, scores, sources, contradictions });
      res.json(withPolicy({ ok: true, version: BSIG_VERSION, ...result }));
    } catch (e) {
      handleError(res, e, 'snapshot_failed');
    }
  });

  // ── behaviour-driven recommendations (inline-only, public) ───────────────
  app.post('/api/behavioural/recommendations', async (req, res) => {
    try {
      const sources = parseInlineSources(req.body);
      const { scores } = extractAndScore(sources);
      const contradictions = detectContradictions(sources, scores);
      const recommendations = buildBehaviouralRecommendations(scores, contradictions);
      res.json(withPolicy({
        ok: true,
        version: BSIG_VERSION,
        recommendations,
        contradiction_score: contradictions.contradiction_score,
      }));
    } catch (e) {
      handleError(res, e, 'recommendations_failed');
    }
  });
}

// ─── shared helpers ──────────────────────────────────────────────────────

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

async function loadProfileBundle(
  pool: Pool,
  db: { execute: (q: unknown) => Promise<{ rows?: unknown[] }> } | undefined,
  userId: string,
): Promise<{ profile: Record<string, unknown> | null;
             jobs: Array<Record<string, unknown>>;
             goals: Array<Record<string, unknown>> }> {
  let profile: Record<string, unknown> | null = null;
  try {
    const r = await pool.query<{ data: Record<string, unknown> }>(
      `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
    profile = r.rows[0]?.data ?? null;
  } catch { /* table may not exist in test environments */ }

  let jobs: Array<Record<string, unknown>> = [];
  let goals: Array<Record<string, unknown>> = [];
  try {
    const j = await pool.query(`SELECT * FROM career_seeker_jobs WHERE user_id = $1`, [userId]);
    jobs = j.rows ?? [];
  } catch { /* */ }
  try {
    const g = await pool.query(`SELECT * FROM career_seeker_goals WHERE user_id = $1`, [userId]);
    goals = g.rows ?? [];
  } catch { /* */ }

  void db;
  return { profile, jobs, goals };
}

function buildDiagnosisEnvelope(args: {
  sources: EvidenceSource[];
  hits: ReturnType<typeof extractAndScore>['hits'];
  scores: SignalScore[];
  contradictions: ContradictionResult;
}) {
  const competencyIds = Array.from(new Set(args.scores.map(s => s.competency_id)));
  const rollups = competencyIds.map(cid => rollupCompetency(cid, args.scores));
  return {
    ok: true,
    taxonomy_version: BSIG_VERSION,
    contradiction_version: CONTRADICTION_VERSION,
    source_count: args.sources.length,
    sources_by_type: countByType(args.sources),
    hit_count: args.hits.length,
    scores: args.scores,
    rollups,
    contradictions: args.contradictions,
  };
}

function countByType(sources: EvidenceSource[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of sources) m[s.source_type] = (m[s.source_type] ?? 0) + 1;
  return m;
}

interface BehaviouralRecommendation {
  id: string;
  title: string;
  detail: string;
  competency_id: string | null;
  signal_key: string | null;
  priority: 'high' | 'medium' | 'low';
  source: 'behavioural_gap' | 'contradiction';
  developmental_action: string;
}

function buildBehaviouralRecommendations(
  scores: SignalScore[],
  contradictions: ContradictionResult,
): BehaviouralRecommendation[] {
  const out: BehaviouralRecommendation[] = [];

  const weakest = scores
    .filter(s => s.behavioural_strength < 0.5)
    .sort((a, b) => a.behavioural_strength - b.behavioural_strength)
    .slice(0, 3);

  for (const s of weakest) {
    out.push({
      id: `bsig_${s.signal_key}`,
      title: `Strengthen "${s.label}"`,
      detail: s.evidence.length === 0
        ? `Your narrative contains no evidence of "${s.label}". Adding 2–3 concrete examples will close this gap.`
        : `Your "${s.label}" signal is at ${(s.behavioural_strength * 100).toFixed(0)}% strength with ${s.evidence_count} source(s) of evidence. Add 2 more examples to make this signal consistent.`,
      competency_id: s.competency_id,
      signal_key: s.signal_key,
      priority: s.behavioural_strength < 0.25 ? 'high'
              : s.behavioural_strength < 0.40 ? 'medium' : 'low',
      source: 'behavioural_gap',
      developmental_action: `Write 2–3 concrete examples demonstrating ${s.label.toLowerCase()} in your resume, projects, or interview prep.`,
    });
  }

  for (const f of contradictions.contradiction_flags) {
    out.push({
      id: `contradiction_${f.rule_id}`,
      title: f.title,
      detail: f.detail,
      competency_id: null,
      signal_key: null,
      priority: f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'low',
      source: 'contradiction',
      developmental_action: f.developmental_action ?? 'Audit your narrative and add supporting evidence.',
    });
  }

  return out;
}

function handleError(res: Response, e: unknown, label: string) {
  const msg = (e as Error)?.message ?? 'unknown';
  // eslint-disable-next-line no-console
  console.warn(`[behavioural] ${label}:`, msg);
  res.status(200).json(withPolicy({
    ok: false, fallback: true, fallback_reason: msg, label,
    taxonomy_version: BSIG_VERSION,
  }));
}

function clampInt(n: number, min: number, max: number): number {
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export type _Req = Request;
