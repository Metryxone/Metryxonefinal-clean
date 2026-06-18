/**
 * LinkedIn Intelligence Engine — analyses a LinkedIn-shaped profile JSON
 * (positions + skills) deterministically. Caller supplies the payload.
 */
export const LINKEDIN_INTEL_VERSION = '5.0.0';

export type LinkedinPosition = {
  title: string;
  company?: string;
  start?: string;        // ISO date or 'YYYY-MM'
  end?: string | null;   // null = current
  industry?: string;
  description?: string;
};

export type LinkedinPayload = {
  name?: string;
  headline?: string;
  positions?: LinkedinPosition[];
  skills?: string[];
};

export type LinkedinAnalysis = {
  position_count: number;
  total_years: number;
  leadership_years: number;
  progression_score: number;       // 0..100
  skill_count: number;
  career_trajectory: 'ascending' | 'lateral' | 'mixed' | 'insufficient_data';
  leadership_indicators: string[];
};

const LEAD_TITLE_PATTERNS = [/manager/i, /director/i, /head\b/i, /lead\b/i, /chief/i, /vp\b/i, /vice president/i, /principal/i, /founder/i, /cto/i, /ceo/i];

function parseDate(d?: string | null): Date | null {
  if (!d) return null;
  // Accept YYYY-MM or YYYY
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(d);
  if (m) return new Date(Date.UTC(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) - 1 : 0, m[3] ? parseInt(m[3], 10) : 1));
  const t = Date.parse(d); return Number.isFinite(t) ? new Date(t) : null;
}

function yearsBetween(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  return Math.max(0, (b.getTime() - a.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function isLeadershipTitle(t: string): boolean {
  return LEAD_TITLE_PATTERNS.some((re) => re.test(t));
}

export function analyzeLinkedinPayload(p: LinkedinPayload): LinkedinAnalysis {
  const positions = Array.isArray(p.positions) ? p.positions.slice() : [];
  // Sort by start date ascending for progression analysis
  positions.sort((a, b) => (parseDate(a.start)?.getTime() ?? 0) - (parseDate(b.start)?.getTime() ?? 0));

  const now = new Date();
  let totalYears = 0;
  let leadYears = 0;
  const leadershipIndicators: string[] = [];
  let leadershipSeen = false;
  let ascendingCount = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const s = parseDate(pos.start); const e = pos.end == null ? now : parseDate(pos.end);
    const years = yearsBetween(s, e);
    totalYears += years;
    if (isLeadershipTitle(pos.title ?? '')) {
      leadYears += years;
      leadershipIndicators.push(`title:${pos.title}`);
      if (!leadershipSeen) leadershipSeen = true;
      if (i > 0 && !isLeadershipTitle(positions[i - 1].title ?? '')) ascendingCount++;
    }
  }

  const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const progression =
    positions.length < 2 ? 30 :
    cap(40 + ascendingCount * 15 + (leadershipSeen ? 15 : 0) + Math.min(20, totalYears));
  const trajectory: LinkedinAnalysis['career_trajectory'] =
    positions.length < 2 ? 'insufficient_data' :
    ascendingCount >= 2 ? 'ascending' :
    ascendingCount === 1 ? 'mixed' : 'lateral';

  return {
    position_count: positions.length,
    total_years: Math.round(totalYears * 10) / 10,
    leadership_years: Math.round(leadYears * 10) / 10,
    progression_score: progression,
    skill_count: Array.isArray(p.skills) ? p.skills.length : 0,
    career_trajectory: trajectory,
    leadership_indicators: leadershipIndicators.slice(0, 6),
  };
}

export function linkedinToCompetencyLevels(a: LinkedinAnalysis): Record<string, { level: number; evidence: string[] }> {
  const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    LEA: { level: cap(a.leadership_years * 8 + a.leadership_indicators.length * 4), evidence: a.leadership_indicators },
    EXE: { level: cap(a.total_years * 3 + a.position_count * 4), evidence: [`years:${a.total_years}`, `positions:${a.position_count}`] },
    ADP: { level: cap(a.position_count * 7 + (a.career_trajectory === 'ascending' ? 20 : 0)), evidence: [`trajectory:${a.career_trajectory}`] },
    COM: { level: cap(35 + a.leadership_indicators.length * 6 + a.skill_count * 0.5), evidence: [] },
    COG: { level: cap(40 + a.progression_score * 0.3 + a.skill_count * 0.4), evidence: [`progression:${a.progression_score}`] },
    TEC: { level: cap(25 + a.skill_count * 1.2), evidence: [`skills:${a.skill_count}`] },
    EIQ: { level: cap(30 + a.leadership_years * 5), evidence: ['leadership_tenure_proxy'] },
  };
}
