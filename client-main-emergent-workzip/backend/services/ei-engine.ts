/**
 * Server-side EI engine — Phase 4 (configurable, versioned, traceable)
 *
 * REFACTOR NOTE
 * -------------
 * Phase 2/3 used hardcoded weights/caps/multipliers/thresholds in this file.
 * Phase 4 moves every knob into `ei_rulesets.config` (see
 * `migrations/20260521_ei_rules_engine.sql`). The engine is now a pure
 * interpreter of a ruleset.
 *
 * Back-compat guarantee: when called with the seeded v1.0.0 ruleset (or the
 * baked default fallback in `ei-rules-loader.ts`), this engine produces the
 * exact same OfficialEIOutput as the Phase 2/3 hardcoded implementation.
 *
 * Determinism: no randomness, no external calls inside the formula path.
 * Explainability: every dimension records its inputs, formula, intermediate
 * values, and contribution into `trace[]`. The caller (ei-resolution route)
 * persists this into `ei_calculation_logs`.
 *
 * The OfficialEIOutput shape is preserved exactly so frontend consumers
 * (`useHybridEI` → `EIProvenanceCard`) keep working with no changes.
 */

import type { ResolverOutput, ResolvedEntity } from './ei-resolver';
import { BAKED_DEFAULT_RULESET, type LoadedRuleset, type EIDimensionConfig } from './ei-rules-loader';

export interface EISignal {
  type: 'institution' | 'qualification' | 'skill' | 'certification' | 'occupation';
  canonical_name: string;
  matched_via: string;
  confidence: number;
  weight_contribution: number;
  evidence: Array<{ label: string; source?: string | null; source_url?: string | null; value?: any }>;
}

export interface OfficialEIBreakdown {
  completenessScore: number;
  technicalScore:    number;
  softScore:         number;
  experienceScore:   number;
  certScore:         number;
  projectScore:      number;
}

export interface DimensionTrace {
  key:           string;
  formula:       string;
  inputs:        Record<string, any>;
  intermediate:  Record<string, any>;
  raw:           number;
  cap:           number;
  contribution:  number;
}

export interface OfficialEIOutput {
  score:    number;
  band:     string;
  breakdown: OfficialEIBreakdown;
  signals:  EISignal[];
  profile_confidence_score: number;
  fallback_used: boolean;
  // Phase 4 additions (back-compat: optional & additive)
  ruleset_version?:             string;
  taxonomy_version?:            string | null;
  institution_dataset_version?: string | null;
  trace?:                       DimensionTrace[];
  evidence_refs?:               { type: string; canonical_id: string }[];
  normalization_details?:       Record<string, any>;
}

export interface EIEngineInput {
  resolved: ResolverOutput;
  raw: {
    completeness?:     number;
    soft_skill_count?: number;
    experience_count?: number;
    project_count?:    number;
  };
  /** Optional Phase 4 ruleset override. When omitted, baked default is used.
   *  Callers in routes should fetch active ruleset via getActiveRuleset() and
   *  pass it here so the score is pinned to a known version. */
  ruleset?: LoadedRuleset;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number, decimals: number) => {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
};

function bandFor(score: number, bands: Record<string, number>): string {
  // bands map {label: min_score}, pick the label with highest min_score satisfied
  const entries = Object.entries(bands).sort((a, b) => b[1] - a[1]);
  for (const [label, min] of entries) {
    if (score >= min) return label;
  }
  return entries[entries.length - 1]?.[0] || 'Starter';
}

function provenanceEvidence(e: ResolvedEntity): EISignal['evidence'] {
  if (!e.provenance?.length) return [];
  return e.provenance.slice(0, 3).map(p => ({
    label: p.source_authority, source: p.source_authority,
    source_url: p.source_url ?? null, value: p.extracted_value ?? null,
  }));
}

// ────────────────────────────────────────────────────────────
// Formula implementations — pure, deterministic, traceable
// ────────────────────────────────────────────────────────────

function evalPercent(dim: EIDimensionConfig, value: number): { raw: number; intermediate: Record<string, any> } {
  const mult = Number(dim.params.multiplier ?? 0);
  const v = clamp(value, 0, 100);
  return { raw: v * mult, intermediate: { value: v, multiplier: mult } };
}

function evalCountLinear(dim: EIDimensionConfig, count: number): { raw: number; intermediate: Record<string, any> } {
  const per = Number(dim.params.per_unit ?? 0);
  const c = Math.max(0, count);
  return { raw: c * per, intermediate: { count: c, per_unit: per } };
}

function evalWeightedSumSkills(dim: EIDimensionConfig, skills: ResolvedEntity[], signals: EISignal[]): { raw: number; intermediate: Record<string, any> } {
  const p = dim.params;
  const base   = Number(p.base_per_skill ?? 0);
  const ucFac  = Number(p.unresolved_credit_factor ?? 0);
  const dFloor = Number(p.demand_weight_floor ?? 0);
  const dSpan  = Number(p.demand_weight_span ?? 0);
  const cFloor = Number(p.confidence_floor ?? 0);

  let raw = 0;
  let matched = 0, unresolved = 0;
  for (const s of skills) {
    if (s.matched) {
      matched++;
      const mdRaw = Number((s.meta as any)?.market_demand_score) || 0.5;
      const md = mdRaw <= 1 ? mdRaw * 100 : mdRaw;
      const w = dFloor + dSpan * clamp(md, 0, 100) / 100;
      const contrib = base * w * clamp(s.confidence, cFloor, 1.0);
      raw += contrib;
      signals.push({
        type: 'skill', canonical_name: s.canonical_name || s.input,
        matched_via: s.matched_via, confidence: s.confidence,
        weight_contribution: Math.round(contrib * 10) / 10,
        evidence: [
          { label: `Market demand ${Math.round(md)}/100`, value: { market_demand_score: md } },
          ...provenanceEvidence(s),
        ],
      });
    } else {
      unresolved++;
      raw += base * ucFac;
    }
  }
  return { raw, intermediate: { matched_skills: matched, unresolved_skills: unresolved, base_per_skill: base } };
}

function evalWeightedSumCerts(dim: EIDimensionConfig, certs: ResolvedEntity[], signals: EISignal[]): { raw: number; intermediate: Record<string, any> } {
  const p = dim.params;
  const tw: Record<string, number> = p.tier_weights || {};
  const ucCredit = Number(p.unresolved_credit ?? 0);
  const cFloor   = Number(p.confidence_floor ?? 0);

  let raw = 0;
  let matched = 0, unresolved = 0;
  for (const c of certs) {
    if (c.matched) {
      matched++;
      const tier = String((c.meta as any)?.tier || 'tier_3');
      const mrRaw = Number((c.meta as any)?.market_recognition_score) || 0.5;
      const mr = mrRaw <= 1 ? mrRaw * 100 : mrRaw;
      const w = (tw[tier] ?? 1.0) * (clamp(mr, 0, 100) / 100) * clamp(c.confidence, cFloor, 1.0);
      raw += w;
      signals.push({
        type: 'certification', canonical_name: c.canonical_name || c.input,
        matched_via: c.matched_via, confidence: c.confidence,
        weight_contribution: Math.round(w * 10) / 10,
        evidence: [
          { label: `Tier: ${tier} · Market recognition ${Math.round(mr)}/100`, value: { tier, market_recognition_score: mr } },
          ...provenanceEvidence(c),
        ],
      });
    } else {
      unresolved++;
      raw += ucCredit;
    }
  }
  return { raw, intermediate: { matched_certs: matched, unresolved_certs: unresolved, tier_weights: tw } };
}

// ────────────────────────────────────────────────────────────

export function computeOfficialEI(input: EIEngineInput): OfficialEIOutput {
  const ruleset = input.ruleset ?? BAKED_DEFAULT_RULESET;
  const cfg = ruleset.config;
  const dims = cfg.dimensions;
  const r = input.resolved;
  const signals: EISignal[] = [];
  const trace: DimensionTrace[] = [];
  const normalization: Record<string, any> = {};

  // ── Helper: run one dimension with capping + tracing ──
  const runDim = (key: string, evalFn: () => { raw: number; intermediate: Record<string, any> }): number => {
    const d = dims[key];
    if (!d || !d.enabled) return 0;
    const { raw, intermediate } = evalFn();
    const cap = Number(d.params.cap ?? d.weight);
    const capped = clamp(raw, 0, cap);
    if (raw > cap) normalization[key] = { raw_before_cap: round(raw, 2), cap, clamped_to: cap };
    trace.push({
      key, formula: d.formula, inputs: snapshotInputsFor(key, input),
      intermediate, raw: round(raw, 3), cap, contribution: round(capped, 3),
    });
    return capped;
  };

  // Dimensions
  const completenessScore = runDim('completeness',   () => evalPercent(dims.completeness, input.raw.completeness ?? 0));
  const technicalScore    = runDim('technical',      () => evalWeightedSumSkills(dims.technical, r.skills || [], signals));
  const softScore         = runDim('soft',           () => evalCountLinear(dims.soft, input.raw.soft_skill_count ?? 0));
  const experienceScore   = runDim('experience',     () => evalCountLinear(dims.experience, input.raw.experience_count ?? 0));
  const certScore         = runDim('certifications', () => evalWeightedSumCerts(dims.certifications, r.certifications || [], signals));
  const projectScore      = runDim('projects',       () => evalCountLinear(dims.projects, input.raw.project_count ?? 0));

  // ── Evidence-only signals (institution / qualification / occupation) ──
  if (dims.institution_bonus?.enabled && r.institution?.matched) {
    const meta = r.institution.meta || {};
    signals.push({
      type: 'institution',
      canonical_name: r.institution.canonical_name || r.institution.input,
      matched_via: r.institution.matched_via, confidence: r.institution.confidence, weight_contribution: 0,
      evidence: [
        { label: `Tier ${meta.tier_computed ?? 'unranked'}`, value: { tier_computed: meta.tier_computed, tier_basis: meta.tier_basis } },
        ...((meta as any).rankings || []).slice(0, 3).map((rk: any) => ({
          label: `${rk.ranking_source}${rk.ranking_category ? ' ' + rk.ranking_category : ''}: #${rk.ranking_value ?? '—'} (${rk.ranking_year})`,
          source: rk.ranking_source, source_url: rk.source_url ?? null, value: rk,
        })),
        ...((meta as any).accreditations || []).slice(0, 3).map((ac: any) => ({
          label: `${ac.accreditation_authority}${ac.accreditation_grade ? ': ' + ac.accreditation_grade : ''}`,
          source: ac.accreditation_authority, source_url: ac.source_url ?? null, value: ac,
        })),
      ],
    });
  }
  if (dims.qualification_bonus?.enabled && r.qualification?.matched) {
    const meta = r.qualification.meta || {};
    signals.push({
      type: 'qualification',
      canonical_name: r.qualification.canonical_name || r.qualification.input,
      matched_via: r.qualification.matched_via, confidence: r.qualification.confidence, weight_contribution: 0,
      evidence: [
        { label: `${meta.qualification_type ?? ''} · NSQF L${meta.nsqf_level ?? '—'} · weight ${meta.qualification_weight ?? '—'}`, value: meta },
        ...provenanceEvidence(r.qualification),
      ],
    });
  }
  if (r.occupation?.matched) {
    signals.push({
      type: 'occupation',
      canonical_name: r.occupation.canonical_name || r.occupation.input,
      matched_via: r.occupation.matched_via, confidence: r.occupation.confidence, weight_contribution: 0,
      evidence: [{ label: `${(r.occupation.meta as any)?.role_family ?? ''} · ${(r.occupation.meta as any)?.seniority_level ?? ''}` }],
    });
  }

  // ── Final score ──
  const breakdown: OfficialEIBreakdown = {
    completenessScore: round(completenessScore, cfg.rounding.breakdown_decimals),
    technicalScore:    round(technicalScore,    cfg.rounding.breakdown_decimals),
    softScore:         round(softScore,         cfg.rounding.breakdown_decimals),
    experienceScore:   round(experienceScore,   cfg.rounding.breakdown_decimals),
    certScore:         round(certScore,         cfg.rounding.breakdown_decimals),
    projectScore:      round(projectScore,      cfg.rounding.breakdown_decimals),
  };
  const raw = breakdown.completenessScore + breakdown.technicalScore + breakdown.softScore
            + breakdown.experienceScore   + breakdown.certScore       + breakdown.projectScore;
  const score = Math.min(round(raw, cfg.rounding.final_decimals), cfg.total_cap);

  // Evidence refs (canonical IDs) for traceability
  const evidence_refs: { type: string; canonical_id: string }[] = [];
  if (r.institution?.canonical_id)   evidence_refs.push({ type: 'institution',   canonical_id: r.institution.canonical_id });
  if (r.qualification?.canonical_id) evidence_refs.push({ type: 'qualification', canonical_id: r.qualification.canonical_id });
  for (const s of (r.skills || []))         if (s.canonical_id) evidence_refs.push({ type: 'skill',         canonical_id: s.canonical_id });
  for (const c of (r.certifications || [])) if (c.canonical_id) evidence_refs.push({ type: 'certification', canonical_id: c.canonical_id });

  return {
    score,
    band: bandFor(score, cfg.bands),
    breakdown,
    signals,
    profile_confidence_score: r.profile_confidence_score,
    fallback_used: false,
    ruleset_version:             ruleset.version,
    taxonomy_version:            ruleset.taxonomy_version,
    institution_dataset_version: ruleset.institution_dataset_version,
    trace,
    evidence_refs,
    normalization_details:       normalization,
  };
}

function snapshotInputsFor(key: string, input: EIEngineInput): Record<string, any> {
  switch (key) {
    case 'completeness': return { completeness: input.raw.completeness ?? 0 };
    case 'technical':    return { total_skills: (input.resolved.skills || []).length };
    case 'soft':         return { soft_skill_count: input.raw.soft_skill_count ?? 0 };
    case 'experience':   return { experience_count: input.raw.experience_count ?? 0 };
    case 'certifications': return { total_certifications: (input.resolved.certifications || []).length };
    case 'projects':     return { project_count: input.raw.project_count ?? 0 };
    default: return {};
  }
}
