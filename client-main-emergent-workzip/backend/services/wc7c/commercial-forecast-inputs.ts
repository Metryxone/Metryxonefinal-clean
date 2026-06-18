/**
 * CAPADEX Commercial Wave 2 — Commercial Forecast Inputs.
 *
 * READ-ONLY · NEVER-THROWS · NO NEW TABLES · directional contract, NOT a forecast.
 *
 * Prepares + MEASURES the INPUTS a commercial forecast would consume, reusing the WC-L2 forecast
 * CONTRACT: a forecast is clamp(last + slope) over an EXISTING trend and needs ≥ MIN_POINTS
 * comparable points (see services/wc3/forecast-intelligence.ts). This emits the input contract +
 * measured point availability per monthly series (paid revenue, paid count, new subscriptions,
 * upcoming expiries). It NEVER fabricates a series or a forecast — a series with < MIN_POINTS points
 * is `forecastable:false` (`insufficient_data`).
 */
import type { Pool } from 'pg';

const MIN_POINTS = 2; // mirrors WC-L2 forecast eligibility (≥2 comparable points)

export interface ForecastSeriesInput {
  key: string;
  label: string;
  points: number;
  forecastable: boolean;
  reason: string;
}

export interface ForecastInputs {
  generated_at: string;
  degraded: boolean;
  min_points: number;
  series: ForecastSeriesInput[];
  forecastable_count: number;
  total_series: number;
}

/** Counts the number of distinct monthly buckets a series has (each bucket = one comparable point). */
async function countMonthlyPoints(pool: Pool, sql: string): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql);
    return rows.length;
  } catch {
    return null;
  }
}

export async function buildForecastInputs(pool: Pool): Promise<ForecastInputs> {
  let degraded = false;

  const defs: { key: string; label: string; sql: string }[] = [
    {
      // Revenue-magnitude series — months that actually carry revenue (SUM(amount_paise) > 0).
      // Distinct forecast TARGET from paid_count; the two share monthly support today because every
      // payable SKU has a non-zero price, but they remain two independent forecast outputs.
      key: 'paid_revenue',
      label: 'Paid revenue by month',
      sql: `SELECT date_trunc('month', created_at) m FROM capadex_payments WHERE status='paid' GROUP BY 1 HAVING COALESCE(SUM(amount_paise), 0) > 0`,
    },
    {
      // Transaction-count series — months with ≥1 paid row, regardless of magnitude.
      key: 'paid_count',
      label: 'Paid transactions by month',
      sql: `SELECT date_trunc('month', created_at) m FROM capadex_payments WHERE status='paid' GROUP BY 1`,
    },
    {
      key: 'new_subscriptions',
      label: 'New package subscriptions by month',
      sql: `SELECT date_trunc('month', purchase_date) m FROM student_subscriptions GROUP BY 1`,
    },
    {
      key: 'upcoming_expiries',
      label: 'Subscription expiries by month',
      sql: `SELECT date_trunc('month', expiry_date) m FROM student_subscriptions WHERE expiry_date IS NOT NULL GROUP BY 1`,
    },
  ];

  const series: ForecastSeriesInput[] = [];
  for (const d of defs) {
    const points = await countMonthlyPoints(pool, d.sql);
    if (points === null) {
      degraded = true;
      series.push({ key: d.key, label: d.label, points: 0, forecastable: false, reason: 'series_unavailable' });
      continue;
    }
    const forecastable = points >= MIN_POINTS;
    series.push({
      key: d.key,
      label: d.label,
      points,
      forecastable,
      reason: forecastable ? 'forecastable' : 'insufficient_data',
    });
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    min_points: MIN_POINTS,
    series,
    forecastable_count: series.filter((s) => s.forecastable).length,
    total_series: series.length,
  };
}
