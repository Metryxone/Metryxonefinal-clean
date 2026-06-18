/**
 * CAPADEX Unified Behavior Graph (read-only aggregator + persistence).
 *
 * Stitches the per-session output of EVERY existing intelligence system into a
 * single, explainable graph — WITHOUT creating any new ontology or signals.
 * It only reads what the runtime already persisted and folds it into one shape:
 *
 *     Concern
 *        ↓
 *     Signals          ← capadex_session_signals  (+ Pragati signal_store)
 *        ↓
 *     Patterns         ← capadex_session_patterns (+ Pragati patterns)
 *        ↓
 *     Risk Factors     ← contradiction_events + capadex_risk_flags + low-score
 *        ↓
 *     Interventions    ← capadex_session_interventions
 *        ↓
 *     Growth Indicators← OMEGA-X longitudinal memory (drift / growth / recovery)
 *        ↓
 *     CSI Contribution ← csi_profiles (score / domains / +ve / -ve factors)
 *
 * Confidence blends signal/pattern confidence with the OMEGA-X quality gate.
 *
 * Persisted ONE-PER-SESSION into `capadex_behavior_graph` (PK = session_id,
 * absolute upsert). Lazy ensureBehaviorGraphSchema() mirrors the canonical
 * migration backend/migrations/20260530_behavior_graph.sql (no migration runner).
 *
 * NB: every external read is best-effort and wrapped — a missing subsystem
 * NEVER breaks graph generation, and graph generation NEVER breaks the caller.
 */
import type { Pool } from 'pg';
import {
  getSessionSignals,
  getSessionPatterns,
  getSessionInterventions,
} from './capadex-explainability-engine';
import { buildOmegaReport } from './omega-report-builder';
import { buildMemory } from './longitudinal-memory';

// ── Graph node shapes ─────────────────────────────────────────────────────────
export interface BehaviorGraphSignal {
  signal_key: string;
  strength: number;
  confidence: number;
  lifecycle_state: string | null;
  source: 'capadex' | 'pragati';
}

export interface BehaviorGraphPattern {
  pattern_key: string;
  label: string | null;
  confidence: number;
  signal_refs: string[];
  explanation: string | null;
  source: 'capadex' | 'pragati';
}

export interface BehaviorGraphRisk {
  risk_key: string;
  type: string;
  severity: string; // critical | high | medium | low
  description: string;
  source: 'risk_flag' | 'contradiction' | 'score';
}

export interface BehaviorGraphIntervention {
  intervention_key: string;
  construct_key: string | null;
  title: string | null;
  expected_impact: number;
  confidence: number;
  rank: number;
}

export interface BehaviorGraphGrowthIndicator {
  key: string;
  direction: string; // improving | stable | declining | emerging | recovering
  detail: string;
  source: 'omega_longitudinal';
}

export interface BehaviorGraphCsiFactor {
  factor: string;
  kind: 'contribution' | 'domain' | 'positive' | 'negative';
  value: number | null;
  detail: string;
}

/** The Unified Behavior Graph for a single session. */
export interface BehaviorGraph {
  session_id: string;
  concern: string | null;
  signals: BehaviorGraphSignal[];
  patterns: BehaviorGraphPattern[];
  risks: BehaviorGraphRisk[];
  interventions: BehaviorGraphIntervention[];
  growthIndicators: BehaviorGraphGrowthIndicator[];
  csiFactors: BehaviorGraphCsiFactor[];
  confidence: number;
  contributors: string[];
  generated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
/** Coerce any confidence-like value into 0..1 (some sources store 0..100). */
function norm01(v: unknown): number {
  let n = num(v);
  if (n > 1 && n <= 100) n = n / 100;
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ── Lazy schema (mirrors 20260530_behavior_graph.sql) ─────────────────────────
let schemaReady = false;
export async function ensureBehaviorGraphSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_behavior_graph (
      session_id          UUID PRIMARY KEY,
      concern             TEXT,
      signal_count        INTEGER NOT NULL DEFAULT 0,
      pattern_count       INTEGER NOT NULL DEFAULT 0,
      risk_count          INTEGER NOT NULL DEFAULT 0,
      intervention_count  INTEGER NOT NULL DEFAULT 0,
      growth_count        INTEGER NOT NULL DEFAULT 0,
      csi_factor_count    INTEGER NOT NULL DEFAULT 0,
      confidence          NUMERIC(6,4) NOT NULL DEFAULT 0,
      contributors        JSONB NOT NULL DEFAULT '[]',
      graph               JSONB NOT NULL DEFAULT '{}',
      generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_cbg_generated ON capadex_behavior_graph (generated_at DESC)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_cbg_concern ON capadex_behavior_graph (concern)`,
  );
  schemaReady = true;
}

// ── Per-system contributors (each best-effort) ────────────────────────────────

/** Root concern + email for the session (capadex_sessions). */
async function loadSession(
  pool: Pool,
  sessionId: string,
): Promise<{ concern: string | null; email: string | null; score: number | null }> {
  try {
    const { rows } = await pool.query(
      `SELECT concern_name, guest_email, score FROM capadex_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows.length) return { concern: null, email: null, score: null };
    return {
      concern: rows[0].concern_name ?? null,
      email: rows[0].guest_email ? String(rows[0].guest_email).toLowerCase() : null,
      score: rows[0].score == null ? null : num(rows[0].score),
    };
  } catch {
    return { concern: null, email: null, score: null };
  }
}

/** CAPADEX behavioural spine — signals. */
async function loadSignals(pool: Pool, sessionId: string): Promise<BehaviorGraphSignal[]> {
  try {
    const rows = await getSessionSignals(pool, sessionId);
    return rows.map((r) => ({
      signal_key: r.signal_key,
      strength: norm01(r.strength),
      confidence: norm01(r.confidence),
      lifecycle_state: r.lifecycle_state ?? null,
      source: 'capadex' as const,
    }));
  } catch {
    return [];
  }
}

/** CAPADEX behavioural spine — patterns. */
async function loadPatterns(pool: Pool, sessionId: string): Promise<BehaviorGraphPattern[]> {
  try {
    const rows = await getSessionPatterns(pool, sessionId);
    return rows.map((r) => ({
      pattern_key: r.pattern_key,
      label: r.label ?? null,
      confidence: norm01(r.confidence),
      signal_refs: Array.isArray(r.signal_refs) ? r.signal_refs.map(String) : [],
      explanation: r.explanation ?? null,
      source: 'capadex' as const,
    }));
  } catch {
    return [];
  }
}

/** CAPADEX behavioural spine — interventions. */
async function loadInterventions(
  pool: Pool,
  sessionId: string,
): Promise<BehaviorGraphIntervention[]> {
  try {
    const rows = await getSessionInterventions(pool, sessionId);
    return rows.map((r) => ({
      intervention_key: r.intervention_key,
      construct_key: r.construct_key ?? null,
      title: r.title ?? null,
      expected_impact: num(r.expected_impact),
      confidence: norm01(r.confidence),
      rank: num(r.rank),
    }));
  } catch {
    return [];
  }
}

/** Risk factors — contradictions + enterprise risk flags + low-score gate. */
async function loadRisks(
  pool: Pool,
  sessionId: string,
  score: number | null,
): Promise<BehaviorGraphRisk[]> {
  const risks: BehaviorGraphRisk[] = [];

  try {
    const { rows } = await pool.query(
      `SELECT contradiction_type, severity, description
         FROM contradiction_events
        WHERE session_id = $1 AND resolved IS NOT TRUE`,
      [sessionId],
    );
    for (const r of rows) {
      risks.push({
        risk_key: `contradiction:${r.contradiction_type}`,
        type: String(r.contradiction_type ?? 'contradiction'),
        severity: String(r.severity ?? 'medium'),
        description: String(r.description ?? 'Response contradiction detected'),
        source: 'contradiction',
      });
    }
  } catch {
    /* contradiction subsystem absent — skip */
  }

  try {
    const { rows } = await pool.query(
      `SELECT risk_type, severity, description
         FROM capadex_risk_flags
        WHERE session_id = $1 AND resolved IS NOT TRUE`,
      [sessionId],
    );
    for (const r of rows) {
      risks.push({
        risk_key: `flag:${r.risk_type}`,
        type: String(r.risk_type ?? 'risk'),
        severity: String(r.severity ?? 'medium'),
        description: String(r.description ?? 'Risk flag raised'),
        source: 'risk_flag',
      });
    }
  } catch {
    /* enterprise risk subsystem absent — skip */
  }

  // Low-score gate mirrors enterprise thresholds (<20 critical / <30 high / <40 medium).
  if (score != null && score < 40) {
    const severity = score < 20 ? 'critical' : score < 30 ? 'high' : 'medium';
    risks.push({
      risk_key: 'score:low',
      type: 'low_score',
      severity,
      description: `Stage score ${Math.round(score)} indicates an at-risk developmental band`,
      source: 'score',
    });
  }

  return risks;
}

/** Growth indicators — OMEGA-X longitudinal memory (drift / growth / recovery). */
async function loadGrowthIndicators(
  pool: Pool,
  email: string | null,
  sessionId: string,
): Promise<BehaviorGraphGrowthIndicator[]> {
  if (!email) return [];
  const out: BehaviorGraphGrowthIndicator[] = [];
  try {
    const memory = (await buildMemory(pool, email, sessionId)) as unknown as Record<string, unknown> | null;
    if (!memory) return [];

    const drift = memory.behavioural_drift as Record<string, unknown> | undefined;
    if (drift && drift.direction) {
      out.push({
        key: 'behavioural_drift',
        direction: String(drift.direction),
        detail: `Behavioural drift ${String(drift.direction)} (slope ${num(drift.slope).toFixed(2)})`,
        source: 'omega_longitudinal',
      });
    }

    for (const gp of asArray(memory.growth_patterns)) {
      const g = gp as Record<string, unknown>;
      out.push({
        key: `growth:${String(g.construct ?? g.concern ?? 'pattern')}`,
        direction: 'improving',
        detail: String(g.description ?? g.label ?? 'Sustained improvement'),
        source: 'omega_longitudinal',
      });
    }

    for (const rr of asArray(memory.resilience_recoveries)) {
      const r = rr as Record<string, unknown>;
      out.push({
        key: `recovery:${String(r.construct ?? r.concern ?? 'recovery')}`,
        direction: 'recovering',
        detail: String(r.description ?? 'Resilience recovery detected'),
        source: 'omega_longitudinal',
      });
    }
  } catch {
    /* longitudinal memory absent — skip */
  }
  return out;
}

/** CSI contribution — csi_profiles (score / domains / +ve / -ve factors). */
async function loadCsiFactors(
  pool: Pool,
  email: string | null,
): Promise<BehaviorGraphCsiFactor[]> {
  if (!email) return [];
  const out: BehaviorGraphCsiFactor[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT csi_score, csi_stage, domain_scores, positive_factors, negative_factors
         FROM csi_profiles WHERE LOWER(user_email) = $1 LIMIT 1`,
      [email],
    );
    if (!rows.length) return [];
    const p = rows[0];

    out.push({
      factor: 'csi_score',
      kind: 'contribution',
      value: num(p.csi_score),
      detail: `CSI ${num(p.csi_score).toFixed(1)} — ${String(p.csi_stage ?? 'n/a')}`,
    });

    const domains = (p.domain_scores ?? {}) as Record<string, unknown>;
    if (domains && typeof domains === 'object' && !Array.isArray(domains)) {
      for (const [name, val] of Object.entries(domains)) {
        out.push({
          factor: name,
          kind: 'domain',
          value: num(val),
          detail: `Domain ${name}: ${num(val).toFixed(1)}`,
        });
      }
    }

    for (const pf of asArray(p.positive_factors)) {
      const f = pf as Record<string, unknown>;
      out.push({
        factor: String(f.factor ?? f.concern ?? f.label ?? 'strength'),
        kind: 'positive',
        value: f.score == null ? null : num(f.score),
        detail: String(f.detail ?? f.description ?? 'Positive contributor'),
      });
    }
    for (const nf of asArray(p.negative_factors)) {
      const f = nf as Record<string, unknown>;
      out.push({
        factor: String(f.factor ?? f.concern ?? f.label ?? 'drag'),
        kind: 'negative',
        value: f.score == null ? null : num(f.score),
        detail: String(f.detail ?? f.description ?? 'Negative contributor'),
      });
    }
  } catch {
    /* CSI subsystem absent — skip */
  }
  return out;
}

/** Pragati conversational runtime — folds its signals/patterns when linked by id. */
async function loadPragati(
  pool: Pool,
  sessionId: string,
): Promise<{ signals: BehaviorGraphSignal[]; patterns: BehaviorGraphPattern[]; matched: boolean }> {
  try {
    const { rows } = await pool.query(
      `SELECT signal_store, patterns, quality_score
         FROM pragati_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows.length) return { signals: [], patterns: [], matched: false };
    const r = rows[0];

    const signals: BehaviorGraphSignal[] = [];
    const store = r.signal_store;
    if (store && typeof store === 'object' && !Array.isArray(store)) {
      for (const [key, val] of Object.entries(store as Record<string, unknown>)) {
        signals.push({
          signal_key: key,
          strength: norm01(typeof val === 'object' ? (val as any)?.strength : val),
          confidence: norm01(typeof val === 'object' ? (val as any)?.confidence : 1),
          lifecycle_state: 'pragati',
          source: 'pragati',
        });
      }
    } else {
      for (const s of asArray(store)) {
        signals.push({
          signal_key: String((s as any)?.key ?? s),
          strength: norm01((s as any)?.strength),
          confidence: norm01((s as any)?.confidence ?? 1),
          lifecycle_state: 'pragati',
          source: 'pragati',
        });
      }
    }

    const patterns: BehaviorGraphPattern[] = asArray(r.patterns).map((p) => {
      const pp = p as Record<string, unknown>;
      return {
        pattern_key: String(pp.pattern ?? pp.key ?? pp.label ?? 'pragati_pattern'),
        label: (pp.label as string) ?? null,
        confidence: norm01(pp.confidence ?? 0.6),
        signal_refs: Array.isArray(pp.signals) ? (pp.signals as unknown[]).map(String) : [],
        explanation: (pp.explanation as string) ?? null,
        source: 'pragati' as const,
      };
    });

    return { signals, patterns, matched: true };
  } catch {
    return { signals: [], patterns: [], matched: false };
  }
}

/** OMEGA-X quality gate — used to blend overall graph confidence. */
async function loadOmegaQuality(pool: Pool, sessionId: string): Promise<number | null> {
  try {
    const report = (await buildOmegaReport(pool, sessionId)) as Record<string, unknown> | null;
    if (!report) return null;
    const qv = report.quality_validation as Record<string, unknown> | undefined;
    if (!qv || qv.overall_score == null) return null;
    return norm01(qv.overall_score);
  } catch {
    return null;
  }
}

// ── Build + persist ───────────────────────────────────────────────────────────

/**
 * Build the Unified Behavior Graph for a session by aggregating every existing
 * intelligence system, then persist exactly one row per session (absolute upsert).
 * Best-effort throughout — returns the computed graph even if persistence fails.
 */
export async function buildBehaviorGraph(pool: Pool, sessionId: string): Promise<BehaviorGraph> {
  const { concern, email, score } = await loadSession(pool, sessionId);

  const [capSignals, capPatterns, interventions, risks, growthIndicators, csiFactors, pragati, omegaQuality] =
    await Promise.all([
      loadSignals(pool, sessionId),
      loadPatterns(pool, sessionId),
      loadInterventions(pool, sessionId),
      loadRisks(pool, sessionId, score),
      loadGrowthIndicators(pool, email, sessionId),
      loadCsiFactors(pool, email),
      loadPragati(pool, sessionId),
      loadOmegaQuality(pool, sessionId),
    ]);

  const signals = [...capSignals, ...pragati.signals];
  const patterns = [...capPatterns, ...pragati.patterns];

  // Confidence: mean of available signal/pattern confidence, blended with OMEGA-X gate.
  const confParts: number[] = [];
  if (signals.length) confParts.push(mean(signals.map((s) => s.confidence)));
  if (patterns.length) confParts.push(mean(patterns.map((p) => p.confidence)));
  let confidence = confParts.length ? mean(confParts) : 0;
  if (omegaQuality != null) confidence = confidence * 0.7 + omegaQuality * 0.3;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(4))));

  const contributors: string[] = [];
  if (capSignals.length) contributors.push('capadex_signals');
  if (capPatterns.length) contributors.push('capadex_patterns');
  if (interventions.length) contributors.push('capadex_interventions');
  if (risks.length) contributors.push('risk_factors');
  if (growthIndicators.length) contributors.push('omega_longitudinal');
  if (csiFactors.length) contributors.push('csi');
  if (pragati.matched) contributors.push('pragati');
  if (omegaQuality != null) contributors.push('omega_quality');

  const graph: BehaviorGraph = {
    session_id: sessionId,
    concern,
    signals,
    patterns,
    risks,
    interventions,
    growthIndicators,
    csiFactors,
    confidence,
    contributors,
    generated_at: new Date().toISOString(),
  };

  await persistBehaviorGraph(pool, graph).catch(() => {/* persistence best-effort */});
  return graph;
}

/** Absolute upsert — guarantees exactly one graph row per session. */
export async function persistBehaviorGraph(pool: Pool, graph: BehaviorGraph): Promise<void> {
  await ensureBehaviorGraphSchema(pool);
  await pool.query(
    `INSERT INTO capadex_behavior_graph (
        session_id, concern, signal_count, pattern_count, risk_count,
        intervention_count, growth_count, csi_factor_count, confidence,
        contributors, graph, generated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
     ON CONFLICT (session_id) DO UPDATE SET
        concern            = EXCLUDED.concern,
        signal_count       = EXCLUDED.signal_count,
        pattern_count      = EXCLUDED.pattern_count,
        risk_count         = EXCLUDED.risk_count,
        intervention_count = EXCLUDED.intervention_count,
        growth_count       = EXCLUDED.growth_count,
        csi_factor_count   = EXCLUDED.csi_factor_count,
        confidence         = EXCLUDED.confidence,
        contributors       = EXCLUDED.contributors,
        graph              = EXCLUDED.graph,
        generated_at       = NOW()`,
    [
      graph.session_id,
      graph.concern,
      graph.signals.length,
      graph.patterns.length,
      graph.risks.length,
      graph.interventions.length,
      graph.growthIndicators.length,
      graph.csiFactors.length,
      graph.confidence,
      JSON.stringify(graph.contributors),
      JSON.stringify(graph),
    ],
  );
}

/** Read the persisted graph for a session (null if not yet generated). */
export async function getBehaviorGraph(pool: Pool, sessionId: string): Promise<BehaviorGraph | null> {
  try {
    await ensureBehaviorGraphSchema(pool);
    const { rows } = await pool.query(
      `SELECT graph FROM capadex_behavior_graph WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!rows.length) return null;
    return rows[0].graph as BehaviorGraph;
  } catch {
    return null;
  }
}

/**
 * Read the Unified Behavior Graph for a USER (Career OS — P2).
 *
 * Bridges user → latest CAPADEX session via capadex_behavioural_memory (the same
 * read-only bridge the Career Behavior Adapter uses), then returns the persisted
 * graph for that session. Strictly read-only (getBehaviorGraph — no build), best-effort,
 * never throws: returns `{ graph: null, session_id: null }` when nothing is linked yet,
 * so callers degrade to their existing behaviour.
 */
export async function buildBehaviorGraphForUser(
  pool: Pool,
  userId: string,
): Promise<{ graph: BehaviorGraph | null; session_id: string | null }> {
  let sessionId: string | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT session_id
         FROM capadex_behavioural_memory
        WHERE user_id = $1 AND session_id IS NOT NULL
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [userId],
    );
    sessionId = rows[0]?.session_id ?? null;
  } catch { /* table may not exist yet — degrade to null */ }

  if (!sessionId) return { graph: null, session_id: null };
  const graph = await getBehaviorGraph(pool, sessionId);
  return { graph, session_id: sessionId };
}
