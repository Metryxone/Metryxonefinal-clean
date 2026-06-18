import type { Express } from 'express';

type Profile = Record<string, unknown>;
type Role    = { id: string; title: string; skills: string[]; competencies: { id: string; required: number }[]; family?: string; adjacentRoles?: string[] };

const ROLE_CATALOG: Role[] = [
  { id:'swe',        title:'Software Engineer',       family:'engineering', skills:['JavaScript','TypeScript','React','Node.js','SQL','Docker','AWS','System Design','Git','REST APIs'],       competencies:[{id:'programming',required:4},{id:'systems-design',required:3},{id:'cloud',required:2},{id:'collaboration',required:3}], adjacentRoles:['ml-eng','devops','cloud-arch','eng-mgr'] },
  { id:'ml-eng',     title:'ML Engineer',             family:'engineering', skills:['Python','TensorFlow','PyTorch','MLOps','SQL','Docker','AWS','Statistics','Machine Learning'],              competencies:[{id:'programming',required:4},{id:'statistics',required:4},{id:'cloud',required:2},{id:'data-engineering',required:3}], adjacentRoles:['ai-eng','ds','swe'] },
  { id:'ai-eng',     title:'AI Engineer',             family:'ai',          skills:['Python','LLMs','Langchain','RAG','System Design','Docker','AWS','Prompt Engineering'],                    competencies:[{id:'programming',required:4},{id:'statistics',required:3},{id:'systems-design',required:3},{id:'cloud',required:3}], adjacentRoles:['ml-eng','swe','ds'] },
  { id:'cloud-arch', title:'Cloud Architect',         family:'engineering', skills:['AWS','Kubernetes','Terraform','Docker','Networking','System Design','CI/CD','Security'],                  competencies:[{id:'cloud',required:5},{id:'systems-design',required:4},{id:'security',required:3},{id:'programming',required:2}], adjacentRoles:['devops','swe','cybersec'] },
  { id:'cybersec',   title:'Cybersecurity Engineer',  family:'security',    skills:['IAM','SIEM','Penetration Testing','OWASP','Python','Network Security','Cloud Security'],                  competencies:[{id:'security',required:5},{id:'programming',required:3},{id:'cloud',required:2},{id:'systems-design',required:2}], adjacentRoles:['cloud-arch','devops','swe'] },
  { id:'devops',     title:'DevOps Engineer',         family:'engineering', skills:['Docker','Kubernetes','CI/CD','AWS','Terraform','Shell Scripting','Monitoring','Git'],                    competencies:[{id:'cloud',required:4},{id:'programming',required:3},{id:'systems-design',required:2},{id:'project-mgmt',required:2}], adjacentRoles:['cloud-arch','swe','cybersec'] },
  { id:'ds',         title:'Data Scientist',          family:'data',        skills:['Python','Machine Learning','SQL','Statistics','Pandas','NumPy','Tableau','R'],                            competencies:[{id:'statistics',required:4},{id:'data-analysis',required:4},{id:'programming',required:3},{id:'research',required:3}], adjacentRoles:['ml-eng','da','de'] },
  { id:'da',         title:'Data Analyst',            family:'data',        skills:['SQL','Excel','Tableau','Power BI','Python','Data Visualization','Statistics','Business Intelligence'],   competencies:[{id:'data-analysis',required:4},{id:'statistics',required:2},{id:'business-acumen',required:3},{id:'presentation',required:2}], adjacentRoles:['ds','de'] },
  { id:'de',         title:'Data Engineer',           family:'data',        skills:['Spark','Kafka','Airflow','SQL','Python','AWS','Databricks','ETL','Data Pipelines'],                      competencies:[{id:'data-engineering',required:5},{id:'cloud',required:3},{id:'programming',required:4},{id:'systems-design',required:3}], adjacentRoles:['ds','da','swe'] },
  { id:'pm',         title:'Product Manager',         family:'product',     skills:['Product Strategy','Agile','SQL','Analytics','Roadmapping','User Research','OKRs','Stakeholder Mgmt'],  competencies:[{id:'strategy',required:4},{id:'stakeholder-mgmt',required:4},{id:'business-acumen',required:4},{id:'data-analysis',required:2}], adjacentRoles:['eng-mgr','ux'] },
  { id:'ux',         title:'UX Designer',             family:'design',      skills:['Figma','User Research','Prototyping','Design Systems','Usability Testing','Sketch','Accessibility'],     competencies:[{id:'ux-design',required:5},{id:'design-thinking',required:4},{id:'research',required:3},{id:'presentation',required:2}], adjacentRoles:['pm'] },
  { id:'eng-mgr',    title:'Engineering Manager',     family:'leadership',  skills:['Leadership','System Design','People Management','OKRs','Strategy','Agile','Communication','Mentoring'],  competencies:[{id:'people-mgmt',required:4},{id:'strategy',required:4},{id:'systems-design',required:3},{id:'mentoring',required:3}], adjacentRoles:['swe','pm'] },
  { id:'platform-eng',title:'Platform Engineer',      family:'engineering', skills:['Kubernetes','Terraform','CI/CD','AWS','Backstage','Docker','Observability','Internal Tooling'],          competencies:[{id:'cloud',required:5},{id:'systems-design',required:4},{id:'programming',required:3}], adjacentRoles:['devops','cloud-arch','swe'] },
];

function resolveRole(roleInput: unknown): Role | null {
  if (!roleInput) return null;
  if (typeof roleInput === 'string') {
    return ROLE_CATALOG.find(r => r.id === roleInput || r.title.toLowerCase() === roleInput.toLowerCase()) ?? null;
  }
  if (typeof roleInput === 'object' && roleInput !== null && Array.isArray((roleInput as Role).skills)) {
    return roleInput as Role;
  }
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9+#.\s-]/g, '').replace(/\s+/g, ' ');
}

function getUserSkillSet(p: Profile): Set<string> {
  const out = new Set<string>();
  const tech = (p?.skills as Record<string,string[]>)?.technical ?? [];
  const soft = (p?.skills as Record<string,string[]>)?.soft ?? [];
  [...tech, ...soft].forEach(s => {
    if (typeof s !== 'string') return;
    const n = norm(s);
    if (!n) return;
    out.add(n);
    n.split(/[\s/]+/).forEach(t => { if (t.length > 1) out.add(t); });
  });
  return out;
}

function computeEI(p: Profile): { score: number; band: string; breakdown: Record<string,number> } {
  const base       = (p?.competencyProfile as Record<string,number>)?.completeness ?? 0;
  const tech       = ((p?.skills as Record<string,unknown[]>)?.technical ?? []).length;
  const soft       = ((p?.skills as Record<string,unknown[]>)?.soft ?? []).length;
  const exp        = ((p?.experience as unknown[]) ?? []).length;
  const certs      = ((p?.certifications as unknown[]) ?? []).length;
  const projs      = ((p?.projects as unknown[]) ?? []).length;

  const breakdown  = {
    completenessScore: base * 0.45,
    technicalScore:    Math.min(tech * 2.5, 20),
    softScore:         Math.min(soft * 1.5, 10),
    experienceScore:   Math.min(exp * 5, 15),
    certScore:         Math.min(certs * 2, 6),
    projectScore:      Math.min(projs * 1.5, 6),
  };
  const raw   = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.min(Math.round(raw), 99);
  const band  = score >= 75 ? 'Elite' : score >= 55 ? 'Strong' : score >= 35 ? 'Developing' : 'Foundation';
  return { score, band, breakdown };
}

function computeFitment(p: Profile, role: Role): Record<string,unknown> {
  const userSkills = getUserSkillSet(p);
  const matched: string[] = [], missing: string[] = [];
  role.skills.forEach(s => {
    const n = norm(s);
    if (userSkills.has(n) || [...userSkills].some(u => u.includes(n) || n.includes(u))) matched.push(s);
    else missing.push(s);
  });
  const skillMatch = Math.round((matched.length / Math.max(1, role.skills.length)) * 100);
  const expYears   = ((p?.experience as {years?:number}[]) ?? []).reduce((s, e) => s + (Number(e?.years) || 1), 0);
  const expectedYears = Math.max(2, role.competencies.reduce((m, c) => Math.max(m, c.required), 0));
  const experienceMatch = Math.round(Math.min(100, (expYears / expectedYears) * 100));
  const fitScore = Math.round(skillMatch * 0.55 + experienceMatch * 0.45);
  const readiness = fitScore >= 75 ? 'hire-ready' : fitScore >= 55 ? 'near-ready' : fitScore >= 35 ? 'developing' : 'early-stage';
  return { fitScore, skillMatch, experienceMatch, matchedSkills: matched.slice(0, 8), missingSkills: missing.slice(0, 5), readiness };
}

function computeVisibility(p: Profile, eiScore: number, isOpen: boolean): Record<string,unknown> {
  const base   = (p?.competencyProfile as Record<string,number>)?.completeness ?? 0;
  const tech   = ((p?.skills as Record<string,unknown[]>)?.technical ?? []).length;
  const exp    = ((p?.experience as unknown[]) ?? []).length;
  const certs  = ((p?.certifications as unknown[]) ?? []).length;
  const projs  = ((p?.projects as unknown[]) ?? []).length;
  const hasLI  = !!(p?.personal as Record<string,unknown>)?.linkedin;
  const hasSumm= !!p?.summary;

  const score = Math.min(100, Math.round(
    (base / 100) * 20 + (eiScore / 100) * 25 + Math.min(15, tech * 2) +
    Math.min(15, exp * 5) + Math.min(10, certs * 3 + projs * 2) +
    (hasLI ? 5 : 0) + (hasSumm ? 5 : 0) + (isOpen ? 5 : 0),
  ));
  const band = score >= 85 ? 'top' : score >= 65 ? 'high' : score >= 45 ? 'medium' : score >= 25 ? 'low' : 'hidden';
  const views = score < 25 ? 0 : Math.max(0, Math.round(score * 0.18 + eiScore * 0.08 + tech * 0.6 + exp * 1.2));
  return { score, band, recruiterViews: views, openToOpportunities: isOpen };
}

export function registerCareerIntelligenceRoutes(app: Express): void {
  app.post('/api/career/intelligence/employability', async (req, res, next) => {
    try {
      const profile = req.body?.profile as Profile | undefined;
      if (!profile) return res.status(400).json({ error: 'profile is required' });
      return res.json({ success: true, ...computeEI(profile) });
    } catch (e) { next(e); }
  });

  app.post('/api/career/intelligence/fitment', async (req, res, next) => {
    try {
      const { profile, role, roleId } = req.body ?? {};
      if (!profile) return res.status(400).json({ error: 'profile is required' });
      const resolved = resolveRole(role ?? roleId);
      if (!resolved) return res.status(400).json({ error: 'role must be a role id string (e.g. "ml-eng") or a full role object with skills[]', availableIds: ROLE_CATALOG.map(r => r.id) });
      return res.json({ success: true, roleId: resolved.id, roleTitle: resolved.title, ...computeFitment(profile as Profile, resolved) });
    } catch (e) { next(e); }
  });

  app.post('/api/career/intelligence/visibility', async (req, res, next) => {
    try {
      const { profile, isOpen } = req.body ?? {};
      if (!profile) return res.status(400).json({ error: 'profile is required' });
      const ei = computeEI(profile as Profile);
      return res.json({ success: true, ...computeVisibility(profile as Profile, ei.score, !!isOpen) });
    } catch (e) { next(e); }
  });

  app.post('/api/career/intelligence/dashboard', async (req, res, next) => {
    try {
      const { profile, role, roleId, isOpen } = req.body ?? {};
      if (!profile) return res.status(400).json({ error: 'profile is required' });

      const ei       = computeEI(profile as Profile);
      const vis      = computeVisibility(profile as Profile, ei.score, !!isOpen);
      const resolved = resolveRole(role ?? roleId);
      const fit      = resolved ? computeFitment(profile as Profile, resolved) : null;

      return res.json({
        success: true,
        employability:   { ...ei, percentile: ei.score >= 75 ? 80 : ei.score >= 55 ? 65 : ei.score >= 35 ? 35 : 15 },
        visibility:      vis,
        fitment:         fit,
        generatedAt:     Date.now(),
      });
    } catch (e) { next(e); }
  });
}
