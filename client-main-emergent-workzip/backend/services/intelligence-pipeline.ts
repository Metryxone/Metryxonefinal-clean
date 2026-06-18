/**
 * CAPADEX Intelligence Pipeline — Phase 3 Activation.
 *
 * Orchestrates the full Signals → Composites → Patterns pipeline for a
 * completed session. This is the wiring layer that connects:
 *
 *   capadex_session_signals  (existing, operational)
 *         ↓  loadCompositeRuntime + detectComposites
 *   capadex_session_composites  (persisted here)
 *         ↓  synthesizePatterns
 *   capadex_session_patterns  (persisted here)
 *
 * Both engines are fully explainable: every composite and pattern carries the
 * exact signal_refs, composite_refs, and evidence_refs it was built from, plus
 * a human-readable prose explanation.
 *
 * Idempotent: recompute-and-reconcile semantics from both engines (safe to
 * replay for the same session — stale rows are reconciled away).
 *
 * Never throws to caller. All errors are caught, logged, and a partial result
 * is returned so the postCompletionHook always succeeds.
 */
import type { Pool } from 'pg';
import {
  loadCompositeRuntime,
  detectComposites,
  persistComposites,
  ensureCompositeSchema,
  type ActiveSignal,
} from './composite-signal-engine';
import {
  synthesizePatterns,
  persistPatterns,
  ensurePatternSchema,
  loadTelemetryAgg,
  loadEvidenceRefs,
} from './pattern-engine';
import { broadcastToSession } from './ws-broadcast';
import { seedCapadexSignals } from './capadex-signals-seeder';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  session_id: string;
  signals_count: number;
  composites_written: number;
  patterns_written: number;
  skipped_reason?: string;
  error?: string;
}

// ── One-time schema migration ─────────────────────────────────────────────────
// Add construct_key to capadex_session_patterns so the WC-3 outcome crosswalk
// can key off pattern rows. Idempotent (ADD COLUMN IF NOT EXISTS).
let constructKeyMigrated = false;

async function ensureConstructKeyColumn(pool: Pool): Promise<void> {
  if (constructKeyMigrated) return;
  try {
    await pool.query(`
      ALTER TABLE capadex_session_patterns
        ADD COLUMN IF NOT EXISTS construct_key VARCHAR(120)
    `);
    constructKeyMigrated = true;
  } catch (err) {
    // Table may not exist yet — ensurePatternSchema runs in parallel; retry next call.
    console.warn('[intelligence-pipeline] construct_key migration deferred:', (err as Error).message);
  }
}

// ── Per-session pipeline ──────────────────────────────────────────────────────

/**
 * Run the composite + pattern pipeline for a single session.
 *
 * Reads active signals from capadex_session_signals, derives composites via
 * the CompositeSignalEngine (dynamic, ontology-driven definitions), then
 * synthesises behavioural patterns via the PatternEngine (composite-derived
 * + domain-concentration, modulated by contradictions and telemetry).
 *
 * Both results are persisted idempotently with recompute-and-reconcile
 * semantics matching the rest of the runtime.
 */
export async function runIntelligencePipeline(
  pool: Pool,
  sessionId: string,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    session_id: sessionId,
    signals_count: 0,
    composites_written: 0,
    patterns_written: 0,
  };

  try {
    // Bootstrap schemas idempotently (parallel — both are fast DDL).
    await Promise.all([
      ensureCompositeSchema(pool),
      ensurePatternSchema(pool),
    ]);
    await ensureConstructKeyColumn(pool);

    // ── Seed ontology (first call only) ────────────────────────────────────
    // Ensures the capadex_signals table has rows for every signal key that
    // real sessions emit, so loadCompositeRuntime produces usable definitions.
    await seedCapadexSignals(pool);

    // ── Read active signals ─────────────────────────────────────────────────
    // Map: weight × severity_factor → strength (0..1 clamped).
    // Handles both the standard vocabulary (critical/high/medium/minimal) and
    // the observational vocabulary (moderate/mild/elevated/low/1/2) that real
    // sessions emit.
    const { rows: sigRows } = await pool.query<{
      signal_key: string;
      strength: number;
      confidence: number;
      lifecycle: string;
    }>(
      `SELECT
         signal_key,
         LEAST(1.0, GREATEST(0.0,
           COALESCE(weight, 0.5)::float *
           CASE LOWER(severity)
             WHEN 'critical'  THEN 1.00
             WHEN 'severe'    THEN 1.00
             WHEN 'elevated'  THEN 0.85
             WHEN '2'         THEN 0.85
             WHEN 'high'      THEN 0.80
             WHEN 'medium'    THEN 0.60
             WHEN 'moderate'  THEN 0.60
             WHEN '1'         THEN 0.65
             WHEN 'mild'      THEN 0.45
             WHEN 'low'       THEN 0.30
             WHEN 'minimal'   THEN 0.25
             ELSE 0.50
           END
         )) AS strength,
         LEAST(1.0, GREATEST(0.0, COALESCE(confidence, 0.8)))::float AS confidence,
         CASE LOWER(severity)
           WHEN 'critical'  THEN 'dominant'
           WHEN 'severe'    THEN 'dominant'
           WHEN 'elevated'  THEN 'dominant'
           WHEN '2'         THEN 'dominant'
           WHEN 'high'      THEN 'active'
           WHEN 'medium'    THEN 'active'
           WHEN 'moderate'  THEN 'active'
           WHEN '1'         THEN 'active'
           WHEN 'mild'      THEN 'candidate'
           WHEN 'low'       THEN 'candidate'
           WHEN 'minimal'   THEN 'candidate'
           ELSE 'candidate'
         END AS lifecycle
       FROM capadex_session_signals
       WHERE session_id = $1
         AND signal_key IS NOT NULL
         AND COALESCE(weight, 0) > 0`,
      [sessionId],
    );

    result.signals_count = sigRows.length;
    if (sigRows.length === 0) {
      result.skipped_reason = 'no_signals';
      return result;
    }

    const active: ActiveSignal[] = sigRows.map((r) => ({
      signal_key: r.signal_key,
      strength:   r.strength,
      confidence: r.confidence,
      lifecycle:  r.lifecycle,
    }));

    // ── Composite generation ────────────────────────────────────────────────
    // Definitions are built dynamically from the capadex_signals ontology
    // (hidden_pattern_contribution clusters). Each composite is explainable:
    // it carries required_signals, weighting_method, confidence_formula, and
    // the exact signal_refs that satisfied it.
    const runtime    = await loadCompositeRuntime(pool);
    const composites = detectComposites(runtime.definitions, active);
    result.composites_written = await persistComposites(pool, sessionId, composites);

    // ── Pattern generation ──────────────────────────────────────────────────
    // Two pattern types emerge from the data:
    //   1. Composite-derived patterns — one per formed composite.
    //   2. Domain-concentration patterns — when ≥2 co-active signals share a domain.
    // Confidence is modulated by contradictions (suppressed signals) and
    // telemetry (hesitation / backtracks corroborate cognitive/emotional patterns).
    const [telemetry, evidenceByToken] = await Promise.all([
      loadTelemetryAgg(pool, sessionId),
      loadEvidenceRefs(pool, sessionId),
    ]);

    const patterns = synthesizePatterns({
      active,
      composites,
      signalMeta:     runtime.signalMeta,
      telemetry,
      evidenceByToken,
    });

    result.patterns_written = await persistPatterns(pool, sessionId, patterns);

    // Back-fill construct_key from pattern_key so WC-3 outcome crosswalk can
    // key off pattern rows without a separate migration step.
    if (patterns.length > 0) {
      await pool.query(
        `UPDATE capadex_session_patterns
            SET construct_key = pattern_key
          WHERE session_id = $1 AND construct_key IS NULL`,
        [sessionId],
      ).catch(() => { /* non-critical — column may not exist on first run before migration */ });
    }

    // Gap 5: broadcast so any connected client refreshes intelligence layers
    // immediately after pipeline completion. No-ops when no client connected.
    broadcastToSession(sessionId, {
      type: 'patterns_ready',
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      data: {
        signals:    result.signals_count,
        composites: result.composites_written,
        patterns:   result.patterns_written,
      },
      explain:
        `${result.composites_written} composites and ${result.patterns_written} patterns ` +
        `synthesised from ${result.signals_count} signals.`,
    });

    console.log(
      `[intelligence-pipeline] ${sessionId}: ` +
        `${result.signals_count} signals → ${result.composites_written} composites ` +
        `→ ${result.patterns_written} patterns`,
    );
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error('[intelligence-pipeline] session', sessionId, ':', err);
  }

  return result;
}

// ── Backfill runner ───────────────────────────────────────────────────────────

/**
 * Run the pipeline for every session that has signals but is missing composites.
 * Processes sessions serially to avoid overwhelming the DB connection pool.
 * Called by the admin backfill endpoint.
 */
export async function backfillIntelligencePipeline(
  pool: Pool,
  limit = 200,
): Promise<{ total: number; processed: number; results: PipelineResult[] }> {
  // Gap 2: UNION covers two cases:
  //   A. sessions with signals but 0 composites (original gap)
  //   B. sessions with composites but 0 patterns (pattern engine added later)
  // All three tables now use uuid for session_id — no cast required.
  const { rows } = await pool.query<{ session_id: string }>(
    `SELECT session_id::text FROM (
       SELECT DISTINCT sig.session_id
         FROM capadex_session_signals sig
         LEFT JOIN capadex_session_composites c ON c.session_id = sig.session_id
        WHERE c.session_id IS NULL
       UNION
       SELECT DISTINCT c2.session_id
         FROM capadex_session_composites c2
         LEFT JOIN capadex_session_patterns p ON p.session_id = c2.session_id
        WHERE p.session_id IS NULL
     ) sub
     LIMIT $1`,
    [limit],
  );

  const results: PipelineResult[] = [];
  for (const { session_id } of rows) {
    results.push(await runIntelligencePipeline(pool, session_id));
  }

  return { total: rows.length, processed: results.length, results };
}
