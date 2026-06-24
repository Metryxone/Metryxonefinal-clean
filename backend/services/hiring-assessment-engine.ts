/**
 * PHASE 5.7 — Assessment-Led Hiring (services).
 *
 * hiring_assessment_engine — supports the assessment-led hiring lifecycle over
 * the employer substrate, COMPOSING what already exists rather than re-scoring:
 *
 *   Invitations  — createAssessmentInvite: issue a tokenised invite to an
 *                  employer candidate for a job (assessment_invites row).
 *   Completion   — recordAssessmentCompletion: mark an invite completed and LINK
 *                  it to an existing score source (a competency score run or a
 *                  CAPADEX session). Never fabricates a score.
 *   Validation   — validateAssessment: is the candidate's assessment for this job
 *                  invited / completed / scored / expired? Dual-source (an invite
 *                  row OR a recorded employer_candidates.assessment_score).
 *   Scoring      — scoreAssessment: COMPOSE one assessment score from the best
 *                  available source (linked score run → recorded score →
 *                  competency_profile proxy → unmeasured), with separate Coverage
 *                  and Confidence axes. The raw competency math is NOT recomputed.
 *   Comparison   — compareAssessments: score N candidates side-by-side for a job.
 *   Ranking      — rankCandidates: order a job's candidates by composed assessment
 *                  evidence (measured first; unmeasured never scored 0, ranked
 *                  last). snapshotRanking persists a candidate_ranking run.
 *
 * Design contract (mirrors the program):
 *   - Additive + flag-gated (`hiringAssessment`). The two net-new tables
 *     (assessment_invites, candidate_ranking) are created by a lazy
 *     ensureHiringAssessmentSchema() that runs ONLY on the POST/write path. GET
 *     reads use a to_regclass probe and degrade — they NEVER run DDL.
 *   - compose-never-recompute: the assessment SCORE is read/derived from existing
 *     substrate; this engine never re-implements competency scoring.
 *   - never-throws: every op returns a typed EngineResult; reads degrade to honest
 *     empty/zeroed/unmeasured results. Absent evidence is reported, never assumed.
 *   - Honesty: Coverage (is there evidence) and Confidence (how trustworthy) are
 *     SEPARATE axes. unmeasured is unmeasured — never silently coerced to 0. A
 *     ranking is a DEVELOPMENTAL ordering by assessment evidence, NOT a hire /
 *     suitability verdict.
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { resolveJob } from './job-store-resolver.js';

export const HIRING_ASSESSMENT_ENGINE_VERSION = '5.7.0';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input' | 'conflict', message: string): EngineResult =>
  ({ ok: false, code, message });

const r1 = (n: number) => Math.round(n * 10) / 10;

// ── honesty helpers ─────────────────────────────────────────────────────────
// Coerce a value to a finite number or null. Critically, null/undefined/'' must
// stay null (NOT become 0) — a fabricated 0 would flip "unmeasured" to "measured".
function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 0..100 developmental band (consistent with the platform's score bands).
function band(score: number | null): string {
  if (score == null) return 'Unmeasured';
  if (score >= 80) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

// Confidence band from a 0..1 trust factor.
function confidenceBand(trust: number | null): string {
  if (trust == null) return 'None';
  if (trust >= 0.75) return 'High';
  if (trust >= 0.45) return 'Moderate';
  if (trust > 0) return 'Low';
  return 'None';
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

// ── lazy ensure-schema (WRITE PATH ONLY — never reached from a GET) ──────────
let schemaReady = false;
export async function ensureHiringAssessmentSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_invites (
      id                 TEXT PRIMARY KEY,
      employer_id        TEXT,
      job_id             TEXT NOT NULL,
      candidate_id       TEXT NOT NULL,
      candidate_email    TEXT,
      token              TEXT NOT NULL,
      assessment_id      TEXT,
      status             TEXT NOT NULL DEFAULT 'invited'
                           CHECK (status IN ('invited','in_progress','completed','expired','cancelled')),
      invited_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at       TIMESTAMPTZ,
      expires_at         TIMESTAMPTZ,
      score_run_id       UUID,
      capadex_session_id UUID,
      metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_invites_token     ON assessment_invites (token);`);
  await pool.query(`CREATE INDEX        IF NOT EXISTS idx_assessment_invites_job       ON assessment_invites (job_id);`);
  await pool.query(`CREATE INDEX        IF NOT EXISTS idx_assessment_invites_candidate ON assessment_invites (candidate_id);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidate_ranking (
      id               BIGSERIAL PRIMARY KEY,
      run_id           TEXT NOT NULL,
      job_id           TEXT NOT NULL,
      candidate_id     TEXT NOT NULL,
      candidate_name   TEXT,
      rank             INTEGER NOT NULL,
      measurable       BOOLEAN NOT NULL DEFAULT false,
      assessment_score NUMERIC,
      composite_score  NUMERIC,
      band             TEXT,
      coverage_pct     NUMERIC,
      confidence_band  TEXT,
      score_source     TEXT,
      detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
      snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_candidate_ranking_job ON candidate_ranking (job_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_candidate_ranking_run ON candidate_ranking (run_id);`);
  schemaReady = true;
}

// ── substrate reads (read-only, never-throws) ───────────────────────────────
interface JobRow { id: string; employer_id: string | null; title: string | null; status: string | null; }
interface CandidateRow {
  id: string;
  employer_id: string | null;
  job_id: string | null;
  name: string | null;
  email: string | null;
  ei_score: number | null;
  assessment_score: number | null;
  competency_profile: any;
  capadex_session_id: string | null;
}

// Resolve a job from EITHER store (employer_jobs first, then job_postings) so a
// job posted via the job-posting engine is visible to the assessment stage. See
// job-store-resolver.ts for the split-store rationale.
async function readJob(pool: Pool, id: string): Promise<JobRow | null> {
  return resolveJob(pool, id);
}

const CANDIDATE_COLS =
  `id, employer_id, job_id, name, email, ei_score, assessment_score, competency_profile, capadex_session_id`;

// Job-membership guard. A candidate belongs to a job when its job_id matches, or
// when job_id is null (candidate not bound to a specific job). Enforced on EVERY
// "for this job" operation so a candidate's evidence can never be scored,
// validated, or compared against the wrong job.
function candidateInJob(candidate: CandidateRow, jobId: string): boolean {
  return candidate.job_id == null || String(candidate.job_id) === jobId;
}

async function readCandidate(pool: Pool, id: string): Promise<CandidateRow | null> {
  if (!(await relExists(pool, 'employer_candidates'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT ${CANDIDATE_COLS} FROM employer_candidates WHERE id = $1`, [id],
    );
    return rows[0] ?? null;
  } catch { return null; }
}

async function listCandidatesForJob(pool: Pool, jobId: string, limit: number): Promise<CandidateRow[]> {
  if (!(await relExists(pool, 'employer_candidates'))) return [];
  try {
    const { rows } = await pool.query(
      `SELECT ${CANDIDATE_COLS} FROM employer_candidates
         WHERE job_id = $1
         ORDER BY created_at DESC NULLS LAST
         LIMIT $2`,
      [jobId, Math.max(1, Math.min(500, limit))],
    );
    return rows;
  } catch { return []; }
}

// competency_profile (jsonb) → average proficiency level (0..5) → 0..100 proxy.
function competencyProfileProxy(raw: any): { score: number | null; n: number } {
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { return { score: null, n: 0 }; } }
  if (!obj || typeof obj !== 'object') return { score: null, n: 0 };
  const levels: number[] = [];
  const take = (v: unknown) => {
    const n = num(v);
    if (n == null) return;
    levels.push(n > 5 ? Math.max(0, Math.min(100, n)) / 20 : Math.max(0, Math.min(5, n)));
  };
  if (Array.isArray(obj)) {
    for (const e of obj) {
      if (e && typeof e === 'object') take((e as any).level ?? (e as any).score ?? (e as any).proficiency ?? (e as any).value ?? (e as any).rating);
    }
  } else {
    for (const v of Object.values(obj)) {
      if (v != null && typeof v === 'object') take((v as any).level ?? (v as any).score ?? (v as any).value);
      else take(v);
    }
  }
  if (levels.length === 0) return { score: null, n: 0 };
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  return { score: r1((avg / 5) * 100), n: levels.length };
}

// Read a completed invite's linked competency score run overall (0..100), tolerant
// of the overall JSONB shape. Read-only; never throws.
async function readScoreRunOverall(pool: Pool, runId: string): Promise<number | null> {
  if (!runId || !(await relExists(pool, 'onto_competency_score_runs'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT overall FROM onto_competency_score_runs WHERE id = $1`, [runId],
    );
    if (!rows[0]) return null;
    let o = rows[0].overall;
    if (typeof o === 'string') { try { o = JSON.parse(o); } catch { return null; } }
    if (o == null) return null;
    if (typeof o === 'number') return num(o);
    if (typeof o === 'object') {
      return num(o.score ?? o.overall ?? o.percentage ?? o.percent ?? o.value);
    }
    return null;
  } catch { return null; }
}

// ── invites (read-only) ─────────────────────────────────────────────────────
export interface InviteRow {
  id: string; employer_id: string | null; job_id: string; candidate_id: string;
  candidate_email: string | null; token: string; assessment_id: string | null;
  status: string; invited_at: string; completed_at: string | null; expires_at: string | null;
  score_run_id: string | null; capadex_session_id: string | null; metadata: any;
}

const INVITE_COLS =
  `id, employer_id, job_id, candidate_id, candidate_email, token, assessment_id, status,
   invited_at, completed_at, expires_at, score_run_id, capadex_session_id, metadata`;

async function readInviteById(pool: Pool, id: string): Promise<InviteRow | null> {
  if (!(await relExists(pool, 'assessment_invites'))) return null;
  try {
    const { rows } = await pool.query(`SELECT ${INVITE_COLS} FROM assessment_invites WHERE id = $1`, [id]);
    return rows[0] ?? null;
  } catch { return null; }
}

async function readInviteByToken(pool: Pool, token: string): Promise<InviteRow | null> {
  if (!(await relExists(pool, 'assessment_invites'))) return null;
  try {
    const { rows } = await pool.query(`SELECT ${INVITE_COLS} FROM assessment_invites WHERE token = $1`, [token]);
    return rows[0] ?? null;
  } catch { return null; }
}

// Latest invite for a candidate+job (validation / scoring lookups). Read-only.
async function readLatestInvite(pool: Pool, jobId: string, candidateId: string): Promise<InviteRow | null> {
  if (!(await relExists(pool, 'assessment_invites'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT ${INVITE_COLS} FROM assessment_invites
         WHERE job_id = $1 AND candidate_id = $2
         ORDER BY invited_at DESC LIMIT 1`,
      [jobId, candidateId],
    );
    return rows[0] ?? null;
  } catch { return null; }
}

export async function getInvite(pool: Pool, inviteId: string): Promise<EngineResult<InviteRow>> {
  const id = String(inviteId ?? '').trim();
  if (!id) return err('invalid_input', 'invite id is required');
  const row = await readInviteById(pool, id);
  return row ? ok(row) : err('not_found', `invite ${id} not found`);
}

export async function getInviteByToken(pool: Pool, token: string): Promise<EngineResult<InviteRow>> {
  const t = String(token ?? '').trim();
  if (!t) return err('invalid_input', 'token is required');
  const row = await readInviteByToken(pool, t);
  return row ? ok(row) : err('not_found', `invite token not found`);
}

export async function listInvitesForJob(
  pool: Pool, jobId: string,
): Promise<EngineResult<{ job_id: string; job_title: string | null; invites: InviteRow[] }>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);
  let invites: InviteRow[] = [];
  if (await relExists(pool, 'assessment_invites')) {
    try {
      const { rows } = await pool.query(
        `SELECT ${INVITE_COLS} FROM assessment_invites WHERE job_id = $1 ORDER BY invited_at DESC`, [jid],
      );
      invites = rows;
    } catch { invites = []; }
  }
  return ok({ job_id: job.id, job_title: job.title, invites });
}

// ── Invitations (WRITE) ─────────────────────────────────────────────────────
export async function createAssessmentInvite(
  pool: Pool,
  input: { jobId: string; candidateId: string; assessmentId?: string | null; candidateEmail?: string | null; expiresInDays?: number | null },
): Promise<EngineResult<InviteRow>> {
  const jid = String(input.jobId ?? '').trim();
  const cid = String(input.candidateId ?? '').trim();
  if (!jid) return err('invalid_input', 'jobId is required');
  if (!cid) return err('invalid_input', 'candidateId is required');

  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);
  const candidate = await readCandidate(pool, cid);
  if (!candidate) return err('not_found', `candidate ${cid} not found`);
  // Candidate must belong to the job (honesty: never invite across jobs silently).
  if (candidate.job_id != null && String(candidate.job_id) !== jid) {
    return err('invalid_input', `candidate ${cid} is not attached to job ${jid}`);
  }

  await ensureHiringAssessmentSchema(pool);

  const id = randomUUID();
  const token = randomUUID().replace(/-/g, '');
  const days = num(input.expiresInDays);
  const email = (input.candidateEmail ?? candidate.email) || null;
  const assessmentId = input.assessmentId != null ? String(input.assessmentId) : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO assessment_invites
         (id, employer_id, job_id, candidate_id, candidate_email, token, assessment_id, status,
          expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'invited',
          CASE WHEN $8::numeric IS NULL THEN NULL ELSE now() + ($8::numeric * INTERVAL '1 day') END)
       RETURNING ${INVITE_COLS}`,
      [id, job.employer_id ?? candidate.employer_id ?? null, jid, cid, email, token, assessmentId, days],
    );
    return ok(rows[0]);
  } catch (e: any) {
    return err('invalid_input', `failed to create invite: ${String(e?.message ?? e)}`);
  }
}

// ── Completion (WRITE) ──────────────────────────────────────────────────────
export async function recordAssessmentCompletion(
  pool: Pool,
  inviteId: string,
  input: { scoreRunId?: string | null; capadexSessionId?: string | null } = {},
): Promise<EngineResult<InviteRow>> {
  const id = String(inviteId ?? '').trim();
  if (!id) return err('invalid_input', 'invite id is required');

  await ensureHiringAssessmentSchema(pool);
  const existing = await readInviteById(pool, id);
  if (!existing) return err('not_found', `invite ${id} not found`);
  if (existing.status === 'cancelled' || existing.status === 'expired') {
    return err('conflict', `invite ${id} is ${existing.status} and cannot be completed`);
  }

  const scoreRunId = input.scoreRunId != null && String(input.scoreRunId).trim() ? String(input.scoreRunId).trim() : null;
  const capadexSessionId = input.capadexSessionId != null && String(input.capadexSessionId).trim() ? String(input.capadexSessionId).trim() : null;

  try {
    const { rows } = await pool.query(
      `UPDATE assessment_invites
          SET status = 'completed',
              completed_at = now(),
              score_run_id = COALESCE($2::uuid, score_run_id),
              capadex_session_id = COALESCE($3::uuid, capadex_session_id),
              updated_at = now()
        WHERE id = $1
        RETURNING ${INVITE_COLS}`,
      [id, scoreRunId, capadexSessionId],
    );
    return ok(rows[0]);
  } catch (e: any) {
    return err('invalid_input', `failed to record completion: ${String(e?.message ?? e)}`);
  }
}

// ── Validation (read-only) ──────────────────────────────────────────────────
export interface ValidationResult {
  job_id: string;
  candidate_id: string;
  candidate_name: string | null;
  valid: boolean;                 // assessment evidence exists and is usable
  status: 'not_invited' | 'invited' | 'in_progress' | 'completed' | 'expired' | 'cancelled' | 'scored_no_invite';
  has_invite: boolean;
  has_score: boolean;             // a usable score source exists
  expired: boolean;
  invite_id: string | null;
  reasons: string[];
}

function isExpired(inv: InviteRow | null): boolean {
  if (!inv?.expires_at) return false;
  const t = new Date(inv.expires_at).getTime();
  return Number.isFinite(t) && t < Date.now();
}

export async function validateAssessment(
  pool: Pool, jobId: string, candidateId: string,
): Promise<EngineResult<ValidationResult>> {
  const jid = String(jobId ?? '').trim();
  const cid = String(candidateId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  if (!cid) return err('invalid_input', 'candidate id is required');

  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);
  const candidate = await readCandidate(pool, cid);
  if (!candidate) return err('not_found', `candidate ${cid} not found`);
  if (!candidateInJob(candidate, jid)) return err('invalid_input', `candidate ${cid} is not attached to job ${jid}`);

  const invite = await readLatestInvite(pool, jid, cid);
  const recordedScore = num(candidate.assessment_score);
  const expired = isExpired(invite);
  const reasons: string[] = [];

  // A usable score source: a completed invite linked to a run, OR a recorded
  // employer_candidates.assessment_score (the employer-portal flow records this).
  const linkedScore = invite?.score_run_id ? await readScoreRunOverall(pool, invite.score_run_id) : null;
  const hasScore = linkedScore != null || recordedScore != null;

  let status: ValidationResult['status'];
  let valid = false;

  if (!invite) {
    if (recordedScore != null) {
      status = 'scored_no_invite';
      valid = true;
      reasons.push('A recorded assessment score exists for this candidate but there is no invite record in this engine (assessment likely issued via the employer portal flow).');
    } else {
      status = 'not_invited';
      reasons.push('No assessment invite has been issued for this candidate on this job, and no recorded assessment score exists.');
    }
  } else if (invite.status === 'cancelled') {
    status = 'cancelled';
    reasons.push('The assessment invite was cancelled.');
  } else if (expired && invite.status !== 'completed') {
    status = 'expired';
    reasons.push('The assessment invite has expired before completion.');
  } else if (invite.status === 'completed') {
    status = 'completed';
    if (hasScore) {
      valid = true;
      reasons.push('Invite completed and a usable assessment score source is present.');
    } else {
      reasons.push('Invite is marked completed but no usable score source is linked yet — completion without a score is not a valid (scorable) assessment.');
    }
  } else if (invite.status === 'in_progress') {
    status = 'in_progress';
    reasons.push('The assessment is in progress and not yet completed.');
  } else {
    status = 'invited';
    reasons.push('The candidate has been invited but has not completed the assessment.');
  }

  return ok({
    job_id: jid,
    candidate_id: cid,
    candidate_name: candidate.name,
    valid,
    status,
    has_invite: invite != null,
    has_score: hasScore,
    expired,
    invite_id: invite?.id ?? null,
    reasons,
  });
}

// ── Scoring (read-only, compose-never-recompute) ────────────────────────────
export type ScoreSource = 'competency_score_run' | 'recorded_score' | 'competency_profile_proxy' | 'unmeasured';

// Source trust drives Confidence — it is NOT the score. A measured run is fully
// trusted; a recorded score is trusted-but-opaque; a profile proxy is a
// conservative inference; unmeasured carries no trust.
const SOURCE_TRUST: Record<ScoreSource, number> = {
  competency_score_run: 1.0,
  recorded_score: 0.8,
  competency_profile_proxy: 0.4,
  unmeasured: 0,
};

export interface AssessmentScore {
  job_id: string;
  candidate_id: string;
  candidate_name: string | null;
  measurable: boolean;             // a usable score source exists
  assessment_score: number | null; // 0..100, null when unmeasured (NEVER 0-coerced)
  band: string;
  score_source: ScoreSource;
  // Coverage = is there assessment evidence at all (binary, as %). Confidence =
  // how trustworthy that evidence is. SEPARATE axes — never composited.
  coverage_pct: number;
  confidence: number | null;       // 0..100
  confidence_band: string;
  supporting: { ei_score: number | null };
  notes: string[];
}

async function composeScore(pool: Pool, jobId: string, candidate: CandidateRow): Promise<AssessmentScore> {
  const invite = await readLatestInvite(pool, jobId, candidate.id);
  const notes: string[] = [];

  let score: number | null = null;
  let source: ScoreSource = 'unmeasured';

  // 1) a completed invite linked to a competency score run (most trustworthy).
  if (invite?.score_run_id) {
    const runScore = await readScoreRunOverall(pool, invite.score_run_id);
    if (runScore != null) { score = r1(Math.max(0, Math.min(100, runScore))); source = 'competency_score_run'; }
  }
  // 2) a recorded employer_candidates.assessment_score.
  if (score == null) {
    const recorded = num(candidate.assessment_score);
    if (recorded != null) { score = r1(Math.max(0, Math.min(100, recorded))); source = 'recorded_score'; }
  }
  // 3) a conservative proxy from the candidate's competency_profile.
  if (score == null) {
    const proxy = competencyProfileProxy(candidate.competency_profile);
    if (proxy.score != null) {
      score = proxy.score; source = 'competency_profile_proxy';
      notes.push(`No assessment result on record — score is a CONSERVATIVE proxy from ${proxy.n} competency-profile level(s), not a completed assessment. Treat as low-confidence.`);
    }
  }
  // 4) unmeasured.
  if (score == null) {
    notes.push('No assessment evidence — no linked score run, no recorded score, and no competency profile. Reported as unmeasured (NOT scored 0).');
  }

  const measurable = score != null;
  const trust = SOURCE_TRUST[source];
  const confidence = measurable ? r1(trust * 100) : null;

  if (source === 'recorded_score') notes.push('Score is a recorded assessment result; the underlying per-competency breakdown is not re-derived here (composed, not recomputed).');
  if (source === 'competency_score_run') notes.push('Score is composed from a linked competency score run (measured).');
  notes.push('Coverage (evidence exists) and Confidence (evidence trustworthiness) are separate axes; this is a developmental assessment signal, not a hiring verdict.');

  return {
    job_id: jobId,
    candidate_id: candidate.id,
    candidate_name: candidate.name,
    measurable,
    assessment_score: score,
    band: band(score),
    score_source: source,
    coverage_pct: measurable ? 100 : 0,
    confidence,
    confidence_band: confidenceBand(measurable ? trust : null),
    supporting: { ei_score: num(candidate.ei_score) },
    notes,
  };
}

export async function scoreAssessment(
  pool: Pool, jobId: string, candidateId: string,
): Promise<EngineResult<AssessmentScore>> {
  const jid = String(jobId ?? '').trim();
  const cid = String(candidateId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  if (!cid) return err('invalid_input', 'candidate id is required');
  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);
  const candidate = await readCandidate(pool, cid);
  if (!candidate) return err('not_found', `candidate ${cid} not found`);
  if (!candidateInJob(candidate, jid)) return err('invalid_input', `candidate ${cid} is not attached to job ${jid}`);
  return ok(await composeScore(pool, jid, candidate));
}

// ── Comparison (read-only) ──────────────────────────────────────────────────
export interface ComparisonResult {
  job_id: string;
  job_title: string | null;
  candidates: AssessmentScore[];
  leaders: { by_assessment_score: string | null; by_confidence: string | null };
  measured_count: number;
  unmeasured_count: number;
  notes: string[];
}

export async function compareAssessments(
  pool: Pool, jobId: string, candidateIds: string[],
): Promise<EngineResult<ComparisonResult>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  const ids = Array.from(new Set((candidateIds ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)));
  if (ids.length < 2) return err('invalid_input', 'at least two candidate ids are required for comparison');

  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);

  const scored: AssessmentScore[] = [];
  const missing: string[] = [];
  const wrongJob: string[] = [];
  for (const cid of ids) {
    const candidate = await readCandidate(pool, cid);
    if (!candidate) { missing.push(cid); continue; }
    if (!candidateInJob(candidate, jid)) { wrongJob.push(cid); continue; }
    scored.push(await composeScore(pool, jid, candidate));
  }
  if (scored.length < 2) {
    const why = [
      missing.length ? `${missing.join(', ')} not found` : '',
      wrongJob.length ? `${wrongJob.join(', ')} not attached to job ${jid}` : '',
    ].filter(Boolean).join('; ');
    return err('not_found', `fewer than two comparable candidates for job ${jid}${why ? ` (${why})` : ''}`);
  }

  const measured = scored.filter((s) => s.measurable);
  const leaderScore = measured.slice().sort((a, b) => (b.assessment_score ?? -1) - (a.assessment_score ?? -1))[0];
  const leaderConf = measured.slice().sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1))[0];

  const notes: string[] = [
    'Comparison is across composed developmental assessment signals; unmeasured candidates are shown as unmeasured (never scored 0) and excluded from "leaders".',
  ];
  if (missing.length) notes.push(`${missing.length} requested candidate id(s) were not found and are omitted: ${missing.join(', ')}.`);

  return ok({
    job_id: job.id,
    job_title: job.title,
    candidates: scored,
    leaders: {
      by_assessment_score: leaderScore?.candidate_id ?? null,
      by_confidence: leaderConf?.candidate_id ?? null,
    },
    measured_count: measured.length,
    unmeasured_count: scored.length - measured.length,
    notes,
  });
}

// ── Ranking (read-only) ─────────────────────────────────────────────────────
export interface RankedCandidate {
  rank: number;
  candidate_id: string;
  candidate_name: string | null;
  measurable: boolean;
  assessment_score: number | null;
  composite_score: number | null;  // assessment + small EI tiebreak contribution
  band: string;
  coverage_pct: number;
  confidence: number | null;
  confidence_band: string;
  score_source: ScoreSource;
}

export interface RankingResult {
  job_id: string;
  job_title: string | null;
  total_candidates: number;
  measured_count: number;
  unmeasured_count: number;
  ranking: RankedCandidate[];
  notes: string[];
}

// Composite = assessment score, with EI as a SMALL deterministic tiebreak nudge
// (does not invent a score; null assessment stays null composite → unmeasured).
function composite(s: AssessmentScore): number | null {
  if (s.assessment_score == null) return null;
  const ei = s.supporting.ei_score;
  const eiNudge = ei == null ? 0 : ((Math.max(0, Math.min(100, ei)) - 50) / 50) * 2; // ±2
  return r1(Math.max(0, Math.min(100, s.assessment_score + eiNudge)));
}

function rankSort(a: { measurable: boolean; composite_score: number | null; confidence: number | null }, b: typeof a): number {
  if (a.measurable !== b.measurable) return a.measurable ? -1 : 1; // measured first
  return (b.composite_score ?? -1) - (a.composite_score ?? -1)
      || (b.confidence ?? -1) - (a.confidence ?? -1);
}

async function buildRanking(pool: Pool, job: JobRow, limit: number): Promise<RankingResult> {
  const candidates = await listCandidatesForJob(pool, job.id, limit);
  const scored: { s: AssessmentScore; composite: number | null }[] = [];
  for (const c of candidates) {
    const s = await composeScore(pool, job.id, c);
    scored.push({ s, composite: composite(s) });
  }
  scored.sort((x, y) => rankSort(
    { measurable: x.s.measurable, composite_score: x.composite, confidence: x.s.confidence },
    { measurable: y.s.measurable, composite_score: y.composite, confidence: y.s.confidence },
  ));

  const ranking: RankedCandidate[] = scored.map((row, i) => ({
    rank: i + 1,
    candidate_id: row.s.candidate_id,
    candidate_name: row.s.candidate_name,
    measurable: row.s.measurable,
    assessment_score: row.s.assessment_score,
    composite_score: row.composite,
    band: row.s.band,
    coverage_pct: row.s.coverage_pct,
    confidence: row.s.confidence,
    confidence_band: row.s.confidence_band,
    score_source: row.s.score_source,
  }));

  const measured = ranking.filter((r) => r.measurable).length;
  return {
    job_id: job.id,
    job_title: job.title,
    total_candidates: ranking.length,
    measured_count: measured,
    unmeasured_count: ranking.length - measured,
    ranking,
    notes: [
      'Ranking orders candidates by composed assessment evidence (measured candidates first; unmeasured are ranked last and never scored 0).',
      'This is a DEVELOPMENTAL assessment ranking — it is NOT a recommendation to hire, reject, or rank suitability.',
      'Composite applies a small (±2) EI tiebreak nudge only when an assessment score exists; it never invents a score.',
    ],
  };
}

export async function rankCandidates(
  pool: Pool, jobId: string, opts: { limit?: number } = {},
): Promise<EngineResult<RankingResult>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);
  return ok(await buildRanking(pool, job, opts.limit ?? 200));
}

// ── Ranking snapshot (WRITE) ────────────────────────────────────────────────
export interface SnapshotResult { run_id: string; job_id: string; rows: number; ranking: RankingResult; }

export async function snapshotRanking(
  pool: Pool, jobId: string, opts: { limit?: number } = {},
): Promise<EngineResult<SnapshotResult>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);

  await ensureHiringAssessmentSchema(pool);
  const ranking = await buildRanking(pool, job, opts.limit ?? 200);
  const runId = randomUUID();

  try {
    for (const r of ranking.ranking) {
      await pool.query(
        `INSERT INTO candidate_ranking
           (run_id, job_id, candidate_id, candidate_name, rank, measurable,
            assessment_score, composite_score, band, coverage_pct, confidence_band, score_source, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
        [
          runId, jid, r.candidate_id, r.candidate_name, r.rank, r.measurable,
          r.assessment_score, r.composite_score, r.band, r.coverage_pct, r.confidence_band, r.score_source,
          JSON.stringify({ confidence: r.confidence }),
        ],
      );
    }
  } catch (e: any) {
    return err('invalid_input', `failed to persist ranking snapshot: ${String(e?.message ?? e)}`);
  }

  return ok({ run_id: runId, job_id: jid, rows: ranking.ranking.length, ranking });
}

export interface RankingSnapshotRow {
  id: string; run_id: string; job_id: string; candidate_id: string; candidate_name: string | null;
  rank: number; measurable: boolean; assessment_score: number | null; composite_score: number | null;
  band: string | null; coverage_pct: number | null; confidence_band: string | null; score_source: string | null;
  detail: any; snapshot_at: string;
}

export async function listRankingSnapshots(
  pool: Pool, jobId: string, opts: { runId?: string } = {},
): Promise<EngineResult<{ job_id: string; run_id: string | null; rows: RankingSnapshotRow[] }>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');
  const job = await readJob(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);

  if (!(await relExists(pool, 'candidate_ranking'))) {
    return ok({ job_id: jid, run_id: opts.runId ?? null, rows: [] });
  }
  try {
    const params: any[] = [jid];
    let where = `job_id = $1`;
    if (opts.runId) { params.push(opts.runId); where += ` AND run_id = $2`; }
    const { rows } = await pool.query(
      `SELECT id, run_id, job_id, candidate_id, candidate_name, rank, measurable,
              assessment_score, composite_score, band, coverage_pct, confidence_band, score_source, detail, snapshot_at
         FROM candidate_ranking
        WHERE ${where}
        ORDER BY snapshot_at DESC, rank ASC`,
      params,
    );
    return ok({ job_id: jid, run_id: opts.runId ?? null, rows });
  } catch {
    return ok({ job_id: jid, run_id: opts.runId ?? null, rows: [] });
  }
}
