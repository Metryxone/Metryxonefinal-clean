/**
 * PHASE 4.2 — Career Match Engine (compose + rank).
 *
 * An additive, read-only, never-throws layer that COMPOSES the already-built
 * subject profiles — competency runtime (getProfile), EI profile (buildEiProfile),
 * Phase-4.3 career readiness (buildCareerReadiness) and role-readiness-v2's
 * anchor-role requirement fit (computeRoleReadinessV2) — and RANKS the live
 * Career-Graph role catalog (`cg_roles`) into the subject's top role MATCHES, each
 * carrying a `match_percentage`, a SEPARATE `match_confidence` band and a templated
 * `match_explanation` (per-role decomposition by the pure career-fit-engine).
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES the already-computed profiles + reads `cg_roles` AS-STORED — it
 *     NEVER recomputes a competency/readiness/EI score and NEVER fabricates a role,
 *     a number or a requirement.
 *   - The role catalog carries MARKET attributes only (NO per-role competency
 *     requirements), so a requirement-backed fit is real ONLY for the subject's
 *     anchor role; every other match is 'Provisional' (supply + categorical
 *     alignment), and Match% / Confidence stay SEPARATE axes (never composited).
 *   - GET-never-writes: ALL composition (getProfile / buildEiProfile /
 *     buildCareerReadiness / computeRoleReadinessV2 transitively ensure the
 *     competency-runtime schema) runs ONLY when competencyRuntimeReady(pool) is
 *     true; absent schema => honest-empty, ZERO DDL on a read. Config (rules) and
 *     history reads use to_regclass probes + inline defaults. The ONLY write/DDL
 *     paths are the explicit POST snapshot and the admin rules CRUD / seed.
 *   - Outputs are DEVELOPMENTAL / MARKET SIGNALS ONLY — never hiring/promotion/
 *     suitability predictions.
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import { competencyRuntimeReady } from './career-gap-engine.js';
import { getProfile } from './competency-runtime.js';
import { buildEiProfile } from './ei-profile-engine.js';
import { buildCareerReadiness } from './career-readiness-aggregator.js';
import { computeRoleReadinessV2 } from './role-readiness-v2.js';
import { listRoles, getRoleById, type CgRole } from './career-graph-engine.js';
import {
  CAREER_FIT_VERSION,
  FIT_COMPONENT_ORDER,
  computeRoleFit,
  bandToConfidence,
  type MatchingRules,
  type MatchConfidenceBand,
  type SubjectSignals,
  type RoleFit,
} from './career-fit-engine.js';

export const CAREER_MATCH_VERSION = '4.2.0';

// ---------------------------------------------------------------------------
// Config-as-data: the inline DEFAULT matching rules (source of truth flag-ON
// with NO seed required). The career_matching_rules table is an OPTIONAL
// admin-editable override — when a 'default' row is present it replaces these.
// ---------------------------------------------------------------------------

export const DEFAULT_MATCHING_RULES: MatchingRules = {
  version: CAREER_MATCH_VERSION,
  weights: {
    competency_fit: 0.35,
    capability_fit: 0.15,
    readiness_fit: 0.2,
    ei_fit: 0.1,
    function_alignment: 0.12,
    seniority_alignment: 0.08,
  },
  caps: {
    top_n: 8,
    function_aligned: 100,
    function_other: 40,
    seniority_aligned: 100,
    seniority_other: 50,
    max_non_anchor_confidence: 'Provisional',
  },
  thresholds: { strong: 75, good: 60, partial: 40 },
  templates: {
    anchor:
      'Your anchor role {role} ({function}) matches at {match}% ({band}) — the only match backed by a real per-role competency-requirement fit.',
    aligned:
      '{role} ({function}) matches at {match}% ({band}) — same function as your anchor; a Provisional signal driven by your measured capability and function/seniority alignment (no per-role requirement data).',
    market:
      '{role} ({function}) matches at {match}% ({band}) — a Provisional, directional signal from your measured capability and categorical alignment; the catalog has no competency requirements for this role.',
    not_measurable:
      'No measurable match for {role} — no competency / readiness / EI signal exists for this subject (honest absence, nothing fabricated).',
  },
};

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

export interface CareerMatchEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  anchor: {
    role_id: string | null;
    role_title: string | null;
    catalog_role_id: number | null;
    catalog_function: string | null;
    catalog_seniority: string | null;
    matched_in_catalog: boolean;
    /** REAL requirement-backed anchor fit (role_match.score) — null if unscored. */
    competency_fit_score: number | null;
    fit_band: string | null;
  };
  matches: RoleFit[];
  summary: {
    roles_considered: number;
    matches_returned: number;
    anchor_in_matches: boolean;
    requirement_backed_count: number;
    provisional_count: number;
    top_match: { role_title: string; match_percentage: number; match_confidence: MatchConfidenceBand } | null;
  };
  /** Coverage (signal supply present) and Confidence (requirement backing) — SEPARATE. */
  axes: {
    coverage: { measurable: boolean; coverage_pct: number | null; detail: string };
    confidence: { band: MatchConfidenceBand; basis: string; caps: string[] };
  };
  catalog: { roles_considered: number; source: string };
  config: { rules_source: 'db' | 'defaults' };
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Match the anchor role TITLE to a cg_roles row (exact, then token-overlap).
 *  Returns the matched role or null — never fabricates. (Mirrors 4.7.) */
function matchAnchor(title: string | null, roles: CgRole[]): CgRole | null {
  if (!title) return null;
  const t = title.trim().toLowerCase();
  if (!t) return null;
  const exact = roles.find((r) => r.title.trim().toLowerCase() === t);
  if (exact) return exact;
  const tokens = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  if (tokens.size === 0) return null;
  let best: CgRole | null = null;
  let bestOverlap = 0;
  for (const r of roles) {
    const rt = r.title.trim().toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const overlap = rt.filter((w) => tokens.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = r;
    }
  }
  return bestOverlap >= 1 ? best : null;
}

/** Compose the subject's signal-set ONCE (read-only; caller must have verified
 *  competencyRuntimeReady so the transitive ensure-schema is a no-op, not DDL). */
async function composeSubjectSignals(
  pool: Pool,
  sid: string,
  roles: CgRole[],
  notes: string[],
): Promise<SubjectSignals> {
  const competency = await getProfile(pool, sid).catch((e) => {
    notes.push(`Competency profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });
  const ei = await buildEiProfile(pool, sid).catch((e) => {
    notes.push(`EI profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });
  const readiness = await buildCareerReadiness(pool, sid).catch((e) => {
    notes.push(`Career readiness unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });
  const role = await computeRoleReadinessV2(pool, sid).catch((e) => {
    notes.push(`Role readiness unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });

  const anchorTitle = role?.role_title ?? null;
  const anchorMatch = matchAnchor(anchorTitle, roles);

  const competencyMeasured = competency?.measured === true && competency.overall_score != null;
  const readinessMeasurable = readiness?.overall?.measurable === true && readiness.overall.score != null;
  const eiMeasurable = ei?.overall_ei?.measurable === true && ei.overall_ei.ei_score != null;

  // Subject-level confidence axis: prefer EI confidence, else readiness band.
  const subjectConfidence: MatchConfidenceBand = eiMeasurable
    ? bandToConfidence(ei!.overall_ei.band, true)
    : bandToConfidence(readiness?.overall?.band ?? null, readinessMeasurable);

  const measurable = competencyMeasured || readinessMeasurable || eiMeasurable;

  return {
    measurable,
    competency: competency
      ? { measured: competencyMeasured, overall_score: competency.overall_score }
      : null,
    readiness: readiness
      ? { measurable: readinessMeasurable, score: readiness.overall.score, band: readiness.overall.band }
      : null,
    ei: ei
      ? { measurable: eiMeasurable, score: ei.overall_ei.ei_score, band: ei.overall_ei.band }
      : null,
    anchor: {
      role_id: role?.role_id ?? competency?.role_id ?? null,
      role_title: anchorTitle,
      catalog_role_id: anchorMatch?.id ?? null,
      function_area: anchorMatch?.function_area ?? null,
      seniority: anchorMatch?.seniority ?? null,
      competency_fit_score:
        role?.role_match?.score != null && role.role_match.fit_band !== 'unmeasured'
          ? role.role_match.score
          : null,
      fit_band: role?.role_match?.label ?? null,
    },
    confidence_band: subjectConfidence,
  };
}

function emptyEnvelope(
  sid: string,
  rolesConsidered: number,
  rulesSource: 'db' | 'defaults',
  notes: string[],
): CareerMatchEnvelope {
  return {
    ok: true,
    subject_id: sid,
    version: CAREER_MATCH_VERSION,
    generated_at: new Date().toISOString(),
    measurable: false,
    anchor: {
      role_id: null,
      role_title: null,
      catalog_role_id: null,
      catalog_function: null,
      catalog_seniority: null,
      matched_in_catalog: false,
      competency_fit_score: null,
      fit_band: null,
    },
    matches: [],
    summary: {
      roles_considered: rolesConsidered,
      matches_returned: 0,
      anchor_in_matches: false,
      requirement_backed_count: 0,
      provisional_count: 0,
      top_match: null,
    },
    axes: {
      coverage: { measurable: false, coverage_pct: null, detail: 'no measurable subject signal' },
      confidence: { band: 'None', basis: 'not measurable', caps: ['not_measurable'] },
    },
    catalog: { roles_considered: rolesConsidered, source: 'cg_roles (read-only)' },
    config: { rules_source: rulesSource },
    language_policy: LANGUAGE_POLICY,
    source_versions: { career_match: CAREER_MATCH_VERSION, career_fit: CAREER_FIT_VERSION },
    notes,
  };
}

// ---------------------------------------------------------------------------
// career_match_engine — compose subject signals + rank cg_roles into top matches.
// PURE compose, never-throws. GET-never-writes (gated by competencyRuntimeReady).
// ---------------------------------------------------------------------------

export async function buildCareerMatch(pool: Pool, subjectId: string): Promise<CareerMatchEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Read the live role catalog (read-only SELECT; listRoles is never-throws).
  const catalog = await listRoles(pool, { limit: 200 }).catch(() => ({ roles: [] as CgRole[], total: 0 }));
  const roles = catalog.roles;

  // OPTIONAL admin-edited rules; fall back to inline defaults (no DDL on read).
  const { rules, source: rulesSource } = await loadMatchingRules(pool);

  // GET-never-writes: only compose when the competency-runtime schema already
  // exists (the composed engines transitively ensure-schema otherwise).
  const runtimeReady = await competencyRuntimeReady(pool);
  if (!runtimeReady) {
    notes.push(
      'Career matches not measurable — competency runtime schema is not initialized (read-only; no schema created).',
    );
    return emptyEnvelope(sid, roles.length, rulesSource, notes);
  }

  const signals = await composeSubjectSignals(pool, sid, roles, notes);

  if (roles.length === 0) {
    notes.push('Role catalog (cg_roles) is empty — matches are honestly empty (never fabricated).');
  }
  if (!signals.measurable) {
    notes.push(
      'No measurable subject signal (competency / readiness / EI) — matches are honestly empty (never fabricated).',
    );
    return emptyEnvelope(sid, roles.length, rulesSource, notes);
  }

  // Decompose fit for every catalog role, keep measurable, rank by match% desc
  // (anchor wins ties, then title for determinism), surface the top-N.
  const allFits = roles
    .map((role) => computeRoleFit(role, signals, rules))
    .filter((f) => f.measurable && f.match_percentage != null);

  allFits.sort(
    (a, b) =>
      (b.match_percentage as number) - (a.match_percentage as number) ||
      Number(b.is_anchor) - Number(a.is_anchor) ||
      a.role_title.localeCompare(b.role_title),
  );

  const topN = Math.max(1, Math.round(rules.caps.top_n ?? DEFAULT_MATCHING_RULES.caps.top_n));
  const matches = allFits.slice(0, topN);

  const anchorMatch = signals.anchor?.catalog_role_id ?? null;
  const anchorInMatches = matches.some((m) => m.is_anchor);
  const requirementBacked = matches.filter((m) => m.evidence.requirement_backed === true).length;
  const provisional = matches.length - requirementBacked;
  const top = matches[0] ?? null;

  if (signals.anchor?.role_title && !anchorMatch) {
    notes.push(
      `Anchor role "${signals.anchor.role_title}" did not match any catalog role by title — every match is Provisional (no requirement-backed fit available).`,
    );
  }

  // Coverage axis = present supply components on the top match (consistent fraction).
  const coverageRef = top ?? allFits[0] ?? null;
  const coveragePct = coverageRef ? coverageRef.coverage.coverage_pct : null;

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_MATCH_VERSION,
    generated_at: new Date().toISOString(),
    measurable: matches.length > 0,
    anchor: {
      role_id: signals.anchor?.role_id ?? null,
      role_title: signals.anchor?.role_title ?? null,
      catalog_role_id: signals.anchor?.catalog_role_id ?? null,
      catalog_function: signals.anchor?.function_area ?? null,
      catalog_seniority: signals.anchor?.seniority ?? null,
      matched_in_catalog: anchorMatch != null,
      competency_fit_score: signals.anchor?.competency_fit_score ?? null,
      fit_band: signals.anchor?.fit_band ?? null,
    },
    matches,
    summary: {
      roles_considered: roles.length,
      matches_returned: matches.length,
      anchor_in_matches: anchorInMatches,
      requirement_backed_count: requirementBacked,
      provisional_count: provisional,
      top_match: top
        ? {
            role_title: top.role_title,
            match_percentage: top.match_percentage as number,
            match_confidence: top.match_confidence,
          }
        : null,
    },
    axes: {
      coverage: {
        measurable: matches.length > 0,
        coverage_pct: coveragePct,
        detail:
          coveragePct != null
            ? `${coveragePct}% of declared fit components backed by real data on the top match`
            : 'no measurable match',
      },
      confidence: {
        band: top?.match_confidence ?? 'None',
        basis: requirementBacked > 0
          ? 'Anchor match is requirement-backed; other matches are Provisional (supply + categorical alignment).'
          : 'No requirement-backed anchor match — all matches are Provisional (directional market signal).',
        caps: requirementBacked > 0 ? [] : ['no_requirement_backed_match'],
      },
    },
    catalog: { roles_considered: roles.length, source: 'cg_roles (read-only)' },
    config: { rules_source: rulesSource },
    language_policy: LANGUAGE_POLICY,
    source_versions: { career_match: CAREER_MATCH_VERSION, career_fit: CAREER_FIT_VERSION },
    notes,
  };
}

/** Compose + decompose the fit for ONE specific catalog role (by cg_roles.id). */
export async function buildCareerMatchForRole(
  pool: Pool,
  subjectId: string,
  roleId: number,
): Promise<{ role_fit: RoleFit | null; envelope_summary: Pick<CareerMatchEnvelope, 'ok' | 'subject_id' | 'version' | 'generated_at' | 'measurable' | 'anchor' | 'axes' | 'config' | 'language_policy' | 'source_versions' | 'notes'> }> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];
  const { rules, source: rulesSource } = await loadMatchingRules(pool);

  const runtimeReady = await competencyRuntimeReady(pool);
  if (!runtimeReady) {
    notes.push('Career match not measurable — competency runtime schema is not initialized (read-only; no schema created).');
    const empty = emptyEnvelope(sid, 0, rulesSource, notes);
    return { role_fit: null, envelope_summary: pickSummary(empty) };
  }

  const role = await getRoleById(pool, roleId).catch(() => null);
  // Pull a small catalog window so anchor title matching still works.
  const catalog = await listRoles(pool, { limit: 200 }).catch(() => ({ roles: [] as CgRole[], total: 0 }));
  const signals = await composeSubjectSignals(pool, sid, catalog.roles, notes);

  if (!role) {
    notes.push(`Role id ${roleId} not found in cg_roles — honest empty (never fabricated).`);
    const empty = emptyEnvelope(sid, catalog.roles.length, rulesSource, notes);
    return { role_fit: null, envelope_summary: pickSummary(empty) };
  }
  if (!signals.measurable) {
    notes.push('No measurable subject signal — fit is honestly empty (never fabricated).');
  }

  const roleFit = signals.measurable ? computeRoleFit(role, signals, rules) : null;

  const base = emptyEnvelope(sid, catalog.roles.length, rulesSource, notes);
  base.measurable = !!roleFit?.measurable;
  base.anchor = {
    role_id: signals.anchor?.role_id ?? null,
    role_title: signals.anchor?.role_title ?? null,
    catalog_role_id: signals.anchor?.catalog_role_id ?? null,
    catalog_function: signals.anchor?.function_area ?? null,
    catalog_seniority: signals.anchor?.seniority ?? null,
    matched_in_catalog: signals.anchor?.catalog_role_id != null,
    competency_fit_score: signals.anchor?.competency_fit_score ?? null,
    fit_band: signals.anchor?.fit_band ?? null,
  };
  if (roleFit) {
    base.axes = {
      coverage: {
        measurable: roleFit.measurable,
        coverage_pct: roleFit.coverage.coverage_pct,
        detail: `${roleFit.coverage.coverage_pct}% of declared fit components backed by real data`,
      },
      confidence: {
        band: roleFit.match_confidence,
        basis: roleFit.evidence.requirement_backed
          ? 'Requirement-backed anchor fit.'
          : 'Provisional (supply + categorical alignment; no per-role requirements).',
        caps: roleFit.evidence.requirement_backed ? [] : ['no_requirement_backed_match'],
      },
    };
  }
  return { role_fit: roleFit, envelope_summary: pickSummary(base) };
}

function pickSummary(env: CareerMatchEnvelope) {
  return {
    ok: env.ok,
    subject_id: env.subject_id,
    version: env.version,
    generated_at: env.generated_at,
    measurable: env.measurable,
    anchor: env.anchor,
    axes: env.axes,
    config: env.config,
    language_policy: env.language_policy,
    source_versions: env.source_versions,
    notes: env.notes,
  };
}

// ---------------------------------------------------------------------------
// Dashboard projection (PURE — UI-ready view over the composed envelope).
// ---------------------------------------------------------------------------

export interface CareerMatchDashboard {
  subject_id: string;
  measurable: boolean;
  headline: { top_match: string | null; match_percentage: number | null; band: string | null; confidence: MatchConfidenceBand };
  anchor: CareerMatchEnvelope['anchor'];
  rows: Array<{
    rank: number;
    role_title: string;
    function_area: string;
    seniority: string;
    match_percentage: number;
    match_band: string;
    match_confidence: MatchConfidenceBand;
    is_anchor: boolean;
    requirement_backed: boolean;
    explanation: string;
  }>;
  axes: CareerMatchEnvelope['axes'];
  notes: string[];
}

export function buildCareerMatchDashboard(env: CareerMatchEnvelope): CareerMatchDashboard {
  return {
    subject_id: env.subject_id,
    measurable: env.measurable,
    headline: {
      top_match: env.summary.top_match?.role_title ?? null,
      match_percentage: env.summary.top_match?.match_percentage ?? null,
      band: env.matches[0]?.match_band ?? null,
      confidence: env.summary.top_match?.match_confidence ?? 'None',
    },
    anchor: env.anchor,
    rows: env.matches.map((m, i) => ({
      rank: i + 1,
      role_title: m.role_title,
      function_area: m.function_area,
      seniority: m.seniority,
      match_percentage: m.match_percentage as number,
      match_band: m.match_band,
      match_confidence: m.match_confidence,
      is_anchor: m.is_anchor,
      requirement_backed: m.evidence.requirement_backed === true,
      explanation: m.match_explanation,
    })),
    axes: env.axes,
    notes: env.notes,
  };
}

// ---------------------------------------------------------------------------
// Config-as-data table (career_matching_rules) — admin-editable override of the
// inline defaults. The ensure-schema DDL is reached ONLY behind the careerMatch
// flag gate (admin rules CRUD / seed / snapshot POST). Read paths use to_regclass
// probes so a GET NEVER triggers DDL.
// ---------------------------------------------------------------------------

export async function ensureCareerMatchSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_matching_rules (
      id          BIGSERIAL PRIMARY KEY,
      rule_key    TEXT NOT NULL UNIQUE,
      version     TEXT NOT NULL DEFAULT '${CAREER_MATCH_VERSION}',
      weights     JSONB NOT NULL DEFAULT '{}'::jsonb,
      caps        JSONB NOT NULL DEFAULT '{}'::jsonb,
      thresholds  JSONB NOT NULL DEFAULT '{}'::jsonb,
      templates   JSONB NOT NULL DEFAULT '{}'::jsonb,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_match_history (
      id                BIGSERIAL PRIMARY KEY,
      subject_id        TEXT NOT NULL,
      role_id           TEXT,
      role_title        TEXT,
      measurable        BOOLEAN NOT NULL DEFAULT FALSE,
      matches_returned  INTEGER NOT NULL DEFAULT 0,
      top_match         TEXT,
      top_match_pct     NUMERIC,
      snapshot          JSONB NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_match_history_subject
       ON career_match_history (subject_id, created_at DESC)`,
  );
}

function mergeRules(row: any): MatchingRules {
  const d = DEFAULT_MATCHING_RULES;
  const weights = { ...d.weights, ...(typeof row.weights === 'string' ? JSON.parse(row.weights) : row.weights ?? {}) };
  const caps = { ...d.caps, ...(typeof row.caps === 'string' ? JSON.parse(row.caps) : row.caps ?? {}) };
  const thresholds = { ...d.thresholds, ...(typeof row.thresholds === 'string' ? JSON.parse(row.thresholds) : row.thresholds ?? {}) };
  const templates = { ...d.templates, ...(typeof row.templates === 'string' ? JSON.parse(row.templates) : row.templates ?? {}) };
  return { version: String(row.version ?? d.version), weights, caps, thresholds, templates };
}

/** Read rule overrides if the table exists AND has an active 'default' row; else
 *  the inline defaults. Read-only (to_regclass probe — NEVER triggers DDL). */
export async function loadMatchingRules(
  pool: Pool,
): Promise<{ source: 'db' | 'defaults'; rules: MatchingRules }> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_matching_rules') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { source: 'defaults', rules: DEFAULT_MATCHING_RULES };
  const r = await pool
    .query(
      `SELECT version, weights, caps, thresholds, templates
         FROM career_matching_rules WHERE rule_key = 'default' AND active = TRUE LIMIT 1`,
    )
    .catch(() => ({ rows: [] as any[] }));
  if (!r.rows.length) return { source: 'defaults', rules: DEFAULT_MATCHING_RULES };
  return { source: 'db', rules: mergeRules(r.rows[0]) };
}

export async function getMatchingRules(pool: Pool): Promise<{ source: 'db' | 'defaults'; rules: MatchingRules }> {
  return loadMatchingRules(pool);
}

/** Upsert the active 'default' rules row (write path — ensures schema first). */
export async function upsertMatchingRules(pool: Pool, partial: Partial<MatchingRules>): Promise<MatchingRules> {
  await ensureCareerMatchSchema(pool);
  const merged: MatchingRules = {
    version: partial.version ?? CAREER_MATCH_VERSION,
    weights: { ...DEFAULT_MATCHING_RULES.weights, ...(partial.weights ?? {}) },
    caps: { ...DEFAULT_MATCHING_RULES.caps, ...(partial.caps ?? {}) },
    thresholds: { ...DEFAULT_MATCHING_RULES.thresholds, ...(partial.thresholds ?? {}) },
    templates: { ...DEFAULT_MATCHING_RULES.templates, ...(partial.templates ?? {}) },
  };
  await pool.query(
    `INSERT INTO career_matching_rules (rule_key, version, weights, caps, thresholds, templates, active, updated_at)
     VALUES ('default', $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, TRUE, NOW())
     ON CONFLICT (rule_key) DO UPDATE SET
       version = EXCLUDED.version, weights = EXCLUDED.weights, caps = EXCLUDED.caps,
       thresholds = EXCLUDED.thresholds, templates = EXCLUDED.templates,
       active = TRUE, updated_at = NOW()`,
    [
      merged.version,
      JSON.stringify(merged.weights),
      JSON.stringify(merged.caps),
      JSON.stringify(merged.thresholds),
      JSON.stringify(merged.templates),
    ],
  );
  return merged;
}

/** Idempotent seed of the inline defaults into the editable table (admin POST). */
export async function seedCareerMatchDefaults(pool: Pool): Promise<{ rules_seeded: boolean }> {
  await upsertMatchingRules(pool, DEFAULT_MATCHING_RULES);
  return { rules_seeded: true };
}

// ---------------------------------------------------------------------------
// Append-only history (explicit POST path only — NEVER on a GET).
// ---------------------------------------------------------------------------

export interface CareerMatchHistoryRow {
  id: number;
  subject_id: string;
  role_id: string | null;
  role_title: string | null;
  measurable: boolean;
  matches_returned: number;
  top_match: string | null;
  top_match_pct: number | null;
  created_at: string;
}

export async function persistCareerMatchSnapshot(
  pool: Pool,
  env: CareerMatchEnvelope,
): Promise<CareerMatchHistoryRow> {
  await ensureCareerMatchSchema(pool);
  const r = await pool.query(
    `INSERT INTO career_match_history
       (subject_id, role_id, role_title, measurable, matches_returned, top_match, top_match_pct, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, subject_id, role_id, role_title, measurable, matches_returned, top_match, top_match_pct, created_at`,
    [
      env.subject_id,
      env.anchor.role_id,
      env.anchor.role_title,
      env.measurable,
      env.summary.matches_returned,
      env.summary.top_match?.role_title ?? null,
      env.summary.top_match?.match_percentage ?? null,
      JSON.stringify(env),
    ],
  );
  const row = r.rows[0];
  return {
    ...row,
    id: Number(row.id),
    top_match_pct: row.top_match_pct != null ? Number(row.top_match_pct) : null,
  } as CareerMatchHistoryRow;
}

export async function listCareerMatchHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerMatchHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_match_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, role_id, role_title, measurable, matches_returned, top_match, top_match_pct, created_at
         FROM career_match_history WHERE subject_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as any[] }));
  return {
    exists: true,
    count: r.rows.length,
    items: r.rows.map((row: any) => ({
      ...row,
      id: Number(row.id),
      top_match_pct: row.top_match_pct != null ? Number(row.top_match_pct) : null,
    })) as CareerMatchHistoryRow[],
  };
}

export { FIT_COMPONENT_ORDER };
