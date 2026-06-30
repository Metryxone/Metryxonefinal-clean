/**
 * LBI Unifier Service
 *
 * Consolidates 3 disconnected LBI subsystems into a single unified profile:
 *   System A — CAPADEX Behavioural Engine  (capadex_session_signals / wcl0)
 *   System B — Psychometric Framework      (lbi_scores / lbi_score_history)
 *   System C — Module Institute            (lbi_modules / lbi_domain_scores)
 *
 * Additive, read-only, never-throws.
 * Flag-off (FF_LEARNING_INTELLIGENCE absent) → callers receive { enabled: false }.
 */

import pg from 'pg';
import { logger } from '../lib/logger';

export interface LbiDimension {
  key: string;
  label: string;
  score: number | null;
  source: 'system_b' | 'system_a' | 'degraded';
  confidence: 'high' | 'medium' | 'low' | 'absent';
}

export interface LbiDomainScore {
  domain_id: string;
  raw_score: number;
  percentile_score: number;
  stanine_score: number;
  classification: string;
  questions_answered: number;
  total_questions: number;
  source: 'system_c';
}

export interface UnifiedLbiProfile {
  email: string;
  overall_lbi: number | null;
  unified_score: number | null;        // W2: preferred composite surface
  authority: 'system_b' | 'system_a' | 'none';  // which system drove the score
  learning_style: string | null;
  sessions_analyzed: number;

  dimensions: LbiDimension[];
  domain_scores: LbiDomainScore[];

  system_coverage: {
    system_a: 'present' | 'absent';
    system_b: 'present' | 'absent';
    system_c: 'present' | 'absent';
    system_c_status: 'retired';
  };

  coverage_pct: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  computed_at: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  consistency_score:  'Consistency',
  persistence_score:  'Persistence',
  attention_score:    'Attention',
  adaptability_score: 'Adaptability',
  velocity_score:     'Velocity',
};

function deriveConfidence(
  overall: number | null,
  sessions: number,
  domainCount: number
): 'high' | 'medium' | 'low' | 'none' {
  if (overall === null) return 'none';
  if (sessions >= 3 && domainCount >= 2) return 'high';
  if (sessions >= 1 || domainCount >= 1) return 'medium';
  return 'low';
}

function coveragePct(
  systemA: 'present' | 'absent',
  systemB: 'present' | 'absent',
  systemC: 'present' | 'absent'
): number {
  const filled = [systemA, systemB, systemC].filter(s => s === 'present').length;
  return Math.round((filled / 3) * 100);
}

export async function getUnifiedLbiProfile(
  email: string,
  pool: pg.Pool
): Promise<UnifiedLbiProfile> {
  const blank: UnifiedLbiProfile = {
    email,
    overall_lbi: null,
    unified_score: null,
    authority: 'none',
    learning_style: null,
    sessions_analyzed: 0,
    dimensions: [],
    domain_scores: [],
    system_coverage: { system_a: 'absent', system_b: 'absent', system_c: 'absent', system_c_status: 'retired' },
    coverage_pct: 0,
    confidence: 'none',
    computed_at: new Date().toISOString(),
  };

  let systemA: 'present' | 'absent' = 'absent';
  let systemB: 'present' | 'absent' = 'absent';
  let systemC: 'present' | 'absent' = 'absent';

  let dimensions: LbiDimension[] = [];
  let domainScores: LbiDomainScore[] = [];
  let overallLbi: number | null = null;
  let learningStyle: string | null = null;
  let sessionsAnalyzed = 0;

  const client = await pool.connect();
  try {
    // ── System B — lbi_scores (email-keyed psychometric scores) ──────────
    try {
      const bResult = await client.query(
        `SELECT consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, overall_lbi,
                learning_style, sessions_analyzed, calculated_at
         FROM lbi_scores
         WHERE user_email = $1
         ORDER BY calculated_at DESC
         LIMIT 1`,
        [email]
      );
      if (bResult.rows.length > 0) {
        const row = bResult.rows[0];
        systemB = 'present';
        overallLbi = row.overall_lbi != null ? Number(row.overall_lbi) : null;
        learningStyle = row.learning_style ?? null;
        sessionsAnalyzed = Number(row.sessions_analyzed ?? 0);
        dimensions = Object.keys(DIMENSION_LABELS).map(key => ({
          key,
          label: DIMENSION_LABELS[key],
          score: row[key] != null ? Number(row[key]) : null,
          source: 'system_b' as const,
          confidence: row[key] != null ? 'high' : 'absent',
        }));
      }
    } catch (e) {
      logger.debug('lbi-unifier: system_b (lbi_scores) read failed; source treated as absent', { err: e instanceof Error ? e.message : String(e) });
    }

    // ── System A — CAPADEX wcl0 / behavioural signals (email-keyed) ──────
    try {
      const aResult = await client.query(
        `SELECT w.segment, w.behaviour, w.persona, w.updated_at
         FROM wcl0_user_intelligence w
         WHERE w.email = $1
         ORDER BY w.updated_at DESC
         LIMIT 1`,
        [email]
      );
      if (aResult.rows.length > 0) {
        systemA = 'present';
        const row = aResult.rows[0];
        if (dimensions.length === 0 && row.behaviour) {
          const beh = typeof row.behaviour === 'string'
            ? JSON.parse(row.behaviour)
            : row.behaviour;
          const mapping: Array<[string, string]> = [
            ['motivation',    'consistency_score'],
            ['confidence',    'persistence_score'],
            ['engagement',    'attention_score'],
            ['adaptability',  'adaptability_score'],
            ['risk',          'velocity_score'],
          ];
          dimensions = mapping.map(([behKey, dimKey]) => {
            const raw = beh?.[behKey];
            const score = raw != null ? Math.round(Number(raw) * 100) : null;
            return {
              key: dimKey,
              label: DIMENSION_LABELS[dimKey] ?? dimKey,
              score,
              source: 'system_a' as const,
              confidence: score != null ? 'medium' : 'absent',
            };
          });
          if (overallLbi === null) {
            const valid = dimensions.map(d => d.score).filter((s): s is number => s != null);
            if (valid.length > 0) {
              overallLbi = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
            }
          }
        }
      }
    } catch (e) {
      logger.debug('lbi-unifier: system_a (wcl0/behavioural) read failed; source treated as absent', { err: e instanceof Error ? e.message : String(e) });
    }

    // ── System C — lbi_domain_scores (session-keyed, look up by email) ───
    try {
      const cResult = await client.query(
        `SELECT ds.domain_id, ds.raw_score, ds.percentile_score, ds.stanine_score,
                ds.classification, ds.questions_answered, ds.total_questions
         FROM lbi_domain_scores ds
         JOIN capadex_sessions cs ON cs.id::text = ds.session_id::text
         WHERE cs.guest_email = $1
         ORDER BY ds.created_at DESC
         LIMIT 10`,
        [email]
      );
      if (cResult.rows.length > 0) {
        systemC = 'present';
        domainScores = cResult.rows.map(r => ({
          domain_id:        r.domain_id,
          raw_score:        Number(r.raw_score),
          percentile_score: Number(r.percentile_score),
          stanine_score:    Number(r.stanine_score),
          classification:   r.classification,
          questions_answered: Number(r.questions_answered ?? 0),
          total_questions:    Number(r.total_questions ?? 0),
          source: 'system_c' as const,
        }));
      }
    } catch (e) {
      logger.debug('lbi-unifier: system_c (domain scores) read failed; source treated as absent', { err: e instanceof Error ? e.message : String(e) });
    }
  } finally {
    client.release();
  }

  if (systemA === 'absent' && systemB === 'absent' && systemC === 'absent') {
    return blank;
  }

  const coverage = coveragePct(systemA, systemB, systemC);
  const confidence = deriveConfidence(overallLbi, sessionsAnalyzed, domainScores.length);
  const authority: 'system_b' | 'system_a' | 'none' =
    systemB === 'present' ? 'system_b' : systemA === 'present' ? 'system_a' : 'none';

  return {
    email,
    overall_lbi: overallLbi,
    unified_score: overallLbi,       // system_b takes priority via dimension derivation order above
    authority,
    learning_style: learningStyle,
    sessions_analyzed: sessionsAnalyzed,
    dimensions,
    domain_scores: domainScores,
    system_coverage: { system_a: systemA, system_b: systemB, system_c: systemC, system_c_status: 'retired' },
    coverage_pct: coverage,
    confidence,
    computed_at: new Date().toISOString(),
  };
}
