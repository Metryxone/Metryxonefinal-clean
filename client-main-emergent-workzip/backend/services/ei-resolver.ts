/**
 * EI Reference Resolver — Phase 2
 *
 * Server-authoritative resolution of free-text profile inputs to canonical
 * reference entities. Replaces the keyword/regex/vocab heuristics of the
 * client-side preview EI with database-grounded matches + provenance + confidence.
 *
 * Pure functions, no Express dependency. Used by /api/ei/resolve.
 *
 * Resolution strategy per entity:
 *   1. Try exact (case-insensitive) match on canonical_name / short_name
 *   2. Try alias table exact match
 *   3. pg_trgm fuzzy match (similarity > THRESHOLD)
 *   4. If still unresolved AND input non-trivial → push to ref_review_queue
 *
 * Confidence score per resolution: 0.0 - 1.0
 *   1.0  exact canonical
 *   0.95 exact alias
 *   sim  fuzzy (raw pg_trgm score)
 */

import type { Pool } from 'pg';

export type Confidence = number; // 0..1

export interface ResolvedEntity {
  input:           string;
  matched:         boolean;
  canonical_id?:   string;
  canonical_name?: string;
  short_name?:     string | null;
  confidence:      Confidence;
  matched_via:     'exact_canonical' | 'exact_alias' | 'fuzzy' | 'unresolved';
  meta?:           Record<string, unknown>; // entity-specific (tier, nsqf_level, market_demand, etc.)
  provenance?:     ProvenanceRef[];
}

export interface ProvenanceRef {
  source_authority: string;
  source_url?:      string | null;
  confidence_score?: number | null;
  snapshot_date?:   string | null;
  extracted_value?: any;
}

export interface ResolverInput {
  institution?:   string;
  qualification?: string;
  skills?:        string[];
  certifications?:string[];
  occupation?:    string;
}

export interface ResolverOutput {
  institution?:    ResolvedEntity;
  qualification?:  ResolvedEntity;
  skills:          ResolvedEntity[];
  certifications:  ResolvedEntity[];
  occupation?:     ResolvedEntity;
  unresolved: {
    institution?:    string;
    qualification?:  string;
    skills:          string[];
    certifications:  string[];
    occupation?:     string;
  };
  profile_confidence_score: number; // 0..100
  resolved_at: string;
}

const FUZZY_THRESHOLD = 0.30;          // pg_trgm score floor
const REVIEW_QUEUE_THRESHOLD = 0.55;   // below this → auto-push to review
const TRIVIAL_INPUT_LEN = 2;           // ignore <=2 char inputs

function normalise(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function looksTrivial(s: string): boolean {
  return !s || s.length <= TRIVIAL_INPUT_LEN;
}

async function exactMatch(
  pool: Pool,
  table: string,
  nameCol: string,
  shortCol: string | undefined,
  input: string,
): Promise<any | null> {
  const term = normalise(input);
  if (!term) return null;
  const cols = shortCol ? [nameCol, shortCol] : [nameCol];
  const whereParts = cols.map((c, i) => `LOWER(${c}) = $${i + 1}`).join(' OR ');
  const vals = cols.map(() => term);
  const r = await pool.query(
    `SELECT * FROM ${table} WHERE (${whereParts}) AND COALESCE(is_active,true)=true LIMIT 1`,
    vals,
  );
  return r.rows[0] || null;
}

async function aliasMatch(
  pool: Pool,
  aliasTable: string,
  fk: string,
  entityTable: string,
  input: string,
): Promise<any | null> {
  if (!aliasTable) return null;
  const term = normalise(input);
  if (!term) return null;
  const r = await pool.query(
    `SELECT e.*, a.alias_name, a.confidence_score AS alias_conf
       FROM ${aliasTable} a JOIN ${entityTable} e ON e.id = a.${fk}
      WHERE LOWER(a.alias_name) = $1 AND COALESCE(e.is_active,true)=true
      LIMIT 1`,
    [term],
  );
  return r.rows[0] || null;
}

async function fuzzyMatch(
  pool: Pool,
  table: string,
  nameCol: string,
  shortCol: string | undefined,
  aliasTable: string | undefined,
  aliasFK: string | undefined,
  input: string,
): Promise<{ row: any; score: number; via: 'canonical' | 'alias' } | null> {
  const term = (input || '').trim();
  if (!term) return null;

  const canonSql = `
    SELECT *, GREATEST(
      similarity(${nameCol}, $1)
      ${shortCol ? `, similarity(COALESCE(${shortCol}, ''), $1)` : ''}
    ) AS _score
      FROM ${table}
     WHERE COALESCE(is_active,true)=true
       AND ( ${nameCol} % $1 ${shortCol ? `OR ${shortCol} % $1` : ''} )
     ORDER BY _score DESC
     LIMIT 1`;
  const c = await pool.query(canonSql, [term]);
  const cBest = c.rows[0] ? { row: c.rows[0], score: Number(c.rows[0]._score) || 0, via: 'canonical' as const } : null;

  let aBest: { row: any; score: number; via: 'alias' } | null = null;
  if (aliasTable && aliasFK) {
    const aSql = `
      SELECT e.*, similarity(a.alias_name, $1) AS _score
        FROM ${aliasTable} a JOIN ${table} e ON e.id = a.${aliasFK}
       WHERE a.alias_name % $1 AND COALESCE(e.is_active,true)=true
       ORDER BY _score DESC LIMIT 1`;
    const a = await pool.query(aSql, [term]);
    if (a.rows[0]) aBest = { row: a.rows[0], score: Number(a.rows[0]._score) || 0, via: 'alias' };
  }

  const winners = [cBest, aBest].filter(Boolean) as Array<NonNullable<typeof cBest>>;
  if (!winners.length) return null;
  winners.sort((a, b) => b.score - a.score);
  const top = winners[0];
  return top.score >= FUZZY_THRESHOLD ? top : null;
}

async function loadProvenance(
  pool: Pool,
  entityType: string,
  entityId: string,
  limit = 5,
): Promise<ProvenanceRef[]> {
  try {
    const r = await pool.query(
      `SELECT source_authority, source_url, confidence_score,
              source_snapshot_date AS snapshot_date, extracted_value
         FROM provenance_records
        WHERE entity_type=$1 AND entity_id=$2
        ORDER BY last_verified_at DESC NULLS LAST, created_at DESC
        LIMIT $3`,
      [entityType, entityId, limit],
    );
    return r.rows;
  } catch {
    return [];
  }
}

async function loadInstitutionMeta(pool: Pool, id: string): Promise<Record<string, unknown>> {
  try {
    const rk = await pool.query(
      `SELECT ranking_source, ranking_category, ranking_year, ranking_value, ranking_percentile, source_url
         FROM institution_rankings WHERE institution_id=$1
         ORDER BY ranking_year DESC, ranking_source LIMIT 6`,
      [id],
    );
    const ac = await pool.query(
      `SELECT accreditation_authority, accreditation_grade, source_url
         FROM institution_accreditations WHERE institution_id=$1
         ORDER BY accreditation_authority LIMIT 6`,
      [id],
    );
    return { rankings: rk.rows, accreditations: ac.rows };
  } catch {
    return {};
  }
}

// In-memory dedupe window for review-queue inserts: same (entity, normalised name)
// within this window is collapsed to a single DB write. Protects against typeahead
// keystroke amplification AND scripted poisoning even when rate limit is generous.
const REVIEW_DEDUPE_MS = 10 * 60_000;
const REVIEW_SEEN_MAX = 20_000;  // hard cap: oldest-insertion eviction when full
const reviewSeen = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - REVIEW_DEDUPE_MS;
  for (const [k, t] of reviewSeen) if (t < cutoff) reviewSeen.delete(k);
}, 5 * 60_000).unref?.();

// Global write-budget for the review queue — defense-in-depth against any
// per-IP rate-limiter bypass (e.g. attacker rotating XFF or coming from many
// real IPs). Even if a flood reaches resolveOne(), at most GLOBAL_INSERT_MAX
// new rows can be appended to ref_review_queue per GLOBAL_WINDOW_MS. Real
// usage is single-digit inserts/minute; legitimate users are unaffected.
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_INSERT_MAX = 60;
let globalWindowStart = Date.now();
let globalInsertCount = 0;
function globalBudgetOk(): boolean {
  const now = Date.now();
  if (now - globalWindowStart >= GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalInsertCount = 0;
  }
  if (globalInsertCount >= GLOBAL_INSERT_MAX) return false;
  globalInsertCount++;
  return true;
}

async function pushReviewQueue(
  pool: Pool,
  entityType: string,
  submittedName: string,
  context: Record<string, unknown>,
  suggestId: string | null,
  suggestScore: number | null,
): Promise<void> {
  const key = `${entityType}::${normalise(submittedName)}`;
  const last = reviewSeen.get(key);
  if (last && Date.now() - last < REVIEW_DEDUPE_MS) return; // dedupe
  // Hard size cap with FIFO eviction — bounds memory under adversarial input cardinality.
  if (reviewSeen.size >= REVIEW_SEEN_MAX) {
    const oldestKey = reviewSeen.keys().next().value;
    if (oldestKey !== undefined) reviewSeen.delete(oldestKey);
  }
  reviewSeen.set(key, Date.now());

  // Global write budget — silently drop once burst budget is exhausted.
  if (!globalBudgetOk()) return;

  try {
    // Server-side dedupe: skip if an identical pending item already exists.
    const exists = await pool.query(
      `SELECT 1 FROM ref_review_queue
        WHERE entity_type=$1 AND LOWER(submitted_name)=LOWER($2) AND status='pending'
        LIMIT 1`,
      [entityType, submittedName],
    );
    if (exists.rowCount) return;
    await pool.query(
      `INSERT INTO ref_review_queue
        (entity_type, submitted_name, context, suggested_match_id, suggested_match_score, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT DO NOTHING`,
      [entityType, submittedName, JSON.stringify(context), suggestId, suggestScore],
    );
  } catch (e) {
    // swallow — review queue auto-push must never block resolution
    console.warn('[ei-resolver] review-queue push failed', (e as Error).message);
  }
}

async function resolveOne(
  pool: Pool,
  entityType: 'institutions' | 'qualifications' | 'certifications' | 'skills' | 'occupations',
  cfg: { table: string; nameCol: string; shortCol?: string; aliasTable?: string; aliasFK?: string; metaPick: (row: any) => Record<string, unknown> },
  input: string,
  context: Record<string, unknown>,
): Promise<ResolvedEntity> {
  const inp = (input || '').trim();
  const unresolved: ResolvedEntity = { input: inp, matched: false, confidence: 0, matched_via: 'unresolved' };
  if (looksTrivial(inp)) return unresolved;

  // 1) exact canonical
  let row = await exactMatch(pool, cfg.table, cfg.nameCol, cfg.shortCol, inp);
  let via: ResolvedEntity['matched_via'] = 'exact_canonical';
  let conf = 1.0;

  // 2) alias exact
  if (!row && cfg.aliasTable && cfg.aliasFK) {
    row = await aliasMatch(pool, cfg.aliasTable, cfg.aliasFK, cfg.table, inp);
    if (row) { via = 'exact_alias'; conf = Number(row.alias_conf) || 0.95; }
  }

  // 3) fuzzy
  if (!row) {
    const fz = await fuzzyMatch(pool, cfg.table, cfg.nameCol, cfg.shortCol, cfg.aliasTable, cfg.aliasFK, inp);
    if (fz) { row = fz.row; via = 'fuzzy'; conf = Number(fz.score) || 0; }
  }

  if (!row) {
    // auto-push to review queue
    await pushReviewQueue(pool, entityType, inp, context, null, null);
    return unresolved;
  }

  // confidence below review threshold → still considered "matched" but flagged
  const meta = cfg.metaPick(row);
  const provType = entityType.replace(/s$/, '');
  const provenance = await loadProvenance(pool, provType, row.id);

  if (entityType === 'institutions') {
    const extra = await loadInstitutionMeta(pool, row.id);
    Object.assign(meta, extra);
  }

  if (conf < REVIEW_QUEUE_THRESHOLD) {
    await pushReviewQueue(pool, entityType, inp, { ...context, fuzzy_suggested: row.id, fuzzy_score: conf }, row.id, conf);
  }

  return {
    input: inp, matched: true,
    canonical_id: row.id,
    canonical_name: row[cfg.nameCol],
    short_name: cfg.shortCol ? row[cfg.shortCol] ?? null : null,
    confidence: Math.max(0, Math.min(1, conf)),
    matched_via: via,
    meta, provenance,
  };
}

const CONFIGS = {
  institutions: {
    table: 'institutions', nameCol: 'canonical_name', shortCol: 'short_name',
    aliasTable: 'institution_aliases', aliasFK: 'institution_id',
    metaPick: (r: any) => ({
      institution_type: r.institution_type,
      country_code: r.country_code,
      tier_computed: r.tier_computed,
      tier_basis: r.tier_basis,
      tier_overridden: r.tier_overridden,
      established_year: r.established_year,
      website: r.website,
    }),
  },
  qualifications: {
    table: 'qualifications', nameCol: 'canonical_name', shortCol: 'short_name',
    aliasTable: 'qualification_aliases', aliasFK: 'qualification_id',
    metaPick: (r: any) => ({
      qualification_type: r.qualification_type,
      nsqf_level: r.nsqf_level,
      eqf_level: r.eqf_level,
      regulator: r.regulator,
      field_of_study: r.field_of_study,
      qualification_weight: r.qualification_weight,
    }),
  },
  certifications: {
    table: 'certifications', nameCol: 'canonical_name', shortCol: 'short_name',
    aliasTable: 'certification_aliases', aliasFK: 'certification_id',
    metaPick: (r: any) => ({
      issuer_name: r.issuer_name,
      issuer_category: r.issuer_category,
      tier: r.tier,
      market_recognition_score: r.market_recognition_score,
      technical_depth_score: r.technical_depth_score,
      verification_supported: r.verification_supported,
      verification_url: r.verification_url,
    }),
  },
  skills: {
    table: 'skills', nameCol: 'canonical_name', shortCol: undefined,
    aliasTable: 'skill_aliases', aliasFK: 'skill_id',
    metaPick: (r: any) => ({
      skill_category: r.skill_category,
      market_demand_score: r.market_demand_score,
      future_relevance_score: r.future_relevance_score,
      esco_uri: r.esco_uri,
    }),
  },
  occupations: {
    table: 'occupations', nameCol: 'canonical_title', shortCol: undefined,
    aliasTable: undefined, aliasFK: undefined,
    metaPick: (r: any) => ({
      role_family: r.role_family,
      seniority_level: r.seniority_level,
      seniority_weight: r.seniority_weight,
      esco_code: r.esco_code,
    }),
  },
} as const;

/** Compute a 0..100 profile confidence score from resolution coverage. */
function computeProfileConfidence(out: Omit<ResolverOutput, 'profile_confidence_score' | 'resolved_at'>): number {
  let total = 0;

  // Institution: up to 25 pts (presence-weighted by confidence)
  if (out.institution?.matched) total += 25 * out.institution.confidence;
  // Qualification: up to 20 pts
  if (out.qualification?.matched) total += 20 * out.qualification.confidence;
  // Skills: up to 25 pts, scaled by resolved ratio AND avg confidence
  const sAll = out.skills.length;
  if (sAll > 0) {
    const matched = out.skills.filter(s => s.matched);
    const avgConf = matched.length ? matched.reduce((a, s) => a + s.confidence, 0) / matched.length : 0;
    total += 25 * (matched.length / sAll) * avgConf;
  }
  // Certifications: up to 20 pts
  const cAll = out.certifications.length;
  if (cAll > 0) {
    const matched = out.certifications.filter(c => c.matched);
    const avgConf = matched.length ? matched.reduce((a, c) => a + c.confidence, 0) / matched.length : 0;
    total += 20 * (matched.length / cAll) * avgConf;
  }
  // Occupation: up to 10 pts
  if (out.occupation?.matched) total += 10 * out.occupation.confidence;

  return Math.round(Math.max(0, Math.min(100, total)));
}

export async function resolveProfile(pool: Pool, input: ResolverInput): Promise<ResolverOutput> {
  const context: Record<string, unknown> = { input_keys: Object.keys(input) };

  const institution = input.institution
    ? await resolveOne(pool, 'institutions', CONFIGS.institutions, input.institution, context)
    : undefined;
  const qualification = input.qualification
    ? await resolveOne(pool, 'qualifications', CONFIGS.qualifications, input.qualification, context)
    : undefined;
  const occupation = input.occupation
    ? await resolveOne(pool, 'occupations', CONFIGS.occupations, input.occupation, context)
    : undefined;

  const skillInputs = (input.skills || []).map(s => (s || '').trim()).filter(Boolean);
  const certInputs  = (input.certifications || []).map(s => (s || '').trim()).filter(Boolean);

  const skills = await Promise.all(
    skillInputs.map(s => resolveOne(pool, 'skills', CONFIGS.skills, s, context)),
  );
  const certifications = await Promise.all(
    certInputs.map(s => resolveOne(pool, 'certifications', CONFIGS.certifications, s, context)),
  );

  const unresolved = {
    institution:    institution?.matched ? undefined : institution?.input,
    qualification:  qualification?.matched ? undefined : qualification?.input,
    skills:         skills.filter(s => !s.matched).map(s => s.input),
    certifications: certifications.filter(c => !c.matched).map(c => c.input),
    occupation:     occupation?.matched ? undefined : occupation?.input,
  };

  const core: Omit<ResolverOutput, 'profile_confidence_score' | 'resolved_at'> = {
    institution, qualification, skills, certifications, occupation, unresolved,
  };

  return {
    ...core,
    profile_confidence_score: computeProfileConfidence(core),
    resolved_at: new Date().toISOString(),
  };
}
