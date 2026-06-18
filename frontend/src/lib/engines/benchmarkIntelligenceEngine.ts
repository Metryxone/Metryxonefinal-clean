/**
 * Benchmark Intelligence Engine
 * Provides peer, geography, salary, percentile, industry, and experience benchmarking.
 */

import type { CareerProfile } from '@/lib/careerIntelligence';
import { COMPETENCY_DOMAINS } from '@/data/marketCatalog';
import { FUTURE_COMPETENCY_MAP } from '@/lib/competency-genome/futureMapping';

export interface BenchmarkIntelligenceInput {
  profile:      CareerProfile | null | undefined;
  eiScore:      number;
  competencyLevels?: Record<string, number>;
  industry?:    string;
  city?:        string;
}

/* ── Normative benchmarks by career stage ─────────────────────────────── */
const PEER_NORMS: Record<string, { avgEI: number; p25: number; p50: number; p75: number; p90: number }> = {
  student:   { avgEI: 22, p25: 12, p50: 22, p75: 33, p90: 44 },
  early:     { avgEI: 38, p25: 26, p50: 38, p75: 52, p90: 64 },
  mid:       { avgEI: 54, p25: 40, p50: 54, p75: 68, p90: 78 },
  senior:    { avgEI: 67, p25: 52, p50: 67, p75: 78, p90: 86 },
  lead:      { avgEI: 76, p25: 62, p50: 76, p75: 86, p90: 92 },
  executive: { avgEI: 84, p25: 72, p50: 84, p75: 92, p90: 96 },
};

/* ── Geography salary multipliers (India) ─────────────────────────────── */
const GEO_MULTIPLIERS: Record<string, { label: string; salaryMult: number; demandIndex: number }> = {
  bangalore:  { label: 'Bangalore', salaryMult: 1.30, demandIndex: 95 },
  mumbai:     { label: 'Mumbai',    salaryMult: 1.25, demandIndex: 90 },
  delhi:      { label: 'Delhi NCR', salaryMult: 1.20, demandIndex: 88 },
  hyderabad:  { label: 'Hyderabad', salaryMult: 1.18, demandIndex: 85 },
  pune:       { label: 'Pune',      salaryMult: 1.12, demandIndex: 82 },
  chennai:    { label: 'Chennai',   salaryMult: 1.10, demandIndex: 80 },
  kolkata:    { label: 'Kolkata',   salaryMult: 0.92, demandIndex: 68 },
  tier2:      { label: 'Tier 2 City',salaryMult: 0.78, demandIndex: 58 },
  tier3:      { label: 'Tier 3 City',salaryMult: 0.62, demandIndex: 44 },
};

/* ── Industry EI norms ────────────────────────────────────────────────── */
const INDUSTRY_NORMS: Record<string, { avgEI: number; topQuartileEI: number; label: string }> = {
  tech:          { avgEI: 58, topQuartileEI: 74, label: 'Technology'        },
  finance:       { avgEI: 54, topQuartileEI: 70, label: 'Finance & Banking' },
  consulting:    { avgEI: 62, topQuartileEI: 78, label: 'Consulting'        },
  healthcare:    { avgEI: 46, topQuartileEI: 62, label: 'Healthcare'        },
  ecommerce:     { avgEI: 52, topQuartileEI: 68, label: 'E-commerce'        },
  manufacturing: { avgEI: 40, topQuartileEI: 56, label: 'Manufacturing'     },
  media:         { avgEI: 44, topQuartileEI: 60, label: 'Media & Creative'  },
  startup:       { avgEI: 55, topQuartileEI: 72, label: 'Startup Ecosystem' },
  government:    { avgEI: 36, topQuartileEI: 50, label: 'Government / PSU'  },
};

/* ── Salary ranges by EI band (₹ LPA) ───────────────────────────────── */
function salaryRange(eiScore: number, expYears: number): { p25: number; p50: number; p75: number; unit: string } {
  const expMult = Math.min(2.5, 1 + expYears * 0.12);
  const base    = eiScore >= 80 ? 28 : eiScore >= 65 ? 20 : eiScore >= 50 ? 13 : eiScore >= 35 ? 8 : 4;
  return {
    p25: Math.round(base * 0.70 * expMult * 10) / 10,
    p50: Math.round(base         * expMult * 10) / 10,
    p75: Math.round(base * 1.35 * expMult * 10) / 10,
    unit: 'LPA',
  };
}

/* ── Output interfaces ───────────────────────────────────────────────── */
export interface PeerBenchmark {
  stage:          string;
  userEI:         number;
  peerAvgEI:      number;
  percentile:     number;
  delta:          number;
  interpretation: string;
  peerCount:      number;
}

export interface GeoBenchmark {
  city:           string;
  salaryMult:     number;
  demandIndex:    number;
  adjustedSalary: { p25: number; p50: number; p75: number; unit: string };
  relativeRank:   'premium' | 'average' | 'below-average';
}

export interface SalaryCompetitiveness {
  estimatedRange:     { p25: number; p50: number; p75: number; unit: string };
  competitivenessScore:number;
  vsIndustryP50:      number;
  interpretation:     string;
  topSkillsForSalary: string[];
}

export interface PercentileRanking {
  overall:        number;
  byDomain:       { domain: string; percentile: number; userLevel: number; benchmarkLevel: number }[];
  topQuartile:    boolean;
  rank:           string;
}

export interface IndustryBenchmark {
  industry:       string;
  userEI:         number;
  industryAvgEI:  number;
  industryTopEI:  number;
  delta:          number;
  standing:       'top' | 'above-avg' | 'avg' | 'below-avg';
}

export interface ExperienceBenchmark {
  expYears:       number;
  expectedEI:     number;
  actualEI:       number;
  delta:          number;
  interpretation: string;
  accelerated:    boolean;
}

export interface BenchmarkIntelligenceOutput {
  peer:       PeerBenchmark;
  geo:        GeoBenchmark;
  salary:     SalaryCompetitiveness;
  percentile: PercentileRanking;
  industry:   IndustryBenchmark;
  experience: ExperienceBenchmark;
  summary:    string;
}

function detectStage(profile: CareerProfile | null | undefined): string {
  const exps      = profile?.experience ?? [];
  const totalYrs  = exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const roleCount = exps.length;
  const title     = ((exps.find((e: Record<string,unknown>) => e?.current) ?? exps[0])?.title ?? '').toLowerCase();

  if (roleCount === 0 || totalYrs < 1)   return 'student';
  if (totalYrs < 3)                      return 'early';
  if (totalYrs < 6)                      return 'mid';
  if (/director|vp|head|principal|staff/.test(title)) return 'executive';
  if (/lead|manager|architect|sr\.|senior/.test(title)) return 'lead';
  if (totalYrs < 10)                     return 'senior';
  return 'lead';
}

function percentileFor(value: number, norms: { p25: number; p50: number; p75: number; p90: number }): number {
  if (value >= norms.p90) return 92;
  if (value >= norms.p75) return 78;
  if (value >= norms.p50) return 58;
  if (value >= norms.p25) return 32;
  return 14;
}

export function runBenchmarkIntelligenceEngine(input: BenchmarkIntelligenceInput): BenchmarkIntelligenceOutput {
  const p          = input.profile;
  const eiScore    = input.eiScore;
  const exps       = p?.experience ?? [];
  const expYears   = exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const stage      = detectStage(p);
  const norms      = PEER_NORMS[stage] ?? PEER_NORMS.mid;
  const industryKey= (input.industry ?? 'tech').toLowerCase();
  const cityKey    = (input.city ?? 'bangalore').toLowerCase();
  const levels     = input.competencyLevels ?? {};

  /* Peer benchmark */
  const peerPct    = percentileFor(eiScore, norms);
  const peer: PeerBenchmark = {
    stage, userEI: eiScore, peerAvgEI: norms.avgEI,
    percentile: peerPct,
    delta: eiScore - norms.avgEI,
    interpretation: peerPct >= 75
      ? `Top ${100 - peerPct}% among ${stage}-stage professionals`
      : peerPct >= 50
        ? 'Above average for your career stage'
        : 'Below average — significant catch-up opportunity',
    peerCount: stage === 'student' ? 15000 : stage === 'early' ? 42000 : 28000,
  };

  /* Geo benchmark */
  const geo_data   = GEO_MULTIPLIERS[cityKey] ?? GEO_MULTIPLIERS.tier2;
  const baseSalary = salaryRange(eiScore, expYears);
  const geo: GeoBenchmark = {
    city: geo_data.label,
    salaryMult: geo_data.salaryMult,
    demandIndex: geo_data.demandIndex,
    adjustedSalary: {
      p25: Math.round(baseSalary.p25 * geo_data.salaryMult * 10) / 10,
      p50: Math.round(baseSalary.p50 * geo_data.salaryMult * 10) / 10,
      p75: Math.round(baseSalary.p75 * geo_data.salaryMult * 10) / 10,
      unit: 'LPA',
    },
    relativeRank: geo_data.salaryMult >= 1.18 ? 'premium' : geo_data.salaryMult >= 0.95 ? 'average' : 'below-average',
  };

  /* Salary competitiveness */
  const indNorm    = INDUSTRY_NORMS[industryKey] ?? INDUSTRY_NORMS.tech;
  const futureSig  = FUTURE_COMPETENCY_MAP.filter(f => f.salaryPremium1Yr >= 20 && (levels[f.competencyId] ?? 0) >= 3);
  const compScore  = Math.round(Math.min(100, (eiScore / Math.max(1, indNorm.avgEI)) * 80 + futureSig.length * 5));
  const salary: SalaryCompetitiveness = {
    estimatedRange: geo.adjustedSalary,
    competitivenessScore: compScore,
    vsIndustryP50: Math.round(baseSalary.p50 - indNorm.avgEI * 0.3),
    interpretation: compScore >= 75
      ? 'Your profile commands a premium salary in this industry'
      : compScore >= 50
        ? 'Competitive salary profile — targeted skill additions would unlock the next band'
        : 'Below market competitiveness — focus on high-premium skills',
    topSkillsForSalary: futureSig.slice(0, 3).map(f => f.competencyId),
  };

  /* Percentile ranking */
  const domainPercentiles = COMPETENCY_DOMAINS.map(d => {
    const userLvl    = levels[d.id] ?? 0;
    const benchmarkLvl = d.domain === 'technical' ? 2.8 : d.domain === 'leadership' ? 2.2 : 2.5;
    const pct        = userLvl >= 4 ? 85 : userLvl >= 3 ? 70 : userLvl >= 2 ? 50 : userLvl >= 1 ? 30 : 10;
    return { domain: d.label, percentile: pct, userLevel: userLvl, benchmarkLevel: benchmarkLvl };
  });
  const overallPct = Math.round(domainPercentiles.reduce((s, d) => s + d.percentile, 0) / domainPercentiles.length);
  const percentile: PercentileRanking = {
    overall: Math.min(99, overallPct),
    byDomain: domainPercentiles,
    topQuartile: overallPct >= 75,
    rank: overallPct >= 90 ? 'Elite' : overallPct >= 75 ? 'Top 25%' : overallPct >= 50 ? 'Above Average' : overallPct >= 25 ? 'Average' : 'Below Average',
  };

  /* Industry benchmark */
  const indStanding: IndustryBenchmark['standing'] =
    eiScore >= indNorm.topQuartileEI ? 'top' : eiScore >= indNorm.avgEI + 8 ? 'above-avg' : eiScore >= indNorm.avgEI - 8 ? 'avg' : 'below-avg';
  const industry: IndustryBenchmark = {
    industry: indNorm.label, userEI: eiScore,
    industryAvgEI: indNorm.avgEI, industryTopEI: indNorm.topQuartileEI,
    delta: eiScore - indNorm.avgEI, standing: indStanding,
  };

  /* Experience benchmark */
  const expectedEI = Math.min(82, 20 + expYears * 7);
  const expBench: ExperienceBenchmark = {
    expYears, expectedEI, actualEI: eiScore,
    delta: eiScore - expectedEI,
    interpretation: eiScore >= expectedEI + 10
      ? 'Ahead of the curve — outperforming experience expectations'
      : eiScore >= expectedEI - 5
        ? 'Tracking well with your experience cohort'
        : 'Profile development lagging behind years of experience — close the gap',
    accelerated: eiScore >= expectedEI + 10,
  };

  /* Summary */
  const summary = `${peer.percentile}th percentile among ${stage}-stage professionals · `
    + `${industry.standing} in ${indNorm.label} industry · `
    + `Est. ₹${geo.adjustedSalary.p50} LPA in ${geo_data.label}`;

  return { peer, geo, salary, percentile, industry, experience: expBench, summary };
}
