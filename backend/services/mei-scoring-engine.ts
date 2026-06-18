/**
 * MEI v2 Scoring Engine
 * ─────────────────────
 * Hierarchical scoring: Competency → Subdimension → Dimension → Composite
 *
 * Design principles:
 *  - Pure function: no DB writes, no external calls. Caller persists output.
 *  - Fully traceable: every competency records its inputs, formula, and result.
 *  - Additive: does not touch ei_* tables or existing OfficialEIOutput.
 *  - Graceful degradation: missing data → score contribution = 0, confidence
 *    deducted proportionally, never throws.
 */

import type { Pool } from 'pg';
import { classifyDegreeLevel, classifyInstitutionTier } from '../lib/ei-classifiers';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MEIProfileInput {
  // Assessment signals
  assessmentScore?:       number | null;   // 0-100
  specialisationScore?:   number | null;
  leadershipScore?:       number | null;
  assessmentTaken?:       boolean;
  specialisationTaken?:   boolean;
  leadershipTaken?:       boolean;
  capadexScore?:          number | null;
  capadexTaken?:          boolean;
  csiScore?:              number | null;
  sessionCount?:          number;

  // Skills
  technicalSkills?:       string[];
  softSkills?:            string[];
  tools?:                 string[];
  skillsText?:            string;
  softSkillsText?:        string;
  skillUpdatedAt?:        string | null;

  // Experience
  totalMonths?:           number;
  peakSeniority?:         string;         // c_suite|vp|director|manager|senior|associate|junior
  roleHistory?:           Array<{ title: string; months: number; company?: string; industry?: string; seniority?: string }>;
  uniqueIndustries?:      string[];
  targetIndustry?:        string | null;
  targetIndustryYearsPct?: number;         // 0-100

  // Education
  highestDegree?:         string;         // phd|masters|bachelors|diploma|other
  bestInstitutionTier?:   string;         // tier1|tier2|tier3|unknown
  fieldAlignment?:        string;         // exact|adjacent|transferable|unrelated
  programmeAccredited?:   boolean;
  multiField?:            boolean;
  hasPostgrad?:           boolean;
  postgradField?:         string;

  // Certifications
  certifications?:        Array<{ name: string; tier: 'top' | 'mid' | 'generic'; verified?: boolean; earned_date?: string }>;
  courses?:               number;

  // Portfolio
  projectCount?:          number;
  publicationCount?:      number;
  hasGithub?:             boolean;
  recommendationCount?:   number;
  endorsementCount?:      number;
  awardCount?:            number;
  profileLinks?:          string[];

  // Profile
  profileFillPct?:        number;         // 0-100
  headline?:              string;
  summary?:               string;

  // Calibration
  industryCode?:          string | null;
  roleLevelCode?:         string | null;
}

export interface CompetencyScore {
  competency_id: number;
  code:          string;
  name:          string;
  raw_score:     number;   // 0 .. max_raw
  norm_score:    number;   // 0 .. 1
  max_raw:       number;
  is_gated:      boolean;
  gate_met:      boolean;
  weight:        number;   // within_sd_weight
  trace:         Record<string, unknown>;
}

export interface SubdimensionScore {
  subdimension_id:   number;
  code:              string;
  name:              string;
  score:             number;          // 0 .. 1
  weighted_score:    number;          // score × within_dim_weight
  within_dim_weight: number;
  competencies:      CompetencyScore[];
}

export interface DimensionScore {
  dimension_id:  number;
  code:          string;
  name:          string;
  base_weight:   number;
  cal_weight:    number;             // after calibration + renorm
  score:         number;             // 0 .. 1
  contribution:  number;             // score × cal_weight × 100 (= points)
  max_points:    number;
  subdimensions: SubdimensionScore[];
}

export interface MEIScoreOutput {
  composite_score:   number;          // 0 .. 99
  band:              'getting_started' | 'building' | 'career_ready' | 'hire_ready';
  confidence:        number;          // 0 .. 1
  industry_code:     string | null;
  role_level_code:   string | null;
  dimensions:        DimensionScore[];
  calibration_trace: {
    raw_weights:  Record<string, number>;
    cal_weights:  Record<string, number>;
    sum_check:    number;
  };
  data_sources:      string[];
  version:           '2.0';
}

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface DBDimension {
  id: number; code: string; name: string;
  base_weight: number; max_points: number;
}
interface DBSubdimension {
  id: number; code: string; name: string; dimension_id: number;
  within_dim_weight: number;
}
interface DBCompetency {
  id: number; code: string; name: string; subdimension_id: number;
  within_sd_weight: number; formula_type: string; formula_config: Record<string, unknown>;
  data_field: string | null; max_raw: number; is_gated: boolean; gate_condition: string | null;
}
interface DBCalibration {
  dimension_id: number; multiplier: number;
}

// ── Schema Bootstrapper ───────────────────────────────────────────────────────

export async function ensureMEISchema(pool: Pool): Promise<void> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  for (const file of ['20260611_mei_v2.sql', '20260615_mei_v2_seeds.sql']) {
    try {
      const sql = readFileSync(join(__dirname, '../migrations', file), 'utf8');
      await pool.query(sql);
    } catch {
      // Already applied or file not found — non-fatal
    }
  }
}

// ── Taxonomy Loader ───────────────────────────────────────────────────────────

let _taxonomyCache: { dims: DBDimension[]; sds: DBSubdimension[]; comps: DBCompetency[] } | null = null;

async function loadTaxonomy(pool: Pool) {
  if (_taxonomyCache) return _taxonomyCache;
  const [dRes, sRes, cRes] = await Promise.all([
    pool.query<DBDimension>('SELECT id,code,name,base_weight::float,max_points::float FROM mei_dimensions WHERE is_active ORDER BY display_order'),
    pool.query<DBSubdimension>('SELECT id,code,name,dimension_id,within_dim_weight::float FROM mei_subdimensions WHERE is_active ORDER BY display_order'),
    pool.query<DBCompetency>('SELECT id,code,name,subdimension_id,within_sd_weight::float,formula_type,formula_config,data_field,max_raw::float,is_gated,gate_condition FROM mei_competencies WHERE is_active ORDER BY display_order'),
  ]);
  _taxonomyCache = { dims: dRes.rows, sds: sRes.rows, comps: cRes.rows };
  return _taxonomyCache;
}

export function invalidateTaxonomyCache() { _taxonomyCache = null; }

async function loadCalibration(pool: Pool, industryCode: string | null, roleLevelCode: string | null) {
  const rows: DBCalibration[] = [];
  if (industryCode) {
    const r = await pool.query<DBCalibration>(
      'SELECT dimension_id,multiplier::float FROM mei_industry_calibration WHERE industry_code=$1', [industryCode]);
    rows.push(...r.rows);
  }
  if (roleLevelCode) {
    const r = await pool.query<DBCalibration>(
      'SELECT dimension_id,multiplier::float FROM mei_role_calibration WHERE role_level_code=$1', [roleLevelCode]);
    // Combine with industry multipliers (average if both exist)
    for (const row of r.rows) {
      const existing = rows.find(x => x.dimension_id === row.dimension_id);
      if (existing) {
        existing.multiplier = (existing.multiplier + row.multiplier) / 2;
      } else {
        rows.push(row);
      }
    }
  }
  return rows;
}

// ── Formula Interpreters ──────────────────────────────────────────────────────

const EMERGING_TECH_VOCAB = [
  'ai','machine learning','deep learning','llm','generative ai','nlp','computer vision',
  'cloud','aws','azure','gcp','kubernetes','docker','microservices',
  'blockchain','web3','defi','smart contracts',
  'data science','data engineering','spark','databricks','snowflake',
  'devops','mlops','cicd','infrastructure as code','terraform',
  'cybersecurity','zero trust','soc2','penetration testing',
];

const COMMUNICATION_VOCAB = [
  'communication','presentation','public speaking','writing','storytelling',
  'stakeholder management','negotiation','facilitation','persuasion','active listening',
];

const COLLABORATION_VOCAB = [
  'teamwork','collaboration','cross-functional','partnership','mentoring',
  'coaching','team building','conflict resolution','empathy','emotional intelligence',
];

function matchVocab(text: string, vocab: string[], maxMatches: number): number {
  const t = (text || '').toLowerCase();
  let count = 0;
  for (const kw of vocab) {
    if (t.includes(kw)) count++;
    if (count >= maxMatches) break;
  }
  return count;
}

function scoreCompetency(comp: DBCompetency, p: MEIProfileInput): { raw: number; trace: Record<string, unknown>; gate_met: boolean } {
  const cfg = comp.formula_config as Record<string, unknown>;

  // Gate check
  let gate_met = true;
  if (comp.is_gated && comp.gate_condition) {
    const cond = comp.gate_condition;
    if (cond === 'assessment_taken') gate_met = !!(p.assessmentTaken);
    else if (cond === 'specialisation_taken') gate_met = !!(p.specialisationTaken);
    else if (cond === 'leadership_taken') gate_met = !!(p.leadershipTaken);
    else if (cond === 'capadex_taken') gate_met = !!(p.capadexTaken);
  }
  if (comp.is_gated && !gate_met) {
    return { raw: 0, trace: { gate: comp.gate_condition, gate_met: false }, gate_met: false };
  }

  const type = comp.formula_type;
  let raw = 0;
  const trace: Record<string, unknown> = { formula_type: type, config: cfg };

  // ── direct ──────────────────────────────────────────────────────────────────
  if (type === 'direct') {
    const field = comp.data_field;
    let val = 0;
    if (field === 'assessmentScore')     val = p.assessmentScore ?? 0;
    else if (field === 'specialisationScore') val = p.specialisationScore ?? 0;
    else if (field === 'leadershipScore')val = p.leadershipScore ?? 0;
    else if (field === 'capadex_score')  val = p.capadexScore ?? 0;
    else if (field === 'csi_score')      val = p.csiScore ?? 0;
    else if (field === 'profile_fill_pct') val = p.profileFillPct ?? 0;
    raw = Math.min(val, comp.max_raw);
    trace.input = val;
  }

  // ── count_capped ─────────────────────────────────────────────────────────────
  else if (type === 'count_capped') {
    const cap = (cfg.cap as number) ?? 10;
    const ppu = (cfg.points_per_unit as number) ?? 10;
    let count = 0;
    const field = comp.data_field;
    if (field === 'technical_skills')   count = (p.technicalSkills ?? []).length;
    else if (field === 'soft_skills')   count = (p.softSkills ?? []).length;
    else if (field === 'tools')         count = (p.tools ?? []).length;
    else if (field === 'projects')      count = p.projectCount ?? 0;
    else if (field === 'publications')  count = p.publicationCount ?? 0;
    else if (field === 'recommendations') count = p.recommendationCount ?? 0;
    else if (field === 'endorsements')  count = p.endorsementCount ?? 0;
    else if (field === 'awards')        count = p.awardCount ?? 0;
    else if (field === 'courses')       count = p.courses ?? 0;
    else if (field === 'unique_industries') count = (p.uniqueIndustries ?? []).length;
    else if (field === 'industry_transitions') count = Math.max(0, (p.uniqueIndustries ?? []).length - 1);
    else if (field === 'profile_links') count = (p.profileLinks ?? []).length;
    const used = Math.min(count, cap);
    raw = used * ppu;
    trace.count = count; trace.capped_count = used;
  }

  // ── percent ──────────────────────────────────────────────────────────────────
  else if (type === 'percent') {
    const field = cfg.field as string;
    let val = 0;
    if (field === 'profile_fill_pct') val = p.profileFillPct ?? 0;
    else if (field === 'target_industry_years_pct') val = p.targetIndustryYearsPct ?? 0;
    raw = (val / 100) * (cfg.scale as number ?? 100);
    trace.val = val;
  }

  // ── lookup ───────────────────────────────────────────────────────────────────
  else if (type === 'lookup') {
    const mapping = cfg.mapping as Record<string, number>;
    let key = '';
    const field = comp.data_field;
    if (field === 'highest_degree')         key = p.highestDegree ?? 'other';
    else if (field === 'best_institution_tier') key = p.bestInstitutionTier ?? 'unknown';
    else if (field === 'field_alignment')   key = p.fieldAlignment ?? 'unrelated';
    else if (field === 'peak_seniority')    key = p.peakSeniority ?? 'junior';
    else if (field === 'employers')         key = 'tier3'; // default; override from roleHistory
    raw = mapping[key] ?? mapping['other'] ?? 0;
    trace.key = key;
  }

  // ── tier_weighted ─────────────────────────────────────────────────────────────
  else if (type === 'tier_weighted') {
    const tiers = cfg.tiers as Record<string, number>;
    const cap = (cfg.cap as number) ?? 100;
    const field = comp.data_field;
    if (field === 'certifications') {
      let pts = 0;
      for (const cert of p.certifications ?? []) {
        pts += tiers[cert.tier] ?? tiers['generic'] ?? 0;
      }
      raw = Math.min(pts, cap);
      trace.cert_count = (p.certifications ?? []).length;
    } else if (field === 'employers') {
      // best employer tier from roleHistory
      const best = (p.roleHistory ?? []).reduce((acc, r) => {
        if (r.company === 'tier1') return Math.max(acc, tiers['tier1'] ?? 0);
        return Math.max(acc, tiers['tier3'] ?? 0);
      }, 0);
      raw = Math.min(best, cap);
    }
  }

  // ── boolean_bonus ─────────────────────────────────────────────────────────────
  else if (type === 'boolean_bonus') {
    const field = comp.data_field;
    let flag = false;
    if (field === 'programme_accredited')  flag = !!(p.programmeAccredited);
    else if (field === 'multi_field')      flag = !!(p.multiField);
    else if (field === 'has_github')       flag = !!(p.hasGithub);
    raw = flag ? (cfg.bonus_if_true as number ?? 100) : (cfg.default as number ?? 0);
    trace.flag = flag;
  }

  // ── keyword_match ─────────────────────────────────────────────────────────────
  else if (type === 'keyword_match') {
    const vocabKey = cfg.vocab_key as string;
    const maxMatches = (cfg.max_matches as number) ?? 3;
    const ppm = (cfg.points_per_match as number) ?? 33.3;
    let text = '';
    let vocab: string[] = [];
    if (vocabKey === 'emerging_tech') { text = p.skillsText ?? (p.technicalSkills ?? []).join(' '); vocab = EMERGING_TECH_VOCAB; }
    else if (vocabKey === 'communication') { text = p.softSkillsText ?? (p.softSkills ?? []).join(' '); vocab = COMMUNICATION_VOCAB; }
    else if (vocabKey === 'collaboration') { text = p.softSkillsText ?? (p.softSkills ?? []).join(' '); vocab = COLLABORATION_VOCAB; }
    const matched = matchVocab(text, vocab, maxMatches);
    raw = Math.min(matched * ppm, comp.max_raw);
    trace.matched = matched;
  }

  // ── conditional ──────────────────────────────────────────────────────────────
  else if (type === 'conditional') {
    const cond = cfg.condition as string;
    if (cond === 'has_postgrad') {
      const bonus = !!(p.hasPostgrad)
        ? (p.fieldAlignment === 'exact' || p.fieldAlignment === 'adjacent'
            ? (cfg.aligned_bonus as number ?? 100)
            : (cfg.unaligned_bonus as number ?? 40))
        : 0;
      raw = bonus;
      trace.has_postgrad = p.hasPostgrad;
    } else if (cond === 'multi_session') {
      raw = (p.sessionCount ?? 0) >= 2 ? 100 : 0;
      trace.session_count = p.sessionCount;
    } else if (cond === 'specialisation_taken') {
      raw = p.specialisationTaken ? (p.specialisationScore ?? 0) : 0;
    } else if (cond === 'leadership_taken') {
      raw = p.leadershipTaken ? (p.leadershipScore ?? 0) : 0;
    } else {
      raw = 0;
    }
  }

  // ── multiplier_bonus ─────────────────────────────────────────────────────────
  else if (type === 'multiplier_bonus') {
    const gate = cfg.gate as string;
    if (gate === 'verified') {
      const verifiedCount = (p.certifications ?? []).filter(c => c.verified).length;
      raw = verifiedCount > 0 ? 100 : 0;
      trace.verified_count = verifiedCount;
    }
  }

  // ── recency ──────────────────────────────────────────────────────────────────
  else if (type === 'recency') {
    const field = comp.data_field;
    const windowMonths = (cfg.window_months as number) ?? 36;
    const recentYears = (cfg.recent_years as number) ?? 3;
    const nowMs = Date.now();
    if (field === 'cert_dates') {
      const recentCerts = (p.certifications ?? []).filter(c => {
        if (!c.earned_date) return false;
        const ageMonths = (nowMs - new Date(c.earned_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        return ageMonths <= windowMonths;
      });
      const cap = (cfg.cap as number) ?? 3;
      raw = Math.min(recentCerts.length * ((cfg.points_per_unit as number) ?? 33.3), comp.max_raw);
      trace.recent_cert_count = recentCerts.length;
    } else if (field === 'skill_updated_at') {
      if (p.skillUpdatedAt) {
        const ageMonths = (nowMs - new Date(p.skillUpdatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
        raw = ageMonths <= (cfg.full_credit_months as number ?? 6) ? 100 : Math.max(0, 100 - (ageMonths - 6) * 5);
      }
    }
  }

  // ── velocity ─────────────────────────────────────────────────────────────────
  else if (type === 'velocity') {
    const windowYears = (cfg.window_years as number) ?? 3;
    const field = comp.data_field;
    if (field === 'seniority_history') {
      // Estimate promotions from role history seniority changes
      const history = p.roleHistory ?? [];
      const seniorityRank: Record<string, number> = { c_suite:7, vp:6, director:5, manager:4, senior:3, associate:2, junior:1 };
      let promotions = 0;
      for (let i = 1; i < history.length; i++) {
        const prev = seniorityRank[history[i-1].seniority ?? 'associate'] ?? 2;
        const curr = seniorityRank[history[i].seniority ?? 'associate'] ?? 2;
        if (curr > prev) promotions++;
      }
      const totalYears = (p.totalMonths ?? 0) / 12;
      const rate = totalYears > 0 ? (promotions / totalYears) * windowYears : 0;
      raw = Math.min(rate / (cfg.max_promotions_per_window as number ?? 2) * 100, 100);
      trace.promotions = promotions; trace.rate = rate;
    } else if (field === 'cert_history') {
      const recentCerts = (p.certifications ?? []).filter(c => {
        if (!c.earned_date) return false;
        const ageYears = (Date.now() - new Date(c.earned_date).getTime()) / (1000 * 60 * 60 * 24 * 365);
        return ageYears <= windowYears;
      });
      const optimalPerYear = (cfg.optimal_per_year as number) ?? 2;
      raw = Math.min(recentCerts.length / (optimalPerYear * windowYears) * 100, 100);
    }
  }

  // ── slope ─────────────────────────────────────────────────────────────────────
  else if (type === 'slope') {
    const history = p.roleHistory ?? [];
    const seniorityRank: Record<string, number> = { c_suite:7, vp:6, director:5, manager:4, senior:3, associate:2, junior:1 };
    if (history.length >= 2) {
      const first = seniorityRank[history[0].seniority ?? 'associate'] ?? 2;
      const last  = seniorityRank[history[history.length-1].seniority ?? 'associate'] ?? 2;
      const slope = (last - first) / history.length;
      raw = Math.min(Math.max(slope / 1.5 * 100, 0), 100);
    }
    trace.history_length = history.length;
  }

  // ── tenure_quality ────────────────────────────────────────────────────────────
  else if (type === 'tenure_quality') {
    const history = p.roleHistory ?? [];
    const optimalMonths = (cfg.optimal_months as number) ?? 30;
    const minMonths = (cfg.min_months as number) ?? 6;
    const discount = (cfg.discount_per_short_role as number) ?? 0.1;
    if (history.length === 0) { raw = 50; }
    else {
      const avg = history.reduce((a, r) => a + r.months, 0) / history.length;
      const shortRoles = history.filter(r => r.months < minMonths).length;
      raw = Math.min(avg / optimalMonths * 100, 100) * (1 - shortRoles * discount);
    }
    trace.avg_months = history.length > 0 ? history.reduce((a, r) => a + r.months, 0) / history.length : 0;
  }

  // ── composite ─────────────────────────────────────────────────────────────────
  else if (type === 'composite') {
    // Average of named sources (we use the already-computed values if available)
    // For now, use capadex_score as proxy for curiosity/openness
    const sources = cfg.sources as string[] ?? [];
    const weights = cfg.weights as number[] ?? sources.map(() => 1 / sources.length);
    let composite = 0;
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const w = weights[i] ?? (1 / sources.length);
      let val = 0;
      if (src === 'recent_certifications') {
        const recentCount = (p.certifications ?? []).filter(c => {
          if (!c.earned_date) return false;
          const ageYears = (Date.now() - new Date(c.earned_date).getTime()) / (1000 * 60 * 60 * 24 * 365);
          return ageYears <= 3;
        }).length;
        val = Math.min(recentCount * 33.3, 100);
      } else if (src === 'capadex_curiosity' || src === 'capadex_score') {
        val = p.capadexScore ?? 0;
      } else if (src === 'collaboration_keywords') {
        const text = p.softSkillsText ?? (p.softSkills ?? []).join(' ');
        val = matchVocab(text, COLLABORATION_VOCAB, 4) * 25;
      } else if (src === 'endorsement_count') {
        val = Math.min((p.endorsementCount ?? 0) * 20, 100);
      }
      composite += val * w;
    }
    raw = Math.min(composite, comp.max_raw);
  }

  // ── text_quality ─────────────────────────────────────────────────────────────
  else if (type === 'text_quality') {
    const minH = (cfg.min_length_headline as number) ?? 20;
    const minS = (cfg.min_length_summary as number) ?? 100;
    const hScore = (p.headline ?? '').length >= minH ? 50 : ((p.headline ?? '').length / minH) * 50;
    const sScore = (p.summary ?? '').length >= minS ? 50 : ((p.summary ?? '').length / minS) * 50;
    raw = hScore + sScore;
    trace.headline_len = (p.headline ?? '').length; trace.summary_len = (p.summary ?? '').length;
  }

  // ── ratio ─────────────────────────────────────────────────────────────────────
  else if (type === 'ratio') {
    const totalYears = (p.totalMonths ?? 0) / 12;
    const targetYears = totalYears * ((p.targetIndustryYearsPct ?? 0) / 100);
    raw = totalYears > 0 ? Math.min(targetYears / totalYears * (cfg.scale as number ?? 100), 100) : 0;
    trace.target_years = targetYears; trace.total_years = totalYears;
  }

  return { raw: Math.min(Math.max(raw, 0), comp.max_raw), trace, gate_met };
}

// ── Main Scorer ───────────────────────────────────────────────────────────────

export async function computeMEIScore(
  pool: Pool,
  profile: MEIProfileInput,
  opts: { skipCalibration?: boolean } = {}
): Promise<MEIScoreOutput> {
  const { dims, sds, comps } = await loadTaxonomy(pool);

  // Load calibration multipliers
  const calRows = opts.skipCalibration ? [] : await loadCalibration(pool, profile.industryCode ?? null, profile.roleLevelCode ?? null);
  const multiplierByDim: Record<number, number> = {};
  for (const row of calRows) multiplierByDim[row.dimension_id] = row.multiplier;

  // Compute calibrated + renormalised weights
  const rawWeights: Record<string, number> = {};
  const calWeightsRaw: Record<string, number> = {};
  for (const dim of dims) {
    rawWeights[dim.code] = dim.base_weight;
    calWeightsRaw[dim.code] = dim.base_weight * (multiplierByDim[dim.id] ?? 1.0);
  }
  const calSum = Object.values(calWeightsRaw).reduce((a, b) => a + b, 0);
  const calWeights: Record<string, number> = {};
  for (const dim of dims) calWeights[dim.code] = calWeightsRaw[dim.code] / calSum;

  // Score each dimension
  let totalConfidenceNumerator = 0;
  let totalConfidenceDenominator = 0;
  const dataSources = new Set<string>();
  const dimensionScores: DimensionScore[] = [];

  for (const dim of dims) {
    const dimSDs = sds.filter(sd => sd.dimension_id === dim.id);
    const sdScores: SubdimensionScore[] = [];

    for (const sd of dimSDs) {
      const sdComps = comps.filter(c => c.subdimension_id === sd.id);
      const compScores: CompetencyScore[] = [];
      let sdWeightedSum = 0;
      let sdWeightTotal = 0;

      for (const comp of sdComps) {
        const { raw, trace, gate_met } = scoreCompetency(comp, profile);
        const norm = comp.max_raw > 0 ? raw / comp.max_raw : 0;
        compScores.push({
          competency_id: comp.id, code: comp.code, name: comp.name,
          raw_score: raw, norm_score: norm,
          max_raw: comp.max_raw, is_gated: comp.is_gated, gate_met,
          weight: comp.within_sd_weight, trace,
        });
        sdWeightedSum += norm * comp.within_sd_weight;
        sdWeightTotal += comp.within_sd_weight;

        // Confidence: gated unfulfilled = low confidence, otherwise high
        totalConfidenceDenominator += comp.within_sd_weight * sd.within_dim_weight;
        if (!comp.is_gated || gate_met) {
          totalConfidenceNumerator += comp.within_sd_weight * sd.within_dim_weight;
        }

        // Data sources
        if (comp.data_field) dataSources.add(comp.data_field);
      }

      const sdScore = sdWeightTotal > 0 ? sdWeightedSum / sdWeightTotal : 0;
      sdScores.push({
        subdimension_id: sd.id, code: sd.code, name: sd.name,
        score: Math.min(Math.max(sdScore, 0), 1),
        weighted_score: sdScore * sd.within_dim_weight,
        within_dim_weight: sd.within_dim_weight,
        competencies: compScores,
      });
    }

    // Dimension score = weighted average of subdimension scores
    const dimWeightSum = sdScores.reduce((a, s) => a + s.within_dim_weight, 0);
    const dimScore = dimWeightSum > 0
      ? sdScores.reduce((a, s) => a + s.score * s.within_dim_weight, 0) / dimWeightSum
      : 0;
    const calW = calWeights[dim.code] ?? dim.base_weight;
    const contribution = dimScore * calW * 100;

    dimensionScores.push({
      dimension_id: dim.id, code: dim.code, name: dim.name,
      base_weight: dim.base_weight, cal_weight: calW,
      score: Math.min(Math.max(dimScore, 0), 1),
      contribution: Math.min(contribution, dim.max_points),
      max_points: dim.max_points,
      subdimensions: sdScores,
    });
  }

  // Composite
  const composite = dimensionScores.reduce((a, d) => a + d.contribution, 0);
  const capped = Math.min(Math.round(composite * 10) / 10, 99);
  const confidence = totalConfidenceDenominator > 0
    ? totalConfidenceNumerator / totalConfidenceDenominator
    : 1.0;

  const band: MEIScoreOutput['band'] =
    capped >= 75 ? 'hire_ready' :
    capped >= 50 ? 'career_ready' :
    capped >= 25 ? 'building' : 'getting_started';

  return {
    composite_score: capped,
    band,
    confidence: Math.min(Math.max(confidence, 0), 1),
    industry_code:  profile.industryCode ?? null,
    role_level_code: profile.roleLevelCode ?? null,
    dimensions: dimensionScores,
    calibration_trace: {
      raw_weights: rawWeights,
      cal_weights: calWeights,
      sum_check: Object.values(calWeights).reduce((a, b) => a + b, 0),
    },
    data_sources: [...dataSources],
    version: '2.0',
  };
}

// ── Profile Mapper (from CareerProfile shape) ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProfileToMEIInput(cp: Record<string, any>, opts: {
  industryCode?: string | null;
  roleLevelCode?: string | null;
} = {}): MEIProfileInput {
  const education = cp.education ?? [];
  const experience = cp.experience ?? [];
  const certifications = cp.certifications ?? [];
  const skills = cp.skills ?? {};
  const projects = cp.projects ?? [];

  // Degree + institution detection (classifiers imported at top of file)
  const bestEdu = education.reduce((best: Record<string, unknown> | null, e: Record<string, unknown>) => {
    const dm = (classifyDegreeLevel((e.degree as string) ?? '') as { mult: number }).mult;
    const bm = best ? (classifyDegreeLevel((best.degree as string) ?? '') as { mult: number }).mult : 0;
    return dm > bm ? e : best;
  }, null);
  const bestDegree = bestEdu ? (classifyDegreeLevel(bestEdu.degree as string ?? '') as { level: string }).level : 'other';
  const bestTier = bestEdu ? `tier${(classifyInstitutionTier(bestEdu.institution as string ?? '') as { tier: number }).tier}` : 'unknown';

  // Experience
  const totalMonths = experience.reduce((a: number, e: Record<string, unknown>) => a + ((e.months as number) ?? 0), 0);
  const industries = [...new Set(experience.map((e: Record<string, unknown>) => e.industry as string).filter(Boolean))] as string[];

  return {
    // Assessments — typically passed in separately
    assessmentScore:      cp.assessmentScore,
    assessmentTaken:      !!(cp.assessmentScore),
    capadexScore:         cp.capadexScore,
    capadexTaken:         !!(cp.capadexScore),
    csiScore:             cp.csiScore,
    sessionCount:         cp.sessionCount,

    // Skills
    technicalSkills:      skills.technical ?? [],
    softSkills:           skills.soft ?? [],
    tools:                skills.tools ?? [],
    skillsText:           [...(skills.technical ?? []), ...(skills.tools ?? [])].join(' '),
    softSkillsText:       (skills.soft ?? []).join(' '),
    skillUpdatedAt:       cp.skillUpdatedAt,

    // Experience
    totalMonths,
    peakSeniority:        cp.peakSeniority ?? 'associate',
    roleHistory:          experience.map((e: Record<string, unknown>) => ({
      title: e.title as string ?? '', months: e.months as number ?? 0,
      company: e.company as string, industry: e.industry as string, seniority: e.seniority as string,
    })),
    uniqueIndustries:     industries,
    targetIndustry:       cp.targetIndustry,
    targetIndustryYearsPct: cp.targetIndustryYearsPct,

    // Education
    highestDegree:        bestDegree,
    bestInstitutionTier:  bestTier,
    fieldAlignment:       cp.fieldAlignment ?? 'adjacent',
    programmeAccredited:  cp.programmeAccredited,
    multiField:           education.length >= 2,
    hasPostgrad:          ['phd','masters'].includes(bestDegree),
    postgradField:        bestEdu?.field as string,

    // Certifications
    certifications:       certifications.map((c: Record<string, unknown>) => ({
      name: c.name as string, tier: (c.tier as 'top' | 'mid' | 'generic') ?? 'generic',
      verified: c.verified as boolean, earned_date: c.earned_date as string,
    })),
    courses:              cp.courseCount ?? 0,

    // Portfolio
    projectCount:         projects.length,
    publicationCount:     cp.publicationCount ?? 0,
    hasGithub:            !!(cp.githubUrl || cp.portfolioUrl),
    recommendationCount:  cp.recommendationCount ?? 0,
    endorsementCount:     cp.endorsementCount ?? 0,
    awardCount:           cp.awardCount ?? 0,
    profileLinks:         [cp.linkedinUrl, cp.githubUrl, cp.portfolioUrl].filter(Boolean),

    // Profile
    profileFillPct:       cp.profileCompleteness ?? cp.profileFillPct ?? 0,
    headline:             cp.headline ?? cp.currentTitle ?? '',
    summary:              cp.summary ?? cp.bio ?? '',

    // Calibration
    industryCode:         opts.industryCode,
    roleLevelCode:        opts.roleLevelCode,
  };
}
