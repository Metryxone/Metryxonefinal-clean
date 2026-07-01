/**
 * EP-98 — Employer Intelligence Operating System
 *
 * Routes: /api/employer/*
 * Auth: requireAuth (session-based, same-origin)
 * Intelligence: compose-only over shared platform engines — no duplicate computation.
 *   1. Hiring Intelligence     — CAPADEX session score + cra_scores skills match
 *   2. Talent Intelligence     — CAPADEX behavioral profile + LBI scores
 *   3. Workforce Intelligence  — aggregate pipeline analytics
 *   4. Leadership Intelligence — cra_scores LEA* domain
 *   5. Learning Intelligence   — lbi_scores
 *   6. Career Intelligence     — career_seeker_profiles JSONB
 *   7. Future Readiness        — frp_assessments tables
 *   8. Outcome Intelligence    — hire/offer history from employer data
 *
 * Data conventions:
 *   - employer_id = req.user.id (session-scoped)
 *   - DB stores id TEXT; all API responses map id → _id for frontend compatibility
 *   - ensureSchema is lazy (single flag, runs once per process)
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { randomBytes, createHash } from 'crypto';
import { sendAssessmentEmail, sendOfferLetterEmail, sendTeamInviteEmail, sendTalentOutreachEmail, sendApplicantCompletionRequest } from '../email';
import {
  ensureSecuritySchema, resolveOrgContext, logAudit, trackSession,
  checkApprovalRequired, createApproval, checkSSOEnforcement,
} from './employer-security';
import { computeSuccessProbability, parseSkills } from './employer-tig';
import { recordHiringOutcome, recordPerformanceOutcome, recordRetentionOutcome } from '../services/validation-loop-intake';
import { resolveCuratedRoleByTitle, getMatchableCuratedRoles } from '../services/role-title-crosswalk';
import { isTalentMatchingEnabled } from '../config/feature-flags';
import { ensureEmployerJobsSchema } from '../services/employer-jobs-schema';

type Middleware = (req: Request, res: Response, next: any) => void;

// ── Schema ─────────────────────────────────────────────────────────────────────
let schemaReady = false;

export async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  // `employer_jobs` is a shared table owned by SEVERAL modules (this authoring
  // path, recruiter-postings, MX-103W projection). Its canonical schema — the
  // base table + every descriptive column the INSERT / toJob mapping reference
  // (work_mode/experience/salary, responsibilities/perks, deadline, quota,
  // matched_role_*, share_token, …) — is now defined once in
  // services/employer-jobs-schema.ts so no module reintroduces schema drift.
  // See .agents/memory/employer-job-store-projection.md.
  await ensureEmployerJobsSchema(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employer_candidates (
      id               TEXT PRIMARY KEY,
      employer_id      TEXT NOT NULL,
      job_id           TEXT DEFAULT '',
      job_title        TEXT DEFAULT '',
      name             TEXT NOT NULL,
      email            TEXT DEFAULT '',
      phone            TEXT DEFAULT '',
      location         TEXT DEFAULT '',
      candidate_role   TEXT DEFAULT '',
      experience       TEXT DEFAULT '',
      skills           JSONB DEFAULT '[]'::jsonb,
      education        TEXT DEFAULT '',
      ei_score         INTEGER,
      match_score      INTEGER,
      source           TEXT DEFAULT 'Direct',
      stage            TEXT DEFAULT 'Applied',
      notes            TEXT DEFAULT '',
      rating           INTEGER DEFAULT 0,
      linkedin_url     TEXT DEFAULT '',
      applied_date     TIMESTAMPTZ DEFAULT now(),
      interview_date   TIMESTAMPTZ,
      offer_amount     NUMERIC,
      tags             JSONB DEFAULT '[]'::jsonb,
      assessment_sent  BOOLEAN DEFAULT false,
      assessment_score INTEGER,
      pooled           BOOLEAN DEFAULT false,
      capadex_session_id TEXT,
      behavioral_profile JSONB,
      competency_profile JSONB,
      created_at       TIMESTAMPTZ DEFAULT now(),
      updated_at       TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_candidates_employer ON employer_candidates(employer_id);
    CREATE INDEX IF NOT EXISTS idx_emp_candidates_stage    ON employer_candidates(stage);
    CREATE INDEX IF NOT EXISTS idx_emp_candidates_email    ON employer_candidates(email);
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS predicted_prob_at_decision FLOAT;
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS decision_at                TIMESTAMPTZ;
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS assessment_sent_at         TIMESTAMPTZ;
    -- Applicant self-completion loop: recruiter emails a token-scoped link so the
    -- candidate can add their own missing details (résumé, phone, etc). Hashed token
    -- only — the raw token lives only in the email link, never in the DB.
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS complete_token_hash        TEXT;
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS complete_token_expires     TIMESTAMPTZ;
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS completion_requested_at    TIMESTAMPTZ;
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS completion_completed_at    TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_emp_candidates_complete_token ON employer_candidates(complete_token_hash);

    -- Talent Pipeline (kanban): stage-change provenance + per-stage aging clock.
    -- stage_changed_at drives the "stalled" signal; stage_source ('manual'|'auto') keeps
    -- assistive automation transparent. Backfill is one-time (guarded by NULL); ensureSchema
    -- memoizes, so this whole block runs once per process.
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
    ALTER TABLE employer_candidates ADD COLUMN IF NOT EXISTS stage_source     TEXT DEFAULT 'manual';
    UPDATE employer_candidates SET stage_changed_at = COALESCE(updated_at, applied_date, created_at, now())
      WHERE stage_changed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_emp_candidates_job         ON employer_candidates(employer_id, job_id);
    CREATE INDEX IF NOT EXISTS idx_emp_candidates_stage_aging ON employer_candidates(employer_id, stage, stage_changed_at);

    -- Résumé / CV blobs live in a SEPARATE table so the candidate LIST query
    -- (SELECT * FROM employer_candidates) never loads the base64 payload.
    CREATE TABLE IF NOT EXISTS employer_candidate_resumes (
      candidate_id TEXT PRIMARY KEY,
      employer_id  TEXT NOT NULL,
      filename     TEXT NOT NULL,
      mime         TEXT DEFAULT 'application/octet-stream',
      size         INTEGER DEFAULT 0,
      data         TEXT NOT NULL,
      uploaded_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_cand_resumes_employer ON employer_candidate_resumes(employer_id);

    CREATE TABLE IF NOT EXISTS employer_interviews (
      id             TEXT PRIMARY KEY,
      employer_id    TEXT NOT NULL,
      candidate_id   TEXT NOT NULL,
      candidate_name TEXT DEFAULT '',
      job_id         TEXT DEFAULT '',
      job_title      TEXT DEFAULT '',
      type           TEXT DEFAULT 'Technical',
      date           TEXT DEFAULT '',
      time           TEXT DEFAULT '',
      duration       INTEGER DEFAULT 60,
      interviewers   JSONB DEFAULT '[]'::jsonb,
      meeting_link   TEXT DEFAULT '',
      status         TEXT DEFAULT 'Scheduled',
      feedback       TEXT DEFAULT '',
      rating         INTEGER,
      recommendation TEXT DEFAULT '',
      created_at     TIMESTAMPTZ DEFAULT now(),
      updated_at     TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_interviews_employer   ON employer_interviews(employer_id);
    CREATE INDEX IF NOT EXISTS idx_emp_interviews_candidate  ON employer_interviews(candidate_id);

    CREATE TABLE IF NOT EXISTS employer_offers (
      id              TEXT PRIMARY KEY,
      employer_id     TEXT NOT NULL,
      candidate_id    TEXT NOT NULL,
      candidate_name  TEXT DEFAULT '',
      job_id          TEXT DEFAULT '',
      job_title       TEXT DEFAULT '',
      ctc_fixed       NUMERIC DEFAULT 0,
      ctc_variable    NUMERIC DEFAULT 0,
      ctc_bonus       NUMERIC DEFAULT 0,
      total_ctc       NUMERIC DEFAULT 0,
      joining_date    TEXT DEFAULT '',
      validity        TEXT DEFAULT '',
      currency        TEXT DEFAULT 'INR',
      status          TEXT DEFAULT 'Draft',
      notes           TEXT DEFAULT '',
      counter_amount  NUMERIC,
      counter_notes   TEXT DEFAULT '',
      offer_letter_url TEXT DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT now(),
      updated_at      TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_offers_employer   ON employer_offers(employer_id);
    CREATE INDEX IF NOT EXISTS idx_emp_offers_candidate  ON employer_offers(candidate_id);

    CREATE TABLE IF NOT EXISTS employer_activity_logs (
      id           TEXT PRIMARY KEY,
      employer_id  TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      type         TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT DEFAULT '',
      by_user      TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_activity_candidate ON employer_activity_logs(candidate_id);

    CREATE TABLE IF NOT EXISTS employer_ref_checks (
      id           TEXT PRIMARY KEY,
      employer_id  TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      ref_name     TEXT NOT NULL DEFAULT '',
      ref_title    TEXT DEFAULT '',
      ref_company  TEXT DEFAULT '',
      ref_email    TEXT DEFAULT '',
      ref_phone    TEXT DEFAULT '',
      relationship TEXT DEFAULT '',
      status       TEXT DEFAULT 'Pending',
      outcome      TEXT DEFAULT '',
      notes        TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT now(),
      updated_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_refchecks_candidate ON employer_ref_checks(candidate_id);

    CREATE TABLE IF NOT EXISTS employer_company_profiles (
      id          TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL UNIQUE,
      name        TEXT DEFAULT '',
      industry    TEXT DEFAULT '',
      size        TEXT DEFAULT '',
      website     TEXT DEFAULT '',
      linkedin    TEXT DEFAULT '',
      location    TEXT DEFAULT '',
      about       TEXT DEFAULT '',
      culture     TEXT DEFAULT '',
      benefits    JSONB DEFAULT '[]'::jsonb,
      tech_stack  JSONB DEFAULT '[]'::jsonb,
      values_list JSONB DEFAULT '[]'::jsonb,
      verified    BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );

    -- Employer account type (additive — existing users keep default 'job_seeker')
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'job_seeker';
    -- (employer_jobs.share_token + backfill is owned by ensureEmployerJobsSchema)
    -- Interview scorecard (structured per-criterion ratings)
    ALTER TABLE employer_interviews ADD COLUMN IF NOT EXISTS scorecard JSONB DEFAULT '{}'::jsonb;

    -- Hiring team roster (employer-managed members + real invite tracking).
    -- NOTE: this is a managed roster + invitation email, NOT an RBAC/login-
    -- provisioning system; access_level documents the intended role.
    CREATE TABLE IF NOT EXISTS employer_team_members (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      employer_id  TEXT NOT NULL,
      name         TEXT DEFAULT '',
      email        TEXT NOT NULL,
      job_title    TEXT DEFAULT '',
      access_level TEXT DEFAULT 'Recruiter',
      status       TEXT DEFAULT 'Invited',
      invited_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT now(),
      updated_at   TIMESTAMPTZ DEFAULT now(),
      UNIQUE (employer_id, email)
    );

    -- Talent-pool outreach log (append-only history of real re-engagement emails)
    CREATE TABLE IF NOT EXISTS employer_pool_outreach (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      employer_id  TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      subject      TEXT DEFAULT '',
      body         TEXT DEFAULT '',
      status       TEXT DEFAULT 'sent',
      sent_at      TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pool_outreach_emp_cand
      ON employer_pool_outreach (employer_id, candidate_id);
  `);
  schemaReady = true;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid(): string {
  return (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function eid(req: Request): string {
  return (req as any).orgId ?? (req.user as any)?.id ?? 'anonymous';
}

/** Map DB row to API shape (id → _id, snake_case → camelCase for known fields). */
function toJob(r: any) {
  return {
    _id: r.id, title: r.title, department: r.department ?? '', location: r.location ?? '',
    type: r.type ?? '', workMode: r.work_mode ?? '', experience: r.experience ?? '',
    salary: r.salary ?? '', description: r.description ?? '',
    requirements: parseArr(r.requirements), responsibilities: parseArr(r.responsibilities),
    skills: parseArr(r.skills), perks: parseArr(r.perks),
    status: r.status ?? 'Active', deadline: r.deadline ?? '',
    hiringManager: r.hiring_manager ?? '', quota: r.quota ?? 1,
    eiMinScore: r.ei_min_score ?? 0, applicationCount: r.application_count ?? 0,
    shareToken: r.share_token ?? null,
    matchedRoleId: r.matched_role_id ?? null, matchedRoleSource: r.matched_role_source ?? null,
    createdAt: r.created_at,
  };
}

function toCandidate(r: any) {
  return {
    _id: r.id, jobId: r.job_id ?? '', jobTitle: r.job_title ?? '',
    name: r.name, email: r.email ?? '', phone: r.phone ?? '',
    location: r.location ?? '', currentRole: r.candidate_role ?? '',
    experience: r.experience ?? '', skills: parseArr(r.skills),
    education: r.education ?? '', eiScore: r.ei_score ?? null,
    matchScore: r.match_score ?? null, source: r.source ?? 'Direct',
    stage: r.stage ?? 'Applied', notes: r.notes ?? '', rating: r.rating ?? 0,
    linkedinUrl: r.linkedin_url ?? '', appliedDate: r.applied_date,
    interviewDate: r.interview_date ?? null, offerAmount: r.offer_amount ?? null,
    tags: parseArr(r.tags), assessmentSent: r.assessment_sent ?? false,
    assessmentScore: r.assessment_score ?? null, pooled: r.pooled ?? false,
    assessmentSentAt: r.assessment_sent_at ?? null,
    stageChangedAt: r.stage_changed_at ?? null,
    stageSource: r.stage_source ?? 'manual',
    completionRequestedAt: r.completion_requested_at ?? null,
    completionCompletedAt: r.completion_completed_at ?? null,
    createdAt: r.created_at,
  };
}

function toInterview(r: any) {
  return {
    _id: r.id, candidateId: r.candidate_id, candidateName: r.candidate_name ?? '',
    jobId: r.job_id ?? '', jobTitle: r.job_title ?? '',
    type: r.type ?? 'Technical', date: r.date ?? '', time: r.time ?? '',
    duration: r.duration ?? 60, interviewers: parseArr(r.interviewers),
    meetingLink: r.meeting_link ?? '', status: r.status ?? 'Scheduled',
    feedback: r.feedback ?? '', rating: r.rating ?? null,
    recommendation: r.recommendation ?? '',
    scorecard: r.scorecard ?? {},
    createdAt: r.created_at,
  };
}

function toOffer(r: any) {
  return {
    _id: r.id, candidateId: r.candidate_id, candidateName: r.candidate_name ?? '',
    jobId: r.job_id ?? '', jobTitle: r.job_title ?? '',
    ctcFixed: Number(r.ctc_fixed) || 0, ctcVariable: Number(r.ctc_variable) || 0,
    ctcBonus: Number(r.ctc_bonus) || 0, totalCTC: Number(r.total_ctc) || 0,
    joiningDate: r.joining_date ?? '', validity: r.validity ?? '',
    currency: r.currency ?? 'INR', status: r.status ?? 'Draft',
    notes: r.notes ?? '', counterAmount: r.counter_amount ? Number(r.counter_amount) : null,
    counterNotes: r.counter_notes ?? '', offerLetterUrl: r.offer_letter_url ?? '',
    createdAt: r.created_at,
  };
}

function toActivity(r: any) {
  return {
    _id: r.id, candidateId: r.candidate_id, type: r.type,
    title: r.title, description: r.description ?? '', by: r.by_user ?? '',
    createdAt: r.created_at,
  };
}

function toRefCheck(r: any) {
  return {
    _id: r.id, candidateId: r.candidate_id, refName: r.ref_name ?? '',
    refTitle: r.ref_title ?? '', refCompany: r.ref_company ?? '',
    refEmail: r.ref_email ?? '', refPhone: r.ref_phone ?? '',
    relationship: r.relationship ?? '', status: r.status ?? 'Pending',
    outcome: r.outcome ?? '', notes: r.notes ?? '', createdAt: r.created_at,
  };
}

function parseArr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

// ── Talent Pipeline (kanban) — stage canon, terminals, aging threshold ─────────────
// Terminal stages are the only ones where a human decision is irreversible-ish (success
// probability is snapshotted there). Active stages are eligible for the "stalled" signal
// and for the bottleneck calc. Auto-advance NEVER targets a terminal stage.
const PIPELINE_STAGES = ['Applied', 'Screened', 'Interview', 'Assessment', 'Offer', 'Hired', 'Rejected'];
const PIPELINE_TERMINAL = new Set(['Hired', 'Rejected']);
const PIPELINE_STALLED_DAYS = 10;

/** Snapshot decision-time success probability the FIRST time a candidate lands on a terminal
 *  stage. Shared by the single PUT and the pipeline bulk-move so both stay consistent.
 *  Best-effort and never throws — a failed snapshot must not fail the move. */
async function snapshotDecisionProb(pool: Pool, employerId: string, candidateId: string): Promise<void> {
  try {
    const r = await pool.query(`SELECT * FROM employer_candidates WHERE id = $1 AND employer_id = $2`, [candidateId, employerId]);
    const row = r.rows[0];
    if (!row || row.predicted_prob_at_decision != null || !row.job_id) return;
    const st = String(row.stage ?? '');
    if (st !== 'Hired' && st !== 'Rejected') return;
    const jr = await pool.query(`SELECT skills FROM employer_jobs WHERE id = $1 AND employer_id = $2`, [row.job_id, employerId]);
    const predicted = computeSuccessProbability(parseSkills(row.skills), Number(row.match_score ?? 0), parseSkills(jr.rows[0]?.skills));
    await pool.query(
      `UPDATE employer_candidates SET predicted_prob_at_decision = $1, decision_at = now()
        WHERE id = $2 AND predicted_prob_at_decision IS NULL`,
      [predicted, candidateId],
    );
    // Validation loop: durably RECORD the realized hiring outcome + its decision-time prediction
    // snapshot so the calibration surfaces can move past ABSTAIN once non-demo pairs reach k_min.
    // Flag-gated + never-throws (best-effort) — demo (@example.com) rows are recorded is_demo=true.
    await recordHiringOutcome(pool, {
      subjectEmail: String(row.email ?? ''),
      subjectUserId: row.candidate_user_id ?? row.user_id ?? null,
      outcomeValue: st === 'Hired' ? 1 : 0,
      predictedProb: predicted,
      refId: `employer_candidate:${candidateId}`,
      detail: { employer_candidate_id: candidateId, job_id: row.job_id, match_score: row.match_score ?? null, stage: st },
    });
  } catch { /* never throw — snapshot is best-effort */ }
}

// ── Realized PERFORMANCE outcome (interviewer verdict) ───────────────────────────────
// When an interviewer records a definite recommendation, that human verdict is a realized
// performance outcome the pre-hire assessment can be calibrated against: Strong Hire/Hire → 1,
// No Hire → 0; Maybe/blank carry no binary verdict → skipped. The candidate's assessment-derived
// match score (0..100) is the decision-time prediction (treated as ABSENT when 0/uninitialised —
// never coerced into a fake 0-probability pair). Flag-gated/demo-aware/idempotent inside the recorder.
export function recommendationToOutcome(rec: string): 0 | 1 | null {
  const r = rec.trim().toLowerCase();
  if (r === 'strong hire' || r === 'hire') return 1;
  if (r === 'no hire') return 0;
  return null; // Maybe / blank / unknown → no realized binary verdict
}

export async function recordInterviewPerformanceOutcome(pool: Pool, employerId: string, interviewId: string): Promise<void> {
  try {
    const ir = await pool.query(`SELECT * FROM employer_interviews WHERE id = $1 AND employer_id = $2`, [interviewId, employerId]);
    const iv = ir.rows[0];
    if (!iv) return;
    const outcome = recommendationToOutcome(String(iv.recommendation ?? ''));
    if (outcome == null) return; // no terminal verdict yet → nothing realized to record
    if (!iv.candidate_id) return;
    const cr = await pool.query(
      `SELECT email, match_score, capadex_session_id FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
      [iv.candidate_id, employerId],
    );
    const cand = cr.rows[0];
    const email = String(cand?.email ?? '').trim();
    if (!email) return; // no subject → cannot attribute the outcome
    const ms = Number(cand?.match_score ?? 0);
    const pred = Number.isFinite(ms) && ms > 0 ? ms / 100 : null; // 0/uninitialised → absent
    await recordPerformanceOutcome(pool, {
      subjectEmail: email,
      assessmentRef: cand?.capadex_session_id ?? null,
      outcomeValue: outcome,
      predictedProb: pred,
      refId: `employer_interview:${interviewId}`,
      detail: { employer_interview_id: interviewId, candidate_id: iv.candidate_id, job_id: iv.job_id ?? null, recommendation: iv.recommendation ?? null, rating: iv.rating ?? null },
    });
  } catch { /* never throw — best-effort */ }
}

// ── Realized RETENTION / yield outcome (offer outcome) ───────────────────────────────
// An offer reaching a terminal yield state is a realized retention/yield outcome: Accepted (the
// selected candidate joined) → 1; Declined/Withdrawn/Expired (did not join) → 0. Draft/Sent/
// Negotiating/pending_approval are non-terminal → skipped. The candidate's decision-time success
// probability (predicted_prob_at_decision, else match score) is the prediction (0/absent → NULL).
export function offerStatusToRetention(status: string): 0 | 1 | null {
  const s = status.trim().toLowerCase();
  if (s === 'accepted') return 1;
  if (s === 'declined' || s === 'withdrawn' || s === 'expired') return 0;
  return null; // Draft/Sent/Negotiating/pending_approval → not a terminal yield outcome
}

export async function recordOfferRetentionOutcome(pool: Pool, employerId: string, offerId: string): Promise<void> {
  try {
    const or = await pool.query(`SELECT * FROM employer_offers WHERE id = $1 AND employer_id = $2`, [offerId, employerId]);
    const off = or.rows[0];
    if (!off) return;
    const outcome = offerStatusToRetention(String(off.status ?? ''));
    if (outcome == null) return; // non-terminal → nothing realized to record
    if (!off.candidate_id) return;
    const cr = await pool.query(
      `SELECT email, match_score, predicted_prob_at_decision, capadex_session_id FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
      [off.candidate_id, employerId],
    );
    const cand = cr.rows[0];
    const email = String(cand?.email ?? '').trim();
    if (!email) return;
    let pred: number | null = cand?.predicted_prob_at_decision != null ? Number(cand.predicted_prob_at_decision) : null;
    if (pred == null) { const ms = Number(cand?.match_score ?? 0); pred = Number.isFinite(ms) && ms > 0 ? ms / 100 : null; }
    await recordRetentionOutcome(pool, {
      subjectEmail: email,
      assessmentRef: cand?.capadex_session_id ?? null,
      outcomeValue: outcome,
      predictedProb: pred,
      refId: `employer_offer:${offerId}`,
      detail: { employer_offer_id: offerId, candidate_id: off.candidate_id, job_id: off.job_id ?? null, status: off.status ?? null },
    });
  } catch { /* never throw — best-effort */ }
}

// ── Résumé / CV validation (shared by the authenticated upload AND the public flows) ──
const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5 MB decoded
const RESUME_ALLOWED_EXT = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
// SECURITY: MIME is DERIVED server-side from the validated extension — the client-supplied
// mime is NEVER trusted/stored. Otherwise an applicant could upload a .txt with mime=text/html
// and the inline viewer (blob iframe) would execute it (stored XSS). No allowed ext maps to an
// executable type; .txt is served as text/plain (and rendered escaped, never iframed).
const RESUME_EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
};

type ResumeValidation =
  | { ok: false; status: number; message: string }
  | { ok: true; cleanName: string; cleanMime: string; stored: string; size: number };

/** Validate + normalise a base64 résumé payload. Pure — never throws, never touches the DB.
 *  Single source of truth so the public and authenticated paths can never drift apart. */
function validateResumePayload(filename: unknown, mime: unknown, dataBase64: unknown): ResumeValidation {
  if (!filename || typeof filename !== 'string' || !dataBase64 || typeof dataBase64 !== 'string') {
    return { ok: false, status: 400, message: 'filename and dataBase64 are required' };
  }
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (!RESUME_ALLOWED_EXT.includes(ext)) {
    return { ok: false, status: 415, message: `Unsupported file type .${ext}. Allowed: ${RESUME_ALLOWED_EXT.join(', ')}` };
  }
  // Cheap pre-decode guard: base64 decodes to ~3/4 its length.
  if (Math.floor((dataBase64.length * 3) / 4) > RESUME_MAX_BYTES + 1024) {
    return { ok: false, status: 413, message: 'File exceeds the 5 MB limit' };
  }
  let buf: Buffer;
  try { buf = Buffer.from(dataBase64, 'base64'); } catch { return { ok: false, status: 400, message: 'Invalid base64 payload' }; }
  if (buf.length === 0) return { ok: false, status: 400, message: 'Empty file' };
  if (buf.length > RESUME_MAX_BYTES) return { ok: false, status: 413, message: 'File exceeds the 5 MB limit' };
  return {
    ok: true,
    cleanName: filename.slice(0, 200),
    cleanMime: RESUME_EXT_MIME[ext] || 'application/octet-stream', // DERIVED from ext — client mime ignored
    stored: buf.toString('base64'), // normalise (strip any whitespace/newlines)
    size: buf.length,
  };
}

// ── Applicant self-completion token helpers ──────────────────────────────────
/** High-entropy URL-safe token; only the sha256 hash is persisted. */
function makeCompletionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}
function hashCompletionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type MissingField = { key: string; label: string };
/** Deterministic "what's still missing" check — no inference, no fabrication. */
function computeMissingFields(c: any, hasResume: boolean): MissingField[] {
  const out: MissingField[] = [];
  const empty = (v: any) => v == null || String(v).trim() === '';
  if (!hasResume) out.push({ key: 'resume', label: 'Résumé / CV' });
  if (empty(c.phone)) out.push({ key: 'phone', label: 'Phone number' });
  if (empty(c.location)) out.push({ key: 'location', label: 'Location' });
  if (empty(c.linkedin_url)) out.push({ key: 'linkedinUrl', label: 'LinkedIn profile' });
  if (empty(c.candidate_role)) out.push({ key: 'currentRole', label: 'Current role / title' });
  if (empty(c.experience)) out.push({ key: 'experience', label: 'Years of experience' });
  if (empty(c.education)) out.push({ key: 'education', label: 'Education' });
  if (parseArr(c.skills).length === 0) out.push({ key: 'skills', label: 'Key skills' });
  return out;
}

// Lightweight in-memory throttle for the UNAUTHENTICATED completion routes (per client IP).
const completionHits = new Map<string, { count: number; resetAt: number }>();
function completionThrottle(req: Request, res: Response): boolean {
  const now = Date.now();
  if (completionHits.size > 5000) { // opportunistic cleanup
    for (const [k, v] of completionHits) if (v.resetAt < now) completionHits.delete(k);
  }
  const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || req.ip || 'unknown';
  const slot = completionHits.get(ip);
  if (!slot || slot.resetAt < now) { completionHits.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  slot.count++;
  if (slot.count > 40) { res.status(429).json({ message: 'Too many requests. Please wait a minute and try again.' }); return false; }
  return true;
}

// ── Intelligence Bridge (compose-only) ────────────────────────────────────────

/** Hiring Intelligence: CAPADEX session score + skills overlap against job requirements. */
async function getHiringIntelligence(pool: Pool, candidateEmail: string, jobId: string) {
  const [sessRes, jobRes] = await Promise.all([
    pool.query(
      `SELECT id, score, stage_code, concern_name, persona, status, primary_construct_key
         FROM capadex_sessions
        WHERE guest_email = $1 AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1`,
      [candidateEmail],
    ).catch(() => ({ rows: [] as any[] })),
    jobId ? pool.query(
      `SELECT skills, requirements, ei_min_score FROM employer_jobs WHERE id = $1`,
      [jobId],
    ).catch(() => ({ rows: [] as any[] })) : Promise.resolve({ rows: [] as any[] }),
  ]);
  const session = sessRes.rows[0] ?? null;
  const job = jobRes.rows[0] ?? null;
  if (!session && !job) return null;
  return {
    domain: 'hiring_intelligence',
    source: 'capadex_sessions + employer_jobs',
    capadexScore: session?.score ?? null,
    behavioralStage: session?.stage_code ?? null,
    concern: session?.concern_name ?? null,
    persona: session?.persona ?? null,
    constructKey: session?.primary_construct_key ?? null,
    eiThreshold: job?.ei_min_score ?? null,
    eiMeetsThreshold: session?.score != null && job?.ei_min_score != null
      ? session.score >= job.ei_min_score : null,
    confidence: session ? 'data_driven' : 'no_assessment',
  };
}

/** Talent Intelligence: LBI scores + CAPADEX behavioral summary. */
async function getTalentIntelligence(pool: Pool, candidateEmail: string) {
  const [lbiRes, sessRes] = await Promise.all([
    pool.query(
      `SELECT overall_lbi, learning_style, consistency_score, persistence_score,
              attention_score, adaptability_score, velocity_score, sessions_analyzed
         FROM lbi_scores WHERE user_email = $1 ORDER BY id DESC LIMIT 1`,
      [candidateEmail],
    ).catch(() => ({ rows: [] as any[] })),
    pool.query(
      `SELECT id, score, stage_code, concern_name, persona, omega_x_payload
         FROM capadex_sessions
        WHERE guest_email = $1 AND status = 'completed'
        ORDER BY created_at DESC LIMIT 1`,
      [candidateEmail],
    ).catch(() => ({ rows: [] as any[] })),
  ]);
  const lbi = lbiRes.rows[0] ?? null;
  const sess = sessRes.rows[0] ?? null;
  if (!lbi && !sess) return null;
  return {
    domain: 'talent_intelligence',
    source: 'lbi_scores + capadex_sessions',
    lbi: lbi ? {
      overall: Number(lbi.overall_lbi) || null,
      learningStyle: lbi.learning_style ?? null,
      consistency: Number(lbi.consistency_score) || null,
      persistence: Number(lbi.persistence_score) || null,
      attention: Number(lbi.attention_score) || null,
      adaptability: Number(lbi.adaptability_score) || null,
      velocity: Number(lbi.velocity_score) || null,
      sessionsAnalyzed: lbi.sessions_analyzed ?? null,
    } : null,
    behavioral: sess ? {
      sessionId: sess.id,
      score: sess.score,
      stage: sess.stage_code,
      concern: sess.concern_name,
      persona: sess.persona,
    } : null,
    confidence: (lbi && sess) ? 'high' : (lbi || sess) ? 'moderate' : 'no_data',
  };
}

/** Leadership Intelligence: LEA* competency codes from cra_scores. */
async function getLeadershipIntelligence(pool: Pool, candidateEmail: string) {
  const userRes = await pool.query(
    `SELECT id FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
    [candidateEmail],
  ).catch(() => ({ rows: [] as any[] }));
  const userId = userRes.rows[0]?.id ?? null;
  if (!userId) return null;
  const craRes = await pool.query(
    `SELECT competency_code, raw_score, confidence, created_at
       FROM cra_scores
      WHERE user_id = $1 AND competency_code LIKE 'LEA%'
      ORDER BY created_at DESC`,
    [userId],
  ).catch(() => ({ rows: [] as any[] }));
  if (!craRes.rows.length) return null;
  const scores = craRes.rows.map(r => ({ code: r.competency_code, score: Number(r.raw_score) || 0, confidence: r.confidence }));
  const avg = scores.reduce((s, r) => s + r.score, 0) / scores.length;
  return {
    domain: 'leadership_intelligence',
    source: 'cra_scores(LEA*)',
    overallLeadership: Math.round(avg),
    subCompetencies: scores,
    confidence: 'data_driven',
  };
}

/** Learning Intelligence: LBI profile. */
async function getLearningIntelligence(pool: Pool, candidateEmail: string) {
  const res = await pool.query(
    `SELECT overall_lbi, learning_style, consistency_score, persistence_score,
            attention_score, adaptability_score, velocity_score, sessions_analyzed
       FROM lbi_scores WHERE user_email = $1 ORDER BY id DESC LIMIT 1`,
    [candidateEmail],
  ).catch(() => ({ rows: [] as any[] }));
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return {
    domain: 'learning_intelligence',
    source: 'lbi_scores',
    overall: Number(r.overall_lbi) || null,
    learningStyle: r.learning_style ?? null,
    dimensions: {
      consistency: Number(r.consistency_score) || null,
      persistence: Number(r.persistence_score) || null,
      attention: Number(r.attention_score) || null,
      adaptability: Number(r.adaptability_score) || null,
      velocity: Number(r.velocity_score) || null,
    },
    sessionsAnalyzed: r.sessions_analyzed ?? null,
    confidence: 'data_driven',
  };
}

/** Career Intelligence: career_seeker_profiles JSONB. */
async function getCareerIntelligence(pool: Pool, candidateEmail: string) {
  const userRes = await pool.query(
    `SELECT id FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
    [candidateEmail],
  ).catch(() => ({ rows: [] as any[] }));
  const userId = userRes.rows[0]?.id ?? null;
  if (!userId) return null;
  const res = await pool.query(
    `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as any[] }));
  if (!res.rows.length) return null;
  const data = res.rows[0].data ?? {};
  return {
    domain: 'career_intelligence',
    source: 'career_seeker_profiles',
    careerStage: data.careerStage ?? null,
    targetRole: data.targetRole ?? null,
    employabilityIndex: data.eiScore ?? data.employabilityScore ?? null,
    passportData: data.passport ? {
      sections: Object.keys(data.passport),
    } : null,
    confidence: 'data_driven',
  };
}

/** Future Readiness Intelligence: frp_assessments. */
async function getFutureReadinessIntelligence(pool: Pool, candidateEmail: string) {
  const userRes = await pool.query(
    `SELECT id FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
    [candidateEmail],
  ).catch(() => ({ rows: [] as any[] }));
  const userId = userRes.rows[0]?.id ?? null;
  if (!userId) return null;
  const res = await pool.query(
    `SELECT fri_score, skill_durability, market_alignment, adaptability_score,
            learning_velocity, role_resilience, readiness_band, created_at
       FROM frp_assessments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as any[] }));
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return {
    domain: 'future_readiness_intelligence',
    source: 'frp_assessments',
    friScore: Number(r.fri_score) || null,
    readinessBand: r.readiness_band ?? null,
    dimensions: {
      skillDurability: Number(r.skill_durability) || null,
      marketAlignment: Number(r.market_alignment) || null,
      adaptability: Number(r.adaptability_score) || null,
      learningVelocity: Number(r.learning_velocity) || null,
      roleResilience: Number(r.role_resilience) || null,
    },
    confidence: 'data_driven',
  };
}

/** Competency Intelligence: all cra_scores domains. */
async function getCompetencyIntelligence(pool: Pool, candidateEmail: string) {
  const userRes = await pool.query(
    `SELECT id FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
    [candidateEmail],
  ).catch(() => ({ rows: [] as any[] }));
  const userId = userRes.rows[0]?.id ?? null;
  if (!userId) return null;
  const res = await pool.query(
    `SELECT competency_code, raw_score, confidence, created_at
       FROM cra_scores WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  ).catch(() => ({ rows: [] as any[] }));
  if (!res.rows.length) return null;
  const byDomain: Record<string, number[]> = {};
  for (const r of res.rows) {
    const domain = r.competency_code.slice(0, 3);
    byDomain[domain] = byDomain[domain] ?? [];
    byDomain[domain].push(Number(r.raw_score) || 0);
  }
  const domainSummary = Object.fromEntries(
    Object.entries(byDomain).map(([d, scores]) => [d, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)]),
  );
  return {
    domain: 'competency_intelligence',
    source: 'cra_scores',
    domainScores: domainSummary,
    rawScores: res.rows.map(r => ({ code: r.competency_code, score: Number(r.raw_score) || 0 })),
    confidence: 'data_driven',
  };
}

/** Unified intelligence envelope for a single candidate (all 8 domains). */
async function buildCandidateIntelligence(pool: Pool, candidate: any) {
  const email = candidate.email ?? '';
  const jobId = candidate.job_id ?? '';
  if (!email) {
    return { candidateId: candidate.id, email: null, domains: {}, confidence: 'no_email' };
  }
  const [hiring, talent, leadership, learning, career, futureReadiness, competency] = await Promise.all([
    getHiringIntelligence(pool, email, jobId),
    getTalentIntelligence(pool, email),
    getLeadershipIntelligence(pool, email),
    getLearningIntelligence(pool, email),
    getCareerIntelligence(pool, email),
    getFutureReadinessIntelligence(pool, email),
    getCompetencyIntelligence(pool, email),
  ]);
  const domains: Record<string, any> = {};
  if (hiring)        domains.hiring_intelligence        = hiring;
  if (talent)        domains.talent_intelligence        = talent;
  if (leadership)    domains.leadership_intelligence    = leadership;
  if (learning)      domains.learning_intelligence      = learning;
  if (career)        domains.career_intelligence        = career;
  if (futureReadiness) domains.future_readiness_intelligence = futureReadiness;
  if (competency)    domains.competency_intelligence    = competency;

  // Cold-profile fallback: build from employer record when no platform data found
  if (Object.keys(domains).length === 0) {
    const coldSkills = parseArr(candidate.skills);
    domains.profile_intelligence = {
      domain: 'profile_intelligence',
      source: 'employer_record',
      experience: candidate.experience ?? null,
      education: candidate.education ?? null,
      skillCount: coldSkills.length,
      topSkills: coldSkills.slice(0, 6),
      matchScore: candidate.match_score ? Number(candidate.match_score) : null,
      eiScore: candidate.ei_score ? Number(candidate.ei_score) : null,
      assessmentScore: candidate.assessment_score ? Number(candidate.assessment_score) : null,
      stage: candidate.stage ?? null,
      confidence: 'profile_only',
      note: 'No MetryxOne platform data. Insights derived from employer record only.',
    };
  }

  const domainCount = Object.keys(domains).length;
  return {
    candidateId: candidate.id,
    email,
    domains,
    domainCoverage: domainCount,
    confidence: domainCount >= 5 ? 'high' : domainCount >= 3 ? 'moderate' : domainCount >= 1 ? 'low' : 'no_data',
    generatedAt: new Date().toISOString(),
  };
}

function computeMatchScore(candidateSkills: string[], jobSkills: string[]): number {
  if (!jobSkills.length || !candidateSkills.length) return 0;
  const jobSet = new Set(jobSkills.map(s => s.toLowerCase().trim()).filter(Boolean));
  const matched = candidateSkills.filter(s => s && jobSet.has(s.toLowerCase().trim())).length;
  return Math.min(100, Math.round((matched / jobSkills.length) * 100));
}

// ── Route Registration ─────────────────────────────────────────────────────────

export function registerEmployerPortalRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Middleware,
): void {

  // ── Employer account gate ───────────────────────────────────────────────────
  // Any authenticated user can self-register; all other employer routes require
  // account_type = 'employer' (or superadmin). The register endpoint sets it.
  // ── Security gate — zero unauthenticated routes, org membership, audit intercept ─
  app.use('/api/employer', async (req: Request, res: Response, next: any) => {
    if (req.path.startsWith('/public/')) return next();
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    if (req.path === '/register' && req.method === 'POST') return next();
    const u = req.user as any;
    const acct: string = u?.account_type ?? '';
    const sysRole: string = u?.role ?? '';
    const isSuperAdmin = sysRole === 'superadmin' || sysRole === 'super_admin' || acct === 'super_admin';
    if (acct !== 'employer' && !isSuperAdmin) {
      return res.status(403).json({
        message: 'employer_account_required',
        hint: 'POST /api/employer/register to activate your employer account',
      });
    }
    // Resolve org membership + set req.orgId / req.employerRole
    try {
      await ensureSecuritySchema(pool);
      const orgCtx = await resolveOrgContext(req, pool);
      if (orgCtx) {
        (req as any).orgId = orgCtx.orgId;
        (req as any).employerRole = orgCtx.role;
        trackSession(pool, req, orgCtx.orgId, u.id);
      } else {
        // Registered employer with no org record yet — give solo-owner context
        (req as any).orgId = u.id;
        (req as any).employerRole = 'owner';
      }
    } catch { /* security schema not ready; fall through with bare user.id */ }
    // SSO enforcement — block email/password logins for domain-matched users when enforce=true
    const _ssoOrgId: string = (req as any).orgId ?? u.id;
    const _userEmail: string = (u as any).username ?? (u as any).email ?? '';
    const _ssoBlock = await checkSSOEnforcement(pool, _ssoOrgId, _userEmail, req).catch(() => ({ blocked: false as const }));
    if (_ssoBlock.blocked) {
      return res.status(403).json({ error: 'sso_required', message: (_ssoBlock as any).reason });
    }
    // Audit interceptor — fire-and-forget on all write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const orgId: string = (req as any).orgId ?? u.id;
      const userId: string = u.id;
      const origJson = (res as any).json?.bind(res);
      if (origJson) {
        (res as any).json = (body: any) => {
          if (res.statusCode < 400) {
            const actionMap: Record<string, string> = { POST: 'created', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' };
            const segments = req.path.split('/').filter(Boolean);
            const resourceType = segments[0] ?? 'resource';
            const resourceId = (body as any)?._id ?? (body?.offer as any)?._id ?? segments[1] ?? '';
            logAudit(pool, { orgId, userId, action: actionMap[req.method] ?? 'modified', resourceType, resourceId, req });
          }
          return origJson(body);
        };
      }
    }
    next();
  });

  // ── EMPLOYER SELF-REGISTRATION ──────────────────────────────────────────────
  // Sets account_type = 'employer' for the current user. Idempotent.
  app.post('/api/employer/register', requireAuth, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      await ensureSecuritySchema(pool);
      const userId = (req.user as any)?.id;
      await pool.query(`UPDATE users SET account_type = 'employer' WHERE id = $1`, [userId]);
      (req.user as any).account_type = 'employer';
      // Bootstrap org + owner membership (org.id = userId keeps existing employer_id scoping intact)
      const compRow = await pool.query(
        `SELECT name FROM employer_company_profiles WHERE employer_id = $1`, [userId],
      ).catch(() => ({ rows: [] as any[] }));
      const orgName = compRow.rows[0]?.name || (req.body as any)?.companyName || '';
      await pool.query(
        `INSERT INTO employer_organizations (id, name, owner_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [userId, orgName, userId],
      );
      await pool.query(
        `INSERT INTO employer_members (id, org_id, user_id, role, status)
         VALUES ($1,$2,$3,'owner','active') ON CONFLICT (org_id, user_id) DO NOTHING`,
        [uid(), userId, userId],
      );
      (req as any).orgId = userId;
      (req as any).employerRole = 'owner';
      res.json({ success: true, account_type: 'employer', orgId: userId, role: 'owner' });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? 'registration_error' });
    }
  });

  // ── PUBLIC JOB APPLICATION (no auth required — gate middleware skips /public/) ─

  app.get('/api/employer/public/jobs/:token', async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const jobRow = await pool.query(
        `SELECT ej.*, ecp.name AS company_name, ecp.industry, ecp.about, ecp.location AS company_location
           FROM employer_jobs ej
           LEFT JOIN employer_company_profiles ecp ON ecp.employer_id = ej.employer_id
          WHERE ej.share_token = $1 AND ej.status = 'Active'`,
        [req.params.token],
      );
      if (!jobRow.rows.length) return res.status(404).json({ message: 'Job not found or no longer active' });
      const r = jobRow.rows[0];
      res.json({
        job: toJob(r),
        company: { name: r.company_name ?? '', industry: r.industry ?? '', about: r.about ?? '', location: r.company_location ?? '' },
      });
    } catch (e: any) { res.status(500).json({ message: e?.message ?? 'error' }); }
  });

  app.post('/api/employer/public/jobs/:token/apply', async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const jobRow = await pool.query(
        `SELECT id, employer_id, title, skills FROM employer_jobs WHERE share_token = $1 AND status = 'Active'`,
        [req.params.token],
      );
      if (!jobRow.rows.length) return res.status(404).json({ message: 'Job not found or no longer active' });
      const job = jobRow.rows[0];
      const b = req.body;
      if (!b.name?.trim() || !b.email?.trim()) return res.status(400).json({ message: 'Name and email are required' });
      const id = uid();
      const skillArr: string[] = Array.isArray(b.skills) ? b.skills : (b.skills ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
      await pool.query(
        `INSERT INTO employer_candidates
           (id, employer_id, job_id, job_title, name, email, phone, location,
            candidate_role, experience, skills, education, source, stage, notes,
            rating, applied_date, tags, assessment_sent, pooled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          id, job.employer_id, job.id, job.title,
          b.name.trim(), b.email.trim().toLowerCase(),
          b.phone ?? '', b.location ?? '', b.currentRole ?? '', b.experience ?? '',
          JSON.stringify(skillArr), b.education ?? '',
          'Public Application', 'Applied', b.coverNote ?? '',
          0, new Date().toISOString(), JSON.stringify([]), false, false,
        ],
      );
      // Optional résumé — stored ONLY after the candidate row exists (FK integrity).
      // Mirrors the same validation guards as the authenticated upload path.
      let resumeStored = false;
      const rf = b.resume;
      if (rf && (rf.filename || rf.dataBase64)) {
        const v = validateResumePayload(rf.filename, rf.mime, rf.dataBase64);
        if (v.ok) {
          await pool.query(
            `INSERT INTO employer_candidate_resumes (candidate_id, employer_id, filename, mime, size, data, uploaded_at)
             VALUES ($1,$2,$3,$4,$5,$6, now())
             ON CONFLICT (candidate_id) DO UPDATE SET
               employer_id = EXCLUDED.employer_id, filename = EXCLUDED.filename,
               mime = EXCLUDED.mime, size = EXCLUDED.size, data = EXCLUDED.data, uploaded_at = now()`,
            [id, job.employer_id, v.cleanName, v.cleanMime, v.size, v.stored],
          );
          resumeStored = true;
        }
        // Invalid résumé is non-fatal: the application itself still succeeds (honest, never throws).
      }
      // Auto match score
      const jobSkillArr = parseArr(job.skills);
      const autoScore = computeMatchScore(skillArr, jobSkillArr);
      if (autoScore > 0) pool.query(`UPDATE employer_candidates SET match_score = $1 WHERE id = $2`, [autoScore, id]).catch(() => {});
      pool.query(`UPDATE employer_jobs SET application_count = application_count + 1 WHERE id = $1`, [job.id]).catch(() => {});
      res.status(201).json({ success: true, message: 'Application submitted successfully', resumeStored });
    } catch (e: any) { res.status(500).json({ message: e?.message ?? 'error' }); }
  });

  // ── PUBLIC APPLICANT SELF-COMPLETION (unauthenticated, token-gated) ─────────
  // Token is high-entropy, hashed-at-rest, single-candidate-scoped, expiring.
  // Bad/expired tokens return a GENERIC 404 (no oracle). Minimal data exposed —
  // never scores, never other candidates. Both routes are IP-rate-limited.
  app.get('/api/employer/public/complete/:token', async (req: Request, res: Response) => {
    if (!completionThrottle(req, res)) return;
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store'); // PII keyed by a token URL — never cache
    try {
      await ensureSchema(pool);
      const hash = hashCompletionToken(String(req.params.token || ''));
      const r = await pool.query(
        `SELECT ec.id, ec.name, ec.email, ec.phone, ec.location, ec.linkedin_url,
                ec.candidate_role, ec.experience, ec.education, ec.skills, ec.job_title,
                ec.complete_token_expires, ec.completion_completed_at,
                ecp.name AS company_name
           FROM employer_candidates ec
           LEFT JOIN employer_company_profiles ecp ON ecp.employer_id = ec.employer_id
          WHERE ec.complete_token_hash = $1`,
        [hash],
      );
      const c = r.rows[0];
      if (!c || !c.complete_token_expires || new Date(c.complete_token_expires).getTime() < Date.now()) {
        return res.status(404).json({ message: 'This link is invalid or has expired.' });
      }
      const hasResume = await pool.query(`SELECT 1 FROM employer_candidate_resumes WHERE candidate_id = $1`, [c.id]);
      const hr = (hasResume.rowCount ?? 0) > 0;
      res.json({
        firstName: String(c.name || '').trim().split(/\s+/)[0] || '',
        company: c.company_name ?? '',
        jobTitle: c.job_title ?? '',
        email: c.email ?? '',                 // identity — read-only on the client
        values: {
          phone: c.phone ?? '', location: c.location ?? '', linkedinUrl: c.linkedin_url ?? '',
          currentRole: c.candidate_role ?? '', experience: c.experience ?? '',
          education: c.education ?? '', skills: parseArr(c.skills),
        },
        hasResume: hr,
        missing: computeMissingFields(c, hr),
        completedAt: c.completion_completed_at ?? null,
      });
    } catch { res.status(500).json({ message: 'Something went wrong. Please try again.' }); }
  });

  app.post('/api/employer/public/complete/:token', async (req: Request, res: Response) => {
    if (!completionThrottle(req, res)) return;
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store'); // PII keyed by a token URL — never cache
    try {
      await ensureSchema(pool);
      const hash = hashCompletionToken(String(req.params.token || ''));
      const r = await pool.query(
        `SELECT id, employer_id, complete_token_expires FROM employer_candidates WHERE complete_token_hash = $1`,
        [hash],
      );
      const c = r.rows[0];
      if (!c || !c.complete_token_expires || new Date(c.complete_token_expires).getTime() < Date.now()) {
        return res.status(404).json({ message: 'This link is invalid or has expired.' });
      }
      const b = req.body || {};
      // Validate the résumé BEFORE writing any field — fail before we mutate anything.
      let resumeValid: ResumeValidation | null = null;
      const rf = b.resume;
      if (rf && (rf.filename || rf.dataBase64)) {
        resumeValid = validateResumePayload(rf.filename, rf.mime, rf.dataBase64);
        if (!resumeValid.ok) { res.status(resumeValid.status).json({ message: resumeValid.message }); return; }
      }
      // Editable fields only — email is identity and never updated. Bound every input.
      const clip = (v: any, n: number) => (v == null ? '' : String(v).slice(0, n).trim());
      const phone = clip(b.phone, 60);
      const location = clip(b.location, 200);
      const linkedinUrl = clip(b.linkedinUrl, 300);
      const currentRole = clip(b.currentRole, 200);
      const experience = clip(b.experience, 100);
      const education = clip(b.education, 500);
      const skillsArr = Array.isArray(b.skills)
        ? b.skills.map((s: any) => String(s).slice(0, 80).trim()).filter(Boolean).slice(0, 50)
        : (typeof b.skills === 'string'
            ? b.skills.split(',').map((s: string) => s.slice(0, 80).trim()).filter(Boolean).slice(0, 50)
            : null);
      const skillsJson = (skillsArr && skillsArr.length) ? JSON.stringify(skillsArr) : null;
      // CASE-WHEN-nonempty: an empty form field NEVER wipes existing data.
      await pool.query(
        `UPDATE employer_candidates SET
           phone          = CASE WHEN $2  <> '' THEN $2  ELSE phone END,
           location       = CASE WHEN $3  <> '' THEN $3  ELSE location END,
           linkedin_url   = CASE WHEN $4  <> '' THEN $4  ELSE linkedin_url END,
           candidate_role = CASE WHEN $5  <> '' THEN $5  ELSE candidate_role END,
           experience     = CASE WHEN $6  <> '' THEN $6  ELSE experience END,
           education      = CASE WHEN $7  <> '' THEN $7  ELSE education END,
           skills         = CASE WHEN $8::jsonb IS NOT NULL THEN $8::jsonb ELSE skills END,
           completion_completed_at = now()
         WHERE id = $1`,
        [c.id, phone, location, linkedinUrl, currentRole, experience, education, skillsJson],
      );
      if (resumeValid && resumeValid.ok) {
        await pool.query(
          `INSERT INTO employer_candidate_resumes (candidate_id, employer_id, filename, mime, size, data, uploaded_at)
           VALUES ($1,$2,$3,$4,$5,$6, now())
           ON CONFLICT (candidate_id) DO UPDATE SET
             employer_id = EXCLUDED.employer_id, filename = EXCLUDED.filename,
             mime = EXCLUDED.mime, size = EXCLUDED.size, data = EXCLUDED.data, uploaded_at = now()`,
          [c.id, c.employer_id, resumeValid.cleanName, resumeValid.cleanMime, resumeValid.size, resumeValid.stored],
        );
      }
      res.json({ success: true, message: 'Thank you — your application has been updated.' });
    } catch { res.status(500).json({ message: 'Something went wrong. Please try again.' }); }
  });

  // Ensure schema once per request (fast path: flag check first)
  const withSchema = (handler: (req: Request, res: Response) => Promise<void>): Middleware => {
    return async (req: Request, res: Response, next: any) => {
      try {
        await ensureSchema(pool);
        await ensureSecuritySchema(pool).catch(() => {});
        await handler(req, res);
      } catch (err: any) {
        console.error('[employer-portal]', err?.message);
        next(err);
      }
    };
  };

  // ── JOBS ──────────────────────────────────────────────────────────────────

  app.get('/api/employer/jobs', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_jobs WHERE employer_id = $1 ORDER BY created_at DESC`,
      [eid(req)],
    );
    res.json(rows.rows.map(toJob));
  }));

  app.post('/api/employer/jobs', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const id = uid();
    await pool.query(
      `INSERT INTO employer_jobs
         (id, employer_id, title, department, location, type, work_mode, experience, salary,
          description, requirements, responsibilities, skills, perks, ei_min_score, status,
          deadline, hiring_manager, quota, matched_role_id, matched_role_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        id, eid(req), b.title ?? '', b.department ?? '', b.location ?? '',
        b.type ?? 'Full-time', b.workMode ?? 'On-site', b.experience ?? '',
        b.salary ?? '', b.description ?? '',
        JSON.stringify(b.requirements ?? []), JSON.stringify(b.responsibilities ?? []),
        JSON.stringify(b.skills ?? []), JSON.stringify(b.perks ?? []),
        b.eiMinScore ?? 0, b.status ?? 'Active',
        b.deadline ?? '', b.hiringManager ?? '', b.quota ?? 1,
        (typeof b.matchedRoleId === 'string' && b.matchedRoleId.trim()) ? b.matchedRoleId.trim() : null,
        (typeof b.matchedRoleSource === 'string' && b.matchedRoleSource.trim()) ? b.matchedRoleSource.trim() : null,
      ],
    );
    const row = await pool.query(`SELECT * FROM employer_jobs WHERE id = $1`, [id]);
    res.status(201).json({ success: true, job: toJob(row.rows[0]) });
  }));

  app.put('/api/employer/jobs/:id', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      title: 'title', department: 'department', location: 'location',
      type: 'type', workMode: 'work_mode', experience: 'experience',
      salary: 'salary', description: 'description', status: 'status',
      deadline: 'deadline', hiringManager: 'hiring_manager', quota: 'quota',
      eiMinScore: 'ei_min_score',
      matchedRoleId: 'matched_role_id', matchedRoleSource: 'matched_role_source',
    };
    const nullableText = new Set(['matchedRoleId', 'matchedRoleSource']);
    for (const [k, col] of Object.entries(map)) {
      if (k in b) {
        let v = b[k];
        if (nullableText.has(k)) v = (typeof v === 'string' && v.trim()) ? v.trim() : null;
        fields.push(`${col} = $${i++}`); vals.push(v);
      }
    }
    for (const [k, col] of [['requirements','requirements'],['responsibilities','responsibilities'],['skills','skills'],['perks','perks']]) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(JSON.stringify(b[k])); }
    }
    if (!fields.length) return res.json({ success: true });
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, eid(req));
    await pool.query(
      `UPDATE employer_jobs SET ${fields.join(', ')} WHERE id = $${i} AND employer_id = $${i + 1}`,
      vals,
    );
    const row = await pool.query(
      `SELECT * FROM employer_jobs WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, job: toJob(row.rows[0]) });
  }));

  app.delete('/api/employer/jobs/:id', requireAuth, withSchema(async (req, res) => {
    await pool.query(
      `DELETE FROM employer_jobs WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    res.json({ success: true });
  }));

  // ── ROLE MATCHING (Task #102) ───────────────────────────────────────────────
  // Employer-scoped, flag-gated (talentMatching). OFF → 503 before any DB touch,
  // so the JobsTab role-match panel stays hidden and the post/edit flow is
  // byte-identical to legacy. Read-only / abstain-never-fabricate: the title is
  // crosswalked to a curated Role-DNA role, or the response abstains (resolved:
  // null) prompting the employer to choose a role by hand.

  // Resolve a free-text job title → curated role (with Confidence ⟂ Coverage).
  app.get('/api/employer/resolve-role', requireAuth, async (req, res) => {
    if (!isTalentMatchingEnabled()) {
      return res.status(503).json({ error: 'role matching is not enabled', flag: 'talentMatching' });
    }
    const title = String(req.query.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'title query param is required' });
    try {
      const resolution = await resolveCuratedRoleByTitle(pool, title);
      res.json(resolution);
    } catch (e: any) {
      console.error('[employer-portal] resolve-role', e?.message);
      res.status(500).json({ error: 'failed to resolve role' });
    }
  });

  // List curated roles an employer can pick from (override / abstain recovery).
  app.get('/api/employer/matchable-roles', requireAuth, async (_req, res) => {
    if (!isTalentMatchingEnabled()) {
      return res.status(503).json({ error: 'role matching is not enabled', flag: 'talentMatching' });
    }
    try {
      const roles = await getMatchableCuratedRoles(pool);
      res.json({ roles });
    } catch (e: any) {
      console.error('[employer-portal] matchable-roles', e?.message);
      res.status(500).json({ error: 'failed to list roles' });
    }
  });

  // ── CANDIDATES ────────────────────────────────────────────────────────────

  app.get('/api/employer/candidates', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_candidates WHERE employer_id = $1 ORDER BY created_at DESC`,
      [eid(req)],
    );
    const candidates = rows.rows.map(toCandidate);
    // Best-effort: derive assessment COMPLETION by matching the candidate's email to a
    // completed CAPADEX session — the same email-join the intelligence bridge uses.
    // Never throws: if the assessment store is unavailable, candidates still load
    // (honest: no completion flags rather than a failed request).
    const emails = Array.from(new Set(
      candidates.map(c => (c.email || '').toLowerCase().trim()).filter(Boolean),
    ));
    if (emails.length) {
      try {
        const comp = await pool.query(
          `SELECT lower(trim(guest_email)) AS em, max(updated_at) AS done_at
             FROM capadex_sessions
            WHERE lower(trim(guest_email)) = ANY($1) AND status = 'completed'
            GROUP BY 1`,
          [emails],
        );
        const done = new Map<string, any>();
        comp.rows.forEach((r: any) => done.set(r.em, r.done_at));
        candidates.forEach((c: any) => {
          // Honesty gate — "Invited → Completed" semantics: a completed CAPADEX
          // session only counts as THIS candidate completing the assessment WE sent
          // when (a) we actually invited them (assessment_sent_at present) AND (b) the
          // session completed at/after that invite. Without this, an old / personal /
          // other-employer session for the same email would falsely show "✓ Completed",
          // hide the Send button, and leak cross-context data into the candidate card.
          if (!c.assessmentSent || !c.assessmentSentAt) return;
          const m = done.get((c.email || '').toLowerCase().trim());
          if (m && new Date(m).getTime() >= new Date(c.assessmentSentAt).getTime()) {
            c.assessmentCompleted = true;
            c.assessmentCompletedAt = m;
          }
        });
      } catch { /* assessment store unavailable — no completion flags */ }
    }
    res.json(candidates);
  }));

  app.post('/api/employer/candidates', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const id = uid();
    await pool.query(
      `INSERT INTO employer_candidates
         (id, employer_id, job_id, job_title, name, email, phone, location,
          candidate_role, experience, skills, education, ei_score, match_score,
          source, stage, notes, rating, linkedin_url, applied_date, tags,
          assessment_sent, pooled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        id, eid(req), b.jobId ?? '', b.jobTitle ?? '',
        b.name ?? 'Unknown', b.email ?? '', b.phone ?? '', b.location ?? '',
        b.currentRole ?? '', b.experience ?? '',
        JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
        b.education ?? '', b.eiScore ?? null, b.matchScore ?? null,
        b.source ?? 'Direct', b.stage ?? 'Applied',
        b.notes ?? '', b.rating ?? 0, b.linkedinUrl ?? '',
        b.appliedDate ?? new Date().toISOString(),
        JSON.stringify(b.tags ?? []),
        b.assessmentSent ?? false, b.pooled ?? false,
      ],
    );
    // Increment job's application_count if jobId provided
    if (b.jobId) {
      pool.query(
        `UPDATE employer_jobs SET application_count = application_count + 1 WHERE id = $1`,
        [b.jobId],
      ).catch(() => {/* non-fatal */});
    }
    // Auto-compute match score from candidate skills vs job skills (fire-and-forget)
    if (b.jobId && Array.isArray(b.skills) && b.skills.length > 0 && !b.matchScore) {
      pool.query(`SELECT skills FROM employer_jobs WHERE id = $1`, [b.jobId])
        .then(jr => {
          if (jr.rows.length) {
            const score = computeMatchScore(b.skills, parseArr(jr.rows[0].skills));
            if (score > 0) pool.query(`UPDATE employer_candidates SET match_score = $1 WHERE id = $2`, [score, id]).catch(() => {});
          }
        }).catch(() => {});
    }
    const row = await pool.query(`SELECT * FROM employer_candidates WHERE id = $1`, [id]);
    res.status(201).json({ success: true, candidate: toCandidate(row.rows[0]) });
  }));

  // Bulk import (CSV/Excel) — validates, normalizes email, dedupes (in-batch + vs existing),
  // inserts only valid new rows, and returns HONEST counts (no fabricated rows).
  // Literal sub-path registered before the /:id param routes.
  app.post('/api/employer/candidates/bulk-import', requireAuth, withSchema(async (req, res) => {
    const list = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
    if (list.length === 0) {
      return res.json({ success: true, inserted: 0, skippedDuplicates: 0, invalid: [], candidates: [] });
    }
    const employerId = eid(req);
    const existing = await pool.query(
      `SELECT lower(trim(email)) AS email FROM employer_candidates WHERE employer_id = $1 AND trim(email) <> ''`,
      [employerId],
    );
    const seen = new Set<string>(existing.rows.map((r: any) => String(r.email)));
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const inserted: any[] = [];
    const invalid: { index: number; name: string; reason: string }[] = [];
    let skippedDuplicates = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i] || {};
      const name = String(b.name ?? '').trim();
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!name) { invalid.push({ index: i, name: '(blank)', reason: 'Missing name' }); continue; }
      if (!email || !emailRe.test(email)) { invalid.push({ index: i, name, reason: 'Invalid email' }); continue; }
      if (seen.has(email)) { skippedDuplicates++; continue; }
      seen.add(email);
      const id = uid();
      try {
        await pool.query(
          `INSERT INTO employer_candidates
             (id, employer_id, job_id, job_title, name, email, phone, location,
              candidate_role, experience, skills, education, ei_score, match_score,
              source, stage, notes, rating, linkedin_url, applied_date, tags,
              assessment_sent, pooled)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
          [
            id, employerId, '', '',
            name, email, String(b.phone ?? ''), String(b.location ?? ''),
            String(b.currentRole ?? ''), String(b.experience ?? ''),
            JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
            String(b.education ?? ''), null, null,
            b.source ?? 'CSV/Excel Import', b.stage ?? 'Applied',
            String(b.notes ?? ''), 0, '',
            b.appliedDate ?? new Date().toISOString(),
            JSON.stringify([]), false, false,
          ],
        );
        const row = await pool.query(`SELECT * FROM employer_candidates WHERE id = $1`, [id]);
        if (row.rows[0]) inserted.push(toCandidate(row.rows[0]));
      } catch {
        invalid.push({ index: i, name, reason: 'Insert failed' });
        seen.delete(email);
      }
    }
    res.status(201).json({
      success: true,
      inserted: inserted.length,
      skippedDuplicates,
      invalid,
      candidates: inserted,
    });
  }));

  app.put('/api/employer/candidates/:id', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const strMap: Record<string, string> = {
      jobId: 'job_id', jobTitle: 'job_title', name: 'name', email: 'email',
      phone: 'phone', location: 'location', currentRole: 'candidate_role',
      experience: 'experience', education: 'education', source: 'source',
      stage: 'stage', notes: 'notes', linkedinUrl: 'linkedin_url',
    };
    for (const [k, col] of Object.entries(strMap)) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(b[k]); }
    }
    const numMap: Record<string, string> = { eiScore: 'ei_score', matchScore: 'match_score', rating: 'rating', assessmentScore: 'assessment_score', offerAmount: 'offer_amount' };
    for (const [k, col] of Object.entries(numMap)) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(b[k]); }
    }
    const boolMap: Record<string, string> = { assessmentSent: 'assessment_sent', pooled: 'pooled' };
    for (const [k, col] of Object.entries(boolMap)) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(b[k]); }
    }
    if ('skills' in b) { fields.push(`skills = $${i++}`); vals.push(JSON.stringify(b.skills)); }
    if ('tags' in b) { fields.push(`tags = $${i++}`); vals.push(JSON.stringify(b.tags)); }
    // Manual stage move → stamp provenance + reset the per-stage aging clock (drives "stalled").
    if ('stage' in b) { fields.push(`stage_changed_at = now()`); fields.push(`stage_source = 'manual'`); }
    if (!fields.length) return res.json({ success: true });
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, eid(req));
    await pool.query(
      `UPDATE employer_candidates SET ${fields.join(', ')} WHERE id = $${i} AND employer_id = $${i + 1}`,
      vals,
    );
    const row = await pool.query(
      `SELECT * FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows[0]) return res.status(404).json({ error: 'Not found' });
    const updated = row.rows[0];

    // E1 — snapshot the success probability the FIRST time a candidate enters a terminal stage
    // (Hired/Rejected). Engine 8 trains on this decision-time value (not a later recompute that may
    // reflect drifted skills/role data), removing label drift. Fire-and-forget: a snapshot failure
    // must never fail the candidate update itself.
    const st = String(updated.stage ?? '');
    if ((st === 'Hired' || st === 'Rejected') && updated.predicted_prob_at_decision == null && updated.job_id) {
      // Snapshot the decision-time prediction AND durably record the realized hiring outcome into
      // the validation loop (shared helper — single source of truth with the bulk-move path).
      void snapshotDecisionProb(pool, eid(req), String(updated.id));
    }

    res.json({ success: true, candidate: toCandidate(updated) });
  }));

  app.delete('/api/employer/candidates/:id', requireAuth, withSchema(async (req, res) => {
    await pool.query(
      `DELETE FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    res.json({ success: true });
  }));

  // Register literal sub-paths BEFORE /:id catch-all (Express route ordering)
  app.post('/api/employer/candidates/:id/pool', requireAuth, withSchema(async (req, res) => {
    const row = await pool.query(
      `UPDATE employer_candidates SET pooled = NOT pooled, updated_at = now()
       WHERE id = $1 AND employer_id = $2 RETURNING pooled`,
      [req.params.id, eid(req)],
    );
    const pooled = row.rows[0]?.pooled ?? false;
    res.json({ success: true, pooled });
  }));

  // ── TALENT PIPELINE (volume-safe: server aggregation · paginated columns · bulk · assistive automation) ──
  // The kanban no longer loads every candidate into the browser. Counts come from a server-side
  // GROUP BY; each column pages its own rows; bulk-move + forward-only auto-advance run server-side.
  // Every route is employer-scoped (IDOR) and never throws. reviewReady/stalled are DERIVED on
  // read — only the POSTs (automate, bulk-move) and the candidate PUT ever mutate a stage.

  // Per-stage (and per-job) counts + bottleneck + review-ready / stalled signals. Pure read.
  app.get('/api/employer/pipeline/summary', requireAuth, withSchema(async (req, res) => {
    const employerId = eid(req);
    const jobId = String(req.query.jobId ?? 'all');
    const scoped = !!jobId && jobId !== 'all';
    const params: any[] = [employerId];
    let jobClause = '';
    if (scoped) { params.push(jobId); jobClause = ` AND job_id = $2`; }

    const grouped = await pool.query(
      `SELECT job_id, stage, COUNT(*)::int AS n
         FROM employer_candidates
        WHERE employer_id = $1${jobClause}
        GROUP BY job_id, stage`,
      params,
    );
    const stages: Record<string, number> = {};
    PIPELINE_STAGES.forEach(s => { stages[s] = 0; });
    const perJobMap = new Map<string, { jobId: string; total: number; stages: Record<string, number> }>();
    let total = 0;
    for (const r of grouped.rows) {
      const st = String(r.stage ?? 'Applied');
      const n = Number(r.n) || 0;
      stages[st] = (stages[st] ?? 0) + n;
      total += n;
      const jid = String(r.job_id ?? '');
      if (!perJobMap.has(jid)) { const blank: Record<string, number> = {}; PIPELINE_STAGES.forEach(s => { blank[s] = 0; }); perJobMap.set(jid, { jobId: jid, total: 0, stages: blank }); }
      const pj = perJobMap.get(jid)!;
      pj.total += n;
      pj.stages[st] = (pj.stages[st] ?? 0) + n;
    }
    // Bottleneck = the ACTIVE (non-terminal) stage holding the most candidates (surface at >2).
    let bottleneck: { stage: string; count: number } | null = null;
    for (const s of PIPELINE_STAGES) {
      if (PIPELINE_TERMINAL.has(s)) continue;
      if (stages[s] > (bottleneck?.count ?? 2)) bottleneck = { stage: s, count: stages[s] };
    }

    // Review-ready = invited + COMPLETED the assessment we sent, still awaiting a human decision.
    let reviewReady = 0;
    try {
      const rr = await pool.query(
        `SELECT COUNT(*)::int AS n
           FROM employer_candidates ec
          WHERE ec.employer_id = $1${jobClause}
            AND ec.assessment_sent_at IS NOT NULL
            AND ec.stage NOT IN ('Hired','Rejected','Offer')
            AND EXISTS (
              SELECT 1 FROM capadex_sessions cs
               WHERE lower(trim(cs.guest_email)) = lower(trim(ec.email))
                 AND cs.status = 'completed'
                 AND cs.updated_at >= ec.assessment_sent_at)`,
        params,
      );
      reviewReady = Number(rr.rows[0]?.n) || 0;
    } catch { /* assessment store unavailable — honest 0, not a guess */ }

    // Stalled = sitting in an active stage past the aging threshold.
    let stalled = 0;
    try {
      const stq = await pool.query(
        `SELECT COUNT(*)::int AS n
           FROM employer_candidates
          WHERE employer_id = $1${jobClause}
            AND stage NOT IN ('Hired','Rejected')
            AND COALESCE(stage_changed_at, updated_at, created_at) < now() - interval '${PIPELINE_STALLED_DAYS} days'`,
        params,
      );
      stalled = Number(stq.rows[0]?.n) || 0;
    } catch { /* ignore */ }

    res.json({
      stages, total, bottleneck, reviewReady, stalled,
      stalledDays: PIPELINE_STALLED_DAYS,
      perJob: Array.from(perJobMap.values()).sort((a, b) => b.total - a.total),
    });
  }));

  // One stage's candidates, paginated. OFFSET-based (safe to low-thousands; keyset is the next
  // step for tens-of-thousands). Server-side search + sort + flag(review|stalled). Only `limit`
  // rows ever leave the DB, so the browser never holds the whole pipeline.
  app.get('/api/employer/pipeline/stage', requireAuth, withSchema(async (req, res) => {
    const employerId = eid(req);
    const jobId = String(req.query.jobId ?? 'all');
    const stage = String(req.query.stage ?? '');
    if (!PIPELINE_STAGES.includes(stage)) { res.status(400).json({ error: 'Invalid stage' }); return; }
    const scoped = !!jobId && jobId !== 'all';
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const sort = String(req.query.sort ?? 'recent');
    const flag = String(req.query.flag ?? '');
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 50);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    const where: string[] = [`employer_id = $1`, `stage = $2`];
    const params: any[] = [employerId, stage];
    if (scoped) { params.push(jobId); where.push(`job_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      where.push(`(lower(name) LIKE ${p} OR lower(email) LIKE ${p} OR lower(candidate_role) LIKE ${p})`);
    }
    if (flag === 'stalled') {
      where.push(`stage NOT IN ('Hired','Rejected')`);
      where.push(`COALESCE(stage_changed_at, updated_at, created_at) < now() - interval '${PIPELINE_STALLED_DAYS} days'`);
    } else if (flag === 'review') {
      where.push(`assessment_sent_at IS NOT NULL`);
      where.push(`stage NOT IN ('Hired','Rejected','Offer')`);
      where.push(`EXISTS (SELECT 1 FROM capadex_sessions cs
                           WHERE lower(trim(cs.guest_email)) = lower(trim(employer_candidates.email))
                             AND cs.status = 'completed'
                             AND cs.updated_at >= employer_candidates.assessment_sent_at)`);
    }
    const whereSql = where.join(' AND ');

    let orderSql = `created_at DESC`;
    if (sort === 'match') orderSql = `match_score DESC NULLS LAST, created_at DESC`;
    else if (sort === 'ei') orderSql = `ei_score DESC NULLS LAST, created_at DESC`;
    else if (sort === 'name') orderSql = `lower(name) ASC`;
    else if (sort === 'oldest') orderSql = `COALESCE(stage_changed_at, updated_at, created_at) ASC`;

    const countQ = await pool.query(`SELECT COUNT(*)::int AS n FROM employer_candidates WHERE ${whereSql}`, params);
    const totalForStage = Number(countQ.rows[0]?.n) || 0;
    const rowsQ = await pool.query(
      `SELECT * FROM employer_candidates WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const candidates = rowsQ.rows.map(toCandidate);

    // Derive per-row stalled (aged in an active stage). No writes.
    const now = Date.now();
    const stalledMs = PIPELINE_STALLED_DAYS * 86400000;
    candidates.forEach((c: any) => {
      const changed = c.stageChangedAt ? new Date(c.stageChangedAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : now);
      c.stalledDays = Math.max(0, Math.floor((now - changed) / 86400000));
      c.stalled = !PIPELINE_TERMINAL.has(c.stage) && (now - changed) > stalledMs;
    });

    // Derive per-row review-ready (completed the assessment we sent) via ONE batched join over
    // just this page's emails — never a per-row query, never the whole table.
    const emails = Array.from(new Set(candidates.map((c: any) => (c.email || '').toLowerCase().trim()).filter(Boolean)));
    if (emails.length) {
      try {
        const comp = await pool.query(
          `SELECT lower(trim(guest_email)) AS em, max(updated_at) AS done_at
             FROM capadex_sessions
            WHERE lower(trim(guest_email)) = ANY($1) AND status = 'completed'
            GROUP BY 1`,
          [emails],
        );
        const done = new Map<string, any>();
        comp.rows.forEach((r: any) => done.set(r.em, r.done_at));
        candidates.forEach((c: any) => {
          if (!c.assessmentSent || !c.assessmentSentAt) return;
          const m = done.get((c.email || '').toLowerCase().trim());
          if (m && new Date(m).getTime() >= new Date(c.assessmentSentAt).getTime()) {
            c.assessmentCompleted = true;
            c.assessmentCompletedAt = m;
            c.reviewReady = !PIPELINE_TERMINAL.has(c.stage) && c.stage !== 'Offer';
          }
        });
      } catch { /* assessment store unavailable — leave flags as-is */ }
    }

    res.json({ stage, candidates, total: totalForStage, offset, limit, hasMore: offset + candidates.length < totalForStage });
  }));

  // Move many candidates at once (explicit human action). IDOR-scoped; honest moved/requested
  // counts (from RETURNING, not input cardinality). Terminal moves snapshot decision probability.
  app.post('/api/employer/pipeline/bulk-move', requireAuth, withSchema(async (req, res) => {
    const employerId = eid(req);
    const ids = Array.isArray(req.body?.candidateIds) ? req.body.candidateIds.map((x: any) => String(x)).filter(Boolean) : [];
    const toStage = String(req.body?.toStage ?? '');
    if (!PIPELINE_STAGES.includes(toStage)) { res.status(400).json({ error: 'Invalid stage' }); return; }
    if (!ids.length) { res.json({ success: true, moved: 0, requested: 0 }); return; }
    const upd = await pool.query(
      `UPDATE employer_candidates
          SET stage = $1, stage_source = 'manual', stage_changed_at = now(), updated_at = now()
        WHERE id = ANY($2) AND employer_id = $3
      RETURNING id`,
      [toStage, ids, employerId],
    );
    const movedIds = upd.rows.map((r: any) => r.id);
    if (PIPELINE_TERMINAL.has(toStage)) {
      for (const id of movedIds) void snapshotDecisionProb(pool, employerId, id);
    }
    res.json({ success: true, moved: movedIds.length, requested: ids.length });
  }));

  // Assistive auto-advance — FORWARD-ONLY, objective-signal driven, employer-scoped.
  // Rule: an assessment is in flight (assessment_sent_at set) for a candidate still in an early
  // stage → move them into "Assessment" (stage_source='auto'). Completion surfaces a DERIVED
  // "Ready for review" badge (NOT an auto-move) because the post-assessment call is always a
  // human's. Hire / Reject / Interview / Offer are NEVER touched. Idempotent; honest rowCount.
  app.post('/api/employer/pipeline/automate', requireAuth, withSchema(async (req, res) => {
    const employerId = eid(req);
    const jobId = String(req.body?.jobId ?? req.query.jobId ?? 'all');
    const scoped = !!jobId && jobId !== 'all';
    const params: any[] = [employerId];
    let jobClause = '';
    if (scoped) { params.push(jobId); jobClause = ` AND job_id = $2`; }
    let moved = 0;
    try {
      const r = await pool.query(
        `UPDATE employer_candidates
            SET stage = 'Assessment', stage_source = 'auto', stage_changed_at = now(), updated_at = now()
          WHERE employer_id = $1${jobClause}
            AND assessment_sent_at IS NOT NULL
            AND stage IN ('Applied','Screened')
        RETURNING id`,
        params,
      );
      moved = r.rowCount ?? 0;
    } catch { /* never throw */ }
    res.json({ success: true, moved, rule: 'assessment_in_flight_to_assessment_stage' });
  }));

  // ── CANDIDATE RÉSUMÉ / CV (attach · download · remove) ───────────────────
  // Multi-segment paths (/:id/resume[/meta]) — never swallowed by the /:id catch-all.
  // Every query joins/scopes on employer_id so one employer can never read another's files.
  // Validation lives in the module-level validateResumePayload (shared with public flows).

  app.get('/api/employer/candidates/:id/resume/meta', requireAuth, withSchema(async (req, res) => {
    const r = await pool.query(
      `SELECT cr.filename, cr.mime, cr.size, cr.uploaded_at
         FROM employer_candidate_resumes cr
         JOIN employer_candidates ec ON ec.id = cr.candidate_id
        WHERE cr.candidate_id = $1 AND ec.employer_id = $2`,
      [req.params.id, eid(req)],
    );
    const row = r.rows[0];
    res.json({ success: true, resume: row ? { filename: row.filename, mime: row.mime, size: row.size, uploadedAt: row.uploaded_at } : null });
  }));

  app.get('/api/employer/candidates/:id/resume', requireAuth, withSchema(async (req, res) => {
    const r = await pool.query(
      `SELECT cr.filename, cr.mime, cr.data
         FROM employer_candidate_resumes cr
         JOIN employer_candidates ec ON ec.id = cr.candidate_id
        WHERE cr.candidate_id = $1 AND ec.employer_id = $2`,
      [req.params.id, eid(req)],
    );
    const row = r.rows[0];
    if (!row) { res.status(404).json({ message: 'No résumé attached' }); return; }
    const buf = Buffer.from(row.data, 'base64');
    const safeName = String(row.filename || 'resume').replace(/[^\w.\-]+/g, '_');
    // SECURITY: serve the MIME DERIVED from the stored extension (never the stored/client mime)
    // and forbid sniffing, so a legacy/poisoned row can never render as active HTML in the viewer.
    const ext = (safeName.split('.').pop() || '').toLowerCase();
    res.setHeader('Content-Type', RESUME_EXT_MIME[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', String(buf.length));
    res.send(buf);
  }));

  app.post('/api/employer/candidates/:id/resume', requireAuth, withSchema(async (req, res) => {
    const { filename, mime, dataBase64 } = req.body || {};
    const v = validateResumePayload(filename, mime, dataBase64);
    if (!v.ok) { res.status(v.status).json({ message: v.message }); return; }
    // Verify the candidate belongs to this employer BEFORE storing anything.
    const own = await pool.query(`SELECT id FROM employer_candidates WHERE id = $1 AND employer_id = $2`, [req.params.id, eid(req)]);
    if (own.rowCount === 0) { res.status(404).json({ message: 'Candidate not found' }); return; }
    await pool.query(
      `INSERT INTO employer_candidate_resumes (candidate_id, employer_id, filename, mime, size, data, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (candidate_id) DO UPDATE SET
         employer_id = EXCLUDED.employer_id, filename = EXCLUDED.filename,
         mime = EXCLUDED.mime, size = EXCLUDED.size,
         data = EXCLUDED.data, uploaded_at = now()`,
      [req.params.id, eid(req), v.cleanName, v.cleanMime, v.size, v.stored],
    );
    res.json({ success: true, resume: { filename: v.cleanName, mime: v.cleanMime, size: v.size, uploadedAt: new Date().toISOString() } });
  }));

  app.delete('/api/employer/candidates/:id/resume', requireAuth, withSchema(async (req, res) => {
    await pool.query(
      `DELETE FROM employer_candidate_resumes WHERE candidate_id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    res.json({ success: true });
  }));

  // ── REQUEST COMPLETION FROM APPLICANT ────────────────────────────────────
  // Recruiter triggers an email so the APPLICANT fills in their own missing details.
  // Scoped to this employer (IDOR guard via eid). Rotates a fresh hashed token (14d).
  app.post('/api/employer/candidates/:id/request-completion', requireAuth, withSchema(async (req, res) => {
    const r = await pool.query(
      `SELECT id, name, email, phone, location, linkedin_url, candidate_role, experience,
              education, skills, job_title, employer_id
         FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    const c = r.rows[0];
    if (!c) { res.status(404).json({ message: 'Candidate not found' }); return; }
    const hasResume = await pool.query(`SELECT 1 FROM employer_candidate_resumes WHERE candidate_id = $1`, [c.id]);
    const hr = (hasResume.rowCount ?? 0) > 0;
    const missing = computeMissingFields(c, hr);
    // Rotate a fresh token on every request (invalidates any prior link). 14-day expiry.
    const { token, hash } = makeCompletionToken();
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE employer_candidates
          SET complete_token_hash = $2, complete_token_expires = $3, completion_requested_at = now()
        WHERE id = $1`,
      [c.id, hash, expires.toISOString()],
    );
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
    // Only email an ABSOLUTE link. A relative link in an email is unclickable, so if no
    // absolute base is configured we skip sending and surface the link for manual sharing.
    const hasAbsoluteBase = /^https?:\/\//i.test(baseUrl);
    const link = hasAbsoluteBase ? `${baseUrl}/complete/${token}` : `/complete/${token}`;
    const comp = await pool.query(`SELECT name FROM employer_company_profiles WHERE employer_id = $1`, [eid(req)]);
    const companyName = comp.rows[0]?.name || 'The hiring team';
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : '';
    // Demo candidates (@example.com) are NEVER emailed — honest flag; return the link so it can be tested.
    const isDemo = /@example\.com$/i.test(String(c.email || ''));
    let sent = false;
    if (!isDemo && c.email && hasAbsoluteBase) {
      sent = await sendApplicantCompletionRequest({
        toEmail: c.email, candidateName: c.name || '', companyName,
        jobTitle: c.job_title || '', missing: missing.map(m => m.label), link, note,
      });
    }
    res.json({
      success: true,
      missing,
      sent,
      demo: isDemo,
      requestedAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
      link: !sent ? link : undefined, // surfaced whenever no email went out, so the recruiter can share it manually
    });
  }));

  // ── BULK SEND ASSESSMENT ─────────────────────────────────────────────────
  // Registered BEFORE /:id routes so literal path wins over param match
  app.post('/api/employer/candidates/bulk-send-assessment', requireAuth, withSchema(async (req, res) => {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ message: 'candidateIds array required' });
    }
    const empId = eid(req);
    const compRow = await pool.query(`SELECT name FROM employer_company_profiles WHERE employer_id = $1`, [empId]);
    const companyName = compRow.rows[0]?.name || 'Your Company';
    let sent = 0, failed = 0, skipped = 0;
    const sentIds: string[] = [];
    await Promise.all(
      candidateIds.map(async (cid: string) => {
        try {
          const row = await pool.query(
            `SELECT email, name, job_title, assessment_sent FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
            [cid, empId],
          );
          if (!row.rows.length) { failed++; return; }
          const { email, name, job_title, assessment_sent } = row.rows[0];
          if (!email) { failed++; return; }
          if (assessment_sent) { skipped++; return; }
          const ok = await sendAssessmentEmail({ toEmail: email, candidateName: name || 'there', jobTitle: job_title || 'the role', companyName });
          if (ok) {
            await pool.query(`UPDATE employer_candidates SET assessment_sent = true, assessment_sent_at = now(), updated_at = now() WHERE id = $1`, [cid]);
            sent++;
            sentIds.push(cid);
          } else { failed++; }
        } catch { failed++; }
      }),
    );
    res.json({ success: true, sent, failed, skipped, total: candidateIds.length, sentIds });
  }));

  app.post('/api/employer/candidates/:id/send-assessment', requireAuth, withSchema(async (req, res) => {
    const row = await pool.query(
      `SELECT ec.email, ec.name, ec.job_title,
              COALESCE(ecp.name, 'Your Company') AS company_name
         FROM employer_candidates ec
         LEFT JOIN employer_company_profiles ecp ON ecp.employer_id = ec.employer_id
        WHERE ec.id = $1 AND ec.employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows.length) return res.status(404).json({ message: 'Candidate not found' });
    const { email, name, job_title, company_name } = row.rows[0];
    if (!email) return res.status(400).json({ message: 'Candidate has no email address' });

    // Send assessment invitation email
    const sent = await sendAssessmentEmail({
      toEmail: email,
      candidateName: name || 'there',
      jobTitle: job_title || 'the role',
      companyName: company_name,
    });

    // Only record the invitation when the email actually went out — keeps the
    // "Invited" status honest (a failed send is NOT marked as invited).
    if (sent) {
      await pool.query(
        `UPDATE employer_candidates SET assessment_sent = true, assessment_sent_at = now(), updated_at = now()
         WHERE id = $1 AND employer_id = $2`,
        [req.params.id, eid(req)],
      );
    }
    res.json({
      success: true,
      emailSent: sent,
      sentAt: sent ? new Date().toISOString() : null,
      message: sent
        ? `Assessment invitation sent to ${email}`
        : `Email delivery failed for ${email} — the address may be unreachable (e.g. @example.com demo data) or ZOHO_EMAIL is not configured.`,
    });
  }));

  // ── INTERVIEWS ────────────────────────────────────────────────────────────

  app.get('/api/employer/interviews', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_interviews WHERE employer_id = $1 ORDER BY created_at DESC`,
      [eid(req)],
    );
    res.json(rows.rows.map(toInterview));
  }));

  app.post('/api/employer/interviews', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const id = uid();
    await pool.query(
      `INSERT INTO employer_interviews
         (id, employer_id, candidate_id, candidate_name, job_id, job_title,
          type, date, time, duration, interviewers, meeting_link, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id, eid(req), b.candidateId ?? '', b.candidateName ?? '',
        b.jobId ?? '', b.jobTitle ?? '', b.type ?? 'Technical',
        b.date ?? '', b.time ?? '', b.duration ?? 60,
        JSON.stringify(b.interviewers ?? []),
        b.meetingLink ?? '', b.status ?? 'Scheduled',
      ],
    );
    const row = await pool.query(`SELECT * FROM employer_interviews WHERE id = $1`, [id]);
    res.status(201).json({ success: true, interview: toInterview(row.rows[0]) });
  }));

  app.put('/api/employer/interviews/:id', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const strMap: Record<string, string> = { type: 'type', date: 'date', time: 'time', status: 'status', feedback: 'feedback', recommendation: 'recommendation', meetingLink: 'meeting_link' };
    for (const [k, col] of Object.entries(strMap)) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(b[k]); }
    }
    if ('duration' in b) { fields.push(`duration = $${i++}`); vals.push(b.duration); }
    if ('rating' in b) { fields.push(`rating = $${i++}`); vals.push(b.rating); }
    if ('interviewers' in b) { fields.push(`interviewers = $${i++}`); vals.push(JSON.stringify(b.interviewers)); }
    if ('scorecard' in b) { fields.push(`scorecard = $${i++}`); vals.push(JSON.stringify(b.scorecard)); }
    if (!fields.length) return res.json({ success: true });
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, eid(req));
    await pool.query(
      `UPDATE employer_interviews SET ${fields.join(', ')} WHERE id = $${i} AND employer_id = $${i + 1}`,
      vals,
    );
    const row = await pool.query(
      `SELECT * FROM employer_interviews WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows[0]) return res.status(404).json({ error: 'Not found' });
    // Validation loop: a definite interviewer recommendation is a realized PERFORMANCE outcome.
    // Fire-and-forget + never-throws — recorder is flag-gated/demo-aware/idempotent.
    if ('recommendation' in b) void recordInterviewPerformanceOutcome(pool, eid(req), req.params.id);
    res.json({ success: true, interview: toInterview(row.rows[0]) });
  }));

  app.delete('/api/employer/interviews/:id', requireAuth, withSchema(async (req, res) => {
    await pool.query(
      `DELETE FROM employer_interviews WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    res.json({ success: true });
  }));

  // ── OFFERS ────────────────────────────────────────────────────────────────

  app.get('/api/employer/offers', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_offers WHERE employer_id = $1 ORDER BY created_at DESC`,
      [eid(req)],
    );
    res.json(rows.rows.map(toOffer));
  }));

  app.post('/api/employer/offers', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const id = uid();
    const orgId = eid(req);
    const total = (Number(b.ctcFixed) || 0) + (Number(b.ctcVariable) || 0) + (Number(b.ctcBonus) || 0);
    // Approval gate: offers above org threshold require admin sign-off
    const needsApproval = await checkApprovalRequired(
      pool, orgId, 'offer', { ...b, totalCtc: b.totalCTC ?? total },
    ).catch(() => false);
    const offerStatus = needsApproval ? 'pending_approval' : (b.status ?? 'Draft');
    await pool.query(
      `INSERT INTO employer_offers
         (id, employer_id, candidate_id, candidate_name, job_id, job_title,
          ctc_fixed, ctc_variable, ctc_bonus, total_ctc, joining_date, validity,
          currency, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id, orgId, b.candidateId ?? '', b.candidateName ?? '',
        b.jobId ?? '', b.jobTitle ?? '',
        Number(b.ctcFixed) || 0, Number(b.ctcVariable) || 0, Number(b.ctcBonus) || 0,
        b.totalCTC ?? total, b.joiningDate ?? '', b.validity ?? '',
        b.currency ?? 'INR', offerStatus, b.notes ?? '',
      ],
    );
    if (needsApproval) {
      const approvalId = await createApproval(pool, {
        orgId, requestedBy: (req.user as any)?.id ?? orgId,
        resourceType: 'offer', resourceId: id,
        action: 'create', payload: { ...b, totalCtc: b.totalCTC ?? total },
      }).catch(() => null);
      const row = await pool.query(`SELECT * FROM employer_offers WHERE id = $1`, [id]);
      return res.status(202).json({ success: true, offer: toOffer(row.rows[0]), pendingApproval: true, approvalId });
    }
    const row = await pool.query(`SELECT * FROM employer_offers WHERE id = $1`, [id]);
    res.status(201).json({ success: true, offer: toOffer(row.rows[0]) });
  }));

  app.put('/api/employer/offers/:id', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const strMap: Record<string, string> = { status: 'status', notes: 'notes', joiningDate: 'joining_date', validity: 'validity', currency: 'currency', counterNotes: 'counter_notes', offerLetterUrl: 'offer_letter_url' };
    for (const [k, col] of Object.entries(strMap)) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(b[k]); }
    }
    const numMap: Record<string, string> = { ctcFixed: 'ctc_fixed', ctcVariable: 'ctc_variable', ctcBonus: 'ctc_bonus', totalCTC: 'total_ctc', counterAmount: 'counter_amount' };
    for (const [k, col] of Object.entries(numMap)) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(Number(b[k]) || 0); }
    }
    if (!fields.length) return res.json({ success: true });
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, eid(req));
    await pool.query(
      `UPDATE employer_offers SET ${fields.join(', ')} WHERE id = $${i} AND employer_id = $${i + 1}`,
      vals,
    );
    const row = await pool.query(
      `SELECT * FROM employer_offers WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows[0]) return res.status(404).json({ error: 'Not found' });
    // Validation loop: an offer reaching a terminal status is a realized RETENTION / yield outcome.
    // Fire-and-forget + never-throws — recorder is flag-gated/demo-aware/idempotent.
    if ('status' in b) void recordOfferRetentionOutcome(pool, eid(req), req.params.id);
    res.json({ success: true, offer: toOffer(row.rows[0]) });
  }));

  app.delete('/api/employer/offers/:id', requireAuth, withSchema(async (req, res) => {
    await pool.query(
      `DELETE FROM employer_offers WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    res.json({ success: true });
  }));

  // ── OFFER LETTER ──────────────────────────────────────────────────────────
  app.post('/api/employer/offers/:id/send-letter', requireAuth, withSchema(async (req, res) => {
    const row = await pool.query(
      `SELECT eo.*, ec.email AS cand_email
         FROM employer_offers eo
         LEFT JOIN employer_candidates ec ON ec.id = eo.candidate_id
        WHERE eo.id = $1 AND eo.employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows.length) return res.status(404).json({ message: 'Offer not found' });
    const o = row.rows[0];
    const toEmail = o.cand_email ?? '';
    if (!toEmail) return res.status(400).json({ message: 'Candidate has no email address' });
    const compRow = await pool.query(`SELECT name FROM employer_company_profiles WHERE employer_id = $1`, [eid(req)]);
    const companyName = compRow.rows[0]?.name || 'Your Company';
    const total = Number(o.total_ctc) || 0;
    const curr = o.currency ?? 'INR';
    const ctcStr = total > 0
      ? (curr === 'INR'
        ? (total >= 100000 ? `₹${(total / 100000).toFixed(1)}L p.a.` : `₹${total.toLocaleString('en-IN')} p.a.`)
        : (total >= 1000 ? `$${(total / 1000).toFixed(0)}k p.a.` : `$${total} p.a.`))
      : '';
    const sent = await sendOfferLetterEmail({
      toEmail, candidateName: o.candidate_name || 'Candidate',
      jobTitle: o.job_title || 'the role', companyName, ctcStr,
      currency: curr, joiningDate: o.joining_date ?? '', validity: o.validity ?? '',
      notes: o.notes ?? '',
    });
    if (sent) await pool.query(`UPDATE employer_offers SET updated_at = now() WHERE id = $1`, [req.params.id]);
    res.json({
      success: true, emailSent: sent,
      message: sent ? `Offer letter sent to ${toEmail}` : 'Marked complete (email delivery failed — check ZOHO_EMAIL config)',
    });
  }));

  // ── ANALYTICS ─────────────────────────────────────────────────────────────

  app.get('/api/employer/analytics', requireAuth, withSchema(async (req, res) => {
    const empId = eid(req);
    const [jobs, candidates, offers] = await Promise.all([
      pool.query(`SELECT status FROM employer_jobs WHERE employer_id = $1`, [empId]),
      pool.query(`SELECT stage, ei_score, match_score, source FROM employer_candidates WHERE employer_id = $1`, [empId]),
      pool.query(`SELECT status FROM employer_offers WHERE employer_id = $1`, [empId]),
    ]);

    const totalJobs = jobs.rows.length;
    const activeJobs = jobs.rows.filter(j => j.status === 'Active').length;
    const cands = candidates.rows;
    const totalCandidates = cands.length;
    const hired = cands.filter(c => c.stage === 'Hired').length;
    const rejected = cands.filter(c => c.stage === 'Rejected').length;
    const inInterview = cands.filter(c => ['Interview','Screened'].includes(c.stage)).length;
    const inOffer = cands.filter(c => c.stage === 'Offer').length;

    const eiScores = cands.map(c => Number(c.ei_score)).filter(n => Number.isFinite(n) && n > 0);
    const matchScores = cands.map(c => Number(c.match_score)).filter(n => Number.isFinite(n) && n > 0);
    const avgEI = eiScores.length ? Math.round(eiScores.reduce((a, b) => a + b, 0) / eiScores.length) : null;
    const avgMatch = matchScores.length ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length) : null;

    const offersTotal = offers.rows.length;
    const offersAccepted = offers.rows.filter(o => o.status === 'Accepted').length;
    const offerRate = totalCandidates > 0 ? Math.round((offersTotal / totalCandidates) * 100) : 0;
    const hireRate = totalCandidates > 0 ? Math.round((hired / totalCandidates) * 100) : 0;

    const stageBreakdown: Record<string, number> = {};
    for (const c of cands) stageBreakdown[c.stage] = (stageBreakdown[c.stage] ?? 0) + 1;

    const sourceBreakdown: Record<string, number> = {};
    for (const c of cands) sourceBreakdown[c.source ?? 'Direct'] = (sourceBreakdown[c.source ?? 'Direct'] ?? 0) + 1;

    const funnelStages = ['Applied','Screened','Interview','Offer','Hired'];
    const conversionFunnel = funnelStages.map(stage => {
      const count = cands.filter(c => c.stage === stage || (stage === 'Interview' && c.stage === 'Interview') || (stage === 'Offer' && c.stage === 'Offer')).length;
      return { stage, count, rate: totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0 };
    });

    res.json({
      totalJobs, activeJobs, totalCandidates, hired, rejected,
      inInterview, inOffer, avgEI, avgMatch, offerRate, hireRate,
      offersAccepted, offersTotal, stageBreakdown, sourceBreakdown, conversionFunnel,
    });
  }));

  // ── COMPANY PROFILE ───────────────────────────────────────────────────────

  app.get('/api/employer/company', requireAuth, withSchema(async (req, res) => {
    const row = await pool.query(
      `SELECT * FROM employer_company_profiles WHERE employer_id = $1`,
      [eid(req)],
    );
    if (!row.rows.length) {
      return res.json({
        name: '', industry: '', size: '', website: '', linkedin: '',
        location: '', about: '', culture: '',
        benefits: [], techStack: [], values: [], verified: false,
      });
    }
    const r = row.rows[0];
    res.json({
      name: r.name ?? '', industry: r.industry ?? '', size: r.size ?? '',
      website: r.website ?? '', linkedin: r.linkedin ?? '', location: r.location ?? '',
      about: r.about ?? '', culture: r.culture ?? '',
      benefits: parseArr(r.benefits), techStack: parseArr(r.tech_stack),
      values: parseArr(r.values_list), verified: r.verified ?? false,
    });
  }));

  app.put('/api/employer/company', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const existing = await pool.query(
      `SELECT id FROM employer_company_profiles WHERE employer_id = $1`,
      [eid(req)],
    );
    if (existing.rows.length) {
      await pool.query(
        `UPDATE employer_company_profiles
            SET name=$2, industry=$3, size=$4, website=$5, linkedin=$6,
                location=$7, about=$8, culture=$9,
                benefits=$10, tech_stack=$11, values_list=$12,
                updated_at=now()
          WHERE employer_id=$1`,
        [
          eid(req), b.name ?? '', b.industry ?? '', b.size ?? '',
          b.website ?? '', b.linkedin ?? '', b.location ?? '',
          b.about ?? '', b.culture ?? '',
          JSON.stringify(b.benefits ?? []), JSON.stringify(b.techStack ?? []),
          JSON.stringify(b.values ?? []),
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO employer_company_profiles
           (id, employer_id, name, industry, size, website, linkedin,
            location, about, culture, benefits, tech_stack, values_list)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          uid(), eid(req), b.name ?? '', b.industry ?? '', b.size ?? '',
          b.website ?? '', b.linkedin ?? '', b.location ?? '',
          b.about ?? '', b.culture ?? '',
          JSON.stringify(b.benefits ?? []), JSON.stringify(b.techStack ?? []),
          JSON.stringify(b.values ?? []),
        ],
      );
    }
    res.json({ success: true });
  }));

  // ── ACTIVITY LOGS ─────────────────────────────────────────────────────────

  app.get('/api/employer/activity/:candidateId', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_activity_logs
        WHERE candidate_id = $1 AND employer_id = $2
        ORDER BY created_at DESC`,
      [req.params.candidateId, eid(req)],
    );
    res.json(rows.rows.map(toActivity));
  }));

  app.post('/api/employer/activity', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const id = uid();
    await pool.query(
      `INSERT INTO employer_activity_logs (id, employer_id, candidate_id, type, title, description, by_user)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, eid(req), b.candidateId ?? '', b.type ?? 'Note', b.title ?? '', b.description ?? '', (req.user as any)?.username ?? ''],
    );
    const row = await pool.query(`SELECT * FROM employer_activity_logs WHERE id = $1`, [id]);
    res.status(201).json({ success: true, activity: toActivity(row.rows[0]) });
  }));

  // ── REFERENCE CHECKS ──────────────────────────────────────────────────────

  app.get('/api/employer/ref-checks/:candidateId', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_ref_checks
        WHERE candidate_id = $1 AND employer_id = $2
        ORDER BY created_at DESC`,
      [req.params.candidateId, eid(req)],
    );
    res.json(rows.rows.map(toRefCheck));
  }));

  app.post('/api/employer/ref-checks', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const id = uid();
    await pool.query(
      `INSERT INTO employer_ref_checks
         (id, employer_id, candidate_id, ref_name, ref_title, ref_company,
          ref_email, ref_phone, relationship, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id, eid(req), b.candidateId ?? '', b.refName ?? '', b.refTitle ?? '',
        b.refCompany ?? '', b.refEmail ?? '', b.refPhone ?? '',
        b.relationship ?? '', b.status ?? 'Pending',
      ],
    );
    const row = await pool.query(`SELECT * FROM employer_ref_checks WHERE id = $1`, [id]);
    res.status(201).json({ success: true, refCheck: toRefCheck(row.rows[0]) });
  }));

  app.put('/api/employer/ref-checks/:id', requireAuth, withSchema(async (req, res) => {
    const b = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, col] of [['status','status'],['outcome','outcome'],['notes','notes']]) {
      if (k in b) { fields.push(`${col} = $${i++}`); vals.push(b[k]); }
    }
    if (!fields.length) return res.json({ success: true });
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, eid(req));
    await pool.query(
      `UPDATE employer_ref_checks SET ${fields.join(', ')} WHERE id = $${i} AND employer_id = $${i + 1}`,
      vals,
    );
    res.json({ success: true });
  }));

  // ── HIRING TEAM (real persisted roster + invite emails) ───────────────────
  // Manages the employer's team-member list and sends real invitation emails.
  // This is a managed roster + invite — it does NOT auto-provision login/RBAC.
  const TEAM_ACCESS = ['Admin', 'Manager', 'Recruiter'];
  const TEAM_STATUS = ['Invited', 'Active', 'Suspended'];
  const trim200 = (v: any) => String(v ?? '').trim().slice(0, 200);
  const toTeamMember = (r: any) => ({
    _id: r.id, name: r.name ?? '', email: r.email ?? '', jobTitle: r.job_title ?? '',
    accessLevel: r.access_level ?? 'Recruiter', status: r.status ?? 'Invited',
    invitedAt: r.invited_at ?? null, createdAt: r.created_at ?? null,
  });

  app.get('/api/employer/team', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT * FROM employer_team_members WHERE employer_id = $1 ORDER BY created_at DESC`,
      [eid(req)],
    );
    res.json(rows.rows.map(toTeamMember));
  }));

  app.post('/api/employer/team', requireAuth, withSchema(async (req, res) => {
    const name = trim200(req.body?.name);
    const email = trim200(req.body?.email).toLowerCase();
    const jobTitle = trim200(req.body?.jobTitle);
    let access = trim200(req.body?.accessLevel) || 'Recruiter';
    if (!TEAM_ACCESS.includes(access)) access = 'Recruiter';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ message: 'A valid email is required' }); return;
    }
    const dup = await pool.query(
      `SELECT id FROM employer_team_members WHERE employer_id = $1 AND lower(email) = $2`,
      [eid(req), email],
    );
    if ((dup.rowCount ?? 0) > 0) { res.status(409).json({ message: 'A team member with this email already exists' }); return; }
    let ins;
    try {
      ins = await pool.query(
        `INSERT INTO employer_team_members (id, employer_id, name, email, job_title, access_level, status, invited_at)
         VALUES ($1,$2,$3,$4,$5,$6,'Invited', now()) RETURNING *`,
        [uid(), eid(req), name, email, jobTitle, access],
      );
    } catch (e: any) {
      // Concurrent duplicate invite that slipped past the SELECT check — honour
      // the UNIQUE(employer_id,email) constraint with a 409 rather than a 500.
      if (e?.code === '23505') { res.status(409).json({ message: 'A team member with this email already exists' }); return; }
      throw e;
    }
    const member = toTeamMember(ins.rows[0]);
    // Real invite email via Zoho (best-effort; honest emailSent flag). Demo
    // (@example.com) addresses are NOT emailed — the roster entry is still real.
    const compRow = await pool.query(
      `SELECT name FROM employer_company_profiles WHERE employer_id = $1`, [eid(req)],
    ).catch(() => ({ rows: [] as any[] }));
    const companyName = compRow.rows[0]?.name || 'our hiring team';
    const inviter = (req.user as any)?.username ?? (req.user as any)?.email ?? '';
    const isDemo = email.endsWith('@example.com');
    let emailSent = false;
    if (!isDemo) {
      emailSent = await sendTeamInviteEmail({
        toEmail: email, memberName: name || 'there', companyName, inviterEmail: inviter, accessLevel: access,
      });
    }
    res.status(201).json({ success: true, member, emailSent, demo: isDemo });
  }));

  app.put('/api/employer/team/:id', requireAuth, withSchema(async (req, res) => {
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    if (req.body?.name !== undefined)        { sets.push(`name = $${i++}`); vals.push(trim200(req.body.name)); }
    if (req.body?.jobTitle !== undefined)    { sets.push(`job_title = $${i++}`); vals.push(trim200(req.body.jobTitle)); }
    if (req.body?.accessLevel !== undefined) { let a = trim200(req.body.accessLevel); if (!TEAM_ACCESS.includes(a)) a = 'Recruiter'; sets.push(`access_level = $${i++}`); vals.push(a); }
    if (req.body?.status !== undefined)      { let s = trim200(req.body.status); if (!TEAM_STATUS.includes(s)) s = 'Invited'; sets.push(`status = $${i++}`); vals.push(s); }
    if (!sets.length) { res.status(400).json({ message: 'No updatable fields provided' }); return; }
    sets.push(`updated_at = now()`);
    vals.push(req.params.id); vals.push(eid(req));
    const upd = await pool.query(
      `UPDATE employer_team_members SET ${sets.join(', ')} WHERE id = $${i++} AND employer_id = $${i} RETURNING *`,
      vals,
    );
    if (!upd.rowCount) { res.status(404).json({ message: 'Team member not found' }); return; }
    res.json({ success: true, member: toTeamMember(upd.rows[0]) });
  }));

  app.delete('/api/employer/team/:id', requireAuth, withSchema(async (req, res) => {
    const del = await pool.query(
      `DELETE FROM employer_team_members WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    res.json({ success: true, deleted: del.rowCount ?? 0 });
  }));

  // ── TALENT POOL OUTREACH (real re-engagement emails + append-only log) ─────
  // Literal /pool/outreach is registered before any candidate :id handlers below.
  app.get('/api/employer/pool/outreach', requireAuth, withSchema(async (req, res) => {
    const rows = await pool.query(
      `SELECT candidate_id, max(sent_at) AS last_sent_at, count(*)::int AS cnt
         FROM employer_pool_outreach
        WHERE employer_id = $1 AND status = 'sent'
        GROUP BY candidate_id`,
      [eid(req)],
    );
    // Only successfully-delivered rows count as "contacted" (outbox: pending/failed excluded).
    res.json(rows.rows.map((r: any) => ({ candidateId: r.candidate_id, lastSentAt: r.last_sent_at, count: r.cnt })));
  }));

  app.post('/api/employer/candidates/:id/outreach', requireAuth, withSchema(async (req, res) => {
    const cand = await pool.query(
      `SELECT id, name, email FROM employer_candidates WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!cand.rowCount) { res.status(404).json({ message: 'Candidate not found' }); return; }
    const c = cand.rows[0];
    const email = String(c.email ?? '').trim().toLowerCase();
    if (!email) { res.status(400).json({ message: 'Candidate has no email on file' }); return; }
    const subject = trim200(req.body?.subject) || 'An opportunity for you';
    const message = String(req.body?.message ?? '').trim().slice(0, 4000);
    if (!message) { res.status(400).json({ message: 'A message is required' }); return; }
    const compRow = await pool.query(
      `SELECT name FROM employer_company_profiles WHERE employer_id = $1`, [eid(req)],
    ).catch(() => ({ rows: [] as any[] }));
    const companyName = compRow.rows[0]?.name || 'A company on MetryxOne';
    const isDemo = email.endsWith('@example.com');
    // Demo addresses bounce — do not send and do not log a delivery we didn't make.
    if (isDemo) { res.json({ success: true, demo: true, sentAt: null }); return; }
    // Outbox pattern: persist a 'pending' row BEFORE sending so a post-send DB
    // failure can never make a delivered email look unsent (which would invite a
    // duplicate re-send). Resolve to 'sent'/'failed' after the SMTP result.
    const rowId = uid();
    await pool.query(
      `INSERT INTO employer_pool_outreach (id, employer_id, candidate_id, subject, body, status)
       VALUES ($1,$2,$3,$4,$5,'pending')`,
      [rowId, eid(req), c.id, subject, message],
    );
    const sent = await sendTalentOutreachEmail({ toEmail: email, candidateName: c.name || 'there', companyName, subject, message });
    if (!sent) {
      await pool.query(`UPDATE employer_pool_outreach SET status = 'failed' WHERE id = $1`, [rowId]).catch(() => {});
      res.status(502).json({ success: false, message: 'email_failed' }); return;
    }
    const upd = await pool.query(
      `UPDATE employer_pool_outreach SET status = 'sent', sent_at = now() WHERE id = $1 RETURNING sent_at`,
      [rowId],
    );
    res.status(201).json({ success: true, sentAt: upd.rows[0]?.sent_at ?? new Date().toISOString(), demo: false });
  }));

  // ── INTELLIGENCE ENDPOINT (8 domains) ────────────────────────────────────

  app.get('/api/employer/candidates/:id/intelligence', requireAuth, withSchema(async (req, res) => {
    const row = await pool.query(
      `SELECT id, email, job_id, name, skills, experience, education,
              stage, match_score, ei_score, assessment_score
         FROM employer_candidates
        WHERE id = $1 AND employer_id = $2`,
      [req.params.id, eid(req)],
    );
    if (!row.rows.length) return res.status(404).json({ message: 'Candidate not found' });
    const intel = await buildCandidateIntelligence(pool, row.rows[0]);
    res.json(intel);
  }));

  // ── WORKFORCE INTELLIGENCE (aggregate) ────────────────────────────────────

  app.get('/api/employer/workforce-intelligence', requireAuth, withSchema(async (req, res) => {
    const empId = eid(req);
    const [cands, jobs] = await Promise.all([
      pool.query(
        `SELECT stage, ei_score, match_score, source, experience, skills
           FROM employer_candidates WHERE employer_id = $1`,
        [empId],
      ),
      pool.query(
        `SELECT status, department, location FROM employer_jobs WHERE employer_id = $1`,
        [empId],
      ),
    ]);
    const cs = cands.rows;
    const eiScores = cs.map(c => Number(c.ei_score)).filter(n => Number.isFinite(n) && n > 0);
    const matchScores = cs.map(c => Number(c.match_score)).filter(n => Number.isFinite(n) && n > 0);
    const experienceBreakdown: Record<string, number> = {};
    for (const c of cs) { const e = c.experience || 'Unknown'; experienceBreakdown[e] = (experienceBreakdown[e] ?? 0) + 1; }
    const departmentBreakdown: Record<string, number> = {};
    for (const j of jobs.rows) { const d = j.department || 'Unknown'; departmentBreakdown[d] = (departmentBreakdown[d] ?? 0) + 1; }
    res.json({
      domain: 'workforce_intelligence',
      totalCandidates: cs.length,
      totalJobs: jobs.rows.length,
      avgEIScore: eiScores.length ? Math.round(eiScores.reduce((a, b) => a + b, 0) / eiScores.length) : null,
      avgMatchScore: matchScores.length ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length) : null,
      experienceBreakdown, departmentBreakdown,
      eiScoreDistribution: {
        high: eiScores.filter(s => s >= 70).length,
        medium: eiScores.filter(s => s >= 40 && s < 70).length,
        low: eiScores.filter(s => s < 40).length,
      },
      confidence: cs.length > 0 ? 'data_driven' : 'no_data',
      generatedAt: new Date().toISOString(),
    });
  }));

  // Boot-time schema init — fire-and-forget so first auth'd request isn't slow
  setImmediate(() => ensureSchema(pool).catch(e =>
    console.warn('[employer-portal] schema init warning:', e?.message)
  ));

  console.log('[employer-portal] routes registered (EP-98)');
}
