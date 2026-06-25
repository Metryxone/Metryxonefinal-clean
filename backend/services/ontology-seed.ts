/**
 * MetryxOne Competency Ontology — Starter Seed
 *
 * Idempotent: every INSERT uses ON CONFLICT (code) DO NOTHING.
 * FK resolution: after inserting each parent layer, SELECT ids by code
 * so child rows and mapping rows use real PKs.
 *
 * Hierarchy covered:
 *   Industry → Function → Department → Role Family → Role
 *     → Layer → Cluster → Competency → Micro Competency
 *       → Concern → Indicator → Assessment Question
 */

import type { Pool } from 'pg';
import { ensureTaxonomySchema } from '../routes/ontology-taxonomy.js';
import { ensureCompetencyCoreSchema } from '../routes/ontology-competency-core.js';
import { ensureConcernsMappingSchema } from '../routes/ontology-concerns-mapping.js';
import { ensureSupplementarySchema } from '../routes/ontology-supplementary.js';

export interface SeedResult {
  phases: Record<string, number>;
  totalRows: number;
  ok: boolean;
  error?: string;
}

async function lookupCodes(pool: Pool, table: string, codes: string[]): Promise<Map<string, number>> {
  if (!codes.length) return new Map();
  const { rows } = await pool.query(
    `SELECT id, code FROM ${table} WHERE code = ANY($1)`,
    [codes],
  );
  return new Map(rows.map((r: any) => [r.code, r.id as number]));
}

async function lookupTitle(pool: Pool, table: string, codes: string[]): Promise<Map<string, number>> {
  if (!codes.length) return new Map();
  const { rows } = await pool.query(
    `SELECT id, code FROM ${table} WHERE code = ANY($1)`,
    [codes],
  );
  return new Map(rows.map((r: any) => [r.code, r.id as number]));
}

export async function runOntologySeed(pool: Pool): Promise<SeedResult> {
  const phases: Record<string, number> = {};

  try {

    // ── 0. ENSURE ALL REQUIRED TABLES EXIST (idempotent DDL) ──────────────────
    await ensureTaxonomySchema(pool);
    await ensureCompetencyCoreSchema(pool);
    await ensureSupplementarySchema(pool);
    await ensureConcernsMappingSchema(pool);

    // ── 1. INDUSTRIES ──────────────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO ont_industries (code, name, parent_sector, description, status, sort_order) VALUES
        ('IND_TECH',     'Technology & Software',          'Technology',         'Software, SaaS, IT services, hardware', 'published', 1),
        ('IND_FIN',      'Financial Services & FinTech',   'Finance',            'Banking, insurance, capital markets, payments', 'published', 2),
        ('IND_HEALTH',   'Healthcare & Life Sciences',     'Healthcare',         'Hospitals, pharma, medtech, diagnostics', 'published', 3),
        ('IND_EDU',      'Education & EdTech',             'Education',          'K-12, higher education, online learning', 'published', 4),
        ('IND_MFG',      'Manufacturing & Engineering',    'Industry',           'Industrial, automotive, electronics, FMCG production', 'published', 5),
        ('IND_RETAIL',   'Retail & E-Commerce',            'Commerce',           'Brick-and-mortar, marketplace, direct-to-consumer', 'published', 6),
        ('IND_ENERGY',   'Energy & Utilities',             'Infrastructure',     'Power, oil & gas, renewables, water', 'published', 7),
        ('IND_TRANS',    'Transportation & Logistics',     'Infrastructure',     'Freight, last-mile, aviation, mobility', 'published', 8),
        ('IND_MEDIA',    'Media & Entertainment',          'Creative',           'Content, streaming, gaming, publishing', 'published', 9),
        ('IND_GOV',      'Government & Public Sector',     'Government',         'Central, state, municipal, defence', 'published', 10),
        ('IND_PROF',     'Professional Services',          'Services',           'Consulting, legal, accounting, staffing', 'published', 11),
        ('IND_FMCG',     'FMCG & Consumer Goods',          'Commerce',           'Fast-moving consumer goods, personal care, food & beverage', 'published', 12)
      ON CONFLICT (code) DO NOTHING
    `);
    phases.industries = 12;

    // ── 2. FUNCTIONS ───────────────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO ont_functions (code, name, description, is_cross_industry, status, sort_order) VALUES
        ('FN_ENGG',   'Engineering & Technology',  'Software engineering, architecture, platform, infra', true,  'published', 1),
        ('FN_PROD',   'Product Management',        'Product strategy, roadmap, user research',            true,  'published', 2),
        ('FN_DESIGN', 'Design & UX',               'Visual design, UX research, brand design',            true,  'published', 3),
        ('FN_DATA',   'Data & Analytics',          'Data science, ML, BI, data engineering',              true,  'published', 4),
        ('FN_MKTG',   'Marketing',                 'Brand, growth, content, digital, performance',        true,  'published', 5),
        ('FN_SALES',  'Sales & Revenue',           'Inside sales, enterprise, partnerships, SDR',         true,  'published', 6),
        ('FN_OPS',    'Operations',                'Business ops, program management, process excellence', true, 'published', 7),
        ('FN_HR',     'Human Resources & People',  'HRBP, talent acquisition, L&D, total rewards',        true,  'published', 8),
        ('FN_FIN',    'Finance & Accounting',      'FP&A, controllership, treasury, tax',                 true,  'published', 9),
        ('FN_LEGAL',  'Legal & Compliance',        'Corporate legal, IP, regulatory, privacy',            true,  'published', 10),
        ('FN_CS',     'Customer Success',          'Onboarding, retention, support, solutions engineering', true,'published', 11),
        ('FN_IT',     'Information Technology',    'IT infrastructure, security, enterprise apps',        true,  'published', 12),
        ('FN_RD',     'Research & Development',    'Applied research, clinical, innovation labs',         false, 'published', 13),
        ('FN_SCM',    'Supply Chain & Procurement','Sourcing, logistics, vendor management',               false, 'published', 14),
        ('FN_STRAT',  'Strategy & Consulting',     'Corporate strategy, M&A, business development',       true,  'published', 15)
      ON CONFLICT (code) DO NOTHING
    `);
    phases.functions = 15;

    // ── 3. INDUSTRY → FUNCTION MAPPINGS ──────────────────────────────────────
    const indIds = await lookupCodes(pool, 'ont_industries', [
      'IND_TECH','IND_FIN','IND_HEALTH','IND_EDU','IND_MFG',
      'IND_RETAIL','IND_ENERGY','IND_TRANS','IND_MEDIA','IND_GOV','IND_PROF','IND_FMCG',
    ]);
    const fnIds = await lookupCodes(pool, 'ont_functions', [
      'FN_ENGG','FN_PROD','FN_DESIGN','FN_DATA','FN_MKTG','FN_SALES',
      'FN_OPS','FN_HR','FN_FIN','FN_LEGAL','FN_CS','FN_IT','FN_RD','FN_SCM','FN_STRAT',
    ]);

    const indFnPairs: [string, string][] = [
      ['IND_TECH',  'FN_ENGG'],   ['IND_TECH',  'FN_PROD'],   ['IND_TECH',  'FN_DESIGN'],
      ['IND_TECH',  'FN_DATA'],   ['IND_TECH',  'FN_MKTG'],   ['IND_TECH',  'FN_SALES'],
      ['IND_FIN',   'FN_ENGG'],   ['IND_FIN',   'FN_DATA'],   ['IND_FIN',   'FN_OPS'],
      ['IND_FIN',   'FN_FIN'],    ['IND_FIN',   'FN_LEGAL'],  ['IND_FIN',   'FN_STRAT'],
      ['IND_HEALTH','FN_RD'],     ['IND_HEALTH','FN_OPS'],    ['IND_HEALTH','FN_IT'],
      ['IND_EDU',   'FN_PROD'],   ['IND_EDU',   'FN_DESIGN'], ['IND_EDU',   'FN_MKTG'],
      ['IND_MFG',   'FN_ENGG'],   ['IND_MFG',   'FN_SCM'],    ['IND_MFG',   'FN_OPS'],
      ['IND_RETAIL','FN_MKTG'],   ['IND_RETAIL','FN_SALES'],  ['IND_RETAIL','FN_SCM'],
      ['IND_ENERGY','FN_ENGG'],   ['IND_ENERGY','FN_OPS'],    ['IND_ENERGY','FN_SCM'],
      ['IND_TRANS', 'FN_OPS'],    ['IND_TRANS', 'FN_SCM'],    ['IND_TRANS', 'FN_IT'],
      ['IND_MEDIA', 'FN_PROD'],   ['IND_MEDIA', 'FN_DESIGN'], ['IND_MEDIA', 'FN_MKTG'],
      ['IND_GOV',   'FN_IT'],     ['IND_GOV',   'FN_LEGAL'],  ['IND_GOV',   'FN_OPS'],
      ['IND_PROF',  'FN_STRAT'],  ['IND_PROF',  'FN_HR'],     ['IND_PROF',  'FN_FIN'],
      ['IND_FMCG',  'FN_MKTG'],   ['IND_FMCG',  'FN_SALES'],  ['IND_FMCG',  'FN_SCM'],
    ];
    let mapIfCount = 0;
    for (const [ic, fc] of indFnPairs) {
      const iid = indIds.get(ic); const fid = fnIds.get(fc);
      if (iid && fid) {
        await pool.query(
          `INSERT INTO map_industry_function (industry_id, function_id) VALUES ($1,$2) ON CONFLICT (industry_id, function_id) DO NOTHING`,
          [iid, fid],
        );
        mapIfCount++;
      }
    }
    phases.map_industry_function = mapIfCount;

    // ── 4. DEPARTMENTS ────────────────────────────────────────────────────────
    const depts: Array<{ code: string; name: string; fnCode: string; desc?: string }> = [
      { code: 'DEPT_SFTDEV',   name: 'Software Development',            fnCode: 'FN_ENGG',  desc: 'Frontend, backend, fullstack, mobile engineering' },
      { code: 'DEPT_PLAT',     name: 'Platform & Infrastructure',       fnCode: 'FN_ENGG',  desc: 'Cloud, DevOps, SRE, architecture' },
      { code: 'DEPT_DATASCI',  name: 'Data Science & ML',               fnCode: 'FN_DATA',  desc: 'ML models, AI research, experimentation' },
      { code: 'DEPT_DATAENGG', name: 'Data Engineering & Analytics',    fnCode: 'FN_DATA',  desc: 'Pipelines, warehousing, BI' },
      { code: 'DEPT_PRODMGMT', name: 'Product Management',              fnCode: 'FN_PROD',  desc: 'Core product, platform product, growth' },
      { code: 'DEPT_UXDES',    name: 'UX & Product Design',             fnCode: 'FN_DESIGN',desc: 'Interaction design, visual design, design systems' },
      { code: 'DEPT_BRAND',    name: 'Brand & Content Marketing',       fnCode: 'FN_MKTG',  desc: 'Brand identity, content, PR' },
      { code: 'DEPT_GROWTH',   name: 'Growth & Performance Marketing',  fnCode: 'FN_MKTG',  desc: 'Paid, SEO, CRO, lifecycle' },
      { code: 'DEPT_INSSALES', name: 'Inside Sales',                    fnCode: 'FN_SALES', desc: 'SDR, BDR, inbound, outbound' },
      { code: 'DEPT_ENTSALES', name: 'Enterprise & Strategic Sales',    fnCode: 'FN_SALES', desc: 'Large account, strategic partnerships' },
      { code: 'DEPT_BIZOPS',   name: 'Business Operations',             fnCode: 'FN_OPS',   desc: 'Process, strategy execution, program management' },
      { code: 'DEPT_TALENT',   name: 'Talent Acquisition',              fnCode: 'FN_HR',    desc: 'Recruiting, employer brand, onboarding' },
      { code: 'DEPT_LD',       name: 'Learning & Development',          fnCode: 'FN_HR',    desc: 'Training, coaching, capability building' },
      { code: 'DEPT_FPA',      name: 'Financial Planning & Analysis',   fnCode: 'FN_FIN',   desc: 'Budgeting, forecasting, investor relations' },
      { code: 'DEPT_LEGAL',    name: 'Corporate Legal & Compliance',    fnCode: 'FN_LEGAL', desc: 'Contracts, IP, regulatory compliance' },
      { code: 'DEPT_CXSUP',    name: 'Customer Experience & Support',   fnCode: 'FN_CS',    desc: 'Tier 1/2 support, success management' },
      { code: 'DEPT_ITSEC',    name: 'IT & Security',                   fnCode: 'FN_IT',    desc: 'Infra, apps, cybersecurity' },
      { code: 'DEPT_CLRES',    name: 'Clinical & Applied Research',     fnCode: 'FN_RD',    desc: 'R&D, clinical trials, innovation labs' },
      { code: 'DEPT_PROCURE',  name: 'Procurement & Vendor Management', fnCode: 'FN_SCM',   desc: 'Strategic sourcing, vendor relations' },
      { code: 'DEPT_STRATEGY', name: 'Corporate Strategy & Insights',   fnCode: 'FN_STRAT', desc: 'Strategic planning, M&A, market intelligence' },
    ];
    for (const d of depts) {
      const fid = fnIds.get(d.fnCode);
      await pool.query(
        `INSERT INTO ont_departments (code, name, description, function_id, status) VALUES ($1,$2,$3,$4,'published') ON CONFLICT (code) DO NOTHING`,
        [d.code, d.name, d.desc ?? null, fid ?? null],
      );
    }
    phases.departments = depts.length;
    const deptIds = await lookupCodes(pool, 'ont_departments', depts.map(d => d.code));

    // ── 5. ROLE FAMILIES ──────────────────────────────────────────────────────
    const roleFamilies: Array<{ code: string; name: string; deptCode: string; archetype: string }> = [
      { code: 'RF_SOFTENGG', name: 'Software Engineering',       deptCode: 'DEPT_SFTDEV',   archetype: 'ic' },
      { code: 'RF_DATA',     name: 'Data & Analytics',           deptCode: 'DEPT_DATASCI',  archetype: 'ic' },
      { code: 'RF_PROD',     name: 'Product Management',         deptCode: 'DEPT_PRODMGMT', archetype: 'cross_functional' },
      { code: 'RF_DESIGN',   name: 'Design & User Experience',   deptCode: 'DEPT_UXDES',    archetype: 'ic' },
      { code: 'RF_GTM',      name: 'Go-to-Market & Sales',       deptCode: 'DEPT_INSSALES', archetype: 'specialist' },
      { code: 'RF_OPS',      name: 'Operations & Strategy',      deptCode: 'DEPT_BIZOPS',   archetype: 'management' },
      { code: 'RF_PEOPLE',   name: 'People & Culture',           deptCode: 'DEPT_TALENT',   archetype: 'cross_functional' },
      { code: 'RF_FIN',      name: 'Finance & Accounting',       deptCode: 'DEPT_FPA',      archetype: 'specialist' },
    ];
    for (const rf of roleFamilies) {
      const did = deptIds.get(rf.deptCode);
      await pool.query(
        `INSERT INTO ont_role_families (code, name, department_id, career_track_archetype, status) VALUES ($1,$2,$3,$4,'published') ON CONFLICT (code) DO NOTHING`,
        [rf.code, rf.name, did ?? null, rf.archetype],
      );
    }
    phases.role_families = roleFamilies.length;
    const rfIds = await lookupCodes(pool, 'ont_role_families', roleFamilies.map(r => r.code));

    // ── 6. ROLES ──────────────────────────────────────────────────────────────
    const roles: Array<{ code: string; title: string; rfCode: string; seniority: string; isLeader?: boolean }> = [
      { code: 'ROLE_JR_SWE',    title: 'Junior Software Engineer',       rfCode: 'RF_SOFTENGG', seniority: 'junior' },
      { code: 'ROLE_SWE',       title: 'Software Engineer',              rfCode: 'RF_SOFTENGG', seniority: 'mid' },
      { code: 'ROLE_SR_SWE',    title: 'Senior Software Engineer',       rfCode: 'RF_SOFTENGG', seniority: 'senior' },
      { code: 'ROLE_STAFF_ENG', title: 'Staff Engineer',                 rfCode: 'RF_SOFTENGG', seniority: 'principal' },
      { code: 'ROLE_BE_ENG',    title: 'Backend Engineer',               rfCode: 'RF_SOFTENGG', seniority: 'mid' },
      { code: 'ROLE_SR_BE_ENG', title: 'Senior Backend Engineer',        rfCode: 'RF_SOFTENGG', seniority: 'senior' },
      { code: 'ROLE_ENG_MGR',   title: 'Engineering Manager',            rfCode: 'RF_SOFTENGG', seniority: 'manager',   isLeader: true },
      { code: 'ROLE_DA',        title: 'Data Analyst',                   rfCode: 'RF_DATA',     seniority: 'mid' },
      { code: 'ROLE_DS',        title: 'Data Scientist',                 rfCode: 'RF_DATA',     seniority: 'mid' },
      { code: 'ROLE_SR_DS',     title: 'Senior Data Scientist',          rfCode: 'RF_DATA',     seniority: 'senior' },
      { code: 'ROLE_DATA_LEAD', title: 'Data & Analytics Lead',          rfCode: 'RF_DATA',     seniority: 'lead' },
      { code: 'ROLE_APM',       title: 'Associate Product Manager',      rfCode: 'RF_PROD',     seniority: 'junior' },
      { code: 'ROLE_PM',        title: 'Product Manager',                rfCode: 'RF_PROD',     seniority: 'mid' },
      { code: 'ROLE_SR_PM',     title: 'Senior Product Manager',         rfCode: 'RF_PROD',     seniority: 'senior' },
      { code: 'ROLE_UX',        title: 'UX Designer',                    rfCode: 'RF_DESIGN',   seniority: 'mid' },
      { code: 'ROLE_SR_UX',     title: 'Senior UX Designer',             rfCode: 'RF_DESIGN',   seniority: 'senior' },
      { code: 'ROLE_DES_LEAD',  title: 'Design Lead',                    rfCode: 'RF_DESIGN',   seniority: 'lead' },
      { code: 'ROLE_BDR',       title: 'Business Development Rep',       rfCode: 'RF_GTM',      seniority: 'junior' },
      { code: 'ROLE_AE',        title: 'Account Executive',              rfCode: 'RF_GTM',      seniority: 'mid' },
      { code: 'ROLE_SR_AE',     title: 'Senior Account Executive',       rfCode: 'RF_GTM',      seniority: 'senior' },
      { code: 'ROLE_SALES_MGR', title: 'Sales Manager',                  rfCode: 'RF_GTM',      seniority: 'manager',   isLeader: true },
      { code: 'ROLE_OPS_AN',    title: 'Operations Analyst',             rfCode: 'RF_OPS',      seniority: 'mid' },
      { code: 'ROLE_OPS_MGR',   title: 'Operations Manager',             rfCode: 'RF_OPS',      seniority: 'manager',   isLeader: true },
      { code: 'ROLE_HRBP',      title: 'HR Business Partner',            rfCode: 'RF_PEOPLE',   seniority: 'mid' },
      { code: 'ROLE_SR_HRBP',   title: 'Senior HR Business Partner',     rfCode: 'RF_PEOPLE',   seniority: 'senior' },
      { code: 'ROLE_FIN_AN',    title: 'Financial Analyst',              rfCode: 'RF_FIN',      seniority: 'mid' },
    ];
    for (const r of roles) {
      const rfid = rfIds.get(r.rfCode);
      await pool.query(
        `INSERT INTO ont_roles (code, title, role_family_id, seniority_level, is_leadership, status) VALUES ($1,$2,$3,$4,$5,'published') ON CONFLICT (code) DO NOTHING`,
        [r.code, r.title, rfid ?? null, r.seniority, r.isLeader ?? false],
      );
    }
    phases.roles = roles.length;

    // ── 7. LAYERS ─────────────────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO ont_layers (code, name, description, layer_type, scoring_weight, sort_order, status) VALUES
        ('L_FOUNDATION', 'Foundation',           'Core professional behaviours and mindsets every practitioner needs, regardless of role', 'proficiency', 1.000, 1, 'published'),
        ('L_FUNCTIONAL', 'Functional Core',      'Role-specific technical and domain skills directly tied to job responsibilities',        'functional',  1.200, 2, 'published'),
        ('L_LEADERSHIP', 'Leadership & Influence','Managing teams, stakeholders, and organisational change at scale',                    'leadership',  1.400, 3, 'published'),
        ('L_SPECIALIST', 'Specialist Mastery',   'Advanced domain expertise that distinguishes top performers and thought leaders',       'specialist',  1.600, 4, 'published')
      ON CONFLICT (code) DO NOTHING
    `);
    phases.layers = 4;
    const layerIds = await lookupCodes(pool, 'ont_layers', ['L_FOUNDATION','L_FUNCTIONAL','L_LEADERSHIP','L_SPECIALIST']);

    // ── 8. COMPETENCY CLUSTERS ────────────────────────────────────────────────
    const clusters: Array<{ code: string; name: string; layerCode: string; category: string; color: string }> = [
      { code: 'CC_PROF',     name: 'Professional Foundations',      layerCode: 'L_FOUNDATION', category: 'behavioral',    color: '#10B981' },
      { code: 'CC_COMM',     name: 'Communication & Collaboration', layerCode: 'L_FOUNDATION', category: 'behavioral',    color: '#3B82F6' },
      { code: 'CC_LEARN',    name: 'Learning Agility',              layerCode: 'L_FOUNDATION', category: 'cognitive',     color: '#6366F1' },
      { code: 'CC_TECH',     name: 'Technical Proficiency',         layerCode: 'L_FUNCTIONAL', category: 'technical',     color: '#0EA5E9' },
      { code: 'CC_ANALYT',   name: 'Analytical & Critical Thinking',layerCode: 'L_FUNCTIONAL', category: 'cognitive',     color: '#8B5CF6' },
      { code: 'CC_DOMAIN',   name: 'Domain Knowledge',              layerCode: 'L_FUNCTIONAL', category: 'domain',        color: '#F59E0B' },
      { code: 'CC_PEOPLE',   name: 'People Leadership',             layerCode: 'L_LEADERSHIP', category: 'leadership',    color: '#EC4899' },
      { code: 'CC_STKH',     name: 'Stakeholder Management',        layerCode: 'L_LEADERSHIP', category: 'leadership',    color: '#EF4444' },
      { code: 'CC_STRAT',    name: 'Strategic Influence',           layerCode: 'L_LEADERSHIP', category: 'leadership',    color: '#F97316' },
      { code: 'CC_TMASTER',  name: 'Technical Mastery',             layerCode: 'L_SPECIALIST', category: 'technical',     color: '#06B6D4' },
      { code: 'CC_INNOV',    name: 'Innovation & Problem Solving',  layerCode: 'L_SPECIALIST', category: 'cognitive',     color: '#84CC16' },
      { code: 'CC_BIZ',      name: 'Business Acumen',               layerCode: 'L_SPECIALIST', category: 'cross_functional', color: '#A78BFA' },
    ];
    for (const c of clusters) {
      const lid = layerIds.get(c.layerCode);
      await pool.query(
        `INSERT INTO ont_competency_clusters (code, name, layer_id, category, color_hex, sort_order, status) VALUES ($1,$2,$3,$4,$5,0,'published') ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, lid ?? null, c.category, c.color],
      );
    }
    phases.clusters = clusters.length;
    const clusterIds = await lookupCodes(pool, 'ont_competency_clusters', clusters.map(c => c.code));

    // Layer → Cluster mappings
    for (const c of clusters) {
      const lid = layerIds.get(c.layerCode); const cid = clusterIds.get(c.code);
      if (lid && cid) {
        await pool.query(
          `INSERT INTO map_layer_cluster (layer_id, cluster_id, weight) VALUES ($1,$2,1.0) ON CONFLICT (layer_id, cluster_id) DO NOTHING`,
          [lid, cid],
        );
      }
    }

    // ── 9. COMPETENCIES ───────────────────────────────────────────────────────
    const competencies: Array<{ code: string; name: string; clusterCode: string; type: string; desc: string }> = [
      { code: 'C_ACCOUNT',   name: 'Accountability & Ownership',       clusterCode: 'CC_PROF',    type: 'core',       desc: 'Takes responsibility for outcomes, delivers on commitments reliably' },
      { code: 'C_ETHICS',    name: 'Integrity & Professional Ethics',  clusterCode: 'CC_PROF',    type: 'threshold',  desc: 'Acts with honesty, transparency, and respect in all professional interactions' },
      { code: 'C_COMM_EFF',  name: 'Effective Communication',         clusterCode: 'CC_COMM',    type: 'core',       desc: 'Articulates ideas clearly in writing, speech, and presentations across audiences' },
      { code: 'C_COLLAB',    name: 'Cross-functional Collaboration',  clusterCode: 'CC_COMM',    type: 'core',       desc: 'Builds productive working relationships across teams and disciplines' },
      { code: 'C_GROWTH',    name: 'Growth Mindset & Self-Awareness', clusterCode: 'CC_LEARN',   type: 'behavioral', desc: 'Proactively seeks feedback, embraces learning from failure' },
      { code: 'C_ADAPT',     name: 'Adaptability & Resilience',       clusterCode: 'CC_LEARN',   type: 'behavioral', desc: 'Navigates ambiguity and change with composure and resourcefulness' },
      { code: 'C_TECH_CORE', name: 'Core Technical Skills',           clusterCode: 'CC_TECH',    type: 'functional', desc: 'Demonstrates mastery of the foundational technical competencies for the role' },
      { code: 'C_TOOLS',     name: 'Tools & Platform Mastery',        clusterCode: 'CC_TECH',    type: 'functional', desc: 'Fluent with the tools, systems, and platforms central to the function' },
      { code: 'C_DATA_DEC',  name: 'Data-Driven Decision Making',     clusterCode: 'CC_ANALYT',  type: 'core',       desc: 'Uses data and evidence to make structured, defensible decisions' },
      { code: 'C_PROB_SOLV', name: 'Structured Problem Solving',      clusterCode: 'CC_ANALYT',  type: 'core',       desc: 'Applies systematic frameworks to decompose and resolve complex problems' },
      { code: 'C_IND_KNW',   name: 'Industry & Business Knowledge',   clusterCode: 'CC_DOMAIN',  type: 'domain',     desc: 'Understands the business model, competitive landscape, and sector dynamics' },
      { code: 'C_DOMAIN',    name: 'Domain Expertise',                clusterCode: 'CC_DOMAIN',  type: 'domain',     desc: 'Deep knowledge of the specialist domain relevant to the role' },
      { code: 'C_TEAM_DEV',  name: 'Team Development & Coaching',     clusterCode: 'CC_PEOPLE',  type: 'leadership', desc: 'Develops, coaches, and grows people to achieve their potential' },
      { code: 'C_PERF_MGT',  name: 'Performance Management',         clusterCode: 'CC_PEOPLE',  type: 'leadership', desc: 'Sets clear expectations, provides feedback, and manages performance with fairness' },
      { code: 'C_EXEC_COMM', name: 'Executive Communication',         clusterCode: 'CC_STKH',    type: 'leadership', desc: 'Communicates effectively with senior stakeholders and boards' },
      { code: 'C_CONFLICT',  name: 'Conflict Resolution & Negotiation',clusterCode: 'CC_STKH',   type: 'leadership', desc: 'Navigates disagreements constructively and reaches durable agreements' },
      { code: 'C_VISION',    name: 'Vision & Direction Setting',      clusterCode: 'CC_STRAT',   type: 'leadership', desc: 'Articulates a compelling future state and aligns teams toward it' },
      { code: 'C_CHANGE',    name: 'Change Leadership',               clusterCode: 'CC_STRAT',   type: 'leadership', desc: 'Leads organisations through transformation with clarity and engagement' },
      { code: 'C_TECH_DEEP', name: 'Advanced Technical Depth',        clusterCode: 'CC_TMASTER', type: 'specialist', desc: 'Demonstrates rare depth of technical knowledge beyond peer level' },
      { code: 'C_THOUGHT',   name: 'Thought Leadership',              clusterCode: 'CC_TMASTER', type: 'specialist', desc: 'Shapes the discipline through research, writing, or community contribution' },
      { code: 'C_CREATIVE',  name: 'Creative Problem Solving',        clusterCode: 'CC_INNOV',   type: 'specialist', desc: 'Generates original, high-value solutions to ambiguous challenges' },
      { code: 'C_EXPERIMENT',name: 'Experimentation & Iteration',     clusterCode: 'CC_INNOV',   type: 'specialist', desc: 'Runs disciplined experiments to validate hypotheses and accelerate learning' },
      { code: 'C_COMMERC',   name: 'Commercial Awareness',            clusterCode: 'CC_BIZ',     type: 'specialist', desc: 'Understands how decisions affect revenue, cost, margin, and customer value' },
      { code: 'C_EXEC_PRES', name: 'Executive Presence & Judgment',  clusterCode: 'CC_BIZ',     type: 'specialist', desc: 'Inspires confidence and trust in senior audiences through substance and gravitas' },
    ];
    for (const c of competencies) {
      const cid = clusterIds.get(c.clusterCode);
      await pool.query(
        `INSERT INTO ont_competencies (code, name, description, cluster_id, competency_type, is_measurable, is_threshold, status)
         VALUES ($1,$2,$3,$4,$5,true,$6,'published')
         ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, c.desc, cid ?? null, c.type, c.type === 'threshold'],
      );
    }
    phases.competencies = competencies.length;
    const compIds = await lookupCodes(pool, 'ont_competencies', competencies.map(c => c.code));

    // Cluster → Competency mappings
    for (const c of competencies) {
      const clid = clusterIds.get(c.clusterCode); const cid = compIds.get(c.code);
      if (clid && cid) {
        await pool.query(
          `INSERT INTO map_cluster_competency (cluster_id, competency_id, is_primary) VALUES ($1,$2,true) ON CONFLICT (cluster_id, competency_id) DO NOTHING`,
          [clid, cid],
        );
      }
    }

    // ── 10. MICRO COMPETENCIES ────────────────────────────────────────────────
    const micros: Array<{
      code: string; name: string; compCode: string; level: string;
      obs: string; absence: string; focus: string;
    }> = [
      // C_ACCOUNT — Accountability & Ownership
      { code: 'MC_ACCOUNT_NOV', compCode: 'C_ACCOUNT', level: 'novice',
        name: 'Meeting Commitments (Novice)',
        obs:  'Completes assigned tasks by agreed deadlines with prompting from manager',
        absence: 'Misses deadlines without proactively flagging blockers',
        focus: 'Practice communicating progress and risks early' },
      { code: 'MC_ACCOUNT_INT', compCode: 'C_ACCOUNT', level: 'intermediate',
        name: 'Outcome Ownership (Intermediate)',
        obs:  'Owns the full outcome of an initiative — not just activities — and course-corrects independently',
        absence: 'Focuses on task completion over impact; deflects when outcomes fall short',
        focus: 'Define success metrics before starting; retrospect on impact not effort' },

      // C_ETHICS — Integrity
      { code: 'MC_ETHICS_NOV', compCode: 'C_ETHICS', level: 'novice',
        name: 'Honest Reporting (Novice)',
        obs:  'Reports status and results accurately, including unfavourable information',
        absence: 'Omits or softens bad news to avoid conflict',
        focus: 'Practise delivering honest updates using structured formats' },
      { code: 'MC_ETHICS_INT', compCode: 'C_ETHICS', level: 'intermediate',
        name: 'Ethical Escalation (Intermediate)',
        obs:  'Proactively raises ethical concerns through appropriate channels, even when uncomfortable',
        absence: 'Lets known policy violations go unreported to avoid friction',
        focus: 'Study ethical decision frameworks; role-play escalation scenarios' },

      // C_COMM_EFF — Effective Communication
      { code: 'MC_COMM_NOV', compCode: 'C_COMM_EFF', level: 'novice',
        name: 'Clear Written Updates (Novice)',
        obs:  'Writes structured, concise status updates and messages understood on first read',
        absence: 'Writes lengthy or ambiguous messages requiring clarification',
        focus: 'Apply BLUF (Bottom Line Up Front) format to all written communication' },
      { code: 'MC_COMM_INT', compCode: 'C_COMM_EFF', level: 'intermediate',
        name: 'Audience-Adaptive Messaging (Intermediate)',
        obs:  'Adjusts tone, detail level, and medium to fit the audience and context',
        absence: 'Uses one style for all audiences; technical detail with executives or no depth with engineers',
        focus: 'Before each communication, define the audience, their goal, and what action you need' },

      // C_COLLAB — Collaboration
      { code: 'MC_COLLAB_NOV', compCode: 'C_COLLAB', level: 'novice',
        name: 'Responsive Collaboration (Novice)',
        obs:  'Responds to requests from cross-functional partners promptly and helpfully',
        absence: 'Delays responses, creating blockers for other teams',
        focus: 'Set SLA expectations with partners and meet them consistently' },
      { code: 'MC_COLLAB_INT', compCode: 'C_COLLAB', level: 'intermediate',
        name: 'Proactive Partnership (Intermediate)',
        obs:  'Proactively identifies dependencies and aligns with stakeholders before friction arises',
        absence: 'Waits for others to surface misalignment; surprised by cross-team blockers',
        focus: 'Map stakeholders at the start of each project; build alignment check-ins into workflows' },

      // C_GROWTH — Growth Mindset
      { code: 'MC_GROWTH_NOV', compCode: 'C_GROWTH', level: 'novice',
        name: 'Feedback Seeking (Novice)',
        obs:  'Actively requests specific feedback from peers and manager after key deliverables',
        absence: 'Avoids requesting feedback; interprets silence as approval',
        focus: 'Schedule a feedback conversation within one week of every major milestone' },
      { code: 'MC_GROWTH_INT', compCode: 'C_GROWTH', level: 'intermediate',
        name: 'Learning From Failure (Intermediate)',
        obs:  'Extracts actionable lessons from setbacks without prolonged self-criticism',
        absence: 'Blames external factors or dwells unproductively after failures',
        focus: 'Run structured retrospectives; distinguish controllable vs. uncontrollable factors' },

      // C_ADAPT — Adaptability
      { code: 'MC_ADAPT_NOV', compCode: 'C_ADAPT', level: 'novice',
        name: 'Handling Change (Novice)',
        obs:  'Adjusts work plans promptly when priorities shift without excessive friction',
        absence: 'Expresses persistent resistance to changes in scope or direction',
        focus: 'Develop a mental model of "change as information"; practise replanning quickly' },
      { code: 'MC_ADAPT_INT', compCode: 'C_ADAPT', level: 'intermediate',
        name: 'Ambiguity Navigation (Intermediate)',
        obs:  'Makes progress on unclear or poorly-specified problems without waiting for full clarity',
        absence: 'Stalls on tasks when requirements are incomplete; frequently escalates for guidance',
        focus: 'Adopt a 70%-clarity threshold model; document assumptions and revisit' },

      // C_DATA_DEC — Data-Driven Decisions
      { code: 'MC_DATADEC_NOV', compCode: 'C_DATA_DEC', level: 'novice',
        name: 'Evidence-Based Reasoning (Novice)',
        obs:  'Supports recommendations with data, not just opinions or anecdotes',
        absence: 'Makes assertions without citing evidence; ignores contradictory data',
        focus: 'Practise structuring every recommendation with a "data says" section' },
      { code: 'MC_DATADEC_ADV', compCode: 'C_DATA_DEC', level: 'advanced',
        name: 'Uncertainty Quantification (Advanced)',
        obs:  'Quantifies confidence levels and surfaces uncertainty ranges in all analyses',
        absence: 'Presents point estimates without confidence intervals; overstates precision',
        focus: 'Learn Bayesian reasoning; always report data range, sample size, and caveats' },

      // C_TEAM_DEV — Team Development
      { code: 'MC_TEAMDEV_INT', compCode: 'C_TEAM_DEV', level: 'intermediate',
        name: 'Coaching Conversations (Intermediate)',
        obs:  'Holds regular 1:1s with clear development discussions, not just status updates',
        absence: '1:1s focus only on tasks; team members cannot articulate their development goals',
        focus: 'Adopt a coaching framework (GROW or similar); log development commitments in writing' },
      { code: 'MC_TEAMDEV_ADV', compCode: 'C_TEAM_DEV', level: 'advanced',
        name: 'Succession Planning (Advanced)',
        obs:  'Intentionally develops team members who could take on the manager\'s responsibilities',
        absence: 'Creates single points of failure; team is not empowered to operate without the leader',
        focus: 'Identify a successor for each critical role; create stretch assignments to close gaps' },

      // C_VISION — Vision Setting
      { code: 'MC_VISION_ADV', compCode: 'C_VISION', level: 'advanced',
        name: 'Compelling Narrative (Advanced)',
        obs:  'Articulates a future state in language that resonates emotionally and logically with diverse audiences',
        absence: 'Vision statements are generic, abstract, or not memorable',
        focus: 'Use the "from → to" story structure; test the vision with 5 people outside your function' },
      { code: 'MC_VISION_EXP', compCode: 'C_VISION', level: 'expert',
        name: 'Cross-org Alignment (Expert)',
        obs:  'Aligns multiple business units or external partners around a shared multi-year direction',
        absence: 'Each function pursues its own interpretation of strategy; misalignment surfaces at delivery',
        focus: 'Map competing priorities explicitly; facilitate co-creation sessions across org boundaries' },

      // C_CREATIVE — Creative Problem Solving
      { code: 'MC_CREATIVE_INT', compCode: 'C_CREATIVE', level: 'intermediate',
        name: 'Reframing Problems (Intermediate)',
        obs:  'Challenges the initial problem statement to discover higher-value solutions',
        absence: 'Accepts problem framing at face value; optimises the wrong thing',
        focus: 'Apply "5 Whys" and "How Might We" techniques before solution generation' },
      { code: 'MC_CREATIVE_ADV', compCode: 'C_CREATIVE', level: 'advanced',
        name: 'Novel Solution Generation (Advanced)',
        obs:  'Generates ideas that are genuinely new to the organisation, not analogies from prior roles',
        absence: 'Ideas are incrementally better versions of existing approaches',
        focus: 'Study adjacent industries for transferable patterns; practise analogical reasoning' },
    ];
    for (const m of micros) {
      const cid = compIds.get(m.compCode);
      if (!cid) continue;
      await pool.query(
        `INSERT INTO ont_micro_competencies
           (code, name, competency_id, proficiency_level, observable_behavior, absence_indicator, development_focus, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'published')
         ON CONFLICT (code) DO NOTHING`,
        [m.code, m.name, cid, m.level, m.obs, m.absence, m.focus],
      );
    }
    phases.micro_competencies = micros.length;

    // ── 11. ONTOLOGY CONCERNS ─────────────────────────────────────────────────
    // RETIRED: concerns are now sourced from CAPADEX (capadex_concerns_master) as the
    // single source of truth, mirrored into ont_concerns by the "Sync from CAPADEX"
    // endpoint (POST /api/ontology/ont-concerns/sync-from-capadex). The previous demo
    // seed authored a parallel competency-model concern list, which contradicted that —
    // so it is intentionally no longer inserted here. Concern→indicator demo mappings
    // below degrade gracefully when no concerns are present (guarded by `if (cid && iid)`).
    phases.concerns = 0;

    // ── 12. INDICATORS ────────────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO ont_indicators (code, label, concern_bridge_tag, signal_type, polarity, weight, description, status) VALUES
        ('IND_PARA_01', 'Repeatedly postpones decisions pending "more data"',        'DECISION_MAKING_PARALYSIS', 'behavioural', 'negative', 0.80, 'Observable in performance reviews and project timelines', 'published'),
        ('IND_PARA_02', 'Solicits unnecessary approvals before acting',              'DECISION_MAKING_PARALYSIS', 'behavioural', 'negative', 0.70, 'Requires multiple sign-offs for routine decisions', 'published'),
        ('IND_COMM_01', 'Avoids raising concerns in group settings',                 'COMMUNICATION_AVOIDANCE',  'behavioural', 'negative', 0.75, 'Silent in meetings where disagreement is expected', 'published'),
        ('IND_COMM_02', 'Delays responding to difficult messages',                   'COMMUNICATION_AVOIDANCE',  'behavioural', 'negative', 0.65, 'Slow turnaround on challenging stakeholder requests', 'published'),
        ('IND_DELG_01', 'Redoes work delegated to team members',                     'DELEGATION_AVOIDANCE',     'behavioural', 'negative', 0.80, 'Team output consistently revised post-delivery', 'published'),
        ('IND_DELG_02', 'Carries disproportionate workload relative to peers',       'DELEGATION_AVOIDANCE',     'behavioural', 'negative', 0.70, 'Consistent late nights; team operating below capacity', 'published'),
        ('IND_IMP_01',  'Minimises own contributions in group settings',             'SELF_DOUBT_CYCLE',         'behavioural', 'negative', 0.75, 'Attributes successes to luck or team, failures to self', 'published'),
        ('IND_IMP_02',  'Reluctant to represent expertise to senior audiences',      'SELF_DOUBT_CYCLE',         'behavioural', 'negative', 0.80, 'Defers to others or qualifies all contributions heavily', 'published'),
        ('IND_PERF_01', 'Misses deadlines due to perfectionism on low-stakes tasks', 'PERFECTIONISM',            'behavioural', 'negative', 0.75, 'Effort-to-impact ratio significantly above baseline', 'published'),
        ('IND_PERF_02', 'Difficulty shipping at 80% quality when speed matters',     'PERFECTIONISM',            'behavioural', 'negative', 0.70, 'Known to re-do finished work before publishing', 'published'),
        ('IND_FEED_01', 'Rarely seeks feedback outside structured review cycles',    'FEEDBACK_AVOIDANCE',       'behavioural', 'negative', 0.75, 'No informal feedback requests between formal reviews', 'published'),
        ('IND_BURN_01', 'Consistently works beyond sustainable hours without flagging','CHRONIC_STRESS',          'behavioural', 'negative', 0.85, 'Calendar / late communication patterns indicate overload', 'published')
      ON CONFLICT (code) DO NOTHING
    `);
    phases.indicators = 12;
    const indIdMap = await lookupCodes(pool, 'ont_indicators', [
      'IND_PARA_01','IND_PARA_02','IND_COMM_01','IND_COMM_02','IND_DELG_01','IND_DELG_02',
      'IND_IMP_01','IND_IMP_02','IND_PERF_01','IND_PERF_02','IND_FEED_01','IND_BURN_01',
    ]);
    const concIds = await lookupCodes(pool, 'ont_concerns', [
      'ONT_C_PARALYSS','ONT_C_COMM_AV','ONT_C_DELEGATE','ONT_C_IMPOSTER',
      'ONT_C_PERF','ONT_C_SCOPE','ONT_C_FEEDBACK','ONT_C_BURNOUT',
    ]);

    // Concern → Indicator mappings
    const concIndPairs: [string, string, boolean][] = [
      ['ONT_C_PARALYSS', 'IND_PARA_01', true],  ['ONT_C_PARALYSS', 'IND_PARA_02', false],
      ['ONT_C_COMM_AV',  'IND_COMM_01', true],  ['ONT_C_COMM_AV',  'IND_COMM_02', false],
      ['ONT_C_DELEGATE', 'IND_DELG_01', true],  ['ONT_C_DELEGATE', 'IND_DELG_02', false],
      ['ONT_C_IMPOSTER', 'IND_IMP_01',  true],  ['ONT_C_IMPOSTER', 'IND_IMP_02',  false],
      ['ONT_C_PERF',     'IND_PERF_01', true],  ['ONT_C_PERF',     'IND_PERF_02', false],
      ['ONT_C_FEEDBACK', 'IND_FEED_01', true],
      ['ONT_C_BURNOUT',  'IND_BURN_01', true],
    ];
    for (const [cc, ic, isPrimary] of concIndPairs) {
      const cid = concIds.get(cc); const iid = indIdMap.get(ic);
      if (cid && iid) {
        await pool.query(
          `INSERT INTO map_concern_indicator (concern_id, indicator_id, weight, is_primary) VALUES ($1,$2,0.8,$3) ON CONFLICT (concern_id, indicator_id) DO NOTHING`,
          [cid, iid, isPrimary],
        );
      }
    }
    phases.map_concern_indicator = concIndPairs.length;

    // ── 13. ASSESSMENT QUESTIONS ──────────────────────────────────────────────
    await pool.query(`
      INSERT INTO ont_assessment_questions (code, stem, assessment_type, response_format, polarity, reverse_score, difficulty_tier, time_estimate_secs, status) VALUES
        ('AQ_PARA_01', 'How often do you find yourself waiting for additional information before making a decision, even when the deadline is close?',       'behavioral', 'likert_5', 'negative', true,  'medium', 90, 'published'),
        ('AQ_PARA_02', 'When faced with an important choice, how frequently do you feel paralysed by the possibility of making the wrong decision?',        'behavioral', 'likert_5', 'negative', true,  'hard',   90, 'published'),
        ('AQ_COMM_01', 'When you disagree with a colleague''s approach in a meeting, how likely are you to voice your perspective directly?',              'situational','likert_5', 'positive', false, 'medium', 90, 'published'),
        ('AQ_COMM_02', 'Describe how you handle a situation where you need to deliver difficult feedback to a peer who is sensitive to criticism.',         'behavioral', 'open_text','positive', false, 'hard',   180,'published'),
        ('AQ_DELG_01', 'After assigning a task to a team member, how often do you find yourself completing or redoing the work yourself?',                 'behavioral', 'likert_5', 'negative', true,  'medium', 90, 'published'),
        ('AQ_IMP_01',  'When you receive recognition for a significant achievement, how naturally does it feel deserved vs. due to luck or others'' help?','behavioral', 'likert_5', 'positive', false, 'hard',   90, 'published'),
        ('AQ_IMP_02',  'How comfortable are you presenting your expert opinion to an audience of senior leaders in your organisation?',                    'situational','likert_5', 'positive', false, 'medium', 90, 'published'),
        ('AQ_PERF_01', 'How often do you delay submitting work because you are not fully satisfied with its quality, even when it meets the requirements?', 'behavioral', 'likert_5', 'negative', true,  'medium', 90, 'published'),
        ('AQ_FEED_01', 'Over the past month, how many times have you proactively sought informal feedback on your work or behaviour?',                     'behavioral', 'likert_5', 'positive', false, 'easy',   60, 'published'),
        ('AQ_FEED_02', 'When you receive feedback that surprises or challenges you, what is your typical first internal reaction?',                        'behavioral', 'open_text','positive', false, 'hard',   180,'published'),
        ('AQ_BURN_01', 'On average over the past month, how many hours per week did you work beyond your contracted or expected hours?',                   'self_report','likert_5', 'negative', true,  'easy',   60, 'published'),
        ('AQ_GROW_01', 'Describe the last time you changed your approach to a problem based on feedback or evidence that your original approach was wrong.','behavioral', 'open_text','positive', false, 'medium', 150,'published'),
        ('AQ_COLLAB_01','When a cross-functional dependency threatens your project timeline, what is your first action?',                                  'situational','mcq',      'positive', false, 'medium', 90, 'published'),
        ('AQ_ADAPT_01', 'How effectively do you continue to produce high-quality work when your role or priorities change significantly?',                  'behavioral', 'likert_5', 'positive', false, 'medium', 90, 'published'),
        ('AQ_VISION_01','Rate how clearly you can articulate the two-year vision for your team or function in a single sentence.',                         'self_report', 'rating_scale','positive',false,'medium', 60,'published'),
        ('AQ_DATA_01',  'When making a key decision without complete data, how do you communicate your confidence level to stakeholders?',                  'situational','open_text','positive', false, 'hard',   150,'published')
      ON CONFLICT (code) DO NOTHING
    `);
    phases.assessment_questions = 16;
    const qIds = await lookupCodes(pool, 'ont_assessment_questions', [
      'AQ_PARA_01','AQ_PARA_02','AQ_COMM_01','AQ_COMM_02','AQ_DELG_01','AQ_IMP_01',
      'AQ_IMP_02','AQ_PERF_01','AQ_FEED_01','AQ_FEED_02','AQ_BURN_01','AQ_GROW_01',
      'AQ_COLLAB_01','AQ_ADAPT_01','AQ_VISION_01','AQ_DATA_01',
    ]);

    // Add MCQ options for AQ_COLLAB_01
    const collabQId = qIds.get('AQ_COLLAB_01');
    if (collabQId) {
      const opts = [
        ['A', 'Immediately escalate to my manager to resolve the dependency', 1],
        ['B', 'Proactively reach out to the partner team to align on timeline', 5],
        ['C', 'Adjust my project plan to absorb the delay without communication', 2],
        ['D', 'Flag the risk in the next status update and wait for direction', 3],
      ];
      for (const [key, text, score] of opts) {
        await pool.query(
          `INSERT INTO ont_question_options (question_id, option_key, option_text, score_value, is_correct) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (question_id, option_key) DO NOTHING`,
          [collabQId, key, text, score, score === 5],
        );
      }
    }

    // Indicator → Question mappings
    const indQPairs: [string, string][] = [
      ['IND_PARA_01', 'AQ_PARA_01'], ['IND_PARA_02', 'AQ_PARA_02'],
      ['IND_COMM_01', 'AQ_COMM_01'], ['IND_COMM_02', 'AQ_COMM_02'],
      ['IND_DELG_01', 'AQ_DELG_01'],
      ['IND_IMP_01',  'AQ_IMP_01'],  ['IND_IMP_02',  'AQ_IMP_02'],
      ['IND_PERF_01', 'AQ_PERF_01'],
      ['IND_FEED_01', 'AQ_FEED_01'],
      ['IND_BURN_01', 'AQ_BURN_01'],
    ];
    for (const [ic, qc] of indQPairs) {
      const iid = indIdMap.get(ic); const qid = qIds.get(qc);
      if (iid && qid) {
        await pool.query(
          `INSERT INTO map_indicator_question (indicator_id, question_id, is_primary, weight) VALUES ($1,$2,true,1.0) ON CONFLICT (indicator_id, question_id) DO NOTHING`,
          [iid, qid],
        );
      }
    }
    phases.map_indicator_question = indQPairs.length;

    // Micro Competency → Concern mappings (where relevant)
    const microIds = await lookupCodes(pool, 'ont_micro_competencies', micros.map(m => m.code));
    const microConcernPairs: [string, string, number][] = [
      ['MC_GROWTH_NOV',  'ONT_C_FEEDBACK',  0.80],
      ['MC_GROWTH_INT',  'ONT_C_FEEDBACK',  0.75],
      ['MC_ACCOUNT_NOV', 'ONT_C_PERF',      0.60],
      ['MC_ACCOUNT_INT', 'ONT_C_PERF',      0.55],
      ['MC_ADAPT_NOV',   'ONT_C_PARALYSS',  0.65],
      ['MC_ADAPT_INT',   'ONT_C_PARALYSS',  0.60],
      ['MC_TEAMDEV_INT', 'ONT_C_DELEGATE',  0.80],
      ['MC_TEAMDEV_ADV', 'ONT_C_DELEGATE',  0.70],
      ['MC_COMM_NOV',    'ONT_C_COMM_AV',   0.75],
      ['MC_COMM_INT',    'ONT_C_COMM_AV',   0.65],
    ];
    for (const [mc, cc, prob] of microConcernPairs) {
      const mid = microIds.get(mc); const cid = concIds.get(cc);
      if (mid && cid) {
        await pool.query(
          `INSERT INTO map_micro_concern (micro_competency_id, concern_id, emergence_probability) VALUES ($1,$2,$3) ON CONFLICT (micro_competency_id, concern_id) DO NOTHING`,
          [mid, cid, prob],
        );
      }
    }
    phases.map_micro_concern = microConcernPairs.length;

    // ── 14. ROLE → LAYER MAPPINGS (selective — all roles get Foundation+Functional; leaders also get Leadership) ──
    const roleRows = await pool.query(`SELECT id, code, is_leadership FROM ont_roles WHERE code = ANY($1)`, [roles.map(r => r.code)]);
    const foundationId = layerIds.get('L_FOUNDATION');
    const functionalId = layerIds.get('L_FUNCTIONAL');
    const leadershipId = layerIds.get('L_LEADERSHIP');
    const specialistId = layerIds.get('L_SPECIALIST');
    let rlCount = 0;
    for (const row of roleRows.rows) {
      const layerList = [foundationId, functionalId];
      if (row.is_leadership) layerList.push(leadershipId);
      if (['ROLE_STAFF_ENG','ROLE_DATA_LEAD','ROLE_SR_PM','ROLE_DES_LEAD'].includes(row.code)) {
        layerList.push(specialistId);
      }
      for (const lid of layerList) {
        if (!lid) continue;
        await pool.query(
          `INSERT INTO map_role_layer (role_id, layer_id, is_mandatory) VALUES ($1,$2,true) ON CONFLICT (role_id, layer_id) DO NOTHING`,
          [row.id, lid],
        );
        rlCount++;
      }
    }
    phases.map_role_layer = rlCount;

    // ── 15. COMPETENCY LEVEL ANCHORS (BARS) ──────────────────────────────────
    const LEVELS = [
      { level: 'foundational', num: 1, min:  0, max:  39 },
      { level: 'developing', num: 2, min: 40, max:  59 },
      { level: 'proficient', num: 3, min: 60, max:  74 },
      { level: 'advanced',   num: 4, min: 75, max:  89 },
      { level: 'expert',     num: 5, min: 90, max: 100 },
    ];

    const barsData: Array<{ code: string; name: string; anchors: string[][]; evidence: string[][]; actions: string[][] }> = [
      {
        code: 'C_ACCOUNT', name: 'Accountability & Ownership',
        anchors: [
          ['Completes tasks when prompted by manager', 'Acknowledges shortfalls only when questioned', 'Rarely flags blockers before they escalate'],
          ['Meets personal deadlines proactively', 'Flags risks before they become critical', 'Accepts responsibility when outcomes fall short'],
          ['Owns initiative outcomes end-to-end', 'Delivers bad news early with a recovery plan', 'Builds systems to track concurrent commitments'],
          ['Creates accountability culture on team without micro-managing', 'Holds peers to commitments diplomatically', 'Ties retrospectives to impact, not effort'],
          ['Sets the accountability standard across the organisation', 'Designs structural accountability systems that outlast individuals', 'Coaches managers on embedding accountability culture'],
        ],
        evidence: [
          ['Manager prompts required on most recurring tasks', 'Misses attributed to external factors'],
          ['Consistent on-time delivery; proactively communicates timeline shifts', 'Blockers escalated before becoming critical'],
          ['No surprise misses; leads post-mortems that change behaviour', 'Stakeholders cite reliability as a defining trait'],
          ['Team delivery metrics improve under their leadership', 'Peers nominate them for follow-through'],
          ['Org-wide process changes attributed to their accountability model', 'Multi-team outcomes visibly improve'],
        ],
        actions: [
          ['Maintain a daily task tracker; review it every morning', 'Send weekly unprompted status updates to manager'],
          ['Write a commitment register for every project', 'Practice "bad news first" in all updates'],
          ['Lead a post-mortem on a missed outcome', 'Introduce team OKRs and review them weekly'],
          ['Coach a direct report through an accountability challenge', 'Run a shared commitment-tracking ritual'],
          ['Design an org-level accountability framework', 'Mentor two managers on accountability culture'],
        ],
      },
      {
        code: 'C_ETHICS', name: 'Integrity & Professional Ethics',
        anchors: [
          ['Reports status honestly when directly asked', 'Avoids obvious conflicts of interest', 'Follows stated policies and procedures'],
          ['Raises concerns about unethical practices even when uncomfortable', 'Discloses conflicts of interest proactively', 'Holds to commitments under moderate pressure'],
          ['Challenges unethical decisions regardless of seniority', 'Models transparency in all interactions', 'Creates psychological safety for others to raise concerns'],
          ['Shapes team ethical standards through explicit guidance', 'Known as the person others consult on ethical dilemmas', 'Builds processes that structurally reduce ethical risk'],
          ['Sets the ethical culture of the organisation', 'Contributes to industry standards on professional conduct', 'Cited as an integrity benchmark at every level'],
        ],
        evidence: [
          ['Policy adherent; no conduct issues raised', 'Honest when directly questioned'],
          ['Has raised at least one ethical concern unprompted', 'Acknowledged by peers for transparency'],
          ['Ethical challenges documented and resolved constructively', 'Zero reputational incidents on their work'],
          ['Team ethical incident rate low; culture of transparency', 'Leadership consults them on ambiguous situations'],
          ['Industry recognition for professional conduct', 'Ethical frameworks they authored still in use'],
        ],
        actions: [
          ['Read company code of conduct; discuss a grey area with manager', 'Identify one potential conflict and disclose proactively'],
          ['Speak up in one meeting where an ethical line is being approached', 'Document how a difficult decision was made and why'],
          ['Run an ethics discussion in a team retrospective', 'Map ethical risks in a project you are leading'],
          ['Create a decision-making framework with explicit ethical criteria', 'Mentor a junior through an ethical dilemma'],
          ['Contribute to industry ethics guidelines or forums', 'Lead an ethics review of an org-wide process'],
        ],
      },
      {
        code: 'C_COMM_EFF', name: 'Effective Communication',
        anchors: [
          ['Communicates clearly in one-on-one settings with prompting', 'Writes grammatically correct emails and documents', 'Struggles to calibrate message for different audiences'],
          ['Communicates clearly in small group settings', 'Writes structured messages that convey key points', 'Adapts tone modestly for different audiences'],
          ['Tailors communication style and depth to each audience', 'Presents complex topics clearly in writing and speech', 'Facilitates productive team discussions'],
          ['Influences beliefs and decisions through communication', 'Writes content cited or shared beyond original audience', 'Manages message across multiple competing stakeholders'],
          ['Sets the communication standard for the organisation', 'Represents the company externally to large audiences', 'Coaches others on high-stakes communication craft'],
        ],
        evidence: [
          ['Messages are clear but require follow-up for completeness', 'Presentations need significant preparation support'],
          ['Team acknowledges clarity of written updates', 'Meetings they facilitate stay on track'],
          ['Stakeholders cite clear communications; minimal ambiguity', 'Written artefacts circulated beyond original audience'],
          ['Cross-team alignment attributed to their communications', 'Leadership relies on them for key announcements'],
          ['All-hands or external communications seen as defining examples', 'Communication frameworks they built are reused'],
        ],
        actions: [
          ['Write a one-page summary of a complex idea and get feedback', 'Present in a team meeting without slides'],
          ['Shadow a senior communicator before a big presentation', 'Rewrite one document you know was unclear'],
          ['Present to a new audience (different function or seniority)', 'Get structured writing feedback from a colleague'],
          ['Run a communication workshop for your team', 'Write an org-wide post on a complex topic'],
          ['Speak at an industry event', 'Develop a communication style guide for your org'],
        ],
      },
      {
        code: 'C_COLLAB', name: 'Cross-functional Collaboration',
        anchors: [
          ['Works cooperatively within immediate team', 'Communicates politely with other teams when required', 'Seeks own team input before cross-functional decisions'],
          ['Proactively shares information with adjacent teams', 'Raises cross-team dependencies before they cause delays', 'Builds relationships outside immediate team'],
          ['Drives cross-functional initiatives to outcomes', 'Resolves cross-team conflicts constructively', 'Creates shared goals across team boundaries'],
          ['Designs collaboration structures that outlast individual relationships', 'Known as a connector across org boundaries', 'Mediates organisational-level conflicts'],
          ['Builds partnerships that create strategic value across the org', 'Redefines how teams work together at scale', 'Cited as the person who makes collaboration work'],
        ],
        evidence: [
          ['Positive relationships within own team; limited cross-team engagement', 'Reaches out to other teams reactively'],
          ['Cross-team dependencies raised before deadlines', 'Acknowledged by peers in other functions'],
          ['Leads cross-functional project with clear outcomes', 'Conflict resolution documented and sustained'],
          ['Org-wide initiatives succeed under their facilitation', 'Named by multiple functions as trusted partner'],
          ['Cross-org collaboration models they created persist', 'External partners cite them as exceptional collaborators'],
        ],
        actions: [
          ['Introduce yourself to one person in a different team this week', 'Share a useful insight with an adjacent team proactively'],
          ['Volunteer to represent your team in a cross-functional meeting', 'Map your team\'s top three external dependencies'],
          ['Lead a cross-functional working group to resolve a shared problem', 'Run a joint retrospective with another team'],
          ['Design a regular cross-team sync and facilitate it for a quarter', 'Map collaboration gaps across your org'],
          ['Propose and launch a new cross-org collaboration model', 'Build an external partnership from scratch'],
        ],
      },
      {
        code: 'C_GROWTH', name: 'Growth Mindset & Self-Awareness',
        anchors: [
          ['Accepts feedback politely but rarely applies it', 'Views failures as bad luck rather than learning', 'Limited self-awareness of development gaps'],
          ['Acts on specific feedback items within a review cycle', 'Acknowledges mistakes and identifies lessons', 'Aware of one or two significant development areas'],
          ['Actively seeks feedback between formal cycles', 'Builds a personal development plan and tracks it', 'Accurately self-assesses strengths and blind spots'],
          ['Creates feedback culture on team', 'Coaches others to develop self-awareness', 'Models vulnerability and intellectual curiosity publicly'],
          ['Sets the learning culture for the organisation', 'Develops systemic feedback structures', 'Recognised for personal mastery and continuous reinvention'],
        ],
        evidence: [
          ['Some feedback received; limited follow-through visible', 'Repeats similar mistakes across cycles'],
          ['Feedback items actioned within same cycle', 'Asks for feedback at least once per quarter'],
          ['Growth plan in place; progress visible to manager', 'Feedback-seeking behaviour acknowledged by peers'],
          ['Team feedback culture visibly strong', 'Others seek them out for self-awareness coaching'],
          ['Org learning metrics improve under their leadership', 'External recognition for people development culture'],
        ],
        actions: [
          ['Ask three colleagues for one specific piece of feedback', 'Write down two growth areas and share with your manager'],
          ['Build a 90-day personal development plan', 'After a setback, write down three things you learned'],
          ['Start a monthly feedback ritual with a trusted peer', 'Read one book on self-development and share a key insight with your team'],
          ['Introduce team retrospectives focused on personal growth', 'Run a vulnerability-sharing session in a team offsite'],
          ['Design a company-wide learning and feedback culture programme', 'Publish thought leadership on growth mindset'],
        ],
      },
      {
        code: 'C_ADAPT', name: 'Adaptability & Resilience',
        anchors: [
          ['Manages routine changes with support', 'Becomes anxious under significant ambiguity', 'Needs structured direction when priorities shift'],
          ['Adjusts approach when circumstances change', 'Maintains performance during moderate disruption', 'Asks clarifying questions rather than waiting for full clarity'],
          ['Thrives in ambiguous environments with minimal direction', 'Maintains composure and output during major change', 'Helps team navigate uncertainty effectively'],
          ['Anticipates change and repositions ahead of it', 'Leads team through significant transformation calmly', 'Reframes setbacks as strategic opportunities'],
          ['Drives organisational transformation', 'Builds adaptive capacity into team systems and culture', 'Cited as the leader who stabilises and redirects during crisis'],
        ],
        evidence: [
          ['Performance dips noticeably during change periods', 'Needs explicit guidance when priorities shift'],
          ['Consistent performance during moderate disruption', 'Asks good questions when direction is ambiguous'],
          ['Takes on stretch projects with missing information', 'Team stability maintained during their tenure'],
          ['Leads successful reorganisation or major pivot', 'Team rated as highly adaptive in reviews'],
          ['Organisation navigated industry disruption under their leadership', 'Change capacity built into team permanently'],
        ],
        actions: [
          ['Take on one task outside your comfort zone this month', 'Write down how you coped with the last big change'],
          ['Volunteer for a project with unclear requirements', 'Practice articulating a decision under uncertainty'],
          ['Lead a team through a change with deliberate communication', 'Build a personal resilience routine (exercise, reflection)'],
          ['Design a change-management plan for a medium-scale pivot', 'Run a scenario-planning workshop for your team'],
          ['Lead a transformation programme', 'Build adaptive capacity into your org through hiring and systems'],
        ],
      },
      {
        code: 'C_TECH_CORE', name: 'Core Technical Skills',
        anchors: [
          ['Applies foundational techniques with guidance', 'Produces correct outputs for well-specified tasks', 'Struggles with unfamiliar technical problems'],
          ['Works independently on standard technical tasks', 'Identifies and resolves common technical issues', 'Understands the "why" behind core techniques'],
          ['Solves complex technical problems independently', 'Contributes to technical design and review', 'Applies best practices consistently without reminders'],
          ['Sets technical standards for the team', 'Mentors others on core techniques', 'Solves novel technical problems that others cannot'],
          ['Defines technical direction at organisational level', 'Produces innovations that reshape practice in the domain', 'Recognised as a technical authority internally and externally'],
        ],
        evidence: [
          ['Task output correct when requirements are clear', 'Frequent check-ins needed for non-standard tasks'],
          ['Independent delivery on standard tasks', 'Code/work reviewed with minimal feedback required'],
          ['Technical designs accepted in review with minor comments', 'Consistently delivers without technical debt accumulation'],
          ['Team technical quality improves under their guidance', 'Others bring unsolved problems to them'],
          ['Technical decisions they made are still the standard years later', 'Industry recognises their technical contributions'],
        ],
        actions: [
          ['Complete one structured technical course or certification', 'Pair-program on a task that is just outside your level'],
          ['Write an explanation of a complex concept for a colleague', 'Fix a longstanding technical debt item independently'],
          ['Lead a technical design review', 'Build a technical onboarding guide for a new joiner'],
          ['Introduce a technical standard adopted across the team', 'Mentor two engineers on core skills'],
          ['Publish technical writing or an open-source contribution', 'Set technical roadmap for the org'],
        ],
      },
      {
        code: 'C_TOOLS', name: 'Tools & Platform Mastery',
        anchors: [
          ['Uses core tools for basic tasks with guidance', 'Relies on documentation or colleagues for non-standard operations', 'Limited awareness of tool ecosystem'],
          ['Independently uses standard tools for all common tasks', 'Troubleshoots typical tool issues without help', 'Aware of the broader tool landscape'],
          ['Optimises workflows using advanced tool features', 'Automates repetitive processes with tooling', 'Evaluates and recommends new tools for the team'],
          ['Builds team-level tooling standards and practices', 'Trains others on advanced platform capabilities', 'Drives tool adoption across functions'],
          ['Defines platform strategy for the organisation', 'Creates or significantly extends tools used by the team', 'Recognised as an expert in the tool ecosystem externally'],
        ],
        evidence: [
          ['Uses designated tools; asks for help frequently', 'Output correct but slow due to tool unfamiliarity'],
          ['Handles all common tool tasks independently', 'Helps team members with tool issues occasionally'],
          ['Workflow automations they built are adopted by team', 'Tool evaluations they ran influenced team decisions'],
          ['Platform standards they set are used org-wide', 'Training sessions they delivered show lasting impact'],
          ['Internal tools they built are mission-critical', 'Industry peers adopt their tooling patterns'],
        ],
        actions: [
          ['Complete the official certification for your primary tool', 'Automate one recurring manual task this month'],
          ['Explore and document five advanced features of a tool you use daily', 'Help a colleague who is stuck with a tool problem'],
          ['Build a workflow automation that saves team time', 'Write a tool evaluation for a new platform candidate'],
          ['Run a tools masterclass for your team', 'Create a tooling standard document for the org'],
          ['Build an internal tool that solves a real platform gap', 'Contribute to a tool\'s public documentation or community'],
        ],
      },
      {
        code: 'C_DATA_DEC', name: 'Data-Driven Decision Making',
        anchors: [
          ['Uses data when it is provided; defaults to intuition when data is absent', 'Reads charts and summaries accurately', 'Rarely questions whether the right data is being used'],
          ['Requests relevant data before making decisions', 'Interprets data correctly and identifies obvious anomalies', 'Distinguishes correlation from causation in simple cases'],
          ['Frames decisions as testable hypotheses before seeking data', 'Identifies data gaps and assesses decision quality under uncertainty', 'Communicates data-backed rationale clearly to non-technical audiences'],
          ['Builds data culture on team — makes data-first the default', 'Designs experiments to answer strategic questions', 'Challenges decisions made without sufficient evidence across functions'],
          ['Defines the data strategy for the organisation', 'Creates decision-making frameworks that others adopt', 'Recognised externally for data-driven leadership'],
        ],
        evidence: [
          ['Reads provided dashboards; decisions occasionally gut-based', 'Rarely pulls own data independently'],
          ['Pulls their own data for decisions', 'Questions supplied with: "What does the data say?"'],
          ['Decision memos include data, uncertainty, and alternative interpretations', 'Non-technical stakeholders understand their data stories'],
          ['Team decision quality measurably improves', 'Senior stakeholders adopt their analytical frameworks'],
          ['Data strategy they designed drives org-wide decisions', 'Published or cited for data leadership'],
        ],
        actions: [
          ['Before your next decision, find at least two data points that bear on it', 'Read a short course on data literacy'],
          ['Write a one-page decision brief with supporting data', 'Find and fix one decision that was made without evidence'],
          ['Design a simple A/B test for a team hypothesis', 'Present a data story to a non-technical audience'],
          ['Build a data dashboard used by multiple stakeholders', 'Run a workshop on decision hygiene for your team'],
          ['Define a data strategy for your organisation', 'Publish on data-driven culture externally'],
        ],
      },
      {
        code: 'C_PROB_SOLV', name: 'Structured Problem Solving',
        anchors: [
          ['Addresses symptoms rather than root causes', 'Proposes solutions before fully understanding the problem', 'Relies on single frameworks or past experience'],
          ['Breaks problems into components before jumping to solutions', 'Uses at least one structured framework (5-Why, Fishbone, etc.)', 'Generates multiple options before choosing'],
          ['Diagnoses root causes accurately in complex situations', 'Applies the right framework for each problem type', 'Drives problem-solving conversations in groups'],
          ['Designs problem-solving processes for teams', 'Solves novel, cross-functional, high-stakes problems', 'Teaches structured thinking to others across levels'],
          ['Defines the analytical culture of the organisation', 'Solves problems that peers have declared intractable', 'Recognised externally for analytical rigour and innovation'],
        ],
        evidence: [
          ['Solutions address visible symptoms; root causes recur', 'Problem statements often miss key constraints'],
          ['Structured approach visible in written problem statements', 'Multiple options proposed before recommendation'],
          ['Complex diagnoses correct on first attempt', 'Problem-solving workshops they facilitated show results'],
          ['Novel org-level problems solved under their leadership', 'Analytical frameworks they built are used team-wide'],
          ['Problems they solved became industry case studies', 'Others cite their analytical approach as model'],
        ],
        actions: [
          ['Use the 5-Why technique on a current work problem', 'Write a problem statement for your next project before proposing solutions'],
          ['Apply a structured framework (MECE, Fishbone) to a real issue', 'Generate three distinct solutions before choosing one'],
          ['Facilitate a structured problem-solving session for your team', 'Write up a case study of a complex problem you solved'],
          ['Design a problem-solving methodology for your team', 'Coach a junior colleague through a difficult diagnosis'],
          ['Publish a framework or speak at a conference on analytical methods', 'Lead a cross-org problem-solving taskforce'],
        ],
      },
      {
        code: 'C_IND_KNW', name: 'Industry & Business Knowledge',
        anchors: [
          ['Understands the company\'s product and immediate market', 'Limited awareness of competitive landscape or broader industry dynamics', 'Reads news reactively when prompted'],
          ['Follows industry news and understands key trends', 'Can name main competitors and their positioning', 'Understands the company\'s revenue model and cost drivers'],
          ['Uses industry knowledge to inform day-to-day decisions', 'Anticipates how industry shifts affect the business', 'Discusses business model trade-offs intelligently'],
          ['Shapes team strategy using deep industry intelligence', 'Builds external networks with peers and thought leaders', 'Positions the team to exploit emerging opportunities'],
          ['Defines the organisation\'s strategic response to industry change', 'Recognised externally as an industry authority', 'Creates competitive advantages through industry insight'],
        ],
        evidence: [
          ['Knows product basics; limited competitive awareness', 'Industry knowledge tested only in reviews'],
          ['Contributes informed view in strategy discussions', 'Names top three competitors with accurate positioning'],
          ['Decisions cite market intelligence', 'Quarterly written industry briefings shared with team'],
          ['Strategy wins attributed in part to their industry intelligence', 'Invited to external industry events as participant'],
          ['Company positions ahead of industry shifts', 'Invited to speak at industry events'],
        ],
        actions: [
          ['Subscribe to three industry newsletters; read them weekly', 'Map your top five competitors on a feature matrix'],
          ['Write a one-page competitive landscape summary for your manager', 'Attend an industry webinar or event'],
          ['Present an industry trend to your team with business implications', 'Build a customer-need map tied to market dynamics'],
          ['Develop a market intelligence process for your team', 'Attend an industry conference and brief leadership on findings'],
          ['Write a public industry insight piece', 'Lead market positioning sessions for senior leadership'],
        ],
      },
      {
        code: 'C_DOMAIN', name: 'Domain Expertise',
        anchors: [
          ['Knows the basics of the specialist domain', 'Requires guidance on domain-specific decisions', 'Limited awareness of edge cases and nuances'],
          ['Independently handles standard domain tasks', 'Knows the core body of knowledge and key practitioners', 'Identifies common domain pitfalls before they occur'],
          ['Recognised as a go-to person for domain questions in the team', 'Solves complex domain problems without external guidance', 'Can distinguish between well-founded and weak domain opinions'],
          ['Recognised across the organisation as a domain authority', 'Contributes new domain knowledge through practice', 'Influences domain standards internally and externally'],
          ['Recognised externally as an industry domain authority', 'Publishes, speaks, or leads professional communities in the domain', 'Defines best practice for the domain at scale'],
        ],
        evidence: [
          ['Handles simple domain tasks; complex tasks require review', 'Domain-specific questions escalated to senior colleagues'],
          ['Handles all standard domain scenarios independently', 'Peers ask for input on domain-related decisions'],
          ['Solves edge cases correctly without research', 'Cross-functional teams consult them on domain questions'],
          ['Org-wide domain decisions pass through them', 'External parties acknowledge their domain authority'],
          ['Publications, talks, or open contributions in the domain', 'Domain standards they set adopted industry-wide'],
        ],
        actions: [
          ['Identify three knowledge gaps in your domain; close them this quarter', 'Find a domain mentor outside your team'],
          ['Read the definitive text in your domain and summarise key insights', 'Present a domain deep-dive to your team'],
          ['Write an internal guide on a complex domain topic', 'Volunteer as domain reviewer on a cross-team project'],
          ['Submit a talk proposal to a domain conference', 'Contribute to an internal domain community of practice'],
          ['Publish in a peer-reviewed venue or at a major industry conference', 'Create a domain curriculum for your org'],
        ],
      },
      {
        code: 'C_TEAM_DEV', name: 'Team Development & Coaching',
        anchors: [
          ['Helps colleagues with specific task questions', 'Shares relevant knowledge when asked', 'No structured development approach'],
          ['Proactively shares knowledge with team', 'Gives useful task-level feedback when asked', 'Identifies when a colleague is struggling and offers support'],
          ['Runs structured 1:1s with development focus', 'Creates individual growth plans and tracks progress', 'Adapts coaching style to each person\'s needs'],
          ['Builds a team known for strong talent development', 'Accelerates high-potential individuals visibly', 'Designs team learning systems that scale'],
          ['Creates organisational capability through people development', 'Develops leaders who go on to lead significant functions', 'Recognised as an exceptional talent developer industry-wide'],
        ],
        evidence: [
          ['Colleagues cite helpful task support', 'No structured development conversations on record'],
          ['Team members cite growth conversations in feedback', 'Knowledge shared proactively in team forums'],
          ['Direct reports show measurable growth in performance reviews', 'Individual development plans exist for all reports'],
          ['Alumni of their team hold senior roles', 'Team-level capability metrics improve year-on-year'],
          ['Leaders they developed run significant organisations', 'Cited externally as outstanding people developer'],
        ],
        actions: [
          ['Read a short coaching guide and practise one technique in your next 1:1', 'Ask a colleague what would help them develop'],
          ['Establish a regular 1:1 with development focus with one direct report', 'Help a colleague identify their top growth area'],
          ['Write an individual development plan for each direct report', 'Run a team skills mapping exercise'],
          ['Build a team onboarding and growth programme', 'Identify and accelerate one high-potential individual'],
          ['Design a talent development framework for your organisation', 'Mentor a senior leader outside your team'],
        ],
      },
      {
        code: 'C_PERF_MGT', name: 'Performance Management',
        anchors: [
          ['Sets targets when asked; rarely revisits them', 'Gives vague positive feedback in reviews', 'Avoids difficult performance conversations'],
          ['Sets SMART goals for each direct report', 'Gives specific feedback tied to observable behaviour', 'Addresses minor performance issues before they escalate'],
          ['Differentiates performance accurately across team', 'Conducts difficult conversations with empathy and clarity', 'Links individual goals to team and org outcomes'],
          ['Builds a high-performance team culture', 'Manages out poor performers fairly and constructively', 'Designs compensation and recognition frameworks'],
          ['Defines performance management standards for the organisation', 'Creates systems that separate and reward true top performance', 'Recognised as an exceptional performance culture builder'],
        ],
        evidence: [
          ['Goals set annually; little evidence of progress check-ins', 'Reviews rely on vague positive descriptors'],
          ['SMART goals in place for all reports', 'Feedback conversations documented with clear action items'],
          ['Performance differentiation accepted by HR and team', 'Difficult conversations resolved and sustained'],
          ['Team performance distribution improves year-on-year', 'Performance management decisions are rarely appealed'],
          ['Organisation-level performance culture transformed', 'Cited as a model for performance management practice'],
        ],
        actions: [
          ['Set SMART goals with one direct report this month', 'Give one piece of specific, behavioural feedback this week'],
          ['Complete a performance management training course', 'Address a minor performance issue within two weeks of noticing it'],
          ['Calibrate your team\'s performance ratings with HR', 'Run a performance-improvement plan for a struggling report'],
          ['Design a performance recognition programme for your team', 'Train your managers on performance conversation skills'],
          ['Create a performance management framework for your organisation', 'Publish on performance culture best practices'],
        ],
      },
      {
        code: 'C_EXEC_COMM', name: 'Executive Communication',
        anchors: [
          ['Communicates factually with senior stakeholders when asked', 'Struggles to frame issues in business terms', 'Becomes nervous or over-detailed in executive settings'],
          ['Presents structured updates in executive settings', 'Filters detail appropriately for senior audiences', 'Responds to stakeholder questions without losing the thread'],
          ['Influences executive decisions through clear communication', 'Prepares concise executive briefs and recommendations', 'Navigates challenging stakeholder questions with confidence'],
          ['Known as an outstanding executive communicator', 'Shapes strategic narratives for the organisation', 'Represents the company externally to investors, press, or boards'],
          ['Defines the communication standards for the leadership team', 'Builds a communication-capable leadership pipeline', 'Sets the external narrative for the organisation'],
        ],
        evidence: [
          ['Senior stakeholders request more structured updates', 'Executive meetings require follow-up for clarity'],
          ['Executive updates rated as clear and structured', 'Questions handled without preparation panic'],
          ['Executive decisions influenced by their framing', 'Board or C-suite cites their communications as exemplary'],
          ['Strategic narrative attributed to their communication', 'External parties cite communications as compelling'],
          ['Organisation\'s external narrative authored or co-authored by them', 'Communication training they designed used at leadership level'],
        ],
        actions: [
          ['Write a three-slide executive summary of your current project', 'Present a topic to a VP-level stakeholder this quarter'],
          ['Study one great executive communicator; identify three techniques to adopt', 'Write a stakeholder map for your key project and tailor one message'],
          ['Present to the leadership team on a strategic topic', 'Write and send an executive brief with recommendation'],
          ['Run an executive communication coaching session for your managers', 'Represent your function in an all-hands or board review'],
          ['Author a public narrative on the org\'s direction', 'Establish communication standards for senior leaders'],
        ],
      },
      {
        code: 'C_CONFLICT', name: 'Conflict Resolution & Negotiation',
        anchors: [
          ['Avoids or escalates conflicts quickly', 'Accepts unfavourable outcomes to keep peace', 'Uncomfortable expressing disagreement directly'],
          ['Raises disagreements constructively without personal attack', 'Seeks to understand the other party\'s perspective before responding', 'Reaches workable compromises in low-stakes situations'],
          ['Mediates conflicts between colleagues effectively', 'Negotiates outcomes that address underlying interests on both sides', 'Maintains relationships through difficult disagreements'],
          ['Resolves systemic cross-team or cross-org conflicts', 'Negotiates high-stakes agreements with lasting results', 'Coaches others to handle conflict constructively'],
          ['Defines the conflict resolution culture of the organisation', 'Negotiates landmark agreements that shape strategy', 'Recognised externally as an exceptional negotiator or mediator'],
        ],
        evidence: [
          ['Conflicts avoided or escalated; others resolve their disagreements', 'Agreement reached but at personal cost to themselves'],
          ['At least two conflicts resolved constructively this year', 'Both parties cite fair outcome in post-conflict feedback'],
          ['Complex multi-party conflicts resolved and sustained', 'Negotiated outcomes with measurable business value'],
          ['Org-level conflicts resolved under their leadership', 'Named by leadership as go-to conflict resolver'],
          ['Published, taught, or recognised externally for conflict-resolution expertise', 'High-stakes negotiations won for the organisation'],
        ],
        actions: [
          ['Read a book on principled negotiation (e.g. "Getting to Yes")', 'Raise one real disagreement directly instead of avoiding it this week'],
          ['Practise active listening in your next disagreement conversation', 'Separate positions from interests in a current conflict situation'],
          ['Volunteer to mediate a conflict between two colleagues', 'Lead a negotiation for a contract or resource decision'],
          ['Run a conflict-resolution workshop for your team', 'Negotiate a partnership or budget that requires multi-stakeholder alignment'],
          ['Design a conflict resolution framework for your organisation', 'Mentor leaders on high-stakes negotiation skills'],
        ],
      },
      {
        code: 'C_VISION', name: 'Vision & Direction Setting',
        anchors: [
          ['Articulates own work goals clearly', 'Struggles to connect individual work to broader team or org direction', 'Vision of success is task-focused, not impact-focused'],
          ['Articulates team goals and connects them to org strategy', 'Inspires small groups around a near-term vision', 'Keeps team focused when priorities shift'],
          ['Creates a compelling, credible multi-year vision for the team', 'Aligns team activity to vision consistently', 'Communicates vision with energy that motivates action'],
          ['Sets a vision that shapes org strategy', 'Attracts talent and stakeholders through the strength of the vision', 'Revisits and evolves vision as context changes'],
          ['Defines the organisational vision with lasting impact', 'Vision resonates externally and attracts external investment or partnership', 'Cited as a visionary leader beyond their organisation'],
        ],
        evidence: [
          ['Team goals clear but disconnected from org strategy', 'Vision communicated infrequently'],
          ['Team can articulate the vision in their own words', 'Strategy documents authored by them are coherent and compelling'],
          ['Team velocity improves after vision-setting work', 'Vision persists through org changes'],
          ['Org strategy shaped by their vision work', 'External talent attracted by their stated direction'],
          ['Vision documented and cited years after authorship', 'Industry recognises their strategic foresight'],
        ],
        actions: [
          ['Write a one-paragraph description of your team\'s purpose that would inspire a new joiner', 'Map your current projects to a three-year ambition'],
          ['Facilitate a vision-setting workshop with your team', 'Write a strategy one-pager with explicit 3-year outcomes'],
          ['Present your team vision to senior leadership', 'Run quarterly alignment sessions to the vision'],
          ['Co-author a divisional or company strategy document', 'Communicate vision externally at an industry event'],
          ['Write and publish a strategic vision that shapes your industry', 'Lead a multi-year transformation anchored in your vision'],
        ],
      },
      {
        code: 'C_CHANGE', name: 'Change Leadership',
        anchors: [
          ['Follows new processes when instructed', 'Neutral stance toward change; neither champions nor resists', 'Communicates change to team when told to'],
          ['Communicates the reason for change clearly to team', 'Identifies and manages resistance in their immediate team', 'Adjusts implementation approach based on team feedback'],
          ['Leads medium-scale change with clear plan, communication, and measurement', 'Builds change capability in direct reports', 'Sustains change beyond initial rollout'],
          ['Leads large-scale transformation across multiple teams', 'Converts sceptics through evidence and empathy', 'Builds change-ready culture that absorbs ongoing disruption'],
          ['Defines the change management approach for the organisation', 'Leads enterprise transformation at speed', 'Recognised externally for change leadership excellence'],
        ],
        evidence: [
          ['Change followed reliably; no active resistance managed', 'Change communication reactive, not proactive'],
          ['Change communication plans documented and delivered', 'Resistance in team identified and addressed'],
          ['Change outcomes sustained 90 days post-launch', 'Team change readiness scores improve'],
          ['Multi-team transformation completed on time and on target', 'Senior leadership cites their change capability'],
          ['Enterprise transformation attributed to their leadership', 'Published or recognised externally for change management'],
        ],
        actions: [
          ['Read a short guide on change management (Kotter or ADKAR)', 'Write a communication plan for one upcoming change'],
          ['Identify the top three sources of resistance to a current change', 'Run a "what\'s in it for me?" session with your team'],
          ['Lead a change from design to sustained adoption', 'Measure change effectiveness at 30-60-90 days'],
          ['Design a change management framework for your organisation', 'Coach managers on leading change in their teams'],
          ['Lead an enterprise transformation programme', 'Publish a case study or speak externally on change leadership'],
        ],
      },
      {
        code: 'C_TECH_DEEP', name: 'Advanced Technical Depth',
        anchors: [
          ['Strong in core techniques; starting to explore advanced topics', 'Reads papers or advanced documentation with guidance', 'Aware of the frontier of the discipline'],
          ['Independently explores advanced technical topics', 'Solves problems that stump peers at the proficient level', 'Contributes to internal technical discussions with novel perspective'],
          ['Recognised within the org as a deep technical expert', 'Solves critical technical problems that others escalate', 'Influences technical architecture or methodology decisions'],
          ['Recognised externally in the discipline', 'Produces technical work that advances practice in the domain', 'Shapes the technical roadmap of the organisation'],
          ['World-class technical expert', 'Published or widely cited in the field', 'Defines the technical standards for the industry or profession'],
        ],
        evidence: [
          ['Reading list includes advanced material; still learning', 'Solves mid-complexity problems independently'],
          ['Solves problems peers escalate to them', 'Technical contributions acknowledged in code review or design sessions'],
          ['Technical architecture decisions attributed to them', 'External parties consult them on hard technical questions'],
          ['Published or presented at technical conferences', 'Patents, papers, or significant open-source contributions'],
          ['Field-defining contributions with wide adoption', 'Technical authority recognised by external institutions'],
        ],
        actions: [
          ['Identify the three hardest problems in your subdomain; read deeply on one', 'Read one recent technical paper and summarise it for the team'],
          ['Solve a problem that has been unsolved by your team for over a month', 'Present an advanced technical deep-dive internally'],
          ['Contribute to an internal or external technical forum', 'Write a design document that becomes the team\'s reference'],
          ['Submit a talk to a technical conference', 'Contribute to an open-source project in your domain'],
          ['Publish a technical paper or define a standard', 'Build an advanced internal capability that becomes the foundation for future work'],
        ],
      },
      {
        code: 'C_THOUGHT', name: 'Thought Leadership',
        anchors: [
          ['Shares interesting articles or perspectives in team settings', 'Has opinions but rarely publishes or shares them externally', 'Building an informed perspective in one area'],
          ['Regularly contributes informed perspective in team or function discussions', 'Has a clear point of view in one domain that others cite', 'Engages with external practitioners in the field'],
          ['Produces original insights shared and cited within the organisation', 'Invited to share perspective at internal forums', 'Builds an external reputation in one area'],
          ['Recognised externally in one domain', 'Published, speaks at conferences, or leads a community', 'Shapes how practitioners think about a problem in the field'],
          ['Field-defining thought leader', 'Work cited across the industry', 'Invited to define or advise on standards, policy, or industry direction'],
        ],
        evidence: [
          ['Shares curated reading lists; no original publications', 'Cited by colleagues in informal discussions'],
          ['Internal posts or presentations with original perspective', 'Colleagues share their frameworks or frameworks widely cited internally'],
          ['External blog posts, talks, or articles published', 'Invited to speak at an industry event'],
          ['Regular external publication or speaking record', 'Work cited by practitioners in the field'],
          ['Books, widely-read publications, advisory roles, or awards', 'Invited to shape national or global practice'],
        ],
        actions: [
          ['Write a 500-word internal post on a topic you know well', 'Share a curated resource with your team and explain why you find it valuable'],
          ['Develop one original framework or model and present it internally', 'Submit a short piece to an internal newsletter or community'],
          ['Publish a blog post or article on your professional area', 'Submit a talk proposal to a conference'],
          ['Build a consistent publication or speaking programme', 'Launch or lead a community of practice'],
          ['Write a book, landmark report, or lead an industry standard', 'Accept an advisory or board role that leverages your expertise'],
        ],
      },
      {
        code: 'C_CREATIVE', name: 'Creative Problem Solving',
        anchors: [
          ['Generates solutions within established patterns', 'Relies on precedent when approaching new problems', 'Uncomfortable with open-ended, undefined challenges'],
          ['Proposes alternative approaches when the first idea fails', 'Combines ideas from different domains', 'Comfortable in early-stage ambiguity'],
          ['Consistently generates original solutions valued by the team', 'Creates conditions that invite creative thinking from others', 'Challenges constraints before accepting them as fixed'],
          ['Leads creative problem-solving on the organisation\'s hardest challenges', 'Builds creative culture on team', 'Generates original products or solutions with measurable impact'],
          ['Defines creative practice for the organisation or industry', 'Creates original, widely-adopted methods or products', 'Recognised externally as a creative innovator'],
        ],
        evidence: [
          ['Solutions are competent and conventional', 'Rarely proposes a new approach unprompted'],
          ['Proposes at least one novel approach per project', 'Cross-domain ideas appear in their work'],
          ['Original solutions adopted by team or product', 'Facilitates creative sessions that produce results'],
          ['Org-level problems solved via original approaches they pioneered', 'Creative outputs have measurable business value'],
          ['Products, methods, or creative approaches they invented become industry standards', 'External recognition for creative innovation'],
        ],
        actions: [
          ['Try a creative technique (mind-mapping, "Yes And") on your next problem', 'Borrow a pattern from a completely different industry and apply it to your work'],
          ['Facilitate a brainwriting or divergent-thinking session for your team', 'Build a creative brief before starting your next design challenge'],
          ['Lead an innovation sprint or hackathon', 'Document your creative process and teach it to a colleague'],
          ['Launch an internal innovation programme', 'Develop an original framework or method used across the team'],
          ['Create a product, method, or creative contribution recognised externally', 'Design an organisation-wide creative culture programme'],
        ],
      },
      {
        code: 'C_EXPERIMENT', name: 'Experimentation & Iteration',
        anchors: [
          ['Tests ideas informally; no structured approach to learning', 'Moves on after a failure without extracting insights', 'Experiments defined by available time, not by hypothesis'],
          ['Defines hypotheses before running experiments', 'Captures results and adjusts based on outcomes', 'Comfortable shipping at 80% quality to learn'],
          ['Designs rigorous experiments with control conditions', 'Builds iterative cycles into team workflow', 'Communicates experimental results with appropriate uncertainty'],
          ['Builds an experimentation culture on the team', 'Designs experiments that answer strategic questions', 'Distinguishes signal from noise in complex experimental results'],
          ['Defines the experimentation infrastructure and culture for the organisation', 'Creates novel experimental methods adopted by others', 'Recognised externally for disciplined, impactful experimentation'],
        ],
        evidence: [
          ['Ideas tested; no documented hypothesis or result', 'Learning from experiments rarely explicit'],
          ['Hypotheses written before experiments start', 'Outcomes documented with clear learnings'],
          ['Experiments designed with control groups and clear metrics', 'Iteration cadence visible in team workflow'],
          ['Experiment infrastructure built and used org-wide', 'Strategic decisions driven by experiments they designed'],
          ['Experimentation frameworks they built become standard', 'External publications or talks on experimentation methodology'],
        ],
        actions: [
          ['Write a hypothesis before your next test ("We believe X because Y; we will know if we are right when Z")', 'Document the result of an experiment even if it was informal'],
          ['Design a proper A/B test with a control condition', 'Ship a feature at 80% quality to learn faster'],
          ['Build an experiment log for your team', 'Present experimental results including uncertainty to stakeholders'],
          ['Design a team experiment programme with defined cadence and metrics', 'Run an experiment that directly influences a strategic decision'],
          ['Build an experimentation platform for your organisation', 'Publish on experimental methodology or A/B testing practice'],
        ],
      },
      {
        code: 'C_COMMERC', name: 'Commercial Awareness',
        anchors: [
          ['Knows the company\'s products and approximate revenue range', 'Does not routinely consider commercial implications of decisions', 'Rarely connects their work to financial outcomes'],
          ['Understands the company\'s revenue model and cost structure', 'Considers cost and revenue impact in day-to-day decisions', 'Can read a basic P&L or financial summary'],
          ['Evaluates trade-offs using commercial logic', 'Understands unit economics and key financial drivers', 'Influences product or operational decisions with commercial arguments'],
          ['Builds commercial judgement into team culture', 'Shapes pricing, positioning, or cost strategy', 'Trusted by commercial stakeholders to represent commercial interest'],
          ['Defines the commercial strategy for the organisation', 'Creates commercial models or partnerships with lasting value', 'Recognised externally for commercial excellence'],
        ],
        evidence: [
          ['Knows company revenue; rarely brings commercial perspective to decisions', 'Commercial implications of their work discussed only in review'],
          ['Cites commercial rationale in decision briefs', 'Reads financial summaries without guidance'],
          ['Trade-off analysis includes quantified commercial impact', 'Commercial stakeholders rate collaboration positively'],
          ['Pricing or cost initiatives they led show measurable P&L improvement', 'Commercial decisions attributed to their judgement'],
          ['Commercial strategy they authored drives sustained revenue or margin improvement', 'External recognition for commercial leadership'],
        ],
        actions: [
          ['Ask your finance partner to walk you through the team\'s cost centre', 'Find out what the company\'s top three revenue drivers are this quarter'],
          ['Write a business case for your next initiative with ROI projection', 'Shadow a commercial or finance colleague for a day'],
          ['Lead a pricing or cost-optimisation decision', 'Present a commercial case to senior leadership'],
          ['Design a commercial model for a new product or service', 'Run a commercial acumen workshop for your team'],
          ['Author a commercial strategy adopted at org level', 'Publish or speak externally on commercial leadership'],
        ],
      },
      {
        code: 'C_EXEC_PRES', name: 'Executive Presence & Judgment',
        anchors: [
          ['Comes across as competent in individual interactions', 'Nervous or under-confident in high-stakes settings', 'Limited gravitas in leadership situations'],
          ['Confident and calm in group settings', 'Makes sound judgements in routine situations', 'Earns credibility through consistent, reliable behaviour'],
          ['Inspires confidence and trust in senior stakeholders', 'Makes sound judgements under pressure and ambiguity', 'Navigates political dynamics without being political'],
          ['Carries real authority in any room', 'Shapes the room\'s direction through presence and judgement', 'Trusted to represent the organisation in critical situations'],
          ['Defines the standard of leadership presence for the organisation', 'Recognised as a figure of authority beyond their immediate role', 'Cited as an exceptional leader by peers, reports, and external stakeholders'],
        ],
        evidence: [
          ['Positive one-on-one feedback; group settings less consistent', 'Senior stakeholder interactions sometimes stilted'],
          ['Consistent positive feedback from peers and managers', 'Judgements in routine decisions respected by team'],
          ['Senior stakeholders proactively seek their input', 'Calm under pressure noted in 360 feedback'],
          ['Trusted to represent the organisation in high-stakes situations', 'Senior leadership consults them on critical judgements'],
          ['Named by external stakeholders as exceptional leader', 'Industry recognises their leadership presence and judgement'],
        ],
        actions: [
          ['Take a public speaking course or join Toastmasters', 'Write down your non-negotiable leadership values and share them with a mentor'],
          ['Ask for feedback on your presence in three high-stakes meetings', 'Practise making decisions with incomplete information'],
          ['Present to a board or C-suite audience', 'Accept a visible leadership role outside your comfort zone'],
          ['Coach a senior leader on executive presence', 'Represent your organisation at an external high-stakes engagement'],
          ['Develop a leadership presence programme for your senior leadership team', 'Mentor emerging executives on judgement and gravitas'],
        ],
      },
    ];

    let barsCount = 0;
    for (const comp of barsData) {
      for (let i = 0; i < LEVELS.length; i++) {
        const lv = LEVELS[i];
        await pool.query(
          `INSERT INTO ont_competency_level_anchors
             (competency_code, competency_name, proficiency_level, level_number,
              score_band_min, score_band_max, behavioural_anchors, sample_evidence, learning_actions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (competency_code, proficiency_level) DO NOTHING`,
          [
            comp.code, comp.name, lv.level, lv.num, lv.min, lv.max,
            comp.anchors[i], comp.evidence[i], comp.actions[i],
          ],
        );
        barsCount++;
      }
    }
    phases.competency_level_anchors = barsCount;

    // ── 16. ROLE → COMPETENCY MAPPINGS ────────────────────────────────────────
    const roleIdMap = new Map<string, number>(
      roleRows.rows.map((r: { code: string; id: number }) => [r.code, r.id]),
    );

    // Seniority → [min_proficiency, target_proficiency]
    const senProf: Record<string, [string, string]> = {
      junior:  ['novice',     'developing'],
      mid:     ['developing', 'proficient'],
      senior:  ['proficient', 'advanced'],
      lead:      ['advanced', 'expert'],
      principal: ['advanced', 'expert'],
      staff:   ['advanced',   'expert'],
      manager: ['proficient', 'advanced'],
    };

    // Universal foundation competencies — all roles get these (tier core, weight 1.0)
    const universalComps = ['C_ACCOUNT', 'C_ETHICS', 'C_COMM_EFF', 'C_COLLAB', 'C_GROWTH', 'C_ADAPT'];

    // Role-specific additions: [role_code, comp_code, importance_tier, weight]
    type Extra = [string, string, 'core' | 'secondary', number];
    const roleExtras: Extra[] = [
      // ── Software Engineering
      ['ROLE_JR_SWE',    'C_TECH_CORE',  'core',      1.3],
      ['ROLE_JR_SWE',    'C_TOOLS',      'core',      1.2],
      ['ROLE_JR_SWE',    'C_PROB_SOLV',  'secondary', 1.0],

      ['ROLE_SWE',       'C_TECH_CORE',  'core',      1.3],
      ['ROLE_SWE',       'C_TOOLS',      'core',      1.2],
      ['ROLE_SWE',       'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_SWE',       'C_DATA_DEC',   'secondary', 0.9],

      ['ROLE_SR_SWE',    'C_TECH_CORE',  'core',      1.3],
      ['ROLE_SR_SWE',    'C_TOOLS',      'core',      1.2],
      ['ROLE_SR_SWE',    'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_SR_SWE',    'C_DATA_DEC',   'core',      1.0],
      ['ROLE_SR_SWE',    'C_CREATIVE',   'secondary', 0.9],

      ['ROLE_STAFF_ENG', 'C_TECH_CORE',  'core',      1.3],
      ['ROLE_STAFF_ENG', 'C_TECH_DEEP',  'core',      1.4],
      ['ROLE_STAFF_ENG', 'C_TOOLS',      'core',      1.1],
      ['ROLE_STAFF_ENG', 'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_STAFF_ENG', 'C_DATA_DEC',   'core',      1.0],
      ['ROLE_STAFF_ENG', 'C_THOUGHT',    'secondary', 1.0],

      ['ROLE_BE_ENG',    'C_TECH_CORE',  'core',      1.3],
      ['ROLE_BE_ENG',    'C_TOOLS',      'core',      1.2],
      ['ROLE_BE_ENG',    'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_BE_ENG',    'C_DATA_DEC',   'secondary', 0.9],

      ['ROLE_SR_BE_ENG', 'C_TECH_CORE',  'core',      1.3],
      ['ROLE_SR_BE_ENG', 'C_TOOLS',      'core',      1.2],
      ['ROLE_SR_BE_ENG', 'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_SR_BE_ENG', 'C_DATA_DEC',   'core',      1.0],
      ['ROLE_SR_BE_ENG', 'C_CREATIVE',   'secondary', 0.9],

      ['ROLE_ENG_MGR',   'C_TECH_CORE',  'secondary', 0.9],
      ['ROLE_ENG_MGR',   'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_ENG_MGR',   'C_TEAM_DEV',   'core',      1.4],
      ['ROLE_ENG_MGR',   'C_PERF_MGT',   'core',      1.3],
      ['ROLE_ENG_MGR',   'C_EXEC_COMM',  'core',      1.2],
      ['ROLE_ENG_MGR',   'C_CONFLICT',   'core',      1.1],

      // ── Data & Analytics
      ['ROLE_DA',        'C_DATA_DEC',   'core',      1.4],
      ['ROLE_DA',        'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_DA',        'C_TECH_CORE',  'core',      1.2],
      ['ROLE_DA',        'C_TOOLS',      'core',      1.1],
      ['ROLE_DA',        'C_DOMAIN',     'secondary', 0.9],

      ['ROLE_DS',        'C_DATA_DEC',   'core',      1.4],
      ['ROLE_DS',        'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_DS',        'C_TECH_CORE',  'core',      1.2],
      ['ROLE_DS',        'C_TOOLS',      'core',      1.1],
      ['ROLE_DS',        'C_DOMAIN',     'core',      1.0],
      ['ROLE_DS',        'C_EXPERIMENT', 'core',      1.1],

      ['ROLE_SR_DS',     'C_DATA_DEC',   'core',      1.4],
      ['ROLE_SR_DS',     'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_SR_DS',     'C_TECH_DEEP',  'core',      1.3],
      ['ROLE_SR_DS',     'C_DOMAIN',     'core',      1.1],
      ['ROLE_SR_DS',     'C_EXPERIMENT', 'core',      1.1],
      ['ROLE_SR_DS',     'C_THOUGHT',    'secondary', 1.0],

      ['ROLE_DATA_LEAD', 'C_DATA_DEC',   'core',      1.4],
      ['ROLE_DATA_LEAD', 'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_DATA_LEAD', 'C_TECH_DEEP',  'core',      1.3],
      ['ROLE_DATA_LEAD', 'C_DOMAIN',     'core',      1.1],
      ['ROLE_DATA_LEAD', 'C_THOUGHT',    'core',      1.1],
      ['ROLE_DATA_LEAD', 'C_COMMERC',    'secondary', 1.0],
      ['ROLE_DATA_LEAD', 'C_EXEC_COMM',  'core',      1.2],

      // ── Product Management
      ['ROLE_APM',       'C_DATA_DEC',   'core',      1.2],
      ['ROLE_APM',       'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_APM',       'C_COMMERC',    'secondary', 1.0],
      ['ROLE_APM',       'C_IND_KNW',    'secondary', 0.9],

      ['ROLE_PM',        'C_DATA_DEC',   'core',      1.2],
      ['ROLE_PM',        'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_PM',        'C_COMMERC',    'core',      1.1],
      ['ROLE_PM',        'C_IND_KNW',    'core',      1.0],
      ['ROLE_PM',        'C_EXEC_COMM',  'secondary', 0.9],

      ['ROLE_SR_PM',     'C_DATA_DEC',   'core',      1.2],
      ['ROLE_SR_PM',     'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_SR_PM',     'C_COMMERC',    'core',      1.2],
      ['ROLE_SR_PM',     'C_IND_KNW',    'core',      1.0],
      ['ROLE_SR_PM',     'C_EXEC_COMM',  'core',      1.1],
      ['ROLE_SR_PM',     'C_VISION',     'secondary', 1.0],
      ['ROLE_SR_PM',     'C_EXEC_PRES',  'secondary', 0.9],

      // ── Design
      ['ROLE_UX',        'C_CREATIVE',   'core',      1.4],
      ['ROLE_UX',        'C_TOOLS',      'core',      1.2],
      ['ROLE_UX',        'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_UX',        'C_DOMAIN',     'secondary', 0.9],

      ['ROLE_SR_UX',     'C_CREATIVE',   'core',      1.4],
      ['ROLE_SR_UX',     'C_TOOLS',      'core',      1.2],
      ['ROLE_SR_UX',     'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_SR_UX',     'C_DOMAIN',     'core',      1.0],
      ['ROLE_SR_UX',     'C_EXEC_COMM',  'secondary', 0.9],

      ['ROLE_DES_LEAD',  'C_CREATIVE',   'core',      1.4],
      ['ROLE_DES_LEAD',  'C_THOUGHT',    'secondary', 1.0],
      ['ROLE_DES_LEAD',  'C_DOMAIN',     'core',      1.1],
      ['ROLE_DES_LEAD',  'C_EXEC_COMM',  'core',      1.1],
      ['ROLE_DES_LEAD',  'C_VISION',     'secondary', 0.9],

      // ── GTM / Sales
      ['ROLE_BDR',       'C_COMMERC',    'core',      1.3],
      ['ROLE_BDR',       'C_IND_KNW',    'core',      1.1],
      ['ROLE_BDR',       'C_CONFLICT',   'secondary', 0.9],

      ['ROLE_AE',        'C_COMMERC',    'core',      1.3],
      ['ROLE_AE',        'C_IND_KNW',    'core',      1.1],
      ['ROLE_AE',        'C_CONFLICT',   'core',      1.0],
      ['ROLE_AE',        'C_EXEC_PRES',  'secondary', 1.0],

      ['ROLE_SR_AE',     'C_COMMERC',    'core',      1.3],
      ['ROLE_SR_AE',     'C_IND_KNW',    'core',      1.1],
      ['ROLE_SR_AE',     'C_CONFLICT',   'core',      1.1],
      ['ROLE_SR_AE',     'C_EXEC_PRES',  'core',      1.1],
      ['ROLE_SR_AE',     'C_EXEC_COMM',  'secondary', 0.9],

      ['ROLE_SALES_MGR', 'C_COMMERC',    'core',      1.3],
      ['ROLE_SALES_MGR', 'C_IND_KNW',    'core',      1.1],
      ['ROLE_SALES_MGR', 'C_CONFLICT',   'core',      1.1],
      ['ROLE_SALES_MGR', 'C_EXEC_PRES',  'core',      1.1],
      ['ROLE_SALES_MGR', 'C_TEAM_DEV',   'core',      1.3],
      ['ROLE_SALES_MGR', 'C_PERF_MGT',   'core',      1.2],

      // ── Operations
      ['ROLE_OPS_AN',    'C_DATA_DEC',   'core',      1.2],
      ['ROLE_OPS_AN',    'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_OPS_AN',    'C_IND_KNW',    'secondary', 1.0],

      ['ROLE_OPS_MGR',   'C_DATA_DEC',   'core',      1.2],
      ['ROLE_OPS_MGR',   'C_PROB_SOLV',  'core',      1.1],
      ['ROLE_OPS_MGR',   'C_IND_KNW',    'core',      1.0],
      ['ROLE_OPS_MGR',   'C_TEAM_DEV',   'core',      1.2],
      ['ROLE_OPS_MGR',   'C_PERF_MGT',   'core',      1.2],
      ['ROLE_OPS_MGR',   'C_EXEC_COMM',  'core',      1.1],

      // ── People / HR
      ['ROLE_HRBP',      'C_TEAM_DEV',   'core',      1.3],
      ['ROLE_HRBP',      'C_CONFLICT',   'core',      1.2],
      ['ROLE_HRBP',      'C_EXEC_COMM',  'core',      1.1],
      ['ROLE_HRBP',      'C_IND_KNW',    'secondary', 0.9],

      ['ROLE_SR_HRBP',   'C_TEAM_DEV',   'core',      1.3],
      ['ROLE_SR_HRBP',   'C_CONFLICT',   'core',      1.2],
      ['ROLE_SR_HRBP',   'C_EXEC_COMM',  'core',      1.1],
      ['ROLE_SR_HRBP',   'C_IND_KNW',    'core',      1.0],
      ['ROLE_SR_HRBP',   'C_EXEC_PRES',  'secondary', 0.9],

      // ── Finance
      ['ROLE_FIN_AN',    'C_DATA_DEC',   'core',      1.3],
      ['ROLE_FIN_AN',    'C_PROB_SOLV',  'core',      1.2],
      ['ROLE_FIN_AN',    'C_IND_KNW',    'core',      1.1],
      ['ROLE_FIN_AN',    'C_COMMERC',    'secondary', 0.9],
    ];

    let rcCount = 0;
    for (const role of roles) {
      const roleId = roleIdMap.get(role.code);
      if (!roleId) continue;
      const [minP, targetP] = senProf[role.seniority] ?? ['novice', 'developing'];

      // Universal foundation competencies
      for (const compCode of universalComps) {
        const compId = compIds.get(compCode);
        if (!compId) continue;
        await pool.query(
          `INSERT INTO map_role_competency
             (role_id, competency_id, importance_tier, weight, min_proficiency, target_proficiency, source)
           VALUES ($1,$2,'core',1.0,$3,$4,'seeded')
           ON CONFLICT (role_id, competency_id) DO NOTHING`,
          [roleId, compId, minP, targetP],
        );
        rcCount++;
      }
    }

    // Role-specific extra competencies
    for (const [roleCode, compCode, tier, weight] of roleExtras) {
      const roleId = roleIdMap.get(roleCode);
      const compId = compIds.get(compCode);
      if (!roleId || !compId) continue;

      // Look up seniority for proficiency
      const role = roles.find(r => r.code === roleCode);
      const [minP, targetP] = senProf[role?.seniority ?? 'mid'] ?? ['developing', 'proficient'];
      await pool.query(
        `INSERT INTO map_role_competency
           (role_id, competency_id, importance_tier, weight, min_proficiency, target_proficiency, source)
         VALUES ($1,$2,$3,$4,$5,$6,'seeded')
         ON CONFLICT (role_id, competency_id) DO NOTHING`,
        [roleId, compId, tier, weight, minP, targetP],
      );
      rcCount++;
    }
    phases.map_role_competency = rcCount;

    const totalRows = Object.values(phases).reduce((s, v) => s + v, 0);
    return { phases, totalRows, ok: true };

  } catch (err: any) {
    console.error('[ontology-seed] error:', err);
    return { phases, totalRows: 0, ok: false, error: err?.message ?? 'Unknown error' };
  }
}
