/**
 * MX-302A — Career Launchpad adoption measurement (read-only)
 * ----------------------------------------------------------------------------
 * The structural validator (validate-mx302a.ts / validation-results.json)
 * certifies the routing CONTRACT only — it makes NO adoption claim. Adoption is
 * a SEPARATE axis that can only be measured against the live DB once
 * `FF_CAREER_LAUNCHPAD` is ON and real users have registered.
 *
 * This script measures that adoption axis, read-only:
 *   - How many real seekers chose each career stage (career_seeker_profiles.career_stage)
 *   - Which experience they effectively landed on (stage + stored preference,
 *     resolved through the SAME pure engine the runtime uses)
 *   - How often they switch experience (platform_audit_log career_experience rows)
 *   - The registration routing trail (platform_audit_log career_stage rows)
 *
 * HONESTY CONTRACT (replit.md):
 *   - Adoption is reported as its OWN axis and is NEVER composited with the
 *     structural verdict. The structural verdict is read back verbatim from
 *     validation-results.json for context, not merged into an adoption score.
 *   - null ≠ 0. An ABSENT table/column (flag never ran ON here) → null
 *     ("cannot measure"), distinct from a PRESENT-but-empty table → 0
 *     ("wired, nothing has happened yet"). null is never coerced to 0.
 *   - Demo / @example.com rows are excluded from every count (joined via users.email).
 *   - PII is never written: only stage/experience aggregates and counts.
 *
 * Run (after launch, flag ON):
 *   cd backend && FF_CAREER_LAUNCHPAD=1 npx tsx audit/mx-302a/measure-adoption.ts
 * Writes:
 *   backend/audit/mx-302a/adoption-results.json
 *   backend/audit/mx-302a/adoption-report.md
 */

import { Pool } from 'pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  CAREER_STAGES,
  EXPERIENCES,
  effectiveExperience,
  isCareerStage,
  type CareerStage,
  type ExperienceId,
} from '../../services/experience-routing';
import { isCareerLaunchpadEnabled } from '../../config/feature-flags';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OUT_DIR = __dirname;
const now = new Date().toISOString();

// Demo exclusion: a row is real only when its user's email is absent OR is not
// an @example.com seed address. Applied to BOTH the profile table and the audit
// trail (joined on the user id).
const DEMO_PRED = `(u.email IS NULL OR lower(u.email) NOT LIKE '%@example.com%')`;

/** rows() returns null on a missing relation/column (cannot measure), else the rows. */
async function rows<T = any>(sql: string, params: any[] = []): Promise<T[] | null> {
  try {
    const r = await pool.query(sql, params);
    return r.rows as T[];
  } catch {
    return null; // null = could not measure (absent table/column) — never 0
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await rows(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return !!r && r.length > 0;
}

async function tableExists(name: string): Promise<boolean> {
  const r = await rows(`SELECT to_regclass($1) AS reg`, [name]);
  return !!r && r[0]?.reg != null;
}

interface StageRow { career_stage: string | null; preferred: string | null }

async function main() {
  const flagOn = isCareerLaunchpadEnabled();

  // ── Structural axis (read verbatim — NEVER composited into adoption) ────────
  let structural: { verdict: string; passed: number; total: number } | null = null;
  const vrPath = join(OUT_DIR, 'validation-results.json');
  if (existsSync(vrPath)) {
    try {
      const vr = JSON.parse(readFileSync(vrPath, 'utf8'));
      structural = { verdict: vr.verdict, passed: vr.passed, total: vr.total };
    } catch { /* leave null */ }
  }

  // ── Provisioning probes (null ≠ 0) ──────────────────────────────────────────
  const profilesTable = await tableExists('career_seeker_profiles');
  const stageColumn = profilesTable ? await columnExists('career_seeker_profiles', 'career_stage') : false;
  const auditTable = await tableExists('platform_audit_log');

  // ── Stage adoption (live picks) ─────────────────────────────────────────────
  // null when the column has never been provisioned (flag never ran ON here);
  // 0/empty distribution when present but no real user has chosen a stage yet.
  const stageByName: Record<string, number> = {};
  const experienceByName: Record<string, number> = {};
  let realProfilesWithStage: number | null = null;
  let unknownStageRows = 0; // stored stage value not in the canon (honest surfacing)

  if (stageColumn) {
    const data = await rows<StageRow>(
      `SELECT csp.career_stage AS career_stage,
              csp.data->'careerProfile'->>'preferredExperience' AS preferred
         FROM career_seeker_profiles csp
         JOIN users u ON u.id = csp.user_id
        WHERE csp.career_stage IS NOT NULL
          AND ${DEMO_PRED}`,
    );
    if (data == null) {
      realProfilesWithStage = null;
    } else {
      realProfilesWithStage = data.length;
      // seed canon keys at 0 so an empty distribution reads as honest zeros
      for (const s of CAREER_STAGES) stageByName[s.id] = 0;
      for (const e of Object.keys(EXPERIENCES)) experienceByName[e] = 0;
      for (const row of data) {
        const stage = row.career_stage;
        if (isCareerStage(stage)) {
          stageByName[stage] = (stageByName[stage] ?? 0) + 1;
          // Effective experience = same resolution the runtime applies: a stored
          // preference honoured only when allowed, else the stage default.
          const pref = (row.preferred as ExperienceId | null) ?? null;
          const exp = effectiveExperience(stage as CareerStage, pref);
          experienceByName[exp.id] = (experienceByName[exp.id] ?? 0) + 1;
        } else {
          unknownStageRows += 1; // stored value outside the 8-stage canon
        }
      }
    }
  }

  // ── Registration routing trail (audit: entity_type='career_stage') ──────────
  // Each row is one new user routed at sign-up. entity_label = the chosen stage.
  let registrationRoutes: number | null = null;
  const registrationByStage: Record<string, number> = {};
  if (auditTable) {
    const reg = await rows<{ entity_label: string | null; n: string }>(
      `SELECT pal.entity_label AS entity_label, count(*)::text AS n
         FROM platform_audit_log pal
         LEFT JOIN users u ON u.id = pal.entity_id
        WHERE pal.entity_type = 'career_stage'
          AND pal.action = 'create'
          AND ${DEMO_PRED}
        GROUP BY pal.entity_label`,
    );
    if (reg == null) {
      registrationRoutes = null;
    } else {
      registrationRoutes = 0;
      for (const r of reg) {
        const n = Number(r.n) || 0;
        registrationRoutes += n;
        registrationByStage[r.entity_label ?? '(null)'] = n;
      }
    }
  }

  // ── Experience switching (audit: entity_type='career_experience') ───────────
  // entity_label = the experience switched TO. Switch frequency = switches per
  // distinct switching user. null when the audit table is absent.
  let totalSwitches: number | null = null;
  let distinctSwitchers: number | null = null;
  const switchesToExperience: Record<string, number> = {};
  if (auditTable) {
    const sw = await rows<{ entity_label: string | null; n: string }>(
      `SELECT pal.entity_label AS entity_label, count(*)::text AS n
         FROM platform_audit_log pal
         LEFT JOIN users u ON u.id = pal.entity_id
        WHERE pal.entity_type = 'career_experience'
          AND pal.action = 'update'
          AND ${DEMO_PRED}
        GROUP BY pal.entity_label`,
    );
    const distinct = await rows<{ n: string }>(
      `SELECT count(DISTINCT pal.entity_id)::text AS n
         FROM platform_audit_log pal
         LEFT JOIN users u ON u.id = pal.entity_id
        WHERE pal.entity_type = 'career_experience'
          AND pal.action = 'update'
          AND ${DEMO_PRED}`,
    );
    if (sw == null || distinct == null) {
      totalSwitches = null;
      distinctSwitchers = null;
    } else {
      totalSwitches = 0;
      for (const r of sw) {
        const n = Number(r.n) || 0;
        totalSwitches += n;
        switchesToExperience[r.entity_label ?? '(null)'] = n;
      }
      distinctSwitchers = Number(distinct[0]?.n) || 0;
    }
  }
  const switchesPerSwitcher =
    totalSwitches == null || distinctSwitchers == null || distinctSwitchers === 0
      ? null
      : Number((totalSwitches / distinctSwitchers).toFixed(2));

  // ── Adoption verdict (its OWN axis — never composited with structural) ──────
  // ACTIVE  → at least one real user has chosen a stage
  // ZERO    → surface provisioned & queryable, but no real adoption yet (honest 0)
  // UNMEASURABLE → column/table absent (flag never ran ON here) → null, not 0
  let adoptionVerdict: 'ACTIVE' | 'ZERO' | 'UNMEASURABLE';
  if (!stageColumn) adoptionVerdict = 'UNMEASURABLE';
  else if (realProfilesWithStage == null) adoptionVerdict = 'UNMEASURABLE';
  else if (realProfilesWithStage > 0) adoptionVerdict = 'ACTIVE';
  else adoptionVerdict = 'ZERO';

  const result = {
    task: 'MX-302A — Career Launchpad adoption measurement',
    generatedAt: now,
    flag: { name: 'FF_CAREER_LAUNCHPAD', enabledInThisProcess: flagOn },
    structuralAxis: structural, // verbatim context — NOT merged into adoption
    provisioning: {
      profilesTable,
      stageColumnProvisioned: stageColumn,
      auditTable,
    },
    adoptionAxis: {
      verdict: adoptionVerdict,
      realSeekersWithStage: realProfilesWithStage, // null = unmeasurable
      unknownStageRows,
      stageDistribution: stageColumn && realProfilesWithStage != null ? stageByName : null,
      experienceDistribution: stageColumn && realProfilesWithStage != null ? experienceByName : null,
      registrationRoutes,              // null = audit table absent
      registrationByStage: registrationRoutes == null ? null : registrationByStage,
      switching: {
        totalSwitches,                 // null = unmeasurable
        distinctSwitchers,
        switchesPerSwitcher,
        switchesToExperience: totalSwitches == null ? null : switchesToExperience,
      },
    },
  };

  writeFileSync(join(OUT_DIR, 'adoption-results.json'), JSON.stringify(result, null, 2));
  writeFileSync(join(OUT_DIR, 'adoption-report.md'), renderReport(result));

  // Console summary
  console.log(`\nMX-302A adoption — ${adoptionVerdict}`);
  console.log(`  flag FF_CAREER_LAUNCHPAD enabled in this process: ${flagOn}`);
  console.log(`  structural axis (separate): ${structural ? `${structural.verdict} (${structural.passed}/${structural.total})` : 'n/a'}`);
  console.log(`  stage column provisioned: ${stageColumn}`);
  console.log(`  real seekers with a stage: ${fmt(realProfilesWithStage)}`);
  console.log(`  registration routes: ${fmt(registrationRoutes)} · total switches: ${fmt(totalSwitches)} (per switcher: ${fmt(switchesPerSwitcher)})`);
  console.log(`\nWrote adoption-results.json + adoption-report.md\n`);

  await pool.end();
}

const fmt = (n: number | null) => (n == null ? 'null (unmeasurable)' : String(n));

function distLines(dist: Record<string, number> | null, labelOf: (k: string) => string): string {
  if (dist == null) return '- null — not measurable (table/column absent)\n';
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  if (entries.every(([, v]) => v === 0)) {
    return '- (all zero — surface is wired but no real user has done this yet)\n';
  }
  return entries
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `- ${labelOf(k)}: **${v}**`)
    .join('\n') + '\n';
}

function renderReport(r: any): string {
  const a = r.adoptionAxis;
  const stageLabel = (id: string) => CAREER_STAGES.find((s) => s.id === id)?.label ?? id;
  const expLabel = (id: string) => (EXPERIENCES as any)[id]?.label ?? id;

  return `# MX-302A — Career Launchpad Adoption (read-only measurement)

_Generated: ${r.generatedAt}_

> **Two independent axes, never composited.** The *structural* axis below is the
> routing-contract certification (read verbatim from \`validation-results.json\`).
> The *adoption* axis is measured live against the DB. A green structural verdict
> says the routing is correct; it says **nothing** about how many real users have
> picked a stage. \`null\` means *cannot measure* (the surface was never provisioned
> here) and is kept distinct from \`0\` (*wired, but nobody has done it yet*).

## Flag
- \`FF_CAREER_LAUNCHPAD\` enabled in this measurement process: **${r.flag.enabledInThisProcess}**
- Adoption only accrues when the flag is ON in the **live Backend API workflow**
  (turning it on in this script alone does not register users).

## Structural axis (context only — not merged into adoption)
${r.structuralAxis
  ? `- Verdict: **${r.structuralAxis.verdict}** (${r.structuralAxis.passed}/${r.structuralAxis.total} checks)`
  : '- n/a (validation-results.json not found)'}

## Provisioning probes (null ≠ 0)
- \`career_seeker_profiles\` table present: **${r.provisioning.profilesTable}**
- \`career_stage\` column provisioned: **${r.provisioning.stageColumnProvisioned}**
  ${r.provisioning.stageColumnProvisioned ? '' : '_(column is created lazily only on the flag-ON path / via migration — absent here means the flag has never run ON against this DB)_'}
- \`platform_audit_log\` table present: **${r.provisioning.auditTable}**

## Adoption axis — verdict: **${a.verdict}**
${a.verdict === 'UNMEASURABLE'
    ? '> The stage surface has not been provisioned against this DB, so adoption is **`null` (unmeasurable)** — explicitly NOT zero. Re-run after launch with the flag ON.'
    : a.verdict === 'ZERO'
      ? '> The surface is provisioned and queryable, but **no real (non-demo) user has chosen a stage yet** — an honest zero, not a defect.'
      : '> Real users have begun choosing stages. Distributions below.'}

### Real seekers who chose a stage
- Count: **${fmt(a.realSeekersWithStage)}**${a.unknownStageRows ? ` · ⚠️ ${a.unknownStageRows} row(s) hold a stage value outside the 8-stage canon` : ''}

### By career stage
${distLines(a.stageDistribution, stageLabel)}
### By effective experience landed on
${distLines(a.experienceDistribution, expLabel)}
### Registration routing trail (audit: \`career_stage\` creates)
- Total routed at sign-up: **${fmt(a.registrationRoutes)}**
${distLines(a.registrationByStage, stageLabel)}
### Experience switching (audit: \`career_experience\` updates)
- Total switches: **${fmt(a.switching.totalSwitches)}**
- Distinct users who switched: **${fmt(a.switching.distinctSwitchers)}**
- Switches per switching user: **${fmt(a.switching.switchesPerSwitcher)}**
- Switched TO, by experience:
${distLines(a.switching.switchesToExperience, expLabel)}
---
_Read-only. Demo/@example.com rows excluded from every count. PII never written —
only stage/experience aggregates._
`;
}

main().catch((e) => {
  console.error('[mx-302a adoption] fatal:', e);
  process.exit(1);
});
