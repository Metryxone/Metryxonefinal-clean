/**
 * MX-302H — Institutional Intelligence routes (read-only composer).
 *
 * Wires the previously-MOCK institutional dashboards (University / Faculty /
 * Placement Officer / Parent) to REAL institute-scoped aggregation by COMPOSING
 * existing substrates (readiness history, competency profiles, employer offers,
 * accreditation), every score aggregate k-anonymity gated:
 *   - GET /api/institutional-intelligence/enabled                 flag probe (no auth; flag state isn't sensitive)
 *   - GET /api/institutional-intelligence/overview                university — readiness + department(=batch) breakdown
 *   - GET /api/institutional-intelligence/heatmap                 competency heatmap (domain × batch), gated
 *   - GET /api/institutional-intelligence/gaps                    institution-wide critical gaps, gated
 *   - GET /api/institutional-intelligence/placement               placement officer — offers/pipeline (honest unavailable)
 *   - GET /api/institutional-intelligence/accreditation           accreditation records (honest empty)
 *   - GET /api/institutional-intelligence/industry-alignment      future-readiness proxy, gated
 *   - GET /api/institutional-intelligence/faculty                 faculty — per-student roster (?batchId optional)
 *   - GET /api/institutional-intelligence/parent/readiness/:childId  parent — child placement readiness (consent-gated)
 *
 * Strictly additive + reversible + flag-gated (`institutionalIntelligence`,
 * FF_INSTITUTIONAL_INTELLIGENCE, default OFF):
 *   - OFF → every route 503 before any auth/DB touch → byte-identical legacy
 *     behaviour (no schema touched; the dashboards keep their mock content).
 *   - GET-only; the composer reads via to_regclass probes and NEVER writes (no DDL).
 *   - Role-aware tenant scoping: institute + role resolved from institutes.admin_user_id
 *     (institute_admin) OR institute_staff→staff_roles (placement_officer / faculty /
 *     staff); faculty is batch-confined via staff_batch_assignments. No institute → 403
 *     no_institute_scope; role outside a surface's allow-list → 403 role_not_authorised.
 *     Parent reads gated by parent_student_links + consent (NOT institute scope).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  resolveInstituteForUser,
  composeOverview,
  composeHeatmap,
  composeGaps,
  composePlacement,
  composeAccreditation,
  composeIndustryAlignment,
  composeFaculty,
  resolveParentChildAccess,
  composeParentPlacementReadiness,
  type InstituteScope,
  type InstituteRole,
} from '../services/institutional-intelligence-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('institutionalIntelligence')) {
    return res.status(503).json({ ok: false, error: 'institutional_intelligence_disabled' });
  }
  next();
}

function callerId(req: Request): string {
  const u: any = (req as any).user ?? {};
  return String(u.id ?? u.userId ?? u.user_id ?? '').trim();
}

const degraded = (res: Response) =>
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });

export function registerInstitutionalIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
): void {
  // Flag probe — UNGATED on purpose (flag STATE is not sensitive; matches the
  // MX-302 family contract). Returns 200 with the live flag boolean so the UI can
  // decide; only the DATA routes below 503 when OFF. enabled:false → UI renders
  // the legacy mock byte-identically.
  app.get('/api/institutional-intelligence/enabled', async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: isFlagEnabled('institutionalIntelligence') });
  });

  // Resolve the caller's institute + role or respond 403 (strict tenant boundary),
  // THEN authorise the resolved role against the surface's allowed roles.
  //
  // Role → surface matrix (least-privilege; each role sees only its own surfaces):
  //   - institute_admin (university lens): every institute surface.
  //   - placement_officer: institute-level placement + the university analytics it
  //     needs to do its job (overview/heatmap/gaps/industry-alignment/accreditation).
  //   - faculty: ONLY the faculty roster, batch-confined inside composeFaculty.
  //   - parent: NOT institute-scoped at all (separate consent-gated route below).
  async function withInstitute(
    req: Request,
    res: Response,
    allowedRoles: InstituteRole[],
  ): Promise<InstituteScope | null> {
    const scope = await resolveInstituteForUser(pool, callerId(req));
    if (!scope) {
      res.status(403).json({ ok: false, error: 'no_institute_scope', message: 'Caller is not an admin or staff member of any institute.' });
      return null;
    }
    if (!allowedRoles.includes(scope.role)) {
      res.status(403).json({ ok: false, error: 'role_not_authorised', role: scope.role, message: `Role '${scope.role}' may not access this surface.` });
      return null;
    }
    return scope;
  }

  // University analytics surfaces — institute admin + placement officer.
  const UNIVERSITY_ROLES: InstituteRole[] = ['institute_admin', 'placement_officer'];

  app.get('/api/institutional-intelligence/overview', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, UNIVERSITY_ROLES); if (!scope) return;
      res.json(await composeOverview(pool, scope));
    } catch (err) { console.error('[institutional-intelligence] overview error:', err); degraded(res); }
  });

  app.get('/api/institutional-intelligence/heatmap', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, UNIVERSITY_ROLES); if (!scope) return;
      res.json(await composeHeatmap(pool, scope));
    } catch (err) { console.error('[institutional-intelligence] heatmap error:', err); degraded(res); }
  });

  app.get('/api/institutional-intelligence/gaps', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, UNIVERSITY_ROLES); if (!scope) return;
      res.json(await composeGaps(pool, scope));
    } catch (err) { console.error('[institutional-intelligence] gaps error:', err); degraded(res); }
  });

  // Placement officer surface — institute admin + placement officer.
  app.get('/api/institutional-intelligence/placement', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, ['institute_admin', 'placement_officer']); if (!scope) return;
      res.json(await composePlacement(pool, scope));
    } catch (err) { console.error('[institutional-intelligence] placement error:', err); degraded(res); }
  });

  app.get('/api/institutional-intelligence/accreditation', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, UNIVERSITY_ROLES); if (!scope) return;
      res.json(await composeAccreditation(pool, scope));
    } catch (err) { console.error('[institutional-intelligence] accreditation error:', err); degraded(res); }
  });

  app.get('/api/institutional-intelligence/industry-alignment', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, UNIVERSITY_ROLES); if (!scope) return;
      res.json(await composeIndustryAlignment(pool, scope));
    } catch (err) { console.error('[institutional-intelligence] industry-alignment error:', err); degraded(res); }
  });

  // Faculty surface — institute admin + faculty (faculty is batch-confined inside
  // composeFaculty via scope.allowed_batch_ids; placement officer is NOT a faculty).
  app.get('/api/institutional-intelligence/faculty', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const scope = await withInstitute(req, res, ['institute_admin', 'faculty']); if (!scope) return;
      const batchId = req.query.batchId != null ? String(req.query.batchId) : null;
      res.json(await composeFaculty(pool, scope, batchId));
    } catch (err) { console.error('[institutional-intelligence] faculty error:', err); degraded(res); }
  });

  // Parent view — gated by parent_student_links + DPDP consent (NOT institute scope).
  app.get('/api/institutional-intelligence/parent/readiness/:childId', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const access = await resolveParentChildAccess(pool, callerId(req), String(req.params.childId));
      res.json(await composeParentPlacementReadiness(pool, access));
    } catch (err) { console.error('[institutional-intelligence] parent readiness error:', err); degraded(res); }
  });
}
