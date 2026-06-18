/**
 * Career Operating System — Employability Passport routes (T-P7).
 *
 * A single, shareable candidate artifact. This file is orchestration-only: it
 * adds NO new engine, store, service or table. The passport snapshot is built
 * on the client from data that already exists (profile, EI, competency
 * breakdown, behaviour graph, behavioural-memory growth, verification trust),
 * and is stored — together with a share token + per-section visibility flags —
 * inside the existing `career_seeker_profiles.data.passport` JSONB. No new
 * table, no migration.
 *
 *   POST   /api/career/passport/:userId/share         (auth) mint/refresh link
 *   DELETE /api/career/passport/:userId/share         (auth) revoke link
 *   GET    /api/career/passport/:userId/share-status  (auth) current link meta
 *   GET    /api/public/passport/:token                (NO auth) sanitized view
 *
 * Privacy: the public endpoint only ever returns the snapshot the candidate
 * explicitly published, filtered by their visibility flags, and ALWAYS strips
 * contact details. Cross-user writes are rejected by `resolveEffectiveUserId`
 * (no silent IDOR) — reused, not re-implemented, from behavioural-memory.ts.
 *
 * Gated by the `employabilityPassport` feature flag: flag-off → every route
 * returns 503 (mirrors the additive-phase convention).
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';
import { pool } from '../storage';
import { isFlagEnabled } from '../config/feature-flags';
import { resolveEffectiveUserId } from './behavioural-memory';

const SECTION_KEYS = [
  'competencies',
  'assessment',
  'skills',
  'projects',
  'certifications',
  'careerReadiness',
  'verifiedCredentials',
  'growthReport',
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];
type Visibility = Record<SectionKey, boolean>;

function defaultVisibility(): Visibility {
  return SECTION_KEYS.reduce((acc, k) => { acc[k] = true; return acc; }, {} as Visibility);
}

function normaliseVisibility(raw: unknown): Visibility {
  const base = defaultVisibility();
  if (raw && typeof raw === 'object') {
    for (const k of SECTION_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'boolean') base[k] = v;
    }
  }
  return base;
}

// Email + phone patterns redacted from EVERY public string field — contact must
// never leak even if a client embedded it in free text (headline, project copy…).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;
const URL_HANDLE_RE = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com)\/\S+/gi;

/** Recursively redact contact-shaped substrings from any value. */
function deepScrubContact(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(URL_HANDLE_RE, '')
      .replace(EMAIL_RE, '')
      .replace(PHONE_RE, '')
      .trim();
  }
  if (Array.isArray(value)) return value.map(deepScrubContact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepScrubContact(v);
    return out;
  }
  return value;
}

/** Strip everything a recruiter must never see and apply visibility flags. */
function sanitiseForPublic(snapshot: any, visibility: Visibility): any {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const header = { ...(snapshot.header ?? {}) };
  // Defensive: never leak contact even if a client embedded it in the header.
  delete (header as any).email;
  delete (header as any).phone;
  delete (header as any).contact;
  delete (header as any).linkedin;
  delete (header as any).github;

  const srcSections = (snapshot.sections ?? {}) as Record<string, unknown>;
  const sections: Record<string, unknown> = {};
  for (const k of SECTION_KEYS) {
    if (visibility[k] && srcSections[k] != null) sections[k] = srcSections[k];
  }
  // Final defence: scrub contact-shaped text from every remaining field.
  return deepScrubContact({ header, sections, generatedAt: snapshot.generatedAt ?? null });
}

async function loadProfileData(userId: string): Promise<{ exists: boolean; data: any }> {
  const { rows } = await pool.query(
    'SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  if (!rows[0]) return { exists: false, data: {} };
  return { exists: true, data: rows[0].data ?? {} };
}

export function registerEmployabilityPassportRoutes(app: Express, requireAuth: RequestHandler) {
  // Flag gate — applied to every passport route (incl. the public one).
  const gate = (_req: Request, res: Response, next: NextFunction) => {
    if (!isFlagEnabled('employabilityPassport')) {
      return res.status(503).json({ error: 'feature_disabled', feature: 'employabilityPassport' });
    }
    next();
  };

  // POST /api/career/passport/:userId/share — store the client-built snapshot +
  // visibility, mint (or refresh) a public share token. Returns link metadata.
  app.post('/api/career/passport/:userId/share', gate, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      const body = req.body ?? {};
      const snapshot = body.snapshot;
      if (!snapshot || typeof snapshot !== 'object') {
        return res.status(400).json({ error: 'snapshot_required' });
      }
      const visibility = normaliseVisibility(body.visibility);

      // Re-mint the token on every share so a refreshed link supersedes the old one.
      const shareToken = crypto.randomBytes(18).toString('base64url');
      const sharedAt = new Date().toISOString();
      const passportRecord = { shareToken, visibility, snapshot, sharedAt };

      // Atomic single-key write — never read-modify-write the whole `data` blob
      // (that would clobber concurrent updates to other profile keys).
      const upd = await pool.query(
        `UPDATE career_seeker_profiles
            SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{passport}', $1::jsonb, true),
                updated_at = NOW()
          WHERE user_id = $2`,
        [JSON.stringify(passportRecord), userId],
      );
      if (!upd.rowCount) return res.status(404).json({ error: 'profile_not_found' });

      return res.status(200).json({
        ok: true,
        shared: true,
        shareToken,
        path: `/passport/${shareToken}`,
        visibility,
        sharedAt,
      });
    } catch (err) { next(err); }
  });

  // DELETE /api/career/passport/:userId/share — revoke (clear the published link).
  app.delete('/api/career/passport/:userId/share', gate, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      // Atomic single-key delete — idempotent, preserves all other profile keys.
      await pool.query(
        `UPDATE career_seeker_profiles
            SET data = data #- '{passport}', updated_at = NOW()
          WHERE user_id = $1`,
        [userId],
      );
      return res.status(200).json({ ok: true, shared: false });
    } catch (err) { next(err); }
  });

  // GET /api/career/passport/:userId/share-status — current link metadata (no snapshot body).
  app.get('/api/career/passport/:userId/share-status', gate, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resolved = resolveEffectiveUserId(req, req.params.userId);
      if (resolved.forbidden) return res.status(403).json({ error: 'forbidden_cross_user' });
      const userId = resolved.userId;
      if (!userId) return res.status(400).json({ error: 'user_id_required' });

      const { data } = await loadProfileData(userId);
      const p = data?.passport;
      if (!p?.shareToken) return res.status(200).json({ ok: true, shared: false });
      return res.status(200).json({
        ok: true,
        shared: true,
        shareToken: p.shareToken,
        path: `/passport/${p.shareToken}`,
        visibility: normaliseVisibility(p.visibility),
        sharedAt: p.sharedAt ?? null,
      });
    } catch (err) { next(err); }
  });

  // GET /api/public/passport/:token — NO auth. Returns the sanitized, visibility-
  // filtered snapshot the candidate published. Contact is always stripped.
  app.get('/api/public/passport/:token', gate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.params.token ?? '').trim();
      if (!token) return res.status(400).json({ error: 'token_required' });

      const { rows } = await pool.query(
        `SELECT data FROM career_seeker_profiles
          WHERE data->'passport'->>'shareToken' = $1
          LIMIT 1`,
        [token],
      );
      const p = rows[0]?.data?.passport;
      if (!p?.snapshot) return res.status(404).json({ error: 'passport_not_found' });

      const visibility = normaliseVisibility(p.visibility);
      const passport = sanitiseForPublic(p.snapshot, visibility);
      if (!passport) return res.status(404).json({ error: 'passport_not_found' });

      return res.status(200).json({ ok: true, passport, sharedAt: p.sharedAt ?? null });
    } catch (err) { next(err); }
  });
}
