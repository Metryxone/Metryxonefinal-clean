/**
 * Resume Signal Engine — deterministic keyword/regex extraction.
 * No LLM calls; pure-function transformation of resume text → signals.
 */
export const RESUME_SIGNAL_VERSION = '5.0.0';

export type ResumeSignals = {
  technical_keywords: string[];
  leadership_verbs: string[];
  execution_indicators: string[];
  project_complexity_score: number;     // 0..100
  industry_exposure: string[];
  years_experience: number | null;
  team_size_hint: number | null;
};

const TECH_KEYWORDS = [
  'python','typescript','javascript','java','go','rust','c++','c#','kubernetes','docker','aws','gcp','azure',
  'react','vue','angular','node','postgres','mongodb','redis','kafka','spark','airflow','tensorflow','pytorch',
  'graphql','grpc','terraform','ansible','jenkins','ci/cd','microservices','distributed systems','machine learning',
];
const LEADERSHIP_VERBS = ['led','managed','mentored','coached','directed','spearheaded','owned','drove','built team','hired','headed'];
const EXEC_VERBS = ['shipped','delivered','launched','migrated','reduced','optimized','automated','scaled','implemented','deployed'];
const INDUSTRIES = ['fintech','healthtech','edtech','saas','ecommerce','retail','manufacturing','telecom','gaming','media','government','consulting'];

function countMatches(haystack: string, needles: string[]): string[] {
  const found = new Set<string>();
  for (const n of needles) if (haystack.includes(n)) found.add(n);
  return [...found];
}

export function extractResumeSignals(rawText: string): ResumeSignals {
  const text = (rawText ?? '').toLowerCase();
  const tech = countMatches(text, TECH_KEYWORDS);
  const lead = countMatches(text, LEADERSHIP_VERBS);
  const exec = countMatches(text, EXEC_VERBS);
  const industries = countMatches(text, INDUSTRIES);

  // Years of experience — first "N years" or "N+ years" mention
  const yearsMatch = text.match(/(\d{1,2})\+?\s*(?:years|yrs)\b/);
  const years = yearsMatch ? Math.min(40, parseInt(yearsMatch[1], 10)) : null;

  // Team size hint — "team of N" or "managed N"
  const teamMatch = text.match(/(?:team of|managed|led)\s+(\d{1,3})\b/);
  const teamSize = teamMatch ? Math.min(500, parseInt(teamMatch[1], 10)) : null;

  // Complexity heuristic — log-scaled signal density
  const density = tech.length * 2 + exec.length * 1.5 + lead.length + industries.length;
  const complexity = Math.max(0, Math.min(100, Math.round(15 * Math.log2(1 + density))));

  return {
    technical_keywords: tech, leadership_verbs: lead, execution_indicators: exec,
    project_complexity_score: complexity, industry_exposure: industries,
    years_experience: years, team_size_hint: teamSize,
  };
}

/** Map resume signals to canonical 7-domain competency levels (0..100). */
export function signalsToCompetencyLevels(s: ResumeSignals): Record<string, { level: number; evidence: string[] }> {
  const lvl = (n: number) => Math.max(0, Math.min(100, n));
  const evTech = s.technical_keywords.slice(0, 6).map((k) => `keyword:${k}`);
  const evLead = s.leadership_verbs.slice(0, 4).map((k) => `verb:${k}`);
  const evExec = s.execution_indicators.slice(0, 4).map((k) => `verb:${k}`);
  return {
    TEC: { level: lvl(s.technical_keywords.length * 6 + s.project_complexity_score * 0.3), evidence: evTech },
    LEA: { level: lvl(s.leadership_verbs.length * 12 + (s.team_size_hint ?? 0) * 0.3), evidence: evLead },
    EXE: { level: lvl(s.execution_indicators.length * 10 + s.project_complexity_score * 0.2), evidence: evExec },
    COG: { level: lvl(s.project_complexity_score * 0.7 + s.industry_exposure.length * 5), evidence: [`complexity:${s.project_complexity_score}`] },
    ADP: { level: lvl(s.industry_exposure.length * 12 + (s.years_experience ?? 0) * 1.5), evidence: s.industry_exposure.slice(0, 4).map((i) => `industry:${i}`) },
    COM: { level: lvl(40 + s.leadership_verbs.length * 5 + s.execution_indicators.length * 2), evidence: ['baseline'] },
    EIQ: { level: lvl(35 + s.leadership_verbs.length * 6), evidence: ['leadership_proxy'] },
  };
}
