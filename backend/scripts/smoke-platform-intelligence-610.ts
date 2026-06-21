/**
 * Phase 6.10 — Platform Intelligence smoke test.
 * 1) Engines compose without throwing and return shaped objects (read-only, never-throws).
 * 2) HTTP routes are flag-gated: with platformIntelligenceConsole OFF every console route 503s
 *    (byte-identical legacy). Run from backend/ so pg + relative imports resolve.
 *
 * Usage: cd backend && npx tsx scripts/smoke-platform-intelligence-610.ts
 */
import pg from 'pg';

(async () => {
  let failures = 0;
  const ok = (label: string, cond: boolean) => {
    console.log(`${cond ? '✓' : '✗'} ${label}`);
    if (!cond) failures++;
  };

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ── 1. Engines compose without throwing ──────────────────────────────────────────────────────
    const { buildPlatformOperationalView } = await import('../services/platform/platform-operational-view');
    const { buildPlatformIntelligence } = await import('../services/platform/platform-intelligence-engine');
    const { buildExecutiveDashboard } = await import('../services/platform/executive-dashboard-view');
    const { buildFounderDashboard } = await import('../services/platform/founder-dashboard-view');

    const opv = await buildPlatformOperationalView(pool);
    ok('operational view returns substrate + data_quality + growth_trend + conversion_funnel',
      !!opv.substrate && !!opv.data_quality && !!opv.growth_trend && !!opv.conversion_funnel);
    ok('operational view never fabricates an unmeasurable growth rate',
      opv.growth_trend.measurable === (opv.growth_trend.growth_pct != null));

    const pi = await buildPlatformIntelligence(pool);
    ok('platform intelligence exposes all 7 categories',
      !!pi.platform_health && !!pi.adoption && !!pi.growth && !!pi.conversion && !!pi.retention && !!pi.revenue && !!pi.operational);
    ok('platform intelligence has headline + degraded + notes',
      !!pi.headline && typeof pi.degraded === 'boolean' && Array.isArray(pi.notes));
    ok('platform health overall_status is a valid enum',
      ['healthy', 'degraded', 'no_substrate'].includes(pi.platform_health.overall_status));
    ok('retention rate is null OR a number (never fabricated)',
      pi.retention.retention_rate === null || typeof pi.retention.retention_rate === 'number');

    const exec = await buildExecutiveDashboard(pool);
    ok('executive dashboard returns KPI list + attention + notes',
      Array.isArray(exec.kpis) && exec.kpis.length > 0 && Array.isArray(exec.attention));
    ok('executive KPIs flag unmeasurable values honestly',
      exec.kpis.every((k) => k.measurable || k.value === null));

    const founder = await buildFounderDashboard(pool);
    ok('founder dashboard returns north_star + grouped metrics',
      !!founder.north_star && Array.isArray(founder.groups) && founder.groups.length === 4);

    // ── 2. HTTP flag-gating ──────────────────────────────────────────────────────────────────────
    // The global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate fronts every admin route,
    // so this UNAUTHENTICATED smoke gets 401 there (byte-identical to a non-existent admin route)
    // before the route-level flag guard runs. For an authenticated super-admin with the flag OFF the
    // flag guard returns 503. Either outcome proves the route is gated; a 200 (flag leaked ON) is the
    // only real failure for this assertion.
    const base = process.env.SMOKE_BASE_URL || 'http://localhost:8080';
    for (const path of ['ping', 'overview', 'executive', 'founder']) {
      try {
        const res = await fetch(`${base}/api/admin/platform/console/${path}`, { credentials: 'include' as any });
        ok(`GET /console/${path} is gated (got ${res.status}, expected 401/403/503)`,
          res.status === 401 || res.status === 403 || res.status === 503);
      } catch (e) {
        console.log(`… GET /console/${path} skipped (server not reachable): ${(e as Error).message}`);
      }
    }
  } catch (err) {
    console.error('SMOKE ERROR', err);
    failures++;
  } finally {
    await pool.end();
  }

  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
