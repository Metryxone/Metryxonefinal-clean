/**
 * /backend/routes/ei-resolution.ts
 *
 * Phase 2 — Hybrid EI public endpoints.
 *   POST /api/ei/resolve         — resolve free-text profile inputs to canonical
 *                                  entities, return official EI + provenance.
 *                                  Falls back deterministically on any error so
 *                                  the frontend preview UX never breaks.
 *
 * No auth — these are called by the public Career Builder during typeahead.
 * The resolver auto-pushes unresolved low-confidence inputs to ref_review_queue,
 * which super-admins triage in the Reference Intelligence panel.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { resolveProfile, type ResolverInput, type ResolverOutput } from '../services/ei-resolver';
import { computeOfficialEI, type OfficialEIOutput } from '../services/ei-engine';
import { computeAndCacheTrust } from './verification';
import { applyTrustToEI } from '../services/trust-engine';
import { getActiveRuleset } from '../services/ei-rules-loader';
import { resolveConfidenceModel, computeConfidence } from '../services/ei-confidence';
import { takeSnapshot } from '../services/ei-snapshots';

/** Read the latest wcl0 behaviour context for a user (T010 — PR0-F3.1).
 *  Looks up the user's email first (wcl0 is email-keyed), then fetches the
 *  most recent intelligence row. Non-blocking: returns {} on any error. */
async function enrichEIWithWcl0(pool: Pool, userId: string): Promise<Record<string, unknown>> {
  try {
    const { rows: ur } = await pool.query(
      `SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]
    );
    if (!ur.length) return {};
    const { rows } = await pool.query(
      `SELECT persona, persona_segment, motivation, confidence, risk, engagement,
              adaptability, learning_style, behaviour_dims_present, behaviour_source
         FROM wcl0_user_intelligence
        WHERE user_email = $1
        ORDER BY updated_at DESC LIMIT 1`,
      [ur[0].email]
    );
    return rows.length ? rows[0] : {};
  } catch { return {}; }
}

function extractInput(body: any): { input: ResolverInput; raw: any } {
  // Accept either flat fields or a profile-shaped object.
  if (body?.profile) {
    const p = body.profile;
    const edu = Array.isArray(p.education) && p.education.length ? p.education[0] : null;
    const techSkills = (p?.skills?.technical || []) as string[];
    const softSkills = (p?.skills?.soft || []) as string[];
    const certs      = (p?.certifications || []).map((c: any) =>
      typeof c === 'string' ? c : (c?.name || c?.title || '')
    ).filter(Boolean);
    return {
      input: {
        institution:    edu?.institution || edu?.school || body?.institution,
        qualification:  edu?.degree || edu?.qualification || body?.qualification,
        skills:         techSkills,
        certifications: certs,
        occupation:     body?.occupation || body?.targetRole,
      },
      raw: {
        completeness:     p?.competencyProfile?.completeness ?? 0,
        soft_skill_count: softSkills.length,
        experience_count: (p?.experience || []).length,
        project_count:    (p?.projects || []).length,
      },
    };
  }
  return {
    input: {
      institution:    body?.institution,
      qualification:  body?.qualification,
      skills:         Array.isArray(body?.skills) ? body.skills : [],
      certifications: Array.isArray(body?.certifications) ? body.certifications : [],
      occupation:     body?.occupation,
    },
    raw: {
      completeness:     body?.completeness ?? 0,
      soft_skill_count: body?.soft_skill_count ?? 0,
      experience_count: body?.experience_count ?? 0,
      project_count:    body?.project_count ?? 0,
    },
  };
}

function deterministicFallback(input: ResolverInput, raw: any): { resolution: ResolverOutput; ei: OfficialEIOutput } {
  // Mirrors preview engine math so the UI never sees a regression even on outage.
  const resolution: ResolverOutput = {
    institution: input.institution ? { input: input.institution, matched: false, confidence: 0, matched_via: 'unresolved' } : undefined,
    qualification: input.qualification ? { input: input.qualification, matched: false, confidence: 0, matched_via: 'unresolved' } : undefined,
    skills: (input.skills || []).map(s => ({ input: s, matched: false, confidence: 0, matched_via: 'unresolved' as const })),
    certifications: (input.certifications || []).map(s => ({ input: s, matched: false, confidence: 0, matched_via: 'unresolved' as const })),
    occupation: input.occupation ? { input: input.occupation, matched: false, confidence: 0, matched_via: 'unresolved' } : undefined,
    unresolved: {
      institution: input.institution, qualification: input.qualification, occupation: input.occupation,
      skills: input.skills || [], certifications: input.certifications || [],
    },
    profile_confidence_score: 0,
    resolved_at: new Date().toISOString(),
  };
  const breakdown = {
    completenessScore: Math.min(45, (raw.completeness || 0) * 0.45),
    technicalScore:    Math.min(20, (input.skills?.length || 0) * 2.5),
    softScore:         Math.min(10, (raw.soft_skill_count || 0) * 1.5),
    experienceScore:   Math.min(15, (raw.experience_count || 0) * 5),
    certScore:         Math.min(6,  (input.certifications?.length || 0) * 2),
    projectScore:      Math.min(6,  (raw.project_count || 0) * 1.5),
  };
  const raw_total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.min(99, Math.round(raw_total));
  // Mirror frontend EI_BANDS taxonomy exactly to preserve UX label semantics on fallback.
  const fbBand = score >= 80 ? 'Excellent' : score >= 65 ? 'Strong' : score >= 50 ? 'Good' : score >= 35 ? 'Developing' : 'Starter';
  return {
    resolution,
    ei: { score, band: fbBand, breakdown, signals: [], profile_confidence_score: 0, fallback_used: true },
  };
}

// ─── Abuse hardening for the public endpoint ─────────────────────────
// 1) Token-bucket rate limiter (per-IP, in-memory) — public Career Builder traffic
//    is bursty but tiny per user, so 30 requests / 60s / IP is generous for typing
//    but blocks scripted poisoning of the review queue.
// 2) In-memory dedupe of (entity_type, normalised_input) tuples — see resolver.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const RL_MAX_BUCKETS = 10_000;            // hard cap to prevent memory blow-up under spoofed XFF floods
const rlBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = rlBuckets.get(ip);
  if (!b || b.resetAt < now) {
    // Hard size cap: when full, evict oldest-inserted entry (Map preserves insertion order).
    if (rlBuckets.size >= RL_MAX_BUCKETS) {
      const oldestKey = rlBuckets.keys().next().value;
      if (oldestKey !== undefined) rlBuckets.delete(oldestKey);
    }
    rlBuckets.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= RL_MAX) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true };
}
// Periodic prune of expired buckets to avoid unbounded growth in long-running processes.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rlBuckets) if (v.resetAt < now) rlBuckets.delete(k);
}, 5 * 60_000).unref?.();

// Resolve client IP safely. Replit's edge proxy is exactly one hop in front of
// us — `trust proxy = 1` (set when these routes are registered) makes Express
// derive req.ip from the LAST entry in X-Forwarded-For (the one written by the
// trusted proxy), which an attacker cannot spoof. We deliberately do NOT read
// the raw header anymore — that was the bypass the previous review flagged.
function clientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

export function registerEIResolutionRoutes(app: Express, pool: Pool) {
  // Trust exactly one proxy hop (Replit edge). Idempotent — safe to call even
  // if some other module already configured it. With this set, req.ip is the
  // proxy-asserted client address and cannot be spoofed via XFF.
  if (!app.get('trust proxy')) app.set('trust proxy', 1);

  app.post('/api/ei/resolve', async (req: Request, res: Response) => {
    const ip = clientIp(req);
    const rl = rateLimit(ip);
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfter || 60));
      return res.status(429).json({ ok: false, error: 'rate limited', retry_after_seconds: rl.retryAfter });
    }
    const { input, raw } = extractInput(req.body || {});
    // Trust attribution is ONLY allowed when the caller is authenticated via
    // session/req.user. We deliberately ignore X-User-Id headers and body.user_id
    // on this public endpoint — accepting client-supplied identifiers would let
    // anyone probe trust metadata for arbitrary user IDs (IDOR).
    const authUser = (req as any).user;
    const userId = authUser ? String(authUser.id || authUser.user_id || '').trim() || null : null;
    const t0 = Date.now();
    try {
      // Phase 4: pin every calculation to the currently active ruleset and
      // persist a calculation log so support/governance can replay the math.
      const ruleset = await getActiveRuleset(pool);
      const resolution = await resolveProfile(pool, input);
      const ei = computeOfficialEI({ resolved: resolution, raw, ruleset });
      let trust: any = null;
      let trustedEI: any = null;
      if (userId) {
        try {
          trust = await computeAndCacheTrust(pool, userId, resolution, ei);
          trustedEI = applyTrustToEI(ei, trust);
        } catch (te) {
          console.warn('[ei/resolve] trust computation failed (non-blocking)', (te as Error).message);
        }
      }
      // Confidence engine output is part of the response payload AND the audit log.
      // CRITICAL: pin the confidence model to the version named by the active
      // ruleset — never report a confidence_model_version that wasn't actually
      // used. The model.version that ran is the only ground truth.
      let confidence: any = null;
      let confidenceModelVersion: string | null = ruleset.confidence_model_version || null;
      try {
        const model = await resolveConfidenceModel(pool, ruleset.confidence_model_version);
        confidence = computeConfidence(model, {
          resolution,
          verified_count: trust?.verified_count || 0,
          pending_count:  trust?.pending_count  || 0,
          revoked_count:  trust?.revoked_count  || 0,
        });
        confidenceModelVersion = model.version; // the version actually executed
      } catch (ce) { /* confidence is additive — never fail the request */ }

      // Persist calculation log (non-blocking)
      pool.query(
        `INSERT INTO ei_calculation_logs
          (user_id, request_id, capability_score, trusted_score, band, ei_version, ruleset_id, ruleset_version,
           taxonomy_version, institution_dataset_version, confidence_model_version,
           dimensions, evidence_refs, trust_adjustments, normalization_details, confidence,
           source, computation_ms, fallback_used)
         VALUES ($1,$2,$3,$4,$5,'4.0',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'resolve',$16,false)`,
        [
          userId, req.headers['x-request-id'] || null,
          ei.score, trustedEI?.score ?? null, ei.band, ruleset.id || null, ruleset.version,
          ruleset.taxonomy_version, ruleset.institution_dataset_version, confidenceModelVersion,
          JSON.stringify(ei.trace || []), JSON.stringify(ei.evidence_refs || []),
          JSON.stringify({ applied: !!trust, multiplier: trust?.trust_multiplier ?? null,
                            verified_count: trust?.verified_count ?? 0,
                            pending_count: trust?.pending_count ?? 0,
                            revoked_count: trust?.revoked_count ?? 0 }),
          JSON.stringify(ei.normalization_details || {}),
          confidence ? JSON.stringify(confidence) : null,
          Date.now() - t0,
        ],
      ).catch(err => console.warn('[ei/resolve] calc log write failed (non-blocking)', err.message));

      // Auto-snapshot for authenticated users (PR0-F2: EI snapshot automation).
      // Fire-and-forget — never delays or fails the response.
      // Also triggers an EI drop alert email when the score falls ≥ 5 points vs the previous snapshot.
      if (userId) {
        pool.query(
          `SELECT capability_score::int AS prev
             FROM ei_snapshot_versions
            WHERE user_id = $1
            ORDER BY snapshot_date DESC LIMIT 1`,
          [userId]
        ).then(({ rows }) => {
          const prevScore: number | null = rows[0]?.prev ?? null;
          return takeSnapshot(pool, { user_id: userId, resolver_input: input, raw, source: 'on_demand' })
            .then(() => {
              if (prevScore !== null && ei.score < prevScore - 4) {
                const drop = prevScore - ei.score;
                pool.query(
                  `SELECT COALESCE(NULLIF(TRIM(email), ''), username) AS addr
                     FROM users WHERE id = $1 LIMIT 1`,
                  [userId]
                ).then(({ rows: ur }) => {
                  const addr = String(ur[0]?.addr ?? '');
                  if (addr.includes('@')) {
                    import('../email').then(({ sendEIDropAlert }) =>
                      sendEIDropAlert(addr, prevScore, ei.score, drop).catch(() => {})
                    ).catch(() => {});
                  }
                }).catch(() => {});
              }
            });
        }).catch(err => console.warn('[ei/resolve] snapshot failed (non-blocking)', err.message));
      }

      // wcl0 behaviour context (PR0-F3.1 T010) — enriches the response when the
      // user has a behaviour intelligence record; {} when absent or on any error.
      const behaviourContext = userId ? await enrichEIWithWcl0(pool, userId) : {};

      res.json({
        ok: true, resolution,
        official_ei: ei,               // capability score (preserved — back-compat)
        trust,                          // null when no user context
        trusted_ei: trustedEI,          // null when no trust data; equal to official_ei when multiplier=1.0
        confidence,                     // Phase 4 — composite confidence + uncertainty flags
        versions: {                     // Phase 4 — version quad for reproducibility
          ei_version: '4.0',
          ruleset_version: ruleset.version,
          taxonomy_version: ruleset.taxonomy_version,
          institution_dataset_version: ruleset.institution_dataset_version,
          confidence_model_version: confidenceModelVersion,
        },
        behaviour_context: Object.keys(behaviourContext).length ? behaviourContext : null,
        generated_at: Date.now(),
      });
    } catch (e: any) {
      console.error('[ei/resolve] resolution failed, falling back', e.message);
      const fb = deterministicFallback(input, raw);
      res.json({
        ok: true,
        resolution: fb.resolution,
        official_ei: fb.ei,
        generated_at: Date.now(),
        warning: 'Reference resolution failed — deterministic fallback applied',
      });
    }
  });

  // Lightweight typeahead pass-through that also returns confidence flags.
  // (The existing /api/reference/:entity/search already covers basic typeahead;
  // this endpoint normalises the response shape for the hybrid client hook.)
  app.get('/api/ei/typeahead/:entity', async (req: Request, res: Response) => {
    try {
      const entity = req.params.entity;
      const q = String(req.query.q || '');
      if (!q.trim()) return res.json({ results: [] });
      // Reuse the public reference search by direct DB call (same logic).
      // This keeps the hybrid hook free of cross-endpoint dependencies.
      const validEntities = ['institutions','qualifications','certifications','skills','occupations'];
      if (!validEntities.includes(entity)) return res.status(400).json({ error: 'unknown entity' });
      const nameCol = entity === 'occupations' ? 'canonical_title' : 'canonical_name';
      const shortCol = entity === 'occupations' || entity === 'skills' ? null : 'short_name';
      const sql = `
        SELECT id, ${nameCol} AS canonical_name${shortCol ? `, ${shortCol}` : ''},
               similarity(${nameCol}, $1) AS confidence
          FROM ${entity}
         WHERE COALESCE(is_active,true)=true
           AND (${nameCol} % $1 OR ${nameCol} ILIKE $2 ${shortCol ? `OR ${shortCol} % $1 OR ${shortCol} ILIKE $2` : ''})
         ORDER BY confidence DESC, ${nameCol}
         LIMIT 8`;
      const r = await pool.query(sql, [q.trim(), `%${q.trim()}%`]);
      res.json({ results: r.rows });
    } catch (e: any) {
      res.json({ results: [], error: e.message });
    }
  });
}
