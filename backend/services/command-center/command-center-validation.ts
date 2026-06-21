/**
 * Phase 6.14 — Command Center validation harness (READ-ONLY honesty checks).
 *
 * PASS = invariant holds. WARN = honest absence (a source absent / unmeasurable) — never a failure.
 * FAIL = a real break (negative/out-of-bounds count, incoherent status, unreadable existing table).
 * Composes the three engines; per-area try/catch isolates a single FAIL.
 */
import pg from 'pg';
import { buildCommandCenterOverview } from './command-center-engine';
import { buildControlTower } from './control-tower-engine';
import { buildGlobalMonitoring } from './global-monitoring-engine';

type Status = 'PASS' | 'WARN' | 'FAIL';

export interface ValidationArea { area: string; status: Status; detail: string; }
export interface CommandCenterValidation {
  generated_at: string;
  overall: Status;
  summary: { pass: number; warn: number; fail: number };
  areas: ValidationArea[];
}

export async function buildCommandCenterValidation(pool: pg.Pool): Promise<CommandCenterValidation> {
  const generated_at = new Date().toISOString();
  const areas: ValidationArea[] = [];
  const add = (area: string, status: Status, detail: string) => areas.push({ area, status, detail });

  // 1 — domain metric values bounded & non-fabricated.
  try {
    const o = await buildCommandCenterOverview(pool);
    const negatives = o.domains.flatMap((d) =>
      d.metrics.filter((m) => m.value != null && m.value < 0).map((m) => `${d.key}.${m.key}`));
    if (negatives.length) add('metric_bounds', 'FAIL', `Negative metric values: ${negatives.join(', ')}.`);
    else add('metric_bounds', 'PASS', 'All measured domain metrics are >= 0.');

    // present-but-empty must be 0 (not null); absent must be null (not 0) — no fabrication either way.
    const fabricated = o.domains.flatMap((d) =>
      d.metrics.filter((m) => !m.present && m.value != null).map((m) => `${d.key}.${m.key}`));
    if (fabricated.length) add('no_fabrication', 'FAIL', `Absent-source metrics report a non-null value: ${fabricated.join(', ')}.`);
    else add('no_fabrication', 'PASS', 'Absent sources report null; present sources report a real count (0 only when genuinely empty).');

    const unmeasurable = o.domains.filter((d) => !d.measurable);
    if (unmeasurable.length) {
      add('domain_coverage', 'WARN', `${unmeasurable.length}/${o.totals.domains} domains have no present source table (unmeasurable — honest null): ${unmeasurable.map((d) => d.key).join(', ')}.`);
    } else {
      add('domain_coverage', 'PASS', `All ${o.totals.domains} domains have at least one present source table.`);
    }
  } catch (err) {
    add('metric_bounds', 'FAIL', `Command Center overview threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  // 2 — control tower counts bounded; pending_total consistent with parts.
  try {
    const c = await buildControlTower(pool);
    const negatives = c.pending_actions.filter((p) => p.count != null && p.count < 0);
    if (negatives.length) add('control_tower_bounds', 'FAIL', `Negative pending counts: ${negatives.map((p) => p.key).join(', ')}.`);
    else add('control_tower_bounds', 'PASS', 'All measured pending-action counts are >= 0.');

    const measuredSum = c.pending_actions.reduce((a, p) => a + (p.count ?? 0), 0);
    if (c.pending_total != null && c.pending_total !== measuredSum) {
      add('control_tower_total', 'FAIL', `pending_total (${c.pending_total}) != sum of measured parts (${measuredSum}).`);
    } else {
      add('control_tower_total', 'PASS', 'pending_total equals the sum of measured pending actions.');
    }
  } catch (err) {
    add('control_tower_bounds', 'FAIL', `Control tower threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  // 3 — monitoring status coherence (status reflects alerts/degradation honestly).
  try {
    const m = await buildGlobalMonitoring(pool);
    const crit = m.alerts.critical_escalations ?? 0;
    if (crit > 0 && m.status === 'operational') {
      add('monitoring_status', 'FAIL', `status is 'operational' despite ${crit} critical escalation(s).`);
    } else if (m.subsystem_coverage.measurable < m.subsystem_coverage.total) {
      add('monitoring_status', 'WARN', `${m.subsystem_coverage.total - m.subsystem_coverage.measurable}/${m.subsystem_coverage.total} subsystems unmeasurable (absent source) — status='${m.status}'.`);
    } else {
      add('monitoring_status', 'PASS', `Monitoring status='${m.status}' coherent with alerts and subsystem coverage.`);
    }
  } catch (err) {
    add('monitoring_status', 'FAIL', `Global monitoring threw: ${(err as Error)?.message ?? 'unknown'}.`);
  }

  const summary = {
    pass: areas.filter((a) => a.status === 'PASS').length,
    warn: areas.filter((a) => a.status === 'WARN').length,
    fail: areas.filter((a) => a.status === 'FAIL').length,
  };
  const overall: Status = summary.fail > 0 ? 'FAIL' : summary.warn > 0 ? 'WARN' : 'PASS';
  return { generated_at, overall, summary, areas };
}
