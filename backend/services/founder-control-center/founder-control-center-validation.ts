/**
 * Phase 6.15 — Founder Control Center validation harness. READ-ONLY honesty check.
 * PASS = invariant holds · WARN = honest absence/unmeasurable (NOT a defect) · FAIL = real break
 * (out-of-bounds score, band/score incoherence, fabricated value, or a fabricated insight with no
 * measurable backing). Each area is independently try/caught so one failure can't mask the rest.
 */
import pg from 'pg';
import { buildFounderDashboard } from './founder-dashboard-engine';
import { buildExecutiveIntelligence } from './executive-intelligence-engine';
import { buildStrategicInsights } from './strategic-insights-engine';
import { healthBand } from './founder-control-center-lib';

export type Status = 'PASS' | 'WARN' | 'FAIL';
export interface ValidationArea { area: string; status: Status; detail: string; }
export interface FounderValidation {
  generated_at: string;
  overall: Status;
  degraded: boolean;
  areas: ValidationArea[];
}

export async function buildFounderControlCenterValidation(pool: pg.Pool): Promise<FounderValidation> {
  const generated_at = new Date().toISOString();
  const areas: ValidationArea[] = [];
  const add = (area: string, status: Status, detail: string) => areas.push({ area, status, detail });

  let degraded = false;

  // Area 1 — KPI bounds & honesty (no negative counts; absent → null not 0)
  try {
    const dash = await buildFounderDashboard(pool);
    degraded = degraded || dash.degraded;
    const all = dash.sections.flatMap((s) => s.kpis);
    const negative = all.filter((k) => k.value != null && k.value < 0);
    const fabricated = all.filter((k) => !k.present && k.value != null); // absent source must be null
    if (negative.length) add('Dashboard KPI bounds', 'FAIL', `${negative.length} KPI(s) negative: ${negative.map((k) => k.key).join(', ')}`);
    else if (fabricated.length) add('Dashboard KPI bounds', 'FAIL', `${fabricated.length} absent-source KPI(s) carry a value (fabricated): ${fabricated.map((k) => k.key).join(', ')}`);
    else {
      const measured = all.filter((k) => k.present).length;
      add('Dashboard KPI bounds', 'PASS', `${all.length} KPIs, ${measured} from present sources, none negative, absent→null upheld`);
    }
  } catch (e: any) { add('Dashboard KPI bounds', 'FAIL', `engine threw: ${e?.message || e}`); }

  // Area 2 — trend base safety (delta_pct null whenever previous is null/0)
  try {
    const dash = await buildFounderDashboard(pool);
    const bad = dash.sections.flatMap((s) => s.kpis)
      .filter((k) => k.trend && k.trend.delta_pct != null && (k.trend.previous == null || k.trend.previous <= 0));
    if (bad.length) add('Trend base safety', 'FAIL', `${bad.length} trend(s) computed delta on a non-positive base: ${bad.map((k) => k.key).join(', ')}`);
    else add('Trend base safety', 'PASS', 'no delta_pct over a null/zero prior window');
  } catch (e: any) { add('Trend base safety', 'FAIL', `engine threw: ${e?.message || e}`); }

  // Area 3 — health score bounds [0,100] or null
  try {
    const exec = await buildExecutiveIntelligence(pool);
    degraded = degraded || exec.degraded;
    const out = exec.domains.filter((d) => d.score != null && (d.score < 0 || d.score > 100));
    const compOut = exec.domains.flatMap((d) => d.components).filter((c) => c.value != null && (c.value < 0 || c.value > 100));
    if (out.length || compOut.length) add('Health score bounds', 'FAIL', `${out.length} domain + ${compOut.length} component score(s) out of [0,100]`);
    else add('Health score bounds', 'PASS', `${exec.domains.length} domains, all scores within [0,100] or null`);
  } catch (e: any) { add('Health score bounds', 'FAIL', `engine threw: ${e?.message || e}`); }

  // Area 4 — band/score coherence (band must match its score)
  try {
    const exec = await buildExecutiveIntelligence(pool);
    const incoherent = exec.domains.filter((d) => d.band !== healthBand(d.score));
    const measurableFlag = exec.domains.filter((d) => d.measurable !== (d.score != null));
    if (incoherent.length) add('Health band coherence', 'FAIL', `${incoherent.length} domain(s) band≠score band: ${incoherent.map((d) => d.key).join(', ')}`);
    else if (measurableFlag.length) add('Health band coherence', 'FAIL', `${measurableFlag.length} domain(s) measurable flag ≠ (score!=null)`);
    else add('Health band coherence', 'PASS', 'every domain band & measurable flag agree with its score');
  } catch (e: any) { add('Health band coherence', 'FAIL', `engine threw: ${e?.message || e}`); }

  // Area 5 — measurable health coverage (WARN when nothing is measurable yet — honest, not a defect)
  try {
    const exec = await buildExecutiveIntelligence(pool);
    const measurable = exec.domains.filter((d) => d.measurable).length;
    if (measurable === 0) add('Health coverage', 'WARN', 'no health domain is currently measurable (empty dev data) — honest absence');
    else add('Health coverage', 'PASS', `${measurable}/${exec.domains.length} health domains measurable`);
  } catch (e: any) { add('Health coverage', 'FAIL', `engine threw: ${e?.message || e}`); }

  // Area 6 — insight provenance (every insight bound to a metric_ref; none exceed measurable signals)
  try {
    const strat = await buildStrategicInsights(pool);
    degraded = degraded || strat.degraded;
    const unbound = strat.insights.filter((i) => !i.metric_ref || !i.metric_ref.trim());
    if (unbound.length) add('Insight provenance', 'FAIL', `${unbound.length} insight(s) lack a metric_ref (fabricated)`);
    else if (strat.insights.length === 0) add('Insight provenance', 'WARN', 'no insights emitted (insufficient measurable signal) — honest absence');
    else add('Insight provenance', 'PASS', `${strat.insights.length} insight(s), all provenance-bound to a measurable metric`);
  } catch (e: any) { add('Insight provenance', 'FAIL', `engine threw: ${e?.message || e}`); }

  // Area 7 — risk honesty (a high risk must be measurable; unmeasurable → severity 'info')
  try {
    const strat = await buildStrategicInsights(pool);
    const fakeHigh = strat.risk_indicators.filter((r) => !r.measurable && (r.severity === 'high' || r.severity === 'medium'));
    const unmeasurableNotInfo = strat.risk_indicators.filter((r) => !r.measurable && r.severity !== 'info');
    const fabricatedValue = strat.risk_indicators.filter((r) => !r.measurable && r.value != null); // unmeasurable risk must carry null
    if (fakeHigh.length || unmeasurableNotInfo.length) add('Risk honesty', 'FAIL', `${fakeHigh.length + unmeasurableNotInfo.length} unmeasurable risk(s) raised above 'info'`);
    else if (fabricatedValue.length) add('Risk honesty', 'FAIL', `${fabricatedValue.length} unmeasurable risk(s) carry a value (fabricated): ${fabricatedValue.map((r) => r.key).join(', ')}`);
    else add('Risk honesty', 'PASS', `${strat.risk_indicators.length} risk indicator(s); unmeasurable ones stay at 'info' with null value`);
  } catch (e: any) { add('Risk honesty', 'FAIL', `engine threw: ${e?.message || e}`); }

  const hasFail = areas.some((a) => a.status === 'FAIL');
  const hasWarn = areas.some((a) => a.status === 'WARN');
  const overall: Status = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';
  return { generated_at, overall, degraded, areas };
}
