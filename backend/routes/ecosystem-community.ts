/**
 * MX-302I — Employer, Community & Ecosystem (flag-gated additive surface).
 *
 * Connects students to the wider career ecosystem across THREE pillars, all behind the
 * `ecosystemCommunity` flag (FF_ECOSYSTEM_COMMUNITY, default OFF):
 *
 *   1. Employer Experience — a READ-ONLY composer over the EXISTING hiring substrate
 *      (employer_jobs / job_postings graduate-vs-internship, campus_drives, employer
 *      invitations via employer_team_members / employer_pool_outreach) → one employer surface.
 *   2. Alumni Network — a REAL consented alumni directory + connection model, the consumer
 *      Mentorship surface WIRED to real mentor_profiles + real mentor_bookings (replacing the
 *      hardcoded mock), B2C student referrals, and user-authored consented Career Stories.
 *   3. Community — career discussion forums (net-new eco_forum_* — DISTINCT from the academic
 *      child/test-scoped forum_* tables), generalized study groups, and hackathons.
 *
 * Discipline (matches the platform's flag-gated additive convention):
 *   - flagGate runs FIRST on every route → 503 before any auth/DB touch when OFF, so the lazy
 *     ensureSchema is NEVER reached and no eco_* table is created → byte-identical legacy incl. schema.
 *   - `/api/ecosystem/enabled` is a persona-agnostic flag probe (flagGate-only) so the SPA can hide
 *     the new surfaces byte-identically.
 *   - Honest empty states: reads return [] / null (never fabricated members/posts); counts are real.
 *   - Consent on user-authored public content (alumni directory, career stories) — nothing is
 *     surfaced publicly without an explicit consent/publish flag.
 *   - Never throws: unexpected errors degrade to a 200 honest-degraded JSON on reads.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { rankCandidatesForJob } from '../services/talent-matching-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('ecosystemCommunity')) {
    return res.status(503).json({ ok: false, error: 'ecosystem_community_disabled' });
  }
  next();
}

function actorId(req: Request): string {
  return String((req.user as any)?.id ?? '');
}
function actorName(req: Request): string {
  const u = req.user as any;
  const name = u?.fullName ?? u?.full_name ?? u?.name ?? u?.username ?? null;
  if (name && String(name).trim()) return String(name).trim();
  const email = u?.email ? String(u.email) : '';
  return email ? email.split('@')[0] : 'Member';
}
function actorEmail(req: Request): string | null {
  const e = (req.user as any)?.email;
  return e ? String(e) : null;
}

const s = (v: unknown, max = 4000): string =>
  (v == null ? '' : String(v)).slice(0, max).trim();
const sOrNull = (v: unknown, max = 4000): string | null => {
  const t = s(v, max);
  return t === '' ? null : t;
};
const toArr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => s(x, 80)).filter(Boolean).slice(0, 40);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((x) => s(x, 80)).filter(Boolean).slice(0, 40);
  return [];
};

// ────────────────────────────────────────────────────────────────────────────
// Lazy schema — only reached when the flag is ON (every route is flagGate-first).
// ────────────────────────────────────────────────────────────────────────────
let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mentor_bookings (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mentor_profile_id varchar NOT NULL,
      seeker_id     varchar NOT NULL,
      seeker_name   text,
      seeker_email  text,
      topic         text,
      preferred_slot text,
      message       text,
      status        text NOT NULL DEFAULT 'requested',
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_mentor_bookings_seeker ON mentor_bookings(seeker_id);
    CREATE INDEX IF NOT EXISTS idx_mentor_bookings_mentor ON mentor_bookings(mentor_profile_id);

    CREATE TABLE IF NOT EXISTS eco_alumni_profiles (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       varchar NOT NULL UNIQUE,
      display_name  text NOT NULL,
      graduation_year integer,
      institute     text,
      headline      text,
      company       text,
      industry      text,
      location      text,
      skills        jsonb NOT NULL DEFAULT '[]',
      bio           text,
      is_published  boolean NOT NULL DEFAULT false,
      open_to_mentoring boolean NOT NULL DEFAULT false,
      open_to_referrals boolean NOT NULL DEFAULT false,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eco_alumni_published ON eco_alumni_profiles(is_published);

    CREATE TABLE IF NOT EXISTS eco_alumni_connections (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id  varchar NOT NULL,
      target_user_id varchar NOT NULL,
      status        text NOT NULL DEFAULT 'pending',
      message       text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE(requester_id, target_user_id)
    );

    CREATE TABLE IF NOT EXISTS eco_referrals (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id   varchar NOT NULL,
      referral_code text NOT NULL,
      invitee_email text,
      status        text NOT NULL DEFAULT 'invited',
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eco_referrals_referrer ON eco_referrals(referrer_id);

    CREATE TABLE IF NOT EXISTS eco_career_stories (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id     varchar NOT NULL,
      author_name   text,
      title         text NOT NULL,
      body          text NOT NULL,
      role          text,
      company       text,
      tags          jsonb NOT NULL DEFAULT '[]',
      consent_public boolean NOT NULL DEFAULT false,
      status        text NOT NULL DEFAULT 'draft',
      upvotes       integer NOT NULL DEFAULT 0,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eco_stories_status ON eco_career_stories(status);

    CREATE TABLE IF NOT EXISTS eco_forum_threads (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id     varchar NOT NULL,
      author_name   text,
      title         text NOT NULL,
      body          text NOT NULL,
      category      text NOT NULL DEFAULT 'general',
      is_anonymous  boolean NOT NULL DEFAULT false,
      reply_count   integer NOT NULL DEFAULT 0,
      upvotes       integer NOT NULL DEFAULT 0,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eco_forum_threads_cat ON eco_forum_threads(category);

    CREATE TABLE IF NOT EXISTS eco_forum_thread_posts (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id     uuid NOT NULL REFERENCES eco_forum_threads(id) ON DELETE CASCADE,
      author_id     varchar NOT NULL,
      author_name   text,
      body          text NOT NULL,
      is_anonymous  boolean NOT NULL DEFAULT false,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_eco_forum_posts_thread ON eco_forum_thread_posts(thread_id);

    CREATE TABLE IF NOT EXISTS eco_study_groups (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id      varchar NOT NULL,
      name          text NOT NULL,
      topic         text,
      description   text,
      is_public     boolean NOT NULL DEFAULT true,
      max_members   integer,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS eco_study_group_members (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id      uuid NOT NULL REFERENCES eco_study_groups(id) ON DELETE CASCADE,
      user_id       varchar NOT NULL,
      user_name     text,
      role          text NOT NULL DEFAULT 'member',
      joined_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS eco_hackathons (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by    varchar NOT NULL,
      title         text NOT NULL,
      theme         text,
      description   text,
      mode          text DEFAULT 'online',
      start_date    date,
      end_date      date,
      registration_deadline date,
      prize_pool    text,
      external_url  text,
      status        text NOT NULL DEFAULT 'upcoming',
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS eco_hackathon_participants (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      hackathon_id  uuid NOT NULL REFERENCES eco_hackathons(id) ON DELETE CASCADE,
      user_id       varchar NOT NULL,
      user_name     text,
      team_name     text,
      joined_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE(hackathon_id, user_id)
    );
  `);
  schemaReady = true;
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
    return !!r.rows[0]?.t;
  } catch {
    return false;
  }
}

export function registerEcosystemCommunityRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // withSchema: flag already verified upstream; lazily create eco_* tables on first authed hit.
  // READ routes degrade honestly to a 200 {degraded:true} so a transient read failure renders
  // as an honest empty/degraded state. WRITE routes must NOT mask a persistence failure as
  // success — they fail loudly with a non-2xx so the client never reports a phantom save.
  const wrap = (write: boolean) =>
    (handler: (req: Request, res: Response) => Promise<void>): Mw =>
      async (req: Request, res: Response) => {
        try {
          await ensureSchema(pool);
          await handler(req, res);
        } catch (err) {
          console.error('[ecosystem-community] handler error:', err);
          if (!res.headersSent) {
            if (write) res.status(500).json({ ok: false, error: 'unexpected_error' });
            else res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error' });
          }
        }
      };
  const withSchema = wrap(false);
  const withSchemaWrite = wrap(true);

  // ── Persona-agnostic flag probe ───────────────────────────────────────────
  app.get('/api/ecosystem/enabled', flagGate, (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PILLAR 1 — EMPLOYER EXPERIENCE (read-only composer over existing substrate)
  // ══════════════════════════════════════════════════════════════════════════
  app.get('/api/ecosystem/employer/overview', flagGate, requireAuth, withSchema(async (req, res) => {
    const eid = actorId(req);
    const out: any = {
      ok: true,
      graduate_jobs: [],
      internship_jobs: [],
      other_jobs: [],
      campus_drives: [],
      invitations: { team_members: 0, pool_outreach: 0 },
      counts: { graduate: 0, internship: 0, other: 0, drives: 0 },
      notes: {
        graduate_internship_classification:
          'Graduate vs Internship is an intelligence-layer classification (job title / employment_type heuristic), not yet a structural job-type column — Founder decision pending (see audit).',
        campus_drives: 'Campus-drive orchestration is owned by MX-302E; this surface composes/links to it. Empty until drives are created there.',
      },
    };

    // Jobs — employer_jobs scoped to this employer; classify graduate vs internship.
    if (await tableExists(pool, 'employer_jobs')) {
      try {
        const jr = await pool.query(
          `SELECT * FROM employer_jobs WHERE employer_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 200`,
          [eid],
        );
        for (const row of jr.rows) {
          const hay = `${row.title ?? ''} ${row.job_type ?? ''} ${row.employment_type ?? ''} ${row.role_title ?? ''}`.toLowerCase();
          const item = {
            id: row.id,
            title: row.title ?? row.role_title ?? 'Untitled role',
            location: row.location ?? null,
            status: row.status ?? null,
            created_at: row.created_at ?? null,
          };
          if (/intern|internship|trainee/.test(hay)) out.internship_jobs.push(item);
          else if (/graduate|fresher|entry.?level|campus/.test(hay)) out.graduate_jobs.push(item);
          else out.other_jobs.push(item);
        }
      } catch (e) { console.error('[ecosystem-community] employer_jobs read:', e); }
    }
    out.counts.graduate = out.graduate_jobs.length;
    out.counts.internship = out.internship_jobs.length;
    out.counts.other = out.other_jobs.length;

    // Campus drives — link to MX-302E (created_by scope; honest empty otherwise).
    if (await tableExists(pool, 'campus_drives')) {
      try {
        const dr = await pool.query(
          `SELECT id, title, role_title, drive_type, location, drive_date, registration_deadline, status
             FROM campus_drives WHERE created_by = $1 ORDER BY created_at DESC NULLS LAST LIMIT 100`,
          [eid],
        );
        out.campus_drives = dr.rows;
        out.counts.drives = dr.rows.length;
      } catch (e) { console.error('[ecosystem-community] campus_drives read:', e); }
    }

    // Employer invitations — reuse existing invitation substrate.
    if (await tableExists(pool, 'employer_team_members')) {
      try {
        const tr = await pool.query(`SELECT COUNT(*)::int AS n FROM employer_team_members WHERE employer_id = $1`, [eid]);
        out.invitations.team_members = tr.rows[0]?.n ?? 0;
      } catch (e) { console.error('[ecosystem-community] team_members read:', e); }
    }
    if (await tableExists(pool, 'employer_pool_outreach')) {
      try {
        const pr = await pool.query(`SELECT COUNT(*)::int AS n FROM employer_pool_outreach WHERE employer_id = $1`, [eid]);
        out.invitations.pool_outreach = pr.rows[0]?.n ?? 0;
      } catch (e) { console.error('[ecosystem-community] pool_outreach read:', e); }
    }

    // Candidate matching — COMPOSE the canonical talent-matching engine (never re-implement
    // scoring here). For the employer's most recent roles we surface honest matched-candidate
    // counts + a top slice. ABSTAINS (resolved:false / measurable:false) when a role title can't
    // be crosswalked or no candidate evidence exists — never fabricates a match. null ≠ 0.
    out.candidate_matching = {
      jobs: [] as any[],
      note:
        'Matched candidates are composed from the canonical talent-matching engine (role-DNA crosswalk + competency evidence). A role abstains when its title is not crosswalkable or no candidate evidence exists — that is an honest "not measurable yet", not zero matches.',
    };
    const rankableJobs = [...out.graduate_jobs, ...out.internship_jobs, ...out.other_jobs].slice(0, 10);
    for (const job of rankableJobs) {
      try {
        const ranked = await rankCandidatesForJob(pool, String(job.id), { limit: 5 });
        if (!ranked.ok) {
          out.candidate_matching.jobs.push({
            job_id: job.id, title: job.title, resolved: false, measurable: false,
            matched_count: null, top_candidates: [], reason: ranked.code ?? 'not_resolvable',
          });
          continue;
        }
        const cands = Array.isArray(ranked.data.candidates) ? ranked.data.candidates : [];
        out.candidate_matching.jobs.push({
          job_id: job.id,
          title: job.title,
          resolved: ranked.data.resolved !== false,
          measurable: !!ranked.data.measurable,
          role_title: ranked.data.role_title ?? null,
          matched_count: ranked.data.measurable ? cands.length : null,
          top_candidates: ranked.data.measurable
            ? cands.slice(0, 5).map((c: any) => ({
                candidate_id: c.candidate_id,
                fit_pct: c.fit_pct ?? null,
                fit_label: c.fit_label ?? null,
                confidence_pct: c.confidence_pct ?? null,
              }))
            : [],
        });
      } catch (e) {
        console.error('[ecosystem-community] candidate match for job', job.id, e);
        out.candidate_matching.jobs.push({
          job_id: job.id, title: job.title, resolved: false, measurable: false,
          matched_count: null, top_candidates: [], reason: 'match_error',
        });
      }
    }

    res.json(out);
  }));

  // ══════════════════════════════════════════════════════════════════════════
  // PILLAR 2 — ALUMNI NETWORK
  // ══════════════════════════════════════════════════════════════════════════

  // --- Consumer Mentorship (WIRED to real mentor_profiles + real mentor_bookings) ---
  app.get('/api/ecosystem/mentors', flagGate, requireAuth, withSchema(async (req, res) => {
    const q = s(req.query.q, 120).toLowerCase();
    let rows: any[] = [];
    if (await tableExists(pool, 'mentor_profiles')) {
      try {
        const r = await pool.query(
          `SELECT id, full_name, profile_photo, bio, specializations, qualifications, languages,
                  availability, rating, total_sessions, completed_sessions
             FROM mentor_profiles WHERE status = 'active' ORDER BY rating DESC NULLS LAST, completed_sessions DESC LIMIT 200`,
        );
        rows = r.rows;
      } catch (e) { console.error('[ecosystem-community] mentors read:', e); }
    }
    const mentors = rows
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        photo: m.profile_photo ?? null,
        bio: m.bio ?? null,
        specializations: Array.isArray(m.specializations) ? m.specializations : [],
        qualifications: Array.isArray(m.qualifications) ? m.qualifications : [],
        languages: Array.isArray(m.languages) ? m.languages : [],
        availability: m.availability ?? null,
        rating: m.rating != null ? Number(m.rating) : null,
        total_sessions: m.total_sessions ?? 0,
        completed_sessions: m.completed_sessions ?? 0,
      }))
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.name} ${m.bio ?? ''} ${m.specializations.join(' ')} ${m.qualifications.join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    // Honest empty state: mentors:[] when no active mentor profiles exist (never the mock).
    res.json({ ok: true, mentors, count: mentors.length });
  }));

  app.post('/api/ecosystem/mentors/:id/book', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const mentorProfileId = s(req.params.id, 64);
    if (!mentorProfileId) { res.status(400).json({ ok: false, error: 'mentor_id_required' }); return; }
    // Verify the mentor exists & is active (no fabricated bookings against ghosts).
    let ok = false;
    if (await tableExists(pool, 'mentor_profiles')) {
      try {
        const r = await pool.query(`SELECT 1 FROM mentor_profiles WHERE id = $1 AND status = 'active'`, [mentorProfileId]);
        ok = r.rowCount! > 0;
      } catch (e) { console.error('[ecosystem-community] mentor verify:', e); }
    }
    if (!ok) { res.status(404).json({ ok: false, error: 'mentor_not_found_or_inactive' }); return; }
    const body = req.body ?? {};
    const r = await pool.query(
      `INSERT INTO mentor_bookings (mentor_profile_id, seeker_id, seeker_name, seeker_email, topic, preferred_slot, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [mentorProfileId, actorId(req), actorName(req), actorEmail(req), sOrNull(body.topic, 200), sOrNull(body.preferred_slot, 200), sOrNull(body.message, 2000)],
    );
    res.json({ ok: true, booking: r.rows[0] });
  }));

  app.get('/api/ecosystem/mentor-bookings', flagGate, requireAuth, withSchema(async (req, res) => {
    const r = await pool.query(
      `SELECT b.*, m.full_name AS mentor_name FROM mentor_bookings b
         LEFT JOIN mentor_profiles m ON m.id = b.mentor_profile_id
        WHERE b.seeker_id = $1 ORDER BY b.created_at DESC LIMIT 200`,
      [actorId(req)],
    );
    res.json({ ok: true, bookings: r.rows });
  }));

  // --- Alumni directory (consented) + profile + connections ---
  app.get('/api/ecosystem/alumni', flagGate, requireAuth, withSchema(async (req, res) => {
    const q = s(req.query.q, 120).toLowerCase();
    const r = await pool.query(
      `SELECT id, user_id, display_name, graduation_year, institute, headline, company, industry,
              location, skills, bio, open_to_mentoring, open_to_referrals
         FROM eco_alumni_profiles WHERE is_published = true ORDER BY updated_at DESC LIMIT 300`,
    );
    let alumni = r.rows;
    if (q) {
      alumni = alumni.filter((a) => {
        const hay = `${a.display_name} ${a.headline ?? ''} ${a.company ?? ''} ${a.industry ?? ''} ${a.institute ?? ''} ${(a.skills || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }
    res.json({ ok: true, alumni, count: alumni.length });
  }));

  app.get('/api/ecosystem/alumni/me', flagGate, requireAuth, withSchema(async (req, res) => {
    const r = await pool.query(`SELECT * FROM eco_alumni_profiles WHERE user_id = $1`, [actorId(req)]);
    res.json({ ok: true, profile: r.rows[0] ?? null });
  }));

  app.post('/api/ecosystem/alumni/profile', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const b = req.body ?? {};
    const display = s(b.display_name, 120) || actorName(req);
    const gy = b.graduation_year != null && Number.isFinite(Number(b.graduation_year)) ? Number(b.graduation_year) : null;
    const r = await pool.query(
      `INSERT INTO eco_alumni_profiles
         (user_id, display_name, graduation_year, institute, headline, company, industry, location, skills, bio,
          is_published, open_to_mentoring, open_to_referrals, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13, now())
       ON CONFLICT (user_id) DO UPDATE SET
         display_name=EXCLUDED.display_name, graduation_year=EXCLUDED.graduation_year, institute=EXCLUDED.institute,
         headline=EXCLUDED.headline, company=EXCLUDED.company, industry=EXCLUDED.industry, location=EXCLUDED.location,
         skills=EXCLUDED.skills, bio=EXCLUDED.bio, is_published=EXCLUDED.is_published,
         open_to_mentoring=EXCLUDED.open_to_mentoring, open_to_referrals=EXCLUDED.open_to_referrals, updated_at=now()
       RETURNING *`,
      [actorId(req), display, gy, sOrNull(b.institute, 200), sOrNull(b.headline, 200), sOrNull(b.company, 200),
       sOrNull(b.industry, 120), sOrNull(b.location, 120), JSON.stringify(toArr(b.skills)), sOrNull(b.bio, 2000),
       !!b.is_published, !!b.open_to_mentoring, !!b.open_to_referrals],
    );
    res.json({ ok: true, profile: r.rows[0] });
  }));

  app.post('/api/ecosystem/alumni/:userId/connect', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const target = s(req.params.userId, 64);
    const me = actorId(req);
    if (!target || target === me) { res.status(400).json({ ok: false, error: 'invalid_target' }); return; }
    const r = await pool.query(
      `INSERT INTO eco_alumni_connections (requester_id, target_user_id, message)
       VALUES ($1,$2,$3)
       ON CONFLICT (requester_id, target_user_id) DO UPDATE SET message=EXCLUDED.message, updated_at=now()
       RETURNING *`,
      [me, target, sOrNull(req.body?.message, 1000)],
    );
    res.json({ ok: true, connection: r.rows[0] });
  }));

  app.get('/api/ecosystem/alumni/connections', flagGate, requireAuth, withSchema(async (req, res) => {
    const me = actorId(req);
    const sent = await pool.query(`SELECT * FROM eco_alumni_connections WHERE requester_id = $1 ORDER BY created_at DESC LIMIT 200`, [me]);
    const received = await pool.query(`SELECT * FROM eco_alumni_connections WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 200`, [me]);
    res.json({ ok: true, sent: sent.rows, received: received.rows });
  }));

  app.post('/api/ecosystem/connections/:id/respond', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const id = s(req.params.id, 64);
    const decision = s(req.body?.decision, 20).toLowerCase();
    if (!['accepted', 'declined'].includes(decision)) { res.status(400).json({ ok: false, error: 'invalid_decision' }); return; }
    const r = await pool.query(
      `UPDATE eco_alumni_connections SET status = $1, updated_at = now()
        WHERE id = $2 AND target_user_id = $3 RETURNING *`,
      [decision, id, actorId(req)],
    );
    if (r.rowCount === 0) { res.status(404).json({ ok: false, error: 'connection_not_found' }); return; }
    res.json({ ok: true, connection: r.rows[0] });
  }));

  // --- B2C student referrals ---
  app.get('/api/ecosystem/referrals/me', flagGate, requireAuth, withSchema(async (req, res) => {
    const me = actorId(req);
    const r = await pool.query(`SELECT * FROM eco_referrals WHERE referrer_id = $1 ORDER BY created_at DESC LIMIT 200`, [me]);
    const code = r.rows[0]?.referral_code ?? `MX-${me.slice(0, 6).toUpperCase()}`;
    const joined = r.rows.filter((x) => x.status === 'joined').length;
    res.json({ ok: true, referral_code: code, referrals: r.rows, count: r.rows.length, joined });
  }));

  app.post('/api/ecosystem/referrals', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const me = actorId(req);
    const invitee = sOrNull(req.body?.invitee_email, 200);
    const code = `MX-${me.slice(0, 6).toUpperCase()}`;
    const r = await pool.query(
      `INSERT INTO eco_referrals (referrer_id, referral_code, invitee_email) VALUES ($1,$2,$3) RETURNING *`,
      [me, code, invitee],
    );
    res.json({ ok: true, referral: r.rows[0] });
  }));

  // --- Career Stories (user-authored, consented; distinct from static TESTIMONIALS) ---
  app.get('/api/ecosystem/stories', flagGate, requireAuth, withSchema(async (_req, res) => {
    // Only published AND consented stories are public. Honest empty state otherwise.
    const r = await pool.query(
      `SELECT id, author_name, title, body, role, company, tags, upvotes, created_at
         FROM eco_career_stories WHERE status = 'published' AND consent_public = true
         ORDER BY created_at DESC LIMIT 200`,
    );
    res.json({ ok: true, stories: r.rows, count: r.rows.length });
  }));

  app.get('/api/ecosystem/stories/me', flagGate, requireAuth, withSchema(async (req, res) => {
    const r = await pool.query(`SELECT * FROM eco_career_stories WHERE author_id = $1 ORDER BY created_at DESC LIMIT 100`, [actorId(req)]);
    res.json({ ok: true, stories: r.rows });
  }));

  app.post('/api/ecosystem/stories', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const b = req.body ?? {};
    const title = s(b.title, 200), body = s(b.body, 8000);
    if (!title || !body) { res.status(400).json({ ok: false, error: 'title_and_body_required' }); return; }
    const consent = !!b.consent_public;
    // Consent is required to publish publicly; without it the story stays a private draft.
    const status = consent ? 'published' : 'draft';
    const r = await pool.query(
      `INSERT INTO eco_career_stories (author_id, author_name, title, body, role, company, tags, consent_public, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING *`,
      [actorId(req), actorName(req), title, body, sOrNull(b.role, 120), sOrNull(b.company, 120),
       JSON.stringify(toArr(b.tags)), consent, status],
    );
    res.json({ ok: true, story: r.rows[0] });
  }));

  // ══════════════════════════════════════════════════════════════════════════
  // PILLAR 3 — COMMUNITY (forums · study groups · hackathons)
  // ══════════════════════════════════════════════════════════════════════════

  // --- Discussion forums (career community; net-new, distinct from academic forum_*) ---
  app.get('/api/ecosystem/forum/threads', flagGate, requireAuth, withSchema(async (req, res) => {
    const cat = s(req.query.category, 60);
    const params: any[] = [];
    let where = '';
    if (cat) { params.push(cat); where = 'WHERE category = $1'; }
    const r = await pool.query(
      `SELECT id, author_name, is_anonymous, title, body, category, reply_count, upvotes, created_at
         FROM eco_forum_threads ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    const rows = r.rows.map((t) => ({ ...t, author_name: t.is_anonymous ? 'Anonymous' : t.author_name }));
    res.json({ ok: true, threads: rows, count: rows.length });
  }));

  app.post('/api/ecosystem/forum/threads', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const b = req.body ?? {};
    const title = s(b.title, 200), body = s(b.body, 8000);
    if (!title || !body) { res.status(400).json({ ok: false, error: 'title_and_body_required' }); return; }
    const r = await pool.query(
      `INSERT INTO eco_forum_threads (author_id, author_name, title, body, category, is_anonymous)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [actorId(req), actorName(req), title, body, s(b.category, 60) || 'general', !!b.is_anonymous],
    );
    res.json({ ok: true, thread: r.rows[0] });
  }));

  app.get('/api/ecosystem/forum/threads/:id', flagGate, requireAuth, withSchema(async (req, res) => {
    const id = s(req.params.id, 64);
    const tr = await pool.query(`SELECT * FROM eco_forum_threads WHERE id = $1`, [id]);
    if (tr.rowCount === 0) { res.status(404).json({ ok: false, error: 'thread_not_found' }); return; }
    const pr = await pool.query(`SELECT * FROM eco_forum_thread_posts WHERE thread_id = $1 ORDER BY created_at ASC LIMIT 500`, [id]);
    const thread = tr.rows[0];
    if (thread.is_anonymous) thread.author_name = 'Anonymous';
    const posts = pr.rows.map((p) => ({ ...p, author_name: p.is_anonymous ? 'Anonymous' : p.author_name }));
    res.json({ ok: true, thread, posts });
  }));

  app.post('/api/ecosystem/forum/threads/:id/posts', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const id = s(req.params.id, 64);
    const body = s(req.body?.body, 8000);
    if (!body) { res.status(400).json({ ok: false, error: 'body_required' }); return; }
    const exists = await pool.query(`SELECT 1 FROM eco_forum_threads WHERE id = $1`, [id]);
    if (exists.rowCount === 0) { res.status(404).json({ ok: false, error: 'thread_not_found' }); return; }
    const r = await pool.query(
      `INSERT INTO eco_forum_thread_posts (thread_id, author_id, author_name, body, is_anonymous)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, actorId(req), actorName(req), body, !!req.body?.is_anonymous],
    );
    await pool.query(`UPDATE eco_forum_threads SET reply_count = reply_count + 1, updated_at = now() WHERE id = $1`, [id]);
    const post = r.rows[0];
    if (post.is_anonymous) post.author_name = 'Anonymous';
    res.json({ ok: true, post });
  }));

  // --- Study groups (generalized from CompetitiveExamPortal StudyGroup) ---
  app.get('/api/ecosystem/study-groups', flagGate, requireAuth, withSchema(async (req, res) => {
    const me = actorId(req);
    const r = await pool.query(
      `SELECT g.*,
              (SELECT COUNT(*)::int FROM eco_study_group_members m WHERE m.group_id = g.id) AS member_count,
              EXISTS (SELECT 1 FROM eco_study_group_members m WHERE m.group_id = g.id AND m.user_id = $1) AS is_member
         FROM eco_study_groups g WHERE g.is_public = true ORDER BY g.created_at DESC LIMIT 200`,
      [me],
    );
    res.json({ ok: true, groups: r.rows, count: r.rows.length });
  }));

  app.post('/api/ecosystem/study-groups', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const b = req.body ?? {};
    const name = s(b.name, 160);
    if (!name) { res.status(400).json({ ok: false, error: 'name_required' }); return; }
    const me = actorId(req);
    const maxM = b.max_members != null && Number.isFinite(Number(b.max_members)) ? Number(b.max_members) : null;
    const r = await pool.query(
      `INSERT INTO eco_study_groups (owner_id, name, topic, description, is_public, max_members)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [me, name, sOrNull(b.topic, 160), sOrNull(b.description, 2000), b.is_public === false ? false : true, maxM],
    );
    const group = r.rows[0];
    await pool.query(
      `INSERT INTO eco_study_group_members (group_id, user_id, user_name, role) VALUES ($1,$2,$3,'owner')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [group.id, me, actorName(req)],
    );
    res.json({ ok: true, group });
  }));

  app.post('/api/ecosystem/study-groups/:id/join', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const id = s(req.params.id, 64);
    const g = await pool.query(`SELECT id, max_members FROM eco_study_groups WHERE id = $1`, [id]);
    if (g.rowCount === 0) { res.status(404).json({ ok: false, error: 'group_not_found' }); return; }
    const maxM = g.rows[0].max_members;
    if (maxM != null) {
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM eco_study_group_members WHERE group_id = $1`, [id]);
      if ((c.rows[0]?.n ?? 0) >= maxM) { res.status(409).json({ ok: false, error: 'group_full' }); return; }
    }
    await pool.query(
      `INSERT INTO eco_study_group_members (group_id, user_id, user_name) VALUES ($1,$2,$3)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [id, actorId(req), actorName(req)],
    );
    res.json({ ok: true });
  }));

  app.post('/api/ecosystem/study-groups/:id/leave', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const id = s(req.params.id, 64);
    await pool.query(`DELETE FROM eco_study_group_members WHERE group_id = $1 AND user_id = $2 AND role <> 'owner'`, [id, actorId(req)]);
    res.json({ ok: true });
  }));

  // --- Hackathons (listing + participation; create is super-admin only) ---
  app.get('/api/ecosystem/hackathons', flagGate, requireAuth, withSchema(async (req, res) => {
    const me = actorId(req);
    const r = await pool.query(
      `SELECT h.*,
              (SELECT COUNT(*)::int FROM eco_hackathon_participants p WHERE p.hackathon_id = h.id) AS participant_count,
              EXISTS (SELECT 1 FROM eco_hackathon_participants p WHERE p.hackathon_id = h.id AND p.user_id = $1) AS is_registered
         FROM eco_hackathons h ORDER BY h.start_date DESC NULLS LAST, h.created_at DESC LIMIT 200`,
      [me],
    );
    res.json({ ok: true, hackathons: r.rows, count: r.rows.length });
  }));

  app.post('/api/ecosystem/hackathons', flagGate, requireAuth, requireSuperAdmin, withSchemaWrite(async (req, res) => {
    const b = req.body ?? {};
    const title = s(b.title, 200);
    if (!title) { res.status(400).json({ ok: false, error: 'title_required' }); return; }
    const d = (v: unknown) => { const t = s(v, 30); return t || null; };
    const r = await pool.query(
      `INSERT INTO eco_hackathons (created_by, title, theme, description, mode, start_date, end_date, registration_deadline, prize_pool, external_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [actorId(req), title, sOrNull(b.theme, 200), sOrNull(b.description, 4000), s(b.mode, 20) || 'online',
       d(b.start_date), d(b.end_date), d(b.registration_deadline), sOrNull(b.prize_pool, 120), sOrNull(b.external_url, 500),
       s(b.status, 20) || 'upcoming'],
    );
    res.json({ ok: true, hackathon: r.rows[0] });
  }));

  app.post('/api/ecosystem/hackathons/:id/join', flagGate, requireAuth, withSchemaWrite(async (req, res) => {
    const id = s(req.params.id, 64);
    const h = await pool.query(`SELECT 1 FROM eco_hackathons WHERE id = $1`, [id]);
    if (h.rowCount === 0) { res.status(404).json({ ok: false, error: 'hackathon_not_found' }); return; }
    await pool.query(
      `INSERT INTO eco_hackathon_participants (hackathon_id, user_id, user_name, team_name) VALUES ($1,$2,$3,$4)
       ON CONFLICT (hackathon_id, user_id) DO UPDATE SET team_name = EXCLUDED.team_name`,
      [id, actorId(req), actorName(req), sOrNull(req.body?.team_name, 120)],
    );
    res.json({ ok: true });
  }));

  // ── Community challenges & leaderboard pointer (reuse existing gamification) ──
  // The gamification engine (/api/gamification/*) already owns XP/levels/streaks/missions/leaderboard;
  // this surface intentionally does NOT duplicate it — the frontend links to GamificationPage.
}
