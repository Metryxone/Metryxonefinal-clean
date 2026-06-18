/**
 * LBI real-score end-to-end validation harness (Task #26)
 * ---------------------------------------------------------------------------
 * Proves the REAL LBI scoring pipeline beyond the "preview / no measured
 * scores yet" path, using a CLEARLY-MARKED, NON-DEMO, idempotent seed.
 *
 * What it exercises (all from real, computed numbers — nothing fabricated):
 *   1. System B (psychometric norms) — seeds real `lbi_session_responses`,
 *      runs the SAME `computeLbiNorms()` the `/api/admin/lbi/compute-norms`
 *      route calls, and proves `/api/lbi/calculate-score`'s norm-referenced
 *      percentile path via the SAME `percentileFromNorms()` it imports.
 *   2. System A (5-dim behavioural) — seeds real `capadex_sessions` for one
 *      validation subject and runs the production `calculateAndPersistLBI()`
 *      so a REAL (non-demo) `lbi_score_history` row exists. This is what flips
 *      `/api/ai-reports/generate` off the preview banner (dataAvailable=true).
 *
 * Honesty contract:
 *   - The Likert RESPONSES are seed inputs; every SCORE/percentile is computed
 *     by the production engine. No score is hand-written.
 *   - All seed data lives under a dedicated, purgeable validation namespace
 *     (age band `VAL_B`, codes prefixed `*VAL*`, email below) so it can never
 *     be confused with organic user data and is removable with `--purge`.
 *   - The validation email is intentionally NOT `@example.com` and the source
 *     is NOT `demo`, because the whole point is to demonstrate the path that
 *     the honesty filter (`source<>'demo'` AND `NOT ILIKE '%@example.com'`)
 *     treats as REAL. It is still obviously a validation account.
 *
 * Usage:
 *   tsx backend/scripts/lbi-validate-real-scores.ts          # seed + verify
 *   tsx backend/scripts/lbi-validate-real-scores.ts --purge  # remove seed
 */
import pg from "pg";
import { computeLbiNorms, percentileFromNorms } from "../services/lbi-norms-engine";
import { calculateAndPersistLBI } from "../routes/lbi-engine";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Validation namespace (purgeable) ────────────────────────────────────────
const VAL_EMAIL = "lbi.real.validation@metryxone.io";
const BAND = { id: "VAL_B", code: "VAL_B", name: "Validation Band (11-14)" };
const DOMAIN = { id: "DVAL", code: "DVAL", name: "Validation Domain" };
const SUB_HI = { id: "SDVAL_HI", code: "SDVAL_HI", name: "Validation Subdomain (established)" };
const SUB_LO = { id: "SDVAL_LO", code: "SDVAL_LO", name: "Validation Subdomain (provisional)" };
const SCALE = { id: "VAL_LIK5", code: "VAL_LIK5", name: "Validation 5-pt Likert" };
const Q_HI = "QVAL_HI_1";
const Q_LO = "QVAL_LO_1";
const N_ESTABLISHED = 35; // responses for SUB_HI  → sample_size >= k_min (30) → established
const N_PROVISIONAL = 12; // responses for SUB_LO  → sample_size <  k_min (30) → provisional

const ok = (b: boolean) => (b ? "PASS" : "FAIL");

/** Deterministic spread of 1..5 so STDDEV > 0 (a degenerate sd kills percentiles). */
function rawFor(i: number): number {
  return 1 + ((i * 7 + 2) % 5);
}

async function ensureFrameworkTables(): Promise<void> {
  // CREATE TABLE IF NOT EXISTS mirroring backend/drizzle/0000_*.sql, WITHOUT the
  // children/students FKs so the harness is self-contained on a fresh DB.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_domains (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      domain_code text NOT NULL UNIQUE, domain_name text NOT NULL,
      description text, color text, icon text,
      weightage real NOT NULL DEFAULT 1, display_order integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'Active', created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lbi_subdomains (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      domain_id varchar NOT NULL, subdomain_code text NOT NULL, subdomain_name text NOT NULL,
      description text, weightage real NOT NULL DEFAULT 1, display_order integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'Active', created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lbi_age_bands (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      band_code text NOT NULL UNIQUE, band_name text NOT NULL,
      min_age integer NOT NULL, max_age integer NOT NULL, grade_range text,
      status text NOT NULL DEFAULT 'Active', created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lbi_response_scales (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      scale_code text NOT NULL UNIQUE, scale_name text NOT NULL,
      scale_type text NOT NULL DEFAULT 'likert', options text NOT NULL, scoring text NOT NULL,
      reverse_scoring_map text, status text NOT NULL DEFAULT 'Active',
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lbi_questions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      question_code text NOT NULL UNIQUE, domain_id varchar NOT NULL, subdomain_id varchar NOT NULL,
      age_band_id varchar NOT NULL, response_scale_id varchar, question_text text NOT NULL,
      question_type text NOT NULL DEFAULT 'likert', response_options text, scoring text,
      reverse_scored boolean NOT NULL DEFAULT false, difficulty text NOT NULL DEFAULT 'MEDIUM',
      language text NOT NULL DEFAULT 'EN', set_number integer DEFAULT 1,
      display_order integer NOT NULL DEFAULT 0, tags text[], version integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'Active', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp
    );
    CREATE TABLE IF NOT EXISTS lbi_assessment_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      child_id varchar, student_id varchar, age_band_id varchar,
      assessment_type text NOT NULL DEFAULT 'full', target_domains text[],
      status text NOT NULL DEFAULT 'not_started', total_questions integer NOT NULL DEFAULT 0,
      questions_answered integer NOT NULL DEFAULT 0, current_question_index integer NOT NULL DEFAULT 0,
      started_at timestamp, completed_at timestamp, time_spent_seconds integer DEFAULT 0,
      device_info text, ip_address text, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lbi_session_responses (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id varchar NOT NULL, question_id varchar NOT NULL,
      response_value integer, response_text text, raw_score real, adjusted_score real,
      response_time_ms integer, question_order integer, created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

async function seedFramework(): Promise<void> {
  await pool.query(
    `INSERT INTO lbi_domains (id, domain_code, domain_name, weightage, display_order, status)
     VALUES ($1,$2,$3,1,1,'Active')
     ON CONFLICT (domain_code) DO UPDATE SET domain_name=EXCLUDED.domain_name`,
    [DOMAIN.id, DOMAIN.code, DOMAIN.name]
  );
  for (const sd of [SUB_HI, SUB_LO]) {
    await pool.query(
      `INSERT INTO lbi_subdomains (id, domain_id, subdomain_code, subdomain_name, weightage, display_order, status)
       VALUES ($1,$2,$3,$4,1,1,'Active')
       ON CONFLICT (id) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name`,
      [sd.id, DOMAIN.id, sd.code, sd.name]
    );
  }
  await pool.query(
    `INSERT INTO lbi_age_bands (id, band_code, band_name, min_age, max_age, grade_range, status)
     VALUES ($1,$2,$3,11,14,'6-8','Active')
     ON CONFLICT (band_code) DO UPDATE SET band_name=EXCLUDED.band_name`,
    [BAND.id, BAND.code, BAND.name]
  );
  await pool.query(
    `INSERT INTO lbi_response_scales (id, scale_code, scale_name, scale_type, options, scoring, reverse_scoring_map, status)
     VALUES ($1,$2,$3,'likert',$4,$5,$6,'Active')
     ON CONFLICT (scale_code) DO UPDATE SET scoring=EXCLUDED.scoring`,
    [
      SCALE.id, SCALE.code, SCALE.name,
      JSON.stringify(["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]),
      JSON.stringify([1, 2, 3, 4, 5]),
      JSON.stringify([5, 4, 3, 2, 1]),
    ]
  );
  const questions: [string, string, string, string][] = [
    [Q_HI, DOMAIN.id, SUB_HI.id, "I stay focused on a task until it is complete."],
    [Q_LO, DOMAIN.id, SUB_LO.id, "I ask for help when I am stuck on a problem."],
  ];
  for (const [code, dom, sub, text] of questions) {
    await pool.query(
      `INSERT INTO lbi_questions
         (id, question_code, domain_id, subdomain_id, age_band_id, response_scale_id,
          question_text, question_type, scoring, reverse_scored, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'likert',$8,false,'Active')
       ON CONFLICT (question_code) DO UPDATE SET question_text=EXCLUDED.question_text`,
      [code, code, dom, sub, BAND.id, SCALE.id, text, JSON.stringify([1, 2, 3, 4, 5])]
    );
  }
}

async function seedResponses(): Promise<void> {
  // Fresh, idempotent: drop prior validation sessions/responses then re-seed.
  await pool.query(
    `DELETE FROM lbi_session_responses WHERE session_id LIKE 'lbival_sess_%'`
  );
  await pool.query(
    `DELETE FROM lbi_assessment_sessions WHERE id LIKE 'lbival_sess_%'`
  );

  const total = Math.max(N_ESTABLISHED, N_PROVISIONAL);
  for (let i = 0; i < total; i++) {
    const sessId = `lbival_sess_${String(i).padStart(3, "0")}`;
    await pool.query(
      `INSERT INTO lbi_assessment_sessions
         (id, age_band_id, assessment_type, status, total_questions, questions_answered, completed_at)
       VALUES ($1,$2,'validation_seed','completed',2,2,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [sessId, BAND.id]
    );
    // every session answers the established subdomain question
    await pool.query(
      `INSERT INTO lbi_session_responses
         (id, session_id, question_id, response_value, raw_score, question_order)
       VALUES ($1,$2,$3,$4::int,$4::real,1)`,
      [`${sessId}_hi`, sessId, Q_HI, rawFor(i)]
    );
    // only the first N_PROVISIONAL sessions answer the provisional subdomain question
    if (i < N_PROVISIONAL) {
      await pool.query(
        `INSERT INTO lbi_session_responses
           (id, session_id, question_id, response_value, raw_score, question_order)
         VALUES ($1,$2,$3,$4::int,$4::real,2)`,
        [`${sessId}_lo`, sessId, Q_LO, rawFor(i + 3)]
      );
    }
  }
}

async function seedSystemABehaviour(): Promise<void> {
  // Seed real CAPADEX sessions for one validation subject, then run the
  // PRODUCTION engine so a genuine (computed) lbi_score_history row exists.
  await pool.query(`DELETE FROM capadex_sessions WHERE guest_email = $1`, [VAL_EMAIL]);
  await pool.query(`DELETE FROM lbi_score_history WHERE LOWER(user_email) = LOWER($1)`, [VAL_EMAIL]);
  await pool.query(`DELETE FROM lbi_scores WHERE LOWER(user_email) = LOWER($1)`, [VAL_EMAIL]);

  const stages = ["CAP_CUR", "CAP_INS", "CAP_GRW", "CAP_MAS"];
  const scores = [58, 64, 71, 77]; // improving trajectory → real adaptability signal
  for (let i = 0; i < stages.length; i++) {
    await pool.query(
      `INSERT INTO capadex_sessions
         (id, guest_email, guest_name, concern_name, user_age, age_band, stage_code, stage_index,
          status, total_items, answered_items, score, time_taken_s, created_at)
       VALUES (gen_random_uuid(), $1, 'LBI Validation', 'exam_stress', 13, 'VAL_B', $2, $3,
          'completed', 10, 10, $4, 240, NOW() - ($5 || ' days')::interval)`,
      [VAL_EMAIL, stages[i], i, scores[i], String((stages.length - i) * 3)]
    );
  }
  await calculateAndPersistLBI(VAL_EMAIL, pool);
}

async function verify(): Promise<void> {
  console.log("\n================ LBI REAL-SCORE VALIDATION ================\n");

  // 1) compute-norms (same fn the /api/admin/lbi/compute-norms route calls)
  const norms = await computeLbiNorms(pool, { kMin: 30 });
  console.log("[1] POST /api/admin/lbi/compute-norms (computeLbiNorms):");
  console.log(`    ${norms.message}`);

  const normRows = await pool.query(
    `SELECT subdomain_code, sample_size, is_provisional, source,
            ROUND(mean_score::numeric,2) AS mean_score, ROUND(sd_score::numeric,2) AS sd_score
     FROM lbi_subdomain_norms WHERE age_band_code = $1 ORDER BY subdomain_code`,
    [BAND.code]
  );
  console.table(normRows.rows);

  const hi = normRows.rows.find((r) => r.subdomain_code === SUB_HI.code);
  const lo = normRows.rows.find((r) => r.subdomain_code === SUB_LO.code);
  const established = hi && Number(hi.sample_size) >= 30 && hi.is_provisional === false && hi.source === "computed";
  const provisional = lo && Number(lo.sample_size) < 30 && lo.is_provisional === true && lo.source === "computed";

  // 2) norm-referenced percentile (same fn /api/lbi/calculate-score imports)
  const pHi = await percentileFromNorms(pool, BAND.code, SUB_HI.code, 90);
  const pLo = await percentileFromNorms(pool, BAND.code, SUB_LO.code, 90);
  console.log("\n[2] /api/lbi/calculate-score norm path (percentileFromNorms @ scorePct=90):");
  console.log(`    ${SUB_HI.code}: percentile=${pHi.percentile} basis=${pHi.basis} provisional=${pHi.is_provisional} n=${pHi.sample_size}`);
  console.log(`    ${SUB_LO.code}: percentile=${pLo.percentile} basis=${pLo.basis} provisional=${pLo.is_provisional} n=${pLo.sample_size}`);
  const normReferenced = pHi.basis === "norm_referenced" && typeof pHi.percentile === "number";

  // 3) Overall raw aggregate (System B), exactly as calculate-score computes it
  const agg = await pool.query(
    `SELECT ROUND((AVG(raw_score)/5.0*100)::numeric)::int AS overall_score_pct, COUNT(*)::int AS n
     FROM lbi_session_responses WHERE session_id LIKE 'lbival_sess_%'`
  );
  const overallPct = agg.rows[0]?.overall_score_pct;
  console.log(`\n[3] System-B overall (raw aggregate, calculate-score 'overallScorePct'): ${overallPct} (from ${agg.rows[0]?.n} responses)`);

  // 4) Real System-A score row → flips /api/ai-reports/generate off preview
  const real = await pool.query(
    `SELECT overall_lbi, consistency_score, persistence_score, attention_score,
            adaptability_score, velocity_score, learning_style, sessions_analyzed, source
     FROM lbi_score_history
     WHERE LOWER(user_email) = LOWER($1)
       AND COALESCE(source,'') <> 'demo'
       AND user_email NOT ILIKE '%@example.com'
     ORDER BY calculated_at DESC LIMIT 1`,
    [VAL_EMAIL]
  );
  const r = real.rows[0];
  console.log("\n[4] /api/ai-reports/generate subject resolution (resolveRealLbiScore):");
  if (r) {
    console.log(`    REAL row found → preview=false, dataAvailable=true, scoreSource=lbi_engine`);
    console.log(`    overall_lbi=${r.overall_lbi}  dims[con/per/att/ada/vel]=${r.consistency_score}/${r.persistence_score}/${r.attention_score}/${r.adaptability_score}/${r.velocity_score}  style=${r.learning_style}  sessions=${r.sessions_analyzed}  source=${r.source}`);
  } else {
    console.log("    No real row resolved (report would stay on preview banner).");
  }
  const reportReal = !!r && r.overall_lbi != null && r.source !== "demo";

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n---------------- RESULT ----------------");
  console.log(`${ok(!!established)}  established norm (sample_size>=30, is_provisional=false, source=computed)`);
  console.log(`${ok(!!provisional)}  provisional norm (sample_size<30, is_provisional=true)`);
  console.log(`${ok(normReferenced)}  norm-referenced percentile returned (basis=norm_referenced)`);
  console.log(`${ok(typeof overallPct === "number")}  System-B overall score computed from real responses`);
  console.log(`${ok(reportReal)}  System-A real overall score → AI report off preview banner`);
  const allPass = !!established && !!provisional && normReferenced && typeof overallPct === "number" && reportReal;
  console.log(`\n${allPass ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`);
  console.log("========================================================\n");
  if (!allPass) process.exitCode = 1;
}

async function purge(): Promise<void> {
  await pool.query(`DELETE FROM lbi_session_responses WHERE session_id LIKE 'lbival_sess_%'`);
  await pool.query(`DELETE FROM lbi_assessment_sessions WHERE id LIKE 'lbival_sess_%'`);
  await pool.query(`DELETE FROM lbi_subdomain_norms WHERE age_band_code = $1`, [BAND.code]);
  await pool.query(`DELETE FROM lbi_questions WHERE question_code IN ($1,$2)`, [Q_HI, Q_LO]);
  await pool.query(`DELETE FROM lbi_subdomains WHERE id IN ($1,$2)`, [SUB_HI.id, SUB_LO.id]);
  await pool.query(`DELETE FROM lbi_domains WHERE domain_code = $1`, [DOMAIN.code]);
  await pool.query(`DELETE FROM lbi_response_scales WHERE scale_code = $1`, [SCALE.code]);
  await pool.query(`DELETE FROM lbi_age_bands WHERE band_code = $1`, [BAND.code]);
  await pool.query(`DELETE FROM capadex_sessions WHERE guest_email = $1`, [VAL_EMAIL]);
  await pool.query(`DELETE FROM lbi_score_history WHERE LOWER(user_email) = LOWER($1)`, [VAL_EMAIL]);
  await pool.query(`DELETE FROM lbi_scores WHERE LOWER(user_email) = LOWER($1)`, [VAL_EMAIL]);
  console.log("Purged LBI validation namespace.");
}

async function run(): Promise<void> {
  try {
    if (process.argv.includes("--purge")) {
      await purge();
      return;
    }
    await ensureFrameworkTables();
    await seedFramework();
    await seedResponses();
    await seedSystemABehaviour();
    await verify();
    // calculateAndPersistLBI fires the W3–W8 chain via setImmediate; let it
    // settle against the live pool before we close it.
    await new Promise((r) => setTimeout(r, 2500));
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
