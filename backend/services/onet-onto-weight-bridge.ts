/**
 * O*NET → Role-DNA weight bridge.
 *
 * The app runs TWO disjoint competency ontologies:
 *   - `onto_*` (text ids: role_*, comp_*) — the CURATED ontology the user-facing
 *     Role-DNA pane (OntologyExplorerPage) and Capability Heatmap
 *     (CareerMobilityPage) read via getRoleDNA / getRoleVector → onto_role_weights.
 *   - `ont_*`  (integer ids) — the O*NET-imported library (RolesPanel /
 *     role-crosswalk) where REAL O*NET-derived links live in
 *     map_role_competency.source = 'onet_derived' (estimated weights inherited
 *     from related SOC occupations by deriveUnratedRoleCompetencies).
 *
 * The two never met, so the user pages' "Estimated / inherited" honesty badge
 * could never fire. This bridge maps the O*NET-derived links across the two
 * namespaces (role and competency by synonym/fuzzy name) and writes them into
 * onto_role_weights stamped source='onet_derived', so the badge lights up on the
 * genuinely estimated competencies — and ONLY those.
 *
 * Discipline:
 *   - ADDITIVE: a curated (dna_profile_id, competency_id) weight ALWAYS wins; a
 *     derived row is inserted only for competencies the profile doesn't curate.
 *   - HONEST: only rows that genuinely match across both namespaces bridge. No
 *     name match ⇒ no row (an honest gap, never fabricated).
 *   - IDEMPOTENT: every run rebuilds the onet_derived rows from scratch; curated
 *     rows are never touched.
 */

import type { Pool } from 'pg';
import { resolveOntRole, normalize, type RoleMatchType } from './role-crosswalk.js';
import { isFlagEnabled } from '../config/feature-flags.js';

/**
 * Curated, defensible competency-name synonym groups bridging the two
 * ontologies' vocabulary. O*NET element names (`ont_competencies.name`) and the
 * curated names (`onto_competencies.canonical_name`) often describe the same
 * competency with different phrasing — e.g. O*NET "Active Listening" vs a
 * curated "Listening". Each inner array is a set of terms treated as
 * equivalent; matching is normalized (lowercase, punctuation/diacritics
 * stripped, whitespace collapsed) so casing and hyphenation never block a
 * match. Kept conservative on purpose: only genuinely-equivalent terms, so the
 * bridge never fabricates a link.
 */
const COMPETENCY_SYNONYMS: string[][] = [
  ['active listening', 'listening'],
  ['complex problem solving', 'problem solving'],
  ['critical thinking', 'analytical thinking', 'analytical skills'],
  ['reading comprehension', 'reading'],
  ['oral communication', 'verbal communication', 'speaking'],
  ['written communication', 'writing'],
  ['mathematics', 'numeracy', 'quantitative reasoning'],
  ['programming', 'coding'],
  ['judgment and decision making', 'decision making'],
  ['social perceptiveness', 'empathy'],
  ['coordination', 'collaboration', 'teamwork'],
  ['instructing', 'teaching'],
  ['negotiation', 'negotiating'],
  ['persuasion', 'influencing'],
  ['service orientation', 'customer service'],
  ['monitoring', 'self monitoring'],
  ['systems analysis', 'systems thinking'],
  ['active learning', 'continuous learning'],
  ['management of personnel resources', 'people management', 'team management'],
  ['time management', 'time-management'],
];

/** Normalized term → the full set of terms equivalent to it (incl. itself). */
const SYNONYM_INDEX: Map<string, Set<string>> = (() => {
  const idx = new Map<string, Set<string>>();
  for (const group of COMPETENCY_SYNONYMS) {
    const terms = group.map((t) => normalize(t));
    const set = new Set(terms);
    for (const t of terms) {
      const existing = idx.get(t);
      if (existing) for (const s of set) existing.add(s);
      else idx.set(t, new Set(set));
    }
  }
  return idx;
})();

type CompMatchType = 'exact' | 'synonym';

/**
 * Build a competency-name matcher over the curated `onto_competencies` rows.
 * Resolves an O*NET competency name to a curated competency id, tolerating
 * casing/punctuation differences (via normalize) and the curated synonym
 * groups. Returns null when nothing genuinely matches (an honest gap).
 */
export function buildCompetencyMatcher(
  ontoComps: Array<{ id: string; canonical_name: string }>,
): (name: string) => { id: string; matchType: CompMatchType } | null {
  const byNorm = new Map<string, string>(); // normalized canonical_name → onto competency id
  for (const c of ontoComps) {
    const n = normalize(c.canonical_name);
    if (n && !byNorm.has(n)) byNorm.set(n, c.id);
  }
  return (name: string) => {
    const n = normalize(name);
    if (!n) return null;
    const exact = byNorm.get(n);
    if (exact) return { id: exact, matchType: 'exact' };
    const group = SYNONYM_INDEX.get(n);
    if (group) {
      for (const term of group) {
        const hit = byNorm.get(term);
        if (hit) return { id: hit, matchType: 'synonym' };
      }
    }
    return null;
  };
}

/** O*NET proficiency band → onto_role_weights.expected_level (1..5). */
export const PROFICIENCY_TO_LEVEL: Record<string, number> = {
  novice: 1,
  developing: 2,
  proficient: 3,
  advanced: 4,
  expert: 5,
};

/** Map an O*NET target-proficiency band to the onto integer level (defaults to 3). */
export function profToLevel(band: string | null | undefined): number {
  if (!band) return 3;
  return PROFICIENCY_TO_LEVEL[band.toLowerCase().trim()] ?? 3;
}

// Lazy ensure-schema mirroring 20261212_onto_role_weights_source.sql (no runner).
let sourceColumnReady: Promise<void> | null = null;
export function ensureOntoRoleWeightSourceColumn(pool: Pool): Promise<void> {
  if (!sourceColumnReady) {
    sourceColumnReady = pool
      .query(
        `ALTER TABLE onto_role_weights
           ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'curated'`,
      )
      .then(() => undefined)
      .catch((err) => {
        // Reset so a transient failure can retry on the next read.
        sourceColumnReady = null;
        throw err;
      });
  }
  return sourceColumnReady;
}

export interface BridgeResult {
  /** onet_derived weight rows present in onto_role_weights after the rebuild. */
  linksBridged: number;
  ok: boolean;
  error?: string;
  /** Curated onto_roles that resolved to an ont_roles library role. */
  rolesMatched?: number;
  /** Curated onto_roles that could not be resolved (an honest coverage gap). */
  rolesUnmatched?: number;
  /** Sample of unmatched role titles (capped) so gaps stay visible. */
  unmatchedRoles?: string[];
  /** How matched roles resolved (exact_title / alias / partial_title / code). */
  roleMatchTypes?: Partial<Record<RoleMatchType, number>>;
  /** Curated roles resolved via the persisted crosswalk (when the flag is on). */
  rolesFromCrosswalk?: number;
  /** O*NET-derived competency links whose name resolved to a curated competency. */
  competenciesMatched?: number;
  /** Distinct O*NET competency names that did not resolve to any curated one. */
  competenciesUnmatched?: number;
  /** Sample of unmatched competency names (capped). */
  unmatchedCompetencies?: string[];
}

const SAMPLE_CAP = 25;
const INSERT_CHUNK = 200;

/**
 * Rebuild the O*NET-derived rows in onto_role_weights from map_role_competency.
 * Idempotent and additive. Returns 0 honestly when nothing bridges (e.g. the
 * O*NET library has not been imported, or no names align across the ontologies).
 *
 * Matching is synonym/fuzzy-tolerant (the original required identical titles and
 * identical competency names, silently dropping any naming difference):
 *   - Roles resolve through the shared role crosswalk (`resolveBestOntRole`),
 *     which tolerates casing/punctuation, legacy ids and known title synonyms.
 *   - Competencies resolve via normalized name + curated synonym groups
 *     (e.g. O*NET "Active Listening" → curated "Listening").
 * Unmatched roles and competency names are counted and logged so coverage gaps
 * remain visible rather than silently disappearing. Only genuine, defensible
 * matches bridge — no fabricated links.
 */
export async function bridgeOnetDerivedWeights(pool: Pool): Promise<BridgeResult> {
  try {
    await ensureOntoRoleWeightSourceColumn(pool);

    // Clear prior derived rows only — curated weights are never touched. This
    // keeps the bridge idempotent and drops any link that no longer qualifies
    // (e.g. a competency that has since gained a curated weight, or a role that
    // gained native O*NET ratings so its estimates were retired upstream).
    await pool.query(`DELETE FROM onto_role_weights WHERE source = 'onet_derived'`);

    // 1. Resolve each curated role (with a current DNA profile) to an ont_roles
    //    library role via the shared crosswalk. Two curated roles may resolve to
    //    the same library role, so accumulate the profiles per library role id.
    const ontoRoles = await pool.query<{ role_id: string; title: string; profile_id: string }>(`
      SELECT oro.id AS role_id, oro.title AS title, p.id AS profile_id
        FROM onto_roles oro
        JOIN onto_dna_profiles p ON p.role_id = oro.id AND p.is_current = TRUE
       WHERE oro.deprecated = FALSE
    `);

    // Which library roles actually carry O*NET-derived links? A curated title can
    // resolve to several library roles (e.g. an exact-title seeded role AND an
    // alias/synonym O*NET role). The crosswalk's "best" pick favours exact_title
    // and total competency count, which can select a seeded role that has NO
    // derived estimates while a synonym role does — silently bridging nothing.
    // So among a title's ranked candidates we prefer the best-ranked one that
    // genuinely has derived links, and only fall back to the top match otherwise.
    const derivedRoleRows = await pool.query<{ role_id: number }>(
      `SELECT DISTINCT role_id FROM map_role_competency
        WHERE source = 'onet_derived' AND is_active = TRUE`,
    );
    const derivedRoleIds = new Set<number>(derivedRoleRows.rows.map((r) => r.role_id));

    // When the Ontology Hierarchy Completion flag is ON, prefer the persisted
    // ont_*→onto_* crosswalk: a curated, human-confirmable mapping that the
    // runtime title matcher only seeds/falls back to. Flag OFF (or the table not
    // yet materialised) → behaviour is byte-identical to the pure-matcher legacy.
    const crosswalk = new Map<string, number>(); // onto_role_id → ont_role_id
    if (isFlagEnabled('ontologyHierarchyV2')) {
      const probe = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.map_ont_onto_role') AS t`);
      if (probe.rows[0]?.t) {
        const cw = await pool.query<{ onto_role_id: string; ont_role_id: number }>(
          `SELECT onto_role_id, ont_role_id FROM map_ont_onto_role WHERE ont_role_id IS NOT NULL`);
        for (const row of cw.rows) crosswalk.set(row.onto_role_id, row.ont_role_id);
      }
    }

    const ontRoleToProfiles = new Map<number, string[]>();
    const roleMatchTypes: Partial<Record<RoleMatchType, number>> = {};
    const unmatchedRoles: string[] = [];
    let rolesFromCrosswalk = 0;
    const assign = (ontRoleId: number, profileId: string): void => {
      const arr = ontRoleToProfiles.get(ontRoleId) ?? [];
      arr.push(profileId);
      ontRoleToProfiles.set(ontRoleId, arr);
    };
    for (const r of ontoRoles.rows) {
      // Persisted crosswalk wins when present AND the mapped library role actually
      // carries O*NET-derived links. An admin-confirmed mapping that points at a
      // role with NO derived estimates would silently bridge nothing, so it must
      // not short-circuit the title matcher — otherwise a role the crosswalk maps
      // to a zero-derived library role gets no inheritance even when a genuinely
      // linkable role exists under the same title. This mirrors the same
      // "prefer the linkable role" discipline already applied below.
      const mapped = crosswalk.get(r.role_id);
      if (mapped != null && derivedRoleIds.has(mapped)) {
        rolesFromCrosswalk += 1;
        assign(mapped, r.profile_id);
        continue;
      }
      const candidates = await resolveOntRole(pool, r.title); // ranked best-first
      // Prefer the best-ranked candidate that actually has derived links.
      const linkable = candidates.find((c) => derivedRoleIds.has(c.id));
      if (linkable) {
        roleMatchTypes[linkable.matchType] = (roleMatchTypes[linkable.matchType] ?? 0) + 1;
        assign(linkable.id, r.profile_id);
        continue;
      }
      // No linkable title candidate. Honour the admin's crosswalk mapping as a
      // fallback (even though it bridges nothing today) so the confirmed mapping
      // is never discarded; otherwise fall back to the overall best title match.
      if (mapped != null) {
        rolesFromCrosswalk += 1;
        assign(mapped, r.profile_id);
        continue;
      }
      if (candidates.length === 0) {
        unmatchedRoles.push(r.title);
        continue;
      }
      const chosen = candidates[0];
      roleMatchTypes[chosen.matchType] = (roleMatchTypes[chosen.matchType] ?? 0) + 1;
      assign(chosen.id, r.profile_id);
    }
    const rolesMatched = ontoRoles.rows.length - unmatchedRoles.length;

    const baseResult: BridgeResult = {
      linksBridged: 0,
      ok: true,
      rolesMatched,
      rolesUnmatched: unmatchedRoles.length,
      unmatchedRoles: unmatchedRoles.slice(0, SAMPLE_CAP),
      roleMatchTypes,
      rolesFromCrosswalk,
      competenciesMatched: 0,
      competenciesUnmatched: 0,
      unmatchedCompetencies: [],
    };

    if (ontRoleToProfiles.size === 0) {
      logSummary(baseResult, ontoRoles.rows.length);
      return baseResult;
    }

    // 2. Pull the O*NET-derived competency links for the matched library roles,
    //    plus the curated competency vocabulary for name matching.
    const ontRoleIds = [...ontRoleToProfiles.keys()];
    const [links, ontoComps] = await Promise.all([
      pool.query<{ role_id: number; comp_name: string; raw_weight: number; band: string | null }>(
        `
        SELECT mrc.role_id        AS role_id,
               oce.name           AS comp_name,
               mrc.weight::float  AS raw_weight,
               mrc.target_proficiency AS band
          FROM map_role_competency mrc
          JOIN ont_competencies oce ON oce.id = mrc.competency_id
         WHERE mrc.role_id = ANY($1::int[])
           AND mrc.source = 'onet_derived'
           AND mrc.is_active = TRUE
           AND oce.is_active = TRUE
        `,
        [ontRoleIds],
      ),
      pool.query<{ id: string; canonical_name: string }>(
        `SELECT id, canonical_name FROM onto_competencies WHERE deprecated = FALSE`,
      ),
    ]);

    const matchComp = buildCompetencyMatcher(ontoComps.rows);

    // 3. Build deduped candidate (profile, competency) weights. A competency name
    //    can resolve to the same curated competency more than once (e.g. via a
    //    synonym) — keep the highest raw weight so the per-profile normalisation
    //    isn't double-counted.
    interface Candidate { profileId: string; compId: string; raw: number; band: string | null }
    const candidates = new Map<string, Candidate>();
    const unmatchedComps = new Set<string>();
    let competenciesMatched = 0;
    for (const link of links.rows) {
      const cm = matchComp(link.comp_name);
      if (!cm) {
        unmatchedComps.add(link.comp_name);
        continue;
      }
      competenciesMatched += 1;
      const profiles = ontRoleToProfiles.get(link.role_id) ?? [];
      const raw = Number(link.raw_weight) || 0;
      for (const profileId of profiles) {
        const key = `${profileId}::${cm.id}`;
        const existing = candidates.get(key);
        if (!existing || raw > existing.raw) {
          candidates.set(key, { profileId, compId: cm.id, raw, band: link.band });
        }
      }
    }

    // 4. Curated always wins: drop any candidate whose (profile, competency) pair
    //    already carries a curated weight. After the DELETE above, every existing
    //    onto_role_weights row is curated.
    const profileIds = [...new Set([...candidates.values()].map((c) => c.profileId))];
    const existingKeys = new Set<string>();
    if (profileIds.length) {
      const existing = await pool.query<{ dna_profile_id: string; competency_id: string }>(
        `SELECT dna_profile_id, competency_id FROM onto_role_weights WHERE dna_profile_id = ANY($1::text[])`,
        [profileIds],
      );
      for (const e of existing.rows) existingKeys.add(`${e.dna_profile_id}::${e.competency_id}`);
    }
    const finalCandidates = [...candidates.values()].filter(
      (c) => !existingKeys.has(`${c.profileId}::${c.compId}`),
    );

    // 5. Normalise each estimated weight to a per-profile fraction over the rows
    //    that will actually be inserted, so derived weights sit on the same scale
    //    as curated ones. weight is NUMERIC(4,3) CHECK 0..1, so clamp + 3 dp.
    const sumByProfile = new Map<string, number>();
    for (const c of finalCandidates) {
      sumByProfile.set(c.profileId, (sumByProfile.get(c.profileId) ?? 0) + c.raw);
    }
    const rows = finalCandidates.map((c) => {
      const sum = sumByProfile.get(c.profileId) ?? 0;
      let weight = sum > 0 ? c.raw / sum : 0;
      weight = Math.min(1, Math.max(0, Math.round(weight * 1000) / 1000));
      return { profileId: c.profileId, compId: c.compId, weight, level: profToLevel(c.band) };
    });

    // 6. Insert the derived rows (chunked). ON CONFLICT DO NOTHING is a final
    //    guard; curated rows were already excluded in step 4.
    let linksBridged = 0;
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const batch = rows.slice(i, i + INSERT_CHUNK);
      const values: string[] = [];
      const params: unknown[] = [];
      batch.forEach((r, idx) => {
        const o = idx * 6;
        values.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`);
        params.push(
          r.profileId,
          r.compId,
          r.weight,
          r.level,
          'Estimated from a related O*NET occupation (inherited)',
          'onet_derived',
        );
      });
      const ins = await pool.query(
        `INSERT INTO onto_role_weights
              (dna_profile_id, competency_id, weight, expected_level, rationale, source)
         VALUES ${values.join(', ')}
         ON CONFLICT (dna_profile_id, competency_id) DO NOTHING`,
        params,
      );
      linksBridged += ins.rowCount ?? 0;
    }

    const result: BridgeResult = {
      ...baseResult,
      linksBridged,
      competenciesMatched,
      competenciesUnmatched: unmatchedComps.size,
      unmatchedCompetencies: [...unmatchedComps].slice(0, SAMPLE_CAP),
    };
    logSummary(result, ontoRoles.rows.length);
    return result;
  } catch (err: any) {
    console.error('[onet-onto-weight-bridge] error:', err);
    return { linksBridged: 0, ok: false, error: err?.message ?? 'bridge failed' };
  }
}

/** Emit an honest coverage summary so unmatched roles/competencies stay visible. */
function logSummary(r: BridgeResult, totalRoles: number): void {
  console.log(
    `[onet-onto-weight-bridge] roles matched ${r.rolesMatched ?? 0}/${totalRoles} ` +
      `(${JSON.stringify(r.roleMatchTypes ?? {})}, crosswalk ${r.rolesFromCrosswalk ?? 0}), unmatched roles ${r.rolesUnmatched ?? 0}; ` +
      `competency links matched ${r.competenciesMatched ?? 0}, ` +
      `unmatched competency names ${r.competenciesUnmatched ?? 0}; ` +
      `derived weights bridged ${r.linksBridged}`,
  );
  if (r.unmatchedRoles && r.unmatchedRoles.length) {
    console.warn('[onet-onto-weight-bridge] unmatched roles (sample):', r.unmatchedRoles);
  }
  if (r.unmatchedCompetencies && r.unmatchedCompetencies.length) {
    console.warn(
      '[onet-onto-weight-bridge] unmatched competency names (sample):',
      r.unmatchedCompetencies,
    );
  }
}
