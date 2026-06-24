/**
 * MX-104X — Candidate & Career Ecosystem journey validation + re-certification report (read-only).
 *
 * Exercises the ecosystem-activation composition engine directly against the live DB and writes the
 * founder deliverable to backend/audit/mx-104x/recertification-report.md.
 *
 * Honest by construction (NO inflation, NO fabrication):
 *   - STRUCTURAL ⟂ ACTIVATION are reported on SEPARATE axes and never composited.
 *   - Structural readiness = % of journey KEY tables present (machinery). PASS ≥85% / PARTIAL ≥60% / FAIL.
 *   - Activation = whether live rows exist per journey step (runtime adoption) — reported alongside,
 *     never blended into the verdict.
 *   - null (absent table) ≠ 0 (empty table) is preserved verbatim.
 *   - No PII is written — only aggregate counts.
 *   - READ-ONLY: no DDL, no writes, composes existing tables only.
 *
 * The 8 re-certification questions (Phase 6):
 *   1. candidate onboarding · 2. assessment · 3. employability · 4. career builder · 5. passport
 *   6. journey wiring intact · 7. Structural⟂Activation honest · 8. byte-identical flag-OFF
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  journeyFunnel,
  careerBuilderActivation,
  passportActivation,
  employabilityActivation,
  journeyAnalytics,
  certification,
  ECOSYSTEM_ACTIVATION_VERSION,
} from '../services/ecosystem-activation';

const OUT_DIR = path.join(__dirname, '../audit/mx-104x');

function fmt(n: number | null | undefined): string {
  return n === null || n === undefined ? '_null (absent — honest gap, not 0)_' : String(n);
}
function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? '_not measurable_' : `${n}%`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only validation).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const funnel = await journeyFunnel(pool);
    const cb = await careerBuilderActivation(pool);
    const pp = await passportActivation(pool);
    const emp = await employabilityActivation(pool);
    const analytics = await journeyAnalytics(pool);
    const cert = await certification(pool);
    const now = new Date().toISOString();

    const fd = (funnel.data as any).founder;
    const dv = (funnel.data as any).data_volume;
    const cbd = cb.data as any;
    const ppd = pp.data as any;
    const empd = emp.data as any;
    const certd = cert.data as any;
    const trans = (analytics.data as any).transitions as any[];

    const L: string[] = [];
    L.push('# MX-104X — Candidate & Career Ecosystem Re-Certification Report');
    L.push('');
    L.push(`_Generated ${now} · engine v${ECOSYSTEM_ACTIVATION_VERSION} · read-only · no DDL · no writes_`);
    L.push('');
    L.push('> **Structural ⟂ Activation.** Structural = the machinery (tables/routes/services) EXISTS.');
    L.push('> Activation = live runtime data has flowed through it. These are SEPARATE axes; the verdict');
    L.push('> below is STRUCTURAL only. Low activation with high structural readiness is the HONEST early-');
    L.push('> adoption state — it is NOT a failure and is NEVER composited into the structural score.');
    L.push('');

    // ── Verdict banner ──
    L.push('## Verdict');
    L.push('');
    L.push(`- **Structural verdict:** \`${certd.verdict}\` (axis: structural / machinery presence)`);
    L.push(`- **Structural readiness:** ${pct(certd.structural_readiness_pct)} (${certd.structural_tables_present}/${certd.structural_tables_total} journey key tables present)`);
    L.push(`- **Activation:** ${certd.readiness_score.activation_steps_live}/${certd.readiness_score.activation_steps_total} journey steps have live runtime data`);
    L.push(`- ${certd.activation_note}`);
    L.push('');

    // ── Founder counts ──
    L.push('## Founder Counts (registered candidates per stage)');
    L.push('');
    L.push('_Registered = users excluding super_admin + `@example.com` demo accounts. Funnel anchored on this population._');
    L.push('');
    L.push('| Stage | Count | Conversion |');
    L.push('|-------|------:|-----------:|');
    L.push(`| Registered | ${fmt(fd.registered_candidates)} | — |`);
    L.push(`| Assessed | ${fmt(fd.assessed_candidates)} | ${pct(fd.assessment_completion_pct)} of registered |`);
    L.push(`| Employability profile | ${fmt(fd.employability_profiles)} | — |`);
    L.push(`| Career Builder | ${fmt(fd.career_builder_users)} | — |`);
    L.push(`| Career Passport | ${fmt(fd.career_passport_users)} | ${pct(fd.journey_completion_pct)} of registered |`);
    L.push('');

    // ── Journey analytics ──
    L.push('## Journey Analytics (per-step conversion / drop-off)');
    L.push('');
    L.push('| Transition | From | To | Conversion | Drop-off |');
    L.push('|-----------|-----:|---:|-----------:|---------:|');
    for (const t of trans) {
      L.push(`| ${t.from} → ${t.to} | ${fmt(t.from_count)} | ${fmt(t.to_count)} | ${pct(t.conversion_pct)} | ${t.dropoff_pct === null || t.dropoff_pct === undefined ? '_n/a_' : t.dropoff_pct + '%'} |`);
    }
    L.push('');
    L.push('_Conversion/drop-off is `n/a` when the denominator stage is empty or unmeasurable — never a fabricated rate._');
    L.push('');

    // ── Subsystem activation ──
    L.push('## Subsystem Activation (live data)');
    L.push('');
    L.push('### Career Builder');
    L.push(`- Activation runs: ${fmt(cbd.activation_runs)} · Distinct users: ${fmt(cbd.distinct_users)}`);
    L.push(`- Role DNA graph roles: ${fmt(cbd.role_dna_graph_roles)} · Career paths: ${fmt(cbd.career_paths)}`);
    L.push(`- Role recommendations: ${fmt(cbd.role_recommendations)} · Skill gaps: ${fmt(cbd.skill_gaps)} · Development recs: ${fmt(cbd.development_recs)}`);
    L.push(`- Role readiness rows: ${fmt(cbd.role_readiness_rows)}`);
    L.push('');
    L.push('### Employability');
    L.push(`- FRI readiness rows: ${fmt(empd.fri_readiness_rows)} · FRI distinct users: ${fmt(empd.fri_distinct_users)}`);
    L.push(`- Career-readiness profiles: ${fmt(empd.career_readiness_profiles)} · LBI scores: ${fmt(empd.lbi_scores)}`);
    L.push('');
    L.push('### Career Passport');
    L.push(`- Foundation snapshots: ${fmt(ppd.foundation?.snapshots)} · Distinct subjects: ${fmt(ppd.foundation?.distinct_subjects)}`);
    if (ppd.foundation?.sections) {
      const s = ppd.foundation.sections;
      L.push(`- Sections present — competency: ${fmt(s.competency)} · employability: ${fmt(s.employability)} · career: ${fmt(s.career)} · readiness: ${fmt(s.readiness)}`);
      L.push(`- Achievements: ${fmt(s.achievements_total)} · Journey events: ${fmt(s.journey_events_total)} · Avg coverage: ${pct(s.avg_coverage_pct)} · Measurable subjects: ${fmt(s.measurable_subjects)}`);
    }
    L.push(`- careerPassport (cp_*): ${ppd.cp_passport?.present ? `present — ${fmt(ppd.cp_passport?.passports)} passports` : '_schema not materialized (flag OFF / never activated) — null, not 0_'}`);
    L.push('');

    // ── Raw data volume ──
    L.push('## Raw Data Volume (not funnel — reported separately)');
    L.push('');
    L.push('_Subject-level totals that may exceed registered users (e.g. seeded competency history). Kept separate by design so the funnel stays honest._');
    L.push('');
    L.push(`- Competency-history subjects: ${fmt(dv.competency_history_subjects)}`);
    L.push(`- CRA-scored subjects: ${fmt(dv.cra_scored_subjects)}`);
    L.push(`- Behavioural CAPADEX users: ${fmt(dv.behavioural_capadex_users)} · reports: ${fmt(dv.behavioural_capadex_reports)}`);
    L.push(`- Career-seeker profiles: ${fmt(dv.career_seeker_profiles)}`);
    L.push('');

    // ── 8 questions ──
    L.push('## Re-Certification Questions (Phase 6)');
    L.push('');
    L.push('| # | Question | Structural | Activation | Answer |');
    L.push('|---|----------|:----------:|:----------:|--------|');
    for (const q of certd.questions as any[]) {
      const act = q.activation_na ? 'n/a' : q.activation ? 'live' : 'no data';
      L.push(`| ${q.q.replace(/\|/g, '\\|')} | ${q.structural ? '✓' : '⚠'} | ${act} | ${q.answer.replace(/\|/g, '\\|')} |`);
    }
    L.push('');

    // ── Table presence detail ──
    L.push('## Structural — Journey Key Table Presence');
    L.push('');
    L.push('| Table | Present |');
    L.push('|-------|:-------:|');
    for (const [t, present] of Object.entries(certd.table_presence as Record<string, boolean>)) {
      L.push(`| \`${t}\` | ${present ? '✓' : '✗ MISSING'} |`);
    }
    L.push('');

    // ── Blockers ──
    L.push('## Remaining Blockers (honest)');
    L.push('');
    L.push('**Structural:**');
    for (const b of certd.remaining_blockers.structural as string[]) L.push(`- ${b}`);
    L.push('');
    L.push('**Activation (runtime adoption — NOT a structural failure):**');
    for (const b of certd.remaining_blockers.activation as string[]) L.push(`- ${b}`);
    L.push('');

    L.push('---');
    L.push('');
    L.push('_Read-only composition over already-built tables. Developmental/operational signals only —');
    L.push('NOT hiring/promotion/suitability predictions. No flag flips, no inflation, no deploy._');

    const outPath = path.join(OUT_DIR, 'recertification-report.md');
    fs.writeFileSync(outPath, L.join('\n'));
    console.log(`[mx104x] wrote ${outPath}`);
    console.log(`[mx104x] structural verdict=${certd.verdict} readiness=${certd.structural_readiness_pct}% activation=${certd.readiness_score.activation_steps_live}/${certd.readiness_score.activation_steps_total}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[mx104x] FAILED', e);
  process.exit(1);
});
