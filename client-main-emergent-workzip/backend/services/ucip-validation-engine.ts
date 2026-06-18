/**
 * UCIP Validation Engine — Phase 1.
 *
 * Schema + integrity validation for a UnifiedCompetencyProfile. Pure function;
 * no I/O. Issues are surfaced as a report; presence of issues NEVER aborts
 * the pipeline (shadow-mode invariant).
 */
import type { UnifiedCompetencyProfile } from './unified-competency-profile-engine';

export const UCIP_VALIDATOR_VERSION = '1.0.0';

export type UcipValidationIssue = {
  severity: 'info' | 'warn' | 'error';
  code: string;
  message: string;
  competencyId?: string;
};

export type UcipValidationReport = {
  ok: boolean;
  issues: UcipValidationIssue[];
  stats: {
    competencies: number;
    with_score: number;
    with_confidence: number;
    duplicates: number;
    sources_ok: number;
    sources_failed: number;
  };
  validator_version: string;
};

function inRange(v: number | undefined, lo: number, hi: number): boolean {
  return v != null && Number.isFinite(v) && v >= lo && v <= hi;
}

export function validateUcip(profile: UnifiedCompetencyProfile): UcipValidationReport {
  const issues: UcipValidationIssue[] = [];

  if (!profile.userId) {
    issues.push({ severity: 'error', code: 'missing_user_id', message: 'profile.userId is required' });
  }

  const comps = profile.competencies ?? [];
  const seen = new Map<string, number>();
  let withScore = 0, withConf = 0;

  for (const c of comps) {
    if (!c.competencyId) {
      issues.push({ severity: 'error', code: 'missing_competency_id', message: 'competency missing id' });
      continue;
    }
    seen.set(c.competencyId, (seen.get(c.competencyId) ?? 0) + 1);

    if (c.rawScore != null || c.normalizedScore != null) withScore++;
    if (c.confidence != null) withConf++;

    if (c.normalizedScore != null && !inRange(c.normalizedScore, 0, 100)) {
      issues.push({ severity: 'warn', code: 'score_out_of_range', message: `normalizedScore ${c.normalizedScore} out of [0,100]`, competencyId: c.competencyId });
    }
    if (c.confidence != null && !inRange(c.confidence, 0, 1)) {
      issues.push({ severity: 'warn', code: 'confidence_out_of_range', message: `confidence ${c.confidence} out of [0,1]`, competencyId: c.competencyId });
    }
  }

  let dupes = 0;
  for (const [cid, n] of seen) if (n > 1) {
    dupes += (n - 1);
    issues.push({ severity: 'warn', code: 'duplicate_competency', message: `competency ${cid} appears ${n} times`, competencyId: cid });
  }

  const meta = profile.orchestrationMetadata;
  if (!meta) {
    issues.push({ severity: 'warn', code: 'missing_metadata', message: 'orchestrationMetadata absent' });
  }
  const sourcesOk = meta?.sources?.ok ?? 0;
  const sourcesFailed = meta?.sources?.failed ?? 0;
  if (sourcesFailed > sourcesOk) {
    issues.push({ severity: 'warn', code: 'degraded_sources', message: `more sources failed (${sourcesFailed}) than succeeded (${sourcesOk})` });
  }

  const ok = !issues.some(i => i.severity === 'error');
  return {
    ok,
    issues,
    stats: {
      competencies: comps.length,
      with_score: withScore,
      with_confidence: withConf,
      duplicates: dupes,
      sources_ok: sourcesOk,
      sources_failed: sourcesFailed,
    },
    validator_version: UCIP_VALIDATOR_VERSION,
  };
}
