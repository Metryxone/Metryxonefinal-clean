/**
 * AI Competency Inference Engine — orchestrates source-specific
 * analysers and combines their per-competency level estimates into a
 * single inferred profile with calibrated confidence + reasoning.
 *
 * No LLM calls. All inference is deterministic heuristics; the AI in
 * "AI inference" is the symbolic/pattern layer, not generative.
 */
import type { Pool } from 'pg';
import { extractResumeSignals, signalsToCompetencyLevels, RESUME_SIGNAL_VERSION } from './resume-signal-engine';
import { analyzeGithubPayload, githubToCompetencyLevels, GITHUB_ANALYZER_VERSION, type GithubPayload } from './github-competency-analyzer';
import { analyzeLinkedinPayload, linkedinToCompetencyLevels, LINKEDIN_INTEL_VERSION, type LinkedinPayload } from './linkedin-intelligence-engine';
import { buildReasoning, AI_REASONING_VERSION, type Evidence } from './ai-reasoning-engine';

export const AI_INFERENCE_VERSION = '5.0.0';

export const INFERENCE_VERSIONS = {
  AI_INFERENCE_VERSION,
  RESUME_SIGNAL_VERSION,
  GITHUB_ANALYZER_VERSION,
  LINKEDIN_INTEL_VERSION,
  AI_REASONING_VERSION,
};

export type SourceInput =
  | { type: 'resume'; text: string; ref?: string }
  | { type: 'github'; payload: GithubPayload; ref?: string }
  | { type: 'linkedin'; payload: LinkedinPayload; ref?: string }
  | { type: 'portfolio'; payload: Record<string, unknown>; ref?: string };

const CANONICAL = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'] as const;

type SourceWeights = Record<string, number>;
const DEFAULT_SOURCE_WEIGHTS: SourceWeights = {
  resume: 0.65, linkedin: 0.70, github: 0.85, portfolio: 0.75, conversation: 0.60,
};

async function loadSourceWeights(pool: Pool): Promise<SourceWeights> {
  try {
    const r = await pool.query<{ source_type: string; base_weight: string }>(
      `SELECT source_type, base_weight FROM inference_confidence_models`,
    );
    if (!r.rowCount) return DEFAULT_SOURCE_WEIGHTS;
    const out: SourceWeights = { ...DEFAULT_SOURCE_WEIGHTS };
    for (const row of r.rows) out[row.source_type] = Number(row.base_weight);
    return out;
  } catch { return DEFAULT_SOURCE_WEIGHTS; }
}

export type InferredCompetency = {
  competency_key: string;
  inferred_level: number;
  confidence: number;
  evidence: Evidence[];
  source_mix: Array<{ source: string; weight: number; level: number }>;
  reasoning: ReturnType<typeof buildReasoning>;
};

export type InferenceResult = {
  user_id: number;
  competencies: InferredCompetency[];
  overall_confidence: number;
  sources_used: string[];
  generated_at: string;
};

function perSourceLevels(input: SourceInput): { source: string; levels: Record<string, { level: number; evidence: string[] }> } | null {
  switch (input.type) {
    case 'resume': {
      const sig = extractResumeSignals(input.text); return { source: 'resume', levels: signalsToCompetencyLevels(sig) };
    }
    case 'github': {
      const a = analyzeGithubPayload(input.payload); return { source: 'github', levels: githubToCompetencyLevels(a) };
    }
    case 'linkedin': {
      const a = analyzeLinkedinPayload(input.payload); return { source: 'linkedin', levels: linkedinToCompetencyLevels(a) };
    }
    case 'portfolio': {
      // Minimal: count project entries; favour TEC/EXE
      const projects = Array.isArray((input.payload as { projects?: unknown[] }).projects) ? (input.payload as { projects: unknown[] }).projects.length : 0;
      const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
      return { source: 'portfolio', levels: {
        TEC: { level: cap(40 + projects * 6), evidence: [`projects:${projects}`] },
        EXE: { level: cap(35 + projects * 5), evidence: [`projects:${projects}`] },
        COG: { level: cap(35 + projects * 4), evidence: [] },
        COM: { level: cap(30 + projects * 3), evidence: [] },
        ADP: { level: cap(30 + projects * 3), evidence: [] },
        LEA: { level: cap(20 + projects * 2), evidence: [] },
        EIQ: { level: cap(20 + projects * 2), evidence: [] },
      } };
    }
  }
}

/** Combine per-source levels into weighted-average inferred levels. */
export async function inferCompetencies(pool: Pool, userId: number, inputs: SourceInput[]): Promise<InferenceResult> {
  const weights = await loadSourceWeights(pool);
  const perSource = inputs.map(perSourceLevels).filter((x): x is NonNullable<typeof x> => x != null);
  const sourcesUsed = perSource.map((p) => p.source);

  const competencies: InferredCompetency[] = CANONICAL.map((key) => {
    let weightedSum = 0; let weightTotal = 0;
    const evidence: Evidence[] = [];
    const sourceMix: Array<{ source: string; weight: number; level: number }> = [];
    for (const p of perSource) {
      const entry = p.levels[key]; if (!entry) continue;
      const w = weights[p.source] ?? 0.5;
      weightedSum += entry.level * w; weightTotal += w;
      sourceMix.push({ source: p.source, weight: w, level: entry.level });
      for (const ev of entry.evidence) evidence.push({ source: p.source, signal: ev, weight: w });
    }
    const inferredLevel = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
    // Confidence = source-richness × weight-coverage; clamped 0..0.95
    const coverage = Math.min(1, weightTotal / 2.5);
    const richness = Math.min(1, sourceMix.length / 3);
    const confidence = Math.round((0.25 + 0.4 * coverage + 0.3 * richness) * 1000) / 1000;
    const reasoning = buildReasoning({ competencyKey: key, inferredLevel, confidence, evidence, sourceMix });
    return { competency_key: key, inferred_level: inferredLevel, confidence: Math.min(0.95, confidence), evidence: evidence.slice(0, 6), source_mix: sourceMix, reasoning };
  });

  const overallConfidence = competencies.length
    ? Math.round((competencies.reduce((s, c) => s + c.confidence, 0) / competencies.length) * 1000) / 1000
    : 0;

  return { user_id: userId, competencies, overall_confidence: overallConfidence, sources_used: sourcesUsed, generated_at: new Date().toISOString() };
}

/** Persist a source row, its inferred competencies + reasoning chains. */
export async function persistInference(pool: Pool, userId: number, sourceType: string, rawPayload: unknown, result: InferenceResult): Promise<string | null> {
  let sourceId: string | null = null;
  try {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO competency_inference_sources (user_id, source_type, source_ref, raw_payload, parsed_meta)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       ON CONFLICT (user_id, source_type, source_ref) DO UPDATE SET raw_payload = EXCLUDED.raw_payload, parsed_meta = EXCLUDED.parsed_meta, ingested_at = NOW()
       RETURNING id`,
      [userId, sourceType, `${sourceType}:${Date.now()}`, JSON.stringify(rawPayload ?? {}), JSON.stringify({ generated_at: result.generated_at })],
    );
    sourceId = r.rows[0].id;
  } catch (err) {
    console.warn('[ai-inference] source persist failed:', (err as Error).message);
  }
  await Promise.all(result.competencies.map(async (c) => {
    try {
      await pool.query(
        `INSERT INTO ai_inferred_competencies (user_id, source_id, competency_key, inferred_level, confidence, evidence)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [userId, sourceId, c.competency_key, c.inferred_level, c.confidence, JSON.stringify(c.evidence)],
      );
      await pool.query(
        `INSERT INTO ai_reasoning_chains (user_id, scope, competency_key, reasoning, confidence)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [userId, 'inference', c.competency_key, JSON.stringify(c.reasoning), c.confidence],
      );
    } catch (err) {
      console.warn('[ai-inference] competency persist failed:', (err as Error).message);
    }
  }));
  return sourceId;
}
