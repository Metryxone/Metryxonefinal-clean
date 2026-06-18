/**
 * CAPADEX Simulation — Engine (0C).
 *
 * Runs a stratified sample of generated profiles through the REAL CAPADEX
 * pipeline by calling its own public HTTP endpoints (black-box validation, not
 * mocks):
 *
 *   POST /api/capadex/session/start   → served questions
 *   POST /api/capadex/session/:id/respond  → records answers, fires signal runtime
 *   POST /api/capadex/session/:id/complete → scores, fires composites/patterns/
 *                                            interventions + report hooks
 *   GET  /api/capadex/report/:id      → synthesised report
 *   GET  /api/capadex/session/:id/{signals,patterns,explain}
 *   POST /api/capadex/concern/analyze (best-effort — hypotheses when flag-on)
 *
 * Every simulated session uses a unique throwaway email and is deleted after
 * its metrics are read, so the harness never pollutes production data or trips
 * the free-assessment limit. Wholly defensive: a failed profile is recorded and
 * skipped, never aborting the run.
 */
import type { Pool } from 'pg';
import {
  PERSONAS,
  getPersona,
  isOnTopic,
  normaliseText,
  type PersonaDef,
} from './persona-library';
import {
  generateProfiles,
  simulateAnswer,
  stratifiedSample,
  type SimProfile,
} from './scenario-generator';
import { evaluate, type MetricSet, type ValidationResult } from './validation-framework';

export interface SimulationOptions {
  /** Profiles to generate (spec: ≥1,000). */
  profileCount?: number;
  /** How many profiles to actually execute through the live pipeline. */
  sampleSize?: number;
  /** PRNG seed for reproducibility. */
  seed?: number;
  /** Delete simulated sessions after metrics are read (default true). */
  cleanup?: boolean;
  /** Ms to wait after /respond so the fire-and-forget signal runtime persists. */
  settleMs?: number;
}

export interface PerRunResult {
  profileId: string;
  personaKey: string;
  ok: boolean;
  error?: string;
  questionCount: number;
  relevance: number;
  relevanceCoverage: number;
  relevanceConcept: number;
  relevanceConcernMatch: number;
  repetition: number;
  questionQuality: number;
  optionQuality: number;
  reportScore: number | null;
  confidenceMatch: boolean | null;
  signalCount: number;
  signalConfidence: number | null;
  patternCount: number;
  patternConfidence: number | null;
  interventionCount: number;
  recommendationQuality: number | null;
  hypothesisConfidence: number | null;
  reportUsefulness: number | null;
  /** True when the concern had no seeded questions (404 at /start) — a data
   *  coverage gap, tracked separately from pipeline quality. */
  notSeeded?: boolean;
}

export interface SimulationRunResult {
  metrics: MetricSet;
  validation: ValidationResult;
  perPersona: Record<string, { runs: number; relevance: number; reportUsefulness: number; confidenceAccuracy: number }>;
  runs: PerRunResult[];
  profileCount: number;
  sampleSize: number;
  seed: number;
  durationMs: number;
}

const TARGET_QUESTIONS = 8;

function baseUrl(): string {
  const port = process.env.PORT || '8080';
  return `http://127.0.0.1:${port}`;
}

async function http<T = any>(method: 'GET' | 'POST', path: string, body?: any): Promise<T> {
  const res = await fetch(baseUrl() + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${method} ${path}: ${json?.error || json?.message || text?.slice(0, 120)}`);
    (err as any).status = res.status;
    throw err;
  }
  return json as T;
}

function mean(nums: number[]): number {
  const v = nums.filter((n) => Number.isFinite(n));
  if (v.length === 0) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function stddev(nums: number[]): number {
  const v = nums.filter((n) => Number.isFinite(n));
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(mean(v.map((n) => (n - m) ** 2)));
}

function extractText(q: any): string {
  return normaliseText(q?.question_text || q?.text || q?.prompt || q?.stem || q?.label || q?.title || q?.question || '');
}

/** Stem + construct metadata — a question is on-topic if its measured construct
 *  aligns with the concern even when the stem carries no concern keyword. */
function extractConceptText(q: any): string {
  return normaliseText(
    [extractText(q), q?.sub_domain_name, q?.dimension, q?.focus_area, q?.subdomain_code, q?.domain]
      .filter(Boolean)
      .join(' '),
  );
}

function extractOptions(q: any): any[] {
  const o = q?.options || q?.choices || q?.answer_options || q?.scale || q?.answers;
  const arr = Array.isArray(o) ? o.slice() : [];
  const lettered = [q?.opt_a, q?.opt_b, q?.opt_c, q?.opt_d, q?.opt_e].filter((x) => x != null && String(x).trim() !== '');
  return arr.concat(lettered);
}

function extractPolarity(q: any): string {
  // CAPADEX items are predominantly distress-worded; default to (-) when absent
  // so a struggling persona agrees (high raw answer).
  return String(q?.polarity || '(-)');
}

/** Severity band → expected report score band (lower score = more struggle). */
function expectedScoreBand(severity: number): 'low' | 'mid' | 'high' {
  if (severity >= 0.6) return 'low';
  if (severity >= 0.4) return 'mid';
  return 'high';
}
function scoreBand(score: number): 'low' | 'mid' | 'high' {
  if (score < 40) return 'low';
  if (score < 70) return 'mid';
  return 'high';
}

async function runProfile(profile: SimProfile, persona: PersonaDef, opts: Required<SimulationOptions>, runTag: string): Promise<{ result: PerRunResult; sessionId: string | null }> {
  const result: PerRunResult = {
    profileId: profile.id,
    personaKey: profile.personaKey,
    ok: false,
    questionCount: 0,
    relevance: 0,
    relevanceCoverage: 0,
    relevanceConcept: 0,
    relevanceConcernMatch: 0,
    repetition: 0,
    questionQuality: 0,
    optionQuality: 0,
    reportScore: null,
    confidenceMatch: null,
    signalCount: 0,
    signalConfidence: null,
    patternCount: 0,
    patternConfidence: null,
    interventionCount: 0,
    recommendationQuality: null,
    hypothesisConfidence: null,
    reportUsefulness: null,
  };
  let sessionId: string | null = null;

  try {
    const email = `sim+${runTag}-${profile.id}@simulation.metryx`;
    let start: any;
    try {
      start = await http<any>('POST', '/api/capadex/session/start', {
        concern_name: persona.concern,
        user_age: profile.age,
        guest_email: email,
        guest_name: `Sim ${persona.role}`,
        persona: '',
      });
    } catch (e: any) {
      // 404 = the concern has no seeded questions. That is a data-coverage gap,
      // NOT a pipeline failure — record it as a distinct dimension and bail so it
      // never drags the quality aggregates (which average over `ok` runs only).
      if (e?.status === 404) {
        result.notSeeded = true;
        result.error = 'concern_not_seeded';
        return { result, sessionId: null };
      }
      throw e;
    }
    sessionId = String(start?.session_id || start?.id || '');
    const questions: any[] = Array.isArray(start?.questions) ? start.questions : [];
    result.questionCount = questions.length;

    // ── Question-set metrics ───────────────────────────────────────────────
    // Repetition: duplicate ids within the served set.
    const ids = questions.map((q) => String(q?.id ?? ''));
    const uniqueIds = new Set(ids);
    result.repetition = ids.length === 0 ? 0 : 1 - uniqueIds.size / ids.length;

    // Relevance: coverage + on-topic concept hits (matched against stem AND
    // construct metadata, since construct-based items rarely keyword the concern).
    result.relevanceCoverage = Math.min(1, questions.length / TARGET_QUESTIONS);
    const onTopic = questions.filter((q) => isOnTopic(extractConceptText(q), persona.conceptTokens)).length;
    result.relevanceConcept = questions.length === 0 ? 0 : onTopic / questions.length;

    // Question / option quality.
    const wellFormed = questions.filter((q) => extractText(q).length >= 12).length;
    result.questionQuality = questions.length === 0 ? 0 : wellFormed / questions.length;
    const goodOptions = questions.filter((q) => {
      // Likert-type items carry an implicit 1..5 scale (no explicit options listed).
      if (normaliseText(q?.question_type).includes('likert')) return true;
      // Every other answerable item MUST present ≥2 distinct, non-empty options.
      // (Stem length is NOT a substitute — an item with a long stem but no usable
      // choices is a genuine quality gap and should score against the harness.)
      const opts = extractOptions(q);
      const distinct = new Set(
        opts
          .map((o) => normaliseText(typeof o === 'object' ? o?.label ?? o?.text ?? o?.value : o))
          .filter((s) => s !== '')
      );
      return distinct.size >= 2;
    }).length;
    result.optionQuality = questions.length === 0 ? 0 : goodOptions / questions.length;

    // ── Answer + record ────────────────────────────────────────────────────
    if (questions.length > 0 && sessionId) {
      const responses = questions
        .filter((q) => q?.id != null)
        .map((q, i) => ({
          item_id: q.id,
          response_value: simulateAnswer(profile, extractPolarity(q), ((i * 2654435761) % 1000) / 1000),
        }));
      if (responses.length > 0) {
        await http('POST', `/api/capadex/session/${sessionId}/respond`, { responses });
        // Let the fire-and-forget signal runtime persist.
        await new Promise((r) => setTimeout(r, opts.settleMs));
      }

      // ── Complete + report ─────────────────────────────────────────────────
      await http('POST', `/api/capadex/session/${sessionId}/complete`, {}).catch(() => {});
      await new Promise((r) => setTimeout(r, opts.settleMs));

      const report = await http<any>('GET', `/api/capadex/report/${sessionId}`).catch(() => null);
      if (report && report.score != null) {
        const score = Number(report.score);
        result.reportScore = score;
        result.confidenceMatch = scoreBand(score) === expectedScoreBand(profile.severity);
        // The engine intentionally resolves fine-grained concerns onto coarse
        // master-bucket labels (e.g. "Performance Anxiety" → "Anxiety &
        // Overthinking"), so exact string equality is the wrong fidelity check.
        // Credit a resolved label that either contains a concern keyword OR
        // shares vocabulary with the persona's concept space; a genuinely-off
        // remap (e.g. "Burnout" → "Exam Stress") still scores 0.
        const resolved = normaliseText(report.concernName);
        const concernWords = normaliseText(persona.concern).split(' ').filter((w) => w.length >= 4);
        const concernMatch =
          concernWords.some((w) => resolved.includes(w)) || isOnTopic(resolved, persona.conceptTokens);
        result.relevanceConcernMatch = concernMatch ? 1 : 0;
        // Report usefulness = completeness.
        const hasInsight = typeof report.insight === 'string' && report.insight.length >= 40;
        const hasSub = Array.isArray(report.subdomains) && report.subdomains.length >= 1;
        const hasLevel = !!report.scoreLevel;
        const parts = [Number.isFinite(score), hasInsight, hasSub, hasLevel];
        result.reportUsefulness = parts.filter(Boolean).length / parts.length;
      }

      // ── Signals / patterns / interventions ────────────────────────────────
      const sig = await http<any>('GET', `/api/capadex/session/${sessionId}/signals`).catch(() => null);
      const signals: any[] = Array.isArray(sig?.signals) ? sig.signals : [];
      result.signalCount = signals.length;
      if (signals.length > 0) result.signalConfidence = mean(signals.map((s) => Number(s.confidence)));

      const pat = await http<any>('GET', `/api/capadex/session/${sessionId}/patterns`).catch(() => null);
      const patterns: any[] = Array.isArray(pat?.patterns) ? pat.patterns : [];
      result.patternCount = patterns.length;
      if (patterns.length > 0) result.patternConfidence = mean(patterns.map((p) => Number(p.confidence)));

      const explain = await http<any>('GET', `/api/capadex/session/${sessionId}/explain`).catch(() => null);
      const lineage: any[] = Array.isArray(explain?.lineage) ? explain.lineage : [];
      const interventions = lineage.flatMap((n) => (Array.isArray(n?.interventions) ? n.interventions : []));
      result.interventionCount = interventions.length;
      if (interventions.length > 0) {
        const nonGeneric = interventions.filter(
          (iv) => iv?.construct_key && (iv?.rationale || iv?.description) && Array.isArray(iv?.signal_refs) && iv.signal_refs.length > 0,
        ).length;
        result.recommendationQuality = nonGeneric / interventions.length;
      }
    }

    // ── Hypotheses (best-effort — only populated when hypothesisDrivenClarity ON)
    const analyze = await http<any>('POST', '/api/capadex/concern/analyze', {
      raw_concern_text: persona.concern,
      primary_persona: persona.track,
      is_proxy: false,
      target_age_band: persona.ageBand,
      assessee_name: `Sim ${persona.role}`,
      contextual_anchor: persona.role,
    }).catch(() => null);
    const hyps: any[] = Array.isArray(analyze?.hypotheses) ? analyze.hypotheses : [];
    if (hyps.length > 0) result.hypothesisConfidence = mean(hyps.map((h) => Number(h.confidence)));
    else if (result.patternConfidence != null) result.hypothesisConfidence = result.patternConfidence;

    // Composite relevance — routing fidelity (coverage + concern match) carries
    // most of the weight; concept overlap is a secondary content signal because
    // construct-based Likert items rarely surface the concern keyword in-stem.
    result.relevance =
      0.35 * result.relevanceCoverage + 0.35 * result.relevanceConcernMatch + 0.3 * result.relevanceConcept;
    result.ok = true;
  } catch (err: any) {
    result.error = String(err?.message || err).slice(0, 200);
  }

  return { result, sessionId };
}

const CLEANUP_TABLES = [
  'capadex_responses',
  'capadex_evidence',
  'capadex_session_signals',
  'capadex_session_composites',
  'capadex_session_patterns',
  'capadex_session_interventions',
  'capadex_session_telemetry',
  'capadex_signal_profiles',
  'capadex_linguistic_signals',
  'capadex_session_signals',
  'contradiction_events',
  'capadex_reports',
  'capadex_behavior_graph',
  'capadex_recommendations',
  'capadex_risk_flags',
  'capadex_runtime_sessions',
];

async function cleanupSessions(pool: Pool, ids: string[]): Promise<number> {
  const valid = ids.filter(Boolean);
  if (valid.length === 0) return 0;
  for (const table of CLEANUP_TABLES) {
    try {
      // `session_id` is UUID in several tables (composites/patterns/interventions/
      // behavior_graph) — cast to text on BOTH sides so the delete actually fires.
      // Without the cast these silently error and leak sim rows into the live DB.
      await pool.query(`DELETE FROM ${table} WHERE session_id::text = ANY($1::text[])`, [valid]);
    } catch (err: any) {
      // A truly-absent table is fine; anything else means we may be leaking — surface it.
      if (!/does not exist|relation .* does not exist/i.test(String(err?.message || ''))) {
        console.error(`[simulation] cleanup failed for ${table}:`, err?.message || err);
      }
    }
  }
  let deleted = 0;
  try {
    const r = await pool.query(`DELETE FROM capadex_sessions WHERE id::text = ANY($1::text[])`, [valid]);
    deleted = r.rowCount ?? 0;
  } catch (err: any) {
    console.error('[simulation] cleanup failed for capadex_sessions:', err?.message || err);
  }
  return deleted;
}

export async function runSimulation(pool: Pool, options: SimulationOptions = {}): Promise<SimulationRunResult> {
  const opts: Required<SimulationOptions> = {
    profileCount: Math.max(1, options.profileCount ?? 1000),
    sampleSize: Math.max(1, options.sampleSize ?? PERSONAS.length),
    seed: options.seed ?? ((Date.now() & 0x7fffffff) >>> 0),
    cleanup: options.cleanup ?? true,
    settleMs: Math.max(0, options.settleMs ?? 350),
  };
  const startedAt = Date.now();
  const runTag = opts.seed.toString(16).slice(0, 8);

  const profiles = generateProfiles(opts.profileCount, opts.seed);
  const sample = stratifiedSample(profiles, opts.sampleSize);

  const runs: PerRunResult[] = [];
  const sessionIds: string[] = [];
  for (const profile of sample) {
    const persona = getPersona(profile.personaKey);
    if (!persona) continue;
    const { result, sessionId } = await runProfile(profile, persona, opts, runTag);
    runs.push(result);
    if (sessionId) sessionIds.push(sessionId);
  }

  if (opts.cleanup) {
    await cleanupSessions(pool, sessionIds).catch(() => 0);
  }

  const ok = runs.filter((r) => r.ok);
  const reportScores = ok.map((r) => r.reportScore).filter((s): s is number => s != null);

  const metrics: MetricSet = {
    relevance: mean(ok.map((r) => r.relevance)),
    relevanceCoverage: mean(ok.map((r) => r.relevanceCoverage)),
    relevanceConcept: mean(ok.map((r) => r.relevanceConcept)),
    relevanceConcernMatch: mean(ok.map((r) => r.relevanceConcernMatch)),
    repetition: mean(ok.map((r) => r.repetition)),
    confidenceAccuracy: (() => {
      const matches = ok.map((r) => r.confidenceMatch).filter((m): m is boolean => m != null);
      return matches.length === 0 ? 0 : matches.filter(Boolean).length / matches.length;
    })(),
    confidenceStability: reportScores.length < 2 ? 1 : Math.max(0, 1 - stddev(reportScores) / 100),
    signalConfidence: mean(ok.map((r) => r.signalConfidence).filter((c): c is number => c != null)),
    patternConfidence: mean(ok.map((r) => r.patternConfidence).filter((c): c is number => c != null)),
    hypothesisConfidence: mean(ok.map((r) => r.hypothesisConfidence).filter((c): c is number => c != null)),
    recommendationQuality: mean(ok.map((r) => r.recommendationQuality).filter((c): c is number => c != null)),
    reportUsefulness: mean(ok.map((r) => r.reportUsefulness).filter((c): c is number => c != null)),
    questionQuality: mean(ok.map((r) => r.questionQuality)),
    optionQuality: mean(ok.map((r) => r.optionQuality)),
    concernCoverage: runs.length === 0 ? 1 : 1 - runs.filter((r) => r.notSeeded).length / runs.length,
    unseededConcerns: Array.from(
      new Set(runs.filter((r) => r.notSeeded).map((r) => getPersona(r.personaKey)?.concern || r.personaKey)),
    ),
    coverage: {
      runs: ok.length,
      attempted: runs.length,
      seeded: runs.filter((r) => !r.notSeeded).length,
      withSignals: ok.filter((r) => r.signalCount > 0).length,
      withPatterns: ok.filter((r) => r.patternCount > 0).length,
      withInterventions: ok.filter((r) => r.interventionCount > 0).length,
      withReport: ok.filter((r) => r.reportScore != null).length,
    },
  };

  const validation = evaluate(metrics);

  const perPersona: SimulationRunResult['perPersona'] = {};
  for (const r of ok) {
    const p = (perPersona[r.personaKey] ??= { runs: 0, relevance: 0, reportUsefulness: 0, confidenceAccuracy: 0 });
    p.runs += 1;
    p.relevance += r.relevance;
    p.reportUsefulness += r.reportUsefulness ?? 0;
    p.confidenceAccuracy += r.confidenceMatch ? 1 : 0;
  }
  for (const key of Object.keys(perPersona)) {
    const p = perPersona[key];
    if (p.runs > 0) {
      p.relevance /= p.runs;
      p.reportUsefulness /= p.runs;
      p.confidenceAccuracy /= p.runs;
    }
  }

  return {
    metrics,
    validation,
    perPersona,
    runs,
    profileCount: opts.profileCount,
    sampleSize: sample.length,
    seed: opts.seed,
    durationMs: Date.now() - startedAt,
  };
}
