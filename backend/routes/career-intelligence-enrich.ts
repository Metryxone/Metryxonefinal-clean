/**
 * PHASE 4 — additive Career Intelligence enrichment for the EXISTING career surfaces.
 *
 * `attachCareerIntelligence` is the single composition primitive that wires the
 * read-only Career Intelligence bridge into the user-facing career routes
 * (readiness / pathways / planning / growth / development) WITHOUT rebuilding any
 * of them. It is strictly additive and honesty-first:
 *
 *   - Flag OFF (`FF_CAREER_INTELLIGENCE` default OFF) => returns the legacy payload
 *     UNTOUCHED and performs NO DB touch => byte-identical legacy behaviour.
 *   - Flag ON => resolves the subject via the `resolveEffectiveUserId` IDOR guard
 *     (super-admin may target another user; everyone else is pinned to their own id;
 *     an explicit cross-user request is refused — enrichment is simply omitted), then
 *     attaches the composed envelope (or a caller-chosen slice) under the additive
 *     `career_intelligence` key. The bridge never recomputes or fabricates: when a
 *     subject has no EI data it returns `measurable:false` / "unavailable" honestly.
 *   - Never throws: any failure degrades to the legacy payload (the existing surface
 *     is never broken by the additive layer).
 */

import type { Request } from 'express';
import type { Pool } from 'pg';
import { isCareerIntelligenceEnabled } from '../config/feature-flags.js';
import { resolveEffectiveUserId } from './behavioural-memory.js';
import {
  buildCareerIntelligence,
  type CareerIntelligenceEnvelope,
} from '../services/career-intelligence-bridge.js';

export async function attachCareerIntelligence<T extends Record<string, unknown>>(
  pool: Pool,
  req: Request,
  requestedId: unknown,
  base: T,
  pick?: (env: CareerIntelligenceEnvelope) => Record<string, unknown>,
): Promise<T> {
  // Flag OFF => byte-identical: legacy payload, no DB touch, no envelope build.
  if (!isCareerIntelligenceEnabled()) return base;
  try {
    const resolved = resolveEffectiveUserId(req, requestedId);
    if (resolved.forbidden || !resolved.userId) return base;
    const env = await buildCareerIntelligence(pool, resolved.userId);
    const career_intelligence = pick ? pick(env) : env;
    return { ...base, career_intelligence } as T;
  } catch {
    // Additive enrichment must never break the legacy surface.
    return base;
  }
}
