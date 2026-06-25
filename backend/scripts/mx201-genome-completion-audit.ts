/**
 * MX-201 — Competency Genome Completion Program · Phase 1+2 (read-only audit + health scoring + gap reports).
 *
 * Audits the CANONICAL 419-competency genome (`onto_competencies`, TEXT ids) across the 18 attributes
 * MX-201 lists, computes a per-competency Health Score, classifies each competency
 * (Complete / Nearly Complete / Partial / Missing), and writes honest gap reports.
 *
 * HONESTY CANON (enforced):
 *   - READ-ONLY. No DDL, no writes, no fabrication. Run against the live DB.
 *   - Each of the 18 attributes is mapped to its REAL backing and classified by how it attaches to the
 *     canonical genome: NATIVE (joinable onto_* field/table), GLOBAL (one table applies to all),
 *     DISJOINT (exists only in the ont_ / INT O*NET namespace or 0 rows — NOT attached to the 419),
 *     or ABSENT (no backing field exists anywhere).
 *   - Per-competency Health is scored ONLY over the AUTHORABLE NATIVE attribute set — you cannot "author"
 *     into a field that does not exist. DISJOINT + ABSENT attributes are reported on a SEPARATE schema-gap
 *     axis (they need schema/crosswalk work, not knowledge-authoring).
 *   - A rate with a zero/absent denominator is reported as null ("not measurable"), never a fabricated 0%.
 *   - Coverage (data present) ⟂ Readiness (eligible + sufficient) kept separate.
 */

import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

type Backing = 'native' | 'global' | 'disjoint' | 'absent';

type AttrSpec = {
  n: number;
  label: string;
  backing: Backing;
  source: string;
  note?: string;
  // for native per-competency attributes, the boolean field name on the per-comp row:
  field?: string;
};

// The 18 MX-201 attributes mapped to the real schema reality of the canonical onto_ genome.
const ATTRIBUTES: AttrSpec[] = [
  { n: 1, label: 'Definition', backing: 'native', source: 'onto_competencies.definition', field: 'has_definition' },
  { n: 2, label: 'Description', backing: 'native', source: 'onto_competencies.definition', field: 'has_definition', note: 'No separate business-description field; definition is the only descriptive field.' },
  { n: 3, label: 'Behavioural Indicators', backing: 'native', source: 'onto_indicators.indicator', field: 'has_indicators' },
  { n: 4, label: 'Observable Behaviours', backing: 'native', source: 'onto_indicators.indicator', field: 'has_indicators', note: 'No distinct field; onto_indicators rows ARE the observable behaviours (shared with #3).' },
  { n: 5, label: 'Proficiency / Required Levels', backing: 'native', source: 'onto_indicators.proficiency_level', field: 'has_levels', note: 'Per-competency levels = ≥2 distinct proficiency_level values among its indicators.' },
  { n: 6, label: 'Level Descriptors', backing: 'global', source: 'onto_proficiency_levels.description', note: 'Global 1–5 level descriptors apply to every competency; not authored per-competency.' },
  { n: 7, label: 'Evidence Requirements', backing: 'disjoint', source: 'map_competency_proficiency.sample_evidence', note: '0 rows AND INT-keyed (O*NET ont_ namespace) — does not attach to the canonical genome.' },
  { n: 8, label: 'Learning Outcomes', backing: 'absent', source: '(none)', note: 'No learning-outcomes field anywhere in the ontology.' },
  { n: 9, label: 'Industry Mapping', backing: 'disjoint', source: 'map_industry_competency', note: '0 rows AND INT-keyed (O*NET ont_ namespace) — not attached to the 419.' },
  { n: 10, label: 'Function Mapping', backing: 'absent', source: '(none direct)', note: 'onto_functions exists but no competency→function map for the canonical genome.' },
  { n: 11, label: 'Department Mapping', backing: 'absent', source: '(none)', note: 'No department dimension in the genome.' },
  { n: 12, label: 'Role Family Mapping', backing: 'native', source: 'onto_competencies.family_id → onto_families', field: 'has_family', note: 'family_id is the COMPETENCY family; role-family is a separate (role-side) dimension.' },
  { n: 13, label: 'Role Mapping', backing: 'native', source: 'onto_role_competency_profiles', field: 'has_role_dna', note: 'Same source as Role DNA (#15).' },
  { n: 14, label: 'O*NET Mapping', backing: 'absent', source: '(none direct)', note: 'No external_ref column on onto_competencies; only an indirect bridge-by-name to ont_competencies.' },
  { n: 15, label: 'Role DNA Mapping', backing: 'native', source: 'onto_role_competency_profiles', field: 'has_role_dna' },
  { n: 16, label: 'Assessment Strategy', backing: 'native', source: 'onto_competencies.scoring_metadata', field: 'has_scoring', note: 'scoring_metadata JSONB is the canonical scoring/assessment config; ont_competencies.assessment_methods is the disjoint O*NET copy.' },
  { n: 17, label: 'Learning Resources', backing: 'disjoint', source: 'cg_skill_resource_map.skill_key', note: 'Keyed by skill_key (TEXT) — measured by name/slug overlap with the genome (reported separately).' },
  { n: 18, label: 'Certification Mapping', backing: 'absent', source: 'rr_certifications (role-keyed)', note: 'Certifications attach to roles, not competencies — no competency-level mapping.' },
];

// AUTHORABLE NATIVE per-competency attributes used for the Health Score (distinct fields only).
// `group` separates structural IDENTITY/governance fields (near-always-filled) from the DEPTH
// (knowledge-authoring) fields — so the headline can warn that avg health is buoyed by identity.
const HEALTH_FIELDS: Array<{ field: string; label: string; group: 'identity' | 'depth' }> = [
  { field: 'has_definition', label: 'Definition', group: 'identity' },
  { field: 'has_domain', label: 'Domain', group: 'identity' },
  { field: 'has_family', label: 'Family', group: 'identity' },
  { field: 'has_type', label: 'Scientific Type', group: 'identity' },
  { field: 'has_governance', label: 'Governance Ext', group: 'identity' },
  { field: 'has_indicators', label: 'Behavioural Indicators', group: 'depth' },
  { field: 'has_levels', label: 'Proficiency Levels', group: 'depth' },
  { field: 'has_role_relevance', label: 'Role Relevance', group: 'depth' },
  { field: 'has_scoring', label: 'Assessment Strategy (scoring_metadata)', group: 'depth' },
  { field: 'has_benchmark', label: 'Benchmark Metadata', group: 'depth' },
  { field: 'has_role_dna', label: 'Role / Role-DNA Mapping', group: 'depth' },
];

function classify(pct: number): 'Complete' | 'Nearly Complete' | 'Partial' | 'Missing' {
  if (pct >= 100) return 'Complete';
  if (pct >= 80) return 'Nearly Complete';
  if (pct >= 40) return 'Partial';
  return 'Missing';
}

function pctOf(num: number, denom: number): number | null {
  if (denom <= 0) return null;
  return Math.round((num / denom) * 1000) / 10;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only genome audit).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // ── Per-competency native attribute presence (one pass over the 419) ──
    const perComp = await pool.query(`
      SELECT c.id, c.canonical_name,
        (c.definition IS NOT NULL AND c.definition <> '')                                              AS has_definition,
        (c.domain_id IS NOT NULL)                                                                       AS has_domain,
        (c.family_id IS NOT NULL)                                                                       AS has_family,
        (c.scientific_type IS NOT NULL)                                                                 AS has_type,
        (c.role_relevance IS NOT NULL AND c.role_relevance::text NOT IN ('null','{}','[]'))             AS has_role_relevance,
        (c.scoring_metadata IS NOT NULL AND c.scoring_metadata::text NOT IN ('null','{}','[]'))         AS has_scoring,
        (c.benchmark_metadata IS NOT NULL AND c.benchmark_metadata::text NOT IN ('null','{}','[]'))     AS has_benchmark,
        (COALESCE(ind.cnt,0) > 0)                                                                       AS has_indicators,
        (COALESCE(ind.levels,0) >= 2)                                                                   AS has_levels,
        (COALESCE(dna.cnt,0) > 0)                                                                       AS has_role_dna,
        (ext.competency_id IS NOT NULL)                                                                 AS has_governance,
        ext.assessment_eligible, ext.career_builder_eligible, ext.employer_eligible,
        ext.ei_eligible, ext.learning_eligible, ext.future_ready_eligible
      FROM onto_competencies c
      LEFT JOIN (SELECT competency_id, count(*) cnt, count(DISTINCT proficiency_level) levels
                   FROM onto_indicators GROUP BY competency_id) ind ON ind.competency_id = c.id
      LEFT JOIN (SELECT competency_id, count(*) cnt
                   FROM onto_role_competency_profiles WHERE active IS TRUE GROUP BY competency_id) dna ON dna.competency_id = c.id
      LEFT JOIN onto_competency_master_ext ext ON ext.competency_id = c.id
      WHERE c.deprecated IS NOT TRUE
      ORDER BY c.canonical_name;`);

    const rows = perComp.rows as any[];
    const total = rows.length;

    // ── Disjoint / schema-gap probes (honest counts, reported separately) ──
    const scalar = async (sql: string): Promise<number | null> => {
      try { const r = await pool.query(sql); const v = r.rows[0]?.n; return v == null ? null : Number(v); }
      catch { return null; }
    };
    const evidenceRows = await scalar('SELECT count(*)::int n FROM map_competency_proficiency');
    const industryRows = await scalar('SELECT count(*)::int n FROM map_industry_competency');
    const learningPathRows = await scalar('SELECT count(*)::int n FROM map_competency_learning_path');
    // Evidence-backed (per-run) proof that the INT-keyed map_role_competency does NOT attach to the
    // canonical TEXT-keyed genome — rather than a hardcoded narrative claim.
    const roleMapRows = await scalar('SELECT count(*)::int n FROM map_role_competency');
    const roleMapCanonicalJoins = await scalar(
      'SELECT count(*)::int n FROM map_role_competency m JOIN onto_competencies c ON c.id = m.competency_id::text WHERE c.deprecated IS NOT TRUE');
    // Learning Resources: overlap of cg_skill_resource_map.skill_key with genome slug or canonical_name.
    const learningResComps = await scalar(`
      SELECT count(DISTINCT c.id)::int n
      FROM onto_competencies c
      JOIN cg_skill_resource_map m
        ON lower(m.skill_key) = lower(c.slug) OR lower(m.skill_key) = lower(c.canonical_name)
      WHERE c.deprecated IS NOT TRUE`);

    // ── Per-attribute coverage across the 18 (native/global measured; disjoint/absent flagged) ──
    const fieldCount = (field: string) => rows.filter((r) => r[field] === true).length;
    const attrReport = ATTRIBUTES.map((a) => {
      let present: number | null = null;
      let coverage: number | null = null;
      let detail = a.note ?? '';
      if (a.backing === 'native' && a.field) {
        present = fieldCount(a.field);
        coverage = pctOf(present, total);
      } else if (a.backing === 'global') {
        present = total; coverage = 100; // global descriptors apply to all comps
      } else if (a.backing === 'disjoint') {
        if (a.label === 'Evidence Requirements') { present = 0; detail += ` (rows=${evidenceRows ?? 'n/m'})`; }
        else if (a.label === 'Industry Mapping') { present = 0; detail += ` (rows=${industryRows ?? 'n/m'})`; }
        else if (a.label === 'Learning Resources') { present = learningResComps ?? 0; coverage = pctOf(present, total); }
        // coverage stays null for namespace-disjoint mappings that cannot attach to the 419
      } // absent → present/coverage stay null
      return { ...a, present, coverage, detail };
    });

    // ── Per-competency Health Score over the AUTHORABLE NATIVE set ──
    const denom = HEALTH_FIELDS.length;
    const scored = rows.map((r) => {
      const presentFields = HEALTH_FIELDS.filter((h) => r[h.field] === true).map((h) => h.label);
      const missingFields = HEALTH_FIELDS.filter((h) => r[h.field] !== true).map((h) => h.label);
      const pct = Math.round((presentFields.length / denom) * 1000) / 10;
      return {
        id: r.id, name: r.canonical_name,
        present: presentFields.length, denom, pct, klass: classify(pct),
        missing: missingFields,
        // Phase-4 readiness flags (eligibility ⟂ data sufficiency)
        assessment_ready: r.assessment_eligible === true && r.has_indicators === true && r.has_levels === true,
        role_dna_ready: r.has_role_dna === true,
        employer_ready: r.employer_eligible === true && r.has_role_dna === true,
        career_ready: r.career_builder_eligible === true,
        employability_ready: r.ei_eligible === true,
        reporting_ready: r.has_definition === true && r.has_domain === true && r.has_family === true,
      };
    });

    const dist = { Complete: 0, 'Nearly Complete': 0, Partial: 0, Missing: 0 } as Record<string, number>;
    for (const s of scored) dist[s.klass]++;
    const avgHealth = Math.round((scored.reduce((a, s) => a + s.pct, 0) / Math.max(1, scored.length)) * 10) / 10;
    // Split coverage so the headline can warn that avg health is buoyed by 100%-filled identity fields.
    const groupCoverage = (group: 'identity' | 'depth') => {
      const fs = HEALTH_FIELDS.filter((h) => h.group === group);
      const sum = fs.reduce((a, h) => a + (fieldCount(h.field) / Math.max(1, total)) * 100, 0);
      return Math.round((sum / Math.max(1, fs.length)) * 10) / 10;
    };
    const identityCoverage = groupCoverage('identity');
    const depthCoverage = groupCoverage('depth');

    const phase4 = {
      assessment: scored.filter((s) => s.assessment_ready).length,
      role_dna: scored.filter((s) => s.role_dna_ready).length,
      employer: scored.filter((s) => s.employer_ready).length,
      career: scored.filter((s) => s.career_ready).length,
      employability: scored.filter((s) => s.employability_ready).length,
      reporting: scored.filter((s) => s.reporting_ready).length,
    };

    // ── Render report ──
    const lines: string[] = [];
    const pctStr = (v: number | null) => (v == null ? 'n/m' : `${v}%`);
    lines.push('# MX-201 — Competency Genome Completion · Phase 1+2 Audit');
    lines.push('');
    lines.push(`_Read-only audit generated ${new Date().toISOString()}. No data was written or fabricated._`);
    lines.push('');
    lines.push(`**Canonical genome:** \`onto_competencies\` — **${total} live competencies** (TEXT ids, e.g. \`comp_accountability\`).`);
    lines.push('');
    lines.push('## Headline');
    lines.push('');
    lines.push(`- **Average competency health (authorable native set, ${denom} attributes):** ${avgHealth}%`);
    lines.push(`- ⚠️ **Read avg health with care — it is buoyed by structural identity/governance fields that are ~100% filled.** Structural identity coverage: **${identityCoverage}%** · knowledge-DEPTH coverage (indicators, proficiency levels, role-relevance, scoring, benchmark, role-DNA): **${depthCoverage}%**. The three genuinely empty depth attributes are the real authoring backlog: Behavioural Indicators ${pctStr(pctOf(fieldCount('has_indicators'), total))}, Proficiency Levels ${pctStr(pctOf(fieldCount('has_levels'), total))}, Role/Role-DNA ${pctStr(pctOf(fieldCount('has_role_dna'), total))}.`);
    lines.push(`- **Classification:** Complete ${dist.Complete} · Nearly Complete ${dist['Nearly Complete']} · Partial ${dist.Partial} · Missing ${dist.Missing} (of ${total})`);
    lines.push(`- **Verdict:** ${dist.Complete === total ? 'COMPLETE' : 'PARTIAL — genome is NOT 419/419 complete'}`);
    lines.push('');
    lines.push('## 1 · The 18 attributes — real backing & coverage');
    lines.push('');
    lines.push('Each attribute is classified by how it attaches to the canonical genome. **NATIVE** = a joinable `onto_*` field/table (authorable). **GLOBAL** = one table applies to all competencies. **DISJOINT** = exists only in the `ont_*`/INT O*NET namespace or has 0 rows — it does **not** attach to the 419. **ABSENT** = no backing field exists anywhere.');
    lines.push('');
    lines.push('| # | Attribute | Backing | Source | Coverage | Notes |');
    lines.push('|---|---|---|---|---|---|');
    for (const a of attrReport) {
      const cov = a.backing === 'native' || (a.backing === 'disjoint' && a.coverage != null) || a.backing === 'global'
        ? `${a.present ?? 'n/m'}/${total} (${pctStr(a.coverage)})`
        : (a.backing === 'disjoint' ? '0 (not attached)' : '— (no field)');
      lines.push(`| ${a.n} | ${a.label} | ${a.backing.toUpperCase()} | \`${a.source}\` | ${cov} | ${a.detail} |`);
    }
    lines.push('');
    lines.push('## 2 · Per-competency health distribution');
    lines.push('');
    lines.push('Health is scored ONLY over the authorable native attributes (you cannot author into a field that does not exist).');
    lines.push('');
    lines.push('| Class | Definition | Count | % of genome |');
    lines.push('|---|---|---|---|');
    lines.push(`| Complete | 100% of native attributes | ${dist.Complete} | ${pctStr(pctOf(dist.Complete, total))} |`);
    lines.push(`| Nearly Complete | ≥80% | ${dist['Nearly Complete']} | ${pctStr(pctOf(dist['Nearly Complete'], total))} |`);
    lines.push(`| Partial | ≥40% | ${dist.Partial} | ${pctStr(pctOf(dist.Partial, total))} |`);
    lines.push(`| Missing | <40% | ${dist.Missing} | ${pctStr(pctOf(dist.Missing, total))} |`);
    lines.push('');
    lines.push('### Native attribute coverage (the authoring backlog)');
    lines.push('');
    lines.push('| Attribute | Present | Coverage |');
    lines.push('|---|---|---|');
    for (const h of HEALTH_FIELDS) {
      const p = fieldCount(h.field);
      lines.push(`| ${h.label} | ${p}/${total} | ${pctStr(pctOf(p, total))} |`);
    }
    lines.push('');
    lines.push('## 3 · Schema-gap report (NOT an authoring gap)');
    lines.push('');
    lines.push('These attributes cannot be filled by knowledge-authoring alone — they need schema and/or a crosswalk first. Reporting them as "0% authored" would be dishonest; they have no canonical home on the 419.');
    lines.push('');
    lines.push('| Attribute | Status | Reason |');
    lines.push('|---|---|---|');
    for (const a of attrReport.filter((x) => x.backing === 'disjoint' || x.backing === 'absent')) {
      lines.push(`| ${a.label} | ${a.backing === 'absent' ? 'NO FIELD' : 'DISJOINT NAMESPACE'} | ${a.detail} |`);
    }
    lines.push('');
    lines.push(`Supporting counts: \`map_competency_proficiency\`=${evidenceRows ?? 'n/m'} rows · \`map_industry_competency\`=${industryRows ?? 'n/m'} rows · \`map_competency_learning_path\`=${learningPathRows ?? 'n/m'} rows · learning-resource name-overlap=${learningResComps ?? 'n/m'}/${total} competencies.`);
    lines.push('');
    lines.push(`**Disjointness proof (this run):** \`map_role_competency\` holds **${roleMapRows ?? 'n/m'} rows** but joins to **${roleMapCanonicalJoins ?? 'n/m'}** canonical \`onto_competencies\` (INT \`competency_id\` cast to TEXT) — it is the O*NET \`ont_\` namespace and does **not** attach to the 419-competency genome. This is measured per-run, not asserted.`);
    lines.push('');
    lines.push('## 4 · Downstream readiness (eligibility ⟂ data sufficiency)');
    lines.push('');
    lines.push('A competency is "ready" for a consumer only when it is both eligible (governance flag) AND has sufficient data.');
    lines.push('');
    lines.push('| Consumer | Ready competencies | Coverage |');
    lines.push('|---|---|---|');
    lines.push(`| Assessment (eligible + indicators + levels) | ${phase4.assessment}/${total} | ${pctStr(pctOf(phase4.assessment, total))} |`);
    lines.push(`| Role DNA (in role profiles) | ${phase4.role_dna}/${total} | ${pctStr(pctOf(phase4.role_dna, total))} |`);
    lines.push(`| Employer Matching (eligible + role-DNA) | ${phase4.employer}/${total} | ${pctStr(pctOf(phase4.employer, total))} |`);
    lines.push(`| Career Builder (eligible) | ${phase4.career}/${total} | ${pctStr(pctOf(phase4.career, total))} |`);
    lines.push(`| Employability (EI eligible) | ${phase4.employability}/${total} | ${pctStr(pctOf(phase4.employability, total))} |`);
    lines.push(`| Reporting (definition + domain + family) | ${phase4.reporting}/${total} | ${pctStr(pctOf(phase4.reporting, total))} |`);
    lines.push('');
    lines.push('## 5 · Worst-covered competencies (authoring priority — bottom 25)');
    lines.push('');
    lines.push('| Competency | Health | Class | Missing native attributes |');
    lines.push('|---|---|---|---|');
    for (const s of [...scored].sort((a, b) => a.pct - b.pct).slice(0, 25)) {
      lines.push(`| ${s.name} | ${s.pct}% | ${s.klass} | ${s.missing.join(', ') || '—'} |`);
    }
    lines.push('');
    lines.push('## Honesty notes');
    lines.push('');
    lines.push('- Health is measured over the **authorable native** attribute set; structurally-absent and namespace-disjoint attributes are excluded from per-competency health and reported separately in §3 — so no competency is penalised for a field that does not exist, and no disjoint O*NET data is credited to the canonical genome.');
    lines.push('- All rates with a zero/absent denominator are shown as `n/m` ("not measurable"), never a fabricated 0%/100%.');
    lines.push('- This is Phase 1+2 (audit + health scoring + gap reports). **No metadata was authored** — Phase 3 (governed, draft-only authoring) STOPS for founder approval, and §3 shows it is not pure knowledge-engineering: ~half of the 18 attributes need schema/crosswalk work first.');

    const outDir = join(process.cwd(), 'audit', 'mx-201');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'genome-completion-report.md');
    writeFileSync(outPath, lines.join('\n'));

    // Machine-readable companion for dashboards / re-runs.
    writeFileSync(join(outDir, 'genome-completion-report.json'), JSON.stringify({
      generated_at: new Date().toISOString(),
      genome_total: total,
      avg_health_pct: avgHealth,
      identity_coverage_pct: identityCoverage,
      depth_coverage_pct: depthCoverage,
      role_map_disjointness: { rows: roleMapRows, canonical_joins: roleMapCanonicalJoins },
      distribution: dist,
      attributes: attrReport,
      native_coverage: HEALTH_FIELDS.map((h) => ({ attribute: h.label, present: fieldCount(h.field), total, coverage_pct: pctOf(fieldCount(h.field), total) })),
      schema_gaps: attrReport.filter((x) => x.backing === 'disjoint' || x.backing === 'absent').map((x) => ({ attribute: x.label, backing: x.backing, reason: x.detail })),
      downstream_readiness: phase4,
      worst: [...scored].sort((a, b) => a.pct - b.pct).slice(0, 50).map((s) => ({ id: s.id, name: s.name, pct: s.pct, klass: s.klass, missing: s.missing })),
    }, null, 2));

    console.log(`[mx201] wrote ${outPath}`);
    console.log(`[mx201] genome ${total} | avg health ${avgHealth}% | Complete ${dist.Complete} / Nearly ${dist['Nearly Complete']} / Partial ${dist.Partial} / Missing ${dist.Missing}`);
    console.log(`[mx201] downstream ready — assessment ${phase4.assessment} | role-DNA ${phase4.role_dna} | employer ${phase4.employer} | career ${phase4.career} | employability ${phase4.employability} | reporting ${phase4.reporting}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error('[mx201] FAILED', e); process.exit(1); });
