import { Pool } from 'pg';
import {
  employerWorkforceOverview,
  employeeWorkforceOverview,
  subjectReadinessTrendView,
} from '../../services/enterprise-workforce-console';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const emp = await employerWorkforceOverview(pool);
    console.log('EMPLOYER overview summary:', JSON.stringify(emp.summary), 'views:', Object.keys(emp.views));
    for (const [k, v] of Object.entries(emp.views)) console.log('  ', k, 'available=', v.available, 'abstained=', v.abstained);

    const meTrend = await subjectReadinessTrendView(pool, 'nonexistent-subject');
    console.log('EMPLOYEE trend (nonexistent):', meTrend.available, meTrend.abstained, meTrend.reason);

    const meEmpty = await subjectReadinessTrendView(pool, '');
    console.log('EMPLOYEE trend (empty subject):', meEmpty.available, meEmpty.abstained, meEmpty.reason);

    const ov = await employeeWorkforceOverview(pool, 'some-user-id');
    console.log('EMPLOYEE overview keys:', Object.keys(ov), 'fr.personalized=', ov.future_readiness.personalized, 'fr.available=', ov.future_readiness.available);
    console.log('SMOKE OK');
  } catch (e) {
    console.error('SMOKE FAIL', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
