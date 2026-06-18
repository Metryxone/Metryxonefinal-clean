import { pool } from './client.js';

const DOMAINS = [
  { code: 'COG', name: 'Cognitive & Analytical', description: 'Critical thinking, problem solving, analytical reasoning', sort_order: 1 },
  { code: 'COM', name: 'Communication & Influence', description: 'Verbal, written, negotiation, stakeholder management', sort_order: 2 },
  { code: 'LEA', name: 'Leadership & People', description: 'Team management, coaching, strategic vision', sort_order: 3 },
  { code: 'EXE', name: 'Execution & Delivery', description: 'Project management, accountability, results orientation', sort_order: 4 },
  { code: 'ADP', name: 'Adaptability & Growth', description: 'Change resilience, learning agility, innovation mindset', sort_order: 5 },
  { code: 'TEC', name: 'Technical & Domain', description: 'Domain-specific expertise, digital fluency, systems thinking', sort_order: 6 },
  { code: 'EIQ', name: 'Emotional & Social Intelligence', description: 'Self-awareness, empathy, relationship building, conflict resolution', sort_order: 7 },
];

const COMPETENCIES_BY_DOMAIN: Record<string, { code: string; name: string; description: string }[]> = {
  COG: [
    { code: 'COG01', name: 'Critical Thinking', description: 'Evaluate arguments and evidence systematically' },
    { code: 'COG02', name: 'Problem Solving', description: 'Identify and resolve complex challenges' },
    { code: 'COG03', name: 'Analytical Reasoning', description: 'Decompose data and derive insights' },
    { code: 'COG04', name: 'Decision Making', description: 'Make sound judgments under uncertainty' },
    { code: 'COG05', name: 'Systems Thinking', description: 'Understand interconnections within complex systems' },
    { code: 'COG06', name: 'Quantitative Analysis', description: 'Apply numerical methods and statistical reasoning' },
    { code: 'COG07', name: 'Research Aptitude', description: 'Gather, synthesize, and apply information effectively' },
  ],
  COM: [
    { code: 'COM01', name: 'Verbal Communication', description: 'Articulate ideas clearly in spoken form' },
    { code: 'COM02', name: 'Written Communication', description: 'Express ideas precisely in writing' },
    { code: 'COM03', name: 'Presentation Skills', description: 'Deliver compelling structured presentations' },
    { code: 'COM04', name: 'Active Listening', description: 'Understand and retain spoken information' },
    { code: 'COM05', name: 'Negotiation', description: 'Reach mutually beneficial agreements' },
    { code: 'COM06', name: 'Stakeholder Management', description: 'Engage and align diverse stakeholders' },
    { code: 'COM07', name: 'Storytelling & Influence', description: 'Use narrative to persuade and inspire' },
  ],
  LEA: [
    { code: 'LEA01', name: 'Team Leadership', description: 'Motivate and guide a team toward goals' },
    { code: 'LEA02', name: 'Strategic Vision', description: 'Set and communicate long-term direction' },
    { code: 'LEA03', name: 'Coaching & Mentoring', description: 'Develop others through guidance and feedback' },
    { code: 'LEA04', name: 'Talent Development', description: 'Identify and grow talent within organizations' },
    { code: 'LEA05', name: 'Change Leadership', description: 'Navigate and drive organizational transformation' },
    { code: 'LEA06', name: 'Decision Authority', description: 'Own and execute high-stakes decisions' },
    { code: 'LEA07', name: 'Cross-functional Collaboration', description: 'Drive alignment across teams and functions' },
  ],
  EXE: [
    { code: 'EXE01', name: 'Project Management', description: 'Plan, execute, and close projects on time and budget' },
    { code: 'EXE02', name: 'Accountability', description: 'Own outcomes and take responsibility for results' },
    { code: 'EXE03', name: 'Prioritization', description: 'Identify and focus on highest-impact work' },
    { code: 'EXE04', name: 'Process Improvement', description: 'Optimize workflows and eliminate inefficiencies' },
    { code: 'EXE05', name: 'Goal Setting & OKRs', description: 'Define measurable objectives and track progress' },
    { code: 'EXE06', name: 'Risk Management', description: 'Identify, assess, and mitigate project risks' },
    { code: 'EXE07', name: 'Resource Optimization', description: 'Allocate and utilize resources efficiently' },
  ],
  ADP: [
    { code: 'ADP01', name: 'Learning Agility', description: 'Acquire new skills and knowledge rapidly' },
    { code: 'ADP02', name: 'Resilience', description: 'Bounce back from setbacks and maintain performance' },
    { code: 'ADP03', name: 'Innovation Mindset', description: 'Generate creative solutions and embrace new ideas' },
    { code: 'ADP04', name: 'Ambiguity Tolerance', description: 'Operate effectively in uncertain environments' },
    { code: 'ADP05', name: 'Growth Mindset', description: 'View challenges as opportunities for development' },
    { code: 'ADP06', name: 'Continuous Improvement', description: 'Proactively seek feedback and self-improve' },
    { code: 'ADP07', name: 'Digital Adaptability', description: 'Embrace and leverage new digital tools quickly' },
  ],
  TEC: [
    { code: 'TEC01', name: 'Domain Expertise', description: 'Deep knowledge in primary professional area' },
    { code: 'TEC02', name: 'Digital Fluency', description: 'Effective use of digital tools and platforms' },
    { code: 'TEC03', name: 'Data Literacy', description: 'Read, interpret, and use data in decision-making' },
    { code: 'TEC04', name: 'Technical Writing', description: 'Produce clear technical documents and specifications' },
    { code: 'TEC05', name: 'Product & Process Knowledge', description: 'Understand product lifecycle and operational processes' },
    { code: 'TEC06', name: 'Regulatory & Compliance Awareness', description: 'Navigate relevant regulatory frameworks' },
    { code: 'TEC07', name: 'Financial Acumen', description: 'Understand financial statements and business metrics' },
    { code: 'TEC08', name: 'AI & Automation Literacy', description: 'Apply AI/automation tools to improve productivity' },
  ],
  EIQ: [
    { code: 'EIQ01', name: 'Self-Awareness', description: 'Recognize own emotions, strengths, and limitations' },
    { code: 'EIQ02', name: 'Self-Regulation', description: 'Manage impulses and maintain composure under pressure' },
    { code: 'EIQ03', name: 'Empathy', description: 'Understand and share the feelings of others' },
    { code: 'EIQ04', name: 'Relationship Building', description: 'Cultivate authentic professional relationships' },
    { code: 'EIQ05', name: 'Conflict Resolution', description: 'Navigate disagreements constructively' },
    { code: 'EIQ06', name: 'Cultural Intelligence', description: 'Work effectively across diverse cultures' },
    { code: 'EIQ07', name: 'Psychological Safety', description: 'Create environments where people speak up freely' },
  ],
};

const ROLES = ['Software Engineer', 'Product Manager', 'Data Analyst', 'Team Lead', 'Director', 'Consultant'];
const CAREER_STAGES = ['junior', 'mid', 'senior', 'lead'];
const BENCH_INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Consulting', 'E-Commerce'];
const PROFILE_INDUSTRIES = BENCH_INDUSTRIES;

// Industry-specific mean offset for realistic cohort differentiation
const INDUSTRY_OFFSET: Record<string, number> = {
  Technology: 0,
  Finance: 3,
  Healthcare: -2,
  Education: -4,
  Manufacturing: -1,
  Consulting: 2,
  'E-Commerce': 1,
};

export async function seedCompetencyData(): Promise<void> {
  const client = await pool.connect();
  try {
    // Each section is idempotent and has its own skip check.
    const domainCount = await client.query(`SELECT COUNT(*)::int AS cnt FROM competency_domains`);
    const domainsExist = domainCount.rows[0].cnt > 0;

    if (!domainsExist) {
      console.log('[Competency] Seeding domains and competencies...');
    }

    const domainIdMap: Record<string, string> = {};
    for (const d of DOMAINS) {
      const r = await client.query(
        `INSERT INTO competency_domains (code, name, description, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [d.code, d.name, d.description, d.sort_order]
      );
      domainIdMap[d.code] = r.rows[0].id;
    }

    const competencyIdMap: Record<string, string> = {};
    let cSort = 0;
    for (const [domainCode, comps] of Object.entries(COMPETENCIES_BY_DOMAIN)) {
      for (const c of comps) {
        const r = await client.query(
          `INSERT INTO competencies (domain_id, code, name, description, sort_order) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [domainIdMap[domainCode], c.code, c.name, c.description, ++cSort]
        );
        competencyIdMap[c.code] = r.rows[0].id;
      }
    }

    const allCompetencyIds = Object.values(competencyIdMap);
    const allCompetencyCodes = Object.keys(competencyIdMap);

    console.log('[Competency] Seeding role weights...');
    const weightValues: string[] = [];
    const weightParams: unknown[] = [];
    let paramIdx = 1;
    for (const role of ROLES) {
      for (const stage of CAREER_STAGES) {
        for (const code of allCompetencyCodes) {
          const baseWeight = getBaseWeight(role, code, stage);
          weightValues.push(`($${paramIdx},$${paramIdx + 1},$${paramIdx + 2},$${paramIdx + 3})`);
          weightParams.push(role, stage, competencyIdMap[code], baseWeight);
          paramIdx += 4;
        }
      }
    }
    if (weightValues.length > 0) {
      await client.query(
        `INSERT INTO role_weights (role, career_stage, competency_id, weight) VALUES ${weightValues.join(',')} ON CONFLICT (role, career_stage, competency_id) DO NOTHING`,
        weightParams
      );
    }

    // Seed multi-industry benchmarks: check if industry-keyed rows exist first
    const benchIndustryCount = await client.query(
      `SELECT COUNT(DISTINCT industry)::int AS cnt FROM competency_benchmarks`
    );
    const benchIndustriesPresent = benchIndustryCount.rows[0].cnt;
    if (benchIndustriesPresent < BENCH_INDUSTRIES.length) {
      console.log('[Competency] Seeding benchmarks for industries: ' + BENCH_INDUSTRIES.join(', ') + '...');
      const benchValues: string[] = [];
      const benchParams: unknown[] = [];
      let bIdx = 1;
      for (const industry of BENCH_INDUSTRIES) {
        const offset = INDUSTRY_OFFSET[industry] ?? 0;
        for (const role of ROLES) {
          for (const stage of CAREER_STAGES) {
            for (const code of allCompetencyCodes) {
              const mean = Math.min(Math.max(45 + offset + Math.floor(Math.random() * 30), 30), 90);
              const std = 8 + Math.floor(Math.random() * 10);
              benchValues.push(`($${bIdx},$${bIdx+1},$${bIdx+2},$${bIdx+3},$${bIdx+4},$${bIdx+5},$${bIdx+6},$${bIdx+7},$${bIdx+8},$${bIdx+9},$${bIdx+10})`);
              benchParams.push(role, stage, industry, competencyIdMap[code], mean, mean - 2, std,
                Math.max(mean - std, 10), Math.min(mean + std, 95), Math.min(mean + std * 1.6, 98), 100);
              bIdx += 11;
            }
          }
        }
      }
      if (benchValues.length > 0) {
        // Insert in chunks to avoid exceeding parameter limits
        const CHUNK = 500;
        for (let c = 0; c < benchValues.length; c += CHUNK) {
          const chunkVals = benchValues.slice(c, c + CHUNK);
          // Renumber params for this chunk
          const chunkParamStart = c * 11;
          const chunkParams = benchParams.slice(chunkParamStart, chunkParamStart + chunkVals.length * 11);
          const renumbered = chunkVals.map((_, i) => {
            const base = i * 11 + 1;
            return `($${base},$${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10})`;
          });
          await client.query(
            `INSERT INTO competency_benchmarks (role, career_stage, industry, competency_id, mean, median, std_dev, p25, p75, p90, sample_size)
             VALUES ${renumbered.join(',')}
             ON CONFLICT ON CONSTRAINT cb_role_industry_stage_key DO NOTHING`,
            chunkParams
          );
        }
      }
    } else {
      console.log('[Competency] Multi-industry benchmarks already present — skipping.');
    }

    console.log('[Competency] Seeding interventions...');
    const interventionTypes = ['course', 'project', 'mentorship'];
    const gapLevels = ['critical', 'high', 'medium', 'low'];
    const intValues: string[] = [];
    const intParams: unknown[] = [];
    let iIdx = 1;
    for (const code of allCompetencyCodes) {
      for (const gapLevel of gapLevels) {
        const type = interventionTypes[Math.floor(Math.random() * interventionTypes.length)];
        intValues.push(`($${iIdx},$${iIdx+1},$${iIdx+2},$${iIdx+3},$${iIdx+4},$${iIdx+5},$${iIdx+6})`);
        intParams.push(competencyIdMap[code], gapLevel, type,
          `${type.charAt(0).toUpperCase() + type.slice(1)}: Improve ${code} (${gapLevel} gap)`,
          `Structured ${type} to develop ${code} competency from a ${gapLevel} gap level.`,
          type === 'course' ? 'Coursera' : type === 'project' ? 'Internal' : 'MetryxOne Mentors',
          type === 'course' ? 6 : type === 'project' ? 8 : 12);
        iIdx += 7;
      }
    }
    if (intValues.length > 0) {
      await client.query(
        `INSERT INTO competency_interventions (competency_id, gap_level, type, title, description, provider, duration_weeks)
         VALUES ${intValues.join(',')}
         ON CONFLICT ON CONSTRAINT competency_interventions_comp_gaplevel_key DO NOTHING`,
        intParams
      );
    }

    const profileCount = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM users WHERE email LIKE 'bench_user_%@dummy.metryx.internal'`
    );
    const existingProfileCount: number = profileCount.rows[0].cnt;
    const TARGET_PROFILES = 100;
    if (existingProfileCount < TARGET_PROFILES) {
      const toAdd = TARGET_PROFILES - existingProfileCount;
      console.log(`[Competency] Seeding ${toAdd} dummy career profiles with scores (${existingProfileCount} already present)...`);
      for (let i = existingProfileCount; i < TARGET_PROFILES; i++) {
        const role = ROLES[i % ROLES.length];
        const stage = CAREER_STAGES[i % CAREER_STAGES.length];
        const industry = PROFILE_INDUSTRIES[i % PROFILE_INDUSTRIES.length];
        const expYears = stage === 'junior' ? 1 + (i % 2) : stage === 'mid' ? 3 + (i % 3) : stage === 'senior' ? 7 + (i % 4) : 12 + (i % 5);

        const dummyEmail = `bench_user_${i}@dummy.metryx.internal`;
        const uRes = await client.query(
          `INSERT INTO users (email, full_name, role, password_hash) VALUES ($1,$2,'user','x') ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name RETURNING id`,
          [dummyEmail, `Bench User ${i}`]
        );
        const userId = uRes.rows[0].id;

        const pRes = await client.query(
          `INSERT INTO career_profiles (user_id, current_job_role, target_job_role, industry, career_stage, experience_years)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE SET current_job_role=EXCLUDED.current_job_role RETURNING id`,
          [userId, role, ROLES[(i + 1) % ROLES.length], industry, stage, expYears]
        );
        const profileId = pRes.rows[0].id;

        const scoreValues: string[] = [];
        const scoreParams: unknown[] = [];
        let sIdx = 1;
        for (const compId of allCompetencyIds) {
          const raw = 30 + Math.floor(Math.random() * 60);
          const confidence = 0.7 + Math.random() * 0.3;
          const finalScore = Math.min(Math.round(raw * confidence), 100);
          scoreValues.push(`($${sIdx},$${sIdx+1},$${sIdx+2},$${sIdx+3},$${sIdx+4})`);
          scoreParams.push(profileId, compId, raw, confidence.toFixed(2), finalScore);
          sIdx += 5;
        }
        if (scoreValues.length > 0) {
          await client.query(
            `INSERT INTO competency_scores (profile_id, competency_id, raw_score, confidence, final_score) VALUES ${scoreValues.join(',')} ON CONFLICT (profile_id, competency_id) DO NOTHING`,
            scoreParams
          );
        }
      }
    } else {
      console.log(`[Competency] ${existingProfileCount} profiles already present — skipping profile seed.`);
    }

    console.log('[Competency] Seed complete — 7 domains, 50 competencies, 7-industry benchmarks, 100 profiles.');
  } catch (err) {
    console.error('[Competency] Seed error:', err);
    throw err;
  } finally {
    client.release();
  }
}

function getBaseWeight(role: string, competencyCode: string, stage: string): number {
  const stageMultiplier = { junior: 0.8, mid: 1.0, senior: 1.1, lead: 1.2 }[stage] ?? 1.0;
  const domain = competencyCode.slice(0, 3);
  const roleWeights: Record<string, Record<string, number>> = {
    'Software Engineer': { COG: 1.4, COM: 0.9, LEA: 0.7, EXE: 1.1, ADP: 1.2, TEC: 1.5, EIQ: 0.8 },
    'Product Manager':  { COG: 1.2, COM: 1.4, LEA: 1.2, EXE: 1.3, ADP: 1.1, TEC: 1.0, EIQ: 1.1 },
    'Data Analyst':     { COG: 1.5, COM: 0.9, LEA: 0.7, EXE: 1.0, ADP: 1.0, TEC: 1.4, EIQ: 0.8 },
    'Team Lead':        { COG: 1.1, COM: 1.2, LEA: 1.5, EXE: 1.3, ADP: 1.0, TEC: 1.0, EIQ: 1.2 },
    'Director':         { COG: 1.2, COM: 1.3, LEA: 1.5, EXE: 1.2, ADP: 1.0, TEC: 0.9, EIQ: 1.3 },
    'Consultant':       { COG: 1.3, COM: 1.4, LEA: 1.0, EXE: 1.1, ADP: 1.2, TEC: 1.2, EIQ: 1.1 },
  };
  const base = (roleWeights[role]?.[domain] ?? 1.0) * stageMultiplier;
  return Math.round(base * 1000) / 1000;
}
