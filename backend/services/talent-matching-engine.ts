/**
 * PHASE 5.5 — Competency Matching Engine (services).
 *
 * Core matching logic: a candidate's competencies vs a role's required
 * competencies → five separately-defined axes:
 *
 *   Match %      — BREADTH: weighted share of the role's required competencies
 *                  the candidate has ANY evidence for (regardless of level).
 *   Readiness %  — DEPTH over ASSESSED weight: weighted attainment across the
 *                  competencies that actually have evidence.
 *   Fit %        — DEPTH over the WHOLE role: weighted attainment over the full
 *                  role weight (unassessed competencies contribute 0). The
 *                  fit BAND is critical-capped (an unmet critical competency can
 *                  never read as a Strong/Good fit).
 *   Gap %        — weighted shortfall over the whole role (100 − Fit raw).
 *   Confidence % — TRUST: how much of the score rests on real, level-bearing
 *                  evidence (measured > inferred-from-keywords > none), scaled
 *                  by role-profile completeness.
 *
 * Four deliverable engines (all pure / read-only / never-fabricating):
 *   - talent_matching_engine     → matchCandidateToRole + ranking orchestrators.
 *   - fit_engine                 → computeFit (composes the canonical readiness).
 *   - gap_engine                 → computeGapBreakdown.
 *   - match_explanation_engine   → explainMatch (per-competency + headline notes).
 *
 * Design contract (mirrors the program):
 *   - COMPOSE-never-recompute: the weighted attainment / blocking-gap / roleFit
 *     math is the canonical getRoleReadiness() in role-competency-profile.ts.
 *     This engine resolves the candidate's `actuals` map and DERIVES the five
 *     axes from that single composed result — it never re-implements the math.
 *   - Additive + GET-never-writes: every operation is read-only over EXISTING
 *     substrates (employer_candidates + onto_role_competency_profiles). This
 *     phase introduces ZERO net-new tables and runs ZERO DDL.
 *   - never-throws: every op returns a typed EngineResult; reads degrade to a
 *     to_regclass probe + honest empty/zeroed result. No fabrication.
 *   - Honesty: keyword-inferred evidence is a CONSERVATIVE proxy that is tracked
 *     separately and discounts Confidence — it never masquerades as a measured
 *     level. Absent evidence is reported as such, never assumed.
 */

import type { Pool } from 'pg';
import {
  getRoleProfile,
  getRoleProfiles,
  getRoleReadiness,
  roleFit,
  type RoleProfile,
  type RoleCompetencyRow,
  type ReadinessResult,
  type RoleFit,
} from './role-competency-profile';
import {
  resolveCuratedRoleByTitle,
  resolveCuratedRoleById,
  type RoleTitleResolution,
} from './role-title-crosswalk';

export const TALENT_MATCHING_ENGINE_VERSION = '5.6.0';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input', message: string): EngineResult =>
  ({ ok: false, code, message });

// Evidence quality (drives Confidence). measured = an explicit per-competency
// proficiency level on the candidate; inferred = the competency name was matched
// to a listed skill keyword (presence only — conservative proxy level); none = no
// evidence. Inferred contributes BREADTH but is heavily discounted for trust.
export type EvidenceSource = 'measured' | 'inferred' | 'none';
const EVIDENCE_TRUST: Record<EvidenceSource, number> = { measured: 1.0, inferred: 0.45, none: 0 };

// Conservative proxy level when a competency is only evidenced by a listed skill
// keyword (capped at the required level so a keyword never over-states depth).
const INFERRED_PROXY_LEVEL = 3;

// Generic competency-name tokens that must NOT alone trigger a keyword inference
// (too ambiguous, e.g. "management", "skills").
const GENERIC_TOKENS = new Set(['management', 'skills', 'skill', 'ability', 'general', 'and', 'the', 'for']);

export interface CompetencyMatch {
  competency_id: string;
  competency_name: string | null;
  required_level: number;
  actual_level: number | null;
  evidence: EvidenceSource;
  weight: number;
  criticality: string;
  attainment_pct: number | null; // min(actual/required,1) * 100
  gap: number | null;            // required - actual (>0 below target)
  status: 'met' | 'gap' | 'blocking_gap' | 'no_evidence';
  explanation: string;
}

export interface MatchResult {
  candidate_id: string;
  candidate_name: string | null;
  candidate_current_role: string | null;
  role_id: string;
  role_title: string | null;
  measurable: boolean;           // role has a competency profile to match against
  match_pct: number | null;
  fit_pct: number | null;
  gap_pct: number | null;
  readiness_pct: number | null;
  confidence_pct: number | null;
  fit_band: RoleFit['band'];
  fit_label: string;
  capped_by_critical: boolean;
  blocking_gaps: number;
  weight_total: number;
  evidence_mix: { measured: number; inferred: number; none: number }; // competency counts
  supporting_signals: { ei_score: number | null; assessment_score: number | null; prior_match_score: number | null };
  breakdown: CompetencyMatch[];
  notes: string[];
}

// ── candidate substrate read (read-only, never-throws) ──────────────────────
interface CandidateRow {
  id: string;
  name: string | null;
  candidate_role: string | null;
  skills: any;
  competency_profile: any;
  ei_score: number | null;
  assessment_score: number | null;
  match_score: number | null;
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

async function readCandidate(pool: Pool, id: string): Promise<CandidateRow | null> {
  if (!(await relExists(pool, 'employer_candidates'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, candidate_role, skills, competency_profile, ei_score, assessment_score, match_score
         FROM employer_candidates WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function listCandidates(pool: Pool, limit: number): Promise<CandidateRow[]> {
  if (!(await relExists(pool, 'employer_candidates'))) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, name, candidate_role, skills, competency_profile, ei_score, assessment_score, match_score
         FROM employer_candidates ORDER BY created_at DESC NULLS LAST LIMIT $1`,
      [Math.max(1, Math.min(500, limit))],
    );
    return rows;
  } catch {
    return [];
  }
}

// ── evidence resolution: candidate competencies → per-competency actuals ─────
function normalize(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Coerce a raw proficiency value to a 0..5 level. Accepts 1..5 directly; values
// >5 are treated as a 0..100 score and rescaled. Non-finite → null.
function coerceLevel(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const lvl = n > 5 ? n / 20 : n;
  return Math.max(0, Math.min(5, lvl));
}

// Parse competency_profile (jsonb) into a Map keyed by BOTH competency_id and
// normalized competency name → level. Tolerant of array or object-map shapes.
function parseCompetencyProfile(raw: any): Map<string, number> {
  const out = new Map<string, number>();
  if (!raw) return out;
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { return out; } }

  const put = (key: unknown, val: unknown) => {
    const k = String(key ?? '').trim();
    const lvl = coerceLevel(val);
    if (k && lvl != null) {
      out.set(k, lvl);
      out.set(normalize(k), lvl);
    }
  };

  if (Array.isArray(obj)) {
    for (const e of obj) {
      if (e && typeof e === 'object') {
        const key = e.competency_id ?? e.id ?? e.comp_id ?? e.competency ?? e.name ?? e.key;
        const val = e.level ?? e.score ?? e.proficiency ?? e.value ?? e.rating;
        put(key, val);
      }
    }
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && typeof v === 'object') put(k, (v as any).level ?? (v as any).score ?? (v as any).value);
      else put(k, v);
    }
  }
  return out;
}

function parseSkills(raw: any): string[] {
  if (!raw) return [];
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { return [raw]; } }
  if (!Array.isArray(obj)) return [];
  return obj
    .map((s) => (s && typeof s === 'object' ? (s.name ?? s.skill ?? s.label) : s))
    .map((s) => normalize(s))
    .filter(Boolean);
}

function keywordMatches(competencyName: string | null, skillTokens: string[]): boolean {
  const compNorm = normalize(competencyName);
  if (!compNorm || skillTokens.length === 0) return false;
  const compTokens = compNorm.split(' ').filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t));
  for (const s of skillTokens) {
    if (!s) continue;
    if (s.length >= 4 && compNorm.includes(s)) return true;     // skill ⊆ competency name
    if (s.includes(compNorm)) return true;                       // competency name ⊆ skill
    const sTokens = s.split(' ');
    if (compTokens.some((ct) => sTokens.includes(ct))) return true; // shared meaningful token
  }
  return false;
}

export interface ResolvedEvidence {
  actuals: Record<string, number>;          // competency_id → level (measured + inferred)
  source: Record<string, EvidenceSource>;   // competency_id → evidence tier
}

/**
 * Resolve the candidate's actual proficiency level for each competency the role
 * requires. measured (explicit level) wins; otherwise a listed skill keyword
 * yields a conservative inferred proxy; otherwise none.
 */
export function resolveCandidateActuals(role: RoleProfile, candidate: CandidateRow): ResolvedEvidence {
  const profile = parseCompetencyProfile(candidate.competency_profile);
  const skillTokens = parseSkills(candidate.skills);
  const actuals: Record<string, number> = {};
  const source: Record<string, EvidenceSource> = {};

  for (const c of role.competencies) {
    if (c.active === false) continue;
    const byId = profile.get(c.competency_id);
    const byName = profile.get(normalize(c.competency_name));
    const measured = byId != null ? byId : byName != null ? byName : null;
    if (measured != null) {
      actuals[c.competency_id] = measured;
      source[c.competency_id] = 'measured';
    } else if (keywordMatches(c.competency_name, skillTokens)) {
      actuals[c.competency_id] = Math.min(INFERRED_PROXY_LEVEL, c.required_level);
      source[c.competency_id] = 'inferred';
    } else {
      source[c.competency_id] = 'none';
    }
  }
  return { actuals, source };
}

// ── fit_engine: derive Match / Readiness / Fit / Gap from the composed readiness
export interface FitMetrics {
  match_pct: number | null;
  readiness_pct: number | null;
  fit_pct: number | null;
  gap_pct: number | null;
  fit: RoleFit;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeFit(readiness: ReadinessResult): FitMetrics {
  if (readiness.weight_total <= 0) {
    return { match_pct: null, readiness_pct: null, fit_pct: null, gap_pct: null, fit: roleFit(null, 0) };
  }
  const match = readiness.coverage_pct ?? 0;            // breadth = assessed-weight share
  const readinessPct = readiness.readiness_score;       // depth over assessed weight (null if none)
  const fitRaw = readinessPct == null ? 0 : r1((readinessPct * match) / 100); // depth over whole role
  const gap = r1(100 - fitRaw);
  return {
    match_pct: r1(match),
    readiness_pct: readinessPct,
    fit_pct: fitRaw,
    gap_pct: gap,
    fit: roleFit(fitRaw, readiness.blocking_gaps),
  };
}

// ── confidence: trust in the score = evidence-quality-weighted coverage ──────
export function computeConfidence(role: RoleProfile, source: Record<string, EvidenceSource>): number | null {
  if (role.weight_total <= 0) return null;
  let trustedWeight = 0;
  for (const c of role.competencies) {
    if (c.active === false) continue;
    trustedWeight += c.weight * EVIDENCE_TRUST[source[c.competency_id] ?? 'none'];
  }
  const profileFactor = role.weight_balanced ? 1 : 0.9; // unbalanced weights → slightly less trustworthy
  return r1((trustedWeight / role.weight_total) * 100 * profileFactor);
}

// ── gap_engine + match_explanation_engine: per-competency breakdown ──────────
function statusOf(g: { gap: number | null; blocking: boolean }, ev: EvidenceSource): CompetencyMatch['status'] {
  if (ev === 'none') return 'no_evidence';
  if (g.blocking) return 'blocking_gap';
  if (g.gap != null && g.gap > 0) return 'gap';
  return 'met';
}

function explainCompetency(c: CompetencyMatch): string {
  const name = c.competency_name ?? c.competency_id;
  if (c.status === 'no_evidence') {
    return `No evidence for ${name} (requires level ${c.required_level}/5, ${c.criticality}). Not assessed — excluded from depth, lowers confidence.`;
  }
  const via = c.evidence === 'inferred' ? ' (inferred from a listed skill — conservative proxy, not a measured level)' : '';
  if (c.status === 'met') {
    return `Meets ${name}: level ${c.actual_level}/${c.required_level}${via}.`;
  }
  const blk = c.status === 'blocking_gap' ? ' This is a CRITICAL competency — a blocking gap that caps overall fit.' : '';
  return `Below target on ${name}: level ${c.actual_level}/${c.required_level} (gap ${c.gap})${via}.${blk}`;
}

export function buildBreakdown(readiness: ReadinessResult, source: Record<string, EvidenceSource>): CompetencyMatch[] {
  return readiness.gaps.map((g) => {
    const ev = source[g.competency_id] ?? 'none';
    const base: CompetencyMatch = {
      competency_id: g.competency_id,
      competency_name: g.competency_name,
      required_level: g.required_level,
      actual_level: ev === 'none' ? null : g.actual_level,
      evidence: ev,
      weight: g.weight,
      criticality: g.criticality,
      attainment_pct: ev === 'none' ? null : g.attainment,
      gap: ev === 'none' ? null : g.gap,
      status: statusOf(g, ev),
      explanation: '',
    };
    base.explanation = explainCompetency(base);
    return base;
  });
}

export function explainMatch(m: Omit<MatchResult, 'notes'>): string[] {
  const notes: string[] = [];
  if (!m.measurable) {
    notes.push('This role has no competency profile yet — define required competencies before matching. No match is computed (not assumed).');
    return notes;
  }
  notes.push(
    `Match ${m.match_pct}% (breadth of evidence) · Readiness ${m.readiness_pct ?? 'n/a'}% (depth over evidenced competencies) · ` +
    `Fit ${m.fit_pct}% (depth over the whole role) · Gap ${m.gap_pct}% · Confidence ${m.confidence_pct}%.`,
  );
  notes.push('Match/Readiness/Fit/Gap/Confidence are SEPARATE axes — high breadth with low confidence means evidence is thin or keyword-inferred.');
  if (m.evidence_mix.inferred > 0) {
    notes.push(`${m.evidence_mix.inferred} competenc${m.evidence_mix.inferred === 1 ? 'y is' : 'ies are'} keyword-inferred (presence only) — these lower confidence and never count as measured depth.`);
  }
  if (m.evidence_mix.none > 0) {
    notes.push(`${m.evidence_mix.none} required competenc${m.evidence_mix.none === 1 ? 'y has' : 'ies have'} no evidence — excluded from readiness depth.`);
  }
  if (m.capped_by_critical) {
    notes.push(`Fit band is capped at "${m.fit_label}" by ${m.blocking_gaps} unmet CRITICAL competenc${m.blocking_gaps === 1 ? 'y' : 'ies'} (a blocking gap regardless of overall score).`);
  }
  return notes;
}

// ── talent_matching_engine: orchestrator ────────────────────────────────────
function evidenceMix(source: Record<string, EvidenceSource>): { measured: number; inferred: number; none: number } {
  const mix = { measured: 0, inferred: 0, none: 0 };
  for (const ev of Object.values(source)) mix[ev] += 1;
  return mix;
}

// Read-only compose wrappers: never trigger ensure-schema DDL (GET-never-writes)
// and never throw — degrade to null/[] on any failure.
async function safeRoleProfile(pool: Pool, roleId: string): Promise<RoleProfile | null> {
  try { return await getRoleProfile(pool, roleId, { readOnly: true }); } catch { return null; }
}
async function safeRoleProfiles(pool: Pool): Promise<RoleProfile[]> {
  try { return await getRoleProfiles(pool, { activeOnly: true, readOnly: true }); } catch { return []; }
}
async function safeRoleReadiness(pool: Pool, roleId: string, actuals: Record<string, number>): Promise<ReadinessResult | null> {
  try { return await getRoleReadiness(pool, roleId, actuals, { readOnly: true }); } catch { return null; }
}

async function computeMatch(pool: Pool, candidate: CandidateRow, role: RoleProfile): Promise<MatchResult> {
  const { actuals, source } = resolveCandidateActuals(role, candidate);
  const readiness = await safeRoleReadiness(pool, role.role_id, actuals);
  // getRoleReadiness returns null only when the role id does not exist; callers
  // pass a RoleProfile already resolved from the same id, so synthesize an empty
  // readiness defensively (never throw).
  const rr: ReadinessResult = readiness ?? {
    role_id: role.role_id, role_title: role.role_title, measured: false, readiness_score: null,
    readiness_band: null, readiness_label: null, coverage_pct: role.weight_total > 0 ? 0 : null,
    weight_total: role.weight_total, weight_assessed: 0, blocking_gaps: 0, gaps: [], strengths: [],
    gap_areas: [], critical_gaps: [], role_fit: roleFit(null, 0), notes: [],
  };

  const metrics = computeFit(rr);
  const confidence = computeConfidence(role, source);
  const breakdown = buildBreakdown(rr, source);
  const mix = evidenceMix(source);

  const partial: Omit<MatchResult, 'notes'> = {
    candidate_id: candidate.id,
    candidate_name: candidate.name,
    candidate_current_role: candidate.candidate_role,
    role_id: role.role_id,
    role_title: role.role_title,
    measurable: role.weight_total > 0,
    match_pct: metrics.match_pct,
    fit_pct: metrics.fit_pct,
    gap_pct: metrics.gap_pct,
    readiness_pct: metrics.readiness_pct,
    confidence_pct: confidence,
    fit_band: metrics.fit.band,
    fit_label: metrics.fit.label,
    capped_by_critical: metrics.fit.capped_by_critical,
    blocking_gaps: rr.blocking_gaps,
    weight_total: role.weight_total,
    evidence_mix: mix,
    supporting_signals: {
      ei_score: candidate.ei_score ?? null,
      assessment_score: candidate.assessment_score ?? null,
      prior_match_score: candidate.match_score ?? null,
    },
    breakdown,
  };
  return { ...partial, notes: explainMatch(partial) };
}

export async function matchCandidateToRole(
  pool: Pool,
  candidateId: string,
  roleId: string,
): Promise<EngineResult<MatchResult>> {
  const cid = String(candidateId ?? '').trim();
  const rid = String(roleId ?? '').trim();
  if (!cid) return err('invalid_input', 'candidate id is required');
  if (!rid) return err('invalid_input', 'role id is required');

  const candidate = await readCandidate(pool, cid);
  if (!candidate) return err('not_found', `candidate ${cid} not found`);
  const role = await safeRoleProfile(pool, rid);
  if (!role) return err('not_found', `role ${rid} not found`);

  return ok(await computeMatch(pool, candidate, role));
}

export interface RankedMatch {
  candidate_id: string;
  candidate_name: string | null;
  role_id: string;
  role_title: string | null;
  match_pct: number | null;
  fit_pct: number | null;
  gap_pct: number | null;
  readiness_pct: number | null;
  confidence_pct: number | null;
  fit_band: RoleFit['band'];
  fit_label: string;
  capped_by_critical: boolean;
  blocking_gaps: number;
}

function toRanked(m: MatchResult): RankedMatch {
  return {
    candidate_id: m.candidate_id, candidate_name: m.candidate_name, role_id: m.role_id,
    role_title: m.role_title, match_pct: m.match_pct, fit_pct: m.fit_pct, gap_pct: m.gap_pct,
    readiness_pct: m.readiness_pct, confidence_pct: m.confidence_pct, fit_band: m.fit_band,
    fit_label: m.fit_label, capped_by_critical: m.capped_by_critical, blocking_gaps: m.blocking_gaps,
  };
}

const byFitThenMatch = (a: RankedMatch, b: RankedMatch) =>
  (b.fit_pct ?? -1) - (a.fit_pct ?? -1) ||
  (b.match_pct ?? -1) - (a.match_pct ?? -1) ||
  (b.confidence_pct ?? -1) - (a.confidence_pct ?? -1);

export async function rankCandidatesForRole(
  pool: Pool,
  roleId: string,
  opts: { limit?: number } = {},
): Promise<EngineResult<{ role_id: string; role_title: string | null; measurable: boolean; candidates: RankedMatch[] }>> {
  const rid = String(roleId ?? '').trim();
  if (!rid) return err('invalid_input', 'role id is required');
  const role = await safeRoleProfile(pool, rid);
  if (!role) return err('not_found', `role ${rid} not found`);

  const candidates = await listCandidates(pool, opts.limit ?? 200);
  const ranked: RankedMatch[] = [];
  for (const c of candidates) ranked.push(toRanked(await computeMatch(pool, c, role)));
  ranked.sort(byFitThenMatch);
  return ok({ role_id: role.role_id, role_title: role.role_title, measurable: role.weight_total > 0, candidates: ranked });
}

export async function rankRolesForCandidate(
  pool: Pool,
  candidateId: string,
  opts: { limit?: number } = {},
): Promise<EngineResult<{ candidate_id: string; candidate_name: string | null; roles: RankedMatch[] }>> {
  const cid = String(candidateId ?? '').trim();
  if (!cid) return err('invalid_input', 'candidate id is required');
  const candidate = await readCandidate(pool, cid);
  if (!candidate) return err('not_found', `candidate ${cid} not found`);

  const profiles = await safeRoleProfiles(pool);
  const ranked: RankedMatch[] = [];
  for (const role of profiles) {
    if (role.weight_total <= 0) continue; // only roles with a real profile are matchable
    ranked.push(toRanked(await computeMatch(pool, candidate, role)));
  }
  ranked.sort(byFitThenMatch);
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  return ok({ candidate_id: candidate.id, candidate_name: candidate.name, roles: ranked.slice(0, limit) });
}

// ── in-memory candidate → role ranking (MX-302G Career Passport) ─────────────
// Career-seeker passport owners are NOT guaranteed an `employer_candidates` row
// (that table is keyed by employer-added email). Rather than fabricate one, the
// passport composes an in-memory candidate from the OWNER'S OWN measured platform
// data (competencies/skills/scores) and ranks the SAME active role profiles with
// the SAME pure pipeline (resolveCandidateActuals → computeMatch). Identical
// honesty: measured/inferred/none evidence mix, Coverage⟂Confidence, abstain on
// roles without a real profile — never an endorsement, only a developmental
// "roles your evidence aligns with" signal.
export type CandidateProfileInput = {
  id: string;
  name?: string | null;
  candidate_role?: string | null;
  skills?: any;
  competency_profile?: any;
  ei_score?: number | null;
  assessment_score?: number | null;
  match_score?: number | null;
};

export async function rankRolesForCandidateProfile(
  pool: Pool,
  input: CandidateProfileInput,
  opts: { limit?: number } = {},
): Promise<EngineResult<{ candidate_id: string; candidate_name: string | null; roles: RankedMatch[] }>> {
  const cid = String(input?.id ?? '').trim();
  if (!cid) return err('invalid_input', 'candidate id is required');
  const candidate: CandidateRow = {
    id: cid,
    name: input.name ?? null,
    candidate_role: input.candidate_role ?? null,
    skills: input.skills ?? null,
    competency_profile: input.competency_profile ?? null,
    ei_score: input.ei_score ?? null,
    assessment_score: input.assessment_score ?? null,
    match_score: input.match_score ?? null,
  };

  const profiles = await safeRoleProfiles(pool);
  const ranked: RankedMatch[] = [];
  for (const role of profiles) {
    if (role.weight_total <= 0) continue; // only roles with a real profile are matchable
    ranked.push(toRanked(await computeMatch(pool, candidate, role)));
  }
  ranked.sort(byFitThenMatch);
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  return ok({ candidate_id: cid, candidate_name: candidate.name, roles: ranked.slice(0, limit) });
}

// ── title / job crosswalk → candidate ranking ───────────────────────────────
// Real employers post jobs with a FREE-TEXT role title, not a curated role id.
// These orchestrators crosswalk that title to a curated Role-DNA role (via
// role-title-crosswalk, never fabricating) and then rank candidates against the
// resolved role's profile. The title-resolution `role_crosswalk` (Confidence)
// is carried alongside the per-candidate match axes (Coverage) — SEPARATE axes,
// never composited. When the title does not resolve, the engine ABSTAINS
// (resolved:false) rather than guess a role.

export interface TitleRankResult {
  role_title_input: string;
  resolved: boolean;
  role_crosswalk: RoleTitleResolution;
  role_id: string | null;
  role_title: string | null;
  measurable: boolean;
  candidates: RankedMatch[];
}

export async function rankCandidatesForRoleTitle(
  pool: Pool,
  title: string,
  opts: { limit?: number } = {},
): Promise<EngineResult<TitleRankResult>> {
  const input = String(title ?? '').trim();
  if (!input) return err('invalid_input', 'role title is required');

  const crosswalk = await resolveCuratedRoleByTitle(pool, input);
  if (!crosswalk.resolved) {
    // Honest abstain: no defensible crosswalk → no candidates ranked (never a guess).
    return ok({
      role_title_input: input,
      resolved: false,
      role_crosswalk: crosswalk,
      role_id: null,
      role_title: null,
      measurable: false,
      candidates: [],
    });
  }

  const ranked = await rankCandidatesForRole(pool, crosswalk.resolved.role_id, opts);
  if (!ranked.ok) return ranked;
  return ok({
    role_title_input: input,
    resolved: true,
    role_crosswalk: crosswalk,
    role_id: ranked.data.role_id,
    role_title: ranked.data.role_title,
    measurable: ranked.data.measurable,
    candidates: ranked.data.candidates,
  });
}

// Read a posted job's free-text role title (read-only, never-throws → null when
// absent). The CANONICAL posting flow (POST /api/job-posting-engine/jobs) writes
// `job_postings`, so that substrate is checked FIRST; the older employer-portal
// `employer_jobs` table is the fallback. Deterministic precedence: a job_postings
// hit wins. `source` is reported so the caller can surface which substrate matched.
async function readJobTitle(
  pool: Pool,
  jobId: string,
): Promise<{ title: string | null; source: 'job_postings' | 'employer_jobs'; override_role_id: string | null } | null> {
  // 1. Canonical posting flow (no employer-confirmed override column here).
  if (await relExists(pool, 'job_postings')) {
    try {
      const { rows } = await pool.query(`SELECT title FROM job_postings WHERE id = $1`, [jobId]);
      if (rows.length > 0) return { title: rows[0].title ?? null, source: 'job_postings', override_role_id: null };
    } catch {
      /* fall through to the legacy substrate */
    }
  }
  // 2. Legacy employer-portal jobs. SELECT * (never names matched_role_id) so this
  //    stays safe even before the employer-portal lazy ensureSchema adds the column —
  //    an absent column simply reads as undefined → null (no employer-confirmed role).
  if (await relExists(pool, 'employer_jobs')) {
    try {
      const { rows } = await pool.query(`SELECT * FROM employer_jobs WHERE id = $1`, [jobId]);
      if (rows.length > 0) {
        const r = rows[0];
        const override = typeof r.matched_role_id === 'string' && r.matched_role_id.trim() ? r.matched_role_id.trim() : null;
        return { title: r.title ?? null, source: 'employer_jobs', override_role_id: override };
      }
    } catch {
      /* not found / unreadable */
    }
  }
  return null;
}

export interface JobRankResult extends TitleRankResult {
  job_id: string;
  job_source: 'job_postings' | 'employer_jobs';
}

/**
 * Rank candidates against a NORMALLY-POSTED job — no hardcoded role id. Reads the
 * job's free-text title (from job_postings, the canonical posting flow, falling
 * back to employer_jobs), crosswalks it to a curated Role-DNA role, and ranks.
 * Abstains (resolved:false) when the title does not crosswalk.
 */
export async function rankCandidatesForJob(
  pool: Pool,
  jobId: string,
  opts: { limit?: number } = {},
): Promise<EngineResult<JobRankResult>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'job id is required');

  const job = await readJobTitle(pool, jid);
  if (!job) return err('not_found', `job ${jid} not found`);

  // An employer-confirmed / overridden role wins over the title heuristic — the
  // human selection is authoritative. Falls through to the title crosswalk only
  // if that stored role is no longer matchable (honest, never a silent guess).
  if (job.override_role_id) {
    const resolution = await resolveCuratedRoleById(pool, job.override_role_id, job.title ?? '');
    if (resolution.resolved) {
      const ranked = await rankCandidatesForRole(pool, resolution.resolved.role_id, opts);
      if (!ranked.ok) return ranked;
      return ok({
        job_id: jid,
        job_source: job.source,
        role_title_input: job.title ?? '',
        resolved: true,
        role_crosswalk: resolution,
        role_id: ranked.data.role_id,
        role_title: ranked.data.role_title,
        measurable: ranked.data.measurable,
        candidates: ranked.data.candidates,
      });
    }
    // stored override no longer valid → fall through to the title crosswalk.
  }

  if (!job.title || !job.title.trim()) {
    return err('invalid_input', `job ${jid} has no role title to crosswalk`);
  }

  const byTitle = await rankCandidatesForRoleTitle(pool, job.title, opts);
  if (!byTitle.ok) return byTitle;
  return ok({ job_id: jid, job_source: job.source, ...byTitle.data });
}
