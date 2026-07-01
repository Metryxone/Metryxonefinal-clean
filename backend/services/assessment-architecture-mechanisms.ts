/**
 * Assessment Architecture Mechanisms (CAPADEX 3.0 · Program 3 · Phase 3.1)
 * ===========================================================================
 * The REUSE-before-build enhancement mechanisms that close the assessment-architecture
 * gaps to ENGINEERING closure. Kept SEPARATE from the read-only certification composer
 * (assessment-architecture-engine.ts) so the composer stays pure/DDL-free and these
 * write-capable mechanisms own all DDL (which runs ONLY on flag-gated write paths).
 *
 * Read-mostly engine that closes the assessment-architecture gaps AP-1, AP-4,
 * AP-5, AP-6, AP-8 to ENGINEERING closure — the capability is BUILT and computes
 * from REAL data, and ABSTAINS (null / provisional / honest reason) when data is
 * insufficient. It NEVER fabricates a norm, benchmark or classification.
 *
 * Gaps closed here:
 *  - AP-4/5/6  Norm groups (gender / education-tier / competitive-exam) over the
 *              SAME norm methodology as lbi-norms-engine (percentile_cont + k_min
 *              provisional flag), written to an OWN additive table so the legacy
 *              `lbi_subdomain_norms` (age norms) stays byte-identical incl. schema.
 *              Computation is gated on the dimension actually existing in the
 *              response substrate; gender norms are additionally ETHICS-gated OFF
 *              by default (env `ASSESSMENT_GENDER_NORMS_ENABLED`).
 *  - AP-8      Country benchmark cohorts, reusing the EXISTING `bench_cohorts`
 *              table + its `geography` column, by additively widening the
 *              `cohort_type` CHECK to admit `'country'` (only ever on this
 *              flag-gated write path — OFF leaves the constraint untouched).
 *  - AP-1      Deterministic Bloom classification of the behavioural clarity bank,
 *              stored in an OWN additive table; abstains (NULL) for affective
 *              self-report items where Bloom's cognitive taxonomy is not meaningful.
 *
 * Contract: additive · flag-gated · byte-identical OFF incl. schema (all DDL runs
 * ONLY on flag-gated write paths) · Coverage ⟂ Confidence ⟂ Adoption never
 * composited · null ≠ 0 · never-throws on read.
 */
import type { Pool } from 'pg';
import { standardScoresFromZ, zFromValue, type StandardScoreSet } from './psychometric-standardization';

export const ASSESSMENT_NORM_K_MIN = 30;

// ── never-throws read helpers (null on ERROR, 0 on no-rows — null ≠ 0) ──────────
async function tableExists(pool: Pool, qualified: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [qualified]);
    return Boolean(rows[0]?.reg);
  } catch { return false; }
}

async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
      [table, column],
    );
    return rows.length > 0;
  } catch { return false; }
}

async function readScalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    if (!rows.length) return 0;
    const v = rows[0][Object.keys(rows[0])[0]];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

async function readRows<T = Record<string, unknown>>(pool: Pool, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows as T[];
  } catch { return []; }
}

// ── DDL (runs ONLY from the flag-gated write paths → OFF creates 0 tables) ───────
export async function ensureAssessmentArchitectureSchema(pool: Pool): Promise<void> {
  // AP-4/5/6 — own additive norm-group table (legacy lbi_subdomain_norms untouched).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_group_norms (
      id               SERIAL PRIMARY KEY,
      norm_group_type  TEXT NOT NULL,
      norm_group_value TEXT NOT NULL,
      subdomain_code   TEXT NOT NULL,
      sample_size      INTEGER NOT NULL DEFAULT 0,
      mean_score       NUMERIC,
      sd_score         NUMERIC,
      p25_score        NUMERIC,
      p50_score        NUMERIC,
      p75_score        NUMERIC,
      is_provisional   BOOLEAN NOT NULL DEFAULT true,
      source           TEXT NOT NULL DEFAULT 'computed',
      computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(norm_group_type, norm_group_value, subdomain_code)
    );
    CREATE INDEX IF NOT EXISTS idx_agn_type ON assessment_group_norms(norm_group_type);
  `);
  // AP-1 — own additive Bloom table (capadex_clarity_questions untouched).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_clarity_bloom (
      question_id  TEXT PRIMARY KEY,
      bloom_level  TEXT,               -- NULL = abstained (not cognitively meaningful)
      basis        TEXT NOT NULL,
      confidence   NUMERIC(4,3),
      classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ccb_level ON capadex_clarity_bloom(bloom_level);
  `);
}

// ════════════════════════════════════════════════════════════════════════════
// AP-4 / AP-5 / AP-6 — Norm groups over the SAME methodology, real data only
// ════════════════════════════════════════════════════════════════════════════
export type NormGroupType = 'gender' | 'education_tier' | 'competitive_exam' | 'country';

/** The dimension column each norm group is computed from, on the LBI session substrate. */
const NORM_GROUP_DIMENSION: Record<NormGroupType, { table: string; column: string; ethicsGated: boolean }> = {
  gender:           { table: 'lbi_assessment_sessions', column: 'gender', ethicsGated: true },
  education_tier:   { table: 'lbi_assessment_sessions', column: 'education_tier', ethicsGated: false },
  competitive_exam: { table: 'lbi_assessment_sessions', column: 'competitive_exam', ethicsGated: false },
  country:          { table: 'lbi_assessment_sessions', column: 'country', ethicsGated: false },
};

export interface NormGroupComputeResult {
  norm_group_type: NormGroupType;
  computed: number;         // rows upserted
  established: number;      // sample >= k_min
  provisional: number;      // 0 < sample < k_min
  abstained: boolean;
  reason: string | null;    // why nothing/less was computed (honest)
  k_min: number;
}

function genderNormsEthicsEnabled(): boolean {
  const raw = (process.env.ASSESSMENT_GENDER_NORMS_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Recompute a norm group from REAL responses. Abstains (writes nothing) when the
 * dimension is not captured in the substrate, or — for gender — when the ethics
 * toggle is off. Uses the exact lbi response→subdomain join as lbi-norms-engine.
 */
export async function computeGroupNorms(pool: Pool, type: NormGroupType, kMin = ASSESSMENT_NORM_K_MIN): Promise<NormGroupComputeResult> {
  const base: NormGroupComputeResult = { norm_group_type: type, computed: 0, established: 0, provisional: 0, abstained: true, reason: null, k_min: kMin };
  const dim = NORM_GROUP_DIMENSION[type];

  if (dim.ethicsGated && !genderNormsEthicsEnabled()) {
    return { ...base, reason: 'ethics_gated_off' };
  }
  // Response substrate must be present.
  const haveSubstrate =
    (await tableExists(pool, 'public.lbi_session_responses')) &&
    (await tableExists(pool, 'public.lbi_questions')) &&
    (await tableExists(pool, 'public.lbi_subdomains')) &&
    (await tableExists(pool, `public.${dim.table}`));
  if (!haveSubstrate) return { ...base, reason: 'substrate_absent' };
  // The dimension itself must exist in the substrate — else we CANNOT honestly group.
  if (!(await columnExists(pool, dim.table, dim.column))) {
    return { ...base, reason: 'dimension_source_absent' };
  }

  try {
    await ensureAssessmentArchitectureSchema(pool);
    const upsert = await pool.query(
      `INSERT INTO assessment_group_norms
         (norm_group_type, norm_group_value, subdomain_code, sample_size,
          mean_score, sd_score, p25_score, p50_score, p75_score, is_provisional, source, computed_at)
       SELECT
         $1::text,
         s.${dim.column}::text,
         sd.subdomain_code,
         COUNT(*)::int,
         AVG(r.raw_score) / 5.0 * 100,
         STDDEV_SAMP(r.raw_score) / 5.0 * 100,
         percentile_cont(0.25) WITHIN GROUP (ORDER BY r.raw_score) / 5.0 * 100,
         percentile_cont(0.5)  WITHIN GROUP (ORDER BY r.raw_score) / 5.0 * 100,
         percentile_cont(0.75) WITHIN GROUP (ORDER BY r.raw_score) / 5.0 * 100,
         (COUNT(*) < $2),
         'computed',
         NOW()
       FROM lbi_session_responses r
       JOIN lbi_questions q   ON q.id = r.question_id
       JOIN lbi_subdomains sd ON sd.id = q.subdomain_id
       JOIN ${dim.table} s    ON s.id = r.session_id
       WHERE r.raw_score IS NOT NULL AND q.subdomain_id IS NOT NULL
         AND s.${dim.column} IS NOT NULL AND s.${dim.column}::text <> ''
       GROUP BY s.${dim.column}, sd.subdomain_code
       ON CONFLICT (norm_group_type, norm_group_value, subdomain_code) DO UPDATE SET
         sample_size = EXCLUDED.sample_size, mean_score = EXCLUDED.mean_score, sd_score = EXCLUDED.sd_score,
         p25_score = EXCLUDED.p25_score, p50_score = EXCLUDED.p50_score, p75_score = EXCLUDED.p75_score,
         is_provisional = EXCLUDED.is_provisional, source = EXCLUDED.source, computed_at = EXCLUDED.computed_at`,
      [type, kMin],
    );
    const est = await readScalar(pool, `SELECT COUNT(*)::int FROM assessment_group_norms WHERE norm_group_type = $1 AND is_provisional = false`, [type]);
    const prov = await readScalar(pool, `SELECT COUNT(*)::int FROM assessment_group_norms WHERE norm_group_type = $1 AND is_provisional = true`, [type]);
    const computed = upsert.rowCount ?? 0;
    return {
      norm_group_type: type, computed,
      established: est ?? 0, provisional: prov ?? 0,
      abstained: computed === 0,
      reason: computed === 0 ? 'no_grouped_responses' : null,
      k_min: kMin,
    };
  } catch {
    return { ...base, reason: 'compute_error' };
  }
}

/**
 * Look up a group norm and return the standard-score set for a raw 0..100 value.
 * Returns all-null scores (never fabricated) when no usable, established norm exists.
 */
export async function groupStandardScore(
  pool: Pool, type: NormGroupType, value: string, subdomainCode: string, rawPct: number | null,
): Promise<{ scores: StandardScoreSet; norm: { sample_size: number; is_provisional: boolean; source: string } | null; basis: string }> {
  const rows = await readRows<{ mean_score: string | null; sd_score: string | null; sample_size: number; is_provisional: boolean; source: string }>(
    pool,
    `SELECT mean_score, sd_score, sample_size, is_provisional, source
       FROM assessment_group_norms
      WHERE norm_group_type = $1 AND norm_group_value = $2 AND subdomain_code = $3 LIMIT 1`,
    [type, value, subdomainCode],
  );
  const nullSet = standardScoresFromZ(null);
  if (!rows.length) return { scores: nullSet, norm: null, basis: 'no_group_norm' };
  const r = rows[0];
  const mean = r.mean_score == null ? null : Number(r.mean_score);
  const sd = r.sd_score == null ? null : Number(r.sd_score);
  const z = zFromValue(rawPct, mean, sd);
  const norm = { sample_size: r.sample_size, is_provisional: r.is_provisional, source: r.source };
  if (z == null) return { scores: nullSet, norm, basis: 'norm_not_usable' };
  return { scores: standardScoresFromZ(z), norm, basis: r.is_provisional ? 'provisional_norm' : 'established_norm' };
}

// ════════════════════════════════════════════════════════════════════════════
// AP-8 — Country benchmark cohorts (reuse bench_cohorts + geography)
// ════════════════════════════════════════════════════════════════════════════
const ALLOWED_COHORT_TYPES = ['global', 'industry', 'function', 'role', 'layer', 'aspirational', 'region', 'country'];

/** Additively widen the bench_cohorts cohort_type CHECK to admit 'country'. Idempotent. */
export async function ensureCountryCohortConstraint(pool: Pool): Promise<{ ok: boolean; reason: string | null }> {
  if (!(await tableExists(pool, 'public.bench_cohorts'))) return { ok: false, reason: 'bench_cohorts_absent' };
  try {
    await pool.query(`ALTER TABLE bench_cohorts ADD COLUMN IF NOT EXISTS geography text`);
    await pool.query(`ALTER TABLE bench_cohorts DROP CONSTRAINT IF EXISTS bench_cohorts_cohort_type_check`);
    await pool.query(
      `ALTER TABLE bench_cohorts ADD CONSTRAINT bench_cohorts_cohort_type_check
         CHECK (cohort_type = ANY (ARRAY[${ALLOWED_COHORT_TYPES.map((t) => `'${t}'::text`).join(', ')}]))`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bench_cohorts_geography ON bench_cohorts (geography) WHERE geography IS NOT NULL`);
    return { ok: true, reason: null };
  } catch { return { ok: false, reason: 'constraint_error' }; }
}

export interface CountryCohortInput { id: string; name: string; geography: string; filters?: Record<string, unknown>; }

/** Register country benchmark cohorts (real geography codes only). Never seeds fabricated stats. */
export async function registerCountryCohorts(pool: Pool, cohorts: CountryCohortInput[]): Promise<{ registered: number; reason: string | null }> {
  const guard = await ensureCountryCohortConstraint(pool);
  if (!guard.ok) return { registered: 0, reason: guard.reason };
  let n = 0;
  for (const c of cohorts) {
    try {
      await pool.query(
        `INSERT INTO bench_cohorts (id, cohort_type, name, geography, filters, is_active)
         VALUES ($1, 'country', $2, $3, $4::jsonb, true)
         ON CONFLICT (id) DO UPDATE SET
           cohort_type = 'country', name = EXCLUDED.name, geography = EXCLUDED.geography,
           filters = EXCLUDED.filters, is_active = true`,
        [c.id, c.name, c.geography, JSON.stringify(c.filters ?? { cohort_kind: 'country_benchmark_scaffold' })],
      );
      n++;
    } catch { /* skip on error, never fabricate */ }
  }
  return { registered: n, reason: n === 0 ? 'no_cohorts_registered' : null };
}

export async function listCountryCohorts(pool: Pool): Promise<Array<Record<string, unknown>>> {
  return readRows(pool, `SELECT id, cohort_type, name, geography, is_active FROM bench_cohorts WHERE cohort_type = 'country' ORDER BY geography, id`);
}

// ════════════════════════════════════════════════════════════════════════════
// AP-1 — Deterministic Bloom classification of the clarity bank (honest abstain)
// ════════════════════════════════════════════════════════════════════════════
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

const BLOOM_KEYWORDS: Array<{ level: BloomLevel; tokens: string[] }> = [
  { level: 'create',    tokens: ['design', 'create', 'develop a plan', 'formulate', 'construct', 'compose', 'propose'] },
  { level: 'evaluate',  tokens: ['evaluate', 'justify', 'critique', 'assess whether', 'defend', 'judge', 'prioritise', 'prioritize'] },
  { level: 'analyze',   tokens: ['analyse', 'analyze', 'compare', 'contrast', 'differentiate', 'why do', 'what causes', 'break down'] },
  { level: 'apply',     tokens: ['apply', 'use the', 'calculate', 'solve', 'demonstrate', 'implement', 'how would you'] },
  { level: 'understand',tokens: ['explain', 'describe', 'summarise', 'summarize', 'interpret', 'what does', 'classify'] },
  { level: 'remember',  tokens: ['define', 'list', 'name the', 'recall', 'identify the', 'what is the term'] },
];

/**
 * Classify ONE clarity item. Behavioural clarity items are overwhelmingly
 * affective self-report ("how often do you…") where Bloom's COGNITIVE taxonomy is
 * not meaningful → we abstain (bloom_level = null) with an explicit basis. We only
 * assign a level when a cognitive-demand cue is genuinely present in the stem.
 */
export function classifyBloom(question: string, questionType: string | null, responseType: string | null): { level: BloomLevel | null; basis: string; confidence: number | null } {
  const q = (question || '').toLowerCase();
  const rt = (responseType || '').toLowerCase();
  const qt = (questionType || '').toLowerCase();

  // Affective / frequency self-report → Bloom cognitive taxonomy not meaningful.
  const affective = rt === 'frequency' || rt === 'likert' || /how often|how much|to what extent|how strongly|how confident|how comfortable/.test(q);
  if (affective && !/why|analyse|analyze|evaluate|design|justify/.test(q)) {
    return { level: null, basis: 'affective_self_report_not_cognitive', confidence: null };
  }
  for (const { level, tokens } of BLOOM_KEYWORDS) {
    if (tokens.some((t) => q.includes(t))) {
      return { level, basis: `stem_cue:${qt || 'generic'}`, confidence: 0.6 };
    }
  }
  return { level: null, basis: 'no_cognitive_cue', confidence: null };
}

export interface BloomClassifyResult { total: number; classified: number; abstained: number; by_level: Record<string, number>; }

/** Classify the whole clarity bank into the own table. Never overwrites source data. */
export async function classifyClarityBank(pool: Pool): Promise<BloomClassifyResult> {
  const empty: BloomClassifyResult = { total: 0, classified: 0, abstained: 0, by_level: {} };
  if (!(await tableExists(pool, 'public.capadex_clarity_questions'))) return empty;
  await ensureAssessmentArchitectureSchema(pool);
  const items = await readRows<{ question_id: string; question: string; question_type: string | null; response_type: string | null }>(
    pool, `SELECT question_id, question, question_type, response_type FROM capadex_clarity_questions`,
  );
  const byLevel: Record<string, number> = {};
  let classified = 0, abstained = 0;
  for (const it of items) {
    const r = classifyBloom(it.question, it.question_type, it.response_type);
    if (r.level) { classified++; byLevel[r.level] = (byLevel[r.level] || 0) + 1; } else { abstained++; }
    try {
      await pool.query(
        `INSERT INTO capadex_clarity_bloom (question_id, bloom_level, basis, confidence, classified_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (question_id) DO UPDATE SET
           bloom_level = EXCLUDED.bloom_level, basis = EXCLUDED.basis,
           confidence = EXCLUDED.confidence, classified_at = EXCLUDED.classified_at`,
        [it.question_id, r.level, r.basis, r.confidence],
      );
    } catch { /* never-throws */ }
  }
  return { total: items.length, classified, abstained, by_level: byLevel };
}

export async function bloomCoverage(pool: Pool): Promise<{ total: number; classified: number; abstained: number; by_level: Record<string, number>; note: string }> {
  const total = await readScalar(pool, `SELECT COUNT(*)::int FROM capadex_clarity_bloom`);
  if (total == null || total === 0) {
    return { total: 0, classified: 0, abstained: 0, by_level: {}, note: 'Not yet classified (run classify). Coverage null≠0.' };
  }
  const classified = (await readScalar(pool, `SELECT COUNT(*)::int FROM capadex_clarity_bloom WHERE bloom_level IS NOT NULL`)) ?? 0;
  const abstained = (await readScalar(pool, `SELECT COUNT(*)::int FROM capadex_clarity_bloom WHERE bloom_level IS NULL`)) ?? 0;
  const levels = await readRows<{ bloom_level: string; n: number }>(pool, `SELECT bloom_level, COUNT(*)::int AS n FROM capadex_clarity_bloom WHERE bloom_level IS NOT NULL GROUP BY bloom_level`);
  const byLevel: Record<string, number> = {};
  for (const l of levels) byLevel[l.bloom_level] = Number(l.n);
  return {
    total, classified, abstained, by_level: byLevel,
    note: 'Behavioural clarity items are largely affective self-report; abstention is honest, not a gap.',
  };
}
