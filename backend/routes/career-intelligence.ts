/**
 * Career Intelligence routes.
 *
 * TWO disjoint surfaces live here:
 *
 * 1. LEGACY (public, unchanged) — `POST /api/career/intelligence/*`
 *    employability / fitment / visibility / dashboard. Stateless, profile-in →
 *    score-out helpers used by the existing user-facing Career Builder. These are
 *    preserved byte-identical (no flag, no auth) and MUST NOT change behaviour.
 *
 * 2. PHASE 4 (additive, flag-gated, super-admin) — `GET /api/career-intelligence/*`
 *    Exposes the additive, read-only Career Intelligence bridge behind the
 *    `careerIntelligence` flag (env `FF_CAREER_INTELLIGENCE`, default OFF). Strictly
 *    additive: flag OFF => every Phase-4 route returns 503 `feature_disabled` BEFORE
 *    any DB touch => byte-identical legacy behaviour (no schema, no read, no write).
 *    The bridge COMPOSES the Phase 3 Competency-EI engines into one career-
 *    intelligence envelope across the six career deliverables — it never recomputes
 *    a score and never fabricates.
 *
 * Access control (Phase 4 only): `subject` is an OPERATOR-supplied identifier for
 * any assessed person (not the caller's identity), so every Phase-4 route is
 * super-admin gated to prevent IDOR — mirrors /api/competency-ei/* (the engines it
 * composes are all super-admin scoped). The legacy POST surface is intentionally
 * public and operates only on the profile in the request body (no stored identity).
 *
 * Phase-4 routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET /api/career-intelligence/_meta/status              — lightweight flag probe
 *   GET /api/career-intelligence/:subject                  — composed envelope
 *   GET /api/career-intelligence/:subject/validation       — Phase-4 validation
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerIntelligenceEnabled } from '../config/feature-flags.js';
import {
  CAREER_INTELLIGENCE_VERSION,
  buildCareerIntelligence,
} from '../services/career-intelligence-bridge.js';
import { runCareerIntelligenceValidation } from '../services/career-intelligence-validation.js';

// ───────────────────────────────────────────────────────────────────────────
// LEGACY public career-intelligence helpers (preserved byte-identical).
// Stateless, profile-in → score-out. Consumed by the user-facing Career Builder.
// ───────────────────────────────────────────────────────────────────────────

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

export function registerCareerIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY public surface — preserved byte-identical (no flag, no auth).
  // Path namespace `/api/career/intelligence/*` is disjoint from the Phase-4
  // `/api/career-intelligence/*` (hyphen) surface, so there is no route collision.
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 4 additive, flag-gated, super-admin surface.
  // ─────────────────────────────────────────────────────────────────────────

  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerIntelligenceEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerIntelligence' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_INTELLIGENCE_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-intelligence]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // The SuperAdmin nav probes this to decide whether to render the tab: flag OFF
  // => 503 (nav hides => byte-identical UI); flag ON + super-admin => 200. Literal
  // path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-intelligence/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_INTELLIGENCE_VERSION, enabled: true, flag: 'careerIntelligence' });
    },
  );

  // ---- Super-admin validation (Phase 4 — mirrors Phase 3.12) -----------------
  // Literal sub-path carries an extra `validation` segment so it never collides
  // with the param route below. Registered FIRST (literal-before-param).
  app.get(
    '/api/career-intelligence/:subject/validation',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => runCareerIntelligenceValidation(pool, String(req.params.subject))),
  );

  // ---- Composed career-intelligence envelope (read-only) ---------------------
  app.get(
    '/api/career-intelligence/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerIntelligence(pool, String(req.params.subject))),
  );
}
