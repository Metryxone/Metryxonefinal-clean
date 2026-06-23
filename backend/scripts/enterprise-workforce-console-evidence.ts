/**
 * MX-100X PHASE 9 — Enterprise Workforce Console evidence generator (direct engine; flag-independent).
 *
 * Proves each of the 7 views either renders from REAL composed engine output OR abstains honestly —
 * and that NOTHING is fabricated:
 *   - skill-gap / succession / mobility / workforce-planning / talent-risk render real composed rows.
 *   - talent-forecasting / readiness-forecasting trends only emit when >= 2 longitudinal points exist
 *     (otherwise abstained:true, no slope).
 *   - cohort aggregates suppressed below k=30.
 *
 * Read-only: composes existing engines + read-only SELECTs. Writes NOTHING to the DB.
 * Writes a committed audit artifact to backend/audit/phase9-enterprise-workforce-console/coverage.md.
 *
 * Run: cd backend && npx tsx scripts/enterprise-workforce-console-evidence.ts
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
  DEFAULT_ORG_ID,
  MIN_TREND_POINTS,
  K_MIN,
  consoleOverview,
  skillGapView,
  successionView,
  mobilityView,
  workforcePlanningView,
  talentRiskView,
  talentForecastingView,
  readinessForecastingView,
  type ConsoleView,
} from '../services/enterprise-workforce-console';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];
  const log = (s = '') => {
    lines.push(s);
    console.log(s);
  };

  try {
    log('# Phase 9 — Enterprise Workforce Intelligence Console: Coverage Evidence');
    log('');
    log(`- Version: \`${ENTERPRISE_WORKFORCE_CONSOLE_VERSION}\``);
    log(`- Generated: ${new Date().toISOString()}`);
    log(`- Org: \`${DEFAULT_ORG_ID}\``);
    log(`- Forecast abstention threshold: \`${MIN_TREND_POINTS}\` points · k-anonymity: \`k=${K_MIN}\``);
    log('');
    log('Composes the EXISTING predictive-workforce (Phase 5) + M5 enterprise engines. Read-only:');
    log('no recompute, no DDL, no writes. Unmeasured → null/abstain, never fabricated 0.');
    log('');

    const overview = await consoleOverview(pool, DEFAULT_ORG_ID);
    log('## 1. Overview — view availability');
    log('');
    log('| View | Available | Abstained | Reason |');
    log('|------|-----------|-----------|--------|');
    for (const [name, v] of Object.entries(overview.views)) {
      log(`| ${name} | ${v.available} | ${v.abstained} | ${v.reason ?? '—'} |`);
    }
    log('');
    log(`Summary: ${overview.summary.available}/${overview.summary.total_views} views available, ${overview.summary.abstained} abstained.`);
    log('');

    const views: Array<[string, ConsoleView]> = [
      ['skill-gap', await skillGapView(pool, DEFAULT_ORG_ID)],
      ['succession', await successionView(pool, DEFAULT_ORG_ID)],
      ['internal-mobility', await mobilityView(pool, DEFAULT_ORG_ID)],
      ['workforce-planning', await workforcePlanningView(pool, DEFAULT_ORG_ID)],
      ['talent-risk', await talentRiskView(pool, DEFAULT_ORG_ID)],
      ['talent-forecasting', await talentForecastingView(pool)],
      ['readiness-forecasting', await readinessForecastingView(pool, DEFAULT_ORG_ID)],
    ];

    log('## 2. Per-view coverage + provenance');
    log('');
    for (const [name, v] of views) {
      log(`### ${name}`);
      log('');
      log(`- available: \`${v.available}\` · abstained: \`${v.abstained}\`${v.reason ? ` · reason: ${v.reason}` : ''}`);
      log(`- engines: ${v.provenance.engines.map((e) => `\`${e}\``).join(', ')}`);
      log(`- tables: ${v.provenance.tables.map((t) => `\`${t}\``).join(', ')}`);
      const cov = (v.data as any)?.coverage;
      if (cov) log(`- coverage: \`${JSON.stringify(cov)}\``);
      if (v.provenance.notes) for (const nt of v.provenance.notes) log(`- note: ${nt}`);
      log('');
    }

    // Honesty spotlight: the two trend views.
    log('## 3. Forecast honesty (>=2 points or abstain — no fabricated slope)');
    log('');
    const tf = views.find(([n]) => n === 'talent-forecasting')![1].data as any;
    for (const [metric, t] of Object.entries(tf.trends) as Array<[string, any]>) {
      log(`- talent-forecasting · ${metric}: points=${t.points}, available=${t.available}, abstained=${t.abstained}` +
        (t.available ? `, direction=${t.direction}, slope=${t.slope}, forecast_next=${t.forecast_next}` : `, reason=${t.reason}`));
    }
    const rf = views.find(([n]) => n === 'readiness-forecasting')![1].data as any;
    log(`- readiness-forecasting · distinct_subjects=${rf.distinct_subjects}, cohort_suppressed=${rf.cohort_suppressed} (${rf.cohort_suppression_reason ?? 'not suppressed'})`);
    for (const st of rf.subject_trends as any[]) {
      log(`  - subject ${st.subject_id}: points=${st.points}, available=${st.available}, ` +
        (st.available ? `direction=${st.direction}, forecast_next=${st.forecast_next}` : `reason=${st.reason}`));
    }
    log('');

    log('## 4. k-anonymity (cohort aggregates suppressed below k=30)');
    log('');
    const mob = views.find(([n]) => n === 'internal-mobility')![1].data as any;
    log(`- internal-mobility cohort avg mobility_alignment: distinct_people=${mob.distinct_people}, suppressed=${mob.cohort_suppressed} (${mob.cohort_suppression_reason ?? 'not suppressed'})`);
    log(`- readiness-forecasting cohort latest readiness avg: distinct_subjects=${rf.distinct_subjects}, suppressed=${rf.cohort_suppressed} (${rf.cohort_suppression_reason ?? 'not suppressed'})`);
    log('');
    log('---');
    log('All view outputs above are composed from existing engine reads + read-only snapshot SELECTs.');
    log('No rows were written and no DDL was run by this evidence pass.');

    const outDir = path.join(process.cwd(), 'audit', 'phase9-enterprise-workforce-console');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'coverage.md'), lines.join('\n') + '\n', 'utf8');
    console.log(`\n[evidence] wrote ${path.join('backend/audit/phase9-enterprise-workforce-console', 'coverage.md')}`);
  } catch (err) {
    console.error('[evidence] FATAL:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
