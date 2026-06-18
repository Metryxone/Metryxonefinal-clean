/**
 * Unified Signal Ingestion Interface
 *
 * Canonical 14-type taxonomy (source: signal-classifier.ts):
 *   explicit · implicit · linguistic · emotional · cognitive ·
 *   executive_function · motivational · engagement · social ·
 *   developmental · digital · environmental · meta · physiological (future)
 *
 * Both ingestion paths (CAPADEX BIOS Step 2 and BIOS Intelligence) share
 * this module so that type normalisation and session-signal persistence
 * are kept in one place.
 */

import type { Pool } from 'pg';
import {
  classifySignals,
  analyzeLinguisticSignals,
  type QuestionTiming,
} from '../services/signal-classifier';

// ── Canonical type list ───────────────────────────────────────────────────────

export const CANONICAL_SIGNAL_TYPES = [
  'explicit',
  'implicit',
  'linguistic',
  'emotional',
  'cognitive',
  'executive_function',
  'motivational',
  'engagement',
  'social',
  'developmental',
  'digital',
  'environmental',
  'meta',
  'physiological', // reserved — future biometric integrations
] as const;

export type CanonicalSignalType = (typeof CANONICAL_SIGNAL_TYPES)[number];

/**
 * Map any incoming signal_type string to the nearest canonical type.
 * Non-canonical values are preserved with best-effort mapping; true unknowns
 * fall back to 'meta' so data is never silently dropped.
 */
const TYPE_ALIAS_MAP: Record<string, CanonicalSignalType> = {
  executive:            'executive_function',
  behavioural:          'implicit',
  behavioral:           'implicit',
  institutional:        'environmental',
  physiological_future: 'physiological',
  biometric:            'physiological',
};

export function normalizeSignalType(raw: string): CanonicalSignalType {
  const lower = raw.toLowerCase().trim();
  if (CANONICAL_SIGNAL_TYPES.includes(lower as CanonicalSignalType)) {
    return lower as CanonicalSignalType;
  }
  return TYPE_ALIAS_MAP[lower] ?? 'meta';
}

// ── Session-signal ingestion (CAPADEX BIOS Step 2) ───────────────────────────

export interface SessionSignalPayload {
  session_id:   string;
  concern_text?: string | null;
  timings:      Record<string, QuestionTiming>;
  stage_code?:  string | null;
  persona?:     string | null;
}

export interface SessionSignalResult {
  signal_count: number;
  profile: {
    severity_level:        string;
    intervention_priority: string;
    early_warnings:        number;
  };
}

/**
 * Classify timing + linguistic signals, persist to `capadex_session_signals`,
 * `capadex_linguistic_signals`, and upsert `capadex_signal_profiles`.
 *
 * Extracted from POST /api/signals/ingest so both signal-capture.ts and any
 * future ingestion path share identical classification + persistence logic.
 */
export async function ingestSessionSignals(
  pool: Pool,
  payload: SessionSignalPayload,
): Promise<SessionSignalResult> {
  const { session_id, concern_text, timings, stage_code, persona } = payload;

  const { signals, profile, linguistic } = classifySignals(
    timings || {},
    concern_text || null,
    persona || null,
  );

  for (const sig of signals) {
    await pool.query(
      `INSERT INTO capadex_session_signals
         (session_id, signal_type, signal_key, signal_value, weight, severity, confidence, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        session_id,
        normalizeSignalType(sig.signal_type),
        sig.signal_key,
        JSON.stringify(sig.signal_value),
        sig.weight,
        sig.severity,
        sig.confidence,
        sig.description,
      ],
    );
  }

  if (linguistic && concern_text) {
    await pool.query(
      `INSERT INTO capadex_linguistic_signals
         (session_id, concern_text, detected_patterns, emotional_vocabulary,
          intensity_score, certainty_score, absolutism_score,
          helplessness_indicators, fatigue_markers, anxiety_markers, raw_word_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT DO NOTHING`,
      [
        session_id, concern_text,
        JSON.stringify(linguistic.detected_patterns),
        JSON.stringify(linguistic.emotional_vocabulary),
        linguistic.intensity_score, linguistic.certainty_score,
        linguistic.absolutism_score,
        JSON.stringify(linguistic.helplessness_indicators),
        JSON.stringify(linguistic.fatigue_markers),
        JSON.stringify(linguistic.anxiety_markers),
        concern_text.split(/\s+/).length,
      ],
    );
  }

  let sess: Record<string, unknown> | undefined;
  try {
    const { rows } = await pool.query(
      'SELECT concern_name, stage_code, guest_email FROM capadex_sessions WHERE id::text = $1 LIMIT 1',
      [String(session_id)],
    );
    sess = rows[0];
  } catch { /* session lookup failed — continue without enrichment */ }

  await pool.query(
    `INSERT INTO capadex_signal_profiles
       (session_id, concern_name, stage_code, persona,
        emotional_load, cognitive_load, engagement_score, risk_score, composite_intensity,
        dominant_signals, early_warnings, growth_indicators, hidden_patterns,
        persona_signals, linguistic_summary, behavioural_flags,
        reliability_score, volatility_score, severity_level, signal_count,
        intervention_priority, generated_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
     ON CONFLICT (session_id) DO UPDATE SET
       emotional_load        = EXCLUDED.emotional_load,
       cognitive_load        = EXCLUDED.cognitive_load,
       engagement_score      = EXCLUDED.engagement_score,
       risk_score            = EXCLUDED.risk_score,
       composite_intensity   = EXCLUDED.composite_intensity,
       dominant_signals      = EXCLUDED.dominant_signals,
       early_warnings        = EXCLUDED.early_warnings,
       growth_indicators     = EXCLUDED.growth_indicators,
       hidden_patterns       = EXCLUDED.hidden_patterns,
       persona_signals       = EXCLUDED.persona_signals,
       linguistic_summary    = EXCLUDED.linguistic_summary,
       behavioural_flags     = EXCLUDED.behavioural_flags,
       reliability_score     = EXCLUDED.reliability_score,
       volatility_score      = EXCLUDED.volatility_score,
       severity_level        = EXCLUDED.severity_level,
       signal_count          = EXCLUDED.signal_count,
       intervention_priority = EXCLUDED.intervention_priority,
       updated_at            = NOW()`,
    [
      session_id,
      sess?.concern_name || concern_text || null,
      stage_code || sess?.stage_code || null,
      persona || null,
      profile.emotional_load, profile.cognitive_load, profile.engagement_score,
      profile.risk_score, profile.composite_intensity,
      JSON.stringify(profile.dominant_signals),
      JSON.stringify(profile.early_warnings),
      JSON.stringify(profile.growth_indicators),
      JSON.stringify(profile.hidden_patterns),
      JSON.stringify(profile.persona_signals),
      JSON.stringify(profile.linguistic_summary),
      JSON.stringify(profile.behavioural_flags),
      profile.reliability_score, profile.volatility_score,
      profile.severity_level, profile.signal_count,
      profile.intervention_priority,
    ],
  );

  return {
    signal_count: signals.length,
    profile: {
      severity_level:        profile.severity_level,
      intervention_priority: profile.intervention_priority,
      early_warnings:        profile.early_warnings.length,
    },
  };
}

// ── Bulk behavioural-signal ingestion (BIOS Intelligence) ─────────────────────

export interface BehaviouralSignalItem {
  signal_type:       string;
  signal_category?:  string | null;
  signal_source?:    string;
  signal_value?:     Record<string, unknown>;
  confidence_score?: number;
  severity_level?:   string;
  contextual_weight?: number;
}

export interface BehaviouralSignalPayload {
  session_id?: string | null;
  user_email?: string | null;
  signals:     BehaviouralSignalItem[];
}

/**
 * Ingest a batch of pre-classified behavioural signals into `behavioural_signals`
 * (BIOS Intelligence layer, user-email keyed).  All signal_type values are
 * normalised to the canonical taxonomy before insertion.
 *
 * Extracted from POST /api/bios/signals/ingest so both ingestion paths share
 * the same lib and normalisation rules.
 */
export async function ingestBehaviouralSignals(
  pool: Pool,
  payload: BehaviouralSignalPayload,
): Promise<{ ingested: number }> {
  const { session_id, user_email, signals } = payload;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sig of signals) {
      await client.query(
        `INSERT INTO behavioural_signals
           (session_id, user_email, signal_type, signal_category, signal_source,
            signal_value, confidence_score, severity_level, contextual_weight, captured_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [
          session_id || null,
          user_email || null,
          normalizeSignalType(sig.signal_type || 'meta'),
          sig.signal_category || null,
          sig.signal_source || 'assessment',
          JSON.stringify(sig.signal_value || {}),
          sig.confidence_score ?? 0.5,
          sig.severity_level || 'low',
          sig.contextual_weight ?? 1.0,
        ]
      );
    }
    await client.query('COMMIT');
    return { ingested: signals.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
