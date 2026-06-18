/**
 * CAPADEX WC-7C — Commercial Intelligence read surface.
 *
 *   GET /api/capadex/admin/revenue-intelligence   (Wave 0)
 *     Admin-only (requireAuth + requireSuperAdmin). Flag isRevenueIntelligenceEnabled():
 *     OFF → {enabled:false} (byte-identical legacy). Read-only revenue attribution over the
 *     live Razorpay ledger; never 500s (degrades to {enabled:true, degraded:true}).
 *
 * The Wave 1 commercial activation (offer + subscription slots) rides the EXISTING activation
 * envelope (GET /api/capadex/session/:id/activation) and is gated by isCommercialActivationEnabled()
 * inside the Decision Orchestrator — no separate route here.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  isRevenueIntelligenceEnabled,
  isCommercialEntitlementEnabled,
  isCommercialRenewalEnabled,
  isCommercialUpsellEnabled,
  isCommercialLifecycleStateEnabled,
  isCommercialForecastInputsEnabled,
} from '../config/feature-flags';
import { buildRevenueIntelligence } from '../services/wc7c/revenue-intelligence';
import { buildEntitlementOverview } from '../services/wc7c/entitlement-engine';
import { buildRenewalPipeline } from '../services/wc7c/renewal-engine';
import { buildUpsellOverview } from '../services/wc7c/upsell-engine';
import { buildSubscriptionLifecycle } from '../services/wc7c/subscription-lifecycle';
import { buildForecastInputs } from '../services/wc7c/commercial-forecast-inputs';

export function registerWc7cCommercialRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  app.get(
    '/api/capadex/admin/revenue-intelligence',
    requireAuth,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      if (!isRevenueIntelligenceEnabled()) {
        return res.status(200).json({ enabled: false });
      }
      try {
        const data = await buildRevenueIntelligence(pool);
        return res.status(200).json({ enabled: true, ...data });
      } catch (err) {
        console.warn(
          '[wc7c-commercial] revenue-intelligence failed, degrading:',
          err instanceof Error ? err.message : String(err),
        );
        return res.status(200).json({ enabled: true, degraded: true, reason: 'revenue_intelligence_error' });
      }
    },
  );

  // Commercial Wave 2 — read-only commercial lifecycle surface. Per-section flag gating; when NO
  // section flag is ON the route returns {enabled:false} (byte-identical legacy). Never 500s — each
  // section degrades independently to {degraded:true}.
  app.get(
    '/api/capadex/admin/commercial-lifecycle',
    requireAuth,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      const flags = {
        entitlement: isCommercialEntitlementEnabled(),
        renewal: isCommercialRenewalEnabled(),
        upsell: isCommercialUpsellEnabled(),
        lifecycle: isCommercialLifecycleStateEnabled(),
        forecast_inputs: isCommercialForecastInputsEnabled(),
      };
      if (!Object.values(flags).some(Boolean)) {
        return res.status(200).json({ enabled: false });
      }

      const out: Record<string, unknown> = { enabled: true, generated_at: new Date().toISOString() };

      const section = async <T>(name: string, on: boolean, build: () => Promise<T>): Promise<void> => {
        if (!on) return;
        try {
          out[name] = await build();
        } catch (err) {
          console.warn(
            `[wc7c-commercial] ${name} failed, degrading:`,
            err instanceof Error ? err.message : String(err),
          );
          out[name] = { degraded: true, reason: `${name}_error` };
        }
      };

      await section('entitlement', flags.entitlement, () => buildEntitlementOverview(pool));
      await section('renewal', flags.renewal, () => buildRenewalPipeline(pool));
      await section('upsell', flags.upsell, () => buildUpsellOverview(pool));
      await section('lifecycle', flags.lifecycle, () => buildSubscriptionLifecycle(pool));
      await section('forecast_inputs', flags.forecast_inputs, () => buildForecastInputs(pool));

      return res.status(200).json(out);
    },
  );
}
