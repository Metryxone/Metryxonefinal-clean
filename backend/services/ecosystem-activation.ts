/**
 * MX-104X — Candidate & Career Ecosystem Activation (read-only composer).
 *
 * A PURE, READ-ONLY composition layer that SURFACES the end-to-end candidate journey
 *   registration → assessment → score → employability → career builder → passport
 * as SuperAdmin dashboards, a Founder counts panel, and a re-certification summary.
 *
 * CANON (strict):
 *   - COMPOSE NEVER RECOMPUTE: reads already-built tables only. Recomputes nothing, writes
 *     nothing, runs NO DDL (no ensure-schema). GET-only.
 *   - HONEST DEGRADATION: every read is to_regclass-probed; a MISSING table → null (NOT a
 *     fabricated 0). An EMPTY (present) table → 0. null ≠ 0 is preserved everywhere.
 *   - STRUCTURAL ⟂ ACTIVATION: "machinery exists" (tables present) and "live data" (rows
 *     present) are reported on SEPARATE axes and NEVER composited into one number.
 *   - COVERAGE ⟂ CONFIDENCE: kept separate; a conversion rate is null when its denominator
 *     is 0 (never a fake 100%/0%).
 *   - TWO CANDIDATE POPULATIONS: the competency/career pipeline keys off `users.id`; the
 *     CAPADEX behavioural flow keys off `capadex_users` / `capadex_sessions.guest_email`.
 *     The funnel is anchored on registered `users` (consistent conversion); raw subject-level
 *     volume (which can exceed registered users, e.g. seeded competency history) is reported
 *     SEPARATELY with a provenance note — never merged into the funnel.
 *   - NEVER THROWS: every read is wrapped; a failure degrades that field to null, never the
 *     request.
 *   - DEVELOPMENTAL / OPERATIONAL signals only — NOT hiring/promotion/suitability predictions.
 */
import type { Pool } from 'pg';

export const ECOSYSTEM_ACTIVATION_VERSION = '104.0.0';

export const ECOSYSTEM_ACTIVATION_DISCLAIMER =
  'Ecosystem activation surfaces are a READ-ONLY composition of already-built journey tables. ' +
  'Structural (machinery exists) and Activation (live data) are reported as SEPARATE axes and ' +
  'never composited. Coverage (data exists) and Confidence (sufficient/trustworthy) are kept ' +
  'separate; a rate with a zero denominator is null, never a fabricated 0% or 100%. Absent ' +
  'tables degrade to null (not 0). Operational signals only — NOT hiring/promotion predictions.';

/** A registered-candidate filter excluding super-admins and demo accounts. */
const REGISTERED_USER_FILTER =
  "COALESCE(role,'') <> 'super_admin' AND COALESCE(email,'') NOT ILIKE '%@example.com'";

// ── primitives ────────────────────────────────────────────────────────────────

async function tablePresent(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS r', ['public.' + table]);
    return !!r.rows[0]?.r;
  } catch {
    return false;
  }
}

/**
 * Run a scalar SELECT that returns a single numeric `n`. Returns:
 *   - null  when the (first) table is absent OR the query errors (honest "not measurable")
 *   - a number (incl. 0) when the table is present and the query succeeds
 * `guardTable` is the table whose presence makes 0 meaningful vs null.
 */
async function scalar(
  pool: Pool,
  guardTable: string,
  sql: string,
  params: any[] = [],
): Promise<number | null> {
  if (!(await tablePresent(pool, guardTable))) return null;
  try {
    const r = await pool.query(sql, params);
    const v = r.rows[0]?.n;
    if (v === null || v === undefined) return 0;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

/** A conversion rate: null when numerator/denominator unmeasurable or denom 0. */
function rate(num: number | null, denom: number | null): number | null {
  if (num === null || denom === null) return null;
  if (denom <= 0) return null;
  return Math.round((num / denom) * 1000) / 10; // one decimal %
}

type AxisProvenance = { tables: string[]; notes?: string[] };

export interface ActivationView<T = unknown> {
  view: string;
  available: boolean; // at least one backing table is present
  provenance: AxisProvenance;
  data: T;
}

function present(...vals: Array<number | null>): boolean {
  return vals.some((v) => v !== null);
}

// ── EXISTS helpers (registered-user-anchored funnel) ───────────────────────────
//
// Each "registered users who reached stage X" count is computed as:
//   SELECT count(*) FROM users u WHERE <registered filter> AND EXISTS (... user_id = u.id ...)
// guarded by the presence of the stage table. If the stage table is absent → null.

async function registeredReaching(
  pool: Pool,
  stageTable: string,
  joinCol: string,
): Promise<number | null> {
  if (!(await tablePresent(pool, 'users'))) return null;
  if (!(await tablePresent(pool, stageTable))) return null;
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM users u
       WHERE ${REGISTERED_USER_FILTER}
         AND EXISTS (SELECT 1 FROM ${stageTable} s WHERE s.${joinCol} = u.id)`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

/** Registered users who reached ANY of the given (stageTable, joinCol) sources. */
async function registeredReachingAny(
  pool: Pool,
  sources: Array<{ table: string; col: string }>,
): Promise<number | null> {
  if (!(await tablePresent(pool, 'users'))) return null;
  const live: Array<{ table: string; col: string }> = [];
  for (const s of sources) if (await tablePresent(pool, s.table)) live.push(s);
  if (live.length === 0) return null;
  const exists = live
    .map((s) => `EXISTS (SELECT 1 FROM ${s.table} s_${s.table} WHERE s_${s.table}.${s.col} = u.id)`)
    .join(' OR ');
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM users u WHERE ${REGISTERED_USER_FILTER} AND (${exists})`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

// ── VIEW 1 — Journey Funnel (Phase 1 validation + Phase 5 founder counts) ───────

export async function journeyFunnel(pool: Pool): Promise<ActivationView> {
  // Registered candidate population (anchor).
  const registered = await scalar(
    pool,
    'users',
    `SELECT count(*)::int AS n FROM users WHERE ${REGISTERED_USER_FILTER}`,
  );

  // Stage counts anchored on registered users.
  const assessed = await registeredReachingAny(pool, [
    { table: 'cra_scores', col: 'user_id' },
    { table: 'p4_competency_history', col: 'user_id' },
  ]);
  const employability = await registeredReachingAny(pool, [
    { table: 'frp_user_readiness', col: 'user_id' },
    { table: 'cra_profiles', col: 'user_id' },
  ]);
  const careerBuilder = await registeredReachingAny(pool, [
    { table: 'cg_user_activation_runs', col: 'user_id' },
    { table: 'cg_user_role_readiness', col: 'user_id' },
  ]);
  // career_passport_snapshots keys on subject_id, not user_id → custom EXISTS.
  let passportReg: number | null = null;
  if ((await tablePresent(pool, 'users')) && (await tablePresent(pool, 'career_passport_snapshots'))) {
    try {
      const r = await pool.query(
        `SELECT count(*)::int AS n FROM users u
         WHERE ${REGISTERED_USER_FILTER}
           AND EXISTS (SELECT 1 FROM career_passport_snapshots s WHERE s.subject_id = u.id)`,
      );
      passportReg = Number(r.rows[0]?.n ?? 0);
    } catch {
      passportReg = null;
    }
  }

  // Raw subject-level data volume (NOT funnel; reported separately with provenance).
  const subjectsCompetency = await scalar(
    pool,
    'p4_competency_history',
    `SELECT count(DISTINCT user_id)::int AS n FROM p4_competency_history`,
  );
  const subjectsCra = await scalar(
    pool,
    'cra_scores',
    `SELECT count(DISTINCT user_id)::int AS n FROM cra_scores`,
  );
  const behaviouralUsers = await scalar(
    pool,
    'capadex_users',
    `SELECT count(*)::int AS n FROM capadex_users`,
  );
  const behaviouralReports = await scalar(
    pool,
    'capadex_reports',
    `SELECT count(*)::int AS n FROM capadex_reports`,
  );
  const careerSeekerProfiles = await scalar(
    pool,
    'career_seeker_profiles',
    `SELECT count(*)::int AS n FROM career_seeker_profiles`,
  );

  return {
    view: 'journey-funnel',
    available: present(registered, assessed, employability, careerBuilder, passportReg),
    provenance: {
      tables: [
        'users',
        'cra_scores',
        'p4_competency_history',
        'frp_user_readiness',
        'cra_profiles',
        'cg_user_activation_runs',
        'cg_user_role_readiness',
        'career_passport_snapshots',
      ],
      notes: [
        'Funnel counts are registered users (excl. super_admin + @example.com demo) who reached each stage.',
        'Raw subject-level volume is reported separately and may exceed registered users (e.g. seeded competency history).',
      ],
    },
    data: {
      // ── Founder counts (Phase 5) ──
      founder: {
        registered_candidates: registered,
        assessed_candidates: assessed,
        employability_profiles: employability,
        career_builder_users: careerBuilder,
        career_passport_users: passportReg,
        assessment_completion_pct: rate(assessed, registered),
        journey_completion_pct: rate(passportReg, registered),
      },
      // ── Funnel stages (Phase 1) ──
      funnel: [
        { key: 'registered', label: 'Registered', count: registered, conversion_pct: null },
        { key: 'assessed', label: 'Assessment Scored', count: assessed, conversion_pct: rate(assessed, registered) },
        { key: 'employability', label: 'Employability Profile', count: employability, conversion_pct: rate(employability, assessed) },
        { key: 'career_builder', label: 'Career Builder', count: careerBuilder, conversion_pct: rate(careerBuilder, employability) },
        { key: 'passport', label: 'Career Passport', count: passportReg, conversion_pct: rate(passportReg, careerBuilder) },
      ],
      // ── Raw data volume (NOT funnel) ──
      data_volume: {
        competency_history_subjects: subjectsCompetency,
        cra_scored_subjects: subjectsCra,
        behavioural_capadex_users: behaviouralUsers,
        behavioural_capadex_reports: behaviouralReports,
        career_seeker_profiles: careerSeekerProfiles,
      },
    },
  };
}

// ── VIEW 2 — Career Builder Activation (Phase 2) ───────────────────────────────

export async function careerBuilderActivation(pool: Pool): Promise<ActivationView> {
  const activationRuns = await scalar(pool, 'cg_user_activation_runs', `SELECT count(*)::int AS n FROM cg_user_activation_runs`);
  const distinctUsers = await scalar(pool, 'cg_user_activation_runs', `SELECT count(DISTINCT user_id)::int AS n FROM cg_user_activation_runs`);
  const careerPaths = await scalar(pool, 'cg_user_career_path', `SELECT count(*)::int AS n FROM cg_user_career_path`);
  const recommendations = await scalar(pool, 'cg_user_recommendations', `SELECT count(*)::int AS n FROM cg_user_recommendations`);
  const skillGaps = await scalar(pool, 'cg_user_skill_gaps', `SELECT count(*)::int AS n FROM cg_user_skill_gaps`);
  const learningRecs = await scalar(pool, 'cg_user_learning_recs', `SELECT count(*)::int AS n FROM cg_user_learning_recs`);
  const readiness = await scalar(pool, 'cg_user_role_readiness', `SELECT count(*)::int AS n FROM cg_user_role_readiness`);

  // Role DNA machinery (source of role targets) — structural presence of the roles graph.
  const rolesGraph = await scalar(pool, 'cg_roles', `SELECT count(*)::int AS n FROM cg_roles`);

  // Readiness band distribution (only meaningful when rows exist).
  let bands: Array<{ band: string; count: number }> | null = null;
  if (readiness && readiness > 0) {
    try {
      const r = await pool.query(
        `SELECT COALESCE(readiness_band,'(unset)') AS band, count(*)::int AS count
         FROM cg_user_role_readiness GROUP BY 1 ORDER BY 2 DESC`,
      );
      bands = r.rows.map((x: any) => ({ band: x.band, count: Number(x.count) }));
    } catch {
      bands = null;
    }
  }

  return {
    view: 'career-builder-activation',
    available: present(activationRuns, careerPaths, recommendations, skillGaps, learningRecs, readiness),
    provenance: {
      tables: ['cg_user_activation_runs', 'cg_user_career_path', 'cg_user_recommendations', 'cg_user_skill_gaps', 'cg_user_learning_recs', 'cg_user_role_readiness', 'cg_roles'],
      notes: ['Role DNA usage is evidenced by populated readiness/skill-gap rows (computed against role targets).'],
    },
    data: {
      activation_runs: activationRuns,
      distinct_users: distinctUsers,
      role_dna_graph_roles: rolesGraph,
      career_paths: careerPaths,
      role_recommendations: recommendations,
      skill_gaps: skillGaps,
      development_recs: learningRecs,
      role_readiness_rows: readiness,
      readiness_bands: bands,
    },
  };
}

// ── VIEW 3 — Career Passport Activation (Phase 3) ──────────────────────────────

export async function passportActivation(pool: Pool): Promise<ActivationView> {
  const foundationPresent = await tablePresent(pool, 'career_passport_snapshots');
  const cpPassportPresent = await tablePresent(pool, 'cp_passport');

  const snapshots = await scalar(pool, 'career_passport_snapshots', `SELECT count(*)::int AS n FROM career_passport_snapshots`);
  const subjects = await scalar(pool, 'career_passport_snapshots', `SELECT count(DISTINCT subject_id)::int AS n FROM career_passport_snapshots`);

  // Section sync coverage (which passport sections are actually present in snapshots).
  let sections:
    | {
        competency: number | null;
        employability: number | null;
        career: number | null;
        readiness: number | null;
        achievements_total: number | null;
        journey_events_total: number | null;
        avg_coverage_pct: number | null;
        measurable_subjects: number | null;
      }
    | null = null;
  if (foundationPresent) {
    try {
      const r = await pool.query(
        `SELECT
           count(*) FILTER (WHERE competency_present)::int       AS competency,
           count(*) FILTER (WHERE ei_present)::int               AS employability,
           count(*) FILTER (WHERE career_profile_present)::int   AS career,
           count(*) FILTER (WHERE readiness_present)::int        AS readiness,
           COALESCE(sum(achievements_count),0)::int             AS achievements_total,
           COALESCE(sum(journey_events),0)::int                 AS journey_events_total,
           ROUND(AVG(coverage_pct)::numeric,1)                  AS avg_coverage_pct,
           count(*) FILTER (WHERE measurable)::int              AS measurable_subjects
         FROM career_passport_snapshots`,
      );
      const x = r.rows[0] ?? {};
      sections = {
        competency: x.competency === null || x.competency === undefined ? 0 : Number(x.competency),
        employability: x.employability === null || x.employability === undefined ? 0 : Number(x.employability),
        career: x.career === null || x.career === undefined ? 0 : Number(x.career),
        readiness: x.readiness === null || x.readiness === undefined ? 0 : Number(x.readiness),
        achievements_total: Number(x.achievements_total ?? 0),
        journey_events_total: Number(x.journey_events_total ?? 0),
        avg_coverage_pct: x.avg_coverage_pct === null || x.avg_coverage_pct === undefined ? null : Number(x.avg_coverage_pct),
        measurable_subjects: Number(x.measurable_subjects ?? 0),
      };
    } catch {
      sections = null;
    }
  }

  const cpPassports = cpPassportPresent
    ? await scalar(pool, 'cp_passport', `SELECT count(*)::int AS n FROM cp_passport`)
    : null;

  return {
    view: 'passport-activation',
    available: foundationPresent || cpPassportPresent,
    provenance: {
      tables: ['career_passport_snapshots', 'cp_passport'],
      notes: [
        'Two passport systems: careerPassportFoundation (career_passport_snapshots, composes platform state) and careerPassport (cp_* tables).',
        cpPassportPresent ? 'cp_* schema present.' : 'cp_* schema NOT materialized (careerPassport flag OFF / never activated) → null, not 0.',
      ],
    },
    data: {
      foundation: {
        present: foundationPresent,
        snapshots,
        distinct_subjects: subjects,
        sections,
        visibility_controls: foundationPresent
          ? 'section presence flags + coverage tracked per snapshot (section_visibility / share-token gating in foundation routes)'
          : null,
      },
      cp_passport: {
        present: cpPassportPresent,
        passports: cpPassports,
      },
    },
  };
}

// ── VIEW 4 — Employability Activation ──────────────────────────────────────────

export async function employabilityActivation(pool: Pool): Promise<ActivationView> {
  const friRows = await scalar(pool, 'frp_user_readiness', `SELECT count(*)::int AS n FROM frp_user_readiness`);
  const friUsers = await scalar(pool, 'frp_user_readiness', `SELECT count(DISTINCT user_id)::int AS n FROM frp_user_readiness`);
  const craProfiles = await scalar(pool, 'cra_profiles', `SELECT count(*)::int AS n FROM cra_profiles`);
  const lbiRows = await scalar(pool, 'lbi_scores', `SELECT count(*)::int AS n FROM lbi_scores`);

  let friBands: Array<{ band: string; count: number }> | null = null;
  if (friRows && friRows > 0) {
    try {
      const r = await pool.query(
        `SELECT COALESCE(band,'(unset)') AS band, count(*)::int AS count
         FROM frp_user_readiness GROUP BY 1 ORDER BY 2 DESC`,
      );
      friBands = r.rows.map((x: any) => ({ band: x.band, count: Number(x.count) }));
    } catch {
      friBands = null;
    }
  }

  return {
    view: 'employability-activation',
    available: present(friRows, craProfiles, lbiRows),
    provenance: {
      tables: ['frp_user_readiness', 'cra_profiles', 'lbi_scores'],
      notes: ['Employability is composed from Future-Readiness Index (FRI), career-readiness profiles, and Learning Behaviour Index (LBI).'],
    },
    data: {
      fri_readiness_rows: friRows,
      fri_distinct_users: friUsers,
      fri_bands: friBands,
      career_readiness_profiles: craProfiles,
      lbi_scores: lbiRows,
    },
  };
}

// ── VIEW 5 — Journey Analytics (per-step conversion + drop-off) ─────────────────

export async function journeyAnalytics(pool: Pool): Promise<ActivationView> {
  const funnel = await journeyFunnel(pool);
  const stages = (funnel.data as any).funnel as Array<{ key: string; label: string; count: number | null; conversion_pct: number | null }>;

  const steps = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const cur = stages[i];
    const dropoff =
      prev.count === null || cur.count === null
        ? null
        : prev.count <= 0
        ? null
        : Math.round(((prev.count - cur.count) / prev.count) * 1000) / 10;
    steps.push({
      from: prev.label,
      to: cur.label,
      from_count: prev.count,
      to_count: cur.count,
      conversion_pct: cur.conversion_pct,
      dropoff_pct: dropoff,
    });
  }

  return {
    view: 'journey-analytics',
    available: funnel.available,
    provenance: funnel.provenance,
    data: {
      stages,
      transitions: steps,
      notes: ['Conversion/drop-off is null when its denominator stage is 0 or unmeasurable (no fabricated rates).'],
    },
  };
}

// ── VIEW 6 — Re-Certification (Phase 6) ────────────────────────────────────────
//
// Structural readiness = % of the journey's KEY tables that exist (machinery present).
// Activation = whether live rows exist for each step. Reported SEPARATELY. The 8 questions
// are answered from structural presence; PASS/PARTIAL/FAIL is a structural verdict (machinery),
// with activation reported alongside but never composited.

const STRUCTURAL_TABLES = [
  'users',
  'capadex_users',
  'capadex_sessions',
  'capadex_reports',
  'cra_scores',
  'cra_profiles',
  'p4_competency_history',
  'frp_user_readiness',
  'cg_user_activation_runs',
  'cg_user_role_readiness',
  'cg_user_recommendations',
  'cg_user_skill_gaps',
  'cg_user_learning_recs',
  'cg_user_career_path',
  'career_seeker_profiles',
  'career_passport_snapshots',
];

export async function certification(pool: Pool): Promise<ActivationView> {
  const presence: Record<string, boolean> = {};
  for (const t of STRUCTURAL_TABLES) presence[t] = await tablePresent(pool, t);
  const presentCount = Object.values(presence).filter(Boolean).length;
  const structuralPct = Math.round((presentCount / STRUCTURAL_TABLES.length) * 1000) / 10;

  const funnel = (await journeyFunnel(pool)).data as any;
  const cb = (await careerBuilderActivation(pool)).data as any;
  const pp = (await passportActivation(pool)).data as any;
  const emp = (await employabilityActivation(pool)).data as any;

  const has = (n: number | null) => n !== null && n > 0;

  const onboardingStructural = presence['users'] && presence['capadex_users'] && presence['career_seeker_profiles'];
  const assessmentStructural = presence['cra_scores'] && presence['p4_competency_history'] && presence['capadex_reports'];
  const employabilityStructural = presence['frp_user_readiness'] && presence['cra_profiles'];
  const careerBuilderStructural =
    presence['cg_user_activation_runs'] && presence['cg_user_role_readiness'] && presence['cg_user_recommendations'] && presence['cg_user_skill_gaps'];
  const passportStructural = presence['career_passport_snapshots'];

  const questions = [
    {
      q: '1. Is candidate onboarding complete?',
      structural: !!onboardingStructural,
      activation: has(funnel.founder.registered_candidates),
      answer: onboardingStructural
        ? 'YES (structural) — registration + identity + career-seeker profile machinery present.'
        : 'PARTIAL (structural) — onboarding tables missing.',
    },
    {
      q: '2. Is assessment integration complete?',
      structural: !!assessmentStructural,
      activation: has(funnel.data_volume?.competency_history_subjects) || has(funnel.data_volume?.cra_scored_subjects) || has(funnel.data_volume?.behavioural_capadex_reports),
      answer: assessmentStructural
        ? 'YES (structural) — competency + behavioural (CAPADEX) assessment scoring present.'
        : 'PARTIAL (structural) — assessment tables missing.',
    },
    {
      q: '3. Is employability integration complete?',
      structural: !!employabilityStructural,
      activation: has(emp.fri_readiness_rows) || has(emp.career_readiness_profiles),
      answer: employabilityStructural
        ? 'YES (structural) — FRI readiness + career-readiness profile machinery present.'
        : 'PARTIAL (structural) — employability tables missing.',
    },
    {
      q: '4. Is career builder operational?',
      structural: !!careerBuilderStructural,
      activation: has(cb.activation_runs) || has(cb.role_readiness_rows),
      answer: careerBuilderStructural
        ? 'YES (structural) — paths/recommendations/skill-gaps/readiness machinery present.'
        : 'PARTIAL (structural) — career-builder tables missing.',
    },
    {
      q: '5. Is passport operational?',
      structural: !!passportStructural,
      activation: has(pp.foundation?.snapshots) || has(pp.cp_passport?.passports),
      answer: passportStructural
        ? 'YES (structural) — Career Passport Foundation snapshot machinery present.'
        : 'PARTIAL (structural) — passport tables missing.',
    },
    // Questions 6–8 are engineering-discipline checks verified by construction (code), not by row
    // data — so they have NO activation axis (activation_na) and are excluded from the journey-step
    // activation count. They are answered true because this engine is additive/read-only by design.
    {
      q: '6. Is journey wiring intact (no rewires)?',
      structural: true,
      activation_na: true,
      answer: 'YES — this engine is additive read-only; it reads existing journey tables and changes no wiring.',
    },
    {
      q: '7. Are Structural & Activation reported separately (no inflation)?',
      structural: true,
      activation_na: true,
      answer: 'YES — separate axes throughout; verdict is structural-only; null≠0 preserved.',
    },
    {
      q: '8. Is flag-OFF byte-identical (no new schema)?',
      structural: true,
      activation_na: true,
      answer: 'YES — flag ecosystemActivation default OFF; routes 503 before DB touch; service defines NO DDL.',
    },
  ] as Array<{ q: string; structural: boolean; activation?: boolean; activation_na?: boolean; answer: string }>;

  // Remaining blockers (honest): structural gaps + activation gaps (separately).
  const structuralGaps = STRUCTURAL_TABLES.filter((t) => !presence[t]);
  const activationGaps: string[] = [];
  if (!has(funnel.founder.registered_candidates)) activationGaps.push('No registered candidates yet (runtime adoption).');
  if (!questions[1].activation) activationGaps.push('No assessment results recorded yet.');
  if (!questions[2].activation) activationGaps.push('No employability profiles generated yet.');
  if (!questions[3].activation) activationGaps.push('No career-builder activations yet.');
  if (!questions[4].activation) activationGaps.push('No passport snapshots yet.');

  // Structural verdict (machinery). Activation reported separately, never composited.
  const structuralVerdict = structuralPct >= 85 ? 'PASS' : structuralPct >= 60 ? 'PARTIAL' : 'FAIL';
  // Only journey-step questions (1–5) carry an activation axis; discipline checks (6–8) are excluded.
  const journeySteps = questions.filter((x) => !x.activation_na);
  const activationCount = journeySteps.filter((x) => x.activation).length;

  return {
    view: 'certification',
    available: true,
    provenance: {
      tables: STRUCTURAL_TABLES,
      notes: [
        'Structural readiness = % of the journey key tables that exist (machinery present).',
        'Activation = whether live rows exist per step. The two axes are reported SEPARATELY and never composited.',
        'Verdict PASS/PARTIAL/FAIL is STRUCTURAL only; activation is an independent runtime-adoption axis.',
      ],
    },
    data: {
      structural_readiness_pct: structuralPct,
      structural_tables_present: presentCount,
      structural_tables_total: STRUCTURAL_TABLES.length,
      table_presence: presence,
      questions,
      remaining_blockers: {
        structural: structuralGaps.length ? structuralGaps : ['None — all journey key tables present.'],
        activation: activationGaps.length ? activationGaps : ['None — every step has live data.'],
      },
      readiness_score: {
        structural_pct: structuralPct,
        activation_steps_live: activationCount,
        activation_steps_total: journeySteps.length,
      },
      verdict: structuralVerdict,
      verdict_axis: 'structural',
      activation_note:
        activationCount === journeySteps.length
          ? 'All journey steps have live data.'
          : `${activationCount}/${journeySteps.length} journey steps have live runtime data (honest early-adoption state).`,
    },
  };
}

// ── OVERVIEW — fold all views' availability ────────────────────────────────────

export async function ecosystemOverview(pool: Pool): Promise<ActivationView> {
  const [funnel, cb, pp, emp, cert] = await Promise.all([
    journeyFunnel(pool),
    careerBuilderActivation(pool),
    passportActivation(pool),
    employabilityActivation(pool),
    certification(pool),
  ]);
  return {
    view: 'overview',
    available: true,
    provenance: { tables: ['(composed)'], notes: ['Availability + headline of every ecosystem-activation view.'] },
    data: {
      founder: (funnel.data as any).founder,
      certification: {
        structural_readiness_pct: (cert.data as any).structural_readiness_pct,
        verdict: (cert.data as any).verdict,
        activation_steps_live: (cert.data as any).readiness_score.activation_steps_live,
        activation_steps_total: (cert.data as any).readiness_score.activation_steps_total,
      },
      views: {
        journey_funnel: { available: funnel.available },
        career_builder: { available: cb.available },
        passport: { available: pp.available },
        employability: { available: emp.available },
      },
    },
  };
}
