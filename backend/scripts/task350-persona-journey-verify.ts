/**
 * Phase 3.2A verification — exercises the persona-journey resolver ON (flag set in-process)
 * against a minimal Express app. Does NOT touch the shared workflow env. Prints results.
 */
process.env.FF_PERSONA_JOURNEY_ROUTER = '1';
import express from 'express';
import http from 'http';
import { registerPersonaJourneyRoutes } from '../routes/persona-journey';

const app = express();
registerPersonaJourneyRoutes(app);
const server = app.listen(0);

function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: d ? JSON.parse(d) : null }));
    }).on('error', reject);
  });
}

(async () => {
  const cases = [
    '/api/persona-journey/enabled',
    '/api/persona-journey/route?legacyKey=student&persona=campus_student&ageBand=17-24&goal=career&timeline=short',
    '/api/persona-journey/route?legacyKey=jobseeker&persona=career_explorer&ageBand=17-24',
    '/api/persona-journey/route?legacyKey=professional&persona=people_manager&ageBand=24-45',
    '/api/persona-journey/route?legacyKey=parent&persona=parent&ageBand=6-14',
    '/api/persona-journey/route?legacyKey=teacher&persona=higher_ed_faculty&ageBand=24-45',
    '/api/persona-journey/route?legacyKey=&persona=unknown_admin&ageBand=',
  ];
  for (const c of cases) {
    const r = await get(c);
    const j = r.body || {};
    const summary = j.resolved
      ? `resolved=${j.resolved} journey=${j.journey?.key} stages=[${(j.lifecycle?.stages || []).map((s: any) => s.label).join('→')}] assessments=${(j.assessments || []).length} status=${j.journey?.status}`
      : j.enabled !== undefined
        ? `enabled=${j.enabled}`
        : `resolved=${j.resolved} reason=${j.reason}`;
    console.log(`[${r.status}] ${c}\n      ${summary}`);
  }
  server.close();
})();
