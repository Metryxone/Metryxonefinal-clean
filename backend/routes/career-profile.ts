import type { Express } from 'express';

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9+#.\s-]/g, '').replace(/\s+/g, ' ');
}

const SOFT_KW = new Set(['communication','leadership','teamwork','collaboration','problem solving',
  'critical thinking','adaptability','time management','creativity','empathy','negotiation',
  'conflict resolution','mentoring','coaching','decision making','presentation','analytical']);

const TOOL_KW = new Set(['jira','confluence','notion','slack','figma','sketch','adobe xd',
  'tableau','power bi','excel','powerpoint','github','gitlab','jenkins','trello','asana']);

const SYNONYMS: Record<string, string> = {
  'js':'JavaScript','ts':'TypeScript','py':'Python','reactjs':'React',
  'nodejs':'Node.js','node':'Node.js','k8s':'Kubernetes','mongo':'MongoDB',
  'ml':'Machine Learning','postgres':'PostgreSQL','mysql':'SQL',
};

function normSkill(s: string): string {
  const t = s.trim();
  return SYNONYMS[t.toLowerCase()] ?? t;
}

function scoreCompleteness(p: Record<string, unknown>): { score: number; sections: unknown[]; missing: string[] } {
  const sections = [
    { id:'personal',    label:'Personal Info',        weight:10, present:!!(p.personal && (p.personal as Record<string,unknown>)?.name) },
    { id:'summary',     label:'Professional Summary', weight:15, present:!!p.summary },
    { id:'experience',  label:'Work Experience',      weight:25, present:!!((p.experience as unknown[])?.length) },
    { id:'skills_tech', label:'Technical Skills',     weight:15, present:!!((p.skills as Record<string,unknown[]>)?.technical?.length >= 3) },
    { id:'skills_soft', label:'Soft Skills',          weight:10, present:!!((p.skills as Record<string,unknown[]>)?.soft?.length >= 2) },
    { id:'education',   label:'Education',            weight:10, present:!!((p.education as unknown[])?.length) },
    { id:'certs',       label:'Certifications',       weight:5,  present:!!((p.certifications as unknown[])?.length) },
    { id:'projects',    label:'Projects',             weight:5,  present:!!((p.projects as unknown[])?.length) },
    { id:'linkedin',    label:'LinkedIn Profile',     weight:5,  present:!!(p.personal && (p.personal as Record<string,unknown>)?.linkedin) },
  ];
  const score   = sections.reduce((s, sec) => s + (sec.present ? sec.weight : 0), 0);
  const missing = sections.filter(s => !s.present).map(s => s.label);
  return { score, sections, missing };
}

function inferStage(p: Record<string, unknown>): { stage: string; totalYears: number; label: string } {
  const exps = (p.experience as { years?: number; title?: string }[]) ?? [];
  const totalYears = exps.reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const title = ((exps.find((e: Record<string,unknown>) => e?.current) ?? exps[0])?.title ?? '').toLowerCase();

  let stage = 'early';
  if (totalYears < 1)   stage = 'student';
  else if (totalYears < 3) stage = 'early';
  else if (totalYears < 6) stage = 'mid';
  else if (/director|vp|head|principal|staff/.test(title)) stage = 'executive';
  else if (/lead|manager|architect|sr\.|senior/.test(title)) stage = 'lead';
  else stage = 'senior';

  const labels: Record<string,string> = {
    student:'Student / Pre-career', early:'Early Career (0–3 yrs)', mid:'Mid-level (3–6 yrs)',
    senior:'Senior (6–10 yrs)', lead:'Lead / Manager', executive:'Director / Executive',
  };
  return { stage, totalYears, label: labels[stage] ?? stage };
}

function normalizeSkills(p: Record<string, unknown>): { technical: string[]; soft: string[]; tools: string[]; duplicates: string[] } {
  const skills = p.skills as Record<string, string[]> | undefined;
  const all = [...(skills?.technical ?? []), ...(skills?.soft ?? [])].filter(s => typeof s === 'string');
  const seen = new Map<string, string>();
  const dupes: string[] = [];

  all.forEach(raw => {
    const n = normSkill(raw);
    const lo = n.toLowerCase();
    if (seen.has(lo)) dupes.push(raw);
    else seen.set(lo, n);
  });

  const technical: string[] = [], soft: string[] = [], tools: string[] = [];
  seen.forEach(n => {
    const lo = n.toLowerCase();
    if (SOFT_KW.has(lo)) soft.push(n);
    else if (TOOL_KW.has(lo)) tools.push(n);
    else technical.push(n);
  });
  return { technical, soft, tools, duplicates: dupes };
}

export function registerCareerProfileRoutes(app: Express): void {
  app.post('/api/career/profile/analyze', async (req, res, next) => {
    try {
      const profile = req.body?.profile as Record<string, unknown> | undefined;
      if (!profile) return res.status(400).json({ error: 'profile is required in request body' });

      const completeness = scoreCompleteness(profile);
      const careerStage  = inferStage(profile);
      const skills       = normalizeSkills(profile);
      const strength     = Math.round(completeness.score * 0.40 + Math.min(100, skills.technical.length * 5) * 0.25 + Math.min(100, careerStage.totalYears * 8) * 0.20 + 15);

      return res.json({
        success: true,
        completeness,
        careerStage,
        skills,
        profileStrength: Math.min(100, strength),
        readinessSignals: [
          completeness.score >= 70 && 'Well-structured profile',
          skills.technical.length >= 8 && 'Strong skill portfolio',
          careerStage.totalYears >= 2 && 'Substantive work history',
        ].filter(Boolean),
        gaps: completeness.missing.slice(0, 4),
      });
    } catch (e) { next(e); }
  });

  app.post('/api/career/profile/completeness', async (req, res, next) => {
    try {
      const profile = req.body?.profile as Record<string, unknown> | undefined;
      if (!profile) return res.status(400).json({ error: 'profile is required' });
      return res.json({ success: true, ...scoreCompleteness(profile) });
    } catch (e) { next(e); }
  });

  app.post('/api/career/profile/normalize-skills', async (req, res, next) => {
    try {
      const profile = req.body?.profile as Record<string, unknown> | undefined;
      if (!profile) return res.status(400).json({ error: 'profile is required' });
      return res.json({ success: true, ...normalizeSkills(profile) });
    } catch (e) { next(e); }
  });

  app.post('/api/career/profile/career-stage', async (req, res, next) => {
    try {
      const profile = req.body?.profile as Record<string, unknown> | undefined;
      if (!profile) return res.status(400).json({ error: 'profile is required' });
      return res.json({ success: true, ...inferStage(profile) });
    } catch (e) { next(e); }
  });
}
