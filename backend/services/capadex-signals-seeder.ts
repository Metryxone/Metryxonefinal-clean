/**
 * CAPADEX Signals Ontology Seeder.
 *
 * WHY THIS EXISTS
 * ──────────────
 * The composite engine builds its definitions by grouping rows in
 * `capadex_signals` by `hidden_pattern_contribution` cluster.  Each row's
 * anchor signal + its `related_signals` become the required co-active tokens
 * for that composite.
 *
 * The production ontology shipped with 20 rows covering the *diagnostic*
 * signal vocabulary.  Real sessions emit a broader *observational* vocabulary
 * (`general_concern`, `stress_management`, `emotional_regulation`,
 * `cognitive_blocking`, etc.) that has NO rows in the table → zero composite
 * definitions that can match → composites = 0 even when signals exist.
 *
 * This seeder adds:
 *   A. Essential rows — new/expanded clusters whose required sets cover actual
 *      session signal keys, so the composite engine fires immediately.
 *   B. Supporting rows — missing `related_signals` entries (referenced by
 *      existing rows but absent as standalone rows) to give them proper
 *      signalMeta weights and domain information.
 *
 * All inserts are ON CONFLICT (signal_id) DO NOTHING — fully idempotent and
 * safe to replay any number of times.  After seeding the composite runtime
 * cache is force-busted so the pipeline picks up the new definitions
 * immediately.
 */
import type { Pool } from 'pg';
import { loadCompositeRuntime } from './composite-signal-engine';
import { ensureSignalOntologySchema } from './signal-ontology-schema';

let seededOnce = false;

interface SeedRow {
  signal_id:                  string;
  signal_name:                string;
  domain:                     string;
  signal_family?:             string;
  category?:                  string;
  detection_type?:            string;
  severity_weight:            number;
  confidence_weight:          number;
  persistence_weight?:        number;
  hidden_pattern_contribution: string;
  related_signals:            string;
  behavioral_meaning?:        string;
}

const SEED_ROWS: SeedRow[] = [
  // ── A. ESSENTIAL: enable composites for real session signals ────────────────

  // burnout_cluster — adds 'general_concern' so sessions with
  //   emotional_overload + general_concern form the composite (5 of 7 sessions).
  {
    signal_id:                   'SIG_S001',
    signal_name:                 'general_concern',
    domain:                      'emotional',
    signal_family:               'stress',
    category:                    'behavioral',
    detection_type:              'direct',
    severity_weight:             0.65,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'burnout_cluster',
    related_signals:             'emotional_overload, stress_reactivity',
    behavioral_meaning:          'Generalised worry and ambient stress activation',
  },

  // burnout_cluster — adds 'stress_reactivity' (referenced in related_signals
  //   of existing rows but absent as a standalone row with proper meta).
  {
    signal_id:                   'SIG_S002',
    signal_name:                 'stress_reactivity',
    domain:                      'emotional',
    signal_family:               'stress',
    category:                    'physiological',
    detection_type:              'direct',
    severity_weight:             0.70,
    confidence_weight:           0.70,
    hidden_pattern_contribution: 'burnout_cluster',
    related_signals:             'emotional_overload, burnout_tendency',
    behavioral_meaning:          'Heightened physiological stress response to triggers',
  },

  // stress_regulation_cluster (NEW) — covers sessions 3 & 4 which have
  //   stress_management + emotional_regulation + emotional_overload but nothing
  //   from the existing burnout_cluster related signals.
  {
    signal_id:                   'SIG_S003',
    signal_name:                 'stress_regulation',
    domain:                      'emotional',
    signal_family:               'regulation',
    category:                    'coping',
    detection_type:              'inferred',
    severity_weight:             0.65,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'stress_regulation_cluster',
    related_signals:             'stress_management, emotional_regulation',
    behavioral_meaning:          'Active modulation of internal stress states',
  },
  {
    signal_id:                   'SIG_S004',
    signal_name:                 'stress_management',
    domain:                      'emotional',
    signal_family:               'regulation',
    category:                    'coping',
    detection_type:              'direct',
    severity_weight:             0.60,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'stress_regulation_cluster',
    related_signals:             'stress_regulation, emotional_regulation',
    behavioral_meaning:          'Effortful strategies to regulate and reduce stress',
  },
  {
    signal_id:                   'SIG_S005',
    signal_name:                 'emotional_regulation',
    domain:                      'emotional',
    signal_family:               'regulation',
    category:                    'coping',
    detection_type:              'direct',
    severity_weight:             0.60,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'stress_regulation_cluster',
    related_signals:             'stress_regulation, stress_management',
    behavioral_meaning:          'Capacity to manage and modulate emotional responses',
  },

  // career_stress_cluster (NEW) — covers sessions 1 & 2 which have both
  //   placement_anxiety and career_confusion co-active.
  {
    signal_id:                   'SIG_S006',
    signal_name:                 'career_anxiety',
    domain:                      'cognitive',
    signal_family:               'career_development',
    category:                    'career',
    detection_type:              'inferred',
    severity_weight:             0.70,
    confidence_weight:           0.70,
    hidden_pattern_contribution: 'career_stress_cluster',
    related_signals:             'placement_anxiety, career_confusion',
    behavioral_meaning:          'Compounded worry about career path and employability',
  },

  // cognitive_avoidance_cluster (NEW) — covers session 7 (avoidance_pattern
  //   + cognitive_blocking).  avoidance_pattern normalises to 'avoidance'
  //   which matches avoidance_behavior's coreToken in the ontology.
  {
    signal_id:                   'SIG_S007',
    signal_name:                 'cognitive_avoidance',
    domain:                      'cognitive',
    signal_family:               'avoidance',
    category:                    'behavioral',
    detection_type:              'inferred',
    severity_weight:             0.70,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'cognitive_avoidance_cluster',
    related_signals:             'avoidance_behavior, cognitive_blocking',
    behavioral_meaning:          'Blocking of cognitive engagement combined with approach avoidance',
  },
  {
    signal_id:                   'SIG_S008',
    signal_name:                 'cognitive_blocking',
    domain:                      'cognitive',
    signal_family:               'executive_function',
    category:                    'cognitive',
    detection_type:              'direct',
    severity_weight:             0.70,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'cognitive_avoidance_cluster',
    related_signals:             'cognitive_avoidance, avoidance_behavior',
    behavioral_meaning:          'Inability to initiate or sustain cognitive processing',
  },

  // hesitation_cluster (NEW) — covers session 1 which shows both
  //   prolonged_hesitation and rapid_answer (extreme response-time variance).
  {
    signal_id:                   'SIG_S009',
    signal_name:                 'behavioral_hesitation',
    domain:                      'behavioral',
    signal_family:               'response_pattern',
    category:                    'behavioral',
    detection_type:              'telemetry',
    severity_weight:             0.65,
    confidence_weight:           0.70,
    hidden_pattern_contribution: 'hesitation_cluster',
    related_signals:             'prolonged_hesitation, rapid_answer',
    behavioral_meaning:          'Dysregulated response timing indicating decision uncertainty',
  },
  {
    signal_id:                   'SIG_S010',
    signal_name:                 'prolonged_hesitation',
    domain:                      'behavioral',
    signal_family:               'response_pattern',
    category:                    'behavioral',
    detection_type:              'telemetry',
    severity_weight:             0.65,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'hesitation_cluster',
    related_signals:             'behavioral_hesitation, rapid_answer',
    behavioral_meaning:          'Extended pause before answering, indicating rumination or avoidance',
  },
  {
    signal_id:                   'SIG_S011',
    signal_name:                 'rapid_answer',
    domain:                      'behavioral',
    signal_family:               'response_pattern',
    category:                    'behavioral',
    detection_type:              'telemetry',
    severity_weight:             0.55,
    confidence_weight:           0.60,
    hidden_pattern_contribution: 'hesitation_cluster',
    related_signals:             'behavioral_hesitation, prolonged_hesitation',
    behavioral_meaning:          'Impulsive answering pattern suggesting avoidance of deep processing',
  },

  // ── B. SUPPORTING: complete missing related_signals entries ────────────────

  {
    signal_id:                   'SIG_S012',
    signal_name:                 'self_doubt_loop',
    domain:                      'emotional',
    signal_family:               'self_worth',
    category:                    'psychological',
    detection_type:              'direct',
    severity_weight:             0.70,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'instability_cluster',
    related_signals:             'confidence_instability, fear_of_failure',
    behavioral_meaning:          'Recurring cycle of self-questioning undermining action',
  },
  {
    signal_id:                   'SIG_S013',
    signal_name:                 'approval_seeking',
    domain:                      'social',
    signal_family:               'social_validation',
    category:                    'social',
    detection_type:              'direct',
    severity_weight:             0.60,
    confidence_weight:           0.60,
    hidden_pattern_contribution: 'identity_dependency_cluster',
    related_signals:             'external_dependency, peer_comparison',
    behavioral_meaning:          'Reliance on external validation to maintain self-concept',
  },
  {
    signal_id:                   'SIG_S014',
    signal_name:                 'communication_hesitation',
    domain:                      'social',
    signal_family:               'social_engagement',
    category:                    'social',
    detection_type:              'direct',
    severity_weight:             0.60,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'isolation_cluster',
    related_signals:             'social_withdrawal, fear_of_rejection',
    behavioral_meaning:          'Reluctance to initiate or sustain communication',
  },
  {
    signal_id:                   'SIG_S015',
    signal_name:                 'fear_of_rejection',
    domain:                      'social',
    signal_family:               'social_engagement',
    category:                    'social',
    detection_type:              'direct',
    severity_weight:             0.65,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'isolation_cluster',
    related_signals:             'social_withdrawal, communication_hesitation',
    behavioral_meaning:          'Anticipatory fear of social rejection driving withdrawal',
  },
  {
    signal_id:                   'SIG_S016',
    signal_name:                 'identity_confusion',
    domain:                      'cognitive',
    signal_family:               'identity',
    category:                    'psychological',
    detection_type:              'direct',
    severity_weight:             0.70,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'career_paralysis_cluster',
    related_signals:             'career_confusion, future_uncertainty',
    behavioral_meaning:          'Unclear or unstable sense of professional identity',
  },
  {
    signal_id:                   'SIG_S017',
    signal_name:                 'disengagement_pattern',
    domain:                      'behavioral',
    signal_family:               'engagement',
    category:                    'behavioral',
    detection_type:              'direct',
    severity_weight:             0.65,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'disengagement_cluster',
    related_signals:             'avoidance_behavior, motivation_decline',
    behavioral_meaning:          'Systematic withdrawal from previously engaging activities',
  },
  {
    signal_id:                   'SIG_S018',
    signal_name:                 'placement_withdrawal',
    domain:                      'behavioral',
    signal_family:               'career_engagement',
    category:                    'behavioral',
    detection_type:              'direct',
    severity_weight:             0.70,
    confidence_weight:           0.70,
    hidden_pattern_contribution: 'employability_gap_cluster',
    related_signals:             'avoidance_behavior, employability_insecurity',
    behavioral_meaning:          'Avoidance of placement-related activities despite awareness',
  },
  {
    signal_id:                   'SIG_S019',
    signal_name:                 'execution_breakdown',
    domain:                      'executive_function',
    signal_family:               'execution',
    category:                    'executive_function',
    detection_type:              'direct',
    severity_weight:             0.70,
    confidence_weight:           0.70,
    hidden_pattern_contribution: 'execution_breakdown_cluster',
    related_signals:             'procrastination_pattern, low_followthrough',
    behavioral_meaning:          'Failure to translate intention into sustained action',
  },
  {
    signal_id:                   'SIG_S020',
    signal_name:                 'low_followthrough',
    domain:                      'behavioral',
    signal_family:               'execution',
    category:                    'behavioral',
    detection_type:              'direct',
    severity_weight:             0.60,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'execution_breakdown_cluster',
    related_signals:             'procrastination_pattern, execution_breakdown',
    behavioral_meaning:          'Pattern of initiating tasks but failing to complete them',
  },
  {
    signal_id:                   'SIG_S021',
    signal_name:                 'low_resilience',
    domain:                      'emotional',
    signal_family:               'resilience',
    category:                    'psychological',
    detection_type:              'direct',
    severity_weight:             0.65,
    confidence_weight:           0.65,
    hidden_pattern_contribution: 'collapse_cluster',
    related_signals:             'burnout_tendency, emotional_overload',
    behavioral_meaning:          'Reduced capacity to recover from stressors or setbacks',
  },
];

/**
 * Seed missing capadex_signals rows.  Safe to call on every startup — the
 * ON CONFLICT guard makes it idempotent.  Forces the composite runtime cache
 * to reload after seeding so the pipeline picks up the new definitions
 * immediately.
 *
 * Returns the number of rows actually inserted (0 on subsequent calls).
 */
export async function seedCapadexSignals(pool: Pool): Promise<number> {
  if (seededOnce) return 0;

  let inserted = 0;
  try {
    // Bootstrap the ontology table first so the inserts below can't silently
    // no-op on a fresh DB that never ran the signal-ontology migration.
    await ensureSignalOntologySchema(pool);

    for (const r of SEED_ROWS) {
      const res = await pool.query(
        `INSERT INTO capadex_signals
           (signal_id, signal_name, domain, signal_family, category,
            detection_type, severity_weight, confidence_weight,
            persistence_weight, hidden_pattern_contribution,
            related_signals, behavioral_meaning)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (signal_id) DO NOTHING`,
        [
          r.signal_id,
          r.signal_name,
          r.domain,
          r.signal_family ?? null,
          r.category ?? null,
          r.detection_type ?? null,
          r.severity_weight,
          r.confidence_weight,
          r.persistence_weight ?? r.severity_weight,
          r.hidden_pattern_contribution,
          r.related_signals,
          r.behavioral_meaning ?? null,
        ],
      );
      inserted += res.rowCount ?? 0;
    }

    // Force-bust the composite runtime cache so the pipeline immediately
    // uses the new definitions on the next loadCompositeRuntime call.
    if (inserted > 0) {
      await loadCompositeRuntime(pool, true);
      console.log(
        `[capadex-signals-seeder] inserted ${inserted} new signal rows; composite runtime cache busted`,
      );
    }

    seededOnce = true;
  } catch (err) {
    console.error('[capadex-signals-seeder] seed error:', (err as Error).message);
    // Non-fatal: pipeline will still run with whatever ontology exists.
  }

  return inserted;
}

/**
 * Returns the current seed status without inserting.
 */
export async function getSignalSeedStatus(pool: Pool): Promise<{
  total_in_ontology: number;
  seeded_rows: number;
  clusters: { cluster: string; signal_count: number }[];
}> {
  try {
    const [totalRes, seededRes, clusterRes] = await Promise.all([
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM capadex_signals`),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM capadex_signals WHERE signal_id LIKE 'SIG_S%'`,
      ),
      pool.query<{ cluster: string; signal_count: string }>(
        `SELECT hidden_pattern_contribution AS cluster, COUNT(*)::text AS signal_count
           FROM capadex_signals
          WHERE hidden_pattern_contribution IS NOT NULL
          GROUP BY hidden_pattern_contribution
          ORDER BY signal_count::int DESC`,
      ),
    ]);
    return {
      total_in_ontology: Number(totalRes.rows[0]?.count ?? 0),
      seeded_rows:       Number(seededRes.rows[0]?.count ?? 0),
      clusters:          clusterRes.rows.map((r) => ({
        cluster:      r.cluster,
        signal_count: Number(r.signal_count),
      })),
    };
  } catch {
    return { total_in_ontology: 0, seeded_rows: 0, clusters: [] };
  }
}
