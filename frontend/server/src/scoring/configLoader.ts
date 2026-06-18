/**
 * Dynamic Scoring Config Loader
 * Loads scoring parameters, norms, and domain weights from the database.
 * Caches config in memory with a 5-minute TTL to avoid hitting DB on every score request.
 */

import { db } from '../db/drizzle.js';
import { scoringFormulaParams, scoringAgeBandNorms, scoringDomainConfig } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';

interface ScoringParam {
  module_code: string;
  param_key: string;
  value: string;
  editable: boolean;
}

interface AgeBandNorm {
  band: string;
  p20: number;
  p40: number;
  p60: number;
  p80: number;
}

interface DomainConfig {
  domain: string;
  subdomain: string;
  module_code: string;
  weight_percent: number;
  status: string;
}

interface ScoringConfig {
  params: Record<string, Record<string, number>>;  // { LES: { mmi_items: 7, ... }, ATT: { ... } }
  norms: Record<string, AgeBandNorm>;               // { A: { p20:28, ... }, B: { ... } }
  domainWeights: DomainConfig[];
  raw: { params: ScoringParam[]; norms: AgeBandNorm[]; domains: DomainConfig[] };
}

let cachedConfig: ScoringConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function loadScoringConfig(): Promise<ScoringConfig> {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const [paramsRows, normsRows, domainsRows] = await Promise.all([
    db.select({
      module_code: scoringFormulaParams.moduleCode,
      param_key: scoringFormulaParams.paramKey,
      value: scoringFormulaParams.value,
      editable: scoringFormulaParams.editable,
    }).from(scoringFormulaParams).orderBy(asc(scoringFormulaParams.moduleCode), asc(scoringFormulaParams.id)),
    db.select({
      band: scoringAgeBandNorms.band,
      p20: scoringAgeBandNorms.p20,
      p40: scoringAgeBandNorms.p40,
      p60: scoringAgeBandNorms.p60,
      p80: scoringAgeBandNorms.p80,
    }).from(scoringAgeBandNorms).orderBy(asc(scoringAgeBandNorms.id)),
    db.select({
      domain: scoringDomainConfig.domain,
      subdomain: scoringDomainConfig.subdomain,
      module_code: scoringDomainConfig.moduleCode,
      weight_percent: scoringDomainConfig.weightPercent,
      status: scoringDomainConfig.status,
    }).from(scoringDomainConfig)
      .where(eq(scoringDomainConfig.status, 'Active'))
      .orderBy(asc(scoringDomainConfig.sortOrder)),
  ]);

  // Group params by module
  const params: Record<string, Record<string, number>> = {};
  for (const p of paramsRows as ScoringParam[]) {
    if (!params[p.module_code]) params[p.module_code] = {};
    params[p.module_code][p.param_key] = parseFloat(p.value) || 0;
  }

  // Index norms by band
  const norms: Record<string, AgeBandNorm> = {};
  for (const n of normsRows as any[]) {
    norms[n.band] = { band: n.band, p20: Number(n.p20), p40: Number(n.p40), p60: Number(n.p60), p80: Number(n.p80) };
  }

  cachedConfig = {
    params,
    norms,
    domainWeights: domainsRows as DomainConfig[],
    raw: {
      params: paramsRows as ScoringParam[],
      norms: normsRows as any[],
      domains: domainsRows as DomainConfig[],
    },
  };
  cacheTimestamp = now;

  return cachedConfig;
}

/** Get a single module's params with defaults */
export async function getModuleParams(moduleCode: string): Promise<Record<string, number>> {
  const config = await loadScoringConfig();
  return config.params[moduleCode] || {};
}

/** Get norm cutoffs for a specific age band */
export async function getNormForBand(band: string): Promise<AgeBandNorm | null> {
  const config = await loadScoringConfig();
  return config.norms[band] || null;
}

/** Classify a raw score into a performance tier using age-band norms */
export async function classifyScore(rawPercent: number, band: string): Promise<string> {
  const norm = await getNormForBand(band);
  if (!norm) return 'Unknown';
  if (rawPercent >= norm.p80) return 'Excellent';
  if (rawPercent >= norm.p60) return 'Proficient';
  if (rawPercent >= norm.p40) return 'Emerging';
  if (rawPercent >= norm.p20) return 'Developing';
  return 'Needs Support';
}

/** Invalidate the cache (call after config update) */
export function invalidateScoringConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}
