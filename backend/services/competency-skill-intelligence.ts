/**
 * Competency → Skill Intelligence — 98X Gap Closure, Phase 5 (additive, flag-gated, reversible).
 *
 * THE CHAIN: Competency → Skill → Learning → Certification → Role → Career Path.
 *
 * HONESTY FINDING (verified against the live DB, 2026-06-23): the Phase-5 plan doc assumed no
 * certification entity and proposed three net-new tables. Ground truth: the LIP namespace ALREADY
 * provides them — `lip_certifications` (skills_validated[] + competency_codes[]),
 * `lip_cert_competency_map`, and `rr_certifications` (role→cert). Building parallel cert/role
 * mapping tables would violate the platform rule "do NOT add parallel namespaces", so this module
 * COMPOSES the existing surfaces read-only and adds ONLY the single genuinely-missing hop:
 *
 *   comp_skill_map — onto_competencies (419-genome) → cg_skill_requirements.skill_key, by
 *   confidence-scored name/slug/token match. UNCLASSIFIED where no match (skill_key NULL) — the
 *   honest ceiling is LOW because the genome is abstract O*NET vocabulary ("Reading Comprehension")
 *   while cg skill_keys are concrete job skills ("cloud_aws"). Never fabricated.
 *
 * Downstream hops REUSE live data only:
 *   - Skill → Learning : cg_skill_resource_map  → cg_learning_resources   (by skill_key)
 *   - Skill → Cert     : lip_certifications.skills_validated[]            (array overlap)
 *   - Skill → Role     : cg_skill_requirements  → cg_roles                (roles requiring skill)
 *   - Role  → Career   : cg_role_edges                                    (role transitions)
 *
 * REVERSIBILITY: comp_skill_map rows are stamped `source='98x_phase5'`; the table is created
 * lazily on the WRITE (seed) path only, and is fully reversible by `DELETE WHERE source=...` or
 * dropping the table. No existing table is ever mutated.
 *
 * SAFETY: every read uses a to_regclass probe + degrades (never throws). Runtime is read-only —
 * no scoring math, no recomputation, no edits to the genome / graph / certification content.
 */

import type { Pool } from 'pg';

export const COMPETENCY_SKILL_INTELLIGENCE_VERSION = 'csi-1.0.0';
export const COMP_SKILL_MAP_SOURCE = '98x_phase5';

const HIGH_CONF = 0.95;       // exact normalized name/slug match
const TOKEN_SUBSET_CONF = 0.7; // one token-set fully contained in the other (multi-token)
const MIN_JACCARD = 0.5;       // floor for a token-overlap match to count at all

export interface CompSkillMatch {
  competency_id: string;
  skill_key: string | null;
  skill_label: string | null;
  match_method: 'exact_name' | 'slug' | 'token' | 'UNCLASSIFIED';
  confidence: number;
}

export interface SeedResult {
  apply: boolean;
  competencies_total: number;
  skills_total: number;
  matched_competencies: number;
  unclassified_competencies: number;
  rows_to_write: number;
  rows_written: number;   // rows that actually persisted (apply only)
  write_failures: number; // honest count of per-row insert failures (apply only)
  coverage_pct: number;   // matched / total
  source: string;
  note: string;
}

export interface ChainHop {
  name: string;
  table_source: string;
  available: boolean;        // false ONLY when the substrate table is missing/unreadable
  count: number;
  coverage_note: string;
  items: Array<Record<string, unknown>>;
}

export interface CompetencySkillChain {
  ok: boolean;
  competency_id: string;
  competency: { id: string; canonical_name: string; slug: string | null } | null;
  resolved: boolean;         // false → unknown competency id (honest)
  hops: {
    skills: ChainHop;
    learning: ChainHop;
    certifications: ChainHop;
    roles: ChainHop;
    career_paths: ChainHop;
  };
  notes: string[];
}

// ---------------------------------------------------------------------------
// Matching helpers (pure, deterministic — used by the seed only)
// ---------------------------------------------------------------------------
function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokenSet(s: string | null | undefined): Set<string> {
  return new Set(norm(s).split(' ').filter((t) => t.length > 2));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

interface SkillRow { skill_key: string; skill_label: string | null; }
interface CompRow { id: string; canonical_name: string; slug: string | null; }

/** Best skill match for one competency, or null when nothing clears MIN_JACCARD. Deterministic:
 *  highest confidence wins, ties broken by skill_key ascending. */
function bestSkillFor(comp: CompRow, skills: SkillRow[]): CompSkillMatch | null {
  const compName = norm(comp.canonical_name);
  const compSlug = norm((comp.slug ?? '').replace(/-/g, ' '));
  const compTokens = tokenSet(comp.canonical_name);
  let best: CompSkillMatch | null = null;

  const consider = (m: CompSkillMatch) => {
    if (!best || m.confidence > best.confidence ||
        (m.confidence === best.confidence && (m.skill_key ?? '') < (best.skill_key ?? ''))) {
      best = m;
    }
  };

  for (const s of skills) {
    const skKey = norm(s.skill_key.replace(/_/g, ' '));
    const skLabel = norm(s.skill_label);
    const skTokens = new Set<string>([...tokenSet(s.skill_key.replace(/_/g, ' ')), ...tokenSet(s.skill_label)]);

    // 1. exact normalized name / slug match → high confidence
    if (compName && (compName === skKey || compName === skLabel)) {
      consider({ competency_id: comp.id, skill_key: s.skill_key, skill_label: s.skill_label, match_method: 'exact_name', confidence: HIGH_CONF });
      continue;
    }
    if (compSlug && (compSlug === skKey || compSlug === skLabel)) {
      consider({ competency_id: comp.id, skill_key: s.skill_key, skill_label: s.skill_label, match_method: 'slug', confidence: HIGH_CONF });
      continue;
    }
    // 2. multi-token subset (one fully contained in the other) → token confidence
    if (compTokens.size >= 2 && skTokens.size >= 2) {
      const aSubB = [...compTokens].every((t) => skTokens.has(t));
      const bSubA = [...skTokens].every((t) => compTokens.has(t));
      if (aSubB || bSubA) {
        consider({ competency_id: comp.id, skill_key: s.skill_key, skill_label: s.skill_label, match_method: 'token', confidence: TOKEN_SUBSET_CONF });
        continue;
      }
    }
    // 3. token overlap above the floor → scaled confidence
    const j = jaccard(compTokens, skTokens);
    if (j >= MIN_JACCARD) {
      consider({ competency_id: comp.id, skill_key: s.skill_key, skill_label: s.skill_label, match_method: 'token', confidence: Math.round(j * 100) / 100 });
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Schema (WRITE path only)
// ---------------------------------------------------------------------------
export async function ensureCompSkillMapSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comp_skill_map (
      id            SERIAL PRIMARY KEY,
      competency_id TEXT        NOT NULL,
      skill_key     TEXT,
      skill_label   TEXT,
      match_method  TEXT        NOT NULL,
      confidence    NUMERIC     NOT NULL DEFAULT 0,
      source        TEXT        NOT NULL DEFAULT '${COMP_SKILL_MAP_SOURCE}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (competency_id, skill_key)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comp_skill_map_competency ON comp_skill_map (competency_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comp_skill_map_skill ON comp_skill_map (skill_key)`);
  // The table UNIQUE(competency_id, skill_key) does NOT dedup NULL skill_key rows in Postgres,
  // so guarantee one-UNCLASSIFIED-row-per-competency explicitly with a partial unique index.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_skill_map_unclassified ON comp_skill_map (competency_id) WHERE skill_key IS NULL`);
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]).catch(() => ({ rows: [{ t: null }] }));
  return Boolean(r.rows[0]?.t);
}

// ---------------------------------------------------------------------------
// Seed (reversible reference crosswalk) — dry-run unless apply=true
// ---------------------------------------------------------------------------
export async function seedCompSkillMap(pool: Pool, apply = false): Promise<SeedResult> {
  const comps = (await pool.query(
    `SELECT id, canonical_name, slug FROM onto_competencies WHERE COALESCE(deprecated,false) = false`,
  ).catch(() => ({ rows: [] as CompRow[] }))).rows as CompRow[];
  const skills = (await pool.query(
    `SELECT DISTINCT skill_key, skill_label FROM cg_skill_requirements WHERE skill_key IS NOT NULL`,
  ).catch(() => ({ rows: [] as SkillRow[] }))).rows as SkillRow[];

  const matches: CompSkillMatch[] = [];
  let matched = 0;
  for (const c of comps) {
    const m = bestSkillFor(c, skills);
    if (m) { matches.push(m); matched++; }
    else matches.push({ competency_id: c.id, skill_key: null, skill_label: null, match_method: 'UNCLASSIFIED', confidence: 0 });
  }

  let rowsWritten = 0;
  let writeFailures = 0;
  if (apply && comps.length > 0) {
    await ensureCompSkillMapSchema(pool);
    // Reversible refresh: clear only THIS provenance, then re-insert.
    await pool.query(`DELETE FROM comp_skill_map WHERE source = $1`, [COMP_SKILL_MAP_SOURCE]);
    for (const m of matches) {
      try {
        await pool.query(
          `INSERT INTO comp_skill_map (competency_id, skill_key, skill_label, match_method, confidence, source)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (competency_id, skill_key) DO UPDATE
             SET skill_label = EXCLUDED.skill_label,
                 match_method = EXCLUDED.match_method,
                 confidence = EXCLUDED.confidence,
                 source = EXCLUDED.source`,
          [m.competency_id, m.skill_key, m.skill_label, m.match_method, m.confidence, COMP_SKILL_MAP_SOURCE],
        );
        rowsWritten++;
      } catch {
        writeFailures++; // honest: never throw, but never silently under-report
      }
    }
  }

  return {
    apply,
    competencies_total: comps.length,
    skills_total: skills.length,
    matched_competencies: matched,
    unclassified_competencies: comps.length - matched,
    rows_to_write: matches.length,
    rows_written: rowsWritten,
    write_failures: writeFailures,
    coverage_pct: comps.length ? Math.round((matched / comps.length) * 1000) / 10 : 0,
    source: COMP_SKILL_MAP_SOURCE,
    note: apply
      ? 'comp_skill_map refreshed (reversible by source=98x_phase5)'
      : 'dry-run only — no rows written',
  };
}

/** Reversibility surfaced as a callable: remove every Phase-5 crosswalk row. */
export async function rollbackCompSkillMap(pool: Pool): Promise<{ ok: boolean; deleted: number }> {
  if (!(await tableExists(pool, 'comp_skill_map'))) return { ok: true, deleted: 0 };
  const r = await pool.query(`DELETE FROM comp_skill_map WHERE source = $1`, [COMP_SKILL_MAP_SOURCE]).catch(() => ({ rowCount: 0 }));
  return { ok: true, deleted: r.rowCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Coverage metric (success metric — read-only)
// ---------------------------------------------------------------------------
export async function getCompetencySkillCoverage(pool: Pool): Promise<{
  available: boolean;
  competencies_total: number;
  competencies_with_skill: number;
  coverage_pct: number;
  note: string;
}> {
  if (!(await tableExists(pool, 'comp_skill_map')) || !(await tableExists(pool, 'onto_competencies'))) {
    return { available: false, competencies_total: 0, competencies_with_skill: 0, coverage_pct: 0, note: 'comp_skill_map not yet seeded' };
  }
  const total = Number((await pool.query(
    `SELECT count(*)::int n FROM onto_competencies WHERE COALESCE(deprecated,false) = false`,
  ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n);
  const withSkill = Number((await pool.query(
    `SELECT count(DISTINCT competency_id)::int n FROM comp_skill_map WHERE skill_key IS NOT NULL`,
  ).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n);
  return {
    available: true,
    competencies_total: total,
    competencies_with_skill: withSkill,
    coverage_pct: total ? Math.round((withSkill / total) * 1000) / 10 : 0,
    note: 'honest ceiling = name/token-matchable competencies (genome vocabulary is abstract)',
  };
}

// ---------------------------------------------------------------------------
// Chain resolver (read-only composition)
// ---------------------------------------------------------------------------
function emptyHop(name: string, source: string, available: boolean, note: string): ChainHop {
  return { name, table_source: source, available, count: 0, coverage_note: note, items: [] };
}

export async function resolveCompetencySkillChain(pool: Pool, competencyId: string): Promise<CompetencySkillChain> {
  const notes: string[] = [];

  // Competency anchor
  let competency: CompetencySkillChain['competency'] = null;
  if (await tableExists(pool, 'onto_competencies')) {
    const c = await pool.query(
      `SELECT id, canonical_name, slug FROM onto_competencies WHERE id = $1 LIMIT 1`, [competencyId],
    ).catch(() => ({ rows: [] as CompRow[] }));
    if (c.rows[0]) competency = { id: c.rows[0].id, canonical_name: c.rows[0].canonical_name, slug: c.rows[0].slug };
  }
  const resolved = competency != null;
  if (!resolved) notes.push('unknown competency_id — chain is empty (honest)');

  // Hop 1: Competency → Skills (comp_skill_map, the net-new crosswalk)
  let skills = emptyHop('skills', 'comp_skill_map', false, 'comp_skill_map not seeded');
  let skillKeys: string[] = [];
  if (await tableExists(pool, 'comp_skill_map')) {
    const r = await pool.query(
      `SELECT skill_key, skill_label, match_method, confidence
         FROM comp_skill_map
        WHERE competency_id = $1 AND skill_key IS NOT NULL
        ORDER BY confidence DESC, skill_key ASC`, [competencyId],
    ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
    skillKeys = r.rows.map((x) => String(x.skill_key));
    skills = {
      name: 'skills', table_source: 'comp_skill_map', available: true, count: r.rows.length,
      coverage_note: r.rows.length ? 'confidence-scored name/token match' : 'UNCLASSIFIED — no skill match for this competency (honest)',
      items: r.rows,
    };
  }

  // Hop 2: Skills → Learning (cg_skill_resource_map → cg_learning_resources)
  let learning = emptyHop('learning', 'cg_skill_resource_map+cg_learning_resources', false, 'learning tables unavailable');
  if (await tableExists(pool, 'cg_skill_resource_map') && await tableExists(pool, 'cg_learning_resources')) {
    if (skillKeys.length === 0) {
      learning = emptyHop('learning', 'cg_skill_resource_map+cg_learning_resources', true, 'no upstream skills → no learning (honest)');
    } else {
      const r = await pool.query(
        `SELECT DISTINCT lr.id, lr.title, lr.resource_type, lr.provider, lr.difficulty, lr.cost_band, srm.skill_key
           FROM cg_skill_resource_map srm
           JOIN cg_learning_resources lr ON lr.id = srm.resource_id
          WHERE srm.skill_key = ANY($1) AND COALESCE(lr.is_active, true) = true
          ORDER BY lr.title ASC LIMIT 50`, [skillKeys],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      learning = { name: 'learning', table_source: 'cg_skill_resource_map+cg_learning_resources', available: true, count: r.rows.length, coverage_note: 'live learning resources mapped by skill_key', items: r.rows };
    }
  }

  // Hop 3: Skills → Certifications (lip_certifications.skills_validated[] overlap)
  let certifications = emptyHop('certifications', 'lip_certifications', false, 'lip_certifications unavailable');
  if (await tableExists(pool, 'lip_certifications')) {
    if (skillKeys.length === 0) {
      certifications = emptyHop('certifications', 'lip_certifications', true, 'no upstream skills → no certifications (honest)');
    } else {
      // Build token candidates from skill_keys ("cloud_aws" → cloud, aws) for array overlap.
      const tokenCandidates = Array.from(new Set(
        skillKeys.flatMap((k) => [k, ...k.split(/[_\s]+/)].filter((t) => t.length > 2)),
      ));
      const r = await pool.query(
        `SELECT id, title, issuing_body, type, difficulty_level, prestige_score, skills_validated, competency_codes, industry_codes
           FROM lip_certifications
          WHERE COALESCE(is_active, true) = true AND skills_validated && $1::text[]
          ORDER BY prestige_score DESC NULLS LAST LIMIT 25`, [tokenCandidates],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      certifications = { name: 'certifications', table_source: 'lip_certifications', available: true, count: r.rows.length, coverage_note: 'live certifications matched by skills_validated[] overlap (reused, not duplicated)', items: r.rows };
    }
  }

  // Hop 4: Skills → Roles (cg_skill_requirements → cg_roles : roles that REQUIRE these skills)
  let roles = emptyHop('roles', 'cg_skill_requirements+cg_roles', false, 'role tables unavailable');
  let roleIds: number[] = [];
  if (await tableExists(pool, 'cg_skill_requirements') && await tableExists(pool, 'cg_roles')) {
    if (skillKeys.length === 0) {
      roles = emptyHop('roles', 'cg_skill_requirements+cg_roles', true, 'no upstream skills → no roles (honest)');
    } else {
      const r = await pool.query(
        `SELECT DISTINCT ro.id, ro.title, ro.demand_score, sr.skill_key, sr.importance
           FROM cg_skill_requirements sr
           JOIN cg_roles ro ON ro.id = sr.role_id
          WHERE sr.skill_key = ANY($1) AND COALESCE(ro.is_active, true) = true
          ORDER BY ro.demand_score DESC NULLS LAST LIMIT 50`, [skillKeys],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      roleIds = Array.from(new Set(r.rows.map((x) => Number(x.id)).filter((n) => Number.isFinite(n))));
      roles = { name: 'roles', table_source: 'cg_skill_requirements+cg_roles', available: true, count: r.rows.length, coverage_note: 'roles whose requirements include the mapped skills', items: r.rows };
    }
  }

  // Hop 5: Roles → Career Paths (cg_role_edges transitions)
  let careerPaths = emptyHop('career_paths', 'cg_role_edges', false, 'cg_role_edges unavailable');
  if (await tableExists(pool, 'cg_role_edges')) {
    if (roleIds.length === 0) {
      careerPaths = emptyHop('career_paths', 'cg_role_edges', true, 'no upstream roles → no career transitions (honest)');
    } else {
      const r = await pool.query(
        `SELECT e.from_role_id, e.to_role_id, fr.title AS from_title, tr.title AS to_title, e.edge_type, e.transition_probability, e.difficulty
           FROM cg_role_edges e
           LEFT JOIN cg_roles fr ON fr.id = e.from_role_id
           LEFT JOIN cg_roles tr ON tr.id = e.to_role_id
          WHERE e.from_role_id = ANY($1)
          ORDER BY e.transition_probability DESC NULLS LAST LIMIT 50`, [roleIds],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      careerPaths = { name: 'career_paths', table_source: 'cg_role_edges', available: true, count: r.rows.length, coverage_note: 'role transitions from the matched roles', items: r.rows };
    }
  }

  if (resolved && skillKeys.length === 0) notes.push('competency resolved but maps to no skill (UNCLASSIFIED) — downstream hops are honestly empty');

  return {
    ok: true,
    competency_id: competencyId,
    competency,
    resolved,
    hops: { skills, learning, certifications, roles, career_paths: careerPaths },
    notes,
  };
}
