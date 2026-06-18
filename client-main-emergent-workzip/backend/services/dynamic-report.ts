/**
 * Dynamic Reporting Engine — Phase 1 S9
 *
 * Generates a confidence-driven, persona-adapted behavioural report by:
 *   1. Loading active behavioural hypotheses (≥ 0.30 confidence) for a session
 *   2. Resolving the latest confidence from confidence_traces
 *   3. Selecting matching insight templates from the governed library
 *   4. Composing a structured report with full explainability
 *
 * Feature-flag: `dynamic_reporting` — callers should check before invoking.
 */

import type { Pool } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceBand = 'high' | 'moderate' | 'low';
export type Persona        = 'student' | 'parent' | 'teacher' | 'counsellor';

export interface PatternInsight {
  construct_key:       string;
  hypothesis_label:    string;
  text:                string;
  why_generated:       string;
  supporting_evidence: string[];
  confidence_level:    'High' | 'Moderate' | 'Low';
  persona_tone:        Persona;
  confidence_score:    number;
}

export interface GrowthOpportunity {
  construct_key: string;
  text:          string;
  priority:      number;
}

export interface ExplainabilityEntry {
  event:     string;
  detail:    string;
  timestamp: string;
}

export interface DynamicReport {
  session_id:              string;
  behavioural_summary:     string;
  confidence_transparency: {
    overall_confidence:    number;
    hypothesis_count:      number;
    high_confidence_count: number;
    note:                  string;
  };
  pattern_insights:     PatternInsight[];
  growth_opportunities: GrowthOpportunity[];
  recommendations:      PatternInsight[];
  explainability_log:   ExplainabilityEntry[];
  generated_at:         string;
}

// ─── Typed DB row shapes (avoid any casts) ───────────────────────────────────

interface SessionRow {
  id:            string;
  concern_name:  string;
  score:         string | null;
  score_level:   string | null;
  stage_code:    string;
  guest_email:   string | null;
  persona:       string | null;
  session_count: string;
}

interface HypothesisRow {
  id:                    string;
  construct_key:         string;
  label:                 string;
  confidence:            string;
  uncertainty:           string;
  evidence_sources:      string[] | Record<string, string> | null;
  lifecycle_state:       string;
  explainability_context: Record<string, unknown>;
}

interface TraceRow {
  hypothesis_id:    string;
  confidence_after: string;
  reason_why:       string;
}

interface TemplateRow {
  insight_text:      string;
  why_generated:     string;
  growth_opportunity: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bandFromScore(confidence: number): ConfidenceBand {
  if (confidence >= 0.70) return 'high';
  if (confidence >= 0.40) return 'moderate';
  return 'low';
}

function bandLabel(band: ConfidenceBand): 'High' | 'Moderate' | 'Low' {
  return band === 'high' ? 'High' : band === 'moderate' ? 'Moderate' : 'Low';
}

function coercePersona(raw: string | null | undefined): Persona {
  const valid: Persona[] = ['student', 'parent', 'teacher', 'counsellor'];
  return valid.includes(raw as Persona) ? (raw as Persona) : 'student';
}

function buildSummary(
  insights:     PatternInsight[],
  score:        number | null,
  concern:      string,
  sessionCount: number
): string {
  if (insights.length === 0) {
    return `The assessment of "${concern}" has produced an initial behavioural profile. Confidence in specific pattern identification is still developing — completing additional stages will sharpen the picture significantly.`;
  }
  const topInsight = insights[0];
  const level = topInsight.confidence_level;
  const constructs = insights.slice(0, 3).map(i => i.hypothesis_label).join(', ');
  const sessionNote = sessionCount > 1
    ? ` This picture has been built across ${sessionCount} sessions — the patterns are becoming more reliable with each one.`
    : ' This is a first-session picture — additional stages will add important depth and confidence.';
  const scoreNote = score !== null
    ? ` The overall score of ${Math.round(score)}% places this profile in a specific developmental range.`
    : '';
  return `The most ${level.toLowerCase()}-confidence pattern in this profile centres on ${constructs}.${scoreNote}${sessionNote} The insights below are drawn from behavioural signals across the assessment and are designed to be both explainable and actionable.`;
}

// ─── Upsert helper ────────────────────────────────────────────────────────────
// Updates existing report row; inserts a minimal row if none exists yet.

export async function upsertDynamicReport(
  pool:      Pool,
  sessionId: string,
  report:    DynamicReport
): Promise<void> {
  const payload = JSON.stringify(report);

  const { rowCount } = await pool.query(
    `UPDATE capadex_reports
     SET dynamic_report = $1, updated_at = NOW()
     WHERE session_id = $2`,
    [payload, sessionId]
  );

  if ((rowCount ?? 0) === 0) {
    // No report row yet — create a minimal one seeded from the session
    await pool.query(
      `INSERT INTO capadex_reports
         (session_id, concern_name, stage_code, score, score_level, dynamic_report)
       SELECT $1,
              COALESCE(s.concern_name, 'Unknown'),
              COALESCE(s.stage_code, 'CAP_CUR'),
              s.score,
              COALESCE(s.score_level, 'Developing'),
              $2
       FROM capadex_sessions s
       WHERE s.id = $1`,
      [sessionId, payload]
    );
  }
}

// ─── Core Generator ───────────────────────────────────────────────────────────

export async function generateReport(
  pool:             Pool,
  sessionId:        string,
  personaOverride?: Persona
): Promise<DynamicReport | null> {
  const log: ExplainabilityEntry[] = [];
  const ts = () => new Date().toISOString();

  try {
    // 0. Resolve session and derive persona from profile data
    const { rows: sessionRows } = await pool.query<SessionRow>(
      `SELECT s.id, s.concern_name, s.score, s.score_level, s.stage_code,
              s.guest_email, s.persona,
              (SELECT COUNT(*)::text FROM capadex_sessions s2
               WHERE s2.guest_email = s.guest_email
                 AND s2.status = 'completed') AS session_count
       FROM capadex_sessions s
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRows.length === 0) {
      log.push({ event: 'session_not_found', detail: `Session ${sessionId} not found`, timestamp: ts() });
      return null;
    }

    const session = sessionRows[0];
    const concernName   = session.concern_name  || 'Unknown Concern';
    const sessionScore  = session.score ? Number(session.score) : null;
    const sessionCount  = Number(session.session_count) || 1;

    // Persona: explicit override > session.persona > 'student'
    const persona: Persona = personaOverride ?? coercePersona(session.persona);

    log.push({
      event:     'session_resolved',
      detail:    `Session found: ${concernName}, stage ${session.stage_code}, score ${sessionScore}, persona ${persona}`,
      timestamp: ts(),
    });

    // 1. Load active hypotheses with confidence ≥ 0.30
    const { rows: hypotheses } = await pool.query<HypothesisRow>(
      `SELECT id, construct_key, label, confidence, uncertainty,
              evidence_sources, lifecycle_state, explainability_context
       FROM behavioural_hypotheses
       WHERE session_id = $1
         AND lifecycle_state = 'active'
         AND confidence >= 0.30
       ORDER BY confidence DESC`,
      [sessionId]
    );

    log.push({
      event:     'hypotheses_loaded',
      detail:    `${hypotheses.length} active hypothesis(es) with confidence ≥ 0.30`,
      timestamp: ts(),
    });

    // 2. Load latest confidence trace per hypothesis for explainability
    const traceMap: Record<string, { reason_why: string; confidence_after: number }> = {};
    if (hypotheses.length > 0) {
      const hypIds = hypotheses.map(h => h.id);
      // Use ANY($1::uuid[]) — clean, parameterised, avoids dynamic interpolation
      const { rows: traces } = await pool.query<TraceRow>(
        `SELECT DISTINCT ON (hypothesis_id)
                hypothesis_id, confidence_after, reason_why
         FROM confidence_traces
         WHERE hypothesis_id = ANY($1::uuid[])
         ORDER BY hypothesis_id, created_at DESC`,
        [hypIds]
      );
      for (const t of traces) {
        traceMap[t.hypothesis_id] = {
          reason_why:       t.reason_why,
          confidence_after: Number(t.confidence_after),
        };
      }
    }

    log.push({
      event:     'confidence_traces_loaded',
      detail:    `Traces loaded for ${Object.keys(traceMap).length} hypothesis(es)`,
      timestamp: ts(),
    });

    // 3. For each hypothesis, compute effective confidence from S4 trace data
    // and select the best-matching insight template.
    // Per S9 spec: final confidence (for banding, priority, and transparency)
    // comes from the latest confidence_after in confidence_traces, with the
    // hypothesis base confidence as the fallback when no trace exists yet.
    const insights:    PatternInsight[] = [];
    const growthItems: GrowthOpportunity[] = [];

    // Enrich hypotheses with effective confidence and re-sort descending
    interface EnrichedHypothesis extends HypothesisRow {
      effective_confidence: number;
    }
    const enriched: EnrichedHypothesis[] = hypotheses.map(h => ({
      ...h,
      effective_confidence: traceMap[h.id]?.confidence_after ?? Number(h.confidence),
    }));
    enriched.sort((a, b) => b.effective_confidence - a.effective_confidence);

    for (const h of enriched) {
      const band = bandFromScore(h.effective_confidence);
      const evidence: string[] = Array.isArray(h.evidence_sources)
        ? h.evidence_sources
        : (h.evidence_sources ? Object.values(h.evidence_sources) : []);
      const traceReason = traceMap[h.id]?.reason_why ?? '';

      // Persona-first template selection with fallback to student then any
      const { rows: templates } = await pool.query<TemplateRow>(
        `SELECT insight_text, why_generated, growth_opportunity
         FROM insight_templates
         WHERE construct_key = $1 AND confidence_band = $2
         ORDER BY
           CASE WHEN persona = $3 THEN 0 WHEN persona = 'student' THEN 1 ELSE 2 END,
           id
         LIMIT 1`,
        [h.construct_key, band, persona]
      );

      const tpl = templates[0];
      if (!tpl) {
        log.push({
          event:     'template_not_found',
          detail:    `No template for ${h.construct_key} / ${band} / ${persona}`,
          timestamp: ts(),
        });
        continue;
      }

      const insight: PatternInsight = {
        construct_key:      h.construct_key,
        hypothesis_label:   h.label,
        text:               tpl.insight_text,
        why_generated:      tpl.why_generated + (traceReason ? ` Latest S4 trace signal: ${traceReason}.` : ''),
        supporting_evidence: [
          ...evidence,
          ...(traceReason ? [`S4 confidence trace: ${traceReason}`] : []),
        ].slice(0, 5),
        confidence_level:  bandLabel(band),
        persona_tone:      persona,
        // Use trace-derived effective confidence — the authoritative S4 value
        confidence_score:  h.effective_confidence,
      };

      insights.push(insight);
      growthItems.push({
        construct_key: h.construct_key,
        text:          tpl.growth_opportunity,
        priority:      insights.length,
      });

      log.push({
        event:     'template_matched',
        detail:    `${h.construct_key} [${band}] confidence=${h.effective_confidence.toFixed(3)} (S4 trace) → template for persona ${persona}`,
        timestamp: ts(),
      });
    }

    // 4. Compose overall confidence transparency using S4 effective confidence
    const overallConfidence = enriched.length > 0
      ? enriched.reduce((sum, h) => sum + h.effective_confidence, 0) / enriched.length
      : 0;
    const highCount = insights.filter(i => i.confidence_level === 'High').length;

    const confidenceNote = hypotheses.length === 0
      ? 'No active hypotheses detected — more session data needed to build confidence.'
      : highCount > 0
      ? `${highCount} of ${insights.length} pattern(s) reached high confidence — these are the most reliable findings.`
      : 'Patterns are emerging but confidence is still building — completing additional stages will significantly increase reliability.';

    // 5. Build behavioural summary
    const behaviouralSummary = buildSummary(insights, sessionScore, concernName, sessionCount);

    log.push({
      event:     'report_composed',
      detail:    `${insights.length} insights, ${growthItems.length} growth opportunities, avg confidence ${overallConfidence.toFixed(2)}`,
      timestamp: ts(),
    });

    return {
      session_id:          sessionId,
      behavioural_summary: behaviouralSummary,
      confidence_transparency: {
        overall_confidence:    Math.round(overallConfidence * 100) / 100,
        hypothesis_count:      hypotheses.length,
        high_confidence_count: highCount,
        note:                  confidenceNote,
      },
      pattern_insights:     insights,
      growth_opportunities: growthItems,
      recommendations:      insights.slice(0, 3),
      explainability_log:   log,
      generated_at:         ts(),
    };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dynamic-report] generateReport error:', message);
    return null;
  }
}
