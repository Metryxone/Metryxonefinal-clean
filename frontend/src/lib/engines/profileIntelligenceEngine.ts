import type { CareerProfile } from '@/lib/careerIntelligence';

export interface ProfileIntelligenceInput {
  profile: CareerProfile | null | undefined;
}

export interface CompletenessSection {
  id:      string;
  label:   string;
  present: boolean;
  weight:  number;
  tip?:    string;
}

export interface CompletenessOutput {
  score:    number;
  sections: CompletenessSection[];
  missing:  string[];
  grade:    'complete' | 'strong' | 'partial' | 'minimal' | 'empty';
}

export interface SkillNormalizationOutput {
  technical:    string[];
  soft:         string[];
  tools:        string[];
  duplicates:   string[];
  normalized:   number;
  totalUnique:  number;
}

export interface CareerStageInference {
  stage:         'student' | 'early' | 'mid' | 'senior' | 'lead' | 'executive';
  totalYears:    number;
  roleCount:     number;
  currentTitle:  string | null;
  seniorityScore:number;
  label:         string;
}

export interface PrimaryFunctionInference {
  function:    'engineering' | 'data' | 'product' | 'design' | 'marketing' | 'hr' | 'finance' | 'consulting' | 'other';
  confidence:  number;
  signals:     string[];
}

export interface ProfileIntelligenceOutput {
  completeness:     CompletenessOutput;
  skills:           SkillNormalizationOutput;
  careerStage:      CareerStageInference;
  primaryFunction:  PrimaryFunctionInference;
  profileStrength:  number;
  readinessSignals: string[];
  gaps:             string[];
}

const SKILL_SYNONYMS: Record<string, string> = {
  'js':              'JavaScript',
  'ts':              'TypeScript',
  'py':              'Python',
  'reactjs':         'React',
  'react.js':        'React',
  'nodejs':          'Node.js',
  'node':            'Node.js',
  'aws':             'AWS',
  'gcp':             'Google Cloud',
  'k8s':             'Kubernetes',
  'postgres':        'PostgreSQL',
  'mysql':           'SQL',
  'mongo':           'MongoDB',
  'mongodb':         'MongoDB',
  'ml':              'Machine Learning',
  'ai':              'Artificial Intelligence',
  'ci/cd':           'CI/CD',
  'docker':          'Docker',
  'git':             'Git',
  'ms excel':        'Excel',
  'microsoft excel': 'Excel',
  'power bi':        'Power BI',
  'powerbi':         'Power BI',
};

const SOFT_SKILL_KEYWORDS = new Set([
  'communication', 'leadership', 'teamwork', 'collaboration', 'problem solving',
  'critical thinking', 'adaptability', 'time management', 'creativity', 'empathy',
  'negotiation', 'conflict resolution', 'mentoring', 'coaching', 'decision making',
  'presentation', 'public speaking', 'stakeholder management', 'analytical',
]);

const TOOL_KEYWORDS = new Set([
  'jira', 'confluence', 'notion', 'slack', 'figma', 'sketch', 'adobe xd',
  'tableau', 'power bi', 'excel', 'powerpoint', 'word', 'google sheets',
  'github', 'gitlab', 'bitbucket', 'jenkins', 'circleci', 'github actions',
  'trello', 'asana', 'monday', 'salesforce', 'hubspot', 'zendesk',
]);

function normalizeSkill(s: string): string {
  const trimmed = s.trim();
  const lower   = trimmed.toLowerCase();
  return SKILL_SYNONYMS[lower] ?? trimmed;
}

function categorizeSkill(skill: string): 'soft' | 'tool' | 'technical' {
  const lower = skill.toLowerCase();
  if (SOFT_SKILL_KEYWORDS.has(lower)) return 'soft';
  if (TOOL_KEYWORDS.has(lower))       return 'tool';
  return 'technical';
}

export function computeProfileCompleteness(p: CareerProfile | null | undefined): CompletenessOutput {
  const sections: CompletenessSection[] = [
    { id: 'personal',   label: 'Personal Info',        weight: 10, present: !!(p?.personal?.name && p?.personal?.email) },
    { id: 'summary',    label: 'Professional Summary', weight: 15, present: !!p?.summary },
    { id: 'experience', label: 'Work Experience',      weight: 25, present: !!((p?.experience ?? []).length) },
    { id: 'skills_tech',label: 'Technical Skills',     weight: 15, present: !!((p?.skills?.technical ?? []).length >= 3) },
    { id: 'skills_soft',label: 'Soft Skills',          weight: 10, present: !!((p?.skills?.soft ?? []).length >= 2) },
    { id: 'education',  label: 'Education',            weight: 10, present: !!((p?.education ?? []).length) },
    { id: 'certs',      label: 'Certifications',       weight: 5,  present: !!((p?.certifications ?? []).length) },
    { id: 'projects',   label: 'Projects',             weight: 5,  present: !!((p?.projects ?? []).length) },
    { id: 'linkedin',   label: 'LinkedIn Profile',     weight: 5,  present: !!p?.personal?.linkedin },
  ];

  sections.forEach(s => {
    if (!s.present) {
      s.tip = s.id === 'summary'     ? 'Write a 2-sentence professional bio'
            : s.id === 'linkedin'    ? 'Add your LinkedIn URL for recruiter visibility'
            : s.id === 'experience'  ? 'Add at least one work or internship role'
            : s.id === 'skills_tech' ? 'Add at least 3 technical skills'
            : `Complete your ${s.label.toLowerCase()}`;
    }
  });

  const score   = sections.reduce((s, sec) => s + (sec.present ? sec.weight : 0), 0);
  const missing = sections.filter(s => !s.present).map(s => s.label);

  const grade: CompletenessOutput['grade'] =
    score >= 90 ? 'complete' : score >= 70 ? 'strong' : score >= 45 ? 'partial' : score >= 20 ? 'minimal' : 'empty';

  return { score, sections, missing, grade };
}

export function normalizeSkills(p: CareerProfile | null | undefined): SkillNormalizationOutput {
  const rawTech = p?.skills?.technical ?? [];
  const rawSoft = p?.skills?.soft ?? [];
  const all     = [...rawTech, ...rawSoft].map(s => typeof s === 'string' ? s : '').filter(Boolean);

  const seen    = new Map<string, string>();
  const dupes: string[] = [];

  all.forEach(raw => {
    const norm  = normalizeSkill(raw);
    const lower = norm.toLowerCase();
    if (seen.has(lower)) {
      dupes.push(raw);
    } else {
      seen.set(lower, norm);
    }
  });

  const technical: string[] = [];
  const soft: string[]      = [];
  const tools: string[]     = [];

  seen.forEach(norm => {
    const cat = categorizeSkill(norm);
    if (cat === 'soft')      soft.push(norm);
    else if (cat === 'tool') tools.push(norm);
    else                     technical.push(norm);
  });

  return {
    technical,
    soft,
    tools,
    duplicates:  dupes,
    normalized:  all.length - seen.size,
    totalUnique: seen.size,
  };
}

export function inferCareerStage(p: CareerProfile | null | undefined): CareerStageInference {
  const exps        = p?.experience ?? [];
  const totalYears  = exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const roleCount   = exps.length;
  const currentTitle= exps.find(e => e?.current)?.title ?? exps[0]?.title ?? null;
  const titleLower  = (currentTitle ?? '').toLowerCase();

  let stage: CareerStageInference['stage'];
  if (roleCount === 0 || totalYears < 1)               stage = 'student';
  else if (totalYears < 3)                             stage = 'early';
  else if (totalYears < 6)                             stage = 'mid';
  else if (totalYears < 10)                            stage = 'senior';
  else if (/director|vp|head|principal|staff/.test(titleLower)) stage = 'executive';
  else if (/lead|manager|architect|sr\.|senior/.test(titleLower)) stage = 'lead';
  else                                                 stage = 'senior';

  const stageLabels: Record<CareerStageInference['stage'], string> = {
    student:   'Student / Pre-career',
    early:     'Early Career (0–3 yrs)',
    mid:       'Mid-level (3–6 yrs)',
    senior:    'Senior (6–10 yrs)',
    lead:      'Lead / Manager',
    executive: 'Director / Executive',
  };

  const seniorityScore = Math.min(100, totalYears * 8 + roleCount * 5);

  return {
    stage,
    totalYears,
    roleCount,
    currentTitle,
    seniorityScore,
    label: stageLabels[stage],
  };
}

export function inferPrimaryFunction(p: CareerProfile | null | undefined): PrimaryFunctionInference {
  const skills  = [...(p?.skills?.technical ?? []), ...(p?.skills?.soft ?? [])].map(s => s.toLowerCase());
  const titles  = (p?.experience ?? []).map(e => (e?.title ?? '').toLowerCase());
  const allText = [...skills, ...titles].join(' ');
  const signals: string[] = [];

  const PATTERNS: { fn: PrimaryFunctionInference['function']; keywords: string[]; weight: number }[] = [
    { fn: 'engineering',  keywords: ['engineer','developer','software','backend','frontend','fullstack','code','programming','devops','infrastructure'], weight: 2 },
    { fn: 'data',         keywords: ['data','analyst','scientist','machine learning','ml','bi','analytics','sql','python','tableau'], weight: 2 },
    { fn: 'product',      keywords: ['product','pm','product manager','roadmap','agile','scrum','ux research'], weight: 2 },
    { fn: 'design',       keywords: ['designer','ux','ui','figma','sketch','visual','brand','typography','illustrator'], weight: 2 },
    { fn: 'marketing',    keywords: ['marketing','growth','seo','content','campaign','brand','social media','copywriting'], weight: 2 },
    { fn: 'hr',           keywords: ['hr','human resources','talent','recruitment','recruiter','l&d','hrbp','people ops'], weight: 2 },
    { fn: 'finance',      keywords: ['finance','accounting','cfa','fpa','controller','auditor','excel','financial modeling'], weight: 2 },
    { fn: 'consulting',   keywords: ['consultant','advisory','strategy','mckinsey','bcg','deloitte','accenture','management'], weight: 2 },
  ];

  const scores: Record<string, number> = {};
  for (const p of PATTERNS) {
    let score = 0;
    for (const kw of p.keywords) {
      if (allText.includes(kw)) { score += p.weight; signals.push(kw); }
    }
    scores[p.fn] = (scores[p.fn] ?? 0) + score;
  }

  let topFn: PrimaryFunctionInference['function'] = 'other';
  let topScore = 0;
  for (const [fn, sc] of Object.entries(scores)) {
    if (sc > topScore) { topScore = sc; topFn = fn as PrimaryFunctionInference['function']; }
  }

  const confidence = Math.min(100, Math.round((topScore / Math.max(1, signals.length)) * 100));
  return { function: topFn, confidence, signals: [...new Set(signals)].slice(0, 5) };
}

export function runProfileIntelligenceEngine(input: ProfileIntelligenceInput): ProfileIntelligenceOutput {
  const p           = input.profile;
  const completeness= computeProfileCompleteness(p);
  const skills      = normalizeSkills(p);
  const careerStage = inferCareerStage(p);
  const primaryFn   = inferPrimaryFunction(p);

  const profileStrength = Math.round(
    completeness.score * 0.40 +
    Math.min(100, skills.totalUnique * 5) * 0.25 +
    careerStage.seniorityScore * 0.20 +
    primaryFn.confidence * 0.15,
  );

  const readinessSignals: string[] = [];
  if (completeness.score >= 70)   readinessSignals.push('Profile is well-structured');
  if (skills.totalUnique >= 8)    readinessSignals.push('Strong skill portfolio');
  if (careerStage.totalYears >= 2)readinessSignals.push('Substantive work history');
  if (p?.personal?.linkedin)      readinessSignals.push('External profile linked');
  if (p?.summary)                 readinessSignals.push('Professional summary present');

  const gaps: string[] = completeness.missing.slice(0, 4);
  if (skills.duplicates.length)   gaps.push(`${skills.duplicates.length} duplicate skill(s) to clean up`);

  return { completeness, skills, careerStage, primaryFunction: primaryFn, profileStrength, readinessSignals, gaps };
}
