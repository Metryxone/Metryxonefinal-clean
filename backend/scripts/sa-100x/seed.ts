/**
 * SA-100X readiness seed.
 *
 * Two clearly-separated layers:
 *   REFERENCE (real product config) — capadex_clarity_questions + capadex_question_registry
 *     (sourced from backend/data/capadex-concern-banks.ts, the canonical question catalogue),
 *     employer_competency_roles + eios_competency_roles (standard competency role library).
 *   DEMO (clearly labelled, disclosed) — every demo row carries a visible marker:
 *     session ids prefixed 'DEMO-SEED-', org/user ids 'demo-seed-*', emails '@example.com',
 *     source/description fields set to 'Demo Seed', JSONB payloads stamped {"source":"Demo Seed"}.
 *   All operations are idempotent: demo rows are deleted by their marker then re-inserted;
 *   reference rows use a sentinel (source_row_index=-777 / review_notes='SA100X_SEED') or ON CONFLICT.
 *
 * Run:  cd backend && npx tsx scripts/sa-100x/seed.ts
 */
import { Pool } from 'pg';
import { PRO_CONCERN_BANK, STUDENT_CONCERN_BANK, type ConcernBankItem } from '../../data/capadex-concern-banks';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
const pool = new Pool({ connectionString: DATABASE_URL });

const SEED_ROW_INDEX = -777;          // reference clarity rows sentinel
const REGISTRY_NOTE = 'SA100X_SEED';  // reference registry sentinel
const REF_EMPLOYER = 'EIOS-REFERENCE';
const DEMO_ORG = 'demo-seed-org';
const DEMO_USER = 'demo-seed-user';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

let FAILURES = 0;
async function run<T>(label: string, fn: () => Promise<number>): Promise<void> {
  try {
    const n = await fn();
    console.log(`  [ok]   ${label}: ${n} rows`);
  } catch (e: any) {
    FAILURES++;
    console.error(`  [FAIL] ${label}: ${e.message}`);
  }
}

// ── REFERENCE: clarity questions + registry from the canonical concern banks ──
function buildOptions(it: ConcernBankItem) {
  const present = [it.opt_a, it.opt_b, it.opt_c, it.opt_d].filter((x) => x != null && x !== '');
  if (present.length >= 2) {
    // multiple-choice: opt_a (healthiest) -> opt_d (most concern); ascending scores
    const cols = [it.opt_a ?? null, it.opt_b ?? null, it.opt_c ?? null, it.opt_d ?? null, null];
    const scores = cols.map((c, i) => (c != null && c !== '' ? i : 0));
    return { a: cols[0], b: cols[1], c: cols[2], d: cols[3], e: cols[4],
             as: scores[0], bs: scores[1], cs: scores[2], ds: scores[3], es: scores[4],
             rtype: 'multiple_choice' };
  }
  if (it.question_type === 'likert_agree') {
    return { a: 'Strongly Disagree', b: 'Disagree', c: 'Neutral', d: 'Agree', e: 'Strongly Agree',
             as: 0, bs: 1, cs: 2, ds: 3, es: 4, rtype: 'agreement' };
  }
  return { a: 'Never', b: 'Rarely', c: 'Sometimes', d: 'Often', e: 'Always',
           as: 0, bs: 1, cs: 2, ds: 3, es: 4, rtype: 'frequency' };
}

async function seedClarityAndRegistry(): Promise<number> {
  const items = [...PRO_CONCERN_BANK, ...STUDENT_CONCERN_BANK];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM capadex_clarity_questions WHERE source_row_index = $1`, [SEED_ROW_INDEX]);
    await client.query(`DELETE FROM capadex_question_registry WHERE review_notes = $1`, [REGISTRY_NOTE]);
    let n = 0;
    for (const it of items) {
      const o = buildOptions(it);
      const concernSlug = slug(it.concern_name);
      const polarity = it.polarity === '(-)' ? 'negative' : 'positive';
      await client.query(
        `INSERT INTO capadex_clarity_questions
          (question_id, concern_id, concern_id_prefix, master_bridge_tag, concern, stage,
           question_type, question, response_type,
           option_a, option_b, option_c, option_d, option_e,
           option_a_score, option_b_score, option_c_score, option_d_score, option_e_score,
           polarity, reverse_score, question_weight, source_row_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [it.item_code, concernSlug, concernSlug.split('_')[0], concernSlug, it.concern_name, it.stage_code,
         it.question_type ?? 'statement', it.question, o.rtype,
         o.a, o.b, o.c, o.d, o.e, o.as, o.bs, o.cs, o.ds, o.es,
         polarity, 'no', it.weight, SEED_ROW_INDEX],
      );
      await client.query(
        `INSERT INTO capadex_question_registry (question_id, version, status, quality_score, review_notes)
         VALUES ($1, 1, 'active', 0.80, $2)
         ON CONFLICT (question_id) DO UPDATE SET status='active', quality_score=0.80, review_notes=$2, updated_at=now()`,
        [it.item_code, REGISTRY_NOTE],
      );
      n++;
    }
    await client.query('COMMIT');
    return n;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── REFERENCE: standard competency role library ──────────────────────────────
const REF_ROLES = [
  { code: 'SWE',  name: 'Software Engineer',    fn: 'Engineering',     dept: 'Technology', sen: 'Mid',
    comps: ['Problem Solving', 'Technical Depth', 'Collaboration', 'Ownership'] },
  { code: 'DA',   name: 'Data Analyst',         fn: 'Analytics',       dept: 'Technology', sen: 'Mid',
    comps: ['Analytical Thinking', 'Communication', 'Attention to Detail', 'Business Acumen'] },
  { code: 'PM',   name: 'Product Manager',      fn: 'Product',         dept: 'Product',    sen: 'Senior',
    comps: ['Strategic Thinking', 'Stakeholder Management', 'Prioritisation', 'Customer Empathy'] },
  { code: 'SALES',name: 'Sales Executive',      fn: 'Sales',           dept: 'Commercial', sen: 'Mid',
    comps: ['Persuasion', 'Resilience', 'Relationship Building', 'Goal Orientation'] },
  { code: 'HRBP', name: 'HR Business Partner',  fn: 'Human Resources', dept: 'People',     sen: 'Senior',
    comps: ['Empathy', 'Conflict Resolution', 'Organisational Awareness', 'Integrity'] },
  { code: 'OPS',  name: 'Operations Manager',   fn: 'Operations',      dept: 'Operations', sen: 'Senior',
    comps: ['Process Orientation', 'Leadership', 'Decision Making', 'Adaptability'] },
  { code: 'CS',   name: 'Customer Success Lead', fn: 'Customer Success', dept: 'Commercial', sen: 'Mid',
    comps: ['Communication', 'Empathy', 'Problem Solving', 'Accountability'] },
  { code: 'FIN',  name: 'Finance Analyst',      fn: 'Finance',         dept: 'Finance',    sen: 'Mid',
    comps: ['Numerical Reasoning', 'Attention to Detail', 'Integrity', 'Analytical Thinking'] },
];

async function seedEmployerRoles(): Promise<number> {
  await pool.query(`DELETE FROM employer_competency_roles WHERE employer_id = $1`, [REF_EMPLOYER]);
  let n = 0;
  for (const r of REF_ROLES) {
    const targets = Object.fromEntries(r.comps.map((c) => [c, 70]));
    await pool.query(
      `INSERT INTO employer_competency_roles
         (employer_id, role_code, role_name, seniority, function_name, department, competencies, proficiency_targets)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (employer_id, role_code) DO UPDATE SET role_name=EXCLUDED.role_name, competencies=EXCLUDED.competencies, updated_at=now()`,
      [REF_EMPLOYER, r.code, r.name, r.sen, r.fn, r.dept, JSON.stringify(r.comps), JSON.stringify(targets)],
    );
    n++;
  }
  return n;
}

async function seedEiosRoles(): Promise<number> {
  let n = 0;
  for (const r of REF_ROLES) {
    const targets = Object.fromEntries(r.comps.map((c) => [c, 70]));
    await pool.query(
      `INSERT INTO eios_competency_roles
         (role_code, role_name, industry, function_name, department, seniority,
          behavioral_competencies, functional_competencies, cognitive_competencies, proficiency_targets)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (role_code) DO UPDATE SET role_name=EXCLUDED.role_name, behavioral_competencies=EXCLUDED.behavioral_competencies`,
      [r.code, r.name, 'Cross-Industry', r.fn, r.dept, r.sen,
       JSON.stringify(r.comps.slice(0, 2)), JSON.stringify(r.comps.slice(2)), JSON.stringify(['Reasoning', 'Learning Agility']),
       JSON.stringify(targets)],
    );
    n++;
  }
  return n;
}

// ── DEMO (labelled) ──────────────────────────────────────────────────────────
const PERSONAS = ['professional', 'campus', 'jobseeker', 'student'];
const AGE_BANDS = ['19-24', '25-34', '35-44', '13-18'];
const STAGES = ['CAP_CUR', 'CAP_PAT', 'CAP_ASP', 'CAP_DEC'];
const CONCERNS = ['Burnout', 'Procrastination', 'Career Confusion', 'Low Confidence', 'Work Stress'];

async function seedDemoCapadexRuntime(): Promise<number> {
  let total = 0;
  // clean
  await pool.query(`DELETE FROM capadex_session_telemetry WHERE session_id LIKE 'DEMO-SEED-%'`);
  await pool.query(`DELETE FROM capadex_signal_profiles   WHERE session_id LIKE 'DEMO-SEED-%'`);
  await pool.query(`DELETE FROM capadex_linguistic_signals WHERE session_id LIKE 'DEMO-SEED-%'`);
  await pool.query(`DELETE FROM capadex_session_signals    WHERE description = 'Demo Seed'`);

  for (let i = 0; i < 40; i++) {
    const sid = `DEMO-SEED-${String(i + 1).padStart(4, '0')}`;
    const persona = PERSONAS[i % PERSONAS.length];
    const stage = STAGES[i % STAGES.length];
    const concern = CONCERNS[i % CONCERNS.length];
    const age = AGE_BANDS[i % AGE_BANDS.length];

    for (let q = 0; q < 3; q++) {
      await pool.query(
        `INSERT INTO capadex_session_telemetry (session_id, question_id, hesitation_ms, backtrack_count, text_edit_count)
         VALUES ($1,$2,$3,$4,$5)`,
        [sid, `Q${q + 1}`, 800 + ((i * 37 + q * 11) % 4000), (i + q) % 3, (i + q) % 2],
      );
      total++;
    }
    await pool.query(
      `INSERT INTO capadex_session_signals (session_id, signal_type, signal_key, signal_value, weight, severity, confidence, description)
       VALUES (gen_random_uuid(), $1, $2, $3, 1.0, $4, 0.80, 'Demo Seed')`,
      ['behavioural', `${slug(concern)}_intensity`, JSON.stringify({ value: 0.4 + (i % 5) * 0.1, source: 'Demo Seed' }),
       ['minimal', 'low', 'moderate', 'elevated'][i % 4]],
    );
    total++;
    await pool.query(
      `INSERT INTO capadex_signal_profiles
         (session_id, concern_name, stage_code, persona, emotional_load, cognitive_load, engagement_score,
          risk_score, composite_intensity, severity_level, signal_count, linguistic_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [sid, concern, stage, persona, 30 + (i % 50), 25 + (i % 45), 40 + (i % 40),
       (i % 60), 0.3 + (i % 5) * 0.1, ['minimal', 'low', 'moderate', 'elevated'][i % 4], 3 + (i % 4),
       JSON.stringify({ source: 'Demo Seed', age_band: age })],
    );
    total++;
    await pool.query(
      `INSERT INTO capadex_linguistic_signals
         (session_id, concern_text, intensity_score, certainty_score, raw_word_count)
       VALUES ($1,$2,$3,$4,$5)`,
      [sid, `[Demo Seed] Reflection on ${concern.toLowerCase()}`, 0.3 + (i % 6) * 0.1, 0.4 + (i % 4) * 0.1, 20 + (i % 40)],
    );
    total++;
  }
  return total;
}

async function seedDemoEmployer(): Promise<number> {
  let total = 0;
  await pool.query(`DELETE FROM tig_clusters         WHERE org_id = $1`, [DEMO_ORG]);
  await pool.query(`DELETE FROM employer_risk_events  WHERE org_id = $1`, [DEMO_ORG]);
  await pool.query(`DELETE FROM ep98_hiring_assessments WHERE org_id = $1`, [DEMO_ORG]);
  await pool.query(`DELETE FROM tig_nodes            WHERE org_id = $1`, [DEMO_ORG]);
  await pool.query(`DELETE FROM eios_workforce_plans WHERE employer_id = $1`, [DEMO_ORG]);

  const clusters = [
    { id: 'high-potential', name: '[Demo Seed] High Potential', color: '#16A34A', size: 8, readiness: 78, growth: 12 },
    { id: 'steady',         name: '[Demo Seed] Steady Performers', color: '#344E86', size: 14, readiness: 62, growth: 6 },
    { id: 'at-risk',        name: '[Demo Seed] Needs Support', color: '#DC2626', size: 5, readiness: 41, growth: 3 },
  ];
  for (const c of clusters) {
    await pool.query(
      `INSERT INTO tig_clusters (id, org_id, cluster_id, cluster_name, color, size, avg_readiness, avg_growth, traits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [`${DEMO_ORG}-${c.id}`, DEMO_ORG, c.id, c.name, c.color, c.size, c.readiness, c.growth,
       JSON.stringify({ source: 'Demo Seed' })],
    );
    total++;
  }
  for (let i = 0; i < 10; i++) {
    await pool.query(
      `INSERT INTO employer_risk_events (id, org_id, user_id, event_type, severity, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [`${DEMO_ORG}-risk-${i}`, DEMO_ORG, `${DEMO_USER}-${i}`,
       ['attrition_risk', 'engagement_drop', 'skill_gap'][i % 3], ['low', 'medium', 'high'][i % 3],
       JSON.stringify({ source: 'Demo Seed', note: 'Illustrative monitored event' })],
    );
    total++;
    await pool.query(
      `INSERT INTO ep98_hiring_assessments
         (id, org_id, job_id, candidate_id, candidate_name, competency_match, behavior_match, fit_score, readiness_score, success_probability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [`${DEMO_ORG}-hire-${i}`, DEMO_ORG, `job-${i % 3}`, `${DEMO_USER}-${i}`, `[Demo Seed] Candidate ${i + 1}`,
       60 + (i % 35), 55 + (i % 40), 62 + (i % 30), 58 + (i % 35), 0.5 + (i % 4) * 0.1],
    );
    total++;
  }
  for (let i = 0; i < 12; i++) {
    await pool.query(
      `INSERT INTO tig_nodes (id, org_id, entity_type, entity_id, label, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [`${DEMO_ORG}-node-${i}`, DEMO_ORG, ['person', 'role', 'skill'][i % 3], `entity-${i}`,
       `[Demo Seed] Node ${i + 1}`, JSON.stringify({ source: 'Demo Seed' })],
    );
    total++;
  }
  for (let i = 0; i < 3; i++) {
    await pool.query(
      `INSERT INTO eios_workforce_plans (employer_id, plan_name, plan_data)
       VALUES ($1,$2,$3)`,
      [DEMO_ORG, `[Demo Seed] Workforce Plan ${i + 1}`,
       JSON.stringify({ source: 'Demo Seed', horizon_months: [12, 24, 36][i], headcount_target: 50 + i * 20 })],
    );
    total++;
  }
  return total;
}

async function seedDemoRoundouts(): Promise<number> {
  let total = 0;
  // competency intelligence — ti_fact_readiness
  await pool.query(`DELETE FROM ti_fact_readiness WHERE user_email LIKE '%demo.seed%'`);
  for (let i = 0; i < 10; i++) {
    await pool.query(
      `INSERT INTO ti_fact_readiness (user_email, rf_name, readiness_type, readiness_score, readiness_band, success_probability)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [`demo.seed.${i}@example.com`, '[Demo Seed] ' + REF_ROLES[i % REF_ROLES.length].name, 'role_readiness',
       45 + (i % 45), ['Emerging', 'Developing', 'Proficient'][i % 3], 0.4 + (i % 5) * 0.1],
    );
    total++;
  }
  // ei data — frp_user_skill_profile (UNIQUE on user_id AND skill_code separately)
  await pool.query(`DELETE FROM frp_user_skill_profile WHERE source = 'demo_seed'`);
  const skills = ['SKILL_DEMO_AI', 'SKILL_DEMO_DATA', 'SKILL_DEMO_COMM', 'SKILL_DEMO_LEAD',
                  'SKILL_DEMO_DESIGN', 'SKILL_DEMO_CLOUD', 'SKILL_DEMO_FIN', 'SKILL_DEMO_OPS'];
  for (let i = 0; i < skills.length; i++) {
    await pool.query(
      `INSERT INTO frp_user_skill_profile (user_id, skill_code, proficiency_level, is_verified, source)
       VALUES ($1,$2,$3,$4,'demo_seed')`,
      [`${DEMO_USER}-${i}`, skills[i], 40 + (i % 50), i % 2 === 0],
    );
    total++;
  }
  // career intelligence — cg_user_skill_gaps + cg_user_career_path (role_id must exist in cg_roles)
  const { rows: roleRows } = await pool.query(`SELECT id FROM cg_roles ORDER BY id LIMIT 3`);
  const roleIds: number[] = roleRows.map((r: any) => r.id);
  if (roleIds.length > 0) {
    await pool.query(`DELETE FROM cg_user_skill_gaps WHERE user_id = $1`, [DEMO_USER]);
    const gapSkills = ['Communication', 'Leadership', 'Analytics', 'Strategy', 'Execution', 'Adaptability'];
    for (let i = 0; i < gapSkills.length; i++) {
      const userLvl = 30 + (i % 40), reqLvl = 70;
      await pool.query(
        `INSERT INTO cg_user_skill_gaps
           (user_id, role_id, skill_key, skill_label, user_level, required_level, gap_delta, gap_severity, importance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [DEMO_USER, roleIds[i % roleIds.length], slug(gapSkills[i]), gapSkills[i], userLvl, reqLvl,
         reqLvl - userLvl, reqLvl - userLvl > 30 ? 'critical' : 'moderate', i % 2 === 0 ? 'core' : 'preferred'],
      );
      total++;
    }
    if (roleIds.length >= 2) {
      await pool.query(`DELETE FROM cg_user_career_path WHERE user_id = $1`, [DEMO_USER]);
      await pool.query(
        `INSERT INTO cg_user_career_path (user_id, from_role_id, to_role_id, path_role_ids, total_months, source)
         VALUES ($1,$2,$3,$4,$5,'demo_seed')`,
        [DEMO_USER, roleIds[0], roleIds[1], `{${roleIds.slice(0, 2).join(',')}}`, 18],
      );
      total++;
    }
  }
  return total;
}

async function main() {
  console.log('SA-100X seed starting…');
  console.log('REFERENCE (real config):');
  await run('clarity_questions + question_registry', seedClarityAndRegistry);
  await run('employer_competency_roles', seedEmployerRoles);
  await run('eios_competency_roles', seedEiosRoles);
  console.log('DEMO (labelled, disclosed):');
  await run('capadex runtime (telemetry/signals/profiles/linguistic)', seedDemoCapadexRuntime);
  await run('employer (clusters/risk/hiring/nodes/plans)', seedDemoEmployer);
  await run('round-outs (ti_fact_readiness/frp/cg)', seedDemoRoundouts);
  await pool.end();
  if (FAILURES > 0) {
    console.error(`SA-100X seed FAILED: ${FAILURES} block(s) errored — fix before trusting the audit.`);
    process.exit(1);
  }
  console.log('SA-100X seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
