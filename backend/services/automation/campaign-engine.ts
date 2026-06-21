/**
 * Phase 6.13 — Campaign Engine (campaign_engine deliverable). READ-ONLY, never-throws.
 *
 * Composes campaign definitions (additive campaign_definitions table) with the EXISTING campaign
 * substrate (eios_campaigns, employer_pool_outreach) into an honest campaign posture. Absent sources
 * → null/empties, never fabricated.
 */
import pg from 'pg';

const N = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

export interface CampaignOverview {
  generated_at: string;
  degraded: boolean;
  provisioned: boolean;
  definitions: any[];
  by_type: { campaign_type: string; count: number }[];
  composed: {
    eios_campaigns: { count: number; target_total: number; sent_total: number; completed_total: number } | null;
    employer_outreach: { total: number; sent: number; pending: number } | null;
  };
  summary: { total_definitions: number; active_definitions: number };
  notes: string[];
}

export async function buildCampaignOverview(pool: pg.Pool): Promise<CampaignOverview> {
  const generated_at = new Date().toISOString();
  const notes: string[] = [];
  let degraded = false;

  // Additive campaign_definitions.
  let definitions: any[] = [];
  let byType: { campaign_type: string; count: number }[] = [];
  let activeDefs = 0;
  const defsTable = await tableExists(pool, 'campaign_definitions');
  if (defsTable) {
    try {
      const r = await pool.query(
        `SELECT id, campaign_key, name, campaign_type, audience_type, channel, status, created_at, updated_at
         FROM campaign_definitions ORDER BY campaign_type, campaign_key`);
      definitions = r.rows;
      activeDefs = definitions.filter((d) => String(d.status).toLowerCase() === 'active').length;
      const g = await pool.query(
        `SELECT campaign_type, COUNT(*)::int AS count FROM campaign_definitions GROUP BY campaign_type ORDER BY count DESC`);
      byType = g.rows.map((row) => ({ campaign_type: String(row.campaign_type), count: N(row.count) }));
    } catch { degraded = true; }
  } else {
    notes.push('campaign_definitions not provisioned — run console setup (POST /console/setup) to enable campaign storage.');
  }

  // Composed EXISTING substrate (read-only).
  let eios: CampaignOverview['composed']['eios_campaigns'] = null;
  if (await tableExists(pool, 'eios_campaigns')) {
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS count,
                COALESCE(SUM(target_count),0)::int AS target_total,
                COALESCE(SUM(sent_count),0)::int AS sent_total,
                COALESCE(SUM(completed_count),0)::int AS completed_total
         FROM eios_campaigns`);
      eios = {
        count: N(r.rows[0]?.count), target_total: N(r.rows[0]?.target_total),
        sent_total: N(r.rows[0]?.sent_total), completed_total: N(r.rows[0]?.completed_total),
      };
    } catch { degraded = true; }
  }

  let outreach: CampaignOverview['composed']['employer_outreach'] = null;
  if (await tableExists(pool, 'employer_pool_outreach')) {
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
                COUNT(*) FILTER (WHERE sent_at IS NULL)::int AS pending
         FROM employer_pool_outreach`);
      outreach = { total: N(r.rows[0]?.total), sent: N(r.rows[0]?.sent), pending: N(r.rows[0]?.pending) };
    } catch { degraded = true; }
  }

  notes.push('Composed counts (eios_campaigns, employer_pool_outreach) are read directly from the live substrate; this console does not create or send campaigns.');

  return {
    generated_at,
    degraded,
    provisioned: defsTable,
    definitions,
    by_type: byType,
    composed: { eios_campaigns: eios, employer_outreach: outreach },
    summary: { total_definitions: definitions.length, active_definitions: activeDefs },
    notes,
  };
}
