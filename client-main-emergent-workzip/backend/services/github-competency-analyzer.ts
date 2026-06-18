/**
 * GitHub Competency Analyzer — analyses a GitHub-shaped JSON payload
 * (user + repos array) deterministically. No external API calls; the
 * caller is expected to fetch raw data and pass it in.
 */
export const GITHUB_ANALYZER_VERSION = '5.0.0';

export type GithubRepo = {
  name: string;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  size?: number;
  open_issues_count?: number;
  topics?: string[];
};

export type GithubPayload = {
  login?: string;
  public_repos?: number;
  followers?: number;
  repos?: GithubRepo[];
};

export type GithubAnalysis = {
  repo_count: number;
  primary_languages: Array<{ language: string; count: number }>;
  complexity_score: number;       // 0..100
  collaboration_score: number;    // 0..100
  architecture_maturity: number;  // 0..100
  language_depth: number;         // 0..100
  engineering_patterns: string[];
};

export function analyzeGithubPayload(p: GithubPayload): GithubAnalysis {
  const repos = Array.isArray(p.repos) ? p.repos : [];
  const repoCount = repos.length;

  // Language histogram
  const lang: Record<string, number> = {};
  for (const r of repos) {
    if (!r?.language) continue;
    lang[r.language] = (lang[r.language] ?? 0) + 1;
  }
  const primaryLanguages = Object.entries(lang)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);

  // Aggregates
  const totalStars = repos.reduce((s, r) => s + (r.stargazers_count ?? 0), 0);
  const totalForks = repos.reduce((s, r) => s + (r.forks_count ?? 0), 0);
  const totalSize  = repos.reduce((s, r) => s + (r.size ?? 0), 0);
  const totalIssues = repos.reduce((s, r) => s + (r.open_issues_count ?? 0), 0);

  // Heuristic scoring (capped 0..100)
  const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const complexity      = cap(10 * Math.log2(1 + totalSize / 100) + repoCount * 1.5);
  const collaboration   = cap(8  * Math.log2(1 + totalForks) + 4 * Math.log2(1 + (p.followers ?? 0)));
  const architecture    = cap(5  * Math.log2(1 + totalStars) + primaryLanguages.length * 6);
  const languageDepth   = cap(primaryLanguages.length * 14 + (primaryLanguages[0]?.count ?? 0) * 4);

  const patterns: string[] = [];
  if (primaryLanguages.length >= 3) patterns.push('polyglot');
  if (totalForks > 5)               patterns.push('community_engaged');
  if (totalIssues > 10)             patterns.push('open_source_maintainer');
  if (totalStars > 50)              patterns.push('recognised_contributor');
  if (repoCount > 20)               patterns.push('prolific');

  return {
    repo_count: repoCount, primary_languages: primaryLanguages,
    complexity_score: complexity, collaboration_score: collaboration,
    architecture_maturity: architecture, language_depth: languageDepth,
    engineering_patterns: patterns,
  };
}

export function githubToCompetencyLevels(a: GithubAnalysis): Record<string, { level: number; evidence: string[] }> {
  const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    TEC: { level: cap(a.language_depth * 0.5 + a.complexity_score * 0.5), evidence: a.primary_languages.slice(0, 3).map((l) => `lang:${l.language}`) },
    COG: { level: cap(a.architecture_maturity * 0.7 + a.complexity_score * 0.3), evidence: [`maturity:${a.architecture_maturity}`] },
    EXE: { level: cap(a.complexity_score * 0.6 + a.repo_count * 1.5), evidence: [`repos:${a.repo_count}`] },
    COM: { level: cap(a.collaboration_score), evidence: a.engineering_patterns.slice(0, 3).map((p) => `pattern:${p}`) },
    ADP: { level: cap(a.language_depth * 0.6 + (a.engineering_patterns.includes('polyglot') ? 20 : 0)), evidence: a.engineering_patterns.includes('polyglot') ? ['polyglot'] : [] },
    LEA: { level: cap((a.engineering_patterns.includes('open_source_maintainer') ? 35 : 15) + a.collaboration_score * 0.4), evidence: [] },
    EIQ: { level: cap(25 + a.collaboration_score * 0.4), evidence: ['collab_proxy'] },
  };
}
