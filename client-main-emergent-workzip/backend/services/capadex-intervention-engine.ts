/**
 * CAPADEX Intervention Engine (Phase 4 — Part B).
 *
 * The final node of the behavioural lineage chain:
 *
 *     Evidence → Signal → Composite → Pattern → **Intervention**
 *
 * Consumes the higher-order output of the spine (behavioural patterns + the
 * atomic signals that compose them) and produces a **ranked set of specific,
 * evidence-grounded interventions**. Every intervention traces back to the
 * pattern(s) and signal(s) that justified it (`pattern_refs`, `signal_refs`),
 * so the explainability runtime can render the full chain.
 *
 * Inputs (per the task): patterns, signals, confidence, severity.
 * Output: ranked interventions, each carrying
 *   title · effort · duration · expected_impact · confidence · review_window.
 *
 * Two hard rules (per the task):
 *   1. **Use ontology mappings.** Each ontology signal is mapped to a behavioural
 *      construct via `SIGNAL_CONSTRUCT_MAP` (a curated crosswalk grounded in each
 *      signal's `domain` + `behavioral_meaning`), and the ontology's own
 *      `intervention_priority` / `recovery_indicator` drive effort/duration/impact.
 *   2. **Use the intervention library.** The recommendation copy itself is pulled
 *      from the 140-row `intervention_library` table, selected by
 *      (construct_key, confidence_band, emotional_load_band, persona).
 *   3. **Never return generic recommendations.** An intervention is emitted ONLY
 *      when a signal maps to a construct that has a real library entry. If nothing
 *      matches, nothing is returned for that signal — there is no catch-all
 *      fallback copy.
 *
 * Persisted to `capadex_session_interventions` with the same idempotent
 * recompute-and-reconcile invariants as the rest of the runtime.
 */
import type { Pool } from 'pg';
import type { Db } from './evidence-engine';
import { coreToken, type ActiveSignal } from './composite-signal-engine';
import type { BehaviouralPattern } from './pattern-engine';

// ── Tunables ────────────────────────────────────────────────────────────────
const RUNTIME_TTL_MS = 60_000;
/** Lifecycle states meaningful enough to warrant an intervention. */
const ACTIONABLE_LIFECYCLES = new Set(['active', 'dominant']);

/**
 * Ontology mapping: each ontology signal (by its normalised core token) → the
 * behavioural construct used to look the intervention up in `intervention_library`.
 * Curated from the signal's `domain` + `behavioral_meaning`; every target is a
 * construct that actually exists in the library, so a mapped signal always
 * resolves to specific (never generic) copy.
 */
const SIGNAL_CONSTRUCT_MAP: Record<string, string> = {
  avoidance: 'PROCRASTINATION',
  avoidance_behavior: 'PROCRASTINATION',
  burnout: 'STRESS_MANAGEMENT',
  burnout_tendency: 'STRESS_MANAGEMENT',
  career_confusion: 'CAREER_CLARITY',
  confidence_instability: 'SELF_ESTEEM',
  decision_paralysis: 'EXECUTIVE_FUNCTION',
  emotional_overload: 'EMOTIONAL_REGULATION',
  employability_insecurity: 'SKILL_AWARENESS',
  external_dependency: 'INTRINSIC_MOTIVATION',
  fear_of_failure: 'ANXIETY',
  future_uncertainty: 'CAREER_CLARITY',
  hopelessness: 'MENTAL_HEALTH',
  interview_fear: 'SOCIAL_CONFIDENCE',
  low_self_belief: 'SELF_ESTEEM',
  motivation_decline: 'INTRINSIC_MOTIVATION',
  overthinking: 'ANXIETY',
  overthinking_pattern: 'ANXIETY',
  peer_comparison: 'PEER_RELATIONS',
  placement_anxiety: 'ANXIETY',
  practical_skill_gap: 'SKILL_AWARENESS',
  procrastination: 'PROCRASTINATION',
  procrastination_pattern: 'PROCRASTINATION',
  social_withdrawal: 'SOCIAL_CONFIDENCE',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface OntologyInterventionMeta {
  signal_name: string;
  domain: string;
  severity: number;
  construct_key: string;
  intervention_priority: string; // Critical | High | Medium | …
  recovery_indicator: string | null;
}

interface LibraryEntry {
  construct_key: string;
  confidence_band: string; // high | moderate | low
  emotional_load_band: string; // high | moderate | low
  persona: string; // student | parent | teacher | counsellor
  intervention_text: string;
  rationale: string;
  safety_level: string; // informational | supportive | referral
}

export interface InterventionRuntime {
  ontology: Map<string, OntologyInterventionMeta>; // core-token → meta
  library: Map<string, LibraryEntry[]>; // construct_key → entries
}

export interface RankedIntervention {
  intervention_key: string; // = construct_key (one intervention per construct)
  construct_key: string;
  title: string;
  description: string;
  rationale: string;
  effort: 'low' | 'moderate' | 'high';
  duration: string;
  expected_impact: number; // 0..1
  confidence: number; // 0..1 — detection confidence that justified it
  review_window: string;
  safety_level: string;
  severity: number; // 0..1 — max ontology severity of contributing signals
  signal_refs: string[];
  pattern_refs: string[];
  rank: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
function humanise(key: string): string {
  const spaced = String(key || '').replace(/_/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Normalise an arbitrary session persona onto the library's persona vocabulary. */
function normalisePersona(persona: string | null | undefined): string {
  const p = String(persona ?? '').toLowerCase();
  if (p.includes('parent')) return 'parent';
  if (p.includes('teacher')) return 'teacher';
  if (p.includes('counsel')) return 'counsellor';
  return 'student'; // learner / professional / proxy / self default to student copy
}

// effort / duration / review-window derive from the ontology intervention priority.
function priorityProfile(priority: string): {
  effort: RankedIntervention['effort'];
  duration: string;
  review_window: string;
} {
  switch (String(priority || '').toLowerCase()) {
    case 'critical':
      return { effort: 'high', duration: '2 weeks', review_window: '7 days' };
    case 'high':
      return { effort: 'moderate', duration: '4 weeks', review_window: '14 days' };
    default:
      return { effort: 'low', duration: '6 weeks', review_window: '30 days' };
  }
}

// ── Runtime load (cached) ────────────────────────────────────────────────────
let runtimeCache: { runtime: InterventionRuntime; loadedAt: number } | null = null;

/**
 * Load the ontology intervention metadata + the intervention library, indexed for
 * O(1) lookup. Cached process-wide with a short TTL. Best-effort: a load failure
 * yields an empty runtime (no interventions that run) rather than throwing into
 * the spine transaction.
 */
export async function loadInterventionRuntime(pool: Pool, force = false): Promise<InterventionRuntime> {
  const now = Date.now();
  if (!force && runtimeCache && now - runtimeCache.loadedAt < RUNTIME_TTL_MS) {
    return runtimeCache.runtime;
  }

  const ontology = new Map<string, OntologyInterventionMeta>();
  const library = new Map<string, LibraryEntry[]>();

  try {
    const sig = await pool.query<{
      signal_name: string;
      domain: string | null;
      severity_weight: string | number | null;
      intervention_priority: string | null;
      recovery_indicator: string | null;
    }>(
      `SELECT signal_name, domain, severity_weight, intervention_priority, recovery_indicator
         FROM capadex_signals`,
    );
    for (const r of sig.rows) {
      const token = coreToken(r.signal_name);
      const construct = SIGNAL_CONSTRUCT_MAP[token] ?? SIGNAL_CONSTRUCT_MAP[coreToken(r.signal_name)];
      if (!token || !construct) continue;
      ontology.set(token, {
        signal_name: r.signal_name,
        domain: (r.domain || 'general').toLowerCase(),
        severity: Number(r.severity_weight) || 0.5,
        construct_key: construct,
        intervention_priority: r.intervention_priority || 'Medium',
        recovery_indicator: r.recovery_indicator || null,
      });
    }

    const lib = await pool.query<LibraryEntry>(
      `SELECT construct_key, confidence_band, emotional_load_band, persona,
              intervention_text, rationale, safety_level
         FROM intervention_library
        WHERE is_active = true`,
    );
    for (const e of lib.rows) {
      const list = library.get(e.construct_key) ?? [];
      list.push({
        construct_key: e.construct_key,
        confidence_band: String(e.confidence_band || '').toLowerCase(),
        emotional_load_band: String(e.emotional_load_band || '').toLowerCase(),
        persona: String(e.persona || '').toLowerCase(),
        intervention_text: e.intervention_text,
        rationale: e.rationale,
        safety_level: e.safety_level,
      });
      library.set(e.construct_key, list);
    }
  } catch (err) {
    console.error('[intervention-engine] runtime load failed (no interventions this run):', err);
  }

  const runtime: InterventionRuntime = { ontology, library };
  runtimeCache = { runtime, loadedAt: now };
  return runtime;
}

/**
 * Select the best library entry for a construct given the derived bands + persona.
 * Relaxes persona → emotional-load → confidence band in turn, but NEVER relaxes the
 * construct itself — so a returned entry is always specific to the construct. Returns
 * null when the construct has no library coverage at all (caller then emits nothing).
 */
function selectLibraryEntry(
  entries: LibraryEntry[],
  confBand: string,
  loadBand: string,
  persona: string,
): LibraryEntry | null {
  if (!entries || entries.length === 0) return null;
  const tries: Array<(e: LibraryEntry) => boolean> = [
    (e) => e.confidence_band === confBand && e.emotional_load_band === loadBand && e.persona === persona,
    (e) => e.confidence_band === confBand && e.emotional_load_band === loadBand && e.persona === 'student',
    (e) => e.confidence_band === confBand && e.emotional_load_band === loadBand,
    (e) => e.confidence_band === confBand && e.persona === persona,
    (e) => e.confidence_band === confBand,
    (e) => e.emotional_load_band === loadBand && e.persona === persona,
    (e) => e.emotional_load_band === loadBand,
    () => true, // any entry for THIS construct (still construct-specific, never generic)
  ];
  for (const pred of tries) {
    const hit = entries.find(pred);
    if (hit) return hit;
  }
  return null;
}

/** First sentence of the library copy, trimmed to a sane title length. */
function deriveTitle(signalName: string, constructKey: string): string {
  return `${humanise(signalName)}: targeted ${humanise(constructKey).toLowerCase()} plan`;
}

// ── Generation (pure) ─────────────────────────────────────────────────────────
/**
 * Build ranked interventions from the higher-order spine output. Pure (no I/O):
 * everything it needs is passed in (the cached runtime + the in-txn signal/pattern
 * state), so it can run inside the spine transaction.
 */
export function generateInterventions(args: {
  active: ActiveSignal[];
  patterns: BehaviouralPattern[];
  runtime: InterventionRuntime;
  persona: string | null;
}): RankedIntervention[] {
  const { active, patterns, runtime, persona } = args;
  const personaKey = normalisePersona(persona);

  // For each ontology signal, find the strongest pattern that contains it (for
  // detection confidence + pattern_refs lineage).
  const patternsBySignalToken = new Map<string, BehaviouralPattern[]>();
  for (const p of patterns) {
    for (const sref of p.signal_refs) {
      const t = coreToken(sref);
      const list = patternsBySignalToken.get(t) ?? [];
      list.push(p);
      patternsBySignalToken.set(t, list);
    }
  }

  // Collapse candidates by construct_key — one intervention per construct, keeping
  // the strongest and merging the lineage refs.
  const byConstruct = new Map<string, RankedIntervention>();

  for (const sig of active) {
    if (!ACTIONABLE_LIFECYCLES.has(sig.lifecycle)) continue;
    const token = coreToken(sig.signal_key);
    const meta = runtime.ontology.get(token);
    if (!meta) continue; // not an ontology signal → no mapping → skip (never generic)

    const entries = runtime.library.get(meta.construct_key);
    if (!entries || entries.length === 0) continue; // no library copy → skip

    // Detection confidence: prefer the strongest containing pattern's confidence.
    const containing = patternsBySignalToken.get(token) ?? [];
    const patternConf = containing.reduce((m, p) => Math.max(m, p.confidence), 0);
    const detectionConfidence = clamp01(Math.max(patternConf, sig.confidence));

    // Band derivation — note the *inverse* relationship for confidence: a strongly
    // detected negative signal indicates LOW capacity in that construct, which is
    // what the library's confidence_band encodes.
    const capacity = 1 - sig.strength;
    const confBand = capacity >= 0.6 ? 'high' : capacity >= 0.35 ? 'moderate' : 'low';
    const load = clamp01(meta.severity * sig.strength);
    const loadBand = load >= 0.65 ? 'high' : load >= 0.4 ? 'moderate' : 'low';

    const entry = selectLibraryEntry(entries, confBand, loadBand, personaKey);
    if (!entry) continue;

    const profile = priorityProfile(meta.intervention_priority);
    const recoveryFactor = meta.recovery_indicator ? 0.9 : 0.75;
    const expectedImpact = round4(clamp01(meta.severity * detectionConfidence * recoveryFactor));
    const patternRefs = Array.from(new Set(containing.map((p) => p.pattern_key)));

    const candidate: RankedIntervention = {
      intervention_key: meta.construct_key.toLowerCase(),
      construct_key: meta.construct_key,
      title: deriveTitle(meta.signal_name, meta.construct_key),
      description: entry.intervention_text,
      rationale: entry.rationale,
      effort: profile.effort,
      duration: profile.duration,
      expected_impact: expectedImpact,
      confidence: round4(detectionConfidence),
      review_window: profile.review_window,
      safety_level: entry.safety_level,
      severity: round4(meta.severity),
      signal_refs: [sig.signal_key],
      pattern_refs: patternRefs,
      rank: 0,
    };

    const existing = byConstruct.get(candidate.intervention_key);
    if (!existing) {
      byConstruct.set(candidate.intervention_key, candidate);
    } else {
      // Merge lineage; keep the stronger-impact framing.
      existing.signal_refs = Array.from(new Set([...existing.signal_refs, ...candidate.signal_refs]));
      existing.pattern_refs = Array.from(new Set([...existing.pattern_refs, ...candidate.pattern_refs]));
      existing.severity = Math.max(existing.severity, candidate.severity);
      if (candidate.expected_impact > existing.expected_impact) {
        existing.title = candidate.title;
        existing.description = candidate.description;
        existing.rationale = candidate.rationale;
        existing.effort = candidate.effort;
        existing.duration = candidate.duration;
        existing.expected_impact = candidate.expected_impact;
        existing.confidence = candidate.confidence;
        existing.review_window = candidate.review_window;
        existing.safety_level = candidate.safety_level;
      }
    }
  }

  // Rank: expected_impact, then severity, then detection confidence.
  const ranked = Array.from(byConstruct.values()).sort(
    (a, b) =>
      b.expected_impact - a.expected_impact ||
      b.severity - a.severity ||
      b.confidence - a.confidence,
  );
  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}

// ── Schema bootstrap (idempotent, lazy) ─────────────────────────────────────
let schemaPromise: Promise<void> | null = null;

/** Ensure `capadex_session_interventions` exists (mirrors the canonical migration). */
export function ensureInterventionSchema(pool: Pool): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS capadex_session_interventions (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id       UUID NOT NULL,
        intervention_key VARCHAR(120) NOT NULL,
        construct_key    VARCHAR(120) NOT NULL,
        title            TEXT,
        description      TEXT,
        rationale        TEXT,
        effort           VARCHAR(20),
        duration         VARCHAR(40),
        expected_impact  NUMERIC(5,4) NOT NULL DEFAULT 0,
        confidence       NUMERIC(5,4) NOT NULL DEFAULT 0,
        review_window    VARCHAR(40),
        safety_level     VARCHAR(20),
        severity         NUMERIC(5,4) NOT NULL DEFAULT 0,
        signal_refs      JSONB NOT NULL DEFAULT '[]',
        pattern_refs     JSONB NOT NULL DEFAULT '[]',
        rank             INTEGER NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_capadex_interventions_session ON capadex_session_interventions (session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_interventions_session_key
        ON capadex_session_interventions (session_id, intervention_key);
    `)
    .then(() => undefined)
    .catch((err) => {
      schemaPromise = null;
      throw err;
    });
  return schemaPromise;
}

// ── Persistence ──────────────────────────────────────────────────────────────
/**
 * Upsert interventions with absolute values and reconcile away any the current
 * recompute no longer produces. Idempotent under replay, mirroring the composite
 * and pattern persistence.
 */
export async function persistInterventions(
  pool: Db,
  sessionId: string,
  interventions: RankedIntervention[],
): Promise<number> {
  const keep = interventions.map((i) => i.intervention_key);
  await pool.query(
    `DELETE FROM capadex_session_interventions
       WHERE session_id = $1 AND intervention_key <> ALL($2::text[])`,
    [sessionId, keep],
  );

  if (interventions.length === 0) return 0;

  let written = 0;
  for (const it of interventions) {
    const res = await pool.query(
      `INSERT INTO capadex_session_interventions
         (session_id, intervention_key, construct_key, title, description, rationale,
          effort, duration, expected_impact, confidence, review_window, safety_level,
          severity, signal_refs, pattern_refs, rank, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16, NOW())
       ON CONFLICT (session_id, intervention_key) DO UPDATE SET
         construct_key   = EXCLUDED.construct_key,
         title           = EXCLUDED.title,
         description     = EXCLUDED.description,
         rationale       = EXCLUDED.rationale,
         effort          = EXCLUDED.effort,
         duration        = EXCLUDED.duration,
         expected_impact = EXCLUDED.expected_impact,
         confidence      = EXCLUDED.confidence,
         review_window   = EXCLUDED.review_window,
         safety_level    = EXCLUDED.safety_level,
         severity        = EXCLUDED.severity,
         signal_refs     = EXCLUDED.signal_refs,
         pattern_refs    = EXCLUDED.pattern_refs,
         rank            = EXCLUDED.rank,
         updated_at      = NOW()`,
      [
        sessionId,
        it.intervention_key,
        it.construct_key,
        it.title,
        it.description,
        it.rationale,
        it.effort,
        it.duration,
        it.expected_impact,
        it.confidence,
        it.review_window,
        it.safety_level,
        it.severity,
        JSON.stringify(it.signal_refs),
        JSON.stringify(it.pattern_refs),
        it.rank,
      ],
    );
    written += res.rowCount ?? 0;
  }
  return written;
}
