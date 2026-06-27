/**
 * MX-302B — Career Discovery Orchestrator (backend, compose-only)
 * ----------------------------------------------------------------------------
 * The brain of the Career Discovery experience that runs BEFORE Career Builder.
 * It COMPOSES already-built engines (CAPADEX, competency, LBI, MEI, career-match,
 * recommendation, roadmap, development, career-graph, occupation, labor-market)
 * and the ONE net-new assessment (Values inventory) into:
 *   1. an assessment battery (what to do, what is done),
 *   2. an aggregated discovery profile + a career-compatibility score.
 *
 * Discipline:
 *   • never-throws — every composed reader is wrapped; a failure degrades to an
 *     honest "absent" rather than a 500.
 *   • null ≠ 0 — a score that cannot be measured is null, never silently 0.
 *   • read-only on GET — the only writes are explicit (values submit / complete).
 *   • lazy ensure-schema is reached ONLY on the flag-ON path (gated at the route),
 *     so flag-OFF is byte-identical incl. schema.
 */
import type { Pool } from 'pg';
import { scoreValues, type ValuesScoreResult } from './career-discovery-values';
import { buildCareerMatch } from './career-match-engine';
import { computeMEIScore, mapProfileToMEIInput } from './mei-scoring-engine';
import { buildCompositeProfile } from './lbi-profile-builder';

// ── Lazy ensure-schema (flag-ON path only) ───────────────────────────────────
let _schemaReady = false;
export async function ensureCareerDiscoverySchema(pool: Pool): Promise<void> {
  if (_schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_discovery_results (
      user_id             VARCHAR     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile             JSONB       NOT NULL DEFAULT '{}'::jsonb,
      values_responses    JSONB       NOT NULL DEFAULT '{}'::jsonb,
      values_scores       JSONB,
      compatibility_score INTEGER,
      status              TEXT        NOT NULL DEFAULT 'in_progress',
      completed_at        TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cdr_status ON career_discovery_results(status);
  `);
  _schemaReady = true;
}

/** Probe whether a relation exists (never throws). */
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [name]);
    return !!r.rows?.[0]?.reg;
  } catch {
    return false;
  }
}

async function countWhere(pool: Pool, sql: string, params: unknown[]): Promise<number | null> {
  try {
    const r = await pool.query(sql, params);
    const n = Number(r.rows?.[0]?.n);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Read the user's self-reported career profile JSONB (never throws → null). */
async function resolveCareerProfileData(pool: Pool, userId: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await pool.query(`SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
    const data = r.rows?.[0]?.data;
    if (!data) return null;
    return (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Resolve the user's email (LBI is keyed by email). never-throws → null. */
async function resolveUserEmail(pool: Pool, userId: string): Promise<string | null> {
  try {
    const r = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const email = r.rows?.[0]?.email;
    return email ? String(email) : null;
  } catch {
    return null;
  }
}

export type DiscoveryStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface DiscoveryStatusResult {
  status: DiscoveryStatus;
  hasCompletedDiscovery: boolean;
  completed_at: string | null;
  compatibility_score: number | null;
  values_completed: boolean;
}

/** Read the per-user discovery status. never-throws → defaults to not_started. */
export async function readDiscoveryStatus(pool: Pool, userId: string): Promise<DiscoveryStatusResult> {
  await ensureCareerDiscoverySchema(pool);
  try {
    const r = await pool.query(
      `SELECT status, completed_at, compatibility_score, values_scores
         FROM career_discovery_results WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const row = r.rows?.[0];
    if (!row) {
      return { status: 'not_started', hasCompletedDiscovery: false, completed_at: null, compatibility_score: null, values_completed: false };
    }
    const status = (row.status as DiscoveryStatus) ?? 'in_progress';
    const hasCompletedDiscovery = status === 'completed' || status === 'skipped';
    return {
      status,
      hasCompletedDiscovery,
      completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      compatibility_score: row.compatibility_score == null ? null : Number(row.compatibility_score),
      values_completed: row.values_scores != null,
    };
  } catch {
    return { status: 'not_started', hasCompletedDiscovery: false, completed_at: null, compatibility_score: null, values_completed: false };
  }
}

/** Persist the net-new Values inventory + scored dimensions (explicit write). */
export async function persistValues(
  pool: Pool,
  userId: string,
  responses: Record<string, unknown>,
): Promise<ValuesScoreResult> {
  await ensureCareerDiscoverySchema(pool);
  const scores = scoreValues(responses);
  await pool.query(
    `INSERT INTO career_discovery_results (user_id, values_responses, values_scores, status)
       VALUES ($1, $2::jsonb, $3::jsonb, 'in_progress')
     ON CONFLICT (user_id) DO UPDATE
       SET values_responses = EXCLUDED.values_responses,
           values_scores    = EXCLUDED.values_scores,
           status           = CASE WHEN career_discovery_results.status IN ('completed','skipped')
                                   THEN career_discovery_results.status ELSE 'in_progress' END,
           updated_at       = NOW()`,
    [userId, JSON.stringify(responses ?? {}), JSON.stringify(scores)],
  );
  return scores;
}

/** Mark discovery complete (or skipped), snapshotting the composed profile. */
export async function markDiscovery(
  pool: Pool,
  userId: string,
  status: 'completed' | 'skipped',
): Promise<DiscoveryStatusResult> {
  await ensureCareerDiscoverySchema(pool);
  let profile: DiscoveryProfile | null = null;
  let compatibility: number | null = null;
  if (status === 'completed') {
    profile = await buildDiscoveryProfile(pool, userId);
    compatibility = profile.compatibility_score;
  }
  await pool.query(
    `INSERT INTO career_discovery_results (user_id, status, completed_at, profile, compatibility_score)
       VALUES ($1, $2, NOW(), COALESCE($3::jsonb, '{}'::jsonb), $4)
     ON CONFLICT (user_id) DO UPDATE
       SET status              = EXCLUDED.status,
           completed_at        = NOW(),
           profile             = COALESCE($3::jsonb, career_discovery_results.profile),
           compatibility_score = COALESCE(EXCLUDED.compatibility_score, career_discovery_results.compatibility_score),
           updated_at          = NOW()`,
    [userId, status, profile ? JSON.stringify(profile) : null, compatibility],
  );
  return readDiscoveryStatus(pool, userId);
}

// ── Assessment battery ───────────────────────────────────────────────────────
export type BatteryModuleStatus = 'completed' | 'available' | 'not_started';

export interface BatteryModule {
  id: string;
  label: string;
  description: string;
  /** Which existing engine this module reuses (or 'net-new' for Values). */
  source: string;
  net_new: boolean;
  status: BatteryModuleStatus;
  /** Honest note when data presence couldn't be measured. */
  note?: string;
}

export interface DiscoveryBattery {
  ok: boolean;
  modules: BatteryModule[];
  completed_count: number;
  total: number;
}

/**
 * Compose a discovery battery: a curated catalog of the assessments that feed
 * discovery, each REUSING an existing engine except the net-new Values
 * inventory. Per-user completion is derived from cheap presence probes; where a
 * probe is not reliable for a given engine we report 'available' (never a fake
 * 'completed').
 */
export async function buildDiscoveryBattery(pool: Pool, userId: string): Promise<DiscoveryBattery> {
  const status = await readDiscoveryStatus(pool, userId);

  // Competency (aptitude / work style): onto_competency_profiles is keyed by
  // subject_id (text), NOT user_id — it has no user_id column, so probing
  // user_id would silently error and under-report completion. The match engine
  // uses subject_id == the user id.
  let competencyDone = false;
  if (await tableExists(pool, 'onto_competency_profiles')) {
    const n = await countWhere(pool, `SELECT COUNT(*)::int AS n FROM onto_competency_profiles WHERE subject_id = $1`, [userId]);
    competencyDone = (n ?? 0) > 0;
  }

  // CAPADEX (interest / personality / behavioural insight): keyed by user_id.
  let capadexDone = false;
  if (await tableExists(pool, 'capadex_sessions')) {
    const n = await countWhere(pool, `SELECT COUNT(*)::int AS n FROM capadex_sessions WHERE user_id = $1`, [userId]);
    capadexDone = (n ?? 0) > 0;
  }

  // LBI (learning style): keyed by user_email.
  let lbiDone = false;
  if (await tableExists(pool, 'lbi_scores')) {
    const email = await resolveUserEmail(pool, userId);
    if (email) {
      const n = await countWhere(pool, `SELECT COUNT(*)::int AS n FROM lbi_scores WHERE user_email = $1`, [email]);
      lbiDone = (n ?? 0) > 0;
    }
  }

  // MEI (multiple intelligence / market readiness) is COMPOSED on demand from
  // the competency + self-reported profile — it is not separately captured, so
  // it's "completed" exactly when those inputs exist (no fake completion).
  const hasProfile = (await resolveCareerProfileData(pool, userId)) != null;
  const meiComposable = competencyDone || hasProfile;

  const modules: BatteryModule[] = [
    {
      id: 'values',
      label: 'Work Values Inventory',
      description: 'A short inventory that surfaces what matters most to you at work.',
      source: 'net-new',
      net_new: true,
      status: status.values_completed ? 'completed' : 'not_started',
    },
    {
      id: 'interest_personality',
      label: 'Interests & Personality (CAPADEX)',
      description: 'Interest, personality and behavioural signals from the CAPADEX assessment.',
      source: 'capadex',
      net_new: false,
      status: capadexDone ? 'completed' : 'available',
      note: capadexDone ? undefined : 'Composes your existing CAPADEX results when present.',
    },
    {
      id: 'aptitude_workstyle',
      label: 'Aptitude & Work Style (Competency)',
      description: 'Your competency genome scores — aptitude and work-style signals used for role matching.',
      source: 'competency-runtime',
      net_new: false,
      status: competencyDone ? 'completed' : 'available',
      note: competencyDone ? undefined : 'Composes your existing competency profile when present.',
    },
    {
      id: 'learning_style',
      label: 'Learning Style (LBI)',
      description: 'Your learning behaviour and preferred learning style from the LBI engine.',
      source: 'lbi',
      net_new: false,
      status: lbiDone ? 'completed' : 'available',
      note: lbiDone ? undefined : 'Composes your existing LBI learning profile when present.',
    },
    {
      id: 'multiple_intelligence',
      label: 'Market Employability Index (MEI)',
      description: 'A composite read of market readiness across multiple intelligence dimensions.',
      source: 'mei-scoring-engine',
      net_new: false,
      status: meiComposable ? 'completed' : 'available',
      note: 'Composed on demand from your competency + profile inputs (not separately captured).',
    },
  ];

  const completed_count = modules.filter((m) => m.status === 'completed').length;
  return { ok: true, modules, completed_count, total: modules.length };
}

// ── Aggregated discovery profile + compatibility ─────────────────────────────
export interface DiscoveryProfile {
  ok: boolean;
  user_id: string;
  values: ValuesScoreResult | null;
  /** Top role matches (from the match engine) — empty when not measurable. */
  top_matches: Array<{ role_id: string; role_name: string; match_percentage: number | null; confidence: string | null }>;
  /** MEI band/score when derivable, else null. */
  mei: { composite_score: number | null; band: string | null; confidence: number | null } | null;
  /** Learning style (LBI) when measured, else null (never a fabricated default). */
  learning_style: { style: string; band: string | null; sessions_analyzed: number } | null;
  /** 0..100 overall career-compatibility score; null when not measurable. */
  compatibility_score: number | null;
  coverage: { values: boolean; matches: boolean; mei: boolean; learning_style: boolean };
  generated_at: string;
}

async function safeBuildMatch(pool: Pool, userId: string) {
  try {
    return await buildCareerMatch(pool, userId);
  } catch {
    return null;
  }
}

/**
 * Aggregate the discovery profile by composing the match engine + the stored
 * Values inventory + a best-effort MEI read. The compatibility score is the
 * anchor / top match percentage when present, otherwise null (never 0).
 */
export async function buildDiscoveryProfile(pool: Pool, userId: string): Promise<DiscoveryProfile> {
  await ensureCareerDiscoverySchema(pool);

  // Values — read the stored scored inventory.
  let values: ValuesScoreResult | null = null;
  try {
    const r = await pool.query(`SELECT values_scores FROM career_discovery_results WHERE user_id = $1 LIMIT 1`, [userId]);
    const vs = r.rows?.[0]?.values_scores;
    if (vs) values = (typeof vs === 'string' ? JSON.parse(vs) : vs) as ValuesScoreResult;
  } catch {
    values = null;
  }

  // Matches — compose the match engine (read-only).
  const matchEnv: any = await safeBuildMatch(pool, userId);
  const rawMatches: any[] = Array.isArray(matchEnv?.matches) ? matchEnv.matches : [];
  const top_matches = rawMatches.slice(0, 5).map((m) => ({
    role_id: String(m.role_id ?? m.id ?? ''),
    role_name: String(m.role_name ?? m.name ?? m.role_id ?? 'Role'),
    match_percentage: m.match_percentage == null ? null : Number(m.match_percentage),
    confidence: m.match_confidence ?? m.confidence ?? null,
  }));

  // Compatibility — prefer the anchor, else best top match. null when none.
  let compatibility_score: number | null = null;
  const anchorPct = matchEnv?.anchor?.match_percentage;
  if (anchorPct != null && Number.isFinite(Number(anchorPct))) {
    compatibility_score = Math.round(Number(anchorPct));
  } else if (top_matches.length && top_matches[0].match_percentage != null) {
    compatibility_score = Math.round(top_matches[0].match_percentage as number);
  }

  // MEI (multiple intelligence / market readiness) — COMPOSE the scoring engine
  // from the user's self-reported career profile. When the user has no profile
  // row at all we cannot honestly score, so MEI stays null (never 0).
  let mei: { composite_score: number | null; band: string | null; confidence: number | null } | null = null;
  try {
    const cp = await resolveCareerProfileData(pool, userId);
    if (cp) {
      const input = mapProfileToMEIInput(cp, {
        industryCode: (cp.targetIndustry as string) ?? null,
        roleLevelCode: null,
      });
      const out: any = await computeMEIScore(pool, input);
      const composite = Number(out?.composite_score);
      if (Number.isFinite(composite)) {
        mei = {
          composite_score: Math.round(composite),
          band: out?.band ?? null,
          confidence: out?.confidence == null ? null : Number(out.confidence),
        };
      }
    }
  } catch {
    mei = null;
  }

  // Learning style (LBI) — COMPOSE the learner profile; the engine returns
  // learning_style=null + band 'no_data' when there is no LBI history, so we
  // surface it ONLY when actually measured (never a fabricated default).
  let learning_style: { style: string; band: string | null; sessions_analyzed: number } | null = null;
  try {
    const email = await resolveUserEmail(pool, userId);
    if (email) {
      const composite: any = await buildCompositeProfile(email, pool);
      const learner = composite?.learner ?? null;
      if (learner?.learning_style) {
        learning_style = {
          style: String(learner.learning_style),
          band: learner.lbi_band ?? null,
          sessions_analyzed: Number(learner.sessions_analyzed ?? 0),
        };
      }
    }
  } catch {
    learning_style = null;
  }

  return {
    ok: true,
    user_id: userId,
    values,
    top_matches,
    mei,
    learning_style,
    compatibility_score,
    coverage: {
      values: !!values?.measurable,
      matches: top_matches.length > 0,
      mei: !!mei,
      learning_style: !!learning_style,
    },
    generated_at: new Date().toISOString(),
  };
}
