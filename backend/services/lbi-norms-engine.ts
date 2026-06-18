import pg from "pg";

/**
 * LBI Subdomain Norms Engine
 * --------------------------------------------------------------------------
 * Computes norm-referenced statistics for LBI subdomains directly from REAL
 * assessment responses (`lbi_session_responses`). Percentiles are derived from
 * these norms — never from the legacy `(raw/5)*100` raw-percentage shortcut,
 * which is NOT a percentile.
 *
 * Honesty contract:
 *  - Norms are only ever computed from real response data. Nothing is fabricated.
 *  - A norm row computed from fewer than `kMin` responses is flagged
 *    `is_provisional = true` and percentiles derived from it are labelled
 *    provisional so the UI can disclose the small sample.
 *  - When no norm row exists for a (age band, subdomain) pair, percentile is
 *    returned as `null` with an explicit basis — never a fabricated value.
 */

export const DEFAULT_NORM_K_MIN = 30;

/** Likert raw scores are 1..5; norms are stored on a 0..100 scale for comparability. */
function rawToPct(raw: number): number {
  return (raw / 5) * 100;
}

/** Abramowitz & Stegun 7.1.26 approximation of the error function. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Cumulative normal probability → percentile (0..100) for value x given mean/sd. */
function normalPercentile(x: number, mean: number, sd: number): number {
  if (!(sd > 0)) return x >= mean ? 50 : 50; // degenerate distribution → no discrimination
  const z = (x - mean) / sd;
  const p = 0.5 * (1 + erf(z / Math.SQRT2));
  return Math.max(1, Math.min(99, Math.round(p * 100)));
}

export async function ensureLbiNormsSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_subdomain_norms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      age_band_code text NOT NULL,
      subdomain_code text NOT NULL,
      min_score numeric DEFAULT 0,
      median_score numeric DEFAULT 50,
      top10_score numeric DEFAULT 100,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(age_band_code, subdomain_code)
    );
    ALTER TABLE lbi_subdomain_norms ADD COLUMN IF NOT EXISTS mean_score    numeric;
    ALTER TABLE lbi_subdomain_norms ADD COLUMN IF NOT EXISTS sd_score      numeric;
    ALTER TABLE lbi_subdomain_norms ADD COLUMN IF NOT EXISTS sample_size   integer;
    ALTER TABLE lbi_subdomain_norms ADD COLUMN IF NOT EXISTS is_provisional boolean DEFAULT true;
    ALTER TABLE lbi_subdomain_norms ADD COLUMN IF NOT EXISTS source        text DEFAULT 'unknown';
    ALTER TABLE lbi_subdomain_norms ADD COLUMN IF NOT EXISTS computed_at   timestamptz;
  `);
}

export interface ComputeNormsResult {
  ok: boolean;
  k_min: number;
  groups_computed: number;
  established: number;   // sample_size >= k_min
  provisional: number;   // 0 < sample_size < k_min
  total_responses: number;
  message: string;
}

/**
 * Recompute every (age band, subdomain) norm from real responses.
 * Returns honest counts; if there are no responses, nothing is written.
 */
export async function computeLbiNorms(
  pool: pg.Pool,
  opts: { kMin?: number } = {}
): Promise<ComputeNormsResult> {
  const kMin = opts.kMin ?? DEFAULT_NORM_K_MIN;
  await ensureLbiNormsSchema(pool);

  let totalResponses = 0;
  try {
    const respCount = await pool.query(
      `SELECT COUNT(*)::int AS n FROM lbi_session_responses
       WHERE to_regclass('public.lbi_questions') IS NOT NULL
         AND to_regclass('public.lbi_subdomains') IS NOT NULL
         AND to_regclass('public.lbi_assessment_sessions') IS NOT NULL
         AND to_regclass('public.lbi_age_bands') IS NOT NULL`
    );
    totalResponses = Number(respCount.rows[0]?.n ?? 0);
  } catch {
    totalResponses = 0; // responses table absent in this environment
  }
  if (totalResponses === 0) {
    return {
      ok: true,
      k_min: kMin,
      groups_computed: 0,
      established: 0,
      provisional: 0,
      total_responses: 0,
      message:
        "No real LBI responses exist yet. No norms were written (fabricating norms is not permitted).",
    };
  }

  // Aggregate distribution stats per (band, subdomain) from real responses only,
  // scaled to the 0..100 representation. Upsert with full provenance.
  const upsert = await pool.query(
    `
    INSERT INTO lbi_subdomain_norms
      (age_band_code, subdomain_code, min_score, median_score, top10_score,
       mean_score, sd_score, sample_size, is_provisional, source, computed_at, updated_at)
    SELECT
      ab.band_code,
      sd.subdomain_code,
      MIN(r.raw_score) / 5.0 * 100,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY r.raw_score) / 5.0 * 100,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY r.raw_score) / 5.0 * 100,
      AVG(r.raw_score) / 5.0 * 100,
      COALESCE(STDDEV_SAMP(r.raw_score), 0) / 5.0 * 100,
      COUNT(*)::int,
      COUNT(*) < $1,
      'computed',
      NOW(),
      NOW()
    FROM lbi_session_responses r
    JOIN lbi_questions q   ON q.id = r.question_id
    JOIN lbi_subdomains sd ON sd.id = q.subdomain_id
    JOIN lbi_assessment_sessions s ON s.id = r.session_id
    JOIN lbi_age_bands ab  ON ab.id = s.age_band_id
    WHERE r.raw_score IS NOT NULL AND q.subdomain_id IS NOT NULL
    GROUP BY ab.band_code, sd.subdomain_code
    ON CONFLICT (age_band_code, subdomain_code) DO UPDATE SET
      min_score      = EXCLUDED.min_score,
      median_score   = EXCLUDED.median_score,
      top10_score    = EXCLUDED.top10_score,
      mean_score     = EXCLUDED.mean_score,
      sd_score       = EXCLUDED.sd_score,
      sample_size    = EXCLUDED.sample_size,
      is_provisional = EXCLUDED.is_provisional,
      source         = 'computed',
      computed_at    = NOW(),
      updated_at     = NOW()
    RETURNING sample_size, is_provisional
    `,
    [kMin]
  );

  const established = upsert.rows.filter((r) => !r.is_provisional).length;
  const provisional = upsert.rows.filter((r) => r.is_provisional).length;

  return {
    ok: true,
    k_min: kMin,
    groups_computed: upsert.rowCount ?? 0,
    established,
    provisional,
    total_responses: totalResponses,
    message: `Computed ${upsert.rowCount ?? 0} subdomain norm(s) from real responses (${established} established, ${provisional} provisional at k_min=${kMin}).`,
  };
}

export interface NormPercentile {
  percentile: number | null;
  basis: "norm_referenced" | "no_norms" | "synthetic_norms";
  is_provisional: boolean;
  sample_size: number | null;
}

/**
 * Resolve a norm-referenced percentile for a score (0..100 scale) within a
 * (age band, subdomain). Returns null percentile when no usable norm exists.
 * Synthetic-default norms never yield a real percentile.
 */
export async function percentileFromNorms(
  pool: pg.Pool,
  ageBandCode: string,
  subdomainCode: string,
  scorePct: number
): Promise<NormPercentile> {
  try {
    const r = await pool.query(
      `SELECT mean_score, sd_score, sample_size, is_provisional, source
       FROM lbi_subdomain_norms
       WHERE age_band_code = $1 AND subdomain_code = $2
       LIMIT 1`,
      [ageBandCode, subdomainCode]
    );
    const row = r.rows[0];
    if (!row || row.source !== "computed" || row.mean_score == null) {
      return {
        percentile: null,
        basis: row && row.source !== "computed" ? "synthetic_norms" : "no_norms",
        is_provisional: row ? !!row.is_provisional : false,
        sample_size: row ? (row.sample_size ?? null) : null,
      };
    }
    const mean = Number(row.mean_score);
    const sd = Number(row.sd_score ?? 0);
    return {
      percentile: normalPercentile(scorePct, mean, sd),
      basis: "norm_referenced",
      is_provisional: !!row.is_provisional,
      sample_size: row.sample_size ?? null,
    };
  } catch {
    return { percentile: null, basis: "no_norms", is_provisional: false, sample_size: null };
  }
}

export { rawToPct };
