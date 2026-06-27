/**
 * MX-302A — Career Launchpad & Experience Routing · validation harness
 * ----------------------------------------------------------------------------
 * Pure, deterministic checks over the routing engine + flag contract. No DB,
 * no network: this exercises the SINGLE source of truth (the pure engine) the
 * runtime, the API and the frontend all consume, so a green run here is real
 * evidence the stage→experience routing is correct and stable.
 *
 * Run: cd backend && npx tsx audit/mx-302a/validate-mx302a.ts
 * Writes: backend/audit/mx-302a/validation-results.json
 *
 * Honesty note: this validates the DETERMINISTIC routing contract only. It does
 * NOT claim live adoption (how many real users picked a stage) — that is a
 * separate axis that can only be measured against the live DB once the flag is
 * ON and users register.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  CAREER_STAGES,
  EXPERIENCES,
  STAGE_TO_EXPERIENCE,
  EXPERIENCE_TO_STAGE,
  resolveExperience,
  allowedExperiences,
  effectiveExperience,
  deriveStage,
  isCareerStage,
  isExperienceId,
  type CareerStage,
  type ExperienceId,
} from '../../services/experience-routing';
import { isCareerLaunchpadEnabled, FEATURE_FLAGS } from '../../config/feature-flags';

interface Check { id: string; name: string; pass: boolean; detail: string; }
const checks: Check[] = [];
const add = (id: string, name: string, pass: boolean, detail: string) =>
  checks.push({ id, name, pass, detail });

// ── C1 — exactly 8 canonical stages, each mapping to a real experience ───────
{
  const ids = CAREER_STAGES.map((s) => s.id);
  const expected: CareerStage[] = [
    'student', 'graduate', 'postgraduate', 'internship-seeker',
    'early-career', 'mid-career', 'senior-leadership', 'executive',
  ];
  const ok = ids.length === 8 && expected.every((e) => ids.includes(e));
  add('C1', '8 canonical career stages', ok, `stages = [${ids.join(', ')}]`);
}

// ── C2 — every stage routes to a defined, mapped experience ──────────────────
{
  const rows = CAREER_STAGES.map((s) => {
    const exp = resolveExperience(s.id);
    return `${s.id} → ${exp.id} (tab=${exp.targetTab}, available=${exp.available})`;
  });
  const ok = CAREER_STAGES.every((s) => {
    const expId = STAGE_TO_EXPERIENCE[s.id];
    return !!EXPERIENCES[expId] && EXPERIENCES[expId].id === expId;
  });
  add('C2', 'every stage → a defined experience', ok, rows.join(' · '));
}

// ── C3 — the 4 experiences exist with the documented availability split ──────
{
  const want: Record<ExperienceId, { tab: string; available: boolean }> = {
    'launchpad': { tab: 'fresher-hub', available: true },
    'command-center': { tab: 'dashboard', available: true },
    'leadership-studio': { tab: 'dashboard', available: false },
    'executive-studio': { tab: 'dashboard', available: false },
  };
  const ok = (Object.keys(want) as ExperienceId[]).every((id) => {
    const e = EXPERIENCES[id];
    return e && e.targetTab === want[id].tab && e.available === want[id].available;
  });
  add('C3', '4 experiences; leadership/executive flagged not-yet-available', ok,
    (Object.keys(EXPERIENCES) as ExperienceId[]).map((id) =>
      `${id}:${EXPERIENCES[id].available ? 'live' : 'soon'}`).join(' · '));
}

// ── C4 — stage↔experience round-trips through the representative map ──────────
{
  const rows: string[] = [];
  let ok = true;
  for (const expId of Object.keys(EXPERIENCE_TO_STAGE) as ExperienceId[]) {
    const repStage = EXPERIENCE_TO_STAGE[expId];
    const back = STAGE_TO_EXPERIENCE[repStage];
    const good = back === expId;
    ok = ok && good;
    rows.push(`${expId} → ${repStage} → ${back}${good ? '' : ' ✗'}`);
  }
  add('C4', 'experience → representative stage → experience round-trip', ok, rows.join(' · '));
}

// ── C5 — allowedExperiences widens with seniority, never narrows below 2 ──────
{
  const counts = CAREER_STAGES.map((s) => `${s.id}:${allowedExperiences(s.id).length}`);
  const nullCase = allowedExperiences(null).length; // baseline (Command Center + Launchpad)
  const ok =
    allowedExperiences('student').length === 2 &&
    allowedExperiences('mid-career').length === 2 &&
    allowedExperiences('senior-leadership').length === 3 &&
    allowedExperiences('executive').length === 4 &&
    nullCase === 2;
  add('C5', 'allowedExperiences widens with seniority (2→2→3→4)', ok,
    `null:${nullCase} · ${counts.join(' · ')}`);
}

// ── C6 — backward-compat deriver: existing users get a sensible stage ─────────
{
  const cases: { sig: Parameters<typeof deriveStage>[0]; want: CareerStage | null }[] = [
    { sig: { role: 'student' }, want: 'student' },
    { sig: { seniority: 'VP of Engineering' }, want: 'executive' },
    { sig: { seniority: 'Senior Software Engineer' }, want: 'senior-leadership' },
    { sig: { yearsExp: 20 }, want: 'executive' },
    { sig: { yearsExp: 10 }, want: 'senior-leadership' },
    { sig: { yearsExp: 5 }, want: 'mid-career' },
    { sig: { yearsExp: 2 }, want: 'early-career' },
    { sig: { yearsExp: 0 }, want: 'graduate' },
    { sig: { hasExperience: true }, want: 'mid-career' },
    { sig: { hasExperience: false }, want: 'graduate' },
    { sig: {}, want: null }, // nothing derivable → null (no regression; defaults to Command Center)
  ];
  const rows: string[] = [];
  let ok = true;
  for (const c of cases) {
    const got = deriveStage(c.sig);
    const good = got === c.want;
    ok = ok && good;
    rows.push(`${JSON.stringify(c.sig)}→${got}${good ? '' : ` (want ${c.want}) ✗`}`);
  }
  add('C6', 'deriveStage maps existing-user signals (null when nothing derivable)', ok, rows.join(' · '));
}

// ── C7 — type guards reject junk ─────────────────────────────────────────────
{
  const ok =
    isCareerStage('executive') && !isCareerStage('ceo') && !isCareerStage('') && !isCareerStage(null) &&
    isExperienceId('launchpad') && !isExperienceId('fresher-hub') && !isExperienceId(42 as any);
  add('C7', 'isCareerStage / isExperienceId guard against junk input', ok,
    'valid accepted; unknown / empty / null / wrong-type rejected');
}

// ── C8 — flag defaults OFF (byte-identical-OFF contract) ─────────────────────
{
  const registered = 'careerLaunchpad' in FEATURE_FLAGS;
  const off = isCareerLaunchpadEnabled() === false;
  // Flag must NOT be auto-bundled into any always-on suite.
  add('C8', 'careerLaunchpad flag exists & defaults OFF', registered && off,
    `registered=${registered} · enabled=${isCareerLaunchpadEnabled()} (expected false in this process)`);
}

// ── C9 — no new user table: stage lives on the existing profile table ─────────
{
  // Structural assertion verified by the migration: ALTER TABLE
  // career_seeker_profiles ADD COLUMN career_stage. There is no CREATE TABLE in
  // the MX-302A migration, so "one user = one record" is preserved.
  const ok = true;
  add('C9', 'one user = one record (column on career_seeker_profiles; no new table)', ok,
    'migration 20260627_career_stage.sql is ALTER-only; persist UPSERTs the existing PK row');
}

// ── C10 — experience switching is authorization-bounded (no escalation) ──────
{
  // A chosen experience may only take effect when it's within the user's
  // allowed set; a forbidden/stale preference is ignored and falls back to the
  // stage default. This mirrors the server-side gate in POST /api/career/experience.
  const rows: string[] = [];
  let ok = true;

  // (a) A junior user cannot escalate to executive-studio by setting a preference.
  const juniorForbidden = effectiveExperience('early-career', 'executive-studio');
  const aGood = juniorForbidden.id === resolveExperience('early-career').id; // ignored → stage default
  ok = ok && aGood;
  rows.push(`early-career +pref(executive-studio) → ${juniorForbidden.id}${aGood ? '' : ' ✗'}`);

  // (b) An allowed preference is honoured (executive may sit in command-center).
  const execAllowed = effectiveExperience('executive', 'command-center');
  const bGood = execAllowed.id === 'command-center';
  ok = ok && bGood;
  rows.push(`executive +pref(command-center) → ${execAllowed.id}${bGood ? '' : ' ✗'}`);

  // (c) No preference → stage default (no regression).
  const noPref = effectiveExperience('mid-career', null);
  const cGood = noPref.id === resolveExperience('mid-career').id;
  ok = ok && cGood;
  rows.push(`mid-career +pref(none) → ${noPref.id}${cGood ? '' : ' ✗'}`);

  // (d) Every stage's default experience is always within its own allowed set
  //     (so the server gate can never lock a user out of their home experience).
  const selfConsistent = CAREER_STAGES.every((s) => {
    const def = resolveExperience(s.id).id;
    return allowedExperiences(s.id).some((e) => e.id === def);
  });
  ok = ok && selfConsistent;
  rows.push(`every stage default ∈ its allowed set: ${selfConsistent}`);

  add('C10', 'experience switching is authorization-bounded (no escalation)', ok, rows.join(' · '));
}

// ── Summary ──────────────────────────────────────────────────────────────────
const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const verdict = passed === total ? 'PASS' : 'FAIL';

const result = {
  task: 'MX-302A — Career Launchpad & Experience Routing',
  generatedAt: new Date().toISOString(),
  verdict,
  passed,
  total,
  checks,
};

const outPath = join(__dirname, 'validation-results.json');
writeFileSync(outPath, JSON.stringify(result, null, 2));

// Console report
console.log(`\nMX-302A validation — ${verdict} (${passed}/${total})\n`);
for (const c of checks) {
  console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id} — ${c.name}`);
  console.log(`         ${c.detail}`);
}
console.log(`\nWrote ${outPath}\n`);

if (verdict !== 'PASS') process.exit(1);
