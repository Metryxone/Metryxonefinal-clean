/**
 * CAPADEX PIL — Phase 6: Runtime Intelligence Activation (read-only consumer).
 *
 *   Surfaces the EXISTING admin-authored Problem Intelligence Layer (Phases 3–5)
 *   inside the live assessment report. For an assessed session it resolves the
 *   user's concern → behavioural archetype, then assembles the human-language
 *   guidance chain already stored in the PIL tables:
 *
 *     concern  →  archetype  →  human problems  →  observable behaviours
 *              →  search intents  →  interventions  →  growth pathway / action plan
 *
 * CANON (strict):
 *   - ADDITIVE & READ-ONLY: no writes, no recompute, no AI, no new content. Every
 *     line returned was authored by the PIL engines and stored in the DB; this
 *     module only SELECTs, filters, and shapes it for one session + stakeholder.
 *   - DETERMINISTIC: same session → same bundle (rows ordered, capped).
 *   - GRACEFUL DEGRADATION: if the concern cannot be resolved confidently, or a
 *     downstream library is empty, the bundle is marked `degraded` and the missing
 *     sections come back empty — NEVER fabricated, NEVER mis-routed to a wrong
 *     archetype, NEVER throws.
 *
 * The flag gate + HTTP surface live in the route; this module is the engine.
 */
import type { Pool } from 'pg';

// ── Stakeholder vocabulary (matches the PIL library columns) ─────────────────
export type Stakeholder = 'student' | 'parent' | 'teacher' | 'counselor' | 'professional';

/**
 * Map a runtime-context persona (+ relationship + age) onto the five PIL
 * stakeholder lenses. PURE. The runtime stores rich persona keys
 * (PROFESSIONAL / MID_CAREER_PROFESSIONAL / SCHOOL_STUDENT / …) and a
 * relationship_type (parent_child / teacher_student / counsellor_client / self);
 * the PIL library only knows student|parent|teacher|counselor|professional.
 *
 * The ACTOR is the person reading the report, so the stakeholder lens follows the
 * actor — a parent assessing their child should see parent-facing guidance.
 */
export function mapStakeholder(input: {
  actorPersona?: string | null;
  relationshipType?: string | null;
  age?: number | null;
}): Stakeholder {
  const rel = String(input.relationshipType ?? '').toLowerCase();
  // Relationship is the most authoritative signal of who is acting.
  if (rel === 'parent_child') return 'parent';
  if (rel === 'teacher_student') return 'teacher';
  if (rel === 'counsellor_client' || rel === 'counselor_client') return 'counselor';

  const p = String(input.actorPersona ?? '').toLowerCase();
  if (p.includes('parent')) return 'parent';
  if (p.includes('teacher') || p.includes('educator')) return 'teacher';
  if (p.includes('counsel')) return 'counselor';
  if (
    p.includes('professional') || p.includes('career') || p.includes('jobseeker') ||
    p.includes('manager') || p.includes('corporate') || p.includes('employee')
  ) return 'professional';
  if (
    p.includes('student') || p.includes('learner') || p.includes('campus') ||
    p.includes('school') || p.includes('college') || p.includes('aspirant')
  ) return 'student';

  // No persona signal → fall back on age (adultness threshold mirrors the
  // funnel's own >=24 convention). Unknown age → student (the gentlest lens).
  const age = typeof input.age === 'number' ? input.age : null;
  if (age != null && age >= 24) return 'professional';
  return 'student';
}

// ── Concern → archetype resolution ───────────────────────────────────────────
export type ResolutionMethod =
  | 'master_pk' | 'name_exact' | 'display_label' | 'token_overlap' | 'none';

export interface ConcernResolution {
  concern_id: string | null;
  archetype_key: string | null;
  archetype_name: string | null;
  method: ResolutionMethod;
  confidence: number; // 0..1 — honest signal of how the match was made
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'my', 'me', 'i', 'about', 'how', 'what', 'why', 'is', 'are', 'be', 'being',
  'feel', 'feeling', 'feels', 'too', 'so', 'very', 'when', 'this', 'that',
]);

function tokens(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// cached distinct (archetype_key, concern_id, concern_name) map list
let mapCache: { rows: ArchetypeMapRow[]; loadedAt: number } | null = null;
const MAP_TTL_MS = 5 * 60_000;
interface ArchetypeMapRow { archetype_key: string; concern_id: string; concern_name: string; }

async function loadArchetypeMap(pool: Pool): Promise<ArchetypeMapRow[]> {
  if (mapCache && Date.now() - mapCache.loadedAt < MAP_TTL_MS) return mapCache.rows;
  const { rows } = await pool.query(
    `SELECT archetype_key, concern_id, concern_name FROM archetype_concern_map
      WHERE archetype_key IS NOT NULL AND concern_name IS NOT NULL
      ORDER BY concern_id ASC, archetype_key ASC`,
  );
  mapCache = { rows: rows as ArchetypeMapRow[], loadedAt: Date.now() };
  return mapCache.rows;
}

/**
 * Pure token-overlap pick over the loaded archetype map. Returns the best row
 * only when the match is strong enough to be trustworthy (>= 2 shared meaningful
 * tokens AND >= 60% of the query's tokens covered) — otherwise null, so a vague
 * free-text concern degrades rather than mis-routing. Exported for unit tests.
 */
export function pickByTokenOverlap(
  concernName: string,
  rows: ArchetypeMapRow[],
): { row: ArchetypeMapRow; confidence: number } | null {
  const q = tokens(concernName);
  if (q.length === 0) return null;
  const qset = new Set(q);
  let best: { row: ArchetypeMapRow; shared: number; ratio: number } | null = null;
  for (const r of rows) {
    const cand = new Set(tokens(r.concern_name));
    if (cand.size === 0) continue;
    let shared = 0;
    for (const t of qset) if (cand.has(t)) shared++;
    if (shared === 0) continue;
    const ratio = shared / qset.size;
    // Deterministic selection: best by (shared, ratio), then stable secondary
    // keys (concern_id, archetype_key) so ties never depend on DB row order.
    if (
      !best ||
      shared > best.shared ||
      (shared === best.shared && ratio > best.ratio) ||
      (shared === best.shared && ratio === best.ratio && r.concern_id < best.row.concern_id) ||
      (shared === best.shared && ratio === best.ratio && r.concern_id === best.row.concern_id && r.archetype_key < best.row.archetype_key)
    ) {
      best = { row: r, shared, ratio };
    }
  }
  if (!best) return null;
  if (best.shared < 2 || best.ratio < 0.6) return null;
  // confidence scaled by coverage, capped below exact-match methods
  return { row: best.row, confidence: Math.min(0.7, 0.4 + best.ratio * 0.3) };
}

export interface SessionConcernInput {
  master_concern_pk: number | null;
  concern_name: string | null;
}

/** Resolve a session's concern to an archetype via a deterministic exact→fuzzy cascade. */
export async function resolveConcernArchetype(
  pool: Pool,
  session: SessionConcernInput,
): Promise<ConcernResolution> {
  const none: ConcernResolution = {
    concern_id: null, archetype_key: null, archetype_name: null, method: 'none', confidence: 0,
  };

  // 1) Authoritative: session.master_concern_pk → master.concern_id → map.
  // `archetype_concern_map` has no name column; LEFT JOIN archetype_library for it.
  if (session.master_concern_pk != null) {
    const { rows } = await pool.query(
      `SELECT acm.concern_id, acm.archetype_key, al.archetype_name
         FROM capadex_concerns_master m
         JOIN archetype_concern_map acm ON acm.concern_id = m.concern_id
         LEFT JOIN archetype_library al ON al.archetype_key = acm.archetype_key
        WHERE m.id = $1
        LIMIT 1`,
      [session.master_concern_pk],
    );
    if (rows[0]) return { ...rows[0], archetype_name: rows[0].archetype_name ?? null, method: 'master_pk', confidence: 1 };
  }

  const name = (session.concern_name || '').trim();
  if (name) {
    // 2) Exact (case-insensitive) name match against the archetype map.
    const exact = await pool.query(
      `SELECT acm.concern_id, acm.archetype_key, al.archetype_name
         FROM archetype_concern_map acm
         LEFT JOIN archetype_library al ON al.archetype_key = acm.archetype_key
        WHERE lower(acm.concern_name) = lower($1)
        ORDER BY acm.concern_id ASC, acm.archetype_key ASC LIMIT 1`,
      [name],
    );
    if (exact.rows[0]) return { ...exact.rows[0], archetype_name: exact.rows[0].archetype_name ?? null, method: 'name_exact', confidence: 0.95 };

    // 3) Name → master.display_label → concern_id → map.
    const viaLabel = await pool.query(
      `SELECT acm.concern_id, acm.archetype_key, al.archetype_name
         FROM capadex_concerns_master m
         JOIN archetype_concern_map acm ON acm.concern_id = m.concern_id
         LEFT JOIN archetype_library al ON al.archetype_key = acm.archetype_key
        WHERE lower(m.display_label) = lower($1)
        ORDER BY acm.concern_id ASC, acm.archetype_key ASC LIMIT 1`,
      [name],
    );
    if (viaLabel.rows[0]) return { ...viaLabel.rows[0], archetype_name: viaLabel.rows[0].archetype_name ?? null, method: 'display_label', confidence: 0.85 };

    // 4) Conservative token-overlap fallback (never mis-routes a vague phrase).
    const picked = pickByTokenOverlap(name, await loadArchetypeMap(pool));
    if (picked) {
      const nameRow = await pool.query(
        `SELECT archetype_name FROM archetype_library WHERE archetype_key = $1 LIMIT 1`,
        [picked.row.archetype_key],
      );
      return {
        concern_id: picked.row.concern_id,
        archetype_key: picked.row.archetype_key,
        archetype_name: nameRow.rows[0]?.archetype_name ?? null,
        method: 'token_overlap',
        confidence: picked.confidence,
      };
    }
  }

  return none;
}

// ── Read-only PIL loaders (cached) ───────────────────────────────────────────
type CacheEntry = { value: unknown; at: number };
const loaderCache = new Map<string, CacheEntry>();
const LOADER_TTL_MS = 60_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = loaderCache.get(key);
  if (hit && Date.now() - hit.at < LOADER_TTL_MS) return hit.value as T;
  const value = await fn();
  loaderCache.set(key, { value, at: Date.now() });
  return value;
}

export interface HumanProblem { voice: string; problem_statement: string; }
export interface Behaviour { behavior_statement: string; behavior_category: string | null; }
export interface SearchIntent { intent_type: string; search_phrase: string; }
export interface Intervention { intervention_type: string; intervention_text: string; }
export interface ActionPlan {
  plan_title: string | null;
  step_immediate: string | null; step_week: string | null;
  step_month: string | null; step_quarter: string | null;
  total_days: number | null;
}
export interface GrowthPathway { summary: string | null; stages: unknown; stage_count: number | null; }

async function loadHumanProblems(pool: Pool, archetypeKey: string): Promise<HumanProblem[]> {
  return cached(`hp:${archetypeKey}`, async () => {
    const { rows } = await pool.query(
      `SELECT voice, problem_statement FROM human_problem_library
        WHERE archetype_key = $1 AND NOT is_duplicate AND realism_pass
        ORDER BY problem_id`,
      [archetypeKey],
    );
    return rows as HumanProblem[];
  });
}

async function loadBehaviours(pool: Pool, concernId: string): Promise<Behaviour[]> {
  return cached(`bh:${concernId}`, async () => {
    const { rows } = await pool.query(
      `SELECT behavior_statement, behavior_category FROM behavior_library
        WHERE concern_id = $1 AND accepted
        ORDER BY quality_total DESC NULLS LAST, behavior_id`,
      [concernId],
    );
    return rows as Behaviour[];
  });
}

async function loadSearchIntents(pool: Pool, archetypeKey: string, stakeholder: Stakeholder): Promise<SearchIntent[]> {
  return cached(`si:${archetypeKey}:${stakeholder}`, async () => {
    const { rows } = await pool.query(
      `SELECT intent_type, search_phrase FROM search_intents
        WHERE archetype_key = $1 AND stakeholder_type = $2 AND NOT is_duplicate
        ORDER BY intent_id`,
      [archetypeKey, stakeholder],
    );
    return rows as SearchIntent[];
  });
}

async function loadInterventions(pool: Pool, archetypeKey: string, stakeholder: Stakeholder): Promise<Intervention[]> {
  return cached(`iv:${archetypeKey}:${stakeholder}`, async () => {
    const { rows } = await pool.query(
      `SELECT intervention_type, intervention_text FROM pil_intervention_library
        WHERE archetype_key = $1 AND stakeholder_type = $2 AND NOT is_duplicate
        ORDER BY intervention_id`,
      [archetypeKey, stakeholder],
    );
    return rows as Intervention[];
  });
}

async function loadActionPlan(pool: Pool, archetypeKey: string, stakeholder: Stakeholder): Promise<ActionPlan | null> {
  return cached(`ap:${archetypeKey}:${stakeholder}`, async () => {
    const { rows } = await pool.query(
      `SELECT plan_title, step_immediate, step_week, step_month, step_quarter, total_days
         FROM pil_action_plan_templates
        WHERE archetype_key = $1 AND stakeholder_type = $2 AND NOT is_duplicate
        ORDER BY avg_composite DESC NULLS LAST, template_id
        LIMIT 1`,
      [archetypeKey, stakeholder],
    );
    return (rows[0] as ActionPlan) || null;
  });
}

async function loadGrowthPathway(pool: Pool, archetypeKey: string, stakeholder: Stakeholder): Promise<GrowthPathway | null> {
  return cached(`gp:${archetypeKey}:${stakeholder}`, async () => {
    const { rows } = await pool.query(
      `SELECT summary, stages, stage_count FROM pil_growth_pathways
        WHERE archetype_key = $1 AND stakeholder_type = $2
        ORDER BY complete DESC, avg_composite DESC NULLS LAST, pathway_id
        LIMIT 1`,
      [archetypeKey, stakeholder],
    );
    return (rows[0] as GrowthPathway) || null;
  });
}

// ── Pure bundle assembly ─────────────────────────────────────────────────────
const PROBLEM_CAP = 4;
const BEHAVIOUR_CAP = 6;
const INTENT_CAP = 5;

export interface GuidanceBundle {
  enabled: boolean;
  degraded: boolean;
  reason: string | null;
  stakeholder: Stakeholder;
  resolution: ConcernResolution;
  archetype: { key: string; name: string | null } | null;
  human_problems: HumanProblem[];
  behaviours: Behaviour[];
  search_intents: SearchIntent[];
  interventions: { type: string; text: string }[]; // one best per type
  action_plan: ActionPlan | null;
  growth_pathway: GrowthPathway | null;
}

const INTERVENTION_TYPE_ORDER = [
  'immediate_actions', 'seven_day', 'thirty_day', 'ninety_day', 'habit', 'skill_building',
];

/**
 * Pure shaper: pick stakeholder-relevant problems, cap collections, and reduce
 * interventions to one best per type in a stable order. No DB, fully testable.
 */
export function assembleBundle(args: {
  stakeholder: Stakeholder;
  resolution: ConcernResolution;
  humanProblems: HumanProblem[];
  behaviours: Behaviour[];
  searchIntents: SearchIntent[];
  interventions: Intervention[];
  actionPlan: ActionPlan | null;
  growthPathway: GrowthPathway | null;
}): GuidanceBundle {
  const { stakeholder, resolution } = args;
  const archetypeKey = resolution.archetype_key;

  const archetype = archetypeKey
    ? { key: archetypeKey, name: resolution.archetype_name }
    : null;

  // Problems carry a `voice` (student | professional | general), not a stakeholder.
  // Surface the voice that fits the reader, always include `general`.
  const voicePref = stakeholder === 'professional' ? 'professional' : 'student';
  const problems = [
    ...args.humanProblems.filter((p) => p.voice === voicePref),
    ...args.humanProblems.filter((p) => p.voice === 'general'),
    ...args.humanProblems.filter((p) => p.voice !== voicePref && p.voice !== 'general'),
  ].slice(0, PROBLEM_CAP);

  const behaviours = args.behaviours.slice(0, BEHAVIOUR_CAP);
  const searchIntents = args.searchIntents.slice(0, INTENT_CAP);

  // One best (first, since loaders order deterministically) intervention per type.
  const byType = new Map<string, string>();
  for (const iv of args.interventions) {
    if (!byType.has(iv.intervention_type)) byType.set(iv.intervention_type, iv.intervention_text);
  }
  const interventions = INTERVENTION_TYPE_ORDER
    .filter((t) => byType.has(t))
    .map((t) => ({ type: t, text: byType.get(t)! }));

  const hasAny =
    problems.length > 0 || behaviours.length > 0 || searchIntents.length > 0 ||
    interventions.length > 0 || !!args.actionPlan || !!args.growthPathway;

  const degraded = !archetype || !hasAny;
  const reason = !archetype
    ? 'concern_not_resolved'
    : !hasAny
      ? 'no_guidance_content'
      : null;

  return {
    enabled: true,
    degraded,
    reason,
    stakeholder,
    resolution,
    archetype,
    human_problems: problems,
    behaviours,
    search_intents: searchIntents,
    interventions,
    action_plan: args.actionPlan,
    growth_pathway: args.growthPathway,
  };
}

// ── Orchestrator: session → full guidance bundle (read-only, never throws) ────
export interface SessionRow {
  master_concern_pk: number | null;
  concern_name: string | null;
  persona: string | null;
  user_age: number | null;
  actor_persona?: string | null;
  relationship_type?: string | null;
}

export async function buildGuidanceForSession(pool: Pool, sessionId: string): Promise<GuidanceBundle> {
  try {
    return await buildGuidanceForSessionInner(pool, sessionId);
  } catch (err) {
    // Honour the never-throw contract at the engine boundary: any DB / runtime
    // error degrades to an inert bundle instead of propagating. The route also
    // catches, but the engine must keep its own promise so any caller is safe.
    console.warn('[runtime-guidance] degraded:', err instanceof Error ? err.message : String(err));
    return {
      enabled: true, degraded: true, reason: 'engine_error',
      stakeholder: 'student',
      resolution: { concern_id: null, archetype_key: null, archetype_name: null, method: 'none', confidence: 0 },
      archetype: null, human_problems: [], behaviours: [], search_intents: [],
      interventions: [], action_plan: null, growth_pathway: null,
    };
  }
}

async function buildGuidanceForSessionInner(pool: Pool, sessionId: string): Promise<GuidanceBundle> {
  // Pull the session + its most recent runtime-context row (for actor/relationship).
  const { rows: srows } = await pool.query(
    `SELECT s.master_concern_pk, s.concern_name, s.persona, s.user_age,
            rc.actor_persona, rc.relationship_type
       FROM capadex_sessions s
       LEFT JOIN LATERAL (
         SELECT actor_persona, relationship_type
           FROM capadex_runtime_sessions r
          WHERE r.session_id = s.id
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT 1
       ) rc ON true
      WHERE s.id = $1
      LIMIT 1`,
    [sessionId],
  );
  const session = srows[0] as SessionRow | undefined;

  const stakeholder = mapStakeholder({
    actorPersona: session?.actor_persona ?? session?.persona ?? null,
    relationshipType: session?.relationship_type ?? null,
    age: session?.user_age ?? null,
  });

  if (!session) {
    return assembleBundle({
      stakeholder,
      resolution: { concern_id: null, archetype_key: null, archetype_name: null, method: 'none', confidence: 0 },
      humanProblems: [], behaviours: [], searchIntents: [], interventions: [], actionPlan: null, growthPathway: null,
    });
  }

  const resolution = await resolveConcernArchetype(pool, {
    master_concern_pk: session.master_concern_pk,
    concern_name: session.concern_name,
  });

  if (!resolution.archetype_key) {
    // No archetype resolved → the full chain is unavailable, but if we still
    // resolved a concern_id we can surface concern-level behaviours (behaviour
    // library keys off concern_id, not archetype). assembleBundle still marks
    // the bundle degraded (no archetype) so the UI shows a general-support
    // fallback alongside whatever partial content resolves. Read-only.
    const partialBehaviours = resolution.concern_id
      ? await loadBehaviours(pool, resolution.concern_id)
      : [];
    return assembleBundle({
      stakeholder, resolution,
      humanProblems: [], behaviours: partialBehaviours, searchIntents: [], interventions: [], actionPlan: null, growthPathway: null,
    });
  }

  const key = resolution.archetype_key;
  const concernId = resolution.concern_id;
  const [humanProblems, behaviours, searchIntents, interventions, actionPlan, growthPathway] = await Promise.all([
    loadHumanProblems(pool, key),
    concernId ? loadBehaviours(pool, concernId) : Promise.resolve([]),
    loadSearchIntents(pool, key, stakeholder),
    loadInterventions(pool, key, stakeholder),
    loadActionPlan(pool, key, stakeholder),
    loadGrowthPathway(pool, key, stakeholder),
  ]);

  return assembleBundle({
    stakeholder, resolution,
    humanProblems, behaviours, searchIntents, interventions, actionPlan, growthPathway,
  });
}
