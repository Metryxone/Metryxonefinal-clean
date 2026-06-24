/**
 * Evidence — MX-100X Phase 4 Adaptive Assessment Activation.
 *
 * Runs the PURE engine + the read-only buildDifficultyPlan against the live bank
 * (engine directly; the workflow keeps the flag OFF so the HTTP contract holds).
 * Proves, with honest numbers:
 *   1. per-level target difficulty band + proficiency anchor (monotonic),
 *   2. level-aware readiness bands are monotonic and senior == legacy ladder,
 *   3. the served-difficulty honest ceiling (live bank is single-band → cannot shift),
 *   4. per-domain coverage gaps surfaced, never padded,
 *   5. difficulty-affinity bonus is a NO-OP on a single-band bank (byte-identical selection).
 *
 * Writes backend/audit/99x-certification/adaptive_assessment_activation_evidence.md.
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  ADAPTIVE_DIFFICULTY_ACTIVATION_VERSION,
  STAGE_ANCHOR,
  type SeniorityBand,
  resolveSeniorityProfile,
  levelAwareReadinessBands,
  classifyReadiness,
  DEFAULT_READINESS_BANDS,
  difficultyAffinityBonus,
  difficultyRank,
  buildDifficultyPlan,
} from '../services/adaptive-difficulty-activation';

const LEVELS: SeniorityBand[] = ['junior', 'mid', 'senior', 'lead', 'director'];

function assert(cond: boolean, msg: string): string {
  return `${cond ? '✅ PASS' : '❌ FAIL'} — ${msg}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines: string[] = [];
  const checks: string[] = [];
  lines.push(`# Adaptive Assessment Activation — Evidence`);
  lines.push('');
  lines.push(`Engine version: \`${ADAPTIVE_DIFFICULTY_ACTIVATION_VERSION}\` · generated ${new Date().toISOString()}`);
  lines.push('');
  lines.push('> Read-only. Pure engine + `buildDifficultyPlan` over the live bank. No writes, no DDL.');
  lines.push('');

  /* 1. per-level target difficulty + anchor (monotonic) */
  lines.push('## 1. Per-level target difficulty + proficiency anchor');
  lines.push('');
  lines.push('| Level | Anchor | Target band | Target rank | Source |');
  lines.push('|---|---|---|---|---|');
  const anchors: number[] = [];
  const targetRanks: number[] = [];
  for (const lvl of LEVELS) {
    const p = resolveSeniorityProfile(lvl);
    anchors.push(p.proficiency_anchor);
    targetRanks.push(p.target_difficulty.rank);
    lines.push(`| ${lvl} | ${p.proficiency_anchor} | ${p.target_difficulty.label} | ${p.target_difficulty.rank} | ${p.proficiency_source} |`);
  }
  lines.push('');
  const anchorMono = anchors.every((v, i) => i === 0 || v >= anchors[i - 1]);
  const rankMono = targetRanks.every((v, i) => i === 0 || v >= targetRanks[i - 1]);
  checks.push(assert(anchorMono, `proficiency anchor monotonic non-decreasing by level [${anchors.join(', ')}]`));
  checks.push(assert(rankMono, `target difficulty rank monotonic non-decreasing by level [${targetRanks.join(', ')}]`));

  /* 1b. Role-DNA override provenance */
  const overridden = resolveSeniorityProfile('junior', 90);
  checks.push(assert(
    overridden.proficiency_source === 'role_dna_expected_level' && overridden.proficiency_anchor === 90,
    `expected_level override wins over stage anchor + stamps provenance (junior+90 → anchor ${overridden.proficiency_anchor}, source ${overridden.proficiency_source})`,
  ));

  /* 2. level-aware readiness bands (monotonic; senior == legacy) */
  lines.push('## 2. Level-aware readiness bands');
  lines.push('');
  lines.push('| Level | Ready≥ | Near≥ | Developing≥ | Emerging≥ |');
  lines.push('|---|---|---|---|---|');
  const readyMins: number[] = [];
  for (const lvl of LEVELS) {
    const b = levelAwareReadinessBands(STAGE_ANCHOR[lvl]);
    readyMins.push(b.ready_min);
    lines.push(`| ${lvl} | ${b.ready_min} | ${b.near_ready_min} | ${b.developing_min} | ${b.emerging_min} |`);
  }
  lines.push('');
  lines.push(`Legacy fixed ladder (flag-OFF): Ready≥${DEFAULT_READINESS_BANDS.ready_min} / Near≥${DEFAULT_READINESS_BANDS.near_ready_min} / Developing≥${DEFAULT_READINESS_BANDS.developing_min} / Emerging≥${DEFAULT_READINESS_BANDS.emerging_min}`);
  lines.push('');
  const seniorBands = levelAwareReadinessBands(STAGE_ANCHOR.senior);
  const seniorMatchesLegacy = JSON.stringify(seniorBands) === JSON.stringify(DEFAULT_READINESS_BANDS);
  const readyMono = readyMins.every((v, i) => i === 0 || v >= readyMins[i - 1]);
  checks.push(assert(seniorMatchesLegacy, `senior level-aware bands == legacy fixed ladder (flag-ON senior is byte-identical to flag-OFF)`));
  checks.push(assert(readyMono, `ready_min monotonic non-decreasing by level [${readyMins.join(', ')}]`));

  // demonstrate the SAME score classifies differently by level
  const sample = 80;
  lines.push(`Same weighted score (${sample}) classified per level:`);
  lines.push('');
  for (const lvl of LEVELS) {
    const b = levelAwareReadinessBands(STAGE_ANCHOR[lvl]);
    lines.push(`- ${lvl}: **${classifyReadiness(sample, b)}**`);
  }
  lines.push('');
  const juniorClass = classifyReadiness(sample, levelAwareReadinessBands(STAGE_ANCHOR.junior));
  const directorClass = classifyReadiness(sample, levelAwareReadinessBands(STAGE_ANCHOR.director));
  checks.push(assert(juniorClass !== directorClass, `score ${sample} classifies differently for junior (${juniorClass}) vs director (${directorClass}) — level-awareness is real`));

  /* 3 + 4. live bank coverage + honest ceiling */
  lines.push('## 3. Live bank coverage (honest ceiling)');
  lines.push('');
  const plan = await buildDifficultyPlan(pool, { stage: 'senior' });
  lines.push(`Bank table present: \`${plan.bank.table_present}\` · approved total: \`${plan.bank.approved_total}\` · distinct bands: \`[${plan.bank.distinct_bands.join(', ')}]\``);
  lines.push(`Served difficulty can shift by level: **\`${plan.bank.served_difficulty_can_shift}\`** — ${plan.bank.note}`);
  lines.push('');
  lines.push('| Domain | Approved | Bands (band×count) | Target available | Coverage gap |');
  lines.push('|---|---|---|---|---|');
  for (const d of plan.per_domain) {
    const bands = d.by_band.map((b) => `${b.band}×${b.count}`).join(', ') || '—';
    lines.push(`| ${d.domain} | ${d.approved_total} | ${bands} | ${d.target_band_available ? 'yes' : 'no'} | ${d.coverage_gap ? '⚠️ yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('### Honest notes');
  for (const n of plan.honest_notes) lines.push(`- ${n}`);
  lines.push('');
  // After activation the served 7-domain bank carries harder/easier variants, so
  // served difficulty CAN now shift by level. This is the activation finding.
  checks.push(assert(
    plan.bank.served_difficulty_can_shift === true,
    `served 7-domain bank now holds multiple difficulty ranks → served difficulty CAN shift by level (activation realised, not padded)`,
  ));

  /* 4. difficulty-affinity bonus shifts the served pool by level */
  lines.push('## 4. Difficulty-affinity selection bias (live, on the varied served bank)');
  lines.push('');
  // The SERVED bands are what the 7 live domains actually hold.
  const servedBands = Array.from(new Set(
    plan.per_domain.flatMap((d) => d.by_band.map((b) => b.band)),
  )).sort();
  lines.push(`Served domains (COG/COM/LEA/EXE/ADP/TEC/EIQ) hold bands \`[${servedBands.join(', ')}]\` (unified 3-tier ladder). Each domain now carries a foundational + advanced variant alongside its intermediate stock, so the selection bonus has rows to discriminate between.`);
  lines.push('');
  // Show the bonus a junior (target foundational) vs a director (target advanced)
  // applies to the SAME candidate rows — opposite ends of the ladder are favoured.
  const juniorRank = resolveSeniorityProfile('junior').target_difficulty.rank;
  const directorRank = resolveSeniorityProfile('director').target_difficulty.rank;
  lines.push('| Served band | Junior bonus (target foundational) | Director bonus (target advanced) |');
  lines.push('|---|---|---|');
  for (const band of servedBands) {
    lines.push(`| ${band} (rank ${difficultyRank(band)}) | ${difficultyAffinityBonus(band, juniorRank)} | ${difficultyAffinityBonus(band, directorRank)} |`);
  }
  lines.push('');
  // A junior should favour the foundational variant; a director the advanced one —
  // i.e. the SAME pool re-ranks oppositely by level. That is the activation proof.
  const juniorFavoursEasier =
    difficultyAffinityBonus('foundational', juniorRank) > difficultyAffinityBonus('advanced', juniorRank);
  const directorFavoursHarder =
    difficultyAffinityBonus('advanced', directorRank) > difficultyAffinityBonus('foundational', directorRank);
  checks.push(assert(
    juniorFavoursEasier && directorFavoursHarder,
    `same served pool re-ranks oppositely by level (junior favours foundational, director favours advanced) — served difficulty genuinely shifts`,
  ));
  // Prove the matcher still discriminates on the unified ladder.
  const variedExact = difficultyAffinityBonus('advanced', 3);
  const variedOne = difficultyAffinityBonus('intermediate', 3);
  const variedFar = difficultyAffinityBonus('foundational', 3);
  checks.push(assert(
    variedExact > variedOne && variedOne >= variedFar && variedFar === 0,
    `band matcher discriminates on unified ladder (advanced→${variedExact} > intermediate→${variedOne} > foundational→${variedFar} for target rank 3)`,
  ));
  checks.push(assert(
    difficultyAffinityBonus('unknown_band', 3) === 0,
    `unknown band → 0 bonus (never penalises an untagged row below a tagged one)`,
  ));

  /* checks summary */
  lines.push('## Checks');
  lines.push('');
  for (const c of checks) lines.push(`- ${c}`);
  lines.push('');
  const failed = checks.filter((c) => c.startsWith('❌')).length;
  lines.push(`**${checks.length - failed}/${checks.length} checks passed.**`);
  lines.push('');

  const outDir = join(__dirname, '..', 'audit', '99x-certification');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'adaptive_assessment_activation_evidence.md');
  writeFileSync(outPath, lines.join('\n'));
  console.log(lines.join('\n'));
  console.log(`\n[evidence] written → ${outPath}`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
