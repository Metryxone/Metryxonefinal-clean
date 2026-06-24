/**
 * Adaptive Assessment Seed (Task #71 — "make adaptive assessments actually
 * adjust difficulty per learner").
 *
 * Two idempotent, self-contained parts, run together at route registration so
 * they survive a merge to prod (per the project convention: a merge carries
 * CODE + migration DDL but NOT rows, so data activation must re-run as a seed).
 *
 *  A. Runtime Role-DNA expected levels.
 *     The adaptive engine reads `competency_runtime_weights` (keyed on
 *     `role_dna_profiles_v2`, a UUID) to drive difficulty from REAL role data
 *     instead of the career-stage anchor. Both tables ship empty. We populate
 *     them for the 5 roles that have curated DNA snapshots, sourcing the
 *     per-competency expected proficiency from `onto_role_weights`
 *     (`expected_level`, a 1–5 ordinal per `onto_proficiency_levels`) and
 *     converting it to the 0–100 scale the runtime weights table uses
 *     (`level × 20`). Per-role differentiated, never fabricated.
 *
 *  B. Unified difficulty vocabulary + real harder/easier variants.
 *     `competency_question_templates` mixed two vocabularies (legacy
 *     easy/medium/hard and laddered foundational/intermediate/advanced). We
 *     collapse to ONE 3-tier ladder (foundational/intermediate/advanced) and
 *     author a foundational + advanced variant for each of the 7 served
 *     domains so SERVED difficulty can actually shift by role level (the bank
 *     was previously 100% medium across served domains).
 *
 * Idempotent: every write is guarded (ON CONFLICT DO NOTHING / existence
 * probe / value-stable UPDATE), so re-running is a no-op. Never deletes
 * runtime-generated rows.
 */
import type { Pool } from 'pg';

/* onto_proficiency_levels is a 1..5 ladder (5 = Expert). The runtime weights
 * table stores expected_level on a 0–100 scale (generator fallbacks are 60–65),
 * so a curated ordinal level L maps to L/5*100. Confirmed scale, not assumed. */
const PROFICIENCY_LEVEL_MAX = 5;
const SEED_DNA_VERSION = '2.0.0-curated';

function levelToPercent(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(100, Math.round((level / PROFICIENCY_LEVEL_MAX) * 100)));
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [name]);
    return !!r.rows[0]?.ok;
  } catch { return false; }
}

export interface AdaptiveAssessmentSeedResult {
  ok: boolean;
  runtime_role_dna: {
    roles_seeded: number;
    weights_inserted: number;
    skipped_existing: number;
    detail: { role_id: string; title: string; anchor: number; competencies: number; status: string }[];
  };
  difficulty: {
    normalized_easy: number;
    normalized_medium: number;
    normalized_hard: number;
    variants_inserted: number;
  };
  error?: string;
}

/* ----------------------------- Part A ----------------------------- */

async function seedRuntimeRoleDna(pool: Pool): Promise<AdaptiveAssessmentSeedResult['runtime_role_dna']> {
  const out: AdaptiveAssessmentSeedResult['runtime_role_dna'] = {
    roles_seeded: 0, weights_inserted: 0, skipped_existing: 0, detail: [],
  };

  // Required substrate. If any source/target table is missing we abstain
  // (honest no-op) rather than fabricate.
  for (const t of ['onto_dna_profiles', 'onto_role_weights', 'onto_roles', 'role_dna_profiles_v2', 'competency_runtime_weights']) {
    if (!(await tableExists(pool, t))) return out;
  }

  // Roles with a current DNA snapshot AND curated weights.
  const roles = await pool.query<{ dna_id: string; role_id: string; title: string }>(`
    SELECT dp.id AS dna_id, ro.id AS role_id, ro.title AS title
      FROM onto_dna_profiles dp
      JOIN onto_roles ro ON ro.id = dp.role_id
     WHERE dp.is_current = true
       AND EXISTS (SELECT 1 FROM onto_role_weights w WHERE w.dna_profile_id = dp.id)
     ORDER BY ro.title`);

  for (const role of roles.rows) {
    const weights = await pool.query<{ competency_id: string; weight: string; expected_level: number; source: string | null }>(
      `SELECT competency_id, weight, expected_level, source
         FROM onto_role_weights WHERE dna_profile_id = $1 AND expected_level IS NOT NULL`,
      [role.dna_id],
    );
    if (weights.rows.length === 0) continue;

    const expectedLevels: Record<string, number> = {};
    for (const w of weights.rows) expectedLevels[w.competency_id] = levelToPercent(Number(w.expected_level));
    const anchorAvg = Math.round(
      Object.values(expectedLevels).reduce((a, b) => a + b, 0) / Object.values(expectedLevels).length,
    );
    const seedMarker = `onto_dna:${role.dna_id}`;

    // Upsert the V2 DNA row (no unique key → idempotent via the seed marker).
    let dnaV2Id: string;
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM role_dna_profiles_v2 WHERE metadata->>'seed_source' = $1 LIMIT 1`, [seedMarker],
    );
    if (existing.rows[0]) {
      dnaV2Id = existing.rows[0].id;
      out.skipped_existing += 1;
    } else {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO role_dna_profiles_v2 (role_id, dna_name, dna_version, expected_levels, metadata, is_active)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, true)
         RETURNING id`,
        [
          role.role_id,
          `${role.title} — curated Role DNA`,
          SEED_DNA_VERSION,
          JSON.stringify(expectedLevels),
          JSON.stringify({ seed_source: seedMarker, provenance: 'onto_role_weights', scale: '0-100 (level×20)', anchor: anchorAvg }),
        ],
      );
      dnaV2Id = ins.rows[0].id;
      out.roles_seeded += 1;
    }

    // Insert runtime weights ONLY if none exist for this DNA row (never clobber
    // rows the live resolution engine may have generated).
    const cnt = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM competency_runtime_weights WHERE role_dna_id = $1::uuid`, [dnaV2Id],
    );
    let inserted = 0;
    if (Number(cnt.rows[0]?.n ?? 0) === 0) {
      for (const w of weights.rows) {
        const pct = levelToPercent(Number(w.expected_level));
        await pool.query(
          `INSERT INTO competency_runtime_weights
             (role_dna_id, competency_id, competency_code, importance_weight, expected_level,
              minimum_threshold, criticality, weighting_reason, weighting_context)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          [
            dnaV2Id,
            w.competency_id,
            w.competency_id,
            Math.round(Number(w.weight) * 100),
            pct,
            Math.round(pct * 0.7),
            pct >= 80 ? 'critical' : pct >= 60 ? 'important' : 'supporting',
            'Seeded from curated Role-DNA (onto_role_weights)',
            JSON.stringify({ provenance: 'onto_role_weights', source: w.source ?? 'curated', raw_level: Number(w.expected_level), scale: '1-5 → 0-100 (level×20)' }),
          ],
        );
        inserted += 1;
      }
      out.weights_inserted += inserted;
    }

    out.detail.push({
      role_id: role.role_id, title: role.title, anchor: anchorAvg,
      competencies: weights.rows.length, status: inserted > 0 ? 'seeded' : 'present',
    });
  }

  return out;
}

/* ----------------------------- Part B ----------------------------- */

// Foundational (easier) + advanced (harder) variants for the 7 served domains.
// Real, developmental multiple-choice items (best_option = correct index).
// Language is developmental — never a hiring/suitability judgement.
type Variant = { dom: string; band: 'foundational' | 'advanced'; prompt: string; options: string[]; best: number };

const DIFFICULTY_VARIANTS: Variant[] = [
  // COG — Cognitive / reasoning
  { dom: 'COG', band: 'foundational', prompt: 'A task takes 2 hours. You have 3 identical tasks to complete one after another. How long will they take in total?', options: ['6 hours', '5 hours', '3 hours', '2 hours'], best: 0 },
  { dom: 'COG', band: 'advanced', prompt: "A system's error rate doubles every hour. It was 0.5% at 09:00. Without intervention, the first hour it EXCEEDS 8% is:", options: ['14:00', '13:00', '12:00', '15:00'], best: 0 },
  // COM — Communication
  { dom: 'COM', band: 'foundational', prompt: 'A teammate asks for a quick project update. The clearest first response is to:', options: ['Share the current status and the next step', 'Recount every detail from the past month', 'Tell them to check the tracker themselves', 'Postpone the conversation indefinitely'], best: 0 },
  { dom: 'COM', band: 'advanced', prompt: 'You must convey complex technical findings to a non-technical executive who has five minutes. The most effective structure is to:', options: ['Lead with the decision needed and its impact, then offer detail on request', 'Walk through the methodology chronologically', 'Send the full report and read it aloud line by line', 'Open with technical caveats to manage expectations'], best: 0 },
  // LEA — Leadership
  { dom: 'LEA', band: 'foundational', prompt: 'A new team member is unsure how to begin a task. A supportive first step is to:', options: ['Clarify the goal and ask what help they need', 'Reassign the task to someone faster', 'Wait to see whether they work it out alone', 'Quietly do the task yourself'], best: 0 },
  { dom: 'LEA', band: 'advanced', prompt: 'Two strong performers publicly disagree on direction, stalling delivery. The most constructive leadership move is to:', options: ['Facilitate a structured decision with shared criteria and a clear owner', 'Side with the more senior person to move quickly', 'Let them resolve it without any involvement', 'Escalate to your manager immediately'], best: 0 },
  // EXE — Execution
  { dom: 'EXE', band: 'foundational', prompt: 'You have several tasks due today. A reliable way to start is to:', options: ['Order them by priority and deadline, then begin the top one', 'Do the easiest tasks first regardless of deadline', 'Work on whichever feels most interesting', 'Wait until you feel fully ready'], best: 0 },
  { dom: 'EXE', band: 'advanced', prompt: 'Mid-sprint, a critical dependency slips by a week, threatening the deadline. The strongest execution response is to:', options: ['Re-scope to protect the core outcome and communicate the trade-offs early', 'Keep the original plan and hope to catch up', 'Quietly drop lower-priority items without telling stakeholders', 'Pause all work until the dependency is resolved'], best: 0 },
  // ADP — Adaptability
  { dom: 'ADP', band: 'foundational', prompt: 'Your usual tool is unavailable just before a deadline. A practical response is to:', options: ['Find a workable alternative to keep making progress', 'Stop work until the tool comes back', 'Miss the deadline and cite the outage', 'Wait for someone else to fix it'], best: 0 },
  { dom: 'ADP', band: 'advanced', prompt: 'New market data you helped gather reverses your team’s strategy. The most adaptive response is to:', options: ['Integrate the new evidence and help reframe the plan around it', 'Defend the original plan you invested in', 'Wait for leadership to dictate every change', 'Treat the new data as a one-off exception'], best: 0 },
  // TEC — Technical
  { dom: 'TEC', band: 'foundational', prompt: 'Before sharing your work for others to use, a good basic practice is to:', options: ['Test that it works and note how to run it', 'Share it immediately and fix issues later', 'Keep the steps only in your head', 'Remove documentation to save time'], best: 0 },
  { dom: 'TEC', band: 'advanced', prompt: 'A recurring production issue has an unclear root cause. The most rigorous technical approach is to:', options: ['Form a hypothesis, reproduce it, then isolate the cause with evidence', 'Re-apply the fix that worked last time and move on', 'Restart the system each time it fails', 'Add broad error suppression to hide the symptom'], best: 0 },
  // EIQ — Emotional intelligence
  { dom: 'EIQ', band: 'foundational', prompt: 'A colleague seems frustrated during a meeting. A considerate response is to:', options: ['Acknowledge it and ask if they would like to share', 'Ignore it to keep things moving', 'Point it out publicly', 'Assume they are upset with you'], best: 0 },
  { dom: 'EIQ', band: 'advanced', prompt: 'You receive sharp, partly unfair criticism in front of peers. The most emotionally intelligent response is to:', options: ['Stay composed, acknowledge any valid point, and continue the discussion later', 'Defend yourself forcefully on the spot', 'Withdraw and disengage for the rest of the meeting', 'Match the tone to stand your ground'], best: 0 },
];

async function seedDifficulty(pool: Pool): Promise<AdaptiveAssessmentSeedResult['difficulty']> {
  const out = { normalized_easy: 0, normalized_medium: 0, normalized_hard: 0, variants_inserted: 0 };
  if (!(await tableExists(pool, 'competency_question_templates'))) return out;

  // 1. Collapse the two vocabularies onto ONE 3-tier ladder (idempotent —
  //    already-laddered rows are untouched).
  const e = await pool.query(`UPDATE competency_question_templates SET difficulty_band='foundational', updated_at=now() WHERE lower(difficulty_band)='easy'`);
  const m = await pool.query(`UPDATE competency_question_templates SET difficulty_band='intermediate', updated_at=now() WHERE lower(difficulty_band)='medium'`);
  const h = await pool.query(`UPDATE competency_question_templates SET difficulty_band='advanced', updated_at=now() WHERE lower(difficulty_band)='hard'`);
  out.normalized_easy = e.rowCount ?? 0;
  out.normalized_medium = m.rowCount ?? 0;
  out.normalized_hard = h.rowCount ?? 0;

  // 2. New rows default to the middle band of the unified ladder.
  await pool.query(`ALTER TABLE competency_question_templates ALTER COLUMN difficulty_band SET DEFAULT 'intermediate'`).catch(() => {});

  // 3. Author harder/easier variants so SERVED difficulty can shift by level.
  for (const v of DIFFICULTY_VARIANTS) {
    const key = `adaptive_${v.dom}_${v.band}_v1`;
    const originId = `${v.dom}_${v.band === 'foundational' ? 'F' : 'A'}1`;
    const body = JSON.stringify({ prompt: v.prompt, options: v.options, best_option: v.best, origin_id: originId });
    const r = await pool.query(
      `INSERT INTO competency_question_templates
         (template_key, competency_code, question_type, template_body, difficulty_band, status, source, notes)
       VALUES ($1, $2, 'multiple_choice', $3::jsonb, $4, 'approved', 'seed', 'Adaptive difficulty variant (Task #71)')
       ON CONFLICT (template_key) DO NOTHING`,
      [key, v.dom, body, v.band],
    );
    out.variants_inserted += r.rowCount ?? 0;
  }

  return out;
}

/* ----------------------------- orchestrator ----------------------------- */

export async function runAdaptiveAssessmentSeed(pool: Pool): Promise<AdaptiveAssessmentSeedResult> {
  try {
    const runtime_role_dna = await seedRuntimeRoleDna(pool);
    const difficulty = await seedDifficulty(pool);
    return { ok: true, runtime_role_dna, difficulty };
  } catch (e: any) {
    return {
      ok: false,
      runtime_role_dna: { roles_seeded: 0, weights_inserted: 0, skipped_existing: 0, detail: [] },
      difficulty: { normalized_easy: 0, normalized_medium: 0, normalized_hard: 0, variants_inserted: 0 },
      error: e?.message ?? 'adaptive assessment seed failed',
    };
  }
}
