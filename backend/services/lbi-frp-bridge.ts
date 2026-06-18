/**
 * LBI ↔ FRP Cross-Platform Intelligence Bridge  (E7)
 *
 * Bidirectional enrichment — read-only from both systems, never mutates scores:
 *   LBI → FRP: LBI behavioural dimensions validate / lift FRP signal confidence
 *   FRP → LBI: FRP market_alignment informs LBI market-risk surface
 *
 * Absent on either side degrades gracefully to partial enrichment.
 */
import type { Pool } from 'pg';

const LBI_TO_FRP_MAP = [
  { lbi_col: 'velocity_score',     frp_col: 'learning_velocity', frp_weight: 0.15 },
  { lbi_col: 'adaptability_score', frp_col: 'adaptability',      frp_weight: 0.20 },
  { lbi_col: 'persistence_score',  frp_col: 'skill_durability',  frp_weight: 0.30 },
] as const;

export interface BridgeDimension {
  lbi_value:  number | null;
  frp_value:  number | null;
  delta:      number | null;
  alignment:  'aligned' | 'gap' | 'insufficient_data';
  note:       string;
}

export interface LbiFrpEnrichment {
  lbi_email:           string;
  frp_user_id:         string | null;
  has_lbi_data:        boolean;
  has_frp_data:        boolean;
  behavioral_overlap:  Record<string, BridgeDimension>;
  confidence_lift:     number;
  frp_informed_risks:  string[];
  enrichment_note:     string;
  computed_at:         string;
}

async function resolveUserIdFromEmail(email: string, pool: Pool): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id::text FROM users
     WHERE LOWER(COALESCE(NULLIF(TRIM(email),''), username)) = $1 LIMIT 1`,
    [email.toLowerCase()],
  ).catch(() => ({ rows: [] as { id: string }[] }));
  return rows[0]?.id ?? null;
}

export async function computeLbiFrpEnrichment(
  email: string,
  pool: Pool,
): Promise<LbiFrpEnrichment> {
  const result: LbiFrpEnrichment = {
    lbi_email:          email,
    frp_user_id:        null,
    has_lbi_data:       false,
    has_frp_data:       false,
    behavioral_overlap: {},
    confidence_lift:    0,
    frp_informed_risks: [],
    enrichment_note:    'no_data',
    computed_at:        new Date().toISOString(),
  };

  try {
    const userId = await resolveUserIdFromEmail(email, pool);
    result.frp_user_id = userId;

    const [lbiRes, frpRes] = await Promise.all([
      pool.query<{
        velocity_score: number; adaptability_score: number;
        persistence_score: number; learning_style: string;
      }>(
        `SELECT velocity_score, adaptability_score, persistence_score, learning_style
         FROM lbi_scores WHERE user_email = $1 LIMIT 1`,
        [email],
      ).catch(() => ({ rows: [] as any[] })),

      userId
        ? pool.query<{
            composite: number; learning_velocity: number; adaptability: number;
            skill_durability: number; market_alignment: number; confidence: number;
          }>(
            `SELECT composite, learning_velocity, adaptability, skill_durability,
                    market_alignment, confidence
             FROM frp_user_readiness
             WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
            [userId],
          ).catch(() => ({ rows: [] as any[] }))
        : { rows: [] as any[] },
    ]);

    const lbi = lbiRes.rows[0] ?? null;
    const frp = frpRes.rows[0] ?? null;
    result.has_lbi_data = lbi != null;
    result.has_frp_data = frp != null;

    if (!lbi && !frp) { result.enrichment_note = 'no_data'; return result; }

    let liftSum = 0;
    let alignedCount = 0;

    for (const m of LBI_TO_FRP_MAP) {
      const lbiVal = lbi ? (Number((lbi as any)[m.lbi_col]) || null) : null;
      const frpVal = frp ? (Number((frp as any)[m.frp_col]) || null) : null;

      let alignment: BridgeDimension['alignment'] = 'insufficient_data';
      let delta: number | null = null;
      let note = 'insufficient_data';

      if (lbiVal != null && frpVal != null) {
        delta = Math.round(lbiVal - frpVal);
        alignment = Math.abs(delta) <= 15 ? 'aligned' : 'gap';
        note = alignment === 'aligned'
          ? `LBI behavioural evidence supports FRP signal (Δ${delta >= 0 ? '+' : ''}${delta})`
          : `Behavioural gap: LBI ${lbiVal.toFixed(0)} vs FRP ${frpVal.toFixed(0)} (Δ${delta >= 0 ? '+' : ''}${delta})`;
        if (alignment === 'aligned') {
          liftSum += m.frp_weight * 20;
          alignedCount++;
        }
      } else {
        note = lbiVal == null
          ? 'no LBI data for this dimension'
          : 'no FRP data for this dimension';
      }

      result.behavioral_overlap[`${m.lbi_col}→${m.frp_col}`] = {
        lbi_value: lbiVal, frp_value: frpVal, delta, alignment, note,
      };
    }

    result.confidence_lift = Math.round(liftSum);

    if (frp && Number(frp.market_alignment) < 40) {
      result.frp_informed_risks.push('market_alignment_risk');
      result.frp_informed_risks.push('role_relevance_risk');
    }

    result.enrichment_note = alignedCount > 0
      ? `${alignedCount}/${LBI_TO_FRP_MAP.length} dimensions aligned — +${result.confidence_lift}pt FRP confidence lift`
      : (lbi && frp ? 'dimensions diverge — review velocity and adaptability gaps' : 'partial_data');
  } catch (err) {
    console.error('[lbi-frp-bridge] error:', err);
    result.enrichment_note = 'computation_error';
  }

  return result;
}
