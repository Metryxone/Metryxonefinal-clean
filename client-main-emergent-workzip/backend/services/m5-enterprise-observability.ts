import type { Pool } from 'pg';

export const ENTERPRISE_OBSERVABILITY_VERSION = '5.0.0';

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;

export function createEnterpriseObservability(pool: Pool) {
  async function forecastAccuracy(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_forecast_accuracy WHERE org_id=$1 ORDER BY recorded_at DESC`,
      [orgId]);
    return r.rows;
  }

  async function simulationAccuracy(simulationId?: string) {
    const sql = simulationId
      ? `SELECT * FROM m5_simulation_accuracy_tracking WHERE simulation_id=$1 ORDER BY recorded_at DESC`
      : `SELECT * FROM m5_simulation_accuracy_tracking ORDER BY recorded_at DESC LIMIT 100`;
    const args = simulationId ? [simulationId] : [];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  async function observabilityLogs(orgId: string, eventType?: string, limit = 100) {
    const sql = eventType
      ? `SELECT * FROM m5_enterprise_observability_logs WHERE org_id=$1 AND event_type=$2 ORDER BY occurred_at DESC LIMIT $3`
      : `SELECT * FROM m5_enterprise_observability_logs WHERE org_id=$1 ORDER BY occurred_at DESC LIMIT $2`;
    const args = eventType ? [orgId, eventType, Math.min(limit, 500)] : [orgId, Math.min(limit, 500)];
    const r = await pool.query(sql, args);
    return r.rows;
  }

  async function recordEvent(orgId: string, eventType: string, payload: any) {
    const id = newId('m5eol');
    await pool.query(
      `INSERT INTO m5_enterprise_observability_logs(id, org_id, event_type, payload) VALUES ($1,$2,$3,$4)`,
      [id, orgId, eventType, JSON.stringify(payload ?? {})]);
    return { id };
  }

  async function recordSimulationAccuracy(args: { simulationId: string; predicted: number; actual: number }) {
    const mape = Math.abs(args.predicted - args.actual) / Math.max(Math.abs(args.actual), 1e-9);
    const id = newId('m5sat');
    await pool.query(
      `INSERT INTO m5_simulation_accuracy_tracking(id, simulation_id, predicted, actual, mape) VALUES ($1,$2,$3,$4,$5)`,
      [id, args.simulationId, args.predicted, args.actual, +mape.toFixed(3)]);
    return { id, mape: +mape.toFixed(3) };
  }

  async function driftStatus(orgId: string) {
    const rows = await forecastAccuracy(orgId);
    const summary = { stable: 0, warning: 0, critical: 0 };
    for (const r of rows) {
      const s = r.drift_status as keyof typeof summary;
      if (s in summary) summary[s]++;
    }
    return { org_id: orgId, total: rows.length, breakdown: summary, rows };
  }

  return { forecastAccuracy, simulationAccuracy, observabilityLogs, recordEvent, recordSimulationAccuracy, driftStatus };
}
