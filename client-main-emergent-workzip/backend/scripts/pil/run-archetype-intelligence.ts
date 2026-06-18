/**
 * CAPADEX PIL — Phase 2 runner: Archetype Intelligence Engine (thin wrapper).
 *
 *   Sub-phases (now owned by the shared pipeline `services/pil/archetype-pipeline.ts`):
 *   2A load read-only inputs → 2B per-concern relationship context → 2C deterministic
 *   archetype assignment → 2C.2 (Phase 2.2) re-apply durable human governance decisions
 *   as an override layer → 2D behavior profile → 2E concern-family roll-up → 2F validation
 *   + discovery readiness → 2G unmatched review. This file keeps ONLY the CSV artifacts +
 *   console audit; compute + persist are shared with the governance API so they can never
 *   drift. Active governance decisions are re-applied EVERY run (survives re-runs); zero
 *   decisions → byte-identical to Phase 2.1.
 *
 * ADDITIVE & SAFE: reads ONLY the Phase-1.5/1.6 extension tables; writes ONLY the six
 * Phase-2 extension tables (+ never truncates archetype_governance_decisions).
 * Pass --dry-run to compute + export CSVs + print the audit WITHOUT touching the DB.
 *
 *   npx tsx backend/scripts/pil/run-archetype-intelligence.ts [--dry-run]
 *
 * NO interventions / coaching / search-intents / recommendations (Phase-2 boundary).
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHETYPES } from '../../services/pil/archetype-intelligence-engine.js';
import {
  computeArchetypeResult, persistArchetypeResult, type ArchetypeComputeResult,
} from '../../services/pil/archetype-pipeline.js';
import { ensureGovernanceSchema, listActiveDecisions } from '../../services/pil/archetype-governance.js';

const DRY_RUN = process.argv.includes('--dry-run');
const OUT_DIR = join(process.cwd(), 'audit', 'pil_phase2');

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]): void {
  const body = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
  writeFileSync(join(OUT_DIR, file), body + '\n', 'utf8');
}
function pct(n: number, total: number): string {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
}

function writeArtifacts(r: ArchetypeComputeResult): void {
  writeCsv('archetype_library.csv',
    ['archetype_key', 'archetype_name', 'definition', 'primary_behavior_category', 'stage_note', 'member_count', 'capability_count', 'problem_count', 'behavior_grounded_count', 'signature_tokens'],
    r.libRows.map((x) => [x.key, x.name, x.def, x.primary, x.stage, x.members, x.caps, x.probs, x.grounded, x.tokens.join('|')]));
  writeCsv('archetype_concern_map.csv',
    ['concern_id', 'concern_name', 'canonical_type', 'archetype_key', 'assignment_score', 'token_matches', 'assignment_method', 'grounding_source', 'governed'],
    r.assignments.filter((a) => a.archetypeKey).map((a) => { const ctx = r.ctxOf.get(a.concernId)!; return [a.concernId, ctx.concernName, ctx.canonicalType, a.archetypeKey, a.score, a.tokenMatches, a.method, a.grounding, r.governedIds.has(a.concernId)]; }));
  writeCsv('archetype_behavior_profile.csv',
    ['archetype_key', 'behavior_category', 'behavior_count', 'pct'],
    r.profileRows.map((x) => [x.key, x.category, x.count, x.pct]));
  writeCsv('archetype_validation.csv',
    ['archetype_key', 'member_count', 'capability_count', 'problem_count', 'behavior_grounded_count', 'coherence', 'distinctiveness', 'validation_status', 'notes', 'grounding_ceiling', 'weak_reason', 'stabilization_recommendation'],
    r.valRows.map((x) => [x.key, x.members, x.caps, x.probs, x.grounded, x.coherence, x.distinct, x.status, x.notes, x.ceiling, x.weakReason ?? '', x.recommendation]));
  writeCsv('archetype_unmatched_review.csv',
    ['concern_id', 'concern_name', 'canonical_type', 'best_archetype_key', 'best_score', 'reason'],
    r.unmatchedRows.map((x) => [x.id, x.name, x.type, x.bestKey, x.bestScore, x.reason]));
  writeCsv('archetype_family_map.csv',
    ['family_name', 'archetype_key', 'concern_count', 'family_total', 'share_pct', 'is_primary'],
    r.famMapRows.map((x) => [x.family, x.key, x.count, x.total, x.share, x.primary]));
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await ensureGovernanceSchema(pool);
  const decisions = await listActiveDecisions(pool);
  const r = await computeArchetypeResult(pool, decisions);
  const ic = r.inputCounts;
  console.log(`\n[PIL 2] read ${ic.ontology} concerns, ${ic.capPairs} cap↔problem pairs, ${ic.families} families, ${ic.simPairs} similarity pairs, behaviors for ${ic.behaviorGroundedConcerns} concerns, coverage for ${ic.familyCoverage} families (read-only)`);
  console.log(`[PIL 2.2] ${decisions.length} active governance decision(s) re-applied: reassign ${r.governance.reassign}, resolve ${r.governance.resolve_unmatched}, reject ${r.governance.reject}, approve ${r.governance.approve}, skipped ${r.governance.skipped}`);

  writeArtifacts(r);
  if (!DRY_RUN) await persistArchetypeResult(pool, r);

  const tag = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`\n${tag}=== PHASE 2 — ARCHETYPE INTELLIGENCE AUDIT ===`);
  console.log(`\nDiscovered ${ARCHETYPES.length} archetypes explaining ${r.assignedCount}/${r.total} concerns (${r.unmatchedCount} unmatched, flagged for review).`);

  console.log('\n## Archetype Set (by member count)');
  const sortedLib = [...r.libRows].sort((a, b) => b.members - a.members);
  for (const x of sortedLib) console.log(`  ${String(x.members).padStart(4)}  [${x.primary.padEnd(15)}]  ${x.name}`);

  console.log('\n## Archetype Distribution (members by canonical type)');
  const typeByArch = new Map<string, Record<string, number>>();
  for (const a of r.assignments) {
    if (!a.archetypeKey) continue;
    const ctx = r.ctxOf.get(a.concernId)!;
    const m = typeByArch.get(a.archetypeKey) ?? {};
    m[ctx.canonicalType] = (m[ctx.canonicalType] ?? 0) + 1;
    typeByArch.set(a.archetypeKey, m);
  }
  for (const x of sortedLib) {
    const m = typeByArch.get(x.key) ?? {};
    const parts = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(' ');
    console.log(`  ${x.name.padEnd(42)} ${parts}`);
  }

  console.log('\n## Coverage Audit');
  console.log(`  Concerns assigned to an archetype: ${r.assignedCount}/${r.total}  ${pct(r.assignedCount, r.total)}`);
  console.log(`  Concerns unmatched (flagged):      ${r.unmatchedCount}/${r.total}  ${pct(r.unmatchedCount, r.total)}`);
  console.log(`    of which no construct-token anchor: ${r.noAnchor}`);
  console.log(`  Behavior-grounded members:         ${[...r.groundedByArch.values()].reduce((s, n) => s + n, 0)}/${r.assignedCount}`);
  console.log(`  Mean intra-archetype coherence:    ${r.meanCoherence.toFixed(3)}`);
  console.log(`  Member balance (1=even):           ${r.balance.toFixed(3)}`);

  console.log('\n## Relationship Grounding (how each assignment is justified)');
  console.log(`  direct C/P/B framing:   ${r.groundingCounts.direct_cpb}/${r.assignedCount}  ${pct(r.groundingCounts.direct_cpb, r.assignedCount)}`);
  console.log(`  propagated (graph):     ${r.groundingCounts.propagated}/${r.assignedCount}  ${pct(r.groundingCounts.propagated, r.assignedCount)}`);
  console.log(`  name-only (no relation):${r.groundingCounts.name_only}/${r.assignedCount}  ${pct(r.groundingCounts.name_only, r.assignedCount)}`);
  console.log(`  → relationship-grounded: ${r.relationshipGrounded}/${r.assignedCount}  (${(r.relationshipGrounding * 100).toFixed(1)}%)`);

  console.log('\n## Similarity Capture (top-down library vs bottom-up similarity)');
  console.log(`  Similarity pairs with both ends assigned: ${r.cap.evaluated}/${ic.simPairs}`);
  console.log(`  Captured in the SAME archetype:           ${r.cap.captured}  (${pct(r.cap.captured, r.cap.evaluated)})`);
  console.log(`  Concern families fragmented across ≥2 archetypes: ${r.fragmentedFamilies}/${ic.families}`);

  console.log('\n## Validation Status (by archetype)');
  console.log(`  strong: ${r.statusCounts.strong}   moderate: ${r.statusCounts.moderate}   weak: ${r.statusCounts.weak}`);

  console.log('\n## Discovery Readiness Score');
  console.log(`  ${r.readiness} / 100`);
  console.log('    (25% coverage · 25% relationship grounding · 20% similarity capture · 20% mean coherence · 10% balance)');

  console.log(`\nCSV artifacts → ${OUT_DIR}`);
  console.log(DRY_RUN ? '[DRY-RUN] no DB writes performed.\n' : '[WRITE] persisted to 6 Phase-2 extension tables.\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
