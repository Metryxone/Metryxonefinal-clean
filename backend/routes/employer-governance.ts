/**
 * Employer Competency Governance — 98X Gap Closure §8 (additive, feature-flagged, read-only).
 *
 * Mount prefix: /api/admin/employer-governance  (super-admin scope via the global
 * `app.use('/api/admin', auth -> superadmin)` gate). Additionally gated on
 * adaptiveIntelligenceFoundation -> employerCompetencyHiring so flag-OFF => 503.
 *
 * Read-only platform-wide aggregation across the employer competency-hiring subsystem:
 *   - employer / job / candidate counts
 *   - hiring-score distribution (banded over stored ep98_hiring_assessments.fit_score)
 *   - calibration state per org (tig_calibration)
 *   - demo-data transparency (rows sourced from the @example.com demo seed)
 *
 * HONESTY: every count is from rowCount of REAL stored rows (never recomputed, never
 * fabricated). Missing table => to_regclass probe degrades the affected block to null
 * (NOT a fake 0). GET never writes / no DDL.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isEmployerCompetencyHiringEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    employerCompetencyHiring: isEmployerCompetencyHiringEnabled(),
  };
}

function requireFlags(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    res.status(503).json({ ok: false, error: 'adaptiveIntelligenceFoundation disabled', feature_flag: flagState() });
    return;
  }
  if (!isEmployerCompetencyHiringEnabled()) {
    res.status(503).json({ ok: false, error: 'employerCompetencyHiring disabled', feature_flag: flagState() });
    return;
  }
  next();
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS reg`, [name]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}

export function registerEmployerGovernanceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequireAuth,
): void {
  app.get(
    '/api/admin/employer-governance/overview',
    requireFlags,
    requireAuth,
    async (_req: Request, res: Response) => {
      try {
        const [hasJobs, hasCandidates, hasAssessments, hasCalibration] = await Promise.all([
          tableExists(pool, 'employer_jobs'),
          tableExists(pool, 'employer_candidates'),
          tableExists(pool, 'ep98_hiring_assessments'),
          tableExists(pool, 'tig_calibration'),
        ]);

        // ── Counts (null when the substrate table is absent — never a fake 0) ──
        let employers: number | null = null;
        let jobs: number | null = null;
        if (hasJobs) {
          const { rows } = await pool.query(
            `SELECT COUNT(DISTINCT employer_id)::int AS employers, COUNT(*)::int AS jobs FROM employer_jobs`,
          );
          employers = rows[0]?.employers ?? 0;
          jobs = rows[0]?.jobs ?? 0;
        }

        let candidates: number | null = null;
        let demoCandidates: number | null = null;
        if (hasCandidates) {
          const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE email ILIKE '%@example.com')::int AS demo
               FROM employer_candidates`,
          );
          candidates = rows[0]?.total ?? 0;
          demoCandidates = rows[0]?.demo ?? 0;
        }

        // ── Hiring-score distribution over REAL stored fit_score values ──
        let hiringScore: any = null;
        if (hasAssessments) {
          const { rows } = await pool.query(
            `SELECT
               COUNT(*)::int                                                       AS scored,
               ROUND(AVG(fit_score)::numeric, 1)                                   AS avg_fit,
               COUNT(*) FILTER (WHERE fit_score >= 80)::int                        AS band_strong,
               COUNT(*) FILTER (WHERE fit_score >= 60 AND fit_score < 80)::int     AS band_developing,
               COUNT(*) FILTER (WHERE fit_score >= 40 AND fit_score < 60)::int     AS band_emerging,
               COUNT(*) FILTER (WHERE fit_score < 40)::int                         AS band_early
             FROM ep98_hiring_assessments`,
          );
          const r = rows[0];
          const scored = r?.scored ?? 0;
          hiringScore = {
            scored,
            avgFit: r?.avg_fit != null ? Number(r.avg_fit) : null,
            distribution: scored > 0
              ? {
                  strong: r.band_strong,
                  developing: r.band_developing,
                  emerging: r.band_emerging,
                  early: r.band_early,
                }
              : null,
            note: scored === 0
              ? 'No hiring assessments stored yet — run the employer hiring flow to populate.'
              : 'Banded over stored fit_score (≥80 strong · 60–79 developing · 40–59 emerging · <40 early).',
          };
        }

        // ── Calibration state per org ──
        let calibration: any = null;
        if (hasCalibration) {
          const { rows } = await pool.query(
            `SELECT org_id,
                    MIN(status) AS status,
                    MAX(total_outcomes)::int AS total_outcomes,
                    MIN(method) AS method,
                    ROUND(MIN(brier)::numeric, 3) AS brier,
                    ROUND(MIN(ece)::numeric, 3)   AS ece
               FROM tig_calibration
              GROUP BY org_id
              ORDER BY org_id`,
          );
          const orgs = rows.map((r) => ({
            orgId: r.org_id,
            status: r.status,
            totalOutcomes: r.total_outcomes,
            method: r.method,
            brier: r.brier != null ? Number(r.brier) : null,
            ece: r.ece != null ? Number(r.ece) : null,
          }));
          calibration = {
            orgs,
            calibratedOrgs: orgs.filter((o) => o.status === 'calibrated').length,
            note: orgs.length === 0
              ? 'No calibration rows — calibration is learned from ≥30 realized hire/reject outcomes.'
              : 'Calibration is learned per org from realized outcomes (Brier/ECE are raw, lower is better).',
          };
        }

        res.json({
          ok: true,
          counts: { employers, jobs, candidates, demoCandidates },
          hiringScore,
          calibration,
          substrate: {
            employer_jobs: hasJobs,
            employer_candidates: hasCandidates,
            ep98_hiring_assessments: hasAssessments,
            tig_calibration: hasCalibration,
          },
          demoTransparency: 'Demo rows are sourced from the @example.com seed and are purgeable; ' +
            'all scores are computed by the real hiring + calibration engines, never fabricated.',
          feature_flag: flagState(),
          generatedAt: new Date().toISOString(),
        });
      } catch {
        // Degrade honestly — never 500 the admin console.
        res.json({
          ok: false,
          degraded: true,
          error: 'governance_overview_unavailable',
          feature_flag: flagState(),
          generatedAt: new Date().toISOString(),
        });
      }
    },
  );
}
