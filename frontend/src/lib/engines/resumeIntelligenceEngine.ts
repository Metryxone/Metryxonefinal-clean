import type { CareerProfile } from '@/lib/careerIntelligence';

export interface ResumeIntelligenceInput {
  parsed: Record<string, unknown>;
}

export interface SectionConfidence {
  section:    string;
  confidence: number;
  present:    boolean;
  quality:    'high' | 'medium' | 'low' | 'missing';
  note?:      string;
}

export interface StructuredExtraction {
  personal:       Record<string, string>;
  summary:        string | null;
  experience:     StructuredExperience[];
  skills:         { technical: string[]; soft: string[]; tools: string[] };
  education:      StructuredEducation[];
  certifications: StructuredCertification[];
  projects:       StructuredProject[];
  languages:      string[];
}

export interface StructuredExperience {
  title:    string;
  company:  string;
  years:    number;
  current:  boolean;
  raw?:     string;
}

export interface StructuredEducation {
  degree:      string;
  institution: string;
  year?:       number;
}

export interface StructuredCertification {
  name:   string;
  issuer: string;
  year?:  number;
}

export interface StructuredProject {
  name:  string;
  stack: string[];
  url?:  string;
}

export interface ResumeIntelligenceOutput {
  overallConfidence: number;
  sections:          SectionConfidence[];
  extracted:         StructuredExtraction;
  mappedProfile:     Partial<CareerProfile>;
  warnings:          string[];
  enrichments:       string[];
}

const KNOWN_TITLES = [
  'software engineer','senior software engineer','staff engineer','principal engineer',
  'frontend developer','backend developer','full stack developer','fullstack developer',
  'data scientist','data analyst','ml engineer','ai engineer',
  'product manager','senior pm','associate pm','group pm',
  'ux designer','ui designer','product designer','design lead',
  'devops engineer','site reliability engineer','platform engineer',
  'marketing manager','growth manager','content manager',
  'hr manager','recruiter','talent acquisition','people partner',
];

const KNOWN_ISSUERS = [
  'aws','amazon web services','google','microsoft','pmi','cisco','oracle',
  'coursera','udemy','linkedin learning','pluralsight',
];

function scoreSection(value: unknown, label: string): SectionConfidence {
  if (!value) return { section: label, confidence: 0, present: false, quality: 'missing', note: `${label} not detected in resume` };

  if (Array.isArray(value)) {
    if (value.length === 0) return { section: label, confidence: 10, present: false, quality: 'missing', note: `${label} array is empty` };
    const quality: SectionConfidence['quality'] = value.length >= 3 ? 'high' : value.length >= 1 ? 'medium' : 'low';
    return { section: label, confidence: value.length >= 3 ? 90 : value.length >= 1 ? 65 : 30, present: true, quality };
  }

  if (typeof value === 'string') {
    const len = value.trim().length;
    if (len < 10)  return { section: label, confidence: 20, present: true, quality: 'low', note: `${label} is very short` };
    if (len < 60)  return { section: label, confidence: 55, present: true, quality: 'medium' };
    return { section: label, confidence: 90, present: true, quality: 'high' };
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).filter(k => (value as Record<string, unknown>)[k]);
    if (keys.length >= 4) return { section: label, confidence: 88, present: true, quality: 'high' };
    if (keys.length >= 2) return { section: label, confidence: 60, present: true, quality: 'medium' };
    return { section: label, confidence: 30, present: true, quality: 'low', note: `${label} has minimal data` };
  }

  return { section: label, confidence: 50, present: true, quality: 'medium' };
}

function extractSkills(raw: unknown): { technical: string[]; soft: string[]; tools: string[] } {
  const SOFT_KW = new Set(['communication','leadership','teamwork','problem solving','collaboration','adaptability','creativity','negotiation','mentoring','analytical']);
  const TOOL_KW = new Set(['jira','figma','slack','notion','confluence','tableau','excel','powerpoint','github','gitlab','jenkins','trello']);

  let all: string[] = [];
  if (Array.isArray(raw)) all = raw.filter(s => typeof s === 'string');
  else if (typeof raw === 'object' && raw) {
    const obj = raw as Record<string, unknown>;
    ['technical','soft','tools'].forEach(k => {
      if (Array.isArray(obj[k])) all.push(...(obj[k] as string[]));
    });
  }

  const technical: string[] = [], soft: string[] = [], tools: string[] = [];
  all.forEach(s => {
    const lower = s.toLowerCase().trim();
    if (SOFT_KW.has(lower))      soft.push(s);
    else if (TOOL_KW.has(lower)) tools.push(s);
    else                         technical.push(s);
  });
  return { technical, soft, tools };
}

function extractExperience(raw: unknown): StructuredExperience[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>, i: number) => ({
    title:   (item.title as string) || (item.role as string) || (item.position as string) || 'Unknown Role',
    company: (item.company as string) || (item.employer as string) || '',
    years:   Number(item.years || item.duration || 1),
    current: !!(item.current || i === 0),
    raw:     item.description as string | undefined,
  }));
}

function extractEducation(raw: unknown): StructuredEducation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => ({
    degree:      (item as Record<string, unknown>).degree as string || '',
    institution: (item as Record<string, unknown>).institution as string || (item as Record<string, unknown>).school as string || '',
    year:        Number((item as Record<string, unknown>).year) || undefined,
  }));
}

function extractCertifications(raw: unknown): StructuredCertification[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => ({
    name:   (item as Record<string, unknown>).name as string || String(item),
    issuer: (item as Record<string, unknown>).issuer as string || '',
    year:   Number((item as Record<string, unknown>).year) || undefined,
  }));
}

function extractProjects(raw: unknown): StructuredProject[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => ({
    name:  (item as Record<string, unknown>).name as string || '',
    stack: Array.isArray((item as Record<string, unknown>).stack) ? (item as Record<string, unknown>).stack as string[] : [],
    url:   (item as Record<string, unknown>).url as string | undefined,
  }));
}

function mapToProfile(extracted: StructuredExtraction): Partial<CareerProfile> {
  return {
    personal:    extracted.personal,
    summary:     extracted.summary ?? undefined,
    experience:  extracted.experience,
    skills:      { technical: extracted.skills.technical, soft: extracted.skills.soft },
    education:   extracted.education,
    certifications: extracted.certifications,
    projects:    extracted.projects,
  };
}

export function runResumeIntelligenceEngine(input: ResumeIntelligenceInput): ResumeIntelligenceOutput {
  const p = input.parsed;

  const extracted: StructuredExtraction = {
    personal:       (p.personal as Record<string, string>) ?? {},
    summary:        (p.summary as string) || null,
    experience:     extractExperience(p.experience ?? p.workExperience),
    skills:         extractSkills(p.skills),
    education:      extractEducation(p.education),
    certifications: extractCertifications(p.certifications),
    projects:       extractProjects(p.projects),
    languages:      Array.isArray(p.languages) ? p.languages as string[] : [],
  };

  const sections: SectionConfidence[] = [
    scoreSection(extracted.personal,       'Personal Info'),
    scoreSection(extracted.summary,        'Summary'),
    scoreSection(extracted.experience,     'Experience'),
    scoreSection(extracted.skills.technical.concat(extracted.skills.soft), 'Skills'),
    scoreSection(extracted.education,      'Education'),
    scoreSection(extracted.certifications, 'Certifications'),
    scoreSection(extracted.projects,       'Projects'),
  ];

  const overallConfidence = Math.round(
    sections.reduce((s, sec) => s + sec.confidence, 0) / sections.length,
  );

  const warnings: string[] = [];
  const enrichments: string[] = [];

  sections.filter(s => s.quality === 'missing' || s.quality === 'low').forEach(s => {
    warnings.push(`${s.section}: ${s.note ?? 'low quality or missing'}`);
  });

  if (overallConfidence >= 80) enrichments.push('High-confidence parse — auto-mapping applied');
  if (extracted.experience.length)  enrichments.push(`${extracted.experience.length} role(s) detected and structured`);
  if (extracted.skills.technical.length) enrichments.push(`${extracted.skills.technical.length} technical skills extracted`);
  if (extracted.certifications.length)   enrichments.push(`${extracted.certifications.length} certification(s) mapped`);
  if (extracted.projects.length)         enrichments.push(`${extracted.projects.length} project(s) found`);

  return {
    overallConfidence,
    sections,
    extracted,
    mappedProfile: mapToProfile(extracted),
    warnings,
    enrichments,
  };
}
