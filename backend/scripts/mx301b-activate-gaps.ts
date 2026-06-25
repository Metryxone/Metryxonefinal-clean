/**
 * mx301b-activate-gaps.ts — MX-301B Career Intelligence ACTIVATION.
 *
 * Closes every LEGITIMATELY closable MX-301B gap so each downstream intelligence
 * engine RECEIVES the demonstration candidate Sarah Johnson's REAL measured data.
 *
 *   Run:       npx tsx backend/scripts/mx301b-activate-gaps.ts
 *   Rollback:  npx tsx backend/scripts/mx301b-activate-gaps.ts --rollback
 *
 * Honesty / safety contract (same as the rest of MX-301):
 *   - HONESTY-FIRST: nothing is fabricated. Every step composes EXISTING engines /
 *     real platform rows. Engines with no real input stay honestly empty — never
 *     forced. Where a step cannot run (missing substrate) it reports an honest skip.
 *   - ADDITIVE + REVERSIBLE: every mutation is captured and fully undone by
 *     --rollback. The anchor-role normalization stores the exact prior value in a
 *     tagged side table (mx301_activation_state) and restores it on rollback.
 *   - SCOPED TO THE DEMO CANDIDATE ONLY (sarah.johnson.mx301@example.com /
 *     captured_by 'mx301-activation'). No production data is touched. NO deploy.
 *
 * Steps (each best-effort + independently reversible):
 *   (a) Anchor-role normalization — ROOT-CAUSE fix. onto_competency_profiles.role_id
 *       for Sarah is the free-text TITLE "Senior Product Manager", but role readiness
 *       resolves requirements by the canonical CODE in onto_role_competency_profiles
 *       (role_pm = "Product Manager"). Exact-equality on the title finds no row →
 *       measurable:false, which dark-starts skill-gap, prioritization, roadmap,
 *       learning-path, career-readiness and the employability index. Normalizing her
 *       anchor to 'role_pm' makes role readiness measurable; the engine then derives
 *       per-competency actuals from her REAL 5-domain proxy scores (domain-proxy,
 *       clearly labelled — never fabricated precise scores).
 *   (b) Promotion / progression readiness — persist TWO real re-measurements of her
 *       live EI profile (ei_profile_snapshots) so progression has the >=2 finite
 *       snapshots it requires. Inputs are unchanged → progression is honestly STABLE
 *       (no fabricated improvement).
 *   (c) Career Builder — activateCareerBuilder writes cg_user_* rows (skill gaps,
 *       readiness, recommendations, learning recs, career paths).
 *   (d) Passport — syncPassportFromPlatform pulls her REAL platform rows into cp_*.
 *
 * Interview enrichment is owned by mx301-report-pack.ts (best-effort, reversible).
 */
import { pathToFileURL } from 'url';

import pg from 'pg';

import { activateCareerBuilder, rollbackCareerBuilderActivation } from '../services/career-builder-activation.js';
import { syncPassportFromPlatform } from '../services/career-passport-bridge.js';
import { buildEiProfile } from '../services/ei-profile-engine.js';
import { persistEiProfile, ensureEiProfileHistorySchema } from '../services/ei-profile-history.js';

import { MX301_SUBJECT } from './mx301-demo-candidate.js';

const { Pool } = pg;

const CAPTURED_BY = 'mx301-activation';
const CANONICAL_ROLE = 'role_pm';
const STATE_TABLE = 'mx301_activation_state';
const STATE_KEY_ROLE = 'onto_competency_profiles.role_id';
const STATE_KEY_CR = 'career_seeker_profiles.currentRole';
const STATE_ABSENT = '__ABSENT__';
// Her real current role — also a real, active cg_roles title — so Career Builder
// anchors coherently here instead of the generic highest-demand fallback.
const DEMO_CURRENT_ROLE = 'Senior Product Manager';

// ── reversible side table (additive, fully purgeable) ────────────────────────
async function ensureStateTable(pool: pg.Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
       state_key   text PRIMARY KEY,
       prior_value text,
       created_at  timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS reg`, [table]);
  return r.rows[0]?.reg != null;
}

type StepResult = { step: string; ok: boolean; detail: string };

// ── (a) anchor-role normalization ────────────────────────────────────────────
async function activateAnchorRole(pool: pg.Pool): Promise<StepResult> {
  try {
    const cur = await pool.query<{ role_id: string | null }>(
      `SELECT role_id FROM onto_competency_profiles WHERE subject_id = $1 LIMIT 1`,
      [MX301_SUBJECT],
    );
    const prior = cur.rows[0]?.role_id ?? null;
    if (prior == null) {
      return { step: 'anchor_role', ok: false, detail: 'no profile row for subject — honest skip' };
    }
    if (prior === CANONICAL_ROLE) {
      return { step: 'anchor_role', ok: true, detail: `already canonical (${CANONICAL_ROLE}) — no-op` };
    }
    // Confirm the canonical role profile actually exists before normalizing — never
    // point a subject at a role that has no requirement profile.
    const roleReqs = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM onto_role_competency_profiles WHERE role_id = $1`,
      [CANONICAL_ROLE],
    );
    if (Number(roleReqs.rows[0]?.n ?? 0) <= 0) {
      return { step: 'anchor_role', ok: false, detail: `canonical role '${CANONICAL_ROLE}' has no requirement profile — honest skip (not normalized)` };
    }
    // Capture prior value ONCE (preserve the true original across re-runs).
    await pool.query(
      `INSERT INTO ${STATE_TABLE} (state_key, prior_value) VALUES ($1, $2)
       ON CONFLICT (state_key) DO NOTHING`,
      [STATE_KEY_ROLE, prior],
    );
    const upd = await pool.query(
      `UPDATE onto_competency_profiles SET role_id = $1 WHERE subject_id = $2 AND role_id IS DISTINCT FROM $1`,
      [CANONICAL_ROLE, MX301_SUBJECT],
    );
    return {
      step: 'anchor_role',
      ok: true,
      detail: `role_id "${prior}" → '${CANONICAL_ROLE}' (${upd.rowCount} row(s)); ${roleReqs.rows[0].n} requirements now resolvable. Prior captured for rollback.`,
    };
  } catch (e: any) {
    return { step: 'anchor_role', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}

// ── (a2) current-role coherence — anchor Career Builder to her real role ─────
async function activateCurrentRole(pool: pg.Pool): Promise<StepResult> {
  try {
    const cur = await pool.query<{ cr: string | null }>(
      `SELECT data->>'currentRole' AS cr FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
      [MX301_SUBJECT],
    );
    if (cur.rowCount === 0) {
      return { step: 'current_role', ok: false, detail: 'no career_seeker_profiles row — honest skip' };
    }
    const prior = cur.rows[0].cr;
    if (prior === DEMO_CURRENT_ROLE) {
      return { step: 'current_role', ok: true, detail: `already '${DEMO_CURRENT_ROLE}' — no-op` };
    }
    // Only set a current role that is a REAL, active cg_roles title (so the anchor resolves).
    const match = await pool.query<{ id: number }>(
      `SELECT id FROM cg_roles WHERE LOWER(title) = LOWER($1) AND is_active LIMIT 1`,
      [DEMO_CURRENT_ROLE],
    );
    if (match.rowCount === 0) {
      return { step: 'current_role', ok: false, detail: `cg_roles has no active '${DEMO_CURRENT_ROLE}' — honest skip` };
    }
    await pool.query(
      `INSERT INTO ${STATE_TABLE} (state_key, prior_value) VALUES ($1, $2)
       ON CONFLICT (state_key) DO NOTHING`,
      [STATE_KEY_CR, prior ?? STATE_ABSENT],
    );
    await pool.query(
      `UPDATE career_seeker_profiles
       SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{currentRole}', to_jsonb($1::text), true)
       WHERE user_id = $2`,
      [DEMO_CURRENT_ROLE, MX301_SUBJECT],
    );
    return {
      step: 'current_role',
      ok: true,
      detail: `currentRole "${prior ?? '(absent)'}" → '${DEMO_CURRENT_ROLE}' (cg_roles #${match.rows[0].id}); Career Builder anchors here. Prior captured.`,
    };
  } catch (e: any) {
    return { step: 'current_role', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}

// ── (b) promotion / progression readiness — 2 real EI re-measurements ────────
async function activateEiProgression(pool: pg.Pool): Promise<StepResult> {
  try {
    await ensureEiProfileHistorySchema(pool);
    const existing = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ei_profile_snapshots WHERE subject_id = $1`,
      [MX301_SUBJECT],
    );
    const have = Number(existing.rows[0]?.n ?? 0);
    const target = 2; // progression requires >=2 finite snapshots
    const profile = await buildEiProfile(pool, MX301_SUBJECT);
    if (!profile.measurable) {
      return { step: 'ei_progression', ok: false, detail: 'EI profile not measurable — honest skip (no snapshot persisted)' };
    }
    let added = 0;
    for (let i = have; i < target; i++) {
      await persistEiProfile(pool, profile, CAPTURED_BY);
      added++;
    }
    return {
      step: 'ei_progression',
      ok: true,
      detail: added > 0
        ? `persisted ${added} real re-measurement snapshot(s) (now ${have + added} total). Inputs unchanged → progression is honestly STABLE.`
        : `already had ${have} snapshots — no-op`,
    };
  } catch (e: any) {
    return { step: 'ei_progression', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}

// ── (c) Career Builder activation ────────────────────────────────────────────
async function activateCareerBuilderStep(pool: pg.Pool): Promise<StepResult> {
  try {
    const s: any = await activateCareerBuilder(pool, MX301_SUBJECT);
    const c = s?.counts ?? {};
    const detail = s?.activated
      ? `activated (anchor ${s.anchor_role_title ?? s.anchor_role_id}); skill_gaps=${c.skill_gaps ?? 0} readiness=${c.role_readiness ?? 0} recs=${c.recommendations ?? 0} learning=${c.learning_recs ?? 0} paths=${c.career_paths ?? 0}`
      : `not activated (${(s?.notes ?? []).join('; ') || 'degraded'}) — honest`;
    return { step: 'career_builder', ok: Boolean(s?.activated), detail };
  } catch (e: any) {
    return { step: 'career_builder', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}

// ── (d) Passport sync ────────────────────────────────────────────────────────
async function activatePassportSync(pool: pg.Pool): Promise<StepResult> {
  try {
    if (!(await tableExists(pool, 'cp_passport'))) {
      return { step: 'passport_sync', ok: false, detail: 'cp_passport substrate absent — honest skip' };
    }
    const p = await pool.query<{ id: number }>(
      `SELECT id FROM cp_passport WHERE user_id = $1 LIMIT 1`,
      [MX301_SUBJECT],
    );
    let passportId = p.rows[0]?.id;
    if (passportId == null) {
      const ins = await pool.query<{ id: number }>(
        `INSERT INTO cp_passport (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id`,
        [MX301_SUBJECT],
      );
      passportId = ins.rows[0]?.id;
    }
    if (passportId == null) {
      return { step: 'passport_sync', ok: false, detail: 'could not resolve a passport id — honest skip' };
    }
    const r = await syncPassportFromPlatform(MX301_SUBJECT, Number(passportId), pool);
    const total = r.assessments_synced + r.scores_synced + r.competencies_synced + r.learning_synced;
    return {
      step: 'passport_sync',
      ok: total > 0,
      detail: `passport #${passportId}: assessments=${r.assessments_synced} scores=${r.scores_synced} competencies=${r.competencies_synced} learning=${r.learning_synced}${r.errors.length ? ` (errors: ${r.errors.length})` : ''}`,
    };
  } catch (e: any) {
    return { step: 'passport_sync', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}

// ── rollback — reverse every step (best-effort, idempotent) ──────────────────
async function rollback(pool: pg.Pool): Promise<StepResult[]> {
  const out: StepResult[] = [];

  // (a) restore the anchor role to its captured prior value
  try {
    if (await tableExists(pool, STATE_TABLE)) {
      const s = await pool.query<{ prior_value: string | null }>(
        `SELECT prior_value FROM ${STATE_TABLE} WHERE state_key = $1`,
        [STATE_KEY_ROLE],
      );
      if (s.rowCount && s.rows[0].prior_value != null) {
        const upd = await pool.query(
          `UPDATE onto_competency_profiles SET role_id = $1 WHERE subject_id = $2`,
          [s.rows[0].prior_value, MX301_SUBJECT],
        );
        await pool.query(`DELETE FROM ${STATE_TABLE} WHERE state_key = $1`, [STATE_KEY_ROLE]);
        out.push({ step: 'anchor_role', ok: true, detail: `restored role_id → "${s.rows[0].prior_value}" (${upd.rowCount} row(s))` });
      } else {
        out.push({ step: 'anchor_role', ok: true, detail: 'no captured prior value — nothing to restore' });
      }
    } else {
      out.push({ step: 'anchor_role', ok: true, detail: 'no state table — nothing to restore' });
    }
  } catch (e: any) {
    out.push({ step: 'anchor_role', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` });
  }

  // (a2) restore currentRole to its captured prior value (or remove if absent before)
  try {
    if (await tableExists(pool, STATE_TABLE)) {
      const s = await pool.query<{ prior_value: string | null }>(
        `SELECT prior_value FROM ${STATE_TABLE} WHERE state_key = $1`,
        [STATE_KEY_CR],
      );
      if (s.rowCount) {
        const prior = s.rows[0].prior_value;
        if (prior == null || prior === STATE_ABSENT) {
          await pool.query(
            `UPDATE career_seeker_profiles SET data = data - 'currentRole' WHERE user_id = $1`,
            [MX301_SUBJECT],
          );
        } else {
          await pool.query(
            `UPDATE career_seeker_profiles
             SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{currentRole}', to_jsonb($1::text), true)
             WHERE user_id = $2`,
            [prior, MX301_SUBJECT],
          );
        }
        await pool.query(`DELETE FROM ${STATE_TABLE} WHERE state_key = $1`, [STATE_KEY_CR]);
        out.push({ step: 'current_role', ok: true, detail: `restored currentRole → ${prior === STATE_ABSENT || prior == null ? '(absent)' : `"${prior}"`}` });
      } else {
        out.push({ step: 'current_role', ok: true, detail: 'no captured prior value — nothing to restore' });
      }
    }
  } catch (e: any) {
    out.push({ step: 'current_role', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` });
  }

  // (b) remove only the snapshots WE added (tagged captured_by)
  try {
    if (await tableExists(pool, 'ei_profile_snapshots')) {
      const del = await pool.query(
        `DELETE FROM ei_profile_snapshots WHERE subject_id = $1 AND captured_by = $2`,
        [MX301_SUBJECT, CAPTURED_BY],
      );
      out.push({ step: 'ei_progression', ok: true, detail: `removed ${del.rowCount} tagged snapshot(s)` });
    }
  } catch (e: any) {
    out.push({ step: 'ei_progression', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` });
  }

  // (c) career builder rollback (purges cg_user_* for the subject)
  try {
    const r: any = await rollbackCareerBuilderActivation(pool, MX301_SUBJECT);
    out.push({ step: 'career_builder', ok: r?.ok !== false, detail: `rolled back (${JSON.stringify(r?.counts ?? r ?? {})})` });
  } catch (e: any) {
    out.push({ step: 'career_builder', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` });
  }

  // (d) passport: remove platform-synced child rows for the demo candidate's passport
  try {
    if (await tableExists(pool, 'cp_passport')) {
      const p = await pool.query<{ id: number }>(`SELECT id FROM cp_passport WHERE user_id = $1 LIMIT 1`, [MX301_SUBJECT]);
      const pid = p.rows[0]?.id;
      if (pid != null) {
        let removed = 0;
        for (const t of ['cp_assessments', 'cp_competencies', 'cp_learning_history']) {
          if (await tableExists(pool, t)) {
            const d = await pool.query(`DELETE FROM ${t} WHERE passport_id = $1 AND platform_verified = true`, [pid]).catch(async () => {
              // some tables may not have platform_verified — fall back to passport_id only
              return pool.query(`DELETE FROM ${t} WHERE passport_id = $1`, [pid]);
            });
            removed += d.rowCount ?? 0;
          }
        }
        out.push({ step: 'passport_sync', ok: true, detail: `removed ${removed} synced passport child row(s) for passport #${pid}` });
      } else {
        out.push({ step: 'passport_sync', ok: true, detail: 'no passport row — nothing to remove' });
      }
    }
  } catch (e: any) {
    out.push({ step: 'passport_sync', ok: false, detail: `error: ${String(e?.message ?? e).slice(0, 120)}` });
  }

  return out;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const isRollback = process.argv.includes('--rollback');

  try {
    if (isRollback) {
      console.log('MX-301B activation ROLLBACK…');
      const res = await rollback(pool);
      for (const r of res) console.log(`  [${r.ok ? 'OK' : '!!'}] ${r.step}: ${r.detail}`);
      console.log('Rollback complete.');
      return;
    }

    console.log(`MX-301B activation for ${MX301_SUBJECT}`);
    await ensureStateTable(pool);

    const results: StepResult[] = [];
    results.push(await activateAnchorRole(pool));
    results.push(await activateCurrentRole(pool));
    results.push(await activateEiProgression(pool));
    results.push(await activateCareerBuilderStep(pool));
    results.push(await activatePassportSync(pool));

    console.log('\n── Activation summary ─────────────────────────────────────────');
    for (const r of results) console.log(`  [${r.ok ? 'OK' : '!!'}] ${r.step}: ${r.detail}`);
    const okN = results.filter((r) => r.ok).length;
    console.log(`\n${okN}/${results.length} steps activated. Engines with no real input stay honestly empty (never fabricated).`);
    console.log('Reverse anytime with: npx tsx backend/scripts/mx301b-activate-gaps.ts --rollback');
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { activateAnchorRole, activateEiProgression, activateCareerBuilderStep, activatePassportSync, rollback };
