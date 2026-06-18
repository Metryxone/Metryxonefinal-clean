/**
 * Scientific Gap Intelligence
 * Phase 2 Scientific Competency Intelligence (v2.0.0)
 *
 * Enhancement-only: does NOT modify existing gap analysis. Adds gap typing
 * (Behavioural/Cognitive/Functional/Leadership/Strategic/Readiness) and a
 * prioritisation engine that combines competency dependencies, role criticality,
 * and developmental delta.
 */
import type { Pool } from 'pg';
import { createCompetencyGraphEngine } from './competency-graph-engine.js';

export const SCI_GAP_INTELLIGENCE_VERSION = '2.0.0';

export type GapType =
  | 'behavioural' | 'cognitive' | 'functional' | 'leadership' | 'strategic' | 'readiness';

const COMPETENCY_TO_GAP_TYPE: Record<string, GapType> = {
  EIQ: 'behavioural',
  COM: 'behavioural',
  COG: 'cognitive',
  EXE: 'functional',
  ADP: 'behavioural',
  LEA: 'leadership',
  TEC: 'functional',
  STR: 'strategic',
  LBI: 'readiness',
};

export interface GapRow {
  competency_id: string;
  gap_type: GapType;
  current_score: number;
  expected_score: number;
  delta: number;
  severity: 'meets' | 'low' | 'medium' | 'high' | 'critical';
  priority: number;        // composite score for ranking
  rationale: string;
  dependency_unlocks: string[]; // competencies that further development would unlock
}

function severityFor(delta: number): GapRow['severity'] {
  if (delta <= 0) return 'meets';
  if (delta <= 5)  return 'low';
  if (delta <= 12) return 'medium';
  if (delta <= 22) return 'high';
  return 'critical';
}

const SEVERITY_WEIGHT: Record<GapRow['severity'], number> = {
  meets: 0, low: 0.5, medium: 1.0, high: 1.6, critical: 2.4,
};

const GAP_TYPE_CRITICALITY: Record<GapType, number> = {
  readiness: 1.4,
  leadership: 1.3,
  strategic: 1.25,
  cognitive: 1.15,
  behavioural: 1.0,
  functional: 1.05,
};

export function createSciGapIntelligence(pool: Pool) {
  const graph = createCompetencyGraphEngine(pool);

  async function computeGaps(
    currentScores: Record<string, number>,
    expectedScores: Record<string, number>,
    opts?: { roleCriticality?: Record<string, number>; marketDemand?: Record<string, number> }
  ): Promise<GapRow[]> {
    const edges = await graph.allEdges();
    const out: GapRow[] = [];
    for (const [compId, expected] of Object.entries(expectedScores)) {
      const current = currentScores[compId] ?? 0;
      const delta = +(expected - current).toFixed(2);
      const severity = severityFor(delta);
      const gapType = COMPETENCY_TO_GAP_TYPE[compId] ?? 'functional';
      const unlocks = edges
        .filter(e => e.source_competency_id === compId && ['prerequisite','amplification','dependency'].includes(e.relationship_type))
        .map(e => e.target_competency_id);
      const criticality = (opts?.roleCriticality?.[compId] ?? 1.0) * GAP_TYPE_CRITICALITY[gapType];
      const market = opts?.marketDemand?.[compId] ?? 1.0;
      const dependencyBoost = 1 + unlocks.length * 0.10; // each downstream unlock adds 10%
      const priority = +(SEVERITY_WEIGHT[severity] * criticality * market * dependencyBoost).toFixed(3);
      out.push({
        competency_id: compId,
        gap_type: gapType,
        current_score: current,
        expected_score: expected,
        delta,
        severity,
        priority,
        rationale: severity === 'meets'
          ? `Meets expected ${gapType} level for the role.`
          : `${severity.toUpperCase()} ${gapType} gap of ${delta} pts; ${unlocks.length} downstream competencies depend on this.`,
        dependency_unlocks: unlocks,
      });
    }
    return out.sort((a, b) => b.priority - a.priority);
  }

  return { computeGaps };
}
