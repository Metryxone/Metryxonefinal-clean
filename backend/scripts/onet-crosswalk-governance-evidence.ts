/**
 * Evidence — MX-100X Phase 2 O*NET Crosswalk Governance (READ-ONLY).
 *
 * Reproducible measurement of the crosswalk governance surface against the live DB. Prints
 * coverage %, confidence band distributions, duplicate/missing counts and unlinked-role
 * inheritance verdicts, and writes an audit markdown to backend/audit/mx100x-p2/.
 *
 *   npx tsx scripts/onet-crosswalk-governance-evidence.ts
 *
 * Honesty: this script measures (never writes the crosswalk). Coverage and Confidence are
 * reported on SEPARATE axes; the industry axis abstains; unlinked roles get an inheritance
 * verdict, never fabricated links.
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  ONET_CROSSWALK_GOVERNANCE_VERSION,
  getCrosswalkConfidence,
  getDuplicates,
  getMissingMappings,
  getUnlinkedRoleAnalysis,
  getGovernanceOverview,
} from '../services/onet-crosswalk-governance-engine';

function bandLine(b: { high: number; moderate: number; low: number; very_low: number; none: number }): string {
  return `high=${b.high} moderate=${b.moderate} low=${b.low} very_low=${b.very_low} none=${b.none}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];
  const log = (s = '') => { console.log(s); lines.push(s); };
  try {
    const generatedAt = new Date().toISOString();
    log(`# MX-100X Phase 2 — O*NET Crosswalk Governance Evidence`);
    log('');
    log(`- Engine version: \`${ONET_CROSSWALK_GOVERNANCE_VERSION}\``);
    log(`- Generated: ${generatedAt}`);
    log(`- Honesty: O*NET is a REFERENCE layer (never scoring). Coverage (a mapping exists) and Confidence (it is trustworthy) are SEPARATE axes. \`ont_*\` ids are INTEGER, \`onto_*\` ids are TEXT — never coerced. Read-only; the crosswalk itself is never written by this script.`);
    log('');

    const overview = await getGovernanceOverview(pool);

    // 1) Confidence
    const conf = await getCrosswalkConfidence(pool);
    log('## 1. Per-mapping confidence (Coverage ⟂ Confidence)');
    log('');
    log('### Role crosswalk (`map_ont_onto_role`)');
    log(`- Total bridges: ${conf.roleBridge.total} · Resolved: ${conf.roleBridge.resolved} · Unresolved: ${conf.roleBridge.unresolved}`);
    log(`- Coverage (resolved/total): ${conf.roleBridge.coverage_pct == null ? 'n/a' : conf.roleBridge.coverage_pct + '%'}`);
    log(`- Confidence bands (over resolved): ${bandLine(conf.roleBridge.band_distribution)}`);
    log(`- Note: ${conf.roleBridge.note}`);
    log('');
    log('| id | curated role (onto, TEXT) | O*NET (ont, INT) | match_method | confidence | band | verified | decision |');
    log('|----|----|----|----|----|----|----|----|');
    for (const r of conf.roleBridge.rows) {
      log(`| ${r.id} | ${r.entity_ref} | ${r.ont_id ?? '—'} | ${r.match_method ?? '—'} | ${r.confidence ?? '—'} | ${r.confidence_band} | ${r.verified ?? '—'} | ${r.decision ?? '—'} |`);
    }
    log('');
    log('### Competency crosswalk (`map_ont_onto_competency`)');
    log(`- Total mappings: ${conf.competencyMapping.total} · Resolved: ${conf.competencyMapping.resolved}`);
    log(`- Coverage (resolved/total): ${conf.competencyMapping.coverage_pct == null ? 'n/a' : conf.competencyMapping.coverage_pct + '%'}`);
    log(`- Confidence bands: ${bandLine(conf.competencyMapping.band_distribution)}`);
    log(`- Note: ${conf.competencyMapping.note}`);
    log('');
    log('### Industry');
    log(`- Measurable: ${conf.industry.measurable} · Reason: \`${conf.industry.reason}\` · ont_industries (reference count): ${conf.industry.ont_industries_count ?? 'n/a'}`);
    log(`- ${conf.industry.note}`);
    log('');

    // 2) Duplicates
    const dups = await getDuplicates(pool);
    log('## 2. Duplicate detection');
    log(`- Total duplicate groups: ${dups.total_duplicate_groups}`);
    log(`  - role bridge → multiple O*NET roles: ${dups.roleBridge.duplicate_onto_role.length}`);
    log(`  - multiple curated roles → one O*NET role: ${dups.roleBridge.duplicate_ont_role.length}`);
    log(`  - competency → multiple O*NET: ${dups.competencyMapping.duplicate_onto_competency.length}`);
    log(`  - multiple curated competencies → one O*NET: ${dups.competencyMapping.duplicate_ont_competency.length}`);
    log(`  - duplicate (role_id, competency_id) pairs: ${dups.roleCompetency.duplicate_pairs.length}`);
    log('');

    // 3) Missing
    const missing = await getMissingMappings(pool);
    log('## 3. Missing-mapping detection');
    log(`- Unresolved role bridges: ${missing.unresolvedRoleBridges.count} → ${missing.unresolvedRoleBridges.rows.map((r) => r.onto_role_id).join(', ') || '—'}`);
    log(`- Active roles with no competency links: ${missing.rolesWithoutCompetencies.count} of ${missing.rolesWithoutCompetencies.total_active_roles ?? 'n/a'} active roles`);
    log(`- Competency crosswalk coverage gap:`);
    log(`  - O*NET (ont_*) uncrosswalked: ${missing.competenciesWithoutCrosswalk.ont_uncrosswalked ?? 'n/a'} of ${missing.competenciesWithoutCrosswalk.ont_total ?? 'n/a'}`);
    log(`  - curated (onto_*) uncrosswalked: ${missing.competenciesWithoutCrosswalk.onto_uncrosswalked ?? 'n/a'} of ${missing.competenciesWithoutCrosswalk.onto_total ?? 'n/a'}`);
    log('');

    // 4) Unlinked-role inheritance closure
    const unlinked = await getUnlinkedRoleAnalysis(pool);
    log('## 4. Unlinked-role inheritance-closure analysis');
    log(`- Total unlinked: ${unlinked.total_unlinked} · inheritance_closable: ${unlinked.inheritance_closable} · genuinely_unmappable: ${unlinked.genuinely_unmappable}`);
    log(`- Note: ${unlinked.note}`);
    log('');
    log('| ont_role_id | code | title | family | linked siblings | verdict |');
    log('|----|----|----|----|----|----|');
    for (const r of unlinked.roles) {
      log(`| ${r.ont_role_id} | ${r.code ?? '—'} | ${r.title ?? '—'} | ${r.family_name ?? r.family_id ?? '—'} | ${r.family_linked_siblings} | ${r.verdict} |`);
    }
    log('');

    // 5) Decisions
    log('## 5. Manual governance decisions (audit)');
    log(`- Decisions table present: ${overview.decisions.table_present} · recorded: ${overview.decisions.recorded} (approved=${overview.decisions.approved}, rejected=${overview.decisions.rejected})`);
    log(`- Decisions are write-once per entity, reversible by provenance (POST /rollback). The audit table is created lazily ONLY on the first decision.`);
    log('');

    const outDir = join(process.cwd(), 'audit', 'mx100x-p2');
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'crosswalk-governance-evidence.md');
    writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
    console.log(`\nWrote ${outFile}`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
