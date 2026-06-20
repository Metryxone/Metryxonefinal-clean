/**
 * PHASE 4.9 — Career Passport Foundation: Career Passport Engine (context loader).
 *
 * A pure, read-only, never-throws layer that LOADS — once, for one subject —
 * the already-computed outputs of the platform's existing Phase-3/Phase-4
 * engines and the subject's profile/history substrate, so the passport profile
 * stitcher (passport-profile.ts) can COMPOSE them into the six passport
 * components WITHOUT recomputing or fabricating anything:
 *
 *   - Competency Profile   — competency-runtime.getProfile (domain-proxy levels).
 *   - EI Profile           — ei-profile-engine.buildEiProfile.
 *   - Career Profile        — career_seeker_profiles (the subject's own JSONB).
 *   - Career Readiness     — career-readiness-aggregator.buildCareerReadiness (4.3).
 *   - Achievements         — DERIVED from measured competency/EI/readiness facts.
 *   - Career Journey       — append-only history tables (4.3 / 4.4 / 4.8 / competency).
 *
 * This is DISTINCT from the existing Career Passport subsystem (cp_* tables,
 * `careerPassport` flag, /api/passport/*). That is a user-EDITABLE portfolio;
 * this is a read-only, generated COMPOSITION snapshot of engine outputs.
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed outputs — never recomputes a score, never
 *     fabricates a level, never zero-fills an absent measure.
 *   - Coverage (data exists) and Confidence (trustworthy) are reported as TWO
 *     SEPARATE axes by the stitcher; this loader only marks presence honestly.
 *   - Read-only & never-throws: every source call is guarded; one failing source
 *     degrades its component to an honest absence (with a note), never the whole
 *     passport.
 *   - GET-never-writes: `competency-runtime.getProfile` lazily CREATEs the
 *     competency-runtime schema, so it is called ONLY when `competencyRuntimeReady`
 *     confirms every relation already exists (a complete no-op). Every other
 *     source on this path (buildEiProfile / buildCareerReadiness / the
 *     career_seeker_profiles read / the history reads) performs ZERO DDL — each
 *     history read uses a to_regclass probe. So a GET can never create anything.
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { competencyRuntimeReady } from './career-gap-engine.js';
import { getProfile, type ProfileView } from './competency-runtime.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import {
  buildCareerReadiness,
  type CareerReadinessEnvelope,
} from './career-readiness-aggregator.js';

export const CAREER_PASSPORT_ENGINE_VERSION = '4.9.0';

/** A single career-journey timeline event, sourced from an append-only history
 *  table (or the competency profile's creation). Never fabricated. */
export interface JourneyEvent {
  at: string;            // ISO timestamp
  kind: string;          // event family (e.g. 'readiness_snapshot')
  label: string;         // human-readable summary
  source: string;        // origin table / engine
  detail?: Record<string, unknown>;
}

/** Everything needed to stitch the six passport components, loaded ONCE. */
export interface PassportContext {
  subject_id: string;
  runtimeReady: boolean;
  competencyProfile: ProfileView | null;
  eiProfile: EiProfile | null;
  readiness: CareerReadinessEnvelope | null;
  careerProfile: { exists: boolean; data: Record<string, unknown> | null };
  journeyEvents: JourneyEvent[];
  notes: string[];
}

/** Read-only: load the subject's own career_seeker_profiles JSONB (no DDL). */
async function loadCareerProfile(
  pool: Pool,
  subjectId: string,
): Promise<{ exists: boolean; data: Record<string, unknown> | null }> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_seeker_profiles') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, data: null };
  const r = await pool
    .query(`SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`, [subjectId])
    .catch(() => ({ rows: [] as any[] }));
  if (!r.rows.length) return { exists: false, data: null };
  const data = r.rows[0].data;
  return { exists: true, data: data && typeof data === 'object' ? (data as Record<string, unknown>) : null };
}

/**
 * Read-only career-journey timeline from the additive append-only history tables
 * built by earlier phases. Each table is to_regclass-probed first so a GET NEVER
 * triggers DDL; an absent table => that source simply contributes no events.
 */
async function loadJourneyEvents(
  pool: Pool,
  subjectId: string,
  competencyProfile: ProfileView | null,
): Promise<JourneyEvent[]> {
  const events: JourneyEvent[] = [];

  const exists = async (rel: string): Promise<boolean> => {
    const p = await pool
      .query(`SELECT to_regclass('public.' || $1) AS t`, [rel])
      .catch(() => ({ rows: [{ t: null }] }));
    return !!p.rows[0]?.t;
  };

  // Career readiness snapshots (Phase 4.3).
  if (await exists('career_readiness_history')) {
    const r = await pool
      .query(
        `SELECT created_at, overall_band, overall_score
           FROM career_readiness_history
          WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [subjectId],
      )
      .catch(() => ({ rows: [] as any[] }));
    for (const row of r.rows as any[]) {
      events.push({
        at: new Date(row.created_at).toISOString(),
        kind: 'readiness_snapshot',
        label: `Career readiness snapshot${row.overall_band ? ` — ${row.overall_band}` : ''}`,
        source: 'career_readiness_history',
        detail: { overall_band: row.overall_band ?? null, overall_score: row.overall_score ?? null },
      });
    }
  }

  // Career gap snapshots (Phase 4.4).
  if (await exists('career_gap_history')) {
    const r = await pool
      .query(
        `SELECT created_at, role_title, total_gaps, total_blocking
           FROM career_gap_history
          WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [subjectId],
      )
      .catch(() => ({ rows: [] as any[] }));
    for (const row of r.rows as any[]) {
      events.push({
        at: new Date(row.created_at).toISOString(),
        kind: 'gap_snapshot',
        label: `Career gap analysis${row.role_title ? ` — ${row.role_title}` : ''}`,
        source: 'career_gap_history',
        detail: { total_gaps: row.total_gaps ?? null, total_blocking: row.total_blocking ?? null },
      });
    }
  }

  // Career simulation runs (Phase 4.8).
  if (await exists('career_simulation_runs')) {
    const r = await pool
      .query(
        `SELECT created_at, kind, scenario_key, unlocked_count
           FROM career_simulation_runs
          WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [subjectId],
      )
      .catch(() => ({ rows: [] as any[] }));
    for (const row of r.rows as any[]) {
      events.push({
        at: new Date(row.created_at).toISOString(),
        kind: 'simulation_run',
        label: `Career simulation — ${row.scenario_key ?? row.kind ?? 'what-if'}`,
        source: 'career_simulation_runs',
        detail: { kind: row.kind ?? null, unlocked_count: row.unlocked_count ?? null },
      });
    }
  }

  // Competency assessment (the measured profile's creation — single anchor event).
  if (competencyProfile?.created_at) {
    events.push({
      at: new Date(competencyProfile.created_at).toISOString(),
      kind: 'competency_assessment',
      label: 'Competency assessment completed',
      source: 'competency-runtime/getProfile',
      detail: {
        overall_level: competencyProfile.overall_level ?? null,
        history_count: competencyProfile.history_count ?? 0,
      },
    });
  }

  // Newest first; ties broken by source for deterministic ordering.
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.source.localeCompare(b.source)));
  return events;
}

/**
 * Load the full passport composition context for a subject. Read-only &
 * never-throws — each source is independently guarded so one failure degrades
 * only its own component to an honest absence.
 */
export async function loadPassportContext(pool: Pool, subjectId: string): Promise<PassportContext> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // GET-never-writes: getProfile -> ensureCompetencyRuntimeSchema (DDL). Probe
  // first; only compose engines when the schema already exists so a GET can
  // never create it. EVERY composed competency-runtime consumer transitively
  // reaches getProfile() -> ensureCompetencyRuntimeSchema() (DDL) UNCONDITIONALLY:
  //   - getProfile (competency)            -> ensureCompetencyRuntimeSchema
  //   - buildEiProfile -> computeEmployabilityScore -> loadScoringInputs -> getProfile
  //   - buildCareerReadiness -> computeRoleReadinessV2 -> computeRoleReadinessForSubject -> getProfile
  // So ALL THREE are gated behind the same read-only competencyRuntimeReady probe.
  // When the runtime schema is absent every one is honestly unavailable and NO
  // schema is ever created on a read (GET-never-writes).
  const runtimeReady = await competencyRuntimeReady(pool).catch(() => false);

  let competencyProfile: ProfileView | null = null;
  let eiProfile: EiProfile | null = null;
  let readiness: CareerReadinessEnvelope | null = null;

  if (runtimeReady) {
    competencyProfile = await getProfile(pool, sid).catch((e) => {
      notes.push(`Competency profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    eiProfile = await buildEiProfile(pool, sid).catch((e) => {
      notes.push(`EI profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    readiness = await buildCareerReadiness(pool, sid).catch((e) => {
      notes.push(`Career readiness unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
  } else {
    notes.push(
      'Competency, EI, and career-readiness profiles not measurable — competency runtime schema is not initialized (read-only; no schema created).',
    );
  }

  const careerProfile = await loadCareerProfile(pool, sid).catch(() => ({ exists: false, data: null }));

  const journeyEvents = await loadJourneyEvents(pool, sid, competencyProfile).catch(() => [] as JourneyEvent[]);

  return {
    subject_id: sid,
    runtimeReady,
    competencyProfile,
    eiProfile,
    readiness,
    careerProfile,
    journeyEvents,
    notes,
  };
}
