/**
 * MX-302D — Student Career Builder Exposure (flag probe only)
 * ----------------------------------------------------------------------------
 * Flag-gated (studentCareerBuilder / FF_STUDENT_CAREER_BUILDER). This phase is a
 * PURE frontend exposure + framing change over the EXISTING Career Builder — it
 * forks no engine, route or page. The only backend surface it needs is a cheap,
 * un-gated `/enabled` probe so the student dashboard and the shared Career
 * Builder can detect the flag state and conditionally render the new student
 * entry points / framing. It writes nothing, touches no DB, and performs no
 * computation.
 *
 * Default OFF → the probe reports `{enabled:false}` so every new student entry
 * point hides and the student dashboard / portal stay byte-identical.
 */
import type { Express, Request, Response } from 'express';
import { isStudentCareerBuilderEnabled } from '../config/feature-flags';

export function registerStudentCareerBuilderRoutes(app: Express): void {
  const BASE = '/api/student-career-builder';

  // Probe — intentionally NOT gated (cheap flag detection), mirrors MX-302A/B/C.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: isStudentCareerBuilderEnabled() });
  });
}
